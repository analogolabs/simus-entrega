using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Qué es una errata y qué es un cambio de fondo en una ficha publicada del Catálogo (LIS-04, lote
/// G1; docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 36).
/// </summary>
/// <remarks>
/// <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que corregir una coma saque del portal una ficha ya aprobada
/// —lo que pasaba cuando nadie sabía que existía la casilla «es una errata»— y, al revés, que cambiar
/// el título, el año, los accesos o las fuentes se cuele como errata y deje publicado algo que
/// nadie revisó.
/// </remarks>
public sealed class ReglasDeErrataDelCatalogoTests
{
    private static PublicacionEditorialRow Publicada() => new()
    {
        Titulo = "Cantos de las Sabanas del Casanare",
        Subtitulo = "Memoria sonora del joropo llanero",
        Resumen = "Recopilación de cantos tradicionales de la Orinoquía colombiana, con transcripciones y contexto.",
        FechaEdtf = "1998",
        AnioInicio = 1998,
        TipoPublicacion = "libro",
        CategoriaId = 3,
        SerieOColeccion = "Colección Orinoquía",
        DesignacionVolumen = "Vol. 2",
        Ambito = "regional",
    };

    private static GuardarPublicacionEditorialSolicitud Igual(PublicacionEditorialRow f) => new()
    {
        Titulo = f.Titulo,
        Subtitulo = f.Subtitulo,
        Resumen = f.Resumen,
        FechaEdtf = f.FechaEdtf,
        AnioInicio = f.AnioInicio,
        TipoPublicacion = f.TipoPublicacion,
        CategoriaId = f.CategoriaId,
        SerieOColeccion = f.SerieOColeccion,
        DesignacionVolumen = f.DesignacionVolumen,
        Ambito = f.Ambito,
    };

    private static IReadOnlyList<string> Fondo(GuardarPublicacionEditorialSolicitud nueva, IReadOnlyCollection<string>? accesos = null, IReadOnlyCollection<long>? fuentes = null) =>
        ReglasDeErrataDelCatalogo.CambiosDeFondo(Publicada(), nueva, accesos ?? [], fuentes ?? []);

    [Fact]
    public void Sin_cambios_es_errata()
    {
        Assert.Empty(Fondo(Igual(Publicada())));
    }

    [Fact]
    public void Una_tilde_una_coma_o_una_mayuscula_en_el_titulo_es_errata()
    {
        var nueva = Igual(Publicada());
        nueva.Titulo = "Cantos de las sabanas del Casanare.";
        Assert.Empty(Fondo(nueva));

        nueva.Titulo = "Cantos de las Sábanas del Casanare";
        Assert.Empty(Fondo(nueva));
    }

    [Fact]
    public void Un_titulo_reescrito_es_de_fondo()
    {
        var nueva = Igual(Publicada());
        nueva.Titulo = "Músicas del Llano";
        Assert.Contains("el título", Fondo(nueva));
    }

    [Fact]
    public void Un_resumen_que_crece_un_poco_es_errata_y_uno_reescrito_es_de_fondo()
    {
        var nueva = Igual(Publicada());
        nueva.Resumen = Publicada().Resumen + " Incluye un glosario.";
        Assert.Empty(Fondo(nueva));

        nueva.Resumen = "Estudio sobre la industria discográfica en Bogotá durante los años ochenta.";
        Assert.Contains("el resumen", Fondo(nueva));
    }

    [Fact]
    public void El_ano_la_fecha_el_tipo_la_categoria_la_serie_el_volumen_y_el_ambito_son_de_fondo()
    {
        var nueva = Igual(Publicada());
        nueva.AnioInicio = 2001;
        Assert.Contains("la fecha", Fondo(nueva));

        nueva = Igual(Publicada());
        nueva.TipoPublicacion = "articulo";
        Assert.Contains("el tipo de publicación", Fondo(nueva));

        nueva = Igual(Publicada());
        nueva.CategoriaId = 9;
        Assert.Contains("la categoría", Fondo(nueva));

        nueva = Igual(Publicada());
        nueva.SerieOColeccion = "Otra colección";
        Assert.Contains("la serie o colección", Fondo(nueva));

        nueva = Igual(Publicada());
        nueva.DesignacionVolumen = "Vol. 3";
        Assert.Contains("el volumen", Fondo(nueva));

        nueva = Igual(Publicada());
        nueva.Ambito = "nacional";
        Assert.Contains("el ámbito", Fondo(nueva));
    }

    [Fact]
    public void Los_accesos_solo_cuentan_si_el_cambio_los_trae_y_si_cambian()
    {
        var firmaDelAcceso = ReglasDeErrataDelCatalogo.FirmaDeAcceso("enlace", "https://acervo.example.org/cantos", null, null);

        // Sin lista de accesos en el cambio: no se tocan.
        Assert.Empty(Fondo(Igual(Publicada()), accesos: [firmaDelAcceso]));

        // La misma lista: errata.
        var nueva = Igual(Publicada());
        nueva.Accesos = [new AccesoEditorialSolicitud { Tipo = "enlace", Url = "https://acervo.example.org/cantos", Etiqueta = "Texto corregido" }];
        Assert.Empty(Fondo(nueva, accesos: [firmaDelAcceso]));

        // Otro enlace, o uno quitado: de fondo.
        nueva.Accesos = [new AccesoEditorialSolicitud { Tipo = "enlace", Url = "https://otro.example.org/cantos" }];
        Assert.Contains("los accesos", Fondo(nueva, accesos: [firmaDelAcceso]));

        nueva.Accesos = [];
        Assert.Contains("los accesos", Fondo(nueva, accesos: [firmaDelAcceso]));
    }

    [Fact]
    public void Las_fuentes_solo_cuentan_si_el_cambio_las_trae_y_si_cambian()
    {
        Assert.Empty(Fondo(Igual(Publicada()), fuentes: [1, 2]));

        var nueva = Igual(Publicada());
        nueva.FuenteIds = [2, 1];
        Assert.Empty(Fondo(nueva, fuentes: [1, 2]));

        nueva.FuenteIds = [1, 3];
        Assert.Contains("las fuentes", Fondo(nueva, fuentes: [1, 2]));
    }

    [Fact]
    public void Se_dicen_todos_los_cambios_de_fondo_a_la_vez()
    {
        var nueva = Igual(Publicada());
        nueva.Titulo = "Músicas del Llano";
        nueva.AnioInicio = 2001;
        nueva.TipoPublicacion = "articulo";

        var fondo = Fondo(nueva);

        Assert.Contains("el título", fondo);
        Assert.Contains("la fecha", fondo);
        Assert.Contains("el tipo de publicación", fondo);
    }
}
