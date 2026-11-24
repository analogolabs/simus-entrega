using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.ImportacionAsistida;

/// <summary>El dato de un espacio ya normalizado, tal como se guarda en la fila del lote.</summary>
public sealed record DatosDeEspacio(
    string Nombre,
    string? Descripcion,
    string Ambiente,
    int? AforoMaximo,
    bool? EsAccesible,
    string? HorarioYProgramacion,
    string CodigoDepartamento,
    string? NombreDepartamento,
    string CodigoMunicipio,
    string? NombreMunicipio,
    string? LugarEspecifico,
    // NULO = LA ORGANIZACION INSTITUCIONAL. Se resuelve al escribir con la que declara el contexto.
    int? OrganizacionId,
    string? NombreOrganizacion,
    IReadOnlyList<int> TiposIds,
    IReadOnlyList<string> NombresDeTipos,
    IReadOnlyList<int> EquipamientoIds,
    IReadOnlyList<string> NombresDeEquipamiento,
    string? CorreoContacto,
    string? TelefonoContacto,
    string? SitioWeb,
    string? Instagram,
    string? Facebook,
    string? OtroEnlace);

/// <summary>
/// Espacios para música en vivo: el séptimo dominio de la Importación Asistida (decisión 123; mismo patrón
/// que <see cref="DominioDeTalleres"/> y <see cref="DominioDeMercados"/>, docs/desarrollo/30-consola-y-acceso.md §30.17 brecha B4).
/// </summary>
/// <remarks>
/// <para>
/// <b>UN ESPACIO IMPORTADO NACE EN BORRADOR, NO CREA ORGANIZACIONES Y NO MODIFICA NADA.</b> Las reglas
/// comunes (territorio, organización responsable, contacto, listas controladas, duplicados) son las de
/// <see cref="ReglasDeProceso"/>; aquí solo está lo propio del espacio: el ambiente, el aforo, la
/// accesibilidad, el horario, los tipos y el equipamiento. Un espacio siempre es municipal (como en el alta
/// del panel). Las prácticas musicales y la foto se completan desde la ficha.
/// </para>
/// </remarks>
public sealed class DominioDeEspacios : IDominioDeImportacion
{
    private static readonly CampoDeImportacionDto[] CamposDeclarados =
    [
        new("nombre", "Nombre del espacio", true),
        new("descripcion", "Descripción", false),
        new("ambiente", "Ambiente", false),
        new("aforoMaximo", "Aforo máximo", false),
        new("esAccesible", "Es accesible", false),
        new("horarioYProgramacion", "Horario y programación", false),
        new("tipos", "Tipos de espacio", false),
        new("equipamiento", "Equipamiento", false),
        new("departamento", "Departamento", true),
        new("municipio", "Municipio", true),
        new("lugarEspecifico", "Lugar específico", false),
        new("organizacion", "Organización responsable", false),
        new("correoContacto", "Correo de contacto", false),
        new("telefonoContacto", "Teléfono de contacto", false),
        new("sitioWeb", "Sitio web", false),
        new("instagram", "Instagram", false),
        new("facebook", "Facebook", false),
        new("otroEnlace", "Otro enlace", false),
    ];

    public CapacidadDeImportacion Capacidad { get; } = new(
        Modulos.Espacios,
        "Espacios para música en vivo",
        "borrador",
        "Un espacio importado entra en borrador, nunca publicado: se publica cuando alguien del PNMC lo "
            + "revisa. Queda bajo la organización que declare la hoja o, si no declara ninguna, bajo la custodia "
            + "del PNMC. No crea organizaciones ni modifica espacios que ya existen.",
        Modulos.Espacios,
        "Espacios",
        CamposDeclarados);

    public async Task<PlanDeImportacion> PlanearAsync(
        IReadOnlyList<FilaDeArchivoDto> filas, string huellaArchivo, SimusDbContext db, CancellationToken ct)
    {
        var territorios = new TerritoriosDivipola(await db.DivipolaLocations.AsNoTracking().ToListAsync(ct));
        var existentes = ReglasDeProceso.Existentes((await db.Espacios.AsNoTracking()
            .Where(item => item.Activo)
            .Select(item => new { item.Id, item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct))
            .Select(item => (item.Id, item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio)));
        var tipos = await db.TiposDeEspacio.AsNoTracking().Where(item => item.Activo)
            .Select(item => new Opcion(item.Id, item.Nombre, item.Slug)).ToListAsync(ct);
        var equipamiento = await db.EquipamientoDeEspacio.AsNoTracking().Where(item => item.Activo)
            .Select(item => new Opcion(item.Id, item.Nombre, item.Slug)).ToListAsync(ct);
        var contexto = new ContextoDePlan(
            territorios, existentes, tipos, equipamiento, await ReglasDeProceso.CargarOrganizacionesAsync(db, ct));

        var vistas = new HashSet<string>(StringComparer.Ordinal);
        var planeadas = filas.OrderBy(item => item.NumeroFila)
            .Select(fila => Planear(fila, contexto, vistas))
            .ToList();
        return new PlanDeImportacion(NucleoDeImportacion.HuellaDelPlan(huellaArchivo, planeadas), planeadas);
    }

    public async Task<long> AplicarAsync(
        FilaImportacionRow fila, ContextoDeAplicacion contexto, SimusDbContext db, CancellationToken ct)
    {
        var datos = Leer(fila.ContenidoNormalizadoJson, fila.Id);
        var espacio = new EspacioRow
        {
            Nombre = datos.Nombre,
            Descripcion = datos.Descripcion,
            Ambiente = datos.Ambiente,
            AforoMaximo = datos.AforoMaximo,
            EsAccesible = datos.EsAccesible,
            HorarioYProgramacion = datos.HorarioYProgramacion,
            CorreoEspacio = datos.CorreoContacto,
            TelefonoEspacio = datos.TelefonoContacto,
            SitioWebEspacio = datos.SitioWeb,
            InstagramEspacio = datos.Instagram,
            FacebookEspacio = datos.Facebook,
            OtroEnlaceEspacio = datos.OtroEnlace,
            NivelCobertura = "municipal",
            CodigoDepartamento = datos.CodigoDepartamento,
            CodigoMunicipio = datos.CodigoMunicipio,
            LugarEspecifico = datos.LugarEspecifico,
            OrganizacionPrincipalId = datos.OrganizacionId ?? contexto.OrganizacionInstitucionalId,
            EstadoRegistro = Capacidad.EstadoAlImportar,
            Activo = true,
            IdUsuarioCreador = contexto.UsuarioId,
            FechaCreacion = contexto.Ahora,
        };
        var foto = RegistradorDeCambios.Tomar(new EspacioParaElHistorial(new EspacioRow(), string.Empty, string.Empty), CamposDelEspacio.Todos);
        db.Espacios.Add(espacio);
        await db.SaveChangesAsync(ct);

        foreach (var id in datos.TiposIds.Distinct())
            db.EspaciosTipos.Add(new EspacioTipoRow { EspacioId = espacio.Id, TipoEspacioId = id, FechaCreacion = contexto.Ahora });
        foreach (var id in datos.EquipamientoIds.Distinct())
            db.EspaciosEquipamiento.Add(new EspacioEquipamientoRow { EspacioId = espacio.Id, EquipamientoEspacioId = id, FechaCreacion = contexto.Ahora });
        await db.SaveChangesAsync(ct);

        // EL HISTORIAL UNICO («EDICIONES») EMPIEZA EL DIA DE LA IMPORTACION, con origen «importacion» y el lote.
        var despues = new EspacioParaElHistorial(
            espacio,
            string.Join(", ", datos.NombresDeEquipamiento.OrderBy(x => x, StringComparer.Ordinal)),
            string.Join(", ", datos.NombresDeTipos.OrderBy(x => x, StringComparer.Ordinal)));
        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(
                Modulos.Espacios, espacio.Id.ToString(CultureInfo.InvariantCulture), espacio.OrganizacionPrincipalId,
                contexto.UsuarioId, "Consola", OrigenDelCambio.Importacion,
                $"Registro importado desde un archivo (lote {fila.LoteImportacionId.ToString(CultureInfo.InvariantCulture)}).",
                Fecha: contexto.Ahora),
            CamposDelEspacio.Todos, foto, despues, ct, conBitacora: false);
        return espacio.Id;
    }

    public IReadOnlyDictionary<string, string?> ParaMostrar(string contenidoNormalizadoJson)
    {
        var datos = Leer(contenidoNormalizadoJson);
        return new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["nombre"] = datos.Nombre,
            ["descripcion"] = datos.Descripcion,
            ["ambiente"] = datos.Ambiente,
            ["aforoMaximo"] = datos.AforoMaximo?.ToString(CultureInfo.InvariantCulture),
            ["esAccesible"] = datos.EsAccesible is null ? null : datos.EsAccesible.Value ? "Sí" : "No",
            ["horarioYProgramacion"] = datos.HorarioYProgramacion,
            ["tipos"] = datos.NombresDeTipos.Count == 0 ? null : string.Join(", ", datos.NombresDeTipos),
            ["equipamiento"] = datos.NombresDeEquipamiento.Count == 0 ? null : string.Join(", ", datos.NombresDeEquipamiento),
            ["departamento"] = datos.NombreDepartamento,
            ["municipio"] = datos.NombreMunicipio,
            ["lugarEspecifico"] = datos.LugarEspecifico,
            ["organizacion"] = datos.NombreOrganizacion,
            ["correoContacto"] = datos.CorreoContacto,
            ["telefonoContacto"] = datos.TelefonoContacto,
            ["sitioWeb"] = datos.SitioWeb,
            ["instagram"] = datos.Instagram,
            ["facebook"] = datos.Facebook,
            ["otroEnlace"] = datos.OtroEnlace,
        };
    }

    public async Task<string?> QueCambioDesdeLaPrevisualizacionAsync(
        IReadOnlyList<FilaImportacionRow> filas, SimusDbContext db, CancellationToken ct)
    {
        var datos = filas.Select(fila => Leer(fila.ContenidoNormalizadoJson, fila.Id)).ToList();
        if (datos.Count == 0) return null;

        var vigentes = await db.Espacios.AsNoTracking()
            .Where(item => item.Activo)
            .Select(item => new { item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct);
        var aviso = await ReglasDeProceso.QueCambioAsync(
            db,
            datos.Select(item => ReglasDeProceso.Clave(item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio)).ToList(),
            vigentes.Select(item => (item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio)),
            datos.Select(item => item.OrganizacionId).ToList(),
            "un espacio coincidente", ct);
        if (aviso is not null) return aviso;

        var tipos = datos.SelectMany(item => item.TiposIds).Distinct().ToList();
        if (tipos.Count > 0
            && await db.TiposDeEspacio.AsNoTracking().CountAsync(item => tipos.Contains(item.Id) && item.Activo, ct) != tipos.Count)
            return "Un tipo de espacio del vocabulario ya no está vigente. No se escribió nada; vuelve a previsualizar.";
        var equipamiento = datos.SelectMany(item => item.EquipamientoIds).Distinct().ToList();
        if (equipamiento.Count > 0
            && await db.EquipamientoDeEspacio.AsNoTracking().CountAsync(item => equipamiento.Contains(item.Id) && item.Activo, ct) != equipamiento.Count)
            return "Un elemento de equipamiento del vocabulario ya no está vigente. No se escribió nada; vuelve a previsualizar.";
        return null;
    }

    // ---------- Las reglas del espacio ------------------------------------------------------

    private sealed record ContextoDePlan(
        TerritoriosDivipola Territorios,
        ExistentesDelPlan Existentes,
        IReadOnlyList<Opcion> Tipos,
        IReadOnlyList<Opcion> Equipamiento,
        OrganizacionesDelPlan Organizaciones);

    private static FilaPlaneada Planear(FilaDeArchivoDto fila, ContextoDePlan plan, HashSet<string> vistas)
    {
        var hallazgos = new Hallazgos();
        var nombre = NormalizacionDeFilas.Campo(fila, "nombre");
        var descripcion = NormalizacionDeFilas.Campo(fila, "descripcion");
        var ambienteCrudo = NormalizacionDeFilas.Campo(fila, "ambiente");
        var ambiente = NormalizarAmbiente(ambienteCrudo);
        var aforoCrudo = NormalizacionDeFilas.Campo(fila, "aforoMaximo");
        var accesibleCrudo = NormalizacionDeFilas.Campo(fila, "esAccesible");
        var horario = NormalizacionDeFilas.Campo(fila, "horarioYProgramacion");
        var lugar = NormalizacionDeFilas.Campo(fila, "lugarEspecifico");

        hallazgos.Obligatorio(nombre, "nombre", "nombre_requerido", "El nombre del espacio es obligatorio.");
        hallazgos.Maximo(nombre, 240, "nombre");
        hallazgos.Maximo(descripcion, 4000, "descripcion");
        hallazgos.Maximo(horario, 2000, "horarioYProgramacion");
        hallazgos.Maximo(lugar, 300, "lugarEspecifico");

        if (ambienteCrudo is not null && ambiente is null)
            hallazgos.Error("ambiente_invalido", "ambiente", "El ambiente debe ser cerrado, abierto (al aire libre) o mixto.");

        int? aforo = null;
        if (aforoCrudo is not null)
        {
            if (!int.TryParse(aforoCrudo.Replace(".", string.Empty, StringComparison.Ordinal), NumberStyles.Integer, CultureInfo.InvariantCulture, out var valor)
                || valor < 1 || valor > 200000)
                hallazgos.Error("aforo_invalido", "aforoMaximo", "Escribe cuántas personas caben, entre 1 y 200.000, o deja el aforo en blanco.");
            else aforo = valor;
        }

        bool? accesible = null;
        if (accesibleCrudo is not null)
        {
            accesible = ReglasDeProceso.NormalizarSiNo(accesibleCrudo);
            if (accesible is null) hallazgos.Error("es_accesible_invalido", "esAccesible", "Escribe «sí» o «no» en «Es accesible», o déjalo en blanco.");
        }

        var tipos = ReglasDeProceso.ResolverConError(
            hallazgos, plan.Tipos, NormalizacionDeFilas.Campo(fila, "tipos"), "tipos", "tipo_invalido", "Estos tipos de espacio", conOpciones: true);
        var equipamiento = ReglasDeProceso.ResolverConError(
            hallazgos, plan.Equipamiento, NormalizacionDeFilas.Campo(fila, "equipamiento"), "equipamiento", "equipamiento_invalido", "Estos elementos de equipamiento", conOpciones: false);

        // UN ESPACIO ES SIEMPRE MUNICIPAL (como en el alta del panel): departamento y municipio son obligatorios.
        var (departamento, municipio) = ReglasDeProceso.ResolverTerritorio(hallazgos, "municipal", fila, plan.Territorios);
        var (organizacionId, nombreOrganizacion) = ReglasDeProceso.ResolverOrganizacion(hallazgos, fila, plan.Organizaciones, "el espacio");
        var contacto = ReglasDeProceso.ValidarContacto(hallazgos, fila);

        var datos = new DatosDeEspacio(
            nombre ?? string.Empty, descripcion, ambiente ?? "cerrado", aforo, accesible, horario,
            departamento?.Codigo ?? string.Empty, departamento?.Nombre, municipio?.Codigo ?? string.Empty, municipio?.Nombre, lugar,
            organizacionId, nombreOrganizacion,
            tipos.Select(item => item.Id).ToList(), tipos.Select(item => item.Nombre).ToList(),
            equipamiento.Select(item => item.Id).ToList(), equipamiento.Select(item => item.Nombre).ToList(),
            contacto.Correo, contacto.Telefono, contacto.SitioWeb, contacto.Instagram, contacto.Facebook, contacto.OtroEnlace);

        var existente = ReglasDeProceso.MarcarDuplicados(
            hallazgos, plan.Existentes, vistas, nombre, "municipal", departamento?.Codigo, municipio?.Codigo,
            "espacio_existente", "un espacio", "el mismo espacio");

        var importable = hallazgos.SinErrores;
        var resultado = existente is not null ? "coincidencia_existente" : importable ? "crear" : "rechazar";
        return new FilaPlaneada(
            fila.NumeroFila, resultado, importable, existente,
            JsonSerializer.Serialize(datos, NucleoDeImportacion.Json), hallazgos.Lista);
    }

    private static string? NormalizarAmbiente(string? valor) => NormalizacionDeFilas.Comparable(valor) switch
    {
        "" => "cerrado",
        "cerrado" or "interior" or "bajo techo" => "cerrado",
        "abierto" or "al aire libre" or "exterior" => "abierto",
        "mixto" => "mixto",
        _ => null,
    };

    private static DatosDeEspacio Leer(string json, long filaId = 0) =>
        JsonSerializer.Deserialize<DatosDeEspacio>(json, NucleoDeImportacion.Json)
            ?? throw new InvalidOperationException($"La fila {filaId} no contiene el contrato normalizado de espacio.");
}
