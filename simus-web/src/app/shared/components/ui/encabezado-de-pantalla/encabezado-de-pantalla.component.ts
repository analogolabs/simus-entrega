import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * EL ENCABEZADO DE UNA PANTALLA del espacio externo (PANEL, decisión 126): el título —el único h1—, una descripción
 * de una frase, un contador discreto en texto y, a la derecha, las acciones de la pantalla (proyectadas).
 *
 * <b>CADA PANTALLA DICE UNA SOLA VEZ LO QUE ES.</b> El armazón ya no repite la descripción encima del contenido, ni la
 * pantalla vuelve a titularse dentro. Sin filetes ni cajas de cifras: lo que antes eran tres recuadros con números
 * («Registros», «Pendientes», «Borradores») es una línea de texto —«7 registros · 2 pendientes»— bajo el título. La
 * tipografía sale de la escala única (docs/desarrollo/30-consola-y-acceso.md §30.18): aquí no se escribe ningún tamaño.
 */
@Component({
  selector: 'app-encabezado-de-pantalla',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; margin: 0 0 1.25rem; }
    .encabezado { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: .75rem 2rem; }
    .encabezado__texto { min-width: 0; max-width: 52rem; }
    .encabezado__texto > * { margin: 0; }
    .encabezado__descripcion { margin-top: .25rem; }
    .encabezado__contador { margin-top: .25rem; }
    .encabezado__acciones { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
    .encabezado__acciones:empty { display: none; }
  `],
  template: `
    <header class="encabezado">
      <div class="encabezado__texto">
        <h1 [attr.id]="idDelTitulo()">{{ titulo() }}</h1>
        @if (descripcion()) { <p class="encabezado__descripcion t-texto">{{ descripcion() }}</p> }
        @if (contador()) { <p class="encabezado__contador t-ayuda" data-testid="contador-de-la-pantalla">{{ contador() }}</p> }
      </div>
      <div class="encabezado__acciones"><ng-content /></div>
    </header>
  `,
})
export class EncabezadoDePantallaComponent {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string | null | undefined>(null);
  /** Un texto breve con lo que hay («7 procesos · 2 en revisión»); discreto, nunca un recuadro. */
  readonly contador = input<string | null | undefined>(null);
  readonly idDelTitulo = input<string | null>(null);
}
