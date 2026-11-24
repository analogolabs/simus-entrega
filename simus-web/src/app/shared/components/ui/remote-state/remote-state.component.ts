import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideLoader2, LucideAlertCircle, LucideRefreshCw } from '@lucide/angular';

import { BotonNativoDirective } from '../boton/boton.component';
@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [CommonModule, LucideLoader2],
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <svg lucideLoader2 class="mx-auto mb-3 animate-spin text-morado" [size]="22"></svg>
      <h3 class="font-alternate text-sm font-bold text-morado">{{ title }}</h3>
      <p class="mt-2 text-sm text-slate-500">{{ description }}</p>
    </div>
  `
})
export class LoadingStateComponent {
  @Input() title = 'Cargando información…';
  @Input() description = 'Estamos preparando los datos.';
}

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [BotonNativoDirective, CommonModule, LucideAlertCircle, LucideRefreshCw],
  template: `
    <div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
      <svg lucideAlertCircle class="mx-auto mb-3 text-rose-700" [size]="22"></svg>
      @if (code) {
        <p class="mb-2 inline-flex rounded-full border border-rose-200 bg-white px-2.5 py-1 font-mono text-dato font-bold text-rose-800">
          {{ code }}
        </p>
      }
      <h3 class="font-alternate text-sm font-bold text-rose-900">{{ title }}</h3>
      <p class="mt-2 whitespace-pre-line text-sm text-rose-700">{{ description }}</p>
      @if (details) {
        <p class="mt-3 rounded-xl border border-rose-100 bg-white px-3 py-2 text-left font-mono text-xs leading-relaxed text-rose-800">
          {{ details }}
        </p>
      }
      @if (retry.observed) {
        <button
          type="button"
          (click)="retry.emit()"
          appBoton="destructiva" class="mt-4 mx-auto"
        >
          <svg lucideRefreshCw [size]="14"></svg>
          Reintentar
        </button>
      }
    </div>
  `
})
export class ErrorStateComponent {
  @Input() title = 'No pudimos cargar esta sección';
  @Input() description = 'Intenta nuevamente en unos segundos.';
  @Input() code = '';
  @Input() details = '';
  @Output() retry = new EventEmitter<void>();
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center">
      <h3 class="font-alternate text-sm font-bold text-slate-600">{{ title }}</h3>
      <p class="mt-2 text-sm text-slate-500">{{ description }}</p>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() title = 'No hay resultados todavía';
  @Input() description = 'Prueba otro filtro o vuelve más tarde.';
}
