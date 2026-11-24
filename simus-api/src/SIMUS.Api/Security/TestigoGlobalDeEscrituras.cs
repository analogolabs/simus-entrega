using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;

namespace SIMUS.Api.Security;

/// <summary>
/// Cómo trata el API una escritura autenticada que llega sin testigo antiforgery válido (hallazgo S-06).
/// </summary>
public enum ModoDelTestigoGlobal
{
    /// <summary>Solo anota la falta y deja pasar. Es la fase de medición.</summary>
    Registrar,

    /// <summary>Responde 400 sin llegar al manejador.</summary>
    Exigir,
}

/// <summary>
/// Exige el testigo antiforgery en TODA escritura (POST, PUT, PATCH, DELETE) del API que va con sesión de
/// cookie, sin depender de que cada ruta se acuerde de pedirlo.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ UNA PIEZA GLOBAL.</b> La regla decía «en todas», pero la comprobación vivía en
/// cada manejador o en un filtro por ruta, y la auditoría contó unas 33 escrituras sin ella. Una ruta nueva
/// nacía abierta y nada lo señalaba. Aquí el defecto es el contrario: se valida salvo que la ruta sea anónima.
/// </para>
/// <para>
/// <b>QUÉ QUEDA FUERA, Y POR QUÉ NO ES UNA LISTA DE RUTAS.</b> Solo las rutas marcadas <c>AllowAnonymous</c>
/// (ingreso, registro, olvidé la clave, confirmar el correo, consultar una invitación…): no hay sesión que
/// aprovechar y el visitante aún no tiene testigo. Que una ruta anónima de escritura exista es una decisión
/// que ya fija el censo de <c>AutorizacionPorDefectoTests</c>, y <c>TestigoGlobalDeEscriturasTests</c> fija la
/// lista de las que escriben.
/// </para>
/// <para>
/// <b>VA DESPUÉS DE LA AUTORIZACIÓN.</b> El testigo va atado a la identidad de quien lo pidió, y esa identidad
/// solo está en <c>HttpContext.User</c> cuando ya corrieron la autenticación y la autorización. Quien no tiene
/// sesión o permiso recibe 401/403 antes de llegar aquí, como siempre.
/// </para>
/// <para>
/// <b>DOBLE COMPROBACIÓN INOCUA.</b> Las rutas que ya validan en el manejador o con
/// <see cref="ExigeTestigoDeLaConsola"/> vuelven a validar: la comprobación no consume el testigo y el
/// resultado es el mismo. El modo se lee de <c>Seguridad:Csrf:Modo</c> en cada petición
/// (<c>Registrar</c> o <c>Exigir</c>), de modo que se puede pasar de una fase a otra sin recompilar.
/// </para>
/// </remarks>
public sealed class TestigoGlobalDeEscrituras
{
    /// <summary>Clave de configuración del modo.</summary>
    public const string ClaveDelModo = "Seguridad:Csrf:Modo";

    /// <summary>Prefijo del API: lo único que cubre la pieza.</summary>
    public const string PrefijoDelApi = "/api/v1/";

    /// <summary>
    /// Escrituras con sesión que NO piden testigo, por patrón de ruta, cada una con su motivo. Son las que
    /// no cambian nada que importe: las consultas por POST (llevan la pregunta en el cuerpo y solo leen) y la
    /// salida (cerrar la sesión de otro no le roba nada a nadie y no debe fallar por un testigo vencido).
    /// Abrir una más obliga a tocar esta lista y la prueba que la fija.
    /// </summary>
    public static readonly string[] SinTestigo =
    [
        "/api/v1/admin/auth/logout",
        "/api/v1/externo/auth/logout",
        "/api/v1/admin/analisis/consultar",
        "/api/v1/externo/organizaciones/{organizacionId:int}/consulta-guiada/consultar",
    ];

    private readonly RequestDelegate _siguiente;

    public TestigoGlobalDeEscrituras(RequestDelegate siguiente)
    {
        _siguiente = siguiente;
    }

    /// <summary>Si el método escribe.</summary>
    public static bool EsEscritura(string metodo) =>
        HttpMethods.IsPost(metodo) || HttpMethods.IsPut(metodo) || HttpMethods.IsPatch(metodo) || HttpMethods.IsDelete(metodo);

    /// <summary>Si la pieza debe pedir testigo a esta ruta: escritura del API, con endpoint y no anónima.</summary>
    public static bool Cubre(HttpContext contexto)
    {
        ArgumentNullException.ThrowIfNull(contexto);
        if (!EsEscritura(contexto.Request.Method)) return false;
        if (!contexto.Request.Path.StartsWithSegments("/api/v1", StringComparison.OrdinalIgnoreCase)) return false;
        var endpoint = contexto.GetEndpoint();
        if (endpoint is null) return false;
        if (endpoint is RouteEndpoint ruta && SinTestigo.Contains(ruta.RoutePattern.RawText, StringComparer.Ordinal)) return false;
        return endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null;
    }

    /// <summary>El modo vigente; ante un valor desconocido, el más estricto.</summary>
    public static ModoDelTestigoGlobal LeerModo(IConfiguration configuracion)
    {
        ArgumentNullException.ThrowIfNull(configuracion);
        var valor = configuracion[ClaveDelModo];
        return string.Equals(valor, nameof(ModoDelTestigoGlobal.Registrar), StringComparison.OrdinalIgnoreCase)
            ? ModoDelTestigoGlobal.Registrar
            : ModoDelTestigoGlobal.Exigir;
    }

    public async Task InvokeAsync(HttpContext contexto)
    {
        if (!Cubre(contexto))
        {
            await _siguiente(contexto);
            return;
        }

        var antiforgery = contexto.RequestServices.GetRequiredService<IAntiforgery>();
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, contexto))
        {
            var modo = LeerModo(contexto.RequestServices.GetRequiredService<IConfiguration>());
            var ruta = (contexto.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "(sin patrón)";
            var registro = contexto.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger<TestigoGlobalDeEscrituras>();
            // Solo método y patrón de la ruta: ni usuario, ni valores de ruta, ni cuerpo.
            registro.LogWarning(
                "Escritura con sesión sin testigo antiforgery válido: {Metodo} {Ruta} (modo {Modo})",
                contexto.Request.Method, ruta, modo);

            if (modo == ModoDelTestigoGlobal.Exigir)
            {
                contexto.Response.StatusCode = StatusCodes.Status400BadRequest;
                // Las dos formas que ya conoce la web: `message` (consola y portal) y `errors.antiforgery` (CMS).
                const string aviso = "La acción no pudo validarse. Actualiza la página e inténtalo nuevamente.";
                await contexto.Response.WriteAsJsonAsync(new
                {
                    message = aviso,
                    errors = new Dictionary<string, string[]> { ["antiforgery"] = [aviso] },
                });
                return;
            }
        }

        await _siguiente(contexto);
    }
}
