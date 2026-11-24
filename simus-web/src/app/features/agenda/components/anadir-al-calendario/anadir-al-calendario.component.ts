import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { LucideCalendarPlus, LucideChevronDown } from '@lucide/angular';
import { EventoDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { PanelAncladoDirective } from '../../../../shared/directives/panel-anclado.directive';
import { descargarEventoIcs, enlaceDeGoogleCalendar, enlaceDeOutlook, urlDelEvento } from '../../domain/agenda-ics';

let contador = 0;

/**
 * «AÑADIR A MI CALENDARIO»: UN MENÚ CON GOOGLE CALENDAR, OUTLOOK Y EL ARCHIVO .ICS (A-6).
 *
 * <b>EL DEFECTO.</b> El botón solo descargaba un archivo, sin decir qué hacía: quien usa Google Calendar o Outlook en
 * la web no sabía que debía abrir el archivo después, y el archivo traía la hora «flotante» (ver `agenda-ics.ts`).
 * Ahora ofrece tres caminos que añaden lo mismo: «Google Calendar» y «Outlook» abren el formulario de evento ya
 * escrito en una pestaña nueva; «Descargar archivo (.ics)» sirve para Apple Calendar, Outlook de escritorio y los
 * demás.
 *
 * <b>POR QUÉ NO `app-menu-de-acciones`.</b> Esa pieza coloca el panel con `position: absolute` y aquí viviría dentro
 * del acordeón de la lista de Agenda, que recorta (`overflow: hidden`): el menú saldría cortado, el mismo defecto de
 * A-3. Esta usa el panel anclado común (`appPanelAnclado`, `position: fixed` calculado contra la ventana) y la
 * escala de capas del portal.
 *
 * <b>TECLADO.</b> Enter, Espacio o Flecha abajo abren; las flechas recorren las opciones; Escape cierra y devuelve
 * el foco al botón; Tab cierra. Un clic fuera cierra.
 */
@Component({
  selector: 'app-anadir-al-calendario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelAncladoDirective, LucideCalendarPlus, LucideChevronDown],
  styles: [`
    :host { display: block; }
    :host(.completo) .calendario__disparador { width: 100%; }
    .calendario__panel {
      z-index: var(--z-desplegable, 60);
      display: flex; flex-direction: column; overflow-y: auto;
      width: max-content; min-width: 15rem; max-width: min(22rem, calc(100vw - 1rem));
      border: 1px solid var(--color-filete); border-radius: var(--radius-control); background: #fff;
      box-shadow: var(--shadow-menu); padding: .3rem;
    }
    .calendario__opcion {
      display: flex; align-items: center; width: 100%; min-height: var(--spacing-control-comodo);
      border-radius: .45rem; padding: .35rem .75rem; color: var(--color-valor); font-size: var(--text-cuerpo);
      font-weight: 600; text-align: left; text-decoration: none; background: none; border: 0; cursor: pointer;
    }
    .calendario__opcion:hover, .calendario__opcion:focus-visible { background: #f3f4f8; color: var(--color-morado); }
    .calendario__opcion:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: -2px; }
    .calendario__nota { padding: .1rem .75rem .35rem; color: var(--color-rotulo); font-size: var(--text-dato); }
  `],
  template: `
    <button type="button" #disparador [class]="clases()" class="calendario__disparador"
      aria-haspopup="menu" [attr.aria-expanded]="abierto()" [attr.aria-controls]="abierto() ? idDelMenu : null"
      [attr.data-testid]="identificador()"
      (click)="alternar()" (keydown.arrowdown)="abrirYEnfocar($event)">
      <svg lucideCalendarPlus [size]="16" aria-hidden="true"></svg>
      <span>Añadir a mi calendario</span>
      <svg lucideChevronDown [size]="14" aria-hidden="true"></svg>
    </button>

    @if (abierto()) {
      <div class="calendario__panel" role="menu" [id]="idDelMenu" aria-label="Añadir a mi calendario" [appPanelAnclado]="disparador">
        <a class="calendario__opcion" role="menuitem" target="_blank" rel="noopener noreferrer" data-testid="calendario-google"
          [href]="google()" (click)="cerrar()">Google Calendar<span class="sr-only"> (se abre en otra pestaña)</span></a>
        <a class="calendario__opcion" role="menuitem" target="_blank" rel="noopener noreferrer" data-testid="calendario-outlook"
          [href]="outlook()" (click)="cerrar()">Outlook<span class="sr-only"> (se abre en otra pestaña)</span></a>
        <button type="button" class="calendario__opcion" role="menuitem" data-testid="calendario-ics" (click)="descargar()">
          Descargar archivo (.ics)
        </button>
        <p class="calendario__nota">El archivo sirve para Apple Calendar y Outlook de escritorio.</p>
      </div>
    }
  `,
  host: {
    '(document:click)': 'alPulsarFuera($event)',
    // El teclado se escucha en el anfitrión: el panel es un `div` sin foco propio y el foco está siempre en un
    // descendiente real (el botón o una opción).
    '(keydown)': 'alTeclear($event)',
    '[class.completo]': 'completo()',
  },
})
export class AnadirAlCalendarioComponent {
  readonly evento = input.required<EventoDeDiseno>();
  /** El botón ocupa todo el ancho (la ficha y las tarjetas). */
  readonly completo = input(true);
  readonly identificador = input<string | null>('anadir-al-calendario');
  /** Las clases del botón: el mismo juego que `app-boton` secundaria, del tamaño cómodo del portal. */
  readonly clases = input('inline-flex items-center justify-center gap-2 rounded-xl border border-filete bg-transparent px-6 min-h-(--spacing-control-comodo) tipo-enlace text-titulo transition hover:border-morado hover:text-morado cursor-pointer foco-simus');

  private readonly anfitrion: ElementRef<HTMLElement> = inject(ElementRef);
  protected readonly abierto = signal(false);
  protected readonly idDelMenu = `menu-de-calendario-${++contador}`;
  private readonly url = computed(() => urlDelEvento(this.evento()));
  protected readonly google = computed(() => enlaceDeGoogleCalendar(this.evento(), this.url()));
  protected readonly outlook = computed(() => enlaceDeOutlook(this.evento(), this.url()));

  protected alternar(): void {
    const abriendo = !this.abierto();
    this.abierto.set(abriendo);
    if (abriendo) { this.enfocarOpcion(0); }
  }

  protected abrirYEnfocar(evento: Event): void {
    evento.preventDefault();
    if (!this.abierto()) { this.abierto.set(true); }
    this.enfocarOpcion(0);
  }

  protected cerrar(devolverFoco = false): void {
    if (!this.abierto()) { return; }
    this.abierto.set(false);
    if (devolverFoco) { this.anfitrion.nativeElement.querySelector<HTMLElement>('.calendario__disparador')?.focus(); }
  }

  protected descargar(): void {
    descargarEventoIcs(this.evento());
    this.cerrar(true);
  }

  protected alTeclear(evento: KeyboardEvent): void {
    if (!this.abierto()) { return; }
    const opciones = Array.from(this.anfitrion.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const actual = opciones.indexOf(document.activeElement as HTMLElement);
    switch (evento.key) {
      case 'ArrowDown': evento.preventDefault(); opciones[(actual + 1) % opciones.length]?.focus(); break;
      case 'ArrowUp': evento.preventDefault(); opciones[(actual - 1 + opciones.length) % opciones.length]?.focus(); break;
      case 'Home': evento.preventDefault(); opciones[0]?.focus(); break;
      case 'End': evento.preventDefault(); opciones[opciones.length - 1]?.focus(); break;
      case 'Escape': evento.preventDefault(); evento.stopPropagation(); this.cerrar(true); break;
      case 'Tab': this.cerrar(false); break;
    }
  }

  protected alPulsarFuera(evento: MouseEvent): void {
    if (this.abierto() && !this.anfitrion.nativeElement.contains(evento.target as Node)) { this.cerrar(false); }
  }

  private enfocarOpcion(indice: number): void {
    // El panel existe en el DOM tras el siguiente ciclo de detección.
    setTimeout(() => this.anfitrion.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]')[indice]?.focus());
  }
}
