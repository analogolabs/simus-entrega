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
/// La importación asistida de Mercados (CON-01): vista previa, validación por fila,
/// coincidencias sin falsos avisos y escritura solo tras confirmar.
/// </summary>
/// <remarks>
/// Las reglas transversales (que ningún dominio publique solo, que cada uno explique su estado)
/// ya las vigila <c>ImportacionAsistidaTests</c> leyendo los dominios de la inyección de
/// dependencias, así que alcanzan a este sin escribir nada. Aquí va lo PROPIO del Mercado.
/// </remarks>
public sealed class ImportacionDeMercadosTests : IClassFixture<TestWebApplicationFactory>
{
    private const string Ruta = "/api/v1/admin/importaciones/mercados";
    private readonly TestWebApplicationFactory _factory;

    public ImportacionDeMercadosTests(TestWebApplicationFactory factory) => _factory = factory;

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
        NombreArchivo = "mercados.csv",
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
            claveIdempotencia = $"mer-{Guid.NewGuid():N}",
            idsFilasExcluidas = excluidas,
        });

    private static async Task<ImportacionDto> ConfirmarAsync(HttpClient cliente, ImportacionDto vista, params long[] excluidas)
    {
        var respuesta = await PedirConfirmacionAsync(cliente, vista, excluidas);
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<ImportacionDto>())!;
    }

    private async Task<int> SembrarMercadoAsync(string nombre, string departamento, string? municipio)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.AsNoTracking().Where(x => x.IsInstitutional).Select(x => x.Id).FirstAsync();
        var mercado = new MercadoRow
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
        db.Mercados.Add(mercado);
        await db.SaveChangesAsync();
        return mercado.Id;
    }

    [Fact]
    public async Task Previsualizar_no_escribe_y_confirmar_crea_un_borrador_con_toda_la_traza()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Mercado de prueba {Guid.NewGuid():N}";
        int antes;
        using (var scope = _factory.Services.CreateScope())
            antes = await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Mercados.CountAsync();

        var vista = await PrevisualizarAsync(cliente, Sobre(Municipal(nombre,
            ("descripcion", "Encuentro de circulación."), ("alcance", "Nacional"), ("modalidad", "Mixta"),
            ("periodicidad", "Anual"), ("correoContacto", " CONTACTO@Ejemplo.org "))));
        Assert.Equal(1, vista.FilasImportables);
        Assert.Equal("crear", vista.Filas[0].Resultado);
        Assert.Equal("Antioquia", vista.Filas[0].Datos["departamento"]);
        Assert.Equal("Nacional", vista.Filas[0].Datos["alcance"]);

        // LA REGLA UNO: previsualizar no escribe en el destino.
        using (var scope = _factory.Services.CreateScope())
            Assert.Equal(antes, await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Mercados.CountAsync());

        var aplicada = await ConfirmarAsync(cliente, vista);
        Assert.Equal("aplicado", aplicada.Estado);

        using var scope2 = _factory.Services.CreateScope();
        var db = scope2.ServiceProvider.GetRequiredService<SimusDbContext>();
        var creado = await db.Mercados.SingleAsync(x => x.Nombre == nombre);
        var institucional = await db.EntityProfiles.SingleAsync(x => x.IsInstitutional);
        // LA REGLA DOS: nace en borrador, bajo la custodia del Programa porque la hoja no traía organización.
        Assert.Equal("borrador", creado.EstadoRegistro);
        Assert.Equal(institucional.Id, creado.OrganizacionPrincipalId);
        Assert.Equal("05001", creado.CodigoMunicipio);
        Assert.Equal("contacto@ejemplo.org", creado.CorreoMercado);
        Assert.NotNull(creado.AlcanceMercadoId);
        Assert.NotNull(creado.ModalidadMercadoId);
        Assert.Null(creado.FechaPublicacion);

        var id = creado.Id.ToString(CultureInfo.InvariantCulture);
        // LA REGLA TRES: dice que llegó en una carga.
        Assert.Equal("importacion", (await db.ProcedenciasDeRegistro.SingleAsync(x => x.ModuloId == "mercados" && x.RegistroId == id)).ContextoOrigen);
        // El historial único de ediciones empieza el día de la importación, con origen «importacion».
        var historial = await db.CambiosDeRegistro.Where(x => x.ModuloId == "mercados" && x.RegistroId == id).ToListAsync();
        Assert.Contains(historial, x => x.CampoId == "nombre" && x.ValorNuevo == nombre && x.Origen == "importacion");
        Assert.All(historial, x => Assert.Equal($"Registro importado desde un archivo (lote {vista.Id}).", x.Motivo));
        // Y la bitácora apunta al registro creado.
        Assert.Contains(await db.AuditLogs.Where(x => x.TableName == "Mercados" && x.RecordId == id).ToListAsync(),
            x => x.NewValuesJson!.Contains("RegistroCreadoPorImportacion", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Un_mercado_que_ya_existe_no_se_modifica_ni_se_borra_y_el_mismo_nombre_en_otro_territorio_no_avisa()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Mercado Existente {Guid.NewGuid():N}";
        var existenteId = await SembrarMercadoAsync(nombre, "05", "05001");

        var vista = await PrevisualizarAsync(cliente, Sobre(
            Municipal(nombre, ("descripcion", "Otra descripción que NO debe sobrescribir.")),
            [("nombre", nombre), ("nivelCobertura", "municipal"), ("departamento", "Valle del Cauca"), ("municipio", "Cali")]));

        Assert.Equal("coincidencia_existente", vista.Filas[0].Resultado);
        Assert.Equal(existenteId, vista.Filas[0].RegistroCoincidenteId);
        Assert.Contains(vista.Filas[0].Hallazgos, h => h.Codigo == "mercado_existente");
        // OTRO TERRITORIO ES OTRO MERCADO: ni error ni aviso (sin falsos avisos).
        Assert.Equal("crear", vista.Filas[1].Resultado);
        Assert.DoesNotContain(vista.Filas[1].Hallazgos, h => h.Severidad is "error" or "advertencia");

        await ConfirmarAsync(cliente, vista);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var intacto = await db.Mercados.SingleAsync(x => x.Id == existenteId);
        Assert.Equal("publicado", intacto.EstadoRegistro);
        Assert.Null(intacto.Descripcion);
        Assert.True(intacto.Activo);
        Assert.Equal(1, await db.Mercados.CountAsync(x => x.Nombre == nombre && x.CodigoMunicipio == "05001"));
        Assert.Equal(1, await db.Mercados.CountAsync(x => x.Nombre == nombre && x.CodigoMunicipio != "05001"));
    }

    [Fact]
    public async Task Dos_filas_del_mismo_mercado_en_el_archivo_rechazan_la_segunda()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Mercado Repetido {Guid.NewGuid():N}";

        var vista = await PrevisualizarAsync(cliente, Sobre(Municipal(nombre), Municipal(nombre.ToUpperInvariant())));

        Assert.Equal("crear", vista.Filas[0].Resultado);
        Assert.Equal("rechazar", vista.Filas[1].Resultado);
        Assert.Contains(vista.Filas[1].Hallazgos, h => h.Codigo == "duplicado_en_archivo");
    }

    [Fact]
    public async Task Los_parecidos_avisan_con_la_razon_y_la_palabra_mercado_no_da_falsos_avisos()
    {
        using var cliente = await ConsolaAsync(_factory);
        var marca = Guid.NewGuid().ToString("N")[..8];
        await SembrarMercadoAsync("Mercado Currulao del Pacífico", "05", "05001");
        await SembrarMercadoAsync("Mercado Cultural del Pacifico Sur Profundo", "05", "05001");

        var vista = await PrevisualizarAsync(cliente, Sobre(
            // Misma palabra con una letra cambiada: errata de tecleo, solo advertencia.
            Municipal("Mercado Currulo del Pacífico"),
            // Solo comparte «Mercado» y «Cultural» con el existente: NO es un posible duplicado.
            Municipal("Mercado Cultural"),
            // Nada en común.
            Municipal($"Rueda de Negocios {marca}")));

        Assert.DoesNotContain(vista.Filas[1].Hallazgos, h => h.Codigo == "posible_duplicado");
        Assert.DoesNotContain(vista.Filas[2].Hallazgos, h => h.Codigo == "posible_duplicado");
        var parecida = vista.Filas[0];
        Assert.True(parecida.PuedeImportarse);
        var aviso = Assert.Single(parecida.Hallazgos, h => h.Codigo == "posible_duplicado");
        Assert.Equal("advertencia", aviso.Severidad);
        Assert.Contains("Posible errata de tecleo", aviso.Mensaje, StringComparison.Ordinal);
        Assert.Equal(3, vista.FilasImportables);
    }

    [Fact]
    public async Task Cada_fila_se_valida_por_separado_y_ninguna_organizacion_se_crea()
    {
        using var cliente = await ConsolaAsync(_factory);
        var marca = Guid.NewGuid().ToString("N")[..8];
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.EntityProfiles.Add(new EntityProfileRow
            {
                EntityType = "organizacion", Name = $"Corporación Aliada {marca}", StatusCode = "activa",
                IsActive = true, CreatedByUserId = await db.Users.Select(x => x.Id).FirstAsync(), CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        int organizaciones;
        using (var scope = _factory.Services.CreateScope())
            organizaciones = await scope.ServiceProvider.GetRequiredService<SimusDbContext>().EntityProfiles.CountAsync();

        var vista = await PrevisualizarAsync(cliente, Sobre(
            Municipal($"Mercado con dueña {marca}", ("organizacion", $"corporación aliada {marca}")),
            Municipal($"Mercado sin dueña {marca}", ("organizacion", "Organización que no existe")),
            [("nombre", $"Mercado sin municipio {marca}"), ("nivelCobertura", "municipal"), ("departamento", "Antioquia")],
            [("nombre", $"Mercado nacional {marca}"), ("nivelCobertura", "nacional"), ("departamento", "Antioquia")],
            [("nombre", $"Mercado sin nivel {marca}")],
            Municipal($"Mercado alcance raro {marca}", ("alcance", "Galáctico"), ("periodicidad", "Intermitente")),
            Municipal($"Mercado enlace malo {marca}", ("sitioWeb", "https://sin espacios .com"))));

        Assert.Equal("crear", vista.Filas[0].Resultado);
        Assert.Contains(vista.Filas[1].Hallazgos, h => h.Codigo == "organizacion_desconocida");
        Assert.Contains(vista.Filas[2].Hallazgos, h => h.Codigo == "municipio_invalido");
        // La cobertura nacional descarta el territorio y lo dice; no es un error.
        Assert.Equal("crear", vista.Filas[3].Resultado);
        Assert.Contains(vista.Filas[3].Hallazgos, h => h.Codigo == "territorio_omitido_por_cobertura");
        Assert.Contains(vista.Filas[4].Hallazgos, h => h.Codigo == "nivel_cobertura_invalido");
        Assert.Contains(vista.Filas[5].Hallazgos, h => h.Codigo == "alcance_invalido");
        Assert.Contains(vista.Filas[5].Hallazgos, h => h.Codigo == "detalle_periodicidad_requerido");
        Assert.Contains(vista.Filas[6].Hallazgos, h => h.Codigo == "url_invalida");
        Assert.Equal(2, vista.FilasImportables);

        await ConfirmarAsync(cliente, vista);
        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<SimusDbContext>();
        var conDueña = await db2.Mercados.SingleAsync(x => x.Nombre == $"Mercado con dueña {marca}");
        Assert.Equal($"Corporación Aliada {marca}", (await db2.EntityProfiles.SingleAsync(x => x.Id == conDueña.OrganizacionPrincipalId)).Name);
        Assert.Equal(0, await db2.Mercados.CountAsync(x => x.Nombre.Contains($"sin dueña {marca}")));
        Assert.Equal(organizaciones, await db2.EntityProfiles.CountAsync());
        var nacional = await db2.Mercados.SingleAsync(x => x.Nombre == $"Mercado nacional {marca}");
        Assert.Null(nacional.CodigoDepartamento);
    }

    [Fact]
    public async Task El_festival_debe_ser_de_la_misma_organizacion_y_una_fila_excluida_no_se_escribe()
    {
        using var cliente = await ConsolaAsync(_factory);
        var marca = Guid.NewGuid().ToString("N")[..8];
        var festival = $"Festival Marco {marca}";
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).FirstAsync();
            db.FestivalRecords.Add(new FestivalRow
            {
                Name = festival, CoverageLevel = "nacional", OrganizacionPrincipalId = institucional,
                StatusCode = "publicado", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        var vista = await PrevisualizarAsync(cliente, Sobre(
            Municipal($"Mercado en marco {marca}", ("festival", festival)),
            Municipal($"Mercado marco inexistente {marca}", ("festival", "Festival que no existe")),
            Municipal($"Mercado excluido {marca}")));

        Assert.Equal("crear", vista.Filas[0].Resultado);
        Assert.Equal(festival, vista.Filas[0].Datos["festival"]);
        Assert.Contains(vista.Filas[1].Hallazgos, h => h.Codigo == "festival_desconocido");

        await ConfirmarAsync(cliente, vista, vista.Filas[2].Id);
        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<SimusDbContext>();
        var enMarco = await db2.Mercados.SingleAsync(x => x.Nombre == $"Mercado en marco {marca}");
        Assert.True(enMarco.SeRealizaEnElMarcoDeUnFestival);
        Assert.NotNull(enMarco.FestivalId);
        Assert.Equal(0, await db2.Mercados.CountAsync(x => x.Nombre == $"Mercado excluido {marca}"));
    }

    [Fact]
    public async Task Si_aparece_un_mercado_coincidente_entre_la_vista_previa_y_la_confirmacion_no_se_escribe_nada()
    {
        using var cliente = await ConsolaAsync(_factory);
        var nombre = $"Mercado Carrera {Guid.NewGuid():N}";
        var vista = await PrevisualizarAsync(cliente, Sobre(Municipal(nombre)));
        Assert.Equal("crear", vista.Filas[0].Resultado);

        await SembrarMercadoAsync(nombre, "05", "05001");
        var respuesta = await PedirConfirmacionAsync(cliente, vista);

        Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
        using var scope = _factory.Services.CreateScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<SimusDbContext>().Mercados.CountAsync(x => x.Nombre == nombre));
    }

    [Fact]
    public async Task La_sede_principal_sale_del_territorio_o_del_archivo_y_nunca_bloquea_la_fila()
    {
        using var cliente = await ConsolaAsync(_factory);
        var marca = Guid.NewGuid().ToString("N")[..8];

        var vista = await PrevisualizarAsync(cliente, Sobre(
            // Sin columnas de sede: municipal, se deriva del municipio.
            Municipal($"Rueda Cafetera Derivada {marca}"),
            // Nacional con la sede en el archivo: la cobertura sigue sin territorio.
            [("nombre", $"Feria Sureña de Sede Propia {marca}"), ("nivelCobertura", "nacional"),
             ("sedeDepartamento", "Antioquia"), ("sedeMunicipio", "Medellin")],
            // Nacional sin sede: se importa y queda pendiente de completar, con un aviso informativo.
            [("nombre", $"Encuentro Pacífico Pendiente {marca}"), ("nivelCobertura", "nacional")],
            // Una sede que no existe en DIVIPOLA sí se rechaza: el archivo dijo algo que no es cierto.
            [("nombre", $"Muestra Andina Mentirosa {marca}"), ("nivelCobertura", "nacional"),
             ("sedeDepartamento", "Atlantida"), ("sedeMunicipio", "Ciudad Esmeralda")]));

        var hallazgos = string.Join(" | ", vista.Filas.Select(f => $"{f.Resultado}: {string.Join(",", f.Hallazgos.Select(h => h.Codigo))}"));
        Assert.True(vista.Filas[0].Resultado == "crear", hallazgos);
        Assert.True(vista.Filas[1].Resultado == "crear", hallazgos);
        Assert.True(vista.Filas[2].Resultado == "crear", hallazgos);
        Assert.Contains(vista.Filas[2].Hallazgos, h => h.Codigo == "sede_pendiente");
        Assert.Contains(vista.Filas[3].Hallazgos, h => h.Codigo == "sede_departamento_invalido");
        Assert.Equal(3, vista.FilasImportables);

        await ConfirmarAsync(cliente, vista);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var derivada = await db.Mercados.SingleAsync(x => x.Nombre == $"Rueda Cafetera Derivada {marca}");
        Assert.Equal(("05", "05001"), (derivada.SedeCodigoDepartamento, derivada.SedeCodigoMunicipio));
        var nacional = await db.Mercados.SingleAsync(x => x.Nombre == $"Feria Sureña de Sede Propia {marca}");
        Assert.Null(nacional.CodigoDepartamento);
        Assert.Equal(("05", "05001"), (nacional.SedeCodigoDepartamento, nacional.SedeCodigoMunicipio));
        var pendiente = await db.Mercados.SingleAsync(x => x.Nombre == $"Encuentro Pacífico Pendiente {marca}");
        Assert.True(SedePrincipal.Pendiente(pendiente));
    }
}
