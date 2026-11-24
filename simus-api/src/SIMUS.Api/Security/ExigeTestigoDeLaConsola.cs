using Microsoft.AspNetCore.Antiforgery;
using SIMUS.Contracts;

namespace SIMUS.Api.Security;

/// <summary>
/// Filtro que exige el testigo antiforgery en una escritura de la consola, y la ruta que lo entrega.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ UN FILTRO Y NO LAS CUATRO LÍNEAS DE SIEMPRE.</b> Las escrituras de «Festivales» de
/// la consola (alta, publicación, liberar la administración y fusionar duplicados) son de las más
/// fuertes que tiene el sistema y eran las únicas del grupo de <c>/admin</c> sin testigo. La
/// comprobación es la de <see cref="TestigoDePeticion"/>; el filtro solo evita tocar la firma de
/// los manejadores, que están mapeados tal cual y cuyos parámetros salen en OpenAPI.
/// </para>
/// <para>
/// <b>TAMBIÉN LAS SUBIDAS Y LOS RETIROS DEL BANCO DE ARCHIVOS</b> (hallazgo D5-09), por la consola y por
/// el portal de las organizaciones (<see cref="ExigirDelCanalExterno"/>, que solo cambia el aviso).
/// Esas rutas llevan <c>DisableAntiforgery</c> porque leen el formulario a mano; sin este filtro
/// la decisión dejaba las seis puertas sin testigo.
/// </para>
/// <para>
/// La cookie de sesión ya es <c>SameSite=Lax</c>; el testigo es la segunda capa y cubre lo que
/// <c>Lax</c> no cubre (un subdominio comprometido es «mismo sitio»). Se añade ANTES de cualquier
/// otro filtro de la ruta: una petición sin testigo no debe invalidar cachés ni llegar al manejador.
/// </para>
/// </remarks>
public static class ExigeTestigoDeLaConsola
{
    /// <summary>
    /// Entrega a la web el testigo que acompañará a la escritura (cabecera <c>X-CSRF-TOKEN</c>).
    /// Una sola ruta para todas las escrituras de la consola que usan este filtro.
    /// </summary>
    public static IResult Entregar(IAntiforgery antiforgery, HttpContext contexto)
    {
        ArgumentNullException.ThrowIfNull(antiforgery);
        ArgumentNullException.ThrowIfNull(contexto);
        var tokens = antiforgery.GetAndStoreTokens(contexto);
        return Results.Ok(new TokenAntiforgeryRespuesta(tokens.RequestToken ?? string.Empty));
    }

    public static ValueTask<object?> Exigir(EndpointFilterInvocationContext contexto, EndpointFilterDelegate siguiente) =>
        ExigirAsync(contexto, siguiente, "La acción no pudo validarse. Recarga la consola e inténtalo nuevamente.");

    /// <summary>
    /// La misma comprobación para una escritura del canal externo (el portal de las organizaciones),
    /// con el aviso que corresponde a quien no está en la consola.
    /// </summary>
    public static ValueTask<object?> ExigirDelCanalExterno(EndpointFilterInvocationContext contexto, EndpointFilterDelegate siguiente) =>
        ExigirAsync(contexto, siguiente, "La acción no pudo validarse. Actualiza la página e inténtalo nuevamente.");

    private static async ValueTask<object?> ExigirAsync(
        EndpointFilterInvocationContext contexto, EndpointFilterDelegate siguiente, string mensaje)
    {
        ArgumentNullException.ThrowIfNull(contexto);
        ArgumentNullException.ThrowIfNull(siguiente);
        var antiforgery = contexto.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, contexto.HttpContext))
        {
            return Results.BadRequest(new { message = mensaje });
        }

        return await siguiente(contexto);
    }
}
