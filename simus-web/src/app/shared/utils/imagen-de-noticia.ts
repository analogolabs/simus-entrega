/**
 * Las fotos de la galería del PNMC que hacen de portada cuando una noticia no trae la suya.
 *
 * UNA SOLA LISTA PARA TODAS LAS PANTALLAS. La portada las usaba y la lista de
 * Noticias no: las mismas noticias aparecían con foto en Inicio y como recuadros grises en
 * `/noticias`. Que una noticia sin portada no tenga ninguna es un dato; que su foto cambie según la
 * pantalla es un defecto.
 */
export const IMAGENES_DE_RESPALDO_DE_NOTICIAS: readonly string[] = [
  '/assets/home/noticia-1.webp',
  '/assets/home/noticia-2.webp',
  '/assets/home/noticia-3.webp',
];

/** Lo mínimo que hace falta para elegir imagen: la suya, y una semilla estable si no hay. */
export interface NoticiaConImagenOpcional {
  img?: string | null;
  id?: string | number | null;
  slug?: string | null;
}

/**
 * La imagen de una noticia: la suya o, si no trae portada, una de respaldo.
 *
 * LA DE RESPALDO SE ELIGE POR LA IDENTIDAD DE LA NOTICIA y no por su posición en la pantalla: así
 * la misma noticia lleva la misma foto en la portada, en la lista y en el detalle, y no cambia al
 * filtrar o paginar. Nunca devuelve cadena vacía: un `src` vacío hace que el navegador vuelva a
 * pedir la página.
 */
/** Las claves del CMS de las tres fotos de respaldo (grupo de imágenes «Fotos de respaldo de las noticias»). */
export const CLAVES_DE_RESPALDO_DE_NOTICIAS: readonly string[] = ['noticia_respaldo_1', 'noticia_respaldo_2', 'noticia_respaldo_3'];

/** Las tres fotos de respaldo con lo que el CMS tenga publicado; `leer` es `getWebImage`. */
export function respaldosDeNoticias(leer: (clave: string) => string): readonly string[] {
  return CLAVES_DE_RESPALDO_DE_NOTICIAS.map((clave, i) => leer(clave) || IMAGENES_DE_RESPALDO_DE_NOTICIAS[i]);
}

export function imagenDeNoticia(noticia: NoticiaConImagenOpcional, respaldos: readonly string[] = IMAGENES_DE_RESPALDO_DE_NOTICIAS): string {
  if (noticia.img) { return noticia.img; }
  const semilla = String(noticia.id ?? noticia.slug ?? '');
  const numero = Number(semilla);
  let indice: number;
  if (semilla !== '' && Number.isFinite(numero)) {
    indice = Math.abs(Math.trunc(numero));
  } else {
    indice = 0;
    for (const caracter of semilla) { indice = (indice * 31 + caracter.charCodeAt(0)) >>> 0; }
  }
  return respaldos[indice % respaldos.length];
}
