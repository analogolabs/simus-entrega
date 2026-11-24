import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** El sustantivo de lo que se edita y su género, para que concuerde «publicada» o «publicado». */
export interface SujetoDeErrata { nombre: string; femenino: boolean }

/**
 * El aviso que sale al abrir para editar algo ya publicado (Catálogo, Noticias y Agenda).
 *
 * <b>UNA SOLA REDACCIÓN Y UNA SOLA REGLA.</b> Hasta el seguimiento de G1 (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 97) el
 * Catálogo avisaba y Noticias y Agenda pedían marcar una casilla «es una errata»: tres pantallas, dos
 * comportamientos y dos textos para lo mismo. Aquí queda lo que ya hacía el Catálogo: <b>no hay
 * casilla</b>; el servidor compara lo publicado con lo que llega y decide si fue una errata (sigue
 * publicado) o un cambio de fondo (vuelve a revisión), y la pantalla lo cuenta al abrir y al guardar.
 * Cada pantalla solo dice qué cuenta como cambio de fondo en lo suyo (`deFondo`).
 */
@Component({
  selector: 'app-aviso-de-errata',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="max-w-md text-sm leading-snug text-slate-700" data-aviso-de-errata>
      <span class="font-bold">{{ esta() }} {{ nombre() }} está {{ publicada() }}.</span>
      Si solo corriges ortografía o redacción, sigue {{ publicada() }}. Si cambias {{ deFondo() }}, vuelve a
      revisión hasta republicarse.
    </p>
  `,
})
export class AvisoDeErrataComponent {
  /** Lo que se edita, sin artículo: «ficha», «noticia», «evento». */
  readonly nombre = input.required<string>();
  /** Si el sustantivo es femenino: «Esta noticia está publicada» frente a «Este evento está publicado». */
  readonly femenino = input(false);
  /** Lo que cuenta como cambio de fondo, ya redactado: «el título, la fecha, el tipo, los accesos o las fuentes». */
  readonly deFondo = input.required<string>();

  protected readonly esta = computed(() => (this.femenino() ? 'Esta' : 'Este'));
  protected readonly publicada = computed(() => (this.femenino() ? 'publicada' : 'publicado'));
}

/**
 * Lo que se cuenta tras guardar algo que ya estaba publicado: el servidor decidió, y la pantalla lo
 * lee del resultado en vez de suponerlo. Una sola frase para las tres pantallas.
 *
 * @param titulo lo que se muestra entre comillas: el título de la ficha.
 * @param estabaPublicado si se abrió publicado; si no, es un guardado corriente.
 * @param sigueSiendoPublicado el estado que devolvió el servidor.
 */
export function mensajeDeGuardadoDeLoPublicado(
  titulo: string, sujeto: SujetoDeErrata, estabaPublicado: boolean, sigueSiendoPublicado: boolean,
): string {
  const quedo = sujeto.femenino ? 'quedó guardada' : 'quedó guardado';
  const sigue = sujeto.femenino ? 'sigue publicada' : 'sigue publicado';
  if (!estabaPublicado) return `«${titulo}» ${quedo}.`;
  return sigueSiendoPublicado
    ? `«${titulo}» ${quedo} y ${sigue}: el cambio era una errata.`
    : `«${titulo}» ${quedo}. Como el cambio es de fondo, vuelve a revisión y deja de verse hasta republicarse.`;
}
