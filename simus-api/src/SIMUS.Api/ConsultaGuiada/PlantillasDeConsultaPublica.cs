using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.ConsultaGuiada;

/// <summary>Un tipo de proceso que el portal publica, con su directorio y la ruta de su ficha.</summary>
/// <param name="Pistas">Palabras (en singular, minúscula y sin tildes) con las que el cajón reconoce el tipo en lo escrito.</param>
public sealed record TipoPublico(string Id, string Singular, string Plural, string Directorio, string Ficha, IReadOnlyList<string> Pistas);

/// <summary>Un proceso publicado, con la forma mínima y común a los cinco tipos. Nada de contacto ni de estados.</summary>
internal sealed record ProcesoPublicado(
    TipoPublico Tipo, int Id, string Nombre, string? Departamento, string? Municipio, int? OrganizacionId);

/// <summary>Los parámetros ya validados de una pregunta. Lo que no se pidió queda nulo.</summary>
internal sealed record ValoresValidados(
    string? Departamento, string? Municipio, TipoPublico? Tipo, int? Practica, int? Territorio, int? Organizacion, int? Mes, int? Anio);

/// <summary>
/// LAS PREGUNTAS PARAMETRIZADAS del banco público de la Consulta Guiada (punto 73 del mapa de comentarios).
/// </summary>
/// <remarks>
/// <para>
/// <b>SIGUE SIENDO UN BANCO CERRADO.</b> Cada plantilla es una consulta escrita aquí, con parámetros TIPADOS: un
/// departamento o un municipio de DIVIPOLA, un tipo de proceso, una práctica o un territorio sonoro del catálogo, una
/// organización con ficha pública, un mes y un año. El valor que llega se busca en su catálogo; lo que no esté ahí se
/// rechaza con un 400. Ningún valor se concatena en una consulta: los filtros se aplican sobre las filas ya leídas con
/// consultas de EF Core parametrizadas, así que una cadena como «05' OR 1=1 --» no es un código y no pasa de la validación.
/// </para>
/// <para>
/// <b>SOLO LO PUBLICADO Y SIN DATOS PERSONALES.</b> Procesos publicados (la misma lectura del directorio), eventos
/// publicados y organizaciones con ficha pública. Las filas con nombre propio llevan el nombre que ya muestra el
/// directorio, su ubicación y el enlace a su ficha; nunca contacto, estados de revisión ni personas.
/// </para>
/// </remarks>
public static class PlantillasDeConsultaPublica
{
    private const int Tope = 30;

    public static readonly IReadOnlyList<TipoPublico> Tipos =
    [
        new("festivales", "festival", "festivales", "/ecosistema/festivales", "/ecosistema/festivales", ["festival"]),
        new("mercados", "mercado musical", "mercados musicales", "/ecosistema/mercados-musicales", "/ecosistema/mercados-musicales", ["mercado"]),
        new("talleres", "taller de lutería", "talleres de lutería", "/ecosistema/luteria", "/ecosistema/luteria", ["taller", "luteria", "lutier"]),
        new("espacios", "espacio para música en vivo", "espacios para música en vivo", "/ecosistema/espacios", "/ecosistema/espacios", ["espacio"]),
        new("redes", "red o centro de documentación", "redes y centros de documentación", "/ecosistema/redes", "/ecosistema/redes", ["red", "documentacion"]),
    ];

    public static TipoPublico? TipoPorId(string? id) => Tipos.FirstOrDefault(tipo => tipo.Id == id);

    private static ParametroDePreguntaDto P(string nombre, string rotulo, bool obligatorio = true) => new(nombre, rotulo, obligatorio);

    private static readonly ParametroDePreguntaDto Departamento = P("departamento", "Departamento");
    private static readonly ParametroDePreguntaDto Municipio = P("municipio", "Municipio");

    private static PreguntaPublica Q(string id, string rotulo, string descripcion, params ParametroDePreguntaDto[] parametros) =>
        new(id, rotulo, descripcion, parametros);

    /// <summary>Las preguntas con parámetros y las nuevas sin ellos. Se suman a las 11 fijas del banco.</summary>
    public static readonly IReadOnlyList<PreguntaPublica> Preguntas = [.. Construir()];

    private static IEnumerable<PreguntaPublica> Construir()
    {
        foreach (var tipo in Tipos)
        {
            yield return Q($"publica_{tipo.Id}_en_departamento", $"¿Qué {tipo.Plural} hay en un departamento?",
                $"Los {tipo.Plural} publicados cuya sede principal está en el departamento que elijas.", Departamento);
            yield return Q($"publica_{tipo.Id}_en_municipio", $"¿Qué {tipo.Plural} hay en un municipio?",
                $"Los {tipo.Plural} publicados cuya sede principal está en el municipio que elijas.", Municipio);
        }

        foreach (var tipo in Tipos.Where(tipo => tipo.Id is "talleres" or "espacios" or "redes"))
        {
            yield return Q($"publica_{tipo.Id}_por_departamento", $"¿Cuántos {tipo.Plural} hay por departamento?",
                $"{char.ToUpperInvariant(tipo.Plural[0]) + tipo.Plural[1..]} publicados por departamento de su sede principal.");
        }

        yield return Q("publica_procesos_por_departamento", "¿Cuántos procesos hay por departamento y tipo?",
            "Todos los departamentos con sus festivales, mercados, talleres, espacios y redes publicados.");
        yield return Q("publica_procesos_en_departamento", "¿Qué hay publicado en un departamento?",
            "Cuántos procesos de cada tipo hay publicados en el departamento que elijas.", Departamento);
        yield return Q("publica_procesos_en_municipio", "¿Qué hay publicado en un municipio?",
            "Cuántos procesos de cada tipo hay publicados en el municipio que elijas.", Municipio);
        yield return Q("publica_festivales_con_practica", "¿Qué festivales tienen una práctica musical?",
            "Los festivales publicados que declaran la práctica musical que elijas.", P("practica", "Práctica musical"));
        yield return Q("publica_festivales_con_territorio", "¿Qué festivales recogen un territorio sonoro?",
            "Los festivales publicados que declaran el territorio sonoro que elijas.", P("territorio", "Territorio sonoro"));
        yield return Q("publica_practicas_en_departamento", "¿Qué prácticas musicales se declaran en un departamento?",
            "Las prácticas musicales de los festivales publicados en el departamento que elijas.", Departamento);
        yield return Q("publica_agenda_filtrada", "¿Qué eventos hay en la agenda, por lugar, tipo o mes?",
            "Eventos publicados de la agenda. Sin mes, los próximos; filtra por departamento, municipio, tipo de proceso que los enmarca, mes y año.",
            P("departamento", "Departamento", false), P("municipio", "Municipio", false), P("tipo", "Tipo de proceso", false),
            P("mes", "Mes", false), P("anio", "Año", false));
        yield return Q("publica_agenda_por_mes", "¿Cuántos eventos hay cada mes?",
            "Eventos publicados de la agenda en los próximos doce meses.");
        yield return Q("publica_organizaciones_con_mas_procesos", "¿Qué organizaciones tienen más procesos publicados?",
            "Las organizaciones con ficha pública que más procesos tienen publicados en el portal.");
        yield return Q("publica_procesos_de_organizacion", "¿Qué procesos tiene una organización?",
            "Los procesos publicados de una organización con ficha pública.", P("organizacion", "Organización"));
        yield return Q("publica_completitud_del_dato", "¿Qué tan completo está el dato?",
            "Por tipo de proceso: cuántos publicados declaran su departamento y su municipio.");
    }

    private static readonly Dictionary<string, PreguntaPublica> PorId = Preguntas.ToDictionary(pregunta => pregunta.Id);

    public static bool Contiene(string id) => PorId.ContainsKey(id);

    // ────────────────────────────── Validación de parámetros ──────────────────────────────

    /// <summary>
    /// Valida los parámetros contra el catálogo de la pregunta: los admitidos, los obligatorios y que cada valor exista.
    /// </summary>
    internal static async Task<(ValoresValidados? Valores, Dictionary<string, string[]> Errores)> ValidarAsync(
        PreguntaPublica pregunta, IReadOnlyDictionary<string, string>? enviados, SimusDbContext db, CacheDivipola divipola, CancellationToken ct)
    {
        var errores = new Dictionary<string, string[]>();
        var recibidos = (enviados ?? new Dictionary<string, string>())
            .Where(par => !string.IsNullOrWhiteSpace(par.Value))
            .ToDictionary(par => par.Key.Trim(), par => par.Value.Trim(), StringComparer.Ordinal);

        foreach (var clave in recibidos.Keys.Where(clave => pregunta.Parametros.All(p => p.Nombre != clave)))
            errores[clave.Length <= 32 ? clave : "parametros"] = ["Esta pregunta no admite ese parámetro."];
        foreach (var parametro in pregunta.Parametros.Where(p => p.Obligatorio && !recibidos.ContainsKey(p.Nombre)))
            errores[parametro.Nombre] = [$"Falta elegir: {parametro.Rotulo.ToLowerInvariant()}."];
        foreach (var par in recibidos.Where(par => par.Value.Length > 40 && pregunta.Parametros.Any(p => p.Nombre == par.Key)))
            errores[par.Key] = ["Ese valor no es válido."];
        if (errores.Count > 0) return (null, errores);

        var (departamentos, municipios) = await divipola.ObtenerAsync(db, ct);
        string? Texto(string nombre) => recibidos.GetValueOrDefault(nombre);
        int? Entero(string nombre, int minimo, int maximo)
        {
            var valor = Texto(nombre);
            if (valor is null) return null;
            if (int.TryParse(valor, NumberStyles.None, CultureInfo.InvariantCulture, out var numero) && numero >= minimo && numero <= maximo) return numero;
            errores[nombre] = ["Ese valor no es válido."];
            return null;
        }

        var departamento = Texto("departamento");
        if (departamento is not null && !departamentos.ContainsKey(departamento)) { errores["departamento"] = ["Ese departamento no está en el catálogo."]; departamento = null; }
        var municipio = Texto("municipio");
        if (municipio is not null && !municipios.ContainsKey(municipio)) { errores["municipio"] = ["Ese municipio no está en el catálogo."]; municipio = null; }
        if (departamento is not null && municipio is not null && !municipio.StartsWith(departamento, StringComparison.Ordinal))
            errores["municipio"] = ["Ese municipio no pertenece al departamento elegido."];

        TipoPublico? tipo = null;
        if (Texto("tipo") is { } idDeTipo && (tipo = TipoPorId(idDeTipo)) is null) errores["tipo"] = ["Ese tipo de proceso no está en el catálogo."];

        var practica = Entero("practica", 1, int.MaxValue);
        if (practica is not null && !await db.PracticasMusicales.AsNoTracking().AnyAsync(item => item.Id == practica, ct))
        { errores["practica"] = ["Esa práctica musical no está en el catálogo."]; practica = null; }
        var territorio = Entero("territorio", 1, int.MaxValue);
        if (territorio is not null && !await db.TerritoriosSonoros.AsNoTracking().AnyAsync(item => item.Id == territorio, ct))
        { errores["territorio"] = ["Ese territorio sonoro no está en el catálogo."]; territorio = null; }
        var organizacion = Entero("organizacion", 1, int.MaxValue);
        if (organizacion is not null && !await PerfilPublicoEndpoints.OrganizacionesPublicas(db).AnyAsync(item => item.Id == organizacion, ct))
        { errores["organizacion"] = ["Esa organización no tiene ficha pública."]; organizacion = null; }
        var mes = Entero("mes", 1, 12);
        var anio = Entero("anio", 2000, 2100);

        return errores.Count > 0 ? (null, errores) : (new ValoresValidados(departamento, municipio, tipo, practica, territorio, organizacion, mes, anio), errores);
    }

    // ────────────────────────────── Catálogos para el cajón ──────────────────────────────

    public static async Task<CatalogosDeConsultaPublicaDto> CatalogosAsync(SimusDbContext db, CacheDivipola divipola, CancellationToken ct)
    {
        var (departamentos, municipios) = await divipola.ObtenerAsync(db, ct);
        var practicas = await db.PracticasMusicales.AsNoTracking().Where(item => item.Activo).OrderBy(item => item.Orden).ThenBy(item => item.Nombre)
            .Select(item => new { item.Id, item.Nombre }).ToListAsync(ct);
        var territorios = await db.TerritoriosSonoros.AsNoTracking().Where(item => item.Activo).OrderBy(item => item.Orden).ThenBy(item => item.Nombre)
            .Select(item => new { item.Id, item.Nombre }).ToListAsync(ct);
        var organizaciones = await PerfilPublicoEndpoints.OrganizacionesPublicas(db).OrderBy(item => item.Name)
            .Select(item => new { item.Id, item.Name }).ToListAsync(ct);
        return new CatalogosDeConsultaPublicaDto(
            departamentos.OrderBy(par => par.Key, StringComparer.Ordinal)
                .Select(par => new ValorDeCatalogoDto(par.Key, BancoDePreguntasPublicas.Nombre(departamentos, par.Key)!)).ToList(),
            municipios.OrderBy(par => par.Key, StringComparer.Ordinal)
                .Select(par => (IReadOnlyList<string>)[par.Key, BancoDePreguntasPublicas.Nombre(municipios, par.Key)!]).ToList(),
            Tipos.Select(tipo => new TipoDeProcesoPublicoDto(tipo.Id, tipo.Singular, tipo.Plural, tipo.Pistas)).ToList(),
            practicas.Select(item => new ValorDeCatalogoDto(item.Id.ToString(CultureInfo.InvariantCulture), item.Nombre)).ToList(),
            territorios.Select(item => new ValorDeCatalogoDto(item.Id.ToString(CultureInfo.InvariantCulture), item.Nombre)).ToList(),
            organizaciones.Select(item => new ValorDeCatalogoDto(item.Id.ToString(CultureInfo.InvariantCulture), item.Name)).ToList());
    }

    // ────────────────────────────── Lectura de lo publicado ──────────────────────────────

    private static (string? Departamento, string? Municipio) Sede(
        string? sedeDepartamento, string? sedeMunicipio, string nivel, string? departamento, string? municipio) =>
        SedePrincipal.Resolver(sedeDepartamento, sedeMunicipio, nivel, departamento, municipio);

    /// <summary>Los procesos publicados de los cinco tipos, con la sede con la que el directorio los sitúa.</summary>
    internal static async Task<List<ProcesoPublicado>> ProcesosAsync(
        SimusDbContext db, List<FestivalPublicadoVigenteLectura> festivales, CancellationToken ct)
    {
        var lista = new List<ProcesoPublicado>();
        lista.AddRange(festivales.Select(f => new ProcesoPublicado(
            Tipos[0], f.Festival.Id, f.Nombre, f.Sede.Departamento, f.Sede.Municipio, f.Festival.OrganizacionPrincipalId)));
        var mercados = await db.Mercados.AsNoTracking().Where(m => m.Activo && m.EstadoRegistro == "publicado")
            .Select(m => new { m.Id, m.Nombre, m.SedeCodigoDepartamento, m.SedeCodigoMunicipio, m.NivelCobertura, m.CodigoDepartamento, m.CodigoMunicipio, Org = (int?)m.OrganizacionPrincipalId }).ToListAsync(ct);
        lista.AddRange(mercados.Select(m => Con(Tipos[1], m.Id, m.Nombre, Sede(m.SedeCodigoDepartamento, m.SedeCodigoMunicipio, m.NivelCobertura, m.CodigoDepartamento, m.CodigoMunicipio), m.Org)));
        var talleres = await db.Talleres.AsNoTracking().Where(m => m.Activo && m.EstadoRegistro == "publicado")
            .Select(m => new { m.Id, m.Nombre, m.SedeCodigoDepartamento, m.SedeCodigoMunicipio, m.NivelCobertura, m.CodigoDepartamento, m.CodigoMunicipio, Org = m.OrganizacionPrincipalId }).ToListAsync(ct);
        lista.AddRange(talleres.Select(m => Con(Tipos[2], m.Id, m.Nombre, Sede(m.SedeCodigoDepartamento, m.SedeCodigoMunicipio, m.NivelCobertura, m.CodigoDepartamento, m.CodigoMunicipio), m.Org)));
        var espacios = await db.Espacios.AsNoTracking().Where(m => m.Activo && m.EstadoRegistro == "publicado")
            .Select(m => new { m.Id, m.Nombre, m.SedeCodigoDepartamento, m.SedeCodigoMunicipio, m.NivelCobertura, m.CodigoDepartamento, m.CodigoMunicipio, Org = m.OrganizacionPrincipalId }).ToListAsync(ct);
        lista.AddRange(espacios.Select(m => Con(Tipos[3], m.Id, m.Nombre, Sede(m.SedeCodigoDepartamento, m.SedeCodigoMunicipio, m.NivelCobertura, m.CodigoDepartamento, m.CodigoMunicipio), m.Org)));
        var redes = await db.Redes.AsNoTracking().Where(m => m.Activo && m.EstadoRegistro == "publicado")
            .Select(m => new { m.Id, m.Nombre, m.SedeCodigoDepartamento, m.SedeCodigoMunicipio, m.NivelCobertura, m.CodigoDepartamento, m.CodigoMunicipio, Org = m.OrganizacionPrincipalId }).ToListAsync(ct);
        lista.AddRange(redes.Select(m => Con(Tipos[4], m.Id, m.Nombre, Sede(m.SedeCodigoDepartamento, m.SedeCodigoMunicipio, m.NivelCobertura, m.CodigoDepartamento, m.CodigoMunicipio), m.Org)));
        return lista;
    }

    private static ProcesoPublicado Con(TipoPublico tipo, int id, string nombre, (string? Departamento, string? Municipio) sede, int? organizacion) =>
        new(tipo, id, nombre, sede.Departamento, sede.Municipio, organizacion);

    // ────────────────────────────── Respuestas ──────────────────────────────

    private static string N(int valor) => valor.ToString(CultureInfo.InvariantCulture);
    private static string Mayuscula(string texto) => char.ToUpperInvariant(texto[0]) + texto[1..];

    private static readonly string[] Meses =
        ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    private static string Ruta(string ruta, params (string Nombre, string Valor)[] consulta) =>
        consulta.Length == 0 ? ruta : ruta + "?" + string.Join("&", consulta.Select(par => $"{par.Nombre}={Uri.EscapeDataString(par.Valor)}"));

    private static BancoDePreguntasPublicas.Resultado Armar(
        string resumen, string titulo, string fuente, string alcance, IReadOnlyList<string> filtros, string[] columnas,
        IEnumerable<string[]> filas, IEnumerable<string?> destinos, int columnaDeEnlace = 0)
    {
        var listaDeFilas = filas.Select(fila => (IReadOnlyList<string>)fila).ToList();
        resumen = resumen.Replace("..", ".", StringComparison.Ordinal); // «Bogotá, D.C.» + punto final.
        return new(resumen, new TablaDeConsultaDto(titulo, fuente, alcance, columnas, listaDeFilas, destinos.ToList(), columnaDeEnlace, filtros));
    }

    private static List<string> FiltrosBase(params string?[] otros) =>
        ["Solo registros publicados", .. otros.Where(otro => !string.IsNullOrWhiteSpace(otro)).Select(otro => otro!)];

    private static string Donde(string? departamento, string? municipio,
        IReadOnlyDictionary<string, string> departamentos, IReadOnlyDictionary<string, string> municipios)
    {
        var partes = new[] { BancoDePreguntasPublicas.Nombre(municipios, municipio), BancoDePreguntasPublicas.Nombre(departamentos, departamento) }
            .Where(parte => !string.IsNullOrWhiteSpace(parte));
        return string.Join(", ", partes);
    }

    internal static async Task<BancoDePreguntasPublicas.Resultado> ResponderAsync(
        PreguntaPublica pregunta, ValoresValidados valores, SimusDbContext db, CacheDivipola divipola, DateOnly hoy, CancellationToken ct)
    {
        var (departamentos, municipios) = await divipola.ObtenerAsync(db, ct);
        var id = pregunta.Id;

        if (id == "publica_agenda_filtrada") return await AgendaFiltradaAsync(db, divipola, valores, hoy, ct);
        if (id == "publica_agenda_por_mes") return await AgendaPorMesAsync(db, hoy, ct);

        var festivales = await LecturaFestivalesPublicados.ConsultarAsync(db, ct);

        switch (id)
        {
            case "publica_festivales_con_practica":
            case "publica_festivales_con_territorio":
            {
                var esPractica = id.EndsWith("practica", StringComparison.Ordinal);
                var buscado = esPractica ? valores.Practica!.Value : valores.Territorio!.Value;
                var nombre = esPractica
                    ? await db.PracticasMusicales.AsNoTracking().Where(i => i.Id == buscado).Select(i => i.Nombre).FirstAsync(ct)
                    : await db.TerritoriosSonoros.AsNoTracking().Where(i => i.Id == buscado).Select(i => i.Nombre).FirstAsync(ct);
                var coinciden = festivales
                    .Where(f => (esPractica ? f.PracticasMusicales : f.TerritoriosSonoros).Any(c => c.Id == buscado))
                    .Select(f => new ProcesoPublicado(Tipos[0], f.Festival.Id, f.Nombre, f.Sede.Departamento, f.Sede.Municipio, null)).ToList();
                var etiqueta = esPractica ? "práctica musical" : "territorio sonoro";
                return Lista(coinciden, Tipos[0], $"Festivales publicados con {etiqueta} «{nombre}»",
                    "Festivales publicados (la misma lectura del directorio)", FiltrosBase($"{Mayuscula(etiqueta)}: {nombre}"), departamentos, municipios,
                    $"con {etiqueta} «{nombre}»");
            }
            case "publica_practicas_en_departamento":
            {
                var enElDepartamento = festivales.Where(f => f.Sede.Departamento == valores.Departamento).ToList();
                var nombreDelDepartamento = BancoDePreguntasPublicas.Nombre(departamentos, valores.Departamento)!;
                var grupos = enElDepartamento.SelectMany(f => f.PracticasMusicales.Select(p => p.Nombre))
                    .GroupBy(n => n).Select(g => (Nombre: g.Key, Total: g.Count()))
                    .OrderByDescending(g => g.Total).ThenBy(g => g.Nombre, StringComparer.Ordinal).ToList();
                return Armar(
                    grupos.Count == 0
                        ? $"Los festivales publicados en {nombreDelDepartamento} no declaran prácticas musicales."
                        : $"En {nombreDelDepartamento} hay {TextoEnEspanol.Plural(enElDepartamento.Count, "festival publicado", "festivales publicados")}; la práctica más declarada es «{grupos[0].Nombre}» ({N(grupos[0].Total)}).",
                    $"Prácticas musicales de los festivales de {nombreDelDepartamento}", "Festivales publicados (la misma lectura del directorio)",
                    $"Festivales publicados · {nombreDelDepartamento}", FiltrosBase($"Departamento: {nombreDelDepartamento}"),
                    ["Práctica musical", "Festivales"], grupos.Select(g => new[] { g.Nombre, N(g.Total) }),
                    grupos.Select(g => (string?)Ruta(Tipos[0].Directorio, ("departamento", nombreDelDepartamento), ("practica", g.Nombre))));
            }
        }

        var procesos = await ProcesosAsync(db, festivales, ct);

        foreach (var tipo in Tipos)
        {
            if (id == $"publica_{tipo.Id}_en_departamento")
            {
                var nombre = BancoDePreguntasPublicas.Nombre(departamentos, valores.Departamento)!;
                return Lista(procesos.Where(p => p.Tipo == tipo && p.Departamento == valores.Departamento).ToList(), tipo,
                    $"{Mayuscula(tipo.Plural)} publicados en {nombre}", $"{Mayuscula(tipo.Plural)} publicados", FiltrosBase($"Departamento: {nombre}"),
                    departamentos, municipios, $"en {nombre}");
            }
            if (id == $"publica_{tipo.Id}_en_municipio")
            {
                var nombre = Donde(valores.Municipio![..2], valores.Municipio, departamentos, municipios);
                var soloMunicipio = BancoDePreguntasPublicas.Nombre(municipios, valores.Municipio)!;
                return Lista(procesos.Where(p => p.Tipo == tipo && p.Municipio == valores.Municipio).ToList(), tipo,
                    $"{Mayuscula(tipo.Plural)} publicados en {soloMunicipio}", $"{Mayuscula(tipo.Plural)} publicados", FiltrosBase($"Municipio: {nombre}"),
                    departamentos, municipios, $"en {nombre}");
            }
            if (id == $"publica_{tipo.Id}_por_departamento")
            {
                var grupos = procesos.Where(p => p.Tipo == tipo && p.Departamento is not null)
                    .GroupBy(p => p.Departamento!).Select(g => (Codigo: g.Key, Nombre: BancoDePreguntasPublicas.Nombre(departamentos, g.Key) ?? g.Key, Total: g.Count()))
                    .OrderByDescending(g => g.Total).ThenBy(g => g.Nombre, StringComparer.Ordinal).ToList();
                var total = procesos.Count(p => p.Tipo == tipo);
                return Armar(
                    $"Hay {TextoEnEspanol.Plural(total, tipo.Singular + " publicado", tipo.Plural + " publicados")}"
                        + (grupos.Count > 0 ? $"; el departamento con más es {grupos[0].Nombre} ({N(grupos[0].Total)})." : "."),
                    $"{Mayuscula(tipo.Plural)} publicados por departamento", $"{Mayuscula(tipo.Plural)} publicados", "Todo el país · solo lo publicado",
                    FiltrosBase("Todo el país"), ["Departamento", Mayuscula(tipo.Plural)], grupos.Select(g => new[] { g.Nombre, N(g.Total) }),
                    grupos.Select(g => (string?)Ruta(tipo.Directorio, ("departamento", g.Nombre))));
            }
        }

        switch (id)
        {
            case "publica_procesos_por_departamento":
            {
                var filas = departamentos.Keys.OrderBy(codigo => codigo, StringComparer.Ordinal).Select(codigo => (
                    Codigo: codigo, Nombre: BancoDePreguntasPublicas.Nombre(departamentos, codigo)!,
                    Cuentas: Tipos.Select(tipo => procesos.Count(p => p.Tipo == tipo && p.Departamento == codigo)).ToArray()))
                    .OrderByDescending(f => f.Cuentas.Sum()).ThenBy(f => f.Nombre, StringComparer.Ordinal).ToList();
                var conProcesos = filas.Count(f => f.Cuentas.Sum() > 0);
                return Armar(
                    $"{N(conProcesos)} de {N(filas.Count)} departamentos tienen al menos un proceso publicado; " +
                    $"hay {TextoEnEspanol.Plural(procesos.Count, "proceso publicado", "procesos publicados")} en total.",
                    "Procesos publicados por departamento y tipo", "Procesos publicados del ecosistema", "Todo el país · solo lo publicado",
                    FiltrosBase("Todo el país"), ["Departamento", "Festivales", "Mercados", "Talleres", "Espacios", "Redes", "Total"],
                    filas.Select(f => (string[])[f.Nombre, .. f.Cuentas.Select(N), N(f.Cuentas.Sum())]),
                    filas.Select(f => (string?)Ruta(Tipos[0].Directorio, ("departamento", f.Nombre))));
            }
            case "publica_procesos_en_departamento":
            case "publica_procesos_en_municipio":
            {
                var porMunicipio = id.EndsWith("municipio", StringComparison.Ordinal);
                var donde = porMunicipio
                    ? Donde(valores.Municipio![..2], valores.Municipio, departamentos, municipios)
                    : BancoDePreguntasPublicas.Nombre(departamentos, valores.Departamento)!;
                var propios = procesos.Where(p => porMunicipio ? p.Municipio == valores.Municipio : p.Departamento == valores.Departamento).ToList();
                var nombreDeLaRuta = porMunicipio ? BancoDePreguntasPublicas.Nombre(municipios, valores.Municipio)! : donde;
                string? dep = porMunicipio ? BancoDePreguntasPublicas.Nombre(departamentos, valores.Municipio![..2]) : null;
                return Armar(
                    propios.Count == 0 ? $"Todavía no hay procesos publicados en {donde}."
                        : $"En {donde} hay {TextoEnEspanol.Plural(propios.Count, "proceso publicado", "procesos publicados")}.",
                    $"Procesos publicados en {donde}", "Procesos publicados del ecosistema", $"{donde} · solo lo publicado",
                    FiltrosBase($"{(porMunicipio ? "Municipio" : "Departamento")}: {donde}"), ["Tipo de proceso", "Publicados"],
                    Tipos.Select(tipo => new[] { Mayuscula(tipo.Plural), N(propios.Count(p => p.Tipo == tipo)) }),
                    Tipos.Select(tipo => (string?)(porMunicipio && dep is not null
                        ? Ruta(tipo.Directorio, ("departamento", dep), ("municipio", nombreDeLaRuta))
                        : Ruta(tipo.Directorio, ("departamento", nombreDeLaRuta)))));
            }
            case "publica_organizaciones_con_mas_procesos":
            {
                var publicas = await PerfilPublicoEndpoints.OrganizacionesPublicas(db).Select(item => new { item.Id, item.Name }).ToListAsync(ct);
                var nombres = publicas.ToDictionary(item => item.Id, item => item.Name);
                var grupos = procesos.Where(p => p.OrganizacionId is { } org && nombres.ContainsKey(org))
                    .GroupBy(p => p.OrganizacionId!.Value).Select(g => (Id: g.Key, Nombre: nombres[g.Key], Total: g.Count()))
                    .OrderByDescending(g => g.Total).ThenBy(g => g.Nombre, StringComparer.Ordinal).Take(10).ToList();
                return Armar(
                    grupos.Count == 0 ? "Todavía no hay organizaciones con ficha pública y procesos publicados."
                        : $"La organización con más procesos publicados es «{grupos[0].Nombre}» ({N(grupos[0].Total)}).",
                    "Organizaciones con más procesos publicados", "Procesos publicados y organizaciones con ficha pública",
                    "Organizaciones con ficha pública · las 10 con más procesos", FiltrosBase("Solo organizaciones con ficha pública"),
                    ["Organización", "Procesos publicados"], grupos.Select(g => new[] { g.Nombre, N(g.Total) }),
                    grupos.Select(g => (string?)$"/ecosistema/organizaciones/{N(g.Id)}"));
            }
            case "publica_procesos_de_organizacion":
            {
                var org = valores.Organizacion!.Value;
                var nombre = await PerfilPublicoEndpoints.OrganizacionesPublicas(db).Where(item => item.Id == org).Select(item => item.Name).FirstAsync(ct);
                var propios = procesos.Where(p => p.OrganizacionId == org).OrderBy(p => p.Tipo.Id).ThenBy(p => p.Nombre, StringComparer.Ordinal).ToList();
                return Armar(
                    propios.Count == 0 ? $"«{nombre}» todavía no tiene procesos publicados."
                        : $"«{nombre}» tiene {TextoEnEspanol.Plural(propios.Count, "proceso publicado", "procesos publicados")}.",
                    $"Procesos publicados de {nombre}", "Procesos publicados", "Una organización con ficha pública",
                    FiltrosBase($"Organización: {nombre}"), ["Nombre", "Tipo", "Lugar"],
                    propios.Take(Tope).Select(p => new[] { p.Nombre, Mayuscula(p.Tipo.Singular), Donde(p.Departamento, p.Municipio, departamentos, municipios) }),
                    propios.Take(Tope).Select(p => (string?)$"{p.Tipo.Ficha}/{N(p.Id)}"));
            }
            case "publica_completitud_del_dato":
            {
                var filas = Tipos.Select(tipo =>
                {
                    var propios = procesos.Where(p => p.Tipo == tipo).ToList();
                    return (Tipo: tipo, Total: propios.Count, ConDepartamento: propios.Count(p => p.Departamento is not null), ConMunicipio: propios.Count(p => p.Municipio is not null));
                }).ToList();
                var total = filas.Sum(f => f.Total);
                var completos = filas.Sum(f => f.ConMunicipio);
                var conPractica = festivales.Count(f => f.PracticasMusicales.Count > 0);
                var porcentaje = total == 0 ? 0 : (int)Math.Round(100.0 * completos / total, MidpointRounding.AwayFromZero);
                return Armar(
                    total == 0 ? "Todavía no hay procesos publicados." :
                    $"De {TextoEnEspanol.Plural(total, "proceso publicado", "procesos publicados")}, {N(completos)} ({N(porcentaje)} %) declaran su municipio. " +
                    $"De {TextoEnEspanol.Plural(festivales.Count, "festival publicado", "festivales publicados")}, {N(conPractica)} declaran al menos una práctica musical.",
                    "Qué tan completo está el dato publicado", "Procesos publicados del ecosistema", "Todo el país · solo lo publicado",
                    FiltrosBase("Todo el país"), ["Tipo de proceso", "Publicados", "Con departamento", "Con municipio"],
                    filas.Select(f => new[] { Mayuscula(f.Tipo.Plural), N(f.Total), N(f.ConDepartamento), N(f.ConMunicipio) }),
                    filas.Select(f => (string?)f.Tipo.Directorio));
            }
        }

        throw new InvalidOperationException("La pregunta no pertenece al banco público.");
    }

    private static BancoDePreguntasPublicas.Resultado Lista(
        List<ProcesoPublicado> procesos, TipoPublico tipo, string titulo, string fuente, IReadOnlyList<string> filtros,
        IReadOnlyDictionary<string, string> departamentos, IReadOnlyDictionary<string, string> municipios, string donde)
    {
        var ordenados = procesos.OrderBy(p => p.Nombre, StringComparer.CurrentCultureIgnoreCase).ToList();
        var mostrados = ordenados.Take(Tope).ToList();
        var resumen = ordenados.Count == 0
            ? $"No hay {tipo.Plural} publicados {donde}."
            : ordenados.Count > Tope
                ? $"Hay {TextoEnEspanol.Plural(ordenados.Count, tipo.Singular + " publicado", tipo.Plural + " publicados")} {donde}; se muestran los primeros {N(Tope)}."
                : $"Hay {TextoEnEspanol.Plural(ordenados.Count, tipo.Singular + " publicado", tipo.Plural + " publicados")} {donde}.";
        return Armar(resumen, titulo, fuente, $"Solo lo publicado · {N(mostrados.Count)} de {N(ordenados.Count)}", filtros,
            ["Nombre", "Municipio", "Departamento"],
            mostrados.Select(p => new[]
            {
                p.Nombre,
                BancoDePreguntasPublicas.Nombre(municipios, p.Municipio) ?? "Sin municipio declarado",
                BancoDePreguntasPublicas.Nombre(departamentos, p.Departamento) ?? "Sin departamento declarado",
            }),
            mostrados.Select(p => (string?)$"{tipo.Ficha}/{N(p.Id)}"));
    }

    // ────────────────────────────── Agenda ──────────────────────────────

    internal static IQueryable<EventoAgendaRow> Publicados(SimusDbContext db) =>
        db.EventosAgenda.AsNoTracking().Where(item => item.Estado == "publicado" && !item.Cancelado);

    private static async Task<BancoDePreguntasPublicas.Resultado> AgendaFiltradaAsync(
        SimusDbContext db, CacheDivipola divipola, ValoresValidados v, DateOnly hoy, CancellationToken ct)
    {
        var (departamentos, municipios) = await divipola.ObtenerAsync(db, ct);
        var consulta = Publicados(db);
        var filtros = FiltrosBase();
        string periodo;

        if (v.Mes is null && v.Anio is null)
        {
            consulta = consulta.Where(item => (item.FechaFin ?? item.FechaInicio) >= hoy);
            periodo = "desde hoy";
            filtros.Add("Próximos (desde hoy)");
        }
        else
        {
            // SIN AÑO, EL PRÓXIMO MES DE ESE NOMBRE: «diciembre» dicho en noviembre es este diciembre.
            var anio = v.Anio ?? (v.Mes!.Value >= hoy.Month ? hoy.Year : hoy.Year + 1);
            var desde = new DateOnly(anio, v.Mes ?? 1, 1);
            var hasta = v.Mes is null ? new DateOnly(anio, 12, 31) : desde.AddMonths(1).AddDays(-1);
            consulta = consulta.Where(item => item.FechaInicio <= hasta && (item.FechaFin ?? item.FechaInicio) >= desde);
            periodo = v.Mes is null ? $"en {anio}" : $"en {Meses[v.Mes.Value - 1]} de {anio}";
            filtros.Add($"Fecha: {periodo.Replace("en ", "", StringComparison.Ordinal)}");
        }

        string? lugar = null;
        if (v.Municipio is not null)
        {
            consulta = consulta.Where(item => item.CodigoMunicipio == v.Municipio);
            lugar = Donde(v.Municipio[..2], v.Municipio, departamentos, municipios);
            filtros.Add($"Municipio: {lugar}");
        }
        else if (v.Departamento is not null)
        {
            consulta = consulta.Where(item => item.CodigoDepartamento == v.Departamento);
            lugar = BancoDePreguntasPublicas.Nombre(departamentos, v.Departamento);
            filtros.Add($"Departamento: {lugar}");
        }

        if (v.Tipo is { } tipo)
        {
            consulta = tipo.Id switch
            {
                "festivales" => consulta.Where(item => item.FestivalId != null),
                "mercados" => consulta.Where(item => item.MercadoId != null),
                "talleres" => consulta.Where(item => item.TallerId != null),
                "espacios" => consulta.Where(item => item.EspacioId != null),
                _ => consulta.Where(item => item.RedId != null),
            };
            filtros.Add($"Enmarcados en: {tipo.Plural}");
        }

        var total = await consulta.CountAsync(ct);
        var filas = await consulta.OrderBy(item => item.FechaInicio).ThenBy(item => item.Id).Take(Tope)
            .Select(item => new { item.FechaInicio, item.Titulo, item.Slug, item.Modalidad, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct);
        var quien = new List<string>();
        if (v.Tipo is not null) quien.Add($"de {v.Tipo.Plural}");
        if (lugar is not null) quien.Add($"en {lugar}");
        var resumen = total == 0
            ? $"No hay eventos publicados {string.Join(' ', quien)} {periodo}.".Replace("  ", " ", StringComparison.Ordinal)
            : $"Hay {TextoEnEspanol.Plural(total, "evento publicado", "eventos publicados")} {string.Join(' ', quien)} {periodo}"
                .Replace("  ", " ", StringComparison.Ordinal) + (total > Tope ? $"; se muestran los {N(Tope)} más cercanos." : ".");
        var nota = v.Tipo is not null
            ? " Los procesos no tienen fecha propia: se listan los eventos de la agenda que cada proceso publica."
            : string.Empty;
        return Armar(resumen + nota, "Eventos de la agenda", "Agenda pública (eventos publicados)",
            $"Eventos publicados · {N(filas.Count)} de {N(total)}", filtros, ["Fecha", "Evento", "Lugar"],
            filas.Select(item => new[]
            {
                item.FechaInicio.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture), item.Titulo,
                BancoDePreguntasPublicas.Lugar(item.Modalidad, item.CodigoDepartamento, item.CodigoMunicipio, departamentos, municipios),
            }),
            filas.Select(item => (string?)(string.IsNullOrWhiteSpace(item.Slug) ? "/agenda" : $"/agenda/{Uri.EscapeDataString(item.Slug)}")), 1);
    }

    private static async Task<BancoDePreguntasPublicas.Resultado> AgendaPorMesAsync(SimusDbContext db, DateOnly hoy, CancellationToken ct)
    {
        var limite = new DateOnly(hoy.Year, hoy.Month, 1).AddMonths(12);
        var inicios = await Publicados(db).Where(item => item.FechaInicio >= hoy && item.FechaInicio < limite)
            .Select(item => item.FechaInicio).ToListAsync(ct);
        var porMes = Enumerable.Range(0, 12).Select(i => new DateOnly(hoy.Year, hoy.Month, 1).AddMonths(i))
            .Select(mes => (Mes: mes, Total: inicios.Count(f => f.Year == mes.Year && f.Month == mes.Month))).ToList();
        return Armar(
            inicios.Count == 0 ? "No hay eventos publicados en los próximos doce meses."
                : $"Hay {TextoEnEspanol.Plural(inicios.Count, "evento publicado", "eventos publicados")} que empiezan en los próximos doce meses.",
            "Eventos por mes", "Agenda pública (eventos publicados)", "Eventos publicados que empiezan en los próximos doce meses",
            FiltrosBase("Próximos doce meses"), ["Mes", "Eventos"],
            porMes.Select(m => new[] { $"{Mayuscula(Meses[m.Mes.Month - 1])} de {N(m.Mes.Year)}", N(m.Total) }),
            porMes.Select(_ => (string?)"/agenda"));
    }
}
