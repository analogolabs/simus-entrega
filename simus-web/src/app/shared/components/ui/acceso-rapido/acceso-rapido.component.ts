import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * UN ACCESO RÁPIDO: un icono dentro de un círculo y el texto debajo (PANEL2).
 *
 * <b>ES UN ENLACE, NO UN BOTÓN NI UNA TARJETA.</b> Se usa como atributo sobre un `<a routerLink>`; el icono se proyecta
 * con el atributo `icono` y el texto es el contenido. Sin borde ni fondo de caja: solo el círculo del icono, que se
 * tiñe al pasar o al enfocar, para no anidar cajas dentro de la sección que los agrupa. Los iconos son los mismos de la
 * barra lateral (`@lucide/angular`); aquí no se dibuja ninguno.
 *
 * <pre>
 * &lt;a app-acceso-rapido [routerLink]="…"&gt;&lt;svg icono lucideMusic [size]="22" aria-hidden="true"&gt;&lt;/svg&gt;Registrar un proceso&lt;/a&gt;
 * </pre>
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'a[app-acceso-rapido]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'group flex min-h-24 flex-col items-center justify-start gap-2 rounded-lg px-2 py-3 text-center no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado',
  },
  template: `
    <span class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-morado/10 text-morado transition group-hover:bg-morado group-hover:text-white group-focus-visible:bg-morado group-focus-visible:text-white">
      <ng-content select="[icono]" />
    </span>
    <span class="t-texto font-bold text-valor group-hover:underline"><ng-content /></span>
  `,
})
export class AccesoRapidoComponent {}
