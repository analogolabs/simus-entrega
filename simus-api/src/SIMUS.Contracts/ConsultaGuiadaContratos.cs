namespace SIMUS.Contracts;

/// <summary>Una pregunta que el catálogo sabe resolver.</summary>
public sealed record ConsultaOfrecidaDto(string Id, string Rotulo, string Descripcion);

/// <summary>
/// Qué puede responder la Consulta Guiada para quien pregunta, y desde dónde.
/// </summary>
/// <remarks>
/// <b>EL CATALOGO DEPENDE DE QUIEN PREGUNTA.</b> Un funcionario del Programa ve las consultas
/// institucionales; una organización, las suyas. No es la misma lista filtrada en pantalla: es lo
/// que el servidor está dispuesto a responderle, y por eso viaja resuelto desde el servidor.
/// </remarks>
public sealed record EstadoDeConsultaGuiadaDto(
    bool Disponible,
    bool ModeloLocalDisponible,
    string Modo,
    string Mensaje,
    IReadOnlyList<ConsultaOfrecidaDto> Consultas,
    IReadOnlyList<string> Sugerencias);

/// <summary>
/// Desde dónde se pregunta, para que la respuesta hable de lo que la persona está mirando.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUE EXISTE.</b> Hasta la Consulta Guiada vivía en una sola
/// pantalla y respondía siempre de toda la operación. Preguntar «¿qué está incompleto?» mientras se
/// mira un Festival concreto devolvía el conteo de los seiscientos, que no es la pregunta que se
/// hizo.
/// </para>
/// <para>
/// <b>EL CONTEXTO NO AMPLIA PERMISOS, LOS ACOTA.</b> El servidor comprueba que quien pregunta pueda
/// ver eso: pedir el contexto de una organización ajena no abre sus datos, los cierra con un 403.
/// </para>
/// <para>
/// <b>Y SI LA CONSULTA NO SE PUEDE ACOTAR, SE DICE.</b> La respuesta siempre declara sobre qué se
/// calculó. Responder de toda la operación una pregunta hecha desde dentro de un Festival, sin
/// avisar, es peor que no acotar: parece una respuesta sobre ese Festival.
/// </para>
/// </remarks>
public sealed class ContextoDeConsultaDto
{
    /// <summary>La sección desde la que se pregunta, tal como la nombra la navegación.</summary>
    public string? Seccion { get; set; }

    /// <summary>La organización sobre la que se pregunta, si la pantalla está dentro de una.</summary>
    public int? OrganizacionId { get; set; }

    /// <summary>El Festival sobre el que se pregunta, si la pantalla está dentro de uno.</summary>
    public int? FestivalId { get; set; }
}

/// <summary>Entrada de la Consulta Guiada. El servidor recorta e interpreta esta pregunta.</summary>
public sealed class PreguntaDeConsultaGuiadaDto
{
    public string? Pregunta { get; set; }

    /// <summary>Desde dónde se pregunta. Opcional: sin él la respuesta es de toda la operación.</summary>
    public ContextoDeConsultaDto? Contexto { get; set; }
}

/// <summary>Tabla agregada que prueba de dónde salió una respuesta.</summary>
/// <remarks>
/// <c>Destinos</c> es opcional y va alineado con <c>Filas</c>: la ruta interna del portal (siempre relativa, «/agenda/mi-evento»)
/// a la que lleva cada fila, o <c>null</c> si esa fila no tiene destino. La celda <c>ColumnaDeEnlace</c> es la que se pinta como enlace.
/// La tabla y la fuente no cambian: el enlace solo añade el camino hacia la ficha.
/// </remarks>
public sealed record TablaDeConsultaDto(
    string Titulo,
    string Fuente,
    string Alcance,
    IReadOnlyList<string> Columnas,
    IReadOnlyList<IReadOnlyList<string>> Filas,
    IReadOnlyList<string?>? Destinos = null,
    int ColumnaDeEnlace = 0,
    IReadOnlyList<string>? FiltrosAplicados = null);

/// <summary>Respuesta verificable de la Consulta Guiada.</summary>
/// <remarks>
/// <c>Contexto</c> DICE SOBRE QUE SE CALCULO —«Toda la operación», «Festival de la Candelaria»— y no
/// es decorativo: es la única forma de que quien lee la cifra sepa si responde a lo que preguntó.
/// </remarks>
public sealed record RespuestaDeConsultaGuiadaDto(
    string Respuesta,
    string ConsultaElegida,
    string ResueltoPor,
    DateTime GeneradoEn,
    TablaDeConsultaDto? Consulta,
    string Contexto);

/// <summary>Indicador agregado del tablero de análisis.</summary>
public sealed record IndicadorAnalisisAdministrativoDto(string Id, string Rotulo, int Total, string Alcance);

/// <summary>
/// Fotografía operacional que se puede mostrar aunque no haya clasificador local.
/// </summary>
/// <remarks>
/// SIGUE SIENDO ADMINISTRATIVO Y POR ESO CONSERVA EL NOMBRE: el tablero mira toda la operación del
/// Programa, no es una capacidad transversal como la Consulta Guiada.
/// </remarks>
public sealed record TableroAnalisisAdministrativoDto(
    DateTime GeneradoEn,
    IReadOnlyList<IndicadorAnalisisAdministrativoDto> Indicadores,
    IReadOnlyList<IReadOnlyList<string>> EstadosFestival,
    /// <summary>Mercados musicales por estado. Entro: un modulo del Ecosistema se ve en el tablero como Festivales.</summary>
    IReadOnlyList<IReadOnlyList<string>> EstadosMercado,
    IReadOnlyList<IReadOnlyList<string>> DepartamentosPrincipales,
    /// <summary>
    /// Procesos con la sede principal pendiente de completar, por tipo (fila: tipo, total). Es de
    /// toda la operación: el filtro de territorio del tablero no lo acota (decisión 124).
    /// </summary>
    IReadOnlyList<IReadOnlyList<string>>? SedesPendientes = null,
    /// <summary>El territorio por el que se acotó el tablero («Huila», «Neiva, Huila»), o nulo si es todo el país.</summary>
    string? AcotadoA = null);

/// <summary>Un parámetro tipado de una pregunta del banco público: qué se pide y de qué catálogo sale su valor.</summary>
/// <param name="Nombre">departamento · municipio · tipo · practica · territorio · organizacion · mes · anio.</param>
/// <param name="Rotulo">Cómo se llama en el selector («Departamento»).</param>
/// <param name="Obligatorio">Si la pregunta no se puede ejecutar sin él.</param>
public sealed record ParametroDePreguntaDto(string Nombre, string Rotulo, bool Obligatorio);

/// <summary>Una pregunta del banco público, con los parámetros que admite (vacío si es fija).</summary>
/// <param name="Ambito">«publico»: lo fija el endpoint del portal (solo registros publicados), nunca el texto de quien pregunta.</param>
/// <param name="Ejemplos">3 a 6 formulaciones de ejemplo; con el <c>Rotulo</c> canónico, insumo para precalcular vectores de la capa semántica.</param>
public sealed record PreguntaPublicaDto(
    string Id, string Rotulo, string Descripcion, IReadOnlyList<ParametroDePreguntaDto> Parametros,
    string Ambito, IReadOnlyList<string> Ejemplos);

/// <summary>Un valor de catálogo: el identificador que viaja y el nombre que se lee.</summary>
public sealed record ValorDeCatalogoDto(string Id, string Nombre);

/// <summary>Un tipo de proceso del portal y las palabras con que se nombra.</summary>
public sealed record TipoDeProcesoPublicoDto(string Id, string Singular, string Plural, IReadOnlyList<string> Pistas);

/// <summary>
/// Los catálogos contra los que se validan los parámetros y con los que el cajón reconoce lo escrito.
/// </summary>
/// <remarks>
/// <c>Municipios</c> viaja compacto —cada fila es [código, nombre]; el departamento son los dos primeros dígitos del código—
/// porque son unos mil cien. Nada de esto es dato personal: son los nombres de la división político-administrativa, los
/// catálogos musicales y las organizaciones con ficha pública.
/// </remarks>
public sealed record CatalogosDeConsultaPublicaDto(
    IReadOnlyList<ValorDeCatalogoDto> Departamentos,
    IReadOnlyList<IReadOnlyList<string>> Municipios,
    IReadOnlyList<TipoDeProcesoPublicoDto> Tipos,
    IReadOnlyList<ValorDeCatalogoDto> Practicas,
    IReadOnlyList<ValorDeCatalogoDto> Territorios,
    IReadOnlyList<ValorDeCatalogoDto> Organizaciones);

/// <summary>
/// Lo que ofrece la Consulta Guiada del portal público: un banco cerrado de preguntas marcadas como públicas.
/// </summary>
/// <remarks>
/// <b>NO HAY TEXTO LIBRE EN EL SERVIDOR.</b> Quien consulta elige una pregunta del banco y, si tiene parámetros, los valores
/// de los catálogos; el servidor no interpreta frases ni las manda a ningún modelo. Reconocer «festivales en Nariño» dentro de
/// lo escrito lo hace el cajón contra estos mismos catálogos, y lo que ejecuta es siempre una pregunta del banco.
/// </remarks>
public sealed record EstadoDeConsultaGuiadaPublicaDto(
    bool Disponible,
    string Modo,
    string Mensaje,
    IReadOnlyList<PreguntaPublicaDto> Preguntas,
    CatalogosDeConsultaPublicaDto Catalogos);

/// <summary>La pregunta elegida del banco público, por su identificador, y los valores de sus parámetros.</summary>
public sealed class ConsultaPublicaSolicitudDto
{
    public string? PreguntaId { get; set; }

    /// <summary>nombre del parámetro → identificador del catálogo («departamento» → «52»). Se valida contra los catálogos.</summary>
    public Dictionary<string, string>? Parametros { get; set; }
}
