using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La exploración del catálogo público ocurre en el servidor: filtros, orden, página y facetas.
///
/// <para>
/// LO QUE FIJAN. Antes el portal bajaba el acervo entero y lo ordenaba y filtraba en el navegador; ahora
/// el navegador pide una página y el servidor decide. Estas pruebas sostienen tres cosas: que el orden por
/// cada columna (y su sentido) lo hace el servidor, que los filtros de autor, año, tema y material
/// combinan, y que los temas con la misma raíz («banda» y «bandas») cuentan juntos.
/// </para>
/// </summary>
public sealed class CatalogoEditorialExploracionTests
{
    private const string Consola = "/api/v1/institucional/catalogo-editorial";
    private const string Publico = "/api/v1/publico/catalogo-editorial";

    // ── La clasificación y las claves de tema, sin servidor ──

    [Theory]
    [InlineData("Partituras", "partitura")]
    [InlineData("Cancionero escolar", "partitura")]
    [InlineData("Guía metodológica", "guia")]
    [InlineData("Cuaderno de trabajo", "guia")]
    [InlineData("DVD", "video")]
    [InlineData("CD", "audio")]
    [InlineData("2 CDs", "audio")]
    [InlineData("CD-ROM interactivo", "digital")]
    [InlineData("Curso virtual", "digital")]
    [InlineData("Libro", "libro")]
    [InlineData(null, "libro")]
    public void El_tipo_de_material_sale_del_texto_de_origen_igual_que_en_el_portal(string? origen, string esperado)
    {
        Assert.Equal(esperado, CatalogoEditorialExploracion.ClasificarMaterial(origen, []));
    }

    [Fact]
    public void La_tipologia_manda_sobre_el_texto_de_origen()
    {
        Assert.Equal("partitura", CatalogoEditorialExploracion.ClasificarMaterial("Libro", [("contenido", "musica-notada")]));
        Assert.Equal("mixto", CatalogoEditorialExploracion.ClasificarMaterial("Libro y CD", [("recurso", "text"), ("recurso", "sound")]));
        Assert.Equal("audio", CatalogoEditorialExploracion.ClasificarMaterial("Producción", [("recurso", "sound")]));
        Assert.Equal("video", CatalogoEditorialExploracion.ClasificarMaterial("Producción", [("recurso", "movingimage")]));
    }

    [Theory]
    [InlineData("banda", "bandas")]
    [InlineData("festival", "festivales")]
    [InlineData("Música", "musica")]
    [InlineData("escuela de música", "Escuelas de Musica")]
    [InlineData("base", "bases")]
    [InlineData("mujer", "mujeres")]
    public void Los_temas_con_la_misma_raiz_comparten_clave(string a, string b)
    {
        Assert.Equal(CatalogoEditorialExploracion.ClaveDeTema(a), CatalogoEditorialExploracion.ClaveDeTema(b));
    }

    [Fact]
    public void Dos_temas_distintos_no_se_confunden()
    {
        Assert.NotEqual(CatalogoEditorialExploracion.ClaveDeTema("iniciación"), CatalogoEditorialExploracion.ClaveDeTema("iniciación musical"));
        Assert.NotEqual(CatalogoEditorialExploracion.ClaveDeTema("banda"), CatalogoEditorialExploracion.ClaveDeTema("repertorio banda"));
    }

    // ── El API real ──

    [Fact]
    public async Task El_servidor_ordena_por_cada_columna_en_los_dos_sentidos_y_deja_lo_vacio_al_final()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        await PublicarAsync(factory, client, "ED-X-1", "Cartilla de banda", 2014, "Zulema Pérez", ["bandas", "pedagogía"]);
        await PublicarAsync(factory, client, "ED-X-2", "Acento", 2021, "Alberto Ruiz", ["banda"]);
        await PublicarAsync(factory, client, "ED-X-3", "Memorias", null, null, ["Pedagogía"]);

        var anonimo = factory.CreateClient();
        async Task<string[]> Codigos(string consulta) =>
            (await (await anonimo.GetAsync($"{Publico}?{consulta}")).Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("items").EnumerateArray().Select(i => i.GetProperty("codigo").GetString()!).ToArray();

        Assert.Equal(["ED-X-2", "ED-X-1", "ED-X-3"], await Codigos("orden=titulo&sentido=asc"));
        Assert.Equal(["ED-X-3", "ED-X-1", "ED-X-2"], await Codigos("orden=titulo&sentido=desc"));
        // Lo que no tiene año va al final tanto de más reciente a más antiguo como al revés.
        Assert.Equal(["ED-X-2", "ED-X-1", "ED-X-3"], await Codigos("orden=anio&sentido=desc"));
        Assert.Equal(["ED-X-1", "ED-X-2", "ED-X-3"], await Codigos("orden=anio&sentido=asc"));
        Assert.Equal(["ED-X-2", "ED-X-1", "ED-X-3"], await Codigos("orden=autoria&sentido=asc"));
        Assert.Equal(["ED-X-1", "ED-X-2", "ED-X-3"], await Codigos("orden=autoria&sentido=desc"));
        // Las direcciones antiguas (`az`, `za`) siguen funcionando.
        Assert.Equal(["ED-X-3", "ED-X-1", "ED-X-2"], await Codigos("orden=za"));
        // Un campo que no existe cae en el título y no rompe.
        Assert.Equal(["ED-X-2", "ED-X-1", "ED-X-3"], await Codigos("orden=inventado"));
    }

    [Fact]
    public async Task Los_filtros_de_autor_anio_y_tema_combinan_y_el_tema_agrupa_singular_y_plural()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        await PublicarAsync(factory, client, "ED-Y-1", "Uno", 2014, "Zulema Pérez", ["bandas"]);
        await PublicarAsync(factory, client, "ED-Y-2", "Dos", 2014, "Alberto Ruiz", ["banda"]);
        await PublicarAsync(factory, client, "ED-Y-3", "Tres", 2021, "Alberto Ruiz", ["coros"]);

        var anonimo = factory.CreateClient();
        async Task<JsonElement> Pagina(string consulta) =>
            await (await anonimo.GetAsync($"{Publico}?{consulta}")).Content.ReadFromJsonAsync<JsonElement>();

        // «banda» y «bandas» son el mismo tema, se pida como se pida.
        Assert.Equal(2, (await Pagina("palabraClave=banda")).GetProperty("total").GetInt32());
        Assert.Equal(2, (await Pagina("palabraClave=Bandas")).GetProperty("total").GetInt32());
        // El autor es el nombre exacto de una persona acreditada, sin importar tildes ni mayúsculas.
        Assert.Equal(2, (await Pagina("autor=alberto%20ruiz")).GetProperty("total").GetInt32());
        Assert.Equal(1, (await Pagina("autor=Alberto%20Ruiz&anio=2014")).GetProperty("total").GetInt32());
        Assert.Equal(0, (await Pagina("autor=Alberto&anio=2014")).GetProperty("total").GetInt32());
        // La autoría busca por trozos.
        Assert.Equal(1, (await Pagina("autoria=zulema")).GetProperty("total").GetInt32());

        var facetas = (await Pagina("tamano=1")).GetProperty("facetas");
        Assert.Equal(3, facetas.GetProperty("totalAcervo").GetInt32());
        var temas = facetas.GetProperty("temas").EnumerateArray().ToList();
        Assert.Equal(2, temas.Count);
        Assert.Equal(2, temas[0].GetProperty("total").GetInt32());
        Assert.Equal(["2021", "2014"], facetas.GetProperty("anios").EnumerateArray().Select(a => a.GetProperty("valor").GetString()!).ToArray());
    }

    [Fact]
    public async Task La_pagina_y_la_cantidad_por_pagina_las_decide_el_servidor_y_las_facetas_cuentan_todo_el_fondo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        for (var i = 1; i <= 5; i++) await PublicarAsync(factory, client, $"ED-Z-{i}", $"Obra {i}", 2000 + i, "Ana Restrepo", []);

        var anonimo = factory.CreateClient();
        var segunda = await (await anonimo.GetAsync($"{Publico}?tamano=2&pagina=2&orden=titulo")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(5, segunda.GetProperty("total").GetInt32());
        Assert.Equal(3, segunda.GetProperty("totalPaginas").GetInt32());
        Assert.Equal(2, segunda.GetProperty("items").GetArrayLength());
        Assert.Equal("ED-Z-3", segunda.GetProperty("items")[0].GetProperty("codigo").GetString());
        Assert.Equal(5, segunda.GetProperty("facetas").GetProperty("totalAcervo").GetInt32());
        // Cada ficha del listado trae la autoría con la que se cita y su tipo de material.
        Assert.Equal("Ana Restrepo", segunda.GetProperty("items")[0].GetProperty("autoriaVisible").GetString());
        Assert.Equal("libro", segunda.GetProperty("items")[0].GetProperty("tipoDeMaterial").GetString());
    }

    [Fact]
    public async Task Lo_que_no_se_puede_publicar_no_entra_en_el_indice_ni_en_las_facetas()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        await PublicarAsync(factory, client, "ED-V-1", "Visible", 2020, "Ana Restrepo", ["oculto"], publicar: false);
        await PublicarAsync(factory, client, "ED-V-2", "Publicada", 2021, "Ana Restrepo", ["visible"]);

        var pagina = await (await factory.CreateClient().GetAsync(Publico)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, pagina.GetProperty("total").GetInt32());
        Assert.Equal(1, pagina.GetProperty("facetas").GetProperty("totalAcervo").GetInt32());
        Assert.DoesNotContain(pagina.GetProperty("facetas").GetProperty("temas").EnumerateArray(),
            t => t.GetProperty("nombre").GetString() == "oculto");
    }

    private static async Task PublicarAsync(
        TestWebApplicationFactory factory, HttpClient client, string codigo, string titulo, int? anio, string? autor,
        string[] palabras, bool publicar = true)
    {
        var creada = await client.PostAsJsonAsync(Consola, new
        {
            codigo, titulo, anioInicio = anio, anioFin = anio, palabrasClave = palabras,
            creditos = autor is null ? [] : new[] { new { nombre = autor, tipo = "persona", rolCodigo = "aut", rolEtiqueta = "Autor", principal = true, orden = 0 } },
        });
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);
        var id = (await creada.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt64();
        if (!publicar) return;

        await client.PostAsJsonAsync($"{Consola}/{id}/catalogacion", new { estado = "validada" });
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fuente = new FuenteEditorialRow { Nombre = "Inventario", Referencia = "Folio 1", FechaConsulta = DateTime.UtcNow, VerificadaPor = "Equipo editorial", FechaCreacion = DateTime.UtcNow };
            db.FuentesEditoriales.Add(fuente);
            await db.SaveChangesAsync();
            db.PublicacionesEditorialesFuentes.Add(new PublicacionEditorialFuenteRow { PublicacionEditorialId = id, FuenteEditorialId = fuente.Id });
            var ficha = await db.PublicacionesEditoriales.FindAsync(id);
            ficha!.DerechosEstado = "verificado";
            ficha.DerechosPermitePublicarFicha = true;
            ficha.DerechosVerificadoPor = "Equipo editorial";
            ficha.DerechosFechaVerificacion = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        var publicada = await client.PostAsJsonAsync($"{Consola}/{id}/publicacion", new { estado = "publicado" });
        Assert.Equal(HttpStatusCode.OK, publicada.StatusCode);
    }
}
