import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { rutaDelPanel } from '../../../core/navegacion/rutas-de-gestion';
import {
  AgendamientoDeCitasService, EdicionConAgenda, etiquetaDeEstadoDeAgenda, tonoDeEstadoDeAgenda,
} from '../../../core/services/agendamiento-de-citas.service';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { FalloDelServidor } from '../panel-organizacion.api';
import { PanelOrganizacionStore } from '../panel-organizacion.store';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { EncabezadoDePantallaComponent } from '../../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { EsqueletoComponent } from '../../../shared/components/ui/esqueleto/esqueleto.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';

/** Las ediciones de un mismo Mercado, juntas: así el listado se lee por Mercado y no como filas sueltas. */
interface MercadoConEdiciones {
  mercadoId: number;
  nombre: string;
  ediciones: EdicionConAgenda[];
}

/**
 * «Agenda de citas», una herramienta de la organización (`/gestion/o/{id}/herramientas/agenda-de-citas`, PANEL2, docs/referencia/26-agenda-de-citas-y-mercados.md).
 *
 * <b>LA GESTIÓN DE LA AGENDA TIENE SU PROPIA ENTRADA.</b> Antes la lista de ediciones colgaba debajo de la lista de herramientas y
 * parecía parte de la pantalla de Herramientas; ahora Herramientas solo presenta las herramientas (todas con la misma forma) y esta
 * pantalla es donde se gestiona la agenda de cada edición.
 *
 * <b>LA HERRAMIENTA CUELGA DE LA EDICIÓN</b>, no del Mercado: cada edición habilita su propia agenda, con su propio modo, sus franjas
 * y sus invitados. Una edición sin agenda ofrece habilitarla; una con agenda lleva a gestionarla. El listado agrupa las ediciones por
 * Mercado, con el nombre del Mercado como título del grupo.
 */
@Component({
  selector: 'app-agenda-de-citas-herramienta',
  standalone: true,
  imports: [EncabezadoDePantallaComponent, BotonNativoDirective, EsqueletoComponent, EstadoDeListaComponent, IndicadorDeEstadoComponent, RouterLink, FechaPipe],
  template: `
    <div class="space-y-6 pb-8">
      <p class="t-ayuda">
        <a [routerLink]="enPanel('herramientas')" class="font-bold text-verde-texto hover:underline">Herramientas</a>
        <span aria-hidden="true"> / </span>Agenda de citas
      </p>
      <app-encabezado-de-pantalla titulo="Agenda de citas"
        descripcion="Organiza las citas entre artistas y compradores o bookers durante una edición de tus Mercados. Tú defines las franjas y a quién invitas; los artistas se inscriben y piden su cita."
        [contador]="contador()" />

      @if (error()) { <p role="alert" class="bg-red-50 p-3 text-cuerpo text-red-800">{{ error() }}</p> }

      @if (cargando()) {
        <app-esqueleto variante="fila" [cantidad]="3" etiqueta="Consultando las ediciones…" />
      } @else if (!ediciones().length) {
        <app-estado-de-lista data-testid="sin-ediciones" titulo="Todavía no tienes ediciones de Mercado"
          detalle="La agenda de citas se habilita sobre una edición. Registra un Mercado y su primera edición en Procesos y vuelve aquí.">
          <a [routerLink]="enPanel('procesos/mercados')" appBoton="secundaria">Ir a Mercados</a>
        </app-estado-de-lista>
      } @else {
        <div class="space-y-8 [&>section:not(:first-child)]:border-t [&>section:not(:first-child)]:border-slate-200 [&>section:not(:first-child)]:pt-6" data-testid="ediciones-por-mercado">
          @for (mercado of mercados(); track mercado.mercadoId) {
            <section [attr.aria-labelledby]="'mercado-' + mercado.mercadoId">
              <h2 [id]="'mercado-' + mercado.mercadoId">{{ mercado.nombre }}</h2>
              <ul class="mt-2 divide-y divide-slate-200 border-y border-slate-200">
                @for (edicion of mercado.ediciones; track edicion.edicionId) {
                  <li class="grid gap-3 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_10rem] sm:items-center" data-testid="fila-de-edicion">
                    <div class="min-w-0">
                      <p class="sr-only">{{ edicion.mercadoNombre }}</p>
                      <h3 class="truncate">Edición {{ edicion.anio }}</h3>
                      @if (edicion.edicionNombre) { <p class="t-ayuda break-words">{{ edicion.edicionNombre }}</p> }
                    </div>
                    <p class="t-texto">
                      @if (edicion.fechaInicio) { {{ edicion.fechaInicio | fecha }}@if (edicion.fechaFin) { al {{ edicion.fechaFin | fecha }} } }
                      @else { Fechas por definir }
                    </p>
                    <p class="t-texto inline-flex items-center gap-2" data-testid="estado-de-la-agenda">
                      @if (edicion.agendaEstado) {
                        <app-indicador-de-estado [etiqueta]="etiqueta(edicion.agendaEstado)" [tono]="tono(edicion.agendaEstado)" [conTexto]="true" />
                        @if ((edicion.agendas?.length ?? 0) > 1) { <span class="t-ayuda">· {{ edicion.agendas!.length }} agendas</span> }
                      } @else { Sin agenda de citas }
                    </p>
                    @if (edicion.agendaId) {
                      <a [routerLink]="enPanel('procesos/mercados', edicion.mercadoId, 'agenda-de-citas', edicion.agendaId)" data-testid="gestionar-agenda" appBoton="secundaria" tamano="menudo">Gestionar</a>
                    } @else if (puedeHabilitar(edicion)) {
                      <a [routerLink]="enPanel('procesos/mercados', edicion.mercadoId, 'agenda-de-citas/nueva', edicion.edicionId)" data-testid="habilitar-agenda" appBoton="principal" tamano="menudo">Habilitar la agenda</a>
                    } @else {
                      <span></span>
                    }
                  </li>
                }
              </ul>
            </section>
          }
        </div>
        @if (hayNoHabilitables()) {
          <p class="t-ayuda" data-testid="nota-de-ediciones-sin-agenda">La agenda solo se habilita en ediciones en preparación o programadas.</p>
        }
      }
    </div>
  `,
})
export class AgendaDeCitasHerramientaComponent implements OnInit {
  private readonly servicio = inject(AgendamientoDeCitasService);
  private readonly store = inject(PanelOrganizacionStore);

  readonly ediciones = signal<EdicionConAgenda[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly mercados = computed<MercadoConEdiciones[]>(() => {
    const grupos = new Map<number, MercadoConEdiciones>();
    for (const edicion of this.ediciones()) {
      const grupo = grupos.get(edicion.mercadoId) ?? { mercadoId: edicion.mercadoId, nombre: edicion.mercadoNombre, ediciones: [] };
      grupo.ediciones.push(edicion);
      grupos.set(edicion.mercadoId, grupo);
    }
    return [...grupos.values()];
  });

  readonly contador = computed(() => {
    const total = this.ediciones().length;
    if (!total) return null;
    const conAgenda = this.ediciones().filter(e => e.agendaId).length;
    const mercados = this.mercados().length;
    return `${mercados} ${mercados === 1 ? 'Mercado' : 'Mercados'} · ${total} ${total === 1 ? 'edición' : 'ediciones'} · ${conAgenda} con agenda`;
  });

  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }

  etiqueta(estado: string): string { return etiquetaDeEstadoDeAgenda(estado); }

  tono(estado: string) { return tonoDeEstadoDeAgenda(estado); }

  hayNoHabilitables(): boolean { return this.ediciones().some(e => !e.agendaId && !this.puedeHabilitar(e)); }

  puedeHabilitar(edicion: EdicionConAgenda): boolean {
    return edicion.estadoEdicion === 'en_preparacion' || edicion.estadoEdicion === 'programada';
  }

  ngOnInit(): void {
    const organizacionId = this.store.organizacionId();
    if (!organizacionId) return;
    this.cargando.set(true);
    this.servicio.edicionesConAgenda(organizacionId).subscribe({
      next: ediciones => { this.cargando.set(false); this.ediciones.set(ediciones); },
      error: (fallo: FalloDelServidor) => {
        this.cargando.set(false);
        this.error.set(fallo?.message ?? 'No fue posible consultar las ediciones.');
      },
    });
  }
}
