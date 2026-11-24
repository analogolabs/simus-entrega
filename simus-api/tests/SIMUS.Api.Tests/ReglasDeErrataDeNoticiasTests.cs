using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Qué es una errata y qué es un cambio de fondo en una noticia publicada (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 97). Es la misma regla del Catálogo y de los eventos, ahora también para
/// Noticias y para los eventos de la consola de Agenda.
/// </summary>
public sealed class ReglasDeErrataDeNoticiasTests
{
    private static NoticiaRow Publicada() => new()
    {
        Titulo = "Se abre la convocatoria de bandas",
        Resumen = "La convocatoria recibe propuestas de bandas de todo el país hasta fin de mes.",
        Cuerpo = "El PNMC abre la convocatoria para bandas de música de todos los municipios del país.",
        FechaPublicacion = new DateOnly(2026, 11, 1),
        CategoriaId = 4,
    };

    private static GuardarNoticiaSolicitud Igual(NoticiaRow f) => new()
    {
        Titulo = f.Titulo,
        Resumen = f.Resumen,
        Cuerpo = f.Cuerpo,
        FechaPublicacion = f.FechaPublicacion,
        CategoriaId = f.CategoriaId,
    };

    [Fact]
    public void Cambiar_o_retirar_la_imagen_principal_es_errata()
    {
        var fila = Publicada();
        var nueva = Igual(fila);
        nueva.ImagenArchivoId = 9;
        Assert.Empty(ReglasDeErrataDeNoticias.CambiosDeFondo(fila, nueva));
        Assert.Equal(9, ReglasDeErrataDeNoticias.ImagenResultante(5, nueva));

        var retira = Igual(fila);
        retira.RetirarImagen = true;
        Assert.Empty(ReglasDeErrataDeNoticias.CambiosDeFondo(fila, retira));
        Assert.Null(ReglasDeErrataDeNoticias.ImagenResultante(5, retira));
        Assert.Equal(5, ReglasDeErrataDeNoticias.ImagenResultante(5, Igual(fila)));
    }

    [Fact]
    public void Sin_cambios_es_errata()
    {
        var fila = Publicada();
        Assert.Empty(ReglasDeErrataDeNoticias.CambiosDeFondo(fila, Igual(fila)));
    }

    [Fact]
    public void Ortografia_tildes_y_puntuacion_son_errata()
    {
        var fila = Publicada();
        var nueva = Igual(fila);
        nueva.Titulo = "Se abre la convocatoría de bandas.";
        nueva.Cuerpo = "El PNMC abre la convocatoria para bandas de música, de todos los municipios del país";
        Assert.Empty(ReglasDeErrataDeNoticias.CambiosDeFondo(fila, nueva));
    }

    [Fact]
    public void Un_titular_reescrito_es_de_fondo()
    {
        var fila = Publicada();
        var nueva = Igual(fila);
        nueva.Titulo = "Cierra la convocatoria de coros";
        Assert.Equal(["el titular"], ReglasDeErrataDeNoticias.CambiosDeFondo(fila, nueva));
    }

    [Fact]
    public void La_fecha_y_la_categoria_son_de_fondo()
    {
        var fila = Publicada();
        var nueva = Igual(fila);
        nueva.FechaPublicacion = new DateOnly(2026, 12, 1);
        nueva.CategoriaId = 9;
        Assert.Equal(["la fecha de publicación", "la categoría"], ReglasDeErrataDeNoticias.CambiosDeFondo(fila, nueva));
    }

    [Fact]
    public void Un_cuerpo_reescrito_es_de_fondo()
    {
        var fila = Publicada();
        var nueva = Igual(fila);
        nueva.Cuerpo = "Texto completamente nuevo que ya no habla de lo mismo.";
        Assert.Contains("el cuerpo", ReglasDeErrataDeNoticias.CambiosDeFondo(fila, nueva));
    }

    private static EventoAgendaRow Evento() => new()
    {
        Titulo = "Encuentro de bandas del Pacífico",
        Descripcion = "Tres días de música con bandas de marcha de la región.",
        FechaInicio = new DateOnly(2026, 12, 5),
        Modalidad = "presencial",
        Lugar = "Teatro Municipal",
    };

    private static GuardarEventoAgendaSolicitud IgualEvento(EventoAgendaRow e) => new()
    {
        Titulo = e.Titulo,
        Descripcion = e.Descripcion,
        FechaInicio = e.FechaInicio,
        Modalidad = e.Modalidad,
        Lugar = e.Lugar,
    };

    [Fact]
    public void Un_evento_de_la_consola_sin_cambios_o_con_una_tilde_es_errata()
    {
        var fila = Evento();
        var nueva = IgualEvento(fila);
        Assert.Empty(ReglasDeErrataDeEventos.CambiosDeFondo(fila, nueva));

        nueva.Lugar = "teatro  municipal";
        nueva.Descripcion = "Tres días de música con bandas de marcha de la región";
        Assert.Empty(ReglasDeErrataDeEventos.CambiosDeFondo(fila, nueva));
    }

    [Fact]
    public void Un_evento_de_la_consola_con_otra_fecha_u_otro_lugar_es_de_fondo()
    {
        var fila = Evento();
        var nueva = IgualEvento(fila);
        nueva.FechaInicio = new DateOnly(2026, 12, 12);
        nueva.Lugar = "Parque de la Música";
        Assert.Equal(["la fecha", "el lugar"], ReglasDeErrataDeEventos.CambiosDeFondo(fila, nueva));
    }
}
