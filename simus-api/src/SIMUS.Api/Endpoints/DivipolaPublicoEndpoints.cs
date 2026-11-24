using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>Catálogo territorial público requerido para diligenciar formularios antes del inicio de sesión.</summary>
public static class DivipolaPublicoEndpoints
{
    public static RouteGroupBuilder MapDivipolaPublicoEndpoints(this RouteGroupBuilder group)
    {
        var publico = group.MapGroup("/publico/divipola").WithTags("divipola-publico");

        // El catálogo DANE no es un directorio de personas ni un registro del PNMC. Debe poder
        // leerse antes de crear una cuenta, pues la sede de la organización es obligatoria en el
        // mismo formulario de registro. Se entrega completo: paginarlo obliga al formulario a
        // coordinar varias respuestas para poblar dos selectores dependientes.
        publico.MapGet("", async (SimusDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var ubicaciones = await dbContext.DivipolaLocations.AsNoTracking()
                .OrderBy(item => item.DepartmentName)
                .ThenBy(item => item.MunicipalityName)
                .Select(item => new DivipolaLocationDto(
                    item.DepartmentCode,
                    item.DepartmentName,
                    item.MunicipalityCode,
                    item.MunicipalityName,
                    item.LocationType ?? string.Empty,
                    item.Latitude,
                    item.Longitude))
                .ToListAsync(cancellationToken);

            return Results.Ok(ubicaciones);
        }).AllowAnonymous();

        return group;
    }
}
