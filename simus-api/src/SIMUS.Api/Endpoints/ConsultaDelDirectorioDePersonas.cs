using System.Globalization;
using System.Text;
using SIMUS.Contracts;

namespace SIMUS.Api.Endpoints;

/// <summary>Lo que pide quien consulta el directorio de agentes y actores. Todo es opcional.</summary>
public sealed record ParametrosDelDirectorioDePersonas(
    string? Texto = null,
    IReadOnlyList<string>? Categorias = null,
    IReadOnlyList<string>? Roles = null,
    IReadOnlyList<string>? Servicios = null,
    IReadOnlyList<string>? Instrumentos = null,
    IReadOnlyList<string>? Practicas = null,
    string? Departamento = null,
    string? Municipio = null,
    string? Actua = null,
    string? Orden = null,
    int Pagina = 1,
    int PorPagina = ConsultaDelDirectorioDePersonas.PorPaginaPorOmision);

/// <summary>
/// El filtrado, el conteo de opciones, el orden y la paginación del directorio de personas, en una pieza pura (sin base de
/// datos) para poder probarla sola.
/// </summary>
/// <remarks>
/// <para>
/// <b>DENTRO DE UNA DIMENSIÓN, CUALQUIERA; ENTRE DIMENSIONES, TODAS.</b> Marcar dos instrumentos trae a quien toca alguno de
/// los dos; marcar un instrumento y un servicio trae a quien tiene ambos.
/// </para>
/// <para>
/// <b>LAS OPCIONES NUNCA MIENTEN.</b> Cada dimensión cuenta lo que quedaría al marcarla, ignorando su propia selección y
/// respetando todo lo demás. Solo se ofrecen las opciones con al menos una persona o ya marcadas.
/// </para>
/// <para>
/// <b>EL ENTRADA YA ES SOLO LO CONSENTIDO:</b> la lista que recibe sale de <c>CargarAsync</c>, que parte de los perfiles
/// visibles. Aquí no se lee ningún dato privado.
/// </para>
/// </remarks>
public static class ConsultaDelDirectorioDePersonas
{
    public const int PorPaginaPorOmision = 12;
    public const int MaximoPorPagina = 60;
    public const string OrdenPorNombre = "nombre";
    public const string OrdenPorTerritorio = "territorio";

    private enum Dimension { Categorias, Roles, Servicios, Instrumentos, Practicas, Actua, Departamento, Municipio }

    public static PaginaDelDirectorioDePersonasDto Ejecutar(
        IReadOnlyList<PersonaDelDirectorioDto> todas,
        ParametrosDelDirectorioDePersonas p,
        TaxonomiaDeNombres taxonomia)
    {
        var porPagina = Math.Clamp(p.PorPagina, 1, MaximoPorPagina);
        var texto = SinTildes((p.Texto ?? string.Empty).Trim());

        bool Cumple(PersonaDelDirectorioDto persona, Dimension? omitir)
        {
            if (texto.Length > 0 && !SinTildes(TextoDeBusqueda(persona, taxonomia)).Contains(texto, StringComparison.Ordinal)) return false;
            if (omitir != Dimension.Departamento && !string.IsNullOrWhiteSpace(p.Departamento)
                && !Igual(persona.Departamento, p.Departamento)) return false;
            if (omitir != Dimension.Municipio && !string.IsNullOrWhiteSpace(p.Municipio)
                && !Igual(persona.Municipio, p.Municipio)) return false;
            if (omitir != Dimension.Actua && !string.IsNullOrWhiteSpace(p.Actua)
                && !persona.Territorios.Any(t => Igual(t, p.Actua))) return false;
            return Alguna(p.Categorias, taxonomia.CategoriasDe(persona), omitir == Dimension.Categorias)
                && Alguna(p.Roles, persona.Roles, omitir == Dimension.Roles)
                && Alguna(p.Servicios, persona.Servicios, omitir == Dimension.Servicios)
                && Alguna(p.Instrumentos, persona.Instrumentos, omitir == Dimension.Instrumentos)
                && Alguna(p.Practicas, persona.Practicas, omitir == Dimension.Practicas);
        }

        var coinciden = todas.Where(x => Cumple(x, null)).ToList();
        var ordenadas = p.Orden == OrdenPorTerritorio
            ? coinciden.OrderBy(x => Donde(x), StringComparer.Create(CultureInfo.GetCultureInfo("es"), true)).ThenBy(x => x.NombreVisible, Comparador)
            : coinciden.OrderBy(x => x.NombreVisible, Comparador);
        var lista = ordenadas.ToList();

        var totalPaginas = Math.Max(1, (int)Math.Ceiling(lista.Count / (double)porPagina));
        var pagina = Math.Clamp(p.Pagina, 1, totalPaginas);
        var items = lista.Skip((pagina - 1) * porPagina).Take(porPagina).ToList();

        List<FacetaDelDirectorioDto> Facetas(Dimension dimension, Func<PersonaDelDirectorioDto, IEnumerable<string>> valores,
            Func<string, string> nombre, IReadOnlyList<string>? marcadas, IEnumerable<string>? orden = null)
        {
            var cuenta = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var persona in todas.Where(x => Cumple(x, dimension)))
                foreach (var v in valores(persona).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct(StringComparer.OrdinalIgnoreCase))
                    cuenta[v] = cuenta.GetValueOrDefault(v) + 1;
            foreach (var m in marcadas ?? []) cuenta.TryAdd(m, 0);
            var resultado = cuenta.Select(par => new FacetaDelDirectorioDto(par.Key, nombre(par.Key), par.Value));
            if (orden is not null)
            {
                var posicion = orden.Select((c, i) => (c, i)).ToDictionary(x => x.c, x => x.i, StringComparer.OrdinalIgnoreCase);
                return resultado.OrderBy(f => posicion.GetValueOrDefault(f.Valor, int.MaxValue)).ThenBy(f => f.Nombre, Comparador).ToList();
            }
            return resultado.OrderBy(f => f.Nombre, Comparador).ToList();
        }

        var facetas = new FacetasDelDirectorioDto(
            Facetas(Dimension.Categorias, taxonomia.CategoriasDe, taxonomia.NombreDeRol, p.Categorias, taxonomia.OrdenDeRoles),
            Facetas(Dimension.Roles, x => x.Roles, taxonomia.NombreDeRol, p.Roles, taxonomia.OrdenDeRoles),
            Facetas(Dimension.Servicios, x => x.Servicios, taxonomia.NombreDeServicio, p.Servicios),
            Facetas(Dimension.Instrumentos, x => x.Instrumentos, taxonomia.NombreDeInstrumento, p.Instrumentos),
            Facetas(Dimension.Practicas, x => x.Practicas, v => v, p.Practicas),
            Facetas(Dimension.Actua, x => x.Territorios, v => v, string.IsNullOrWhiteSpace(p.Actua) ? null : [p.Actua]),
            Facetas(Dimension.Departamento, x => x.Departamento is null ? [] : [x.Departamento], v => v,
                string.IsNullOrWhiteSpace(p.Departamento) ? null : [p.Departamento]),
            // LOS MUNICIPIOS SOLO SE OFRECEN DENTRO DE UN DEPARTAMENTO: sin él serían cientos.
            string.IsNullOrWhiteSpace(p.Departamento) ? [] :
                Facetas(Dimension.Municipio, x => x.Municipio is null ? [] : [x.Municipio], v => v,
                    string.IsNullOrWhiteSpace(p.Municipio) ? null : [p.Municipio]));

        return new PaginaDelDirectorioDePersonasDto(items, lista.Count, todas.Count, pagina, porPagina, totalPaginas, facetas);
    }

    private static readonly StringComparer Comparador = StringComparer.Create(CultureInfo.GetCultureInfo("es"), true);

    private static bool Alguna(IReadOnlyList<string>? elegidos, IEnumerable<string> propios, bool omitir) =>
        omitir || elegidos is null || elegidos.Count == 0
        || elegidos.Any(e => propios.Contains(e, StringComparer.OrdinalIgnoreCase));

    private static bool Igual(string? a, string? b) => string.Equals(a, b, StringComparison.OrdinalIgnoreCase);

    private static string Donde(PersonaDelDirectorioDto p) =>
        string.Join(", ", new[] { p.Municipio, p.Departamento }.Where(x => !string.IsNullOrEmpty(x)));

    private static string TextoDeBusqueda(PersonaDelDirectorioDto p, TaxonomiaDeNombres t) =>
        string.Join(' ', new[] { p.NombreVisible, p.BiografiaCorta, p.Municipio, p.Departamento }
            .Concat(p.Practicas).Concat(p.Territorios)
            .Concat(p.Roles.Select(t.NombreDeRol)).Concat(t.CategoriasDe(p).Select(t.NombreDeRol))
            .Concat(p.Servicios.Select(t.NombreDeServicio)).Concat(p.Instrumentos.Select(t.NombreDeInstrumento))
            .Where(x => !string.IsNullOrEmpty(x)));

    /// <summary>Quita tildes y pasa a minúscula: «Pacífico» y «pacifico» son lo mismo para quien busca.</summary>
    public static string SinTildes(string valor)
    {
        var d = valor.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(d.Length);
        foreach (var c in d)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(char.ToLowerInvariant(c));
        return sb.ToString();
    }
}

/// <summary>
/// Los nombres de la taxonomía y la categoría de cada rol, para decir «Luthier» y no «luthier» y para agrupar por
/// categoría. Una categoría sin subcategorías (o un rol sin padre) es su propia categoría (decisión 135).
/// </summary>
public sealed class TaxonomiaDeNombres
{
    private readonly IReadOnlyDictionary<string, string> _roles;
    private readonly IReadOnlyDictionary<string, string> _servicios;
    private readonly IReadOnlyDictionary<string, string> _instrumentos;
    private readonly IReadOnlyDictionary<string, string> _categoriaDe;

    public TaxonomiaDeNombres(
        IReadOnlyDictionary<string, string> roles, IReadOnlyDictionary<string, string> servicios,
        IReadOnlyDictionary<string, string> instrumentos, IReadOnlyDictionary<string, string> categoriaDeRol,
        IReadOnlyList<string> ordenDeRoles)
    {
        _roles = roles; _servicios = servicios; _instrumentos = instrumentos; _categoriaDe = categoriaDeRol;
        OrdenDeRoles = ordenDeRoles;
    }

    /// <summary>Los códigos de rol en el orden del Catálogo (categoría seguida de sus subcategorías).</summary>
    public IReadOnlyList<string> OrdenDeRoles { get; }

    public string NombreDeRol(string codigo) => _roles.GetValueOrDefault(codigo) ?? codigo;
    public string NombreDeServicio(string codigo) => _servicios.GetValueOrDefault(codigo) ?? codigo;
    public string NombreDeInstrumento(string codigo) => _instrumentos.GetValueOrDefault(codigo) ?? codigo;

    public IEnumerable<string> CategoriasDe(PersonaDelDirectorioDto persona) =>
        persona.Roles.Select(r => _categoriaDe.GetValueOrDefault(r) ?? r).Distinct();
}
