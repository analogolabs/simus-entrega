using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.ConsultaGuiada;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La Consulta Guiada del portal público (decisión 158): banco cerrado, anónimo, con cupo estricto y sin campos no públicos.
/// </summary>
/// <remarks>
/// Cada prueba levanta su propia fábrica: el cupo por origen es de 20 por minuto y las pruebas comparten dirección de origen,
/// así que compartir la fábrica cruzaría el conteo.
/// </remarks>
public sealed class ConsultaGuiadaPublicaTests
{
    private const string Estado = "/api/v1/publico/consulta-guiada/estado";
    private const string Consultar = "/api/v1/publico/consulta-guiada/consultar";

    private static readonly string[] CamposDeLaRespuesta = ["respuesta", "consultaElegida", "resueltoPor", "generadoEn", "consulta", "contexto"];
    private static readonly string[] CamposDeLaTabla = ["titulo", "fuente", "alcance", "columnas", "filas", "destinos", "columnaDeEnlace", "filtrosAplicados"];

    [Fact]
    public async Task El_estado_se_lee_sin_sesion_y_ofrece_entre_25_y_36_preguntas_del_banco_publico()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();

        var respuesta = await cliente.GetAsync(Estado);

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var estado = await respuesta.Content.ReadFromJsonAsync<EstadoDeConsultaGuiadaPublicaDto>();
        Assert.NotNull(estado);
        Assert.True(estado!.Disponible);
        Assert.InRange(estado.Preguntas.Count, 25, 36);
        Assert.Equal(BancoDePreguntasPublicas.Preguntas.Select(item => item.Id), estado.Preguntas.Select(item => item.Id));
        // Nada del catálogo de la consola ni de la organización se ofrece aquí.
        var ajenas = CatalogoDeConsultas.De(AmbitoDeConsulta.Institucional).Concat(CatalogoDeConsultas.De(AmbitoDeConsulta.Organizacion)).Select(item => item.Id);
        Assert.Empty(estado.Preguntas.Select(item => item.Id).Intersect(ajenas));
    }

    [Fact]
    public async Task Cada_pregunta_responde_con_fuente_alcance_y_tabla_y_solo_con_los_campos_declarados()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();

        foreach (var pregunta in BancoDePreguntasPublicas.Preguntas.Where(p => p.Parametros.All(x => !x.Obligatorio)))
        {
            var respuesta = await cliente.PostAsJsonAsync(Consultar, new { preguntaId = pregunta.Id });
            Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
            var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();

            // SOLO ESTOS CAMPOS: ni identificadores, ni contactos, ni estados de revisión.
            Assert.Equal(CamposDeLaRespuesta.Order(), cuerpo.EnumerateObject().Select(p => p.Name).Order());
            Assert.Equal("banco_publico", cuerpo.GetProperty("resueltoPor").GetString());
            Assert.Equal(pregunta.Id, cuerpo.GetProperty("consultaElegida").GetString());
            Assert.False(string.IsNullOrWhiteSpace(cuerpo.GetProperty("respuesta").GetString()));
            var tabla = cuerpo.GetProperty("consulta");
            Assert.Equal(CamposDeLaTabla.Order(), tabla.EnumerateObject().Select(p => p.Name).Order());
            Assert.False(string.IsNullOrWhiteSpace(tabla.GetProperty("fuente").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(tabla.GetProperty("alcance").GetString()));
            var columnas = tabla.GetProperty("columnas").GetArrayLength();
            Assert.True(columnas >= 2);
            var filas = tabla.GetProperty("filas").GetArrayLength();
            foreach (var fila in tabla.GetProperty("filas").EnumerateArray()) Assert.Equal(columnas, fila.GetArrayLength());
            // CADA FILA LLEVA SU DESTINO: una ruta interna del portal (nunca una dirección externa) alineada con las filas.
            var destinos = tabla.GetProperty("destinos");
            Assert.Equal(filas, destinos.GetArrayLength());
            foreach (var destino in destinos.EnumerateArray())
            {
                var ruta = destino.GetString();
                Assert.False(string.IsNullOrWhiteSpace(ruta));
                Assert.StartsWith("/", ruta, StringComparison.Ordinal);
                Assert.DoesNotContain("//", ruta, StringComparison.Ordinal);
            }
            Assert.InRange(tabla.GetProperty("columnaDeEnlace").GetInt32(), 0, columnas - 1);
            // Una consulta verificada nunca se presenta como IA.
            Assert.DoesNotContain("IA", cuerpo.GetProperty("respuesta").GetString()!, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Ninguna_respuesta_trae_borradores_ni_datos_personales_ni_de_contacto()
    {
        await using var factory = new TestWebApplicationFactory();
        var marca = "SECRETO" + Guid.NewGuid().ToString("N")[..8];
        var manana = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3);
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.FestivalRecords.Add(new FestivalRow
            {
                Name = $"Festival en revisión {marca}", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001",
                StatusCode = EstadosFestival.EnRevision, ContactEmail = $"{marca}@privado.test", ContactPhone = "3009998877", CreatedAt = DateTime.UtcNow,
            });
            db.FestivalRecords.Add(new FestivalRow
            {
                Name = $"Festival publicado {marca}", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001",
                StatusCode = EstadosFestival.Publicado, ContactEmail = $"{marca}@privado.test", ContactPhone = "3009998877", CreatedAt = DateTime.UtcNow,
            });
            db.EventosAgenda.AddRange(
                new EventoAgendaRow { Slug = "b-" + marca, Titulo = $"Borrador {marca}", Descripcion = "d", FechaInicio = manana, Estado = "borrador", Organizador = marca, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow },
                new EventoAgendaRow { Slug = "p-" + marca, Titulo = $"Publicado {marca}", Descripcion = "d", FechaInicio = manana, Estado = "publicado", Organizador = marca, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow });
            db.Noticias.AddRange(
                new NoticiaRow { Slug = "nb-" + marca, Titulo = $"Noticia en borrador {marca}", Resumen = "r", Estado = "borrador", FechaPublicacion = manana.AddDays(-5), FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow },
                new NoticiaRow { Slug = "np-" + marca, Titulo = $"Noticia publicada {marca}", Resumen = "r", Estado = "publicado", FechaPublicacion = manana.AddDays(-5), AutoriaNombre = marca, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        var cliente = factory.CreateClient();
        var todo = new List<string>();
        foreach (var pregunta in BancoDePreguntasPublicas.Preguntas.Where(p => p.Parametros.All(x => !x.Obligatorio)))
        {
            var respuesta = await cliente.PostAsJsonAsync(Consultar, new { preguntaId = pregunta.Id });
            todo.Add(await respuesta.Content.ReadAsStringAsync());
        }
        var texto = string.Join('\n', todo);

        // Lo publicado de agenda y noticias SÍ sale (con título, fecha y lugar); lo demás no.
        Assert.Contains($"Publicado {marca}", texto, StringComparison.Ordinal);
        Assert.Contains($"Noticia publicada {marca}", texto, StringComparison.Ordinal);
        Assert.DoesNotContain($"Borrador {marca}", texto, StringComparison.Ordinal);
        Assert.DoesNotContain($"Noticia en borrador {marca}", texto, StringComparison.Ordinal);
        Assert.DoesNotContain($"Festival en revisión {marca}", texto, StringComparison.Ordinal);
        // Sin parámetros, ninguna pregunta lista los festivales por su nombre: las listas nominales piden un lugar o un catálogo.
        Assert.DoesNotContain($"Festival publicado {marca}", texto, StringComparison.Ordinal);
        // Ni contacto, ni organizador ni autoría, ni ningún correo o teléfono.
        Assert.DoesNotContain(marca + "@", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("3009998877", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("@", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("pnmc.local", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotMatch(@"""organizador""|""autoria""|""correo""|""telefono""|""estado""", texto);
        // Los totales sí cuentan lo publicado: el festival publicado entra, el que está en revisión no.
        var procesos = JsonSerializer.Deserialize<RespuestaDeConsultaGuiadaDto>(todo[0], new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        Assert.Equal("1", procesos.Consulta!.Filas.Single(fila => fila[0] == "Festivales")[1]);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("mis_pendientes")]
    [InlineData("resumen_de_talleres")]
    [InlineData("festivales_por_estado")]
    [InlineData("¿qué festivales están en revisión?")]
    public async Task Una_pregunta_que_no_es_del_banco_publico_se_rechaza(string preguntaId)
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();

        var respuesta = await cliente.PostAsJsonAsync(Consultar, new { preguntaId });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task El_cupo_por_origen_corta_con_429_despues_de_veinte_consultas()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();
        var estados = new List<HttpStatusCode>();
        for (var i = 0; i < LimiteDeTasaConsultaGuiadaPublica.CupoPorMinutoYPorOrigen + 2; i++)
            estados.Add((await cliente.PostAsJsonAsync(Consultar, new { preguntaId = "publica_noticias_recientes" })).StatusCode);

        Assert.All(estados.Take(LimiteDeTasaConsultaGuiadaPublica.CupoPorMinutoYPorOrigen), codigo => Assert.Equal(HttpStatusCode.OK, codigo));
        Assert.Equal(HttpStatusCode.TooManyRequests, estados[^1]);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await cliente.GetAsync(Estado)).StatusCode);
    }

    [Fact]
    public async Task Los_ambitos_de_la_consola_y_de_la_organizacion_siguen_pidiendo_sesion()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();

        var consola = await cliente.PostAsJsonAsync("/api/v1/admin/analisis/consultar", new { pregunta = "¿cuántos festivales hay?" });
        var organizacion = await cliente.GetAsync("/api/v1/externo/organizaciones/1/consulta-guiada/estado");

        Assert.True(consola.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);
        Assert.True(organizacion.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);
    }
}
