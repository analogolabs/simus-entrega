using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using SIMUS.Api.Historial;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El banco de archivos: subir una imagen una vez y vincularla desde donde haga falta.
///
/// <para>
/// <b>POR QUE HACIA FALTA.</b> <c>dbo.Archivos</c> existe desde el principio —con su texto
/// alternativo, su pie y su crédito— y <b>ninguna ruta del API escribía en ella</b>. Los
/// Festivales solo vinculaban identificadores que nadie podía crear, y los paneles de alta de
/// Agenda, Noticias y Catálogo Editorial pedían la imagen como una RUTA QUE ALGUIEN TECLEABA.
/// Eso no es subir un archivo: es confiar en que el fichero ya esté puesto y bien escrito.
/// </para>
/// <para>
/// <b>EL ORDEN DE LAS COMPROBACIONES ES EL ORDEN EN QUE SE LE DICEN LOS PROBLEMAS A QUIEN SUBE</b>,
/// y está tomado del desarrollo de septiembre porque allí está bien pensado:
/// </para>
/// <list type="number">
///   <item>El <b>tope se mira antes de reconocer</b>. Leer primero y medir después es reservar la
///   memoria que se quería evitar.</item>
///   <item>El <b>texto alternativo se exige antes de mirar los bytes</b>. Que el archivo sea
///   válido no salva a una imagen sin alternativa textual.</item>
///   <item>El <b>formato se reconoce por la firma</b>, no por lo que el cliente declare. Es lo que
///   separa una imagen de un ejecutable con la cabecera pegada delante.</item>
///   <item>Si el cliente <b>declara un tipo y no coincide</b>, se rechaza: mentir sobre el tipo es
///   una señal, no un descuido que haya que corregirle en silencio.</item>
/// </list>
/// <para>
/// <b>LOS BYTES VAN A LA BASE</b>, como ya hace <c>MediosWeb</c>. No se inventa un segundo
/// almacenamiento, y el reconocedor es el mismo: <see cref="MediosWebContrato"/>.
/// </para>
/// </summary>
public static class BancoDeArchivosEndpoints
{
    private static readonly string[] AdjunteUnArchivo = ["Adjunte un archivo."];
    private static readonly string[] EscribaElTextoAlternativo =
        ["Escriba el texto alternativo: describe la imagen para quien no puede verla."];
    private static readonly string[] NoEsImagenValida =
        ["El archivo no es una imagen WebP, PNG o JPEG válida."];
    private static readonly string[] NoEsPdfValido =
        ["El archivo no es un PDF válido."];
    private static readonly string[] TipoDeclaradoNoCoincide =
        ["El tipo declarado no coincide con el contenido del archivo."];

    private const int LargoMaximoDelAlternativo = 300;
    private const int LargoMaximoDelPie = 500;
    private const int LargoMaximoDelCredito = 200;

    public static RouteGroupBuilder MapBancoDeArchivosEndpoints(this RouteGroupBuilder api)
    {
        // LA LECTURA ES ANONIMA Y LA ESCRITURA NO. Un archivo vinculado a un evento publicado
        // tiene que poder verlo cualquiera; subirlo, solo quien administra.
        var publico = api.MapGroup("/publico/archivos").WithTags("archivos-publico").AllowAnonymous();
        publico.MapGet("/{id:int}", Servir).WithName("ServirArchivo");

        var consola = api.MapGroup("/institucional/archivos")
            .WithTags("archivos")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            // «celebra» también entra: quien edita una edición de Celebra la Música adjunta logos, fondo y archivos
            // sin necesitar el módulo «Banco de archivos». Retirar y el informe de almacenamiento siguen siendo solo del Banco.
            .ExigeAlgunModulo("banco-de-archivos", "celebra");
        // `DisableAntiforgery` apaga la comprobación AUTOMÁTICA de los formularios de ASP.NET; el testigo
        // se exige a mano con el filtro, que va antes de leer el cuerpo del archivo.
        consola.MapPost(string.Empty, Subir).WithName("SubirArchivo").DisableAntiforgery().ConTopeDeImagen()
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir);
        // LOS DOCUMENTOS ENTRAN POR SU PROPIA PUERTA, y no relajando la de las imágenes.
        consola.MapPost("/documentos", SubirDocumento).WithName("SubirDocumento").DisableAntiforgery().ConTopeDeDocumento()
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir);
        consola.MapGet("/{id:int}", Describir).WithName("DescribirArchivo");
        // LA GESTION DEL BANCO, QUE NO EXISTIA. Se podía subir y servir, y nada más: ni ver qué
        // hay dentro, ni saber a qué está vinculado cada archivo, ni retirar uno subido por error.
        consola.MapGet(string.Empty, ListarInstitucional).WithName("ListarArchivos");
        // EL INFORME DE ALMACENAMIENTO (docs/operacion/28-tabla-de-retencion-documental.md §28.14 pieza 1): solo lectura, sin contenido.
        consola.MapGet("/almacenamiento", InformeDeAlmacenamiento.LeerAsync).WithName("InformeDeAlmacenamientoDelBanco")
            .ExigeModulo("banco-de-archivos");
        consola.MapDelete("/{id:int}", RetirarInstitucional).WithName("RetirarArchivo")
            .ExigeModulo("banco-de-archivos")
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir);

        // ── EL MISMO BANCO, PARA LAS ORGANIZACIONES ───────────────────────────────────────────
        //
        // POR QUE SE ABRE. La historia de usuario pide adjuntar el programa, el afiche y el logo de
        // cada Edición, y la foto de perfil de la organización; con el banco cerrado al canal
        // externo, lo único que podía aportar quien registra era una URL a un sitio ajeno. Abierto
        // a petición de la dirección de producto.
        //
        // ES EL MISMO MANEJADOR Y NO UNA COPIA. Toda la cadena de comprobaciones —el tope antes de
        // leer, el texto alternativo, el formato POR SU FIRMA y no por lo que el cliente declare, y
        // el rechazo si el tipo declarado miente— es exactamente la misma. Duplicarla para el canal
        // externo sería duplicar la superficie donde una de las dos copias se queda corta.
        //
        // LO QUE CAMBIA SON DOS GUARDAS QUE EL CANAL INSTITUCIONAL NO NECESITA, y están en
        // `GuardasDelCanalExterno`: el correo confirmado y la cuota por organización.
        var externo = api.MapGroup("/externo/archivos")
            .WithTags("archivos")
            .RequireAuthorization(SimusAuthentication.ExternalPolicy);
        externo.MapPost(string.Empty, SubirDesdeOrganizacion).WithName("SubirArchivoExterno").DisableAntiforgery().ConTopeDeImagen()
            .AddEndpointFilter(ExigeTestigoDeLaConsola.ExigirDelCanalExterno);
        // LOS SOPORTES DE UNA SOLICITUD SON PDF: el acta, el certificado de la cámara
        // de comercio. Es la misma puerta de documentos de la consola, con las guardas del canal.
        externo.MapPost("/documentos", SubirDocumentoDesdeOrganizacion).WithName("SubirDocumentoExterno").DisableAntiforgery().ConTopeDeDocumento()
            .AddEndpointFilter(ExigeTestigoDeLaConsola.ExigirDelCanalExterno);
        externo.MapGet("/{id:int}", DescribirDeLaOrganizacion).WithName("DescribirArchivoExterno");
        externo.MapGet(string.Empty, ListarDeLaOrganizacion).WithName("ListarArchivosExternos");
        externo.MapDelete("/{id:int}", RetirarDeLaOrganizacion).WithName("RetirarArchivoExterno")
            .AddEndpointFilter(ExigeTestigoDeLaConsola.ExigirDelCanalExterno);
        return api;
    }

    /// <summary>
    /// Sirve el archivo con su ETag.
    /// </summary>
    /// <remarks>
    /// LA HUELLA ES EL ETAG, y por eso se guarda. Un navegador que ya tiene la imagen recibe un
    /// 304 y no vuelve a bajar los bytes; sin ETag, cada carga del portal se trae el acervo entero.
    /// </remarks>
    private static async Task<IResult> Servir(
        SimusDbContext db, HttpContext contexto, ClaimsPrincipal principal, int id, CancellationToken ct)
    {
        // LOS BYTES NO SE LEEN HASTA SABER QUE HACEN FALTA (optimización, 20 nov 2026). Antes esta consulta traía el
        // BLOB entero (hasta 2 MiB una imagen, 80 MiB un PDF) y SOLO DESPUÉS comprobaba permisos y ETag: cada
        // revalidación de una imagen que el navegador ya tenía —la inmensa mayoría de las peticiones— costaba una
        // lectura completa de la base para terminar en un 304 sin cuerpo. Ahora la primera consulta es de
        // metadatos (la longitud la calcula SQL Server sin entregar el contenido), el permiso se decide igual que
        // antes y los bytes solo se leen si el navegador no los tiene.
        var fila = await db.Files.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new { Longitud = x.Content == null ? 0 : x.Content.Length, x.MimeType, x.Fingerprint, x.OrganizacionId, x.UploadedByUserId })
            .FirstOrDefaultAsync(ct);

        if (fila is null || fila.Longitud == 0) return Results.NotFound();

        // ── UN ARCHIVO SE SIRVE A QUIEN PUEDE VERLO, Y NO A CUALQUIERA QUE ACIERTE EL NUMERO ──
        //
        // QUE PASABA, MEDIDO EL 13 DE SEPTIEMBRE DE 2026. La ruta era anónima para TODO el banco y
        // los identificadores son enteros consecutivos: `GET /api/v1/publico/archivos/1..N` bajaba
        // el acervo entero. Entre lo que devolvía estaba el archivo 1005, «Afiche de la edición
        // 2027», subido por una organización a una edición que nunca se publicó —y que de hecho
        // había quedado huérfana, porque el formulario se abandonó sin guardar—. El material de un
        // proceso que su dueño todavía no ha enseñado no es público, y menos aún el de uno que no
        // llegó a existir.
        //
        // LA REGLA ES LA VINCULACION, NO UNA BANDERA. Un archivo es público si está usado en algo
        // que el público ya ve. No se guarda un `EsPublico` que habría que mantener a mano y que
        // se quedaría desincronizado la primera vez que alguien retire una noticia.
        //
        // QUIEN TIENE SESION NO PASA POR AHI: el equipo del PNMC ve el banco entero, y una
        // organización ve lo suyo. Es lo mismo que ya hace el resto del sistema con un borrador.
        // LA SESION EXTERNA HAY QUE PEDIRLA A PROPOSITO, Y ESO COSTO UN 404 EN PRUEBAS.
        //
        // Esta ruta es anónima, así que el canalizador solo resuelve el esquema POR OMISION —el de
        // la consola— y el `principal` que llega no trae la sesión de una organización aunque su
        // cookie venga en la petición. Comprobado: con sesión institucional el archivo 1005 se servía;
        // con la sesión de la organización DUEÑA del mismo archivo, 404. Es decir: quien lo subió
        // era justo el único que no podía volver a verlo.
        //
        // NO SE CAMBIA EL ESQUEMA POR OMISION —eso alcanzaría a todo el API—: se pregunta por el
        // externo solo aquí, y solo cuando el que ya vino no sirve.
        var quienPide = principal;
        if (Actor(quienPide) <= 0)
        {
            var externa = await contexto.AuthenticateAsync(SimusAuthentication.ExternalScheme);
            if (externa.Succeeded && externa.Principal is not null) { quienPide = externa.Principal; }
        }

        // LA FOTO PERSONAL LA VE SIEMPRE QUIEN LA SUBIO, aunque su perfil no se vea todavia.
        var esSuyaPersonal = fila.OrganizacionId is null && fila.UploadedByUserId > 0 && fila.UploadedByUserId == Actor(quienPide);
        // LO YA COMPROBADO PÚBLICO NO SE VUELVE A COMPROBAR (ver `CacheDeArchivosPublicos`): una imagen pública del portal
        // se decidía con hasta 12 consultas en cada petición, también en cada revalidación que acaba en 304.
        var recordados = contexto.RequestServices.GetService<CacheDeArchivosPublicos>();
        var epocaAlComprobar = recordados?.Epoca ?? 0;
        if (!esSuyaPersonal && recordados?.EsPublico(id) != true)
        {
            if (!await PuedeVerloAsync(db, quienPide, id, fila.OrganizacionId, ct))
            {
                // 404 Y NO 403: un 403 confirma que el archivo existe, que es justo lo que no hay que
                // confirmarle a quien está recorriendo identificadores.
                return Results.NotFound();
            }
            if (Actor(quienPide) <= 0) recordados?.AnotarPublico(id, epocaAlComprobar);
        }

        var etiqueta = string.IsNullOrWhiteSpace(fila.Fingerprint)
            ? null
            : new EntityTagHeaderValue($"\"{fila.Fingerprint}\"");

        // POLITICA DE CACHE SEGUN QUIEN PIDE. Lo que se sirve a una petición ANÓNIMA ya pasó la regla de
        // «está usado en algo que el público ve», así que una caché compartida puede guardarlo unos minutos; lo
        // que se sirve a una sesión (el borrador de una organización, el banco entero del equipo) no debe quedar
        // en una caché compartida. En ambos casos el navegador revalida con el ETag, que ahora cuesta una consulta
        // de metadatos y no la lectura del contenido. Cinco minutos y no un día: retirar un archivo del público
        // tiene que notarse pronto.
        var anonima = Actor(quienPide) <= 0;
        contexto.Response.Headers.CacheControl = anonima ? "public, max-age=300, stale-while-revalidate=60" : "private, no-cache";

        if (etiqueta is not null && CoincideConElEtag(contexto.Request.Headers.IfNoneMatch, etiqueta))
        {
            contexto.Response.Headers.ETag = etiqueta.ToString();
            return Results.StatusCode(StatusCodes.Status304NotModified);
        }

        var contenido = await db.Files.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => x.Content)
            .FirstOrDefaultAsync(ct);
        if (contenido is null || contenido.Length == 0) return Results.NotFound();

        return Results.File(contenido, fila.MimeType, entityTag: etiqueta);
    }

    /// <summary>
    /// Si el navegador ya tiene esta versión: `If-None-Match` con el ETag actual o `*`, comparación débil
    /// (RFC 9110 §13.1.2), que es la que aplica a GET.
    /// </summary>
    private static bool CoincideConElEtag(Microsoft.Extensions.Primitives.StringValues recibidos, EntityTagHeaderValue actual)
    {
        if (recibidos.Count == 0) return false;
        foreach (var cabecera in recibidos)
        {
            if (string.IsNullOrWhiteSpace(cabecera)) continue;
            if (cabecera.Trim() == "*") return true;
            foreach (var parte in cabecera.Split(','))
            {
                if (EntityTagHeaderValue.TryParse(parte.Trim(), out var candidata) && candidata.Compare(actual, useStrongComparison: false)) return true;
            }
        }
        return false;
    }

    /// <summary>
    /// Dónde está usado un archivo, mirando las tablas que lo pueden vincular (siete con la foto del taller).
    /// </summary>
    /// <remarks>
    /// <para>
    /// ES LA PREGUNTA QUE SOSTIENE TODO LO DEMAS: si se puede servir a cualquiera, si se puede
    /// retirar, y qué se rompería al hacerlo. Sin ella, el banco es una caja donde entran cosas y
    /// no se sabe qué hay dentro.
    /// </para>
    /// <para>
    /// SEIS TABLAS, Y SE ENUMERAN A PROPOSITO. Son las seis que tienen una foránea a
    /// <c>dbo.Archivos</c>, comprobado contra el catálogo de la base y no de memoria. Si algún día
    /// aparece una séptima, esta consulta se queda corta en silencio: por eso existe
    /// <c>Las_tablas_que_vinculan_un_archivo_son_las_que_esta_consulta_mira</c>, que compara esta
    /// lista con las foráneas reales y se pone en rojo cuando dejan de coincidir.
    /// </para>
    /// </remarks>
    private static async Task<List<VinculoDeArchivo>> VinculosAsync(SimusDbContext db, int archivoId, CancellationToken ct, bool detenerAlEncontrarPublico = false)
    {
        var vinculos = new List<VinculoDeArchivo>();
        // CON `detenerAlEncontrarPublico` se deja de preguntar en cuanto un uso hace público el archivo. Es lo que
        // necesita `Servir` (si es público, no importa qué más lo use): una imagen de una noticia publicada se decidía
        // con 13 consultas y ahora con las que hagan falta hasta dar con ella. El listado y el uso completo siguen
        // pidiendo todos los usos.
        bool Basta() => detenerAlEncontrarPublico && vinculos.Any(v => v.EsPublico);

        if (await db.EntityProfiles.AsNoTracking().AnyAsync(x => x.ArchivoFotoId == archivoId, ct))
        {
            // LA FOTO DE PERFIL ES PUBLICA POR DECISION de la dirección de producto // de 2026: acompaña a la organización en el portal.
            vinculos.Add(new VinculoDeArchivo("organizacion", "Foto de perfil de una organización", true));
        }

        // LA FOTO DE UN PERFIL DE PERSONA ES PUBLICA SOLO MIENTRAS EL PERFIL SE VE. Si la
        // persona retira la autorización o la consola lo oculta, la foto deja de servirse al público.
        if (Basta()) return vinculos;
        if (await db.PerfilesPublicos.AsNoTracking().AnyAsync(x => x.ArchivoFotoId == archivoId, ct))
        {
            // LA FOTO DE UN PERFIL «SOLO SIMUS» NO ES PÚBLICA: solo la sirve quien tiene sesión (cualquier cuenta de
            // SIMUS, de consola o externa). Se marca aparte para que `Servir` pida la sesión y el resto
            // del banco (uso, retiro, listado) la siga contando como no pública.
            var publica = await PerfilPublicoEndpoints.Visibles(db).AnyAsync(x => x.ArchivoFotoId == archivoId, ct);
            var soloSimus = !publica
                && await PerfilPublicoEndpoints.VisiblesParaSimus(db).AnyAsync(x => x.ArchivoFotoId == archivoId, ct);
            vinculos.Add(new VinculoDeArchivo("perfil", "Foto de un perfil público de persona", publica, soloSimus));
        }

        // LA FOTO DE QUIEN PARTICIPA EN UNA AGENDA DE CITAS (AGE2): no es pública; la sirve el Banco solo con sesión.
        if (Basta()) return vinculos;
        if (await db.ParticipantesDeCitas.AsNoTracking().AnyAsync(x => x.FotoArchivoId == archivoId, ct))
        {
            vinculos.Add(new VinculoDeArchivo("agenda-de-citas", "Foto de un participante de una agenda de citas", false, SoloConSesion: true));
        }

        // LA FOTO DE UN TALLER DE LUTERIA ES PUBLICA SOLO MIENTRAS EL TALLER ESTA PUBLICADO (LUT-02,
        // decisión 115). Antes de eso la ven quienes responden por él y la consola, por las reglas de
        // dueño de arriba; un taller retirado o archivado deja de servirla al público.
        if (Basta()) return vinculos;
        var talleres = await db.Talleres.AsNoTracking()
            .Where(x => x.ArchivoFotoId == archivoId)
            .Select(x => new { x.Activo, x.EstadoRegistro })
            .ToListAsync(ct);
        foreach (var taller in talleres)
        {
            vinculos.Add(new VinculoDeArchivo("taller", "Foto de un taller de lutería", taller.Activo && taller.EstadoRegistro == "publicado"));
        }

        if (Basta()) return vinculos;
        var espacios = await db.Espacios.AsNoTracking().Where(x => x.ArchivoFotoId == archivoId)
            .Select(x => new { x.Activo, x.EstadoRegistro }).ToListAsync(ct);
        foreach (var espacio in espacios)
        {
            vinculos.Add(new VinculoDeArchivo("espacio", "Foto de un espacio para música en vivo", espacio.Activo && espacio.EstadoRegistro == "publicado"));
        }

        if (Basta()) return vinculos;
        var redes = await db.Redes.AsNoTracking().Where(x => x.ArchivoFotoId == archivoId)
            .Select(x => new { x.Activo, x.EstadoRegistro }).ToListAsync(ct);
        foreach (var red in redes)
        {
            vinculos.Add(new VinculoDeArchivo("red", "Foto de una red o centro de documentación", red.Activo && red.EstadoRegistro == "publicado"));
        }

        if (Basta()) return vinculos;
        var materiales = await db.ArchivosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == Modulos.EdicionesDeFestival && x.ArchivoId == archivoId)
            .Join(db.EdicionesFestival.AsNoTracking(),
                m => m.RegistroId, e => e.Id.ToString(), (m, e) => e.EstadoVisibilidad)
            .ToListAsync(ct);
        foreach (var visibilidad in materiales)
        {
            vinculos.Add(new VinculoDeArchivo("edicion", "Material de una edición de Festival", visibilidad == "publicada"));
        }

        // LAS IMÁGENES DE UNA EDICIÓN DE MERCADO (portada, logotipo, afiche, galería) son públicas SOLO si la edición
        // está publicada Y el mercado que la contiene también lo está (activo y publicado), la misma condición con la que
        // el portal lista las ediciones. Los mercados no tienen módulo propio de archivos: todo cuelga de la edición.
        if (Basta()) return vinculos;
        var deMercados = await db.ArchivosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == Modulos.EdicionesDeMercado && x.ArchivoId == archivoId)
            .Join(db.EdicionesMercado.AsNoTracking(),
                m => m.RegistroId, e => e.Id.ToString(), (m, e) => new { e.MercadoId, e.EstadoVisibilidad })
            .Join(db.Mercados.AsNoTracking(),
                e => e.MercadoId, k => k.Id, (e, k) => new { e.EstadoVisibilidad, k.Activo, k.EstadoRegistro })
            .ToListAsync(ct);
        foreach (var u in deMercados)
        {
            vinculos.Add(new VinculoDeArchivo("edicion-mercado", "Imagen de una edición de Mercado",
                u.EstadoVisibilidad == "publicado" && u.Activo && u.EstadoRegistro == "publicado"));
        }

        // LOS ARCHIVOS DE UN FESTIVAL cuelgan de su cabecera. Desde el retiro de `PerfilesPublicosFestival` (PR-8) la migración
        // reapunta aquí los que estaban ligados a un perfil: sin esta cuenta el Banco los marcaría «sin uso» y la purga los borraría.
        if (Basta()) return vinculos;
        var deFestivales = await db.ArchivosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == Modulos.Festivales && x.ArchivoId == archivoId)
            .Join(db.FestivalRecords.AsNoTracking(), m => m.RegistroId, f => f.Id.ToString(), (m, f) => f.StatusCode)
            .ToListAsync(ct);
        foreach (var estadoDelFestival in deFestivales)
        {
            vinculos.Add(new VinculoDeArchivo("festival", "Material de un Festival", string.Equals(estadoDelFestival, "publicado", StringComparison.OrdinalIgnoreCase)));
        }

        // UN SOPORTE DE UNA SOLICITUD NO ES PÚBLICO: lo ven la organización que lo
        // adjuntó y la consola. Contarlo como uso impide retirarlo mientras la solicitud lo cite.
        if (Basta()) return vinculos;
        var soportes = await db.ArchivosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == Modulos.ReclamacionesDeAdministracion && x.ArchivoId == archivoId).CountAsync(ct);
        for (var i = 0; i < soportes; i++)
        {
            vinculos.Add(new VinculoDeArchivo("reclamacion", "Soporte de una solicitud de administración", false));
        }

        if (Basta()) return vinculos;
        var noticias = await db.NoticiasArchivos.AsNoTracking()
            .Where(x => x.ArchivoId == archivoId)
            .Join(db.Noticias.AsNoTracking(), n => n.NoticiaId, x => x.Id, (n, x) => x.Estado)
            .ToListAsync(ct);
        foreach (var estado in noticias)
        {
            vinculos.Add(new VinculoDeArchivo("noticia", "Imagen de una noticia", estado == "publicado"));
        }

        if (Basta()) return vinculos;
        var eventos = await db.EventosAgendaArchivos.AsNoTracking()
            .Where(x => x.ArchivoId == archivoId)
            .Join(db.EventosAgenda.AsNoTracking(), a => a.EventoAgendaId, e => e.Id, (a, e) => e.Estado)
            .ToListAsync(ct);
        foreach (var estado in eventos)
        {
            vinculos.Add(new VinculoDeArchivo("agenda", "Imagen de un evento de la agenda", estado == "publicado"));
        }

        if (Basta()) return vinculos;
        // LA PORTADA, LA GALERÍA Y LA CAJA DE HERRAMIENTAS DE UNA EDICIÓN DE «CELEBRA LA MÚSICA» SON PÚBLICAS SOLO MIENTRAS LA
        // EDICIÓN ESTÁ PUBLICADA. Sin este vínculo el Banco las serviría solo con sesión: el micrositio mostraría imágenes rotas
        // a quien no la tiene, y la purga las daría por «sin uso».
        var deEdiciones = await db.CelebraEdiciones.AsNoTracking()
            .Where(e => e.ImagenPortadaArchivoId == archivoId).Select(e => e.Publicada).ToListAsync(ct);
        deEdiciones.AddRange(await db.CelebraGaleria.AsNoTracking()
            .Where(g => g.ArchivoId == archivoId)
            .Join(db.CelebraEdiciones.AsNoTracking(), g => g.CelebraEdicionId, e => e.Id, (g, e) => e.Publicada).ToListAsync(ct));
        deEdiciones.AddRange(await db.CelebraRecursos.AsNoTracking()
            .Where(r => r.ArchivoId == archivoId)
            .Join(db.CelebraEdiciones.AsNoTracking(), r => r.CelebraEdicionId, e => e.Id, (r, e) => e.Publicada).ToListAsync(ct));
        foreach (var publicada in deEdiciones)
        {
            vinculos.Add(new VinculoDeArchivo("celebra-la-musica", "Imagen o documento de una edición de Celebra la música", publicada));
        }

        if (Basta()) return vinculos;
        // LAS FOTOS Y PORTADAS DE UN ÁLBUM DE LA GALERÍA SON PÚBLICAS SOLO MIENTRAS EL ÁLBUM ESTÁ PUBLICADO.
        var deGaleria = await db.GaleriaAlbumes.AsNoTracking()
            .Where(a => a.PortadaArchivoId == archivoId).Select(a => a.Publicado).ToListAsync(ct);
        // La foto de un ítem y la miniatura propia de un video: públicas con el álbum publicado o, si el ítem es suelto, con su propia marca.
        deGaleria.AddRange(await (from i in db.GaleriaItems.AsNoTracking()
                                  where i.ArchivoId == archivoId || i.MiniaturaArchivoId == archivoId
                                  join a in db.GaleriaAlbumes.AsNoTracking() on i.GaleriaAlbumId equals a.Id into ja
                                  from a in ja.DefaultIfEmpty()
                                  select a == null ? i.Publicado : a.Publicado).ToListAsync(ct));
        foreach (var publicado in deGaleria)
        {
            vinculos.Add(new VinculoDeArchivo("galeria", "Foto, miniatura de video o portada de la Galería", publicado));
        }

        if (Basta()) return vinculos;
        // LA IMAGEN DE UNA FICHA DE «CATÁLOGOS» (territorio sonoro o práctica musical) es pública mientras el elemento esté activo.
        var deCatalogos = await (from f in db.FichasConceptualesTerritoriosSonoros.AsNoTracking()
                                 where f.ImagenArchivoId == archivoId
                                 join t in db.TerritoriosSonoros.AsNoTracking() on f.TerritorioSonoroId equals t.Id
                                 select new { t.Activo, Que = "Imagen de la ficha de un territorio sonoro" }).ToListAsync(ct);
        deCatalogos.AddRange(await (from f in db.FichasConceptualesPracticasMusicales.AsNoTracking()
                                    where f.ImagenArchivoId == archivoId
                                    join p in db.PracticasMusicales.AsNoTracking() on f.PracticaMusicalId equals p.Id
                                    select new { p.Activo, Que = "Imagen de la ficha de una práctica musical" }).ToListAsync(ct));
        foreach (var c in deCatalogos) vinculos.Add(new VinculoDeArchivo("catalogo", c.Que, c.Activo));

        var accesos = await db.AccesosEditoriales.AsNoTracking()
            .Where(x => x.ArchivoId == archivoId)
            .Select(x => x.DerechosPermitePublicarArchivo)
            .ToListAsync(ct);
        foreach (var permite in accesos)
        {
            // EL ARCHIVO DE UNA PUBLICACION NECESITA SU PROPIO PERMISO: enseñar la ficha y repartir
            // el fichero son dos autorizaciones distintas, y el Catálogo las separa.
            vinculos.Add(new VinculoDeArchivo("editorial", "Archivo de una publicación del Catálogo", permite));
        }

        return vinculos;
    }

    /// <summary>
    /// Si quien pide el archivo puede verlo: porque está publicado, porque es suyo, o porque
    /// administra.
    /// </summary>
    private static async Task<bool> PuedeVerloAsync(
        SimusDbContext db, ClaimsPrincipal principal, int archivoId, int? organizacionDelArchivo, CancellationToken ct)
    {
        // 1. EL EQUIPO DEL PNMC VE EL BANCO ENTERO: es quien responde por él.
        if (Permisos.EsFuncionario(principal)) return true;

        // 2. LA ORGANIZACION VE LO SUYO, esté publicado o no. Es su material.
        if (organizacionDelArchivo is int duena)
        {
            var personaId = Actor(principal);
            if (personaId > 0 && await db.UserEntities.AsNoTracking().AnyAsync(
                    v => v.UserId == personaId && v.EntityId == duena && v.IsActive
                      && RolesDeEntidad.Miembros.Contains(v.EntityRole), ct))
            {
                return true;
            }
        }

        // 3. Y CUALQUIERA, SI ESTA USADO EN ALGO QUE YA SE VE.
        var vinculos = await VinculosAsync(db, archivoId, ct, detenerAlEncontrarPublico: true);
        if (vinculos.Any(v => v.EsPublico)) return true;

        // 4. Y CUALQUIER CUENTA DE SIMUS, SI EL ARCHIVO ES LA FOTO DE UN PERFIL «SOLO SIMUS». Sin sesión,
        // el mismo 404 que un archivo inexistente.
        return Actor(principal) > 0 && vinculos.Any(v => v.SoloConSesion);
    }

    /// <summary>Un uso concreto de un archivo, y si ese uso lo hace visible al público.</summary>
    private sealed record VinculoDeArchivo(string Modulo, string Descripcion, bool EsPublico, bool SoloConSesion = false);

    /// <summary>Los datos del archivo sin sus bytes, para que un panel pueda describir lo vinculado.</summary>
    private static async Task<IResult> Describir(SimusDbContext db, int id, CancellationToken ct)
    {
        var fila = await db.Files.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                id = x.Id,
                nombre = x.OriginalName,
                tipo = x.MimeType,
                bytes = x.FileSizeBytes,
                alt = x.AltText,
                pie = x.Caption,
                credito = x.Credit,
                ancho = x.Width,
                alto = x.Height,
                url = "/api/v1/publico/archivos/" + x.Id.ToString(CultureInfo.InvariantCulture),
            })
            .FirstOrDefaultAsync(ct);

        return fila is null ? Results.NotFound() : Results.Ok(fila);
    }

    /// <summary>
    /// Lo que hay en el banco, con su procedencia y con dónde está usado cada archivo.
    /// </summary>
    /// <remarks>
    /// <b>SIN ESTO NO HABIA GESTION, SOLO SUBIDA.</b> El banco admitía archivos y los servía, y no
    /// existía ninguna forma de ver qué contenía: para saber de un archivo había que conocer ya su
    /// identificador. Un almacén en el que no se puede mirar acumula lo que nadie recuerda.
    /// </remarks>
    private static async Task<IResult> ListarInstitucional(
        SimusDbContext db, string? procedencia, bool? soloHuerfanos, int? pagina, int? tamano, CancellationToken ct) =>
        await ListarAsync(db, null, procedencia, soloHuerfanos, pagina, tamano, ct);

    /// <summary>Los archivos de la organización de quien pregunta, y cuánto le queda de cuota.</summary>
    private static async Task<IResult> ListarDeLaOrganizacion(
        SimusDbContext db, ClaimsPrincipal principal, bool? soloHuerfanos, int? pagina, int? tamano, CancellationToken ct)
    {
        var organizacionId = await OrganizacionDeAsync(db, principal, ct);
        if (organizacionId is null) return Results.Forbid();
        return await ListarAsync(db, organizacionId, null, soloHuerfanos, pagina, tamano, ct);
    }

    private static async Task<IResult> ListarAsync(
        SimusDbContext db, int? organizacionId, string? procedencia, bool? soloHuerfanos,
        int? pagina, int? tamano, CancellationToken ct)
    {
        var numero = Math.Max(1, pagina ?? 1);
        var porPagina = Math.Clamp(tamano ?? 24, 1, 100);

        // UNA FILA SIN BYTES NO ES UN ARCHIVO, Y EL BANCO NO LA OFRECE.
        //
        // QUE PASABA, MEDIDO EL 14 DE SEPTIEMBRE DE 2026 recorriendo la consola: el Banco de
        // archivos listaba el archivo 5 y su previsualizacion contestaba 404. La fila existe en
        // `dbo.Archivos` con `Contenido` nulo: la creo la semilla
        // `V20260519_03__administracion_control_seed.sql` como «Archivo temporal de prueba» para
        // validar metadatos, y nunca tuvo contenido que servir.
        //
        // SE EXCLUYE EN EL LISTADO Y NO SE BORRA LA FILA. Borrar datos es una accion que en este
        // proyecto no se toma de paso, y no hace falta: `Servir` ya devuelve 404 cuando no hay
        // bytes, asi que lo unico roto era ofrecer en la lista algo que no se puede abrir. Con esta
        // guarda, cualquier fila corrupta que aparezca en el futuro —una subida que falle despues
        // de escribir la fila— deja de ensuciar el banco por si sola.
        //
        // SE MIRA `PesoBytes` Y NO EL PROPIO BLOB. `Content.Length > 0` no se puede traducir —EF lo
        // baja a `Enumerable.Any()` y la consulta revienta con un 500, comprobado— y
        // `EF.Functions.DataLength` solo existe en SQL Server, mientras que buena parte de las
        // pruebas corren sobre SQLite. `PesoBytes` lo escribe cada subida con `datos.Length`, asi
        // que es el mismo hecho expresado en una columna que cualquier proveedor sabe comparar.
        // Un peso nulo no descarta la fila: lo que se excluye es un cero declarado.
        var consulta = db.Files.AsNoTracking()
            .Where(x => x.Content != null && (x.FileSizeBytes == null || x.FileSizeBytes > 0));
        // SIN ORGANIZACION NO SIGNIFICA «DEL PROGRAMA». Desde una cuenta externa sube
        // la foto de su perfil público sin organización; lo que la distingue es el canal de quien
        // la subió. Las tres procedencias se reparten el banco sin solaparse.
        var cuentasExternas = db.Users.AsNoTracking().Where(u => u.AccessChannel == CanalExterno).Select(u => u.Id);
        if (organizacionId is int propia) { consulta = consulta.Where(x => x.OrganizacionId == propia); }
        else if (procedencia == "institucional") { consulta = consulta.Where(x => x.OrganizacionId == null && !cuentasExternas.Contains(x.UploadedByUserId)); }
        else if (procedencia == "personas") { consulta = consulta.Where(x => x.OrganizacionId == null && cuentasExternas.Contains(x.UploadedByUserId)); }
        else if (procedencia == "organizaciones") { consulta = consulta.Where(x => x.OrganizacionId != null); }

        // LO QUE NADIE USA, CONTADO ANTES DE FILTRAR. Es la cifra del aviso del banco: cuánto
        // hay sin usar en el alcance que se mira (una organización, o una procedencia) y cuánto pesa.
        // No se borra nada por sí solo: el aviso lleva a la lista y retirar sigue siendo un acto de una persona.
        var sinUsar = SoloSinUso(db, consulta);
        var sinUsarTotal = await sinUsar.CountAsync(ct);
        var sinUsarBytes = sinUsarTotal == 0
            ? 0L
            : await sinUsar.SumAsync(x => (long?)x.FileSizeBytes ?? 0L, ct);

        // «SIN USAR» SE RESUELVE EN EL SERVIDOR, ANTES DE PAGINAR. Antes se descartaba cada
        // archivo de la página ya cortada, así que una página podía salir casi vacía y el total mentía:
        // con 24 por página y los sin usar repartidos en el banco, el filtro mostraba «Todo lo que hay
        // está vinculado» mirando solo los primeros 24. La regla es la misma que `VinculosAsync`.
        if (soloHuerfanos == true) { consulta = sinUsar; }

        var total = await consulta.CountAsync(ct);
        var filas = await consulta
            .OrderByDescending(x => x.Id)
            .Skip((numero - 1) * porPagina).Take(porPagina)
            .Select(x => new
            {
                x.Id, x.OriginalName, x.MimeType, x.FileSizeBytes, x.AltText,
                x.Width, x.Height, x.CreatedAt, x.OrganizacionId, x.UploadedByUserId,
            })
            .ToListAsync(ct);

        // LOS NOMBRES, NO LOS NUMEROS. Una lista que dice «organización 2162» obliga a ir a
        // buscar cuál es, que es justo lo que una lista existe para evitar.
        var organizaciones = filas.Select(x => x.OrganizacionId).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var nombresDeOrganizacion = await db.EntityProfiles.AsNoTracking()
            .Where(e => organizaciones.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => e.Name, ct);
        var personas = filas.Select(x => x.UploadedByUserId).Where(x => x > 0).Distinct().ToList();
        var cuentas = await db.Users.AsNoTracking()
            .Where(u => personas.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName, u.AccessChannel })
            .ToListAsync(ct);
        var nombresDePersona = cuentas.ToDictionary(u => u.Id, u => u.FullName);
        var subidosPorCuentaExterna = cuentas.Where(u => u.AccessChannel == CanalExterno).Select(u => u.Id).ToHashSet();

        var items = new List<object>(filas.Count);
        foreach (var fila in filas)
        {
            var vinculos = await VinculosAsync(db, fila.Id, ct);
            items.Add(new
            {
                id = fila.Id,
                nombre = fila.OriginalName,
                tipo = fila.MimeType,
                bytes = fila.FileSizeBytes,
                alt = fila.AltText,
                ancho = fila.Width,
                alto = fila.Height,
                fechaCarga = fila.CreatedAt,
                // LA PROCEDENCIA, SEPARADA DE QUIEN LO SUBIO: son dos cosas distintas y el proyecto
                // no las confunde en ningún módulo.
                // «persona»: sin organización y subido por una cuenta externa, que hoy solo puede
                // ser la foto de un perfil público.
                procedencia = fila.OrganizacionId is not null ? "organizacion"
                    : subidosPorCuentaExterna.Contains(fila.UploadedByUserId) ? "persona"
                    : "institucional",
                organizacionId = fila.OrganizacionId,
                organizacionNombre = fila.OrganizacionId is int o && nombresDeOrganizacion.TryGetValue(o, out var nombre) ? nombre : null,
                subidoPor = nombresDePersona.TryGetValue(fila.UploadedByUserId, out var quien) ? quien : null,
                url = "/api/v1/publico/archivos/" + fila.Id.ToString(CultureInfo.InvariantCulture),
                usos = vinculos.Select(v => new { modulo = v.Modulo, descripcion = v.Descripcion, esPublico = v.EsPublico }).ToList(),
                // HUERFANO ES EL QUE NO USA NADIE, y es la cifra que de verdad hace falta: son los
                // que ocupan cuota sin que nadie los eche de menos.
                huerfano = vinculos.Count == 0,
                visiblePublicamente = vinculos.Any(v => v.EsPublico),
            });
        }

        long? usados = null;
        if (organizacionId is int deQuien)
        {
            usados = await db.Files.AsNoTracking().Where(x => x.OrganizacionId == deQuien)
                .SumAsync(x => (long?)x.FileSizeBytes ?? 0L, ct);
        }

        return Results.Ok(new
        {
            items,
            pagina = numero,
            tamano = porPagina,
            total,
            totalPaginas = total == 0 ? 0 : (int)Math.Ceiling(total / (double)porPagina),
            cuotaBytes = organizacionId is null ? (long?)null : CuotaPorOrganizacion,
            usadoBytes = usados,
            // Los archivos que ningún lugar usa, en el alcance de esta consulta.
            sinUsar = new { total = sinUsarTotal, bytes = sinUsarBytes },
        });
    }

    /// <summary>
    /// Los archivos que NINGÚN lugar usa, como condición de la consulta. Es la misma regla de
    /// <see cref="VinculosAsync"/> —un archivo está en uso si alguna de las seis tablas que lo vinculan
    /// lo cita y el registro citado existe— expresada para que la base la resuelva de una vez, en lugar
    /// de preguntar archivo por archivo. <c>Los_sin_usar_del_servidor_coinciden_con_los_vinculos_de_cada_archivo</c>
    /// vigila que las dos no se separen.
    /// </summary>
    internal static IQueryable<FileRow> SoloSinUso(SimusDbContext db, IQueryable<FileRow> consulta) =>
        consulta.Where(x =>
            !db.EntityProfiles.Any(p => p.ArchivoFotoId == x.Id)
            && !db.PerfilesPublicos.Any(p => p.ArchivoFotoId == x.Id)
            && !db.ParticipantesDeCitas.Any(p => p.FotoArchivoId == x.Id)
            && !db.Talleres.Any(t => t.ArchivoFotoId == x.Id)
            && !db.Espacios.Any(t => t.ArchivoFotoId == x.Id)
            && !db.Redes.Any(t => t.ArchivoFotoId == x.Id)
            && !db.ArchivosDeRegistro.Any(m => m.ArchivoId == x.Id
                && ((m.ModuloId == Modulos.EdicionesDeFestival
                        && db.EdicionesFestival.Any(e => e.Id.ToString() == m.RegistroId))
                    || (m.ModuloId == Modulos.Festivales
                        && db.FestivalRecords.Any(f => f.Id.ToString() == m.RegistroId))
                    || (m.ModuloId == Modulos.EdicionesDeMercado
                        && db.EdicionesMercado.Any(e => e.Id.ToString() == m.RegistroId))
                    || m.ModuloId == Modulos.ReclamacionesDeAdministracion))
            && !db.NoticiasArchivos.Any(n => n.ArchivoId == x.Id && db.Noticias.Any(no => no.Id == n.NoticiaId))
            && !db.EventosAgendaArchivos.Any(a => a.ArchivoId == x.Id && db.EventosAgenda.Any(e => e.Id == a.EventoAgendaId))
            && !db.AccesosEditoriales.Any(a => a.ArchivoId == x.Id));

    /// <summary>
    /// Retira un archivo del banco.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>SOLO SI NO LO USA NADIE, Y ESO NO ES UNA PRECAUCION: ES LA UNICA FORMA DE QUE SEA
    /// SEGURO.</b> Seis tablas pueden apuntar a un archivo. Borrarlo mientras alguna lo hace deja
    /// una noticia con una imagen rota o revienta contra la foránea; comprobarlo antes convierte la
    /// operación en una que no puede estropear nada.
    /// </para>
    /// <para>
    /// EL MENSAJE DE CUOTA PROMETIA ESTO Y NO EXISTIA. Cuando una organización llenaba su espacio
    /// se le decía «retira material que ya no uses», y no había ninguna forma de retirarlo: la
    /// única salida era escribir al Programa. Una promesa que el sistema no puede cumplir es peor
    /// que no hacerla.
    /// </para>
    /// </remarks>
    private static async Task<IResult> RetirarInstitucional(
        SimusDbContext db, ClaimsPrincipal principal, int id, CancellationToken ct)
    {
        var fila = await db.Files.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();
        return await RetirarAsync(db, fila, principal, ct);
    }

    private static async Task<IResult> RetirarDeLaOrganizacion(
        SimusDbContext db, ClaimsPrincipal principal, int id, CancellationToken ct)
    {
        var organizacionId = await OrganizacionDeAsync(db, principal, ct);
        if (organizacionId is null) return Results.Forbid();

        var fila = await db.Files.FirstOrDefaultAsync(x => x.Id == id, ct);
        // LO AJENO NO SE ENCUENTRA. Un 403 sobre un archivo de otra organización confirmaría que
        // existe; con 404 no se puede saber ni eso recorriendo identificadores.
        if (fila is null || fila.OrganizacionId != organizacionId) return Results.NotFound();
        return await RetirarAsync(db, fila, principal, ct);
    }

    private static async Task<IResult> RetirarAsync(
        SimusDbContext db, FileRow fila, ClaimsPrincipal principal, CancellationToken ct)
    {
        var vinculos = await VinculosAsync(db, fila.Id, ct);
        if (vinculos.Count > 0)
        {
            return Results.Conflict(new
            {
                motivo = "archivo_en_uso",
                message = "Este archivo se está usando y por eso no se puede retirar. Quítalo primero de donde está.",
                usos = vinculos.Select(v => v.Descripcion).Distinct().ToList(),
            });
        }

        // RETIRAR DEJA SU LÍNEA. Es la única acción del Banco que borra bytes, y antes no
        // quedaba rastro de quién retiró qué. La línea sigue el contrato único de la bitácora
        // (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md); lleva lo que describe el hecho —tipo, peso y de quién era— y NUNCA el nombre del
        // archivo, que puede ser un dato personal («cedula_ana_gomez.pdf»). No va a CambiosDeRegistro:
        // retirar no cambia un campo de un registro, quita el registro.
        var actor = Actor(principal);
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Eliminar, "ArchivoRetirado", actor > 0 ? actor : null, "Archivos",
            fila.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { tipo = fila.MimeType, bytes = fila.FileSizeBytes, organizacionId = fila.OrganizacionId },
            despues: null, motivo: null, OrigenDelCambio.Directo, DateTime.UtcNow));
        db.Files.Remove(fila);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    /// <summary>La organización por la que responde quien pregunta, si responde por alguna.</summary>
    private static async Task<int?> OrganizacionDeAsync(SimusDbContext db, ClaimsPrincipal principal, CancellationToken ct)
    {
        var personaId = Actor(principal);
        if (personaId <= 0) return null;
        return await db.UserEntities.AsNoTracking()
            .Where(v => v.UserId == personaId && v.IsActive && RolesDeEntidad.Miembros.Contains(v.EntityRole))
            .Select(v => (int?)v.EntityId)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Describe un archivo de la propia organización.
    /// </summary>
    /// <remarks>
    /// ANTES DESCRIBIA CUALQUIERA. Una cuenta externa podía pedir <c>/externo/archivos/4</c> y
    /// recibir el nombre, el texto alternativo, el pie y el crédito de un archivo institucional con
    /// el que no tiene nada que ver. No son los bytes, pero son datos de otro.
    /// </remarks>
    private static async Task<IResult> DescribirDeLaOrganizacion(
        SimusDbContext db, ClaimsPrincipal principal, int id, CancellationToken ct)
    {
        var organizacionId = await OrganizacionDeAsync(db, principal, ct);
        if (organizacionId is null) return Results.Forbid();

        var fila = await db.Files.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null || fila.OrganizacionId != organizacionId) return Results.NotFound();
        return Results.Ok(Descripcion(fila));
    }

    /// <summary>El tope de lo que una organización puede acumular en el banco.</summary>
    /// <remarks>
    /// <para>
    /// <b>EL CANAL INSTITUCIONAL NO TIENE TOPE Y EL EXTERNO SI, y la diferencia no es desconfianza:
    /// es quién responde.</b> Quien carga desde la consola es el equipo del PNMC y sus subidas se
    /// miran; una cuenta externa la abre cualquiera, y sin cuota el banco queda expuesto a que se
    /// llene a dos megas por vez. Los bytes viven en la base, así que llenarlo no es «ocupar disco»:
    /// es hacer más lento todo lo demás.
    /// </para>
    /// <para>
    /// CINCUENTA MEGAS SON VEINTICINCO ARCHIVOS AL TOPE. Una organización con tres Festivales y sus
    /// ediciones —programa, afiche y logo cada una, más su foto de perfil— no se acerca. Quien lo
    /// alcance es que tiene un problema distinto, y lo que corresponde entonces es hablarlo, no que
    /// el sistema siga tragando en silencio.
    /// </para>
    /// </remarks>
    internal const long CuotaPorOrganizacion = 50L * 1024 * 1024;

    /// <summary>
    /// La misma subida, por la puerta de las organizaciones.
    /// </summary>
    /// <remarks>
    /// <b>NO REPITE NI UNA COMPROBACION DE FORMATO.</b> Pone las dos guardas propias del canal
    /// —correo confirmado y cuota— y delega en <see cref="Subir"/>, que es donde vive la cadena que
    /// separa una imagen de un ejecutable con la cabecera pegada delante.
    /// </remarks>
    private static async Task<IResult> SubirDesdeOrganizacion(
        HttpRequest peticion, SimusDbContext db, ClaimsPrincipal principal, PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion, CancellationToken ct)
    {
        var (organizacionId, rechazo) = await GuardasDelCanalExternoAsync(peticion, db, principal, politicaDeConfirmacion, ct);
        return rechazo ?? await Subir(peticion, db, principal, ct, organizacionId);
    }

    /// <summary>
    /// Un PDF por la puerta de las organizaciones: los soportes de una solicitud.
    /// </summary>
    /// <remarks>
    /// <b>LAS MISMAS DOS GUARDAS QUE UNA IMAGEN</b> —correo confirmado y cuota— y la misma cadena de
    /// documentos de la consola: el tope antes de leer y el formato por su contenido.
    /// </remarks>
    private static async Task<IResult> SubirDocumentoDesdeOrganizacion(
        HttpRequest peticion, SimusDbContext db, ClaimsPrincipal principal, PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion, CancellationToken ct)
    {
        var (organizacionId, rechazo) = await GuardasDelCanalExternoAsync(peticion, db, principal, politicaDeConfirmacion, ct);
        return rechazo ?? await SubirDocumentoComoDueno(peticion, principal, db, ct, organizacionId);
    }

    /// <summary>De qué organización es quien sube, con su correo confirmado y su cuota disponible.</summary>
    private static async Task<(int? OrganizacionId, IResult? Rechazo)> GuardasDelCanalExternoAsync(
        HttpRequest peticion, SimusDbContext db, ClaimsPrincipal principal, PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion, CancellationToken ct)
    {
        var personaId = Actor(principal);
        if (personaId <= 0) return (null, Results.Unauthorized());

        // DE QUE ORGANIZACION ES. Sin esto no hay ni procedencia ni cuota, y una subida externa
        // quedaría indistinguible de una del Programa.
        var organizacionId = await db.UserEntities.AsNoTracking()
            .Where(vinculo => vinculo.UserId == personaId && vinculo.IsActive
                && RolesDeEntidad.Miembros.Contains(vinculo.EntityRole))
            .Select(vinculo => (int?)vinculo.EntityId)
            .FirstOrDefaultAsync(ct);
        if (organizacionId is null) return (null, Results.Forbid());

        // 1. EL CORREO CONFIRMADO, que es la regla del canal: sin él una organización no registra
        //    procesos, y subir el afiche de un Festival es parte de registrarlo.
        if (await AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(
                db, politicaDeConfirmacion, organizacionId.Value, "adjuntar archivos a tus procesos", ct) is { } sinConfirmar)
        {
            return (null, sinConfirmar);
        }

        // 2. LA CUOTA, ANTES DE LEER LOS BYTES. Medir después de cargar es reservar la memoria que
        //    se quería evitar, que es el mismo motivo por el que el tope por archivo va primero.
        //
        //    CUENTA LO QUE ENTRA, Y ANTES NO. La comprobación era «lo acumulado ya llega al tope»,
        //    así que una organización a 49,9 MB podía subir un archivo de 2 MB y quedarse en 51,9.
        //    El tamaño viaja en la cabecera del formulario, así que se sabe sin leer un solo byte.
        var entrante = peticion.HasFormContentType
            ? ((await peticion.ReadFormAsync(ct)).Files["file"]?.Length ?? 0L)
            : 0L;
        var acumulado = await db.Files.AsNoTracking()
            .Where(x => x.OrganizacionId == organizacionId.Value)
            .SumAsync(x => (long?)x.FileSizeBytes ?? 0L, ct);
        if (acumulado + entrante > CuotaPorOrganizacion)
        {
            return (null, Results.Conflict(new
            {
                motivo = "cuota_de_archivos_agotada",
                message = "Tu organización alcanzó el espacio disponible para archivos. "
                    + "Retira material que ya no uses o escríbenos para revisarlo.",
                usadoBytes = acumulado,
                cuotaBytes = CuotaPorOrganizacion,
                archivoBytes = entrante,
            }));
        }

        return (organizacionId.Value, null);
    }

    /// <summary>El canal de las cuentas externas (<c>dbo.Usuarios.CanalAcceso</c>).</summary>
    internal const string CanalExterno = "externo";

    /// <summary>Lo que una persona puede ocupar en el banco con fotos de su perfil público.</summary>
    private const long CuotaPersonal = 10L * 1024 * 1024;

    /// <summary>
    /// La foto del perfil público de una persona. Es el mismo manejador que el resto del
    /// banco; lo único propio es la cuota, que se cuenta por quien sube y no por organización,
    /// porque una cuenta individual no tiene ninguna.
    /// </summary>
    internal static async Task<IResult> SubirFotoPersonalAsync(
        HttpRequest peticion, SimusDbContext db, ClaimsPrincipal principal, int personaId, CancellationToken ct)
    {
        var entrante = peticion.HasFormContentType
            ? ((await peticion.ReadFormAsync(ct)).Files["file"]?.Length ?? 0L)
            : 0L;
        var acumulado = await db.Files.AsNoTracking()
            .Where(x => x.UploadedByUserId == personaId && x.OrganizacionId == null)
            .SumAsync(x => (long?)x.FileSizeBytes ?? 0L, ct);
        if (acumulado + entrante > CuotaPersonal)
        {
            return Results.Conflict(new
            {
                motivo = "cuota_de_archivos_agotada",
                message = "Alcanzaste el espacio disponible para fotos de tu perfil. Escríbenos para revisarlo.",
                usadoBytes = acumulado,
                cuotaBytes = CuotaPersonal,
                archivoBytes = entrante,
            });
        }

        return await SubirComoDueno(peticion, db, principal, ct, organizacionId: null, personaId: personaId);
    }

    private static Task<IResult> Subir(
        HttpRequest peticion, SimusDbContext db, ClaimsPrincipal principal, CancellationToken ct,
        int? organizacionId = null)
        => SubirComoDueno(peticion, db, principal, ct, organizacionId, personaId: null);

    // LA PERSONA NO VIENE DE LA PETICION. `Subir` está mapeado tal cual en la consola, y un
    // parámetro más en su firma se convertía en `?personaId=` público. Solo la subida personal,
    // que lo toma de la sesión, llega a este núcleo con una persona.
    private static async Task<IResult> SubirComoDueno(
        HttpRequest peticion, SimusDbContext db, ClaimsPrincipal principal, CancellationToken ct,
        int? organizacionId, int? personaId)
    {
        if (!peticion.HasFormContentType)
        {
            return Results.BadRequest(new { file = AdjunteUnArchivo });
        }

        var formulario = await peticion.ReadFormAsync(ct);
        var archivo = formulario.Files["file"];
        if (archivo is null || archivo.Length == 0)
        {
            return Results.BadRequest(new { file = AdjunteUnArchivo });
        }

        // 1. EL TOPE, ANTES DE LEER NADA. Medir después de cargar es reservar la memoria que se
        //    quería evitar.
        if (archivo.Length > MediosWebContrato.MaxBytes)
        {
            return Results.BadRequest(new
            {
                file = new[]
                {
                    $"El archivo pesa {PesoLegible(archivo.Length)} y el máximo es {PesoLegible(MediosWebContrato.MaxBytes)}.",
                },
            });
        }

        // 2. EL TEXTO ALTERNATIVO, ANTES DE MIRAR LOS BYTES. Que el archivo sea válido no salva a
        //    una imagen sin alternativa textual.
        var alt = (formulario["alt"].ToString() ?? string.Empty).Trim();
        if (alt.Length == 0)
        {
            return Results.BadRequest(new { alt = EscribaElTextoAlternativo });
        }
        if (alt.Length > LargoMaximoDelAlternativo)
        {
            return Results.BadRequest(new
            {
                alt = new[] { $"El texto alternativo admite {LargoMaximoDelAlternativo.ToString(CultureInfo.InvariantCulture)} caracteres y tiene {alt.Length.ToString(CultureInfo.InvariantCulture)}." },
            });
        }

        using var memoria = new MemoryStream();
        await archivo.CopyToAsync(memoria, ct);
        var datos = memoria.ToArray();

        // 3. EL FORMATO, POR SU FIRMA. Sin decir en qué paso falló: un mensaje detallado sería un
        //    manual para el siguiente intento.
        var formato = MediosWebContrato.Reconocer(datos);
        if (formato is null)
        {
            return Results.BadRequest(new { file = NoEsImagenValida });
        }

        // 3b. SIN METADATOS (S-03). Una foto de celular trae la latitud y la longitud de su casa en el
        //     EXIF, y esta ruta la sirve a anónimos cuando el archivo está vinculado a algo publicado.
        //     Se quitan aquí, en el servidor, antes de calcular la huella y guardar.
        var limpios = LimpiezaDeMetadatosDeImagen.Limpiar(datos, formato.Value.Mime);
        if (limpios is null)
        {
            return Results.BadRequest(new { file = NoEsImagenValida });
        }

        datos = limpios;

        // 4. EL TIPO DECLARADO, SI VIENE, TIENE QUE COINCIDIR.
        var declarado = (archivo.ContentType ?? string.Empty).Trim();
        if (declarado.Length > 0 && !string.Equals(declarado, formato.Value.Mime, StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { file = TipoDeclaradoNoCoincide });
        }

        var huella = MediosWebContrato.Huella(datos);

        // EL MISMO ARCHIVO NO SE GUARDA DOS VECES, PERO SOLO DENTRO DE SU MISMO DUEÑO.
        //
        // LA DEDUPLICACION ERA GLOBAL Y ESO CRUZABA ORGANIZACIONES. Si la organización B subía
        // exactamente los mismos bytes que ya había subido A, se le devolvía el archivo DE A: con
        // el texto alternativo de A, con el crédito de A y con la procedencia de A. B acababa
        // enseñando en su ficha una descripción que no escribió, no podía corregirla, y la cuota se
        // le seguía cobrando a A. Tres cosas mal por ahorrar unos kilobytes.
        //
        // DENTRO DE UN MISMO DUEÑO SI TIENE SENTIDO: reutilizar la portada de un evento en otro no
        // debe duplicar dos megas, y el texto alternativo lo escribió la misma persona.
        //
        // SIN ORGANIZACION HAY DOS CLASES DE DUEÑO: el Programa y cada persona con su foto de
        // perfil. Comparar solo por `OrganizacionId == null` las mezclaba: quien subía los
        // mismos bytes que otra persona o que la consola recibía el archivo ajeno, y el perfil lo
        // rechazaba por no ser propio. La persona deduplica contra lo suyo; el Programa, contra lo
        // que no subió ninguna cuenta externa.
        var mismos = db.Files.AsNoTracking().Where(x => x.Fingerprint == huella && x.OrganizacionId == organizacionId);
        if (personaId is int persona)
        {
            mismos = mismos.Where(x => x.UploadedByUserId == persona);
        }
        else if (organizacionId is null)
        {
            var cuentasExternas = db.Users.AsNoTracking().Where(u => u.AccessChannel == CanalExterno).Select(u => u.Id);
            mismos = mismos.Where(x => !cuentasExternas.Contains(x.UploadedByUserId));
        }

        var yaEstaba = await mismos.FirstOrDefaultAsync(ct);
        if (yaEstaba is not null)
        {
            // LA MISMA IMAGEN CON OTRA DESCRIPCION YA NO DESCARTA LA NUEVA EN SILENCIO (D5-06). La
            // deduplicación es por dueño, así que quien sube es de quien es la imagen: la descripción
            // que acaba de escribir es la que vale. Se aplica, queda en el historial con la anterior
            // y la respuesta lo dice, para que la persona sepa que no se creó un archivo nuevo.
            if (!string.Equals(yaEstaba.AltText, alt, StringComparison.Ordinal))
            {
                return await ActualizarLaDescripcionAsync(db, principal, yaEstaba.Id, alt, organizacionId, personaId, ct);
            }

            return Results.Ok(Descripcion(yaEstaba));
        }

        // El prefijo distingue al dueño en la ruta, que es única en la tabla.
        var prefijo = personaId is int p
            ? "persona" + p.ToString(CultureInfo.InvariantCulture)
            : organizacionId?.ToString(CultureInfo.InvariantCulture) ?? "pnmc";

        var ahora = DateTime.UtcNow;
        var fila = new FileRow
        {
            OriginalName = Recortar(archivo.FileName, 300) ?? "archivo",
            StoredName = prefijo + "-" + huella + ExtensionDe(formato.Value.Mime),
            MimeType = formato.Value.Mime,
            Extension = ExtensionDe(formato.Value.Mime),
            FileSizeBytes = datos.Length,
            // LA RUTA ES UNICA POR ARCHIVO, y no la de lectura a secas.
            //
            // `UQ_Archivos_RutaAlmacenamiento` lo exige, y SQLite no replica esa restricción: con
            // la ruta común a todos, las pruebas pasaban en verde y el segundo archivo que se
            // subía contra SQL Server real reventaba con un 500. Es la misma clase de fallo que
            // trajo `CatalogoEditorialEsquemaSqlServerTests`, y aquí la fija su gemela.
            //
            // El nombre almacenado ya es la huella más la extensión, así que es único por
            // contenido: dos ficheros iguales ni siquiera llegan aquí —se reutiliza el existente—.
            // LA RUTA LLEVA AL DUEÑO PORQUE LA HUELLA YA NO ES UNICA EN LA TABLA. Al deduplicar
            // por dueño, los mismos bytes pueden estar dos veces —una por organización— y
            // `UQ_Archivos_RutaAlmacenamiento` rechazaría la segunda. El prefijo distingue sin
            // tocar la restricción, que es la que impide el descuido de verdad.
            StoragePath = "/api/v1/publico/archivos/" + prefijo + "-" + huella + ExtensionDe(formato.Value.Mime),
            PublicUrl = null,
            AltText = alt,
            Caption = Recortar(formulario["caption"].ToString(), LargoMaximoDelPie),
            Credit = Recortar(formulario["credit"].ToString(), LargoMaximoDelCredito),
            UploadedByUserId = Actor(principal),
            // NULO ES INSTITUCIONAL. Es la procedencia, y no lo mismo que quién lo subió.
            OrganizacionId = organizacionId,
            CreatedAt = ahora,
            Content = datos,
            Fingerprint = huella,
            Width = formato.Value.Width,
            Height = formato.Value.Height,
        };

        db.Files.Add(fila);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/institucional/archivos/{fila.Id.ToString(CultureInfo.InvariantCulture)}", Descripcion(fila));
    }

    /// <summary>El texto alternativo es el único campo del archivo cuyo cambio guarda el historial.</summary>
    private static readonly IReadOnlyList<CampoVigilado<FileRow>> CamposVigilados =
    [
        new("altText", "Descripción para quien no ve la imagen", ClaseDeDato.Publico, x => x.AltText),
    ];

    private const string AvisoDeDescripcionActualizada = "Ya tenías esta imagen; actualicé su descripción.";

    private static async Task<IResult> ActualizarLaDescripcionAsync(
        SimusDbContext db, ClaimsPrincipal principal, int archivoId, string alt, int? organizacionId, int? personaId, CancellationToken ct)
    {
        var fila = await db.Files.FirstAsync(x => x.Id == archivoId, ct);
        var foto = RegistradorDeCambios.Tomar(fila, CamposVigilados);
        fila.AltText = alt;
        var actor = Actor(principal);
        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(
                Modulos.Archivos, fila.Id.ToString(CultureInfo.InvariantCulture), organizacionId, actor,
                personaId is not null ? "Persona" : organizacionId is null ? "Consola" : "Organización",
                Motivo: "Se subió la misma imagen con otra descripción"),
            CamposVigilados, foto, fila, ct);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new
        {
            id = fila.Id,
            nombre = fila.OriginalName,
            tipo = fila.MimeType,
            bytes = fila.FileSizeBytes,
            alt = fila.AltText,
            pie = fila.Caption,
            credito = fila.Credit,
            ancho = fila.Width,
            alto = fila.Height,
            url = "/api/v1/publico/archivos/" + fila.Id.ToString(CultureInfo.InvariantCulture),
            descripcionActualizada = true,
            aviso = AvisoDeDescripcionActualizada,
        });
    }

    /// <summary>
    /// Sube un documento —hoy, un PDF— al banco.
    /// </summary>
    /// <remarks>
    /// <para>
    /// ES UNA PUERTA APARTE Y NO UN PARAMETRO DE LA DE IMAGENES, a propósito. Las guardas de
    /// <see cref="Subir"/> están pensadas para imágenes: exigen texto alternativo, miden dimensiones
    /// y toleran 2 MiB. Añadir aquí un interruptor «acepta PDF» habría relajado esas tres cosas para
    /// todo el mundo, que es como una excepción se convierte en la regla sin que nadie lo decida.
    /// </para>
    /// <para>
    /// QUE CAMBIA RESPECTO DE UNA IMAGEN: el tope sube a 20 MiB —una guía escaneada pesa diez veces
    /// lo que un hero y no por estar mal exportada—, no se pide texto alternativo —un PDF no se
    /// describe, se abre— y el formato se comprueba con <see cref="MediosWebContrato.EsPdf"/>, que
    /// mira las dos puntas del fichero. Lo que NO cambia: el formato se reconoce por su contenido y
    /// no por lo que el cliente declare, y el tope se mide ANTES de leer nada.
    /// </para>
    /// <para>
    /// EL CANAL EXTERNO SE ABRIÓ PARA UN USO CONCRETO: los soportes de una
    /// solicitud de administración —un acta, un certificado— son PDF. Lo pidió la dirección; entra
    /// por <see cref="SubirDocumentoDesdeOrganizacion"/>, con el correo confirmado y la cuota de la
    /// organización, y lo subido solo lo ven la organización y la consola.
    /// </para>
    /// </remarks>
    private static Task<IResult> SubirDocumento(
        HttpRequest peticion, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
        => SubirDocumentoComoDueno(peticion, principal, db, ct, organizacionId: null);

    // EL DUEÑO NO VIENE DE LA PETICION, como en `SubirComoDueno`: `SubirDocumento` está mapeado
    // tal cual en la consola y un parámetro más se volvería público. La organización solo llega
    // aquí desde `SubirDocumentoDesdeOrganizacion`, que la toma de la sesión.
    private static async Task<IResult> SubirDocumentoComoDueno(
        HttpRequest peticion, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct, int? organizacionId)
    {
        if (!peticion.HasFormContentType)
        {
            return Results.BadRequest(new { file = AdjunteUnArchivo });
        }

        var formulario = await peticion.ReadFormAsync(ct);
        var archivo = formulario.Files["file"];
        if (archivo is null || archivo.Length == 0)
        {
            return Results.BadRequest(new { file = AdjunteUnArchivo });
        }

        // EL TOPE, ANTES DE LEER NADA.
        if (archivo.Length > MediosWebContrato.MaxBytesDocumento)
        {
            return Results.BadRequest(new
            {
                file = new[]
                {
                    $"El documento pesa {PesoLegible(archivo.Length)} y el máximo es {PesoLegible(MediosWebContrato.MaxBytesDocumento)}.",
                },
            });
        }

        using var memoria = new MemoryStream();
        await archivo.CopyToAsync(memoria, ct);
        var datos = memoria.ToArray();

        if (!MediosWebContrato.EsPdf(datos))
        {
            return Results.BadRequest(new { file = NoEsPdfValido });
        }

        var declarado = (archivo.ContentType ?? string.Empty).Trim();
        if (declarado.Length > 0 && !string.Equals(declarado, "application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { file = TipoDeclaradoNoCoincide });
        }

        var huella = MediosWebContrato.Huella(datos);
        // SE DEDUPLICA DENTRO DEL MISMO DUEÑO, como las imágenes: el PDF de una organización no se
        // le entrega a otra ni al Programa.
        var yaEstaba = await db.Files.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Fingerprint == huella && x.OrganizacionId == organizacionId, ct);
        if (yaEstaba is not null)
        {
            return Results.Ok(Descripcion(yaEstaba));
        }

        // EL PREFIJO DISTINGUE AL DUEÑO EN LA RUTA, que es única en la tabla.
        var prefijo = organizacionId?.ToString(CultureInfo.InvariantCulture) ?? "pnmc";
        var ahora = DateTime.UtcNow;
        var fila = new FileRow
        {
            OriginalName = Recortar(archivo.FileName, 300) ?? "documento.pdf",
            StoredName = prefijo + "-" + huella + ".pdf",
            MimeType = "application/pdf",
            Extension = ".pdf",
            FileSizeBytes = datos.Length,
            StoragePath = "/api/v1/publico/archivos/" + prefijo + "-" + huella + ".pdf",
            PublicUrl = null,
            // EL NOMBRE DEL FICHERO HACE DE DESCRIPCION, y no se inventa una: un PDF se identifica
            // por cómo se llama, no por una frase que describa su aspecto.
            AltText = Recortar(archivo.FileName, LargoMaximoDelAlternativo) ?? "documento",
            Caption = Recortar(formulario["caption"].ToString(), LargoMaximoDelPie),
            Credit = Recortar(formulario["credit"].ToString(), LargoMaximoDelCredito),
            UploadedByUserId = Actor(principal),
            OrganizacionId = organizacionId,
            CreatedAt = ahora,
            Content = datos,
            Fingerprint = huella,
            // Un documento no tiene dimensiones en píxeles. Inventarlas sería mentir en la tabla.
            Width = null,
            Height = null,
        };

        db.Files.Add(fila);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/institucional/archivos/{fila.Id.ToString(CultureInfo.InvariantCulture)}", Descripcion(fila));
    }

    private static object Descripcion(FileRow fila) => new
    {
        id = fila.Id,
        nombre = fila.OriginalName,
        tipo = fila.MimeType,
        bytes = fila.FileSizeBytes,
        alt = fila.AltText,
        pie = fila.Caption,
        credito = fila.Credit,
        ancho = fila.Width,
        alto = fila.Height,
        url = "/api/v1/publico/archivos/" + fila.Id.ToString(CultureInfo.InvariantCulture),
    };

    /// <summary>La extensión que corresponde al tipo reconocido, no a la que traía el nombre.</summary>
    /// <summary>
    /// Un peso dicho como lo diría una persona: «2 MB» y no «2097152 bytes» (D5-12).
    /// </summary>
    /// <remarks>
    /// El mensaje de «el archivo es muy grande» lo lee quien sube una foto, no quien programó el
    /// tope: con cifras en bytes no se entiende cuánto hay que reducir. Se redondea a un decimal y se
    /// escribe con coma, como en el resto de la interfaz.
    /// </remarks>
    internal static string PesoLegible(long bytes)
    {
        var es = CultureInfo.GetCultureInfo("es-CO");
        return bytes switch
        {
            >= 1024L * 1024 => $"{(bytes / (1024d * 1024)).ToString("0.#", es)} MB",
            >= 1024 => $"{(bytes / 1024d).ToString("0.#", es)} KB",
            _ => $"{bytes.ToString(es)} bytes",
        };
    }

    private static string ExtensionDe(string mime) => mime switch
    {
        "image/png" => ".png",
        "image/jpeg" => ".jpg",
        "image/webp" => ".webp",
        _ => ".bin",
    };

    private static string? Recortar(string? valor, int largo)
    {
        var limpio = (valor ?? string.Empty).Trim();
        if (limpio.Length == 0) return null;
        return limpio.Length <= largo ? limpio : limpio[..largo];
    }

    private static int Actor(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), CultureInfo.InvariantCulture, out var id) ? id : 0;
}
