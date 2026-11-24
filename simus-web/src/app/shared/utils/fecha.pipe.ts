import { Pipe, PipeTransform } from '@angular/core';
import { EstiloDeFecha, OpcionesDeFecha, ValorDeFecha, formatearFecha } from './formatos-de-fecha';

/**
 * `{{ valor | fecha }}`, `{{ valor | fecha:'fecha-hora' }}`: el único pipe de fechas de SIMUS.
 *
 * Sustituye al `| date` de Angular, que sin idioma sale en inglés y sin zona pinta la hora del
 * navegador. Toda la lógica vive en `formatearFecha`; ver allí la regla de instantes y
 * fechas de calendario.
 */
@Pipe({ name: 'fecha', standalone: true })
export class FechaPipe implements PipeTransform {
  transform(valor: ValorDeFecha, estilo: EstiloDeFecha = 'fecha', opciones?: OpcionesDeFecha): string {
    return formatearFecha(valor, estilo, opciones);
  }
}
