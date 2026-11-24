using SIMUS.Domain.Entities;

namespace SIMUS.Api.Historial;

/// <summary>
/// El taller tal como se compara en el historial: la fila y los dos listados que no viven en ella.
/// </summary>
/// <remarks>
/// Los servicios y las familias de instrumentos son tablas de relación, no columnas. Se llevan como
/// texto —los nombres ordenados, separados por coma— para que un cambio en ellos quede en el
/// registro de cambios igual que cualquier otro campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.5.1).
/// </remarks>
public sealed record TallerParaElHistorial(TallerRow Fila, string Servicios, string Familias);

/// <summary>
/// Los campos de un taller cuyo cambio queda en el registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md).
/// </summary>
/// <remarks>
/// <b>EL CONTACTO ES «CONTACTO», NO «PUBLICO».</b> Correo y teléfono del taller son datos de una
/// persona o de un negocio pequeño: el valor se guarda —decisión del 10 de noviembre de 2026— y lo
/// lee solo la consola. Lo demás es lo que el portal ya enseña.
/// </remarks>
public static class CamposDelTaller
{
    public static readonly IReadOnlyList<CampoVigilado<TallerParaElHistorial>> Todos =
    [
        new("nombre", "Nombre", ClaseDeDato.Publico, x => x.Fila.Nombre),
        new("descripcion", "Descripción", ClaseDeDato.Publico, x => x.Fila.Descripcion),
        new("modalidad", "Modalidad", ClaseDeDato.Publico, x => x.Fila.Modalidad),
        new("recibeAprendices", "Recibe aprendices", ClaseDeDato.Publico, x => x.Fila.RecibeAprendices),
        new("saberesYTecnicas", "Saberes y técnicas", ClaseDeDato.Publico, x => x.Fila.SaberesYTecnicas),
        new("correoTaller", "Correo del taller", ClaseDeDato.Contacto, x => x.Fila.CorreoTaller),
        new("telefonoTaller", "Teléfono del taller", ClaseDeDato.Contacto, x => x.Fila.TelefonoTaller),
        new("sitioWebTaller", "Sitio web", ClaseDeDato.Publico, x => x.Fila.SitioWebTaller),
        new("instagramTaller", "Instagram", ClaseDeDato.Publico, x => x.Fila.InstagramTaller),
        new("facebookTaller", "Facebook", ClaseDeDato.Publico, x => x.Fila.FacebookTaller),
        new("otroEnlaceTaller", "Otro enlace", ClaseDeDato.Publico, x => x.Fila.OtroEnlaceTaller),
        new("nivelCobertura", "Nivel de cobertura", ClaseDeDato.Publico, x => x.Fila.NivelCobertura),
        new("codigoDepartamento", "Departamento", ClaseDeDato.Publico, x => x.Fila.CodigoDepartamento),
        new("codigoMunicipio", "Municipio", ClaseDeDato.Publico, x => x.Fila.CodigoMunicipio),
        new("sedeCodigoDepartamento", "Departamento de la sede", ClaseDeDato.Publico, x => x.Fila.SedeCodigoDepartamento),
        new("sedeCodigoMunicipio", "Municipio de la sede", ClaseDeDato.Publico, x => x.Fila.SedeCodigoMunicipio),
        new("lugarEspecifico", "Lugar", ClaseDeDato.Publico, x => x.Fila.LugarEspecifico),
        new("archivoFotoId", "Foto", ClaseDeDato.Publico, x => x.Fila.ArchivoFotoId, CatalogoDeCampo.Archivo),
        new("servicios", "Servicios del taller", ClaseDeDato.Publico, x => x.Servicios),
        new("familias", "Familias de instrumentos", ClaseDeDato.Publico, x => x.Familias),
    ];
}
