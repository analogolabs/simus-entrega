import { rutaDelPanel } from '../../../../core/navegacion/rutas-de-gestion';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../../core/http/api-client.service';
import { ExternalSessionService } from '../../../../core/services/external-session.service';
import { enmascararCorreo } from '../../../../shared/utils/correo-enmascarado';

import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';
export interface InvitacionAbierta {
  organizacion: string;
  rol: string;
  correoInvitado: string;
  estado: string;
  fechaExpiracion: string;
}

/** Clave con la que se recuerda el enlace mientras la persona inicia sesión. */
export const CLAVE_INVITACION_PENDIENTE = 'simus.invitacionPendiente';

/**
 * La página que recibe el enlace de una invitación a una organización (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4).
 *
 * ES ANÓNIMA, como la confirmación de correo: quien la abre puede no haber entrado nunca. Con
 * sesión, acepta con su cuenta; sin ella, le ofrece entrar y vuelve aquí al terminar. El testigo
 * viaja en el cuerpo de las peticiones, no se reenvía en la URL.
 */
@Component({
  selector: 'app-aceptar-invitacion-page',
  standalone: true,
  imports: [BotonNativoDirective, CommonModule, RouterLink],
  templateUrl: './aceptar-invitacion-page.component.html',
})
export class AceptarInvitacionPageComponent {
  private readonly api = inject(ApiClientService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sesionExterna = inject(ExternalSessionService);

  readonly testigo = this.ruta.snapshot.queryParamMap.get('testigo') ?? '';
  readonly cargando = signal(true);
  readonly aceptando = signal(false);
  readonly invitacion = signal<InvitacionAbierta | null>(null);
  readonly error = signal('');
  readonly sesion = this.sesionExterna.actual;
  readonly vigente = computed(() => this.invitacion()?.estado === 'pendiente');
  readonly saliendo = signal(false);

  /**
   * Una invitación que ya no sirve —inexistente, usada, revocada o vencida— no deja a la persona
   * sin salida: con sesión, a sus organizaciones; sin ella, a ingresar; y siempre al inicio.
   */
  readonly sinSalida = computed(() => !this.cargando() && (!!this.error() || (!!this.invitacion() && !this.vigente())));

  /**
   * Si la cuenta de la sesión es la invitada.
   *
   * SOLO LA CUENTA DEL CORREO INVITADO ACEPTA (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4 v1.1). La consulta devuelve el
   * correo enmascarado, así que se compara enmascarando también el de la sesión: si difieren, no es
   * la cuenta y se dice antes de pulsar nada. Si coinciden, el servidor tiene la última palabra.
   */
  readonly esLaCuentaInvitada = computed(() => {
    const datos = this.invitacion();
    const sesion = this.sesion();
    if (!datos || !sesion) { return false; }
    return enmascararCorreo(sesion.email) === datos.correoInvitado;
  });

  constructor() {
    this.sesionExterna.cargarUnaVez();
    void this.consultar();
  }

  etiquetaDeRol(rol: string): string {
    return rol === 'administrador' ? 'administrador' : 'editor';
  }

  /** Recuerda la invitación para retomarla después de iniciar sesión. */
  recordar(): void {
    try { sessionStorage.setItem(CLAVE_INVITACION_PENDIENTE, `/ecosistema/invitacion?testigo=${this.testigo}`); } catch { /* sin almacenamiento */ }
  }

  /**
   * Cierra la sesión de la cuenta que no es la invitada y lleva a entrar o a crear la cuenta del
   * correo invitado, recordando la invitación para volver aquí después.
   */
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
      const aceptada = await firstValueFrom(this.api.post<{ organizacionId?: string; rol?: string }>('/api/v1/externo/invitaciones/aceptar', { testigo: this.testigo }, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible aceptar la invitación.',
      }));
      try { sessionStorage.removeItem(CLAVE_INVITACION_PENDIENTE); } catch { /* sin almacenamiento */ }
      await firstValueFrom(this.sesionExterna.refrescar());
      // SE ABRE LA ORGANIZACIÓN QUE INVITÓ, no la habitual: es a la que se acaba de entrar.
      // Y CON SU ROL: el panel da la bienvenida «Te uniste a X como editor».
      await this.router.navigate(
        aceptada?.organizacionId ? rutaDelPanel(String(aceptada.organizacionId), 'resumen') : ['/gestion'],
        aceptada?.organizacionId ? { queryParams: { unido: aceptada.rol ?? this.invitacion()?.rol } } : {});
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
      this.invitacion.set(await firstValueFrom(this.api.post<InvitacionAbierta>(
        '/api/v1/externo/invitaciones/consultar', { testigo: this.testigo }, { errorFallback: 'No fue posible consultar la invitación.' })));
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
