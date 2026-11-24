import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PreguntaPublicaService } from '../../../../core/services/pregunta-publica.service';
import { IconoFijoComponent } from '../../../../shared/components/ui/icono-fijo/icono-fijo.component';

/**
 * UNA LÍNEA DISCRETA EN LA PORTADA que abre el Asistente (la entrada principal es la burbuja flotante). No consulta nada por sí
 * misma: solo enciende el panel mediante `PreguntaPublicaService`, que se carga aparte, así que no pesa en el paquete inicial.
 *
 * Los textos están en el código y no en el registro de textos editables (la consulta pública es una herramienta, no contenido).
 */
@Component({
  selector: 'app-pregunta-destacada',
  standalone: true,
  imports: [TextoWebPipe, IconoFijoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section data-pregunta-destacada aria-label="Asistente" class="bg-white py-4">
      <div class="mx-auto flex max-w-7xl items-center justify-center px-6 lg:px-8">
        <button type="button" data-pregunta-destacada-campo (click)="preguntas.abrir($event)"
          class="tipo-pequeno inline-flex min-h-control cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent px-3 text-morado transition-colors hover:bg-morado-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">
          <svg iconoFijo="message-circle-question" [size]="18" aria-hidden="true" class="shrink-0"></svg>
          <span>{{ 'asistente_invitacion' | textoWeb }}</span>
        </button>
      </div>
    </section>
  `,
})
export class PreguntaDestacadaComponent {
  readonly preguntas = inject(PreguntaPublicaService);
}
