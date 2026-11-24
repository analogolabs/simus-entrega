import { Component, Input } from '@angular/core';

/**
 * EL TÍTULO DE PÁGINA Y DE SECCIÓN, con el formato de Noticias: un antetítulo pequeño en morado y
 * debajo el título grande en Oswald, en la tinta oscura (`.tipo-seccion`). `backgroundText` es el
 * antetítulo (antes era una palabra gigante de marca de agua detrás del título) y `foregroundText`,
 * el título. Sin adornos: ni marca de agua ni barrita.
 *
 * Es el componente COMPARTIDO de Agenda, Editorial y las secciones de El Plan; un título largo del
 * CMS parte de renglón en lugar de desbordar (`break-words`).
 *
 * `nivel`: `h2` por defecto (secciones). Una página cuyo título principal es esta cabecera la pide
 * como `h1`: sin él, el lector de pantalla no encuentra el título de la página.
 */
@Component({
  selector: 'app-section-header',
  standalone: true,
  template: `
    <div class="w-full min-w-0 text-left" [class.mb-4]="compact" [class.lg:mb-6]="compact" [class.mb-8]="!compact" [class.lg:mb-12]="!compact">
      @if (backgroundText) {
        <p class="tipo-etiqueta mb-3 text-morado">{{ backgroundText }}</p>
      }
      @if (nivel === 'h1') {
        <h1 class="tipo-seccion break-words text-titulo">{{ foregroundText }}</h1>
      } @else {
        <h2 class="tipo-seccion break-words text-titulo">{{ foregroundText }}</h2>
      }
    </div>
  `,
})
export class SectionHeaderComponent {
  @Input() backgroundText = '';
  @Input() foregroundText = '';
  @Input() compact = false;
  @Input() nivel: 'h1' | 'h2' = 'h2';
}
