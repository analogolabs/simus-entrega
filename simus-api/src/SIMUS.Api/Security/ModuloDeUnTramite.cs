using System.Security.Claims;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Security;

/// <summary>
/// A qué módulo de la consola pertenece un trámite de la bandeja que llega con su propio
/// <c>ModuloId</c>: vinculaciones, retiros, posibles duplicados y alertas de calidad.
/// </summary>
/// <remarks>
/// <para>
/// <b>LA BANDEJA NO ES UNA PUERTA TRASERA.</b> «Solicitudes y revisiones» la tiene toda
/// cuenta de consola, pero decidir sobre un trámite es actuar sobre el registro de un módulo: un
/// retiro de un Mercado publicado lo despublica. Quien no tiene «Mercados» no puede hacerlo desde la
/// sección, y tampoco desde la bandeja.
/// </para>
/// <para>
/// <b>ESTOS TRÁMITES COMPARTEN RUTA</b> (<c>/admin/solicitudes-de-vinculacion</c>,
/// <c>/admin/duplicates</c>, <c>/admin/data-quality/flags</c>) para todos los módulos, así que el
/// cierre no se puede poner en el grupo como hace <see cref="ExigeModuloExtensiones"/>: se mira fila
/// a fila con esta tabla. Las colas con ruta propia (eventos, festivales, ediciones, propuestas,
/// reclamaciones) se cierran en su grupo.
/// </para>
/// <para>
/// <b>LO DESCONOCIDO QUEDA EN SOLICITUDES</b>, que toda cuenta tiene: es la misma regla que el
/// buzón (<see cref="ModuloDeUnAviso"/>). Esconder lo que no se sabe clasificar haría trabajo que
/// nadie ve.
/// </para>
/// </remarks>
public static class ModuloDeUnTramite
{
    private const string Ecosistema = "ecosistema";

    private static readonly Dictionary<string, string> Correspondencias = new(StringComparer.OrdinalIgnoreCase)
    {
        // Festivales: vinculación ('festivals'), retiro y el resto de su circuito.
        ["festivals"] = Ecosistema,
        ["festivales_retiro"] = Ecosistema,
        [Modulos.Festivales] = Ecosistema,
        [Modulos.EdicionesDeFestival] = Ecosistema,
        [Modulos.PropuestasDeCambioDeFestival] = Ecosistema,

        ["mercados_retiro"] = "mercados",
        [Modulos.Mercados] = "mercados",
        [Modulos.EdicionesDeMercado] = "mercados",
        [Modulos.Talleres] = "talleres",
        [Modulos.Espacios] = "espacios",
        [Modulos.Redes] = "redes",

        [Modulos.Organizaciones] = "organizaciones",
        [Modulos.CatalogoEditorial] = "catalogo-editorial",
        [Modulos.Agenda] = "agenda",
        [Modulos.Noticias] = "noticias",
    };

    /// <summary>El módulo de consola que hay que tener para decidir ese trámite, o <c>null</c>.</summary>
    public static string? ConsolaDe(string? moduloDelTramite) =>
        !string.IsNullOrWhiteSpace(moduloDelTramite)
        && Correspondencias.TryGetValue(moduloDelTramite.Trim(), out var modulo)
            ? modulo
            : null;

    /// <summary>
    /// Los <c>ModuloId</c> de trámite que esa sesión NO puede ver ni decidir.
    /// </summary>
    /// <remarks>
    /// Se devuelve lo vetado, y no lo permitido, para que la consulta pueda filtrar sin dejar fuera
    /// lo desconocido: <c>ModuloId not in (vetados)</c>. El webmaster no tiene nada vetado.
    /// </remarks>
    public static async Task<List<string>> VetadosAsync(
        SimusDbContext db, ClaimsPrincipal principal, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(principal);
        if (principal.IsInRole(Permisos.Webmaster)) return [];

        var cuenta = PermisosDeModulo.CuentaDe(principal);
        if (cuenta is null) return [.. Correspondencias.Keys];

        var suyos = await PermisosDeModulo.DeLaCuentaAsync(db, cuenta.Value, esWebmaster: false, ct);
        var tiene = new HashSet<string>(suyos, StringComparer.OrdinalIgnoreCase);
        return Correspondencias
            .Where(par => !tiene.Contains(par.Value))
            .Select(par => par.Key)
            .ToList();
    }

    /// <summary>Si esa sesión puede decidir un trámite de ese módulo.</summary>
    public static async Task<bool> PuedeDecidirAsync(
        SimusDbContext db, ClaimsPrincipal principal, string? moduloDelTramite, CancellationToken ct)
    {
        var consola = ConsolaDe(moduloDelTramite);
        return consola is null || await PermisosDeModulo.PuedeAsync(db, principal, consola, ct);
    }

    /// <summary>El 403 con el mismo texto que el de <see cref="ExigeModuloExtensiones"/>.</summary>
    public static IResult SinModulo() =>
        Results.Problem(
            detail: "Tu cuenta no tiene activado este módulo del Espacio de Gestión Administrativa. "
                + "Quien administre los usuarios puede activártelo.",
            statusCode: StatusCodes.Status403Forbidden,
            title: "Módulo no activado para esta cuenta");
}
