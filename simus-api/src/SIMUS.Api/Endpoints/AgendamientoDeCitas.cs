using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Las reglas de la agenda de citas de un Mercado (docs/referencia/26-agenda-de-citas-y-mercados.md) que comparten el lado de la organización y
/// el de las personas.
/// </summary>
/// <remarks>
/// <para>
/// <b>LA BASE IMPIDE LA DOBLE RESERVA; ESTE CODIGO LA EXPLICA.</b> Los índices únicos filtrados de
/// <c>V20261115_70</c> son lo que de verdad garantiza que nadie tenga dos citas vivas en una franja. Aquí
/// se comprueba ANTES para poder decir por qué, y se atrapa el choque DESPUES para el caso de que dos
/// personas pidan a la vez: la segunda recibe un 409 con un mensaje y no un error del motor.
/// </para>
/// <para>
/// <b>EL VENCIMIENTO ES PEREZOSO.</b> Una solicitud pendiente reserva la franja hasta que se decide o
/// vence. No hay un proceso que la libere a su hora: toda lectura o escritura de una agenda llama primero a
/// <see cref="ExpirarVencidasAsync"/>, así que una franja que debió liberarse nunca bloquea a nadie.
/// </para>
/// </remarks>
internal static class AgendamientoDeCitas
{
    /// <summary>
    /// Las fechas de una edición son de CALENDARIO (la columna es <c>date</c>): se envían como «AAAA-MM-DD», sin hora ni zona.
    /// Enviadas como instante («…T00:00:00») la web las leía como UTC y las pintaba un día antes en hora de Bogotá.
    /// </summary>
    public static DateOnly? Dia(DateTime? fecha) => fecha is { } f ? DateOnly.FromDateTime(f) : null;

    public const string ModoCompradoresRotan = "compradores_rotan";
    public const string ModoCompradoresFijos = "compradores_fijos";
    public static readonly string[] Modos = [ModoCompradoresRotan, ModoCompradoresFijos];

    public const string AprobacionAutomatica = "automatica";
    public const string AprobacionPorAceptacion = "aceptacion";
    public static readonly string[] Aprobaciones = [AprobacionAutomatica, AprobacionPorAceptacion];

    public const string RolArtista = "artista";
    public const string RolComprador = "comprador";

    public static readonly string[] TiposDeComprador =
        ["festival", "sala", "agencia", "sello", "editorial", "medio", "institucion", "otro"];

    /// <summary>Colombia no tiene horario de verano: Bogotá es UTC−5 todo el año.</summary>
    public static readonly TimeSpan DesfaseDeBogota = TimeSpan.FromHours(-5);

    /// <summary>Quién rota —visita y pide— en cada modo.</summary>
    public static string RolQueRota(string modo) => modo == ModoCompradoresFijos ? RolArtista : RolComprador;

    /// <summary>Quién es fijo —recibe y confirma— en cada modo.</summary>
    public static string RolFijo(string modo) => modo == ModoCompradoresFijos ? RolComprador : RolArtista;

    public static bool EstaVivo(string estadoDeLaCita) => estadoDeLaCita is "solicitada" or "confirmada";

    public static string? Opcional(string? valor, int maximo)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        var limpio = valor.Trim();
        return limpio.Length > maximo ? limpio[..maximo] : limpio;
    }

    /// <summary>Si el fallo de guardado fue un índice único: la franja ya la tomó otra persona.</summary>
    public static bool EsChoqueDeUnicidad(DbUpdateException error)
    {
        var mensaje = (error.InnerException?.Message ?? error.Message) ?? string.Empty;
        return mensaje.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase)
            || mensaje.Contains("duplicate", StringComparison.OrdinalIgnoreCase)
            || mensaje.Contains("duplicad", StringComparison.OrdinalIgnoreCase);
    }

    public static DateTime LocalDeBogotaAUtc(DateOnly fecha, TimeOnly hora) =>
        DateTime.SpecifyKind(fecha.ToDateTime(hora) - DesfaseDeBogota, DateTimeKind.Utc);

    // ═════════════════════════════════ Vencimiento y promoción ═════════════════════════════════

    /// <summary>
    /// Libera las franjas de las solicitudes que vencieron. Las deja en <c>vencida</c>, con su línea de
    /// bitácora, y NO llama a <c>SaveChanges</c> más que para guardar lo suyo.
    /// </summary>
    public static async Task ExpirarVencidasAsync(SimusDbContext db, int agendaId, DateTime ahora, CancellationToken ct)
    {
        var vencidas = await db.CitasDeAgenda
            .Where(c => c.AgendaId == agendaId && c.Estado == "solicitada" && c.VenceUtc != null && c.VenceUtc <= ahora)
            .ToListAsync(ct);
        if (vencidas.Count == 0) return;

        foreach (var cita in vencidas)
        {
            cita.Estado = "vencida";
            cita.FechaDecision = ahora;
            cita.FechaActualizacion = ahora;
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Actualizar, "CitaVencida", null, "CitasDeAgenda",
                cita.Id.ToString(CultureInfo.InvariantCulture),
                antes: new { estado = "solicitada" }, despues: new { estado = "vencida" },
                motivo: null, OrigenDelCambio.Directo, ahora));
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Mientras haya cupo, entra el primero de la lista de espera por orden de ingreso y se le avisa.
    /// </summary>
    public static async Task PromoverDeLaListaDeEsperaAsync(
        SimusDbContext db, AgendaDeCitasRow agenda, string nombreDelMercado, DateTime ahora, CancellationToken ct)
    {
        while (true)
        {
            var aprobados = await db.ParticipantesDeCitas
                .CountAsync(p => p.AgendaId == agenda.Id && p.Rol == RolArtista && p.Estado == "aprobado", ct);
            if (agenda.CupoArtistas is int cupo && aprobados >= cupo) return;

            var siguiente = await db.ParticipantesDeCitas
                .Where(p => p.AgendaId == agenda.Id && p.Rol == RolArtista && p.Estado == "lista_de_espera")
                .OrderBy(p => p.FechaInscripcion).ThenBy(p => p.Id)
                .FirstOrDefaultAsync(ct);
            if (siguiente is null) return;

            siguiente.Estado = "aprobado";
            siguiente.FechaActualizacion = ahora;
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Actualizar, "ParticipanteDeCitasPromovido", null, "ParticipantesDeCitas",
                siguiente.Id.ToString(CultureInfo.InvariantCulture),
                antes: new { estado = "lista_de_espera" }, despues: new { estado = "aprobado" },
                motivo: null, OrigenDelCambio.Directo, ahora));
            await AvisarAsync(db, [siguiente.UsuarioId], "InscripcionEnAgendaConfirmada",
                "Ya tienes lugar en la agenda de citas",
                $"Se liberó un lugar y entraste a la agenda de citas de «{nombreDelMercado}». Ya puedes pedir citas.",
                agenda.Id, ahora, ct);
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Cancela las citas vivas de un participante que sale de la agenda (o rechazado) y avisa a la otra
    /// parte. La franja queda libre.
    /// </summary>
    public static async Task CancelarLasCitasVivasDeAsync(
        SimusDbContext db, AgendaDeCitasRow agenda, ParticipanteDeCitasRow quienSale, string motivo, int? actor,
        string nombreDelMercado, DateTime ahora, CancellationToken ct)
    {
        var citas = await db.CitasDeAgenda
            .Where(c => c.AgendaId == agenda.Id && (c.AnfitrionId == quienSale.Id || c.VisitanteId == quienSale.Id)
                && (c.Estado == "solicitada" || c.Estado == "confirmada"))
            .ToListAsync(ct);
        foreach (var cita in citas)
        {
            var estadoAnterior = cita.Estado;
            cita.Estado = "cancelada";
            cita.MotivoDeLaDecision = motivo;
            cita.CanceladaPorId = quienSale.Id;
            cita.FechaDecision = ahora;
            cita.FechaActualizacion = ahora;
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Actualizar, "CitaCancelada", actor, "CitasDeAgenda",
                cita.Id.ToString(CultureInfo.InvariantCulture),
                antes: new { estado = estadoAnterior }, despues: new { estado = "cancelada" },
                motivo, OrigenDelCambio.Directo, ahora));

            var otraParte = cita.AnfitrionId == quienSale.Id ? cita.VisitanteId : cita.AnfitrionId;
            var cuenta = await db.ParticipantesDeCitas.AsNoTracking()
                .Where(p => p.Id == otraParte).Select(p => p.UsuarioId).FirstOrDefaultAsync(ct);
            await AvisarAsync(db, [cuenta], "CitaCancelada", "Se canceló una cita",
                $"{quienSale.Nombre} salió de la agenda de «{nombreDelMercado}» y su cita contigo se canceló. Motivo: {motivo}",
                agenda.Id, ahora, ct);
        }
    }

    // ═══════════════════════════════════════ Avisos ═══════════════════════════════════════

    /// <summary>
    /// Un aviso dentro de SIMUS para cada cuenta. Mientras no haya proveedor de correo no se simula su
    /// entrega: solo se registra (docs/usuario/06-modulos-y-funcionalidades.md §6.5). Una persona sin cuenta —un comprador invitado que aún no
    /// entró— no recibe aviso.
    /// </summary>
    public static Task AvisarAsync(
        SimusDbContext db, IEnumerable<int?> usuarios, string evento, string titulo, string cuerpo,
        int agendaId, DateTime ahora, CancellationToken ct) =>
        AvisarConPortafolioAsync(db, usuarios, evento, titulo, cuerpo, agendaId, ahora, portafolio: null, ct);

    /// <summary>Lo mismo, con el portafolio de quien actúa en el correo (la presentación y los enlaces con los que agenda).</summary>
    public static async Task AvisarConPortafolioAsync(
        SimusDbContext db, IEnumerable<int?> usuarios, string evento, string titulo, string cuerpo,
        int agendaId, DateTime ahora, PortafolioDeCorreo? portafolio, CancellationToken ct)
    {
        var ids = usuarios.Where(u => u is > 0).Select(u => u!.Value).Distinct().ToList();
        if (ids.Count == 0) return;

        var cuentas = await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id) && u.IsActive)
            .Select(u => new { u.Id, u.Email })
            .ToListAsync(ct);
        var nombreDeLaAgenda = await db.AgendasDeCitas.AsNoTracking().Where(x => x.Id == agendaId)
            .Select(x => x.Subtitulo == "" ? x.Nombre : x.Nombre + " · " + x.Subtitulo).FirstOrDefaultAsync(ct);
        foreach (var cuenta in cuentas)
        {
            db.Notifications.Add(new NotificationRow
            {
                RecipientUserId = cuenta.Id,
                RecipientEmail = cuenta.Email,
                EventType = evento,
                AccessScope = SimusAuthentication.ExternalScope,
                Channel = "internal",
                Title = titulo,
                Body = cuerpo,
                Status = "enviada",
                ModuloId = Modulos.AgendasDeCitas,
                RecordId = agendaId.ToString(CultureInfo.InvariantCulture),
                CreatedAt = ahora,
                SentAt = ahora,
                Attempts = 0,
            });

            // EL MISMO AVISO SALE POR CORREO, con la plantilla común: quien no entra a SIMUS todos los días se
            // entera igual. Va a la cola (estado «pendiente») como todos los correos del sistema; no finge envío.
            var redactado = CorreosDelSistema.AvisoDeAgendaDeCitas(evento, titulo, cuerpo, nombreDeLaAgenda, EnlaceDeMiAgenda, portafolio);
            await new EnviadorDeCorreoPendienteDeProveedor(db).EncolarAsync(
                new CorreoSaliente(cuenta.Email, redactado.Asunto, redactado.Cuerpo, "AgendaDeCitas." + evento, cuenta.Id), ct);
        }
    }

    /// <summary>Dónde ve cada persona sus citas: «Mi agenda de citas» (el botón de todos los correos de la agenda).</summary>
    public const string EnlaceDeMiAgenda = "/gestion/cuenta/agenda-de-citas";

    // ═══════════════════════════════ Registro de cambios ═══════════════════════════════

    /// <summary>
    /// El cambio de estado de un registro de la agenda, campo por campo, en el registro de cambios
    /// (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md). La línea de bitácora la escribe quien llama, con su evento propio.
    /// </summary>
    public static Task RegistrarEstadoAsync(
        SimusDbContext db, string modulo, string registroId, int? organizacionId, int? actor, string actorRol,
        string? anterior, string nuevo, string? motivo, DateTime ahora, CancellationToken ct) =>
        RegistradorDeCambios.RegistrarValoresAsync(
            db,
            new ContextoDeCambio(modulo, registroId, organizacionId, actor, actorRol,
                Motivo: motivo, Fecha: ahora),
            [new ValorCambiado("estado", "Estado", ClaseDeDato.Publico, anterior, nuevo)],
            ct, conBitacora: false);

    // ═════════════════════════════════════ Proyecciones ═════════════════════════════════════

    /// <summary>
    /// La foto de perfil de cada participante que tiene cuenta y la muestra: la del perfil público de la persona (Banco de
    /// archivos, la regla de las fotos de perfil: pública o «solo SIMUS»). Quien no tiene, se pinta con sus iniciales.
    /// </summary>
    public static async Task<Dictionary<int, string>> FotosAsync(SimusDbContext db, IEnumerable<int> participanteIds, CancellationToken ct)
    {
        var ids = participanteIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        static string Url(int archivo) => "/api/v1/publico/archivos/" + archivo.ToString(CultureInfo.InvariantCulture);

        // 1. La foto que la persona puso en esta agenda.
        var propias = await db.ParticipantesDeCitas.AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.FotoArchivoId != null)
            .Select(p => new { p.Id, Foto = p.FotoArchivoId!.Value }).ToListAsync(ct);
        var resultado = propias.ToDictionary(x => x.Id, x => Url(x.Foto));

        // 2. Si no, la de su perfil público, cuando lo tiene y lo muestra.
        var delPerfil = await (
            from p in db.ParticipantesDeCitas.AsNoTracking()
            where ids.Contains(p.Id) && p.UsuarioId != null && p.FotoArchivoId == null
            join f in PerfilPublicoEndpoints.VisiblesParaSimus(db) on p.UsuarioId equals f.IdUsuario
            where f.ArchivoFotoId != null
            select new { p.Id, Foto = f.ArchivoFotoId!.Value }).ToListAsync(ct);
        foreach (var x in delPerfil) resultado[x.Id] = Url(x.Foto);
        return resultado;
    }

    public static ParticipanteDto Participante(
        ParticipanteDeCitasRow p, bool verContacto, bool verCorreoDeInvitacion, int? posicion = null) =>
        new(p.Id, p.Rol, p.Nombre, p.Entidad, p.TipoDeComprador, p.Presentacion, p.Enlaces, p.RepresentaA,
            p.Espacio, p.Estado, p.MotivoDeLaDecision, p.FechaInscripcion, p.UsuarioId is not null, posicion,
            verCorreoDeInvitacion ? p.CorreoInvitacion : null,
            verContacto ? p.ContactoCorreo ?? p.CorreoInvitacion : null,
            verContacto ? p.ContactoTelefono : null);

    /// <summary>
    /// Las citas de una agenda como las ve quien pregunta. <paramref name="quienPregunta"/> es el participante
    /// cuya vista se arma, o <c>null</c> para la organización (que ve todas y no necesita contactos aquí).
    /// El contacto de la otra parte solo sale cuando la cita está CONFIRMADA.
    /// </summary>
    public static async Task<List<CitaDto>> CitasAsync(
        SimusDbContext db, int agendaId, int? quienPregunta, CancellationToken ct)
    {
        var consulta = db.CitasDeAgenda.AsNoTracking().Where(c => c.AgendaId == agendaId);
        if (quienPregunta is int yo) consulta = consulta.Where(c => c.AnfitrionId == yo || c.VisitanteId == yo);
        var citas = await consulta.ToListAsync(ct);
        if (citas.Count == 0) return [];

        var franjas = await db.FranjasDeCitas.AsNoTracking().Where(f => f.AgendaId == agendaId)
            .ToDictionaryAsync(f => f.Id, ct);
        var personas = await db.ParticipantesDeCitas.AsNoTracking().Where(p => p.AgendaId == agendaId)
            .ToDictionaryAsync(p => p.Id, ct);

        // La misma fuente de foto que la parrilla y el calendario (la de la agenda o la del perfil), para «Mi día» y «Mis citas».
        var fotos = quienPregunta is int
            ? await FotosAsync(db, citas.Select(c => quienPregunta == c.AnfitrionId ? c.VisitanteId : c.AnfitrionId), ct)
            : [];

        return citas
            .Select(c =>
            {
                var franja = franjas[c.FranjaId];
                var anfitrion = personas[c.AnfitrionId];
                var visitante = personas[c.VisitanteId];
                ParticipanteDeCitasRow? otra = quienPregunta is int q ? (q == c.AnfitrionId ? visitante : anfitrion) : null;
                var contacto = c.Estado == "confirmada" && otra is not null;
                return new CitaDto(
                    c.Id, c.FranjaId, franja.InicioUtc, franja.FinUtc, c.Estado,
                    anfitrion.Id, anfitrion.Nombre, anfitrion.Entidad, anfitrion.Espacio,
                    visitante.Id, visitante.Nombre, visitante.Entidad,
                    c.MensajeInicial, c.MotivoDeLaDecision, c.VenceUtc, c.FechaSolicitud,
                    contacto ? otra!.ContactoCorreo ?? otra.CorreoInvitacion : null,
                    contacto ? otra!.ContactoTelefono : null,
                    // La mesa o la sala la asigna la organización al COMPRADOR; se muestra, nunca se escribe desde aquí.
                    new[] { anfitrion, visitante }.FirstOrDefault(x => x.Rol == RolComprador && !string.IsNullOrWhiteSpace(x.Espacio))?.Espacio,
                    // EL PORTAFOLIO DE LA OTRA PARTE viaja con la cita desde que se pide (quien responde decide con él).
                    otra is null ? null : new PortafolioDto(otra.Nombre, otra.Entidad, otra.Presentacion, otra.Enlaces, fotos.GetValueOrDefault(otra.Id)));
            })
            .OrderBy(c => c.InicioUtc).ThenBy(c => c.Id)
            .ToList();
    }

    public static async Task<AgendaDto> ResumenAsync(
        SimusDbContext db, AgendaDeCitasRow agenda, CancellationToken ct)
    {
        var edicion = await db.EdicionesMercado.AsNoTracking().FirstAsync(e => e.Id == agenda.EdicionMercadoId, ct);
        var mercado = await db.Mercados.AsNoTracking().FirstAsync(m => m.Id == edicion.MercadoId, ct);

        var participantes = await db.ParticipantesDeCitas.AsNoTracking()
            .Where(p => p.AgendaId == agenda.Id)
            .GroupBy(p => new { p.Rol, p.Estado })
            .Select(g => new { g.Key.Rol, g.Key.Estado, Total = g.Count() })
            .ToListAsync(ct);
        var citas = await db.CitasDeAgenda.AsNoTracking()
            .Where(c => c.AgendaId == agenda.Id)
            .GroupBy(c => c.Estado)
            .Select(g => new { Estado = g.Key, Total = g.Count() })
            .ToListAsync(ct);
        var franjas = await db.FranjasDeCitas.CountAsync(f => f.AgendaId == agenda.Id, ct);

        int Contar(string rol, string estado) =>
            participantes.Where(p => p.Rol == rol && p.Estado == estado).Sum(p => p.Total);
        int Citas(string estado) => citas.Where(c => c.Estado == estado).Sum(c => c.Total);

        return new AgendaDto(
            agenda.Id, agenda.EdicionMercadoId, mercado.Id, mercado.Nombre, edicion.Anio, edicion.Nombre,
            Dia(edicion.FechaInicio), Dia(edicion.FechaFin), agenda.Estado, agenda.Modo, agenda.DuracionMinutos,
            agenda.PausaMinutos, agenda.TopeSolicitudesPendientes, agenda.VencimientoSolicitudHoras,
            agenda.CupoArtistas, agenda.AperturaInscripcionUtc, agenda.CierreInscripcionUtc, franjas,
            Contar(RolArtista, "aprobado"), Contar(RolArtista, "lista_de_espera"), Contar(RolComprador, "aprobado"),
            Citas("solicitada"), Citas("confirmada"), agenda.AprobacionDeArtistas, Contar(RolArtista, "pendiente"), agenda.Nombre,
            agenda.CitasMaximasPorVisitante, agenda.Subtitulo);
    }

    // ═══════════════════════════════════ Calendario y CSV ═══════════════════════════════════

    /// <summary>Un archivo .ics con las citas confirmadas que se le pasan.</summary>
    public static string Calendario(string titulo, IEnumerable<(CitaDto Cita, string Resumen)> citas, DateTime ahora)
    {
        static string Escapar(string texto) => texto
            .Replace("\\", "\\\\", StringComparison.Ordinal).Replace(";", "\\;", StringComparison.Ordinal)
            .Replace(",", "\\,", StringComparison.Ordinal).Replace("\r", string.Empty, StringComparison.Ordinal)
            .Replace("\n", "\\n", StringComparison.Ordinal);
        static string Instante(DateTime utc) => utc.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);

        var sb = new StringBuilder();
        sb.Append("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SIMUS//Agenda de citas//ES\r\nCALSCALE:GREGORIAN\r\n");
        sb.Append("X-WR-CALNAME:").Append(Escapar(titulo)).Append("\r\n");
        foreach (var (cita, resumen) in citas)
        {
            sb.Append("BEGIN:VEVENT\r\n");
            sb.Append("UID:cita-").Append(cita.Id.ToString(CultureInfo.InvariantCulture)).Append("@simus\r\n");
            sb.Append("DTSTAMP:").Append(Instante(ahora)).Append("\r\n");
            sb.Append("DTSTART:").Append(Instante(cita.InicioUtc)).Append("\r\n");
            sb.Append("DTEND:").Append(Instante(cita.FinUtc)).Append("\r\n");
            sb.Append("SUMMARY:").Append(Escapar(resumen)).Append("\r\n");
            var lugar = cita.Espacio ?? cita.AnfitrionEspacio;
            if (!string.IsNullOrWhiteSpace(lugar))
            {
                sb.Append("LOCATION:").Append(Escapar(lugar!)).Append("\r\n");
            }
            sb.Append("STATUS:CONFIRMED\r\nEND:VEVENT\r\n");
        }
        sb.Append("END:VCALENDAR\r\n");
        return sb.ToString();
    }

    /// <summary>El CSV de las citas de la agenda (con BOM para que Excel lo abra en UTF-8).</summary>
    public static byte[] Csv(IEnumerable<CitaDto> citas, IReadOnlyDictionary<int, ParticipanteDeCitasRow> personas)
    {
        static string Campo(string? valor)
        {
            var texto = valor ?? string.Empty;
            // Una celda que empieza por = + - @ se leería como fórmula en una hoja de cálculo.
            if (texto.Length > 0 && texto[0] is '=' or '+' or '-' or '@') texto = "'" + texto;
            return "\"" + texto.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
        }
        static string Bogota(DateTime utc) =>
            (DateTime.SpecifyKind(utc, DateTimeKind.Utc) + DesfaseDeBogota).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);

        var sb = new StringBuilder();
        sb.Append("Inicio (Bogotá),Fin (Bogotá),Estado,Anfitrión,Entidad del anfitrión,Espacio,Correo del anfitrión,"
            + "Visitante,Entidad del visitante,Correo del visitante,Motivo\r\n");
        foreach (var c in citas)
        {
            personas.TryGetValue(c.AnfitrionId, out var anfitrion);
            personas.TryGetValue(c.VisitanteId, out var visitante);
            sb.Append(string.Join(',',
                Campo(Bogota(c.InicioUtc)), Campo(Bogota(c.FinUtc)), Campo(c.Estado),
                Campo(c.AnfitrionNombre), Campo(c.AnfitrionEntidad), Campo(c.AnfitrionEspacio),
                Campo(anfitrion?.ContactoCorreo ?? anfitrion?.CorreoInvitacion),
                Campo(c.VisitanteNombre), Campo(c.VisitanteEntidad),
                Campo(visitante?.ContactoCorreo ?? visitante?.CorreoInvitacion),
                Campo(c.MotivoDeLaDecision))).Append("\r\n");
        }
        return [.. new UTF8Encoding(true).GetPreamble(), .. new UTF8Encoding(false).GetBytes(sb.ToString())];
    }
}
