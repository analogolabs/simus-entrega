import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideCalendar, LucideChartColumn, LucideLayoutGrid, LucideList, LucideMap, LucideTable } from '@lucide/angular';

/** Los iconos que sabe pintar el modo solo-icono: los modos de vista del portal (A-4, M-2). */
export type IconoDeOpcion = 'lista' | 'mosaico' | 'mapa' | 'grafico' | 'tabla' | 'calendario';

/** Una posición del selector. */
export interface OpcionSegmentada {
  readonly id: string;
  readonly etiqueta: string;

  /**
   * Cuántos elementos hay detrás de esta posición, cuando el control filtra una lista.
   *
   * Es opcional a propósito: un selector de modo de vista -«Barras / Áreas»- no tiene nada que
   * contar, y ponerle un número al lado sería inventar un dato.
   */
  readonly conteo?: number;

  /**
   * El icono de la posición, solo para `soloIconos`. Con iconos, `etiqueta` deja de verse pero NO se pierde: es el
   * nombre accesible y el tooltip del botón («Vista de lista»), y por eso sigue siendo obligatoria.
   */
  readonly icono?: IconoDeOpcion;
}

/**
 * Elegir entre dos o tres opciones excluyentes, como un solo objeto con varias posiciones.
 *
 * <b>SUSTITUYE A LAS PILDORAS, Y ESO ES UNA NORMA DEL PROYECTO.</b> El 12 de septiembre de 2026 el
 * está definido de los controles de la vista de gráfico del mapa —«Barras / Áreas»,
 * «Territorios sonoros / Prácticas», «Barras / Unidades»—: «ese tipo de botones, así como una
 * píldora, no deben estar presentes en el diseño». Es la misma regla que ya regía para los estados,
 * extendida a los controles.
 *
 * <b>POR QUE LA PILDORA ESTABA MAL AQUI, Y NO SOLO POR GUSTO.</b> Cada opción se dibujaba como una
 * cápsula redondeada independiente, con su borde y su fondo, y la elegida rellena de morado. Un
 * borde alrededor de cada una dice «objeto separado», y no lo son: son posiciones de un mismo
 * control, y solo una puede estar puesta. Además, tres cápsulas sueltas junto a otras tres cápsulas
 * en la misma pantalla se leen como seis opciones de una sola lista. La forma tiene que decir lo
 * que la cosa es.
 *
 * <b>COMO SE MARCA LO ELEGIDO.</b> Con un subrayado y el color de la marca, nunca con un relleno:
 * un relleno morado convierte la opción otra vez en una cápsula, esta vez oscura, y además hunde el
 * contraste del texto. Es el mismo criterio con el que se rehízo la tira de lecturas de la vista de
 * gráfico, que marca lo elegido con una barra superior.
 *
 * <b>EL TAMAÑO SIGUE LA ESCALA DEL PROYECTO.</b> Estas posiciones se pintaban a 9,5 px en
 * versalitas, por debajo del suelo de 12 px que fija la escala tipográfica; se subieron a
 * `text-dato` con su altura de control mínima, al reutilizar el
 * control para filtrar la bandeja de Solicitudes.
 *
 * <b>SEMANTICA.</b> `role="group"` con `aria-pressed` en cada botón, que es lo que ya usaba el
 * marcado anterior: se conserva para no cambiar lo que anuncia el lector de pantalla al mismo
 * tiempo que cambia lo que se ve.
 */
@Component({
  selector: 'app-selector-segmentado',
  standalone: true,
  imports: [CommonModule, LucideCalendar, LucideChartColumn, LucideLayoutGrid, LucideList, LucideMap, LucideTable],
  /*
    EL HOST DECLARA SU `display`, Y NO ES UN DETALLE.

    Sin declararlo, un componente de Angular es `display: inline`, y los márgenes verticales NO se
    aplican a una caja en línea. Como las utilidades `space-y-*` de Tailwind 4 ponen justamente un
    `margin-block-start` en los hermanos, el aire por debajo del selector desaparecía: medido el 15
    de septiembre de 2026 en Páginas y bloques, 9 px donde el contenedor pedía 24, y las casillas de
    cifras quedaban pegadas al subrayado de la pestaña activa.

    `block` y no `inline-block`: el selector siempre ocupa su propia fila o es hijo de un
    contenedor flex —la barra de lista—, donde un hijo en bloque se comporta igual.
  */
  styles: [`
    :host { display: block; }
    /* MODO SOLO-ICONO: sutil a propósito. Sin borde ni relleno de marca: la posición elegida es un fondo suave del
       filete y el icono en morado; las demás, un icono de apoyo. Objetivo táctil de 36 px (44 con 'comodo'). */
    :host(.solo-iconos) { display: inline-block; }
    .iconos { display: inline-flex; gap: .125rem; padding: .125rem; border-radius: var(--radius-control); background: transparent; }
    .iconos__boton {
      display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
      width: var(--spacing-control); height: var(--spacing-control);
      border: 0; border-radius: calc(var(--radius-control) - 2px); background: transparent; color: var(--color-rotulo);
      transition: background-color .15s var(--ease-soft, ease), color .15s var(--ease-soft, ease);
    }
    .iconos--comodo .iconos__boton { width: var(--spacing-control-comodo); height: var(--spacing-control-comodo); }
    .iconos__boton:hover { background: color-mix(in srgb, var(--color-filete) 55%, transparent); color: var(--color-valor); }
    .iconos__boton[aria-pressed='true'] { background: var(--color-filete); color: var(--color-morado); }
    .iconos__boton:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); }
    @media (prefers-reduced-motion: reduce) { .iconos__boton { transition: none; } }
  `],
  host: { '[class.solo-iconos]': 'soloIconos' },
  template: `
    @if (soloIconos) {
      <!--
        SOLO ICONOS (A-4, M-2): un grupo de botones cuadrados. Cada uno lleva 'aria-label' y 'title' con la misma
        etiqueta (nombre accesible y tooltip) y 'aria-pressed'; el icono es decorativo. Pensado para ir a la DERECHA
        de la línea del título del apartado.
      -->
      <div class="iconos" [class.iconos--comodo]="comodo" role="group" [attr.aria-label]="etiquetaDelGrupo">
        @for (opcion of opciones; track opcion.id) {
          <button type="button" class="iconos__boton"
            [attr.aria-pressed]="opcion.id === elegida" [attr.aria-label]="opcion.etiqueta" [attr.title]="opcion.etiqueta"
            [attr.data-opcion]="opcion.id" (click)="elegir.emit(opcion.id)">
            @switch (opcion.icono) {
              @case ('mosaico') { <svg lucideLayoutGrid [size]="18" aria-hidden="true"></svg> }
              @case ('mapa') { <svg lucideMap [size]="18" aria-hidden="true"></svg> }
              @case ('grafico') { <svg lucideChartColumn [size]="18" aria-hidden="true"></svg> }
              @case ('tabla') { <svg lucideTable [size]="18" aria-hidden="true"></svg> }
              @case ('calendario') { <svg lucideCalendar [size]="18" aria-hidden="true"></svg> }
              @default { <svg lucideList [size]="18" aria-hidden="true"></svg> }
            }
          </button>
        }
      </div>
    } @else if (forma === 'segmentado') {
      <!--
        LA FORMA SEGMENTADA (decisión 116): un solo objeto con borde completo y las posiciones dentro,
        sin subrayado que cruce por debajo. Es la de los modos de visualización —Día / Mes / Rango,
        Mapa / Gráfico / Tabla—. Lo elegido se marca con un fondo suave y el color de la marca.
      -->
      <div class="flex w-full gap-0.5 rounded-[var(--radius-control,0.5rem)] border border-slate-300 bg-white p-0.5" role="group" [attr.aria-label]="etiquetaDelGrupo">
        @for (opcion of opciones; track opcion.id) {
          @let puesta = opcion.id === elegida;
          <button
            type="button"
            (click)="elegir.emit(opcion.id)"
            [attr.aria-pressed]="puesta"
            [attr.data-opcion]="opcion.id"
            [class]="'inline-flex ' + (comodo ? 'min-h-[var(--spacing-control-comodo,2.75rem)] ' : 'min-h-[calc(var(--spacing-control,2.25rem)-0.5rem)] ') + 'min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 text-center rounded-[calc(var(--radius-control,0.5rem)-2px)] px-3 text-cuerpo font-bold transition-colors ' + (
              puesta ? 'bg-morado/10 text-morado' : 'text-[color:var(--color-prosa)] hover:bg-slate-100 hover:text-morado'
            )"
          ><span>{{ opcion.etiqueta }}</span>&ngsp;@if (opcion.conteo !== undefined) {<span class="text-dato font-normal tabular-nums">{{ opcion.conteo }}</span>}</button>
        }
      </div>
    } @else {
        <div class="inline-flex flex-wrap" [class.border-b]="conFilete" [class.border-slate-200]="conFilete" role="group" [attr.aria-label]="etiquetaDelGrupo">
        @for (opcion of opciones; track opcion.id) {
          @let puesta = opcion.id === elegida;
          @let vacia = opcion.conteo === 0 && !puesta;
          <button
            type="button"
            (click)="elegir.emit(opcion.id)"
            [attr.aria-pressed]="puesta"
            [attr.data-opcion]="opcion.id"
            [attr.data-vacia]="vacia ? 'si' : null"
            [attr.data-filtro-organizacion]="atributoDeDatos === 'filtro-organizacion' ? opcion.id : null"
            [class]="'-mb-px inline-flex min-h-control cursor-pointer items-center gap-1.5 border-b-2 px-3 text-cuerpo font-bold transition-all ' + (
              puesta
                ? 'border-morado text-morado'
                : vacia
                  ? 'border-transparent text-[color:var(--color-rotulo)] font-semibold hover:text-morado'
                  : 'border-transparent text-[color:var(--color-prosa)] hover:text-morado'
            )"
          ><span>{{ opcion.etiqueta }}</span>&ngsp;@if (opcion.conteo !== undefined) {<span class="text-dato font-normal tabular-nums" [class.text-[color:var(--color-rotulo)]]="!puesta">{{ opcion.conteo }}</span>}</button>
        }
      </div>
    }
  `,
})
export class SelectorSegmentadoComponent {
  @Input({ required: true }) opciones: readonly OpcionSegmentada[] = [];
  @Input({ required: true }) elegida = '';

  /** Qué se está eligiendo, para quien navega con lector de pantalla. */
  @Input({ required: true }) etiquetaDelGrupo = '';

  @Output() readonly elegir = new EventEmitter<string>();

  /** Objetivo táctil cómodo (44 px de alto) para el uso con el dedo en pantalla angosta. Solo la forma segmentada. */
  @Input() comodo = false;

  /**
   * Nombre del atributo de datos con que las pruebas de un panel localizan cada opción.
   *
   * Cada botón lleva siempre `data-opcion`; esto añade además el atributo que una prueba ya
   * existente busca —`data-filtro-organizacion` en el panel de organizaciones—, para que adoptar
   * el selector compartido no obligue a reescribir lo que ya vigilaba.
   */
  @Input() atributoDeDatos: 'filtro-organizacion' | null = null;

  /**
   * Una posición en cero se apaga, pero SIGUE AHI y sigue pulsándose.
   *
   * No se oculta porque una capacidad que no se ve no existe: al unificar la bandeja el 15 de
   * septiembre de 2026 se ocultaron las posiciones vacías y la dirección de producto reportó que seis
   * subsecciones —eliminaciones, reclamaciones, vinculaciones, duplicados, alertas y propuestas—
   * habían desaparecido. Un cero dice «no hay nada de esto pendiente», que es información; un
   * hueco no dice nada.
   *
   * Se apaga con el color de rótulo y medio grado de peso, no con opacidad: una posición al 50 %
   * de opacidad hunde el contraste del texto por debajo del mínimo legible.
   */

  /**
   * Si el selector dibuja su propio filete inferior.
   *
   * Suelto, sí: el filete es lo que hace que la pestaña activa «se apoye» en algo. Dentro de una
   * barra que ya dibuja un filete a todo lo ancho —Solicitudes, con su enlace a la derecha— se
   * apaga, o quedan dos líneas: una corta bajo las pestañas y otra larga siete píxeles más abajo.
   * Medido.
   */
  @Input() conFilete = true;

  /**
   * `subrayado` (por omisión): la fila de pestañas de estado de las bandejas. `segmentado`: un objeto
   * con borde para elegir un modo de visualización (docs/desarrollo/30-consola-y-acceso.md §30.13, regla 4).
   */
  @Input() forma: 'subrayado' | 'segmentado' = 'subrayado';

  /**
   * Cada posición se pinta solo con su icono (`OpcionSegmentada.icono`); la etiqueta pasa a ser el nombre accesible y
   * el tooltip. Es el modo de los conmutadores de vista —lista/mosaico, mapa/gráfico/tabla—, que no deben llamar más
   * la atención que el contenido. Ignora `forma` y `conFilete`.
   */
  @Input() soloIconos = false;
}
