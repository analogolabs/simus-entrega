import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * El aviso de una ficha pública cuyo proceso es un registro histórico (tarjeta pequeña sobre «Datos del …»), con el enlace
 * «Es de mi organización: pedir su administración» (decisión 129).
 *
 * UNA SOLA PIEZA para los cinco tipos de proceso: el enlace lleva a la herramienta «Procesos históricos» de la
 * organización, con el proceso ya buscado y su tipo.
 */
@Component({
  selector: 'app-aviso-de-registro-historico',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <aside class="rounded-xl border border-filete bg-niebla/60 p-4" data-testid="registro-historico" aria-labelledby="registro-historico-titulo">
      <p id="registro-historico-titulo" class="font-alternate text-xs font-bold text-morado">Registro histórico</p>
      <p class="mt-1.5 text-xs leading-relaxed text-prosa">
        Proviene de los levantamientos, la identificación y la caracterización del Plan Nacional de Música para la Convivencia
        del Ministerio de las Culturas, las Artes y los Saberes, como Sistema de Información de la Música. Puede tener
        una organización asociada.
      </p>
      <p class="mt-3 text-sm font-bold text-titulo">¿Reconoces {{ tipo() }}?</p>
      <p class="mt-1 text-xs leading-relaxed text-prosa">
        Es tuyo: registra tu organización o ingresa con tu organización y solicita la administración.
      </p>
      <a [routerLink]="'/gestion/herramientas/procesos-historicos'" [queryParams]="{ reclamar: id(), buscar: nombre(), tipo: modulo() }" fragment="historicos" data-reclamar-historico
         class="mt-3 inline-flex min-h-control items-center rounded-lg bg-morado px-3.5 py-2 text-sm font-bold text-white no-underline transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2">Es de mi organización: pedir su administración</a>
    </aside>
  `,
})
export class AvisoDeRegistroHistoricoComponent {
  /** Con su artículo, en minúscula: «este festival», «esta red». */
  readonly tipo = input.required<string>();
  /** El módulo: `festivales`, `mercados`, `redes`, `talleres` o `espacios`. */
  readonly modulo = input.required<string>();
  readonly id = input.required<string>();
  readonly nombre = input.required<string>();
}
