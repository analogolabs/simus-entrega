using Microsoft.AspNetCore.Mvc;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Topes de petición de las subidas del Banco de archivos y de las fotos personales (S-08).
/// <para>
/// El tope por archivo (2 MiB imagen, 80 MiB documento) se comprobaba DESPUÉS de <c>ReadFormAsync</c>,
/// cuando el cuerpo ya estaba almacenado. Aquí se comprueba antes de leer nada, de dos maneras: el
/// filtro responde 413 por la cabecera <c>Content-Length</c> sin tocar el cuerpo, y el atributo
/// <see cref="RequestSizeLimitAttribute"/> hace que Kestrel corte los cuerpos sin longitud declarada
/// (<c>chunked</c>) y suba el límite global de 30 MiB solo donde un documento de 80 MiB lo necesita.
/// </para>
/// </summary>
internal static class TopesDeSubida
{
    /// <summary>Lo que ocupa el multipart (límites, nombres de campo, texto alternativo, pie, crédito).</summary>
    internal const int MargenDelFormulario = 64 * 1024;

    internal const long TopeDePeticionDeImagen = MediosWebContrato.MaxBytes + MargenDelFormulario;

    internal const long TopeDePeticionDeDocumento = MediosWebContrato.MaxBytesDocumento + MargenDelFormulario;

    public static RouteHandlerBuilder ConTopeDeImagen(this RouteHandlerBuilder ruta)
        => ruta.ConTope(TopeDePeticionDeImagen, MediosWebContrato.MaxBytes, "archivo");

    public static RouteHandlerBuilder ConTopeDeDocumento(this RouteHandlerBuilder ruta)
        => ruta.ConTope(TopeDePeticionDeDocumento, MediosWebContrato.MaxBytesDocumento, "documento");

    // El filtro se registra ANTES que el del testigo (el orden de registro es el de ejecución): una
    // petición desmedida se rechaza sin llegar a ninguna otra comprobación ni a leer el formulario.
    private static RouteHandlerBuilder ConTope(this RouteHandlerBuilder ruta, long tope, long topeDelArchivo, string sujeto)
        => ruta
            .WithMetadata(new RequestSizeLimitAttribute(tope))
            .AddEndpointFilter(async (contexto, siguiente) =>
            {
                var declarado = contexto.HttpContext.Request.ContentLength;
                if (declarado is { } largo && largo > tope)
                {
                    return Results.Json(
                        new
                        {
                            file = new[]
                            {
                                $"El {sujeto} pesa {BancoDeArchivosEndpoints.PesoLegible(largo)} y el máximo es {BancoDeArchivosEndpoints.PesoLegible(topeDelArchivo)}.",
                            },
                        },
                        statusCode: StatusCodes.Status413PayloadTooLarge);
                }

                return await siguiente(contexto);
            });
}
