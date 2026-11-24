/**
 * LO QUE FALTA PARA PUBLICAR.
 *
 * <b>Qué estaba roto.</b> «Publicar» era la primera acción del menú de cualquier borrador y se
 * ejecutaba sin preguntar; si faltaba algo, la API respondía 400 con el motivo y la pantalla decía
 * «No fue posible cambiar el estado». La Agenda ya sabía calcular sus requisitos; Noticias y
 * Catálogo no, y cada una avisaba (o no) a su manera.
 *
 * <b>Qué hace.</b> Un cálculo por módulo, con las mismas frases que el servidor (que sigue siendo
 * quien decide: esto lo anticipa, no lo sustituye), para que el menú ofrezca «Publicar» apagado con
 * la lista de lo que falta en vez de dejar elegirlo y fallar. Las listas vacías significan «se
 * puede publicar».
 */

const vacio = (valor: string | null | undefined): boolean => !valor || !valor.trim();

export function loQueFaltaParaPublicarNoticia(
  noticia: { titulo?: string | null; resumen?: string | null; cuerpo?: string | null; fechaPublicacion?: string | null },
): string[] {
  const faltas: string[] = [];
  if (vacio(noticia.titulo)) faltas.push('no tiene título');
  if (vacio(noticia.resumen)) faltas.push('no tiene resumen');
  if (vacio(noticia.cuerpo)) faltas.push('no tiene cuerpo');
  if (vacio(noticia.fechaPublicacion)) faltas.push('no tiene fecha de publicación');
  return faltas;
}

export function loQueFaltaParaPublicarEvento(
  evento: { titulo?: string | null; descripcion?: string | null; modalidad?: string | null; lugar?: string | null; url?: string | null },
): string[] {
  const faltas: string[] = [];
  if (vacio(evento.titulo)) faltas.push('no tiene título');
  if (vacio(evento.descripcion)) faltas.push('no tiene descripción');
  const modalidad = evento.modalidad ?? '';
  if ((modalidad === 'presencial' || modalidad === 'mixta') && vacio(evento.lugar)) faltas.push('es presencial y no dice dónde');
  if ((modalidad === 'virtual' || modalidad === 'mixta') && vacio(evento.url)) faltas.push('es virtual y no tiene enlace');
  return faltas;
}

/** La ficha del Catálogo Editorial: validada, con al menos una fuente y con derechos que autoricen publicar la ficha. */
export function loQueFaltaParaPublicarFicha(
  ficha: { estadoCatalogacion?: string | null; fuentes?: readonly unknown[] | null; derechos?: { permitePublicarFicha?: boolean } | null },
): string[] {
  const faltas: string[] = [];
  if (ficha.estadoCatalogacion !== 'validada') faltas.push('la ficha no está validada');
  if (!ficha.fuentes?.length) faltas.push('no tiene ninguna fuente registrada');
  if (!ficha.derechos?.permitePublicarFicha) faltas.push('los derechos no autorizan publicar la ficha');
  return faltas;
}

/** «No se puede publicar: no tiene título; no tiene resumen.» — la misma frase que dice el servidor. */
export function motivoParaNoPublicar(faltas: readonly string[]): string {
  return `No se puede publicar: ${faltas.join('; ')}.`;
}
