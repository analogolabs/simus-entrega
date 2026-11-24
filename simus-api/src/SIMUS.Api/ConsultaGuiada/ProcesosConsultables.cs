using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace SIMUS.Api.ConsultaGuiada;

/// <summary>Un tipo de proceso que la Consulta Guiada sabe contar: cómo se llama y con qué palabras se pide.</summary>
/// <param name="Modulo">El módulo del registro (<see cref="Modulos"/>).</param>
/// <param name="Singular">«taller de lutería».</param>
/// <param name="Plural">«talleres de lutería».</param>
/// <param name="Pistas">Las palabras que lo nombran en una pregunta.</param>
public sealed record TipoDeProcesoConsultable(
    string Modulo, string Singular, string Plural, string Femenino, IReadOnlyList<string> Pistas)
{
    /// <summary>«resumen_de_talleres».</summary>
    public string IdDelResumen => $"resumen_de_{Modulo}";

    /// <summary>«talleres_por_departamento».</summary>
    public string IdPorDepartamento => $"{Modulo}_por_departamento";

    /// <summary>«mis_talleres».</summary>
    public string IdDeLosMios => $"mis_{Modulo}";
}

/// <summary>Lo mínimo de un proceso que las consultas cuentan: es igual para los tres tipos.</summary>
public sealed class FilaDeProceso
{
    public int Id { get; init; }
    public string? Estado { get; init; }
    public string? Departamento { get; init; }
    public string? Municipio { get; init; }
    public int? OrganizacionId { get; init; }
}

/// <summary>
/// LOS PROCESOS CON MODELO COMÚN (Taller, Espacio, Red; docs/desarrollo/30-consola-y-acceso.md §30.17) SE CONSULTAN CON UNA SOLA
/// IMPLEMENTACIÓN. Un tipo nuevo es una entrada de <see cref="Tipos"/> y su proyección en
/// <see cref="Filas"/>; el catálogo, las consultas de la consola y las de la organización lo recogen solos.
/// </summary>
public static class ProcesosConsultables
{
    public static readonly IReadOnlyList<TipoDeProcesoConsultable> Tipos =
    [
        new(Modulos.Talleres, "taller de lutería", "talleres de lutería", "", ["taller", "luteria", "lutier"]),
        new(Modulos.Espacios, "espacio para música en vivo", "espacios para música en vivo", "", ["espacio"]),
        // «REDES» Y NO «RED»: con tres letras casaría por prefijo con «reducir» o «redactar».
        new(Modulos.Redes, "red o centro de documentación", "redes y centros de documentación", "a", ["redes", "documentacion"]),
    ];

    /// <summary>Todas las palabras que nombran un proceso de estos: las demás consultas las usan para dejarlos pasar.</summary>
    public static readonly IReadOnlyList<string> TodasLasPistas = [.. Tipos.SelectMany(tipo => tipo.Pistas)];

    /// <summary>Las consultas del catálogo de estos tipos, para ambos ámbitos.</summary>
    public static IReadOnlyList<ConsultaDelCatalogo> Consultas { get; } = [.. Tipos.SelectMany(Construir)];

    private static IEnumerable<ConsultaDelCatalogo> Construir(TipoDeProcesoConsultable tipo)
    {
        var fem = tipo.Femenino == "a";
        // SON MAS ESPECIFICAS QUE LAS DE FESTIVALES: nombran el tipo y la dimensión a la vez.
        yield return new(tipo.IdPorDepartamento, $"{Mayuscula(tipo.Plural)} por departamento",
            $"Distribución de {tipo.Plural} publicad{(fem ? "as" : "os")} con ubicación departamental.",
            AmbitoDeConsulta.Institucional, tipo.Pistas,
            ["departament", "territorio", "donde", "distrib", "repart", "cobertura"],
            SeAcotaPorTerritorio: true, SoloMiraLoPublicado: true);
        yield return new(tipo.IdDelResumen, $"Resumen de {tipo.Plural}",
            $"{(fem ? "Cuántas" : "Cuántos")} {tipo.Plural} hay en cada estado del circuito, incluidos los que no están publicados.",
            AmbitoDeConsulta.Institucional, tipo.Pistas, SeAcotaPorEstado: true);
        yield return new(tipo.IdDeLosMios, $"Cómo van mis {tipo.Plural}",
            $"Estado de {(fem ? "las" : "los")} {tipo.Plural} de la organización.",
            AmbitoDeConsulta.Organizacion, tipo.Pistas,
            SeAcotaPorTerritorio: true, SeAcotaPorEstado: true);
    }

    private static string Mayuscula(string texto) => char.ToUpperInvariant(texto[0]) + texto[1..];

    public static TipoDeProcesoConsultable? PorIdDeConsulta(string idDeConsulta) =>
        Tipos.FirstOrDefault(tipo => tipo.IdDelResumen == idDeConsulta
            || tipo.IdPorDepartamento == idDeConsulta || tipo.IdDeLosMios == idDeConsulta);

    /// <summary>Los procesos activos de un tipo, con la misma forma para cualquiera.</summary>
    public static IQueryable<FilaDeProceso> Filas(SimusDbContext db, string modulo) => modulo switch
    {
        Modulos.Talleres => db.Talleres.AsNoTracking().Where(x => x.Activo).Select(x => new FilaDeProceso
        { Id = x.Id, Estado = x.EstadoRegistro, Departamento = x.CodigoDepartamento, Municipio = x.CodigoMunicipio, OrganizacionId = x.OrganizacionPrincipalId }),
        Modulos.Espacios => db.Espacios.AsNoTracking().Where(x => x.Activo).Select(x => new FilaDeProceso
        { Id = x.Id, Estado = x.EstadoRegistro, Departamento = x.CodigoDepartamento, Municipio = x.CodigoMunicipio, OrganizacionId = x.OrganizacionPrincipalId }),
        Modulos.Redes => db.Redes.AsNoTracking().Where(x => x.Activo).Select(x => new FilaDeProceso
        { Id = x.Id, Estado = x.EstadoRegistro, Departamento = x.CodigoDepartamento, Municipio = x.CodigoMunicipio, OrganizacionId = x.OrganizacionPrincipalId }),
        _ => throw new ArgumentOutOfRangeException(nameof(modulo), modulo, "Ese módulo no es un proceso consultable."),
    };
}
