using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El catálogo de los procesos que pueden estar registrados de antes sin organización, y por qué
/// cada tipo lo es o no lo es (decisión 129).
/// </summary>
/// <remarks>
/// <para>
/// <b>UN PROCESO HISTÓRICO ES UN REGISTRO PREVIO CUYA ORGANIZACIÓN ES LA INSTITUCIONAL, EN LOS CINCO TIPOS
/// (decisión 131).</b> El Programa carga —por importación asistida o desde la consola— Festivales, Mercados,
/// Lutería, Espacios y Redes sin organización y los deja a nombre de la organización institucional hasta
/// que su organización real se registre: es la «custodia del Programa». «Reclamar» es pedir que ese
/// registro pase a la organización, con su historia, y el Programa decide.
/// </para>
/// <para>
/// <b>NO HACE FALTA RELAJAR <c>CK_Talleres_UnSoloResponsable</c> Y SUS HERMANAS.</b> Un histórico es «una
/// organización (la institucional) y ninguna persona», que la restricción ya admite; así se representa en
/// Festivales y Mercados y así en los demás. Un proceso de una PERSONA responsable no es un histórico: tiene
/// dueño, y pasarlo a una organización es otro trámite. Solo se ofrece lo publicado.
/// </para>
/// <para>Una sola lista, en el orden fijo de la decisión 118: Festivales, Mercados, Redes y documentación, Lutería, Espacios.</para>
/// </remarks>
public static class TiposDeProcesoHistorico
{
    public sealed record Tipo(string Modulo, string Etiqueta, string EtiquetaPlural, bool Reclamable, string? MotivoNoReclamable, string RutaPublica);

    public static readonly IReadOnlyList<Tipo> Todos =
    [
        new(Modulos.Festivales, "Festival", "Festivales", true, null, "/ecosistema/festivales"),
        new(Modulos.Mercados, "Mercado musical", "Mercados musicales", true, null, "/ecosistema/mercados-musicales"),
        new(Modulos.Redes, "Red o documentación", "Redes y documentación", true, null, "/ecosistema/redes"),
        new(Modulos.Talleres, "Taller de lutería", "Lutería", true, null, "/ecosistema/luteria"),
        new(Modulos.Espacios, "Espacio para música en vivo", "Espacios para música en vivo", true, null, "/ecosistema/espacios"),
    ];

    public static Tipo? De(string? modulo) =>
        Todos.FirstOrDefault(x => string.Equals(x.Modulo, modulo?.Trim(), StringComparison.OrdinalIgnoreCase));

    public static Tipo? ReclamableDe(string? modulo) => De(modulo) is { Reclamable: true } tipo ? tipo : null;
}

/// <summary>
/// Cuánto se parece un proceso histórico a la organización que reclama, para sugerirlo SOLO cuando
/// hay varias coincidencias independientes (decisión 129).
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ NO SE SUGIERE NADA POR DEFECTO.</b> Antes la herramienta abría con la lista del
/// departamento de la sede: decenas de procesos ajenos que la persona debía descartar uno a uno, y
/// cada uno insinuaba «quizá es tuyo». Ahora solo se sugiere cuando el servidor reúne coincidencias
/// que, juntas, rara vez son casualidad. Es un aviso para una persona, nunca una unión.
/// </para>
/// <para>
/// <b>EL PUNTAJE.</b> Suma de señales independientes; se sugiere con <see cref="Umbral"/> o más:
/// </para>
/// <list type="bullet">
/// <item><b>Nombre (una sola señal, la mayor):</b> el organizador anterior —o, si no lo hay, el proceso— se llama
/// igual que la organización (mismas palabras que distinguen, sin tildes, mayúsculas ni signos): <b>3</b>.
/// Una sigla, una errata o palabras compartidas: <b>1</b>. Un nombre hecho solo de palabras genéricas
/// («Fundación Cultural») no cuenta.</item>
/// <item><b>Territorio:</b> el mismo municipio que la sede: <b>2</b>; solo el mismo departamento: <b>1</b>.</item>
/// <item><b>Contacto:</b> el mismo correo (de la organización o de quien reclama) o la misma página web o red: <b>5</b>,
/// porque dos registros no comparten una dirección por casualidad.</item>
/// </list>
/// <para>
/// <b>UMBRAL CONSERVADOR: 5.</b> El nombre igual SOLO no basta (3), ni con el departamento (4): hace
/// falta además el mismo municipio, o un contacto en común. Un falso aviso cuesta confianza; un
/// falso negativo cuesta una búsqueda. Medido en <c>ProcesosHistoricosCoincidenciaTests</c>.
/// </para>
/// </remarks>
public static class CoincidenciaConLaOrganizacion
{
    public const int Umbral = 5;
    public const int PuntosNombreIgual = 3;
    public const int PuntosNombreParecido = 1;
    public const int PuntosMismoMunicipio = 2;
    public const int PuntosMismoDepartamento = 1;
    public const int PuntosContacto = 5;

    public sealed record Organizacion(string Nombre, string? NombreLegal, string? Departamento, string? Municipio,
        IReadOnlyList<string> Correos, string? Web, string? Instagram, string? Facebook);

    public sealed record Proceso(string Nombre, string? Organizador, string? Departamento, string? Municipio,
        string? Correo, string? Web, string? Instagram, string? Facebook);

    public sealed record Resultado(int Puntaje, string? Motivo, IReadOnlyList<string> Motivos)
    {
        public bool EsFuerte => Puntaje >= Umbral;
    }

    // Palabras que una organización lleva casi siempre: coincidir en ellas no dice nada.
    private static readonly HashSet<string> Genericas = new(StringComparer.Ordinal)
    {
        "fundacion", "corporacion", "asociacion", "casa", "cultural", "culturales", "grupo", "colectivo", "red", "centro",
        "escuela", "cultura", "musica", "musical", "organizacion", "entidad", "sociedad", "cooperativa", "de", "del", "la", "las", "los", "el", "y", "para", "en",
        "colombia", "colombiana", "colombiano", "nacional", "municipal", "departamental", "festival", "mercado", "taller", "espacio", "sas", "ong", "nit",
    };

    public static Resultado Evaluar(Organizacion organizacion, Proceso proceso)
    {
        var puntos = 0;
        var partes = new List<string>();

        // ---- Nombre: la mayor de las señales, una sola vez.
        var (puntosNombre, fraseNombre) = Nombre(organizacion, proceso);
        puntos += puntosNombre;
        if (fraseNombre is not null) partes.Add(fraseNombre);

        // ---- Territorio.
        if (!string.IsNullOrWhiteSpace(organizacion.Departamento) && !string.IsNullOrWhiteSpace(proceso.Departamento)
            && string.Equals(organizacion.Departamento.Trim(), proceso.Departamento.Trim(), StringComparison.Ordinal))
        {
            if (!string.IsNullOrWhiteSpace(organizacion.Municipio) && !string.IsNullOrWhiteSpace(proceso.Municipio)
                && string.Equals(organizacion.Municipio.Trim(), proceso.Municipio.Trim(), StringComparison.Ordinal))
            { puntos += PuntosMismoMunicipio; partes.Add("queda en el mismo municipio"); }
            else
            { puntos += PuntosMismoDepartamento; partes.Add("queda en el mismo departamento"); }
        }

        // ---- Contacto: cualquiera de las tres, una sola vez.
        var contacto = Contacto(organizacion, proceso);
        if (contacto is not null) { puntos += PuntosContacto; partes.Add(contacto); }

        var motivos = partes.Select(Capitalizar).ToList();
        return new Resultado(puntos, partes.Count == 0 ? null : Capitalizar(Unir(partes)) + ".", motivos);
    }

    private static (int, string?) Nombre(Organizacion organizacion, Proceso proceso)
    {
        var tieneOrganizador = !string.IsNullOrWhiteSpace(proceso.Organizador);
        var candidato = tieneOrganizador ? proceso.Organizador! : proceso.Nombre;
        var sujeto = tieneOrganizador ? "el organizador" : "el proceso";
        var respaldo = RespaldoDe(organizacion, proceso);
        var mejor = 0;
        var porNombreIgual = false;
        foreach (var nombre in new[] { organizacion.Nombre, organizacion.NombreLegal })
        {
            if (string.IsNullOrWhiteSpace(nombre) || !TienePalabrasPropias(nombre) || !TienePalabrasPropias(candidato)) continue;
            var puntaje = new ParecidoDeNombres.Consulta(nombre).Puntaje(candidato, respaldo);
            if (puntaje >= 3) { mejor = Math.Max(mejor, PuntosNombreIgual); porNombreIgual = true; }
            else if (puntaje >= 1) mejor = Math.Max(mejor, PuntosNombreParecido);
        }
        if (mejor == 0) return (0, null);
        return porNombreIgual
            ? (PuntosNombreIgual, tieneOrganizador ? "el organizador se llama igual" : "el proceso se llama como tu organización")
            : (PuntosNombreParecido, $"{sujeto} tiene un nombre parecido");
    }

    private static ParecidoDeNombres.RespaldoTerritorial RespaldoDe(Organizacion organizacion, Proceso proceso) =>
        ParecidoDeNombres.RespaldoDe(organizacion.Departamento, organizacion.Municipio, proceso.Departamento, proceso.Municipio);

    private static bool TienePalabrasPropias(string nombre) =>
        ParecidoDeNombres.Normalizar(nombre).Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Any(p => p.Length >= 4 && !Genericas.Contains(p));

    private static string? Contacto(Organizacion organizacion, Proceso proceso)
    {
        var correo = NormalizarCorreo(proceso.Correo);
        if (correo is not null && organizacion.Correos.Select(NormalizarCorreo).Contains(correo, StringComparer.Ordinal))
            return "comparte el correo de contacto";
        var web = NormalizarEnlace(proceso.Web);
        if (web is not null && web == NormalizarEnlace(organizacion.Web)) return "comparte la página web";
        var instagram = NormalizarEnlace(proceso.Instagram);
        if (instagram is not null && instagram == NormalizarEnlace(organizacion.Instagram)) return "comparte la cuenta de Instagram";
        var facebook = NormalizarEnlace(proceso.Facebook);
        if (facebook is not null && facebook == NormalizarEnlace(organizacion.Facebook)) return "comparte la página de Facebook";
        return null;
    }

    private static string? NormalizarCorreo(string? valor)
    {
        var texto = SIMUS.Api.Security.CorreoElectronico.Normalizar(valor);
        return texto is null || !texto.Contains('@') ? null : texto;
    }

    /// <summary>Sin esquema, sin «www.», sin parámetros ni barra final. Un enlace de solo el sitio («facebook.com») no identifica a nadie.</summary>
    internal static string? NormalizarEnlace(string? valor)
    {
        var texto = valor?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(texto)) return null;
        foreach (var esquema in new[] { "https://", "http://" }) if (texto.StartsWith(esquema, StringComparison.Ordinal)) texto = texto[esquema.Length..];
        if (texto.StartsWith("www.", StringComparison.Ordinal)) texto = texto[4..];
        var corte = texto.IndexOfAny(['?', '#']);
        if (corte >= 0) texto = texto[..corte];
        texto = texto.TrimEnd('/');
        if (!texto.Contains('.')) return null;
        var host = texto.Split('/')[0];
        var redes = new[] { "instagram.com", "facebook.com", "m.facebook.com", "linktr.ee", "wa.me" };
        return redes.Contains(host) && !texto.Contains('/') ? null : texto;
    }

    private static string Unir(List<string> partes) =>
        partes.Count == 1 ? partes[0]
        : string.Join(", ", partes.Take(partes.Count - 1)) + " y " + partes[^1];

    private static string Capitalizar(string texto) =>
        texto.Length == 0 ? texto : char.ToUpper(texto[0], CultureInfo.GetCultureInfo("es-CO")) + texto[1..];
}

public static partial class ReclamacionesAdministracionEndpoints
{
    private const int MaximoDeSugeridos = 6;

    /// <summary>
    /// Procesos históricos sin organización (los cinco tipos), para reclamarlos: <b>sin criterio de búsqueda no hay lista</b>.
    /// </summary>
    /// <remarks>
    /// Sin texto, territorio ni tipo la respuesta trae solo los SUGERIDOS: los que coinciden con la
    /// organización en lo bastante como para no ser casualidad (<see cref="CoincidenciaConLaOrganizacion"/>),
    /// cada uno con su motivo. Con algún criterio, trae lo que se busca, con la coincidencia fuerte
    /// destacada si la hay. El tipo (<c>tipo=festivales|mercados|redes|talleres|espacios</c>) es un criterio: acota a ese proceso.
    /// </remarks>
    private static async Task<IResult> BuscarProcesosHistoricos(int organizacionId, string? tipo, string? buscar,
        string? codigoDepartamento, string? codigoMunicipio, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = Persona(principal); if (persona is null) return Results.Unauthorized();
        if (!await Edita(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        var tipos = TiposDeProcesoHistorico.Todos.Select(t => new TipoDeProcesoHistoricoDto(t.Modulo, t.Etiqueta, t.EtiquetaPlural, t.Reclamable, t.MotivoNoReclamable)).ToList();
        string? moduloElegido = null;
        if (!string.IsNullOrWhiteSpace(tipo))
        {
            var elegido = TiposDeProcesoHistorico.De(tipo);
            if (elegido is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["tipo"] = ["Elige un tipo de proceso de la lista."] });
            if (!elegido.Reclamable) return Results.Ok(new ProcesosHistoricosDto(false, tipos, [], [], elegido.MotivoNoReclamable));
            moduloElegido = elegido.Modulo;
        }
        var texto = ParecidoDeNombres.Normalizar(buscar);
        var departamento = string.IsNullOrWhiteSpace(codigoDepartamento) ? null : codigoDepartamento.Trim();
        var municipio = string.IsNullOrWhiteSpace(codigoMunicipio) ? null : codigoMunicipio.Trim();
        var hayBusqueda = texto.Length > 0 || departamento is not null || municipio is not null || moduloElegido is not null;

        var institucional = await IdInstitucionalAsync(db, ct);
        if (institucional is null) return Results.Ok(new ProcesosHistoricosDto(hayBusqueda, tipos, [], [], null));

        var organizacion = await db.EntityProfiles.AsNoTracking().Where(x => x.Id == organizacionId).FirstOrDefaultAsync(ct);
        if (organizacion is null) return Results.NotFound();
        var correoDeLaPersona = await db.Users.AsNoTracking().Where(x => x.Id == persona).Select(x => x.Email).FirstOrDefaultAsync(ct);
        var perfil = new CoincidenciaConLaOrganizacion.Organizacion(organizacion.Name, organizacion.LegalName,
            organizacion.HeadquartersDepartmentCode, organizacion.HeadquartersMunicipalityCode,
            new[] { organizacion.ContactEmail, correoDeLaPersona }.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!).ToList(),
            organizacion.WebsiteUrl, organizacion.InstagramUrl, organizacion.FacebookUrl);

        var candidatos = new List<Candidato>();
        if (moduloElegido is null or Modulos.Festivales)
            candidatos.AddRange((await db.FestivalRecords.AsNoTracking()
                .Where(x => x.OrganizacionPrincipalId == institucional && x.FusionadoEnId == null && (x.StatusCode == EstadosFestival.Publicado || x.StatusCode == "Publicado"))
                .Select(x => new { x.Id, x.Name, x.OrganizerDisplayName, x.CoverageLevel, x.DepartmentCode, x.MunicipalityCode, x.Periodicidad, x.ContactEmail, x.OrganizerContactEmail, x.WebsiteUrl, x.OrganizerWebsiteUrl, x.InstagramUrl, x.FacebookUrl })
                .ToListAsync(ct))
                .Select(x => new Candidato(Modulos.Festivales, x.Id, x.Name, OrganizadorConocido(x.OrganizerDisplayName), x.CoverageLevel, x.DepartmentCode, x.MunicipalityCode, x.Periodicidad,
                    x.OrganizerContactEmail ?? x.ContactEmail, x.OrganizerWebsiteUrl ?? x.WebsiteUrl, x.InstagramUrl, x.FacebookUrl)));
        candidatos.AddRange((await HistoricosSimplesAsync(db, institucional.Value, moduloElegido, ct))
            .Select(x => new Candidato(x.Modulo, x.Id, x.Nombre, null, x.Cobertura, x.Departamento, x.Municipio, x.Periodicidad, x.Correo, x.Web, x.Instagram, x.Facebook)));

        // LA COINCIDENCIA CON LA ORGANIZACIÓN, de todos: decide qué se sugiere y qué se destaca.
        var fuertes = candidatos.ToDictionary(x => (x.Modulo, x.Id), x => CoincidenciaConLaOrganizacion.Evaluar(perfil,
            new CoincidenciaConLaOrganizacion.Proceso(x.Nombre, x.Organizador, x.Departamento, x.Municipio, x.Correo, x.Web, x.Instagram, x.Facebook)));

        List<Candidato> elegidos;
        if (!hayBusqueda)
        {
            elegidos = candidatos.Where(x => fuertes[(x.Modulo, x.Id)].EsFuerte)
                .OrderByDescending(x => fuertes[(x.Modulo, x.Id)].Puntaje).ThenBy(x => x.Nombre, StringComparer.OrdinalIgnoreCase)
                .Take(MaximoDeSugeridos).ToList();
        }
        else
        {
            var consulta = candidatos.AsEnumerable();
            if (departamento is not null) consulta = consulta.Where(x => x.Departamento == departamento);
            if (municipio is not null) consulta = consulta.Where(x => x.Municipio == municipio);
            var porTexto = consulta.ToList();
            var puntajes = new Dictionary<(string, int), int>();
            if (texto.Length > 0)
            {
                var consultaDeNombre = new ParecidoDeNombres.Consulta(buscar);
                foreach (var x in porTexto)
                {
                    var respaldo = ParecidoDeNombres.RespaldoDe(departamento, municipio, x.Departamento, x.Municipio);
                    var nombre = consultaDeNombre.Puntaje(x.Nombre, respaldo);
                    var organizador = x.Organizador is null ? 0 : consultaDeNombre.Puntaje(x.Organizador, respaldo);
                    var contiene = ParecidoDeNombres.Normalizar(x.Nombre).Contains(texto, StringComparison.Ordinal)
                        || (x.Organizador is not null && ParecidoDeNombres.Normalizar(x.Organizador).Contains(texto, StringComparison.Ordinal));
                    puntajes[(x.Modulo, x.Id)] = Math.Max(Math.Max(nombre, organizador), contiene ? 2 : 0);
                }
                porTexto = porTexto.Where(x => puntajes.GetValueOrDefault((x.Modulo, x.Id)) > 0).ToList();
            }
            elegidos = porTexto
                .OrderByDescending(x => fuertes[(x.Modulo, x.Id)].EsFuerte)
                .ThenByDescending(x => puntajes.GetValueOrDefault((x.Modulo, x.Id)))
                .ThenBy(x => x.Nombre, StringComparer.OrdinalIgnoreCase)
                .Take(MaximoDeHistoricos).ToList();
        }

        var idsFestival = elegidos.Where(x => x.Modulo == Modulos.Festivales).Select(x => x.Id).ToArray();
        var descripciones = new Dictionary<(string, int), string?>();
        foreach (var f in idsFestival.Length == 0 ? [] : await db.FestivalRecords.AsNoTracking().Where(x => idsFestival.Contains(x.Id)).Select(x => new { x.Id, x.Description }).ToListAsync(ct))
            descripciones[(Modulos.Festivales, f.Id)] = f.Description;
        var anios = new Dictionary<(string, int), List<int>>();
        foreach (var g in (idsFestival.Length == 0 ? [] : await db.EdicionesFestival.AsNoTracking().Where(x => idsFestival.Contains(x.FestivalId) && x.Anio != null).Select(x => new { x.FestivalId, Anio = x.Anio!.Value }).ToListAsync(ct)).GroupBy(x => x.FestivalId))
            anios[(Modulos.Festivales, g.Key)] = g.Select(x => x.Anio).Distinct().OrderByDescending(x => x).ToList();
        foreach (var x in elegidos.Where(x => x.Modulo != Modulos.Festivales))
        {
            var simple = await CargarSimpleAsync(db, x.Modulo, x.Id, false, ct);
            descripciones[(x.Modulo, x.Id)] = simple?.Descripcion;
            if (x.Modulo == Modulos.Mercados) anios[(x.Modulo, x.Id)] = await AniosDeEdicionesAsync(db, x.Modulo, x.Id, ct);
        }
        var textos = elegidos.Select(x => x.Id.ToString(CultureInfo.InvariantCulture)).Distinct().ToArray();
        var reclamaciones = textos.Length == 0 ? []
            : await db.AdministrationClaims.AsNoTracking()
                .Where(x => textos.Contains(x.CanonicalRecordId) && Activas.Contains(x.Status))
                .Select(x => new { x.Id, x.ModuloId, x.CanonicalRecordId, x.RequestingOrganizationId, x.Status }).ToListAsync(ct);
        var lugares = await LugaresAsync(db, elegidos.Select(x => x.Departamento), ct);

        var dtos = elegidos.Select(x =>
        {
            var id = x.Id.ToString(CultureInfo.InvariantCulture);
            var activa = reclamaciones.FirstOrDefault(r => r.ModuloId == x.Modulo && r.CanonicalRecordId == id);
            var propia = activa is not null && activa.RequestingOrganizationId == organizacionId ? activa : null;
            var (dep, mun) = Lugar(lugares, x.Departamento, x.Municipio);
            var fuerte = fuertes[(x.Modulo, x.Id)];
            var etiqueta = TiposDeProcesoHistorico.De(x.Modulo)!;
            return new ProcesoHistoricoReclamableDto(
                x.Modulo, etiqueta.Etiqueta, id, x.Nombre, descripciones.GetValueOrDefault((x.Modulo, x.Id)), x.Organizador,
                x.Cobertura ?? "municipal", x.Departamento, dep, x.Municipio, mun, x.Periodicidad,
                anios.TryGetValue((x.Modulo, x.Id), out var lista) ? lista : [],
                activa is not null && propia is null, propia?.Id.ToString(CultureInfo.InvariantCulture), propia?.Status,
                fuerte.EsFuerte, fuerte.EsFuerte ? fuerte.Puntaje : null, fuerte.EsFuerte ? fuerte.Motivo : null);
        }).ToList();

        return Results.Ok(hayBusqueda
            ? new ProcesosHistoricosDto(true, tipos, dtos, [], null)
            : new ProcesosHistoricosDto(false, tipos, [], dtos, null));
    }

    /// <summary>Las fuentes históricas escribieron «Sin organizador registrado» donde no había organizador: eso no es un nombre.</summary>
    private static string? OrganizadorConocido(string? organizador) =>
        string.IsNullOrWhiteSpace(organizador) || ParecidoDeNombres.Normalizar(organizador).StartsWith("sin organizador", StringComparison.Ordinal) ? null : organizador.Trim();

    private sealed record Candidato(string Modulo, int Id, string Nombre, string? Organizador, string? Cobertura, string? Departamento, string? Municipio,
        string? Periodicidad, string? Correo, string? Web, string? Instagram, string? Facebook);
}
