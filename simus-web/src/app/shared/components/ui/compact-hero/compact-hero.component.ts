import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Hero compacto sin foto (usado por fichas de detalle: componente, subpáginas
 * de ecosistema, etc.). Solo breadcrumb + título + subtítulo opcional, sobre
 * fondo morado plano — sin degradado ni imagen de fondo.
 */
@Component({
  selector: 'app-compact-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="bg-morado pb-12 pt-32 text-white">
      <div [class]="'mx-auto px-6 ' + maxWidthClass">
        <nav aria-label="Ruta de navegación" class="mb-6">
          <ol class="flex items-center gap-2 font-alternate text-xs font-bold">
            <li>
              <button
                type="button"
                (click)="regresoSolicitado.emit()"
                class="-my-2 inline-flex min-h-11 cursor-pointer items-center rounded-sm border-0 bg-transparent p-0 text-verde/75 transition-colors hover:text-verde-claro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde focus-visible:ring-offset-2 focus-visible:ring-offset-morado"
              >{{ backLabel }}</button>
            </li>
            @if (current) {
              <li class="text-verde/35" aria-hidden="true">/</li>
              <li class="max-w-[16rem] truncate text-verde" aria-current="page">{{ current }}</li>
            }
          </ol>
        </nav>
        <h1 class="tipo-seccion text-balance">{{ title }}</h1>
        @if (subtitle) {
          <p class="tipo-cuerpo mt-3 max-w-2xl text-white/85">{{ subtitle }}</p>
        }
      </div>
    </section>
  `,
})
export class CompactHeroComponent {
  @Input() backLabel = 'Inicio';
  @Input() current = '';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() maxWidthClass = 'max-w-7xl';

  @Output() regresoSolicitado = new EventEmitter<void>();
}
