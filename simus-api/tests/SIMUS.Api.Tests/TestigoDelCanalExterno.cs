using System.Net.Http.Json;
using System.Text.Json;

namespace SIMUS.Api.Tests;

/// <summary>
/// Manda una escritura del canal externo con el testigo antiforgery, como lo hace la web.
/// </summary>
/// <remarks>
/// Las subidas y retiros del Banco de archivos exigen el testigo. Las pruebas que solo quieren
/// subir un archivo no tienen por qué repetir el pedido del testigo: lo hacen por aquí.
/// </remarks>
internal static class TestigoDelCanalExterno
{
    /// <summary>El testigo de la sesión del cliente, tal como lo entrega el portal.</summary>
    public static async Task<string> PedirAsync(HttpClient cliente)
    {
        ArgumentNullException.ThrowIfNull(cliente);
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        return testigo.GetProperty("requestToken").GetString()!;
    }

    /// <summary>Un POST con cuerpo y testigo.</summary>
    public static async Task<HttpResponseMessage> PostAsync(HttpClient cliente, string ruta, HttpContent contenido)
    {
        ArgumentNullException.ThrowIfNull(cliente);
        using var mensaje = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = contenido };
        mensaje.Headers.Add("X-CSRF-TOKEN", await PedirAsync(cliente));
        return await cliente.SendAsync(mensaje);
    }
}
