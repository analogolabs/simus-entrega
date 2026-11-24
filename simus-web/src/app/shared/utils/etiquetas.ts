/**
 * La etiqueta pública de un contenido (noticia, evento, ficha).
 *
 * <b>UNA SOLA FUENTE.</b> La etiqueta ES el proyecto transversal del contenido (`/publico/proyectos-transversales`):
 * su código es la dirección estable (`?proyecto=<código>` en Agenda y Noticias) y su nombre es lo que se lee
 * («Celebra la Música 2026»). Activar una estrategia nueva es crear el proyecto en la consola y marcar los
 * contenidos con él: el portal no guarda ninguna lista de etiquetas.
 */
export interface EtiquetaDeContenido {
  /** El código del proyecto: va en la dirección (`?proyecto=`). */
  codigo: string;
  /** El nombre legible. */
  nombre: string;
  /** Cuántos contenidos la llevan, cuando se muestra una lista de las disponibles. */
  total?: number;
}

/** El parámetro de la dirección con el que Agenda y Noticias filtran por etiqueta. */
export const PARAMETRO_DE_ETIQUETA = 'proyecto';

interface ConProyecto { slug?: string; codigo?: string; nombre: string }

/** Lleva los proyectos que vienen del servidor (`slug`) o de un adaptador (`codigo`) a la etiqueta común. */
export function comoEtiquetas(proyectos: readonly ConProyecto[] | null | undefined): EtiquetaDeContenido[] {
  const vistas = new Set<string>();
  const etiquetas: EtiquetaDeContenido[] = [];
  for (const p of proyectos ?? []) {
    const codigo = p.slug ?? p.codigo ?? '';
    if (!codigo || vistas.has(codigo)) continue;
    vistas.add(codigo);
    etiquetas.push({ codigo, nombre: p.nombre });
  }
  return etiquetas;
}

/**
 * Las etiquetas que hay en un conjunto de contenidos, con cuántos contenidos lleva cada una, de mayor a menor
 * y, a igualdad, por nombre. Salen de lo que el contenido declara: solo se ofrece una etiqueta si hay algo que ver con ella.
 */
export function etiquetasDisponibles(contenidos: readonly { proyectos?: readonly ConProyecto[] | null }[]): EtiquetaDeContenido[] {
  const cuenta = new Map<string, EtiquetaDeContenido>();
  for (const contenido of contenidos) {
    for (const etiqueta of comoEtiquetas(contenido.proyectos)) {
      const previa = cuenta.get(etiqueta.codigo);
      cuenta.set(etiqueta.codigo, { ...etiqueta, total: (previa?.total ?? 0) + 1 });
    }
  }
  return [...cuenta.values()].sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || a.nombre.localeCompare(b.nombre, 'es'));
}
