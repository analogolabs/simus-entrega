using SIMUS.Contracts;

namespace SIMUS.Api.ConsultaAbierta;

public enum TipoDeCampo { Texto, Numero, Fecha, Lugar, Catalogo }

/// <summary>Un campo público de una entidad. Lo que no esté declarado aquí no se puede pedir, filtrar ni mostrar.</summary>
/// <param name="Catalogo">departamento · municipio · tipo · practica · territorio · organizacion: el valor se resuelve contra ese catálogo.</param>
public sealed record CampoSemantico(
    string Nombre, string Rotulo, TipoDeCampo Tipo, string Descripcion,
    string? Catalogo = null, bool Multiple = false, bool Agrupable = true, bool Agregable = false);

/// <summary>Una entidad pública consultable.</summary>
/// <param name="CampoNombre">El campo que se muestra como nombre y que enlaza a la ficha.</param>
/// <param name="Columnas">Los campos que se listan por omisión.</param>
/// <param name="Directorio">Ruta pública donde se listan; los grupos enlazan allí con el filtro como parámetro de la URL.</param>
public sealed record EntidadSemantica(
    string Id, string Rotulo, string Plural, string Descripcion, string CampoNombre,
    IReadOnlyList<CampoSemantico> Campos, IReadOnlyList<string> Columnas, string Fuente, string? Directorio)
{
    public CampoSemantico? Campo(string? nombre) => Campos.FirstOrDefault(c => c.Nombre == nombre);
}

/// <summary>
/// LA CAPA SEMÁNTICA PÚBLICA: el catálogo declarativo de lo que se puede preguntar.
/// </summary>
/// <remarks>
/// <para>
/// <b>SOLO REGISTROS PUBLICADOS Y NADA PERSONAL.</b> Cada entidad se carga con las mismas lecturas públicas del portal
/// (<see cref="CargadorDeEntidades"/>). No hay entidad de personas, de cuentas, de citas ni de revisión; no hay campo de contacto,
/// correo, teléfono ni de organizador. Añadir una entidad o un campo exige tocar este archivo y su prueba.
/// </para>
/// <para>
/// <b>EL ÁMBITO NO ESTÁ AQUÍ.</b> Es «público» y lo fija el endpoint; ni la pregunta ni el modelo pueden cambiarlo.
/// </para>
/// </remarks>
public static class CatalogoSemantico
{
    private static CampoSemantico Lugar(string nombre, string rotulo, string catalogo) =>
        new(nombre, rotulo, TipoDeCampo.Lugar, $"{rotulo} de la sede principal (catálogo DIVIPOLA).", catalogo);

    private static readonly CampoSemantico Departamento = Lugar("departamento", "Departamento", "departamento");
    private static readonly CampoSemantico Municipio = Lugar("municipio", "Municipio", "municipio");
    private static readonly CampoSemantico Organizacion =
        new("organizacion", "Organización", TipoDeCampo.Catalogo, "Organización con ficha pública que lo impulsa.", "organizacion");

    public static readonly IReadOnlyList<EntidadSemantica> Entidades =
    [
        new("procesos", "proceso", "procesos", "Festivales, mercados musicales, talleres de lutería, espacios para música en vivo y redes publicados; el campo «tipo» dice cuál es.",
            "nombre",
            [
                new("nombre", "Nombre", TipoDeCampo.Texto, "Nombre público.", Agrupable: false),
                new("tipo", "Tipo de proceso", TipoDeCampo.Catalogo, "festivales, mercados, talleres, espacios o redes.", "tipo"),
                Departamento, Municipio, Organizacion,
            ],
            ["nombre", "tipo", "municipio", "departamento"], "Procesos publicados del ecosistema", null),
        new("festivales", "festival", "festivales", "Festivales de música publicados, con sus prácticas musicales y territorios sonoros.",
            "nombre",
            [
                new("nombre", "Nombre", TipoDeCampo.Texto, "Nombre público.", Agrupable: false),
                Departamento, Municipio, Organizacion,
                new("practica", "Práctica musical", TipoDeCampo.Catalogo, "Prácticas musicales que declara (puede tener varias).", "practica", Multiple: true),
                new("territorio", "Territorio sonoro", TipoDeCampo.Catalogo, "Territorios sonoros que recoge (puede tener varios).", "territorio", Multiple: true),
                new("periodicidad", "Periodicidad", TipoDeCampo.Texto, "Cada cuánto se realiza (anual, bienal…)."),
            ],
            ["nombre", "municipio", "departamento"], "Festivales publicados (la misma lectura del directorio)", "/ecosistema/festivales"),
        new("eventos", "evento", "eventos", "Eventos publicados de la agenda pública.",
            "titulo",
            [
                new("titulo", "Evento", TipoDeCampo.Texto, "Título del evento.", Agrupable: false),
                new("fecha", "Fecha de inicio", TipoDeCampo.Fecha, "Fecha de inicio (AAAA-MM-DD, o «hoy»).", Agrupable: false),
                new("mes", "Mes", TipoDeCampo.Numero, "Mes de inicio, de 1 a 12."),
                new("anio", "Año", TipoDeCampo.Numero, "Año de inicio."),
                Departamento, Municipio,
                new("modalidad", "Modalidad", TipoDeCampo.Texto, "presencial, virtual o híbrido."),
                new("marco", "Enmarcado en", TipoDeCampo.Catalogo, "Tipo de proceso que enmarca el evento (festivales, mercados…).", "tipo"),
            ],
            ["fecha", "titulo", "municipio", "departamento"], "Agenda pública (eventos publicados)", "/agenda"),
        new("noticias", "noticia", "noticias", "Noticias publicadas del portal.",
            "titulo",
            [
                new("titulo", "Noticia", TipoDeCampo.Texto, "Titular.", Agrupable: false),
                new("fecha", "Fecha", TipoDeCampo.Fecha, "Fecha de publicación (AAAA-MM-DD, o «hoy»).", Agrupable: false),
                new("mes", "Mes", TipoDeCampo.Numero, "Mes de publicación, de 1 a 12."),
                new("anio", "Año", TipoDeCampo.Numero, "Año de publicación."),
            ],
            ["fecha", "titulo"], "Noticias publicadas", "/noticias"),
        new("organizaciones", "organización", "organizaciones", "Organizaciones con ficha pública y cuántos procesos publicados tienen.",
            "nombre",
            [
                new("nombre", "Nombre", TipoDeCampo.Texto, "Nombre público.", Agrupable: false),
                new("procesos", "Procesos publicados", TipoDeCampo.Numero, "Cuántos procesos publicados tiene.", Agrupable: false, Agregable: true),
            ],
            ["nombre", "procesos"], "Organizaciones con ficha pública", "/ecosistema/organizaciones"),
        new("practicas", "práctica musical", "prácticas musicales", "Catálogo de prácticas musicales y cuántos festivales publicados las declaran.",
            "nombre",
            [
                new("nombre", "Nombre", TipoDeCampo.Texto, "Nombre de la práctica.", Agrupable: false),
                new("festivales", "Festivales", TipoDeCampo.Numero, "Festivales publicados que la declaran.", Agrupable: false, Agregable: true),
            ],
            ["nombre", "festivales"], "Catálogo de prácticas musicales", "/ecosistema/practicas-musicales"),
        new("territorios", "territorio sonoro", "territorios sonoros", "Catálogo de territorios sonoros y cuántos festivales publicados los recogen.",
            "nombre",
            [
                new("nombre", "Nombre", TipoDeCampo.Texto, "Nombre del territorio.", Agrupable: false),
                new("festivales", "Festivales", TipoDeCampo.Numero, "Festivales publicados que lo recogen.", Agrupable: false, Agregable: true),
            ],
            ["nombre", "festivales"], "Catálogo de territorios sonoros", "/ecosistema/festivales"),
    ];

    public static EntidadSemantica? Buscar(string? id) => Entidades.FirstOrDefault(e => e.Id == id);

    public static readonly string[] Operadores = ["eq", "neq", "in", "contiene", "gt", "gte", "lt", "lte"];
    public static readonly string[] Funciones = ["count", "sum", "avg", "min", "max"];

    public const int MaximoFiltros = 6;
    public const int MaximoAgrupaciones = 2;
    public const int LimitePorOmision = 20;
    public const int LimiteMaximo = 50;
    public const int MaximoValor = 80;

    public static IReadOnlyList<EntidadSemanticaDto> Describir() => Entidades.Select(e => new EntidadSemanticaDto(
        e.Id, e.Rotulo, e.Descripcion,
        e.Campos.Select(c => new CampoSemanticoDto(c.Nombre, c.Rotulo, c.Tipo.ToString().ToLowerInvariant(), c.Agrupable, c.Agregable)).ToList())).ToList();
}
