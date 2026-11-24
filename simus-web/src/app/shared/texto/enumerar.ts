import { Pipe, PipeTransform } from '@angular/core';

/**
 * «la descripción, el lugar y la fecha»: una lista escrita como se dice.
 *
 * `join(', ')` escribía «Falta la descripción, el lugar», que se lee como una frase a medias.
 */
export function enumerar(elementos: readonly string[] | null | undefined): string {
  const lista = (elementos ?? []).filter(elemento => elemento && elemento.trim());
  if (lista.length <= 1) return lista[0] ?? '';
  return `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
}

/** `{{ lista | enumerar }}`. */
@Pipe({ name: 'enumerar', standalone: true })
export class EnumerarPipe implements PipeTransform {
  transform(elementos: readonly string[] | null | undefined): string {
    return enumerar(elementos);
  }
}
