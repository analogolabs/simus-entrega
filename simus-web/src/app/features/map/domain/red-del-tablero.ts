import type { AristaDeRed, NodoDeRed, RedDelEcosistema, TipoDeArista, TipoDeNodo } from '../../../core/services/red-del-ecosistema.service';
import type { EChartsCoreOption } from 'echarts/core';
import { ZOOM_MAXIMO, ZOOM_MINIMO } from './lienzo-de-red';
import { GRIS_SIN_DATO, TINTA, TINTA_SUAVE } from './opciones-del-tablero';

/**
 * La red del tablero: qué se enseña de la red registrada para el ámbito elegido, cómo se recorre
 * (ego-red expandible) y cómo se dibuja.
 *
 * <b>SOLO RELACIONES REGISTRADAS.</b> Las aristas vienen del servidor tal como están en la base
 * (organización responsable, clasificación declarada, mercado en el marco de un festival); aquí no se
 * crea ninguna. Filtrar o expandir quita o muestra nodos, nunca inventa vínculos entre los que
 * quedan: dos territorios que comparten un festival NO quedan unidos entre sí, lo están ambos con el festival.
 */
export const TIPOS_DE_NODO: readonly TipoDeNodo[] = ['organizacion', 'festival', 'mercado', 'territorio', 'practica'];

export const ROTULO_DE_NODO: Readonly<Record<TipoDeNodo, string>> = {
  organizacion: 'Organización', festival: 'Festival', mercado: 'Mercado', territorio: 'Territorio sonoro', practica: 'Práctica musical',
};

/** Colores validados contra daltonismo y reforzados con la forma del nodo, que es la otra señal. */
export const COLOR_DE_NODO: Readonly<Record<TipoDeNodo, string>> = {
  festival: '#7a2f97', mercado: '#c88011', organizacion: '#d33068', territorio: '#109db5', practica: '#4f7a22',
};
const FORMA_DE_NODO: Readonly<Record<TipoDeNodo, string>> = {
  festival: 'circle', mercado: 'diamond', organizacion: 'rect', territorio: 'triangle', practica: 'pin',
};

/** La relación dicha en palabras, desde el origen hacia el destino. */
export function rotuloDeArista(tipo: TipoDeArista, tipoDeDestino: TipoDeNodo): string {
  if (tipo === 'responsable') return 'es responsable de';
  if (tipo === 'en_el_marco') return 'se realiza en el marco de';
  return tipoDeDestino === 'practica' ? 'declara la práctica' : 'declara el territorio sonoro';
}

/** La relación vista desde el otro extremo. */
export function rotuloInverso(tipo: TipoDeArista, tipoDeOrigen: TipoDeNodo): string {
  if (tipo === 'responsable') return 'tiene como responsable a';
  if (tipo === 'en_el_marco') return 'incluye el mercado';
  return tipoDeOrigen === 'mercado' ? 'declarado por el mercado' : 'declarado por el festival';
}

/** Cuántos vecinos se muestran al ampliar un nodo, y el tope de nodos a la vista. */
export const VECINOS_POR_NODO = 8;
export const MAXIMO_DE_NODOS_A_LA_VISTA = 120;
/** Cuántos nodos llevan etiqueta siempre visible (además del elegido, sus vecinos y los ampliados). */
const ETIQUETAS_PRINCIPALES = 10;

export interface AmbitoDeLaRed {
  /** Departamento normalizado, o vacío para todo el país. */
  readonly departamento: string;
  /** Qué procesos se ven: `null` todos, o la lista de tipos. */
  readonly procesos: readonly ('festival' | 'mercado')[] | null;
  /** Nombre del territorio sonoro o de la práctica por la que se filtra, o vacío. */
  readonly territorio?: string;
  readonly practica?: string;
  /** Qué tipos de nodo se dibujan; `null` o vacío = todos. */
  readonly tiposDeNodo?: readonly TipoDeNodo[] | null;
}

export function filtrarRed(
  red: RedDelEcosistema,
  ambito: AmbitoDeLaRed,
  normalizar: (nombre: string) => string,
): RedDelEcosistema {
  const porId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  const declaradosPor = (proceso: string, tipo: TipoDeNodo): Set<string> => new Set(red.aristas
    .filter((a) => a.origen === proceso && a.tipo === 'declara' && porId.get(a.destino)?.tipo === tipo)
    .map((a) => porId.get(a.destino)!.nombre));
  const procesos = new Set(red.nodos
    .filter((nodo) => (nodo.tipo === 'festival' || nodo.tipo === 'mercado')
      && (!ambito.procesos || ambito.procesos.includes(nodo.tipo))
      && (!ambito.departamento || normalizar(nodo.departamento) === ambito.departamento)
      && (!ambito.territorio || declaradosPor(nodo.id, 'territorio').has(ambito.territorio))
      && (!ambito.practica || declaradosPor(nodo.id, 'practica').has(ambito.practica)))
    .map((nodo) => nodo.id));
  const aristas = red.aristas.filter((arista) => {
    if (arista.tipo === 'en_el_marco') return procesos.has(arista.origen) && procesos.has(arista.destino);
    // organización → proceso: el proceso es el destino; proceso → territorio o práctica: el proceso es el origen.
    return procesos.has(arista.tipo === 'responsable' ? arista.destino : arista.origen);
  });
  const usados = new Set<string>([...procesos]);
  for (const arista of aristas) { usados.add(arista.origen); usados.add(arista.destino); }
  let nodos = red.nodos.filter((nodo) => usados.has(nodo.id));
  let finales = aristas;
  const tipos = ambito.tiposDeNodo ?? [];
  if (tipos.length > 0 && tipos.length < TIPOS_DE_NODO.length) {
    nodos = nodos.filter((nodo) => tipos.includes(nodo.tipo));
    const vivos = new Set(nodos.map((nodo) => nodo.id));
    finales = aristas.filter((a) => vivos.has(a.origen) && vivos.has(a.destino));
  }
  return { nodos, aristas: finales, truncada: red.truncada };
}

/** Cuántas relaciones registradas tiene cada nodo. */
export function gradoDeLosNodos(red: RedDelEcosistema): Map<string, number> {
  const grado = new Map<string, number>();
  for (const arista of red.aristas) {
    grado.set(arista.origen, (grado.get(arista.origen) ?? 0) + 1);
    grado.set(arista.destino, (grado.get(arista.destino) ?? 0) + 1);
  }
  return grado;
}

const porGradoYNombre = (grado: Map<string, number>) => (a: NodoDeRed, b: NodoDeRed) =>
  (grado.get(b.id) ?? 0) - (grado.get(a.id) ?? 0) || a.nombre.localeCompare(b.nombre, 'es');

/** Los nodos con que se abre la red: los más conectados, ya ampliados. Sin relaciones, ninguno. */
export function semillasDeLaRed(red: RedDelEcosistema, cantidad = 3): string[] {
  const grado = gradoDeLosNodos(red);
  return [...red.nodos].filter((n) => (grado.get(n.id) ?? 0) > 0).sort(porGradoYNombre(grado)).slice(0, cantidad).map((n) => n.id);
}

/** Los vecinos registrados de un nodo, los más conectados primero. */
export function vecinosDe(red: RedDelEcosistema, id: string): NodoDeRed[] {
  const porId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  const grado = gradoDeLosNodos(red);
  const ids = new Set<string>();
  for (const arista of red.aristas) {
    if (arista.origen === id) ids.add(arista.destino);
    if (arista.destino === id) ids.add(arista.origen);
  }
  return [...ids].map((v) => porId.get(v)).filter((n): n is NodoDeRed => !!n).sort(porGradoYNombre(grado));
}

export interface EstadoDeLaExploracion {
  /** Los nodos ampliados: se ven ellos y sus vecinos (hasta el límite de cada uno). */
  readonly expandidos: readonly string[];
  /** Cuántos vecinos más de lo habitual se piden por nodo («ver más»). */
  readonly extra: Readonly<Record<string, number>>;
}

export interface VistaDeLaRed {
  readonly red: RedDelEcosistema;
  /** Vecinos que quedan sin mostrar, por nodo ampliado: de ahí sale «ver más». */
  readonly ocultos: Readonly<Record<string, number>>;
  /** Si se llegó al tope de nodos a la vista. */
  readonly recortada: boolean;
}

/** La ego-red visible: los nodos ampliados y una porción de sus vecinos, con las relaciones registradas entre los que se ven. */
export function vistaDeLaRed(red: RedDelEcosistema, estado: EstadoDeLaExploracion): VistaDeLaRed {
  const existentes = new Set(red.nodos.map((n) => n.id));
  const ampliados = estado.expandidos.filter((id) => existentes.has(id));
  const visibles = new Set<string>(ampliados);
  const ocultos: Record<string, number> = {};
  let recortada = false;
  for (const id of ampliados) {
    const vecinos = vecinosDe(red, id);
    const limite = VECINOS_POR_NODO + (estado.extra[id] ?? 0);
    let mostrados = 0;
    for (const vecino of vecinos) {
      if (mostrados >= limite) break;
      if (!visibles.has(vecino.id)) {
        if (visibles.size >= MAXIMO_DE_NODOS_A_LA_VISTA) { recortada = true; break; }
        visibles.add(vecino.id);
      }
      mostrados += 1;
    }
    ocultos[id] = vecinos.filter((v) => !visibles.has(v.id)).length;
  }
  return {
    red: {
      nodos: red.nodos.filter((n) => visibles.has(n.id)),
      aristas: red.aristas.filter((a) => visibles.has(a.origen) && visibles.has(a.destino)),
      truncada: red.truncada,
    },
    ocultos,
    recortada,
  };
}

const sinAcentos = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Búsqueda de un nodo por su nombre, sin acentos ni mayúsculas; primero los que empiezan por lo escrito. */
export function buscarNodos(red: RedDelEcosistema, texto: string, maximo = 8): NodoDeRed[] {
  const buscado = sinAcentos(texto);
  if (buscado.length < 2) return [];
  const grado = gradoDeLosNodos(red);
  return red.nodos
    .map((nodo) => ({ nodo, nombre: sinAcentos(nodo.nombre) }))
    .filter((x) => x.nombre.includes(buscado))
    .sort((a, b) => Number(b.nombre.startsWith(buscado)) - Number(a.nombre.startsWith(buscado)) || porGradoYNombre(grado)(a.nodo, b.nodo))
    .slice(0, maximo).map((x) => x.nodo);
}

/** Con quién se relaciona un nodo, con la relación dicha en palabras y desde qué lado. */
export function vinculosDe(red: RedDelEcosistema, id: string): { nodo: NodoDeRed; relacion: string }[] {
  const porId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  const vinculos: { nodo: NodoDeRed; relacion: string }[] = [];
  for (const arista of red.aristas) {
    const origen = porId.get(arista.origen);
    const destino = porId.get(arista.destino);
    if (!origen || !destino) continue;
    if (arista.origen === id) vinculos.push({ nodo: destino, relacion: rotuloDeArista(arista.tipo, destino.tipo) });
    if (arista.destino === id) vinculos.push({ nodo: origen, relacion: rotuloInverso(arista.tipo, origen.tipo) });
  }
  return vinculos.sort((a, b) => a.nodo.tipo.localeCompare(b.nodo.tipo) || a.nodo.nombre.localeCompare(b.nodo.nombre, 'es'));
}

/** La alternativa tabular completa: una fila por relación registrada, en palabras. */
export function tablaDeVinculos(red: RedDelEcosistema): { clave: string; celdas: [string, string, string, string] }[] {
  const porId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  return red.aristas.flatMap((arista: AristaDeRed) => {
    const origen = porId.get(arista.origen);
    const destino = porId.get(arista.destino);
    if (!origen || !destino) return [];
    return [{
      clave: `${arista.origen}>${arista.destino}`,
      celdas: [origen.nombre, ROTULO_DE_NODO[origen.tipo], rotuloDeArista(arista.tipo, destino.tipo), `${destino.nombre} (${ROTULO_DE_NODO[destino.tipo].toLowerCase()})`] as [string, string, string, string],
    }];
  });
}

/** Enlace a la ficha pública del nodo, si la tiene (territorios y prácticas no tienen ficha propia). */
export function enlaceDeLaFicha(nodo: NodoDeRed): string[] | null {
  const numero = nodo.id.split(':')[1];
  if (!numero) return null;
  switch (nodo.tipo) {
    case 'festival': return ['/ecosistema/festivales', numero];
    case 'mercado': return ['/ecosistema/mercados-musicales', numero];
    case 'organizacion': return ['/ecosistema/organizaciones', numero];
    default: return null;
  }
}

const escapar = (texto: string): string => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * El grafo (fuerza) con forma y color por tipo de nodo, tamaño por número de vínculos y el nodo elegido
 * resaltado con sus vecinos: lo demás se atenúa, no se oculta.
 */
export function opcionRed(
  red: RedDelEcosistema,
  opciones: { seleccion?: string; animar?: boolean; expandidos?: readonly string[] },
): EChartsCoreOption {
  const grado = gradoDeLosNodos(red);
  const porId = new Map(red.nodos.map((n) => [n.id, n]));
  const vecinos = new Set<string>();
  if (opciones.seleccion) {
    vecinos.add(opciones.seleccion);
    for (const arista of red.aristas) {
      if (arista.origen === opciones.seleccion) vecinos.add(arista.destino);
      if (arista.destino === opciones.seleccion) vecinos.add(arista.origen);
    }
  }
  const atenua = (id: string) => !!opciones.seleccion && !vecinos.has(id);
  const ampliados = new Set(opciones.expandidos ?? []);
  // Etiquetas: siempre las de los nodos principales (los más conectados, los ampliados, el elegido y sus vecinos);
  // el resto aparece al pasar el cursor o al acercar (el lienzo enciende `label.show` del conjunto).
  const principales = new Set<string>([...ampliados, ...vecinos]);
  [...red.nodos].sort((a, b) => (grado.get(b.id) ?? 0) - (grado.get(a.id) ?? 0)).slice(0, ETIQUETAS_PRINCIPALES).forEach((n) => principales.add(n.id));
  return {
    animation: opciones.animar ?? true,
    animationDuration: 300,
    textStyle: { fontFamily: 'inherit', color: TINTA_SUAVE, fontSize: 12 },
    aria: { enabled: true, decal: { show: false } },
    tooltip: {
      confine: true,
      formatter: (p: { dataType: string; data: { name: string; tipo?: TipoDeNodo; departamento?: string; grado?: number; rotulo?: string } }) => {
        if (p.dataType === 'edge') return escapar(p.data.rotulo ?? '');
        const tipo = p.data.tipo ? ROTULO_DE_NODO[p.data.tipo] : '';
        const donde = p.data.departamento ? ` · ${escapar(p.data.departamento)}` : '';
        return `<b>${escapar(p.data.name)}</b><br/>${tipo}${donde}<br/>${p.data.grado ?? 0} ${(p.data.grado ?? 0) === 1 ? 'vínculo' : 'vínculos'}<br/><i>Pulsa para ampliarlo y abrir su ficha</i>`;
      },
    },
    legend: { show: false },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      force: { repulsion: 190, gravity: 0.15, edgeLength: [55, 115], friction: 0.2, layoutAnimation: opciones.animar ?? true },
      // El grafo se ajusta a un marco con aire (a la derecha cabe la etiqueta) y el zoom tiene tope: nunca se pierde.
      left: 28, right: 96, top: 24, bottom: 24,
      scaleLimit: { min: ZOOM_MINIMO, max: ZOOM_MAXIMO },
      label: { show: false, position: 'right', color: TINTA, fontSize: 12, width: 110, overflow: 'truncate' },
      labelLayout: { hideOverlap: true },
      emphasis: { focus: 'adjacency', label: { show: true, fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.9)', padding: [2, 4] }, lineStyle: { width: 2.5, opacity: 0.9 } },
      blur: { itemStyle: { opacity: 0.25 }, lineStyle: { opacity: 0.08 } },
      edgeSymbol: ['none', 'none'],
      cursor: 'pointer',
      lineStyle: { color: GRIS_SIN_DATO, width: 1, opacity: 0.6, curveness: 0.05 },
      data: red.nodos.map((nodo) => ({
        id: nodo.id,
        name: nodo.nombre,
        tipo: nodo.tipo,
        departamento: nodo.departamento,
        grado: grado.get(nodo.id) ?? 0,
        symbol: FORMA_DE_NODO[nodo.tipo],
        symbolSize: (nodo.tipo === 'festival' || nodo.tipo === 'mercado' ? 12 : 16) + Math.min(20, (grado.get(nodo.id) ?? 0) * 1.5)
          + (ampliados.has(nodo.id) ? 4 : 0),
        itemStyle: {
          color: COLOR_DE_NODO[nodo.tipo],
          borderColor: nodo.id === opciones.seleccion ? TINTA : '#fff', borderWidth: nodo.id === opciones.seleccion ? 3 : 1,
          opacity: atenua(nodo.id) ? 0.2 : 1,
        },
        label: {
          // Sin `show` hereda el de la serie, que el lienzo enciende al acercar; los atenuados nunca llevan etiqueta.
          ...(atenua(nodo.id) ? { show: false } : principales.has(nodo.id) ? { show: true } : {}),
          color: TINTA, fontSize: 12, position: 'right', formatter: '{b}', width: 110, overflow: 'truncate',
        },
      })),
      links: red.aristas.map((arista) => ({
        source: arista.origen,
        target: arista.destino,
        rotulo: rotuloDeArista(arista.tipo, porId.get(arista.destino)?.tipo ?? 'territorio'),
        lineStyle: { opacity: opciones.seleccion && !(vecinos.has(arista.origen) && vecinos.has(arista.destino) && (arista.origen === opciones.seleccion || arista.destino === opciones.seleccion)) ? 0.08 : 0.6 },
      })),
    }],
  };
}
