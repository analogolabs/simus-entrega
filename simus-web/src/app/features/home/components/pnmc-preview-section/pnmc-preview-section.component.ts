import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { EncabezadoDeSeccionComponent } from '../encabezado-de-seccion/encabezado-de-seccion.component';

/**
 * QUÉ ES SIMUS. El mensaje que define el sistema y, a su lado, cuatro conceptos con icono,
 * sin tarjetas ni sombras. El PNMC ya no tiene sección propia aquí: es una de
 * las puertas de «Explora SIMUS».
 */
@Component({
  selector: 'app-pnmc-preview-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EncabezadoDeSeccionComponent],
  templateUrl: './pnmc-preview-section.component.html',
})
export class PNMCPreviewSectionComponent {
  private webTexts = inject(TextosWebService);

  /** Los cuatro conceptos. Las claves se escriben enteras para que el panel sepa quién las lee. */
  /**
   * Color expresivo de cada concepto: magenta para lo cultural (el ecosistema), cian para la
   * información, amarillo para el territorio (los datos que se destacan) y morado para el conocimiento.
   */
  readonly conceptos = computed(() => ([
    ['01', 'home_concepto_1_title', 'home_concepto_1_desc', 'magenta'],
    ['02', 'home_concepto_2_title', 'home_concepto_2_desc', 'cian'],
    ['03', 'home_concepto_3_title', 'home_concepto_3_desc', 'amarillo'],
    ['04', 'home_concepto_4_title', 'home_concepto_4_desc', 'morado'],
  ] as const).map(([numero, titulo, descripcion, color]) => ({
    numero,
    barra: ({ magenta: 'var(--color-magenta)', cian: 'var(--color-cian)', amarillo: 'var(--color-verde)', morado: 'var(--color-morado)' } as const)[color],
    titulo: this.webTexts.getWebText(titulo),
    descripcion: this.webTexts.getWebText(descripcion),
  })));

  getWebText(key: string): string {
    return this.webTexts.getWebText(key);
  }
}
