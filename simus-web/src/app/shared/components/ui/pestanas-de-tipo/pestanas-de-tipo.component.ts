import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { OpcionDePestana, PestanasComponent } from '../pestanas/pestanas.component';
import { TIPO_OTRAS, opcionesDeTipoDeProceso } from '../barra-de-tipo/opciones-de-tipo';

/** La pestaña de lo que no es de un proceso (una invitación, una cita…). */
export const PESTANA_OTRAS = TIPO_OTRAS;

/**
 * LAS PESTAÑAS POR TIPO DE PROCESO (PANEL, decisión 126, docs/desarrollo/30-consola-y-acceso.md §30.18): «Todos», Festivales, Mercados, Redes,
 * Lutería y Espacios, en el orden fijo del Ecosistema y con el conteo de cada uno.
 *
 * UNA SOLA IMPLEMENTACIÓN para Procesos, Solicitudes, Eventos y «Mi actividad y solicitudes» de Mi espacio: cambian los
 * conteos y lo que se hace con la pestaña elegida, no la pieza. El ESTADO ya no es una pestaña: es un filtro
 * desplegable con conteos (`app-filtro-desplegable`). Detrás está `app-pestanas` (rol, flechas y foco incluidos).
 */
@Component({
  selector: 'app-pestanas-de-tipo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PestanasComponent],
  template: `<app-pestanas [etiquetaDelGrupo]="etiquetaDelGrupo()" [opciones]="opciones()" [elegida]="elegida()" [controla]="controla()" (elegir)="elegir.emit($event)" />`,
})
export class PestanasDeTipoComponent {
  /** Cuántos hay de cada tipo (`festivales`, `mercados`…) y `otras`. Lo que falta cuenta cero. */
  readonly conteos = input.required<Readonly<Record<string, number>>>();
  readonly elegida = input.required<string>();
  readonly etiquetaDelGrupo = input('Tipo de proceso');
  readonly controla = input<string | null>(null);
  /** Con «Citas e invitaciones» solo cuando hay algo que no es de un proceso (solicitudes con citas o invitaciones). */
  readonly conOtras = input(false);
  /** Los tipos que se ofrecen (por omisión los cinco). Mi espacio solo ofrece Lutería, Espacios y Redes: no registra Festivales ni Mercados. */
  readonly tipos = input<readonly string[] | null>(null);
  /** El total de «Todos»; sin él, la suma de los tipos. */
  readonly total = input<number | null>(null);
  readonly elegir = output<string>();

  readonly opciones = computed<readonly OpcionDePestana[]>(() => opcionesDeTipoDeProceso({
    conteos: this.conteos(), total: this.total(), tipos: this.tipos(), conOtras: this.conOtras() || this.elegida() === PESTANA_OTRAS,
  }));
}
