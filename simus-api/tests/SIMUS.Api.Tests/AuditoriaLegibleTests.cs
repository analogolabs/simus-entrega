using System.Net;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La bitácora, legible: quién hizo qué, sobre qué registro con su nombre.
/// </summary>
/// <remarks>
/// <para>
/// LO QUE SE VEIA ANTES era «crear · Festivales »: la acción sin sujeto, un nombre de tabla y un
/// identificador. Para responder «quién editó qué» faltaban las dos mitades que importan, y ninguna
/// está en la fila de bitácora: el nombre de la persona vive en <c>Usuarios</c> y el del registro en
/// la tabla afectada.
/// </para>
/// <para>
/// NO SE PUEDE SACAR DEL JSON, y conviene que quede escrito para que nadie lo intente otra vez.
/// <c>ValoresNuevos</c> guarda lo que cada endpoint decidió guardar —en un Festival recién creado,
/// la organización, el estado y el evento— y en casi la mitad de las filas es nulo.
/// </para>
/// </remarks>
public sealed class AuditoriaLegibleTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AuditoriaLegibleTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task EntrarComoWebmasterAsync()
    {
        var respuesta = await _client.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest
        {
            Email = "test@pnmc.local",
            Password = "pnmc-master"
        });
        respuesta.EnsureSuccessStatusCode();
    }

    /// <summary>
    /// Siembra una fila de bitácora con autor conocido sobre un registro con nombre conocido.
    /// </summary>
    /// <remarks>
    /// Se escribe directamente en la base y no a través de un endpoint a propósito: lo que esta
    /// clase mide es la LECTURA de la bitácora, y montarla por la vía larga la ataría al flujo que
    /// hoy la escribe.
    /// </remarks>
    private async Task<(int UsuarioId, int FestivalId)> SembrarAsync(string sufijo)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ahora = DateTime.UtcNow;

        var usuario = new UserRow
        {
            FullName = "Autora Auditada " + sufijo,
            Email = $"autora.auditada.{sufijo}@example.com",
            PasswordHash = "x",
            AccessChannel = "interno",
            IsActive = true,
            CreatedAt = ahora,
            UpdatedAt = ahora,
        };
        db.Users.Add(usuario);

        var festival = new FestivalRow
        {
            Name = "Festival Auditado " + sufijo,
            CoverageLevel = "nacional",
            StatusCode = "borrador",
            CreatedAt = ahora,
            UpdatedAt = ahora,
        };
        db.FestivalRecords.Add(festival);
        await db.SaveChangesAsync();

        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = usuario.Id,
            TableName = "Festivales",
            RecordId = festival.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
            Action = "editar_auditado_" + sufijo,
            CreatedAt = ahora,
        });
        await db.SaveChangesAsync();

        return (usuario.Id, festival.Id);
    }

    [Fact]
    public async Task La_Bitacora_Dice_Quien_Y_Sobre_Que_Registro_Con_Su_Nombre()
    {
        var (usuarioId, festivalId) = await SembrarAsync("nombre");
        await EntrarComoWebmasterAsync();

        var respuesta = await _client.GetAsync("/api/v1/admin/auditoria/?accion=editar_auditado_nombre");
        respuesta.EnsureSuccessStatusCode();
        var carga = await respuesta.Content.ReadFromJsonAsync<AuditoriaRespuestaDto>();

        Assert.NotNull(carga);
        var item = Assert.Single(carga!.Items);

        // EL AUTOR. Antes la fila traía un IdUsuario y la pantalla no lo mostraba siquiera.
        Assert.NotNull(item.Autor);
        Assert.Equal("Autora Auditada nombre", item.Autor!.Nombre);
        Assert.Equal(usuarioId.ToString(System.Globalization.CultureInfo.InvariantCulture), item.Autor.Id);

        // EL NOMBRE DEL REGISTRO, que no está en la bitácora sino en la tabla afectada.
        Assert.Equal("Festival Auditado nombre", item.NombreRegistro);
        Assert.Equal(festivalId.ToString(System.Globalization.CultureInfo.InvariantCulture), item.RegistroId);

        // Y su grupo, que es lo que permite repartir la pantalla en secciones.
        Assert.Equal("festivales", item.Grupo);
        Assert.Equal("Festivales", item.GrupoEtiqueta);
    }

    /// <summary>Anota una linea de bitacora con un verbo concreto de la lista blanca.</summary>
    private async Task AnotarAsync(int usuarioId, int festivalId, string accion)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = usuarioId,
            TableName = "Festivales",
            RecordId = festivalId.ToString(System.Globalization.CultureInfo.InvariantCulture),
            Action = accion,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task La_Bitacora_Entrega_El_Verbo_Y_Tambien_El_Verbo_En_Palabras()
    {
        var (usuarioId, festivalId) = await SembrarAsync("etiqueta");
        await AnotarAsync(usuarioId, festivalId, "iniciar_sesion");
        await EntrarComoWebmasterAsync();

        // Se filtra tambien por registro: entrar como webmaster deja sus propias lineas de
        // `iniciar_sesion`, y sin acotar el registro la pagina traeria las suyas ademas de esta.
        var respuesta = await _client.GetAsync(
            $"/api/v1/admin/auditoria/?accion=iniciar_sesion&registroId={festivalId.ToString(System.Globalization.CultureInfo.InvariantCulture)}");
        respuesta.EnsureSuccessStatusCode();
        var carga = await respuesta.Content.ReadFromJsonAsync<AuditoriaRespuestaDto>();

        var item = Assert.Single(carga!.Items);

        // LOS DOS, Y POR ESO ESTA PRUEBA. El Resumen y el historial de un Festival ya pedían
        // `accionEtiqueta` y el servidor no lo enviaba nunca, así que caían al verbo crudo y
        // enseñaban «iniciar_sesion» a quien administra. El verbo sigue viajando
        // porque es el que se usa para filtrar.
        Assert.Equal("iniciar_sesion", item.Accion);
        Assert.Equal("Inició sesión", item.AccionEtiqueta);
    }

    /// <summary>
    /// (L9): las actuaciones sobre registros y los accesos de sesión se leen por separado.
    /// </summary>
    [Fact]
    public async Task Los_Accesos_Se_Separan_De_Las_Actuaciones_Y_Cada_Vista_Trae_Su_Total()
    {
        var (usuarioId, festivalId) = await SembrarAsync("vistas");
        await AnotarAsync(usuarioId, festivalId, "iniciar_sesion");
        await AnotarAsync(usuarioId, festivalId, "cerrar_sesion");
        await EntrarComoWebmasterAsync();
        var registro = festivalId.ToString(System.Globalization.CultureInfo.InvariantCulture);

        var actuaciones = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>(
            $"/api/v1/admin/auditoria/?vista=actuaciones&registroId={registro}");
        var item = Assert.Single(actuaciones!.Items);
        Assert.Equal("editar_auditado_vistas", item.Accion);

        var accesos = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>(
            $"/api/v1/admin/auditoria/?vista=accesos&registroId={registro}");
        Assert.Equal(2, accesos!.Items.Count);
        Assert.All(accesos.Items, fila => Assert.Contains("sesion", fila.Accion));

        // Sin `vista` se devuelve todo, como antes: el historial de un registro no cambia.
        var todo = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>(
            $"/api/v1/admin/auditoria/?registroId={registro}");
        Assert.Equal(3, todo!.Items.Count);

        // Los dos totales cuentan TODA la bitácora y suman lo que hay.
        Assert.True(todo.TotalAccesos >= 2);
        Assert.True(todo.TotalActuaciones >= 1);
    }

    /// <summary> (L9): las tablas internas se leen como la sección de la consola que las escribe.</summary>
    [Fact]
    public async Task Las_Tablas_Internas_Salen_Como_La_Seccion_Que_Las_Escribe()
    {
        var (usuarioId, _) = await SembrarAsync("tablas");
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            foreach (var tabla in new[] { "ModulosPorCuenta", "UsuariosEntidades", "AdministracionControl" })
            {
                db.AuditLogs.Add(new AuditLogRow
                {
                    UserId = usuarioId, TableName = tabla, RecordId = "seed-tablas", Action = "actualizar", CreatedAt = DateTime.UtcNow,
                });
            }
            await db.SaveChangesAsync();
        }
        await EntrarComoWebmasterAsync();

        var carga = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>("/api/v1/admin/auditoria/?registroId=seed-tablas&tamano=10");
        var etiquetas = carga!.Items.ToDictionary(i => i.Tabla, i => i.GrupoEtiqueta);

        Assert.Equal("Usuarios y accesos", etiquetas["ModulosPorCuenta"]);
        Assert.Equal("Organizaciones", etiquetas["UsuariosEntidades"]);
        Assert.Equal("Sistema", etiquetas["AdministracionControl"]);
        // Ninguna cae en «otros» con el nombre crudo de la tabla.
        Assert.DoesNotContain(carga.Items, i => i.Grupo == "otros");
    }

    /// <summary> (L9): el cambio de apartados de una cuenta dice la cuenta, no «Registro 3».</summary>
    [Fact]
    public async Task Los_Apartados_De_Una_Cuenta_Se_Registran_Con_El_Nombre_De_La_Cuenta()
    {
        var (usuarioId, _) = await SembrarAsync("apartados");
        var registro = usuarioId.ToString(System.Globalization.CultureInfo.InvariantCulture);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.AuditLogs.Add(new AuditLogRow
            {
                UserId = usuarioId, TableName = "ModulosPorCuenta", RecordId = registro, Action = "actualizar", CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        await EntrarComoWebmasterAsync();

        var carga = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>(
            $"/api/v1/admin/auditoria/?tabla=ModulosPorCuenta&registroId={registro}");

        var item = Assert.Single(carga!.Items);
        Assert.Equal("Autora Auditada apartados", item.NombreRegistro);
    }

    [Fact]
    public void Un_Verbo_Que_El_Servidor_No_Sabe_Nombrar_Se_Devuelve_Tal_Cual()
    {
        // Las pruebas siembran verbos que la base real no admitiría —SQLite no tiene la CHECK—,
        // y aun así la respuesta no puede quedarse sin acción: ocultar que algo ocurrió es peor
        // que enseñarlo sin traducir.
        Assert.DoesNotContain("editar_auditado_nombre", VerbosDeBitacora.Conocidos, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Una_Linea_Del_Catalogo_Editorial_Dice_El_Titulo_De_La_Ficha_Y_No_El_Nombre_De_La_Tabla()
    {
        // EL CATALOGO EDITORIAL ESCRIBE BITACORA DESDE y no estaba clasificado: sus
        // lineas caian en «otros» y la consola enseñaba «PublicacionesEditoriales» —el nombre
        // crudo de la tabla— donde deberia ir el titulo de la ficha.
        long publicacionId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var ficha = new PublicacionEditorialRow
            {
                Codigo = "ED-AUD-01",
                Titulo = "Cantos de comunidades negras",
                EstadoCatalogacion = "pendiente_revision",
                EstadoPublicacion = "borrador",
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow,
            };
            db.PublicacionesEditoriales.Add(ficha);
            await db.SaveChangesAsync();
            publicacionId = ficha.Id;

            db.AuditLogs.Add(new AuditLogRow
            {
                UserId = null,
                TableName = "PublicacionesEditoriales",
                RecordId = publicacionId.ToString(System.Globalization.CultureInfo.InvariantCulture),
                Action = "publicar",
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        await EntrarComoWebmasterAsync();

        var respuesta = await _client.GetAsync(
            $"/api/v1/admin/auditoria/?accion=publicar&registroId={publicacionId.ToString(System.Globalization.CultureInfo.InvariantCulture)}");
        respuesta.EnsureSuccessStatusCode();
        var carga = await respuesta.Content.ReadFromJsonAsync<AuditoriaRespuestaDto>();

        var item = Assert.Single(carga!.Items);
        Assert.Equal("editorial", item.Grupo);
        Assert.Equal("Catálogo Editorial", item.GrupoEtiqueta);
        Assert.Equal("Cantos de comunidades negras", item.NombreRegistro);
        Assert.Equal("Publicó", item.AccionEtiqueta);
    }

    [Fact]
    public void Las_Etiquetas_De_Accion_Cubren_La_Lista_Blanca_Del_Esquema()
    {
        // LAS DOS LISTAS NO PUEDEN SEPARARSE. La columna `Accion` está cerrada por
        // `CK_BitacoraAuditoria_Accion`; si alguien añade un verbo allí y no aquí, la consola
        // volvería a enseñar el verbo crudo, que es exactamente el defecto que se corrigió.
        var verbosDelEsquema = VerbosDeLaListaBlanca();

        Assert.NotEmpty(verbosDelEsquema);
        var sinEtiqueta = verbosDelEsquema
            .Except(VerbosDeBitacora.Conocidos, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var sobrantes = VerbosDeBitacora.Conocidos
            .Except(verbosDelEsquema, StringComparer.OrdinalIgnoreCase)
            .ToList();

        Assert.True(sinEtiqueta.Count == 0, "Verbos que la base admite y el servidor no sabe nombrar: " + string.Join(", ", sinEtiqueta));
        Assert.True(sobrantes.Count == 0, "Verbos con etiqueta que la base no admite: " + string.Join(", ", sobrantes));
    }

    /// <summary>
    /// Lee <c>CK_BitacoraAuditoria_Accion</c> del guion de esquema que la definió por última vez.
    /// </summary>
    /// <remarks>
    /// La restricción nació en <c>V20260519_02</c> y se amplía con un guion nuevo cada vez que entra
    /// un verbo (la última: <c>V20261110_11</c>, «consultar»). Se lee el guion más reciente que la
    /// declare, porque la lista vigente es la de la última definición.
    /// </remarks>
    private static List<string> VerbosDeLaListaBlanca([CallerFilePath] string origen = "")
    {
        var carpeta = Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(origen)!, "..", "..", "..", "simus-database", "schema"));

        Assert.True(Directory.Exists(carpeta), $"No se encontró {carpeta}.");

        var patron = new Regex(
            @"CK_BitacoraAuditoria_Accion\s+CHECK\s*\(\s*Accion\s+IN\s*\((?<lista>[^)]*)\)",
            RegexOptions.IgnoreCase);

        var ultima = Directory.GetFiles(carpeta, "*.sql")
            .OrderBy(ruta => Path.GetFileName(ruta), StringComparer.Ordinal)
            .Select(ruta => patron.Match(File.ReadAllText(ruta)))
            .LastOrDefault(coincidencia => coincidencia.Success);

        Assert.True(ultima is not null, "No se pudo leer CK_BitacoraAuditoria_Accion del esquema.");

        return Regex.Matches(ultima!.Groups["lista"].Value, @"N'(?<verbo>[^']+)'")
            .Select(m => m.Groups["verbo"].Value)
            .ToList();
    }

    [Fact]
    public async Task Los_Totales_Por_Grupo_Se_Cuentan_Sobre_Toda_La_Bitacora_Y_No_Sobre_El_Filtro()
    {
        await SembrarAsync("totales");
        await EntrarComoWebmasterAsync();

        var respuesta = await _client.GetAsync("/api/v1/admin/auditoria/?grupo=festivales");
        respuesta.EnsureSuccessStatusCode();
        var carga = await respuesta.Content.ReadFromJsonAsync<AuditoriaRespuestaDto>();
        Assert.NotNull(carga);

        var festivales = carga!.Grupos.Single(g => g.Id == "festivales");
        Assert.True(festivales.Total > 0);

        // AQUI ESTA EL DEFECTO QUE ESTO EVITA: si los totales se calcularan con el filtro puesto,
        // al elegir «Festivales» las demás pestañas dirían cero y parecería que no hay nada en
        // ellas. Los grupos son las cifras de las pestañas, no del resultado.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var totalReal = await db.AuditLogs.CountAsync();
        Assert.Equal(totalReal, carga.Grupos.Sum(g => g.Total));

        // Y lo devuelto sí está filtrado.
        Assert.All(carga.Items, item => Assert.Equal("festivales", item.Grupo));
    }

    [Fact]
    public async Task El_Tamano_De_Pagina_Lo_Decide_El_Servidor()
    {
        await SembrarAsync("tope");
        await EntrarComoWebmasterAsync();

        // Cada fila de la página puede obligar a resolver un nombre: sin tope, una sola petición
        // se convierte en un barrido de varias tablas.
        var respuesta = await _client.GetAsync("/api/v1/admin/auditoria/?tamano=100000");
        respuesta.EnsureSuccessStatusCode();
        var carga = await respuesta.Content.ReadFromJsonAsync<AuditoriaRespuestaDto>();

        Assert.NotNull(carga);
        Assert.Equal(50, carga!.TamanoPagina);
        Assert.True(carga.Items.Count <= 50);
    }

    [Fact]
    public async Task Sin_Sesion_Institucional_La_Bitacora_No_Se_Lee()
    {
        // La bitácora dice quién tocó qué y trae correos: es exactamente el tipo de dato que no
        // puede quedar detrás de una ruta anónima por descuido.
        var anonimo = _factory.CreateClient();
        var respuesta = await anonimo.GetAsync("/api/v1/admin/auditoria/");

        Assert.True(
            respuesta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden,
            $"Se esperaba 401 o 403 y llegó {(int)respuesta.StatusCode}.");
    }

    // ─── Lo que entro: verbos como lista, buscar a quien, periodo y detalle ───

    [Fact]
    public async Task La_Bitacora_Ofrece_Sus_Verbos_Como_Lista_Con_Su_Total()
    {
        var (usuarioId, festivalId) = await SembrarAsync("verbos");
        await AnotarAsync(usuarioId, festivalId, "publicar");
        await EntrarComoWebmasterAsync();

        var carga = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>("/api/v1/admin/auditoria/?accion=publicar");

        Assert.NotNull(carga);
        // EL VERBO EN PALABRAS Y CON SU TOTAL SOBRE TODA LA BITACORA: es lo que llena la lista
        // «Accion» de la pantalla, que antes era un campo de texto para escribir el codigo exacto.
        var publicar = Assert.Single(carga!.Acciones, a => a.Id == "publicar");
        Assert.Equal("Publicó", publicar.Etiqueta);
        Assert.True(publicar.Total >= 1);
        // Y los demas verbos siguen en la lista aunque el filtro este puesto en uno.
        Assert.Contains(carga.Acciones, a => a.Id == "editar_auditado_verbos");
    }

    [Fact]
    public async Task La_Bitacora_Se_Busca_Por_Quien_Actuo_Y_No_Por_El_Codigo_Del_Verbo()
    {
        var (usuarioId, _) = await SembrarAsync("busqueda");
        await EntrarComoWebmasterAsync();

        var porNombre = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>("/api/v1/admin/auditoria/?q=Autora%20Auditada%20busqueda");
        var porCorreo = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>("/api/v1/admin/auditoria/?q=autora.auditada.busqueda%40example.com");
        var porNadie = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>("/api/v1/admin/auditoria/?q=nadie-con-este-nombre-zz");

        Assert.NotNull(porNombre);
        Assert.All(porNombre!.Items, item => Assert.Equal(usuarioId.ToString(System.Globalization.CultureInfo.InvariantCulture), item.Autor?.Id));
        Assert.True(porNombre.Total >= 1);
        Assert.Equal(porNombre.Total, porCorreo!.Total);
        Assert.Equal(0, porNadie!.Total);
    }

    [Fact]
    public async Task La_Bitacora_Se_Acota_Desde_Una_Fecha()
    {
        var (usuarioId, festivalId) = await SembrarAsync("periodo");
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.AuditLogs.Add(new AuditLogRow
            {
                UserId = usuarioId,
                TableName = "Festivales",
                RecordId = festivalId.ToString(System.Globalization.CultureInfo.InvariantCulture),
                Action = "vieja_auditada_periodo",
                CreatedAt = DateTime.UtcNow.AddDays(-40),
            });
            db.AuditLogs.Add(new AuditLogRow
            {
                UserId = usuarioId,
                TableName = "Festivales",
                RecordId = festivalId.ToString(System.Globalization.CultureInfo.InvariantCulture),
                Action = "vieja_auditada_periodo",
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        await EntrarComoWebmasterAsync();

        var desde = Uri.EscapeDataString(DateTime.UtcNow.AddDays(-7).ToString("O"));
        var recientes = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>($"/api/v1/admin/auditoria/?accion=vieja_auditada_periodo&desde={desde}");
        var todas = await _client.GetFromJsonAsync<AuditoriaRespuestaDto>("/api/v1/admin/auditoria/?accion=vieja_auditada_periodo");

        Assert.Equal(1, recientes!.Total);
        Assert.Equal(2, todas!.Total);
    }

    [Fact]
    public async Task Una_Actuacion_Se_Abre_Con_Lo_Que_Guardo_De_Antes_Y_De_Despues()
    {
        var (usuarioId, festivalId) = await SembrarAsync("detalle");
        long id;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = new AuditLogRow
            {
                UserId = usuarioId,
                TableName = "Festivales",
                RecordId = festivalId.ToString(System.Globalization.CultureInfo.InvariantCulture),
                Action = "actualizar",
                PreviousValuesJson = "{\"Nombre\":\"Antes\",\"Estado\":\"borrador\"}",
                NewValuesJson = "{\"Nombre\":\"Después\",\"Estado\":\"publicado\",\"Numero\":3,\"Sede\":{\"Ciudad\":\"Pasto\"}}",
                CreatedAt = DateTime.UtcNow,
            };
            db.AuditLogs.Add(fila);
            await db.SaveChangesAsync();
            id = fila.Id;
        }
        await EntrarComoWebmasterAsync();

        var detalle = await _client.GetFromJsonAsync<AuditoriaDetalleDto>($"/api/v1/admin/auditoria/{id}");

        Assert.NotNull(detalle);
        Assert.Equal(id.ToString(System.Globalization.CultureInfo.InvariantCulture), detalle!.Actuacion.Id);
        Assert.Equal("Actualizó", detalle.Actuacion.AccionEtiqueta);
        // La hora llega como UTC declarado: sin la «Z», el navegador la tomaba por hora local.
        Assert.Equal(DateTimeKind.Utc, detalle.Actuacion.Fecha.Kind);
        Assert.Equal("Festival Auditado detalle", detalle.Actuacion.NombreRegistro);
        Assert.Equal("Antes", detalle.ValoresAnteriores["Nombre"]);
        Assert.Equal("Después", detalle.ValoresNuevos["Nombre"]);
        // Un numero llega como texto y un objeto anidado como su JSON: la pantalla no opera con ellos.
        Assert.Equal("3", detalle.ValoresNuevos["Numero"]);
        Assert.Contains("Pasto", detalle.ValoresNuevos["Sede"]);

        var inexistente = await _client.GetAsync("/api/v1/admin/auditoria/987654321");
        Assert.Equal(HttpStatusCode.NotFound, inexistente.StatusCode);
    }

}
