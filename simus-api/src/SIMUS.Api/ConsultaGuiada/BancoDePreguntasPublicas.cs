using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.ConsultaGuiada;

/// <summary>Una pregunta del banco público: su identificador, cómo se rotula y qué responde.</summary>
public sealed record PreguntaPublica(string Id, string Rotulo, string Descripcion, IReadOnlyList<ParametroDePreguntaDto>? ParametrosDeLaPregunta = null)
{
    /// <summary>Los parámetros tipados que admite; vacío si la pregunta es fija.</summary>
    public IReadOnlyList<ParametroDePreguntaDto> Parametros => ParametrosDeLaPregunta ?? [];

    /// <summary>Dónde se responde: siempre «publico» en este banco. Lo fija el endpoint del portal, no el texto del usuario.</summary>
    public string Ambito => AmbitoDelCatalogo.Publico;

    /// <summary>3 a 6 formulaciones de ejemplo (sinónimos) para precalcular vectores; el texto canónico es el rótulo.</summary>
    public IReadOnlyList<string> Ejemplos => FormulacionesDeEjemplo.De(Id);
}

/// <summary>
/// El banco de preguntas MARCADO PÚBLICO de la Consulta Guiada del portal (decisión 158).
/// </summary>
/// <remarks>
/// <para>
/// Todos los identificadores empiezan por <c>publica_</c>: no chocan con los del catálogo de la consola.
/// </para>
/// <para>
/// <b>ES UN BANCO CERRADO, Y NO UN FILTRO SOBRE OTRO.</b> Cada pregunta tiene su consulta escrita aquí; añadir una exige
/// tocar este fichero y su prueba. No se deriva del catálogo de la consola (que sabe contar estados de revisión,
/// bandejas y registros de una organización) justamente para que una pregunta nueva de allá no aparezca aquí sola.
/// </para>
/// <para>
/// <b>TODAS LEEN LO QUE EL PORTAL YA PUBLICA</b>: Festivales y Mercados publicados, Talleres, Espacios y Redes publicados
/// (solo conteos), la agenda y las noticias publicadas, y el catálogo de prácticas musicales. Las filas con nombre propio
/// (eventos y noticias) llevan los mismos campos que ya salen en el listado público: fecha, título, lugar.
/// </para>
/// </remarks>
public static class BancoDePreguntasPublicas
{
    private const int FilasMaximas = 15;

    private static readonly IReadOnlyList<PreguntaPublica> PreguntasFijas =
    [
        new("publica_procesos_por_tipo", "¿Cuántos procesos hay publicados, por tipo?",
            "Festivales, mercados, talleres de lutería, espacios y redes que el portal muestra hoy."),
        new("publica_festivales_por_departamento", "¿En qué departamentos hay festivales?",
            "Festivales publicados por departamento de su sede principal."),
        new("publica_festivales_por_municipio", "¿En qué municipios hay más festivales?",
            "Los municipios con más festivales publicados."),
        new("publica_festivales_por_practica", "¿Qué prácticas musicales tienen los festivales?",
            "Festivales publicados por práctica musical."),
        new("publica_festivales_por_territorio_sonoro", "¿Qué territorios sonoros recogen los festivales?",
            "Festivales publicados por territorio sonoro."),
        new("publica_festivales_por_periodicidad", "¿Cada cuánto se realizan los festivales?",
            "Festivales publicados por periodicidad."),
        new("publica_mercados_por_departamento", "¿En qué departamentos hay mercados musicales?",
            "Mercados musicales publicados por departamento de su sede principal."),
        new("publica_agenda_proxima", "¿Qué hay en la agenda próxima?",
            "Los próximos eventos publicados en la agenda, con fecha y lugar."),
        new("publica_agenda_por_departamento", "¿En qué departamentos hay eventos próximos?",
            "Eventos próximos de la agenda por departamento."),
        new("publica_noticias_recientes", "¿Cuáles son las noticias más recientes?",
            "Las últimas noticias publicadas, con su fecha."),
        new("publica_practicas_musicales", "¿Qué prácticas musicales reconoce el portal?",
            "El catálogo de prácticas musicales y cuántos festivales publicados tiene cada una."),
    ];

    public static readonly IReadOnlyList<PreguntaPublica> Preguntas = [.. PreguntasFijas, .. PlantillasDeConsultaPublica.Preguntas];

    public static PreguntaPublica? Buscar(string id) => Preguntas.FirstOrDefault(item => item.Id == id);

    public sealed record Resultado(string Resumen, TablaDeConsultaDto Tabla);

    /// <summary>Los parámetros de una pregunta no pasaron la validación contra los catálogos: el endpoint responde 400.</summary>
    public sealed class ParametrosInvalidosException(Dictionary<string, string[]> errores) : Exception("Parámetros inválidos.")
    {
        public Dictionary<string, string[]> Errores { get; } = errores;
    }

    /// <summary>Responde una pregunta FIJA del banco (las parametrizadas las resuelve <see cref="PlantillasDeConsultaPublica"/>).</summary>
    public static async Task<Resultado> ResponderAsync(
        string id, SimusDbContext db, CacheDivipola divipola, DateTime ahora, CancellationToken ct,
        IReadOnlyDictionary<string, string>? parametros = null)
    {
        var hoy = DateOnly.FromDateTime(ahora);
        if (!PlantillasDeConsultaPublica.Contiene(id) && parametros?.Any(par => !string.IsNullOrWhiteSpace(par.Value)) == true)
            throw new ParametrosInvalidosException(new() { ["parametros"] = ["Esta pregunta no admite parámetros."] });
        if (PlantillasDeConsultaPublica.Contiene(id))
        {
            var pregunta = Buscar(id)!;
            var (valores, errores) = await PlantillasDeConsultaPublica.ValidarAsync(pregunta, parametros, db, divipola, ct);
            if (valores is null) throw new ParametrosInvalidosException(errores);
            return await PlantillasDeConsultaPublica.ResponderAsync(pregunta, valores, db, divipola, hoy, ct);
        }

        return id switch
        {
            "publica_procesos_por_tipo" => await ProcesosPorTipoAsync(db, ct),
            "publica_festivales_por_departamento" => await FestivalesPorAsync(db, divipola, ct, Dimension.Departamento),
            "publica_festivales_por_municipio" => await FestivalesPorAsync(db, divipola, ct, Dimension.Municipio),
            "publica_festivales_por_practica" => await FestivalesPorAsync(db, divipola, ct, Dimension.Practica),
            "publica_festivales_por_territorio_sonoro" => await FestivalesPorAsync(db, divipola, ct, Dimension.TerritorioSonoro),
            "publica_festivales_por_periodicidad" => await FestivalesPorAsync(db, divipola, ct, Dimension.Periodicidad),
            "publica_mercados_por_departamento" => await MercadosPorDepartamentoAsync(db, divipola, ct),
            "publica_agenda_proxima" => await AgendaProximaAsync(db, divipola, hoy, ct),
            "publica_agenda_por_departamento" => await AgendaPorDepartamentoAsync(db, divipola, hoy, ct),
            "publica_noticias_recientes" => await NoticiasRecientesAsync(db, hoy, ct),
            "publica_practicas_musicales" => await PracticasAsync(db, ct),
            _ => throw new InvalidOperationException("La pregunta no pertenece al banco público."),
        };
    }

    private enum Dimension { Departamento, Municipio, Practica, TerritorioSonoro, Periodicidad }

    internal static string N(int valor) => valor.ToString(CultureInfo.InvariantCulture);

    private static string Fecha(DateOnly fecha) => fecha.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    private static Resultado Armar(
        string resumen, string titulo, string fuente, string alcance, string[] columnas, IEnumerable<string[]> filas,
        IEnumerable<string?>? destinos = null, int columnaDeEnlace = 0) =>
        new(resumen, new TablaDeConsultaDto(titulo, fuente, alcance, columnas, filas.Select(fila => (IReadOnlyList<string>)fila).ToList(),
            destinos?.ToList(), columnaDeEnlace, ["Solo registros publicados", alcance]));

    /// <summary>Una consulta de la cadena de consulta, codificada: «/ecosistema/festivales?departamento=Valle%20del%20Cauca».</summary>
    private static string Ruta(string ruta, string parametro, string valor) =>
        $"{ruta}?{parametro}={Uri.EscapeDataString(valor)}";

    private static async Task<Resultado> ProcesosPorTipoAsync(SimusDbContext db, CancellationToken ct)
    {
        var festivales = await db.FestivalRecords.AsNoTracking()
            .CountAsync(item => item.StatusCode == "publicado" || item.StatusCode == "Publicado", ct);
        var mercados = await db.Mercados.AsNoTracking().CountAsync(item => item.Activo && item.EstadoRegistro == "publicado", ct);
        var filas = new List<string[]> { new[] { "Festivales", N(festivales) }, new[] { "Mercados musicales", N(mercados) } };
        var destinos = new List<string?> { "/ecosistema/festivales", "/ecosistema/mercados-musicales" };
        foreach (var tipo in ProcesosConsultables.Tipos)
        {
            var cuantos = await ProcesosConsultables.Filas(db, tipo.Modulo).CountAsync(item => item.Estado == "publicado", ct);
            filas.Add([char.ToUpperInvariant(tipo.Plural[0]) + tipo.Plural[1..], N(cuantos)]);
            destinos.Add(tipo.Modulo == Modulos.Talleres ? "/ecosistema/luteria"
                : tipo.Modulo == Modulos.Espacios ? "/ecosistema/espacios"
                : tipo.Modulo == Modulos.Redes ? "/ecosistema/redes" : null);
        }

        var total = filas.Sum(fila => int.Parse(fila[1], CultureInfo.InvariantCulture));
        return Armar(
            $"El portal muestra hoy {TextoEnEspanol.Plural(total, "proceso publicado", "procesos publicados")}.",
            "Procesos publicados por tipo", "Procesos publicados del ecosistema", "Todo el país · solo lo publicado",
            ["Tipo de proceso", "Publicados"], filas, destinos);
    }

    private static async Task<Resultado> FestivalesPorAsync(
        SimusDbContext db, CacheDivipola divipola, CancellationToken ct, Dimension dimension)
    {
        var festivales = await LecturaFestivalesPublicados.ConsultarAsync(db, ct);
        var (departamentos, municipios) = await divipola.ObtenerAsync(db, ct);

        IEnumerable<string?> valores = dimension switch
        {
            Dimension.Departamento => festivales.Select(item => Nombre(departamentos, item.Sede.Departamento)),
            Dimension.Municipio => festivales.Select(item => Nombre(municipios, item.Sede.Municipio)),
            Dimension.Practica => festivales.SelectMany(item => item.PracticasMusicales.Select(practica => practica.Nombre)),
            Dimension.TerritorioSonoro => festivales.SelectMany(item => item.TerritoriosSonoros.Select(territorio => territorio.Nombre)),
            _ => festivales.Select(item => item.Periodicidad),
        };
        var grupos = valores.Where(valor => !string.IsNullOrWhiteSpace(valor))
            .GroupBy(valor => valor!.Trim())
            .Select(grupo => (Nombre: grupo.Key, Total: grupo.Count()))
            .OrderByDescending(grupo => grupo.Total).ThenBy(grupo => grupo.Nombre, StringComparer.Ordinal)
            .ToList();
        var mostrados = dimension == Dimension.Municipio ? grupos.Take(FilasMaximas).ToList() : grupos;

        var (etiqueta, columna) = dimension switch
        {
            Dimension.Departamento => ("departamento", "Departamento"),
            Dimension.Municipio => ("municipio", "Municipio"),
            Dimension.Practica => ("práctica musical", "Práctica musical"),
            Dimension.TerritorioSonoro => ("territorio sonoro", "Territorio sonoro"),
            _ => ("periodicidad", "Periodicidad"),
        };
        var resumen = grupos.Count == 0
            ? $"Todavía no hay festivales publicados con {etiqueta} declarado."
            : $"Hay {TextoEnEspanol.Plural(festivales.Count, "festival publicado", "festivales publicados")}; por {etiqueta}, el que más aparece es «{grupos[0].Nombre}» ({N(grupos[0].Total)}).";
        var alcance = dimension == Dimension.Municipio
            ? $"Festivales publicados · los {N(FilasMaximas)} municipios con más festivales"
            : "Festivales publicados · todo el país";
        return Armar(resumen, $"Festivales publicados por {etiqueta}", "Festivales publicados (la misma lectura del mapa y la analítica)",
            alcance, [columna, "Festivales"], mostrados.Select(grupo => new[] { grupo.Nombre, N(grupo.Total) }),
            mostrados.Select(grupo => (string?)(dimension switch
            {
                Dimension.Departamento => Ruta("/ecosistema/festivales", "departamento", grupo.Nombre),
                Dimension.Municipio => Ruta("/ecosistema/festivales", "municipio", grupo.Nombre),
                Dimension.Practica => Ruta("/ecosistema/festivales", "practica", grupo.Nombre),
                Dimension.TerritorioSonoro => Ruta("/ecosistema/festivales", "territorio", grupo.Nombre),
                _ => "/ecosistema/festivales",
            })));
    }

    private static async Task<Resultado> MercadosPorDepartamentoAsync(SimusDbContext db, CacheDivipola divipola, CancellationToken ct)
    {
        var (departamentos, _) = await divipola.ObtenerAsync(db, ct);
        var mercados = await db.Mercados.AsNoTracking()
            .Where(item => item.Activo && item.EstadoRegistro == "publicado")
            .Select(item => new { item.SedeCodigoDepartamento, item.SedeCodigoMunicipio, item.NivelCobertura, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct);
        var grupos = mercados
            .Select(item => Nombre(departamentos, SedePrincipal.Resolver(
                item.SedeCodigoDepartamento, item.SedeCodigoMunicipio, item.NivelCobertura, item.CodigoDepartamento, item.CodigoMunicipio).Departamento))
            .Where(valor => !string.IsNullOrWhiteSpace(valor))
            .GroupBy(valor => valor!)
            .Select(grupo => (Nombre: grupo.Key, Total: grupo.Count()))
            .OrderByDescending(grupo => grupo.Total).ThenBy(grupo => grupo.Nombre, StringComparer.Ordinal).ToList();
        return Armar(
            $"Hay {TextoEnEspanol.Plural(mercados.Count, "mercado musical publicado", "mercados musicales publicados")}.",
            "Mercados musicales publicados por departamento", "Mercados musicales publicados", "Todo el país · solo lo publicado",
            ["Departamento", "Mercados"], grupos.Select(grupo => new[] { grupo.Nombre, N(grupo.Total) }),
            grupos.Select(_ => (string?)"/ecosistema/mercados-musicales"));
    }

    private static IQueryable<EventoAgendaRow> EventosProximos(SimusDbContext db, DateOnly hoy) =>
        db.EventosAgenda.AsNoTracking()
            .Where(item => item.Estado == "publicado" && !item.Cancelado && (item.FechaFin ?? item.FechaInicio) >= hoy);

    private static async Task<Resultado> AgendaProximaAsync(SimusDbContext db, CacheDivipola divipola, DateOnly hoy, CancellationToken ct)
    {
        var (departamentos, municipios) = await divipola.ObtenerAsync(db, ct);
        var total = await EventosProximos(db, hoy).CountAsync(ct);
        var filas = await EventosProximos(db, hoy).OrderBy(item => item.FechaInicio).ThenBy(item => item.Id).Take(10)
            .Select(item => new { item.FechaInicio, item.Titulo, item.Slug, item.Modalidad, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct);
        return Armar(
            total == 0
                ? "No hay eventos próximos publicados en la agenda."
                : $"Hay {TextoEnEspanol.Plural(total, "evento próximo publicado", "eventos próximos publicados")} en la agenda; estos son los {N(filas.Count)} más cercanos.",
            "Próximos eventos de la agenda", "Agenda pública (eventos publicados)", $"Eventos publicados desde hoy · los {N(filas.Count)} más cercanos",
            ["Fecha", "Evento", "Lugar"],
            filas.Select(item => new[] { Fecha(item.FechaInicio), item.Titulo, Lugar(item.Modalidad, item.CodigoDepartamento, item.CodigoMunicipio, departamentos, municipios) }),
            filas.Select(item => (string?)(string.IsNullOrWhiteSpace(item.Slug) ? "/agenda" : $"/agenda/{Uri.EscapeDataString(item.Slug)}")), columnaDeEnlace: 1);
    }

    private static async Task<Resultado> AgendaPorDepartamentoAsync(SimusDbContext db, CacheDivipola divipola, DateOnly hoy, CancellationToken ct)
    {
        var (departamentos, _) = await divipola.ObtenerAsync(db, ct);
        var eventos = await EventosProximos(db, hoy).Select(item => item.CodigoDepartamento).ToListAsync(ct);
        var grupos = eventos.Select(codigo => Nombre(departamentos, codigo)).Where(valor => !string.IsNullOrWhiteSpace(valor))
            .GroupBy(valor => valor!).Select(grupo => (Nombre: grupo.Key, Total: grupo.Count()))
            .OrderByDescending(grupo => grupo.Total).ThenBy(grupo => grupo.Nombre, StringComparer.Ordinal).ToList();
        var sinLugar = eventos.Count - grupos.Sum(grupo => grupo.Total);
        return Armar(
            $"Hay {TextoEnEspanol.Plural(eventos.Count, "evento próximo publicado", "eventos próximos publicados")}"
                + (sinLugar > 0 ? $"; {TextoEnEspanol.Plural(sinLugar, "no tiene", "no tienen")} departamento (virtuales o nacionales)." : "."),
            "Eventos próximos por departamento", "Agenda pública (eventos publicados)", "Eventos publicados desde hoy · todo el país",
            ["Departamento", "Eventos"], grupos.Select(grupo => new[] { grupo.Nombre, N(grupo.Total) }),
            grupos.Select(grupo => (string?)Ruta("/agenda", "departamento", grupo.Nombre)));
    }

    private static async Task<Resultado> NoticiasRecientesAsync(SimusDbContext db, DateOnly hoy, CancellationToken ct)
    {
        var filas = await db.Noticias.AsNoTracking()
            .Where(item => item.Estado == "publicado" && item.FechaPublicacion != null && item.FechaPublicacion <= hoy)
            .OrderByDescending(item => item.FechaPublicacion).ThenByDescending(item => item.Id).Take(5)
            .Select(item => new { Fecha = item.FechaPublicacion!.Value, item.Titulo, item.Slug })
            .ToListAsync(ct);
        return Armar(
            filas.Count == 0 ? "Todavía no hay noticias publicadas." : $"Estas son las {N(filas.Count)} noticias publicadas más recientes.",
            "Noticias más recientes", "Noticias publicadas", $"Noticias publicadas · las {N(filas.Count)} más recientes",
            ["Fecha", "Noticia"], filas.Select(item => new[] { Fecha(item.Fecha), item.Titulo }),
            filas.Select(item => (string?)(string.IsNullOrWhiteSpace(item.Slug) ? "/noticias" : $"/noticias/{Uri.EscapeDataString(item.Slug)}")), columnaDeEnlace: 1);
    }

    private static async Task<Resultado> PracticasAsync(SimusDbContext db, CancellationToken ct)
    {
        var catalogo = await db.PracticasMusicales.AsNoTracking().Where(item => item.Activo).OrderBy(item => item.Orden).ThenBy(item => item.Nombre)
            .Select(item => new { item.Nombre, item.Slug }).ToListAsync(ct);
        var festivales = await LecturaFestivalesPublicados.ConsultarAsync(db, ct);
        var cuantos = festivales.SelectMany(item => item.PracticasMusicales.Select(practica => practica.Nombre))
            .GroupBy(nombre => nombre).ToDictionary(grupo => grupo.Key, grupo => grupo.Count());
        return Armar(
            $"El portal reconoce {TextoEnEspanol.Plural(catalogo.Count, "práctica musical", "prácticas musicales")}.",
            "Prácticas musicales del catálogo", "Catálogo de prácticas musicales y festivales publicados", "Catálogo completo · festivales publicados",
            ["Práctica musical", "Festivales publicados"], catalogo.Select(item => new[] { item.Nombre, N(cuantos.GetValueOrDefault(item.Nombre)) }),
            catalogo.Select(item => (string?)(string.IsNullOrWhiteSpace(item.Slug) ? "/ecosistema/practicas-musicales" : $"/ecosistema/practicas-musicales/{Uri.EscapeDataString(item.Slug)}")));
    }

    internal static string? Nombre(IReadOnlyDictionary<string, string> nombres, string? codigo) =>
        string.IsNullOrWhiteSpace(codigo) ? null : ConParticulas(TextoEnEspanol.ATituloDeColombia(nombres.TryGetValue(codigo, out var nombre) ? nombre : codigo));

    /// <summary>«Valle Del Cauca» → «Valle del Cauca»: las partículas van en minúscula, como en el resto del portal.</summary>
    private static string ConParticulas(string nombre) => nombre
        .Replace(" Del ", " del ", StringComparison.Ordinal).Replace(" De ", " de ", StringComparison.Ordinal)
        .Replace(" La ", " la ", StringComparison.Ordinal).Replace(" Y ", " y ", StringComparison.Ordinal)
        .Replace(" Las ", " las ", StringComparison.Ordinal).Replace(" Los ", " los ", StringComparison.Ordinal);

    internal static string Lugar(
        string modalidad, string? departamento, string? municipio,
        IReadOnlyDictionary<string, string> departamentos, IReadOnlyDictionary<string, string> municipios)
    {
        var partes = new[] { Nombre(municipios, municipio), Nombre(departamentos, departamento) }.Where(p => !string.IsNullOrWhiteSpace(p)).ToArray();
        if (partes.Length > 0) return string.Join(", ", partes);
        return string.Equals(modalidad, "virtual", StringComparison.OrdinalIgnoreCase) ? "Virtual" : "Sin lugar específico";
    }
}
