using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.ImportacionAsistida;

/// <summary>El dato de una red ya normalizado, tal como se guarda en la fila del lote.</summary>
public sealed record DatosDeRed(
    string Nombre,
    string? Descripcion,
    string TipoDeNodo,
    bool AccesoAbierto,
    string? AcervosYColecciones,
    string NivelCobertura,
    string? CodigoDepartamento,
    string? NombreDepartamento,
    string? CodigoMunicipio,
    string? NombreMunicipio,
    string? LugarEspecifico,
    // NULO = LA ORGANIZACION INSTITUCIONAL. Se resuelve al escribir con la que declara el contexto.
    int? OrganizacionId,
    string? NombreOrganizacion,
    IReadOnlyList<int> FormasDeAccesoIds,
    IReadOnlyList<string> NombresDeFormasDeAcceso,
    IReadOnlyList<int> FormatosIds,
    IReadOnlyList<string> NombresDeFormatos,
    string? CorreoContacto,
    string? TelefonoContacto,
    string? SitioWeb,
    string? Instagram,
    string? Facebook,
    string? OtroEnlace);

/// <summary>
/// Redes y documentación: el octavo dominio de la Importación Asistida (decisión 123; mismo patrón que
/// <see cref="DominioDeTalleres"/> y <see cref="DominioDeEspacios"/>, docs/desarrollo/30-consola-y-acceso.md §30.17 brecha B4).
/// </summary>
/// <remarks>
/// <b>UNA RED IMPORTADA NACE EN BORRADOR, NO CREA ORGANIZACIONES Y NO MODIFICA NADA.</b> Las reglas comunes
/// son las de <see cref="ReglasDeProceso"/>; aquí solo está lo propio de la red: el tipo de nodo, el acceso
/// abierto, los acervos, las formas de acceso y los formatos de documentación. Las prácticas musicales y la
/// foto se completan desde la ficha.
/// </remarks>
public sealed class DominioDeRedes : IDominioDeImportacion
{
    private static readonly CampoDeImportacionDto[] CamposDeclarados =
    [
        new("nombre", "Nombre de la red", true),
        new("descripcion", "Descripción", false),
        new("tipoDeNodo", "Tipo de nodo", false),
        new("accesoAbierto", "Acceso abierto", false),
        new("acervosYColecciones", "Acervos y colecciones", false),
        new("formasDeAcceso", "Formas de acceso", false),
        new("formatos", "Formatos de documentación", false),
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
        Modulos.Redes,
        "Redes y documentación",
        "borrador",
        "Una red importada entra en borrador, nunca publicada: se publica cuando alguien del PNMC la "
            + "revisa. Queda bajo la organización que declare la hoja o, si no declara ninguna, bajo la custodia "
            + "del PNMC. No crea organizaciones ni modifica redes que ya existen.",
        Modulos.Redes,
        "Redes",
        CamposDeclarados);

    public async Task<PlanDeImportacion> PlanearAsync(
        IReadOnlyList<FilaDeArchivoDto> filas, string huellaArchivo, SimusDbContext db, CancellationToken ct)
    {
        var territorios = new TerritoriosDivipola(await db.DivipolaLocations.AsNoTracking().ToListAsync(ct));
        var existentes = ReglasDeProceso.Existentes((await db.Redes.AsNoTracking()
            .Where(item => item.Activo)
            .Select(item => new { item.Id, item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct))
            .Select(item => (item.Id, item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio)));
        var formas = await db.FormasDeAccesoDeRed.AsNoTracking().Where(item => item.Activo)
            .Select(item => new Opcion(item.Id, item.Nombre, item.Slug)).ToListAsync(ct);
        var formatos = await db.FormatosDeDocumentacion.AsNoTracking().Where(item => item.Activo)
            .Select(item => new Opcion(item.Id, item.Nombre, item.Slug)).ToListAsync(ct);
        var contexto = new ContextoDePlan(
            territorios, existentes, formas, formatos, await ReglasDeProceso.CargarOrganizacionesAsync(db, ct));

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
        var red = new RedRow
        {
            Nombre = datos.Nombre,
            Descripcion = datos.Descripcion,
            TipoDeNodo = datos.TipoDeNodo,
            AccesoAbierto = datos.AccesoAbierto,
            AcervosYColecciones = datos.AcervosYColecciones,
            CorreoRed = datos.CorreoContacto,
            TelefonoRed = datos.TelefonoContacto,
            SitioWebRed = datos.SitioWeb,
            InstagramRed = datos.Instagram,
            FacebookRed = datos.Facebook,
            OtroEnlaceRed = datos.OtroEnlace,
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
        var foto = RegistradorDeCambios.Tomar(new RedParaElHistorial(new RedRow(), string.Empty, string.Empty), CamposDeLaRed.Todos);
        db.Redes.Add(red);
        await db.SaveChangesAsync(ct);

        foreach (var id in datos.FormasDeAccesoIds.Distinct())
            db.RedesFormasDeAcceso.Add(new RedFormaDeAccesoRow { RedId = red.Id, FormaDeAccesoId = id, FechaCreacion = contexto.Ahora });
        foreach (var id in datos.FormatosIds.Distinct())
            db.RedesFormatos.Add(new RedFormatoRow { RedId = red.Id, FormatoId = id, FechaCreacion = contexto.Ahora });
        await db.SaveChangesAsync(ct);

        // EL HISTORIAL UNICO («EDICIONES») EMPIEZA EL DIA DE LA IMPORTACION, con origen «importacion» y el lote.
        var despues = new RedParaElHistorial(
            red,
            string.Join(", ", datos.NombresDeFormasDeAcceso.OrderBy(x => x, StringComparer.Ordinal)),
            string.Join(", ", datos.NombresDeFormatos.OrderBy(x => x, StringComparer.Ordinal)));
        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(
                Modulos.Redes, red.Id.ToString(CultureInfo.InvariantCulture), red.OrganizacionPrincipalId,
                contexto.UsuarioId, "Consola", OrigenDelCambio.Importacion,
                $"Registro importado desde un archivo (lote {fila.LoteImportacionId.ToString(CultureInfo.InvariantCulture)}).",
                Fecha: contexto.Ahora),
            CamposDeLaRed.Todos, foto, despues, ct, conBitacora: false);
        return red.Id;
    }

    public IReadOnlyDictionary<string, string?> ParaMostrar(string contenidoNormalizadoJson)
    {
        var datos = Leer(contenidoNormalizadoJson);
        return new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["nombre"] = datos.Nombre,
            ["descripcion"] = datos.Descripcion,
            ["tipoDeNodo"] = datos.TipoDeNodo,
            ["accesoAbierto"] = datos.AccesoAbierto ? "Sí" : "No",
            ["acervosYColecciones"] = datos.AcervosYColecciones,
            ["formasDeAcceso"] = datos.NombresDeFormasDeAcceso.Count == 0 ? null : string.Join(", ", datos.NombresDeFormasDeAcceso),
            ["formatos"] = datos.NombresDeFormatos.Count == 0 ? null : string.Join(", ", datos.NombresDeFormatos),
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

        var vigentes = await db.Redes.AsNoTracking()
            .Where(item => item.Activo)
            .Select(item => new { item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct);
        var aviso = await ReglasDeProceso.QueCambioAsync(
            db,
            datos.Select(item => ReglasDeProceso.Clave(item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio)).ToList(),
            vigentes.Select(item => (item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio)),
            datos.Select(item => item.OrganizacionId).ToList(),
            "una red coincidente", ct);
        if (aviso is not null) return aviso;

        var formas = datos.SelectMany(item => item.FormasDeAccesoIds).Distinct().ToList();
        if (formas.Count > 0
            && await db.FormasDeAccesoDeRed.AsNoTracking().CountAsync(item => formas.Contains(item.Id) && item.Activo, ct) != formas.Count)
            return "Una forma de acceso del vocabulario ya no está vigente. No se escribió nada; vuelve a previsualizar.";
        var formatos = datos.SelectMany(item => item.FormatosIds).Distinct().ToList();
        if (formatos.Count > 0
            && await db.FormatosDeDocumentacion.AsNoTracking().CountAsync(item => formatos.Contains(item.Id) && item.Activo, ct) != formatos.Count)
            return "Un formato de documentación del vocabulario ya no está vigente. No se escribió nada; vuelve a previsualizar.";
        return null;
    }

    // ---------- Las reglas de la red --------------------------------------------------------

    private sealed record ContextoDePlan(
        TerritoriosDivipola Territorios,
        ExistentesDelPlan Existentes,
        IReadOnlyList<Opcion> FormasDeAcceso,
        IReadOnlyList<Opcion> Formatos,
        OrganizacionesDelPlan Organizaciones);

    private static FilaPlaneada Planear(FilaDeArchivoDto fila, ContextoDePlan plan, HashSet<string> vistas)
    {
        var hallazgos = new Hallazgos();
        var nombre = NormalizacionDeFilas.Campo(fila, "nombre");
        var descripcion = NormalizacionDeFilas.Campo(fila, "descripcion");
        var nodoCrudo = NormalizacionDeFilas.Campo(fila, "tipoDeNodo");
        var tipoDeNodo = NormalizarTipoDeNodo(nodoCrudo);
        var abiertoCrudo = NormalizacionDeFilas.Campo(fila, "accesoAbierto");
        var abierto = ReglasDeProceso.NormalizarSiNo(abiertoCrudo);
        var acervos = NormalizacionDeFilas.Campo(fila, "acervosYColecciones");
        var nivel = ReglasDeProceso.NormalizarNivel(NormalizacionDeFilas.Campo(fila, "nivelCobertura"));
        var lugar = NormalizacionDeFilas.Campo(fila, "lugarEspecifico");

        hallazgos.Obligatorio(nombre, "nombre", "nombre_requerido", "El nombre de la red es obligatorio.");
        hallazgos.Maximo(nombre, 240, "nombre");
        hallazgos.Maximo(descripcion, 4000, "descripcion");
        hallazgos.Maximo(acervos, 2000, "acervosYColecciones");
        hallazgos.Maximo(lugar, 300, "lugarEspecifico");

        if (nodoCrudo is not null && tipoDeNodo is null)
            hallazgos.Error("tipo_de_nodo_invalido", "tipoDeNodo", "El tipo de nodo debe ser red, centro de documentación, archivo, colección o grupo de investigación.");
        if (abiertoCrudo is not null && abierto is null)
            hallazgos.Error("acceso_abierto_invalido", "accesoAbierto", "Escribe «sí» o «no» en «Acceso abierto».");

        var formas = ReglasDeProceso.ResolverConError(
            hallazgos, plan.FormasDeAcceso, NormalizacionDeFilas.Campo(fila, "formasDeAcceso"), "formasDeAcceso", "forma_de_acceso_invalida", "Estas formas de acceso", conOpciones: true);
        var formatos = ReglasDeProceso.ResolverConError(
            hallazgos, plan.Formatos, NormalizacionDeFilas.Campo(fila, "formatos"), "formatos", "formato_invalido", "Estos formatos de documentación", conOpciones: false);

        if (nivel is null)
            hallazgos.Error("nivel_cobertura_invalido", "nivelCobertura", "La cobertura debe ser nacional, departamental o municipal.");
        var (departamento, municipio) = ReglasDeProceso.ResolverTerritorio(hallazgos, nivel, fila, plan.Territorios);
        var (organizacionId, nombreOrganizacion) = ReglasDeProceso.ResolverOrganizacion(hallazgos, fila, plan.Organizaciones, "la red");
        var contacto = ReglasDeProceso.ValidarContacto(hallazgos, fila);

        var datos = new DatosDeRed(
            nombre ?? string.Empty, descripcion, tipoDeNodo ?? "red", abierto ?? false, acervos, nivel ?? string.Empty,
            departamento?.Codigo, departamento?.Nombre, municipio?.Codigo, municipio?.Nombre, lugar,
            organizacionId, nombreOrganizacion,
            formas.Select(item => item.Id).ToList(), formas.Select(item => item.Nombre).ToList(),
            formatos.Select(item => item.Id).ToList(), formatos.Select(item => item.Nombre).ToList(),
            contacto.Correo, contacto.Telefono, contacto.SitioWeb, contacto.Instagram, contacto.Facebook, contacto.OtroEnlace);

        var existente = ReglasDeProceso.MarcarDuplicados(
            hallazgos, plan.Existentes, vistas, nombre, nivel, datos.CodigoDepartamento, datos.CodigoMunicipio,
            "red_existente", "una red", "la misma red");

        var importable = hallazgos.SinErrores;
        var resultado = existente is not null ? "coincidencia_existente" : importable ? "crear" : "rechazar";
        return new FilaPlaneada(
            fila.NumeroFila, resultado, importable, existente,
            JsonSerializer.Serialize(datos, NucleoDeImportacion.Json), hallazgos.Lista);
    }

    private static string? NormalizarTipoDeNodo(string? valor) => NormalizacionDeFilas.Comparable(valor) switch
    {
        "" or "red" => "red",
        "centro de documentacion" or "centro_de_documentacion" => "centro_de_documentacion",
        "archivo" => "archivo",
        "coleccion" => "coleccion",
        "grupo de investigacion" or "grupo_de_investigacion" => "grupo_de_investigacion",
        _ => null,
    };

    private static DatosDeRed Leer(string json, long filaId = 0) =>
        JsonSerializer.Deserialize<DatosDeRed>(json, NucleoDeImportacion.Json)
            ?? throw new InvalidOperationException($"La fila {filaId} no contiene el contrato normalizado de red.");
}
