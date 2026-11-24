using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Importación de un catálogo desde una hoja de cálculo (CSV), para que el área misional trabaje en Excel.
/// </summary>
/// <remarks>
/// <para>
/// <b>PRIMERO LA VISTA PREVIA, DESPUÉS LA APLICACIÓN.</b> Con <c>aplicar = false</c> se valida cada fila y se dice qué se
/// crearía, qué se cambiaría y qué falla, sin escribir nada. Con <c>aplicar = true</c> se hace TODO O NADA: si una sola fila
/// tiene un error, no se guarda ninguna.
/// </para>
/// <para>
/// <b>COLUMNAS.</b> Solo se tocan las columnas que vienen en la hoja: una columna ausente deja el campo como está y una
/// columna presente y vacía lo borra. Una fila se empareja por «Id» o, si no lo trae, por el nombre sin tildes ni
/// mayúsculas; si no hay pareja, se crea. Nunca se elimina nada: lo que la hoja no menciona queda igual.
/// </para>
/// </remarks>
public static partial class CatalogosEndpoints
{
    private sealed record Campo(string Clave, string Rotulo, Func<ElementoDeCatalogoDto, string?> Leer, int Max);

    private static readonly Campo[] CamposDeTexto =
    [
        new("sinonimos", "Sinónimos", x => x.Sinonimos, MaxSinonimos),
        new("definicionbreve", "Definición breve", x => x.DefinicionBreve, MaxDefinicionBreve),
        new("fichaampliada", "Ficha ampliada", x => x.DefinicionAmpliada, MaxDefinicionAmpliada),
        new("caracteristicas", "Características", x => x.Caracteristicas, MaxTextoDeFicha),
        new("relacionterritorial", "Relación territorial", x => x.RelacionTerritorial, MaxTextoDeFicha),
        new("contextos", "Contextos", x => x.Contextos, MaxTextoDeFicha),
        new("ejemplos", "Ejemplos", x => x.Ejemplos, MaxTextoDeFicha),
        new("fuente", "Fuente", x => x.Fuentes, MaxTextoDeFicha),
        new("observaciones", "Observaciones", x => x.Observaciones, MaxObservaciones),
    ];

    /// <summary>Nombres alternativos de columna, ya normalizados, que se aceptan al importar.</summary>
    private static readonly Dictionary<string, string> SinonimosDeColumna = new()
    {
        ["sinonimos"] = "sinonimos", ["definicionampliada"] = "fichaampliada", ["fuentes"] = "fuente", ["padre"] = "principal",
        ["practicaprincipal"] = "principal", ["definicionpreliminar"] = "preliminar", ["estado"] = "activo", ["direccion"] = "slug",
    };

    private static string Clave(string columna) => ReglasDeNoticias.SlugDesde(columna).Replace("-", string.Empty);

    private static async Task<IResult> Importar<TItem, TFicha>(SimusDbContext db, ClaimsPrincipal quien,
        DescriptorDeCatalogo<TItem, TFicha> d, ImportarCatalogoSolicitud s, CancellationToken ct)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        const int MaxFilas = 500;
        var entrada = s.Filas ?? [];
        if (entrada.Count == 0) return Results.BadRequest(new { filas = HojaVacia });
        if (entrada.Count > MaxFilas) return Results.BadRequest(new { filas = new[] { $"Una importación admite hasta {MaxFilas} filas." } });

        var existentes = await ConstruirAsync(db, d, ct);
        var porId = existentes.ToDictionary(x => x.Id);
        var porNombre = new Dictionary<string, ElementoDeCatalogoDto>();
        foreach (var x in existentes) porNombre[Clave(x.Nombre)] = x;

        var planes = new List<Plan>();
        var vistos = new HashSet<string>();
        var numero = 0;
        foreach (var cruda in entrada)
        {
            numero++;
            var fila = cruda.GroupBy(k => Normaliza(k.Key)).ToDictionary(g => g.Key, g => g.Last().Value);
            var errores = new List<string>();
            fila.TryGetValue("nombre", out var nombreCrudo);
            var nombre = Limpiar(nombreCrudo);
            ElementoDeCatalogoDto? actual = null;
            if (fila.TryGetValue("id", out var idTexto) && !string.IsNullOrWhiteSpace(idTexto))
            {
                if (!int.TryParse(idTexto.Trim(), CultureInfo.InvariantCulture, out var id) || !porId.TryGetValue(id, out actual))
                    errores.Add($"El Id «{idTexto.Trim()}» no existe en este catálogo.");
            }
            else if (nombre is not null) porNombre.TryGetValue(Clave(nombre), out actual);

            if (nombre is null && actual is null) errores.Add("Falta el nombre.");
            nombre ??= actual?.Nombre ?? string.Empty;
            if (nombre.Length > MaxNombre) errores.Add($"El nombre admite hasta {MaxNombre} caracteres.");
            if (nombre.Length > 0 && !vistos.Add(actual is null ? "n:" + Clave(nombre) : "i:" + actual.Id.ToString(CultureInfo.InvariantCulture)))
                errores.Add("El elemento aparece repetido en la hoja.");

            var plan = new Plan(numero, nombre, actual, fila, errores);
            planes.Add(plan);
        }

        // Los nombres nuevos de la hoja también cuentan como «principales» posibles.
        var nombresDeLaHoja = planes.Where(p => p.Errores.Count == 0).Select(p => Clave(p.Nombre)).ToHashSet();
        foreach (var p in planes.Where(p => p.Errores.Count == 0)) Evaluar(p, d, existentes, nombresDeLaHoja);

        // Dos niveles: quien figura como principal en la hoja no puede tener a su vez un principal.
        var conPrincipal = planes.Where(p => p.Errores.Count == 0 && p.ConPrincipal && p.Principal is not null).ToList();
        foreach (var p in conPrincipal)
        {
            var clavePrincipal = Clave(p.Principal!);
            if (conPrincipal.Any(q => Clave(q.Nombre) == clavePrincipal))
                p.Errores.Add($"«{p.Principal}» tiene a su vez un principal en la hoja: solo se admiten dos niveles.");
        }

        var hayErrores = planes.Any(p => p.Errores.Count > 0);
        var aplicada = false;
        if (s.Aplicar && !hayErrores) { await AplicarPlanesAsync(db, quien, d, planes, ct); aplicada = true; }

        var salida = planes.Select(p => new FilaDeImportacionDeCatalogoDto(p.Numero, p.Nombre,
            p.Errores.Count > 0 ? "error" : p.Actual is null ? "crear" : p.Cambios.Count == 0 ? "sin-cambios" : "actualizar",
            p.Cambios, p.Errores)).ToList();
        return Results.Ok(new ResultadoDeImportacionDeCatalogoDto(aplicada,
            salida.Count(f => f.Accion == "crear"), salida.Count(f => f.Accion == "actualizar"),
            salida.Count(f => f.Accion == "sin-cambios"), salida.Count(f => f.Accion == "error"), salida));
    }

    private sealed class Plan(int numero, string nombre, ElementoDeCatalogoDto? actual, Dictionary<string, string?> fila, List<string> errores)
    {
        public int Numero { get; } = numero;
        public string Nombre { get; } = nombre;
        public ElementoDeCatalogoDto? Actual { get; } = actual;
        public Dictionary<string, string?> Fila { get; } = fila;
        public List<string> Errores { get; } = errores;
        public List<string> Cambios { get; } = [];
        public Dictionary<string, string?> Textos { get; } = [];
        public int? Orden { get; set; }
        public bool? Activo { get; set; }
        public bool? Preliminar { get; set; }
        public string? Principal { get; set; }
        public bool ConPrincipal { get; set; }
        public string? Slug { get; set; }
    }

    private static string Normaliza(string columna)
    {
        var k = Clave(columna);
        return SinonimosDeColumna.GetValueOrDefault(k, k);
    }

    private static void Evaluar<TItem, TFicha>(Plan p, DescriptorDeCatalogo<TItem, TFicha> d,
        List<ElementoDeCatalogoDto> existentes, HashSet<string> nombresDeLaHoja)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var a = p.Actual;
        void Cambio(string rotulo) => p.Cambios.Add(rotulo);

        foreach (var c in CamposDeTexto)
        {
            if (!p.Fila.TryGetValue(c.Clave, out var crudo)) continue;
            if (c.Clave == "relacionterritorial" && d.Relacion is null) continue;
            var valor = c.Clave == "sinonimos" ? LimpiarSinonimos(crudo) : Limpiar(crudo);
            if (valor is not null && valor.Length > c.Max) { p.Errores.Add($"{c.Rotulo} admite hasta {c.Max} caracteres."); continue; }
            p.Textos[c.Clave] = valor;
            if (!string.Equals(valor, c.Leer(a ?? Vacio), StringComparison.Ordinal)) Cambio(c.Rotulo);
        }
        if (p.Fila.TryGetValue("orden", out var ordenTxt) && !string.IsNullOrWhiteSpace(ordenTxt))
        {
            if (!int.TryParse(ordenTxt.Trim(), CultureInfo.InvariantCulture, out var o) || o < 1 || o > MaxOrden) p.Errores.Add($"El orden «{ordenTxt.Trim()}» no es válido (1 a {MaxOrden}).");
            else { p.Orden = o; if (a is null || a.Orden != o) Cambio("Orden"); }
        }
        if (p.Fila.TryGetValue("activo", out var activoTxt) && !string.IsNullOrWhiteSpace(activoTxt))
        {
            var v = ReglasDeNoticias.SlugDesde(activoTxt);
            bool? parsed = v is "si" or "1" or "true" or "activo" or "activa" or "x" ? true : v is "no" or "0" or "false" or "inactivo" or "inactiva" ? false : null;
            if (parsed is null) p.Errores.Add($"«{activoTxt.Trim()}» no es un estado válido: use Sí o No.");
            else { p.Activo = parsed; if (a is null ? !parsed.Value : a.Activo != parsed) Cambio("Activo"); }
        }
        if (p.Fila.TryGetValue("preliminar", out var preTxt) && !string.IsNullOrWhiteSpace(preTxt))
        {
            var v = ReglasDeNoticias.SlugDesde(preTxt);
            bool? parsed = v is "si" or "1" or "true" or "preliminar" or "x" ? true : v is "no" or "0" or "false" ? false : null;
            if (parsed is null) p.Errores.Add($"«{preTxt.Trim()}» no es válido en «Definición preliminar»: use Sí o No.");
            else { p.Preliminar = parsed; if ((a?.EsPreliminar ?? false) != parsed) Cambio("Definición preliminar"); }
        }
        if (p.Fila.TryGetValue("principal", out var principalTxt) && d.FijarPadre is not null)
        {
            p.ConPrincipal = true;
            p.Principal = Limpiar(principalTxt);
            if (p.Principal is not null)
            {
                var clave = Clave(p.Principal);
                var enCatalogo = existentes.FirstOrDefault(x => Clave(x.Nombre) == clave);
                if (!nombresDeLaHoja.Contains(clave) && enCatalogo is null) p.Errores.Add($"El principal «{p.Principal}» no existe.");
                else if (clave == Clave(p.Nombre)) p.Errores.Add("Un elemento no puede ser su propio principal.");
                else if (enCatalogo?.PadreId is not null) p.Errores.Add($"«{p.Principal}» ya es subelemento de otro: solo se admiten dos niveles.");
            }
            if (!string.Equals(p.Principal, a?.PadreNombre, StringComparison.OrdinalIgnoreCase)) Cambio("Principal");
        }
        if (p.Fila.TryGetValue("slug", out var slugTxt) && !string.IsNullOrWhiteSpace(slugTxt))
        {
            p.Slug = ReglasDeNoticias.SlugDesde(slugTxt);
            if (a is not null && p.Slug != a.Slug) Cambio("Dirección");
        }
        if (a is null) p.Cambios.Insert(0, "Elemento nuevo");
    }

    private static readonly ElementoDeCatalogoDto Vacio = new(0, string.Empty, string.Empty, 0, true, null, null, null, null, null, null,
        null, null, null, null, null, false, null, null, null, null, 0, [], 0, "pendiente");

    private static async Task AplicarPlanesAsync<TItem, TFicha>(SimusDbContext db, ClaimsPrincipal quien,
        DescriptorDeCatalogo<TItem, TFicha> d, List<Plan> planes, CancellationToken ct)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var estrategia = db.Database.CreateExecutionStrategy();
        await estrategia.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var todos = await d.Items(db).ToListAsync(ct);
            var fichas = (await d.Fichas(db).ToListAsync(ct)).ToDictionary(d.ClaveDeFicha);
            var siguiente = todos.Count == 0 ? 1 : todos.Max(x => x.Orden) + 1;
            var ahora = DateTime.UtcNow;
            var creados = new List<(Plan Plan, TItem Fila)>();
            var antesPorId = new Dictionary<int, Dictionary<string, string?>>();

            foreach (var p in planes)
            {
                TItem fila;
                if (p.Actual is null)
                {
                    fila = new TItem { Nombre = p.Nombre, Slug = UnicoSlug(todos, p.Slug ?? ReglasDeNoticias.SlugDesde(p.Nombre)), Orden = p.Orden ?? siguiente++, Activo = p.Activo ?? true };
                    d.Items(db).Add(fila);
                    todos.Add(fila);
                    creados.Add((p, fila));
                }
                else
                {
                    fila = todos.First(x => x.Id == p.Actual.Id);
                    fichas.TryGetValue(fila.Id, out var f0);
                    antesPorId[fila.Id] = InstantaneaPublica(fila, f0, d);
                    if (p.Orden is { } o) fila.Orden = o;
                    if (p.Activo is { } ac) fila.Activo = ac;
                    if (p.Slug is { } sl && sl.Length > 0 && sl != fila.Slug) fila.Slug = UnicoSlug(todos.Where(x => x.Id != fila.Id).ToList(), sl);
                }
                if (p.Textos.TryGetValue("sinonimos", out var alias)) fila.Sinonimos = alias;
                if (p.Textos.TryGetValue("observaciones", out var obs)) fila.Observaciones = obs;
                fila.FechaActualizacion = ahora;
            }
            await db.SaveChangesAsync(ct);

            var porClaveDeNombre = todos.ToDictionary(x => Clave(x.Nombre), x => x);
            foreach (var p in planes)
            {
                var fila = p.Actual is null ? creados.First(c => c.Plan == p).Fila : todos.First(x => x.Id == p.Actual.Id);
                if (!fichas.TryGetValue(fila.Id, out var ficha))
                {
                    ficha = new TFicha();
                    d.FijarClave(ficha, fila.Id);
                    d.Fichas(db).Add(ficha);
                    fichas[fila.Id] = ficha;
                }
                if (p.Textos.TryGetValue("definicionbreve", out var br)) ficha.DefinicionBreve = br;
                if (p.Textos.TryGetValue("fichaampliada", out var am)) ficha.DefinicionAmpliada = am;
                if (p.Textos.TryGetValue("caracteristicas", out var ca)) ficha.Caracteristicas = ca;
                if (p.Textos.TryGetValue("relacionterritorial", out var re)) d.FijarRelacion?.Invoke(ficha, re);
                if (p.Textos.TryGetValue("contextos", out var co)) ficha.Contextos = co;
                if (p.Textos.TryGetValue("ejemplos", out var ej)) ficha.Ejemplos = ej;
                if (p.Textos.TryGetValue("fuente", out var fu)) ficha.Fuentes = fu;
                if (p.Preliminar is { } pre) ficha.EsPreliminar = pre;
                ficha.FechaActualizacion = ahora;
                if (p.ConPrincipal && d.FijarPadre is not null)
                    d.FijarPadre(fila, p.Principal is null ? null : porClaveDeNombre[Clave(p.Principal)].Id);

                AuditarDesdeImportacion(db, quien, d, fila, ficha, p.Actual is null ? "crear" : "actualizar", p.Actual is null ? null : antesPorId[fila.Id]);
            }
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });
    }

    private static string UnicoSlug<TItem>(List<TItem> todos, string deseado) where TItem : IElementoDeCatalogo
    {
        var slug = deseado;
        for (var n = 2; todos.Any(x => x.Slug == slug); n++) slug = deseado + "-" + n.ToString(CultureInfo.InvariantCulture);
        return slug;
    }
}
