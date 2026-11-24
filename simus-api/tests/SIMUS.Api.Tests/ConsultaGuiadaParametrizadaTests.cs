using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.ConsultaGuiada;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Las preguntas PARAMETRIZADAS de la Consulta Guiada pública (punto 73): parámetros tipados validados contra catálogos,
/// solo registros publicados, sin datos personales y sin SQL dinámico.
/// </summary>
/// <remarks>Cada prueba levanta su fábrica: el cupo es de 20 consultas por minuto y por origen.</remarks>
public sealed class ConsultaGuiadaParametrizadaTests
{
    private const string Estado = "/api/v1/publico/consulta-guiada/estado";
    private const string Consultar = "/api/v1/publico/consulta-guiada/consultar";
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed record Sembrado(int Practica, int Territorio, int Organizacion, string Marca);

    /// <summary>Un mundo pequeño: lo publicado y lo que no, en Antioquia (05) y en Bogotá (11).</summary>
    private static async Task<Sembrado> SembrarAsync(TestWebApplicationFactory factory)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var marca = "ZZ" + Guid.NewGuid().ToString("N")[..6];
        var ahora = DateTime.UtcNow;
        var hoy = DateOnly.FromDateTime(ahora);
        var practica = new PracticaMusicalRow { Nombre = "Chirimía " + marca, Slug = "chirimia-" + marca.ToLowerInvariant(), Orden = 1 };
        var territorio = new TerritorioSonoroRow { Nombre = "Andino " + marca, Slug = "andino-" + marca.ToLowerInvariant(), Orden = 1 };
        var organizacion = new EntityProfileRow
        {
            EntityType = "organizacion", Name = "Corporación " + marca, StatusCode = "activa", IsActive = true,
            CreatedByUserId = 1, CreatedAt = ahora, FechaRevisionConsola = ahora,
        };
        var privada = new EntityProfileRow
        {
            EntityType = "organizacion", Name = "Sin revisar " + marca, StatusCode = "activa", IsActive = true,
            CreatedByUserId = 1, CreatedAt = ahora,
        };
        db.PracticasMusicales.Add(practica);
        db.TerritoriosSonoros.Add(territorio);
        db.EntityProfiles.AddRange(organizacion, privada);
        await db.SaveChangesAsync();

        var publicado = new FestivalRow
        {
            Name = "Festival publicado " + marca, CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001",
            StatusCode = EstadosFestival.Publicado, ContactEmail = marca + "@privado.test", ContactPhone = "3001112233",
            OrganizacionPrincipalId = organizacion.Id, CreatedAt = ahora,
        };
        var borrador = new FestivalRow
        {
            Name = "Festival en revisión " + marca, CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001",
            StatusCode = EstadosFestival.EnRevision, CreatedAt = ahora,
        };
        db.FestivalRecords.AddRange(publicado, borrador);
        db.Mercados.AddRange(
            new MercadoRow { Nombre = "Mercado publicado " + marca, NivelCobertura = "municipal", CodigoDepartamento = "11", CodigoMunicipio = "11001", OrganizacionPrincipalId = organizacion.Id, EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora },
            new MercadoRow { Nombre = "Mercado borrador " + marca, NivelCobertura = "municipal", CodigoDepartamento = "11", CodigoMunicipio = "11001", OrganizacionPrincipalId = organizacion.Id, EstadoRegistro = "borrador", Activo = true, FechaCreacion = ahora });
        db.Talleres.AddRange(
            new TallerRow { Nombre = "Taller publicado " + marca, NivelCobertura = "municipal", CodigoDepartamento = "05", CodigoMunicipio = "05001", OrganizacionPrincipalId = organizacion.Id, EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora },
            new TallerRow { Nombre = "Taller borrador " + marca, NivelCobertura = "municipal", CodigoDepartamento = "05", CodigoMunicipio = "05001", EstadoRegistro = "en_revision", Activo = true, FechaCreacion = ahora });
        db.Espacios.Add(new EspacioRow { Nombre = "Espacio publicado " + marca, NivelCobertura = "municipal", CodigoDepartamento = "05", CodigoMunicipio = "05001", EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora });
        db.Redes.Add(new RedRow { Nombre = "Red inactiva " + marca, NivelCobertura = "nacional", EstadoRegistro = "publicado", Activo = false, FechaCreacion = ahora });
        await db.SaveChangesAsync();

        db.EventosAgenda.AddRange(
            new EventoAgendaRow { Slug = "p-" + marca, Titulo = "Evento publicado " + marca, Descripcion = "d", FechaInicio = hoy.AddDays(2), Estado = "publicado", CodigoDepartamento = "05", CodigoMunicipio = "05001", FestivalId = publicado.Id, Organizador = marca, FechaCreacion = ahora, FechaActualizacion = ahora },
            new EventoAgendaRow { Slug = "b-" + marca, Titulo = "Evento borrador " + marca, Descripcion = "d", FechaInicio = hoy.AddDays(2), Estado = "borrador", CodigoDepartamento = "05", CodigoMunicipio = "05001", FechaCreacion = ahora, FechaActualizacion = ahora },
            new EventoAgendaRow { Slug = "c-" + marca, Titulo = "Evento de Bogotá " + marca, Descripcion = "d", FechaInicio = hoy.AddDays(3), Estado = "publicado", CodigoDepartamento = "11", CodigoMunicipio = "11001", FechaCreacion = ahora, FechaActualizacion = ahora });
        await db.SaveChangesAsync();
        db.Set<PracticaMusicalDeRegistroRow>().Add(new PracticaMusicalDeRegistroRow { ModuloId = Modulos.Festivales, RegistroId = Clasificaciones.Clave(publicado.Id), ValorId = practica.Id, FechaCreacion = ahora });
        await db.SaveChangesAsync();
        return new Sembrado(practica.Id, territorio.Id, organizacion.Id, marca);
    }

    private static async Task<RespuestaDeConsultaGuiadaDto> PreguntarAsync(HttpClient cliente, string id, object? parametros = null)
    {
        var respuesta = await cliente.PostAsJsonAsync(Consultar, new { preguntaId = id, parametros });
        Assert.True(respuesta.StatusCode == HttpStatusCode.OK, $"{id}: {respuesta.StatusCode} {await respuesta.Content.ReadAsStringAsync()}");
        return (await respuesta.Content.ReadFromJsonAsync<RespuestaDeConsultaGuiadaDto>(Web))!;
    }

    private static string Nombres(RespuestaDeConsultaGuiadaDto respuesta) =>
        string.Join('\n', respuesta.Consulta!.Filas.Select(fila => string.Join('|', fila)));

    [Fact]
    public async Task El_catalogo_declara_parametros_tipados_conocidos_y_ofrece_los_catalogos()
    {
        await using var factory = new TestWebApplicationFactory();
        var sembrado = await SembrarAsync(factory);
        var estado = (await factory.CreateClient().GetFromJsonAsync<EstadoDeConsultaGuiadaPublicaDto>(Estado, Web))!;

        Assert.Equal(estado.Preguntas.Count, estado.Preguntas.Select(p => p.Id).Distinct().Count());
        string[] conocidos = ["departamento", "municipio", "tipo", "practica", "territorio", "organizacion", "mes", "anio"];
        Assert.All(estado.Preguntas.SelectMany(p => p.Parametros), parametro => Assert.Contains(parametro.Nombre, conocidos));
        Assert.Contains(estado.Preguntas, p => p.Parametros.Any(x => x.Obligatorio));
        // Preparado para la capa semántica: ámbito explícito y 3 a 6 formulaciones por pregunta.
        Assert.All(estado.Preguntas, p =>
        {
            Assert.Equal("publico", p.Ambito);
            Assert.InRange(p.Ejemplos.Count, 3, 6);
        });
        Assert.Contains(estado.Catalogos.Departamentos, d => d.Id == "05" && d.Nombre == "Antioquia");
        Assert.Contains(estado.Catalogos.Municipios, m => m[0] == "05001");
        Assert.Equal(5, estado.Catalogos.Tipos.Count);
        Assert.Contains(estado.Catalogos.Practicas, p => p.Id == sembrado.Practica.ToString());
        // Solo las organizaciones con ficha pública se ofrecen: la que no se ha revisado no aparece.
        Assert.Contains(estado.Catalogos.Organizaciones, o => o.Id == sembrado.Organizacion.ToString());
        Assert.DoesNotContain(estado.Catalogos.Organizaciones, o => o.Nombre.StartsWith("Sin revisar", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("publica_festivales_en_departamento", "departamento", "99")]
    [InlineData("publica_festivales_en_departamento", "departamento", "05' OR 1=1 --")]
    [InlineData("publica_festivales_en_departamento", "departamento", "05; DROP TABLE Festivales")]
    [InlineData("publica_festivales_en_departamento", "departamento", "Antioquia")]
    [InlineData("publica_mercados_en_municipio", "municipio", "11001' UNION SELECT 1 --")]
    [InlineData("publica_mercados_en_municipio", "municipio", "99999")]
    [InlineData("publica_agenda_filtrada", "tipo", "bancos")]
    [InlineData("publica_agenda_filtrada", "mes", "13")]
    [InlineData("publica_agenda_filtrada", "mes", "0")]
    [InlineData("publica_agenda_filtrada", "anio", "mil")]
    [InlineData("publica_agenda_filtrada", "anio", "1850")]
    [InlineData("publica_festivales_con_practica", "practica", "999999")]
    [InlineData("publica_festivales_con_practica", "practica", "1 OR 1=1")]
    [InlineData("publica_festivales_con_territorio", "territorio", "-1")]
    [InlineData("publica_procesos_de_organizacion", "organizacion", "999999")]
    [InlineData("publica_procesos_en_departamento", "tipo", "festivales")]
    public async Task Un_parametro_invalido_o_no_admitido_se_rechaza_con_400_y_sin_ejecutar(string id, string parametro, string valor)
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();
        // Los obligatorios que no son el que se prueba van válidos, para que el rechazo sea del parámetro probado.
        var enviados = new Dictionary<string, string> { [parametro] = valor };
        if (id == "publica_festivales_en_departamento" && parametro != "departamento") enviados["departamento"] = "05";

        var respuesta = await cliente.PostAsJsonAsync(Consultar, new { preguntaId = id, parametros = enviados });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task Un_parametro_obligatorio_vacio_o_ausente_se_rechaza_y_el_municipio_debe_ser_del_departamento()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsJsonAsync(Consultar, new { preguntaId = "publica_festivales_en_departamento" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsJsonAsync(Consultar,
            new { preguntaId = "publica_festivales_en_departamento", parametros = new { departamento = "  " } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsJsonAsync(Consultar,
            new { preguntaId = "publica_agenda_filtrada", parametros = new { departamento = "11", municipio = "05001" } })).StatusCode);
        // Una pregunta fija no admite parámetros.
        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsJsonAsync(Consultar,
            new { preguntaId = "publica_noticias_recientes", parametros = new { departamento = "05" } })).StatusCode);
        // El cuerpo de error nombra el parámetro.
        var cuerpo = await (await cliente.PostAsJsonAsync(Consultar, new { preguntaId = "publica_festivales_en_departamento" })).Content.ReadAsStringAsync();
        Assert.Contains("departamento", cuerpo, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Las_listas_por_lugar_y_tipo_traen_solo_lo_publicado_con_filtros_y_enlace_a_la_ficha()
    {
        await using var factory = new TestWebApplicationFactory();
        var s = await SembrarAsync(factory);
        var cliente = factory.CreateClient();

        var festivales = await PreguntarAsync(cliente, "publica_festivales_en_departamento", new { departamento = "05" });
        Assert.Contains("Festival publicado " + s.Marca, Nombres(festivales), StringComparison.Ordinal);
        Assert.DoesNotContain("Festival en revisión", Nombres(festivales), StringComparison.Ordinal);
        Assert.Contains("Departamento: Antioquia", festivales.Consulta!.FiltrosAplicados!);
        Assert.Contains("Solo registros publicados", festivales.Consulta.FiltrosAplicados!);
        Assert.StartsWith("/ecosistema/festivales/", festivales.Consulta.Destinos![0], StringComparison.Ordinal);
        Assert.Contains("1 festival publicado", festivales.Respuesta, StringComparison.Ordinal);

        var enBogota = await PreguntarAsync(cliente, "publica_festivales_en_departamento", new { departamento = "11" });
        Assert.Empty(enBogota.Consulta!.Filas);
        Assert.StartsWith("No hay festivales publicados", enBogota.Respuesta, StringComparison.Ordinal);

        var mercados = await PreguntarAsync(cliente, "publica_mercados_en_municipio", new { municipio = "11001" });
        Assert.Contains("Mercado publicado " + s.Marca, Nombres(mercados), StringComparison.Ordinal);
        Assert.DoesNotContain("Mercado borrador", Nombres(mercados), StringComparison.Ordinal);
        Assert.StartsWith("/ecosistema/mercados-musicales/", mercados.Consulta!.Destinos![0], StringComparison.Ordinal);

        var talleres = await PreguntarAsync(cliente, "publica_talleres_en_departamento", new { departamento = "05" });
        Assert.Contains("Taller publicado " + s.Marca, Nombres(talleres), StringComparison.Ordinal);
        Assert.DoesNotContain("Taller borrador", Nombres(talleres), StringComparison.Ordinal);

        var espacios = await PreguntarAsync(cliente, "publica_espacios_en_municipio", new { municipio = "05001" });
        Assert.Contains("Espacio publicado " + s.Marca, Nombres(espacios), StringComparison.Ordinal);

        // Una red inactiva no es pública aunque diga «publicado».
        var redes = await PreguntarAsync(cliente, "publica_redes_por_departamento");
        Assert.Empty(redes.Consulta!.Filas);
        Assert.DoesNotContain("Red inactiva", JsonSerializer.Serialize(redes), StringComparison.Ordinal);

        // Ni contacto ni personas en ninguna respuesta.
        var texto = JsonSerializer.Serialize(new[] { festivales, mercados, talleres, espacios });
        Assert.DoesNotContain("@", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("3001112233", texto, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Las_preguntas_de_catalogo_organizacion_y_completitud_responden_con_lo_publicado()
    {
        await using var factory = new TestWebApplicationFactory();
        var s = await SembrarAsync(factory);
        var cliente = factory.CreateClient();

        var conPractica = await PreguntarAsync(cliente, "publica_festivales_con_practica", new { practica = s.Practica.ToString() });
        Assert.Contains("Festival publicado " + s.Marca, Nombres(conPractica), StringComparison.Ordinal);
        Assert.DoesNotContain("Festival en revisión", Nombres(conPractica), StringComparison.Ordinal);

        var conTerritorio = await PreguntarAsync(cliente, "publica_festivales_con_territorio", new { territorio = s.Territorio.ToString() });
        Assert.Empty(conTerritorio.Consulta!.Filas);

        var practicas = await PreguntarAsync(cliente, "publica_practicas_en_departamento", new { departamento = "05" });
        Assert.Contains("Chirimía " + s.Marca, Nombres(practicas), StringComparison.Ordinal);

        var enDepartamento = await PreguntarAsync(cliente, "publica_procesos_en_departamento", new { departamento = "05" });
        Assert.Equal("1", enDepartamento.Consulta!.Filas.Single(f => f[0] == "Festivales")[1]);
        Assert.Equal("1", enDepartamento.Consulta.Filas.Single(f => f[0] == "Talleres de lutería")[1]);
        Assert.Contains("departamento=Antioquia", enDepartamento.Consulta.Destinos![0], StringComparison.Ordinal);

        var matriz = await PreguntarAsync(cliente, "publica_procesos_por_departamento");
        Assert.Equal(7, matriz.Consulta!.Columnas.Count);
        Assert.True(matriz.Consulta.Filas.Count >= 2);

        var ranking = await PreguntarAsync(cliente, "publica_organizaciones_con_mas_procesos");
        Assert.Contains("Corporación " + s.Marca + "|3", Nombres(ranking), StringComparison.Ordinal);
        Assert.DoesNotContain("Sin revisar", Nombres(ranking), StringComparison.Ordinal);
        Assert.Equal($"/ecosistema/organizaciones/{s.Organizacion}", ranking.Consulta!.Destinos![0]);

        var deLaOrganizacion = await PreguntarAsync(cliente, "publica_procesos_de_organizacion", new { organizacion = s.Organizacion.ToString() });
        Assert.Equal(3, deLaOrganizacion.Consulta!.Filas.Count);
        Assert.DoesNotContain("borrador", Nombres(deLaOrganizacion), StringComparison.Ordinal);

        var completitud = await PreguntarAsync(cliente, "publica_completitud_del_dato");
        Assert.Equal("1", completitud.Consulta!.Filas.Single(f => f[0] == "Festivales")[1]);
        Assert.Equal(["Tipo de proceso", "Publicados", "Con departamento", "Con municipio"], completitud.Consulta.Columnas);
    }

    [Fact]
    public async Task La_agenda_filtra_por_lugar_tipo_y_mes_y_nunca_trae_borradores()
    {
        await using var factory = new TestWebApplicationFactory();
        var s = await SembrarAsync(factory);
        var cliente = factory.CreateClient();
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        var fecha = hoy.AddDays(2);

        var proximos = await PreguntarAsync(cliente, "publica_agenda_filtrada");
        Assert.Contains("Evento publicado " + s.Marca, Nombres(proximos), StringComparison.Ordinal);
        Assert.Contains("Evento de Bogotá " + s.Marca, Nombres(proximos), StringComparison.Ordinal);
        Assert.DoesNotContain("Evento borrador", Nombres(proximos), StringComparison.Ordinal);

        var enAntioquia = await PreguntarAsync(cliente, "publica_agenda_filtrada", new { departamento = "05" });
        Assert.Contains("Evento publicado", Nombres(enAntioquia), StringComparison.Ordinal);
        Assert.DoesNotContain("Bogotá", Nombres(enAntioquia), StringComparison.Ordinal);
        Assert.Contains("Departamento: Antioquia", enAntioquia.Consulta!.FiltrosAplicados!);

        var deFestivales = await PreguntarAsync(cliente, "publica_agenda_filtrada", new { tipo = "festivales" });
        Assert.Contains("Evento publicado", Nombres(deFestivales), StringComparison.Ordinal);
        Assert.DoesNotContain("Bogotá", Nombres(deFestivales), StringComparison.Ordinal);
        Assert.Contains("Enmarcados en: festivales", deFestivales.Consulta!.FiltrosAplicados!);

        var delMes = await PreguntarAsync(cliente, "publica_agenda_filtrada",
            new { mes = fecha.Month.ToString(), anio = fecha.Year.ToString(), departamento = "05" });
        Assert.Contains("Evento publicado", Nombres(delMes), StringComparison.Ordinal);
        var otroAnio = await PreguntarAsync(cliente, "publica_agenda_filtrada", new { mes = fecha.Month.ToString(), anio = (fecha.Year - 1).ToString() });
        Assert.Empty(otroAnio.Consulta!.Filas);

        var sinAnio = await PreguntarAsync(cliente, "publica_agenda_filtrada", new { mes = hoy.Month.ToString() });
        Assert.Contains($"{hoy.Year}", string.Join(' ', sinAnio.Consulta!.FiltrosAplicados!), StringComparison.Ordinal);

        var porMes = await PreguntarAsync(cliente, "publica_agenda_por_mes");
        Assert.Equal(12, porMes.Consulta!.Filas.Count);
    }
}
