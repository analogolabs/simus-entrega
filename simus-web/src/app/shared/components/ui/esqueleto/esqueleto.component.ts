import { ChangeDetectionStrategy, Component, computed, input, numberAttribute } from '@angular/core';

export type VarianteDeEsqueleto = 'tarjeta' | 'fila' | 'ficha' | 'tabla' | 'encabezado' | 'noticias' | 'persona' | 'formulario' | 'concepto' | 'articulo';

/** Cuántas piezas lleva cada variante si quien la usa no dice otra cosa. */
const CANTIDAD_POR_OMISION: Readonly<Record<VarianteDeEsqueleto, number>> = {
  tarjeta: 3, fila: 5, ficha: 1, tabla: 6, encabezado: 1, noticias: 3, persona: 8, formulario: 4, concepto: 6, articulo: 1,
};

/**
 * La estructura de lo que está por llegar, dibujada mientras llega (decisión 117 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`).
 *
 * <b>UNA SOLA PIEZA PARA TODA CARGA.</b> Antes cada pantalla enseñaba lo suyo: un «Consultando…»
 * suelto, un círculo que giraba, un recuadro gris, o NADA y luego un «no hay resultados» que
 * parpadeaba antes de que llegaran los datos. Esta pieza sustituye a todos: el sitio no se siente
 * vacío ni lento porque la forma de la página ya está ahí cuando la persona llega.
 *
 * <b>RESERVA EL MISMO ESPACIO QUE EL CONTENIDO FINAL.</b> Las variantes copian las medidas de lo que
 * reemplazan (tarjeta de noticia o de directorio, fila de lista, ficha con portada, fila de tabla,
 * encabezado de página). Al llegar los datos no hay salto de diseño.
 *
 * <b>APARECE DE INMEDIATO.</b> No hay retardo antes de pintarla: quien decide mostrarla es la
 * pantalla, con la señal de carga puesta desde el constructor o desde el valor inicial, no desde un
 * `ngOnInit` que deje un fotograma vacío.
 *
 * <b>ANIMACIÓN SUTIL Y CORTA.</b> Un parpadeo de opacidad de 1,2 s, sin barrido de luz. Con
 * `prefers-reduced-motion` no hay animación: quedan los bloques quietos.
 *
 * <b>ACCESIBLE.</b> El contenedor lleva `aria-busy="true"` y UN solo texto para lector de pantalla
 * (`etiqueta`) dentro de un `role="status"`; los bloques son `aria-hidden`. Con varias piezas
 * (`cantidad`) el texto se dice una vez, no una por pieza.
 *
 * <b>LA ENTRADA DEL CONTENIDO DURA A LO SUMO 150 ms.</b> Quien reemplaza el esqueleto por los datos
 * puede añadir la clase global `.aparece` (ver `styles.css`), que hace un fundido corto.
 *
 * <b>EL VACÍO REAL NO VA AQUÍ.</b> «No hay resultados» se pinta solo cuando la carga terminó:
 * `@if (cargando) { esqueleto } @else if (vacio) { aviso } @else { datos }`, en ese orden y con la
 * señal de carga en `true` desde el valor inicial.
 */
@Component({
  selector: 'app-esqueleto',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.aria-busy]': '"true"', '[attr.data-esqueleto]': 'variante()', '[class]': '"esqueleto esqueleto--" + variante()' },
  styles: [`
    :host { display: block; }
    .bloque { background: var(--color-filete); border-radius: .5rem; animation: esqueleto-latido var(--dur-latido, 1200ms) ease-in-out infinite; }
    .bloque--linea { height: .85rem; }
    .bloque--linea-grande { height: 1.6rem; border-radius: .4rem; }
    .bloque--redondo { border-radius: 9999px; }
    @keyframes esqueleto-latido { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
    @media (prefers-reduced-motion: reduce) { .bloque { animation: none; } }

    /* Tarjeta: la imagen 16:9 y tres líneas, como la tarjeta de noticia y la del directorio. */
    .rejilla { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); }
    .tarjeta { display: flex; flex-direction: column; gap: .75rem; padding: 0 0 1rem; border: 1px solid var(--color-filete); border-radius: 1rem; overflow: hidden; min-height: 21rem; }
    .tarjeta .bloque--imagen { border-radius: 0; aspect-ratio: 16 / 9; width: 100%; }
    .tarjeta__cuerpo { display: flex; flex-direction: column; gap: .6rem; padding: 0 1.25rem; }

    /* Persona (mosaico del directorio): foto cuadrada y tres líneas, la medida de la tarjeta de persona. */
    .rejilla-personas { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr)); }
    .persona { display: flex; flex-direction: column; gap: .75rem; border: 1px solid var(--color-filete); border-radius: 1rem; overflow: hidden; padding-bottom: 1rem; }
    .persona .bloque--foto { border-radius: 0; aspect-ratio: 1 / 1; width: 100%; }

    /* Fila de lista: miniatura cuadrada y dos líneas; la altura de una fila de directorio. */
    .fila { display: grid; grid-template-columns: 4rem minmax(0, 1fr); gap: 1rem; align-items: center; padding: 1.25rem 0; border-bottom: 1px solid var(--color-filete); min-height: 6.5rem; }
    .fila .bloque--miniatura { width: 4rem; height: 4rem; }
    .fila__texto { display: flex; flex-direction: column; gap: .55rem; }

    /* Ficha: portada, título y párrafos. */
    .ficha { display: flex; flex-direction: column; gap: 1.25rem; min-height: 40rem; }
    .ficha .bloque--portada { height: 14rem; border-radius: 1rem; }
    .ficha__cuerpo { display: flex; flex-direction: column; gap: .7rem; max-width: 48rem; }

    /* Tabla: una cabecera y filas de la altura de una fila de tabla administrativa. */
    .tabla { border: 1px solid var(--color-filete); border-radius: .75rem; overflow: hidden; }
    .tabla__fila { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1.25rem; align-items: center; padding: 0 1rem; height: 3.25rem; border-bottom: 1px solid var(--color-filete); }
    .tabla__fila:last-child { border-bottom: 0; }
    .tabla__fila--cabecera { height: 2.75rem; }
    @media (max-width: 40rem) { .tabla__fila { grid-template-columns: 2fr 1fr; } .tabla__fila > :nth-child(n+3) { display: none; } }

    /* Noticias: el encabezado de sección y la rejilla de 12 columnas (destacada de 5, dos de 4 en pila, boletín de 3). */
    .noticias { display: flex; flex-direction: column; gap: 2rem; }
    .noticias__cabeza { display: flex; flex-direction: column; gap: .8rem; }
    .noticias__rejilla { display: grid; gap: 1.25rem; grid-template-columns: 1fr; }
    .noticias__destacada { min-height: 25rem; border-radius: 1rem; }
    .noticias__pila { display: grid; gap: 1.25rem; grid-template-rows: repeat(2, minmax(11.875rem, 1fr)); }
    .noticias__pila .bloque, .noticias__boletin { border-radius: 1rem; }
    .noticias__boletin { min-height: 21.875rem; }
    @media (min-width: 64rem) {
      .noticias__rejilla { grid-template-columns: repeat(12, minmax(0, 1fr)); }
      .noticias__destacada { grid-column: span 5; }
      .noticias__pila { grid-column: span 4; }
      .noticias__boletin { grid-column: span 3; }
    }

    /* Formulario (L6): una etiqueta corta y un campo de 44 px por pieza; reserva la medida del formulario de acceso. */
    .formulario { display: flex; flex-direction: column; gap: 1.25rem; }
    .formulario__campo { display: flex; flex-direction: column; gap: .5rem; }
    .formulario__campo .bloque--control { height: var(--spacing-control-comodo, 2.75rem); border-radius: var(--radius-control, .5rem); }

    /* Concepto (Territorios sonoros, Prácticas musicales): tarjeta de solo texto, en la rejilla de 1, 2 y 3 columnas de la lista real. */
    .rejilla-conceptos { display: grid; gap: 1rem; grid-template-columns: 1fr; }
    @media (min-width: 48rem) { .rejilla-conceptos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (min-width: 80rem) { .rejilla-conceptos { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    .concepto { display: flex; flex-direction: column; gap: .75rem; padding: 1.5rem; border: 1px solid var(--color-filete); border-radius: 1rem; background: #fff; min-height: 10.25rem; }

    /* Artículo (ficha conceptual): la caja blanca de lectura con un párrafo destacado y un cuerpo. */
    .articulo { display: flex; flex-direction: column; gap: .8rem; padding: 2rem; border: 1px solid var(--color-filete); border-radius: 1rem; background: #fff; min-height: 14rem; }

    /* Encabezado de página: antetítulo, título y una línea de apoyo. */
    .encabezado { display: flex; flex-direction: column; gap: .8rem; padding: 1rem 0; min-height: 7rem; }
  `],
  template: `
    <span class="sr-only" role="status" aria-live="polite">{{ etiqueta() }}</span>
    @switch (variante()) {
      @case ('tarjeta') {
        <div class="rejilla" aria-hidden="true">
          @for (n of piezas(); track n) {
            <div class="tarjeta">
              <div class="bloque bloque--imagen"></div>
              <div class="tarjeta__cuerpo">
                <div class="bloque bloque--linea" style="width: 40%"></div>
                <div class="bloque bloque--linea-grande" style="width: 90%"></div>
                <div class="bloque bloque--linea" style="width: 75%"></div>
              </div>
            </div>
          }
        </div>
      }
      @case ('persona') {
        <div class="rejilla-personas" aria-hidden="true">
          @for (n of piezas(); track n) {
            <div class="persona">
              <div class="bloque bloque--foto"></div>
              <div class="tarjeta__cuerpo">
                <div class="bloque bloque--linea-grande" style="width: 80%"></div>
                <div class="bloque bloque--linea" style="width: 60%"></div>
                <div class="bloque bloque--linea" style="width: 45%"></div>
              </div>
            </div>
          }
        </div>
      }
      @case ('fila') {
        <div aria-hidden="true">
          @for (n of piezas(); track n) {
            <div class="fila">
              <div class="bloque bloque--miniatura"></div>
              <div class="fila__texto">
                <div class="bloque bloque--linea-grande" style="width: 60%"></div>
                <div class="bloque bloque--linea" style="width: 85%"></div>
              </div>
            </div>
          }
        </div>
      }
      @case ('ficha') {
        <div class="ficha" aria-hidden="true">
          <div class="bloque bloque--portada"></div>
          <div class="ficha__cuerpo">
            <div class="bloque bloque--linea" style="width: 25%"></div>
            <div class="bloque bloque--linea-grande" style="width: 70%"></div>
            <div class="bloque bloque--linea" style="width: 95%"></div>
            <div class="bloque bloque--linea" style="width: 88%"></div>
            <div class="bloque bloque--linea" style="width: 92%"></div>
            <div class="bloque bloque--linea" style="width: 60%"></div>
          </div>
        </div>
      }
      @case ('tabla') {
        <div class="tabla" aria-hidden="true">
          <div class="tabla__fila tabla__fila--cabecera">
            <div class="bloque bloque--linea" style="width: 50%"></div>
            <div class="bloque bloque--linea" style="width: 60%"></div>
            <div class="bloque bloque--linea" style="width: 60%"></div>
            <div class="bloque bloque--linea" style="width: 50%"></div>
          </div>
          @for (n of piezas(); track n) {
            <div class="tabla__fila">
              <div class="bloque bloque--linea" style="width: 80%"></div>
              <div class="bloque bloque--linea" style="width: 70%"></div>
              <div class="bloque bloque--linea" style="width: 55%"></div>
              <div class="bloque bloque--linea" style="width: 45%"></div>
            </div>
          }
        </div>
      }
      @case ('noticias') {
        <div class="noticias" aria-hidden="true">
          <div class="noticias__cabeza">
            <div class="bloque bloque--linea" style="width: 8rem"></div>
            <div class="bloque bloque--linea-grande" style="width: min(20rem, 70%)"></div>
          </div>
          <div class="noticias__rejilla">
            <div class="bloque noticias__destacada"></div>
            <div class="noticias__pila"><div class="bloque"></div><div class="bloque"></div></div>
            <div class="bloque noticias__boletin"></div>
          </div>
          <div class="rejilla">
            @for (n of piezas(); track n) {
              <div class="tarjeta">
                <div class="bloque bloque--imagen"></div>
                <div class="tarjeta__cuerpo">
                  <div class="bloque bloque--linea" style="width: 40%"></div>
                  <div class="bloque bloque--linea-grande" style="width: 90%"></div>
                  <div class="bloque bloque--linea" style="width: 75%"></div>
                </div>
              </div>
            }
          </div>
        </div>
      }
      @case ('concepto') {
        <div class="rejilla-conceptos" aria-hidden="true">
          @for (n of piezas(); track n) {
            <div class="concepto">
              <div class="bloque bloque--linea-grande" style="width: 65%"></div>
              <div class="bloque bloque--linea" style="width: 95%"></div>
              <div class="bloque bloque--linea" style="width: 80%"></div>
              <div class="bloque bloque--linea" style="width: 35%; margin-top: auto"></div>
            </div>
          }
        </div>
      }
      @case ('articulo') {
        <div class="articulo" aria-hidden="true">
          <div class="bloque bloque--linea-grande" style="width: 90%"></div>
          <div class="bloque bloque--linea-grande" style="width: 60%"></div>
          <div class="bloque bloque--linea" style="width: 95%; margin-top: 1.25rem"></div>
          <div class="bloque bloque--linea" style="width: 88%"></div>
          <div class="bloque bloque--linea" style="width: 70%"></div>
        </div>
      }
      @case ('formulario') {
        <div class="formulario" aria-hidden="true">
          @for (n of piezas(); track n) {
            <div class="formulario__campo">
              <div class="bloque bloque--linea" style="width: 7rem"></div>
              <div class="bloque bloque--control"></div>
            </div>
          }
        </div>
      }
      @default {
        <div class="encabezado" aria-hidden="true">
          <div class="bloque bloque--linea" style="width: 8rem"></div>
          <div class="bloque bloque--linea-grande" style="width: min(28rem, 80%)"></div>
          <div class="bloque bloque--linea" style="width: min(36rem, 95%)"></div>
        </div>
      }
    }
  `,
})
export class EsqueletoComponent {
  readonly variante = input<VarianteDeEsqueleto>('fila');
  /** Cuántas tarjetas, filas o filas de tabla se dibujan. Por omisión, las que caben en una pantalla. */
  readonly cantidad = input(undefined, { transform: (v: unknown) => (v === undefined || v === null ? undefined : numberAttribute(v)) });
  /** El único texto que oye un lector de pantalla; una vez, no por pieza. */
  readonly etiqueta = input('Cargando…');

  readonly piezas = computed(() => {
    const n = this.cantidad() ?? CANTIDAD_POR_OMISION[this.variante()];
    return Array.from({ length: Math.max(1, n) }, (_, i) => i);
  });
}
