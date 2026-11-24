using SIMUS.Domain.Entities;

namespace SIMUS.Api.Historial;

/// <summary>
/// Los catorce campos de un Festival cuyo cambio queda en el registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10), leídos de la
/// cabecera <c>dbo.Festivales</c>.
/// </summary>
/// <remarks>
/// Conservan los mismos identificadores, rótulos y clases que usó la migración <c>V20261110_12</c> cuando se leían del
/// perfil público (retirado en el PR-6 del retiro de <c>PerfilesPublicosFestival</c>): la historia ya escrita sigue siendo la
/// misma lista y no se parte en dos.
/// </remarks>
public static class CamposDelFestival
{
    public static readonly IReadOnlyList<CampoVigilado<FestivalRow>> DelFestival =
    [
        new("nombre", "Nombre", ClaseDeDato.Publico, x => x.Name),
        new("descripcion", "Descripción", ClaseDeDato.Publico, x => x.Description),
        new("nivelCobertura", "Nivel de cobertura", ClaseDeDato.Publico, x => x.CoverageLevel),
        new("codigoDepartamento", "Departamento", ClaseDeDato.Publico, x => x.DepartmentCode, CatalogoDeCampo.Departamento),
        new("codigoMunicipio", "Municipio", ClaseDeDato.Publico, x => x.MunicipalityCode, CatalogoDeCampo.Municipio),
        new("periodicidad", "Periodicidad", ClaseDeDato.Publico, x => x.Periodicidad),
        new("periodicidadDetalle", "Detalle de la periodicidad", ClaseDeDato.Publico, x => x.PeriodicidadDetalle),
        new("correoContacto", "Correo de contacto", ClaseDeDato.Contacto, x => x.ContactEmail),
        new("telefonoContacto", "Teléfono de contacto", ClaseDeDato.Contacto, x => x.ContactPhone),
        new("instagram", "Instagram", ClaseDeDato.Publico, x => x.InstagramUrl),
        new("facebook", "Facebook", ClaseDeDato.Publico, x => x.FacebookUrl),
        new("sitioWeb", "Sitio web", ClaseDeDato.Publico, x => x.WebsiteUrl),
        new("otroEnlace", "Otro enlace", ClaseDeDato.Publico, x => x.OtherUrl),
        new("director", "Director o directora", ClaseDeDato.Publico, x => x.Director),
    ];
}
