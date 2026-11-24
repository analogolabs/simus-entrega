using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// LA SEDE PRINCIPAL DE TODO PROCESO, EN UN SOLO LUGAR (decisión 119).
/// </summary>
/// <remarks>
/// <para>
/// Festival, Mercado, Taller, Espacio y Red llevan una sede con departamento y municipio, para
/// situarlos en el mapa, AUNQUE su cobertura sea nacional o departamental. La cobertura sigue siendo
/// un dato aparte (y sus CHECK no se tocan). Todo lo que hace falta —derivar, validar, aplicar y
/// resolver nombres— vive aquí y lo usan los cinco tipos: no hay cinco copias que se separen.
/// </para>
/// <para>
/// DATOS EXISTENTES SIN SEDE no se borran ni bloquean la lectura: quedan «pendiente de completar»
/// (<see cref="Pendiente"/>) y se les pide la sede al editarlos o enviarlos a revisión.
/// </para>
/// </remarks>
public static class SedePrincipal
{
    public const string ClaveDepartamento = "sedeCodigoDepartamento";
    public const string ClaveMunicipio = "sedeCodigoMunicipio";

    /// <summary>Lo que se escribe en el error cuando falta la sede.</summary>
    public const string MensajeDeDepartamento = "Elige el departamento de la sede principal.";
    public const string MensajeDeMunicipio = "Elige el municipio de la sede principal.";

    private static string? Limpiar(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    /// <summary>
    /// La sede que se guarda: la que llega y, si no llega ninguna, la que sale del territorio de la
    /// cobertura (municipal: departamento y municipio; departamental: solo el departamento; nacional:
    /// ninguna). Una petición anterior a la sede sigue funcionando para los procesos municipales.
    /// </summary>
    public static (string? Departamento, string? Municipio) Resolver(
        string? sedeDepartamento, string? sedeMunicipio, string? nivelCobertura, string? departamento, string? municipio)
    {
        var sedeDep = Limpiar(sedeDepartamento);
        var sedeMun = Limpiar(sedeMunicipio);
        if (sedeDep is not null || sedeMun is not null) return (sedeDep, sedeMun);

        return (nivelCobertura?.Trim().ToLowerInvariant()) switch
        {
            "municipal" => (Limpiar(departamento), Limpiar(municipio)),
            "departamental" => (Limpiar(departamento), null),
            _ => (null, null),
        };
    }

    /// <summary>Guarda la sede en la fila (ya resuelta con <see cref="Resolver"/>).</summary>
    public static void Aplicar(ISedeDeProceso fila, (string? Departamento, string? Municipio) sede)
    {
        fila.SedeCodigoDepartamento = sede.Departamento;
        fila.SedeCodigoMunicipio = sede.Municipio;
    }

    /// <summary>Guarda en la fila la sede que llega o, si no llega, la del territorio de la cobertura.</summary>
    public static void Aplicar(
        ISedeDeProceso fila, string? sedeDepartamento, string? sedeMunicipio, string? nivelCobertura,
        string? departamento, string? municipio) =>
        Aplicar(fila, Resolver(sedeDepartamento, sedeMunicipio, nivelCobertura, departamento, municipio));

    /// <summary>
    /// El FILTRO DE LA CONSOLA POR SEDE, para los cinco tipos de proceso con una sola implementación.
    /// Departamento y municipio son los de la sede (no los de la cobertura); <paramref name="pendiente"/>
    /// deja solo los que aún no tienen la sede completa. Un municipio solo se aplica con departamento:
    /// la consola no ofrece el municipio hasta elegir el departamento.
    /// </summary>
    public static IQueryable<T> FiltrarPorSede<T>(
        IQueryable<T> consulta, string? departamento, string? municipio, bool pendiente) where T : class, ISedeDeProceso
    {
        if (pendiente)
        {
            return consulta.Where(t =>
                EF.Property<string?>(t, nameof(ISedeDeProceso.SedeCodigoDepartamento)) == null
                || EF.Property<string?>(t, nameof(ISedeDeProceso.SedeCodigoDepartamento)) == ""
                || EF.Property<string?>(t, nameof(ISedeDeProceso.SedeCodigoMunicipio)) == null
                || EF.Property<string?>(t, nameof(ISedeDeProceso.SedeCodigoMunicipio)) == "");
        }
        var dep = Limpiar(departamento);
        if (dep is null) return consulta;
        consulta = consulta.Where(t => EF.Property<string?>(t, nameof(ISedeDeProceso.SedeCodigoDepartamento)) == dep);
        var mun = Limpiar(municipio);
        return mun is null
            ? consulta
            : consulta.Where(t => EF.Property<string?>(t, nameof(ISedeDeProceso.SedeCodigoMunicipio)) == mun);
    }

    /// <summary>
    /// La sede con la que cuentan las analíticas y la consulta guiada: la de la fila y, mientras esté
    /// pendiente de completar, el territorio de su cobertura (mismo respaldo que el portal).
    /// </summary>
    public static (string? Departamento, string? Municipio) ParaContar(
        string? sedeDepartamento, string? sedeMunicipio, string? nivelCobertura, string? departamento, string? municipio) =>
        Resolver(sedeDepartamento, sedeMunicipio, nivelCobertura, departamento, municipio);

    /// <summary>
    /// Cuántos procesos vivos (ni archivados ni rechazados) tienen la sede pendiente de completar, por
    /// tipo. Es lo que la consola enseña para pedir que se complete; no bloquea nada.
    /// </summary>
    public static async Task<IReadOnlyList<(string Tipo, string Etiqueta, int Total)>> ContarPendientesAsync(
        SimusDbContext db, CancellationToken ct)
    {
        var festivales = await db.FestivalRecords.AsNoTracking()
            .Where(f => f.StatusCode != "archivado" && f.StatusCode != "rechazado"
                && (f.SedeCodigoDepartamento == null || f.SedeCodigoDepartamento == "" || f.SedeCodigoMunicipio == null || f.SedeCodigoMunicipio == ""))
            .CountAsync(ct);
        var mercados = await db.Mercados.AsNoTracking()
            .Where(f => f.Activo && f.EstadoRegistro != "archivado" && f.EstadoRegistro != "rechazado"
                && (f.SedeCodigoDepartamento == null || f.SedeCodigoDepartamento == "" || f.SedeCodigoMunicipio == null || f.SedeCodigoMunicipio == ""))
            .CountAsync(ct);
        var talleres = await db.Talleres.AsNoTracking()
            .Where(f => f.Activo && f.EstadoRegistro != "archivado" && f.EstadoRegistro != "rechazado"
                && (f.SedeCodigoDepartamento == null || f.SedeCodigoDepartamento == "" || f.SedeCodigoMunicipio == null || f.SedeCodigoMunicipio == ""))
            .CountAsync(ct);
        var espacios = await db.Espacios.AsNoTracking()
            .Where(f => f.Activo && f.EstadoRegistro != "archivado" && f.EstadoRegistro != "rechazado"
                && (f.SedeCodigoDepartamento == null || f.SedeCodigoDepartamento == "" || f.SedeCodigoMunicipio == null || f.SedeCodigoMunicipio == ""))
            .CountAsync(ct);
        var redes = await db.Redes.AsNoTracking()
            .Where(f => f.Activo && f.EstadoRegistro != "archivado" && f.EstadoRegistro != "rechazado"
                && (f.SedeCodigoDepartamento == null || f.SedeCodigoDepartamento == "" || f.SedeCodigoMunicipio == null || f.SedeCodigoMunicipio == ""))
            .CountAsync(ct);
        return
        [
            ("festivales", "Festivales", festivales),
            ("mercados", "Mercados", mercados),
            ("talleres", "Talleres de lutería", talleres),
            ("espacios", "Espacios para música en vivo", espacios),
            ("redes", "Redes y centros de documentación", redes),
        ];
    }

    /// <summary>Un proceso sin sede completa está «pendiente de completar».</summary>
    public static bool Pendiente(ISedeDeProceso fila) =>
        string.IsNullOrWhiteSpace(fila.SedeCodigoDepartamento) || string.IsNullOrWhiteSpace(fila.SedeCodigoMunicipio);

    /// <summary>
    /// El VALIDADOR DIVIPOLA común (alta, edición y envío a revisión): la sede es obligatoria, el
    /// departamento y el municipio existen y el municipio pertenece al departamento.
    /// </summary>
    public static async Task<Dictionary<string, string[]>> ErroresAsync(
        SimusDbContext db, string? departamento, string? municipio, CancellationToken ct)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        departamento = Limpiar(departamento);
        municipio = Limpiar(municipio);

        if (departamento is null)
        {
            errores[ClaveDepartamento] = [MensajeDeDepartamento];
            return errores;
        }
        if (!await db.DivipolaLocations.AsNoTracking().AnyAsync(d => d.DepartmentCode == departamento, ct))
        {
            errores[ClaveDepartamento] = ["Ese departamento no existe en el catálogo oficial."];
            return errores;
        }
        if (municipio is null)
        {
            errores[ClaveMunicipio] = [MensajeDeMunicipio];
            return errores;
        }
        if (!await db.DivipolaLocations.AsNoTracking()
                .AnyAsync(d => d.DepartmentCode == departamento && d.MunicipalityCode == municipio, ct))
        {
            errores[ClaveMunicipio] = ["Ese municipio no existe en el catálogo oficial o no pertenece al departamento elegido."];
        }
        return errores;
    }

    /// <summary>Pasa los errores de <see cref="ErroresAsync"/> al diccionario de quien valida.</summary>
    public static async Task ValidarAsync(
        Dictionary<string, string[]> errores, SimusDbContext db, string? departamento, string? municipio, CancellationToken ct)
    {
        foreach (var (clave, mensajes) in await ErroresAsync(db, departamento, municipio, ct)) errores[clave] = mensajes;
    }

    /// <summary>
    /// La sede para el envío a revisión: la de la fila (debe estar completa y ser válida). El texto
    /// avisa de que es lo que falta para enviar, no de que el formulario esté mal.
    /// </summary>
    public static async Task ValidarParaRevisionAsync(
        Dictionary<string, string[]> errores, SimusDbContext db, ISedeDeProceso fila, CancellationToken ct)
    {
        foreach (var (clave, mensajes) in await ErroresAsync(db, fila.SedeCodigoDepartamento, fila.SedeCodigoMunicipio, ct))
        {
            errores[clave] = [mensajes.Length > 0 && mensajes[0].StartsWith("Elige", StringComparison.Ordinal)
                ? "Para enviarlo falta la sede principal: " + char.ToLowerInvariant(mensajes[0][0]) + mensajes[0][1..]
                : mensajes[0]];
        }
    }

    /// <summary>
    /// Los nombres oficiales de las sedes de un grupo de filas, en una sola consulta. Devuelve la
    /// función que arma el <see cref="SedeDto"/> de cada fila (nulo si está pendiente de completar).
    /// </summary>
    public static async Task<Func<ISedeDeProceso, SedeDto?>> ResolverNombresAsync(
        SimusDbContext db, IEnumerable<ISedeDeProceso> filas, CancellationToken ct)
    {
        var lista = filas.ToList();
        var codigos = lista.Where(f => !string.IsNullOrWhiteSpace(f.SedeCodigoDepartamento))
            .Select(f => f.SedeCodigoDepartamento!).Distinct().ToList();
        var territorios = codigos.Count == 0
            ? []
            : await db.DivipolaLocations.AsNoTracking().Where(d => codigos.Contains(d.DepartmentCode))
                .Select(d => new { d.DepartmentCode, d.DepartmentName, d.MunicipalityCode, d.MunicipalityName })
                .ToListAsync(ct);

        return fila =>
        {
            var departamento = Limpiar(fila.SedeCodigoDepartamento);
            if (departamento is null) return null;
            var municipio = Limpiar(fila.SedeCodigoMunicipio);
            return new SedeDto(
                departamento,
                territorios.Find(t => t.DepartmentCode == departamento)?.DepartmentName,
                municipio,
                municipio is null ? null : territorios.Find(t => t.MunicipalityCode == municipio)?.MunicipalityName);
        };
    }

    /// <summary>
    /// El territorio con el que un proceso sale en el portal (mapa, filtros y directorio): su sede y,
    /// mientras está pendiente de completar, el de su cobertura, para que no desaparezca. La cobertura
    /// se sigue diciendo en su propio campo (<c>NivelCobertura</c>).
    /// </summary>
    public static (string? CodigoDepartamento, string? NombreDepartamento, string? CodigoMunicipio, string? NombreMunicipio) ParaMostrar(
        SedeDto? sede, string? codigoDepartamento, string? nombreDepartamento, string? codigoMunicipio, string? nombreMunicipio) =>
        sede is { CodigoDepartamento: not null }
            ? (sede.CodigoDepartamento, sede.NombreDepartamento, sede.CodigoMunicipio, sede.NombreMunicipio)
            : (codigoDepartamento, nombreDepartamento, codigoMunicipio, nombreMunicipio);
}
