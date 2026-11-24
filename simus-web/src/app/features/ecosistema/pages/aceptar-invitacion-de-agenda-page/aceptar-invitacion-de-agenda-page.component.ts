import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiClientService } from '../../../../core/http/api-client.service';
import { RUTAS_DE_LA_CUENTA } from '../../../../core/navegacion/rutas-de-gestion';
import { InvitacionDeAgendaAbierta } from '../../../../core/services/agendamiento-de-citas.service';
import { ExternalSessionService } from '../../../../core/services/external-session.service';
import { FechaPipe } from '../../../../shared/utils/fecha.pipe';
import { enmascararCorreo } from '../../../../shared/utils/correo-enmascarado';
import { CLAVE_INVITACION_PENDIENTE } from '../aceptar-invitacion-page/aceptar-invitacion-page.component';

/**
 * La página que recibe el enlace de la invitación a una agenda de citas (docs/referencia/26-agenda-de-citas-y-mercados.md §26.10).
 *
 * <b>ES EL MISMO FLUJO QUE LA INVITACIÓN A UNA ORGANIZACIÓN</b> (`AceptarInvitacionPageComponent`): es
 * anónima, el testigo viaja en el cuerpo y no en la URL, solo la cuenta del correo invitado acepta, y quien
 * todavía no tiene cuenta la crea con ese correo y vuelve aquí al terminar.
 */
@Component({
  selector: 'app-aceptar-invitacion-de-agenda-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FechaPipe],
  template: `
    <section class="min-h-[100dvh] bg-slate-50 px-4 pb-16 pt-28 font-nunito text-slate-700">
      <div class="mx-auto max-w-xl py-6 sm:py-8">
        <h1 class="font-alternate text-2xl font-bold tracking-wide text-morado">Invitación a una agenda de citas</h1>

        @if (cargando()) { <p role="status" class="mt-4 text-sm text-slate-500">Comprobando la invitación…</p> }

        @if (invitacion(); as datos) {
          <p class="mt-4 text-base leading-relaxed">
            <strong>{{ datos.mercadoNombre }}</strong> ({{ datos.anio }}) te invita a su agenda de citas como comprador o booker,
            para ver a los artistas inscritos y gestionar tus citas.
          </p>
          <p class="mt-1 text-sm text-slate-500">Invitación enviada a {{ datos.correoEnmascarado }}.</p>
          <p class="mt-3 text-sm leading-relaxed text-slate-700" data-testid="invitacion-aviso-de-uso">
            Este enlace es <strong>de un solo uso</strong> y vence a los <strong>7 días</strong> de enviado@if (vigente()) { (el {{ datos.fechaExpiracion | fecha }}) }.
            Si ya lo usaste, entra a tu cuenta: la agenda te aparece en «Mi agenda de citas». Si venció o se perdió, pide a la organización del
            Mercado que te envíe otro.
          </p>

          @if (!vigente()) {
            <p role="alert" data-testid="invitacion-no-vigente" class="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              @switch (datos.estado) {
                @case ('aceptada') { Esta invitación ya se usó. Si la aceptaste tú, la agenda aparece en «Mi agenda de citas». }
                @case ('revocada') { La organización dejó sin efecto esta invitación. Pídele que te envíe otra. }
                @case ('vencida') { Esta invitación venció (duran 7 días). Pide a la organización que te envíe otra. }
                @default { La invitación no está disponible. }
              }
            </p>
          } @else if (sesion() && !esLaCuentaInvitada()) {
            <div role="alert" data-testid="invitacion-otra-cuenta" class="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              <p>
                Esta invitación se envió a <strong>{{ datos.correoEnmascarado }}</strong> y solo puede aceptarla la cuenta con ese correo.
                Ahora estás con <strong>{{ sesion()?.email }}</strong>.
              </p>
              <p class="mt-2">Cierra la sesión y entra con la cuenta de ese correo. Si todavía no la tienes, créala con ese correo: al terminar volverás aquí.</p>
            </div>
            <div class="mt-4 flex flex-wrap gap-3">
              <button type="button" (click)="cambiarDeCuenta('/ingresar')" [disabled]="saliendo()" data-testid="invitacion-cambiar-de-cuenta"
                      class="min-h-11 rounded-lg bg-morado px-5 font-alternate text-xs font-bold tracking-wide text-white hover:bg-morado/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">
                Cerrar sesión y entrar con esa cuenta
              </button>
              <button type="button" (click)="cambiarDeCuenta('/registro')" [disabled]="saliendo()"
                      class="min-h-11 rounded-lg border border-slate-300 bg-white px-5 font-alternate text-xs font-bold tracking-wide text-slate-700 hover:border-morado hover:text-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado">
                Crear la cuenta de ese correo
              </button>
            </div>
          } @else if (sesion()) {
            <p class="mt-5 text-sm">Aceptarás con tu cuenta <strong>{{ sesion()?.email }}</strong>.</p>
            <button type="button" (click)="aceptar()" [disabled]="aceptando()" data-testid="aceptar-invitacion"
                    class="mt-4 min-h-11 rounded-lg bg-morado px-5 font-alternate text-xs font-bold tracking-wide text-white hover:bg-morado/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">
              {{ aceptando() ? 'Aceptando…' : 'Aceptar invitación' }}
            </button>
          } @else {
            <p class="mt-5 text-sm">Para aceptarla, entra con la cuenta de SIMUS de <strong>{{ datos.correoEnmascarado }}</strong>: solo esa cuenta puede aceptarla. Si aún no la tienes, créala con ese correo: al terminar volverás aquí para aceptar la invitación.</p>
            <div class="mt-4 flex flex-wrap gap-3">
              <a routerLink="/ingresar" (click)="recordar()" data-testid="invitacion-ingresar"
                 class="inline-flex min-h-11 items-center rounded-lg bg-morado px-5 font-alternate text-xs font-bold tracking-wide text-white hover:bg-morado/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">Iniciar sesión</a>
              <a routerLink="/registro" (click)="recordar()"
                 class="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-5 font-alternate text-xs font-bold tracking-wide text-slate-700 hover:border-morado hover:text-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado">Crear cuenta</a>
            </div>
          }
        }

        @if (error()) { <p role="alert" data-testid="invitacion-error" class="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }

        @if (sinSalida()) {
          <div class="mt-5 flex flex-wrap gap-3" data-testid="invitacion-salidas">
            @if (sesion()) {
              <a [routerLink]="rutaDeMisAgendas" data-testid="invitacion-ir-a-mis-agendas"
                 class="inline-flex min-h-11 items-center rounded-lg bg-morado px-5 font-alternate text-xs font-bold tracking-wide text-white no-underline hover:bg-morado/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">Ir a mi agenda de citas</a>
            } @else {
              <a routerLink="/ingresar" data-testid="invitacion-ir-a-ingresar"
                 class="inline-flex min-h-11 items-center rounded-lg bg-morado px-5 font-alternate text-xs font-bold tracking-wide text-white no-underline hover:bg-morado/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">Ingresar</a>
            }
            <a routerLink="/" data-testid="invitacion-ir-al-inicio"
               class="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-5 font-alternate text-xs font-bold tracking-wide text-slate-700 no-underline hover:border-morado hover:text-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado">Ir al inicio</a>
          </div>
        }
      </div>
    </section>
  `,
})
export class AceptarInvitacionDeAgendaPageComponent {
  private readonly api = inject(ApiClientService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sesionExterna = inject(ExternalSessionService);

  readonly rutaDeMisAgendas = RUTAS_DE_LA_CUENTA.agendaDeCitas;
  readonly testigo = this.ruta.snapshot.queryParamMap.get('testigo') ?? '';
  readonly cargando = signal(true);
  readonly aceptando = signal(false);
  readonly saliendo = signal(false);
  readonly invitacion = signal<InvitacionDeAgendaAbierta | null>(null);
  readonly error = signal('');
  readonly sesion = this.sesionExterna.actual;
  readonly vigente = computed(() => this.invitacion()?.estado === 'pendiente');
  readonly sinSalida = computed(() => !this.cargando() && (!!this.error() || (!!this.invitacion() && !this.vigente())));

  /** Se compara enmascarando también el correo de la sesión; el servidor tiene la última palabra. */
  readonly esLaCuentaInvitada = computed(() => {
    const datos = this.invitacion();
    const sesion = this.sesion();
    if (!datos || !sesion) { return false; }
    return enmascararCorreo(sesion.email) === datos.correoEnmascarado;
  });

  constructor() {
    this.sesionExterna.cargarUnaVez();
    void this.consultar();
  }

  /** Recuerda la invitación para retomarla después de iniciar sesión o crear la cuenta. */
  recordar(): void {
    try { sessionStorage.setItem(CLAVE_INVITACION_PENDIENTE, `/ecosistema/invitacion-agenda?testigo=${this.testigo}`); } catch { /* sin almacenamiento */ }
  }

  async cambiarDeCuenta(destino: '/ingresar' | '/registro'): Promise<void> {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    this.recordar();
    try {
      await firstValueFrom(this.sesionExterna.salir());
      await this.router.navigateByUrl(destino);
    } finally {
      this.saliendo.set(false);
    }
  }

  async aceptar(): Promise<void> {
    if (this.aceptando()) return;
    this.aceptando.set(true);
    this.error.set('');
    try {
      const token = await firstValueFrom(this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {}));
      const aceptada = await firstValueFrom(this.api.post<{ agendaId?: number }>('/api/v1/externo/agendas-de-citas/invitaciones/aceptar', { testigo: this.testigo }, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible aceptar la invitación.',
      }));
      try { sessionStorage.removeItem(CLAVE_INVITACION_PENDIENTE); } catch { /* sin almacenamiento */ }
      await this.router.navigateByUrl(aceptada?.agendaId ? `${RUTAS_DE_LA_CUENTA.agendaDeCitas}/${aceptada.agendaId}` : RUTAS_DE_LA_CUENTA.agendaDeCitas);
    } catch (e: unknown) {
      this.error.set(this.motivo(e) ?? 'No fue posible aceptar la invitación.');
    } finally {
      this.aceptando.set(false);
    }
  }

  private async consultar(): Promise<void> {
    if (!this.testigo) {
      this.error.set('Este enlace está incompleto. Ábrelo tal como te lo enviaron.');
      this.cargando.set(false);
      return;
    }
    try {
      this.invitacion.set(await firstValueFrom(this.api.post<InvitacionDeAgendaAbierta>(
        '/api/v1/externo/agendas-de-citas/invitaciones/consultar', { testigo: this.testigo },
        { errorFallback: 'No fue posible consultar la invitación.' })));
    } catch {
      this.error.set('Este enlace de invitación no existe. Revisa que lo copiaste completo.');
    } finally {
      this.cargando.set(false);
    }
  }

  private motivo(e: unknown): string | null {
    const cuerpo = (e as { payload?: { message?: string } | null })?.payload;
    return cuerpo?.message ?? null;
  }
}
