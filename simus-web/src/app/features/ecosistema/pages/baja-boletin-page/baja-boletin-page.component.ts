import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BoletinService } from '../../../../core/services/boletin.service';
import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';

/** En qué paso está la persona: cada uno tiene su propio bloque y su propio rótulo. */
type PasoDeLaBaja = 'cargando' | 'confirmar' | 'hecha' | 'invalido' | 'fallo';

/**
 * La página del enlace «Darme de baja» de los correos del boletín.
 *
 * <b>ES LA REVOCACIÓN DE LA AUTORIZACIÓN</b> que el texto del boletín promete «desde el enlace que acompaña a cada envío»
 * (Ley 1581 de 2012, art. 8). Es anónima a propósito: se abre desde el buzón, sin sesión; el testigo firmado es la credencial.
 *
 * <b>EN DOS TIEMPOS, COMO LA CONFIRMACIÓN.</b> Abrir la página solo consulta el enlace (no cambia nada: los antivirus y las
 * vistas previas abren los enlaces); la baja la hace el botón. Repetirla es inofensivo: el servidor es idempotente.
 *
 * <b>NO REVELA SI UN CORREO ESTÁ EN LA LISTA:</b> un enlace que no es auténtico dice siempre lo mismo. El correo que se
 * enseña sale enmascarado y solo con un enlace auténtico.
 */
@Component({
  selector: 'app-baja-boletin-page',
  standalone: true,
  imports: [TextoWebPipe, BotonNativoDirective, RouterLink],
  templateUrl: './baja-boletin-page.component.html',
})
export class BajaBoletinPageComponent implements OnInit {
  private readonly boletin = inject(BoletinService);
  private readonly ruta = inject(ActivatedRoute);

  readonly testigo = this.ruta.snapshot.queryParamMap.get('testigo') ?? '';
  readonly paso = signal<PasoDeLaBaja>(this.testigo ? 'cargando' : 'invalido');
  readonly correo = signal('');
  readonly trabajando = signal(false);
  readonly error = signal('');
  /** Verdadero si la persona ya estaba de baja al abrir el enlace (lo abrió dos veces). */
  readonly yaEstabaDeBaja = signal(false);

  ngOnInit(): void {
    if (this.testigo) void this.consultar();
  }

  async consultar(): Promise<void> {
    this.paso.set('cargando');
    this.error.set('');
    try {
      const vista = await firstValueFrom(this.boletin.consultarBaja(this.testigo));
      this.correo.set(vista.correo);
      this.yaEstabaDeBaja.set(vista.estado === 'baja');
      this.paso.set(vista.estado === 'baja' ? 'hecha' : 'confirmar');
    } catch (error: unknown) {
      this.alFallar(error);
    }
  }

  async darseDeBaja(): Promise<void> {
    if (!this.testigo || this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.boletin.darseDeBaja(this.testigo));
      this.yaEstabaDeBaja.set(false);
      this.paso.set('hecha');
    } catch (error: unknown) {
      this.alFallar(error);
    } finally {
      this.trabajando.set(false);
    }
  }

  /** Un 400 es un enlace que no sirve; cualquier otra cosa (red, cupo, servidor) se puede reintentar. */
  private alFallar(error: unknown): void {
    const estado = (error as { status?: number | null })?.status;
    if (estado === 400 || estado === 404) {
      this.paso.set('invalido');
      return;
    }
    this.error.set('No pudimos completar la baja ahora mismo. Tu suscripción no cambió: inténtalo de nuevo en unos minutos.');
    this.paso.set('fallo');
  }
}
