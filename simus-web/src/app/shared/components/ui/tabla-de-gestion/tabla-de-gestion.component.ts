import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Directive, ElementRef, Renderer2, TemplateRef, effect, computed, contentChildren, inject, input, output, ViewEncapsulation, booleanAttribute } from '@angular/core';
import { EstadoDeOrden } from '../orden-de-lista/orden-de-lista';
import { AccionDeFila, AccionElegida, AccionesDeFilaComponent } from './acciones-de-fila.component';

/**
 * El ancho de una columna. La tabla usa `table-layout: fixed` con anchos de rejilla: así el ESTADO y la FECHA
 * quedan alineados de fila a fila aunque los nombres sean largos o cortos.
 *
 * - `principal`: lo que sobra; lleva el nombre, el tipo y el detalle (la fila entera se lee desde aquí).
 * - `estado`: 11 rem, para el indicador de estado con texto.
 * - `fecha`: 9,5 rem.
 * - `media`: 12 rem (un rol, un tipo, un proceso).
 * - `corta`: 7 rem (un tamaño, una cantidad).
 */
export type AnchoDeColumna = 'principal' | 'estado' | 'fecha' | 'media' | 'corta';

/** Una columna de `app-tabla-de-gestion`. La columna «Acciones» no se declara: la añade la tabla si hay `acciones`. */
export interface ColumnaDeGestion {
  readonly id: string;
  readonly etiqueta: string;
  readonly ancho?: AnchoDeColumna;
  /**
   * Si el encabezado ordena. Por omisión SÍ; una columna sin criterio de orden declara `false` y se pinta como
   * texto, sin botón ni flecha (una cabecera que ofrece ordenar y no hace nada es un defecto).
   */
  readonly ordenable?: boolean;
}

/** El contexto de una plantilla de celda: la fila es `$implicit` (`let-fila`). */
export interface ContextoDeCelda<T> { $implicit: T; indice: number }

/**
 * La plantilla de UNA celda: `<ng-template appCelda="estado" let-fila>…</ng-template>`. La columna con el mismo `id`
 * pinta esa plantilla; una columna sin plantilla queda vacía.
 */
@Directive({ selector: 'ng-template[appCelda]', standalone: true })
export class CeldaDeTablaDirective {
  readonly id = input.required<string>({ alias: 'appCelda' });
  readonly plantilla = inject<TemplateRef<ContextoDeCelda<unknown>>>(TemplateRef);
}

/**
 * La plantilla del DETALLE de una fila (el historial, por ejemplo): se pinta en una fila extra debajo de la fila cuya
 * clave coincide con `detalleAbierto`. `<ng-template appDetalleDeFila let-fila>…</ng-template>`.
 */
@Directive({ selector: 'ng-template[appDetalleDeFila]', standalone: true })
export class DetalleDeFilaDirective {
  readonly plantilla = inject<TemplateRef<ContextoDeCelda<unknown>>>(TemplateRef);
}

/** Pone en la fila `<tr>` los atributos que la pantalla pide con `atributosDeFila` (p. ej. `data-testid`). Interno. */
@Directive({ selector: 'tr[appAtributosDeFila]', standalone: true })
export class AtributosDeFilaDirective {
  readonly atributos = input<Readonly<Record<string, string | null>> | null>(null, { alias: 'appAtributosDeFila' });
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);
  private puestos: string[] = [];
  constructor() {
    effect(() => {
      for (const nombre of this.puestos) this.renderer.removeAttribute(this.elemento, nombre);
      const nuevos = this.atributos() ?? {};
      this.puestos = Object.keys(nuevos).filter(k => nuevos[k] !== null);
      for (const nombre of this.puestos) this.renderer.setAttribute(this.elemento, nombre, nuevos[nombre] as string);
    });
  }
}

/**
 * LA TABLA DE LISTAS DE GESTIÓN (P3, prototipo B4): Solicitudes, Procesos y Eventos —y, después, Equipo y Archivos— se
 * leen en la misma tabla, con las mismas reglas.
 *
 * <b>QUÉ DECIDE ESTA PIEZA</b>: la rejilla fija (nombre flexible; estado, fecha… con ancho fijo), los encabezados
 * ordenables con `aria-sort` y teclado, la columna «Acciones» con `app-acciones-de-fila`, la fila que abre el
 * detalle, y la forma móvil. <b>QUÉ NO DECIDE</b>: el contenido de las celdas (lo pinta la pantalla con
 * `appCelda`), el orden de las filas (la pantalla las ordena; la tabla solo muestra y avisa) ni qué hace cada acción.
 *
 * <b>ORDEN.</b> `orden` es el estado vigente; el botón del encabezado emite `ordenar` con el `id` de la columna y la
 * pantalla aplica `alternarOrden` y `ordenarFilas` (de `orden-de-lista`). El encabezado lleva `aria-sort`
 * («ascending», «descending» o «none») y una flecha ▲/▼. El mismo estado alimenta `app-orden-de-lista`.
 *
 * <b>LA FILA ABRE EL DETALLE.</b> Con `filaAbre`, un clic en cualquier parte de la fila (que no sea un enlace, un botón
 * ni el menú) emite `abrir`. El camino accesible NO es el clic de la fila: la celda principal lleva su propio enlace
 * (`class="tg-titulo"`) y el menú tiene «Abrir». El clic de la fila es un atajo para el ratón.
 *
 * <b>MÓVIL.</b> Por debajo de 40 rem de ancho DEL CONTENEDOR (no de la ventana: cambia con el menú lateral) la tabla
 * pierde los encabezados y cada fila pasa a una tarjeta sin borde: nombre y acciones arriba, y las demás celdas debajo,
 * una por línea. El orden se cambia entonces con «Ordenar por» de la barra de herramientas.
 *
 * <b>CLASES PARA LAS CELDAS</b> (sin encapsulación, para que lleguen a lo que pinta la pantalla): `tg-rotulo` (la
 * línea de tipo en mayúsculas pequeñas, morado), `tg-titulo` (el nombre; enlace o texto en negrita), `tg-detalle` (la
 * línea gris de detalle) y `tg-aparte` (segunda línea de una celda, p. ej. «hasta 18 dic»).
 *
 * @example
 * <app-tabla-de-gestion etiqueta="Procesos" [columnas]="columnas" [filas]="filas()" [clave]="clave"
 *   [orden]="orden()" (ordenar)="orden.set(alternarOrden(orden(), $event))"
 *   [acciones]="accionesDe" [descripcionDeFila]="nombreDe" (accion)="alAccion($event)" filaAbre (abrir)="abrir($event)">
 *   <ng-template appCelda="nombre" let-p><a class="tg-titulo" [routerLink]="…">{{ p.nombre }}</a></ng-template>
 *   <ng-template appCelda="estado" let-p><app-indicador-de-estado … /></ng-template>
 * </app-tabla-de-gestion>
 */
@Component({
  selector: 'app-tabla-de-gestion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, AccionesDeFilaComponent, AtributosDeFilaDirective],
  // SIN ENCAPSULACIÓN: las celdas las pinta la pantalla dentro de `ng-template`, y sus nodos no llevan el atributo de
  // este componente; con estilos encapsulados `tg-titulo` y compañía nunca les llegarían.
  encapsulation: ViewEncapsulation.None,
  styles: [`
    app-tabla-de-gestion { display: block; container-type: inline-size; }
    .tg { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: var(--text-cuerpo); color: var(--color-valor); }
    .tg th { padding: .5rem .75rem; border-bottom: 1px solid var(--color-filete); color: var(--color-rotulo); font-size: var(--text-dato); font-weight: 700; text-align: left; vertical-align: bottom; }
    .tg td { padding: .75rem; border-top: 1px solid var(--color-filete); vertical-align: middle; overflow-wrap: anywhere; }
    .tg tbody tr:first-child > td { border-top: 0; }
    .tg .tg__c--estado { width: 11rem; }
    .tg .tg__c--fecha { width: 9.5rem; }
    .tg .tg__c--media { width: 12rem; }
    .tg .tg__c--corta { width: 7rem; }
    .tg .tg__c--acciones { width: 5rem; text-align: right; }
    .tg tbody tr[data-fila-abre] { cursor: pointer; }
    .tg tbody tr[data-fila-abre]:hover > td { background: var(--color-hueso); }
    .tg__ordenar { display: inline-flex; align-items: center; gap: .35rem; min-height: var(--spacing-control-minimo); padding: .25rem 0; border: 0; border-radius: .375rem; background: none;
      color: inherit; font: inherit; cursor: pointer; }
    .tg__ordenar:hover { color: var(--color-morado); }
    .tg__ordenar:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); }
    .tg th[aria-sort='ascending'] .tg__ordenar, .tg th[aria-sort='descending'] .tg__ordenar { color: var(--color-morado); }
    .tg__flecha { display: inline-block; width: .75rem; font-size: .625rem; color: var(--color-morado); }
    .tg-rotulo { margin: 0 0 .125rem; color: var(--color-morado-claro); font-size: var(--text-dato); font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
    .tg-titulo { display: inline; padding: 0; border: 0; background: none; color: var(--color-morado); font: inherit; font-weight: 700; text-align: left; text-decoration: none; }
    a.tg-titulo:hover, button.tg-titulo:hover { text-decoration: underline; }
    a.tg-titulo:focus-visible, button.tg-titulo:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); border-radius: .25rem; }
    /* Hasta dos líneas en la tabla (el resto se corta con puntos suspensivos); completo en las tarjetas del móvil. */
    .tg-detalle { display: -webkit-box; margin: .125rem 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; color: var(--color-rotulo); font-size: var(--text-cuerpo); }
    .tg-aparte { display: block; color: var(--color-rotulo); font-size: var(--text-dato); }
    .tg__detalle > td { padding: 0; background: var(--color-niebla); }
    /* LA FORMA DE TARJETAS (sin encabezados, cada fila una tarjeta sin borde) aparece cuando el contenedor es más angosto que el
       umbral: 40 rem por omisión y 28 rem con tarjetasBajo="estrecho" (Miembros e Invitaciones del Equipo, que viven en una
       columna angosta y aun así caben como tabla). Son las mismas reglas escritas dos veces, escopadas a su raíz: Angular exige
       estilos literales y no admite generarlos con una función. Si cambias unas, cambia las otras. */
    @container (max-width: 40rem) {
      .tg:not(.tg--estrecha) thead { display: none; }
      .tg:not(.tg--estrecha), .tg:not(.tg--estrecha) tbody, .tg:not(.tg--estrecha) tr, .tg:not(.tg--estrecha) td { display: block; width: auto; }
      .tg:not(.tg--estrecha) tr[data-fila] { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .375rem .5rem; align-items: start; padding: .75rem 0; border-top: 1px solid var(--color-filete); }
      .tg:not(.tg--estrecha) tbody tr[data-fila]:first-child { border-top: 0; }
      .tg:not(.tg--estrecha) td { padding: 0; border: 0; }
      .tg:not(.tg--estrecha) tbody tr[data-fila-abre]:hover > td { background: none; }
      .tg:not(.tg--estrecha) td[data-rol='principal'] { grid-column: 1; grid-row: 1; }
      .tg:not(.tg--estrecha) td[data-rol='acciones'] { grid-column: 2; grid-row: 1; width: auto; }
      .tg:not(.tg--estrecha) td[data-rol='estado'], .tg:not(.tg--estrecha) td[data-rol='media'] { grid-column: 1 / -1; grid-row: 2; }
      .tg:not(.tg--estrecha) td[data-rol='fecha'], .tg:not(.tg--estrecha) td[data-rol='corta'] { grid-column: 1 / -1; grid-row: 3; color: var(--color-prosa); }
      .tg:not(.tg--estrecha) .tg-detalle { display: block; -webkit-line-clamp: unset; line-clamp: unset; }
      .tg:not(.tg--estrecha) .tg-aparte { display: inline; margin-left: .375rem; }
      .tg:not(.tg--estrecha) .tg-aparte::before { content: '· '; }
    }
    @container (max-width: 28rem) {
      .tg.tg--estrecha thead { display: none; }
      .tg.tg--estrecha, .tg.tg--estrecha tbody, .tg.tg--estrecha tr, .tg.tg--estrecha td { display: block; width: auto; }
      .tg.tg--estrecha tr[data-fila] { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .375rem .5rem; align-items: start; padding: .75rem 0; border-top: 1px solid var(--color-filete); }
      .tg.tg--estrecha tbody tr[data-fila]:first-child { border-top: 0; }
      .tg.tg--estrecha td { padding: 0; border: 0; }
      .tg.tg--estrecha tbody tr[data-fila-abre]:hover > td { background: none; }
      .tg.tg--estrecha td[data-rol='principal'] { grid-column: 1; grid-row: 1; }
      .tg.tg--estrecha td[data-rol='acciones'] { grid-column: 2; grid-row: 1; width: auto; }
      .tg.tg--estrecha td[data-rol='estado'], .tg.tg--estrecha td[data-rol='media'] { grid-column: 1 / -1; grid-row: 2; }
      .tg.tg--estrecha td[data-rol='fecha'], .tg.tg--estrecha td[data-rol='corta'] { grid-column: 1 / -1; grid-row: 3; color: var(--color-prosa); }
      .tg.tg--estrecha .tg-detalle { display: block; -webkit-line-clamp: unset; line-clamp: unset; }
      .tg.tg--estrecha .tg-aparte { display: inline; margin-left: .375rem; }
      .tg.tg--estrecha .tg-aparte::before { content: '· '; }
    }
  `],
  template: `
    <table class="tg" [class.tg--estrecha]="tarjetasBajo() === 'estrecho'" data-tabla-de-gestion>
      <caption class="sr-only">{{ etiqueta() }}</caption>
      <thead>
        <tr>
          @for (columna of columnas(); track columna.id) {
            <th scope="col" [class]="'tg__c--' + (columna.ancho ?? 'principal')" [attr.aria-sort]="columna.ordenable === false ? null : ariaSortDe(columna.id)">
              @if (columna.ordenable === false) { {{ columna.etiqueta }} } @else {
                <button type="button" class="tg__ordenar" [attr.data-ordenar]="columna.id" (click)="ordenar.emit(columna.id)">
                  {{ columna.etiqueta }}<span class="tg__flecha" aria-hidden="true">{{ flechaDe(columna.id) }}</span>
                </button>
              }
            </th>
          }
          @if (conAcciones()) { <th scope="col" class="tg__c--acciones">Acciones</th> }
        </tr>
      </thead>
      <tbody>
        @for (fila of filas(); track clave()(fila); let i = $index) {
          <tr data-fila [appAtributosDeFila]="atributosDe(fila)" [attr.data-fila-abre]="filaAbre() ? '' : null" (click)="alPulsarFila($event, fila)">
            @for (columna of columnas(); track columna.id) {
              <td [attr.data-rol]="columna.ancho ?? 'principal'">
                @if (plantillaDe(columna.id); as plantilla) {
                  <ng-container [ngTemplateOutlet]="plantilla" [ngTemplateOutletContext]="{ $implicit: fila, indice: i }" />
                }
              </td>
            }
            @if (conAcciones()) {
              <td data-rol="acciones" class="tg__c--acciones">
                <app-acciones-de-fila [acciones]="accionesDe(fila)" [descripcion]="descripcionDe(fila)" (elegida)="accion.emit({ fila, accion: $event })" />
              </td>
            }
          </tr>
          @if (detalleAbierto() !== null && detalleAbierto() === clave()(fila) && plantillaDeDetalle(); as detalle) {
            <tr class="tg__detalle"><td [attr.colspan]="columnas().length + (conAcciones() ? 1 : 0)">
              <ng-container [ngTemplateOutlet]="detalle" [ngTemplateOutletContext]="{ $implicit: fila, indice: i }" />
            </td></tr>
          }
        }
      </tbody>
    </table>
  `,
})
export class TablaDeGestionComponent<T> {
  /** Qué lista es, para el título accesible de la tabla («Procesos»). */
  readonly etiqueta = input.required<string>();
  readonly columnas = input.required<readonly ColumnaDeGestion[]>();
  readonly filas = input.required<readonly T[]>();
  /** La clave única y estable de una fila (para `track` y para `detalleAbierto`). */
  readonly clave = input.required<(fila: T) => string | number>();
  /** El orden vigente (los encabezados lo reflejan). Sin él, ninguna columna se marca. */
  readonly orden = input<EstadoDeOrden | null>(null);
  /** Las acciones de una fila. Sin esta función no hay columna «Acciones». */
  readonly acciones = input<((fila: T) => readonly AccionDeFila[]) | null>(null);
  /** El nombre de la fila para el nombre accesible del menú («Acciones de …»). */
  readonly descripcionDeFila = input<((fila: T) => string) | null>(null);
  /** Atributos que se ponen en la `<tr>` de cada fila: `data-testid`, `data-tipo`… (nombre → valor; `null` no se pone). */
  readonly atributosDeFila = input<((fila: T) => Readonly<Record<string, string | null>>) | null>(null);
  /** Un clic en la fila emite `abrir`. */
  readonly filaAbre = input(false, { transform: booleanAttribute });
  /**
   * Cuándo la tabla pasa a tarjetas: `normal` (por debajo de 40 rem de ancho del contenedor) o `estrecho` (por debajo de
   * 28 rem), para una tabla que vive en una columna angosta de una pantalla de dos columnas y aun así cabe como tabla.
   */
  readonly tarjetasBajo = input<'normal' | 'estrecho'>('normal');
  /** La clave de la fila cuyo detalle (`appDetalleDeFila`) está desplegado. */
  readonly detalleAbierto = input<string | number | null>(null);

  /** El encabezado de una columna ordenable se pulsó. */
  readonly ordenar = output<string>();
  /** Se eligió y confirmó una acción de la fila. */
  readonly accion = output<{ fila: T; accion: AccionElegida }>();
  /** Se pulsó la fila (solo con `filaAbre`). */
  readonly abrir = output<T>();

  private readonly celdas = contentChildren(CeldaDeTablaDirective);
  private readonly detalles = contentChildren(DetalleDeFilaDirective);

  protected readonly conAcciones = computed(() => this.acciones() !== null);
  protected readonly plantillaDeDetalle = computed(() => this.detalles()[0]?.plantilla ?? null);

  protected plantillaDe(id: string): TemplateRef<ContextoDeCelda<unknown>> | null {
    return this.celdas().find(c => c.id() === id)?.plantilla ?? null;
  }
  protected accionesDe(fila: T): readonly AccionDeFila[] { return this.acciones()?.(fila) ?? []; }
  protected atributosDe(fila: T): Readonly<Record<string, string | null>> | null { return this.atributosDeFila()?.(fila) ?? null; }
  protected descripcionDe(fila: T): string { return this.descripcionDeFila()?.(fila) ?? ''; }

  protected ariaSortDe(columna: string): 'none' | 'ascending' | 'descending' {
    const o = this.orden();
    if (!o || o.columna !== columna) return 'none';
    return o.direccion === 'asc' ? 'ascending' : 'descending';
  }
  protected flechaDe(columna: string): string {
    const o = this.orden();
    return o && o.columna === columna ? (o.direccion === 'asc' ? '▲' : '▼') : '';
  }

  protected alPulsarFila(evento: MouseEvent, fila: T): void {
    if (!this.filaAbre()) return;
    if ((evento.target as Element).closest('a, button, input, select, textarea, [role="menu"], app-acciones-de-fila')) return;
    this.abrir.emit(fila);
  }
}
