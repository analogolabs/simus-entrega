using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Endpoints;
using SIMUS.Api.Historial;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.ImportacionAsistida;

/// <summary>El dato de un taller ya normalizado, tal como se guarda en la fila del lote.</summary>
/// <remarks>
/// Lleva los identificadores ya resueltos (organización, servicios, familias) y también sus nombres: los
/// primeros son lo que se escribe; los segundos, lo que reconoce quien revisa la previsualización.
/// </remarks>
public sealed record DatosDeTaller(
    string Nombre,
    string? Descripcion,
    string Modalidad,
    bool RecibeAprendices,
    string? SaberesYTecnicas,
    string NivelCobertura,
    string? CodigoDepartamento,
    string? NombreDepartamento,
    string? CodigoMunicipio,
    string? NombreMunicipio,
    string? LugarEspecifico,
    // NULO = LA ORGANIZACION INSTITUCIONAL. Se resuelve al escribir con la que declara el contexto.
    int? OrganizacionId,
    string? NombreOrganizacion,
    IReadOnlyList<int> ServiciosIds,
    IReadOnlyList<string> NombresDeServicios,
    IReadOnlyList<int> FamiliasIds,
    IReadOnlyList<string> NombresDeFamilias,
    string? CorreoContacto,
    string? TelefonoContacto,
    string? SitioWeb,
    string? Instagram,
    string? Facebook,
    string? OtroEnlace);

/// <summary>
/// Talleres de lutería: el sexto dominio de la Importación Asistida (LUT-02, decisión 120; patrón de
/// <see cref="DominioDeMercados"/>, docs/desarrollo/30-consola-y-acceso.md §30.17 brecha B4).
/// </summary>
/// <remarks>
/// <para>
/// <b>UN TALLER IMPORTADO NACE EN BORRADOR.</b> Un taller se publica cuando alguien del Programa lo
/// revisa; cargarlo en masa publicado sería dar por revisadas todas las filas de un archivo.
/// </para>
/// <para>
/// <b>LA ORGANIZACION RESPONSABLE ES OPCIONAL Y NUNCA SE CREA.</b> Si la hoja la trae, tiene que coincidir por
/// nombre con una organización que ya existe; si no la trae, el taller queda bajo la custodia del
/// Programa (organización institucional), igual que un Mercado importado. Un lutier independiente se
/// registra con su cuenta: no se importa a una persona.
/// </para>
/// <para>
/// <b>NADA SE MODIFICA NI SE BORRA.</b> Un taller que ya existe (mismo nombre y territorio) se marca
/// «Ya existe» y no se escribe; uno que solo se parece es una advertencia. Los servicios y las familias de
/// instrumentos se leen de las listas controladas (separados por «;» o «,»): un valor que no existe
/// rechaza la fila, no se inventa. Las prácticas musicales y la foto se completan desde la ficha.
/// </para>
/// </remarks>
public sealed class DominioDeTalleres : IDominioDeImportacion
{
    private static readonly CampoDeImportacionDto[] CamposDeclarados =
    [
        new("nombre", "Nombre del taller", true),
        new("descripcion", "Descripción", false),
        new("modalidad", "Modalidad", false),
        new("recibeAprendices", "Recibe aprendices", false),
        new("saberesYTecnicas", "Saberes y técnicas", false),
        new("servicios", "Servicios", false),
        new("familias", "Familias de instrumentos", false),
        new("nivelCobertura", "Nivel de cobertura", true),
        new("departamento", "Departamento", false),
        new("municipio", "Municipio", false),
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
        Modulos.Talleres,
        "Talleres de lutería",
        "borrador",
        "Un taller importado entra en borrador, nunca publicado: un taller se publica cuando alguien del "
            + "Programa lo revisa, y cargarlo en masa publicado sería dar por revisadas todas las filas de un "
            + "archivo. Queda bajo la organización que declare la hoja o, si no declara ninguna, bajo la "
            + "custodia del PNMC.",
        Modulos.Talleres,
        "Talleres",
        CamposDeclarados);

    public async Task<PlanDeImportacion> PlanearAsync(
        IReadOnlyList<FilaDeArchivoDto> filas, string huellaArchivo, SimusDbContext db, CancellationToken ct)
    {
        var territorios = new TerritoriosDivipola(await db.DivipolaLocations.AsNoTracking().ToListAsync(ct));
        var existentes = ReglasDeProceso.Existentes((await db.Talleres.AsNoTracking()
            .Where(item => item.Activo)
            .Select(item => new { item.Id, item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct))
            .Select(item => (item.Id, item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio)));

        var servicios = await db.ServiciosDeTaller.AsNoTracking().Where(item => item.Activo)
            .Select(item => new Opcion(item.Id, item.Nombre, item.Slug)).ToListAsync(ct);
        var familias = await db.FamiliasDeInstrumentos.AsNoTracking().Where(item => item.Activo)
            .Select(item => new Opcion(item.Id, item.Nombre, item.Slug)).ToListAsync(ct);

        var contexto = new ContextoDePlan(
            territorios, existentes, servicios, familias, await ReglasDeProceso.CargarOrganizacionesAsync(db, ct));
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
        var taller = new TallerRow
        {
            Nombre = datos.Nombre,
            Descripcion = datos.Descripcion,
            Modalidad = datos.Modalidad,
            RecibeAprendices = datos.RecibeAprendices,
            SaberesYTecnicas = datos.SaberesYTecnicas,
            CorreoTaller = datos.CorreoContacto,
            TelefonoTaller = datos.TelefonoContacto,
            SitioWebTaller = datos.SitioWeb,
            InstagramTaller = datos.Instagram,
            FacebookTaller = datos.Facebook,
            OtroEnlaceTaller = datos.OtroEnlace,
            NivelCobertura = datos.NivelCobertura,
            CodigoDepartamento = datos.CodigoDepartamento,
            CodigoMunicipio = datos.CodigoMunicipio,
            LugarEspecifico = datos.LugarEspecifico,
            OrganizacionPrincipalId = datos.OrganizacionId ?? contexto.OrganizacionInstitucionalId,
            EstadoRegistro = Capacidad.EstadoAlImportar,
            Activo = true,
            IdUsuarioCreador = contexto.UsuarioId,
            FechaCreacion = contexto.Ahora,
        };
        var foto = RegistradorDeCambios.Tomar(new TallerParaElHistorial(new TallerRow(), string.Empty, string.Empty), CamposDelTaller.Todos);
        db.Talleres.Add(taller);
        await db.SaveChangesAsync(ct);

        foreach (var id in datos.ServiciosIds.Distinct())
            db.TalleresServicios.Add(new TallerServicioRow { TallerId = taller.Id, ServicioTallerId = id, FechaCreacion = contexto.Ahora });
        foreach (var id in datos.FamiliasIds.Distinct())
            db.TalleresFamiliasDeInstrumentos.Add(new TallerFamiliaInstrumentoRow { TallerId = taller.Id, FamiliaInstrumentoId = id, FechaCreacion = contexto.Ahora });
        await db.SaveChangesAsync(ct);

        // EL HISTORIAL UNICO («EDICIONES») EMPIEZA EL DIA DE LA IMPORTACION, con origen «importacion» y el
        // lote que lo cargó. La bitácora ya anota la creación contra el registro: va sin su propia línea.
        var despues = new TallerParaElHistorial(
            taller,
            string.Join(", ", datos.NombresDeServicios.OrderBy(x => x, StringComparer.Ordinal)),
            string.Join(", ", datos.NombresDeFamilias.OrderBy(x => x, StringComparer.Ordinal)));
        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(
                Modulos.Talleres, taller.Id.ToString(CultureInfo.InvariantCulture), taller.OrganizacionPrincipalId,
                contexto.UsuarioId, "Consola", OrigenDelCambio.Importacion,
                $"Registro importado desde un archivo (lote {fila.LoteImportacionId.ToString(CultureInfo.InvariantCulture)}).",
                Fecha: contexto.Ahora),
            CamposDelTaller.Todos, foto, despues, ct, conBitacora: false);
        return taller.Id;
    }

    public IReadOnlyDictionary<string, string?> ParaMostrar(string contenidoNormalizadoJson)
    {
        var datos = Leer(contenidoNormalizadoJson);
        return new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["nombre"] = datos.Nombre,
            ["descripcion"] = datos.Descripcion,
            ["modalidad"] = datos.Modalidad,
            ["recibeAprendices"] = datos.RecibeAprendices ? "Sí" : "No",
            ["saberesYTecnicas"] = datos.SaberesYTecnicas,
            ["servicios"] = datos.NombresDeServicios.Count == 0 ? null : string.Join(", ", datos.NombresDeServicios),
            ["familias"] = datos.NombresDeFamilias.Count == 0 ? null : string.Join(", ", datos.NombresDeFamilias),
            ["nivelCobertura"] = datos.NivelCobertura,
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

        var vigentes = await db.Talleres.AsNoTracking()
            .Where(item => item.Activo)
            .Select(item => new { item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct);
        var aviso = await ReglasDeProceso.QueCambioAsync(
            db,
            datos.Select(item => ReglasDeProceso.Clave(item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio)).ToList(),
            vigentes.Select(item => (item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio)),
            datos.Select(item => item.OrganizacionId).ToList(),
            "un taller coincidente", ct);
        if (aviso is not null) return aviso;

        var servicios = datos.SelectMany(item => item.ServiciosIds).Distinct().ToList();
        if (servicios.Count > 0
            && await db.ServiciosDeTaller.AsNoTracking().CountAsync(item => servicios.Contains(item.Id) && item.Activo, ct) != servicios.Count)
            return "Un servicio del vocabulario ya no está vigente. No se escribió nada; vuelve a previsualizar.";
        var familias = datos.SelectMany(item => item.FamiliasIds).Distinct().ToList();
        if (familias.Count > 0
            && await db.FamiliasDeInstrumentos.AsNoTracking().CountAsync(item => familias.Contains(item.Id) && item.Activo, ct) != familias.Count)
            return "Una familia de instrumentos del vocabulario ya no está vigente. No se escribió nada; vuelve a previsualizar.";

        return null;
    }

    // ---------- Las reglas del taller -------------------------------------------------------

    private sealed record ContextoDePlan(
        TerritoriosDivipola Territorios,
        ExistentesDelPlan Existentes,
        IReadOnlyList<Opcion> Servicios,
        IReadOnlyList<Opcion> Familias,
        OrganizacionesDelPlan Organizaciones);

    private static FilaPlaneada Planear(FilaDeArchivoDto fila, ContextoDePlan plan, HashSet<string> vistas)
    {
        var hallazgos = new Hallazgos();
        var nombre = NormalizacionDeFilas.Campo(fila, "nombre");
        var descripcion = NormalizacionDeFilas.Campo(fila, "descripcion");
        var modalidadCruda = NormalizacionDeFilas.Campo(fila, "modalidad");
        var modalidad = NormalizarModalidad(modalidadCruda);
        var aprendicesCrudo = NormalizacionDeFilas.Campo(fila, "recibeAprendices");
        var aprendices = ReglasDeProceso.NormalizarSiNo(aprendicesCrudo);
        var saberes = NormalizacionDeFilas.Campo(fila, "saberesYTecnicas");
        var nivel = ReglasDeProceso.NormalizarNivel(NormalizacionDeFilas.Campo(fila, "nivelCobertura"));
        var lugar = NormalizacionDeFilas.Campo(fila, "lugarEspecifico");

        hallazgos.Obligatorio(nombre, "nombre", "nombre_requerido", "El nombre del taller es obligatorio.");
        hallazgos.Maximo(nombre, 240, "nombre");
        hallazgos.Maximo(descripcion, 4000, "descripcion");
        hallazgos.Maximo(saberes, 2000, "saberesYTecnicas");
        hallazgos.Maximo(lugar, 300, "lugarEspecifico");

        if (modalidadCruda is not null && modalidad is null)
            hallazgos.Error("modalidad_invalida", "modalidad", "La modalidad debe ser fija, itinerante o colectiva.");
        if (aprendicesCrudo is not null && aprendices is null)
            hallazgos.Error("recibe_aprendices_invalido", "recibeAprendices", "Escribe «sí» o «no» en «Recibe aprendices».");

        var servicios = ReglasDeProceso.ResolverConError(
            hallazgos, plan.Servicios, NormalizacionDeFilas.Campo(fila, "servicios"), "servicios", "servicio_invalido", "Estos servicios", conOpciones: true);
        var familias = ReglasDeProceso.ResolverConError(
            hallazgos, plan.Familias, NormalizacionDeFilas.Campo(fila, "familias"), "familias", "familia_invalida", "Estas familias de instrumentos", conOpciones: false);

        if (nivel is null)
            hallazgos.Error("nivel_cobertura_invalido", "nivelCobertura", "La cobertura debe ser nacional, departamental o municipal.");
        var (departamento, municipio) = ReglasDeProceso.ResolverTerritorio(hallazgos, nivel, fila, plan.Territorios);
        var (organizacionId, nombreOrganizacion) = ReglasDeProceso.ResolverOrganizacion(hallazgos, fila, plan.Organizaciones, "el taller");
        var contacto = ReglasDeProceso.ValidarContacto(hallazgos, fila);

        var datos = new DatosDeTaller(
            nombre ?? string.Empty, descripcion, modalidad ?? "fijo", aprendices ?? false, saberes, nivel ?? string.Empty,
            departamento?.Codigo, departamento?.Nombre, municipio?.Codigo, municipio?.Nombre, lugar,
            organizacionId, nombreOrganizacion,
            servicios.Select(item => item.Id).ToList(), servicios.Select(item => item.Nombre).ToList(),
            familias.Select(item => item.Id).ToList(), familias.Select(item => item.Nombre).ToList(),
            contacto.Correo, contacto.Telefono, contacto.SitioWeb, contacto.Instagram, contacto.Facebook, contacto.OtroEnlace);

        var existente = ReglasDeProceso.MarcarDuplicados(
            hallazgos, plan.Existentes, vistas, nombre, nivel, datos.CodigoDepartamento, datos.CodigoMunicipio,
            "taller_existente", "un taller", "el mismo taller");

        var importable = hallazgos.SinErrores;
        var resultado = existente is not null ? "coincidencia_existente" : importable ? "crear" : "rechazar";
        return new FilaPlaneada(
            fila.NumeroFila, resultado, importable, existente,
            JsonSerializer.Serialize(datos, NucleoDeImportacion.Json), hallazgos.Lista);
    }

    private static string? NormalizarModalidad(string? valor) => NormalizacionDeFilas.Comparable(valor) switch
    {
        "" => "fijo",
        "fijo" or "taller fijo" => "fijo",
        "itinerante" or "taller itinerante" => "itinerante",
        "colectivo" or "colectiva" or "taller colectivo" => "colectivo",
        _ => null,
    };

    private static DatosDeTaller Leer(string json, long filaId = 0) =>
        JsonSerializer.Deserialize<DatosDeTaller>(json, NucleoDeImportacion.Json)
            ?? throw new InvalidOperationException($"La fila {filaId} no contiene el contrato normalizado de taller.");
}
