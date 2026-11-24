/**
 * Cómo se leen los datos de un archivo del banco: el peso, el tipo y la visibilidad (P4, biblioteca de archivos).
 *
 * Son funciones puras y sin dependencias para que la cuadrícula, la lista y la ficha lateral digan lo mismo.
 */

/** El peso en la unidad que se lee, no en bytes: «48 KB», «1,2 MB». Sin dato, una raya. */
export function pesoLegible(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',')} GB`;
}

/** La extensión que se le lee a un tipo MIME: `image/jpeg` es «JPG»; lo desconocido, el subtipo en mayúsculas. */
export function formatoDeArchivo(tipo: string | null | undefined): string {
  const subtipo = (tipo ?? '').split('/')[1]?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!subtipo) return 'Archivo';
  if (subtipo === 'jpeg' || subtipo === 'jpg') return 'JPG';
  return subtipo.replace(/\+.*$/, '').toUpperCase();
}

/** «JPG · imagen»: el formato y la clase de archivo. Hoy el banco solo guarda imágenes. */
export function tipoLegible(tipo: string | null | undefined): string {
  const clase = (tipo ?? '').startsWith('image/') ? 'imagen' : 'archivo';
  return `${formatoDeArchivo(tipo)} · ${clase}`;
}

/** Las dimensiones, «720×960 px», o nada si el archivo no las trae. */
export function dimensionesLegibles(ancho: number | null | undefined, alto: number | null | undefined): string {
  return ancho && alto ? `${ancho}×${alto}` : '';
}
