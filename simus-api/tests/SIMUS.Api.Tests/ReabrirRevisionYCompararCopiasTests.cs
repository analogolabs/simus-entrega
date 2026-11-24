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
/// T2: reabrir la revisión de un Festival rechazado y comparar dos copias antes de fusionar.
/// </summary>
/// <remarks>
/// <para>
/// <b>REABRIR.</b> «Rechazado» era un callejón sin salida en la consola. Estas pruebas fijan lo que
/// la salida hace y lo que no: devuelve a «en revisión» (y solo desde «rechazado»), exige el motivo y
/// el testigo, respeta el módulo y deja huella en el historial, la bitácora y el aviso a la
/// organización. La parte de SQL Server —los CHECK de historial y bitácora— está en
/// <see cref="ReabrirRevisionDeFestivalSqlServerTests"/>.
/// </para>
/// <para>
/// <b>COMPARAR.</b> La vista previa no puede prometer algo que la fusión no hace: la prueba central
/// compara lo que la comparación anuncia con lo que la fusión hace de verdad.
/// </para>
/// </remarks>
public sealed class ReabrirRevisionYCompararCopiasTests
{
    private const string Institucional = "/api/v1/institucional/festivales";
    private const string Admin = "/api/v1/admin/festivales";
    private static readonly string[] MotivosVacios = ["", "   "];
    private static readonly string[] SoloEcosistema = ["ecosistema"];

    // ---------- Reabrir la revisión ---------------------------------------------------------

    [Fact]
    public async Task Un_Festival_rechazado_vuelve_a_revision_con_historial_bitacora_y_aviso()
    {
        await using var factory = new TestWebApplicationFactory();
        var (festival, persona) = await RechazadoAsync(factory, conRemitente: true);
        var consola = await CmsTestClient.LoginAsync(factory);

        var respuesta = await consola.PostAsJsonAsync($"{Institucional}/{festival}/reabrir-revision",
            new { motivo = "La organización aclaró el municipio por correo." });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("EnRevision", cuerpo.GetProperty("estado").GetString());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal("en_revision", (await db.FestivalRecords.AsNoTracking().SingleAsync(x => x.Id == festival)).StatusCode);

        // El historial lo cuenta con su motivo, de «rechazado» a «en revisión».
        var historial = await consola.GetFromJsonAsync<JsonElement>($"{Institucional}/{festival}/historial");
        var entrada = Assert.Single(historial.EnumerateArray(), x => x.GetProperty("accion").GetString() == "FestivalRevisionReabierta");
        Assert.Equal("rechazado", entrada.GetProperty("estadoAnterior").GetString());
        Assert.Equal("en_revision", entrada.GetProperty("estadoNuevo").GetString());
        Assert.Equal("La organización aclaró el municipio por correo.", entrada.GetProperty("motivo").GetString());
        Assert.False(string.IsNullOrWhiteSpace(entrada.GetProperty("accionEtiqueta").GetString()));

        // La bitácora usa un verbo que admite la base (actualizar) y el evento viaja en el cuerpo.
        var auditoria = await db.AuditLogs.AsNoTracking()
            .SingleAsync(x => x.TableName == "Festivales" && x.RecordId == festival.ToString(CultureInfo.InvariantCulture)
                && x.NewValuesJson!.Contains("FestivalRevisionReabierta"));
        Assert.Equal(AccionesAuditoria.Actualizar, auditoria.Action);
        Assert.Contains("\"evento\":\"FestivalRevisionReabierta\"", auditoria.NewValuesJson, StringComparison.Ordinal);

        // EL CAMBIO DE ESTADO TAMBIÉN VA AL REGISTRO DE CAMBIOS (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md): qué valía, quién y por qué.
        var cambio = await db.CambiosDeRegistro.AsNoTracking()
            .SingleAsync(x => x.ModuloId == Modulos.Festivales && x.RegistroId == festival.ToString(CultureInfo.InvariantCulture));
        Assert.Equal("estado", cambio.CampoId);
        Assert.Equal("rechazado", cambio.ValorAnterior);
        Assert.Equal("en_revision", cambio.ValorNuevo);
        Assert.Equal("directo", cambio.Origen);
        Assert.Equal("La organización aclaró el municipio por correo.", cambio.Motivo);

        // La organización lo sabe, con el motivo.
        var aviso = await db.Notifications.AsNoTracking()
            .SingleAsync(x => x.EventType == "FestivalRevisionReabierta" && x.Channel == "internal");
        Assert.Equal(persona, aviso.RecipientUserId);
        Assert.Contains("La organización aclaró el municipio por correo.", aviso.Body, StringComparison.Ordinal);

        // Y vuelve a la bandeja, donde se decide como cualquier otro.
        var bandeja = await consola.GetFromJsonAsync<List<FestivalRevisionInstitucionalDto>>($"{Institucional}/en-revision");
        Assert.Contains(bandeja!, x => x.Id == festival.ToString(CultureInfo.InvariantCulture));
        var decision = await consola.PostAsJsonAsync($"{Institucional}/{festival}/decisiones", new { accion = "Publicar" });
        Assert.Equal(HttpStatusCode.OK, decision.StatusCode);
    }

    [Fact]
    public async Task Sin_motivo_no_se_reabre()
    {
        await using var factory = new TestWebApplicationFactory();
        var (festival, _) = await RechazadoAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);

        foreach (var motivo in MotivosVacios)
        {
            var respuesta = await consola.PostAsJsonAsync($"{Institucional}/{festival}/reabrir-revision", new { motivo });
            Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
            Assert.Contains("motivo", await respuesta.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        }

        Assert.Equal("rechazado", await EstadoAsync(factory, festival));
    }

    [Theory]
    [InlineData("borrador")]
    [InlineData("en_revision")]
    [InlineData("ajustes_solicitados")]
    [InlineData("publicado")]
    [InlineData("archivado")]
    public async Task Solo_un_Festival_rechazado_se_reabre(string estado)
    {
        await using var factory = new TestWebApplicationFactory();
        var (festival, _) = await RechazadoAsync(factory, estado: estado);
        var consola = await CmsTestClient.LoginAsync(factory);

        var respuesta = await consola.PostAsJsonAsync($"{Institucional}/{festival}/reabrir-revision", new { motivo = "Probar." });

        Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
        Assert.Equal(estado, await EstadoAsync(factory, festival));
    }

    [Fact]
    public async Task Un_Festival_que_no_existe_responde_404()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);

        var respuesta = await consola.PostAsJsonAsync($"{Institucional}/999999/reabrir-revision", new { motivo = "Probar." });

        Assert.Equal(HttpStatusCode.NotFound, respuesta.StatusCode);
    }

    [Fact]
    public async Task Sin_testigo_no_se_reabre()
    {
        await using var factory = new TestWebApplicationFactory();
        var (festival, _) = await RechazadoAsync(factory);
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var respuesta = await sinTestigo.PostAsJsonAsync($"{Institucional}/{festival}/reabrir-revision", new { motivo = "Sin testigo." });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Equal("rechazado", await EstadoAsync(factory, festival));
    }

    [Fact]
    public async Task Sin_el_modulo_de_Festivales_y_ediciones_no_se_reabre_y_con_el_si()
    {
        await using var factory = new TestWebApplicationFactory();
        var (festival, _) = await RechazadoAsync(factory);
        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);

        var sinModulo = await gestor.PostAsJsonAsync($"{Institucional}/{festival}/reabrir-revision", new { motivo = "Probar." });
        Assert.Equal(HttpStatusCode.Forbidden, sinModulo.StatusCode);
        Assert.Equal("rechazado", await EstadoAsync(factory, festival));

        var webmaster = await CmsTestClient.LoginAsync(factory);
        (await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloEcosistema })).EnsureSuccessStatusCode();

        var conModulo = await gestor.PostAsJsonAsync($"{Institucional}/{festival}/reabrir-revision", new { motivo = "Lo decide quien revisa." });
        Assert.Equal(HttpStatusCode.OK, conModulo.StatusCode);
        Assert.Equal("en_revision", await EstadoAsync(factory, festival));
    }

    // ---------- Comparar dos copias ---------------------------------------------------------

    [Fact]
    public async Task La_comparacion_anuncia_lo_mismo_que_la_fusion_hace()
    {
        await using var factory = new TestWebApplicationFactory();
        var (practicaA, practicaB) = await DosPracticasAsync(factory);
        var conservado = await HistoricoAsync(factory, "Muestra Andina de Cuerdas", ediciones: [2018, 2019], correo: null, practicas: [practicaA]);
        var absorbido = await HistoricoAsync(factory, "Muestra Andina de Cuerdas (copia)", ediciones: [2019, 2020], correo: "cuerdas@historico.test", practicas: [practicaA, practicaB]);
        var consola = await CmsTestClient.LoginAsync(factory);

        var comparacion = await consola.GetFromJsonAsync<ComparacionDeCopiasDto>($"{Admin}/{conservado}/fusion/comparar?con={absorbido}");

        Assert.NotNull(comparacion);
        Assert.Null(comparacion!.CodigoBloqueo);
        Assert.Equal("Muestra Andina de Cuerdas", comparacion.Conservado.Nombre);
        Assert.Equal("Muestra Andina de Cuerdas (copia)", comparacion.Absorbido.Nombre);
        Assert.Equal([2019, 2018], comparacion.Conservado.AniosDeEdiciones);
        Assert.Equal([2020, 2019], comparacion.Absorbido.AniosDeEdiciones);

        // Cada dato dice qué pasa con él.
        CampoComparadoDto Campo(string clave) => Assert.Single(comparacion.Campos, x => x.Clave == clave);
        Assert.Equal("conserva", Campo("nombre").Resultado);
        Assert.Equal("Muestra Andina de Cuerdas", Campo("nombre").QuedaAsi);
        Assert.Equal("igual", Campo("descripcion").Resultado);
        Assert.Equal("completa", Campo("correoContacto").Resultado);
        Assert.Equal("cuerdas@historico.test", Campo("correoContacto").QuedaAsi);
        Assert.Equal("vacio", Campo("instagram").Resultado);
        Assert.Equal("une", Campo("practicasMusicales").Resultado);
        Assert.Equal("vacio", Campo("territoriosSonoros").Resultado);

        // Lo que se traslada, y lo que las dos tienen en común.
        Assert.Equal(2, comparacion.Traslado.Ediciones);
        Assert.Equal(1, comparacion.Traslado.Clasificaciones);
        Assert.Equal([2019], comparacion.Traslado.AniosEnLasDos);

        // NO ESCRIBE NADA: la copia sigue publicada y sin fusionar.
        Assert.Equal("publicado", await EstadoAsync(factory, absorbido));

        // Y LO ANUNCIADO ES LO QUE PASA: se fusiona y se comparan los números.
        var fusion = await consola.PostAsJsonAsync($"{Admin}/{conservado}/fusion",
            new { absorbidoId = absorbido.ToString(CultureInfo.InvariantCulture), motivo = "Dos fuentes del mismo Festival." });
        Assert.Equal(HttpStatusCode.OK, fusion.StatusCode);
        var resultado = (await fusion.Content.ReadFromJsonAsync<ResultadoDeFusionDto>())!;
        Assert.Equal(comparacion.Traslado.Ediciones, resultado.Ediciones);
        Assert.Equal(comparacion.Traslado.Mercados, resultado.Mercados);
        Assert.Equal(comparacion.Traslado.Eventos, resultado.Eventos);
        Assert.Equal(comparacion.Traslado.Archivos, resultado.Archivos);
        Assert.Equal(comparacion.Traslado.Clasificaciones, resultado.Clasificaciones);
        Assert.Equal(comparacion.Traslado.Reclamaciones, resultado.Reclamaciones);
        Assert.Equal(
            comparacion.Campos.Where(x => x.Resultado == "completa").Select(x => x.Etiqueta).Order().ToList(),
            resultado.DatosCompletados.Order().ToList());
    }

    [Fact]
    public async Task La_comparacion_explica_el_bloqueo_cuando_la_fusion_no_se_permite()
    {
        await using var factory = new TestWebApplicationFactory();
        var uno = await HistoricoAsync(factory, "Festival uno");
        var dos = await HistoricoAsync(factory, "Festival dos");
        await DarleOrganizacionAsync(factory, dos);
        var consola = await CmsTestClient.LoginAsync(factory);

        var comparacion = await consola.GetFromJsonAsync<ComparacionDeCopiasDto>($"{Admin}/{uno}/fusion/comparar?con={dos}");

        Assert.Equal("tiene_organizacion", comparacion!.CodigoBloqueo);
        Assert.False(string.IsNullOrWhiteSpace(comparacion.Bloqueo));
    }

    [Fact]
    public async Task La_comparacion_valida_sus_entradas_y_es_solo_del_webmaster()
    {
        await using var factory = new TestWebApplicationFactory();
        var uno = await HistoricoAsync(factory, "Festival uno");
        var dos = await HistoricoAsync(factory, "Festival dos");
        var consola = await CmsTestClient.LoginAsync(factory);

        Assert.Equal(HttpStatusCode.BadRequest, (await consola.GetAsync($"{Admin}/{uno}/fusion/comparar?con={uno}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await consola.GetAsync($"{Admin}/{uno}/fusion/comparar?con=999999")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await consola.GetAsync($"{Admin}/999999/fusion/comparar?con={dos}")).StatusCode);

        var (_, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync($"{Admin}/{uno}/fusion/comparar?con={dos}")).StatusCode);
    }

    // ---------- Andamio ---------------------------------------------------------------------

    private static async Task<string?> EstadoAsync(TestWebApplicationFactory factory, int id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        return (await db.FestivalRecords.AsNoTracking().SingleAsync(x => x.Id == id)).StatusCode;
    }

    /// <summary>
    /// Un Festival en el estado que se pide (por omisión, rechazado), con una organización responsable
    /// y, si se pide, la persona que lo envió a revisión: a ella se le avisa.
    /// </summary>
    private static async Task<(int Festival, int Persona)> RechazadoAsync(
        TestWebApplicationFactory factory, string estado = "rechazado", bool conRemitente = false)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();

        var persona = new UserRow
        {
            FullName = "Responsable de la agrupación",
            Email = $"responsable.{Guid.NewGuid():N}@example.com",
            PasswordHash = "no-se-usa",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Users.Add(persona);
        var festival = new FestivalRow
        {
            Name = "Festival rechazado de prueba",
            Description = "Festival sembrado para reabrir su revisión.",
            CoverageLevel = "municipal",
            DepartmentCode = "05",
            MunicipalityCode = "05001",
            StatusCode = estado,
            OrganizacionPrincipalId = institucional,
            CreatedAt = DateTime.UtcNow,
        };
        db.FestivalRecords.Add(festival);
        await db.SaveChangesAsync();

        if (conRemitente)
        {
            db.HistorialesRevisionRegistros.Add(new HistorialRevisionRegistroRow
            {
                ModuloId = Modulos.Festivales,
                RegistroId = festival.Id.ToString(CultureInfo.InvariantCulture),
                EstadoAnterior = "borrador",
                EstadoNuevo = "en_revision",
                Accion = "FestivalEnviadoARevision",
                UsuarioId = persona.Id,
                Fecha = DateTime.UtcNow.AddDays(-2),
            });
            await db.SaveChangesAsync();
        }

        return (festival.Id, persona.Id);
    }

    private static async Task<(int, int)> DosPracticasAsync(TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        // La siembra de la suite trae una sola práctica: se añade la segunda para poder unirlas.
        if (await db.PracticasMusicales.CountAsync() < 2)
        {
            db.PracticasMusicales.Add(new PracticaMusicalRow { Nombre = "Práctica de prueba", Slug = "practica-de-prueba-t2", Orden = 99 });
            await db.SaveChangesAsync();
        }
        var ids = await db.PracticasMusicales.AsNoTracking().OrderBy(x => x.Id).Select(x => x.Id).Take(2).ToListAsync();
        Assert.Equal(2, ids.Count);
        return (ids[0], ids[1]);
    }

    private static async Task<int> HistoricoAsync(
        TestWebApplicationFactory factory, string nombre, int[]? ediciones = null, string? correo = null, int[]? practicas = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();
        var festival = new FestivalRow
        {
            Name = nombre,
            Description = "Registro histórico de prueba.",
            CoverageLevel = "municipal",
            DepartmentCode = "05",
            MunicipalityCode = "05001",
            StatusCode = "publicado",
            OrganizacionPrincipalId = institucional,
            ContactEmail = correo,
            CreatedAt = DateTime.UtcNow,
        };
        db.FestivalRecords.Add(festival);
        await db.SaveChangesAsync();
        foreach (var anio in ediciones ?? [])
        {
            db.EdicionesFestival.Add(new EdicionFestivalRow
            {
                FestivalId = festival.Id, Anio = anio, Nombre = $"Edición {anio}", Estado = "realizada",
                EstadoRegistro = "publicado", EstadoVisibilidad = "publicada", FechaCreacion = DateTime.UtcNow,
            });
        }
        if (practicas is { Length: > 0 })
        {
            db.Agregar<PracticaMusicalDeRegistroRow>(Modulos.Festivales, festival.Id, practicas, DateTime.UtcNow);
        }
        await db.SaveChangesAsync();
        return festival.Id;
    }

    /// <summary>Pasa el Festival a una organización cualquiera: ya no es una copia que nadie administre.</summary>
    private static async Task DarleOrganizacionAsync(TestWebApplicationFactory factory, int festivalId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var otra = await db.EntityProfiles.AsNoTracking().Where(x => !x.IsInstitutional).Select(x => (int?)x.Id).FirstOrDefaultAsync();
        if (otra is null)
        {
            var creada = new EntityProfileRow
            {
                EntityType = "organizacion", Name = "Organización que administra", StatusCode = "activa", IsActive = true, CreatedAt = DateTime.UtcNow,
            };
            db.EntityProfiles.Add(creada);
            await db.SaveChangesAsync();
            otra = creada.Id;
        }
        (await db.FestivalRecords.SingleAsync(x => x.Id == festivalId)).OrganizacionPrincipalId = otra;
        await db.SaveChangesAsync();
    }
}
