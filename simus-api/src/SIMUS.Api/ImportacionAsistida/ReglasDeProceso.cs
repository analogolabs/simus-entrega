using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.ImportacionAsistida;

/// <summary>Una opción de una lista controlada (servicio, familia, tipo, formato…), con lo que la identifica.</summary>
internal sealed record Opcion(int Id, string Nombre, string Slug);

/// <summary>El contacto de un proceso ya normalizado, con los mismos seis campos en todos los tipos.</summary>
internal sealed record ContactoNormalizado(
    string? Correo, string? Telefono, string? SitioWeb, string? Instagram, string? Facebook, string? OtroEnlace);

/// <summary>Las organizaciones que conoce un plan: por nombre comparable, y la institucional que custodia.</summary>
internal sealed record OrganizacionesDelPlan(
    Dictionary<string, List<(int Id, string Nombre)>> PorNombre, int? InstitucionalId, string? NombreInstitucional);

/// <summary>Los procesos vigentes de un tipo: por clave exacta (nombre y territorio) y por territorio, para los parecidos.</summary>
internal sealed record ExistentesDelPlan(
    Dictionary<string, int> PorClave, Dictionary<string, List<(int Id, string Nombre)>> PorTerritorio);

/// <summary>
/// Las reglas de importación que son del MODELO COMÚN de procesos (docs/desarrollo/30-consola-y-acceso.md §30.17) y no de un tipo:
/// territorio, organización responsable, contacto, listas controladas, duplicados y parecidos. Talleres,
/// Espacios y Redes las usan igual; cada dominio solo declara sus campos propios.
/// </summary>
internal static class ReglasDeProceso
{
    private static readonly char[] SeparadoresDeLista = [';', ','];

    /// <summary>Lee una lista controlada («a; b»): lo reconocido, y lo que no existe en el vocabulario.</summary>
    public static (List<Opcion> Reconocidas, List<string> Desconocidas) Resolver(IReadOnlyList<Opcion> vocabulario, string? crudo)
    {
        var reconocidas = new List<Opcion>();
        var desconocidas = new List<string>();
        if (string.IsNullOrWhiteSpace(crudo)) return (reconocidas, desconocidas);
        foreach (var parte in crudo.Split(SeparadoresDeLista, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var clave = NormalizacionDeFilas.Comparable(parte);
            var opcion = vocabulario.FirstOrDefault(item => NormalizacionDeFilas.Comparable(item.Nombre) == clave
                || NormalizacionDeFilas.Comparable(item.Slug) == clave);
            if (opcion is null) desconocidas.Add(parte);
            else if (reconocidas.All(item => item.Id != opcion.Id)) reconocidas.Add(opcion);
        }
        return (reconocidas, desconocidas);
    }

    /// <summary>Lee una lista controlada y rechaza la fila si algo no existe; devuelve lo reconocido.</summary>
    public static List<Opcion> ResolverConError(
        Hallazgos hallazgos, IReadOnlyList<Opcion> vocabulario, string? crudo, string campo, string codigo, string rotulo, bool conOpciones)
    {
        var (reconocidas, desconocidas) = Resolver(vocabulario, crudo);
        if (desconocidas.Count > 0)
        {
            var opciones = conOpciones ? $" Opciones: {string.Join(", ", vocabulario.Select(item => item.Nombre))}." : string.Empty;
            hallazgos.Error(codigo, campo, $"{rotulo} no están en el vocabulario: {string.Join(", ", desconocidas)}.{opciones}");
        }
        return reconocidas;
    }

    public static string? NormalizarNivel(string? valor) => NormalizacionDeFilas.Comparable(valor) switch
    {
        "nacional" => "nacional",
        "departamental" or "departamento" => "departamental",
        "municipal" or "municipio" or "local" => "municipal",
        _ => null,
    };

    public static bool? NormalizarSiNo(string? valor) => NormalizacionDeFilas.Comparable(valor) switch
    {
        "" => false,
        "si" or "s" or "true" or "1" => true,
        "no" or "n" or "false" or "0" => false,
        _ => null,
    };

    public static string TerritorioDe(string? departamento, string? municipio) =>
        $"{departamento ?? string.Empty}|{municipio ?? string.Empty}";

    public static string Clave(string? nombre, string? departamento, string? municipio) =>
        $"{NormalizacionDeFilas.Comparable(nombre)}|{departamento ?? string.Empty}|{municipio ?? string.Empty}";

    /// <summary>
    /// El territorio de la fila según el nivel. LA COHERENCIA NIVEL-TERRITORIO ES UN CHECK DE LA BASE: se
    /// comprueba al planear para que la previsualización no diga «todo bien» y el lote reviente.
    /// </summary>
    public static (Territorio? Departamento, Territorio? Municipio) ResolverTerritorio(
        Hallazgos hallazgos, string? nivel, FilaDeArchivoDto fila, TerritoriosDivipola territorios)
    {
        var municipioCrudo = NormalizacionDeFilas.Campo(fila, "municipio");
        var departamento = territorios.Departamento(NormalizacionDeFilas.Campo(fila, "departamento"));
        var municipio = territorios.Municipio(departamento?.Codigo, municipioCrudo);
        if (nivel is null) return (departamento, municipio);

        if (nivel == "nacional")
        {
            if (departamento is not null || !string.IsNullOrWhiteSpace(municipioCrudo))
                hallazgos.Info("territorio_omitido_por_cobertura", "nivelCobertura", "La cobertura nacional no conserva departamento ni municipio.");
            return (null, null);
        }
        if (nivel == "departamental")
        {
            if (departamento is null)
                hallazgos.Error("departamento_invalido", "departamento", "El departamento no coincide con DIVIPOLA.");
            if (!string.IsNullOrWhiteSpace(municipioCrudo))
                hallazgos.Info("municipio_omitido_por_cobertura", "municipio", "La cobertura departamental no conserva municipio.");
            return (departamento, null);
        }
        if (departamento is null)
            hallazgos.Error("departamento_invalido", "departamento", "El departamento no coincide con DIVIPOLA.");
        if (municipio is null)
            hallazgos.Error("municipio_invalido", "municipio", "El municipio no coincide con DIVIPOLA dentro del departamento indicado.");
        return (departamento, municipio);
    }

    public static async Task<OrganizacionesDelPlan> CargarOrganizacionesAsync(SimusDbContext db, CancellationToken ct)
    {
        var organizaciones = await db.EntityProfiles.AsNoTracking()
            .Where(item => item.EntityType == "organizacion")
            .Select(item => new { item.Id, item.Name, item.IsInstitutional })
            .ToListAsync(ct);
        return new OrganizacionesDelPlan(
            organizaciones
                .GroupBy(item => NormalizacionDeFilas.Comparable(item.Name), StringComparer.Ordinal)
                .ToDictionary(
                    grupo => grupo.Key,
                    grupo => grupo.Select(item => (Id: item.Id, Nombre: item.Name)).ToList(),
                    StringComparer.Ordinal),
            organizaciones.Where(item => item.IsInstitutional).Select(item => (int?)item.Id).FirstOrDefault(),
            organizaciones.Where(item => item.IsInstitutional).Select(item => item.Name).FirstOrDefault());
    }

    /// <summary>
    /// LA ORGANIZACION NUNCA SE CREA DESDE UN PROCESO: se busca por nombre y, si no hay una sola que
    /// coincida, la fila se rechaza para que alguien lo resuelva. Sin organización en la hoja, el proceso
    /// queda bajo la custodia del Programa.
    /// </summary>
    public static (int? Id, string? Nombre) ResolverOrganizacion(
        Hallazgos hallazgos, FilaDeArchivoDto fila, OrganizacionesDelPlan plan, string elProceso)
    {
        var cruda = NormalizacionDeFilas.Campo(fila, "organizacion");
        if (cruda is null)
        {
            if (plan.InstitucionalId is null)
            {
                hallazgos.Error("organizacion_requerida", "organizacion",
                    $"No hay una organización institucional que se haga cargo de {elProceso}; indica la organización responsable.");
            }
            return (null, plan.NombreInstitucional);
        }
        var candidatas = plan.PorNombre.GetValueOrDefault(NormalizacionDeFilas.Comparable(cruda));
        if (candidatas is null || candidatas.Count == 0)
        {
            hallazgos.Error("organizacion_desconocida", "organizacion",
                "No existe una organización con ese nombre. Regístrala primero o deja la columna vacía para que quede bajo el PNMC.");
            return (null, null);
        }
        if (candidatas.Count > 1)
        {
            hallazgos.Error("organizacion_ambigua", "organizacion",
                "Hay varias organizaciones con ese nombre; el archivo no permite saber cuál es.");
            return (null, null);
        }
        return (candidatas[0].Id, candidatas[0].Nombre);
    }

    /// <summary>EL CONTACTO CON LA MISMA REGLA QUE EL ALTA DEL PANEL (https; usuario o dirección en redes).</summary>
    public static ContactoNormalizado ValidarContacto(Hallazgos hallazgos, FilaDeArchivoDto fila)
    {
        var correoCrudo = NormalizacionDeFilas.Campo(fila, "correoContacto");
        var correo = NormalizacionDeFilas.NormalizarCorreo(correoCrudo);
        var telefonoCrudo = NormalizacionDeFilas.Campo(fila, "telefonoContacto");
        var telefono = NormalizacionDeFilas.NormalizarTelefono(telefonoCrudo);
        var sitioCrudo = NormalizacionDeFilas.Campo(fila, "sitioWeb");
        var otroCrudo = NormalizacionDeFilas.Campo(fila, "otroEnlace");
        var instagramCrudo = NormalizacionDeFilas.Campo(fila, "instagram");
        var facebookCrudo = NormalizacionDeFilas.Campo(fila, "facebook");

        hallazgos.Correo(correo, "correoContacto");
        hallazgos.Maximo(correo, 180, "correoContacto");
        if (!ValidationHelpers.IsValidPhone(telefono))
            hallazgos.Error("telefono_invalido", "telefonoContacto", ValidationHelpers.MensajeDeTelefono);
        hallazgos.Maximo(telefono, 80, "telefonoContacto");
        foreach (var (campo, valor) in new[] { ("sitioWeb", sitioCrudo), ("otroEnlace", otroCrudo) })
        {
            if (!ValidationHelpers.IsValidHttpsUrl(valor)) hallazgos.Error("url_invalida", campo, ValidationHelpers.MensajeDeUrl);
            hallazgos.Maximo(valor, 500, campo);
        }
        foreach (var (campo, valor) in new[] { ("instagram", instagramCrudo), ("facebook", facebookCrudo) })
        {
            if (!ValidationHelpers.IsValidSocialLink(valor)) hallazgos.Error("red_social_invalida", campo, ValidationHelpers.MensajeDeRedSocial);
            hallazgos.Maximo(valor, 500, campo);
        }
        if (!string.Equals(correoCrudo, correo, StringComparison.Ordinal))
            hallazgos.Info("correo_normalizado", "correoContacto", "El correo se normalizó a minúsculas y sin espacios.");
        if (!string.Equals(telefonoCrudo, telefono, StringComparison.Ordinal))
            hallazgos.Info("telefono_normalizado", "telefonoContacto", "El teléfono se normalizó sin separadores de presentación.");

        return new ContactoNormalizado(
            correo, telefono,
            ValidationHelpers.NormalizeHttpsUrl(sitioCrudo),
            ValidationHelpers.NormalizeSocialLink(instagramCrudo),
            ValidationHelpers.NormalizeSocialLink(facebookCrudo),
            ValidationHelpers.NormalizeHttpsUrl(otroCrudo));
    }

    public static ExistentesDelPlan Existentes(IEnumerable<(int Id, string Nombre, string? Departamento, string? Municipio)> registrados)
    {
        var lista = registrados.ToList();
        return new ExistentesDelPlan(
            lista
                .GroupBy(item => Clave(item.Nombre, item.Departamento, item.Municipio), StringComparer.Ordinal)
                .ToDictionary(grupo => grupo.Key, grupo => grupo.OrderBy(item => item.Id).First().Id, StringComparer.Ordinal),
            lista
                .GroupBy(item => TerritorioDe(item.Departamento, item.Municipio), StringComparer.Ordinal)
                .ToDictionary(
                    grupo => grupo.Key,
                    grupo => grupo.OrderBy(item => item.Id).Select(item => (Id: item.Id, Nombre: item.Nombre)).ToList(),
                    StringComparer.Ordinal));
    }

    /// <summary>
    /// NADA SE MODIFICA: uno que ya existe (mismo nombre y territorio) se marca y no se escribe; uno repetido en
    /// el archivo se rechaza; uno que solo se parece es una advertencia (mismo criterio que Mercados).
    /// </summary>
    public static long? MarcarDuplicados(
        Hallazgos hallazgos, ExistentesDelPlan existentes, HashSet<string> vistas,
        string? nombre, string? nivel, string? departamento, string? municipio,
        string codigoExistente, string unProceso, string elMismo)
    {
        var clavePropia = Clave(nombre, departamento, municipio);
        long? existente = null;
        if (nombre is not null && nivel is not null && existentes.PorClave.TryGetValue(clavePropia, out var encontrado))
        {
            existente = encontrado;
            hallazgos.Error(codigoExistente, "nombre",
                $"Ya existe {unProceso} con ese nombre en ese territorio, con identificador {encontrado.ToString(CultureInfo.InvariantCulture)}; esta importación no lo modifica.");
        }
        if (nombre is not null && nivel is not null && !vistas.Add(clavePropia))
            hallazgos.Error("duplicado_en_archivo", "nombre", $"Otra fila del archivo representa {elMismo} y territorio.");

        if (existente is null && nombre is not null && nivel is not null
            && existentes.PorTerritorio.TryGetValue(TerritorioDe(departamento, municipio), out var vecinos))
        {
            var respaldo = ParecidoDeNombres.RespaldoDe(departamento, municipio, departamento, municipio);
            var (id, nombreExistente, razon) = ParecidoDeNombres.Puntuar(nombre, vecinos, vecino => vecino.Nombre, _ => respaldo)
                .OrderByDescending(par => par.Puntaje)
                .ThenBy(par => par.Item.Id)
                .Select(par => (par.Item.Id, par.Item.Nombre, par.Razon))
                .FirstOrDefault();
            if (razon is not null)
            {
                hallazgos.Advertencia("posible_duplicado", "nombre",
                    $"Se parece a «{nombreExistente}» (identificador {id.ToString(CultureInfo.InvariantCulture)}): {razon} "
                    + $"Si es {elMismo}, excluye esta fila.");
            }
        }
        return existente;
    }

    /// <summary>
    /// Lo que cambió entre la previsualización y la confirmación y obliga a volver a previsualizar: un proceso
    /// coincidente nuevo y una organización que ya no existe. Devuelve el aviso, o nulo si todo sigue igual.
    /// </summary>
    public static async Task<string?> QueCambioAsync(
        SimusDbContext db, IReadOnlyCollection<string> clavesDelLote,
        IEnumerable<(string Nombre, string? Departamento, string? Municipio)> vigentes,
        IReadOnlyCollection<int?> organizacionesDelLote, string unaCoincidente, CancellationToken ct)
    {
        var claves = clavesDelLote.ToHashSet(StringComparer.Ordinal);
        if (vigentes.Any(item => claves.Contains(Clave(item.Nombre, item.Departamento, item.Municipio))))
            return $"Apareció {unaCoincidente} después de la previsualización. No se escribió nada; vuelve a previsualizar.";

        var organizaciones = organizacionesDelLote.Where(item => item is not null).Select(item => item!.Value).Distinct().ToList();
        if (organizaciones.Count > 0
            && await db.EntityProfiles.AsNoTracking().CountAsync(item => organizaciones.Contains(item.Id), ct) != organizaciones.Count)
            return "Una organización responsable ya no existe. No se escribió nada; vuelve a previsualizar.";
        return null;
    }
}
