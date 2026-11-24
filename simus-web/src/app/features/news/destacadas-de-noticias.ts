/**
 * LA REGLA DE LAS NOTICIAS DESTACADAS, escrita una sola vez (N-1).
 *
 * <b>NO HAY UNA MARCA «DESTACADA» EN LA BASE.</b> Se comprobó en el servidor
 * (`NoticiasEndpoints.ListarPublicas`): la lista pública devuelve solo las noticias `publicado` con
 * fecha de publicación llegada, ordenadas por fecha de publicación descendente y, a igualdad, por
 * identificador descendente. Las «destacadas» son simplemente las primeras de esa lista: la que va
 * grande y las dos que la acompañan en la página de Noticias, y las mismas tres que enseña la
 * portada del Inicio. Nadie las elige ni vencen: se actualizan solas.
 *
 * Consecuencias que la gente debe poder leer: (1) al publicarse una noticia nueva pasa al primer
 * lugar y la tercera baja al listado; (2) una noticia con fecha futura («Programada») no cuenta
 * hasta el día de su fecha; (3) cambiar la fecha de publicación de una noticia cambia su lugar;
 * (4) una noticia archivada, rechazada o en borrador no está en la lista y no ocupa lugar.
 */
export const NOTICIAS_DESTACADAS = 3;

/** Cuántas noticias recientes lleva el bloque «Actualidad» del Inicio: la principal y cuatro secundarias (H-3). */
export const NOTICIAS_EN_INICIO = 5;

/** El texto para quien gestiona la sección: añade lo que decide el equipo y no ve el público. */
export const REGLA_DE_DESTACADAS_EN_LA_CONSOLA =
  'Las noticias destacadas no se eligen a mano: son las tres publicadas con la fecha de publicación más reciente (a igual fecha, la última creada). Una noticia programada entra el día de su fecha; una en borrador, en revisión, rechazada o archivada no cuenta. Cambiar la fecha de publicación cambia su lugar.';
