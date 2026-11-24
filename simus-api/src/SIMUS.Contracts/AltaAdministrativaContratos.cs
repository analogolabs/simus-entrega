namespace SIMUS.Contracts;

/// <summary>
/// Lo que la consola envía para dar de alta una organización.
/// </summary>
/// <remarks>
/// <para>
/// <b>NO ES UN FORMULARIO DISTINTO DEL EXTERNO: ES EL MISMO SIN LA CUENTA.</b> El alta externa
/// crea a la vez la organización y el usuario que la administrará, porque quien la registra es
/// esa persona. La consola registra una organización que todavía <b>no tiene cuenta</b>: el
/// funcionario deja su ficha y sus datos de responsable, y cuando la organización llegue al
/// sistema reclamará su administración por el circuito que ya existe.
/// </para>
/// <para>
/// POR ESO NO HAY CONTRASEÑA NI CORREO DE ACCESO. Pedirlos obligaría al funcionario a inventar
/// una credencial para una persona que no está delante.
/// </para>
/// </remarks>
public sealed class CrearOrganizacionAdministrativaSolicitud
{
    public string Nombre { get; set; } = string.Empty;
    public string? Identificacion { get; set; }
    public string? CorreoContacto { get; set; }
    public string? CodigoDepartamentoSede { get; set; }
    public string? CodigoMunicipioSede { get; set; }

    /// <summary>Quién responde por la organización. Se guarda aunque no tenga cuenta todavía.</summary>
    public string ResponsableNombre { get; set; } = string.Empty;
    public string? ResponsableTipoDocumento { get; set; }
    public string? ResponsableNumeroDocumento { get; set; }
    public string? ResponsableCorreo { get; set; }
    public string? ResponsableTelefono { get; set; }

    /// <summary>
    /// Ley 1581 de 2012: la autorización del titular se guarda, no se presume.
    /// </summary>
    /// <remarks>
    /// SE PIDE TAMBIÉN EN EL ALTA ADMINISTRATIVA. Que el dato lo teclee un funcionario no cambia
    /// que sea un dato personal de otra persona: si nadie autorizó, la ficha lo dice.
    /// </remarks>
    public bool ResponsableAutorizacionDatos { get; set; }
}

/// <summary>
/// Lo que la consola envía para dar de alta un Festival.
/// </summary>
/// <remarks>
/// <b>REUTILIZA EL MISMO CUERPO QUE EL ASISTENTE EXTERNO</b> y le añade una sola cosa: a qué
/// organización pertenece. En el canal externo eso no hace falta —es la de la sesión—; en la
/// consola es una decisión, y puede quedar sin resolver mientras nadie responda por el Festival.
/// </remarks>
public sealed class CrearFestivalAdministrativoSolicitud
{
    public CrearFestivalBorradorSolicitud Festival { get; set; } = new();

    /// <summary>
    /// La organización que gestiona el Festival.
    /// </summary>
    /// <remarks>
    /// <b>NO ES LA PROCEDENCIA.</b> Que el Programa incorpore el Festival no lo convierte en su
    /// organización responsable: eso sigue siendo la Fundación que lo organiza. Puede venir nulo:
    /// un Festival histórico puede no tener todavía quién responda por él.
    /// </remarks>
    public int? OrganizacionResponsableId { get; set; }
}

/// <summary>Un Festival ya registrado que se parece al que se está dando de alta.</summary>
/// <remarks>
/// EXISTE PARA QUE NADIE REGISTRE DOS VECES EL MISMO FESTIVAL. Se ofrece antes de guardar, con lo
/// justo para reconocerlo: nombre, territorio y estado. No decide nada por quien registra.
/// </remarks>
public sealed record CoincidenciaDeAltaDto(
    string Id,
    string Nombre,
    string? Territorio,
    string Estado,
    string? OrganizacionResponsable);

/// <summary>
/// La ficha administrativa de un Festival: sus datos permanentes, de dónde vino, quién responde
/// por él y sus ediciones.
/// </summary>
/// <remarks>
/// <para>
/// <b>EL FESTIVAL ES LA ENTIDAD PRINCIPAL Y LAS EDICIONES CUELGAN DE ÉL.</b> No son un módulo
/// equivalente: son el historial de realizaciones de ese Festival concreto. Por eso viajan dentro
/// de su ficha y no en una lista propia paralela.
/// </para>
/// <para>
/// <b>TRES DIMENSIONES SEPARADAS.</b> <c>Procedencia</c> dice quién lo incorporó;
/// <c>OrganizacionResponsable</c>, quién lo gestiona. Que el Programa lo haya registrado no lo
/// convierte en su responsable.
/// </para>
/// </remarks>
public sealed record FichaFestivalAdministrativaDto(
    string Id,
    string Nombre,
    string? Descripcion,
    string Estado,
    string NivelCobertura,
    string? Departamento,
    string? Municipio,
    string? Periodicidad,
    string? CorreoContacto,
    string? Telefono,
    string? SitioWeb,
    int? OrganizacionResponsableId,
    string? OrganizacionResponsableNombre,
    ProcedenciaDeRegistroDto? Procedencia,
    IReadOnlyList<ElementoDeClasificacionDto> PracticasMusicales,
    IReadOnlyList<ElementoDeClasificacionDto> TerritoriosSonoros,
    IReadOnlyList<EdicionDelFestivalDto> Ediciones,
    DateTime FechaCreacion,
    DateTime? FechaActualizacion,
    // FUSIÓN DE DUPLICADOS. Si es un registro histórico —en custodia del Programa—, si otro
    // lo absorbió y cuáles absorbió él: lo que la consola necesita para ofrecer o explicar la fusión.
    bool EsRegistroHistorico = false,
    string? FusionadoEnId = null,
    string? FusionadoEnNombre = null,
    IReadOnlyList<FestivalAbsorbidoDto>? Absorbidos = null);

/// <summary>Una copia del Festival que este absorbió al fusionar duplicados.</summary>
public sealed record FestivalAbsorbidoDto(string Id, string Nombre, DateTime? FechaFusion);

/// <summary>
/// Otra copia del mismo Festival histórico que se podría fusionar con este.
/// </summary>
/// <remarks>
/// <c>Bloqueo</c> no es nulo cuando la fusión no se permite, y dice por qué y qué hacer: la consola
/// lo enseña en vez de ofrecer un botón que el servidor va a rechazar.
/// </remarks>
public sealed record CandidatoDeFusionDto(
    string Id,
    string Nombre,
    string Estado,
    string? NombreMunicipio,
    string? NombreDepartamento,
    IReadOnlyList<int> AniosDeEdiciones,
    int Ediciones,
    string? ReclamacionAbiertaDe,
    string? ReclamacionAbiertaEstado,
    bool Parecido,
    string? CodigoBloqueo,
    string? Bloqueo,
    // Por qué se propone esta copia: qué palabras del nombre coinciden (M2). Null si se buscó por número.
    string? RazonDelParecido = null);

/// <summary>El Festival que se conserva y las copias con las que se puede fusionar.</summary>
public sealed record CandidatosDeFusionDto(
    string FestivalId,
    string Nombre,
    string? CodigoBloqueo,
    string? Bloqueo,
    IReadOnlyList<CandidatoDeFusionDto> Candidatos);

/// <summary>Fusionar otra copia en este Festival. El motivo es obligatorio.</summary>
public sealed class FusionarFestivalesSolicitud
{
    /// <summary>La copia que se absorbe y queda archivada.</summary>
    public string AbsorbidoId { get; set; } = string.Empty;

    /// <summary>Por qué son el mismo Festival. Queda en la bitácora y en el historial.</summary>
    public string Motivo { get; set; } = string.Empty;
}

/// <summary>Una de las dos copias que se comparan antes de fusionar.</summary>
public sealed record CopiaComparadaDto(
    string Id,
    string Nombre,
    string Estado,
    string? NombreMunicipio,
    string? NombreDepartamento,
    IReadOnlyList<int> AniosDeEdiciones,
    int Ediciones);

/// <summary>
/// Un dato de las dos copias, lado a lado, con lo que la fusión hará con él (M3/T2, docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.8).
/// </summary>
/// <remarks>
/// <c>Resultado</c> dice qué pasa: <c>igual</c> (las dos dicen lo mismo), <c>conserva</c> (se queda
/// lo de este Festival; lo de la copia se descarta), <c>completa</c> (a este le falta y se completa con
/// el de la copia), <c>une</c> (una lista: se suman los valores de las dos) o <c>vacio</c> (ninguna lo
/// tiene). <c>QuedaAsi</c> es el valor que tendrá este Festival al terminar. <c>Clave</c> identifica
/// el dato para que la consola lo escriba con su vocabulario (estado, periodicidad).
/// </remarks>
public sealed record CampoComparadoDto(
    string Clave,
    string Etiqueta,
    string? EnLoQueSeConserva,
    string? EnLaCopia,
    string Resultado,
    string? QuedaAsi);

/// <summary>Lo que cuelga de la copia y pasará al Festival que se conserva.</summary>
public sealed record TrasladoDeFusionDto(
    int Ediciones,
    int Mercados,
    int Eventos,
    int Archivos,
    int Clasificaciones,
    int Reclamaciones,
    IReadOnlyList<int> AniosEnLasDos);

/// <summary>
/// La comparación de dos copias del mismo Festival histórico antes de fusionarlas.
/// </summary>
/// <remarks>
/// Es de solo lectura y no cambia ninguna regla: dice con los mismos criterios que usa la fusión
/// qué se conserva, qué se completa y qué se traslada. <c>Bloqueo</c> no es nulo cuando la fusión no
/// se permite (el mismo motivo que la lista de copias).
/// </remarks>
public sealed record ComparacionDeCopiasDto(
    CopiaComparadaDto Conservado,
    CopiaComparadaDto Absorbido,
    IReadOnlyList<CampoComparadoDto> Campos,
    TrasladoDeFusionDto Traslado,
    string? CodigoBloqueo,
    string? Bloqueo);

/// <summary>Lo que se movió al Festival que se conserva.</summary>
public sealed record ResultadoDeFusionDto(
    string FestivalId,
    string AbsorbidoId,
    int Ediciones,
    int Mercados,
    int Eventos,
    int Archivos,
    int Clasificaciones,
    int Reclamaciones,
    IReadOnlyList<string> DatosCompletados);

/// <summary>Una realización del Festival, con lo justo para reconocerla y abrirla.</summary>
public sealed record EdicionDelFestivalDto(
    string Id,
    int? Anio,
    int? NumeroEdicion,
    string? Nombre,
    DateOnly? FechaInicio,
    DateOnly? FechaFin,
    string EstadoVisibilidad,
    ProcedenciaDeRegistroDto? Procedencia);

/// <summary>
/// La ficha de un mercado musical en la consola: lo permanente, quién responde y de dónde vino.
/// </summary>
/// <remarks>
/// <b>ES LA PAREJA DE <see cref="FichaFestivalAdministrativaDto"/>, Y NO LA MISMA.</b> Un mercado
/// tiene alcance, modalidad y puede realizarse en el marco de un festival; un festival no tiene
/// nada de eso. Lo que sí es igual es el armazón —estado, territorio, organización responsable,
/// procedencia, clasificación y realizaciones—, porque es lo que hace que las dos fichas se lean
/// igual.
/// </remarks>
public sealed record FichaMercadoAdministrativaDto(
    string Id,
    string Nombre,
    string? Descripcion,
    string Estado,
    string NivelCobertura,
    string? Departamento,
    string? Municipio,
    string? LugarEspecifico,
    string? Periodicidad,
    string? Alcance,
    string? Modalidad,
    string? CorreoContacto,
    string? Telefono,
    string? SitioWeb,
    int? OrganizacionResponsableId,
    string? OrganizacionResponsableNombre,
    bool SeRealizaEnElMarcoDeUnFestival,
    int? FestivalId,
    string? FestivalNombre,
    ProcedenciaDeRegistroDto? Procedencia,
    IReadOnlyList<ElementoDeClasificacionDto> PracticasMusicales,
    IReadOnlyList<ElementoDeClasificacionDto> TerritoriosSonoros,
    IReadOnlyList<EdicionDelMercadoDto> Ediciones,
    DateTime FechaCreacion,
    DateTime? FechaActualizacion);

/// <summary>Una realización del mercado, con lo justo para reconocerla.</summary>
/// <remarks>
/// LOS DOS EJES DE ESTADO NO SE MEZCLAN: <c>EstadoVisibilidad</c> dice si el portal la enseña y
/// <c>Estado</c> describe el acontecimiento —en preparación, programada, realizada, cancelada—.
/// </remarks>
public sealed record EdicionDelMercadoDto(
    string Id,
    int Anio,
    int? NumeroEdicion,
    string? Nombre,
    DateOnly? FechaInicio,
    DateOnly? FechaFin,
    string Estado,
    string EstadoVisibilidad,
    ProcedenciaDeRegistroDto? Procedencia);

/// <summary>Lo que la consola envía para publicar, archivar o devolver a borrador un Festival.</summary>
/// <remarks>
/// LOS TRES ESTADOS Y NO LOS SIETE: los demás —en revisión, ajustes solicitados, aprobado,
/// rechazado— pertenecen al circuito de revisión del canal externo y escribirlos desde aquí
/// dejaría la bandeja diciendo cosas que nadie decidió en ella.
/// </remarks>
public sealed class CambioDePublicacionDeFestival
{
    public string Estado { get; set; } = string.Empty;
}

/// <summary>Lo que la consola envía para devolver un proceso a custodia institucional.</summary>
/// <remarks>
/// EL MOTIVO NO ES OPCIONAL. Quitarle a una organización la administración de su propio proceso es
/// la decisión más fuerte de esa pantalla, y dentro de un año nadie recordará por qué se tomó.
/// </remarks>
public sealed class LiberacionDeAdministracion
{
    public string Motivo { get; set; } = string.Empty;
}
