using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

public sealed record FestivalPublicadoVigenteLectura(
    FestivalRow Festival,
    string Nombre,
    string? Descripcion,
    string NivelCobertura,
    string? CodigoDepartamento,
    string? CodigoMunicipio,
    string? Periodicidad,
    string? PeriodicidadDetalle,
    string? CorreoContacto,
    string? TelefonoContacto,
    string? Instagram,
    string? Facebook,
    string? SitioWeb,
    string? OtroEnlace,
    IReadOnlyList<CatalogoFestivalDto> PracticasMusicales,
    IReadOnlyList<CatalogoFestivalDto> TerritoriosSonoros)
{
    /// <summary>
    /// LA SEDE PRINCIPAL con la que se sitúa el Festival en el mapa, el directorio y los filtros:
    /// la suya o, mientras esté pendiente de completar, la del territorio de su cobertura (decisión 119).
    /// La sede es la de la cabecera.
    /// </summary>
    public (string? Departamento, string? Municipio) Sede => SedePrincipal.Resolver(
        Festival.SedeCodigoDepartamento, Festival.SedeCodigoMunicipio, NivelCobertura, CodigoDepartamento, CodigoMunicipio);
}

public static class LecturaFestivalesPublicados
{
    private const string EstadoPropuestaPublicada = "Publicada";

    /// <summary>
    /// Los Festivales tal como los ve el público, con su versión vigente resuelta.
    /// </summary>
    /// <param name="incluirAunqueNoEstePublicado">
    /// Un Festival que entra en la lectura sea cual sea su estado.
    /// </param>
    /// <remarks>
    /// <b>EL PARAMETRO EXISTE PARA PREVISUALIZAR, y por eso no lo usa ninguna ruta pública.</b> La
    /// consola necesita enseñar cómo se verá un Festival antes de publicarlo, y hacerlo con otra
    /// consulta —una que armara la ficha «parecida»— dejaría de parecerse en cuanto la lectura
    /// pública cambiara un campo, en silencio. Así la previsualización recorre <b>exactamente</b> el
    /// mismo camino: la misma resolución de versión vigente, el mismo retiro de propuestas sin
    /// aprobar, los mismos catálogos.
    /// <b>NO ABRE NINGUNA PUERTA:</b> quien decide si se puede pedir es la ruta, y la de
    /// previsualización exige sesión de consola.
    /// </remarks>
    public static async Task<List<FestivalPublicadoVigenteLectura>> ConsultarAsync(
        SimusDbContext dbContext,
        CancellationToken cancellationToken,
        int? incluirAunqueNoEstePublicado = null)
    {
        // SIN ESTADO NO ES PUBLICO, Y ANTES LA CONDICION DECIA QUE SI.
        //
        // Empezaba por `item.StatusCode == null`: un Festival sin estado declarado salía en el
        // portal. Al escribir la prueba que lo fijaba se comprobó que ese caso NO SE PUEDE
        // CONSTRUIR EN NINGUNO DE LOS DOS MOTORES —la columna es NOT NULL tanto en SQL Server como
        // en el modelo de EF con el que la suite levanta SQLite—, así que la rama era código muerto
        // en todas partes. Lo que la hacía peor que inútil es lo que declaraba: que un registro
        // cuyo estado nadie decidió es un registro publicado, justo al revés de lo que hace el
        // resto del sistema —lo que entra por Importación Asistida nace en borrador—.
        //
        // `"Publicado"` con mayúscula se conserva: la base es insensible a mayúsculas y pudo
        // escribirse así antes de que `EstadosFestival` unificara el vocabulario; retirarlo
        // ocultaría de golpe las fichas que lo tengan.
        var festivales = await dbContext.FestivalRecords.AsNoTracking()
            .Where(item => item.StatusCode == "publicado" || item.StatusCode == "Publicado"
                || (incluirAunqueNoEstePublicado != null && item.Id == incluirAunqueNoEstePublicado))
            .ToListAsync(cancellationToken);
        // LO PUBLICADO ES LA CABECERA (retiro de PerfilesPublicosFestival, PR-4). Ya no hay «versión
        // vigente» que resolver ni propuestas rechazadas que repudiar: una propuesta que no se aplicó nunca tocó la
        // cabecera, y la tabla del perfil ya no tiene lectores ni escritores (PR-6).
        var ids = festivales.Select(item => item.Id).ToArray();
        var practicas = ids.Length == 0 ? [] : await dbContext
            .DeVarios<PracticaMusicalDeRegistroRow>(Modulos.Festivales, ids).AsNoTracking()
            .Join(dbContext.PracticasMusicales.AsNoTracking(), relacion => relacion.ValorId, practica => practica.Id,
                (relacion, practica) => new { relacion.RegistroId, practica.Id, practica.Nombre }).ToListAsync(cancellationToken);
        var territorios = ids.Length == 0 ? [] : await dbContext
            .DeVarios<TerritorioSonoroDeRegistroRow>(Modulos.Festivales, ids).AsNoTracking()
            .Join(dbContext.TerritoriosSonoros.AsNoTracking(), relacion => relacion.ValorId, territorio => territorio.Id,
                (relacion, territorio) => new { relacion.RegistroId, territorio.Id, territorio.Nombre }).ToListAsync(cancellationToken);

        // PNMC-050: se agrupa una vez (F + N comparaciones y no F x N).
        var practicasPorFestival = practicas.ToLookup(
            item => Clasificaciones.Registro(item.RegistroId), item => new CatalogoFestivalDto(item.Id, item.Nombre));
        var territoriosPorFestival = territorios.ToLookup(
            item => Clasificaciones.Registro(item.RegistroId), item => new CatalogoFestivalDto(item.Id, item.Nombre));
        return festivales.Select(festival => new FestivalPublicadoVigenteLectura(
            festival, festival.Name, festival.Description, festival.CoverageLevel, festival.DepartmentCode,
            festival.MunicipalityCode, festival.Periodicidad, festival.PeriodicidadDetalle, festival.ContactEmail,
            festival.ContactPhone, festival.InstagramUrl, festival.FacebookUrl, festival.WebsiteUrl, festival.OtherUrl,
            practicasPorFestival[festival.Id].OrderBy(item => item.Nombre).ToList(),
            territoriosPorFestival[festival.Id].OrderBy(item => item.Nombre).ToList())).ToList();
    }
}
