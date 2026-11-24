using SIMUS.Domain.Entities;

namespace SIMUS.Api.Historial;

/// <summary>
/// El espacio tal como se compara en el historial: la fila y los dos listados que no viven en ella.
/// </summary>
/// <remarks>
/// El equipamiento y los tipos de espacio son tablas de relación, no columnas. Se llevan como
/// texto —los nombres ordenados, separados por coma— para que un cambio en ellos quede en el
/// registro de cambios igual que cualquier otro campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.5.1).
/// </remarks>
public sealed record EspacioParaElHistorial(EspacioRow Fila, string Equipamiento, string Tipos);

/// <summary>
/// Los campos de un espacio cuyo cambio queda en el registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md).
/// </summary>
/// <remarks>
/// <b>EL CONTACTO ES «CONTACTO», NO «PUBLICO».</b> Correo y teléfono del espacio son datos de una
/// persona o de un negocio pequeño: el valor se guarda —decisión del 10 de noviembre de 2026— y lo
/// lee solo la consola. Lo demás es lo que el portal ya enseña.
/// </remarks>
public static class CamposDelEspacio
{
    public static readonly IReadOnlyList<CampoVigilado<EspacioParaElHistorial>> Todos =
    [
        new("nombre", "Nombre", ClaseDeDato.Publico, x => x.Fila.Nombre),
        new("descripcion", "Descripción", ClaseDeDato.Publico, x => x.Fila.Descripcion),
        new("ambiente", "Ambiente", ClaseDeDato.Publico, x => x.Fila.Ambiente),
        new("aforoMaximo", "Aforo máximo", ClaseDeDato.Publico, x => x.Fila.AforoMaximo),
        new("esAccesible", "Accesible", ClaseDeDato.Publico, x => x.Fila.EsAccesible),
        new("horarioYProgramacion", "Horario y programación", ClaseDeDato.Publico, x => x.Fila.HorarioYProgramacion),
        new("correoEspacio", "Correo del espacio", ClaseDeDato.Contacto, x => x.Fila.CorreoEspacio),
        new("telefonoEspacio", "Teléfono del espacio", ClaseDeDato.Contacto, x => x.Fila.TelefonoEspacio),
        new("sitioWebEspacio", "Sitio web", ClaseDeDato.Publico, x => x.Fila.SitioWebEspacio),
        new("instagramEspacio", "Instagram", ClaseDeDato.Publico, x => x.Fila.InstagramEspacio),
        new("facebookEspacio", "Facebook", ClaseDeDato.Publico, x => x.Fila.FacebookEspacio),
        new("otroEnlaceEspacio", "Otro enlace", ClaseDeDato.Publico, x => x.Fila.OtroEnlaceEspacio),
        new("nivelCobertura", "Nivel de cobertura", ClaseDeDato.Publico, x => x.Fila.NivelCobertura),
        new("codigoDepartamento", "Departamento", ClaseDeDato.Publico, x => x.Fila.CodigoDepartamento),
        new("codigoMunicipio", "Municipio", ClaseDeDato.Publico, x => x.Fila.CodigoMunicipio),
        new("archivoFotoId", "Foto", ClaseDeDato.Publico, x => x.Fila.ArchivoFotoId, CatalogoDeCampo.Archivo),
        new("sedeCodigoDepartamento", "Departamento de la sede", ClaseDeDato.Publico, x => x.Fila.SedeCodigoDepartamento),
        new("sedeCodigoMunicipio", "Municipio de la sede", ClaseDeDato.Publico, x => x.Fila.SedeCodigoMunicipio),
        new("lugarEspecifico", "Dirección o lugar", ClaseDeDato.Publico, x => x.Fila.LugarEspecifico),
        new("tipos", "Tipos de espacio", ClaseDeDato.Publico, x => x.Tipos),
        new("equipamiento", "Equipamiento del espacio", ClaseDeDato.Publico, x => x.Equipamiento),
    ];
}
