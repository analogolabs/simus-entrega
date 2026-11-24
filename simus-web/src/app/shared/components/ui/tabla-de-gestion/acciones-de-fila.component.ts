import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ServicioDeConfirmacion, PeticionDeConfirmacion } from '../../../../core/confirmacion/servicio-de-confirmacion';
import { AccionDeRegistro, MenuDeAccionesComponent } from '../menu-de-acciones/menu-de-acciones.component';

/**
 * Una acción sobre una fila: lo de `AccionDeRegistro` (id, etiqueta, tono, enlace, deshabilitada y su motivo) más,
 * opcionalmente, la confirmación que se pide ANTES de emitirla.
 */
export interface AccionDeFila extends AccionDeRegistro {
  /**
   * El diálogo que se abre antes de ejecutar. Una acción con `tono: 'peligro'` que no la traiga recibe una
   * por omisión («Esto no se deshace»): lo destructivo nunca se ejecuta con un solo clic.
   */
  confirmacion?: PeticionDeConfirmacion;
}

/** Lo que emite `app-acciones-de-fila` al confirmarse una acción. */
export interface AccionElegida {
  /** El `id` de la acción. */
  readonly id: string;
  /** El motivo escrito en el diálogo (cadena vacía si no se pedía). */
  readonly motivo: string;
}

/**
 * LA COLUMNA «ACCIONES» de una tabla de gestión: UN solo control por fila —los tres puntos— que abre
 * `app-menu-de-acciones` (la acción esperada primero, lo irreversible al final y en rojo, lo que no se puede
 * hacer ahora apagado y con su motivo escrito).
 *
 * <b>LA CONFIRMACIÓN VIVE AQUÍ.</b> Si la acción elegida trae `confirmacion`, o es de `tono: 'peligro'`, se abre
 * el diálogo común (`ServicioDeConfirmacion`: qué va a pasar, qué consecuencia tiene, el motivo si viaja al
 * historial) y solo se emite `elegida` si la persona confirma. Quien consume no vuelve a escribir un
 * «¿seguro?» por pantalla: recibe la acción ya confirmada, con su motivo.
 *
 * <b>NAVEGAR NO ES CONFIRMAR.</b> «Abrir» y «Ver historial» no llevan confirmación: la pantalla las atiende en
 * `elegida` como cualquier otra (típicamente, `router.navigate`).
 *
 * `app-tabla-de-gestion` la usa en su última columna; puede usarse suelta en cualquier fila o ficha.
 */
@Component({
  selector: 'app-acciones-de-fila',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MenuDeAccionesComponent],
  template: `<app-menu-de-acciones [acciones]="paraElMenu()" [descripcion]="descripcion()" (elegida)="alElegir($event)" />`,
})
export class AccionesDeFilaComponent {
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  /** Las acciones que corresponden a ESTA fila hoy. Lo que no corresponde no se incluye. */
  readonly acciones = input.required<readonly AccionDeFila[]>();
  /** A qué fila pertenece, para el nombre accesible del disparador: «Acciones de Festival del Macizo». */
  readonly descripcion = input('');
  /** Se emite con la acción ya confirmada. */
  readonly elegida = output<AccionElegida>();

  protected readonly paraElMenu = computed(() => [...this.acciones()]);

  protected async alElegir(id: string): Promise<void> {
    const accion = this.acciones().find(a => a.id === id);
    if (!accion || accion.deshabilitada) return;
    const peticion = accion.confirmacion ?? (accion.tono === 'peligro'
      ? { titulo: accion.etiqueta, detalle: 'Esta acción no se deshace.', accion: accion.etiqueta, tono: 'destructiva' as const }
      : null);
    if (!peticion) { this.elegida.emit({ id, motivo: '' }); return; }
    const respuesta = await this.confirmaciones.pedir(peticion);
    if (respuesta) this.elegida.emit({ id, motivo: respuesta.motivo });
  }
}
