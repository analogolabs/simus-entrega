using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La bitácora de auditoría, legible.
/// </summary>
/// <remarks>
/// <para>
/// POR QUE HACIA FALTA UNA RUTA PROPIA. El monitor ya devolvia las ocho ultimas filas de
/// <c>BitacoraAuditoria</c> en crudo, y en pantalla se leian asi: «crear · Festivales ». Tres
/// datos y ninguno util: la accion sin sujeto, el nombre de una tabla, y un identificador que no
/// dice a QUE registro pertenece ni QUIEN lo toco. Para responder «quien edito que» hacen falta dos
/// cosas que la fila no trae: el nombre de la persona —que esta en <c>Usuarios</c>— y el nombre del
/// registro —que esta en la tabla afectada, cada una con su columna—.
/// </para>
/// <para>
/// EL NOMBRE DEL REGISTRO NO SALE DEL JSON, aunque lo pareciera. <c>ValoresNuevos</c> guarda lo que
/// cada endpoint decidio guardar; en un Festival recien creado son
/// <c>{"OrganizacionPrincipalId":117,"Estado":"borrador","Evento":"FestivalCreado"}</c>: ni rastro
/// del nombre. Y 26 de las 57 filas de la base local no tienen JSON en absoluto. Se resuelve
/// consultando la tabla afectada, que es la unica fuente que siempre lo tiene.
/// </para>
/// <para>
/// UNA CONSULTA POR TABLA PRESENTE EN LA PAGINA, NO UNA POR FILA. Se pide una pagina, se agrupan
/// sus identificadores por tabla y se resuelve cada tabla de un viaje. Con veinte filas eso son
/// como mucho cinco consultas, no veinte.
/// </para>
/// </remarks>
public static class AdminAuditoriaEndpoints
{
    /// <summary>Cuantas filas devuelve una pagina si no se pide otra cosa.</summary>
    private const int TamanoPorOmision = 20;

    /// <summary>
    /// Tope duro de pagina.
    /// </summary>
    /// <remarks>
    /// No es decoracion: cada fila de la pagina puede obligar a resolver un nombre, asi que una
    /// peticion con <c>tamano=100000</c> se convierte en un barrido de varias tablas. El tope se
    /// aplica en el servidor porque el cliente no es quien decide cuanto trabajo pedir.
    /// </remarks>
    private const int TamanoMaximo = 50;

    /// <summary>Grupo al que va a parar una tabla que nadie ha clasificado todavia.</summary>
    private const string GrupoOtros = "otros";

    /// <summary>
    /// De que grupo es cada tabla.
    /// </summary>
    /// <remarks>
    /// LAS TABLAS SON LAS QUE EL CODIGO ESCRIBE DE VERDAD. Se comprobaron dos veces: buscando
    /// <c>TableName = "..."</c> en el codigo (Entidades, Festivales, PropuestasCambioFestival) y
    /// mirando que hay en la bitacora de la base local (Usuarios, Festivales, Noticias, Agenda).
    /// Las demas entran porque sus modulos comparten la ruta de escritura del panel. Una tabla que
    /// no este aqui NO se pierde: cae en «otros» con su propio nombre como etiqueta, que es peor que
    /// clasificarla pero mucho mejor que ocultarla.
    /// </remarks>
    private static readonly Dictionary<string, (string Grupo, string Etiqueta)> ClasificacionPorTabla =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Noticias"] = ("noticias", "Noticias"),
            // LA AGENDA ESCRIBE «EventosAgenda» Y AQUI SOLO ESTABA «Agenda». Comprobado contra
            // `AgendaEndpoints.Auditar`, que escribe `TableName = "EventosAgenda"`: TODAS sus
            // líneas caían en «otros» y la pestaña de Agenda de la auditoría salía vacía. Se deja
            // también el nombre viejo por si quedaron filas escritas con él.
            ["EventosAgenda"] = ("agenda", "Agenda"),
            ["Agenda"] = ("agenda", "Agenda"),
            ["AlbumesGaleria"] = ("editorial", "Álbumes y galería"),
            ["GaleriaAlbumes"] = ("editorial", "Galería"),
            ["GaleriaItems"] = ("editorial", "Galería"),
            ["Festivales"] = ("festivales", "Festivales"),
            // NOMBRE HISTORICO. Hasta las propuestas de cambio sobre
            // un festival se anotaban con el nombre de su tabla de entonces. La tabla se retiró y
            // esas líneas ahora se anotan como «Festivales», igual que las de Mercados; la clave
            // vieja se conserva para que las filas ya escritas sigan clasificándose.
            ["PropuestasCambioFestival"] = ("festivales", "Festivales"),
            ["Entidades"] = ("organizaciones", "Organizaciones"),
            ["Usuarios"] = ("usuarios", "Usuarios y accesos"),
            // El Catalogo Editorial escribe bitacora desde una revisión anterior y no estaba aqui: sus
            // lineas caian en «otros» y la consola enseñaba el nombre crudo de la tabla,
            // «PublicacionesEditoriales», donde deberia ir el titulo de la ficha.
            ["PublicacionesEditoriales"] = ("editorial", "Catálogo Editorial"),
            // (L9): LAS TABLAS INTERNAS TAMBIEN SE LEEN COMO SECCIONES. «ModulosPorCuenta»,
            // «UsuariosEntidades» o «AdministracionControl» salían tal cual, en «otros», y quien revisa
            // la bitácora no sabe qué tabla es esa: sabe qué sección de la consola es. Cada una se
            // traduce a la sección donde se hace el cambio que la escribe.
            ["Mercados"] = ("mercados", "Mercados"),
            ["EdicionesMercado"] = ("mercados", "Mercados"),
            ["EdicionesFestival"] = ("festivales", "Festivales"),
            ["ReclamacionesAdministracion"] = ("festivales", "Festivales"),
            ["Categorias"] = ("categorias", "Categorías y proyectos"),
            ["PracticasMusicales"] = ("categorias", "Catálogos"),
            ["TerritoriosSonoros"] = ("categorias", "Catálogos"),
            ["ProyectosTransversales"] = ("categorias", "Categorías y proyectos"),
            ["ValoresDeTaxonomiaDePerfiles"] = ("categorias", "Categorías y proyectos"),
            ["LotesImportacion"] = ("importaciones", "Importaciones"),
            ["ModulosPorCuenta"] = ("usuarios", "Usuarios y accesos"),
            ["UsuariosEntidades"] = ("organizaciones", "Organizaciones"),
            ["InvitacionesDeOrganizacion"] = ("organizaciones", "Organizaciones"),
            ["AdministracionControl"] = ("sistema", "Sistema"),
        };

    /// <summary>
    /// Los verbos que son ENTRADAS Y SALIDAS de una sesión, no actuaciones sobre un registro.
    /// </summary>
    /// <remarks>
    /// (L9): de 167 filas, 86 eran «Inició sesión». Se separan en la vista «Accesos» para que
    /// «Actuaciones» —quién cambió qué— no quede enterrada bajo el ruido de las sesiones. Son los
    /// cuatro verbos de sesión de <c>CK_BitacoraAuditoria_Accion</c>.
    /// </remarks>
    private static readonly string[] VerbosDeAcceso =
        ["iniciar_sesion", "cerrar_sesion", "iniciar_sesion_externa", "cerrar_sesion_externa"];

    public static RouteGroupBuilder MapAdminAuditoriaEndpoints(this RouteGroupBuilder group)
    {
        var admin = group.MapGroup("/admin/auditoria").WithTags("admin-auditoria");
        admin.RequireAuthorization(SimusAuthentication.InstitutionalPolicy);
        admin.ExigeModulo("auditoria");

        admin.MapGet("/", async (
            string? grupo,
            string? accion,
            string? registroId,
            string? tabla,
            string? vista,
            string? q,
            DateTime? desde,
            string? orden,
            string? direccion,
            int? pagina,
            int? tamano,
            SimusDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var paginaPedida = Math.Max(1, pagina ?? 1);
            var tamanoPedido = Math.Clamp(tamano ?? TamanoPorOmision, 1, TamanoMaximo);
            var grupoPedido = (grupo ?? string.Empty).Trim().ToLowerInvariant();
            var accionPedida = (accion ?? string.Empty).Trim();
            var registroPedido = (registroId ?? string.Empty).Trim();
            var tablaPedida = (tabla ?? string.Empty).Trim();

            // LOS TOTALES POR GRUPO SE CUENTAN SOBRE TODA LA BITACORA, NO SOBRE LA PAGINA NI SOBRE
            // EL FILTRO. Son las cifras de las pestañas: si se recalcularan con el filtro puesto,
            // al elegir «Noticias» las demas pestañas mostrarian cero y pareceria que no hay nada
            // en ellas.
            var porTabla = await dbContext.AuditLogs.AsNoTracking()
                .GroupBy(fila => fila.TableName)
                .Select(g => new { Tabla = g.Key, Total = g.Count() })
                .ToListAsync(cancellationToken);

            var grupos = porTabla
                .Select(x => (Clasificacion: Clasificar(x.Tabla), x.Total))
                .GroupBy(x => x.Clasificacion.Grupo, StringComparer.Ordinal)
                .Select(g => new AuditoriaGrupoDto(g.Key, g.First().Clasificacion.Etiqueta, g.Sum(x => x.Total)))
                .OrderByDescending(g => g.Total)
                .ThenBy(g => g.Etiqueta, StringComparer.Ordinal)
                .ToList();

            // LOS VERBOS, TAMBIEN SOBRE TODA LA BITACORA, por la misma razon que los grupos: son las
            // posiciones de una lista, y una lista que se cuenta a si misma con el filtro puesto diria
            // cero en todas las demas.
            var acciones = (await dbContext.AuditLogs.AsNoTracking()
                    .GroupBy(fila => fila.Action)
                    .Select(g => new { Accion = g.Key, Total = g.Count() })
                    .ToListAsync(cancellationToken))
                .Select(x => new AuditoriaAccionDto(x.Accion, VerbosDeBitacora.Etiquetar(x.Accion), x.Total))
                .OrderByDescending(x => x.Total)
                .ThenBy(x => x.Etiqueta, StringComparer.CurrentCulture)
                .ToList();

            // ACTUACIONES Y ACCESOS, POR SEPARADO. Los totales de las dos vistas cuentan toda la
            // bitácora, por la misma razón que los de grupos: son las cifras de dos pestañas. Sin
            // `vista` se devuelve todo, como antes, para quien consulte el historial de un registro.
            var totalAccesos = await dbContext.AuditLogs.AsNoTracking()
                .CountAsync(fila => VerbosDeAcceso.Contains(fila.Action), cancellationToken);
            var totalActuaciones = await dbContext.AuditLogs.AsNoTracking()
                .CountAsync(fila => !VerbosDeAcceso.Contains(fila.Action), cancellationToken);

            var consulta = dbContext.AuditLogs.AsNoTracking().AsQueryable();

            var vistaPedida = (vista ?? string.Empty).Trim().ToLowerInvariant();
            if (vistaPedida == "accesos")
            {
                consulta = consulta.Where(fila => VerbosDeAcceso.Contains(fila.Action));
            }
            else if (vistaPedida == "actuaciones")
            {
                consulta = consulta.Where(fila => !VerbosDeAcceso.Contains(fila.Action));
            }

            if (grupoPedido.Length > 0 && grupoPedido != "todos")
            {
                // Lista y no `Dictionary.Keys`: EF sabe traducir `List.Contains` a un IN de SQL,
                // pero no la coleccion de claves de un diccionario.
                var tablasConocidas = ClasificacionPorTabla.Keys.ToList();
                // El filtro llega como grupo y la columna guarda tablas: se traduce aqui.
                var tablas = ClasificacionPorTabla
                    .Where(par => par.Value.Grupo == grupoPedido)
                    .Select(par => par.Key)
                    .ToList();

                consulta = grupoPedido == GrupoOtros
                    ? consulta.Where(fila => !tablasConocidas.Contains(fila.TableName))
                    : consulta.Where(fila => tablas.Contains(fila.TableName));
            }

            if (accionPedida.Length > 0)
            {
                consulta = consulta.Where(fila => fila.Action == accionPedida);
            }

            if (registroPedido.Length > 0)
            {
                consulta = consulta.Where(fila => fila.RecordId == registroPedido);
            }

            // LA TABLA JUNTO AL IDENTIFICADOR, O EL HISTORIAL MIENTE.
            //
            // `registroId` a secas cruza tablas: la noticia 5 y el evento 5 comparten
            // identificador, así que el historial de uno enseñaba también las actuaciones del
            // otro. Con la tabla, la ficha de un registro pide exactamente su propia historia.
            if (tablaPedida.Length > 0)
            {
                consulta = consulta.Where(fila => fila.TableName == tablaPedida);
            }

            // BUSCA A LA PERSONA, NO EL VERBO. El campo de texto de la pantalla buscaba el codigo exacto
            // de la accion —«iniciar_sesion»—, que nadie escribe; la accion es ahora una lista. Lo que
            // se escribe en un buscador de bitacora es quien: un nombre o un correo. Y, de paso, el
            // identificador de un registro cuando se conoce.
            var textoPedido = (q ?? string.Empty).Trim();
            if (textoPedido.Length > 0)
            {
                var quienes = dbContext.Users
                    .Where(usuario => usuario.FullName.Contains(textoPedido) || usuario.Email.Contains(textoPedido))
                    .Select(usuario => (int?)usuario.Id);
                consulta = consulta.Where(fila => quienes.Contains(fila.UserId) || fila.RecordId == textoPedido);
            }

            // EL PERIODO. `desde` llega en ISO; si trae zona se lleva a UTC, que es como guarda la
            // bitacora, y si no la trae se toma como UTC en vez de como la hora local del servidor.
            if (desde is { } desdePedido)
            {
                var desdeUtc = desdePedido.Kind == DateTimeKind.Local
                    ? desdePedido.ToUniversalTime()
                    : DateTime.SpecifyKind(desdePedido, DateTimeKind.Utc);
                consulta = consulta.Where(fila => fila.CreatedAt >= desdeUtc);
            }

            var total = await consulta.CountAsync(cancellationToken);

            var filas = await Ordenar(consulta, dbContext, orden, direccion)
                .Skip((paginaPedida - 1) * tamanoPedido)
                .Take(tamanoPedido)
                .Select(fila => new
                {
                    fila.Id,
                    fila.UserId,
                    fila.TableName,
                    fila.RecordId,
                    fila.Action,
                    fila.CreatedAt,
                    fila.NewValuesJson,
                })
                .ToListAsync(cancellationToken);

            var autores = await ResolverAutoresAsync(dbContext, filas.Select(f => f.UserId), cancellationToken);
            var nombres = await ResolverNombresAsync(
                dbContext,
                filas.Select(f => (f.TableName, f.RecordId)),
                cancellationToken);

            var items = filas.Select(fila =>
            {
                autores.TryGetValue(fila.UserId ?? -1, out var autor);
                nombres.TryGetValue((fila.TableName, fila.RecordId), out var nombre);
                return Linea(fila.Id, fila.CreatedAt, fila.Action, fila.TableName, fila.RecordId, nombre, autor, fila.NewValuesJson);
            }).ToList();

            return Results.Ok(new AuditoriaRespuestaDto(total, paginaPedida, tamanoPedido, grupos, acciones, items, totalActuaciones, totalAccesos));
        });

        // UNA ACTUACION ENTERA. La lista dice quien hizo que y sobre que; esto dice ademas QUE CAMBIO,
        // que es lo que la fila guardo de antes y de despues y hasta no
        // se podia ver desde ninguna pantalla.
        admin.MapGet("/{id:long}", async (long id, SimusDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var fila = await dbContext.AuditLogs.AsNoTracking()
                .FirstOrDefaultAsync(actual => actual.Id == id, cancellationToken);
            if (fila is null) return Results.NotFound();

            var autores = await ResolverAutoresAsync(dbContext, [fila.UserId], cancellationToken);
            var nombres = await ResolverNombresAsync(dbContext, [(fila.TableName, fila.RecordId)], cancellationToken);
            autores.TryGetValue(fila.UserId ?? -1, out var autor);
            nombres.TryGetValue((fila.TableName, fila.RecordId), out var nombre);

            return Results.Ok(new AuditoriaDetalleDto(
                Linea(fila.Id, fila.CreatedAt, fila.Action, fila.TableName, fila.RecordId, nombre, autor, fila.NewValuesJson),
                ValoresDe(fila.PreviousValuesJson),
                ValoresDe(fila.NewValuesJson)));
        });

        return group;
    }

    /// <summary>
    /// El módulo de la consola que hay que tener para ver una decisión sobre esa tabla.
    /// </summary>
    /// <remarks>
    /// Es la misma correspondencia que usa la bandeja (<see cref="ModuloDeUnTramite"/>), pero por
    /// tabla de la bitácora. Una tabla que no esté aquí NO se muestra en «Resueltas»: a diferencia de
    /// la bandeja, donde lo desconocido queda a la vista para no esconder trabajo, aquí lo que no se
    /// sabe a qué módulo pertenece no se puede asegurar que la cuenta tenga permiso para verlo.
    /// </remarks>
    private static readonly Dictionary<string, string> ModuloDeConsolaPorTabla = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Festivales"] = "ecosistema",
        ["PropuestasCambioFestival"] = "ecosistema",
        ["EdicionesFestival"] = "ecosistema",
        ["ReclamacionesAdministracion"] = "ecosistema",
        ["Mercados"] = "mercados",
        ["EdicionesMercado"] = "mercados",
        ["Noticias"] = "noticias",
        ["EventosAgenda"] = "agenda",
        ["Agenda"] = "agenda",
        ["PublicacionesEditoriales"] = "catalogo-editorial",
        ["Entidades"] = "organizaciones",
    };

    /// <summary>Los verbos de la bitácora que son una decisión sobre un trámite.</summary>
    private static readonly string[] VerbosDeDecision =
        [AccionesAuditoria.Aprobar, AccionesAuditoria.Rechazar, AccionesAuditoria.Publicar, AccionesAuditoria.Archivar];

    /// <summary>
    /// Los eventos que se guardan como «actualizar» pero son «devolver para corregir»: el verbo
    /// técnico no distingue una devolución de una edición cualquiera, y el nombre del evento sí.
    /// </summary>
    private static readonly string[] EventosDeDevolucion =
        ["AjustesSolicitados", "CambiosPedidos", "ConAjustes", "Devuelto", "Devuelta"];

    /// <summary>Cuántos días atrás llega «Resueltas».</summary>
    private const int DiasDeResueltas = 30;

    /// <summary>Tope de filas de «Resueltas»: es una vista de consulta, no un informe.</summary>
    private const int TopeDeResueltas = 100;

    /// <summary>
    /// Lo que se decidió en los últimos 30 días, de los módulos que la cuenta tiene activados.
    /// </summary>
    /// <remarks>
    /// <b>LO RESUELTO TAMBIÉN SE LEE, PERO SOLO LO QUE LA CUENTA PUEDE VER.</b> Al decidir, el trámite
    /// desaparece de la bandeja y no quedaba vista alguna de lo hecho. La bitácora ya lo tiene,
    /// pero su pantalla exige el módulo «Auditoría», que un gestor no tiene: por eso esta ruta aparte,
    /// que filtra por los módulos de la cuenta con la misma regla que la bandeja.
    /// </remarks>
    public static RouteGroupBuilder MapResueltasDeLaBandejaEndpoints(this RouteGroupBuilder group)
    {
        var resueltas = group.MapGroup("/admin/resueltas").WithTags("admin-resueltas");
        resueltas.RequireAuthorization(SimusAuthentication.InstitutionalPolicy);

        resueltas.MapGet("/", async (
            System.Security.Claims.ClaimsPrincipal principal,
            SimusDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var tablasVisibles = new List<string>();
            foreach (var (tabla, modulo) in ModuloDeConsolaPorTabla)
            {
                if (await PermisosDeModulo.PuedeAsync(dbContext, principal, modulo, cancellationToken))
                    tablasVisibles.Add(tabla);
            }

            var desde = DateTime.UtcNow.AddDays(-DiasDeResueltas);
            var filasDeLaBase = await dbContext.AuditLogs.AsNoTracking()
                .Where(fila => fila.CreatedAt >= desde && tablasVisibles.Contains(fila.TableName))
                .Where(fila => VerbosDeDecision.Contains(fila.Action) || fila.Action == AccionesAuditoria.Actualizar)
                .OrderByDescending(fila => fila.CreatedAt).ThenByDescending(fila => fila.Id)
                .Select(fila => new { fila.Id, fila.UserId, fila.TableName, fila.RecordId, fila.Action, fila.CreatedAt, fila.NewValuesJson })
                .Take(TopeDeResueltas * 4)
                .ToListAsync(cancellationToken);

            // «actualizar» solo entra si su evento es una devolución; se decide en memoria porque el
            // evento vive dentro del JSON y el tope ya acotó cuántas filas se miran.
            var filas = filasDeLaBase
                .Where(fila => VerbosDeDecision.Contains(fila.Action)
                    || (fila.NewValuesJson is { } json && EventosDeDevolucion.Any(e => json.Contains(e, StringComparison.Ordinal))))
                .Take(TopeDeResueltas)
                .ToList();

            var autores = await ResolverAutoresAsync(dbContext, filas.Select(f => f.UserId), cancellationToken);
            var nombres = await ResolverNombresAsync(dbContext, filas.Select(f => (f.TableName, f.RecordId)), cancellationToken);

            var items = filas.Select(fila =>
            {
                autores.TryGetValue(fila.UserId ?? -1, out var autor);
                nombres.TryGetValue((fila.TableName, fila.RecordId), out var nombre);
                return Linea(fila.Id, fila.CreatedAt, fila.Action, fila.TableName, fila.RecordId, nombre, autor, fila.NewValuesJson);
            }).ToList();

            return Results.Ok(new ResueltasRespuestaDto(DiasDeResueltas, items));
        });

        return group;
    }

    /// <summary>La linea legible de una fila, igual en la lista y en el detalle.</summary>
    private static AuditoriaItemDto Linea(
        long id, DateTime fecha, string accion, string tabla, string registroId, string? nombre,
        AuditoriaAutorDto? autor, string? valoresNuevos = null)
    {
        var clasificacion = Clasificar(tabla);
        return new AuditoriaItemDto(
            id.ToString(CultureInfo.InvariantCulture),
            // LA HORA VIAJA COMO UTC, Y LO DICE. La bitacora se escribe con `DateTime.UtcNow`, pero
            // EF la devuelve sin `Kind` y el JSON salia sin la «Z»: el navegador la tomaba por hora
            // local y la consola ensenaba «19:07» para algo hecho a las 14:07 de Bogota. Medido en
            // el navegador al abrir el detalle de una actuacion.
            DateTime.SpecifyKind(fecha, DateTimeKind.Utc),
            accion,
            // QUE PASO, Y NO SOLO QUE VERBO SE USO. El historial de un mercado enseñaba cinco
            // «Actualizó» seguidos que solo se distinguían por la hora; el evento funcional estaba
            // guardado en el cuerpo de la fila y nadie lo leía. Si no se reconoce, se queda el verbo.
            EventosDeLaBitacora.Etiquetar(valoresNuevos) ?? VerbosDeBitacora.Etiquetar(accion),
            clasificacion.Grupo,
            clasificacion.Etiqueta,
            tabla,
            registroId,
            nombre,
            autor);
    }

    /// <summary>
    /// Lo que una fila guardo, campo a campo y como texto.
    /// </summary>
    /// <remarks>
    /// CADA ENDPOINT GUARDA LO QUE QUISO GUARDAR, asi que aqui no se supone ninguna forma: un objeto
    /// plano da un par por propiedad; una propiedad anidada llega como su JSON compacto; un valor que
    /// no es un objeto —o un JSON que no se puede leer— da el diccionario vacio, y la pantalla dice
    /// que esa actuacion no guardo valores.
    /// </remarks>
    private static Dictionary<string, string?> ValoresDe(string? json)
    {
        var valores = new Dictionary<string, string?>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(json)) return valores;
        try
        {
            using var documento = JsonDocument.Parse(json);
            if (documento.RootElement.ValueKind != JsonValueKind.Object) return valores;
            foreach (var propiedad in documento.RootElement.EnumerateObject())
            {
                valores[propiedad.Name] = propiedad.Value.ValueKind switch
                {
                    JsonValueKind.Null => null,
                    JsonValueKind.String => propiedad.Value.GetString(),
                    _ => propiedad.Value.GetRawText(),
                };
            }
        }
        catch (JsonException)
        {
            return new Dictionary<string, string?>(StringComparer.Ordinal);
        }
        return valores;
    }

    private static (string Grupo, string Etiqueta) Clasificar(string tabla) =>
        ClasificacionPorTabla.TryGetValue(tabla ?? string.Empty, out var valor)
            ? valor
            : (GrupoOtros, string.IsNullOrWhiteSpace(tabla) ? "Otros" : tabla);

    /// <summary>
    /// Quien hizo cada cosa, en una sola consulta.
    /// </summary>
    /// <remarks>
    /// El correo viaja porque dos personas pueden llamarse igual y quien revisa la bitacora
    /// necesita desempatar. Es una ruta que ya exige sesion institucional: no expone nada que esa
    /// sesion no pueda ver en la pantalla de Usuarios.
    /// </remarks>
    /// <summary>El orden de la bitacora, resuelto en la base y no sobre la pagina cargada.</summary>
    /// <remarks>
    /// <para>
    /// <b>ORDENA EL SERVIDOR PORQUE LA BITACORA PAGINA.</b> Hasta la
    /// tabla ordenaba las filas que traia la pagina, lo que reordena veinte filas de miles y
    /// afirma algo falso sobre el resto. La direccion de producto lo fijo para toda la consola: «debe
    /// ser de todos, no solo de los de la pagina visible».
    /// </para>
    /// <para>
    /// <b>SIN COLUMNA PEDIDA, DE LO ULTIMO HACIA ATRAS</b>, que es como se lee una bitacora y como
    /// respondia antes de existir este parametro.
    /// </para>
    /// <para>
    /// <b>«ACTUACION» ORDENA POR EL CODIGO</b> —actualizar, archivar, aprobar, crear, eliminar,
    /// publicar, rechazar—, que en castellano cae practicamente en el mismo orden que el verbo que
    /// se lee en la columna: Actualizo, Archivo, Aprobo, Creo, Elimino, Publico, Rechazo.
    /// </para>
    /// <para>
    /// <b>«REGISTRO» NO ORDENA Y LA TABLA NO LO OFRECE.</b> El nombre del registro tocado no esta
    /// en la bitacora: se resuelve despues, una consulta por cada tabla presente en la pagina. No
    /// hay forma de ordenarlo en la base sin unir todas las tablas del sistema, y ordenar solo la
    /// pagina es el defecto que se esta quitando. Una cabecera que ofrece ordenar y ordena otra
    /// cosa es peor que una cabecera que no lo ofrece.
    /// </para>
    /// </remarks>
    private static IQueryable<AuditLogRow> Ordenar(
        IQueryable<AuditLogRow> consulta, SimusDbContext dbContext, string? orden, string? direccion)
    {
        var ascendente = string.Equals((direccion ?? string.Empty).Trim(), "asc", StringComparison.OrdinalIgnoreCase);

        switch ((orden ?? string.Empty).Trim().ToLowerInvariant())
        {
            case "actuacion":
                return ascendente
                    ? consulta.OrderBy(fila => fila.Action).ThenByDescending(fila => fila.Id)
                    : consulta.OrderByDescending(fila => fila.Action).ThenByDescending(fila => fila.Id);

            case "responsable":
                return ascendente
                    ? consulta.OrderBy(ClaveDeResponsable(dbContext)).ThenByDescending(fila => fila.Id)
                    : consulta.OrderByDescending(ClaveDeResponsable(dbContext)).ThenByDescending(fila => fila.Id);

            case "fecha":
                return ascendente
                    ? consulta.OrderBy(fila => fila.CreatedAt).ThenBy(fila => fila.Id)
                    : consulta.OrderByDescending(fila => fila.CreatedAt).ThenByDescending(fila => fila.Id);

            default:
                // DE LO ULTIMO HACIA ATRAS, que es el orden con el que se abre la bitacora.
                return consulta.OrderByDescending(fila => fila.CreatedAt).ThenByDescending(fila => fila.Id);
        }
    }

    /// <summary>Quien firma la actuacion, con el mismo texto que ensena la columna.</summary>
    /// <remarks>
    /// DEVUELVE «Sistema» PARA LO QUE NO TIENE AUTOR, y no cadena vacia ni nulo: es exactamente lo
    /// que se lee en la celda, asi que ordenar por esta clave deja la columna en el orden en el que
    /// se ve. Una clave vacia agruparia esas filas al principio y la columna pareceria desordenada.
    /// </remarks>
    private static System.Linq.Expressions.Expression<Func<AuditLogRow, string>> ClaveDeResponsable(SimusDbContext dbContext) =>
        fila => dbContext.Users
            .Where(usuario => usuario.Id == fila.UserId)
            .Select(usuario => usuario.FullName)
            .FirstOrDefault() ?? "Sistema";

    private static async Task<Dictionary<int, AuditoriaAutorDto>> ResolverAutoresAsync(
        SimusDbContext dbContext,
        IEnumerable<int?> identificadores,
        CancellationToken cancellationToken)
    {
        var ids = identificadores.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];

        return await dbContext.Users.AsNoTracking()
            .Where(usuario => ids.Contains(usuario.Id))
            .Select(usuario => new AuditoriaAutorDto(
                usuario.Id.ToString(CultureInfo.InvariantCulture),
                usuario.FullName,
                usuario.Email))
            .ToDictionaryAsync(autor => int.Parse(autor.Id, CultureInfo.InvariantCulture), cancellationToken);
    }

    /// <summary>
    /// El nombre de cada registro tocado, una consulta por tabla presente en la pagina.
    /// </summary>
    /// <remarks>
    /// SOLO SE RESUELVEN LAS TABLAS QUE SE SABEN LEER. Una tabla sin entrada aqui deja el nombre en
    /// <c>null</c> y la pantalla cae al identificador, que es lo que se veia antes: peor, pero
    /// cierto. Inventar un nombre seria peor que no tenerlo.
    /// </remarks>
    private static async Task<Dictionary<(string Tabla, string Registro), string>> ResolverNombresAsync(
        SimusDbContext dbContext,
        IEnumerable<(string Tabla, string Registro)> referencias,
        CancellationToken cancellationToken)
    {
        var resultado = new Dictionary<(string, string), string>();
        var porTabla = referencias
            .Where(r => !string.IsNullOrWhiteSpace(r.Tabla) && !string.IsNullOrWhiteSpace(r.Registro))
            .GroupBy(r => r.Tabla, StringComparer.OrdinalIgnoreCase);

        foreach (var grupo in porTabla)
        {
            var ids = grupo
                .Select(r => int.TryParse(r.Registro, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : (int?)null)
                .Where(n => n.HasValue)
                .Select(n => n!.Value)
                .Distinct()
                .ToList();
            if (ids.Count == 0) continue;

            List<(int Id, string Nombre)> filas = grupo.Key.ToLowerInvariant() switch
            {
                "festivales" => await dbContext.FestivalRecords.AsNoTracking()
                    .Where(x => ids.Contains(x.Id)).Select(x => new ValueTuple<int, string>(x.Id, x.Name)).ToListAsync(cancellationToken),
                "entidades" => await dbContext.EntityProfiles.AsNoTracking()
                    .Where(x => ids.Contains(x.Id)).Select(x => new ValueTuple<int, string>(x.Id, x.Name)).ToListAsync(cancellationToken),
                // «ModulosPorCuenta» guarda como registro el id de la CUENTA cuyos apartados cambian: el
                // nombre que se lee es el de esa persona, y no «Registro 3».
                "usuarios" or "modulosporcuenta" => await dbContext.Users.AsNoTracking()
                    .Where(x => ids.Contains(x.Id)).Select(x => new ValueTuple<int, string>(x.Id, x.FullName)).ToListAsync(cancellationToken),
                // el nombre de lo que se tocó, y no «Registro 7».
                "mercados" => await dbContext.Mercados.AsNoTracking()
                    .Where(x => ids.Contains(x.Id)).Select(x => new ValueTuple<int, string>(x.Id, x.Nombre)).ToListAsync(cancellationToken),
                "categorias" => await dbContext.Categorias.AsNoTracking()
                    .Where(x => ids.Contains(x.Id)).Select(x => new ValueTuple<int, string>(x.Id, x.NombreCategoria)).ToListAsync(cancellationToken),
                "practicasmusicales" => await dbContext.PracticasMusicales.AsNoTracking()
                    .Where(x => ids.Contains(x.Id)).Select(x => new ValueTuple<int, string>(x.Id, x.Nombre)).ToListAsync(cancellationToken),
                "territoriossonoros" => await dbContext.TerritoriosSonoros.AsNoTracking()
                    .Where(x => ids.Contains(x.Id)).Select(x => new ValueTuple<int, string>(x.Id, x.Nombre)).ToListAsync(cancellationToken),
                "proyectostransversales" => await dbContext.ProyectosTransversales.AsNoTracking()
                    .Where(x => ids.Contains(x.Id)).Select(x => new ValueTuple<int, string>(x.Id, x.Nombre)).ToListAsync(cancellationToken),
                "valoresdetaxonomiadeperfiles" => await dbContext.ValoresDeTaxonomiaDePerfiles.AsNoTracking()
                    .Where(x => ids.Contains(x.Id)).Select(x => new ValueTuple<int, string>(x.Id, x.Nombre)).ToListAsync(cancellationToken),
                _ => [],
            };

            // LAS TRES TABLAS DE CLAVE `long` SE RESUELVEN APARTE del `switch` de arriba, que
            // trabaja con `int`. Meterlas allí obligaría a estrechar el identificador, que es justo
            // la conversión silenciosa que rompe cuando el acervo crece.
            //
            // NOTICIAS Y AGENDA NO ESTABAN, y se notaba: sus líneas de bitácora enseñaban el número
            // del registro donde debería ir el título, de modo que la auditoría decía «alguien
            // publicó el 7» en vez de decir qué se publicó.
            var idsLargos = grupo
                .Select(r => long.TryParse(r.Registro, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : (long?)null)
                .Where(n => n.HasValue)
                .Select(n => n!.Value)
                .Distinct()
                .ToList();

            if (idsLargos.Count > 0)
            {
                List<(long Id, string Nombre)> porClaveLarga = grupo.Key.ToLowerInvariant() switch
                {
                    "publicacioneseditoriales" => await dbContext.PublicacionesEditoriales.AsNoTracking()
                        .Where(x => idsLargos.Contains(x.Id)).Select(x => new ValueTuple<long, string>(x.Id, x.Titulo)).ToListAsync(cancellationToken),
                    "noticias" => await dbContext.Noticias.AsNoTracking()
                        .Where(x => idsLargos.Contains(x.Id)).Select(x => new ValueTuple<long, string>(x.Id, x.Titulo)).ToListAsync(cancellationToken),
                    "eventosagenda" => await dbContext.EventosAgenda.AsNoTracking()
                        .Where(x => idsLargos.Contains(x.Id)).Select(x => new ValueTuple<long, string>(x.Id, x.Titulo)).ToListAsync(cancellationToken),
                    _ => [],
                };

                foreach (var (id, nombre) in porClaveLarga)
                {
                    resultado[(grupo.Key, id.ToString(CultureInfo.InvariantCulture))] = nombre;
                }
            }

            foreach (var (id, nombre) in filas)
            {
                resultado[(grupo.Key, id.ToString(CultureInfo.InvariantCulture))] = nombre;
            }
        }

        return resultado;
    }
}
