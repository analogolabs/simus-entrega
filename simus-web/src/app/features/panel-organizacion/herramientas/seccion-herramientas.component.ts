import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCalendarClock, LucideChevronRight, LucideHistory } from '@lucide/angular';

import { rutaDelPanel } from '../../../core/navegacion/rutas-de-gestion';
import { EncabezadoDePantallaComponent } from '../../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { PanelOrganizacionStore } from '../panel-organizacion.store';

/**
 * Herramientas de la organización (`/gestion/o/{id}/herramientas`): lo que SIMUS ofrece más allá de los procesos (docs/referencia/26-agenda-de-citas-y-mercados.md).
 *
 * <b>CADA HERRAMIENTA ES UNA TARJETA ENTERA QUE SE PUEDE PULSAR</b> (punto 35 del mapa de comentarios): no hay botón «Abrir»
 * aparte; toda la tarjeta es el enlace. La tipografía es la escala común del espacio externo: el nombre es un H2 de la
 * escala, la frase es `t-texto` y la tarea, un rótulo `t-rotulo`; aquí no se escribe ningún tamaño. Cada una tiene su propia
 * pantalla: «Procesos históricos» (pedir la administración de lo que ya estaba en SIMUS) y «Agenda de citas» (las agendas de
 * las ediciones de tus Mercados).
 */
@Component({
  selector: 'app-seccion-herramientas',
  standalone: true,
  imports: [EncabezadoDePantallaComponent, RouterLink, LucideCalendarClock, LucideHistory, LucideChevronRight],
  styles: [`
    .herramientas { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); margin: 0; padding: 0; list-style: none; }
    .herramienta { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr) auto; align-items: start; gap: .25rem 1rem; height: 100%; padding: 1rem 1.125rem; border: 1px solid var(--color-filete); border-radius: .75rem; background: #fff; color: inherit; text-decoration: none; transition: border-color .12s, background-color .12s; }
    .herramienta:hover { border-color: var(--color-morado); background: var(--color-morado-50); }
    .herramienta:focus-visible { outline: 2px solid var(--color-morado); outline-offset: 2px; }
    .herramienta__icono { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: .5rem; background: var(--color-morado-50); color: var(--color-morado); }
    .herramienta__nombre { margin: 0; }
    .herramienta__texto { margin: .125rem 0 0; }
    .herramienta__tarea { margin: .5rem 0 0; color: var(--color-seccion); }
    .herramienta__flecha { align-self: center; color: var(--color-rotulo); }
    .herramienta:hover .herramienta__flecha { color: var(--color-morado); }
  `],
  template: `
    <div class="space-y-5 pb-8">
      <app-encabezado-de-pantalla titulo="Herramientas" descripcion="Lo que SIMUS ofrece más allá de tus procesos. Se usan cuando hacen falta." />

      <ul class="herramientas" data-testid="lista-de-herramientas">
        <li data-testid="herramienta-procesos-historicos">
          <a [routerLink]="enPanel('herramientas/procesos-historicos')" data-testid="abrir-procesos-historicos" class="herramienta">
            <span class="herramienta__icono" aria-hidden="true"><svg lucideHistory [size]="20"></svg></span>
            <div>
              <h2 class="herramienta__nombre">Procesos históricos</h2>
              <span class="herramienta__texto t-texto block">Busca los procesos que ya estaban en SIMUS sin organización y pide la administración de los que son tuyos.</span>
              <span class="herramienta__tarea t-rotulo block">Reclamar</span>
            </div>
            <span class="herramienta__flecha" aria-hidden="true"><svg lucideChevronRight [size]="18"></svg></span>
          </a>
        </li>
        <li data-testid="herramienta-agenda-de-citas">
          <a [routerLink]="enPanel('herramientas/agenda-de-citas')" data-testid="abrir-agenda-de-citas" class="herramienta">
            <span class="herramienta__icono" aria-hidden="true"><svg lucideCalendarClock [size]="20"></svg></span>
            <div>
              <h2 class="herramienta__nombre">Agenda de citas</h2>
              <span class="herramienta__texto t-texto block">Organiza las citas entre artistas y compradores durante una edición de tus Mercados: defines las franjas y a quién invitas.</span>
              <span class="herramienta__tarea t-rotulo block">Organizar</span>
            </div>
            <span class="herramienta__flecha" aria-hidden="true"><svg lucideChevronRight [size]="18"></svg></span>
          </a>
        </li>
      </ul>
    </div>
  `,
})
export class SeccionHerramientasComponent {
  private readonly store = inject(PanelOrganizacionStore);

  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }
}
