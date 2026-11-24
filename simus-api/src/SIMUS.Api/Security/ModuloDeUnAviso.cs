using SIMUS.Domain.Entities;

namespace SIMUS.Api.Security;

/// <summary>
/// A qué módulo de la consola pertenece cada aviso del buzón institucional.
/// </summary>
/// <remarks>
/// <para>
/// <b>EL BUZON TIENE QUE DECIR LO MISMO QUE LA BARRA.</b> Lo pidió la dirección de producto el 15 de
/// septiembre de 2026, al fijar los permisos por cuenta: «es importante que el apartado de
/// notificaciones por supuesto también corresponda con los módulos que tienen activados en cada
/// caso». Una consola que oculta «Catálogo Editorial» y sigue avisando de lo que pasa dentro
/// enseña trabajo al que no se puede entrar: el aviso lleva a una puerta cerrada con 403.
/// </para>
/// <para>
/// <b>SE MAPEA AL MODULO QUE HAY QUE TENER PARA ACTUAR.</b> Un festival que llega a revisión se
/// abre desde «Solicitudes y revisiones», pero decidirlo exige «Festivales y ediciones»
/// (ecosistema) desde el 5 de noviembre de 2026: antes la bandeja dejaba decidir sobre
/// módulos no concedidos. Un aviso que lleva a una decisión que la cuenta no puede tomar es un
/// enlace a un 403, así que el circuito del Festival se mapea a «ecosistema».
/// </para>
/// <para>
/// <b>LO DESCONOCIDO SE MUESTRA.</b> Un aviso sin módulo, o con uno que esta tabla no conoce, se
/// entrega igual. La alternativa —callar lo que no se sabe clasificar— convierte cada aviso nuevo
/// que alguien escriba mal en un mensaje que nadie recibe y que nadie echa de menos, que es
/// exactamente el fallo que no se detecta nunca.
/// </para>
/// </remarks>
public static class ModuloDeUnAviso
{
    private static readonly Dictionary<string, string> Correspondencias = new(StringComparer.OrdinalIgnoreCase)
    {
        // El circuito de revisión del Festival se ve en Solicitudes, pero se decide con el
        // Ecosistema: sin ese módulo, el servidor responde 403 a cada decisión.
        [Modulos.Festivales] = "ecosistema",
        [Modulos.EdicionesDeFestival] = "ecosistema",
        [Modulos.PropuestasDeCambioDeFestival] = "ecosistema",
        ["reclamaciones-administracion"] = "ecosistema",

        // MERCADOS FALTABA, Y ESO ERA UN AGUJERO. Un aviso cuyo módulo no está en esta tabla se
        // entrega SIEMPRE —es la regla deliberada para no callar lo que no se sabe clasificar—, de
        // modo que los avisos de Mercados llegaban a cuentas que no tienen el módulo activado. La
        // auditoría encontró trece ya escritos en la base. Es
        // exactamente lo contrario de lo que se pidió el 15 de septiembre: «es importante que el
        // apartado de notificaciones por supuesto también corresponda con los módulos que tienen
        // activados en cada caso».
        [Modulos.Mercados] = "mercados",
        [Modulos.EdicionesDeMercado] = "mercados",
        [Modulos.Talleres] = "talleres",
        [Modulos.Espacios] = "espacios",
        [Modulos.Redes] = "redes",

        // Estos sí se trabajan en su propio módulo.
        [Modulos.Organizaciones] = "organizaciones",
        [Modulos.CatalogoEditorial] = "catalogo-editorial",
        [Modulos.Agenda] = "agenda",
        [Modulos.Noticias] = "noticias",
        ["banco-de-archivos"] = "banco-de-archivos",
        ["boletin"] = "boletin",
        ["usuarios"] = "usuarios",
    };

    /// <summary>
    /// El módulo de consola que hay que tener abierto para atender ese aviso, o <c>null</c> si el
    /// aviso no pertenece a ninguno y por tanto se entrega siempre.
    /// </summary>
    public static string? ConsolaDe(string? moduloDelAviso) =>
        !string.IsNullOrWhiteSpace(moduloDelAviso)
        && Correspondencias.TryGetValue(moduloDelAviso.Trim(), out var modulo)
            ? modulo
            : null;

    /// <summary>
    /// Los identificadores de aviso que esa cuenta NO debe recibir, dados los módulos que tiene.
    /// </summary>
    /// <remarks>
    /// Se devuelve la lista de lo vetado, y no la de lo permitido, porque es la que sabe filtrar la
    /// consulta sin dejar fuera lo desconocido: <c>ModuloId is null or not in (vetados)</c>.
    /// </remarks>
    public static List<string> VetadosPara(IReadOnlyCollection<string> modulosDeLaCuenta)
    {
        ArgumentNullException.ThrowIfNull(modulosDeLaCuenta);
        var tiene = new HashSet<string>(modulosDeLaCuenta, StringComparer.OrdinalIgnoreCase);
        return Correspondencias
            .Where(par => !tiene.Contains(par.Value))
            .Select(par => par.Key)
            .ToList();
    }
}
