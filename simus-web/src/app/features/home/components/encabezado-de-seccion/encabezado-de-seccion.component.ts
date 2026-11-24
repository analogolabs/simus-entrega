import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * LOS DOS ENCABEZADOS DE LA PORTADA. Hay dos clases de sección y cada una abre distinto:
 *
 * - `mensaje`: secciones que dicen algo. Antetítulo pequeño en mayúsculas, la frase importante en
 *   grande (Nunito fina) y un texto pequeño debajo. «Qué es SIMUS» y el cierre.
 * - `titulo`: secciones que se recorren. Un título de sección claro (Oswald en mayúsculas) y un
 *   subtítulo corto. «Explora SIMUS», «La música en el territorio», «Actualidad».
 *
 * Los dos comparten alineación (borde izquierdo de la columna), ancho máximo y la distancia al
 * contenido que sigue; esa repetición es la que ordena la página.
 */
@Component({
  selector: 'app-encabezado-de-seccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block max-w-3xl' },
  template: `
    @if (antetitulo()) {
      <p class="tipo-etiqueta mb-5 " [class.text-morado]="!sobreOscuro()" [class.text-white/70]="sobreOscuro()">{{ antetitulo() }}</p>
    }
    <h2
      [class.tipo-enunciado]="tipo() === 'mensaje'"
      [class.tipo-seccion]="tipo() === 'titulo'"
      [class.text-titulo]="!sobreOscuro()"
      [class.text-white]="sobreOscuro()"
    >{{ titulo() }}</h2>
    @if (texto()) {
      <p class="tipo-subtitulo max-w-2xl" [class.mt-6]="tipo() === 'mensaje'" [class.mt-4]="tipo() === 'titulo'" [class.text-tinta-media]="!sobreOscuro()" [class.text-white/70]="sobreOscuro()">{{ texto() }}</p>
    }
  `,
})
export class EncabezadoDeSeccionComponent {
  readonly tipo = input<'mensaje' | 'titulo'>('titulo');
  readonly titulo = input.required<string>();
  readonly antetitulo = input('');
  readonly texto = input('');
  /** En las secciones de fondo oscuro cambia a los tonos claros. */
  readonly sobreOscuro = input(false);
}
