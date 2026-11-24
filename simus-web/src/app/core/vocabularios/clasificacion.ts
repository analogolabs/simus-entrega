/**
 * Separador no ambiguo para listas de clasificaciones transportadas en un campo.
 *
 * Una coma no sirve: los nombres válidos del catálogo pueden contener comas.
 * El carácter de unidad no forma parte de esos nombres y permite conservar cada
 * clasificación sin inventar elementos al volver a separarla.
 */
export const SEPARADOR_DE_CLASIFICACION = '\u001F';
