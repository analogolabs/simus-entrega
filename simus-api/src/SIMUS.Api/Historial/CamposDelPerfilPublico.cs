using SIMUS.Domain.Entities;

namespace SIMUS.Api.Historial;

/// <summary>
/// Los campos del perfil público de una PERSONA cuyo cambio queda en el registro de cambios (ME, docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10).
/// </summary>
/// <remarks>
/// <b>LO PÚBLICO ES PÚBLICO; EL NOMBRE CIVIL ES DE CONTACTO.</b> El nombre artístico, la biografía, los roles y el
/// portafolio son lo que la ficha muestra. Que la persona consienta mostrar su nombre civil es una decisión sobre un
/// dato personal: clase «contacto», que no lee la organización.
/// </remarks>
public static class CamposDelPerfilPublico
{
    public static readonly IReadOnlyList<CampoVigilado<PerfilPublicoRow>> Vigilados =
    [
        new("nombreVisible", "Nombre artístico", ClaseDeDato.Publico, x => x.NombreVisible),
        new("codigoMunicipio", "Municipio", ClaseDeDato.Publico, x => x.CodigoMunicipio, CatalogoDeCampo.Municipio),
        new("archivoFotoId", "Foto", ClaseDeDato.Publico, x => x.ArchivoFotoId),
        new("nombreCivilVisible", "Mostrar mi nombre civil", ClaseDeDato.Contacto, x => x.NombreCivilVisible),
        new("biografiaCorta", "Biografía corta", ClaseDeDato.Publico, x => x.BiografiaCorta),
        new("biografiaLarga", "Biografía", ClaseDeDato.Publico, x => x.BiografiaLarga),
        new("visibilidad", "Quién ve mi perfil", ClaseDeDato.Publico, x => x.Visibilidad),
        new("roles", "Roles y oficios", ClaseDeDato.Publico, x => x.RolesJson),
        new("portafolio", "Portafolio", ClaseDeDato.Publico, x => x.PortafolioJson),
        new("organizaciones", "Organizaciones que muestro", ClaseDeDato.Publico, x => x.OrganizacionesVisiblesJson),
    ];
}
