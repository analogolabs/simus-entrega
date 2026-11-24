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
/// LA CONSOLA LEE LA SEDE PRINCIPAL (decisión 124): filtros de departamento y municipio en
/// las listas de los cinco procesos, tablero acotado, analíticas y consulta guiada por sede (con
/// respaldo a la cobertura mientras la sede esté pendiente) y el conteo de procesos con sede pendiente.
/// </summary>
public sealed class FiltrosPorSedeDeLaConsolaTests
{
    /// <summary>
    /// Un proceso de cada tipo con la sede en Medellín (05/05001) y cobertura nacional, y otro sin sede
    /// con cobertura nacional (pendiente de completar). Los nombres dicen cuál es cuál.
    /// </summary>
    private static async Task SembrarAsync(TestWebApplicationFactory factory)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        if (!await db.DivipolaLocations.AnyAsync(d => d.MunicipalityCode == "76001"))
        {
            db.DivipolaLocations.Add(new DivipolaLocationRow
            {
                DepartmentCode = "76", DepartmentName = "Valle del Cauca", MunicipalityCode = "76001", MunicipalityName = "Cali", LocationType = "MUNICIPALITY",
            });
            await db.SaveChangesAsync();
        }
        var ahora = DateTime.UtcNow;
        var organizacion = (await db.EntityProfiles.AsNoTracking().OrderBy(e => e.Id).FirstAsync()).Id;
        db.FestivalRecords.AddRange(
            new FestivalRow { Name = "Festival con sede", CoverageLevel = "nacional", StatusCode = EstadosFestival.Publicado, CreatedAt = ahora, SedeCodigoDepartamento = "05", SedeCodigoMunicipio = "05001" },
            new FestivalRow { Name = "Festival sin sede", CoverageLevel = "nacional", StatusCode = EstadosFestival.Publicado, CreatedAt = ahora },
            new FestivalRow { Name = "Festival en Cali", CoverageLevel = "nacional", StatusCode = EstadosFestival.Publicado, CreatedAt = ahora, SedeCodigoDepartamento = "76", SedeCodigoMunicipio = "76001" });
        await db.SaveChangesAsync();
        db.Mercados.AddRange(
            new MercadoRow { Nombre = "Mercado con sede", NivelCobertura = "nacional", OrganizacionPrincipalId = organizacion, EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora, SedeCodigoDepartamento = "05", SedeCodigoMunicipio = "05001" },
            new MercadoRow { Nombre = "Mercado sin sede", NivelCobertura = "nacional", OrganizacionPrincipalId = organizacion, EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora },
            new MercadoRow { Nombre = "Mercado en Cali", NivelCobertura = "nacional", OrganizacionPrincipalId = organizacion, EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora, SedeCodigoDepartamento = "76", SedeCodigoMunicipio = "76001" });
        await db.SaveChangesAsync();
        db.Talleres.AddRange(
            new TallerRow { Nombre = "Taller con sede", NivelCobertura = "nacional", EstadoRegistro = "publicado", FechaCreacion = ahora, SedeCodigoDepartamento = "05", SedeCodigoMunicipio = "05001" },
            new TallerRow { Nombre = "Taller sin sede", NivelCobertura = "nacional", EstadoRegistro = "publicado", FechaCreacion = ahora },
            new TallerRow { Nombre = "Taller en Cali", NivelCobertura = "nacional", EstadoRegistro = "publicado", FechaCreacion = ahora, SedeCodigoDepartamento = "76", SedeCodigoMunicipio = "76001" });
        await db.SaveChangesAsync();
        db.Espacios.AddRange(
            new EspacioRow { Nombre = "Espacio con sede", NivelCobertura = "nacional", EstadoRegistro = "publicado", FechaCreacion = ahora, SedeCodigoDepartamento = "05", SedeCodigoMunicipio = "05001" },
            new EspacioRow { Nombre = "Espacio sin sede", NivelCobertura = "nacional", EstadoRegistro = "publicado", FechaCreacion = ahora },
            new EspacioRow { Nombre = "Espacio en Cali", NivelCobertura = "nacional", EstadoRegistro = "publicado", FechaCreacion = ahora, SedeCodigoDepartamento = "76", SedeCodigoMunicipio = "76001" });
        await db.SaveChangesAsync();
        db.Redes.AddRange(
            new RedRow { Nombre = "Red con sede", NivelCobertura = "nacional", EstadoRegistro = "publicado", FechaCreacion = ahora, SedeCodigoDepartamento = "05", SedeCodigoMunicipio = "05001" },
            new RedRow { Nombre = "Red sin sede", NivelCobertura = "nacional", EstadoRegistro = "publicado", FechaCreacion = ahora },
            new RedRow { Nombre = "Red en Cali", NivelCobertura = "nacional", EstadoRegistro = "publicado", FechaCreacion = ahora, SedeCodigoDepartamento = "76", SedeCodigoMunicipio = "76001" });
        await db.SaveChangesAsync();
    }

    private static async Task<List<string>> NombresAsync(HttpClient cliente, string ruta, string propiedad)
    {
        var cuerpo = await cliente.GetFromJsonAsync<JsonElement>(ruta);
        return cuerpo.GetProperty("items").EnumerateArray().Select(i => i.GetProperty(propiedad).GetString()!).ToList();
    }

    public static TheoryData<string, string, string> Listas => new()
    {
        { "/api/v1/institucional/mercados", "nombre", "Mercado" },
        { "/api/v1/institucional/talleres", "nombre", "Taller" },
        { "/api/v1/institucional/espacios", "nombre", "Espacio" },
        { "/api/v1/institucional/redes", "nombre", "Red" },
        { "/api/v1/admin/data/records/festivals", "title", "Festival" },
    };

    [Theory]
    [MemberData(nameof(Listas))]
    public async Task La_lista_filtra_por_la_sede_y_no_por_la_cobertura(string ruta, string propiedad, string tipo)
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarAsync(factory);
        using var cliente = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var sep = ruta.Contains('?', StringComparison.Ordinal) ? "&" : "?";
        // Los de la lista de Festivales se llaman «sedeDepartamento»: allí el filtro es «departamento» y «municipio».
        var esFestival = tipo == "Festival";
        var claveDepartamento = esFestival ? "departamento" : "sedeDepartamento";
        var claveMunicipio = esFestival ? "municipio" : "sedeMunicipio";

        // Todos tienen cobertura nacional: por cobertura no habría ninguno en Antioquia; por sede, uno.
        var antioquia = await NombresAsync(cliente, $"{ruta}{sep}{claveDepartamento}=05", propiedad);
        Assert.Contains($"{tipo} con sede", antioquia);
        Assert.DoesNotContain($"{tipo} en Cali", antioquia);
        Assert.DoesNotContain($"{tipo} sin sede", antioquia);

        var medellin = await NombresAsync(cliente, $"{ruta}{sep}{claveDepartamento}=05&{claveMunicipio}=05001", propiedad);
        Assert.Contains($"{tipo} con sede", medellin);
        Assert.DoesNotContain($"{tipo} en Cali", medellin);

        var cali = await NombresAsync(cliente, $"{ruta}{sep}{claveDepartamento}=76&{claveMunicipio}=76001", propiedad);
        Assert.Contains($"{tipo} en Cali", cali);
        Assert.DoesNotContain($"{tipo} con sede", cali);
    }

    [Theory]
    [MemberData(nameof(Listas))]
    public async Task La_lista_ensena_solo_los_de_sede_pendiente_cuando_se_pide(string ruta, string propiedad, string tipo)
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarAsync(factory);
        using var cliente = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var sep = ruta.Contains('?', StringComparison.Ordinal) ? "&" : "?";

        var pendientes = await NombresAsync(cliente, $"{ruta}{sep}sedePendiente=true", propiedad);

        Assert.Contains($"{tipo} sin sede", pendientes);
        Assert.DoesNotContain($"{tipo} con sede", pendientes);
        Assert.DoesNotContain($"{tipo} en Cali", pendientes);
    }

    [Fact]
    public async Task La_lista_de_festivales_ofrece_departamentos_y_municipios_de_la_sede_y_cuenta_las_pendientes()
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarAsync(factory);
        using var cliente = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var cuerpo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/admin/data/records/festivals?departamento=05");

        var departamentos = cuerpo.GetProperty("territorios").EnumerateArray().Select(t => t.GetProperty("codigo").GetString()).ToList();
        Assert.Contains("05", departamentos);
        Assert.Contains("76", departamentos);
        var municipios = cuerpo.GetProperty("municipios").EnumerateArray().Select(t => t.GetProperty("codigo").GetString()).ToList();
        Assert.Equal(["05001"], municipios);
        // El Festival de demostración que trae la base de pruebas puede tener sede o no; el sembrado aporta al menos una.
        Assert.True(cuerpo.GetProperty("sedesPendientes").GetInt32() >= 1);
    }

    [Fact]
    public async Task El_tablero_se_acota_por_la_sede_y_cuenta_las_sedes_pendientes_de_toda_la_operacion()
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarAsync(factory);
        using var cliente = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var todo = await cliente.GetFromJsonAsync<TableroAnalisisAdministrativoDto>("/api/v1/admin/analisis/tablero");
        var antioquia = await cliente.GetFromJsonAsync<TableroAnalisisAdministrativoDto>("/api/v1/admin/analisis/tablero?departamento=05");
        var cali = await cliente.GetFromJsonAsync<TableroAnalisisAdministrativoDto>("/api/v1/admin/analisis/tablero?departamento=76&municipio=76001");

        Assert.NotNull(todo); Assert.NotNull(antioquia); Assert.NotNull(cali);
        int Total(TableroAnalisisAdministrativoDto t, string id) => t.Indicadores.Single(i => i.Id == id).Total;
        // Cobertura nacional en todos: solo la sede los sitúa.
        Assert.Equal(1, Total(cali, "publicados"));
        Assert.Equal(1, Total(cali, "mercados"));
        Assert.True(Total(antioquia, "publicados") >= 1);
        Assert.True(Total(todo, "publicados") > Total(antioquia, "publicados"));
        Assert.Equal("Valle del Cauca".ToUpperInvariant(), cali.AcotadoA!.Split(',')[1].Trim().ToUpperInvariant());
        Assert.Null(todo.AcotadoA);
        // Cali tiene un reparto por municipio, no por departamento.
        Assert.Contains(cali.DepartamentosPrincipales, fila => fila[0].Contains("Cali", StringComparison.OrdinalIgnoreCase));

        // Las sedes pendientes son de toda la operación: el filtro no las acota.
        var pendientesDeCali = cali.SedesPendientes!.ToDictionary(f => f[0], f => int.Parse(f[1], System.Globalization.CultureInfo.InvariantCulture));
        var pendientesDeTodo = todo.SedesPendientes!.ToDictionary(f => f[0], f => int.Parse(f[1], System.Globalization.CultureInfo.InvariantCulture));
        Assert.Equal(pendientesDeTodo, pendientesDeCali);
        Assert.True(pendientesDeTodo["Mercados"] >= 1);
        Assert.True(pendientesDeTodo["Talleres de lutería"] >= 1);
        Assert.True(pendientesDeTodo["Espacios para música en vivo"] >= 1);
        Assert.True(pendientesDeTodo["Redes y centros de documentación"] >= 1);
        Assert.Equal(pendientesDeTodo.Values.Sum(), todo.Indicadores.Single(i => i.Id == "sedes_pendientes").Total);
    }

    [Fact]
    public async Task Las_analiticas_y_la_consulta_guiada_leen_la_sede_con_respaldo_a_la_cobertura()
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarAsync(factory);
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            // Pendiente de sede, pero de cobertura municipal en Cali: el respaldo lo sitúa allí.
            db.FestivalRecords.Add(new FestivalRow
            {
                Name = "Festival pendiente municipal", CoverageLevel = "municipal", DepartmentCode = "76", MunicipalityCode = "76001",
                StatusCode = EstadosFestival.Publicado, CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        using var cliente = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var respuestaHttp = await cliente.PostAsJsonAsync("/api/v1/admin/analisis/consultar",
            new PreguntaDeConsultaGuiadaDto { Pregunta = "¿Cuántos festivales hay publicados en el Valle del Cauca?" });
        respuestaHttp.EnsureSuccessStatusCode();
        var respuesta = await respuestaHttp.Content.ReadFromJsonAsync<RespuestaDeConsultaGuiadaDto>();

        // Dos: «Festival en Cali» (por su sede, aunque su cobertura es nacional) y el pendiente municipal (por su cobertura).
        Assert.NotNull(respuesta);
        var publicados = respuesta.Consulta!.Filas.Single(f => f[0] == "Festivales publicados");
        Assert.Equal("2", publicados[1]);

        var porDepartamento = await cliente.PostAsJsonAsync("/api/v1/admin/analisis/consultar",
            new PreguntaDeConsultaGuiadaDto { Pregunta = "¿Qué departamentos tienen más Festivales publicados?" });
        var tabla = (await porDepartamento.Content.ReadFromJsonAsync<RespuestaDeConsultaGuiadaDto>())!.Consulta!;
        Assert.Contains(tabla.Filas, f => f[0].Contains("Antioquia", StringComparison.OrdinalIgnoreCase) && f[1] == "1");
        Assert.Contains(tabla.Filas, f => f[0].Contains("Valle", StringComparison.OrdinalIgnoreCase) && f[1] == "2");
    }

    [Fact]
    public async Task La_calidad_de_datos_cuenta_los_festivales_sin_sede_principal()
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarAsync(factory);
        using var cliente = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var respuestaHttp = await cliente.PostAsJsonAsync("/api/v1/admin/analisis/consultar",
            new PreguntaDeConsultaGuiadaDto { Pregunta = "¿Qué información está incompleta?" });
        var tabla = (await respuestaHttp.Content.ReadFromJsonAsync<RespuestaDeConsultaGuiadaDto>())!.Consulta!;

        var fila = tabla.Filas.Single(f => f[0] == "Sin sede principal completa");
        Assert.True(int.Parse(fila[1], System.Globalization.CultureInfo.InvariantCulture) >= 1);
    }
}
