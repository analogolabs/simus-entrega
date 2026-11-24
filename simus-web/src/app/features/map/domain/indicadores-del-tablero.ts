/**
 * Las fichas de los indicadores del tablero: qué dice cada cifra, cómo se calcula y qué NO dice.
 *
 * <b>UNA FICHA POR INDICADOR, A LA VISTA DESDE EL GRAFICO.</b> Es el criterio de gobernanza de la
 * plataforma: quien cita una cifra de SIMUS tiene que poder saber su definición, fórmula, unidad,
 * fuente, periodo, cobertura, actualización y límites sin salir de la pantalla. Las fichas viven aquí,
 * en un solo archivo, y no repartidas por las plantillas: un cambio de método se corrige en un sitio.
 *
 * <b>LO QUE TODAS DICEN IGUAL, A PROPOSITO:</b> son registros de la plataforma, no el universo de
 * agentes ni de procesos del país. Que un departamento tenga cero no prueba que no haya actividad,
 * solo que nadie la ha registrado y publicado.
 */
export interface FichaDeIndicador {
  readonly id: 'registros-por-departamento' | 'composicion-declarada' | 'ediciones-por-anio' | 'eventos-por-mes'
    | 'avanzado-barras' | 'avanzado-mosaico' | 'avanzado-flujo' | 'avanzado-matriz' | 'avanzado-red';
  readonly nombre: string;
  readonly definicion: string;
  readonly formula: string;
  readonly unidad: string;
  readonly fuente: string;
  readonly periodo: string;
  readonly cobertura: string;
  readonly actualizacion: string;
  readonly limitaciones: string;
}

const FUENTE_PUBLICA = 'Lecturas públicas de SIMUS (solo lo publicado tras la revisión del PNMC).';

export const FICHAS_DE_INDICADORES: readonly FichaDeIndicador[] = [
  {
    id: 'registros-por-departamento',
    nombre: 'Registros por departamento',
    definicion: 'Cuántos registros publicados de la capa elegida tienen su sede principal en cada departamento.',
    formula: 'Conteo de registros publicados agrupados por el departamento de su sede principal.',
    unidad: 'Registros (un registro cuenta una vez).',
    fuente: FUENTE_PUBLICA,
    periodo: 'Estado actual de lo publicado; no es una serie histórica.',
    cobertura: 'Los 33 departamentos de la cartografía DANE; un registro sin sede resoluble no entra.',
    actualizacion: 'Al abrir la vista: lee las listas públicas en ese momento.',
    limitaciones: 'Cuenta registros de la plataforma, no la población real de procesos. Es una cifra absoluta: un departamento grande o muy poblado tendrá más sin ser por ello más activo; no se normaliza por población.',
  },
  {
    id: 'composicion-declarada',
    nombre: 'Territorios sonoros y prácticas declarados',
    definicion: 'Cuántas veces declaran los registros publicados cada territorio sonoro (los 14 del Plan) o cada práctica musical.',
    formula: 'Conteo de declaraciones por valor del catálogo; un registro que declara varios cuenta en todos. La cuota es declaraciones sobre registros, no sobre la suma.',
    unidad: 'Declaraciones; la cuota se da en % de los registros.',
    fuente: FUENTE_PUBLICA,
    periodo: 'Estado actual de lo publicado.',
    cobertura: 'Registros de la capa y el departamento elegidos.',
    actualizacion: 'Al abrir la vista.',
    limitaciones: 'La clasificación la declara el propio proceso, no una verificación externa. «Sin clasificar» es dato que falta, no un grupo. Las cuotas pueden sumar más de 100 %.',
  },
  {
    id: 'ediciones-por-anio',
    nombre: 'Ediciones publicadas por año',
    definicion: 'Cuántas ediciones publicadas de Festivales y Mercados corresponden a cada año.',
    formula: 'Conteo de ediciones con visibilidad «publicada» agrupadas por año de la edición, tipo de proceso y departamento de la sede del proceso.',
    unidad: 'Ediciones.',
    fuente: 'Servidor de SIMUS, /publico/analitica/ecosistema/evolucion (ediciones de Festivales y de Mercados publicados).',
    periodo: 'Año de la edición (fecha de ocurrencia declarada), no la fecha en que se registró en SIMUS.',
    cobertura: 'Solo Festivales y Mercados; otras capas no registran ediciones por año.',
    actualizacion: 'Al abrir la vista.',
    limitaciones: 'Una edición que nadie cargó no aparece: la caída de una serie puede ser falta de registro y no menos actividad. Los años sin ediciones se muestran en cero.',
  },
  {
    id: 'eventos-por-mes',
    nombre: 'Eventos de la Agenda por mes',
    definicion: 'Cuántos eventos publicados de la Agenda empiezan en cada mes del año.',
    formula: 'Conteo de eventos por mes de su fecha de inicio, sumando todos los años que la Agenda trae.',
    unidad: 'Eventos.',
    fuente: 'Agenda pública de SIMUS.',
    periodo: 'Eventos publicados en la Agenda; el mes es el de la fecha de inicio.',
    cobertura: 'Eventos con departamento; sigue el departamento elegido. No depende de la capa.',
    actualizacion: 'Al abrir la vista.',
    limitaciones: 'Junta años en un solo calendario: muestra estacionalidad, no evolución. Solo refleja eventos cargados en la Agenda.',
  },
  {
    id: 'avanzado-barras',
    nombre: 'Registros por departamento y tipo de proceso',
    definicion: 'Cuántos registros publicados hay en cada departamento, repartidos por tipo de proceso (festival, mercado, escuela, red, lutería, espacio).',
    formula: 'Conteo de registros publicados por departamento de su sede y por capa de origen; cada registro cuenta una vez.',
    unidad: 'Registros.',
    fuente: FUENTE_PUBLICA,
    periodo: 'Estado actual de lo publicado; no es una serie histórica.',
    cobertura: 'Todos los departamentos con registros y los tipos de proceso elegidos; un registro sin departamento no entra.',
    actualizacion: 'Al abrir la vista.',
    limitaciones: 'Registros de la plataforma, no el universo de procesos. Cifra absoluta: no se normaliza por población. Al agrupar por práctica o por territorio sonoro, un registro que declara varios cuenta en todos y las barras suman más que los registros.',
  },
  {
    id: 'avanzado-mosaico',
    nombre: 'Tipo de proceso, departamento y práctica',
    definicion: 'De qué está hecho el conjunto de registros, en tres niveles que se recorren con un clic: tipo de proceso, departamento y práctica musical declarada.',
    formula: 'Conteo por tipo de proceso; dentro de cada uno, por departamento; dentro de cada departamento, por práctica declarada («Sin declarar» cuando no hay).',
    unidad: 'Declaraciones (un registro que declara varias prácticas cuenta en todas; en los dos primeros niveles cuenta una vez).',
    fuente: FUENTE_PUBLICA,
    periodo: 'Estado actual de lo publicado.',
    cobertura: 'Registros de los tipos de proceso elegidos.',
    actualizacion: 'Al abrir la vista.',
    limitaciones: 'La clasificación la declara el proceso y no se verifica. El tercer nivel puede sumar más que los registros del departamento porque una práctica no excluye a otra.',
  },
  {
    id: 'avanzado-flujo',
    nombre: 'Reparto en tres pasos: tipo de proceso, departamento y práctica',
    definicion: 'Diagrama aluvial que sigue a los registros desde su tipo de proceso hasta su departamento y su práctica principal declarada.',
    formula: 'Cada registro aporta un hilo: tipo de proceso, departamento de la sede y primera práctica declarada («Sin declarar» si no hay). Los departamentos y prácticas menos frecuentes se agrupan en «Otros».',
    unidad: 'Registros (un hilo por registro).',
    fuente: FUENTE_PUBLICA,
    periodo: 'Estado actual de lo publicado.',
    cobertura: 'Registros de los tipos de proceso elegidos.',
    actualizacion: 'Al abrir la vista.',
    limitaciones: 'No es un movimiento: las bandas dicen cómo se reparten los registros, no que algo pase de un lugar a otro. Usa solo la primera práctica declarada de cada registro. El flujo territorial real (sede de la organización hacia el departamento del proceso) necesita un dato agregado que aún no se sirve.',
  },
  {
    id: 'avanzado-red',
    nombre: 'Relaciones registradas entre organizaciones, procesos, territorios y prácticas',
    definicion: 'Con quién se conecta cada organización, festival, mercado, territorio sonoro o práctica musical según lo que está registrado y publicado.',
    formula: 'Cada línea es una relación escrita en la base: la organización responsable de un festival o mercado, el territorio sonoro o la práctica que declara y el festival en cuyo marco se realiza un mercado. Se cuenta una línea por relación; el tamaño del nodo crece con sus relaciones.',
    unidad: 'Relaciones registradas (una por línea).',
    fuente: 'Servidor de SIMUS, /publico/analitica/ecosistema/red (solo festivales y mercados publicados; sin personas).',
    periodo: 'Estado actual de lo publicado.',
    cobertura: 'Festivales y mercados publicados, con su organización responsable (los registros históricos en custodia del PNMC no se atribuyen a ninguna organización), territorios sonoros y prácticas declarados. Escuelas, redes de documentación, luthiers y espacios aún no se sirven en esta red.',
    actualizacion: 'Al abrir la pestaña.',
    limitaciones: 'No se infiere ninguna relación: que dos territorios aparezcan alrededor del mismo festival no los une entre sí. La falta de una línea significa que nadie la ha registrado, no que no exista. La red se recorta si supera el tope de nodos del servidor y, a la vista, muestra solo los vecinos que se piden.',
  },
  {
    id: 'avanzado-matriz',
    nombre: 'Coincidencias entre dos clasificaciones',
    definicion: 'Cuántos registros declaran a la vez dos valores: práctica y territorio sonoro, práctica y departamento, o territorio sonoro y departamento.',
    formula: 'Conteo de registros que declaran ambos valores. Se muestran los valores más frecuentes de cada eje.',
    unidad: 'Registros.',
    fuente: FUENTE_PUBLICA,
    periodo: 'Estado actual de lo publicado.',
    cobertura: 'Registros de los tipos de proceso elegidos que declaran ambos valores.',
    actualizacion: 'Al abrir la vista.',
    limitaciones: 'Coexistencia, no relación: que dos valores aparezcan juntos en un registro no prueba que se deriven uno del otro. Se muestran los diez valores más frecuentes de cada eje y «Sin declarar» no se cruza: dos datos que faltan no dicen nada.',
  },
];

export const fichaDelIndicador = (id: FichaDeIndicador['id']): FichaDeIndicador =>
  FICHAS_DE_INDICADORES.find((ficha) => ficha.id === id) as FichaDeIndicador;
