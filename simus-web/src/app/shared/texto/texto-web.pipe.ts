import { Pipe, PipeTransform, inject } from '@angular/core';
import { TextosWebService } from '../../core/services/textos-web.service';

/**
 * `{{ 'clave_del_cms' | textoWeb }}` — un texto fijo del portal, editable desde el CMS.
 *
 * La clave tiene que existir en `registro-de-textos-web.ts`: el registro guarda el texto de
 * respaldo (el que ya estaba escrito en la plantilla), así que mientras nadie publique otro el
 * sitio se ve igual que antes.
 *
 * ES IMPURO A PROPÓSITO. Lee la señal del servicio de textos, que cambia cuando llegan los textos
 * publicados o, en la vista previa del CMS, cuando se escribe un borrador. Un pipe puro no volvería
 * a evaluarse y la página se quedaría con el texto de respaldo. El costo es una búsqueda en un
 * diccionario por cada uso por ciclo de detección.
 */
@Pipe({ name: 'textoWeb', standalone: true, pure: false })
export class TextoWebPipe implements PipeTransform {
  private readonly textos = inject(TextosWebService);

  transform(clave: string): string {
    return this.textos.getWebText(clave);
  }
}
