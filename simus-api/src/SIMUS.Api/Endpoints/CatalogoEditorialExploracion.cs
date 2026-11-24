using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Lo que pide quien explora el catálogo público: búsqueda, filtros y orden.
/// </summary>
/// <remarks>
/// Los nombres de los filtros son los de la dirección del portal (`/editorial?...`), de modo que la
/// pantalla los pasa tal cual. Todo va en minúsculas y sin tildes al comparar.
/// </remarks>
internal sealed record ConsultaDeExploracionEditorial(
    string? Q, string? Titulo, string? Autoria, string? Clave, string? PalabraClave,
    string? Categoria, string? Subcategoria, string? Material, string? Soporte, string? Anio,
    string? Autor, string? Orden, string? Sentido);

/// <summary>
/// La exploración del catálogo público: filtra, ordena, pagina y calcula las facetas EN EL SERVIDOR.
/// </summary>
/// <remarks>
/// <para>
/// POR QUE EN MEMORIA Y NO EN SQL. El acervo publicado es un fondo curado de unos pocos cientos de
/// fichas, y el tipo de material se deduce de la tipología y de un texto de origen con expresiones
/// regulares, que SQL no sabe leer. Se lee una proyección liviana de lo publicable (sin accesos
/// bloqueados) y se filtra aquí; las fichas completas solo se arman para la página pedida. Si el fondo
/// creciera a miles, el índice pasa a una vista materializada sin cambiar el contrato.
/// </para>
/// <para>
/// EL NAVEGADOR YA NO ORDENA NI FILTRA: antes bajaba el acervo entero página a página y lo
/// trabajaba él. Las facetas (secciones, años, temas) se calculan sobre la categoría elegida, igual
/// que antes, pero con el conteo del servidor.
/// </para>
/// </remarks>
internal static class CatalogoEditorialExploracion
{
    internal sealed record Indice(
        long Id, string Codigo, string Titulo, int? AnioInicio, int? AnioFin,
        string? Categoria, string? Subcategoria, string? TipoPublicacion,
        string AutoriaVisible, string TextoDeAutoria, string TextoDeBusqueda, string TextoDeMateria,
        string[] NombresDeCreditos, string[] PalabrasClave, string Material, string[] Soportes,
        (string Codigo, string Etiqueta)[] SoportesConEtiqueta);

    // ─────────────────────────── Tipo de material ───────────────────────────

    /// <summary>Los siete tipos y el orden en que se ofrecen. Espejo de `tipo-de-material.ts` del portal.</summary>
    internal static readonly (string Id, string Etiqueta)[] TiposDeMaterial =
    [
        ("libro", "Libro"), ("guia", "Guía o manual"), ("partitura", "Partitura"), ("audio", "Audio"),
        ("video", "Video"), ("digital", "Recurso digital"), ("mixto", "Material mixto"),
    ];

    private static readonly Regex RxPartitura = new("partitura|cancionero", RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex RxAudio = new(@"(?:^|[^a-z])\d*cds?(?![a-z])|\bdisco\b", RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex RxVideo = new("dvd|vhs|video", RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex RxDigital = new(@"\bapp\b|curso virtual|multimedia|cd-?\s?rom|virtual|digital", RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex RxGuia = new("guia|manual|cuaderno", RegexOptions.CultureInvariant | RegexOptions.Compiled);

    /// <summary>
    /// El tipo de material de una ficha, por la misma tabla de prioridades que documenta
    /// `tipo-de-material.ts`: partitura, mixto, audio, video, digital, guía y, si nada aplica, libro.
    /// </summary>
    internal static string ClasificarMaterial(string? tipoPublicacion, IReadOnlyCollection<(string Eje, string Codigo)> tipologia)
    {
        var origen = Plano(tipoPublicacion);
        var recursos = tipologia.Where(t => t.Eje == "recurso").Select(t => t.Codigo).ToHashSet();
        var esMusicaNotada = tipologia.Any(t => t.Eje == "contenido" && t.Codigo == "musica-notada");

        if (esMusicaNotada || RxPartitura.IsMatch(origen)) return "partitura";
        if (recursos.Count >= 2) return "mixto";
        if (recursos.Contains("sound") || (RxAudio.IsMatch(origen) && !origen.Contains("rom", StringComparison.Ordinal))) return "audio";
        if (recursos.Contains("movingimage") || RxVideo.IsMatch(origen)) return "video";
        if (recursos.Contains("interactiveresource") || RxDigital.IsMatch(origen)) return "digital";
        if (RxGuia.IsMatch(origen)) return "guia";
        return "libro";
    }

    private static readonly Dictionary<string, string> SoporteEnLlano = new(StringComparer.Ordinal)
    {
        ["volumen"] = "Impreso", ["disco-de-audio"] = "CD de audio", ["videodisco"] = "DVD",
        ["disco-de-computador"] = "CD-ROM", ["recurso-en-linea"] = "En línea",
    };

    /// <summary>El soporte en la palabra de uso común: «volumen» es RDA 338 y quien busca dice «impreso».</summary>
    internal static string EtiquetaDeSoporte(string codigo, string respaldo) =>
        SoporteEnLlano.TryGetValue(codigo, out var llano) ? llano : respaldo;

    // ─────────────────────────── Texto ───────────────────────────

    /// <summary>Sin tildes y en minúsculas: así se comparan los textos de la fuente.</summary>
    internal static string Plano(string? texto)
    {
        if (string.IsNullOrEmpty(texto)) return string.Empty;
        var descompuesto = texto.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(descompuesto.Length);
        foreach (var c in descompuesto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant().Trim();
    }

    /// <summary>
    /// La clave de un tema: sin tildes, en minúsculas y con cada palabra en singular.
    /// «Bandas» y «banda», «festivales» y «festival», «Música» y «musica» son el mismo tema.
    /// </summary>
    internal static string ClaveDeTema(string? termino)
    {
        var palabras = Plano(termino).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Join(' ', palabras.Select(SingularDe));
    }

    private static string SingularDe(string palabra)
    {
        if (palabra.Length <= 3 || !palabra.EndsWith('s')) return palabra;
        // «festivales», «mujeres», «cantores»: el plural con «es» solo si la raíz acaba en l, r, n, d o z.
        if (palabra.EndsWith("es", StringComparison.Ordinal) && palabra.Length > 4 && "lrndz".Contains(palabra[^3]))
            return palabra[..^2];
        return palabra[..^1];
    }

    private static string Unir(IEnumerable<string?> valores) =>
        string.Join("; ", valores.Select(v => (v ?? string.Empty).Trim()).Where(v => v.Length > 0).Distinct(StringComparer.Ordinal));

    /// <summary>Hasta tres nombres y cuántos quedan fuera; es con lo que se cita la obra de un vistazo.</summary>
    private static string Acotar(IEnumerable<string> nombres)
    {
        var unicos = nombres.Select(n => n.Trim()).Where(n => n.Length > 0).Distinct(StringComparer.Ordinal).ToList();
        return unicos.Count <= 3 ? string.Join("; ", unicos) : $"{string.Join("; ", unicos.Take(3))} y {unicos.Count - 3} más";
    }

    private static string TextoDelAnio(int? inicio, int? fin) =>
        inicio is not null && fin is not null && inicio != fin ? $"{inicio} – {fin}" : (inicio ?? fin)?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;

    // ─────────────────────────── Índice ───────────────────────────

    /// <summary>
    /// Lo publicable, con lo mínimo para filtrar y ordenar. Seis consultas sobre todo el fondo, no
    /// una por ficha.
    /// </summary>
    internal static async Task<List<Indice>> LeerIndiceAsync(SimusDbContext db, CancellationToken ct)
    {
        var fichas = await db.PublicacionesEditoriales.AsNoTracking()
            .Where(x => x.EstadoCatalogacion == "validada"
                     && x.EstadoPublicacion == "publicado"
                     && x.DerechosPermitePublicarFicha
                     && db.PublicacionesEditorialesFuentes.Any(f => f.PublicacionEditorialId == x.Id))
            .ToListAsync(ct);
        if (fichas.Count == 0) return [];

        var categoriaIds = fichas.SelectMany(f => new[] { f.CategoriaId, f.SubcategoriaEditorialId })
            .Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();
        var categorias = await db.Categorias.AsNoTracking().Where(c => categoriaIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.NombreCategoria, ct);

        var creditos = (await db.CreditosEditoriales.AsNoTracking()
            .Join(db.AgentesEditoriales.AsNoTracking(), c => c.AgenteEditorialId, a => a.Id,
                (c, a) => new { c.PublicacionEditorialId, c.Orden, c.Id, c.Principal, c.RolEtiqueta, a.NombrePreferido, a.Tipo })
            .ToListAsync(ct))
            .GroupBy(x => x.PublicacionEditorialId)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Orden).ThenBy(x => x.Id).ToList());

        var claves = (await db.PalabrasClaveEditoriales.AsNoTracking()
            .OrderBy(x => x.Termino).Select(x => new { x.PublicacionEditorialId, x.Termino }).ToListAsync(ct))
            .GroupBy(x => x.PublicacionEditorialId).ToDictionary(g => g.Key, g => g.Select(x => x.Termino).ToArray());

        var tipologias = (await db.PublicacionesEditorialesTipologias.AsNoTracking()
            .Join(db.TipologiasEditoriales.AsNoTracking(), x => x.TipologiaEditorialId, tp => tp.Id,
                (x, tp) => new { x.PublicacionEditorialId, tp.Eje, tp.Codigo, tp.Etiqueta })
            .ToListAsync(ct))
            .GroupBy(x => x.PublicacionEditorialId).ToDictionary(g => g.Key, g => g.ToList());

        var practicas = (await db.PublicacionesEditorialesPracticasMusicales.AsNoTracking()
            .Join(db.PracticasMusicales.AsNoTracking(), p => p.PracticaMusicalId, m => m.Id,
                (p, m) => new { p.PublicacionEditorialId, m.Nombre })
            .ToListAsync(ct))
            .GroupBy(x => x.PublicacionEditorialId).ToDictionary(g => g.Key, g => g.Select(x => x.Nombre).OrderBy(n => n, StringComparer.Ordinal).ToArray());

        var accesos = (await db.AccesosEditoriales.AsNoTracking()
            .Where(x => (x.Tipo == "archivo" && x.DerechosPermitePublicarArchivo) || (x.Tipo != "archivo" && x.DerechosPermitePublicarFicha))
            .Select(x => new { x.PublicacionEditorialId, x.UbicacionFisica, x.Etiqueta, x.Url })
            .ToListAsync(ct))
            .GroupBy(x => x.PublicacionEditorialId)
            .ToDictionary(g => g.Key, g => string.Join(' ', g.Select(a => $"{a.UbicacionFisica} {a.Etiqueta} {a.Url}")));

        var resultado = new List<Indice>(fichas.Count);
        foreach (var f in fichas)
        {
            var cs = creditos.GetValueOrDefault(f.Id) ?? [];
            static bool EsEntidad(string? tipo) => string.Equals((tipo ?? string.Empty).Trim(), "entidad", StringComparison.OrdinalIgnoreCase);
            var personas = cs.Where(c => c.Principal && !EsEntidad(c.Tipo)).ToList();
            var entidades = cs.Where(c => c.Principal && EsEntidad(c.Tipo)).ToList();
            var secundarios = cs.Where(c => !c.Principal).ToList();
            var autor = Unir(personas.Select(c => c.NombrePreferido));
            var corporativo = Unir(entidades.Select(c => c.NombrePreferido));
            var entidadesCualesquiera = entidades.Count > 0 ? entidades : cs.Where(c => EsEntidad(c.Tipo)).ToList();
            var personasCualesquiera = personas.Count > 0 ? personas : cs.Where(c => !EsEntidad(c.Tipo)).ToList();
            var visible = Acotar((entidadesCualesquiera.Count > 0 ? entidadesCualesquiera : personasCualesquiera).Select(c => c.NombrePreferido));
            var autoriaVisible = autor.Length > 0 ? autor : corporativo.Length > 0 ? corporativo : visible;
            var adicionales = Unir(secundarios.Select(c => $"{c.NombrePreferido} ({c.RolEtiqueta})"));

            var categoria = f.CategoriaId is { } cid ? categorias.GetValueOrDefault(cid) : null;
            var subcategoria = f.SubcategoriaEditorialId is { } sid ? categorias.GetValueOrDefault(sid) : null;
            var ruta = categoria is null ? string.Empty : subcategoria is null ? categoria : $"{categoria} > {subcategoria}";
            var practica = practicas.GetValueOrDefault(f.Id) is { Length: > 0 } p ? string.Join(" · ", p) : string.Empty;
            var palabras = claves.GetValueOrDefault(f.Id) ?? [];
            var tipologia = tipologias.GetValueOrDefault(f.Id) ?? [];
            var soportes = tipologia.Where(t => t.Eje == "soporte").Select(t => (t.Codigo, EtiquetaDeSoporte(t.Codigo, t.Etiqueta))).ToArray();

            var textoDeAutoria = Plano(string.Join(' ', new[] { autoriaVisible, autor, corporativo, adicionales }
                .Concat(cs.Select(c => c.NombrePreferido))));
            var materia = Plano(string.Join(' ', new[] { categoria, ruta, practica, categoria, subcategoria }.Concat(palabras)));
            var busqueda = Plano(string.Join(' ', new[]
            {
                f.Codigo, f.Titulo, f.Subtitulo, TextoDelAnio(f.AnioInicio, f.AnioFin), categoria, ruta, f.TipoPublicacion, practica,
                categoria, subcategoria, autor, corporativo, adicionales, f.Ambito, accesos.GetValueOrDefault(f.Id), f.Resumen,
            }.Concat(palabras)));

            resultado.Add(new Indice(
                f.Id, f.Codigo, f.Titulo, f.AnioInicio, f.AnioFin, categoria, subcategoria, f.TipoPublicacion,
                autoriaVisible, textoDeAutoria, busqueda, materia,
                cs.Select(c => Plano(c.NombrePreferido)).Distinct().ToArray(), palabras,
                ClasificarMaterial(f.TipoPublicacion, tipologia.Select(t => (t.Eje, t.Codigo)).ToArray()),
                soportes.Select(s => s.Codigo).ToArray(), soportes));
        }
        return resultado;
    }

    private static IEnumerable<int> AniosDe(Indice f)
    {
        if (f.AnioInicio is { } a && f.AnioFin is { } b && b >= a && b - a <= 10)
        {
            for (var y = a; y <= b; y++) yield return y;
            yield break;
        }
        if (f.AnioInicio is { } i) yield return i;
        if (f.AnioFin is { } fin && fin != f.AnioInicio) yield return fin;
    }

    // ─────────────────────────── Filtrar, ordenar, facetas ───────────────────────────

    internal static List<Indice> Filtrar(IEnumerable<Indice> fichas, ConsultaDeExploracionEditorial c, bool incluirCategoria)
    {
        var q = Plano(c.Q); var titulo = Plano(c.Titulo); var autoria = Plano(c.Autoria); var clave = Plano(c.Clave);
        var tema = string.IsNullOrWhiteSpace(c.PalabraClave) ? null : ClaveDeTema(c.PalabraClave);
        var categoria = Plano(c.Categoria); var subcategoria = Plano(c.Subcategoria);
        var material = (c.Material ?? string.Empty).Trim(); var soporte = (c.Soporte ?? string.Empty).Trim();
        var anio = int.TryParse(c.Anio, NumberStyles.None, CultureInfo.InvariantCulture, out var y) ? y : (int?)null;
        var autor = Plano(c.Autor);

        return fichas.Where(f =>
        {
            if (incluirCategoria && categoria.Length > 0 && Plano(f.Categoria) != categoria) return false;
            if (subcategoria.Length > 0 && Plano(f.Subcategoria) != subcategoria) return false;
            if (material.Length > 0 && f.Material != material) return false;
            if (soporte.Length > 0 && !f.Soportes.Contains(soporte)) return false;
            if (tema is not null && !f.PalabrasClave.Any(k => ClaveDeTema(k) == tema)) return false;
            if (anio is not null && !AniosDe(f).Contains(anio.Value)) return false;
            if (titulo.Length > 0 && !Plano(f.Titulo).Contains(titulo, StringComparison.Ordinal)) return false;
            if (autoria.Length > 0 && !f.TextoDeAutoria.Contains(autoria, StringComparison.Ordinal)) return false;
            if (clave.Length > 0 && !f.TextoDeMateria.Contains(clave, StringComparison.Ordinal)) return false;
            if (autor.Length > 0 && !f.NombresDeCreditos.Contains(autor)) return false;
            return q.Length == 0 || f.TextoDeBusqueda.Contains(q, StringComparison.Ordinal);
        }).ToList();
    }

    /// <summary>Los campos por los que se puede ordenar. Cualquier otro valor cae en el título.</summary>
    internal static readonly string[] CamposDeOrden = ["titulo", "categoria", "autoria", "anio"];

    internal static List<Indice> Ordenar(List<Indice> fichas, string? orden, string? sentido)
    {
        var pedido = Plano(orden);
        var campo = CamposDeOrden.Contains(pedido) ? pedido : "titulo";
        var descendente = pedido == "za" || string.Equals(sentido, "desc", StringComparison.OrdinalIgnoreCase);
        static string Titulo(Indice f) => Plano(string.IsNullOrWhiteSpace(f.Titulo) ? f.Codigo : f.Titulo);

        // LO QUE NO TIENE VALOR VA AL FINAL EN AMBOS SENTIDOS: ordenar por año no puede abrir con cuarenta «sin fecha».
        Func<Indice, bool> tieneValor = campo switch
        {
            "categoria" => f => !string.IsNullOrWhiteSpace(f.Categoria),
            "autoria" => f => f.AutoriaVisible.Length > 0,
            "anio" => f => (f.AnioInicio ?? f.AnioFin) is not null,
            _ => _ => true,
        };
        Func<Indice, string> clave = campo switch
        {
            "categoria" => f => Plano(f.Categoria),
            "autoria" => f => Plano(f.AutoriaVisible),
            // El año se ordena como texto con ceros a la izquierda: así comparte el mismo mecanismo.
            "anio" => f => (f.AnioInicio ?? f.AnioFin ?? 0).ToString("D6", CultureInfo.InvariantCulture),
            _ => Titulo,
        };

        var con = fichas.Where(tieneValor);
        var ordenadas = descendente ? con.OrderByDescending(clave, StringComparer.Ordinal) : con.OrderBy(clave, StringComparer.Ordinal);
        var resultado = ordenadas.ThenBy(Titulo, StringComparer.Ordinal).ThenBy(f => f.Id).ToList();
        resultado.AddRange(fichas.Where(f => !tieneValor(f)).OrderBy(Titulo, StringComparer.Ordinal).ThenBy(f => f.Id));
        return resultado;
    }

    /// <summary>
    /// Las facetas. Las categorías se cuentan sobre todo el fondo; el resto, sobre la categoría
    /// elegida (como antes), de modo que cada opción dice cuántas fichas deja.
    /// </summary>
    internal static FacetasDelCatalogoEditorialDto Facetas(IReadOnlyList<Indice> todas, ConsultaDeExploracionEditorial c)
    {
        var categorias = todas.Where(f => !string.IsNullOrWhiteSpace(f.Categoria))
            .GroupBy(f => f.Categoria!, StringComparer.Ordinal)
            .Select(g => new FacetaEditorialDto(g.Key, g.Key, g.Count()))
            .OrderBy(x => Plano(x.Nombre), StringComparer.Ordinal).ToList();

        var categoria = Plano(c.Categoria);
        var alcance = categoria.Length == 0 ? todas : todas.Where(f => Plano(f.Categoria) == categoria).ToList();

        var subcategorias = alcance.Where(f => !string.IsNullOrWhiteSpace(f.Subcategoria))
            .GroupBy(f => f.Subcategoria!, StringComparer.Ordinal)
            .Select(g => new FacetaEditorialDto(g.Key, g.Key, g.Count()))
            .OrderBy(x => Plano(x.Nombre), StringComparer.Ordinal).ToList();

        var materiales = TiposDeMaterial
            .Select(t => new FacetaEditorialDto(t.Id, t.Etiqueta, alcance.Count(f => f.Material == t.Id)))
            .Where(x => x.Total > 0).ToList();

        var soportes = alcance.SelectMany(f => f.SoportesConEtiqueta.DistinctBy(s => s.Codigo))
            .GroupBy(s => s.Codigo, StringComparer.Ordinal)
            .Select(g => new FacetaEditorialDto(g.Key, g.First().Etiqueta, g.Count()))
            .OrderByDescending(x => x.Total).ThenBy(x => x.Nombre, StringComparer.Ordinal).ToList();

        var anios = alcance.SelectMany(f => AniosDe(f).Distinct().Select(y => (f.Id, y)))
            .GroupBy(t => t.y).OrderByDescending(g => g.Key)
            .Select(g => new FacetaEditorialDto(g.Key.ToString(CultureInfo.InvariantCulture), g.Key.ToString(CultureInfo.InvariantCulture), g.Select(t => t.Id).Distinct().Count()))
            .ToList();

        // LOS TEMAS SE AGRUPAN POR SU CLAVE (sin tildes, en singular): «banda» y «bandas» cuentan juntos y el
        // nombre que se muestra es la forma que más usa el fondo.
        var temas = alcance.SelectMany(f => f.PalabrasClave.Select(k => (f.Id, Clave: ClaveDeTema(k), Nombre: k)).Where(t => t.Clave.Length > 0))
            .GroupBy(t => t.Clave, StringComparer.Ordinal)
            .Select(g => new FacetaEditorialDto(
                g.GroupBy(t => t.Nombre, StringComparer.Ordinal).OrderByDescending(n => n.Count()).ThenBy(n => n.Key, StringComparer.Ordinal).First().Key,
                g.GroupBy(t => t.Nombre, StringComparer.Ordinal).OrderByDescending(n => n.Count()).ThenBy(n => n.Key, StringComparer.Ordinal).First().Key,
                g.Select(t => t.Id).Distinct().Count()))
            .OrderByDescending(x => x.Total).ThenBy(x => Plano(x.Nombre), StringComparer.Ordinal).ToList();

        return new FacetasDelCatalogoEditorialDto(todas.Count, alcance.Count, categorias, subcategorias, materiales, soportes, anios, temas);
    }
}
