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
/// La importación asistida de Espacios para música en vivo (decisión 123): mismas reglas que Talleres y
/// Mercados, con lo propio del espacio (ambiente, aforo, tipos, equipamiento, siempre municipal).
/// </summary>
public sealed class ImportacionDeEspaciosTests : IClassFixture<TestWebApplicationFactory>
{
    private const string Ruta = "/api/v1/admin/importaciones/espacios";
    private readonly TestWebApplicationFactory _factory;

    public ImportacionDeEspaciosTests(TestWebApplicationFactory factory) => _factory = factory;

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
        NombreArchivo = "archivo.csv",
        Formato = "csv",
        HuellaArchivo = new string('a', 64),
        VersionContrato = 1,
        Filas = filas.Select((valores, indice) => ImportacionFestivalesTests.Fila(indice + 2, valores)).ToList(),
    };

    private static async Task<ImportacionDto> PrevisualizarAsync(HttpClient cliente, PrevisualizarImportacionSolicitud sobre)
    {
        var respuesta = await cliente.PostAsJsonAsync($"{Ruta}/previsualizar", sobre);
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<ImportacionDto>())!;
    }

    private static async Task<HttpResponseMessage> PedirConfirmacionAsync(HttpClient cliente, ImportacionDto vista) =>
        await cliente.PostAsJsonAsync($"{Ruta}/{vista.Id}/confirmar", new
        {
            huellaPlan = vista.HuellaPlan,
            claveIdempotencia = $"imp-{Guid.NewGuid():N}",
            idsFilasExcluidas = Array.Empty<long>(),
        });

    private static async Task<ImportacionDto> ConfirmarAsync(HttpClient cliente, ImportacionDto vista)
    {
        var respuesta = await PedirConfirmacionAsync(cliente, vista);
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<ImportacionDto>())!;
    }

    private static (string Campo, string? Valor)[] Municipal(string nombre, params (string Campo, string? Valor)[] extra) =>
        new (string Campo, string? Valor)[] { ("nombre", nombre), ("departamento", "Antioquia"), ("municipio", "Medellin") }
            .Concat(extra).ToArray();

    private async Task<int> SembrarEspacioAsync(string nombre, string departamento, string municipio)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.AsNoTracking().Where(x => x.IsInstitutional).Select(x => x.Id).FirstAsync();
        var espacio = new EspacioRow
        {
            Nombre = nombre, NivelCobertura = "municipal", CodigoDepartamento = departamento, CodigoMunicipio = municipio,
            OrganizacionPrincipalId = institucional, EstadoRegistro = "publicado", Activo = true, FechaCreacion = DateTime.UtcNow,
        };
        db.Espacios.Add(espacio);
        await db.SaveChangesAsync();
        return espacio.Id;
    }

    [Fact]
    public async Task Previsualizar_no_escribe_y_confirmar_crea_un_borrador_con_toda_la_traza()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Espacio de prueba {Guid.NewGuid():N}";
        int antes;
        using (var scope = _factory.Services.CreateScope())
            antes = await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Espacios.CountAsync();

        var vista = await PrevisualizarAsync(cliente, Sobre(Municipal(nombre,
            ("descripcion", "Sala de conciertos."), ("ambiente", "Al aire libre"), ("aforoMaximo", "1.200"), ("esAccesible", "Sí"),
            ("correoContacto", " ESPACIO@Ejemplo.org "))));
        Assert.Equal(1, vista.FilasImportables);
        Assert.Equal("crear", vista.Filas[0].Resultado);
        Assert.Equal("abierto", vista.Filas[0].Datos["ambiente"]);

        using (var scope = _factory.Services.CreateScope())
            Assert.Equal(antes, await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Espacios.CountAsync());

        Assert.Equal("aplicado", (await ConfirmarAsync(cliente, vista)).Estado);

        using var scope2 = _factory.Services.CreateScope();
        var db = scope2.ServiceProvider.GetRequiredService<SimusDbContext>();
        var creado = await db.Espacios.SingleAsync(x => x.Nombre == nombre);
        var institucional = await db.EntityProfiles.SingleAsync(x => x.IsInstitutional);
        Assert.Equal("borrador", creado.EstadoRegistro);
        Assert.Equal(institucional.Id, creado.OrganizacionPrincipalId);
        Assert.Null(creado.UsuarioResponsableId);
        Assert.Equal("municipal", creado.NivelCobertura);
        Assert.Equal("abierto", creado.Ambiente);
        Assert.Equal(1200, creado.AforoMaximo);
        Assert.True(creado.EsAccesible);
        Assert.Equal("espacio@ejemplo.org", creado.CorreoEspacio);
        Assert.Null(creado.FechaPublicacion);

        var id = creado.Id.ToString(CultureInfo.InvariantCulture);
        Assert.Equal("importacion", (await db.ProcedenciasDeRegistro.SingleAsync(x => x.ModuloId == "espacios" && x.RegistroId == id)).ContextoOrigen);
        Assert.Contains(await db.CambiosDeRegistro.Where(x => x.ModuloId == "espacios" && x.RegistroId == id).ToListAsync(),
            x => x.CampoId == "nombre" && x.ValorNuevo == nombre && x.Origen == "importacion");
    }

    [Fact]
    public async Task Un_espacio_que_ya_existe_no_se_modifica_y_el_mismo_nombre_en_otro_municipio_no_avisa()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Espacio Existente {Guid.NewGuid():N}";
        var existenteId = await SembrarEspacioAsync(nombre, "05", "05001");

        var vista = await PrevisualizarAsync(cliente, Sobre(
            Municipal(nombre, ("descripcion", "Otra descripción que NO debe sobrescribir.")),
            [("nombre", nombre), ("departamento", "Valle del Cauca"), ("municipio", "Cali")]));

        Assert.Equal("coincidencia_existente", vista.Filas[0].Resultado);
        Assert.Equal(existenteId, vista.Filas[0].RegistroCoincidenteId);
        Assert.Contains(vista.Filas[0].Hallazgos, h => h.Codigo == "espacio_existente");
        Assert.Equal("crear", vista.Filas[1].Resultado);

        await ConfirmarAsync(cliente, vista);
        using var scope = _factory.Services.CreateScope();
        var intacto = await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Espacios.SingleAsync(x => x.Id == existenteId);
        Assert.Equal("publicado", intacto.EstadoRegistro);
        Assert.Null(intacto.Descripcion);
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
            Municipal($"Espacio correcto {marca}"),
            Municipal($"Espacio sin dueña {marca}", ("organizacion", "Organización que no existe")),
            [("nombre", $"Espacio sin municipio {marca}"), ("departamento", "Antioquia")],
            Municipal($"Espacio raro {marca}", ("ambiente", "Submarino"), ("aforoMaximo", "0"), ("esAccesible", "quizá"), ("tipos", "Hechizos")),
            Municipal($"Espacio enlace malo {marca}", ("sitioWeb", "https://sin espacios .com"))));

        Assert.Equal("crear", vista.Filas[0].Resultado);
        Assert.Contains(vista.Filas[1].Hallazgos, h => h.Codigo == "organizacion_desconocida");
        Assert.Contains(vista.Filas[2].Hallazgos, h => h.Codigo == "municipio_invalido");
        Assert.Contains(vista.Filas[3].Hallazgos, h => h.Codigo == "ambiente_invalido");
        Assert.Contains(vista.Filas[3].Hallazgos, h => h.Codigo == "aforo_invalido");
        Assert.Contains(vista.Filas[3].Hallazgos, h => h.Codigo == "es_accesible_invalido");
        Assert.Contains(vista.Filas[3].Hallazgos, h => h.Codigo == "tipo_invalido");
        Assert.Contains(vista.Filas[4].Hallazgos, h => h.Codigo == "url_invalida");
        Assert.Equal(1, vista.FilasImportables);

        await ConfirmarAsync(cliente, vista);
        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal(0, await db2.Espacios.CountAsync(x => x.Nombre.Contains($"sin dueña {marca}")));
        Assert.Equal(organizaciones, await db2.EntityProfiles.CountAsync());
    }

    [Fact]
    public async Task Si_aparece_un_espacio_coincidente_entre_la_vista_previa_y_la_confirmacion_no_se_escribe_nada()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Espacio Carrera {Guid.NewGuid():N}";
        var vista = await PrevisualizarAsync(cliente, Sobre(Municipal(nombre)));
        Assert.Equal("crear", vista.Filas[0].Resultado);

        await SembrarEspacioAsync(nombre, "05", "05001");
        var respuesta = await PedirConfirmacionAsync(cliente, vista);

        Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
        using var scope = _factory.Services.CreateScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Espacios.CountAsync(x => x.Nombre == nombre));
    }
}
