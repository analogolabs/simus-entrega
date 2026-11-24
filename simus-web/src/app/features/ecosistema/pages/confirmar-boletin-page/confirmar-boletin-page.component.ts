import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../../core/http/api-client.service';
import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';

/**
 * La página que recibe el enlace de confirmación del boletín (doble confirmación, S-10).
 *
 * <b>ES ANONIMA A PROPOSITO:</b> el enlace se abre desde el buzón, sin sesión.
 *
 * <b>CONFIRMA UN BOTON, NO LA CARGA DE LA PAGINA.</b> Los antivirus y las vistas previas del correo
 * abren los enlaces por quien los recibe; si abrir bastara, confirmarían por la persona. Así la
 * autorización de tratamiento de datos es siempre un acto de quien la da.
 *
 * <b>EL TESTIGO NO SE QUEDA EN LA BARRA</b> ni viaja en la URL de la petición: va en el cuerpo.
 */
@Component({
  selector: 'app-confirmar-boletin-page',
  standalone: true,
  imports: [TextoWebPipe, BotonNativoDirective, CommonModule, RouterLink],
  templateUrl: './confirmar-boletin-page.component.html',
})
export class ConfirmarBoletinPageComponent {
  private readonly api = inject(ApiClientService);
  private readonly ruta = inject(ActivatedRoute);

  readonly testigo = this.ruta.snapshot.queryParamMap.get('testigo') ?? '';
  readonly trabajando = signal(false);
  readonly confirmado = signal(false);
  readonly error = signal(this.testigo ? '' : 'Este enlace está incompleto. Ábrelo tal como llegó a tu correo.');

  async confirmar(): Promise<void> {
    if (!this.testigo || this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.post('/api/v1/publico/boletin/confirmar', { testigo: this.testigo }, {}));
      this.confirmado.set(true);
    } catch (error: unknown) {
      const mensaje = (error as { payload?: { message?: unknown } })?.payload?.message;
      this.error.set(typeof mensaje === 'string' && mensaje.trim() ? mensaje.trim() : 'No fue posible confirmar la suscripción. Inténtalo de nuevo en unos minutos.');
    } finally {
      this.trabajando.set(false);
    }
  }
}
