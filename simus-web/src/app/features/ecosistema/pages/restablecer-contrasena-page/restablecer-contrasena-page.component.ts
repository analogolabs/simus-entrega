import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { enfocarCampo } from '../../../../core/formularios/foco';
import { traducirErrorDelServidor } from '../../../../core/formularios/traductor-de-errores';
import { RecuperacionDeContrasenaService } from '../../../../core/services/recuperacion-de-contrasena.service';
import { ErrorDeCampoComponent } from '../../../../shared/components/ui/error-de-campo/error-de-campo.component';

import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';
/** Lo que se le dice a quien abre un enlace que ya no sirve, y qué hacer. */
const MOTIVOS: Record<string, string> = {
  enlace_vencido: 'Este enlace ya venció. Los enlaces valen 60 minutos.',
  enlace_usado: 'Este enlace ya se usó. Cada enlace sirve una sola vez.',
  enlace_reemplazado: 'Pediste un enlace más reciente y este ya no sirve. Usa el último correo que recibiste.',
  enlace_no_valido: 'Este enlace no es válido. Revisa que lo copiaste completo.',
};

/**
 * La página que abre el enlace de recuperación de contraseña.
 *
 * <b>ES ANÓNIMA</b>: se abre desde el buzón, donde no hay sesión de SIMUS. El testigo se lee de la
 * dirección una vez y viaja en el cuerpo de las peticiones; ni él ni la contraseña se guardan, se
 * escriben en un registro ni se vuelven a mostrar.
 *
 * <b>PRIMERO SE COMPRUEBA EL ENLACE</b>, antes de pedir una contraseña, para no hacer escribir una
 * frase nueva y descubrir después que el enlace venció. <b>NO INICIA SESIÓN</b> al terminar: lleva a
 * ingresar con la contraseña nueva, y las demás sesiones de la cuenta ya quedaron cerradas.
 */
@Component({
  selector: 'app-restablecer-contrasena-page',
  standalone: true,
  imports: [BotonNativoDirective, FormsModule, RouterLink, ErrorDeCampoComponent],
  templateUrl: './restablecer-contrasena-page.component.html',
})
export class RestablecerContrasenaPageComponent {
  private readonly servicio = inject(RecuperacionDeContrasenaService);
  private readonly ruta = inject(ActivatedRoute);

  private readonly testigo = this.ruta.snapshot.queryParamMap.get('testigo')?.trim() ?? '';

  readonly comprobando = signal(true);
  /** El enlace sirve: se muestra el formulario. */
  readonly valido = signal(false);
  /** El motivo por el que el enlace no sirve, o `null` si sirve. */
  readonly motivo = signal<string | null>(null);
  readonly correoEnmascarado = signal('');
  readonly enviando = signal(false);
  readonly restablecida = signal(false);
  readonly mostrarContrasena = signal(false);
  readonly errores = signal<Record<string, string>>({});
  readonly error = signal('');

  nueva = '';
  confirmacion = '';

  /** El mensaje listo para mostrar cuando el enlace no sirve. */
  readonly mensajeDelMotivo = computed(() => {
    const motivo = this.motivo();
    return motivo ? (MOTIVOS[motivo] ?? MOTIVOS['enlace_no_valido']) : '';
  });

  constructor() {
    void this.comprobar();
  }

  alternarMostrarContrasena(): void { this.mostrarContrasena.update(valor => !valor); }

  actualizarCampo(campo: string): void {
    this.errores.update(errores => {
      const siguiente = { ...errores };
      delete siguiente[campo];
      return siguiente;
    });
  }

  /** La regla de cada campo, en un solo sitio. La política completa la aplica el servidor. */
  private mensajeDelCampo(campo: string): string | null {
    if (campo === 'nueva') return this.nueva.length >= 12 ? null : 'La contraseña debe tener al menos 12 caracteres.';
    return this.confirmacion && this.confirmacion === this.nueva ? null : 'Las contraseñas no coinciden.';
  }

  alSalirDelCampo(campo: string): void {
    const mensaje = this.mensajeDelCampo(campo);
    this.errores.update(errores => {
      const siguiente = { ...errores };
      if (mensaje) siguiente[campo] = mensaje; else delete siguiente[campo];
      return siguiente;
    });
  }

  async restablecer(): Promise<void> {
    if (this.enviando()) return;
    this.error.set('');
    const fallos = ['nueva', 'confirmacion'].filter(campo => this.mensajeDelCampo(campo));
    this.errores.set(Object.fromEntries(fallos.map(campo => [campo, this.mensajeDelCampo(campo)!])));
    if (fallos.length) { this.enfocar(fallos[0]); return; }

    this.enviando.set(true);
    try {
      await this.servicio.restablecer(this.testigo, this.nueva);
      this.nueva = '';
      this.confirmacion = '';
      this.restablecida.set(true);
      enfocarCampo('restablecer-titulo');
    } catch (fallo: unknown) {
      this.fallar(fallo);
    } finally {
      this.enviando.set(false);
    }
  }

  /**
   * Lo que rechaza el servidor vuelve a su campo (la política de contraseñas) o al aviso general (el
   * enlace que dejó de servir entre tanto), con el traductor compartido de los formularios.
   */
  private fallar(fallo: unknown): void {
    const traducido = traducirErrorDelServidor(fallo, {
      camposConLugar: ['nueva'],
      alternativa: 'No fue posible restablecer la contraseña. Inténtalo de nuevo.',
    });
    const payload = (fallo as { payload?: { motivo?: string } } | null)?.payload;
    if (payload?.motivo && MOTIVOS[payload.motivo]) {
      this.motivo.set(payload.motivo);
      return;
    }
    if (traducido.hayCampos) {
      this.errores.set(traducido.campos);
      this.enfocar('nueva');
      return;
    }
    this.error.set(traducido.general);
  }

  private enfocar(campo: string): void {
    enfocarCampo(campo === 'nueva' ? 'restablecer-nueva' : 'restablecer-confirmacion');
  }

  private async comprobar(): Promise<void> {
    if (!this.testigo) {
      this.motivo.set('enlace_no_valido');
      this.comprobando.set(false);
      return;
    }
    try {
      const estado = await this.servicio.comprobar(this.testigo);
      if (estado.valido) {
        this.correoEnmascarado.set(estado.correoEnmascarado ?? '');
        this.valido.set(true);
        enfocarCampo('restablecer-nueva');
      } else {
        this.motivo.set(estado.motivo ?? 'enlace_no_valido');
      }
    } catch (fallo: unknown) {
      this.error.set(traducirErrorDelServidor(fallo, {
        alternativa: 'No fue posible comprobar el enlace. Inténtalo de nuevo en un momento.',
      }).general);
    } finally {
      this.comprobando.set(false);
    }
  }
}
