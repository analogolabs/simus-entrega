import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Type, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { laPantallaReservaSuBarra } from '../../../../core/navegacion/barra-superior';

/**
 * EL ARMAZÓN DEL PORTAL PÚBLICO: el único `<main>` de sus pantallas.
 *
 * Hasta UI-G el `<main id="contenido-principal">` lo ponía `app.component` alrededor de TODO el
 * enrutador, de modo que la consola, el panel de una organización y el acceso —que traen su propia
 * cabecera y su navegación— quedaban con su banner DENTRO del contenido principal. Ahora cada armazón
 * declara el suyo: este para el portal (cuya cabecera y pie son de `app.component`, fuera del
 * `<main>`), y la consola, el panel y el acceso en sus propias plantillas.
 *
 * Conserva `id`, `tabindex="-1"` y la animación de entrada: el enlace de salto y el foco que
 * recibe el contenido al saltar siguen siendo los de siempre.
 *
 * <b>EL ASISTENTE EN TODO EL PORTAL.</b> El panel (`CajonDeConsultaGuiadaComponent` en modo `publica`) trae su propia burbuja flotante abajo a
 * la derecha (con margen seguro) y un panel de chat; la portada tiene un enlace discreto que lo abre mediante `PreguntaPublicaService`.
 * En el mapa y en la agenda de citas la burbuja no se pinta porque estorba.
 *
 * <b>SE CARGA DIFERIDO (`import()` al terminar el primer pintado).</b> El cajón arrastra el formulario, el banco de preguntas y el esqueleto: en la
 * carga inicial pesaba ≈ +76 kB y rompía el presupuesto del bundle inicial (900 kB). Con un `import()` tras el primer
 * pintado vive en un fragmento aparte. No se usa `@defer`: su ejecución suma ≈ +7 kB al núcleo de Angular, que es
 * justo el margen que queda bajo el presupuesto.
 */
@Component({
  selector: 'app-portal-layout',
  imports: [RouterOutlet, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main id="contenido-principal" tabindex="-1" class="min-h-screen animate-page-entrance" [class.reserva-de-barra]="!reservaPropia()">
    <router-outlet />
  </main>
  @if (cajon(); as componente) {
    <ng-container *ngComponentOutlet="componente; inputs: entradasDelCajon()" />
  }`,
  styles: [`:host { display: block; }`],
})
export class PortalLayoutComponent {
  private readonly router = inject(Router);

  /**
   * ¿La pantalla activa pone ella el alto de la barra fija? Si no, lo reserva este armazón (`.reserva-de-barra`):
   * ninguna pantalla se queda bajo la barra por olvido (punto 31 del mapa de comentarios; ver `barra-superior.ts`).
   */
  readonly reservaPropia = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => laPantallaReservaSuBarra(this.router))),
    { initialValue: laPantallaReservaSuBarra(this.router) },
  );

  readonly cajon = signal<Type<unknown> | null>(null);
  /** Pantallas donde la esquina inferior derecha estorba: el mapa a pantalla completa y la agenda de citas (una aplicación con sus propios controles). */
  private static readonly SIN_BURBUJA = /^\/(mapa-ecosistemico|ecosistema\/agenda-de-citas)(\/|$)/;
  private readonly ruta = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url.split(/[?#]/)[0])),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );
  readonly entradasDelCajon = computed(() => ({ publica: true, ocultarLanzador: PortalLayoutComponent.SIN_BURBUJA.test(this.ruta()) }));

  constructor() {
    afterNextRender(() => {
      void import('../../consulta-guiada/cajon-de-consulta-guiada.component').then(m => this.cajon.set(m.CajonDeConsultaGuiadaComponent));
    });
  }

}
