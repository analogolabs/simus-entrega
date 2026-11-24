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

/// <summary>El dato de un Mercado ya normalizado, tal como se guarda en la fila del lote.</summary>
/// <remarks>
/// LLEVA LOS IDENTIFICADORES YA RESUELTOS —organización, festival, alcance, modalidad— y también
/// sus nombres: los primeros son lo que se escribe, los segundos son lo que reconoce quien revisa la
/// previsualización. <c>CorreoContacto</c> y <c>TelefonoContacto</c> conservan el nombre de los demás
/// dominios porque son los que la retención minimiza una vez aplicado el lote.
/// </remarks>
public sealed record DatosDeMercado(
    string Nombre,
    string? Descripcion,
    int? AlcanceId,
    string? NombreAlcance,
    int? ModalidadId,
    string? NombreModalidad,
    string? Periodicidad,
    string? PeriodicidadDetalle,
    string NivelCobertura,
    string? CodigoDepartamento,
    string? NombreDepartamento,
    string? CodigoMunicipio,
    string? NombreMunicipio,
    string? LugarEspecifico,
    // NULO = LA ORGANIZACION INSTITUCIONAL. Se resuelve al escribir con la que declara el contexto.
    int? OrganizacionId,
    string? NombreOrganizacion,
    int? FestivalId,
    string? NombreFestival,
    string? CorreoContacto,
    string? TelefonoContacto,
    string? SitioWeb,
    string? Instagram,
    string? Facebook,
    string? OtroEnlace,
    // LA SEDE PRINCIPAL (decisión 119): aparte de la cobertura. Nula = pendiente de completar.
    string? SedeCodigoDepartamento = null,
    string? SedeNombreDepartamento = null,
    string? SedeCodigoMunicipio = null,
    string? SedeNombreMunicipio = null);

/// <summary>
/// Mercados musicales: el quinto dominio de la Importación Asistida (CON-01).
/// </summary>
/// <remarks>
/// <para>
/// <b>UN MERCADO IMPORTADO NACE EN BORRADOR.</b> A diferencia de los Festivales históricos, no hay
/// decisión de la dirección que autorice publicar un Mercado cargado en masa: un Mercado se publica
/// cuando alguien del Programa lo revisa, y <c>ImportacionAsistidaTests</c> vigila que este dominio
/// no declare un estado público.
/// </para>
/// <para>
/// <b>LA ORGANIZACION RESPONSABLE ES OPCIONAL EN EL ARCHIVO.</b> Si la hoja la trae, tiene que
/// coincidir por nombre con una organización que ya existe: <b>nunca se crea una organización desde
/// un Mercado</b>. Si no la trae, el Mercado queda bajo la custodia del Programa, como cualquier
/// registro importado sin dueño, y su organización podrá reclamarlo después.
/// </para>
/// <para>
/// <b>LAS COINCIDENCIAS NO DAN FALSOS AVISOS.</b> Un nombre idéntico en el mismo territorio es un
/// error («ya existe»); uno que solo se parece es una advertencia que no bloquea. El parecido
/// reutiliza <see cref="ParecidoDeNombres"/> —palabras que distinguen, erratas de tecleo y siglas
/// con respaldo de territorio— y solo compara dentro del mismo territorio. «Mercado» es una palabra
/// genérica (no distingue), igual que «Festival».
/// </para>
/// <para>
/// <b>NADA SE MODIFICA NI SE BORRA.</b> Un Mercado que ya existe no se actualiza con el archivo: la
/// fila se marca «Ya existe» y no se escribe. Prácticas musicales, territorios sonoros y ediciones
/// no se importan: se completan desde la ficha, que es donde se revisan.
/// </para>
/// </remarks>
public sealed class DominioDeMercados : IDominioDeImportacion
{
    private static readonly CampoDeImportacionDto[] CamposDeclarados =
    [
        new("nombre", "Nombre del mercado", true),
        new("descripcion", "Descripción", false),
        new("alcance", "Alcance", false),
        new("modalidad", "Modalidad", false),
        new("periodicidad", "Periodicidad", false),
        new("periodicidadDetalle", "Detalle de la periodicidad", false),
        new("nivelCobertura", "Nivel de cobertura", true),
        new("departamento", "Departamento", false),
        new("municipio", "Municipio", false),
        new("sedeDepartamento", "Departamento de la sede principal", false),
        new("sedeMunicipio", "Municipio de la sede principal", false),
        new("lugarEspecifico", "Lugar específico", false),
        new("organizacion", "Organización responsable", false),
        new("festival", "Festival en cuyo marco se realiza", false),
        new("correoContacto", "Correo de contacto", false),
        new("telefonoContacto", "Teléfono de contacto", false),
        new("sitioWeb", "Sitio web", false),
        new("instagram", "Instagram", false),
        new("facebook", "Facebook", false),
        new("otroEnlace", "Otro enlace", false),
    ];

    public CapacidadDeImportacion Capacidad { get; } = new(
        Modulos.Mercados,
        "Mercados",
        "borrador",
        "Un Mercado importado entra en borrador, nunca publicado: un Mercado se publica cuando alguien "
            + "del PNMC lo revisa, y cargarlo en masa publicado sería dar por revisadas todas las filas "
            + "de un archivo. Queda bajo la organización que declare la hoja o, si no declara ninguna, bajo "
            + "la custodia del PNMC.",
        Modulos.Mercados,
        "Mercados",
        CamposDeclarados);

    public async Task<PlanDeImportacion> PlanearAsync(
        IReadOnlyList<FilaDeArchivoDto> filas, string huellaArchivo, SimusDbContext db, CancellationToken ct)
    {
        var territorios = new TerritoriosDivipola(await db.DivipolaLocations.AsNoTracking().ToListAsync(ct));
        var registrados = await db.Mercados.AsNoTracking()
            .Where(item => item.Activo)
            .Select(item => new { item.Id, item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct);
        var existentes = registrados
            .GroupBy(item => Clave(item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio), StringComparer.Ordinal)
            .ToDictionary(grupo => grupo.Key, grupo => grupo.OrderBy(item => item.Id).First().Id, StringComparer.Ordinal);
        // PARA «SE PARECE A…»: los Mercados registrados, agrupados por territorio. Solo se compara
        // dentro del mismo territorio, que es lo que mantiene corta la lista y lo que impide que dos
        // Mercados de departamentos distintos se confundan.
        var parecidos = registrados
            .GroupBy(item => TerritorioDe(item.CodigoDepartamento, item.CodigoMunicipio), StringComparer.Ordinal)
            .ToDictionary(
                grupo => grupo.Key,
                grupo => grupo.OrderBy(item => item.Id).Select(item => (Id: item.Id, Nombre: item.Nombre)).ToList(),
                StringComparer.Ordinal);

        var vocabularios = new Vocabularios(
            await db.AlcancesMercado.AsNoTracking().Select(item => new Opcion(item.Id, item.Nombre, item.Slug)).ToListAsync(ct),
            await db.ModalidadesMercado.AsNoTracking().Select(item => new Opcion(item.Id, item.Nombre, item.Slug)).ToListAsync(ct));

        var organizaciones = await db.EntityProfiles.AsNoTracking()
            .Where(item => item.EntityType == "organizacion")
            .Select(item => new { item.Id, item.Name, item.IsInstitutional })
            .ToListAsync(ct);
        var institucionalId = organizaciones.Where(item => item.IsInstitutional).Select(item => (int?)item.Id).FirstOrDefault();
        var organizacionesPorNombre = organizaciones
            .GroupBy(item => NormalizacionDeFilas.Comparable(item.Name), StringComparer.Ordinal)
            .ToDictionary(
                grupo => grupo.Key,
                grupo => grupo.Select(item => (Id: item.Id, Nombre: item.Name)).ToList(),
                StringComparer.Ordinal);
        var nombreInstitucional = organizaciones.Where(item => item.IsInstitutional).Select(item => item.Name).FirstOrDefault();

        var festivales = (await db.FestivalRecords.AsNoTracking()
                .Select(item => new { item.Id, item.Name, item.OrganizacionPrincipalId })
                .ToListAsync(ct))
            .Where(item => item.OrganizacionPrincipalId != null)
            .GroupBy(item => item.OrganizacionPrincipalId!.Value)
            .ToDictionary(
                grupo => grupo.Key,
                grupo => grupo.Select(item => (Id: item.Id, Nombre: item.Name)).ToList());

        var contexto = new ContextoDePlan(
            territorios, existentes, parecidos, vocabularios, organizacionesPorNombre,
            institucionalId, nombreInstitucional, festivales);
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
        var mercado = new MercadoRow
        {
            Nombre = datos.Nombre,
            Descripcion = datos.Descripcion,
            AlcanceMercadoId = datos.AlcanceId,
            ModalidadMercadoId = datos.ModalidadId,
            Periodicidad = datos.Periodicidad,
            PeriodicidadDetalle = datos.PeriodicidadDetalle,
            CorreoMercado = datos.CorreoContacto,
            TelefonoMercado = datos.TelefonoContacto,
            SitioWebMercado = datos.SitioWeb,
            InstagramMercado = datos.Instagram,
            FacebookMercado = datos.Facebook,
            OtroEnlaceMercado = datos.OtroEnlace,
            NivelCobertura = datos.NivelCobertura,
            CodigoDepartamento = datos.CodigoDepartamento,
            CodigoMunicipio = datos.CodigoMunicipio,
            SedeCodigoDepartamento = datos.SedeCodigoDepartamento,
            SedeCodigoMunicipio = datos.SedeCodigoMunicipio,
            LugarEspecifico = datos.LugarEspecifico,
            SeRealizaEnElMarcoDeUnFestival = datos.FestivalId is not null,
            FestivalId = datos.FestivalId,
            OrganizacionPrincipalId = datos.OrganizacionId ?? contexto.OrganizacionInstitucionalId,
            EstadoRegistro = Capacidad.EstadoAlImportar,
            Activo = true,
            IdUsuarioCreador = contexto.UsuarioId,
            FechaCreacion = contexto.Ahora,
        };
        var foto = RegistradorDeCambios.Tomar(new MercadoRow(), MercadosEndpoints.CamposVigilados);
        db.Mercados.Add(mercado);
        await db.SaveChangesAsync(ct);

        // EL HISTORIAL UNICO («EDICIONES») EMPIEZA EL DIA DE LA IMPORTACION: una fila por cada dato que
        // el archivo trajo, con origen «importacion» y el lote que lo cargó. La bitácora ya anota la
        // creación contra el registro; por eso aquí va sin su propia línea.
        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(
                Modulos.Mercados, mercado.Id.ToString(CultureInfo.InvariantCulture), mercado.OrganizacionPrincipalId,
                contexto.UsuarioId, "Consola", OrigenDelCambio.Importacion,
                $"Registro importado desde un archivo (lote {fila.LoteImportacionId.ToString(CultureInfo.InvariantCulture)}).",
                Fecha: contexto.Ahora),
            MercadosEndpoints.CamposVigilados, foto, mercado, ct, conBitacora: false);
        return mercado.Id;
    }

    public IReadOnlyDictionary<string, string?> ParaMostrar(string contenidoNormalizadoJson)
    {
        var datos = Leer(contenidoNormalizadoJson);
        return new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["nombre"] = datos.Nombre,
            ["descripcion"] = datos.Descripcion,
            ["alcance"] = datos.NombreAlcance,
            ["modalidad"] = datos.NombreModalidad,
            ["periodicidad"] = datos.Periodicidad,
            ["periodicidadDetalle"] = datos.PeriodicidadDetalle,
            ["nivelCobertura"] = datos.NivelCobertura,
            // SE ENSEÑA EL NOMBRE Y SE GUARDA EL CODIGO, como en Festivales.
            ["departamento"] = datos.NombreDepartamento,
            ["municipio"] = datos.NombreMunicipio,
            ["lugarEspecifico"] = datos.LugarEspecifico,
            ["organizacion"] = datos.NombreOrganizacion,
            ["festival"] = datos.NombreFestival,
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

        var claves = datos
            .Select(item => Clave(item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio))
            .ToHashSet(StringComparer.Ordinal);
        var vigentes = await db.Mercados.AsNoTracking()
            .Where(item => item.Activo)
            .Select(item => new { item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio })
            .ToListAsync(ct);
        if (vigentes.Any(item => claves.Contains(Clave(item.Nombre, item.CodigoDepartamento, item.CodigoMunicipio))))
            return "Apareció un Mercado coincidente después de la previsualización. No se escribió nada; vuelve a previsualizar.";

        // LAS RELACIONES TAMBIEN PUEDEN HABER CAMBIADO: escribir un Mercado con una organización o un
        // Festival que ya no están (o que ya no son de esa organización) reventaría en la base.
        var organizaciones = datos.Where(item => item.OrganizacionId is not null).Select(item => item.OrganizacionId!.Value).Distinct().ToList();
        if (organizaciones.Count > 0)
        {
            var presentes = await db.EntityProfiles.AsNoTracking().Where(item => organizaciones.Contains(item.Id)).CountAsync(ct);
            if (presentes != organizaciones.Count)
                return "Una organización responsable ya no existe. No se escribió nada; vuelve a previsualizar.";
        }

        var conFestival = datos.Where(item => item.FestivalId is not null).ToList();
        if (conFestival.Count > 0)
        {
            var idsDeFestival = conFestival.Select(item => item.FestivalId!.Value).Distinct().ToList();
            var duenos = await db.FestivalRecords.AsNoTracking()
                .Where(item => idsDeFestival.Contains(item.Id))
                .ToDictionaryAsync(item => item.Id, item => item.OrganizacionPrincipalId, ct);
            var institucional = await ProcedenciaDeRegistro.IdInstitucionalAsync(db, ct);
            foreach (var item in conFestival)
            {
                var organizacion = item.OrganizacionId ?? institucional;
                if (!duenos.TryGetValue(item.FestivalId!.Value, out var dueno) || dueno != organizacion)
                    return "Un Festival asociado ya no existe o cambió de organización. No se escribió nada; vuelve a previsualizar.";
            }
        }

        return null;
    }

    // ---------- Las reglas de Mercado -------------------------------------------------------

    private sealed record Opcion(int Id, string Nombre, string Slug);

    private sealed record Vocabularios(IReadOnlyList<Opcion> Alcances, IReadOnlyList<Opcion> Modalidades)
    {
        public static Opcion? Buscar(IReadOnlyList<Opcion> lista, string? valor)
        {
            var clave = NormalizacionDeFilas.Comparable(valor);
            return clave.Length == 0
                ? null
                : lista.FirstOrDefault(item => NormalizacionDeFilas.Comparable(item.Nombre) == clave
                    || NormalizacionDeFilas.Comparable(item.Slug) == clave);
        }
    }

    private sealed record ContextoDePlan(
        TerritoriosDivipola Territorios,
        Dictionary<string, int> Existentes,
        Dictionary<string, List<(int Id, string Nombre)>> Parecidos,
        Vocabularios Vocabularios,
        Dictionary<string, List<(int Id, string Nombre)>> OrganizacionesPorNombre,
        int? InstitucionalId,
        string? NombreInstitucional,
        Dictionary<int, List<(int Id, string Nombre)>> FestivalesPorOrganizacion);

    private static FilaPlaneada Planear(FilaDeArchivoDto fila, ContextoDePlan plan, HashSet<string> vistas)
    {
        var hallazgos = new Hallazgos();
        var nombre = NormalizacionDeFilas.Campo(fila, "nombre");
        var descripcion = NormalizacionDeFilas.Campo(fila, "descripcion");
        var alcanceCrudo = NormalizacionDeFilas.Campo(fila, "alcance");
        var modalidadCruda = NormalizacionDeFilas.Campo(fila, "modalidad");
        var periodicidadCruda = NormalizacionDeFilas.Campo(fila, "periodicidad");
        var periodicidad = NormalizarPeriodicidad(periodicidadCruda);
        var detalle = NormalizacionDeFilas.Campo(fila, "periodicidadDetalle");
        var nivel = NormalizarNivel(NormalizacionDeFilas.Campo(fila, "nivelCobertura"));
        var departamentoCrudo = NormalizacionDeFilas.Campo(fila, "departamento");
        var municipioCrudo = NormalizacionDeFilas.Campo(fila, "municipio");
        var departamento = plan.Territorios.Departamento(departamentoCrudo);
        var municipio = plan.Territorios.Municipio(departamento?.Codigo, municipioCrudo);
        var lugar = NormalizacionDeFilas.Campo(fila, "lugarEspecifico");
        var organizacionCruda = NormalizacionDeFilas.Campo(fila, "organizacion");
        var festivalCrudo = NormalizacionDeFilas.Campo(fila, "festival");
        var correoCrudo = NormalizacionDeFilas.Campo(fila, "correoContacto");
        var correo = NormalizacionDeFilas.NormalizarCorreo(correoCrudo);
        var telefonoCrudo = NormalizacionDeFilas.Campo(fila, "telefonoContacto");
        var telefono = NormalizacionDeFilas.NormalizarTelefono(telefonoCrudo);
        var sitioCrudo = NormalizacionDeFilas.Campo(fila, "sitioWeb");
        var otroCrudo = NormalizacionDeFilas.Campo(fila, "otroEnlace");
        var instagramCrudo = NormalizacionDeFilas.Campo(fila, "instagram");
        var facebookCrudo = NormalizacionDeFilas.Campo(fila, "facebook");

        hallazgos.Obligatorio(nombre, "nombre", "nombre_requerido", "El nombre del mercado es obligatorio.");
        hallazgos.Maximo(nombre, 240, "nombre");
        hallazgos.Maximo(lugar, 300, "lugarEspecifico");

        // LAS DOS LISTAS CONTROLADAS: un valor que no está en el vocabulario no se guarda ni se adivina.
        var alcance = Vocabularios.Buscar(plan.Vocabularios.Alcances, alcanceCrudo);
        if (alcanceCrudo is not null && alcance is null)
        {
            hallazgos.Error("alcance_invalido", "alcance",
                $"El alcance debe ser uno de: {string.Join(", ", plan.Vocabularios.Alcances.Select(item => item.Nombre))}.");
        }
        var modalidad = Vocabularios.Buscar(plan.Vocabularios.Modalidades, modalidadCruda);
        if (modalidadCruda is not null && modalidad is null)
        {
            hallazgos.Error("modalidad_invalida", "modalidad",
                $"La modalidad debe ser una de: {string.Join(", ", plan.Vocabularios.Modalidades.Select(item => item.Nombre))}.");
        }

        if (!string.IsNullOrWhiteSpace(periodicidadCruda) && periodicidad is null)
            hallazgos.Error("periodicidad_invalida", "periodicidad", "La periodicidad no pertenece al catálogo vigente.");
        if (PeriodicidadesFestival.RequiereDetalle(periodicidad) && string.IsNullOrWhiteSpace(detalle))
            hallazgos.Error("detalle_periodicidad_requerido", "periodicidadDetalle", "Esta periodicidad requiere una explicación.");
        hallazgos.Maximo(detalle, 240, "periodicidadDetalle");

        // LA COHERENCIA NIVEL-TERRITORIO ES UN CHECK DE LA BASE (`CK_Mercados_NivelCobertura`): se
        // comprueba al planear para que la previsualización no diga «todo bien» y el lote reviente.
        if (nivel is null)
        {
            hallazgos.Error("nivel_cobertura_invalido", "nivelCobertura",
                "La cobertura debe ser nacional, departamental o municipal.");
        }
        else if (nivel == "nacional")
        {
            if (departamento is not null || !string.IsNullOrWhiteSpace(municipioCrudo))
            {
                hallazgos.Info("territorio_omitido_por_cobertura", "nivelCobertura",
                    "La cobertura nacional no conserva departamento ni municipio.");
            }
            departamento = null;
            municipio = null;
        }
        else if (nivel == "departamental")
        {
            if (departamento is null)
                hallazgos.Error("departamento_invalido", "departamento", "El departamento no coincide con DIVIPOLA.");
            if (!string.IsNullOrWhiteSpace(municipioCrudo))
            {
                hallazgos.Info("municipio_omitido_por_cobertura", "municipio",
                    "La cobertura departamental no conserva municipio.");
            }
            municipio = null;
        }
        else
        {
            if (departamento is null)
                hallazgos.Error("departamento_invalido", "departamento", "El departamento no coincide con DIVIPOLA.");
            if (municipio is null)
            {
                hallazgos.Error("municipio_invalido", "municipio",
                    "El municipio no coincide con DIVIPOLA dentro del departamento indicado.");
            }
        }

        // LA SEDE PRINCIPAL (decisión 119). Si el archivo la trae, tiene que existir en DIVIPOLA y el
        // municipio pertenecer al departamento; si no la trae, sale del territorio de la cobertura
        // (municipal: departamento y municipio; departamental: solo el departamento). Lo que no se
        // pueda resolver NO bloquea: queda «pendiente de completar» y se pide en la ficha.
        var sedeDepartamentoCrudo = NormalizacionDeFilas.Campo(fila, "sedeDepartamento");
        var sedeMunicipioCrudo = NormalizacionDeFilas.Campo(fila, "sedeMunicipio");
        var sedeDepartamento = plan.Territorios.Departamento(sedeDepartamentoCrudo);
        var sedeMunicipio = plan.Territorios.Municipio(sedeDepartamento?.Codigo, sedeMunicipioCrudo);
        if (sedeDepartamentoCrudo is not null || sedeMunicipioCrudo is not null)
        {
            if (sedeDepartamento is null)
                hallazgos.Error("sede_departamento_invalido", "sedeDepartamento", "El departamento de la sede no coincide con DIVIPOLA.");
            else if (sedeMunicipioCrudo is not null && sedeMunicipio is null)
                hallazgos.Error("sede_municipio_invalido", "sedeMunicipio",
                    "El municipio de la sede no coincide con DIVIPOLA dentro del departamento indicado.");
        }
        else
        {
            sedeDepartamento = departamento;
            sedeMunicipio = nivel == "municipal" ? municipio : null;
        }
        if (sedeDepartamento is null || sedeMunicipio is null)
        {
            hallazgos.Info("sede_pendiente", "sedeMunicipio",
                "La sede principal queda pendiente de completar: se pedirá en la ficha antes de enviar el Mercado a revisión.");
        }

        // LA ORGANIZACION NUNCA SE CREA DESDE UN MERCADO: se busca por nombre y, si no hay una sola
        // que coincida, la fila se rechaza para que alguien lo resuelva.
        int? organizacionId = null;
        string? nombreOrganizacion = null;
        int? organizacionParaElFestival = plan.InstitucionalId;
        if (organizacionCruda is not null)
        {
            var candidatas = plan.OrganizacionesPorNombre.GetValueOrDefault(NormalizacionDeFilas.Comparable(organizacionCruda));
            if (candidatas is null || candidatas.Count == 0)
            {
                hallazgos.Error("organizacion_desconocida", "organizacion",
                    "No existe una organización con ese nombre. Regístrala primero o deja la columna vacía para que quede bajo el PNMC.");
                organizacionParaElFestival = null;
            }
            else if (candidatas.Count > 1)
            {
                hallazgos.Error("organizacion_ambigua", "organizacion",
                    "Hay varias organizaciones con ese nombre; el archivo no permite saber cuál es.");
                organizacionParaElFestival = null;
            }
            else
            {
                organizacionId = candidatas[0].Id;
                nombreOrganizacion = candidatas[0].Nombre;
                organizacionParaElFestival = organizacionId;
            }
        }
        else
        {
            nombreOrganizacion = plan.NombreInstitucional;
            if (plan.InstitucionalId is null)
            {
                hallazgos.Error("organizacion_requerida", "organizacion",
                    "No hay una organización institucional que se haga cargo del Mercado; indica la organización responsable.");
            }
        }

        // EL FESTIVAL DEBE SER DE LA MISMA ORGANIZACION (regla del servidor, que un CHECK no expresa).
        int? festivalId = null;
        string? nombreFestival = null;
        if (festivalCrudo is not null && organizacionParaElFestival is { } dueno)
        {
            var delDueno = plan.FestivalesPorOrganizacion.GetValueOrDefault(dueno) ?? [];
            var clave = NormalizacionDeFilas.Comparable(festivalCrudo);
            var coinciden = delDueno.Where(item => NormalizacionDeFilas.Comparable(item.Nombre) == clave).ToList();
            if (coinciden.Count == 0)
            {
                hallazgos.Error("festival_desconocido", "festival",
                    "No hay un Festival con ese nombre bajo la organización responsable del Mercado.");
            }
            else if (coinciden.Count > 1)
            {
                hallazgos.Error("festival_ambiguo", "festival",
                    "Hay varios Festivales con ese nombre bajo la organización responsable; asocia el Mercado desde su ficha.");
            }
            else
            {
                festivalId = coinciden[0].Id;
                nombreFestival = coinciden[0].Nombre;
            }
        }

        // CONTACTO: LA MISMA REGLA QUE EL ALTA DE LA CONSOLA (https; usuario o dirección en redes).
        hallazgos.Correo(correo, "correoContacto");
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

        var datos = new DatosDeMercado(
            nombre ?? string.Empty, descripcion, alcance?.Id, alcance?.Nombre, modalidad?.Id, modalidad?.Nombre,
            periodicidad, detalle, nivel ?? string.Empty,
            departamento?.Codigo, departamento?.Nombre, municipio?.Codigo, municipio?.Nombre, lugar,
            organizacionId, nombreOrganizacion, festivalId, nombreFestival,
            correo, telefono,
            ValidationHelpers.NormalizeHttpsUrl(sitioCrudo),
            ValidationHelpers.NormalizeSocialLink(instagramCrudo),
            ValidationHelpers.NormalizeSocialLink(facebookCrudo),
            ValidationHelpers.NormalizeHttpsUrl(otroCrudo),
            sedeDepartamento?.Codigo, sedeDepartamento?.Nombre, sedeMunicipio?.Codigo, sedeMunicipio?.Nombre);

        var clavePropia = Clave(datos.Nombre, datos.CodigoDepartamento, datos.CodigoMunicipio);
        long? existente = null;
        if (nombre is not null && nivel is not null && plan.Existentes.TryGetValue(clavePropia, out var encontrado))
        {
            existente = encontrado;
            hallazgos.Error("mercado_existente", "nombre",
                $"Ya existe un Mercado con ese nombre en ese territorio, con identificador {encontrado.ToString(CultureInfo.InvariantCulture)}; esta importación no lo modifica.");
        }
        if (nombre is not null && nivel is not null && !vistas.Add(clavePropia))
            hallazgos.Error("duplicado_en_archivo", "nombre", "Otra fila del archivo representa el mismo Mercado y territorio.");

        // UN NOMBRE QUE NO ES IDENTICO PERO SE PARECE NO SE BLOQUEA: SE AVISA. Es el mismo criterio del
        // asistente de reclamación y de la importación de Festivales (`ParecidoDeNombres`): palabras
        // que distinguen, erratas de tecleo y siglas con respaldo de territorio. Solo se compara con
        // los Mercados del mismo territorio, y solo es una advertencia: quien prepara el archivo
        // decide y puede excluir la fila antes de confirmar.
        if (existente is null && nombre is not null && nivel is not null
            && plan.Parecidos.TryGetValue(TerritorioDe(datos.CodigoDepartamento, datos.CodigoMunicipio), out var vecinos))
        {
            var respaldo = ParecidoDeNombres.RespaldoDe(datos.CodigoDepartamento, datos.CodigoMunicipio, datos.CodigoDepartamento, datos.CodigoMunicipio);
            var (id, nombreExistente, razon) = ParecidoDeNombres.Puntuar(nombre, vecinos, vecino => vecino.Nombre, _ => respaldo)
                .OrderByDescending(par => par.Puntaje)
                .ThenBy(par => par.Item.Id)
                .Select(par => (par.Item.Id, par.Item.Nombre, par.Razon))
                .FirstOrDefault();
            if (razon is not null)
            {
                hallazgos.Advertencia("posible_duplicado", "nombre",
                    $"Se parece a «{nombreExistente}» (identificador {id.ToString(CultureInfo.InvariantCulture)}): {razon} "
                    + "Si es el mismo Mercado, excluye esta fila; su organización podrá reclamar el que ya existe.");
            }
        }

        var importable = hallazgos.SinErrores;
        var resultado = existente is not null ? "coincidencia_existente" : importable ? "crear" : "rechazar";
        return new FilaPlaneada(
            fila.NumeroFila, resultado, importable, existente,
            JsonSerializer.Serialize(datos, NucleoDeImportacion.Json), hallazgos.Lista);
    }

    /// <summary>El territorio de un Mercado como clave: nacional, departamental o municipal.</summary>
    private static string TerritorioDe(string? departamento, string? municipio) =>
        $"{departamento ?? string.Empty}|{municipio ?? string.Empty}";

    /// <summary>Qué hace que dos Mercados sean el mismo: su nombre y su territorio.</summary>
    private static string Clave(string? nombre, string? departamento, string? municipio) =>
        $"{NormalizacionDeFilas.Comparable(nombre)}|{departamento ?? string.Empty}|{municipio ?? string.Empty}";

    private static string? NormalizarNivel(string? valor) => NormalizacionDeFilas.Comparable(valor) switch
    {
        "nacional" => "nacional",
        "departamental" or "departamento" => "departamental",
        "municipal" or "municipio" or "local" => "municipal",
        _ => null,
    };

    private static string? NormalizarPeriodicidad(string? valor)
    {
        var normal = NormalizacionDeFilas.Comparable(valor).Replace(' ', '_');
        return normal.Length == 0 ? null : PeriodicidadesFestival.Todas.Contains(normal) ? normal : null;
    }

    private static DatosDeMercado Leer(string json, long filaId = 0) =>
        JsonSerializer.Deserialize<DatosDeMercado>(json, NucleoDeImportacion.Json)
            ?? throw new InvalidOperationException($"La fila {filaId} no contiene el contrato normalizado de Mercado.");
}
