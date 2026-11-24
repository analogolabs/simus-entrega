using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

public static class AnaliticaRedPublicaEndpoints
{
    /// <summary>Tope de nodos que se sirven; si el ecosistema crece más, se avisa en <c>Truncada</c> y no se corta en silencio.</summary>
    internal const int MaximoDeNodos = 600;

    public static RouteGroupBuilder MapAnaliticaRedPublicaEndpoints(this RouteGroupBuilder group)
    {
        // ANONIMA A PROPOSITO. Alimenta la red de relaciones del tablero del ecosistema (vista Gráfico
        // del mapa público). SOLO RELACIONES REGISTRADAS: organización responsable → proceso (la que cada
        // Festival o Mercado publicado declara), proceso → territorio sonoro o práctica musical (clasificación declarada) y
        // mercado → festival (el que se realiza en su marco). Nada inferido: una pareja que no está
        // escrita en la base no es una arista. SIN PERSONAS: los nodos son organizaciones, procesos y
        // territorios sonoros, nunca perfiles de personas. Un Festival en custodia institucional
        // (registro histórico sin organización) no se atribuye al Programa: no genera arista.
        group.MapGet("/publico/analitica/ecosistema/red", async (
            SimusDbContext dbContext,
            CacheDivipola divipola,
            CancellationToken cancellationToken) =>
        {
            var (departamentos, _) = await divipola.ObtenerAsync(dbContext, cancellationToken);
            string? Depto(string? codigo) =>
                codigo is not null && departamentos.TryGetValue(codigo, out var nombre) ? nombre : codigo;

            var nodos = new Dictionary<string, NodoDeRedDto>();
            var aristas = new HashSet<AristaDeRedDto>();
            void Nodo(string id, string tipo, string nombre, string? departamento = null) =>
                nodos.TryAdd(id, new NodoDeRedDto(id, tipo, nombre, departamento));

            var institucional = await dbContext.EntityProfiles.AsNoTracking()
                .Where(item => item.IsInstitutional).Select(item => (int?)item.Id).FirstOrDefaultAsync(cancellationToken);
            var organizaciones = await dbContext.EntityProfiles.AsNoTracking()
                .Select(item => new { item.Id, item.Name }).ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);

            var festivales = await LecturaFestivalesPublicados.ConsultarAsync(dbContext, cancellationToken);
            var festivalesVisibles = new HashSet<int>();
            foreach (var festival in festivales)
            {
                var id = $"festival:{festival.Festival.Id}";
                Nodo(id, "festival", festival.Nombre, Depto(festival.Sede.Departamento));
                festivalesVisibles.Add(festival.Festival.Id);
                if (festival.Festival.OrganizacionPrincipalId is int org && org != institucional && organizaciones.TryGetValue(org, out var nombreOrg))
                {
                    Nodo($"organizacion:{org}", "organizacion", nombreOrg);
                    aristas.Add(new AristaDeRedDto($"organizacion:{org}", id, "responsable"));
                }
                foreach (var territorio in festival.TerritoriosSonoros)
                {
                    Nodo($"territorio:{territorio.Id}", "territorio", territorio.Nombre);
                    aristas.Add(new AristaDeRedDto(id, $"territorio:{territorio.Id}", "declara"));
                }
                foreach (var practica in festival.PracticasMusicales)
                {
                    Nodo($"practica:{practica.Id}", "practica", practica.Nombre);
                    aristas.Add(new AristaDeRedDto(id, $"practica:{practica.Id}", "declara"));
                }
            }

            var mercados = await dbContext.Mercados.AsNoTracking()
                .Where(item => item.Activo && item.EstadoRegistro == "publicado").ToListAsync(cancellationToken);
            var territoriosDeMercado = await dbContext.MercadosTerritoriosSonoros.AsNoTracking()
                .Join(dbContext.TerritoriosSonoros.AsNoTracking(), relacion => relacion.TerritorioSonoroId, territorio => territorio.Id,
                    (relacion, territorio) => new { relacion.MercadoId, territorio.Id, territorio.Nombre })
                .ToListAsync(cancellationToken);
            var practicasDeMercado = await dbContext.MercadosPracticasMusicales.AsNoTracking()
                .Join(dbContext.PracticasMusicales.AsNoTracking(), relacion => relacion.PracticaMusicalId, practica => practica.Id,
                    (relacion, practica) => new { relacion.MercadoId, practica.Id, practica.Nombre })
                .ToListAsync(cancellationToken);
            foreach (var mercado in mercados)
            {
                var id = $"mercado:{mercado.Id}";
                var sede = SedePrincipal.Resolver(mercado.SedeCodigoDepartamento, mercado.SedeCodigoMunicipio, mercado.NivelCobertura, mercado.CodigoDepartamento, mercado.CodigoMunicipio);
                Nodo(id, "mercado", mercado.Nombre, Depto(sede.Departamento));
                if (mercado.OrganizacionPrincipalId != institucional && organizaciones.TryGetValue(mercado.OrganizacionPrincipalId, out var nombreOrg))
                {
                    Nodo($"organizacion:{mercado.OrganizacionPrincipalId}", "organizacion", nombreOrg);
                    aristas.Add(new AristaDeRedDto($"organizacion:{mercado.OrganizacionPrincipalId}", id, "responsable"));
                }
                if (mercado.SeRealizaEnElMarcoDeUnFestival && mercado.FestivalId is int festivalId && festivalesVisibles.Contains(festivalId))
                {
                    aristas.Add(new AristaDeRedDto(id, $"festival:{festivalId}", "en_el_marco"));
                }
                foreach (var territorio in territoriosDeMercado.Where(item => item.MercadoId == mercado.Id))
                {
                    Nodo($"territorio:{territorio.Id}", "territorio", territorio.Nombre);
                    aristas.Add(new AristaDeRedDto(id, $"territorio:{territorio.Id}", "declara"));
                }
                foreach (var practica in practicasDeMercado.Where(item => item.MercadoId == mercado.Id))
                {
                    Nodo($"practica:{practica.Id}", "practica", practica.Nombre);
                    aristas.Add(new AristaDeRedDto(id, $"practica:{practica.Id}", "declara"));
                }
            }

            var truncada = nodos.Count > MaximoDeNodos;
            var permitidos = truncada
                ? nodos.Values.OrderBy(item => item.Tipo is "territorio" or "practica" ? 0 : item.Tipo == "organizacion" ? 1 : 2).ThenBy(item => item.Id, StringComparer.Ordinal)
                    .Take(MaximoDeNodos).Select(item => item.Id).ToHashSet()
                : nodos.Keys.ToHashSet();
            return Results.Ok(new RedDelEcosistemaDto(
                nodos.Values.Where(item => permitidos.Contains(item.Id)).OrderBy(item => item.Tipo).ThenBy(item => item.Nombre, StringComparer.CurrentCulture).ToList(),
                aristas.Where(item => permitidos.Contains(item.Origen) && permitidos.Contains(item.Destino))
                    .OrderBy(item => item.Origen, StringComparer.Ordinal).ThenBy(item => item.Destino, StringComparer.Ordinal).ToList(),
                truncada));
        })
        .WithTags("analitica-ecosistema")
        .AllowAnonymous()
        .RequireRateLimiting(new LimiteDeTasaAnaliticaPublica());

        return group;
    }
}
