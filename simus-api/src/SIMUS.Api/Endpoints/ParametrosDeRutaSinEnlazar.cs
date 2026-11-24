using System.Text.RegularExpressions;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Documenta los parámetros de la ruta que el manejador no recibe como parámetros suyos (LUT-01).
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ EXISTE.</b> Las operaciones de eventos de <see cref="EventosDeOrganizacionEndpoints"/> sirven a una
/// organización (<c>/externo/organizaciones/{organizacionId}/…</c>) y a una persona sin organización
/// (<c>/externo/mis-eventos/…</c>) con el mismo manejador, que recibe un <see cref="AlcanceDeEventos"/> armado desde la
/// ruta y la sesión. Un parámetro que el manejador no declara no sale en el contrato, y el contrato publicado
/// (<c>openapi.yaml</c>) dejaba de decir que esas rutas llevan el identificador de la organización.
/// </para>
/// <para>
/// Añade el parámetro de ruta que falta, con el tipo entero de los identificadores del API
/// (<c>organizacionId</c>, <c>:int</c>), delante de los demás, que es donde está en la ruta. No toca los que el
/// manejador sí declara.
/// </para>
/// </remarks>
internal sealed partial class ParametrosDeRutaSinEnlazar : IOperationFilter
{
    [GeneratedRegex(@"\{(?<nombre>[A-Za-z]\w*Id)(?::\w+)?\}", RegexOptions.CultureInvariant)]
    private static partial Regex ParametroDeIdentificador();

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        ArgumentNullException.ThrowIfNull(operation);
        ArgumentNullException.ThrowIfNull(context);

        var plantilla = context.ApiDescription.RelativePath ?? string.Empty;
        var posicion = 0;
        foreach (Match coincidencia in ParametroDeIdentificador().Matches(plantilla))
        {
            var nombre = coincidencia.Groups["nombre"].Value;
            if (operation.Parameters.Any(p => p.In == ParameterLocation.Path
                && string.Equals(p.Name, nombre, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            operation.Parameters.Insert(posicion++, new OpenApiParameter
            {
                Name = nombre,
                In = ParameterLocation.Path,
                Required = true,
                Schema = new OpenApiSchema { Type = "integer", Format = "int32" },
            });
        }
    }
}
