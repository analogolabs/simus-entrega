import { Component, computed, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { ConsultaEstructurada, RespuestaDeConsultaAbierta } from './consulta-guiada.service';

/**
 * «Cómo entendí tu pregunta» de la consulta abierta: lo que el modelo interpretó, a la vista y corregible, más el gráfico sugerido.
 *
 * <b>SE CARGA DIFERIDO</b> (`@defer`) desde el cajón: solo existe si alguien hace una consulta abierta, así que no pesa en el
 * paquete inicial. Los chips no son decoración: cada uno es un filtro o una agrupación que se QUITA con un clic, y quitarlo
 * vuelve a pedir la consulta al servidor ya corregida, sin pasar otra vez por el modelo.
 */
@Component({
  selector: 'app-como-entendi-abierta',
  standalone: true,
  imports: [LucideX],
  template: `
    <section data-como-entendi aria-labelledby="como-entendi-titulo" class="mt-3 border-t border-slate-200 pt-3">
      <h3 id="como-entendi-titulo" class="text-xs font-bold text-slate-800">Cómo entendí tu pregunta</h3>
      <p class="mt-1 text-dato text-slate-600">{{ lineas()[0] }}</p>
      @if (chips().length > 0) {
        <ul class="mt-2 flex flex-wrap gap-1.5" aria-label="Filtros aplicados; quita los que no quieras">
          @for (chip of chips(); track chip.clave) {
            <li>
              <button type="button" data-quitar-chip [disabled]="ocupado()" (click)="quitar(chip.clave)"
                [attr.aria-label]="'Quitar: ' + chip.texto"
                class="inline-flex min-h-control items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-dato font-semibold text-slate-700 no-underline hover:border-morado-claro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado-claro disabled:opacity-50">
                {{ chip.texto }}<svg lucideX [size]="12" aria-hidden="true" class="shrink-0"></svg>
              </button>
            </li>
          }
        </ul>
      }
      @if (otras().length > 0) {
        <p class="mt-2 text-dato text-slate-500">{{ otras().join(' · ') }}</p>
      }
      <p class="mt-2 text-dato text-rotulo">{{ origen() }}</p>
    </section>
    @if (barras().length > 0) {
      <figure data-grafico class="mt-3" [attr.aria-label]="'Gráfico: ' + (respuesta().tabla?.titulo ?? '')">
        <ul class="flex flex-col gap-1">
          @for (barra of barras(); track barra.etiqueta) {
            <li class="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-2 text-dato text-slate-600">
              <span class="truncate" [attr.title]="barra.etiqueta">{{ barra.etiqueta }}</span>
              <span class="h-2.5 rounded bg-slate-100"><span class="block h-full rounded bg-morado-claro" [style.width.%]="barra.porcentaje"></span></span>
              <span class="font-bold text-slate-700">{{ barra.valor }}</span>
            </li>
          }
        </ul>
        <figcaption class="sr-only">La misma información está en la tabla.</figcaption>
      </figure>
    }
  `,
})
export class ComoEntendiAbiertaComponent {
  readonly respuesta = input.required<RespuestaDeConsultaAbierta>();
  readonly ocupado = input(false);
  /** La consulta ya corregida (sin el filtro quitado); el cajón la vuelve a pedir. */
  readonly editar = output<ConsultaEstructurada>();

  readonly lineas = computed(() => this.respuesta().comoEntendi);

  /** Un chip por filtro y por agrupación, en el orden en que el servidor los explica. */
  readonly chips = computed(() => {
    const r = this.respuesta();
    const c = r.consultaEntendida;
    if (!c) return [];
    const filtros = (c.filtros ?? []).map((_, i) => ({ clave: `f${i}`, texto: r.comoEntendi[1 + i] ?? '' }));
    const agrupar = (c.agrupar ?? []).map((campo, i) => ({ clave: `g${i}`, texto: `Agrupado por ${campo}` }));
    return [...filtros, ...agrupar].filter(chip => chip.texto);
  });

  /** Las demás líneas (cálculo, orden, límite): se leen, no se editan aquí. */
  readonly otras = computed(() => {
    const r = this.respuesta();
    const n = r.consultaEntendida?.filtros?.length ?? 0;
    return r.comoEntendi.slice(1 + n).filter(l => !l.startsWith('Agrupado por'));
  });

  readonly origen = computed(() => {
    const r = this.respuesta();
    const s = (r.latenciaMs / 1000).toFixed(1).replace('.', ',');
    return r.via === 'modelo'
      ? `Un modelo local interpretó la pregunta en ${s} s. Las cifras salen de los datos publicados, no del modelo.`
      : r.via === 'consulta_editada' ? 'Consulta corregida por ti; las cifras salen de los datos publicados.' : 'Pregunta verificada del portal.';
  });

  /** Barras para una agrupación con valores numéricos; la tabla sigue siendo la fuente. */
  readonly barras = computed(() => {
    const r = this.respuesta();
    const t = r.tabla;
    if (!r.grafico || !t || t.filas.length < 2) return [];
    const ultima = t.columnas.length - 1;
    const filas = t.filas.slice(0, 12).map(f => ({ etiqueta: f.slice(0, ultima).join(' · '), valor: f[ultima], n: Number(String(f[ultima]).replace(',', '.')) }));
    if (filas.some(f => !Number.isFinite(f.n))) return [];
    const maximo = Math.max(...filas.map(f => f.n), 1);
    return filas.map(f => ({ etiqueta: f.etiqueta, valor: f.valor, porcentaje: Math.round((100 * Math.max(f.n, 0)) / maximo) }));
  });

  quitar(clave: string): void {
    const c = this.respuesta().consultaEntendida;
    if (!c) return;
    const indice = Number(clave.slice(1));
    const nueva: ConsultaEstructurada = { ...c, filtros: [...(c.filtros ?? [])], agrupar: [...(c.agrupar ?? [])] };
    if (clave.startsWith('f')) nueva.filtros!.splice(indice, 1);
    else {
      nueva.agrupar!.splice(indice, 1);
      // Sin agrupar, el cálculo y el orden por «metrica» ya no aplican: vuelve a ser una lista.
      if (nueva.agrupar!.length === 0 && nueva.metrica?.funcion === 'count') { nueva.metrica = null; nueva.orden = null; }
    }
    this.editar.emit(nueva);
  }
}
