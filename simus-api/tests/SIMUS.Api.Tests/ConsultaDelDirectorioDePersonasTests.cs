using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>El directorio de agentes y actores: filtros, conteos, orden y paginación (pieza pura) y el endpoint público.</summary>
public sealed class ConsultaDelDirectorioDePersonasTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;
    public ConsultaDelDirectorioDePersonasTests(TestWebApplicationFactory factory) => _factory = factory;

    private static PersonaDelDirectorioDto P(string nombre, string[] roles, string[] servicios, string[] instrumentos,
        string? municipio = null, string? departamento = null, string[]? territorios = null, string[]? practicas = null, string? bio = null) =>
        new(Guid.NewGuid(), nombre, null, bio, municipio, departamento, roles, servicios, instrumentos, practicas ?? [], territorios ?? [], roles.Length + servicios.Length > 0);

    private static TaxonomiaDeNombres Taxonomia() => new(
        new Dictionary<string, string> { ["creador"] = "Creación", ["luthier"] = "Luthier", ["compositor"] = "Compositor", ["docente"] = "Docente" },
        new Dictionary<string, string> { ["clases"] = "Clases", ["luteria"] = "Lutería" },
        new Dictionary<string, string> { ["guitarra"] = "Guitarra", ["tiple"] = "Tiple" },
        new Dictionary<string, string> { ["luthier"] = "creador", ["compositor"] = "creador", ["docente"] = "docente", ["creador"] = "creador" },
        ["creador", "luthier", "compositor", "docente"]);

    private static List<PersonaDelDirectorioDto> Muestra() =>
    [
        P("Ángela Mora", ["luthier"], ["luteria"], ["tiple"], "Bogotá", "Bogotá D.C.", ["Cundinamarca"], ["Música andina"], "Construye tiples"),
        P("Beto Ríos", ["docente"], ["clases"], ["guitarra"], "Cali", "Valle del Cauca"),
        P("Carla Pérez", ["compositor", "docente"], ["clases"], ["guitarra", "tiple"], "Cali", "Valle del Cauca"),
        P("Diego Sol", [], [], [], "Pasto", "Nariño"),
    ];

    [Fact]
    public void Sin_filtros_trae_todas_ordenadas_y_el_total_publicado()
    {
        var r = ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(), Taxonomia());
        Assert.Equal(4, r.Total);
        Assert.Equal(4, r.TotalPublicadas);
        Assert.Equal(["Ángela Mora", "Beto Ríos", "Carla Pérez", "Diego Sol"], r.Items.Select(i => i.NombreVisible));
    }

    [Fact]
    public void Dentro_de_una_dimension_es_cualquiera_y_entre_dimensiones_todas()
    {
        var uno = ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(Instrumentos: ["tiple", "guitarra"]), Taxonomia());
        Assert.Equal(3, uno.Total);
        var dos = ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(Instrumentos: ["tiple"], Servicios: ["clases"]), Taxonomia());
        Assert.Equal(["Carla Pérez"], dos.Items.Select(i => i.NombreVisible));
    }

    [Fact]
    public void La_categoria_se_deduce_de_los_roles()
    {
        var r = ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(Categorias: ["creador"]), Taxonomia());
        Assert.Equal(["Ángela Mora", "Carla Pérez"], r.Items.Select(i => i.NombreVisible));
    }

    [Fact]
    public void La_busqueda_ignora_tildes_y_mayusculas_y_mira_nombres_de_la_taxonomia()
    {
        Assert.Single(ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(Texto: "angela"), Taxonomia()).Items);
        Assert.Single(ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(Texto: "LUTERIA"), Taxonomia()).Items);
        Assert.Equal(2, ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(Texto: "cali"), Taxonomia()).Total);
    }

    [Fact]
    public void Los_conteos_ignoran_la_propia_seleccion_y_respetan_las_demas()
    {
        var r = ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(Servicios: ["luteria"], Instrumentos: ["tiple"]), Taxonomia());
        // El servicio se cuenta sin su propia selección (instrumento = tiple): lutería 1 y clases 1.
        Assert.Equal(1, r.Facetas.Servicios.Single(f => f.Valor == "luteria").Total);
        Assert.Equal(1, r.Facetas.Servicios.Single(f => f.Valor == "clases").Total);
        // El instrumento se cuenta con el servicio puesto: solo Ángela, que toca tiple.
        Assert.Equal(1, r.Facetas.Instrumentos.Single(f => f.Valor == "tiple").Total);
        Assert.DoesNotContain(r.Facetas.Instrumentos, f => f.Valor == "guitarra");
    }

    [Fact]
    public void Los_municipios_solo_se_ofrecen_dentro_de_un_departamento()
    {
        Assert.Empty(ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(), Taxonomia()).Facetas.Municipios);
        var r = ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(Departamento: "valle del cauca"), Taxonomia());
        Assert.Equal(2, r.Total);
        Assert.Equal(["Cali"], r.Facetas.Municipios.Select(m => m.Valor));
    }

    [Fact]
    public void Pagina_con_tope_y_acota_la_pagina_pedida()
    {
        var muchas = Enumerable.Range(1, 130).Select(i => P($"Persona {i:000}", ["docente"], [], [])).ToList();
        var r = ConsultaDelDirectorioDePersonas.Ejecutar(muchas, new(Pagina: 99, PorPagina: 500), Taxonomia());
        Assert.Equal(60, r.PorPagina);
        Assert.Equal(3, r.TotalPaginas);
        Assert.Equal(3, r.Pagina);
        Assert.Equal(10, r.Items.Count);
        Assert.Equal(130, r.Total);
    }

    [Fact]
    public void Ordena_por_territorio()
    {
        var r = ConsultaDelDirectorioDePersonas.Ejecutar(Muestra(), new(Orden: ConsultaDelDirectorioDePersonas.OrdenPorTerritorio), Taxonomia());
        Assert.Equal("Ángela Mora", r.Items[0].NombreVisible);
        Assert.Equal("Diego Sol", r.Items[^1].NombreVisible);
    }

    [Fact]
    public async Task El_endpoint_publico_responde_paginado_sin_sesion_y_sin_datos_privados()
    {
        var respuesta = await _factory.CreateClient().GetAsync("/api/v1/publico/directorio-de-personas?porPagina=5&orden=territorio&rol=luthier,docente");
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var texto = await respuesta.Content.ReadAsStringAsync();
        var pagina = JsonSerializer.Deserialize<PaginaDelDirectorioDePersonasDto>(texto, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(pagina);
        Assert.Equal(5, pagina!.PorPagina);
        Assert.True(pagina.Pagina >= 1);
        Assert.NotNull(pagina.Facetas);
        // El contrato público no tiene ningún campo de contacto, documento ni residencia.
        foreach (var privado in new[] { "correo", "email", "telefono", "phone", "documento", "residencia", "nombreCivil" })
            Assert.DoesNotContain(privado, texto, StringComparison.OrdinalIgnoreCase);
    }
}
