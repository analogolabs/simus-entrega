import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmacionComponent } from '../../shared/components/ui/confirmacion/confirmacion.component';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { BorradorPendiente, BorradoresDeProcesoApi, ModuloDeBorrador } from './borradores-de-proceso.api';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
/**
 * «Tienes un registro sin terminar», con «Continuar» y «Descartar».
 *
 * <b>EL BORRADOR ABANDONADO ERA INVISIBLE.</b> La lista decía «0 registrados» y el Resumen «Aún no
 * tienes procesos»: se retomaba en silencio al volver a «Registrar», y «Cancelar» no preguntaba ni
 * descartaba. Ahora la lista y el Resumen dicen que hay un registro a medias, desde cuándo, y dejan
 * seguirlo o tirarlo. Solo aparece si el borrador tiene algo escrito: abrir el asistente y cerrarlo
 * sin teclear nada no es «un registro sin terminar».
 *
 * `modulo` limita a un proceso (la lista de Festivales solo habla de Festivales); sin él, el Resumen
 * muestra todos.
 */
@Component({
  selector: 'app-registro-sin-terminar',
  standalone: true,
  imports: [BotonNativoDirective, RouterLink, ConfirmacionComponent, FechaPipe],
  template: `
    @for (borrador of pendientes(); track borrador.id) {
      <section class="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="registro-sin-terminar" role="status">
        <p class="text-sm font-bold text-amber-950">
          Tienes un {{ borrador.moduloId === 'mercados' ? 'Mercado' : 'Festival' }} sin terminar@if (borrador.nombre) {: «{{ borrador.nombre }}»}.
        </p>
        <p class="mt-1 text-sm text-amber-900">Lo dejaste guardado como borrador el {{ borrador.fechaActualizacion | fecha:'fecha-hora' }}. Aún no está registrado.</p>
        <div class="mt-3 flex flex-wrap gap-3">
          <a [routerLink]="rutaParaContinuar(borrador)" data-testid="continuar-registro"
             class="inline-flex min-h-11 items-center rounded-lg bg-morado px-4 text-sm font-bold text-white no-underline hover:bg-morado/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">Continuar</a>
          <button type="button" (click)="aDescartar.set(borrador)" data-testid="descartar-registro"
                  appBoton="secundaria">Descartar</button>
        </div>
      </section>
    }
    @if (aDescartar(); as borrador) {
      <app-confirmacion
        titulo="Descartar el registro sin terminar"
        [detalle]="'Se borra lo que escribiste' + (borrador.nombre ? ' de «' + borrador.nombre + '»' : '') + '. No se puede recuperar.'"
        accion="Descartar"
        [error]="error()"
        [ocupado]="descartando()"
        (confirmar)="descartar(borrador)"
        (cancelar)="aDescartar.set(null)" />
    }
  `,
})
export class RegistroSinTerminarComponent {
  private readonly api = inject(BorradoresDeProcesoApi);

  readonly organizacionId = input.required<string>();
  /** Si se indica, solo los registros de ese proceso. */
  readonly modulo = input<ModuloDeBorrador | null>(null);

  readonly pendientes = signal<BorradorPendiente[]>([]);
  readonly aDescartar = signal<BorradorPendiente | null>(null);
  readonly descartando = signal(false);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const organizacion = this.organizacionId();
      const modulo = this.modulo();
      untracked(() => this.api.pendientes(organizacion).subscribe({
        next: filas => this.pendientes.set((filas ?? []).filter(fila => !modulo || fila.moduloId === modulo)),
        // Un fallo de esta consulta no es un fallo de la pantalla: simplemente no se ofrece el aviso.
        error: () => this.pendientes.set([]),
      }));
    });
  }

  rutaParaContinuar(borrador: BorradorPendiente): string[] {
    return rutaDelPanel(this.organizacionId(), borrador.moduloId === 'mercados' ? 'procesos/mercados/nuevo' : 'procesos/festivales/nuevo');
  }

  descartar(borrador: BorradorPendiente): void {
    this.descartando.set(true);
    this.error.set('');
    this.api.descartar(borrador.id).subscribe({
      next: () => {
        this.descartando.set(false);
        this.aDescartar.set(null);
        this.pendientes.update(filas => filas.filter(fila => fila.id !== borrador.id));
      },
      error: () => {
        this.descartando.set(false);
        this.error.set('No fue posible descartar el registro. Inténtalo de nuevo.');
      },
    });
  }
}
