using SIMUS.Domain.Entities;

namespace SIMUS.Api.Historial;

/// <summary>
/// La red tal como se compara en el historial: la fila y los dos listados que no viven en ella.
/// </summary>
/// <remarks>
/// Las formas de acceso y los formatos son tablas de relación, no columnas. Se llevan como
/// texto —los nombres ordenados, separados por coma— para que un cambio en ellos quede en el
/// registro de cambios igual que cualquier otro campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.5.1).
/// </remarks>
public sealed record RedParaElHistorial(RedRow Fila, string FormasDeAcceso, string Formatos);

/// <summary>
/// Los campos de una red cuyo cambio queda en el registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md).
/// </summary>
/// <remarks>
/// <b>EL CONTACTO ES «CONTACTO», NO «PUBLICO».</b> Correo y teléfono de la red son datos de una
/// persona o de un negocio pequeño: el valor se guarda —decisión del 10 de noviembre de 2026— y lo
/// lee solo la consola. Lo demás es lo que el portal ya enseña.
/// </remarks>
public static class CamposDeLaRed
{
    public static readonly IReadOnlyList<CampoVigilado<RedParaElHistorial>> Todos =
    [
        new("nombre", "Nombre", ClaseDeDato.Publico, x => x.Fila.Nombre),
        new("descripcion", "Descripción", ClaseDeDato.Publico, x => x.Fila.Descripcion),
        new("tipoDeNodo", "Tipo de nodo", ClaseDeDato.Publico, x => x.Fila.TipoDeNodo),
        new("accesoAbierto", "Acceso abierto", ClaseDeDato.Publico, x => x.Fila.AccesoAbierto),
        new("acervosYColecciones", "Acervos y colecciones", ClaseDeDato.Publico, x => x.Fila.AcervosYColecciones),
        new("correoRed", "Correo de la red", ClaseDeDato.Contacto, x => x.Fila.CorreoRed),
        new("telefonoRed", "Teléfono de la red", ClaseDeDato.Contacto, x => x.Fila.TelefonoRed),
        new("sitioWebRed", "Sitio web", ClaseDeDato.Publico, x => x.Fila.SitioWebRed),
        new("instagramRed", "Instagram", ClaseDeDato.Publico, x => x.Fila.InstagramRed),
        new("facebookRed", "Facebook", ClaseDeDato.Publico, x => x.Fila.FacebookRed),
        new("otroEnlaceRed", "Otro enlace", ClaseDeDato.Publico, x => x.Fila.OtroEnlaceRed),
        new("nivelCobertura", "Nivel de cobertura", ClaseDeDato.Publico, x => x.Fila.NivelCobertura),
        new("codigoDepartamento", "Departamento", ClaseDeDato.Publico, x => x.Fila.CodigoDepartamento),
        new("codigoMunicipio", "Municipio", ClaseDeDato.Publico, x => x.Fila.CodigoMunicipio),
        new("archivoFotoId", "Foto", ClaseDeDato.Publico, x => x.Fila.ArchivoFotoId, CatalogoDeCampo.Archivo),
        new("sedeCodigoDepartamento", "Departamento de la sede", ClaseDeDato.Publico, x => x.Fila.SedeCodigoDepartamento),
        new("sedeCodigoMunicipio", "Municipio de la sede", ClaseDeDato.Publico, x => x.Fila.SedeCodigoMunicipio),
        new("lugarEspecifico", "Lugar", ClaseDeDato.Publico, x => x.Fila.LugarEspecifico),
        new("formasDeAcceso", "Formas de acceso", ClaseDeDato.Publico, x => x.FormasDeAcceso),
        new("formatos", "Formatos de documentación", ClaseDeDato.Publico, x => x.Formatos),
    ];
}
