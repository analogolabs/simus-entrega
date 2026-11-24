import { Component, computed, input } from '@angular/core';
import {
  EntradaDeLaLineaDeTiempo,
  ResultadoDeCambios,
} from '../../../../core/services/historial-de-cambios.service';
import { FechaPipe } from '../../../utils/fecha.pipe';

/** Cómo se dice de dónde vino un cambio. Un origen que no se reconoce no se enseña. */
const ORIGEN_EN_PALABRAS: Readonly<Record<string, string>> = {
  directo: 'Corrección directa',
  propuesta: 'Propuesta de cambio aprobada',
  importacion: 'Importación',
  fusion: 'Fusión de duplicados',
  sistema: 'Sistema',
  migracion: 'Reconstruido de versiones anteriores',
};

/**
 * Los cambios de datos de un registro, campo por campo: qué valía, qué vale, quién lo cambió y por
 * qué (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md).
 *
 * <b>ES PRESENTACIONAL Y NO PIDE NADA.</b> Quien lo usa lee el historial con
 * <code>HistorialDeCambiosService</code> —desde la consola o desde el panel de la organización— y le
 * pasa el resultado; así el mismo componente sirve a las dos puertas, que leen reglas distintas.
 *
 * <b>TRES ESTADOS, NO DOS.</b> <code>undefined</code> es «se está consultando»; un fallo se dice como
 * fallo, porque «no hay cambios» cuando la consulta se cayó es afirmar algo falso sobre el registro;
 * y una lista vacía dice desde cuándo existe el registro, para no parecer que promete más.
 */
@Component({
  selector: 'app-cambios-de-datos',
  standalone: true,
  imports: [FechaPipe],
  template: `
    @let r = resultado();
    @if (r === undefined) {
      <p class="mt-3 text-xs text-rotulo">Consultando los cambios…</p>
    } @else if (r === null || r.fallo) {
      <p role="alert" class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        No fue posible consultar los cambios de datos ahora mismo. Esto no significa que el registro
        no los tenga: vuelve a abrirlo en un momento.
      </p>
    } @else {
      @if (guardados().length === 0) {
        <p data-testid="cambios-vacio" class="mt-3 text-xs text-rotulo">
          Todavía no hay cambios de datos registrados.
        </p>
      } @else {
        <ol data-testid="cambios-de-datos" class="mt-3 space-y-4">
          @for (guardado of guardados(); track guardado.fecha + guardado.titulo) {
            <li class="border-t border-filete pt-2">
              <p class="text-xs font-bold text-valor">{{ guardado.titulo }}</p>
              <p class="text-dato text-rotulo">
                {{ guardado.actor || 'Sin autor registrado' }} ·
                <span class="tabular-nums">{{ guardado.fecha | fecha: 'fecha-hora' }}</span>
                @if (origenEnPalabras(guardado.origen); as origen) { · {{ origen }} }
              </p>
              @if (guardado.motivo) {
                <p class="mt-1 text-dato text-rotulo">Motivo: {{ guardado.motivo }}</p>
              }
              <ul class="mt-2 space-y-1.5">
                @for (cambio of guardado.cambios; track cambio.campoId) {
                  <li class="text-xs text-valor">
                    <span class="font-bold">{{ cambio.campo }}</span>
                    @if (cambio.clase !== 'publico' && cambio.clase !== 'organizacion') {
                      <span class="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-dato text-amber-900">dato personal</span>
                    }
                    <span class="block text-dato text-rotulo">
                      <span class="line-through">{{ cambio.nombreAnterior ?? cambio.valorAnterior ?? 'vacío' }}</span>
                      →
                      <span class="text-valor">{{ cambio.nombreNuevo ?? cambio.valorNuevo ?? 'vacío' }}</span>
                    </span>
                  </li>
                }
              </ul>
            </li>
          }
        </ol>
      }

      @if (r.linea && r.linea.camposOcultos > 0) {
        <p data-testid="cambios-ocultos" class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          Hay {{ r.linea.camposOcultos }}
          {{ r.linea.camposOcultos === 1 ? 'cambio de un dato personal que tu cuenta no puede ver' : 'cambios de datos personales que tu cuenta no puede ver' }}.
          Quien administra la auditoría puede consultarlos.
        </p>
      }

      @if (r.linea; as linea) {
        <p data-testid="cambios-desde" class="mt-3 text-dato text-rotulo">
          El registro de cambios campo por campo existe desde el
          <span class="tabular-nums">{{ linea.inicioDelRegistro | fecha }}</span>. Lo anterior no se reconstruye.
        </p>
      }
    }
  `,
})
export class CambiosDeDatosComponent {
  /**
   * El resultado de leer el historial. <code>undefined</code> es «se está consultando»;
   * <code>null</code> o un fallo, que no se pudo leer.
   */
  readonly resultado = input<ResultadoDeCambios | null | undefined>(undefined);

  /** Solo los guardados que cambiaron datos; los estados los enseña «Estados y motivos». */
  protected readonly guardados = computed<readonly EntradaDeLaLineaDeTiempo[]>(
    () => (this.resultado()?.linea?.entradas ?? []).filter(entrada => entrada.tipo === 'cambios'),
  );

  protected origenEnPalabras(origen: string | null): string | null {
    return origen ? (ORIGEN_EN_PALABRAS[origen] ?? null) : null;
  }
}
