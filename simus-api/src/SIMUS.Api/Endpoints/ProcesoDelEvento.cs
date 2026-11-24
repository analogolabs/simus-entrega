using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// De quién es el anuncio: una organización, o una persona sin organización (LUT-01).
/// </summary>
/// <remarks>
/// <para>
/// <b>UN EVENTO NO TIENE DUEÑO PROPIO: LO TIENE SU PROCESO.</b> Es la regla de siempre
/// (<see cref="EventosDeOrganizacionEndpoints"/>): una organización anuncia eventos de sus procesos.
/// Con los talleres de lutería, las redes y los espacios para música en vivo, el responsable de un
/// proceso puede ser una <b>persona</b> (<c>UsuarioResponsableId</c>) y no una organización. El
/// alcance dice cuál de las dos cosas es y a partir de él se deciden los procesos que se pueden
/// enmarcar, los eventos que se ven y qué eventos se pueden tocar.
/// </para>
/// <para>
/// <b>UNA PERSONA SOLO ANUNCIA SOBRE LO SUYO Y SIN ORGANIZACIÓN.</b> Los Festivales y los Mercados no
/// tienen persona responsable en esta base: quedan fuera del alcance personal. Tampoco entra un
/// taller, un espacio o una red que una organización registró aunque la persona pertenezca a ella:
/// para eso está el panel de la organización.
/// </para>
/// </remarks>
internal readonly record struct AlcanceDeEventos(int? OrganizacionId, int Persona)
{
    public bool EsDePersona => OrganizacionId is null;

    /// <summary>
    /// Lo que Minimal API llama para armar el alcance: la organización sale de la RUTA (si la hay) y la
    /// persona, de la sesión. Nunca del cuerpo ni de la consulta: quien escribe no elige de quién habla.
    /// </summary>
    /// <remarks>
    /// Sin sesión externa la persona queda en 0 y cada operación responde 401.
    /// </remarks>
    public static ValueTask<AlcanceDeEventos> BindAsync(HttpContext http)
    {
        ArgumentNullException.ThrowIfNull(http);
        var persona = SesionExterna.PersonaDe(http.User) ?? 0;
        int? organizacion = null;
        if (http.Request.RouteValues.TryGetValue("organizacionId", out var valor)
            && int.TryParse(Convert.ToString(valor, CultureInfo.InvariantCulture), NumberStyles.Integer, CultureInfo.InvariantCulture, out var deRuta))
        {
            organizacion = deRuta;
        }

        return ValueTask.FromResult(new AlcanceDeEventos(organizacion, persona));
    }
}

/// <summary>
/// El proceso que enmarca un evento de la Agenda: uno solo, de cinco tipos (LUT-01, decisión 104 de docs/referencia/20-decisiones-y-flujos-por-modulo.md).
/// </summary>
/// <remarks>
/// <b>NO ES UNA AGENDA APARTE.</b> Los procesos de lutería, redes y espacios para música en vivo se anuncian
/// como eventos de la Agenda normal: la misma fila de <c>dbo.EventosAgenda</c>, la misma regla de
/// errata, el mismo retiro y la misma cancelación. Esta clase solo sabe de qué proceso es un evento
/// y cómo pintarlo; nada más cambia.
/// </remarks>
internal static class ProcesoDelEvento
{
    public const string Festival = "festival";
    public const string Mercado = "mercado";
    public const string Taller = "taller";
    public const string Espacio = "espacio";
    public const string Red = "red";

    /// <summary>Los cinco tipos, en el orden en que se ofrecen.</summary>
    public static readonly string[] Tipos = [Festival, Mercado, Taller, Espacio, Red];

    /// <summary>El rótulo con el que se nombra el tipo ante el público y ante quien anuncia.</summary>
    public static string Etiqueta(string tipo) => tipo switch
    {
        Festival => "Festival",
        Mercado => "Mercado",
        Taller => "Taller de lutería",
        Espacio => "Espacio para música en vivo",
        Red => "Red y documentación",
        _ => tipo,
    };

    /// <summary>El proceso que enmarca la fila, o <c>null</c>.</summary>
    public static (string Tipo, int Id)? De(EventoAgendaRow evento)
    {
        if (evento.FestivalId is int festival) return (Festival, festival);
        if (evento.MercadoId is int mercado) return (Mercado, mercado);
        if (evento.TallerId is int taller) return (Taller, taller);
        if (evento.EspacioId is int espacio) return (Espacio, espacio);
        if (evento.RedId is int red) return (Red, red);
        return null;
    }

    /// <summary>El proceso que pide la solicitud (el primero con identificador positivo), o <c>null</c>.</summary>
    public static (string Tipo, int Id)? De(CrearEventoDeOrganizacionSolicitud solicitud)
    {
        if (solicitud.FestivalId is > 0) return (Festival, solicitud.FestivalId.Value);
        if (solicitud.MercadoId is > 0) return (Mercado, solicitud.MercadoId.Value);
        if (solicitud.TallerId is > 0) return (Taller, solicitud.TallerId.Value);
        if (solicitud.EspacioId is > 0) return (Espacio, solicitud.EspacioId.Value);
        if (solicitud.RedId is > 0) return (Red, solicitud.RedId.Value);
        return null;
    }

    /// <summary>Cuántos procesos pide la solicitud: la regla es exactamente uno.</summary>
    public static int Cantidad(CrearEventoDeOrganizacionSolicitud solicitud) =>
        (solicitud.FestivalId is > 0 ? 1 : 0)
        + (solicitud.MercadoId is > 0 ? 1 : 0)
        + (solicitud.TallerId is > 0 ? 1 : 0)
        + (solicitud.EspacioId is > 0 ? 1 : 0)
        + (solicitud.RedId is > 0 ? 1 : 0);

    /// <summary>El tipo del proceso, o <c>null</c> si el evento no está enmarcado en ninguno.</summary>
    public static string? TipoDe(EventoAgendaRow evento) => De(evento)?.Tipo;

    /// <summary>Deja en la fila el proceso de la solicitud y vacía los otros cuatro.</summary>
    public static void Aplicar(EventoAgendaRow evento, CrearEventoDeOrganizacionSolicitud solicitud)
    {
        var proceso = De(solicitud);
        evento.FestivalId = proceso?.Tipo == Festival ? proceso.Value.Id : null;
        evento.MercadoId = proceso?.Tipo == Mercado ? proceso.Value.Id : null;
        evento.TallerId = proceso?.Tipo == Taller ? proceso.Value.Id : null;
        evento.EspacioId = proceso?.Tipo == Espacio ? proceso.Value.Id : null;
        evento.RedId = proceso?.Tipo == Red ? proceso.Value.Id : null;
    }

    /// <summary>La clave del proceso en los diccionarios de nombres: <c>taller:12</c>.</summary>
    public static string Clave(string tipo, int id) => tipo + ":" + id.ToString(CultureInfo.InvariantCulture);

    // ---------- Lo que ve y puede tocar un alcance ---------------------------------------------

    /// <summary>
    /// Los eventos cuyo proceso es del alcance, en cualquier estado del proceso.
    /// </summary>
    /// <remarks>
    /// <b>SUS EVENTOS SON LOS DE SUS PROCESOS.</b> No hay columna de «organización» ni de «persona» en la
    /// agenda, y no hace falta: el proceso que enmarca el evento ya dice de quién es. Un evento ajeno
    /// responde como uno que no existe.
    /// </remarks>
    public static IQueryable<EventoAgendaRow> DelAlcance(SimusDbContext db, AlcanceDeEventos alcance, bool rastrear)
    {
        var eventos = rastrear ? db.EventosAgenda.AsQueryable() : db.EventosAgenda.AsNoTracking();
        var persona = alcance.Persona;

        if (alcance.OrganizacionId is int organizacion)
        {
            var festivales = db.FestivalRecords.Where(f => f.OrganizacionPrincipalId == organizacion).Select(f => f.Id);
            var mercados = db.Mercados.Where(m => m.OrganizacionPrincipalId == organizacion).Select(m => m.Id);
            var talleres = db.Talleres.Where(t => t.OrganizacionPrincipalId == organizacion).Select(t => t.Id);
            var espacios = db.Espacios.Where(x => x.OrganizacionPrincipalId == organizacion).Select(x => x.Id);
            var redes = db.Redes.Where(x => x.OrganizacionPrincipalId == organizacion).Select(x => x.Id);
            return eventos.Where(e =>
                (e.FestivalId != null && festivales.Contains(e.FestivalId.Value))
                || (e.MercadoId != null && mercados.Contains(e.MercadoId.Value))
                || (e.TallerId != null && talleres.Contains(e.TallerId.Value))
                || (e.EspacioId != null && espacios.Contains(e.EspacioId.Value))
                || (e.RedId != null && redes.Contains(e.RedId.Value)));
        }

        var misTalleres = db.Talleres.Where(t => t.OrganizacionPrincipalId == null && t.UsuarioResponsableId == persona).Select(t => t.Id);
        var misEspacios = db.Espacios.Where(x => x.OrganizacionPrincipalId == null && x.UsuarioResponsableId == persona).Select(x => x.Id);
        var misRedes = db.Redes.Where(x => x.OrganizacionPrincipalId == null && x.UsuarioResponsableId == persona).Select(x => x.Id);
        return eventos.Where(e =>
            (e.TallerId != null && misTalleres.Contains(e.TallerId.Value))
            || (e.EspacioId != null && misEspacios.Contains(e.EspacioId.Value))
            || (e.RedId != null && misRedes.Contains(e.RedId.Value)));
    }

    // ---------- Los procesos de lutería, música en vivo y redes que son del alcance ---------

    private static IQueryable<TallerRow> TalleresDe(SimusDbContext db, AlcanceDeEventos alcance)
    {
        if (alcance.OrganizacionId is int o) return db.Talleres.AsNoTracking().Where(x => x.OrganizacionPrincipalId == o);
        var persona = alcance.Persona;
        return db.Talleres.AsNoTracking().Where(x => x.OrganizacionPrincipalId == null && x.UsuarioResponsableId == persona);
    }

    private static IQueryable<EspacioRow> EspaciosDe(SimusDbContext db, AlcanceDeEventos alcance)
    {
        if (alcance.OrganizacionId is int o) return db.Espacios.AsNoTracking().Where(x => x.OrganizacionPrincipalId == o);
        var persona = alcance.Persona;
        return db.Espacios.AsNoTracking().Where(x => x.OrganizacionPrincipalId == null && x.UsuarioResponsableId == persona);
    }

    private static IQueryable<RedRow> RedesDe(SimusDbContext db, AlcanceDeEventos alcance)
    {
        if (alcance.OrganizacionId is int o) return db.Redes.AsNoTracking().Where(x => x.OrganizacionPrincipalId == o);
        var persona = alcance.Persona;
        return db.Redes.AsNoTracking().Where(x => x.OrganizacionPrincipalId == null && x.UsuarioResponsableId == persona);
    }

    /// <summary>El nombre de cada proceso del alcance (cualquier estado), por <see cref="Clave"/>.</summary>
    public static async Task<Dictionary<string, string>> NombresAsync(
        SimusDbContext db, AlcanceDeEventos alcance, CancellationToken ct)
    {
        var nombres = new Dictionary<string, string>(StringComparer.Ordinal);
        var persona = alcance.Persona;

        if (alcance.OrganizacionId is int organizacion)
        {
            foreach (var f in await db.FestivalRecords.AsNoTracking().Where(f => f.OrganizacionPrincipalId == organizacion).Select(f => new { f.Id, f.Name }).ToListAsync(ct))
                nombres[Clave(Festival, f.Id)] = f.Name;
            foreach (var m in await db.Mercados.AsNoTracking().Where(m => m.OrganizacionPrincipalId == organizacion).Select(m => new { m.Id, m.Nombre }).ToListAsync(ct))
                nombres[Clave(Mercado, m.Id)] = m.Nombre;
        }

        foreach (var t in await TalleresDe(db, alcance).Select(t => new { t.Id, t.Nombre }).ToListAsync(ct))
            nombres[Clave(Taller, t.Id)] = t.Nombre;
        foreach (var x in await EspaciosDe(db, alcance).Select(x => new { x.Id, x.Nombre }).ToListAsync(ct))
            nombres[Clave(Espacio, x.Id)] = x.Nombre;
        foreach (var x in await RedesDe(db, alcance).Select(x => new { x.Id, x.Nombre }).ToListAsync(ct))
            nombres[Clave(Red, x.Id)] = x.Nombre;

        return nombres;
    }

    /// <summary>
    /// El proceso tiene que ser del alcance y estar publicado.
    /// </summary>
    /// <remarks>
    /// LAS DOS CONDICIONES SE COMPRUEBAN EN UNA SOLA CONSULTA a propósito: separadas, un proceso
    /// ajeno y uno sin publicar darían mensajes distintos, y el primero le diría a quien pregunta
    /// que ese proceso existe.
    /// </remarks>
    public static Task<bool> PublicadoYDelAlcanceAsync(
        SimusDbContext db, AlcanceDeEventos alcance, (string Tipo, int Id)? proceso, CancellationToken ct)
    {
        if (proceso is not { } p) return Task.FromResult(false);
        var id = p.Id;
        var organizacion = alcance.OrganizacionId;

        switch (p.Tipo)
        {
            case Festival when organizacion is int o:
                return db.FestivalRecords.AsNoTracking().AnyAsync(
                    x => x.Id == id && x.OrganizacionPrincipalId == o && x.StatusCode == EstadosFestival.Publicado, ct);
            case Mercado when organizacion is int o:
                return db.Mercados.AsNoTracking().AnyAsync(
                    x => x.Id == id && x.OrganizacionPrincipalId == o && x.Activo && x.EstadoRegistro == "publicado", ct);
            case Taller:
                return TalleresDe(db, alcance).AnyAsync(
                    x => x.Id == id && x.Activo && x.EstadoRegistro == "publicado", ct);
            case Espacio:
                return EspaciosDe(db, alcance).AnyAsync(
                    x => x.Id == id && x.Activo && x.EstadoRegistro == "publicado", ct);
            case Red:
                return RedesDe(db, alcance).AnyAsync(
                    x => x.Id == id && x.Activo && x.EstadoRegistro == "publicado", ct);
            default:
                return Task.FromResult(false);
        }
    }

    /// <summary>
    /// Los procesos publicados del alcance que pueden enmarcar un evento, con su territorio.
    /// </summary>
    public static async Task<List<ProcesoQueEnmarcaDto>> PublicadosAsync(
        SimusDbContext db, AlcanceDeEventos alcance, CancellationToken ct)
    {
        var procesos = new List<(string Tipo, int Id, string Nombre, string? Departamento, string? Municipio)>();
        if (alcance.OrganizacionId is int o)
        {
            procesos.AddRange((await db.FestivalRecords.AsNoTracking()
                .Where(f => f.OrganizacionPrincipalId == o && f.StatusCode == EstadosFestival.Publicado)
                .Select(f => new { f.Id, f.Name, f.DepartmentCode, f.MunicipalityCode })
                .ToListAsync(ct)).Select(f => (Festival, f.Id, f.Name, f.DepartmentCode, f.MunicipalityCode)));
            procesos.AddRange((await db.Mercados.AsNoTracking()
                .Where(m => m.OrganizacionPrincipalId == o && m.Activo && m.EstadoRegistro == "publicado")
                .Select(m => new { m.Id, m.Nombre, m.CodigoDepartamento, m.CodigoMunicipio })
                .ToListAsync(ct)).Select(m => (Mercado, m.Id, m.Nombre, m.CodigoDepartamento, m.CodigoMunicipio)));
        }

        procesos.AddRange((await TalleresDe(db, alcance)
            .Where(x => x.Activo && x.EstadoRegistro == "publicado")
            .Select(x => new { x.Id, x.Nombre, x.CodigoDepartamento, x.CodigoMunicipio })
            .ToListAsync(ct)).Select(x => (Taller, x.Id, x.Nombre, x.CodigoDepartamento, x.CodigoMunicipio)));
        procesos.AddRange((await EspaciosDe(db, alcance)
            .Where(x => x.Activo && x.EstadoRegistro == "publicado")
            .Select(x => new { x.Id, x.Nombre, x.CodigoDepartamento, x.CodigoMunicipio })
            .ToListAsync(ct)).Select(x => (Espacio, x.Id, x.Nombre, x.CodigoDepartamento, x.CodigoMunicipio)));
        procesos.AddRange((await RedesDe(db, alcance)
            .Where(x => x.Activo && x.EstadoRegistro == "publicado")
            .Select(x => new { x.Id, x.Nombre, x.CodigoDepartamento, x.CodigoMunicipio })
            .ToListAsync(ct)).Select(x => (Red, x.Id, x.Nombre, x.CodigoDepartamento, x.CodigoMunicipio)));

        if (procesos.Count == 0) return [];

        procesos = procesos
            .OrderBy(p => Array.IndexOf(Tipos, p.Tipo))
            .ThenBy(p => p.Nombre, StringComparer.CurrentCulture)
            .ToList();

        // EL TERRITORIO DISTINGUE DOS PROCESOS DE NOMBRE PARECIDO. Una organización con el mismo
        // festival en dos municipios veía dos opciones idénticas y tenía que adivinar.
        var municipios = procesos.Select(f => f.Municipio).Where(c => c != null).ToList();
        var departamentos = procesos.Select(f => f.Departamento).Where(c => c != null).ToList();
        var territorios = await db.DivipolaLocations.AsNoTracking()
            .Where(d => municipios.Contains(d.MunicipalityCode) || departamentos.Contains(d.DepartmentCode))
            .Select(d => new { d.DepartmentCode, d.DepartmentName, d.MunicipalityCode, d.MunicipalityName })
            .ToListAsync(ct);

        return procesos.Select(p => new ProcesoQueEnmarcaDto(
            p.Id.ToString(CultureInfo.InvariantCulture),
            p.Tipo,
            Etiqueta(p.Tipo),
            p.Nombre,
            territorios.FirstOrDefault(t => t.MunicipalityCode == p.Municipio)?.MunicipalityName
                ?? territorios.FirstOrDefault(t => t.DepartmentCode == p.Departamento)?.DepartmentName,
            // LOS CÓDIGOS VIAJAN PARA QUE EL FORMULARIO PROPONGA EL TERRITORIO DEL PROCESO (D3-14).
            Limpio(p.Departamento),
            Limpio(p.Municipio))).ToList();
    }

    private static string? Limpio(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    // ---------- Quién responde por el evento ---------------------------------------------------

    /// <summary>La organización que responde por el proceso del evento, o <c>null</c> si responde una persona.</summary>
    public static async Task<int?> OrganizacionDeAsync(SimusDbContext db, EventoAgendaRow evento, CancellationToken ct)
    {
        if (evento.FestivalId is int festivalId)
        {
            return await db.FestivalRecords.AsNoTracking()
                .Where(f => f.Id == festivalId)
                .Select(f => f.OrganizacionPrincipalId)
                .FirstOrDefaultAsync(ct);
        }

        if (evento.MercadoId is int mercadoId)
        {
            return await db.Mercados.AsNoTracking()
                .Where(m => m.Id == mercadoId)
                .Select(m => (int?)m.OrganizacionPrincipalId)
                .FirstOrDefaultAsync(ct);
        }

        if (evento.TallerId is int tallerId)
        {
            return await db.Talleres.AsNoTracking()
                .Where(t => t.Id == tallerId).Select(t => t.OrganizacionPrincipalId).FirstOrDefaultAsync(ct);
        }

        if (evento.EspacioId is int espacioId)
        {
            return await db.Espacios.AsNoTracking()
                .Where(t => t.Id == espacioId).Select(t => t.OrganizacionPrincipalId).FirstOrDefaultAsync(ct);
        }

        if (evento.RedId is int redId)
        {
            return await db.Redes.AsNoTracking()
                .Where(t => t.Id == redId).Select(t => t.OrganizacionPrincipalId).FirstOrDefaultAsync(ct);
        }

        return null;
    }

    /// <summary>
    /// La persona que responde por el proceso del evento cuando no hay organización (taller, espacio o
    /// red de una persona), o <c>null</c>.
    /// </summary>
    public static async Task<int?> PersonaResponsableDeAsync(SimusDbContext db, EventoAgendaRow evento, CancellationToken ct)
    {
        if (evento.TallerId is int tallerId)
        {
            return await db.Talleres.AsNoTracking()
                .Where(t => t.Id == tallerId && t.OrganizacionPrincipalId == null).Select(t => t.UsuarioResponsableId).FirstOrDefaultAsync(ct);
        }

        if (evento.EspacioId is int espacioId)
        {
            return await db.Espacios.AsNoTracking()
                .Where(t => t.Id == espacioId && t.OrganizacionPrincipalId == null).Select(t => t.UsuarioResponsableId).FirstOrDefaultAsync(ct);
        }

        if (evento.RedId is int redId)
        {
            return await db.Redes.AsNoTracking()
                .Where(t => t.Id == redId && t.OrganizacionPrincipalId == null).Select(t => t.UsuarioResponsableId).FirstOrDefaultAsync(ct);
        }

        return null;
    }
}
