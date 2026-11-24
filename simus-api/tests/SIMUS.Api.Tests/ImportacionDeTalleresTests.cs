using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La importación asistida de Talleres de lutería (LUT-02, decisión 120): vista previa, validación por fila,
/// coincidencias sin falsos avisos y escritura solo tras confirmar.
/// </summary>
/// <remarks>
/// Las reglas transversales (que ningún dominio publique solo, que cada uno explique su estado)
/// ya las vigila <c>ImportacionAsistidaTests</c> leyendo los dominios de la inyección de
/// dependencias, así que alcanzan a este sin escribir nada. Aquí va lo PROPIO del taller.
/// </remarks>
public sealed class ImportacionDeTalleresTests : IClassFixture<TestWebApplicationFactory>
{
    private const string Ruta = "/api/v1/admin/importaciones/talleres";
    private readonly TestWebApplicationFactory _factory;

    public ImportacionDeTalleresTests(TestWebApplicationFactory factory) => _factory = factory;

    private static async Task<HttpClient> ConsolaAsync(TestWebApplicationFactory factory)
    {
        var cliente = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var testigo = await cliente.GetFromJsonAsync<JsonElement>($"{Ruta}/csrf");
        cliente.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        cliente.DefaultRequestHeaders.Add("X-CSRF-TOKEN", testigo.GetProperty("token").GetString());
        return cliente;
    }

    private static PrevisualizarImportacionSolicitud Sobre(params (string Campo, string? Valor)[][] filas) => new()
    {
        NombreArchivo = "talleres.csv",
        Formato = "csv",
        HuellaArchivo = new string('a', 64),
        VersionContrato = 1,
        Filas = filas.Select((valores, indice) => ImportacionFestivalesTests.Fila(indice + 2, valores)).ToList(),
    };

    private static (string Campo, string? Valor)[] Municipal(string nombre, params (string Campo, string? Valor)[] extra) =>
        new (string Campo, string? Valor)[]
        {
            ("nombre", nombre), ("nivelCobertura", "municipal"),
            ("departamento", "Antioquia"), ("municipio", "Medellin"),
        }.Concat(extra).ToArray();

    private static async Task<ImportacionDto> PrevisualizarAsync(HttpClient cliente, PrevisualizarImportacionSolicitud sobre)
    {
        var respuesta = await cliente.PostAsJsonAsync($"{Ruta}/previsualizar", sobre);
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<ImportacionDto>())!;
    }

    private static async Task<HttpResponseMessage> PedirConfirmacionAsync(HttpClient cliente, ImportacionDto vista, params long[] excluidas) =>
        await cliente.PostAsJsonAsync($"{Ruta}/{vista.Id}/confirmar", new
        {
            huellaPlan = vista.HuellaPlan,
            claveIdempotencia = $"tal-{Guid.NewGuid():N}",
            idsFilasExcluidas = excluidas,
        });

    private static async Task<ImportacionDto> ConfirmarAsync(HttpClient cliente, ImportacionDto vista, params long[] excluidas)
    {
        var respuesta = await PedirConfirmacionAsync(cliente, vista, excluidas);
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<ImportacionDto>())!;
    }

    private async Task<int> SembrarTallerAsync(string nombre, string departamento, string? municipio)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.AsNoTracking().Where(x => x.IsInstitutional).Select(x => x.Id).FirstAsync();
        var taller = new TallerRow
        {
            Nombre = nombre,
            NivelCobertura = municipio is null ? "departamental" : "municipal",
            CodigoDepartamento = departamento,
            CodigoMunicipio = municipio,
            OrganizacionPrincipalId = institucional,
            EstadoRegistro = "publicado",
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
        };
        db.Talleres.Add(taller);
        await db.SaveChangesAsync();
        return taller.Id;
    }

    [Fact]
    public async Task Previsualizar_no_escribe_y_confirmar_crea_un_borrador_con_servicios_familias_y_toda_la_traza()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Taller de prueba {Guid.NewGuid():N}";
        int antes;
        using (var scope = _factory.Services.CreateScope())
            antes = await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Talleres.CountAsync();

        var vista = await PrevisualizarAsync(cliente, Sobre(Municipal(nombre,
            ("descripcion", "Construcción de guitarras."), ("modalidad", "Itinerante"), ("recibeAprendices", "Sí"),
            ("servicios", "Reparación; Venta de instrumentos"), ("familias", "cordofonos-frotados"),
            ("correoContacto", " TALLER@Ejemplo.org "))));
        Assert.Equal(1, vista.FilasImportables);
        Assert.Equal("crear", vista.Filas[0].Resultado);
        Assert.Equal("Antioquia", vista.Filas[0].Datos["departamento"]);
        Assert.Equal("Reparación, Venta de instrumentos", vista.Filas[0].Datos["servicios"]);

        // LA REGLA UNO: previsualizar no escribe en el destino.
        using (var scope = _factory.Services.CreateScope())
            Assert.Equal(antes, await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Talleres.CountAsync());

        Assert.Equal("aplicado", (await ConfirmarAsync(cliente, vista)).Estado);

        using var scope2 = _factory.Services.CreateScope();
        var db = scope2.ServiceProvider.GetRequiredService<SimusDbContext>();
        var creado = await db.Talleres.SingleAsync(x => x.Nombre == nombre);
        var institucional = await db.EntityProfiles.SingleAsync(x => x.IsInstitutional);
        // LA REGLA DOS: nace en borrador, bajo la custodia del Programa porque la hoja no traía organización.
        Assert.Equal("borrador", creado.EstadoRegistro);
        Assert.Equal(institucional.Id, creado.OrganizacionPrincipalId);
        Assert.Null(creado.UsuarioResponsableId);
        Assert.Equal("itinerante", creado.Modalidad);
        Assert.True(creado.RecibeAprendices);
        Assert.Equal("taller@ejemplo.org", creado.CorreoTaller);
        Assert.Null(creado.FechaPublicacion);
        Assert.Equal(2, await db.TalleresServicios.CountAsync(x => x.TallerId == creado.Id));
        Assert.Equal(1, await db.TalleresFamiliasDeInstrumentos.CountAsync(x => x.TallerId == creado.Id));

        var id = creado.Id.ToString(CultureInfo.InvariantCulture);
        // LA REGLA TRES: dice que llegó en una carga.
        Assert.Equal("importacion", (await db.ProcedenciasDeRegistro.SingleAsync(x => x.ModuloId == "talleres" && x.RegistroId == id)).ContextoOrigen);
        var historial = await db.CambiosDeRegistro.Where(x => x.ModuloId == "talleres" && x.RegistroId == id).ToListAsync();
        Assert.Contains(historial, x => x.CampoId == "nombre" && x.ValorNuevo == nombre && x.Origen == "importacion");
        Assert.Contains(historial, x => x.CampoId == "servicios" && x.Origen == "importacion");
        Assert.Contains(await db.AuditLogs.Where(x => x.TableName == "Talleres" && x.RecordId == id).ToListAsync(),
            x => x.NewValuesJson!.Contains("RegistroCreadoPorImportacion", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Un_taller_que_ya_existe_no_se_modifica_y_el_mismo_nombre_en_otro_territorio_no_avisa()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Taller Existente {Guid.NewGuid():N}";
        var existenteId = await SembrarTallerAsync(nombre, "05", "05001");

        var vista = await PrevisualizarAsync(cliente, Sobre(
            Municipal(nombre, ("descripcion", "Otra descripción que NO debe sobrescribir.")),
            [("nombre", nombre), ("nivelCobertura", "municipal"), ("departamento", "Valle del Cauca"), ("municipio", "Cali")]));

        Assert.Equal("coincidencia_existente", vista.Filas[0].Resultado);
        Assert.Equal(existenteId, vista.Filas[0].RegistroCoincidenteId);
        Assert.Contains(vista.Filas[0].Hallazgos, h => h.Codigo == "taller_existente");
        Assert.Equal("crear", vista.Filas[1].Resultado);
        Assert.DoesNotContain(vista.Filas[1].Hallazgos, h => h.Severidad is "error" or "advertencia");

        await ConfirmarAsync(cliente, vista);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var intacto = await db.Talleres.SingleAsync(x => x.Id == existenteId);
        Assert.Equal("publicado", intacto.EstadoRegistro);
        Assert.Null(intacto.Descripcion);
        Assert.True(intacto.Activo);
    }

    [Fact]
    public async Task Cada_fila_se_valida_por_separado_y_ninguna_organizacion_se_crea()
    {
        using var cliente = await ConsolaAsync(_factory);
        var marca = Guid.NewGuid().ToString("N")[..8];
        int organizaciones;
        using (var scope = _factory.Services.CreateScope())
            organizaciones = await scope.ServiceProvider.GetRequiredService<SimusDbContext>().EntityProfiles.CountAsync();

        var vista = await PrevisualizarAsync(cliente, Sobre(
            Municipal($"Taller correcto {marca}"),
            Municipal($"Taller sin dueña {marca}", ("organizacion", "Organización que no existe")),
            [("nombre", $"Taller sin municipio {marca}"), ("nivelCobertura", "municipal"), ("departamento", "Antioquia")],
            [("nombre", $"Taller nacional {marca}"), ("nivelCobertura", "nacional"), ("departamento", "Antioquia")],
            [("nombre", $"Taller sin nivel {marca}")],
            Municipal($"Taller servicio raro {marca}", ("servicios", "Hechizos"), ("modalidad", "Volador"), ("recibeAprendices", "quizá")),
            Municipal($"Taller enlace malo {marca}", ("sitioWeb", "https://sin espacios .com"))));

        Assert.Equal("crear", vista.Filas[0].Resultado);
        Assert.Contains(vista.Filas[1].Hallazgos, h => h.Codigo == "organizacion_desconocida");
        Assert.Contains(vista.Filas[2].Hallazgos, h => h.Codigo == "municipio_invalido");
        Assert.Equal("crear", vista.Filas[3].Resultado);
        Assert.Contains(vista.Filas[3].Hallazgos, h => h.Codigo == "territorio_omitido_por_cobertura");
        Assert.Contains(vista.Filas[4].Hallazgos, h => h.Codigo == "nivel_cobertura_invalido");
        Assert.Contains(vista.Filas[5].Hallazgos, h => h.Codigo == "servicio_invalido");
        Assert.Contains(vista.Filas[5].Hallazgos, h => h.Codigo == "modalidad_invalida");
        Assert.Contains(vista.Filas[5].Hallazgos, h => h.Codigo == "recibe_aprendices_invalido");
        Assert.Contains(vista.Filas[6].Hallazgos, h => h.Codigo == "url_invalida");
        Assert.Equal(2, vista.FilasImportables);

        await ConfirmarAsync(cliente, vista);
        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal(0, await db2.Talleres.CountAsync(x => x.Nombre.Contains($"sin dueña {marca}")));
        Assert.Equal(organizaciones, await db2.EntityProfiles.CountAsync());
        Assert.Null((await db2.Talleres.SingleAsync(x => x.Nombre == $"Taller nacional {marca}")).CodigoDepartamento);
    }

    [Fact]
    public async Task Si_aparece_un_taller_coincidente_entre_la_vista_previa_y_la_confirmacion_no_se_escribe_nada()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Taller Carrera {Guid.NewGuid():N}";
        var vista = await PrevisualizarAsync(cliente, Sobre(Municipal(nombre)));
        Assert.Equal("crear", vista.Filas[0].Resultado);

        await SembrarTallerAsync(nombre, "05", "05001");
        var respuesta = await PedirConfirmacionAsync(cliente, vista);

        Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
        using var scope = _factory.Services.CreateScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Talleres.CountAsync(x => x.Nombre == nombre));
    }
}
