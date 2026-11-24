using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Catálogo Editorial: consola institucional y consulta pública.
///
/// <para>
/// LAS DOS DECISIONES NO SE MEZCLAN. `EstadoCatalogacion` dice si la ficha está bien hecha;
/// `EstadoPublicacion` dice si se ve. Guardar no cambia la visibilidad, y publicar no valida
/// nada: son operaciones distintas con permisos distintos.
/// </para>
/// <para>
/// LA PUERTA DE LO PUBLICO EXIGE CUATRO COSAS A LA VEZ, y está escrita UNA sola vez en
/// <see cref="EsVisiblePublicamente"/>: ficha validada, estado publicado, al menos una fuente y
/// derechos que permitan publicar la ficha. Repartida entre el listado y el detalle, la primera
/// que alguien olvidara abriría una ficha sin derechos por la mitad que no se revisó.
/// </para>
/// </summary>
public static class CatalogoEditorialEndpoints
{
    public static RouteGroupBuilder MapCatalogoEditorialEndpoints(this RouteGroupBuilder api)
    {
        var publico = api.MapGroup("/publico/catalogo-editorial").WithTags("catalogo-editorial-publico").AllowAnonymous();
        publico.MapGet(string.Empty, ListarPublicas).WithName("ListarPublicacionesEditorialesPublicas").CacheaLecturaPublica();
        publico.MapGet("/{codigo}", ObtenerPublica).WithName("ObtenerPublicacionEditorialPublica").CacheaLecturaPublica();

        var consola = api.MapGroup("/institucional/catalogo-editorial")
            .WithTags("catalogo-editorial")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo("catalogo-editorial");
        consola.MapGet(string.Empty, ListarInternas).WithName("ListarPublicacionesEditoriales");
        // LAS LISTAS CON LAS QUE SE RELLENA EL FORMULARIO. Salen del acervo, no de una lista fija.
        consola.MapGet("/vocabularios", Vocabularios).WithName("VocabulariosCatalogoEditorial");
        // LEER UN DOCUMENTO Y PROPONER. No guarda nada: devuelve con qué abrir el formulario.
        consola.MapPost("/desde-documento", LeerDocumento).WithName("LeerDocumentoEditorial").DisableAntiforgery().AdmiteDocumentos();
        consola.MapGet("/{id:long}", ObtenerInterna).WithName("ObtenerPublicacionEditorial");
        consola.MapPost(string.Empty, Crear).WithName("CrearPublicacionEditorial");
        consola.MapPut("/{id:long}", Guardar).WithName("GuardarPublicacionEditorial");
        consola.MapPost("/{id:long}/catalogacion", CambiarCatalogacion).WithName("CambiarCatalogacionPublicacionEditorial");
        consola.MapPost("/{id:long}/publicacion", CambiarPublicacion).WithName("CambiarPublicacionPublicacionEditorial");
        // LOS DERECHOS LOS REGISTRA QUIEN CATALOGA; publicar sigue siendo del webmaster.
        // EL TESTIGO CON EL QUE LA CONSOLA FIRMA LOS DERECHOS, como en el resto de circuitos.
        consola.MapGet("/csrf", (IAntiforgery antiforgery, HttpContext contexto) =>
        {
            var tokens = antiforgery.GetAndStoreTokens(contexto);
            return Results.Ok(new TokenAntiforgeryRespuesta(tokens.RequestToken ?? string.Empty));
        }).WithName("TestigoCatalogoEditorial");
        // EL TESTIGO SE COMPRUEBA EN UN FILTRO Y NO COMO PARAMETRO DEL MANEJADOR, para no tocar su
        // firma: lo que se añade a un método mapeado puede acabar leyéndose de la consulta.
        consola.MapPut("/{id:long}/derechos", GuardarDerechos).WithName("GuardarDerechosPublicacionEditorial")
            .AddEndpointFilter(async (contexto, siguiente) =>
            {
                var antiforgery = contexto.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();
                return await GuardasDelCms.ValidateAntiforgeryAsync(antiforgery, contexto.HttpContext)
                    ?? await siguiente(contexto);
            });

        // LAS FUENTES LAS REGISTRA QUIEN CATALOGA: sin ellas la ficha nunca podía
        // publicarse. Mismo testigo y misma versión optimista que los derechos.
        consola.MapPost("/{id:long}/fuentes", AgregarFuente).WithName("AgregarFuentePublicacionEditorial")
            .AddEndpointFilter(async (contexto, siguiente) =>
            {
                var antiforgery = contexto.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();
                return await GuardasDelCms.ValidateAntiforgeryAsync(antiforgery, contexto.HttpContext)
                    ?? await siguiente(contexto);
            });
        consola.MapPut("/{id:long}/fuentes/{fuenteId:long}", EditarFuente).WithName("EditarFuentePublicacionEditorial")
            .AddEndpointFilter(async (contexto, siguiente) =>
            {
                var antiforgery = contexto.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();
                return await GuardasDelCms.ValidateAntiforgeryAsync(antiforgery, contexto.HttpContext)
                    ?? await siguiente(contexto);
            });

        // EL HILO DE TRABAJO DE LA FICHA: lo que se decidió, quién y cuándo, y lo que alguien
        // anotó por el camino. Es la misma tabla que usa el circuito de Festivales.
        consola.MapGet("/{id:long}/historial", LeerHistorial).WithName("HistorialPublicacionEditorial");
        consola.MapPost("/{id:long}/anotaciones", Anotar).WithName("AnotarPublicacionEditorial");

        // COMO SE VERA EN EL LISTADO, antes de publicarla. Ver `PrevisualizacionEnListado`.
        api.MapGroup(PrevisualizacionEnListado.Prefijo + "/catalogo-editorial")
            .WithTags("previsualizacion")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .MapGet("/{id:long}", PrevisualizarEnListado)
            .WithName("PrevisualizarPublicacionEditorialEnListado")
            .Produces<PublicacionEditorialPublicaDto>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        return api;
    }

    // ─────────────────────────── Consulta pública ───────────────────────────

    /// <summary>
    /// La única definición de «esta ficha se puede enseñar».
    ///
    /// No basta con `publicado`: una ficha observada, sin fuente o con derechos pendientes no
    /// sale, aunque alguien haya pulsado publicar. Es la regla de una revisión anterior, y vive aquí para
    /// que el listado y el detalle no puedan discrepar.
    /// </summary>
    private static bool EsVisiblePublicamente(PublicacionEditorialRow ficha, int fuentes) =>
        ficha.EstadoCatalogacion == "validada"
        && ficha.EstadoPublicacion == "publicado"
        && fuentes > 0
        && ficha.DerechosPermitePublicarFicha;

    /// <summary>
    /// La ficha como la publica un catálogo de biblioteca: lo que sirve para identificarla,
    /// encontrarla y conseguirla, y nada del trabajo de catalogarla.
    /// </summary>
    /// <remarks>
    /// <para>
    /// SE ARMA APARTE Y NO SE FILTRA EL DTO DE LA CONSOLA. Hasta las dos
    /// rutas públicas devolvían <see cref="ArmarAsync"/> con <c>soloPublico: true</c>, y ese
    /// interruptor solo recortaba los ACCESOS: todo lo demás salía entero. Medido sobre
    /// <c>GET /publico/catalogo-editorial/PNMC-ED-001</c>: un visitante anónimo recibía
    /// <c>estadoCatalogacion</c>, <c>version</c>, el nombre de quien verificó los derechos y la
    /// procedencia del registro. El defecto no es que alguien olvidara un campo: es que con un solo
    /// DTO, publicar un campo nuevo no cuesta nada y no lo decide nadie. Con dos, hay que escribirlo.
    /// </para>
    /// <para>
    /// EL CRITERIO ESTA EN <c>CatalogoEditorialContratos.cs</c>, sobre
    /// <see cref="PublicacionEditorialPublicaDto"/>, con el porqué de cada exclusión.
    /// </para>
    /// </remarks>
    private static async Task<PublicacionEditorialPublicaDto> ArmarPublicaAsync(
        SimusDbContext db, PublicacionEditorialRow fila, CancellationToken ct) =>
        (await ArmarPublicasAsync(db, [fila], ct))[0];

    /// <summary>
    /// Arma las fichas públicas de una página entera con un número FIJO de consultas.
    /// </summary>
    /// <remarks>
    /// <para>
    /// ANTES SE ARMABA FILA POR FILA: cada ficha hacía unas catorce consultas (créditos, identificadores,
    /// accesos, palabras clave, tipología, categorías, prácticas, territorios, idiomas…), así que una
    /// página de 100 fichas, anónima y sin caché, costaba ~1 400 viajes a la base (medido en la pila
    /// SIMUS_PERF, 20 nov 2026: ver el PR de optimización). Ahora cada dato se lee UNA vez para todos los
    /// identificadores de la página y se reparte en memoria.
    /// </para>
    /// <para>
    /// EL RESULTADO ES EL MISMO. Cada lista conserva el orden que tenía: el que impone la consulta
    /// (créditos y accesos por `Orden`, palabras por término, tipología por eje) se pide a la base y el
    /// reparto por ficha lo respeta, de modo que ninguna ordenación se reimplementa en memoria con otra
    /// comparación de cadenas.
    /// </para>
    /// </remarks>
    private static async Task<List<PublicacionEditorialPublicaDto>> ArmarPublicasAsync(
        SimusDbContext db, List<PublicacionEditorialRow> filas, CancellationToken ct)
    {
        if (filas.Count == 0) return [];
        var ids = filas.Select(f => f.Id).ToList();

        var creditos = (await db.CreditosEditoriales.AsNoTracking()
            .Where(x => ids.Contains(x.PublicacionEditorialId))
            .Join(db.AgentesEditoriales.AsNoTracking(), c => c.AgenteEditorialId, a => a.Id, (c, a) => new { c, a })
            .OrderBy(x => x.c.Orden).ThenBy(x => x.c.Id)
            .Select(x => new { x.c.PublicacionEditorialId, Dto = new CreditoPublicoDto(x.a.Id, x.a.NombrePreferido, x.a.Tipo, x.c.RolCodigo, x.c.RolEtiqueta, x.c.Principal) })
            .ToListAsync(ct)).ToLookup(x => x.PublicacionEditorialId, x => x.Dto);

        var identificadores = (await db.IdentificadoresEditoriales.AsNoTracking()
            .Where(x => ids.Contains(x.PublicacionEditorialId))
            .OrderBy(x => x.Id)
            .Select(x => new { x.PublicacionEditorialId, Dto = new IdentificadorPublicoDto(x.Esquema, x.CodigoRecibido, x.Cualificador) })
            .ToListAsync(ct)).ToLookup(x => x.PublicacionEditorialId, x => x.Dto);

        // LA MISMA REGLA DE SIEMPRE SOBRE LOS ACCESOS: el archivo necesita permiso propio, porque
        // enseñar la ficha de una obra y repartir el fichero no son la misma autorización.
        var accesos = (await db.AccesosEditoriales.AsNoTracking()
            .Where(x => ids.Contains(x.PublicacionEditorialId))
            .Where(x => (x.Tipo == "archivo" && x.DerechosPermitePublicarArchivo)
                     || (x.Tipo != "archivo" && x.DerechosPermitePublicarFicha))
            .OrderBy(x => x.Orden).ThenBy(x => x.Id)
            .Select(x => new { x.PublicacionEditorialId, Dto = new AccesoPublicoDto(x.Tipo, x.Url, x.UbicacionFisica, x.Etiqueta, x.Nota) })
            .ToListAsync(ct)).ToLookup(x => x.PublicacionEditorialId, x => x.Dto);

        var palabrasClave = (await db.PalabrasClaveEditoriales.AsNoTracking()
            .Where(x => ids.Contains(x.PublicacionEditorialId))
            .OrderBy(x => x.Termino)
            .Select(x => new { x.PublicacionEditorialId, x.Termino })
            .ToListAsync(ct)).ToLookup(x => x.PublicacionEditorialId, x => x.Termino);

        var tipologia = (await db.PublicacionesEditorialesTipologias.AsNoTracking()
            .Where(x => ids.Contains(x.PublicacionEditorialId))
            .Join(db.TipologiasEditoriales.AsNoTracking(), x => x.TipologiaEditorialId, tp => tp.Id, (x, tp) => new { x.PublicacionEditorialId, tp })
            .OrderBy(x => x.tp.Eje == "recurso" ? 0 : x.tp.Eje == "contenido" ? 1 : x.tp.Eje == "medio" ? 2 : 3)
            .ThenBy(x => x.tp.Orden)
            .Select(x => new { x.PublicacionEditorialId, Dto = new TipologiaEditorialDto(x.tp.Eje, x.tp.Codigo, x.tp.Etiqueta, x.tp.Norma) })
            .ToListAsync(ct)).ToLookup(x => x.PublicacionEditorialId, x => x.Dto);

        // CATEGORIA Y SUBCATEGORIA en una sola consulta, para la ficha y para su ruta «Categoría > Subcategoría».
        var categorias = await ResolverCategoriasAsync(db, filas.SelectMany(f => new[] { f.CategoriaId, f.SubcategoriaEditorialId }), ct);

        var vinculosDePracticas = (await db.PublicacionesEditorialesPracticasMusicales.AsNoTracking()
            .Where(x => ids.Contains(x.PublicacionEditorialId))
            .Select(x => new { x.PublicacionEditorialId, x.PracticaMusicalId }).ToListAsync(ct))
            .Select(x => (x.PublicacionEditorialId, x.PracticaMusicalId)).ToList();
        var vinculosDeTerritorios = (await db.PublicacionesEditorialesTerritoriosSonoros.AsNoTracking()
            .Where(x => ids.Contains(x.PublicacionEditorialId))
            .Select(x => new { x.PublicacionEditorialId, x.TerritorioSonoroId }).ToListAsync(ct))
            .Select(x => (x.PublicacionEditorialId, x.TerritorioSonoroId)).ToList();
        var practicas = await ClasificacionDeContenido.AgruparPracticasAsync(db, vinculosDePracticas, ct);
        var territorios = await ClasificacionDeContenido.AgruparTerritoriosAsync(db, vinculosDeTerritorios, ct);

        // El texto «a · b · c» de las prácticas se ordena POR NOMBRE con el orden de la base (el del catálogo
        // lo dan `Orden` y `Nombre`, que es otra cosa), así que el rango por nombre se le pide a la base.
        var idsDePracticas = vinculosDePracticas.Select(v => v.PracticaMusicalId).Distinct().ToList();
        var rangoPorNombre = idsDePracticas.Count == 0
            ? new Dictionary<int, int>()
            : (await db.PracticasMusicales.AsNoTracking().Where(p => idsDePracticas.Contains(p.Id))
                .OrderBy(p => p.Nombre).Select(p => p.Id).ToListAsync(ct))
                .Select((id, posicion) => (id, posicion)).ToDictionary(x => x.id, x => x.posicion);

        var idiomas = (await db.PublicacionesEditorialesIdiomas.AsNoTracking()
            .Where(x => ids.Contains(x.PublicacionEditorialId))
            .Join(db.Idiomas.AsNoTracking(), x => x.CodigoIdioma, i => i.Codigo, (x, i) => new { x.PublicacionEditorialId, x.Orden, i.Codigo, i.Nombre })
            .OrderBy(x => x.Orden)
            .Select(x => new { x.PublicacionEditorialId, Dto = new IdiomaDeFichaDto(x.Codigo, x.Nombre) })
            .ToListAsync(ct)).ToLookup(x => x.PublicacionEditorialId, x => x.Dto);

        string? NombreDe(int? id) => id is int v && categorias.TryGetValue(v, out var n) ? n : null;
        var resultado = new List<PublicacionEditorialPublicaDto>(filas.Count);
        foreach (var fila in filas)
        {
            var categoria = NombreDe(fila.CategoriaId);
            var subcategoria = NombreDe(fila.SubcategoriaEditorialId);
            var ruta = categoria is null ? null : subcategoria is null ? categoria : categoria + " > " + subcategoria;
            var propias = practicas.TryGetValue(fila.Id, out var delasPracticas) ? delasPracticas : [];
            var textoDePracticas = propias.Count == 0
                ? null
                : string.Join(" · ", propias.OrderBy(p => rangoPorNombre.TryGetValue(p.Id, out var r) ? r : int.MaxValue).Select(p => p.Nombre));

            resultado.Add(new PublicacionEditorialPublicaDto(
                fila.Codigo, fila.Titulo, fila.Subtitulo, fila.DesignacionVolumen, fila.SerieOColeccion, fila.Resumen,
                fila.FechaEdtf, fila.AnioInicio, fila.AnioFin, fila.NotaFecha, idiomas[fila.Id].ToList(),
                fila.TipoPublicacion, fila.Formato, tipologia[fila.Id].ToList(),
                fila.TamanoFormato, fila.Paginas, fila.Duracion,
                categoria, null, textoDePracticas, subcategoria, palabrasClave[fila.Id].ToList(),
                fila.Ambito, fila.AmbitoTexto,
                categoria, ruta,
                fila.MiniaturaRuta, fila.TextoPortada,
                creditos[fila.Id].ToList(), identificadores[fila.Id].ToList(), accesos[fila.Id].ToList(), fila.DerechosLicenciaONota,
                propias,
                territorios.TryGetValue(fila.Id, out var losTerritorios) ? losTerritorios : [],
                fila.FechaActualizacion)
            {
                SubcategoriaEditorialId = fila.SubcategoriaEditorialId,
            });
        }
        return resultado;
    }

    /// <summary>
    /// El catálogo público, explorado en el servidor: búsqueda, filtros, orden, página y facetas.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>EL SERVIDOR ORDENA Y FILTRA; EL NAVEGADOR SOLO PINTA.</b> `orden` es `titulo`, `categoria`,
    /// `autoria` o `anio` (también `az` y `za`, que vienen de direcciones antiguas) y `sentido` es
    /// `asc` o `desc`. `autor` filtra por el nombre exacto de una persona o entidad acreditada; `autoria`
    /// busca por trozos de nombre. Ver <see cref="CatalogoEditorialExploracion"/>.
    /// </para>
    /// </remarks>
    private static async Task<IResult> ListarPublicas(
        string? q, string? palabraClave, string? categoria, string? subcategoria, string? material, string? soporte,
        string? anio, string? titulo, string? autoria, string? clave, string? autor, string? orden, string? sentido,
        int? pagina, int? tamano, SimusDbContext db, CancellationToken ct)
    {
        var numero = Math.Max(1, pagina ?? 1);
        var porPagina = Math.Clamp(tamano ?? 20, 1, 100);
        var consulta = new ConsultaDeExploracionEditorial(
            q, titulo, autoria, clave, palabraClave, categoria, subcategoria, material, soporte, anio, autor, orden, sentido);

        var indice = await CatalogoEditorialExploracion.LeerIndiceAsync(db, ct);
        var coincidentes = CatalogoEditorialExploracion.Ordenar(CatalogoEditorialExploracion.Filtrar(indice, consulta, incluirCategoria: true), orden, sentido);
        var total = coincidentes.Count;
        var totalPaginas = total == 0 ? 0 : (int)Math.Ceiling(total / (double)porPagina);
        var pagina_ = coincidentes.Skip((numero - 1) * porPagina).Take(porPagina).ToList();

        var ids = pagina_.Select(x => x.Id).ToList();
        var porId = (await db.PublicacionesEditoriales.AsNoTracking().Where(x => ids.Contains(x.Id)).ToListAsync(ct)).ToDictionary(x => x.Id);
        // Con un número fijo de consultas para toda la página (ArmarPublicasAsync); el orden es el que dio el servidor.
        var filas = pagina_.Select(x => porId[x.Id]).ToList();
        var armadas = await ArmarPublicasAsync(db, filas, ct);
        var items = new List<PublicacionEditorialPublicaDto>(pagina_.Count);
        for (var i = 0; i < pagina_.Count; i++)
            items.Add(armadas[i] with { AutoriaVisible = pagina_[i].AutoriaVisible, TipoDeMaterial = pagina_[i].Material });

        return Results.Ok(new PaginaPublicacionesEditorialesPublicasDto(items, numero, porPagina, total, totalPaginas)
        {
            Facetas = CatalogoEditorialExploracion.Facetas(indice, consulta),
        });
    }

    private static async Task<IResult> ObtenerPublica(string codigo, SimusDbContext db, CancellationToken ct)
    {
        var fila = await db.PublicacionesEditoriales.AsNoTracking().FirstOrDefaultAsync(x => x.Codigo == codigo, ct);
        if (fila is null) return Results.NotFound();

        var fuentes = await db.PublicacionesEditorialesFuentes.CountAsync(x => x.PublicacionEditorialId == fila.Id, ct);
        // MISMO 404 QUE SI NO EXISTIERA, a propósito: distinguir «no publicada» de «no existe»
        // convierte esta ruta anónima en una forma de averiguar qué hay sin publicar.
        if (!EsVisiblePublicamente(fila, fuentes)) return Results.NotFound();

        return Results.Ok(await ArmarPublicaAsync(db, fila, ct));
    }

    // ─────────────────────────── Consola institucional ───────────────────────────

    private static async Task<IResult> ListarInternas(
        string? q, string? estadoCatalogacion, string? estadoPublicacion,
        int? pagina, int? tamano, SimusDbContext db, CancellationToken ct)
    {
        var numero = Math.Max(1, pagina ?? 1);
        var porPagina = Math.Clamp(tamano ?? 20, 1, 100);

        var consulta = db.PublicacionesEditoriales.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var termino = q.Trim();
            consulta = consulta.Where(x => x.Titulo.Contains(termino) || x.Codigo.Contains(termino));
        }
        if (!string.IsNullOrWhiteSpace(estadoCatalogacion)) consulta = consulta.Where(x => x.EstadoCatalogacion == estadoCatalogacion);
        if (!string.IsNullOrWhiteSpace(estadoPublicacion)) consulta = consulta.Where(x => x.EstadoPublicacion == estadoPublicacion);

        var total = await consulta.CountAsync(ct);
        var filas = await consulta
            .OrderByDescending(x => x.FechaActualizacion).ThenBy(x => x.Id)
            .Skip((numero - 1) * porPagina).Take(porPagina)
            .ToListAsync(ct);

        var items = new List<PublicacionEditorialDto>(filas.Count);
        foreach (var fila in filas) { items.Add(await ArmarAsync(db, fila, soloPublico: false, ct)); }

        var totalPaginas = total == 0 ? 0 : (int)Math.Ceiling(total / (double)porPagina);
        return Results.Ok(new PaginaPublicacionesEditorialesDto(items, numero, porPagina, total, totalPaginas));
    }

    /// <summary>La ficha con la forma de la lectura pública, esté publicada o no.</summary>
    /// <remarks>
    /// <b><c>soloPublico: true</c>, IGUAL QUE LA RUTA PUBLICA.</b> Es lo que hace que esto sea una
    /// previsualización y no una ficha interna con otro nombre: los campos que el portal no enseña
    /// tampoco se enseñan aquí, porque la pregunta es «¿cómo se verá?», no «¿qué tengo guardado?».
    /// </remarks>
    /// <summary>
    /// Cómo se verá la ficha en el listado público, antes de publicarla.
    /// </summary>
    /// <remarks>
    /// DEVUELVE EL CONTRATO PUBLICO, que es el sentido entero de previsualizar: enseñar lo que va a
    /// ver el portal. Antes devolvía el de la consola con `soloPublico: true`, así que la
    /// previsualización enseñaba campos que el público no iba a recibir nunca.
    /// </remarks>
    private static async Task<IResult> PrevisualizarEnListado(long id, SimusDbContext db, CancellationToken ct)
    {
        var fila = await db.PublicacionesEditoriales.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return fila is null ? Results.NotFound() : Results.Ok(await ArmarPublicaAsync(db, fila, ct));
    }

    private static async Task<IResult> ObtenerInterna(long id, SimusDbContext db, CancellationToken ct)
    {
        var fila = await db.PublicacionesEditoriales.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return fila is null ? Results.NotFound() : Results.Ok(await ArmarAsync(db, fila, soloPublico: false, ct));
    }

    /// <summary>
    /// Las listas con las que se rellena el formulario de una publicación.
    /// </summary>
    /// <remarks>
    /// <para>
    /// CADA LISTA SALE DE LO QUE EL ACERVO YA DICE, contado y ordenado por uso. Los vocabularios
    /// fijos —tipos de agente, esquemas de identificador— salen del contrato, que es donde están
    /// declarados; la tipología sale de su tabla, que es un vocabulario normalizado de verdad.
    /// </para>
    /// <para>
    /// SE DEVUELVE EL RECUENTO junto a cada término. Sirve para ordenar por lo más usado y, sobre
    /// todo, para que quien cataloga vea que «Libro» y «Libro impreso» conviven y pueda elegir bien
    /// en vez de inventar una tercera variante.
    /// </para>
    /// </remarks>
    /// <summary>Los sitios del acervo, con su sección al frente.</summary>
    /// <remarks>
    /// LA SECCION SE DERIVA DE LA RUTA, no se guarda aparte por gusto: medido, el primer tramo
    /// coincide con `SeccionPrincipal` en las 170 fichas que tienen las dos. Se devuelve resuelta
    /// para que el formulario no tenga que partir cadenas.
    /// </remarks>
    private static List<RutaDelAcervoDto> Rutas(IEnumerable<string?> rutas) =>
        rutas
            .Select(r => (r ?? string.Empty).Trim())
            .Where(r => r.Length > 0)
            .GroupBy(r => r, StringComparer.Ordinal)
            .Select(g => new RutaDelAcervoDto(g.Key, SeccionDeLaRuta(g.Key), g.Count()))
            .OrderBy(r => r.Seccion, StringComparer.Ordinal).ThenBy(r => r.Ruta, StringComparer.Ordinal)
            .ToList();

    /// <summary>El primer tramo de la ruta, que es la sección.</summary>
    internal static string SeccionDeLaRuta(string? ruta)
    {
        var limpia = (ruta ?? string.Empty).Trim();
        if (limpia.Length == 0) { return string.Empty; }
        var corte = limpia.IndexOf('>', StringComparison.Ordinal);
        return corte < 0 ? limpia : limpia[..corte].Trim();
    }

    /// <summary>
    /// Lee un documento y propone con qué rellenar una ficha nueva.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>TRES CAPAS, Y NINGUNA ES UN MODELO.</b> Primero lo que el documento dice de sí mismo —su
    /// diccionario de metadatos—; después lo que ENSEÑA —el texto de las primeras páginas, con el
    /// tamaño de letra, de donde salen el título y el subtítulo, y los identificadores con su dígito
    /// de control comprobado—; y por último el cotejo contra el propio acervo, que es lo que permite
    /// reconocer a «Ministerio de Cultura» como el agente que ya existe y no como una cadena de texto.
    /// </para>
    /// <para>
    /// <b>NO GUARDA NADA, salvo la portada.</b> La imagen sí entra al banco de archivos porque sin un
    /// identificador no hay forma de enseñarla en el formulario ni de asociarla después; todo lo demás
    /// se devuelve como propuesta. Es la restricción del proyecto sobre importación asistida: lo
    /// obtenido así no se publica solo.
    /// </para>
    /// <para>
    /// <b>CADA VALOR VIAJA CON SU ORIGEN.</b> Un título que escribió quien generó el PDF y otro que se
    /// dedujo del tamaño de la letra no merecen la misma confianza, y quien cataloga tiene derecho a
    /// saber cuál es cuál antes de aceptarlo.
    /// </para>
    /// </remarks>
    private static async Task<IResult> LeerDocumento(
        HttpRequest peticion, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        // EL TRAMO COMUN VIVE EN `ImportacionDeDocumentos` y lo comparte con la Agenda: comprobar el
        // formato por su firma, leer los metadatos y sacar el texto es lo mismo para un afiche que
        // para una publicación. Duplicarlo sería duplicar la superficie donde una copia se queda corta.
        var (documento, error) = await ImportacionDeDocumentos.LeerAsync(peticion, ct);
        if (error is not null) { return error; }

        var metadatos = documento!.Metadatos;
        var lectura = documento.Lectura;

        var titulos = new List<ValorPropuestoDto>();
        var subtitulos = new List<ValorPropuestoDto>();
        var pudo = new List<string>();

        // EL ANALISIS DECIDE; AQUI SOLO SE TRADUCE. Antes esto ordenaba por tamaño de letra y ponía
        // los metadatos por delante, y con un artículo real el resultado fue: título = «Seccio Clinica
        // de Barcelona» —el nombre de la plantilla de la revista— y subtítulo = «Irene Domínguez
        // Díaz», que es la autora. Ahora los candidatos compiten y el motivo viaja a la pantalla.
        if (lectura?.Analisis is { } analisis)
        {
            if (analisis.Titulo is { Length: > 0 } titulo)
            {
                // EL ORIGEN CAMBIA SI SE LEYO MIRANDO. No es cosmética: la pantalla ordena y rotula
                // las propuestas por su origen, y una leída ópticamente merece revisarse con más
                // atención que una extraída de la capa de texto.
                var origen = lectura.LeidoConReconocimientoOptico ? "reconocimiento óptico" : "análisis";
                titulos.Add(new ValorPropuestoDto(titulo, origen, analisis.MotivoDelTitulo));
                pudo.Add(lectura.LeidoConReconocimientoOptico
                    ? "título de la portada, leído con reconocimiento óptico"
                    : "título del documento");
            }
            if (analisis.Subtitulo is { Length: > 0 } subtitulo)
            {
                subtitulos.Add(new ValorPropuestoDto(subtitulo, "portada", "Acompaña al título en la primera página."));
            }
            if (analisis.Resumen is { Length: > 0 } resumen)
            {
                pudo.Add("resumen");
            }
        }

        // El título de metadatos se sigue ofreciendo como ALTERNATIVA, detrás: a veces es el bueno, y
        // esconderlo obligaría a transcribirlo si el análisis se equivoca.
        // …SIEMPRE QUE SEA TEXTO. Probado con documentos reales, por aquí llegaron a la pantalla un
        // título de metadatos en UTF-16 mal recuperado —bytes crudos con NUL entre medias— y el nombre
        // del archivo del gestor editorial, «436-469-1-PB.pdf». Ninguno de los dos es el título de
        // nada, y ofrecerlos obliga a quien cataloga a distinguir la basura antes de poder borrarla.
        if (metadatos.Titulo is { Length: > 0 } tituloDeclarado
            && TextoLegible.EsPlausible(tituloDeclarado)
            && !TextoLegible.PareceNombreDeArchivo(tituloDeclarado)
            && !titulos.Any(x => string.Equals(x.Valor, tituloDeclarado, StringComparison.OrdinalIgnoreCase)))
        {
            titulos.Add(new ValorPropuestoDto(tituloDeclarado, "metadatos", "Lo declara el documento. No siempre es el título real."));
            pudo.Add("metadatos del documento");
        }

        var identificadores = new List<ValorPropuestoDto>();
        var anios = new List<ValorPropuestoDto>();
        var agentes = new List<ValorPropuestoDto>();
        var rutas = new List<ValorPropuestoDto>();
        var practicas = new List<ValorPropuestoDto>();
        var tipos = new List<ValorPropuestoDto>();

        if (lectura is not null)
        {
            foreach (var isbn in lectura.Isbn)
            {
                identificadores.Add(new ValorPropuestoDto(isbn, "texto", "ISBN con su dígito de control comprobado."));
            }
            foreach (var ismn in lectura.Ismn)
            {
                identificadores.Add(new ValorPropuestoDto(ismn, "texto", "ISMN con su dígito de control comprobado."));
            }
            if (identificadores.Count > 0) { pudo.Add("identificadores normalizados"); }

            foreach (var anio in lectura.Anios.Take(3))
            {
                anios.Add(new ValorPropuestoDto(anio.ToString(CultureInfo.InvariantCulture), "texto", "Aparece en las primeras páginas."));
            }

            // ── Capa 3: lo que el acervo ya conoce ──
            var texto = lectura.TextoDeLasPrimerasPaginas;
            var fichas = await db.PublicacionesEditoriales.AsNoTracking()
                .Select(p => new { p.RutaSeccion, p.PracticaMusical, p.TipoPublicacion })
                .ToListAsync(ct);
            var nombres = await db.AgentesEditoriales.AsNoTracking()
                .Select(a => a.NombrePreferido)
                .ToListAsync(ct);

            static List<(string, int)> Contados(IEnumerable<string?> valores) => valores
                .Select(v => (v ?? string.Empty).Trim()).Where(v => v.Length > 0)
                .GroupBy(v => v, StringComparer.Ordinal)
                .Select(g => (g.Key, g.Count())).ToList();

            foreach (var reconocido in CotejoConElAcervo.Reconocer(texto, Contados(nombres)))
            {
                agentes.Add(new ValorPropuestoDto(reconocido.Valor, "acervo",
                    $"Ya está en el fichero de autoridades, con {reconocido.Usos.ToString(CultureInfo.InvariantCulture)} obra(s)."));
            }
            foreach (var reconocido in CotejoConElAcervo.Reconocer(texto, Contados(fichas.Select(f => f.RutaSeccion))))
            {
                rutas.Add(new ValorPropuestoDto(reconocido.Valor, "acervo", "Coincide con una ubicación del acervo."));
            }
            foreach (var reconocido in CotejoConElAcervo.Reconocer(texto, Contados(fichas.Select(f => f.PracticaMusical))))
            {
                practicas.Add(new ValorPropuestoDto(reconocido.Valor, "acervo", "Coincide con una práctica del acervo."));
            }
            foreach (var reconocido in CotejoConElAcervo.Reconocer(texto, Contados(fichas.Select(f => f.TipoPublicacion))))
            {
                tipos.Add(new ValorPropuestoDto(reconocido.Valor, "acervo", "Coincide con un tipo ya usado."));
            }
            if (agentes.Count + rutas.Count + practicas.Count + tipos.Count > 0) { pudo.Add("coincidencias con el acervo"); }

            // LA AUTORIA QUE ESTA EN LA PORTADA Y NO EN EL ACERVO. Un artículo firmado por alguien que
            // nunca publicó con el PNMC no coincide con ningún agente conocido, y antes se perdía: se
            // proponía como SUBTITULO porque era el segundo texto más grande.
            //
            // SE COMPARA SIN TILDES, y no por capricho: el acervo tiene «Jaime Jaramillo Árias» y la
            // portada del mismo libro imprime «Jaime Jaramillo Arias». Comparando solo por mayúsculas
            // —que es lo que hacía— salían los dos, y quien cataloga tenía que adivinar cuál de las dos
            // personas idénticas elegir. Gana la del acervo, que es la que ya tiene la tilde puesta.
            foreach (var nombre in lectura.Analisis.Autores)
            {
                var yaEsta = agentes.Any(x => CotejoConElAcervo.Normalizar(x.Valor) == CotejoConElAcervo.Normalizar(nombre));
                if (!yaEsta)
                {
                    agentes.Add(new ValorPropuestoDto(nombre, "portada", "Tiene forma de nombre propio en la primera página."));
                }
            }
            if (lectura.Analisis.Autores.Count > 0) { pudo.Add("autoría en la portada"); }
        }

        var (portadaId, portadaUrl) = await ImportacionDeDocumentos.GuardarPortadaAsync(documento, principal, db, ct);
        if (portadaId is not null) { pudo.Add("portada renderizada"); }

        return Results.Ok(new PropuestaDeFichaDto(
            Titulos: titulos,
            Subtitulos: subtitulos,
            Identificadores: identificadores,
            Anios: anios,
            Agentes: agentes,
            Rutas: rutas,
            Practicas: practicas,
            TiposDePublicacion: tipos,
            Resumen: lectura?.Analisis.Resumen,
            Paginas: lectura is not null ? $"{lectura.Paginas.ToString(CultureInfo.InvariantCulture)} p." : metadatos.Paginas?.ToString(CultureInfo.InvariantCulture),
            PortadaArchivoId: portadaId,
            PortadaUrl: portadaUrl,
            RequiereOcr: lectura?.PaginaSinTexto ?? false,
            LeidoConReconocimientoOptico: lectura?.LeidoConReconocimientoOptico ?? false,
            LoQueSePudoLeer: pudo));
    }

    private static string? Recortar(string? valor, int largo)
    {
        var limpio = (valor ?? string.Empty).Trim();
        if (limpio.Length == 0) { return null; }
        return limpio.Length <= largo ? limpio : limpio[..largo];
    }

    /// <summary>El siguiente código libre de la serie del acervo.</summary>
    /// <remarks>
    /// <para>
    /// SE LEE EL MAYOR REALMENTE USADO, no se cuenta cuántas hay. Contar da 171 y propone el 172
    /// aunque el 172 ya exista porque alguien repuso una ficha borrada: el número de filas y el
    /// último número de la serie son cosas distintas en cuanto se borra una.
    /// </para>
    /// <para>
    /// SOLO SE MIRAN LAS QUE SIGUEN EL PATRON. El acervo trae códigos `PNMC-ED-001`…`PNMC-ED-171`,
    /// y las fichas de verificación usan otros. Mezclarlos daría un salto absurdo en la serie.
    /// </para>
    /// </remarks>
    private static async Task<string> SiguienteCodigoAsync(SimusDbContext db, CancellationToken ct)
    {
        const string prefijo = "PNMC-ED-";
        var codigos = await db.PublicacionesEditoriales.AsNoTracking()
            .Where(x => x.Codigo.StartsWith(prefijo))
            .Select(x => x.Codigo)
            .ToListAsync(ct);

        var mayor = 0;
        foreach (var codigo in codigos)
        {
            var cola = codigo[prefijo.Length..];
            if (cola.Length > 0 && cola.All(char.IsAsciiDigit)
                && int.TryParse(cola, CultureInfo.InvariantCulture, out var numero) && numero > mayor)
            {
                mayor = numero;
            }
        }

        return prefijo + (mayor + 1).ToString("D3", CultureInfo.InvariantCulture);
    }

    private static async Task<IResult> Vocabularios(SimusDbContext db, CancellationToken ct)
    {
        static IReadOnlyList<TerminoDeVocabularioDto> Contar(IEnumerable<string?> valores) =>
            valores
                .Select(v => (v ?? string.Empty).Trim())
                .Where(v => v.Length > 0)
                .GroupBy(v => v, StringComparer.Ordinal)
                .Select(g => new TerminoDeVocabularioDto(g.Key, g.Count()))
                .OrderByDescending(t => t.Usos).ThenBy(t => t.Valor, StringComparer.Ordinal)
                .ToList();

        var fichas = await db.PublicacionesEditoriales.AsNoTracking()
            .Select(p => new
            {
                p.TipoPublicacion, p.Ambito, p.Formato,
                p.SeccionPrincipal, p.RutaSeccion, p.PracticaMusical, p.Subcategoria, p.CategoriaSecundaria,
            })
            .ToListAsync(ct);

        var roles = await db.CreditosEditoriales.AsNoTracking()
            .GroupBy(c => new { c.RolCodigo, c.RolEtiqueta })
            .Select(g => new RolEditorialDto(g.Key.RolCodigo, g.Key.RolEtiqueta, g.Count()))
            .ToListAsync(ct);

        var tipologias = await db.TipologiasEditoriales.AsNoTracking()
            .OrderBy(t => t.Eje).ThenBy(t => t.Orden)
            .Select(t => new TipologiaEditorialDto(t.Eje, t.Codigo, t.Etiqueta, t.Norma))
            .ToListAsync(ct);

        return Results.Ok(new VocabulariosEditorialesDto(
            SiguienteCodigo: await SiguienteCodigoAsync(db, ct),
            Idiomas: await IdiomasDeContenido.VocabularioAsync(db, ct),
            TiposDePublicacion: Contar(fichas.Select(f => f.TipoPublicacion)),
            Ambitos: Contar(fichas.Select(f => f.Ambito)),
            Formatos: Contar(fichas.Select(f => f.Formato)),
            Rutas: Rutas(fichas.Select(f => f.RutaSeccion)),
            PracticasMusicales: Contar(fichas.Select(f => f.PracticaMusical)),
            Subcategorias: Contar(fichas.Select(f => f.Subcategoria)),
            CategoriasSecundarias: Contar(fichas.Select(f => f.CategoriaSecundaria)),
            EsquemasIdentificador: CatalogoEditorialContrato.EsquemasIdentificador
                .Select(e => new TerminoDeVocabularioDto(e, 0)).ToList(),
            RolesDeCredito: roles.OrderByDescending(r => r.Usos).ThenBy(r => r.Etiqueta, StringComparer.Ordinal).ToList(),
            Tipologias: tipologias,
            TiposDeAgente: CatalogoEditorialContrato.TiposAgente)
        {
            CategoriasEditoriales = await db.Categorias.AsNoTracking()
                .Where(c => c.CodigoModulo == "editorial")
                .OrderBy(c => c.OrdenVisualizacion).ThenBy(c => c.NombreCategoria)
                .Select(c => new CategoriaDeContenidoDto(c.Id, c.CodigoModulo, c.NombreCategoria, c.Slug,
                    c.Descripcion, c.OrdenVisualizacion, 0) { CategoriaPadreId = c.CategoriaPadreId }).ToListAsync(ct),
        });
    }

    private static async Task<IResult> Crear(
        GuardarPublicacionEditorialSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var problema = Validar(solicitud);
        if (problema is not null) return problema;

        var categoriaInvalida = await ClasificacionEditorial.ValidarAsync(
            db, solicitud.CategoriaId, solicitud.SubcategoriaEditorialId, ct);
        if (categoriaInvalida is not null) return categoriaInvalida;

        var clasificacion = await ClasificacionDeContenido.ValidarAsync(
            db, solicitud.PracticasMusicalesIds, solicitud.TerritoriosSonorosIds, ct);
        if (clasificacion is not null) return clasificacion;

        var idiomasInvalidos = await IdiomasDeContenido.ValidarAsync(db, solicitud.Idiomas, ct);
        if (idiomasInvalidos is not null) return idiomasInvalidos;

        // EL CODIGO LO PONE EL SISTEMA, POR ORDEN DE REGISTRO.
        //
        // Pedirlo a mano tenía dos costes: había que saberse cuál fue el último —«¿voy por el 171 o
        // por el 172?»— y dos personas catalogando a la vez chocaban sin enterarse hasta guardar.
        // Ahora, si no llega código, el servidor toma el siguiente libre de la serie. Se sigue
        // aceptando uno escrito a mano: una ficha que se repone tiene que poder recuperar el suyo.
        var codigo = string.IsNullOrWhiteSpace(solicitud.Codigo)
            ? await SiguienteCodigoAsync(db, ct)
            : solicitud.Codigo!.Trim();

        if (await db.PublicacionesEditoriales.AnyAsync(x => x.Codigo == codigo, ct))
        {
            return Results.Conflict(new { message = "Ya existe una publicación con ese código." });
        }

        var fila = new PublicacionEditorialRow
        {
            Codigo = codigo,
            Titulo = solicitud.Titulo!.Trim(),
            Subtitulo = Limpiar(solicitud.Subtitulo),
            DesignacionVolumen = Limpiar(solicitud.DesignacionVolumen),
            SerieOColeccion = Limpiar(solicitud.SerieOColeccion),
            Resumen = Limpiar(solicitud.Resumen),
            FechaEdtf = Limpiar(solicitud.FechaEdtf),
            AnioInicio = solicitud.AnioInicio,
            AnioFin = solicitud.AnioFin,
            TipoPublicacion = Limpiar(solicitud.TipoPublicacion),
            CategoriaId = solicitud.CategoriaId,
            SubcategoriaEditorialId = solicitud.SubcategoriaEditorialId,
            Ambito = Limpiar(solicitud.Ambito),
            MiniaturaRuta = LimpiarRuta(solicitud.MiniaturaRuta),
            // LA SECCION NO SE PIDE: es el primer tramo de la ruta, y lo es en las 170 fichas del
            // acervo que tienen las dos. Pedirlas por separado deja que discrepen.
            RutaSeccion = Limpiar(solicitud.RutaSeccion),
            SeccionPrincipal = Limpiar(solicitud.RutaSeccion) is { } ruta
                ? SeccionDeLaRuta(ruta)
                : Limpiar(solicitud.SeccionPrincipal),
            PracticaMusical = Limpiar(solicitud.PracticaMusical),
            Subcategoria = Limpiar(solicitud.Subcategoria),
            TamanoFormato = Limpiar(solicitud.TamanoFormato),
            Paginas = Limpiar(solicitud.Paginas),
            Duracion = Limpiar(solicitud.Duracion),
            CamposAdicionales = Limpiar(solicitud.CamposAdicionales),
            TextoPortada = Limpiar(solicitud.TextoPortada),
            Formato = Limpiar(solicitud.Formato),
            NotaFecha = Limpiar(solicitud.NotaFecha),
            CategoriaSecundaria = Limpiar(solicitud.CategoriaSecundaria),
            AmbitoTexto = Limpiar(solicitud.AmbitoTexto),
            EstadoCatalogacion = "pendiente_revision",
            EstadoPublicacion = "borrador",
            Version = 1,
            FechaCreacion = DateTime.UtcNow,
            FechaActualizacion = DateTime.UtcNow,
        };
        // EL ALTA ES UNA SOLA TRANSACCION, y no es celo: hacen falta DOS `SaveChanges` —el primero
        // para que la publicación reciba su identidad y el segundo para colgarle fuentes y
        // auditoría—, así que sin transacción un fallo en el segundo deja la ficha creada y sin
        // rastro. Pasó de verdad el 11 sep 2026: la bitácora rechazó un valor que no era objeto
        // JSON, la llamada devolvió 500, y el código quedó ocupado para siempre.
        //
        // VA DENTRO DE `CreateExecutionStrategy` PORQUE ESTA BASE REINTENTA. Abrir la transacción
        // a pelo lanza «does not support user-initiated transactions»: la estrategia no sabría qué
        // reintentar. Es el mismo patrón que usa la importación de Festivales.
        var estrategia = db.Database.CreateExecutionStrategy();
        await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);

            db.PublicacionesEditoriales.Add(fila);
            await db.SaveChangesAsync(ct);

            await AplicarFuentesAsync(db, fila.Id, solicitud.FuenteIds, ct);
            await AplicarClasificacionAsync(db, fila.Id, solicitud, ct);
            await AplicarPalabrasClaveAsync(db, fila.Id, solicitud.PalabrasClave, ct);
            await AplicarCreditosAsync(db, fila.Id, solicitud.Creditos, ct);
            await AplicarIdentificadoresAsync(db, fila.Id, solicitud.Identificadores, ct);
            await AplicarAccesosAsync(db, fila.Id, solicitud.Accesos, ct);
            await AplicarTipologiasAsync(db, fila.Id, solicitud.Tipologias, ct);
            await IdiomasDeContenido.AplicarAsync(db, fila.Id, solicitud.Idiomas, ct);
            // DE DONDE VIENE: la creó la consola. Misma transacción que el alta.
            await ProcedenciaDeRegistro.AnotarAltaInstitucionalAsync(
                db, Modulos.CatalogoEditorial, fila.Id.ToString(CultureInfo.InvariantCulture), Actor(principal), ct);
            Auditar(db, Actor(principal), fila.Id, "crear", null, new { fila.Codigo, fila.Titulo });
            await db.SaveChangesAsync(ct);

            await transaccion.CommitAsync(ct);
        });

        return Results.Created($"/api/v1/institucional/catalogo-editorial/{fila.Id}", await ArmarAsync(db, fila, soloPublico: false, ct));
    }

    /// <summary>Los campos de una ficha del Catálogo cuyo cambio queda en el registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md).</summary>
    public static readonly IReadOnlyList<CampoVigilado<PublicacionEditorialRow>> CamposVigilados =
    [
        new("titulo", "Título", ClaseDeDato.Publico, x => x.Titulo),
        new("subtitulo", "Subtítulo", ClaseDeDato.Publico, x => x.Subtitulo),
        new("designacionVolumen", "Designación de volumen", ClaseDeDato.Publico, x => x.DesignacionVolumen),
        new("serieOColeccion", "Serie o colección", ClaseDeDato.Publico, x => x.SerieOColeccion),
        new("resumen", "Resumen", ClaseDeDato.Publico, x => x.Resumen),
        new("fechaEdtf", "Fecha", ClaseDeDato.Publico, x => x.FechaEdtf),
        new("anioInicio", "Año de inicio", ClaseDeDato.Publico, x => x.AnioInicio),
        new("anioFin", "Año de fin", ClaseDeDato.Publico, x => x.AnioFin),
        new("tipoPublicacion", "Tipo de publicación", ClaseDeDato.Publico, x => x.TipoPublicacion),
        new("categoriaId", "Categoría", ClaseDeDato.Publico, x => x.CategoriaId, CatalogoDeCampo.CategoriaDeContenido),
        new("ambito", "Ámbito", ClaseDeDato.Publico, x => x.Ambito),
        new("ambitoTexto", "Descripción del ámbito", ClaseDeDato.Publico, x => x.AmbitoTexto),
        new("tamanoFormato", "Tamaño o formato", ClaseDeDato.Publico, x => x.TamanoFormato),
        new("paginas", "Páginas", ClaseDeDato.Publico, x => x.Paginas),
        new("duracion", "Duración", ClaseDeDato.Publico, x => x.Duracion),
        new("textoPortada", "Texto de la portada", ClaseDeDato.Publico, x => x.TextoPortada),
        new("formato", "Formato", ClaseDeDato.Publico, x => x.Formato),
        new("notaFecha", "Nota sobre la fecha", ClaseDeDato.Publico, x => x.NotaFecha),
    ];

    private static async Task<IResult> Guardar(
        long id, GuardarPublicacionEditorialSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var problema = Validar(solicitud);
        if (problema is not null) return problema;

        var categoriaInvalida = await ClasificacionEditorial.ValidarAsync(
            db, solicitud.CategoriaId, solicitud.SubcategoriaEditorialId, ct);
        if (categoriaInvalida is not null) return categoriaInvalida;

        var clasificacion = await ClasificacionDeContenido.ValidarAsync(
            db, solicitud.PracticasMusicalesIds, solicitud.TerritoriosSonorosIds, ct);
        if (clasificacion is not null) return clasificacion;

        var idiomasInvalidos = await IdiomasDeContenido.ValidarAsync(db, solicitud.Idiomas, ct);
        if (idiomasInvalidos is not null) return idiomasInvalidos;

        var fila = await db.PublicacionesEditoriales.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();

        // CONTROL DE VERSION. Sin esto, dos personas editando la misma ficha se pisan y la última
        // gana sin que ninguna se entere de que existió la otra.
        if (solicitud.Version != fila.Version)
        {
            return Results.Conflict(new { message = "La ficha cambió desde que se abrió. Vuelva a cargarla antes de guardar." });
        }

        var antes = fila.Titulo;
        // LOS VALORES DE ANTES, para el registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md).
        var fotoDeLosCampos = RegistradorDeCambios.Tomar(fila, CamposVigilados);

        // ERRATA O CAMBIO DE FONDO LO DECIDE EL SERVIDOR (LIS-04; docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 36):
        // se compara lo publicado con lo que llega, ANTES de aplicar nada. Quien edita ya no tiene
        // que saber que existe una casilla de errata para no despublicar la ficha al corregir una coma.
        IReadOnlyList<string> cambiosDeFondo = [];
        if (fila.EstadoPublicacion == "publicado")
        {
            var accesosActuales = (await db.AccesosEditoriales.AsNoTracking()
                .Where(x => x.PublicacionEditorialId == fila.Id)
                .Select(x => new { x.Tipo, x.Url, x.UbicacionFisica, x.ArchivoId })
                .ToListAsync(ct))
                .Select(x => ReglasDeErrataDelCatalogo.FirmaDeAcceso(x.Tipo, x.Url, x.UbicacionFisica, x.ArchivoId))
                .ToList();
            var fuentesActuales = await db.PublicacionesEditorialesFuentes.AsNoTracking()
                .Where(x => x.PublicacionEditorialId == fila.Id)
                .Select(x => (long)x.FuenteEditorialId)
                .ToListAsync(ct);
            cambiosDeFondo = ReglasDeErrataDelCatalogo.CambiosDeFondo(fila, solicitud, accesosActuales, fuentesActuales);
        }
        var esErrata = cambiosDeFondo.Count == 0;
        fila.Titulo = solicitud.Titulo!.Trim();
        fila.Subtitulo = Limpiar(solicitud.Subtitulo);
        fila.DesignacionVolumen = Limpiar(solicitud.DesignacionVolumen);
        fila.SerieOColeccion = Limpiar(solicitud.SerieOColeccion);
        fila.Resumen = Limpiar(solicitud.Resumen);
        fila.FechaEdtf = Limpiar(solicitud.FechaEdtf);
        fila.AnioInicio = solicitud.AnioInicio;
        fila.AnioFin = solicitud.AnioFin;
        fila.TipoPublicacion = Limpiar(solicitud.TipoPublicacion);
        fila.SubcategoriaEditorialId = solicitud.SubcategoriaEditorialId;
        fila.CategoriaId = solicitud.CategoriaId;
        fila.Ambito = Limpiar(solicitud.Ambito);
        fila.MiniaturaRuta = LimpiarRuta(solicitud.MiniaturaRuta);
        fila.TamanoFormato = Limpiar(solicitud.TamanoFormato);
        fila.Paginas = Limpiar(solicitud.Paginas);
        fila.Duracion = Limpiar(solicitud.Duracion);
        fila.CamposAdicionales = Limpiar(solicitud.CamposAdicionales);
        fila.TextoPortada = Limpiar(solicitud.TextoPortada);
        fila.Formato = Limpiar(solicitud.Formato);
        fila.NotaFecha = Limpiar(solicitud.NotaFecha);

        fila.AmbitoTexto = Limpiar(solicitud.AmbitoTexto);
        fila.Version += 1;
        fila.FechaActualizacion = DateTime.UtcNow;

        await AplicarFuentesAsync(db, fila.Id, solicitud.FuenteIds, ct);
        await AplicarClasificacionAsync(db, fila.Id, solicitud, ct);
        await AplicarPalabrasClaveAsync(db, fila.Id, solicitud.PalabrasClave, ct);
        await AplicarCreditosAsync(db, fila.Id, solicitud.Creditos, ct);
        await AplicarIdentificadoresAsync(db, fila.Id, solicitud.Identificadores, ct);
        await AplicarAccesosAsync(db, fila.Id, solicitud.Accesos, ct);
        await AplicarTipologiasAsync(db, fila.Id, solicitud.Tipologias, ct);
        await IdiomasDeContenido.AplicarAsync(db, fila.Id, solicitud.Idiomas, ct);
        Auditar(db, Actor(principal), fila.Id, "actualizar", new { titulo = antes }, new { fila.Titulo });
        // LA AUDITORÍA DE ARRIBA YA ESCRIBE SU LÍNEA; el registro de cambios guarda los valores.
        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(
                Modulos.CatalogoEditorial, fila.Id.ToString(CultureInfo.InvariantCulture), null, Actor(principal), "Consola",
                Motivo: fila.EstadoPublicacion != "publicado" ? null
                    : esErrata ? "Errata corregida en lo publicado." : $"Cambio de fondo en lo publicado ({string.Join(", ", cambiosDeFondo)}).",
                Fecha: fila.FechaActualizacion),
            CamposVigilados, fotoDeLosCampos, fila, ct, conBitacora: false);

        // ERRATA O CAMBIO DE FONDO, como en Noticias. Lo publicado admite erratas al instante;
        // lo demás vuelve a revisión en el eje de publicación y deja de verse hasta republicarse.
        // La catalogación no se toca: la ficha sigue estando bien hecha, lo que cambia es si se ve.
        if (fila.EstadoPublicacion == "publicado")
        {
            if (!esErrata) fila.EstadoPublicacion = "en_revision";
            Historiar(db, Actor(principal), fila,
                esErrata ? HistorialDeEstados.AccionErrata : HistorialDeEstados.AccionVueltaARevision,
                "publicado", fila.EstadoPublicacion,
                esErrata ? "Errata corregida en lo publicado." : $"Cambio de fondo en lo publicado ({string.Join(", ", cambiosDeFondo)}): vuelve a revisión.");
        }
        await db.SaveChangesAsync(ct);

        return Results.Ok(await ArmarAsync(db, fila, soloPublico: false, ct));
    }

    private static async Task<IResult> CambiarCatalogacion(
        long id, CambioDeEstadoEditorial cambio, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        if (!CatalogoEditorialContrato.EstadosCatalogacion.Contains(cambio.Estado ?? string.Empty))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["estado"] = ["Estado de catalogación no reconocido."] });
        }

        // OBSERVAR PIDE MOTIVO, como devolver en Noticias y Agenda: quien la catalogó
        // necesita saber qué corregir.
        if (cambio.Estado == "observada" && string.IsNullOrWhiteSpace(cambio.Motivo))
        {
            return MotivoObligatorio("Escribe el motivo: quien catalogó la ficha necesita saber qué corregir.");
        }

        var fila = await db.PublicacionesEditoriales.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();

        var antes = fila.EstadoCatalogacion;
        fila.EstadoCatalogacion = cambio.Estado!;
        fila.FechaActualizacion = DateTime.UtcNow;
        Auditar(db, Actor(principal), fila.Id, "actualizar", new { estadoCatalogacion = antes }, new { estadoCatalogacion = fila.EstadoCatalogacion, cambio.Motivo });
        Historiar(db, Actor(principal), fila, "CatalogacionCambiada", antes, fila.EstadoCatalogacion, cambio.Motivo);
        await db.SaveChangesAsync(ct);
        return Results.Ok(await ArmarAsync(db, fila, soloPublico: false, ct));
    }

    private static async Task<IResult> CambiarPublicacion(
        long id, CambioDeEstadoEditorial cambio, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        // PUBLICAR Y RETIRAR SON DEL WEBMASTER. Catalogar y editar también los hace el gestor
        // interno; sacar algo al portal, no. Es la tabla de permisos de una revisión anterior.
        if (!Permisos.EsWebmaster(principal)) return Results.Forbid();

        if (!CatalogoEditorialContrato.EstadosPublicacion.Contains(cambio.Estado ?? string.Empty))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["estado"] = ["Estado de publicación no reconocido."] });
        }

        // RETIRAR PIDE MOTIVO: lo que deja de verse en el portal tiene que decir por qué.
        if (cambio.Estado == "retirado" && string.IsNullOrWhiteSpace(cambio.Motivo))
        {
            return MotivoObligatorio("Escribe el motivo: lo que se retira del portal tiene que decir por qué.");
        }

        var fila = await db.PublicacionesEditoriales.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();

        // PUBLICAR EXIGE LAS MISMAS CUATRO CONDICIONES QUE VER. Comprobarlo solo al leer dejaría
        // fichas marcadas como publicadas que el portal nunca enseña: dos verdades sobre lo mismo.
        if (cambio.Estado == "publicado")
        {
            var fuentes = await db.PublicacionesEditorialesFuentes.CountAsync(x => x.PublicacionEditorialId == fila.Id, ct);
            var motivos = new List<string>();
            if (fila.EstadoCatalogacion != "validada") motivos.Add("la ficha no está validada");
            if (fuentes == 0) motivos.Add("no tiene ninguna fuente registrada");
            if (!fila.DerechosPermitePublicarFicha) motivos.Add("los derechos no autorizan publicar la ficha");
            if (motivos.Count > 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["estado"] = [$"No se puede publicar: {string.Join("; ", motivos)}."],
                });
            }
        }

        var antes = fila.EstadoPublicacion;
        fila.EstadoPublicacion = cambio.Estado!;
        fila.FechaActualizacion = DateTime.UtcNow;
        // EL VERBO SALE DE LA LISTA BLANCA DE `CK_BitacoraAuditoria_Accion`, que admite trece y
        // ni «publicacion» ni «catalogacion» están entre ellos. Retirar se audita como `archivar`,
        // que es el verbo que la bitácora ya tiene para «dejó de estar visible».
        var verbo = fila.EstadoPublicacion == "publicado" ? "publicar" : "archivar";
        Auditar(db, Actor(principal), fila.Id, verbo, new { estadoPublicacion = antes }, new { estadoPublicacion = fila.EstadoPublicacion, cambio.Motivo });
        Historiar(db, Actor(principal), fila, "PublicacionCambiada", antes, fila.EstadoPublicacion, cambio.Motivo);
        await db.SaveChangesAsync(ct);
        return Results.Ok(await ArmarAsync(db, fila, soloPublico: false, ct));
    }

    // ─────────────────────────── Armado y ayudas ───────────────────────────

    /// <summary>
    /// Arma la ficha completa.
    ///
    /// <paramref name="soloPublico"/> NO es cosmético: con él, un acceso cuyo archivo no está
    /// autorizado no viaja al portal. La ficha puede ser pública y su archivo no serlo; son dos
    /// autorizaciones distintas y el filtro tiene que respetarlas por separado.
    /// </summary>
    private static async Task<PublicacionEditorialDto> ArmarAsync(
        SimusDbContext db, PublicacionEditorialRow fila, bool soloPublico, CancellationToken ct)
    {
        var fuenteIds = await db.PublicacionesEditorialesFuentes.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == fila.Id).Select(x => x.FuenteEditorialId).ToListAsync(ct);

        var fuentes = await db.FuentesEditoriales.AsNoTracking()
            .Where(x => fuenteIds.Contains(x.Id))
            .Select(x => new FuenteEditorialDto(x.Id, x.Nombre, x.Referencia, x.Url, x.FechaFuente, x.FechaConsulta, x.VerificadaPor))
            .ToListAsync(ct);

        var creditos = await db.CreditosEditoriales.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == fila.Id)
            .Join(db.AgentesEditoriales.AsNoTracking(), c => c.AgenteEditorialId, a => a.Id, (c, a) => new { c, a })
            .OrderBy(x => x.c.Orden).ThenBy(x => x.c.Id)
            .Select(x => new CreditoEditorialDto(x.c.Id, x.a.Id, x.a.NombrePreferido, x.a.Tipo, x.c.RolCodigo, x.c.RolEtiqueta, x.c.Principal, x.c.Orden))
            .ToListAsync(ct);

        var identificadores = await db.IdentificadoresEditoriales.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == fila.Id)
            .Select(x => new IdentificadorEditorialDto(x.Id, x.Esquema, x.CodigoRecibido, x.Cualificador, x.Valido, x.ObservacionValidacion))
            .ToListAsync(ct);

        var accesosConsulta = db.AccesosEditoriales.AsNoTracking().Where(x => x.PublicacionEditorialId == fila.Id);
        if (soloPublico)
        {
            accesosConsulta = accesosConsulta.Where(x =>
                (x.Tipo == "archivo" && x.DerechosPermitePublicarArchivo) ||
                (x.Tipo != "archivo" && x.DerechosPermitePublicarFicha));
        }
        var accesos = await accesosConsulta.OrderBy(x => x.Orden).ThenBy(x => x.Id)
            .Select(x => new AccesoEditorialDto(
                x.Id, x.Tipo, (long?)x.ArchivoId, x.Url, x.UbicacionFisica, x.Etiqueta, x.Nota, x.Orden,
                new DerechosEditorialesDto(x.DerechosEstado, x.DerechosPermitePublicarFicha, x.DerechosPermitePublicarArchivo,
                    x.DerechosLicenciaONota, x.DerechosFuenteId, x.DerechosFechaVerificacion, x.DerechosVerificadoPor)))
            .ToListAsync(ct);

        var palabrasClave = await db.PalabrasClaveEditoriales.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == fila.Id)
            .OrderBy(x => x.Termino).Select(x => x.Termino).ToListAsync(ct);

        var programas = await db.PublicacionesEditorialesProgramas.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == fila.Id)
            .Join(db.ProgramasEditoriales.AsNoTracking(), r => r.ProgramaEditorialId, p => p.Id, (r, p) => new { r, p })
            .Select(x => new RelacionProgramaEditorialDto(
                x.r.Id, new ProgramaEditorialDto(x.p.Id, x.p.Codigo, x.p.Nombre, x.p.Activo),
                x.r.FuenteEditorialId, x.r.VigenteDesde, x.r.VigenteHasta, x.r.VerificadaPor))
            .ToListAsync(ct);

        var categorias = await ResolverCategoriasAsync(db, [fila.CategoriaId], ct);
        var categoria = categorias.TryGetValue(fila.CategoriaId ?? 0, out var nombreCategoria) ? nombreCategoria : null;

        var practicasIds = await db.PublicacionesEditorialesPracticasMusicales.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == fila.Id).Select(x => x.PracticaMusicalId).ToListAsync(ct);
        var territoriosIds = await db.PublicacionesEditorialesTerritoriosSonoros.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == fila.Id).Select(x => x.TerritorioSonoroId).ToListAsync(ct);
        var procedencia = await ProcedenciaDeRegistro.LeerAsync(
            db, Modulos.CatalogoEditorial, fila.Id.ToString(CultureInfo.InvariantCulture), ct);
        var practicas = await ClasificacionDeContenido.PracticasAsync(db, practicasIds, ct);
        var territoriosSonoros = await ClasificacionDeContenido.TerritoriosAsync(db, territoriosIds, ct);

        // LA TIPOLOGIA SE ORDENA POR EJE Y LUEGO POR LA NORMA, no por su identificador. Los cuatro
        // ejes se leen en el orden en que los presenta el documento de estándares —qué es, de qué
        // está hecho, con qué se usa, en qué viene— y dentro de cada uno manda el orden de la lista
        // oficial, que no es alfabético: «texto» va antes que «música notada» porque así está en
        // RDA 336.
        var tipologia = await db.PublicacionesEditorialesTipologias.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == fila.Id)
            .Join(db.TipologiasEditoriales.AsNoTracking(), x => x.TipologiaEditorialId, tp => tp.Id, (x, tp) => tp)
            .OrderBy(tp => tp.Eje == "recurso" ? 0 : tp.Eje == "contenido" ? 1 : tp.Eje == "medio" ? 2 : 3)
            .ThenBy(tp => tp.Orden)
            .Select(tp => new TipologiaEditorialDto(tp.Eje, tp.Codigo, tp.Etiqueta, tp.Norma))
            .ToListAsync(ct);

        var derechos = new DerechosEditorialesDto(
            fila.DerechosEstado, fila.DerechosPermitePublicarFicha, fila.DerechosPermitePublicarArchivo,
            fila.DerechosLicenciaONota, fila.DerechosFuenteId, fila.DerechosFechaVerificacion, fila.DerechosVerificadoPor);

        var idiomas = await IdiomasDeContenido.DeLaPublicacionAsync(db, fila.Id, ct);
        var lectura = await ClasificacionEditorial.LeerAsync(db, fila, ct);

        return new PublicacionEditorialDto(
            fila.Id, fila.Codigo, fila.Titulo, fila.Subtitulo, fila.DesignacionVolumen, fila.SerieOColeccion,
            fila.Resumen, fila.FechaEdtf, fila.AnioInicio, fila.AnioFin, idiomas, fila.NotaFecha,
            fila.TipoPublicacion, fila.CategoriaId, lectura.Categoria, fila.Ambito, fila.AmbitoTexto, fila.Formato,
            null, palabrasClave, fila.MiniaturaRuta,
            lectura.Categoria, lectura.Ruta, lectura.Practicas, lectura.Subcategoria, fila.TamanoFormato, fila.Paginas, fila.Duracion, fila.CamposAdicionales, fila.TextoPortada,
            tipologia, fila.Confianza, fila.RevisarClasificacion, fila.RevisarCreditos,
            fila.NotasCatalogacion, fila.DiapositivaOrigen,
            fila.EstadoCatalogacion, fila.EstadoPublicacion, fila.Version,
            derechos, fuentes, creditos, identificadores, accesos, programas,
            practicas, territoriosSonoros, procedencia, fila.FechaActualizacion)
        {
            SubcategoriaEditorialId = fila.SubcategoriaEditorialId,
            RutaSeccionHistorica = fila.RutaSeccion,
            PracticaMusicalHistorica = fila.PracticaMusical,
            CategoriaSecundariaHistorica = fila.CategoriaSecundaria,
            SubcategoriaHistorica = fila.Subcategoria,
        };
    }

    /// <summary>Deja la clasificación de la publicación diciendo lo que pide la solicitud.</summary>
    private static async Task AplicarClasificacionAsync(
        SimusDbContext db, long publicacionId, GuardarPublicacionEditorialSolicitud solicitud, CancellationToken ct)
    {
        var practicas = await db.PublicacionesEditorialesPracticasMusicales
            .Where(x => x.PublicacionEditorialId == publicacionId).ToListAsync(ct);
        ClasificacionDeContenido.Reconciliar(
            db.PublicacionesEditorialesPracticasMusicales, practicas, x => x.PracticaMusicalId, solicitud.PracticasMusicalesIds,
            id => new PublicacionEditorialPracticaMusicalRow { PublicacionEditorialId = publicacionId, PracticaMusicalId = id });

        var territorios = await db.PublicacionesEditorialesTerritoriosSonoros
            .Where(x => x.PublicacionEditorialId == publicacionId).ToListAsync(ct);
        ClasificacionDeContenido.Reconciliar(
            db.PublicacionesEditorialesTerritoriosSonoros, territorios, x => x.TerritorioSonoroId, solicitud.TerritoriosSonorosIds,
            id => new PublicacionEditorialTerritorioSonoroRow { PublicacionEditorialId = publicacionId, TerritorioSonoroId = id });
    }

    private static async Task AplicarFuentesAsync(SimusDbContext db, long publicacionId, IReadOnlyList<long>? fuenteIds, CancellationToken ct)
    {
        if (fuenteIds is null) return;

        var actuales = await db.PublicacionesEditorialesFuentes
            .Where(x => x.PublicacionEditorialId == publicacionId).ToListAsync(ct);
        db.PublicacionesEditorialesFuentes.RemoveRange(actuales.Where(x => !fuenteIds.Contains(x.FuenteEditorialId)));

        var existentes = actuales.Select(x => x.FuenteEditorialId).ToHashSet();
        foreach (var id in fuenteIds.Distinct().Where(x => !existentes.Contains(x)))
        {
            db.PublicacionesEditorialesFuentes.Add(new PublicacionEditorialFuenteRow
            {
                PublicacionEditorialId = publicacionId,
                FuenteEditorialId = id,
            });
        }
    }

    /// <summary>
    /// Los créditos de la ficha: a quién se acredita y en qué papel.
    /// </summary>
    /// <remarks>
    /// <para>
    /// AUSENTE NO ES VACIO. <c>null</c> deja los créditos como estaban; una lista vacía los retira.
    /// Sin esa distinción, guardar un cambio de título desde un formulario que no envíe créditos
    /// dejaría la ficha sin autoría.
    /// </para>
    /// <para>
    /// EL AGENTE SE BUSCA POR NOMBRE Y SE CREA SI NO ESTA, que es como funciona un fichero de
    /// autoridades: quien cataloga escribe «Ibis Amador Martelo», no un identificador. La búsqueda
    /// es por nombre exacto sin distinguir mayúsculas; un agente nuevo queda marcado con
    /// <c>RequiereRevision</c> para que alguien confirme después si es un duplicado de otro que ya
    /// estaba escrito de otra forma. Fundir dos agentes NO se hace solo.
    /// </para>
    /// </remarks>
    private static async Task AplicarCreditosAsync(
        SimusDbContext db, long publicacionId, IReadOnlyList<CreditoEditorialSolicitud>? creditos, CancellationToken ct)
    {
        if (creditos is null) return;

        var limpios = creditos
            .Where(c => !string.IsNullOrWhiteSpace(c.Nombre) && !string.IsNullOrWhiteSpace(c.RolCodigo))
            .ToList();

        var actuales = await db.CreditosEditoriales
            .Where(x => x.PublicacionEditorialId == publicacionId).ToListAsync(ct);
        db.CreditosEditoriales.RemoveRange(actuales);

        var orden = 0;
        foreach (var credito in limpios)
        {
            var nombre = credito.Nombre!.Trim();
            var agente = await db.AgentesEditoriales
                .FirstOrDefaultAsync(a => a.NombrePreferido == nombre, ct);

            if (agente is null)
            {
                agente = new AgenteEditorialRow
                {
                    // El código es interno y solo tiene que ser único; el nombre es lo que se lee.
                    Codigo = $"AG-{Guid.NewGuid():N}"[..20],
                    Tipo = string.Equals(credito.Tipo?.Trim(), "entidad", StringComparison.OrdinalIgnoreCase) ? "entidad" : "persona",
                    NombrePreferido = nombre,
                    RequiereRevision = true,
                    FechaCreacion = DateTime.UtcNow,
                    FechaActualizacion = DateTime.UtcNow,
                };
                db.AgentesEditoriales.Add(agente);
                await db.SaveChangesAsync(ct);
            }

            db.CreditosEditoriales.Add(new CreditoEditorialRow
            {
                PublicacionEditorialId = publicacionId,
                AgenteEditorialId = agente.Id,
                RolCodigo = credito.RolCodigo!.Trim(),
                // El papel en letra NO se deriva del código: un mismo `aut` es «Autor» en una ficha
                // y «Autor corporativo» en otra. Si no llega, se usa el código como último recurso.
                RolEtiqueta = string.IsNullOrWhiteSpace(credito.RolEtiqueta)
                    ? credito.RolCodigo!.Trim()
                    : credito.RolEtiqueta!.Trim(),
                Principal = credito.Principal,
                Orden = credito.Orden > 0 ? credito.Orden : orden,
            });
            orden++;
        }
    }

    /// <summary>Los identificadores normalizados, con el cualificador que los distingue.</summary>
    /// <remarks>
    /// UNA OBRA PUEDE TENER VARIOS DEL MISMO ESQUEMA: `PNMC-ED-103` trae CINCO ISBN —PDF, EPUB,
    /// HTML, iBook y MOBI—, y sin el cualificador serían cinco líneas iguales.
    /// </remarks>
    private static async Task AplicarIdentificadoresAsync(
        SimusDbContext db, long publicacionId, IReadOnlyList<IdentificadorEditorialSolicitud>? identificadores, CancellationToken ct)
    {
        if (identificadores is null) return;

        var actuales = await db.IdentificadoresEditoriales
            .Where(x => x.PublicacionEditorialId == publicacionId).ToListAsync(ct);
        db.IdentificadoresEditoriales.RemoveRange(actuales);

        foreach (var identificador in identificadores.Where(i => !string.IsNullOrWhiteSpace(i.Codigo)))
        {
            db.IdentificadoresEditoriales.Add(new IdentificadorEditorialRow
            {
                PublicacionEditorialId = publicacionId,
                Esquema = string.IsNullOrWhiteSpace(identificador.Esquema) ? "ISBN" : identificador.Esquema!.Trim(),
                // SE GUARDA TAL COMO LLEGO. Corregirlo en silencio borraría la prueba de que la
                // fuente venía mal, que es justo lo que hay que poder revisar después.
                CodigoRecibido = identificador.Codigo!.Trim(),
                Cualificador = Limpiar(identificador.Cualificador),
            });
        }
    }

    /// <summary>Las vías de consulta: enlace, ubicación física o archivo del banco.</summary>
    /// <remarks>
    /// CADA ACCESO LLEVA SU PROPIA DECISION DE DERECHOS, y un acceso nuevo nace en
    /// <c>pendiente</c>: publicar la ficha y repartir el archivo son autorizaciones distintas y
    /// ninguna se concede por comodidad al crear la fila.
    /// </remarks>
    private static async Task AplicarAccesosAsync(
        SimusDbContext db, long publicacionId, IReadOnlyList<AccesoEditorialSolicitud>? accesos, CancellationToken ct)
    {
        if (accesos is null) return;

        var actuales = await db.AccesosEditoriales
            .Where(x => x.PublicacionEditorialId == publicacionId).ToListAsync(ct);

        var orden = 0;
        var nuevos = new List<AccesoEditorialRow>();
        foreach (var acceso in accesos.Where(CatalogoEditorialContrato.TieneDestinoValido))
        {
            var previo = actuales.FirstOrDefault(a =>
                a.Tipo == acceso.Tipo
                && (a.Url ?? string.Empty) == (acceso.Url ?? string.Empty)
                && (a.UbicacionFisica ?? string.Empty) == (acceso.UbicacionFisica ?? string.Empty));

            nuevos.Add(new AccesoEditorialRow
            {
                PublicacionEditorialId = publicacionId,
                Tipo = acceso.Tipo!,
                ArchivoId = acceso.ArchivoId is null ? null : (int)acceso.ArchivoId.Value,
                Url = Limpiar(acceso.Url),
                UbicacionFisica = Limpiar(acceso.UbicacionFisica),
                Etiqueta = Limpiar(acceso.Etiqueta),
                Nota = Limpiar(acceso.Nota),
                Orden = acceso.Orden > 0 ? acceso.Orden : orden,
                // UN ACCESO QUE YA EXISTIA CONSERVA SUS DERECHOS. Reescribirlos a «pendiente» al
                // guardar un cambio de etiqueta despublicaría en silencio lo que ya estaba revisado.
                DerechosEstado = previo?.DerechosEstado ?? "pendiente",
                DerechosPermitePublicarFicha = previo?.DerechosPermitePublicarFicha ?? false,
                DerechosPermitePublicarArchivo = previo?.DerechosPermitePublicarArchivo ?? false,
                DerechosLicenciaONota = previo?.DerechosLicenciaONota,
                DerechosFuenteId = previo?.DerechosFuenteId,
                DerechosFechaVerificacion = previo?.DerechosFechaVerificacion,
                DerechosVerificadoPor = previo?.DerechosVerificadoPor,
            });
            orden++;
        }

        db.AccesosEditoriales.RemoveRange(actuales);
        db.AccesosEditoriales.AddRange(nuevos);
    }

    /// <summary>Las cuatro facetas de tipología, por su código.</summary>
    /// <remarks>
    /// SE ENVIAN CODIGOS Y NO IDENTIFICADORES: `texto`, `audio`, `volumen`. El identificador de una
    /// fila del vocabulario cambia entre instalaciones; el código es el término de la norma.
    /// </remarks>
    private static async Task AplicarTipologiasAsync(
        SimusDbContext db, long publicacionId, IReadOnlyList<string>? codigos, CancellationToken ct)
    {
        if (codigos is null) return;

        var limpios = codigos.Select(c => (c ?? string.Empty).Trim()).Where(c => c.Length > 0).Distinct().ToList();
        var ids = await db.TipologiasEditoriales
            .Where(t => limpios.Contains(t.Codigo)).Select(t => t.Id).ToListAsync(ct);

        var actuales = await db.PublicacionesEditorialesTipologias
            .Where(x => x.PublicacionEditorialId == publicacionId).ToListAsync(ct);
        db.PublicacionesEditorialesTipologias.RemoveRange(actuales);

        foreach (var id in ids)
        {
            db.PublicacionesEditorialesTipologias.Add(new PublicacionEditorialTipologiaRow
            {
                PublicacionEditorialId = publicacionId,
                TipologiaEditorialId = id,
            });
        }
    }

    private static async Task AplicarPalabrasClaveAsync(
        SimusDbContext db, long publicacionId, IReadOnlyList<string>? terminos, CancellationToken ct)
    {
        if (terminos is null) return;

        var limpios = terminos
            .Select(x => x?.Trim() ?? string.Empty)
            .Where(x => x.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var actuales = await db.PalabrasClaveEditoriales
            .Where(x => x.PublicacionEditorialId == publicacionId).ToListAsync(ct);

        db.PalabrasClaveEditoriales.RemoveRange(
            actuales.Where(x => !limpios.Contains(x.Termino, StringComparer.OrdinalIgnoreCase)));

        foreach (var termino in limpios.Where(t =>
            !actuales.Any(a => string.Equals(a.Termino, t, StringComparison.OrdinalIgnoreCase))))
        {
            db.PalabrasClaveEditoriales.Add(new PalabraClaveEditorialRow
            {
                PublicacionEditorialId = publicacionId,
                Termino = termino,
            });
        }
    }

    /// <summary>
    /// Lo que una ficha necesita para poder guardarse.
    /// </summary>
    /// <remarks>
    /// EL CODIGO YA NO SE EXIGE, ni al crear. Llevaba un parámetro `exigeCodigo` que solo era cierto
    /// en el alta; desde que el servidor lo asigna por orden de registro, exigirlo ahí rechazaba
    /// justo el caso normal. El parámetro se retira en vez de quedarse sin uso: un argumento que ya
    /// no decide nada es una pregunta que alguien volverá a hacerse.
    /// </remarks>
    private static IResult? Validar(GuardarPublicacionEditorialSolicitud solicitud)
    {
        var errores = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(solicitud.Titulo)) errores["titulo"] = ["El título es obligatorio."];
        if (solicitud.AnioInicio is not null && solicitud.AnioFin is not null && solicitud.AnioFin < solicitud.AnioInicio)
        {
            errores["anioFin"] = ["El año final no puede ser anterior al inicial."];
        }
        return errores.Count > 0 ? Results.ValidationProblem(errores) : null;
    }


    /// <summary>
    /// El nombre de cada categoría de la página, en una consulta.
    /// </summary>
    /// <remarks>
    /// EL IDENTIFICADOR ES EL DATO Y EL NOMBRE ES COMO SE LEE. Se resuelve al servir y no se guarda
    /// junto al identificador: dos columnas con la misma verdad acaban discrepando.
    /// </remarks>
    private static async Task<Dictionary<int, string>> ResolverCategoriasAsync(
        SimusDbContext db, IEnumerable<int?> identificadores, CancellationToken ct)
    {
        var ids = identificadores.Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];

        return await db.Categorias.AsNoTracking()
            .Where(c => ids.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.NombreCategoria, ct);
    }

    private static string? Limpiar(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    /// <summary>
    /// Deja la ruta de la portada referida a la raíz del sitio.
    ///
    /// <para>
    /// POR QUE SE NORMALIZA AQUI Y NO EN LA PANTALLA. Las tres fichas de verificación se guardaron
    /// como <c>editorial/thumbs/PNMC-ED-001.png</c>, sin barra inicial, y las portadas se veían:
    /// el navegador resolvía la ruta relativa contra <c>/editorial</c> y acertaba por casualidad.
    /// Desde cualquier otra ruta —una ficha con su propio camino— habría fallado, y la utilidad de
    /// miniaturas del proyecto solo sustituye rutas absolutas, así que el mosaico seguía pidiendo
    /// el original. Corregirlo en el servidor vale para todo lo que escriba en esta columna, venga
    /// de la consola o de la carga del acervo.
    /// </para>
    /// <para>
    /// Una dirección externa (<c>http://</c>, <c>https://</c>) o un dato incrustado se dejan
    /// intactos: no son rutas de este sitio y anteponerles una barra los rompería.
    /// </para>
    /// </summary>
    private static string? LimpiarRuta(string? valor)
    {
        var limpio = Limpiar(valor);
        if (limpio is null || limpio.StartsWith('/')) return limpio;
        var esExterna = limpio.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || limpio.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || limpio.StartsWith("data:", StringComparison.OrdinalIgnoreCase);
        return esExterna ? limpio : "/" + limpio;
    }

    /// <summary>El módulo con el que esta ficha aparece en el hilo de revisión del proyecto.</summary>
    private const string Modulo = Modulos.CatalogoEditorial;

    /// <summary>
    /// Deja constancia de una decisión sobre la ficha en el hilo único de revisión.
    /// </summary>
    /// <remarks>
    /// <para>
    /// HASTA HOY EL CATALOGO NO ESCRIBIA NADA. Validar una ficha, observarla, publicarla o retirarla
    /// no dejaba rastro, aunque `dbo.RegistrosRevisionHistorial` —el hilo que ya usa el circuito de
    /// Festivales— existía desde mayo. A la pregunta «quién validó esto y por qué se retiró» no
    /// había respuesta.
    /// </para>
    /// <para>
    /// LOS DOS EJES NUNCA CAMBIAN A LA VEZ, así que `EstadoNuevo` es el valor nuevo del que se movió
    /// y `Accion` dice cuál. El otro viaja en `MetadataJson` para que la fila se lea sola.
    /// </para>
    /// </remarks>
    private static void Historiar(
        SimusDbContext db, int actor, PublicacionEditorialRow fila,
        string accion, string? estadoAnterior, string estadoNuevo, string? comentario)
    {
        db.HistorialesRevisionRegistros.Add(new HistorialRevisionRegistroRow
        {
            ModuloId = Modulo,
            RegistroId = fila.Id.ToString(CultureInfo.InvariantCulture),
            EstadoAnterior = estadoAnterior,
            EstadoNuevo = estadoNuevo,
            Accion = accion,
            Comentario = Recortar(comentario, 1200),
            UsuarioId = actor == 0 ? null : actor,
            Fecha = DateTime.UtcNow,
            MetadataJson =
                $"{{\"codigo\":\"{fila.Codigo}\",\"catalogacion\":\"{fila.EstadoCatalogacion}\",\"publicacion\":\"{fila.EstadoPublicacion}\"}}",
        });
    }

    /// <summary>
    /// El hilo de trabajo de una ficha: decisiones y anotaciones, en un solo orden.
    /// </summary>
    private static async Task<IResult> LeerHistorial(long id, SimusDbContext db, CancellationToken ct)
    {
        var existe = await db.PublicacionesEditoriales.AsNoTracking().AnyAsync(x => x.Id == id, ct);
        if (!existe) return Results.NotFound();

        var registro = id.ToString(CultureInfo.InvariantCulture);
        var filas = await db.HistorialesRevisionRegistros.AsNoTracking()
            .Where(x => x.ModuloId == Modulo && x.RegistroId == registro)
            .OrderByDescending(x => x.Fecha).ThenByDescending(x => x.Id)
            .ToListAsync(ct);

        // EL NOMBRE DE QUIEN DECIDIO, NO SU NUMERO. Un historial que dice «usuario 12» obliga a ir a
        // buscar quién es, que es justo lo que un historial existe para evitar.
        var ids = filas.Select(x => x.UsuarioId).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var nombres = await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        return Results.Ok(filas.Select(x => new AnotacionEditorialDto(
            x.Id, x.Accion, x.EstadoAnterior, x.EstadoNuevo, x.Comentario,
            x.UsuarioId, x.UsuarioId.HasValue && nombres.TryGetValue(x.UsuarioId.Value, out var n) ? n : null,
            x.Fecha)).ToList());
    }

    /// <summary>
    /// Deja una anotación sobre la ficha, sin mover ningún estado.
    /// </summary>
    /// <remarks>
    /// ES UNA FILA MAS DEL MISMO HILO y no una tabla de comentarios aparte: así, lo que alguien
    /// anotó y la decisión que comenta se leen en el mismo sitio y en el mismo orden. `EstadoNuevo`
    /// repite el estado de catalogación actual porque nada se movió, y eso además deja dicho en qué
    /// situación estaba la ficha cuando se escribió.
    /// </remarks>
    private static async Task<IResult> Anotar(
        long id, AnotacionEditorialSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var texto = (solicitud?.Comentario ?? string.Empty).Trim();
        if (texto.Length == 0)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["comentario"] = ["Escribe la anotación: una entrada vacía no dice nada a quien la lea después."],
            });
        }

        var fila = await db.PublicacionesEditoriales.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();

        Historiar(db, Actor(principal), fila, "Anotacion", fila.EstadoCatalogacion, fila.EstadoCatalogacion, texto);
        await db.SaveChangesAsync(ct);
        return Results.Ok();
    }

    private static IResult MotivoObligatorio(string mensaje) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { ["motivo"] = [mensaje] });

    /// <summary>La acción con la que un cambio de derechos entra en el hilo de la ficha.</summary>
    internal const string AccionDerechosCambiados = "DerechosCambiados";

    /// <summary>
    /// Registra los derechos de la ficha y de sus accesos.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>LO HACE QUIEN CATALOGA, NO QUIEN PUBLICA.</b> Basta el módulo `catalogo-editorial`; la
    /// decisión de sacar la ficha al portal sigue en <see cref="CambiarPublicacion"/>, que exige
    /// webmaster. Hasta los derechos solo los fijaban las semillas y la importación, así que
    /// una ficha creada en la consola nunca podía publicarse.
    /// </para>
    /// <para>
    /// <b>«PENDIENTE» NO AUTORIZA NADA.</b> Un permiso concedido con los derechos sin verificar es una
    /// contradicción, y la puerta del portal no tiene cómo distinguirla.
    /// </para>
    /// <para>
    /// <b>QUIÉN Y CUÁNDO LOS PONE EL SERVIDOR</b>, y el cambio queda en el hilo como
    /// <c>DerechosCambiados</c>, con el estado de catalogación repetido —como una anotación—
    /// porque los derechos no son ninguno de los dos ejes.
    /// </para>
    /// </remarks>
    private static async Task<IResult> GuardarDerechos(
        long id, GuardarDerechosEditorialesSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        if (solicitud.Ficha is null && solicitud.Accesos is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["ficha"] = ["Indica los derechos de la ficha o de algún acceso."] });
        }

        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        RevisarDerechos(errores, "ficha", solicitud.Ficha);
        var accesosPedidos = solicitud.Accesos ?? [];
        for (var i = 0; i < accesosPedidos.Count; i++)
        {
            RevisarDerechos(errores, $"accesos[{i}]", accesosPedidos[i]);
        }
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var fila = await db.PublicacionesEditoriales.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();
        if (solicitud.Version != fila.Version)
        {
            return Results.Conflict(new { message = "La ficha cambió desde que se abrió. Vuelva a cargarla antes de guardar." });
        }

        // LA FUENTE DE UNOS DERECHOS ES UNA DE LAS QUE LA FICHA YA CITA. Una fuente ajena dejaría
        // la autorización respaldada por algo que la ficha no reconoce.
        var fuentesDeLaFicha = await db.PublicacionesEditorialesFuentes.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == fila.Id).Select(x => x.FuenteEditorialId).ToListAsync(ct);
        var accesosDeLaFicha = await db.AccesosEditoriales
            .Where(x => x.PublicacionEditorialId == fila.Id).ToListAsync(ct);

        if (solicitud.Ficha?.FuenteId is long fuenteFicha && !fuentesDeLaFicha.Contains(fuenteFicha))
        {
            errores["ficha"] = ["La fuente de los derechos debe ser una de las que cita la ficha."];
        }
        for (var i = 0; i < accesosPedidos.Count; i++)
        {
            var pedido = accesosPedidos[i];
            if (accesosDeLaFicha.TrueForAll(a => a.Id != pedido.AccesoId))
            {
                errores[$"accesos[{i}]"] = ["Ese acceso no es de esta ficha. Vuelva a cargarla."];
            }
            else if (pedido.FuenteId is long fuenteAcceso && !fuentesDeLaFicha.Contains(fuenteAcceso))
            {
                errores[$"accesos[{i}]"] = ["La fuente de los derechos debe ser una de las que cita la ficha."];
            }
        }
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var actor = Actor(principal);
        var verificador = actor == 0
            ? null
            : await db.Users.AsNoTracking().Where(u => u.Id == actor).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        verificador = Recortar(verificador, 200);
        var ahora = DateTime.UtcNow;

        var antes = new
        {
            ficha = new { fila.DerechosEstado, fila.DerechosPermitePublicarFicha, fila.DerechosPermitePublicarArchivo },
            accesos = accesosDeLaFicha.Select(a => new { a.Id, a.DerechosEstado, a.DerechosPermitePublicarFicha, a.DerechosPermitePublicarArchivo }).ToList(),
        };

        var partes = new List<string>();
        if (solicitud.Ficha is { } f)
        {
            fila.DerechosEstado = f.Estado!;
            fila.DerechosPermitePublicarFicha = f.PermitePublicarFicha;
            fila.DerechosPermitePublicarArchivo = f.PermitePublicarArchivo;
            fila.DerechosLicenciaONota = Recortar(f.LicenciaONota, 600);
            fila.DerechosFuenteId = f.FuenteId;
            fila.DerechosFechaVerificacion = ahora;
            fila.DerechosVerificadoPor = verificador;
            partes.Add($"Ficha: {ResumenDeDerechos(f)}.");
        }
        foreach (var pedido in accesosPedidos)
        {
            var acceso = accesosDeLaFicha.First(a => a.Id == pedido.AccesoId);
            acceso.DerechosEstado = pedido.Estado!;
            acceso.DerechosPermitePublicarFicha = pedido.PermitePublicarFicha;
            acceso.DerechosPermitePublicarArchivo = pedido.PermitePublicarArchivo;
            acceso.DerechosLicenciaONota = Recortar(pedido.LicenciaONota, 600);
            acceso.DerechosFuenteId = pedido.FuenteId;
            acceso.DerechosFechaVerificacion = ahora;
            acceso.DerechosVerificadoPor = verificador;
            partes.Add($"Acceso «{acceso.Etiqueta ?? acceso.Url ?? acceso.UbicacionFisica ?? acceso.Tipo}»: {ResumenDeDerechos(pedido)}.");
        }

        fila.Version += 1;
        fila.FechaActualizacion = ahora;
        Auditar(db, actor, fila.Id, "actualizar", antes, new
        {
            ficha = new { fila.DerechosEstado, fila.DerechosPermitePublicarFicha, fila.DerechosPermitePublicarArchivo },
            accesos = accesosPedidos.Select(a => new { a.AccesoId, a.Estado, a.PermitePublicarFicha, a.PermitePublicarArchivo }).ToList(),
        });
        Historiar(db, actor, fila, AccionDerechosCambiados, fila.EstadoCatalogacion, fila.EstadoCatalogacion, string.Join(" ", partes));
        await db.SaveChangesAsync(ct);
        return Results.Ok(await ArmarAsync(db, fila, soloPublico: false, ct));
    }

    /// <summary>La acción con la que registrar o corregir una fuente entra en el hilo de la ficha.</summary>
    internal const string AccionFuenteRegistrada = "FuenteRegistrada";
    internal const string AccionFuenteCorregida = "FuenteCorregida";

    private static Dictionary<string, string[]> RevisarFuente(GuardarFuenteEditorialSolicitud s)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var nombre = (s.Nombre ?? string.Empty).Trim();
        if (nombre.Length == 0) errores["nombre"] = ["Escribe cómo se llama la fuente."];
        else if (nombre.Length > 300) errores["nombre"] = ["El nombre admite hasta 300 caracteres."];
        var referencia = (s.Referencia ?? string.Empty).Trim();
        var url = (s.Url ?? string.Empty).Trim();
        if (referencia.Length > 600) errores["referencia"] = ["La referencia admite hasta 600 caracteres."];
        if (url.Length > 1000) errores["url"] = ["El enlace admite hasta 1000 caracteres."];
        else if (url.Length > 0
            && !(Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)))
        {
            errores["url"] = ["El enlace debe empezar por http:// o https://."];
        }
        if (referencia.Length == 0 && url.Length == 0 && !errores.ContainsKey("url"))
        {
            errores["referencia"] = ["Indica el enlace o la referencia con la que se localiza la fuente."];
        }
        return errores;
    }

    /// <summary>
    /// Registra una fuente nueva y la cita en la ficha.
    /// </summary>
    /// <remarks>
    /// La fuente es lo primero que le falta a una ficha creada en la consola: «Publicar» exige al
    /// menos una y no había forma de crearla. Quién la verificó y cuándo la consultó los pone el
    /// servidor. Queda en el hilo de la ficha como <c>FuenteRegistrada</c>.
    /// </remarks>
    private static async Task<IResult> AgregarFuente(
        long id, GuardarFuenteEditorialSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var errores = RevisarFuente(solicitud);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var fila = await db.PublicacionesEditoriales.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();
        if (solicitud.Version != fila.Version)
        {
            return Results.Conflict(new { message = "La ficha cambió desde que se abrió. Vuelva a cargarla antes de guardar." });
        }

        var actor = Actor(principal);
        var ahora = DateTime.UtcNow;
        var fuente = new FuenteEditorialRow
        {
            Nombre = Recortar(solicitud.Nombre, 300)!,
            Referencia = Recortar(solicitud.Referencia, 600),
            Url = Recortar(solicitud.Url, 1000),
            FechaFuente = FechaDeCalendario(solicitud.FechaFuente),
            FechaConsulta = ahora,
            VerificadaPor = await NombreDelActorAsync(db, actor, ct) ?? "Equipo del PNMC",
            FechaCreacion = ahora,
        };
        db.FuentesEditoriales.Add(fuente);
        // DOS GUARDADOS: la relación necesita el identificador que la base da a la fuente.
        await db.SaveChangesAsync(ct);
        db.PublicacionesEditorialesFuentes.Add(new PublicacionEditorialFuenteRow
        {
            PublicacionEditorialId = fila.Id,
            FuenteEditorialId = fuente.Id,
        });
        fila.Version += 1;
        fila.FechaActualizacion = ahora;
        Auditar(db, actor, fila.Id, "actualizar", null, new { fuente = new { fuente.Id, fuente.Nombre } });
        Historiar(db, actor, fila, AccionFuenteRegistrada, fila.EstadoCatalogacion, fila.EstadoCatalogacion,
            $"Fuente registrada: «{fuente.Nombre}».");
        await db.SaveChangesAsync(ct);
        return Results.Ok(await ArmarAsync(db, fila, soloPublico: false, ct));
    }

    /// <summary>Corrige una fuente que la ficha ya cita. Queda como <c>FuenteCorregida</c>.</summary>
    private static async Task<IResult> EditarFuente(
        long id, long fuenteId, GuardarFuenteEditorialSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var errores = RevisarFuente(solicitud);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var fila = await db.PublicacionesEditoriales.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();
        if (solicitud.Version != fila.Version)
        {
            return Results.Conflict(new { message = "La ficha cambió desde que se abrió. Vuelva a cargarla antes de guardar." });
        }
        // SOLO UNA FUENTE QUE LA FICHA CITA: la fuente puede servir a otras fichas y esta no es el
        // sitio para tocar las de otras.
        var citada = await db.PublicacionesEditorialesFuentes.AsNoTracking()
            .AnyAsync(x => x.PublicacionEditorialId == fila.Id && x.FuenteEditorialId == fuenteId, ct);
        if (!citada) return Results.NotFound();
        var fuente = await db.FuentesEditoriales.FirstOrDefaultAsync(x => x.Id == fuenteId, ct);
        if (fuente is null) return Results.NotFound();

        var actor = Actor(principal);
        var ahora = DateTime.UtcNow;
        var nombreAnterior = fuente.Nombre;
        var antes = new { fuente.Nombre, fuente.Referencia, fuente.Url, fuente.FechaFuente };
        fuente.Nombre = Recortar(solicitud.Nombre, 300)!;
        fuente.Referencia = Recortar(solicitud.Referencia, 600);
        fuente.Url = Recortar(solicitud.Url, 1000);
        fuente.FechaFuente = FechaDeCalendario(solicitud.FechaFuente);
        fuente.FechaConsulta = ahora;
        fuente.VerificadaPor = await NombreDelActorAsync(db, actor, ct) ?? fuente.VerificadaPor;
        fila.Version += 1;
        fila.FechaActualizacion = ahora;
        Auditar(db, actor, fila.Id, "actualizar", new { fuente = antes }, new { fuente = new { fuente.Nombre, fuente.Referencia, fuente.Url, fuente.FechaFuente } });
        Historiar(db, actor, fila, AccionFuenteCorregida, fila.EstadoCatalogacion, fila.EstadoCatalogacion,
            $"Fuente corregida: «{nombreAnterior}»" + (nombreAnterior == fuente.Nombre ? "." : $", ahora «{fuente.Nombre}»."));
        await db.SaveChangesAsync(ct);
        return Results.Ok(await ArmarAsync(db, fila, soloPublico: false, ct));
    }

    /// <summary>Una fecha de calendario se guarda a mediodía UTC: ninguna zona la corre de día.</summary>
    private static DateTime? FechaDeCalendario(DateTime? fecha) =>
        fecha is { } f ? DateTime.SpecifyKind(f.Date.AddHours(12), DateTimeKind.Utc) : null;

    private static async Task<string?> NombreDelActorAsync(SimusDbContext db, int actor, CancellationToken ct) =>
        actor == 0
            ? null
            : Recortar(await db.Users.AsNoTracking().Where(u => u.Id == actor).Select(u => u.FullName).FirstOrDefaultAsync(ct), 200);

    private static void RevisarDerechos(Dictionary<string, string[]> errores, string clave, DerechosEditorialesSolicitud? d)
    {
        if (d is null) return;
        if (!CatalogoEditorialContrato.EstadosDerechos.Contains(d.Estado ?? string.Empty))
        {
            errores[clave] = ["Estado de derechos no reconocido: pendiente, verificado o restringido."];
        }
        else if (d.Estado == "pendiente" && (d.PermitePublicarFicha || d.PermitePublicarArchivo))
        {
            errores[clave] = ["Con los derechos pendientes no se puede autorizar ninguna publicación."];
        }
        else if ((d.LicenciaONota?.Trim().Length ?? 0) > 600)
        {
            errores[clave] = ["La licencia o nota admite hasta 600 caracteres."];
        }
    }

    private static string ResumenDeDerechos(DerechosEditorialesSolicitud d) =>
        $"{d.Estado}; publicar ficha: {(d.PermitePublicarFicha ? "sí" : "no")}; publicar archivo: {(d.PermitePublicarArchivo ? "sí" : "no")}";

    private static int Actor(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), CultureInfo.InvariantCulture, out var id) ? id : 0;

    /// <summary>
    /// Escribe en la bitácora.
    ///
    /// <para>
    /// LOS VALORES VIAJAN COMO OBJETO, NUNCA COMO CADENA SUELTA. `CK_BitacoraAuditoria_*_JSON`
    /// exige `ISJSON(...) = 1`, e `ISJSON` rechaza un escalar: <c>"Acento"</c> es JSON válido para
    /// cualquier analizador y no para esa comprobación. Serializar el título a secas hacía fallar
    /// el INSERT entero con un 500 que no decía nada del catálogo.
    /// </para>
    /// <para>
    /// Y EL VERBO SALE DE UNA LISTA BLANCA de trece. Inventar uno nuevo no da un error de
    /// compilación: da un 500 la primera vez que alguien cataloga algo.
    /// </para>
    /// </summary>
    private static void Auditar(SimusDbContext db, int actor, long id, string accion, object? antes, object? despues) =>
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = actor,
            TableName = "PublicacionesEditoriales",
            RecordId = id.ToString(CultureInfo.InvariantCulture),
            Action = accion,
            PreviousValuesJson = antes is null ? null : JsonSerializer.Serialize(antes),
            NewValuesJson = despues is null ? null : JsonSerializer.Serialize(despues),
            CreatedAt = DateTime.UtcNow,
        });
}

/// <summary>Cambio de un estado, con su motivo opcional para la auditoría.</summary>
public sealed class CambioDeEstadoEditorial
{
    public string? Estado { get; set; }
    public string? Motivo { get; set; }
}
