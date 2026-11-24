using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Reabrir la revisión de un Festival rechazado y comparar dos copias, <b>contra SQL Server</b> (T2).
/// </summary>
/// <remarks>
/// <para>
/// Contra el motor real porque lo que se escribe al reabrir toca las mismas restricciones que el resto
/// del circuito y que SQLite no tiene: <c>CK_RegistrosRevisionHistorial_EstadoNuevo</c> para la fila
/// de historial, <c>CK_BitacoraAuditoria_Accion</c> para la bitácora y la clave foránea de estados
/// del Festival. La prueba hermana de SQLite (<see cref="ReabrirRevisionYCompararCopiasTests"/>) cubre
/// las reglas; esta demuestra que lo escrito cabe en la base.
/// </para>
/// <para>
/// La comparación solo lee, pero se prueba aquí junto a la fusión que anuncia: sus consultas se
/// traducen a SQL y las diferencias de motor se ven en un 500, no en un fallo de aserción.
/// </para>
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class ReabrirRevisionDeFestivalSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private const string ClaveFuncionario = "ReabrirRevision123";
    private const string EventoReabierto = "FestivalRevisionReabierta";

    private readonly SqlServerFixture _base;

    public ReabrirRevisionDeFestivalSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task Un_Festival_rechazado_vuelve_a_revision_y_lo_escrito_cabe_en_la_base()
    {
        var correoAgrupacion = $"agrupacion.reabrir.{Guid.NewGuid():N}@example.com";
        var (departamento, municipio) = await TerritorioRealAsync();

        // La organización envía su Festival a revisión.
        using var agrupacion = _base.CrearCliente();
        (await agrupacion.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización de prueba reabrir",
            FullName = "Responsable de reabrir",
            NumeroDocumento = "1020304060",
            HeadquartersDepartmentCode = departamento,
            HeadquartersMunicipalityCode = municipio,
            Phone = "3000000060",
            Email = correoAgrupacion,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await agrupacion.PostAsJsonAsync("/api/v1/externo/auth/login",
            new ExternalLoginRequest { Email = correoAgrupacion, Password = Clave })).EnsureSuccessStatusCode();
        var organizacion = await OrganizacionDeLaCuenta.PrepararAsync(
            agrupacion, nombre: "Agrupación a reabrir", correoContacto: "contacto@agrupacion-reabrir.test", departamento: departamento, municipio: municipio);
        var festival = await CrearAsync<FestivalBorradorDto>(agrupacion, $"/api/v1/externo/organizaciones/{organizacion.Id}/festivales", new
        {
            nombre = "Festival que se rechaza y se reabre",
            descripcion = "Festival sembrado para comprobar que la revisión se reabre contra el motor real.",
            nivelCobertura = "municipal",
            codigoDepartamento = departamento,
            codigoMunicipio = municipio,
        });
        var enviar = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/externo/festivales/{festival.Id}/enviar-a-revision") { Content = JsonContent.Create(new { }) };
        enviar.Headers.Add("X-CSRF-TOKEN", await CsrfExternoAsync(agrupacion));
        Assert.Equal(HttpStatusCode.OK, (await agrupacion.SendAsync(enviar)).StatusCode);

        // Quien revisa lo rechaza.
        using var consola = await IniciarConsolaAsync();
        var rechazo = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/institucional/festivales/{festival.Id}/decisiones")
        {
            Content = JsonContent.Create(new { accion = "Rechazar", motivoRechazo = "No se pudo comprobar el municipio." }),
        };
        rechazo.Headers.Add("X-CSRF-TOKEN", await CsrfInstitucionalAsync(consola));
        Assert.Equal(HttpStatusCode.OK, (await consola.SendAsync(rechazo)).StatusCode);
        Assert.Equal(EstadosFestival.Rechazado, await EstadoAsync(festival.Id));

        // SIN MOTIVO NO SE REABRE.
        var sinMotivo = await ReabrirAsync(consola, festival.Id, "");
        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);
        Assert.Equal(EstadosFestival.Rechazado, await EstadoAsync(festival.Id));

        // CON MOTIVO, VUELVE A REVISIÓN. Antes de escribir bien la fila de historial y la de
        // bitácora, este 200 era un 500: los dos CHECK rechazan lo que no conocen.
        var reabrir = await ReabrirAsync(consola, festival.Id, "La organización aportó el acto de creación del Festival.");
        Assert.Equal(HttpStatusCode.OK, reabrir.StatusCode);
        Assert.Equal(EstadosFestival.EnRevision, await EstadoAsync(festival.Id));

        // NO SE REABRE DOS VECES: ya no está rechazado.
        Assert.Equal(HttpStatusCode.Conflict, (await ReabrirAsync(consola, festival.Id, "Otra vez.")).StatusCode);

        // Lo escrito, leído del motor y no del contexto de EF.
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var historial = await db.HistorialesRevisionRegistros.AsNoTracking()
            .SingleAsync(x => x.ModuloId == Modulos.Festivales && x.RegistroId == festival.Id && x.Accion == EventoReabierto);
        Assert.Equal(EstadosFestival.Rechazado, historial.EstadoAnterior);
        Assert.Equal(EstadosFestival.EnRevision, historial.EstadoNuevo);
        Assert.Equal("La organización aportó el acto de creación del Festival.", historial.Comentario);
        var auditoria = await db.AuditLogs.AsNoTracking()
            .SingleAsync(x => x.TableName == "Festivales" && x.RecordId == festival.Id && x.NewValuesJson!.Contains(EventoReabierto));
        Assert.Equal(AccionesAuditoria.Actualizar, auditoria.Action);
        var cambio = await db.CambiosDeRegistro.AsNoTracking()
            .SingleAsync(x => x.ModuloId == Modulos.Festivales && x.RegistroId == festival.Id);
        Assert.Equal("estado", cambio.CampoId);
        Assert.Equal(EstadosFestival.Rechazado, cambio.ValorAnterior);
        Assert.Equal(EstadosFestival.EnRevision, cambio.ValorNuevo);
        Assert.Equal("La organización aportó el acto de creación del Festival.", cambio.Motivo);
        Assert.Contains(await db.Notifications.AsNoTracking().ToListAsync(),
            x => x.RecordId == festival.Id && x.EventType == EventoReabierto && x.RecipientEmail == correoAgrupacion);

        // Y quien revisa decide de nuevo, con los botones de siempre.
        var publicar = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/institucional/festivales/{festival.Id}/decisiones")
        {
            Content = JsonContent.Create(new { accion = "Publicar" }),
        };
        publicar.Headers.Add("X-CSRF-TOKEN", await CsrfInstitucionalAsync(consola));
        Assert.Equal(HttpStatusCode.OK, (await consola.SendAsync(publicar)).StatusCode);
        Assert.Equal(EstadosFestival.Publicado, await EstadoAsync(festival.Id));
    }

    [HechoSqlServer]
    public async Task La_comparacion_se_lee_contra_el_motor_y_anuncia_lo_que_la_fusion_hace()
    {
        var (departamento, municipio) = await TerritorioRealAsync();
        using var consola = await IniciarConsolaAsync();
        var conservado = await AltaHistoricaAsync(consola, "Muestra Andina de Cuerdas", departamento, municipio, descripcion: "Muestra de cuerdas andinas.", correo: null);
        var absorbido = await AltaHistoricaAsync(consola, "Muestra Andina de Cuerdas (copia)", departamento, municipio, descripcion: "Otra redacción de la muestra.", correo: "cuerdas@historico.test");

        var respuesta = await consola.GetAsync($"/api/v1/admin/festivales/{conservado}/fusion/comparar?con={absorbido}");
        Assert.True(respuesta.StatusCode == HttpStatusCode.OK, $"Comparar respondió {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");
        var comparacion = (await respuesta.Content.ReadFromJsonAsync<ComparacionDeCopiasDto>())!;

        Assert.Null(comparacion.CodigoBloqueo);
        CampoComparadoDto Campo(string clave) => Assert.Single(comparacion.Campos, x => x.Clave == clave);
        Assert.Equal("conserva", Campo("descripcion").Resultado);
        Assert.Equal("Muestra de cuerdas andinas.", Campo("descripcion").QuedaAsi);
        Assert.Equal("completa", Campo("correoContacto").Resultado);
        Assert.Equal("igual", Campo("municipio").Resultado);
        Assert.False(string.IsNullOrWhiteSpace(Campo("municipio").EnLoQueSeConserva));

        // La copia no cambia por mirarla…
        Assert.Equal(EstadosFestival.Publicado, await EstadoAsync(absorbido.ToString(CultureInfo.InvariantCulture)));

        // …y lo anunciado es lo que la fusión hace.
        var token = await consola.GetFromJsonAsync<TokenAntiforgeryRespuesta>("/api/v1/admin/csrf");
        var fusion = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/festivales/{conservado}/fusion")
        {
            Content = JsonContent.Create(new { absorbidoId = absorbido.ToString(CultureInfo.InvariantCulture), motivo = "Dos fuentes del mismo Festival." }),
        };
        fusion.Headers.Add("X-CSRF-TOKEN", token!.RequestToken);
        var resultado = await consola.SendAsync(fusion);
        Assert.True(resultado.StatusCode == HttpStatusCode.OK, $"Fusionar respondió {(int)resultado.StatusCode}: {await resultado.Content.ReadAsStringAsync()}");
        var hecho = (await resultado.Content.ReadFromJsonAsync<ResultadoDeFusionDto>())!;
        Assert.Equal(comparacion.Traslado.Ediciones, hecho.Ediciones);
        Assert.Equal(comparacion.Traslado.Clasificaciones, hecho.Clasificaciones);
        Assert.Equal(
            comparacion.Campos.Where(x => x.Resultado == "completa").Select(x => x.Etiqueta).Order().ToList(),
            hecho.DatosCompletados.Order().ToList());
    }

    // ---------- Andamio ---------------------------------------------------------------------

    private static async Task<HttpResponseMessage> ReabrirAsync(HttpClient consola, string festivalId, string motivo)
    {
        var mensaje = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/institucional/festivales/{festivalId}/reabrir-revision")
        {
            Content = JsonContent.Create(new { motivo }),
        };
        mensaje.Headers.Add("X-CSRF-TOKEN", await CsrfInstitucionalAsync(consola));
        return await consola.SendAsync(mensaje);
    }

    private async Task<string?> EstadoAsync(string festivalId) => Convert.ToString(await _base.EscalarAsync(
        $"SELECT EstadoRegistro FROM dbo.Festivales WHERE IdFestival = {int.Parse(festivalId, CultureInfo.InvariantCulture)};"));

    /// <summary>Un Festival histórico dado de alta desde la consola, sin organización: nace publicado.</summary>
    private static async Task<int> AltaHistoricaAsync(
        HttpClient consola, string nombre, string departamento, string municipio, string descripcion, string? correo)
    {
        var token = await consola.GetFromJsonAsync<TokenAntiforgeryRespuesta>("/api/v1/admin/csrf");
        var alta = new HttpRequestMessage(HttpMethod.Post, "/api/v1/admin/festivales")
        {
            Content = JsonContent.Create(new
            {
                festival = new
                {
                    nombre,
                    descripcion,
                    correoContacto = correo,
                    nivelCobertura = "municipal",
                    codigoDepartamento = departamento,
                    codigoMunicipio = municipio,
                    practicasMusicalesIds = Array.Empty<int>(),
                    territoriosSonorosIds = Array.Empty<int>(),
                },
                organizacionResponsableId = (int?)null,
            }),
        };
        alta.Headers.Add("X-CSRF-TOKEN", token!.RequestToken);
        var respuesta = await consola.SendAsync(alta);
        Assert.True(respuesta.StatusCode == HttpStatusCode.Created, $"Alta respondió {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");
        var creado = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        return int.Parse(creado.GetProperty("id").GetString()!, CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// La sesión de quien revisa: un webmaster sembrado en la base desechable, con su propia clave.
    /// También deja la entidad institucional, de la que dependen los históricos.
    /// </summary>
    private async Task<HttpClient> IniciarConsolaAsync()
    {
        var correo = $"reabrir.{Guid.NewGuid():N}@pnmc.local";
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var idWebmaster = await db.Roles.AsNoTracking().Where(x => x.Name == "webmaster").Select(x => x.Id).SingleAsync();
            var usuario = new UserRow { FullName = "Webmaster de reabrir", Email = correo, IsActive = true, CreatedAt = DateTime.UtcNow };
            usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, ClaveFuncionario);
            db.Users.Add(usuario);
            await db.SaveChangesAsync();
            await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);

            if (!await db.EntityProfiles.AnyAsync(x => x.IsInstitutional))
            {
                db.EntityProfiles.Add(new EntityProfileRow
                {
                    EntityType = "organizacion",
                    Name = "Plan Nacional de Música para la Convivencia",
                    StatusCode = "activa",
                    IsActive = true,
                    IsInstitutional = true,
                    CreatedByUserId = usuario.Id,
                    ResponsibleUserId = usuario.Id,
                    CreatedAt = DateTime.UtcNow,
                });
                await db.SaveChangesAsync();
            }
        }

        var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = correo, Password = ClaveFuncionario })).EnsureSuccessStatusCode();
        return cliente;
    }

    private async Task<(string Departamento, string Municipio)> TerritorioRealAsync()
    {
        var par = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio FROM dbo.Divipola "
            + "ORDER BY CodigoDepartamento, CodigoMunicipio;"));
        Assert.False(string.IsNullOrWhiteSpace(par),
            "dbo.Divipola esta vacia: sin territorio no se puede crear una organizacion ni un Festival.");
        var partes = par!.Split('|');
        return (partes[0], partes[1]);
    }

    private static async Task<string> CsrfExternoAsync(HttpClient cliente)
    {
        var respuesta = await cliente.GetAsync("/api/v1/externo/organizaciones/csrf");
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<ExternalCsrfTokenResponse>())!.RequestToken;
    }

    private static async Task<string> CsrfInstitucionalAsync(HttpClient cliente)
    {
        var respuesta = await cliente.GetAsync("/api/v1/institucional/festivales/csrf");
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<TokenAntiforgeryRespuesta>())!.RequestToken;
    }

    private static async Task<T> CrearAsync<T>(HttpClient cliente, string ruta, object cuerpo)
    {
        var mensaje = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", await CsrfExternoAsync(cliente));
        var respuesta = await cliente.SendAsync(mensaje);
        if (!respuesta.IsSuccessStatusCode)
        {
            Assert.Fail($"POST {ruta} respondió {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");
        }
        var creado = await respuesta.Content.ReadFromJsonAsync<T>();
        Assert.NotNull(creado);
        return creado!;
    }
}
