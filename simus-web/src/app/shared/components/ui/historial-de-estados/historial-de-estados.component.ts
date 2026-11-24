import { Component, Input } from '@angular/core';
import { FechaPipe } from '../../../utils/fecha.pipe';
import { ETIQUETAS_DE_ESTADO_EDITORIAL, rotuloDeEstado } from '../../../../core/vocabularios/estados';
import { EsqueletoComponent } from '../esqueleto/esqueleto.component';

/**
 * Una fila del historial de estados (`EntradaDeHistorialDeEstadosDto` del API).
 */
export interface EntradaDeHistorialDeEstados {
  id: string;
  accion: string;
  accionEtiqueta: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  motivo: string | null;
  actor: string | null;
  fecha: string;
}

const ETIQUETAS_DE_ESTADO: Record<string, string> = {
  // EL CIRCUITO EDITORIAL, DEL VOCABULARIO ÚNICO.
  ...ETIQUETAS_DE_ESTADO_EDITORIAL,
  // LOS DOS EJES DEL CATÁLOGO EDITORIAL: catalogación y publicación. `en_revision` y
  // `borrador` ya están arriba y se leen igual en los dos.
  pendiente_revision: 'Pendiente de revisión',
  validada: 'Validada',
  observada: 'Observada',
  retirado: 'Retirado',
};

/** «en_revision» se lee «En revisión». Un código que no se conoce se vuelve legible: nunca se enseña el código. */
export function etiquetaDeEstado(estado: string | null | undefined): string {
  if (!estado) return '';
  return ETIQUETAS_DE_ESTADO[estado] ?? rotuloDeEstado(estado);
}

/**
 * El historial de estados de un registro: qué pasó, de qué estado a cuál, quién, cuándo y por qué.
 *
 * <b>LO USAN LA CONSOLA Y EL PANEL DE LA ORGANIZACIÓN</b>, con la misma lectura del API. Es
 * de solo presentación: quien lo pinta pide las filas y le dice si está cargando o si falló.
 *
 * <b>TRES ESTADOS Y NO DOS.</b> `null` es «no se pudo leer», que no es lo mismo que una lista vacía:
 * decir «sin movimientos» cuando la consulta falló sería afirmar algo falso sobre el registro.
 */
@Component({
  selector: 'app-historial-de-estados',
  standalone: true,
  imports: [EsqueletoComponent, FechaPipe],
  template: `
    @if (cargando) {
      <app-esqueleto variante="fila" [cantidad]="2" etiqueta="Consultando el historial…" />
    } @else if (entradas === null) {
      <p role="alert" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        No fue posible consultar el historial ahora mismo. Vuelve a abrirlo en un momento.
      </p>
    } @else if (!entradas?.length) {
      <p class="text-xs text-rotulo">Todavía no hay cambios de estado registrados.</p>
    } @else {
      <ol data-testid="historial-de-estados" class="space-y-3">
        @for (entrada of entradas; track entrada.id) {
          <li class="border-t pt-2" [class]="entrada.motivo ? 'border-amber-300' : 'border-filete'">
            <p class="text-xs font-bold text-valor">{{ accionLegible(entrada) }}</p>
            <p class="text-dato text-rotulo">
              @if (entrada.estadoAnterior && entrada.estadoAnterior !== entrada.estadoNuevo) {
                {{ etiquetaDeEstado(entrada.estadoAnterior) }} → {{ etiquetaDeEstado(entrada.estadoNuevo) }}
              } @else {
                {{ etiquetaDeEstado(entrada.estadoNuevo) }}
              }
            </p>
            <p class="text-dato text-rotulo">
              {{ entrada.actor || 'Sin autor registrado' }} ·
              <time class="tabular-nums" [attr.datetime]="entrada.fecha">{{ entrada.fecha | fecha: 'fecha-hora' }}</time>
            </p>
            @if (entrada.motivo) {
              <p data-motivo class="mt-1 text-xs leading-relaxed text-valor"><span class="font-semibold">Motivo:</span> {{ entrada.motivo }}</p>
            }
          </li>
        }
      </ol>
    }
  `,
})
export class HistorialDeEstadosComponent {
  protected readonly etiquetaDeEstado = etiquetaDeEstado;

  /** El movimiento con su rótulo; si el servidor no lo trae, el código vuelto legible. */
  protected accionLegible(entrada: EntradaDeHistorialDeEstados): string {
    return entrada.accionEtiqueta || rotuloDeEstado(entrada.accion);
  }

  /** Las filas, lo más reciente primero. `null` si la consulta falló. */
  @Input() entradas: EntradaDeHistorialDeEstados[] | null | undefined = undefined;

  @Input() cargando = false;
}
