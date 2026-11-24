import type { ItemDePortafolio, TipoDePortafolio } from '../services/perfil-publico.service';
import { mensajeDeUrl } from './url';

/**
 * EL PORTAFOLIO DEL PERFIL PÚBLICO: SOLO ENLACES (perfil público).
 *
 * Cada elemento apunta a algo que ya está en la web (una grabación, un video, un texto, una imagen…): nunca
 * se sube un archivo al portafolio. Lleva título, clase, enlace https, y —opcionales— una descripción breve y
 * el año. Es la misma regla que aplica el servidor (`PerfilPublicoEndpoints`).
 */
export const TIPOS_DE_PORTAFOLIO: readonly { valor: TipoDePortafolio; rotulo: string }[] = [
  { valor: 'audio', rotulo: 'Audio' },
  { valor: 'video', rotulo: 'Video' },
  { valor: 'texto', rotulo: 'Texto' },
  { valor: 'imagen', rotulo: 'Imagen' },
  { valor: 'enlace', rotulo: 'Otro' },
];

export const LARGO_TITULO_DE_PORTAFOLIO = 120;
export const LARGO_DESCRIPCION_DE_PORTAFOLIO = 300;
export const PRIMER_ANIO_DE_PORTAFOLIO = 1900;

export function etiquetaDeTipoDePortafolio(tipo: string): string {
  return TIPOS_DE_PORTAFOLIO.find(t => t.valor === tipo)?.rotulo ?? 'Otro';
}

/** El año escrito, como número entero; `null` si está vacío o no es un año. */
export function anioDeTexto(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || `${valor}`.trim() === '') return null;
  const numero = Number(`${valor}`.trim());
  return Number.isInteger(numero) ? numero : Number.NaN;
}

/** Los motivos por los que un elemento no se puede guardar, por campo; vacío si sirve. */
export function erroresDeItemDePortafolio(item: { titulo: string; url: string; anio: string | number | null }, anioActual = new Date().getFullYear()): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!item.titulo.trim()) errores['titulo'] = 'Escribe el título del elemento.';
  if (!item.url.trim()) errores['url'] = 'Pega la dirección donde está el elemento.';
  else if (mensajeDeUrl(item.url)) errores['url'] = 'Escribe una dirección https completa, por ejemplo https://www.mi-sitio.org/mi-grabacion.';
  const anio = anioDeTexto(item.anio);
  if (anio !== null && (Number.isNaN(anio) || anio < PRIMER_ANIO_DE_PORTAFOLIO || anio > anioActual + 1)) {
    errores['anio'] = `El año va entre ${PRIMER_ANIO_DE_PORTAFOLIO} y ${anioActual + 1}.`;
  }
  return errores;
}

export function resumenDeItem(item: ItemDePortafolio): string {
  return [etiquetaDeTipoDePortafolio(item.tipo), item.anio ?? null].filter(Boolean).join(' · ');
}
