import { AfterViewInit, Component, ElementRef, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ContextoDeOrganizacionService, MODO_PERSONAL } from '../../core/services/contexto-de-organizacion.service';
import { ExternalSessionService, OrganizacionDeSesion } from '../../core/services/external-session.service';
import { etiquetaDelRolEnOrganizacion } from '../../core/navegacion/rol-en-organizacion';
import { RAIZ_DE_LA_CUENTA, urlDelPanel } from '../../core/navegacion/rutas-de-gestion';

/**
 * «¿Cómo quieres entrar?», en `/gestion/entrada` (ACC2).
 *
 * <b>EL PRIMER MOMENTO TRAS INICIAR SESIÓN, PARA QUIEN TIENE MÁS DE UN SITIO.</b> Una persona que
 * además de su perfil individual administra o edita una o más organizaciones elige aquí si entra a
 * «Mi espacio» o al panel de una de ellas. Antes `/gestion` la mandaba, sin preguntar, a la última
 * organización que abrió o a la primera: una cuenta como la de Lucía Ramírez aterrizaba dentro de una
 * entidad aunque venía a ver su perfil.
 *
 * <b>UNA CUENTA SIN ORGANIZACIÓN NO VE ESTA PANTALLA:</b> pasa de largo hacia su espacio personal, que
 * es donde tiene su sitio.
 *
 * <b>LA ELECCIÓN SE RECUERDA, PERO SOLO PARA PRESELECCIONAR.</b> La tarjeta de la última vez recibe el
 * foco y lleva una nota; la pantalla se muestra igual en cada inicio de sesión nuevo. Lo que manda
 * después es la dirección: el panel de una organización vive en `/gestion/o/{id}` y nada aquí lo
 * contradice. Los enlaces profundos y el `?volver=` no pasan por esta pantalla.
 *
 * Cambiar de modo más tarde se hace desde el menú de cuenta de la cabecera.
 */
@Component({
  selector: 'app-entrada-a-gestion-page',
  standalone: true,
  template: `
    @if (hayOrganizaciones()) {
      <!-- La cabecera del portal es fija: el alto de la barra se reserva con la regla común reserva-de-barra (styles.css), no con un margen a ojo. -->
      <main id="contenido-principal" tabindex="-1" class="armazon-de-gestion reserva-de-barra mx-auto max-w-3xl px-6 pb-16" aria-labelledby="entrada-titulo" data-testid="entrada-a-gestion">
        <h1 id="entrada-titulo" style="margin-top: 2.5rem">¿Cómo quieres entrar?</h1>
        <p class="t-texto mt-2 max-w-2xl">
          Hola, {{ nombre() }}. Tu cuenta es tuya y también responde por {{ organizaciones().length === 1 ? 'una organización' : 'varias organizaciones' }}. Elige dónde quieres trabajar; podrás cambiar cuando quieras desde el menú de tu cuenta.
        </p>

        <ul class="mt-6 space-y-3" data-testid="opciones-de-entrada">
          <li>
            <button
              type="button"
              data-testid="entrar-mi-espacio"
              [attr.data-recordada]="recordada() === modoPersonal ? 'true' : null"
              (click)="entrarAMiEspacio()"
              class="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-morado/40 bg-[#E9DDEE] px-4 py-4 text-left transition hover:border-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                          >
              <span class="min-w-0">
                <span class="block font-bold text-morado">Mi espacio</span>
                <span class="t-texto mt-0.5 block">Tu perfil público, tus datos personales, tu seguridad y lo que registras a tu nombre.</span>
              </span>
              <span class="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-500">
                @if (recordada() === modoPersonal) { <span class="font-bold text-verde-texto">La última vez</span> }
                <span>Entrar</span>
              </span>
            </button>
          </li>
          @for (organizacion of organizaciones(); track organizacion.id) {
            <li>
              <button
                type="button"
                [attr.data-testid]="'entrar-organizacion-' + organizacion.id"
                [attr.data-recordada]="recordada() === organizacion.id ? 'true' : null"
                (click)="entrarAOrganizacion(organizacion)"
                class="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-morado hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                              >
                <span class="min-w-0">
                  <span class="block break-words font-bold text-morado">{{ organizacion.name }}</span>
                  <span class="t-texto mt-0.5 block">{{ rolDe(organizacion) }}</span>
                </span>
                <span class="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-500">
                  @if (recordada() === organizacion.id) { <span class="font-bold text-verde-texto">La última vez</span> }
                  <span>Entrar</span>
                </span>
              </button>
            </li>
          }
        </ul>
      </main>
    }
  `,
})
export class EntradaAGestionPageComponent implements OnInit, AfterViewInit {
  private readonly router = inject(Router);
  private readonly sesion = inject(ExternalSessionService);
  private readonly contexto = inject(ContextoDeOrganizacionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly modoPersonal = MODO_PERSONAL;
  readonly organizaciones = computed(() => this.sesion.organizaciones());
  readonly hayOrganizaciones = computed(() => this.organizaciones().length > 0);
  readonly nombre = computed(() => this.sesion.actual()?.fullName?.trim() || 'bienvenida o bienvenido');

  /** Cómo entró la persona la última vez, solo para preseleccionar una tarjeta. */
  readonly recordada = computed(() => this.contexto.modoRecordado());

  ngOnInit(): void {
    // SIN ORGANIZACIÓN NO HAY NADA QUE ELEGIR: a su espacio personal, sin dejar esta dirección en el historial.
    if (!this.hayOrganizaciones()) {
      void this.router.navigateByUrl(RAIZ_DE_LA_CUENTA, { replaceUrl: true });
    }
  }

  ngAfterViewInit(): void {
    // El foco empieza en la tarjeta de la última vez, o en la primera: con teclado basta Intro.
    queueMicrotask(() => {
      const raiz = this.host.nativeElement;
      const destino = raiz.querySelector<HTMLElement>('[data-recordada="true"]') ?? raiz.querySelector<HTMLElement>('button');
      destino?.focus();
    });
  }

  rolDe(organizacion: OrganizacionDeSesion): string {
    return etiquetaDelRolEnOrganizacion(organizacion.role);
  }

  entrarAMiEspacio(): void {
    this.contexto.recordarModoPersonal();
    void this.router.navigateByUrl(RAIZ_DE_LA_CUENTA);
  }

  entrarAOrganizacion(organizacion: OrganizacionDeSesion): void {
    this.contexto.recordar(organizacion.id);
    void this.router.navigateByUrl(urlDelPanel(organizacion.id, 'resumen'));
  }
}
