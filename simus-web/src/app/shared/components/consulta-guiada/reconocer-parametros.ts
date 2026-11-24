import { normalizar } from './buscar-preguntas';
import { CatalogosDeConsultaPublica, PreguntaPublica } from './consulta-guiada.service';

/**
 * Reconoce, dentro de lo que la persona escribió, los parámetros de las plantillas del banco público
 * («festivales en Nariño», «mercados de Bogotá en diciembre») POR COINCIDENCIA CON LOS CATÁLOGOS.
 *
 * <b>SIN IA Y SIN INVENTAR.</b> No genera nada: normaliza (minúsculas, sin tildes), busca nombres exactos de departamentos,
 * municipios, prácticas, territorios y organizaciones, y palabras de tipo de proceso o de mes, y escoge UNA plantilla ya
 * existente del banco. El resultado solo dice cuál plantilla y con qué valores; el servidor vuelve a validar todo
 * contra los mismos catálogos. Si no se entiende, devuelve `ninguno`; si falta un parámetro obligatorio, `pedir`.
 */
export interface Reconocimiento {
  estado: 'ejecutar' | 'pedir' | 'ninguno';
  pregunta?: PreguntaPublica;
  /** nombre del parámetro → identificador del catálogo (lo que viaja al servidor). */
  parametros: Record<string, string>;
  /** Parámetros obligatorios que no se encontraron. */
  faltantes: string[];
  /** Lo que se entendió, legible: «Departamento: Nariño». */
  entendido: string[];
  /** Un nombre de municipio que corresponde a varios; hay que elegir. */
  ambiguo?: string;
}

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type Categoria = 'org' | 'practica' | 'territorio' | 'depto' | 'muni';
interface Indice { mapas: Record<Categoria, Map<string, string[]>>; nombres: Map<string, string>; maximo: number }

const PRIORIDAD: Categoria[] = ['org', 'practica', 'territorio', 'depto', 'muni'];
const PALABRAS_DE_EVENTO = new Set(['evento', 'eventos', 'agenda', 'concierto', 'conciertos', 'actividad', 'actividades', 'proximo', 'proximos', 'proxima', 'proximas', 'cuando', 'calendario']);
const CUANTOS = new Set(['cuantos', 'cuantas', 'cantidad', 'numero', 'total']);
const RESERVADAS = new Set([...MESES, ...PALABRAS_DE_EVENTO, ...CUANTOS, 'festival', 'festivales', 'mercado', 'mercados', 'taller', 'talleres', 'espacio', 'espacios', 'red', 'redes', 'proceso', 'procesos', 'departamento', 'municipio', 'musical', 'musicales', 'practica', 'practicas', 'territorio', 'territorios', 'sonoro', 'sonoros', 'organizacion', 'organizaciones', 'mes', 'meses', 'luteria', 'hay', 'que', 'las', 'los', 'una', 'por', 'del', 'con', 'musica', 'sonora', 'sonoras']);

const indices = new WeakMap<CatalogosDeConsultaPublica, Indice>();

function alias(nombre: string): string[] {
  const n = normalizar(nombre);
  const salida = new Set<string>([n]);
  const antesDeComa = normalizar(nombre.split(',')[0]);
  salida.add(antesDeComa);
  for (const a of [n, antesDeComa]) {
    const sinArticulo = a.replace(/^(la|el|los|las) /, '');
    salida.add(sinArticulo);
    salida.add(sinArticulo.replace(/ d c$/, '').replace(/ dc$/, ''));
  }
  if (n.includes('san andres')) salida.add('san andres');
  if (n.startsWith('valle del cauca')) salida.add('valle');
  return [...salida].filter(a => a.length > 1);
}

function construir(cat: CatalogosDeConsultaPublica): Indice {
  const mapas: Indice['mapas'] = { org: new Map(), practica: new Map(), territorio: new Map(), depto: new Map(), muni: new Map() };
  const nombres = new Map<string, string>();
  let maximo = 1;
  const poner = (categoria: Categoria, clave: string, id: string, nombre: string) => {
    if (categoria !== 'depto' && !clave.includes(' ') && (clave.length < 4 || RESERVADAS.has(clave))) return;
    const ids = mapas[categoria].get(clave) ?? [];
    if (!ids.includes(id)) ids.push(id);
    mapas[categoria].set(clave, ids);
    nombres.set(`${categoria}:${id}`, nombre);
    maximo = Math.max(maximo, clave.split(' ').length);
  };
  cat.departamentos.forEach(d => alias(d.nombre).forEach(a => poner('depto', a, d.id, d.nombre)));
  cat.municipios.forEach(([codigo, nombre]) => alias(nombre).forEach(a => poner('muni', a, codigo, nombre)));
  cat.practicas.forEach(p => alias(p.nombre).forEach(a => poner('practica', a, p.id, p.nombre)));
  cat.territorios.forEach(t => alias(t.nombre).forEach(a => poner('territorio', a, t.id, t.nombre)));
  cat.organizaciones.forEach(o => alias(o.nombre).forEach(a => poner('org', a, o.id, o.nombre)));
  return { mapas, nombres, maximo };
}

function raices(palabra: string): string[] {
  const salida = [palabra];
  if (palabra.endsWith('es') && palabra.length > 4) salida.push(palabra.slice(0, -2));
  if (palabra.endsWith('s') && palabra.length > 3) salida.push(palabra.slice(0, -1));
  return salida;
}

export function reconocerParametros(
  texto: string, preguntas: readonly PreguntaPublica[], catalogos: CatalogosDeConsultaPublica | undefined, hoy: Date = new Date(),
): Reconocimiento {
  const vacio: Reconocimiento = { estado: 'ninguno', parametros: {}, faltantes: [], entendido: [] };
  if (!catalogos) return vacio;
  const tokens = normalizar(texto).split(' ').filter(Boolean);
  if (tokens.length === 0) return vacio;
  const indice = indices.get(catalogos) ?? construir(catalogos);
  indices.set(catalogos, indice);

  // 1. Nombres de catálogos: gana el más largo y, a igual largo, el orden de PRIORIDAD (Bogotá es departamento antes que municipio).
  const candidatos: { inicio: number; fin: number; categoria: Categoria; ids: string[] }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let n = Math.min(indice.maximo, tokens.length - i); n >= 1; n--) {
      const clave = tokens.slice(i, i + n).join(' ');
      for (const categoria of PRIORIDAD) {
        const ids = indice.mapas[categoria].get(clave);
        if (ids) candidatos.push({ inicio: i, fin: i + n, categoria, ids });
      }
    }
  }
  candidatos.sort((a, b) => (b.fin - b.inicio) - (a.fin - a.inicio) || PRIORIDAD.indexOf(a.categoria) - PRIORIDAD.indexOf(b.categoria));
  const usados = new Set<number>();
  const hallados: Partial<Record<Categoria, string[]>> = {};
  for (const c of candidatos) {
    const libres = Array.from({ length: c.fin - c.inicio }, (_, k) => c.inicio + k);
    if (libres.some(k => usados.has(k)) || hallados[c.categoria]) continue;
    libres.forEach(k => usados.add(k));
    hallados[c.categoria] = c.ids;
  }
  const restantes = tokens.filter((_, k) => !usados.has(k));

  // 2. Palabras sueltas: tipo, mes, año, intención.
  const tiposVistos = new Set<string>();
  for (const t of restantes) {
    for (const tipo of catalogos.tipos) if (raices(t).some(r => tipo.pistas.includes(r))) tiposVistos.add(tipo.id);
  }
  const tipo = tiposVistos.size === 1 ? [...tiposVistos][0] : undefined;
  let mes = restantes.map(t => MESES.indexOf(t) + 1).find(m => m > 0);
  let anio = restantes.find(t => /^20\d\d$/.test(t));
  if (!mes && /\beste mes\b/.test(tokens.join(' '))) { mes = hoy.getMonth() + 1; anio = String(hoy.getFullYear()); }
  const tiene = (...palabras: string[]) => restantes.some(t => palabras.some(p => t === p || t.startsWith(p)));
  const esEvento = restantes.some(t => PALABRAS_DE_EVENTO.has(t)) || !!mes || !!anio;
  const cuantos = restantes.some(t => CUANTOS.has(t)) || tokens.join(' ').includes('por departamento');

  const porMes = !mes && (tokens.join(' ').includes('por mes') || (restantes.some(t => t === 'mes' || t === 'meses') && cuantos));

  // 3. Territorio y desambiguación de municipios.
  let departamento = hallados.depto?.[0];
  let municipio: string | undefined;
  let ambiguo: string | undefined;
  if (hallados.muni) {
    const delDepto = departamento ? hallados.muni.filter(c => c.startsWith(departamento!)) : hallados.muni;
    if (delDepto.length === 1) municipio = delDepto[0];
    else if (delDepto.length > 1) ambiguo = indice.nombres.get(`muni:${delDepto[0]}`);
    else municipio = hallados.muni.length === 1 ? hallados.muni[0] : undefined;
    if (municipio && departamento && !municipio.startsWith(departamento)) departamento = undefined;
  }
  const practica = hallados.practica?.[0];
  const territorio = hallados.territorio?.[0];
  const organizacion = hallados.org?.[0];

  // 4. Qué plantilla.
  let id: string | undefined;
  if (tiene('complet', 'calidad')) id = 'publica_completitud_del_dato';
  else if (organizacion) id = 'publica_procesos_de_organizacion';
  else if (tiene('organizacion') && tiene('mas', 'mayor', 'activ', 'ranking')) id = 'publica_organizaciones_con_mas_procesos';
  else if (tiene('organizacion')) id = 'publica_procesos_de_organizacion';
  else if (porMes) id = 'publica_agenda_por_mes';
  else if (esEvento) id = 'publica_agenda_filtrada';
  else if (practica) id = 'publica_festivales_con_practica';
  else if (territorio) id = 'publica_festivales_con_territorio';
  else if (tiene('practica') && (departamento || municipio)) id = 'publica_practicas_en_departamento';
  else if (tiene('practica')) id = 'publica_practicas_musicales';
  else if (tiene('territorio')) id = 'publica_festivales_con_territorio';
  else if (tipo) {
    id = municipio || ambiguo ? `publica_${tipo}_en_municipio`
      : departamento ? `publica_${tipo}_en_departamento`
      : cuantos ? `publica_${tipo}_por_departamento`
      : `publica_${tipo}_en_departamento`;
  } else if (municipio || ambiguo) id = 'publica_procesos_en_municipio';
  else if (departamento) id = 'publica_procesos_en_departamento';
  else if (cuantos && tiene('departamento')) id = 'publica_procesos_por_departamento';
  else if (tiene('proceso') || cuantos) id = 'publica_procesos_por_tipo';

  const pregunta = id ? preguntas.find(p => p.id === id) : undefined;
  if (!pregunta) return vacio;

  // 5. Solo los parámetros que la plantilla declara; los obligatorios que falten se piden con selector.
  const todos: Record<string, string | undefined> = {
    departamento, municipio, tipo, practica, territorio, organizacion, mes: mes ? String(mes) : undefined, anio,
  };
  if (pregunta.id === 'publica_agenda_filtrada' && municipio) delete todos['departamento'];
  const parametros: Record<string, string> = {};
  for (const p of pregunta.parametros) if (todos[p.nombre]) parametros[p.nombre] = todos[p.nombre]!;
  const faltantes = pregunta.parametros.filter(p => p.obligatorio && !parametros[p.nombre]).map(p => p.nombre);
  const nombreDe = (nombre: string, valor: string): string => {
    switch (nombre) {
      case 'departamento': return indice.nombres.get(`depto:${valor}`) ?? valor;
      case 'municipio': return indice.nombres.get(`muni:${valor}`) ?? valor;
      case 'practica': return indice.nombres.get(`practica:${valor}`) ?? valor;
      case 'territorio': return indice.nombres.get(`territorio:${valor}`) ?? valor;
      case 'organizacion': return indice.nombres.get(`org:${valor}`) ?? valor;
      case 'tipo': return catalogos.tipos.find(t => t.id === valor)?.plural ?? valor;
      case 'mes': return MESES[Number(valor) - 1] ?? valor;
      default: return valor;
    }
  };
  const entendido = pregunta.parametros.filter(p => parametros[p.nombre]).map(p => `${p.rotulo}: ${nombreDe(p.nombre, parametros[p.nombre])}`);
  return { estado: faltantes.length === 0 ? 'ejecutar' : 'pedir', pregunta, parametros, faltantes, entendido, ambiguo };
}
