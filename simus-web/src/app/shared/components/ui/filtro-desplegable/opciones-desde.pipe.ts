import { Pipe, PipeTransform } from '@angular/core';

import { nombrePropio } from '../../../texto/nombre-propio';
import { OpcionDeFiltro } from './filtro-desplegable.component';

/**
 * `departamentos() | opcionesDesde:'code':'name':'Selecciona':true` — una lista de objetos, como las
 * opciones de `app-filtro-desplegable` (UI-D).
 *
 * Existe para que una plantilla que tenía un `<select>` con un `@for` de `<option>` pase al
 * desplegable estándar sin escribir una lista más en cada componente: el valor y el texto se nombran
 * por su propiedad. `textoVacio` añade la primera opción de valor `''` («Selecciona»); `propio`
 * escribe el texto como nombre propio («Valle del Cauca», no «VALLE DEL CAUCA»).
 *
 * Es puro: devuelve la misma lista mientras no cambie la entrada, así que el desplegable no se
 * vuelve a pintar de más.
 */
@Pipe({ name: 'opcionesDesde', standalone: true, pure: true })
export class OpcionesDesdePipe implements PipeTransform {
  transform<T extends object>(
    lista: readonly T[] | null | undefined,
    propiedadDelValor: keyof T & string,
    propiedadDelTexto: keyof T & string,
    textoVacio: string | null = null,
    propio = false,
  ): OpcionDeFiltro[] {
    const opciones = (lista ?? []).map(elemento => {
      const campos = elemento as Record<string, unknown>;
      const texto = String(campos[propiedadDelTexto] ?? '');
      return { id: String(campos[propiedadDelValor] ?? ''), etiqueta: propio ? nombrePropio(texto) : texto };
    });
    return textoVacio === null ? opciones : [{ id: '', etiqueta: textoVacio }, ...opciones];
  }
}
