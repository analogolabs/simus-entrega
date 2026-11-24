import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * UN PANEL DE SECCIÓN: el apartado de una pantalla del espacio de gestión (panel de la organización y Mi espacio),
 * con su título, un contador opcional, una acción a la derecha y su contenido (PANEL3).
 *
 * <b>APLANADO (P1 de la gestión externa, prototipo B4).</b> Un panel ya no es una caja con borde: es un apartado
 * con su encabezado de sección (tipografía de títulos, color morado) sobre el fondo de la pantalla. La jerarquía la
 * dan el encabezado, el espacio entre apartados y los tonos de estado; las líneas existen SOLO entre filas, con la
 * clase `filas-de-panel` en la lista.
 *
 * <b>REGLAS DE USO</b>
 * <ul>
 *   <li>Un solo nivel: dentro de un panel NO va otro panel ni una tarjeta con borde. Las filas se agrupan con espacio,
 *     o con un fondo suave (`bg-slate-50`) si necesitan separarse, nunca con filetes.</li>
 *   <li>Sin caja: ni borde ni sombra ni relleno. El fondo sutil lo pone la zona de la pantalla (banda, columna lateral).</li>
 *   <li>El título es un encabezado real: `nivel` 2 por omisión (la pantalla tiene un h1) o 3 si el panel vive dentro
 *     de otra sección con h2. La región se nombra con él (`aria-labelledby`).</li>
 *   <li>`tono="atencion"` tiñe el apartado de ámbar suave para lo que espera una acción; el resto es `neutro`.</li>
 *   <li>La acción (un enlace «Ver todas…») se proyecta con el atributo `accion`; el contador es texto, p. ej. «3».
 *     Un icono opcional se proyecta con el atributo `icono` y va antes del título (decorativo: `aria-hidden`).</li>
 * </ul>
 *
 * <pre>
 * &lt;app-panel-de-seccion titulo="Próximos eventos" idDelTitulo="inicio-eventos"&gt;
 *   &lt;a accion routerLink="…"&gt;Ver eventos&lt;/a&gt;
 *   …contenido…
 * &lt;/app-panel-de-seccion&gt;
 * </pre>
 */
@Component({
  selector: 'app-panel-de-seccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; min-width: 0; }
    /* APLANADO (P1 de la gestión externa, prototipo B4): sin caja, sin borde, sin relleno propio. El apartado se
       distingue por su encabezado y por el aire entre apartados; el fondo lo pone el lienzo de la pantalla. */
    .panel { min-width: 0; }
    .panel--atencion { border-radius: .75rem; background: var(--color-atencion-suave, #fff4d1); padding: 1rem 1.125rem; }
    .panel__cabecera { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .25rem .75rem; margin: 0 0 .75rem; }
    .panel--compacto .panel__cabecera { margin-bottom: .5rem; }
    .panel__titulo { display: flex; min-width: 0; align-items: center; gap: .5rem; }
    .panel__titulo > * { margin: 0; }
    .panel__titulo :is(h2, h3) { font-family: var(--font-alternate); font-size: 1.375rem; font-weight: 600; line-height: 1.2; letter-spacing: .01em; color: var(--color-morado); }
    .panel--compacto .panel__titulo :is(h2, h3) { font-size: 1.125rem; }
    .panel__contador { display: inline-grid; min-width: 1.5rem; height: 1.5rem; place-items: center; border-radius: 999px; background: var(--color-morado-100, #eee9ef); padding: 0 .5rem; color: var(--color-morado, #4c2c54); font-size: var(--text-dato); font-weight: 800; font-variant-numeric: tabular-nums; }
    .panel--atencion .panel__contador { background: #f6e3b4; color: #6b4300; }
    .panel__accion { font-size: var(--text-cuerpo); font-weight: 700; }
    .panel__accion:empty { display: none; }
    .panel__accion ::ng-deep a { color: var(--color-verde-texto); text-decoration: none; }
    .panel__accion ::ng-deep a:hover { text-decoration: underline; }
    /* LÍNEAS SOLO ENTRE FILAS: una lista con la clase «filas-de-panel» separa cada fila de la siguiente con un
       filete suave; nunca arriba de la primera ni debajo de la última. */
    :host ::ng-deep .filas-de-panel { margin: 0; padding: 0; list-style: none; }
    :host ::ng-deep .filas-de-panel > li + li { border-top: 1px solid var(--color-filete, #e7eaf0); }
  `],
  template: `
    <section class="panel" [class.panel--compacto]="densidad() === 'compacto'" [class.panel--atencion]="tono() === 'atencion'"
             [attr.aria-labelledby]="idDelTitulo()">
      <header class="panel__cabecera">
        <div class="panel__titulo">
          <ng-content select="[icono]" />
          @if (nivel() === 3) { <h3 [attr.id]="idDelTitulo()">{{ titulo() }}</h3> }
          @else { <h2 [attr.id]="idDelTitulo()">{{ titulo() }}</h2> }
          @if (contador() !== null && contador() !== undefined) {
            <span class="panel__contador" [attr.aria-label]="'Cantidad: ' + contador()">{{ contador() }}</span>
          }
        </div>
        <div class="panel__accion"><ng-content select="[accion]" /></div>
      </header>
      <ng-content />
    </section>
  `,
})
export class PanelDeSeccionComponent {
  readonly titulo = input.required<string>();
  /** El id del encabezado; la región se nombra con él. Obligatorio para que cada panel tenga su nombre accesible. */
  readonly idDelTitulo = input.required<string>();
  /** 2 por omisión; 3 si el panel vive dentro de otra sección con h2. */
  readonly nivel = input<2 | 3>(2);
  /** Una cantidad breve junto al título («3»); sin ella no se pinta nada. */
  readonly contador = input<string | number | null | undefined>(null);
  readonly tono = input<'neutro' | 'atencion'>('neutro');
  readonly densidad = input<'normal' | 'compacto'>('normal');
}
