using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

public static class AnaliticaEvolucionPublicaEndpoints
{
    public static RouteGroupBuilder MapAnaliticaEvolucionPublicaEndpoints(this RouteGroupBuilder group)
    {
        // ANONIMA A PROPOSITO. Alimenta la lectura «evolución» del tablero del ecosistema (vista Gráfico
        // del mapa público): cuántas ediciones publicadas hubo cada año, por tipo de proceso y por
        // departamento de la sede. Devuelve solo conteos, ni una fila ni un nombre propio, y cuenta sobre
        // lo publicado: un borrador, un proceso retirado o una edición sin publicar no engordan ningún
        // total. Comparte el cupo por minuto y por origen de la analítica pública.
        group.MapGet("/publico/analitica/ecosistema/evolucion", async (
            SimusDbContext dbContext,
            CacheDivipola divipola,
            CancellationToken cancellationToken) =>
        {
            var (departamentos, _) = await divipola.ObtenerAsync(dbContext, cancellationToken);
            string? Nombre(string? codigo) =>
                codigo is not null && departamentos.TryGetValue(codigo, out var nombre) ? nombre : codigo;

            var puntos = new List<PuntoDeEvolucionDto>();

            // Festivales: la sede es la de la versión vigente del Festival publicado.
            var festivales = (await LecturaFestivalesPublicados.ConsultarAsync(dbContext, cancellationToken))
                .ToDictionary(item => item.Festival.Id, item => Nombre(item.Sede.Departamento));
            var edicionesDeFestival = await dbContext.EdicionesFestival.AsNoTracking()
                .Where(item => item.EstadoVisibilidad == "publicada" && item.Anio != null)
                .Select(item => new { item.FestivalId, Anio = item.Anio!.Value })
                .ToListAsync(cancellationToken);
            puntos.AddRange(edicionesDeFestival
                .Where(item => festivales.ContainsKey(item.FestivalId))
                .GroupBy(item => (item.Anio, Departamento: festivales[item.FestivalId]))
                .Select(item => new PuntoDeEvolucionDto("festival", item.Key.Anio, item.Key.Departamento, item.Count())));

            // Mercados: ídem, con la sede del mercado publicado y activo.
            var mercados = (await dbContext.Mercados.AsNoTracking()
                    .Where(item => item.Activo && item.EstadoRegistro == "publicado")
                    .Select(item => new { item.Id, item.NivelCobertura, item.CodigoDepartamento, item.CodigoMunicipio, item.SedeCodigoDepartamento, item.SedeCodigoMunicipio })
                    .ToListAsync(cancellationToken))
                .ToDictionary(item => item.Id, item => Nombre(SedePrincipal.Resolver(
                    item.SedeCodigoDepartamento, item.SedeCodigoMunicipio, item.NivelCobertura, item.CodigoDepartamento, item.CodigoMunicipio).Departamento));
            var edicionesDeMercado = await dbContext.EdicionesMercado.AsNoTracking()
                .Where(item => item.EstadoVisibilidad == "publicada")
                .Select(item => new { item.MercadoId, item.Anio })
                .ToListAsync(cancellationToken);
            puntos.AddRange(edicionesDeMercado
                .Where(item => mercados.ContainsKey(item.MercadoId))
                .GroupBy(item => (item.Anio, Departamento: mercados[item.MercadoId]))
                .Select(item => new PuntoDeEvolucionDto("mercado", item.Key.Anio, item.Key.Departamento, item.Count())));

            return Results.Ok(new EvolucionAnaliticaDto(puntos
                .OrderBy(item => item.Anio).ThenBy(item => item.Proceso).ThenBy(item => item.Departamento)
                .ToList()));
        })
        .WithTags("analitica-ecosistema")
        .AllowAnonymous()
        .RequireRateLimiting(new LimiteDeTasaAnaliticaPublica());

        return group;
    }
}
