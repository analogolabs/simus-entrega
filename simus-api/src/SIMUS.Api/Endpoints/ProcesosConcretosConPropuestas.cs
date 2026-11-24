using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

// Los tipos que admiten propuestas de cambio (PROP, decisión 122; el Festival se suma en el PR-5a del retiro de PerfilesPublicosFestival). Cada uno dice QUE se puede proponer y
// COMO se lee y se escribe; el circuito es de `PropuestasDeCambioDeProcesoEndpoints`.

/// <summary>
/// Mercado Musical. Los campos son los de <see cref="CamposProponiblesDeMercado"/>, que conserva el catálogo con sus
/// nombres de siempre (los mismos que la revisión por campos).
/// </summary>
internal sealed class MercadoConPropuestas : ProcesoDeFilaConPropuestas<MercadoRow>
{
    public override string Modulo => Modulos.Mercados;
    public override string Ruta => "mercados";
    public override string Etiqueta => "Mercado";
    public override string TablaDeAuditoria => "Mercados";
    public override string ParaElAviso => "el mercado musical";

    protected override IReadOnlyDictionary<string, Columna> Columnas { get; } = CamposProponiblesDeMercado.Todos.ToDictionary(
        c => c.Key,
        c => new Columna(
            new CampoProponible(c.Value.SeccionId, c.Value.Etiqueta, Legible(c.Key)),
            c.Value.Leer, c.Value.Escribir),
        StringComparer.Ordinal);

    private static Func<SimusDbContext, string?, CancellationToken, Task<string?>>? Legible(string campoId) => campoId switch
    {
        "alcance" => NombresDe(async (db, ids, ct) => await db.AlcancesMercado.AsNoTracking()
            .Where(a => ids.Contains(a.Id)).ToDictionaryAsync(a => a.Id, a => a.Nombre, ct)),
        "modalidad" => NombresDe(async (db, ids, ct) => await db.ModalidadesMercado.AsNoTracking()
            .Where(m => ids.Contains(m.Id)).ToDictionaryAsync(m => m.Id, m => m.Nombre, ct)),
        "festival" => NombresDe(async (db, ids, ct) => await db.FestivalRecords.AsNoTracking()
            .Where(f => ids.Contains(f.Id)).ToDictionaryAsync(f => f.Id, f => f.Name, ct)),
        CamposProponiblesDeMercado.PracticasMusicales => NombresDe(NombresDePracticas),
        CamposProponiblesDeMercado.TerritoriosSonoros => NombresDe(async (db, ids, ct) => await db.TerritoriosSonoros.AsNoTracking()
            .Where(t => ids.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Nombre, ct)),
        "codigoDepartamento" => DepartamentoLegible,
        "codigoMunicipio" => MunicipioLegible,
        _ => null,
    };

    internal static async Task<Dictionary<int, string>> NombresDePracticas(SimusDbContext db, List<int> ids, CancellationToken ct) =>
        await db.PracticasMusicales.AsNoTracking().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Nombre, ct);

    protected override Task<MercadoRow?> CargarAsync(SimusDbContext db, int id, bool conSeguimiento, CancellationToken ct) =>
        (conSeguimiento ? db.Mercados : db.Mercados.AsNoTracking()).FirstOrDefaultAsync(m => m.Id == id && m.Activo, ct);

    protected override RegistroProponible ARegistro(MercadoRow f) => new(f.Id, f.Nombre, f.EstadoRegistro, f.OrganizacionPrincipalId, null);
    protected override int? OrganizacionDe(MercadoRow f) => f.OrganizacionPrincipalId;
    protected override void ActualizadoEn(MercadoRow f, DateTime ahora) => f.FechaActualizacion = ahora;

    public override async Task<Dictionary<int, string>> NombresAsync(SimusDbContext db, List<int> ids, CancellationToken ct) =>
        await db.Mercados.AsNoTracking().Where(m => ids.Contains(m.Id)).ToDictionaryAsync(m => m.Id, m => m.Nombre, ct);

    protected override async Task<string?> LeerListaAsync(SimusDbContext db, int id, string campoId, CancellationToken ct) =>
        await CamposProponiblesDeMercado.ValorActualAsync(db, new MercadoRow { Id = id }, campoId, ct);

    protected override Task EscribirListaAsync(SimusDbContext db, int id, string campoId, string? valor, DateTime ahora, CancellationToken ct) =>
        CamposProponiblesDeMercado.AplicarListaAsync(db, new MercadoRow { Id = id }, campoId, valor, ahora, ct);

    protected override Task<FotoDeCampos> FotoAsync(SimusDbContext db, MercadoRow fila, CancellationToken ct) =>
        Task.FromResult(RegistradorDeCambios.Tomar(fila, MercadosEndpoints.CamposVigilados));

    protected override async Task RegistrarCambioAsync(
        SimusDbContext db, MercadoRow fila, FotoDeCampos antes, ContextoDeCambio contexto, CancellationToken ct) =>
        await RegistradorDeCambios.RegistrarAsync(db, contexto, MercadosEndpoints.CamposVigilados, antes, fila, ct, conBitacora: false);

    public override void Auditar(SimusDbContext db, int actor, int id, string evento, object? antes, object? despues, string? motivo) =>
        MercadosEndpoints.Auditar(db, actor, id, evento, antes, despues);
}

/// <summary>
/// Taller de lutería. Lo proponible es lo que decide <i>qué es</i> el taller: nombre, modalidad, territorio, servicios y
/// familias de instrumentos. La errata (contacto, foto, descripción, saberes) se edita directo en el taller.
/// </summary>
internal sealed class TallerConPropuestas : ProcesoDeFilaConPropuestas<TallerRow>
{
    public override string Modulo => Modulos.Talleres;
    public override string Ruta => "talleres";
    public override string Etiqueta => "Taller";
    public override string TablaDeAuditoria => "Talleres";
    public override string ParaElAviso => "el taller de lutería";

    protected override IReadOnlyDictionary<string, Columna> Columnas { get; } = new Dictionary<string, Columna>(StringComparer.Ordinal)
    {
        ["nombre"] = Texto("identificacion", "Nombre del taller", t => t.Nombre, (t, v) => t.Nombre = v ?? string.Empty),
        ["modalidad"] = Texto("identificacion", "Modalidad", t => t.Modalidad, (t, v) => t.Modalidad = (v ?? "fijo").ToLowerInvariant()),
        ["nivelCobertura"] = Texto("territorio", "Nivel de cobertura", t => t.NivelCobertura, (t, v) => t.NivelCobertura = (v ?? string.Empty).ToLowerInvariant()),
        ["codigoDepartamento"] = Texto("territorio", "Departamento", t => t.CodigoDepartamento, (t, v) => t.CodigoDepartamento = v, DepartamentoLegible),
        ["codigoMunicipio"] = Texto("territorio", "Municipio", t => t.CodigoMunicipio, (t, v) => t.CodigoMunicipio = v, MunicipioLegible),
        ["servicios"] = ListaDeCatalogo("oficio", "Servicios del taller", async (db, ids, ct) => await db.ServiciosDeTaller.AsNoTracking()
            .Where(s => ids.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.Nombre, ct)),
        ["familias"] = ListaDeCatalogo("oficio", "Familias de instrumentos", async (db, ids, ct) => await db.FamiliasDeInstrumentos.AsNoTracking()
            .Where(f => ids.Contains(f.Id)).ToDictionaryAsync(f => f.Id, f => f.Nombre, ct)),
    };

    protected override Task<TallerRow?> CargarAsync(SimusDbContext db, int id, bool conSeguimiento, CancellationToken ct) =>
        (conSeguimiento ? db.Talleres : db.Talleres.AsNoTracking()).FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);

    protected override RegistroProponible ARegistro(TallerRow f) => new(f.Id, f.Nombre, f.EstadoRegistro, f.OrganizacionPrincipalId, f.UsuarioResponsableId);
    protected override int? OrganizacionDe(TallerRow f) => f.OrganizacionPrincipalId;
    protected override void ActualizadoEn(TallerRow f, DateTime ahora) => f.FechaActualizacion = ahora;

    public override async Task<Dictionary<int, string>> NombresAsync(SimusDbContext db, List<int> ids, CancellationToken ct) =>
        await db.Talleres.AsNoTracking().Where(t => ids.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Nombre, ct);

    protected override async Task<string?> LeerListaAsync(SimusDbContext db, int id, string campoId, CancellationToken ct) => campoId switch
    {
        "servicios" => Lista(await db.TalleresServicios.AsNoTracking().Where(x => x.TallerId == id).Select(x => x.ServicioTallerId).ToListAsync(ct)),
        "familias" => Lista(await db.TalleresFamiliasDeInstrumentos.AsNoTracking().Where(x => x.TallerId == id).Select(x => x.FamiliaInstrumentoId).ToListAsync(ct)),
        _ => null,
    };

    protected override async Task EscribirListaAsync(SimusDbContext db, int id, string campoId, string? valor, DateTime ahora, CancellationToken ct)
    {
        var pedidos = Identificadores(valor);
        if (campoId == "servicios")
        {
            db.TalleresServicios.RemoveRange(await db.TalleresServicios.Where(x => x.TallerId == id).ToListAsync(ct));
            db.TalleresServicios.AddRange(pedidos.Select(p => new TallerServicioRow { TallerId = id, ServicioTallerId = p, FechaCreacion = ahora }));
        }
        else if (campoId == "familias")
        {
            db.TalleresFamiliasDeInstrumentos.RemoveRange(await db.TalleresFamiliasDeInstrumentos.Where(x => x.TallerId == id).ToListAsync(ct));
            db.TalleresFamiliasDeInstrumentos.AddRange(pedidos.Select(p => new TallerFamiliaInstrumentoRow { TallerId = id, FamiliaInstrumentoId = p, FechaCreacion = ahora }));
        }
    }

    protected override async Task<FotoDeCampos> FotoAsync(SimusDbContext db, TallerRow fila, CancellationToken ct) =>
        RegistradorDeCambios.Tomar(await TalleresEndpoints.ParaElHistorialAsync(db, fila, ct), CamposDelTaller.Todos);

    protected override async Task RegistrarCambioAsync(
        SimusDbContext db, TallerRow fila, FotoDeCampos antes, ContextoDeCambio contexto, CancellationToken ct) =>
        await RegistradorDeCambios.RegistrarAsync(
            db, contexto, CamposDelTaller.Todos, antes, await TalleresEndpoints.ParaElHistorialAsync(db, fila, ct), ct, conBitacora: false);
}

/// <summary>Espacio para música en vivo: nombre, ambiente, tipos de espacio y territorio.</summary>
internal sealed class EspacioConPropuestas : ProcesoDeFilaConPropuestas<EspacioRow>
{
    public override string Modulo => Modulos.Espacios;
    public override string Ruta => "espacios";
    public override string Etiqueta => "Espacio";
    public override string TablaDeAuditoria => "Espacios";
    public override string ParaElAviso => "el espacio para música en vivo";

    protected override IReadOnlyDictionary<string, Columna> Columnas { get; } = new Dictionary<string, Columna>(StringComparer.Ordinal)
    {
        ["nombre"] = Texto("identificacion", "Nombre del espacio", e => e.Nombre, (e, v) => e.Nombre = v ?? string.Empty),
        ["ambiente"] = Texto("identificacion", "Ambiente", e => e.Ambiente, (e, v) => e.Ambiente = (v ?? "cerrado").ToLowerInvariant()),
        ["tipos"] = ListaDeCatalogo("identificacion", "Tipos de espacio", async (db, ids, ct) => await db.TiposDeEspacio.AsNoTracking()
            .Where(t => ids.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Nombre, ct)),
        ["nivelCobertura"] = Texto("territorio", "Nivel de cobertura", e => e.NivelCobertura, (e, v) => e.NivelCobertura = (v ?? string.Empty).ToLowerInvariant()),
        ["codigoDepartamento"] = Texto("territorio", "Departamento", e => e.CodigoDepartamento, (e, v) => e.CodigoDepartamento = v, DepartamentoLegible),
        ["codigoMunicipio"] = Texto("territorio", "Municipio", e => e.CodigoMunicipio, (e, v) => e.CodigoMunicipio = v, MunicipioLegible),
        ["lugarEspecifico"] = Texto("territorio", "Dirección o lugar", e => e.LugarEspecifico, (e, v) => e.LugarEspecifico = v),
    };

    protected override Task<EspacioRow?> CargarAsync(SimusDbContext db, int id, bool conSeguimiento, CancellationToken ct) =>
        (conSeguimiento ? db.Espacios : db.Espacios.AsNoTracking()).FirstOrDefaultAsync(e => e.Id == id && e.Activo, ct);

    protected override RegistroProponible ARegistro(EspacioRow f) => new(f.Id, f.Nombre, f.EstadoRegistro, f.OrganizacionPrincipalId, f.UsuarioResponsableId);
    protected override int? OrganizacionDe(EspacioRow f) => f.OrganizacionPrincipalId;
    protected override void ActualizadoEn(EspacioRow f, DateTime ahora) => f.FechaActualizacion = ahora;

    public override async Task<Dictionary<int, string>> NombresAsync(SimusDbContext db, List<int> ids, CancellationToken ct) =>
        await db.Espacios.AsNoTracking().Where(e => ids.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => e.Nombre, ct);

    protected override async Task<string?> LeerListaAsync(SimusDbContext db, int id, string campoId, CancellationToken ct) => campoId switch
    {
        "tipos" => Lista(await db.EspaciosTipos.AsNoTracking().Where(x => x.EspacioId == id).Select(x => x.TipoEspacioId).ToListAsync(ct)),
        _ => null,
    };

    protected override async Task EscribirListaAsync(SimusDbContext db, int id, string campoId, string? valor, DateTime ahora, CancellationToken ct)
    {
        if (campoId != "tipos") return;
        db.EspaciosTipos.RemoveRange(await db.EspaciosTipos.Where(x => x.EspacioId == id).ToListAsync(ct));
        db.EspaciosTipos.AddRange(Identificadores(valor).Select(p => new EspacioTipoRow { EspacioId = id, TipoEspacioId = p, FechaCreacion = ahora }));
    }

    protected override async Task<FotoDeCampos> FotoAsync(SimusDbContext db, EspacioRow fila, CancellationToken ct) =>
        RegistradorDeCambios.Tomar(await EspaciosEndpoints.ParaElHistorialAsync(db, fila, ct), CamposDelEspacio.Todos);

    protected override async Task RegistrarCambioAsync(
        SimusDbContext db, EspacioRow fila, FotoDeCampos antes, ContextoDeCambio contexto, CancellationToken ct) =>
        await RegistradorDeCambios.RegistrarAsync(
            db, contexto, CamposDelEspacio.Todos, antes, await EspaciosEndpoints.ParaElHistorialAsync(db, fila, ct), ct, conBitacora: false);
}

/// <summary>Red o centro de documentación: nombre, tipo de nodo, formas de acceso, formatos y territorio.</summary>
internal sealed class RedConPropuestas : ProcesoDeFilaConPropuestas<RedRow>
{
    public override string Modulo => Modulos.Redes;
    public override string Ruta => "redes";
    public override string Etiqueta => "Red";
    public override string TablaDeAuditoria => "Redes";
    public override string ParaElAviso => "la red";
    public override bool Femenino => true;

    protected override IReadOnlyDictionary<string, Columna> Columnas { get; } = new Dictionary<string, Columna>(StringComparer.Ordinal)
    {
        ["nombre"] = Texto("identificacion", "Nombre de la red", r => r.Nombre, (r, v) => r.Nombre = v ?? string.Empty),
        ["tipoDeNodo"] = Texto("identificacion", "Tipo de nodo", r => r.TipoDeNodo, (r, v) => r.TipoDeNodo = (v ?? "red").ToLowerInvariant()),
        ["formasDeAcceso"] = ListaDeCatalogo("acceso", "Formas de acceso", async (db, ids, ct) => await db.FormasDeAccesoDeRed.AsNoTracking()
            .Where(f => ids.Contains(f.Id)).ToDictionaryAsync(f => f.Id, f => f.Nombre, ct)),
        ["formatos"] = ListaDeCatalogo("acceso", "Formatos de documentación", async (db, ids, ct) => await db.FormatosDeDocumentacion.AsNoTracking()
            .Where(f => ids.Contains(f.Id)).ToDictionaryAsync(f => f.Id, f => f.Nombre, ct)),
        ["nivelCobertura"] = Texto("territorio", "Nivel de cobertura", r => r.NivelCobertura, (r, v) => r.NivelCobertura = (v ?? string.Empty).ToLowerInvariant()),
        ["codigoDepartamento"] = Texto("territorio", "Departamento", r => r.CodigoDepartamento, (r, v) => r.CodigoDepartamento = v, DepartamentoLegible),
        ["codigoMunicipio"] = Texto("territorio", "Municipio", r => r.CodigoMunicipio, (r, v) => r.CodigoMunicipio = v, MunicipioLegible),
    };

    protected override Task<RedRow?> CargarAsync(SimusDbContext db, int id, bool conSeguimiento, CancellationToken ct) =>
        (conSeguimiento ? db.Redes : db.Redes.AsNoTracking()).FirstOrDefaultAsync(r => r.Id == id && r.Activo, ct);

    protected override RegistroProponible ARegistro(RedRow f) => new(f.Id, f.Nombre, f.EstadoRegistro, f.OrganizacionPrincipalId, f.UsuarioResponsableId);
    protected override int? OrganizacionDe(RedRow f) => f.OrganizacionPrincipalId;
    protected override void ActualizadoEn(RedRow f, DateTime ahora) => f.FechaActualizacion = ahora;

    public override async Task<Dictionary<int, string>> NombresAsync(SimusDbContext db, List<int> ids, CancellationToken ct) =>
        await db.Redes.AsNoTracking().Where(r => ids.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Nombre, ct);

    protected override async Task<string?> LeerListaAsync(SimusDbContext db, int id, string campoId, CancellationToken ct) => campoId switch
    {
        "formasDeAcceso" => Lista(await db.RedesFormasDeAcceso.AsNoTracking().Where(x => x.RedId == id).Select(x => x.FormaDeAccesoId).ToListAsync(ct)),
        "formatos" => Lista(await db.RedesFormatos.AsNoTracking().Where(x => x.RedId == id).Select(x => x.FormatoId).ToListAsync(ct)),
        _ => null,
    };

    protected override async Task EscribirListaAsync(SimusDbContext db, int id, string campoId, string? valor, DateTime ahora, CancellationToken ct)
    {
        var pedidos = Identificadores(valor);
        if (campoId == "formasDeAcceso")
        {
            db.RedesFormasDeAcceso.RemoveRange(await db.RedesFormasDeAcceso.Where(x => x.RedId == id).ToListAsync(ct));
            db.RedesFormasDeAcceso.AddRange(pedidos.Select(p => new RedFormaDeAccesoRow { RedId = id, FormaDeAccesoId = p, FechaCreacion = ahora }));
        }
        else if (campoId == "formatos")
        {
            db.RedesFormatos.RemoveRange(await db.RedesFormatos.Where(x => x.RedId == id).ToListAsync(ct));
            db.RedesFormatos.AddRange(pedidos.Select(p => new RedFormatoRow { RedId = id, FormatoId = p, FechaCreacion = ahora }));
        }
    }

    protected override async Task<FotoDeCampos> FotoAsync(SimusDbContext db, RedRow fila, CancellationToken ct) =>
        RegistradorDeCambios.Tomar(await RedesEndpoints.ParaElHistorialAsync(db, fila, ct), CamposDeLaRed.Todos);

    protected override async Task RegistrarCambioAsync(
        SimusDbContext db, RedRow fila, FotoDeCampos antes, ContextoDeCambio contexto, CancellationToken ct) =>
        await RegistradorDeCambios.RegistrarAsync(
            db, contexto, CamposDeLaRed.Todos, antes, await RedesEndpoints.ParaElHistorialAsync(db, fila, ct), ct, conBitacora: false);
}

/// <summary>
/// Festival. Lo publicado es su CABECERA (<c>dbo.Festivales</c>) y sus listas de catálogo, como en los demás procesos: una
/// propuesta aprobada escribe ahí y deja la historia campo por campo; ya no crea una versión del perfil.
/// </summary>
/// <remarks>
/// <para>
/// <b>SON EXACTAMENTE LOS MISMOS DIECISÉIS CAMPOS Y DOS LISTAS</b> que tenía <c>CamposProponiblesDeFestival</c> (retirada en este
/// mismo PR), con los mismos identificadores y rótulos: las propuestas ya guardadas y las notas de revisión siguen
/// hablando del mismo campo. Ampliar lo que se puede proponer es una decisión de producto, no un efecto de cambiar dónde se guarda.
/// </para>
/// <para>
/// <b>NO ESTÁ EN <see cref="PropuestasDeCambioDeProcesoEndpoints.Procesos"/>, QUE ES LO QUE SE MAPEA A RUTAS.</b> Las rutas del Festival
/// (<c>externo/festivales/{id}/propuesta-cambio</c>, <c>institucional/propuestas-cambio-festival/*</c>) se conservan con su contrato
/// —el formulario manda el perfil entero y el servidor calcula las diferencias—; lo que se comparte con el circuito común
/// es esta clase: la lista cerrada de campos, cómo se lee y se escribe cada uno y cómo se deja la historia
/// (<see cref="ProcesoDeFilaConPropuestas{TRow}.AplicarAsync"/>).
/// </para>
/// </remarks>
internal sealed class FestivalConPropuestas : ProcesoDeFilaConPropuestas<FestivalRow>
{
    internal const string PracticasMusicales = "practicasMusicales";
    internal const string TerritoriosSonoros = "territoriosSonoros";

    /// <summary>La única instancia: no guarda estado.</summary>
    internal static readonly FestivalConPropuestas Instancia = new();

    public override string Modulo => Modulos.Festivales;
    public override string Ruta => "festivales";
    public override string Etiqueta => "Festival";
    public override string TablaDeAuditoria => "Festivales";
    public override string ParaElAviso => "el Festival";

    private static readonly Dictionary<string, Columna> ColumnasDelFestival = new Dictionary<string, Columna>(StringComparer.Ordinal)
    {
        ["nombre"] = Texto("generales", "Nombre del festival", f => f.Name, (f, v) => f.Name = v ?? string.Empty),
        ["descripcion"] = Texto("generales", "Descripción", f => f.Description, (f, v) => f.Description = v),
        ["periodicidad"] = Texto("generales", "Periodicidad", f => f.Periodicidad, (f, v) => f.Periodicidad = v),
        ["periodicidadDetalle"] = Texto("generales", "Detalle de la periodicidad", f => f.PeriodicidadDetalle, (f, v) => f.PeriodicidadDetalle = v),
        ["nivelCobertura"] = Texto("territorio", "Alcance territorial", f => f.CoverageLevel, (f, v) => f.CoverageLevel = v ?? string.Empty),
        ["codigoDepartamento"] = Texto("territorio", "Departamento", f => f.DepartmentCode, (f, v) => f.DepartmentCode = v, DepartamentoLegible),
        ["codigoMunicipio"] = Texto("territorio", "Municipio", f => f.MunicipalityCode, (f, v) => f.MunicipalityCode = v, MunicipioLegible),
        ["correoContacto"] = Texto("contacto", "Correo de contacto", f => f.ContactEmail, (f, v) => f.ContactEmail = v),
        ["telefonoContacto"] = Texto("contacto", "Teléfono de contacto", f => f.ContactPhone, (f, v) => f.ContactPhone = v),
        ["instagram"] = Texto("contacto", "Instagram", f => f.InstagramUrl, (f, v) => f.InstagramUrl = v),
        ["facebook"] = Texto("contacto", "Facebook", f => f.FacebookUrl, (f, v) => f.FacebookUrl = v),
        ["sitioWeb"] = Texto("contacto", "Sitio web", f => f.WebsiteUrl, (f, v) => f.WebsiteUrl = v),
        ["otroEnlace"] = Texto("contacto", "Otro enlace", f => f.OtherUrl, (f, v) => f.OtherUrl = v),
        ["observacionesContacto"] = Texto("contacto", "Observaciones de contacto", f => f.ObservacionesContacto, (f, v) => f.ObservacionesContacto = v),
        ["director"] = Texto("organizador", "Director o directora", f => f.Director, (f, v) => f.Director = v),
        ["tipoOrganizadorId"] = Texto("organizador", "Tipo de organización", f => Numero(f.TipoOrganizadorId), (f, v) => f.TipoOrganizadorId = Entero(v),
            NombresDe(async (db, ids, ct) => await db.TiposOrganizador.AsNoTracking()
                .Where(t => ids.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Nombre, ct))),
        [PracticasMusicales] = ListaDeCatalogo("practicas", "Prácticas musicales", MercadoConPropuestas.NombresDePracticas),
        [TerritoriosSonoros] = ListaDeCatalogo("practicas", "Territorios sonoros", async (db, ids, ct) => await db.TerritoriosSonoros.AsNoTracking()
            .Where(t => ids.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Nombre, ct)),
    };

    protected override IReadOnlyDictionary<string, Columna> Columnas => ColumnasDelFestival;

    /// <summary>El valor de una columna de la cabecera como texto comparable; <c>null</c> en las listas y en lo desconocido.</summary>
    internal static string? LeerColumna(FestivalRow festival, string campoId) =>
        ColumnasDelFestival.TryGetValue(campoId, out var columna) && columna.Escribir is not null ? columna.Leer(festival) : null;

    /// <summary>Si el campo es una columna de la cabecera (no una de las dos listas) y está en la lista cerrada.</summary>
    internal static bool EsColumna(string campoId) =>
        ColumnasDelFestival.TryGetValue(campoId, out var columna) && columna.Escribir is not null;

    protected override Task<FestivalRow?> CargarAsync(SimusDbContext db, int id, bool conSeguimiento, CancellationToken ct) =>
        (conSeguimiento ? db.FestivalRecords : db.FestivalRecords.AsNoTracking()).FirstOrDefaultAsync(f => f.Id == id, ct);

    protected override RegistroProponible ARegistro(FestivalRow f) =>
        new(f.Id, f.Name, EstadosFestival.HaciaContrato(f.StatusCode) ?? f.StatusCode, f.OrganizacionPrincipalId, null);

    protected override int? OrganizacionDe(FestivalRow f) => f.OrganizacionPrincipalId;
    protected override void ActualizadoEn(FestivalRow f, DateTime ahora) => f.UpdatedAt = ahora;

    public override async Task<Dictionary<int, string>> NombresAsync(SimusDbContext db, List<int> ids, CancellationToken ct) =>
        await db.FestivalRecords.AsNoTracking().Where(f => ids.Contains(f.Id)).ToDictionaryAsync(f => f.Id, f => f.Name, ct);

    protected override async Task<string?> LeerListaAsync(SimusDbContext db, int id, string campoId, CancellationToken ct) => campoId switch
    {
        PracticasMusicales => Lista(await db.ValoresAsync<PracticaMusicalDeRegistroRow>(Modulos.Festivales, id, ct)),
        TerritoriosSonoros => Lista(await db.ValoresAsync<TerritorioSonoroDeRegistroRow>(Modulos.Festivales, id, ct)),
        _ => null,
    };

    protected override async Task EscribirListaAsync(SimusDbContext db, int id, string campoId, string? valor, DateTime ahora, CancellationToken ct)
    {
        // SE ESCRIBE LA LISTA ENTERA, no se añade: una propuesta sobre las prácticas dice cuáles quedan.
        var pedidos = Identificadores(valor);
        if (campoId == PracticasMusicales)
            await db.FijarAsync<PracticaMusicalDeRegistroRow>(Modulos.Festivales, id, pedidos, ahora, ct);
        else if (campoId == TerritoriosSonoros)
            await db.FijarAsync<TerritorioSonoroDeRegistroRow>(Modulos.Festivales, id, pedidos, ahora, ct);
    }

    protected override Task<FotoDeCampos> FotoAsync(SimusDbContext db, FestivalRow fila, CancellationToken ct) =>
        Task.FromResult(RegistradorDeCambios.Tomar(fila, CamposDelFestival.DelFestival));

    protected override async Task RegistrarCambioAsync(
        SimusDbContext db, FestivalRow fila, FotoDeCampos antes, ContextoDeCambio contexto, CancellationToken ct) =>
        await RegistradorDeCambios.RegistrarAsync(db, contexto, CamposDelFestival.DelFestival, antes, fila, ct, conBitacora: false);

    protected override async Task<object?> TomarListasAsync(SimusDbContext db, int id, CancellationToken ct) =>
        await ListasDeLaEdicion.TomarAsync(db, Modulos.Festivales, id, ct);

    protected override async Task RegistrarListasAsync(
        SimusDbContext db, int id, object? antes, ContextoDeCambio contexto, CancellationToken ct)
    {
        if (antes is not ListasDeLaEdicion.FotoDeListas foto) return;
        // Las listas ya están guardadas (el circuito común guardó antes de registrar): se comparan contra la foto.
        var practicas = await db.ValoresAsync<PracticaMusicalDeRegistroRow>(Modulos.Festivales, id, ct);
        var territorios = await db.ValoresAsync<TerritorioSonoroDeRegistroRow>(Modulos.Festivales, id, ct);
        await ListasDeLaEdicion.RegistrarAsync(
            db, contexto, foto, new ListasDeLaEdicion.Marcado(practicas, territorios, null, null, null), ct, conBitacora: false);
    }
}
