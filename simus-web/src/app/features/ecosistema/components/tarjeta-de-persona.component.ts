import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PersonaDelDirectorio } from '../../../core/services/directorio-de-personas.service';

/** Las iniciales de un nombre: hasta dos letras, la de la primera y la de la última palabra. */
export function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  const primera = palabras[0][0];
  const ultima = palabras.length > 1 ? palabras[palabras.length - 1][0] : '';
  return (primera + ultima).toLocaleUpperCase('es');
}

/** Un tono estable por nombre: la misma persona siempre tiene el mismo color de respaldo, sin foto. */
const TONOS = ['bg-morado/10 text-morado', 'bg-verde/15 text-morado', 'bg-niebla text-titulo', 'bg-hueso text-morado'] as const;
export function tonoDe(nombre: string): string {
  let suma = 0;
  for (const c of nombre) suma = (suma + c.charCodeAt(0)) % 9973;
  return TONOS[suma % TONOS.length];
}

/**
 * Una persona del directorio de agentes y actores de la música, en mosaico o en lista.
 *
 * <b>LA FOTO MANDA.</b> En el mosaico es un cuadrado a todo el ancho; en la lista, un cuadrado de 6 rem. Sin foto (o si la
 * imagen no carga) se dibujan las iniciales sobre un tono estable: una tarjeta sin foto no parece rota ni vacía.
 *
 * <b>SOLO LO CONSENTIDO.</b> Pinta lo que el servidor entregó, que ya es lo que la persona publicó: nombre público, foto,
 * roles, servicios, instrumentos y territorio. Nunca su residencia ni su nombre civil.
 *
 * Sin mayúsculas sostenidas (docs/usuario/23-guia-de-estilo-de-textos.md). Tarjeta sin tarjetas anidadas; el nombre enlaza a la ficha y toda la tarjeta
 * es su área de toque.
 */
@Component({
  selector: 'app-tarjeta-de-persona',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (modo() === 'mosaico') {
      <article class="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-filete bg-white transition hover:border-verde-medio" [attr.data-persona]="persona().nombreVisible">
        <div class="relative aspect-square w-full overflow-hidden bg-niebla">
          @if (hayFoto()) {
            <img [src]="persona().fotoUrl" [alt]="'Foto de ' + persona().nombreVisible" loading="lazy" decoding="async" width="320" height="320"
              class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" (error)="falloLaFoto.set(true)" />
          } @else {
            <span data-iniciales aria-hidden="true" [class]="'flex h-full w-full items-center justify-center font-alternate text-5xl font-bold ' + tono()">{{ iniciales() }}</span>
          }
          @if (!persona().completo) {
            <span class="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-tinta-media">Perfil por completar</span>
          }
        </div>
        <div class="flex flex-1 flex-col gap-2 p-5">
          <h3 class="text-lg font-bold leading-tight">
            <a [routerLink]="enlace()" class="text-morado no-underline after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-verde focus-visible:after:ring-inset focus-visible:after:rounded-2xl">{{ persona().nombreVisible }}</a>
          </h3>
          <p class="line-clamp-2 min-h-10 text-sm text-tinta-media">{{ contexto() }}</p>
          @if (lugar()) { <p class="text-sm text-titulo">{{ lugar() }}</p> }
          @if (etiquetas().length) {
            <ul class="mt-auto flex flex-wrap gap-1.5 pt-1" aria-label="Servicios e instrumentos">
              @for (e of etiquetasVisibles(); track e) { <li class="rounded-full bg-verde/10 px-2.5 py-0.5 text-xs text-morado">{{ e }}</li> }
              @if (sobran() > 0) { <li class="rounded-full border border-filete px-2.5 py-0.5 text-xs text-tinta-media">+{{ sobran() }}</li> }
            </ul>
          }
        </div>
      </article>
    } @else {
      <article class="group relative grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-6 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[7rem_minmax(0,1fr)_14rem]" [attr.data-persona]="persona().nombreVisible">
        <div class="h-20 w-20 overflow-hidden rounded-2xl bg-niebla sm:h-28 sm:w-28">
          @if (hayFoto()) {
            <img [src]="persona().fotoUrl" [alt]="'Foto de ' + persona().nombreVisible" loading="lazy" decoding="async" width="112" height="112"
              class="h-full w-full object-cover" (error)="falloLaFoto.set(true)" />
          } @else {
            <span data-iniciales aria-hidden="true" [class]="'flex h-full w-full items-center justify-center font-alternate text-2xl font-bold sm:text-3xl ' + tono()">{{ iniciales() }}</span>
          }
        </div>
        <div class="min-w-0">
          <h3 class="text-xl font-bold leading-tight">
            <a [routerLink]="enlace()" class="text-morado no-underline after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-verde focus-visible:after:ring-inset">{{ persona().nombreVisible }}</a>
          </h3>
          <p class="mt-1 text-sm text-tinta-media">{{ contexto() }}</p>
          @if (persona().biografiaCorta) { <p class="mt-2 line-clamp-2 text-sm leading-relaxed text-titulo">{{ persona().biografiaCorta }}</p> }
          @if (etiquetas().length) {
            <ul class="mt-3 flex flex-wrap gap-1.5" aria-label="Servicios e instrumentos">
              @for (e of etiquetas(); track e) { <li class="rounded-full bg-verde/10 px-2.5 py-0.5 text-xs text-morado">{{ e }}</li> }
            </ul>
          }
        </div>
        <div class="col-span-2 min-w-0 text-sm lg:col-span-1 lg:text-right">
          @if (lugar()) { <p class="text-xs font-bold text-tinta-media">Municipio</p><p class="mt-1 text-titulo">{{ lugar() }}</p> }
          @if (persona().territorios.length) { <p class="mt-3 text-xs font-bold text-tinta-media">Actúa en</p><p class="mt-1 text-titulo">{{ persona().territorios.join(', ') }}</p> }
          @if (!persona().completo) { <p class="mt-3 text-xs text-tinta-media">Perfil por completar</p> }
        </div>
      </article>
    }
  `,
})
export class TarjetaDePersonaComponent {
  readonly persona = input.required<PersonaDelDirectorio>();
  readonly modo = input<'mosaico' | 'lista'>('mosaico');
  /** La línea bajo el nombre: roles dichos con su nombre («Luthier · Docente»). */
  readonly contexto = input('');
  /** Servicios e instrumentos dichos con su nombre. */
  readonly etiquetas = input<readonly string[]>([]);
  /** «Municipio, Departamento», ya con nombre propio. */
  readonly lugar = input('');

  protected readonly falloLaFoto = signal(false);
  protected readonly hayFoto = computed(() => !!this.persona().fotoUrl && !this.falloLaFoto());
  protected readonly iniciales = computed(() => inicialesDe(this.persona().nombreVisible));
  protected readonly tono = computed(() => tonoDe(this.persona().nombreVisible));
  protected readonly enlace = computed(() => ['/ecosistema/personas', this.persona().clave]);
  protected readonly etiquetasVisibles = computed(() => this.etiquetas().slice(0, 3));
  protected readonly sobran = computed(() => Math.max(0, this.etiquetas().length - 3));
}
