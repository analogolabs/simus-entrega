/**
 * El nombre de un departamento o municipio como se LEE (DAT-01).
 *
 * <b>EL CATÁLOGO DIVIPOLA DEL DANE VIENE EN MAYÚSCULAS</b> —«BOGOTÁ, D.C.», «SAN VICENTE DEL
 * CAGUÁN», «ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA»— y así llegaban a los
 * selectores y a las listas, junto a nombres de lugar escritos a mano con mayúscula inicial. La
 * misma ciudad se leía de dos maneras en dos pantallas, y en un desplegable de mil municipios un
 * bloque de gritos cansa y no se distingue de un dato que sí está en mayúsculas a propósito.
 *
 * <b>SOLO SE CAMBIA LO QUE LLEGA TODO EN MAYÚSCULAS.</b> Un nombre que ya trae alguna minúscula se
 * deja tal cual: es la prueba de que alguien lo escribió pensando en cómo se lee, y volver a
 * «corregirlo» solo puede empeorarlo. Por eso la función es idempotente.
 *
 * <b>ES SOLO PRESENTACIÓN.</b> El código del departamento o del municipio sigue siendo lo que se
 * guarda y lo que se compara; el nombre en mayúsculas del catálogo no cambia en la base ni en la
 * respuesta del servidor. Quien compare nombres debe seguir normalizando ambos lados.
 */

/** Las partículas que van en minúscula salvo al comienzo del nombre: «Valle del Cauca». */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

/** «D.C.», «S.A.»: siglas con puntos que se conservan en mayúsculas. */
const SIGLA_CON_PUNTOS = /^(?:\p{L}\.)+$/u;

const PALABRA = /[\p{L}\p{N}.']+/gu;

function tieneMinusculas(texto: string): boolean {
  return /\p{Ll}/u.test(texto);
}

export function nombreLegibleDelTerritorio(nombre: string | null | undefined): string {
  const limpio = (nombre ?? '').replace(/\s+/g, ' ').trim();
  if (limpio === '' || tieneMinusculas(limpio)) return limpio;

  let indice = 0;
  return limpio
    .toLocaleLowerCase('es-CO')
    .replace(PALABRA, palabra => {
      const esLaPrimera = indice === 0;
      indice += 1;
      if (SIGLA_CON_PUNTOS.test(palabra)) return palabra.toLocaleUpperCase('es-CO');
      if (!esLaPrimera && PARTICULAS.has(palabra)) return palabra;
      return palabra.charAt(0).toLocaleUpperCase('es-CO') + palabra.slice(1);
    });
}
