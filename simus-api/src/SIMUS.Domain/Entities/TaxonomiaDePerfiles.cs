namespace SIMUS.Domain.Entities;

/// <summary>Un valor inicial de la taxonomía de perfiles: código estable, nombre y su correspondencia con Soy Cultura.</summary>
/// <param name="Codigo">Estable: nunca se renombra ni se reutiliza (los perfiles lo guardan).</param>
/// <param name="GrupoSoyCultura">Grupo del Registro Único Nacional de Agentes Culturales al que se corresponde: <c>creador</c> o <c>gestor</c> (Ley 397 de 1997, arts. 27 y 28), o <c>otro</c>.</param>
/// <param name="CodigoDePadre">Solo roles: el código de la categoría a la que pertenece como subcategoría (decisión 135); nulo es una categoría o un valor sin jerarquía.</param>
public sealed record ValorDeTaxonomia(string Codigo, string Nombre, string? GrupoSoyCultura = null, string? Fuente = null, string? CodigoDePadre = null);

/// <summary>
/// La taxonomía CONTROLADA con la que una persona se clasifica y con la que otras la buscan (docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).
/// </summary>
/// <remarks>
/// <para>
/// <b>VIVE EN LA TABLA <c>ValoresDeTaxonomiaDePerfiles</c> (decisión 133).</b> Se administra desde el Catálogo de la
/// consola. Lo que queda aquí son los nombres de las dimensiones, los máximos y los <b>valores iniciales</b> con los que
/// se siembra la tabla (en SQL Server los siembra <c>V20261118_10</c>; en SQLite, el arranque). Nada del código lee estas
/// listas para validar o mostrar: lo hace de la tabla.
/// </para>
/// <para>
/// <b>REUTILIZA, NO DUPLICA.</b> Las prácticas musicales siguen siendo las del catálogo <c>PracticasMusicales</c>; los
/// instrumentos son las clases de Hornbostel-Sachs de <c>FamiliasDeInstrumentos</c> (más «voz»); los servicios de
/// reparación reutilizan el vocabulario de <c>ServiciosDeTaller</c> bajo un solo servicio de búsqueda. Aquí solo
/// están los vocabularios que no existían: roles, servicios que se buscan e instrumentos.
/// </para>
/// <para>
/// <b>MAPEO A SOY CULTURA.</b> El formulario vigente de Soy Cultura no es público: la fuente es la Ley 2621 de 2026
/// (art. 8, agentes del sector) y la Ley 397 de 1997 (arts. 27-29). El grupo se declara; el código de Soy Cultura queda
/// por confirmar con el Ministerio (docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).
/// </para>
/// </remarks>
public static class TaxonomiaDePerfiles
{
    public const string DimensionRol = "rol";
    public const string DimensionServicio = "servicio";
    public const string DimensionInstrumento = "instrumento";
    public const string DimensionTerritorio = "territorio";

    /// <summary>Lo que una persona puede elegir en roles: se cuentan las subcategorías (y las categorías sin hijas) elegidas.</summary>
    public const int MaximoDeRoles = 6;
    public const int MaximoDeServicios = 8;
    public const int MaximoDeInstrumentos = 8;
    public const int MaximoDeTerritorios = 10;

    private const string FuenteDeCategoria =
        "Propuesta SIMUS sobre los grupos de la Ley 397 de 1997 (arts. 27 y 28) y la Ley 2621 de 2026 (art. 8); pendiente de confirmar con el Ministerio";

    /// <summary>
    /// Los roles en DOS niveles (decisión 135): la <b>categoría</b> agrupa y la <b>subcategoría</b> es lo que la persona elige.
    /// Una categoría sin subcategorías (<c>gestor</c>) se elige a sí misma. Los códigos de siempre se conservan; las
    /// categorías son valores nuevos. La estructura es una propuesta: no es el catálogo oficial de Soy Cultura.
    /// </summary>
    public static readonly IReadOnlyList<ValorDeTaxonomia> RolesIniciales =
    [
        new("creacion-e-interpretacion", "Creación e interpretación", "creador", FuenteDeCategoria),
        new("interprete", "Intérprete o instrumentista", "creador", "Ley 2621 de 2026, art. 8", "creacion-e-interpretacion"),
        new("cantante", "Cantante o cantautor(a)", "creador", "Ley 2621 de 2026, art. 8", "creacion-e-interpretacion"),
        new("compositor", "Compositor(a) o arreglista", "creador", "Ley 2621 de 2026, art. 8", "creacion-e-interpretacion"),
        new("director", "Director(a) de agrupación u orquesta", "creador", "Ley 2621 de 2026, art. 8", "creacion-e-interpretacion"),
        new("cultor", "Cultor(a) o portador(a) de tradición", "creador", "Propuesta SIMUS", "creacion-e-interpretacion"),
        new("formacion-e-investigacion", "Formación e investigación", "otro", FuenteDeCategoria),
        new("docente", "Docente o formador(a) de música", "otro", "Ley 2621 de 2026, art. 8", "formacion-e-investigacion"),
        new("investigador", "Investigador(a) o sabedor(a)", "otro", "Ley 2621 de 2026, art. 8", "formacion-e-investigacion"),
        new("tecnica-luteria-y-produccion", "Técnica, lutería y producción", "otro", FuenteDeCategoria),
        new("luthier", "Lutier o constructor(a) de instrumentos", "creador", "Propuesta SIMUS; docs/referencia/27-fuentes-de-luteria.md", "tecnica-luteria-y-produccion"),
        new("sonidista", "Sonidista o técnico(a) de audio", "otro", "Ley 2621 de 2026, art. 8", "tecnica-luteria-y-produccion"),
        new("productor", "Productor(a) musical o fonográfico", "otro", "Ley 2621 de 2026, art. 8", "tecnica-luteria-y-produccion"),
        new("gestor", "Gestor(a) cultural", "gestor", "Ley 397 de 1997, art. 28"),
    ];

    public static readonly IReadOnlyList<ValorDeTaxonomia> ServiciosIniciales =
    [
        new("clases", "Clases y formación musical"),
        new("presentaciones", "Presentaciones en vivo"),
        new("grabacion", "Grabación y producción musical"),
        new("composicion", "Composición y arreglos por encargo"),
        new("luteria", "Construcción, reparación y restauración de instrumentos"),
        new("sonido", "Sonido e ingeniería de audio"),
        new("gestion", "Gestión y producción de eventos"),
        new("direccion", "Dirección de agrupaciones o procesos"),
        new("investigacion", "Investigación y documentación"),
        new("asesoria", "Asesoría y consultoría"),
    ];

    public static readonly IReadOnlyList<ValorDeTaxonomia> InstrumentosIniciales =
    [
        new("cordofonos", "Cuerdas (cordófonos)", Fuente: "Hornbostel-Sachs; FamiliasDeInstrumentos"),
        new("aerofonos", "Vientos (aerófonos)", Fuente: "Hornbostel-Sachs; FamiliasDeInstrumentos"),
        new("membranofonos", "Percusión de membrana (membranófonos)", Fuente: "Hornbostel-Sachs; FamiliasDeInstrumentos"),
        new("idiofonos", "Percusión de sonido propio (idiófonos)", Fuente: "Hornbostel-Sachs; FamiliasDeInstrumentos"),
        new("electrofonos", "Instrumentos electrónicos (electrófonos)", Fuente: "Hornbostel-Sachs; FamiliasDeInstrumentos"),
        new("voz", "Voz", Fuente: "Propuesta SIMUS"),
    ];

    /// <summary>Las dimensiones cuyos valores se administran en la tabla (el territorio son los departamentos de DIVIPOLA).</summary>
    public static readonly IReadOnlyList<string> DimensionesAdministrables = [DimensionRol, DimensionServicio, DimensionInstrumento];

    public static IReadOnlyList<ValorDeTaxonomia> Iniciales(string dimension) => dimension switch
    {
        DimensionRol => RolesIniciales,
        DimensionServicio => ServiciosIniciales,
        DimensionInstrumento => InstrumentosIniciales,
        _ => [],
    };

    public static int Maximo(string dimension) => dimension switch
    {
        DimensionRol => MaximoDeRoles,
        DimensionServicio => MaximoDeServicios,
        DimensionInstrumento => MaximoDeInstrumentos,
        _ => MaximoDeTerritorios,
    };

}

/// <summary>Un valor de la taxonomía de perfiles tal como vive en la tabla administrable (decisión 133).</summary>
public sealed class ValorDeTaxonomiaDePerfilesRow
{
    public int Id { get; set; }
    /// <summary><c>rol</c>, <c>servicio</c> o <c>instrumento</c>.</summary>
    public string Dimension { get; set; } = string.Empty;
    /// <summary>Estable: nunca se renombra ni se reutiliza (los perfiles lo guardan).</summary>
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    /// <summary><c>creador</c>, <c>gestor</c> u <c>otro</c>; solo tiene sentido en los roles.</summary>
    public string? GrupoSoyCultura { get; set; }
    public string? Fuente { get; set; }
    /// <summary>Desactivado: deja de ofrecerse, pero los perfiles que ya lo usan lo conservan.</summary>
    public bool Activo { get; set; } = true;
    public int OrdenVisualizacion { get; set; } = 1;
    /// <summary>Solo roles: la categoría a la que pertenece. Nulo: es una categoría (o un valor sin jerarquía). Dos niveles como máximo (decisión 135).</summary>
    public int? IdPadre { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaActualizacion { get; set; }
}
