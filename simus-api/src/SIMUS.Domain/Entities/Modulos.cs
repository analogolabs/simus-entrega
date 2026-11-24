namespace SIMUS.Domain.Entities;

/// <summary>
/// Los módulos del Ecosistema, con el nombre con el que un registro se identifica en todo el sistema.
/// </summary>
/// <remarks>
/// <para>
/// <b>ESTA LISTA EXISTE PORQUE NO EXISTIA, y esa fue exactamente la avería.</b> Hasta el 21 de
/// septiembre de 2026 el módulo de un registro se escribía como una cadena suelta allí donde hiciera
/// falta: la auditoría contó <b>152 literales</b> repartidos por el código, sin nada que obligara a
/// dos de ellos a coincidir. Y no coincidían. Diecisiete tablas guardaban el módulo en una columna
/// llamada <c>ModuloId</c> y cinco en una llamada <c>Dominio</c>; unas decían <c>festivales</c> y
/// otras <c>festival</c>, unas <c>organizaciones</c> y otras <c>organizacion</c>, y el catálogo
/// editorial era <c>editorial</c> en un sitio y <c>catalogo-editorial</c> en otro.
/// </para>
/// <para>
/// <b>LO QUE ESO ROMPIA, MEDIDO.</b> El cruce entre la procedencia de un registro y su historial de
/// revisión —la consulta que contesta «de dónde vino esto y qué se hizo con ello»— devolvía CERO
/// filas sobre 1 050 de procedencia y 38 de historial. No un resultado parcial: ninguno. La regla
/// más transversal del proyecto, la de que todo registro guarda de dónde viene, quedaba sin poder
/// contestarse porque las dos mitades de la historia estaban escritas en vocabularios distintos.
/// </para>
/// <para>
/// <b>POR QUE PLURAL Y CON GUION MEDIO, y no al revés.</b> No es preferencia: el valor viaja como
/// segmento de URL en tres rutas —<c>/admin/importaciones/{dominio}</c>,
/// <c>/admin/borradores/{dominio}</c> y <c>/admin/data/records/{moduleId}</c>—, y en un camino se
/// escribe en minúsculas con guion medio. Además la Importación Asistida y los módulos de la consola
/// ya usaban esa forma, y la lista de la consola está atada por prueba al fichero de navegación, de
/// modo que no podía moverse. Lo que se movió fueron los tres valores con guion bajo que introdujo
/// la consolidación del 18 de septiembre —<c>versiones_festival</c>, <c>ediciones_festival</c> y
/// <c>ediciones_mercado</c>—: la disidencia más reciente era la nuestra.
/// </para>
/// <para>
/// <b>NO CONFUNDIR CON LOS MODULOS DE LA CONSOLA.</b> <c>ModulosDeLaConsola</c> son las secciones de
/// la barra izquierda y la unidad de permiso por cuenta; sus identificadores son los de la pantalla.
/// Esta lista dice de qué ES un registro. Cinco valores viven en los dos mundos y ahí el
/// identificador es literalmente el mismo, a propósito.
/// </para>
/// </remarks>
public static class Modulos
{
    /// <summary>El Festival, como registro permanente.</summary>
    public const string Festivales = "festivales";

    /// <summary>Cada realización anual de un Festival.</summary>
    public const string EdicionesDeFestival = "ediciones-festival";

    /// <summary>El Mercado Musical, como registro permanente.</summary>
    public const string Mercados = "mercados";

    /// <summary>Cada realización de un Mercado Musical.</summary>
    public const string EdicionesDeMercado = "ediciones-mercado";

    /// <summary>El taller de lutería, como registro permanente.</summary>
    public const string Talleres = "talleres";

    /// <summary>
    /// La agenda de citas de una edición de Mercado, primera herramienta del apartado «Herramientas» (docs/referencia/26-agenda-de-citas-y-mercados.md).
    /// </summary>
    /// <remarks>
    /// <b>UN MODULO POR ENTIDAD.</b> El registro de cambios identifica al dueño por (módulo, identificador):
    /// la agenda 1, el participante 1 y la cita 1 son tres registros distintos, y con un solo módulo sus
    /// historias se mezclarían. Son tres valores, no uno.
    /// </remarks>
    public const string AgendasDeCitas = "agendas-de-citas";

    /// <summary>Quien participa en una agenda de citas: un artista inscrito o un comprador invitado.</summary>
    public const string ParticipantesDeCitas = "participantes-de-citas";

    /// <summary>Una cita entre dos participantes de una agenda.</summary>
    public const string CitasDeAgenda = "citas-de-agenda";

    /// <summary>El espacio para música en vivo, como registro permanente (docs/referencia/25-modulos-restantes.md).</summary>
    public const string Espacios = "espacios";
    /// <summary>La red o el centro de documentación, como registro permanente.</summary>
    public const string Redes = "redes";

    /// <summary>La organización que registra y administra procesos.</summary>
    public const string Organizaciones = "organizaciones";

    /// <summary>Una noticia del sitio.</summary>
    public const string Noticias = "noticias";

    /// <summary>Un evento de la agenda.</summary>
    public const string Agenda = "agenda";

    /// <summary>Una publicación del Catálogo Editorial.</summary>
    public const string CatalogoEditorial = "catalogo-editorial";

    /// <summary>Una cuenta de la consola y los módulos que se le conceden.</summary>
    public const string Usuarios = "usuarios";

    /// <summary>La nómina del equipo que se muestra en el sitio: un solo registro, «nomina».</summary>
    public const string EquipoWeb = "equipo-web";

    /// <summary>Un archivo del Banco de archivos (hoy, el texto alternativo de una imagen: D5-06).</summary>
    public const string Archivos = "archivos";

    /// <summary>
    /// Una propuesta de cambio de una organización sobre un Festival ya publicado.
    /// </summary>
    /// <remarks>
    /// ES UN REGISTRO PROPIO Y NO UN EVENTO. Tiene su fila, su identificador y su ciclo, y por eso
    /// aparece aquí: el historial y los avisos la nombran como nombran a cualquier otro registro.
    /// </remarks>
    public const string PropuestasDeCambioDeFestival = "propuestas-cambio-festival";

    /// <summary>
    /// Las solicitudes para administrar un Festival histórico.
    /// </summary>
    /// <remarks>
    /// NO ESTÁ EN <see cref="Todos"/>: no es un registro del ecosistema, es un trámite. Se declara
    /// aquí porque sus soportes cuelgan de <c>dbo.ArchivosDeRegistro</c> con este identificador
    /// (V20261106_09), el mismo que ya usan sus notificaciones.
    /// </remarks>
    public const string ReclamacionesDeAdministracion = "reclamaciones-administracion";

    /// <summary>
    /// El perfil público de una PERSONA (ME): su nombre artístico, su biografía, su portafolio. El registro es el
    /// identificador de la cuenta.
    /// </summary>
    /// <remarks>
    /// NO ESTÁ EN <see cref="Todos"/>: no es un proceso del ecosistema ni tiene organización responsable. Se declara
    /// aquí para que el registro de cambios lo nombre como a cualquier otro registro; su historial lo lee solo la
    /// propia persona (y la consola con Auditoría).
    /// </remarks>
    public const string PerfilesPublicosDePersona = "perfiles-publicos-persona";

    /// <summary>Todos, para validar y para recorrer.</summary>
    public static readonly string[] Todos =
    [
        Festivales,
        EdicionesDeFestival,
        Mercados,
        EdicionesDeMercado,
        Talleres,
        Espacios,
        Redes,
        Organizaciones,
        Noticias,
        Agenda,
        CatalogoEditorial,
        PropuestasDeCambioDeFestival,
    ];

    /// <summary>
    /// Los que clasifican sus registros con los vocabularios controlados.
    /// </summary>
    /// <remarks>
    /// Es el subconjunto que admiten las restricciones <c>CHECK</c> de las ocho tablas de relación.
    /// Se declara aparte porque no todo módulo se clasifica: una noticia no tiene prácticas
    /// musicales propias, las hereda del proceso del que habla.
    /// </remarks>
    public static readonly string[] Clasificables =
    [
        Festivales,
        EdicionesDeFestival,
        EdicionesDeMercado,
    ];

    /// <summary>Si ese texto es uno de los módulos, sin admitir variantes.</summary>
    public static bool Existe(string? modulo) =>
        !string.IsNullOrWhiteSpace(modulo) && Array.Exists(Todos, m => string.Equals(m, modulo, StringComparison.Ordinal));
}
