import { Component } from '@angular/core';
import { EncabezadoDePantallaComponent } from '../../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { BibliotecaDeArchivosComponent } from './biblioteca-de-archivos.component';

/**
 * «Archivos de la organización», en el espacio de la organización.
 *
 * <b>POR QUE HACIA FALTA.</b> Cuando una organización llenaba su cuota, el sistema le decía «retira
 * material que ya no uses» y no había ninguna forma de retirarlo: la única salida era escribir al
 * Programa. Una promesa que el sistema no puede cumplir es peor que no hacerla. Y tampoco podía
 * ver lo que llevaba subido, así que no sabía qué ocupaba su espacio.
 *
 * <b>UNA BIBLIOTECA (P4, prototipo B4).</b> Desde P4 la pantalla es una biblioteca de cuadrícula o lista con ficha
 * lateral, búsqueda, orden y filtros (`app-biblioteca-de-archivos`). Sigue leyendo el mismo banco, por el canal
 * externo: el servidor decide qué devuelve según por dónde se pregunta. La consola conserva `app-gestion-del-banco`.
 */
@Component({
  selector: 'app-seccion-archivos',
  standalone: true,
  imports: [BibliotecaDeArchivosComponent, EncabezadoDePantallaComponent],
  template: `
    <div class="space-y-5 pb-8">
      <app-encabezado-de-pantalla titulo="Archivos de la organización" descripcion="Las imágenes subidas a los procesos de la organización. Un archivo se puede retirar cuando ya no lo usa ninguna ficha." />
      <app-biblioteca-de-archivos />
    </div>
  `,
})
export class SeccionArchivosComponent {}
