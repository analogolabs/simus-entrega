namespace SIMUS.Api.Security;

/// <summary>
/// Los módulos del Espacio de Gestión Administrativa, que son la unidad de permiso.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR CUENTA Y NO POR ROL, y esa fue la decisión.</b> quedó fijado el 15 de
/// septiembre de 2026: «los permisos por gestor se definen por cuenta, es decir, debería haber algún
/// apartado donde yo pueda seleccionar cuál de los módulos que actualmente aparece en la izquierda
/// se le activan». Un permiso por rol obliga a inventar un rol nuevo cada vez que una persona
/// necesita una combinación distinta, y se acaba con roles llamados «coordinador-pero-sin-catálogo».
/// </para>
/// <para>
/// <b>LA UNIDAD ES EL MODULO QUE LA PERSONA VE.</b> No se inventa una taxonomía paralela de
/// permisos: si en la barra izquierda pone «Catálogo Editorial», eso es lo que se activa o se
/// desactiva, y con el mismo identificador. Por eso esta lista tiene que coincidir, una a una, con
/// las secciones de <c>navegacion-administrativa.ts</c>, y una prueba lo comprueba leyendo el
/// fichero: dos listas que describen lo mismo divergen en cuanto nadie las mira.
/// </para>
/// <para>
/// <b>DOS VIENEN SIEMPRE ACTIVADOS</b> y no se pueden quitar. Los nombró la dirección de producto:
/// Resumen operativo y Solicitudes y revisiones. Sin ellos una cuenta entra a una consola vacía y
/// no tiene dónde ver lo que espera una decisión, que es el trabajo que la consola existe para
/// hacer.
/// </para>
/// <para>
/// <b>EL WEBMASTER LOS TIENE TODOS, SIEMPRE.</b> No es un privilegio de comodidad: si el permiso de
/// entrar a «Usuarios y roles» se pudiera quitar a todo el mundo, la última cuenta que lo tuviera
/// podría dejar al Programa sin forma de conceder permisos a nadie, y eso no se arregla desde la
/// interfaz. La misma razón por la que existe el candado del último webmaster.
/// </para>
/// </remarks>
public static class ModulosDeLaConsola
{
    /// <summary>Resumen operativo. Siempre activado.</summary>
    public const string Monitor = "monitor";

    /// <summary>Solicitudes y revisiones. Siempre activado.</summary>
    public const string Solicitudes = "solicitudes";

    /// <summary>
    /// Los que toda cuenta de consola tiene, se le concedan o no.
    /// </summary>
    public static readonly string[] SiempreActivados = [Monitor, Solicitudes];

    /// <summary>
    /// Todos los módulos, en el mismo orden en que aparecen en la barra izquierda.
    /// </summary>
    /// <remarks>
    /// EL ORDEN NO ES DECORATIVO: la pantalla que los ofrece los lista así, y una lista de permisos
    /// ordenada distinto de la barra que describe obliga a buscar cada módulo dos veces.
    /// </remarks>
    public static readonly string[] Todos =
    [
        Monitor,
        Solicitudes,
        "ecosistema",
        "mercados",
        "talleres",
        "espacios",
        "redes",
        "organizaciones",
        "catalogo-editorial",
        "agenda",
        "noticias",
        "categorias",
        "banco-de-archivos",
        // «celebra»: el micrositio «Celebra la Música». Apartado propio y permiso propio (antes se editaba con
        // «categorias»): solo lo abre quien administra a las personas a las que se les concede.
        "celebra",
        // «galeria» salio de la barra —no tenia panel ni circuito— y con
        // ella de aqui: el catalogo describe exactamente la barra, y la prueba lo exige.
        "gestion-sitio",
        "boletin",
        "analisis",
        "auditoria",
        "usuarios",
        "sistema",
    ];

    /// <summary>
    /// Los que solo abre el rol webmaster, se le concedan o no a otra cuenta.
    /// </summary>
    /// <remarks>
    /// <b>LA MISMA REGLA QUE LA BARRA.</b> «Usuarios y roles» y «Salud del sistema» llevan
    /// <c>rolesPermitidos: ['webmaster']</c> en <c>navegacion-administrativa.ts</c>: un gestor no los
    /// ve nunca. Pero la ficha de la cuenta los ofrecía como casillas y la lista contaba «16 de 16»
    /// cuando la barra de esa cuenta tenía 14: el webmaster creía conceder lo que el rol nunca
    /// permite. Ahora no se conceden, no se cuentan y el servidor no los abre a otro rol.
    /// </remarks>
    public static readonly string[] SoloWebmaster = ["usuarios", "sistema"];

    /// <summary>Los módulos que puede llegar a abrir una cuenta con ese rol.</summary>
    public static IReadOnlyList<string> AlAlcanceDe(bool esWebmaster) =>
        esWebmaster ? Todos : Todos.Where(m => !EsSoloWebmaster(m)).ToArray();

    /// <summary>Si ese módulo es de los que solo abre un webmaster.</summary>
    public static bool EsSoloWebmaster(string? codigo) =>
        !string.IsNullOrWhiteSpace(codigo)
        && Array.Exists(SoloWebmaster, m => string.Equals(m, codigo.Trim(), StringComparison.OrdinalIgnoreCase));

    /// <summary>Si ese código corresponde a un módulo real de la consola.</summary>
    public static bool Existe(string? codigo) =>
        !string.IsNullOrWhiteSpace(codigo)
        && Array.Exists(Todos, m => string.Equals(m, codigo.Trim(), StringComparison.OrdinalIgnoreCase));

    /// <summary>Si ese módulo lo tiene toda cuenta, se le conceda o no.</summary>
    public static bool EsSiempreActivado(string? codigo) =>
        !string.IsNullOrWhiteSpace(codigo)
        && Array.Exists(SiempreActivados, m => string.Equals(m, codigo.Trim(), StringComparison.OrdinalIgnoreCase));
}
