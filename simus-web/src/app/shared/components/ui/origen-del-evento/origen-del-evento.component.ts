import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideMapPin, LucideUsers2 } from '@lucide/angular';
import { ETIQUETAS_DE_PROCESO_DEL_EVENTO, ProcesoDelEvento } from '../../../../core/services/agenda.service';

/**
 * Dónde, quién organiza y a qué proceso pertenece un evento de la Agenda: la pieza común de la ficha
 * del evento (decisión 116 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`).
 *
 * <b>EL PROCESO NO ES UNA ETIQUETA DE LA TARJETA.</b> En la lista y en el mapa el evento enseña su
 * categoría, su fecha y su lugar; el proceso al que está ligado (Festival, Mercado, taller, espacio o
 * red) se lee aquí, al abrir la ficha, justo debajo de la organización y con enlace a su ficha. El
 * orden es el de la pregunta de quien llega: dónde es, quién lo hace y de qué proceso hace parte.
 */
@Component({
  selector: 'app-origen-del-evento',
  standalone: true,
  imports: [RouterLink, LucideMapPin, LucideUsers2],
  template: `
    @if (lugar() || territorio()) {
      <div [class]="compacto() ? 'flex gap-2' : 'flex gap-3'">
        <svg lucideMapPin [size]="compacto() ? 14 : 18" aria-hidden="true" class="mt-0.5 shrink-0 text-morado"></svg>
        <div>
          <dt [class]="compacto() ? 'text-dato font-bold text-slate-500' : 'tipo-etiqueta text-tinta-media'">Dónde</dt>
          @if (lugar()) { <dd [class]="compacto() ? 'text-cuerpo font-semibold text-slate-700' : 'mt-1 font-nunito text-base font-bold text-titulo'" data-testid="evento-lugar">{{ lugar() }}</dd> }
          @if (territorio()) { <dd [class]="compacto() ? 'text-cuerpo font-semibold text-slate-700' : 'mt-0.5 text-sm text-tinta-media'" data-testid="evento-territorio">{{ territorio() }}</dd> }
          @if (modalidad()) { <dd [class]="compacto() ? 'mt-0.5 text-dato text-slate-500' : 'mt-0.5 text-sm text-tinta-media'">{{ modalidad() }}</dd> }
        </div>
      </div>
    }

    @if (organizacion()) {
      <div [class]="compacto() ? 'flex gap-2' : 'flex gap-3'" data-testid="evento-organiza">
        <svg lucideUsers2 [size]="compacto() ? 14 : 18" aria-hidden="true" class="mt-0.5 shrink-0 text-morado"></svg>
        <div>
          <dt [class]="compacto() ? 'text-dato font-bold text-slate-500' : 'tipo-etiqueta text-tinta-media'">Organiza</dt>
          <dd [class]="compacto() ? 'text-cuerpo font-semibold text-slate-700' : 'mt-1 font-nunito text-base font-bold text-titulo'">
            @if (rutaDeLaOrganizacion(); as ruta) {
              <a [routerLink]="ruta" class="text-morado hover:text-morado-claro focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado">{{ organizacion() }}</a>
            } @else {
              {{ organizacion() }}
            }
          </dd>
          @if (proceso(); as p) {
            <dd [class]="compacto() ? 'mt-0.5 text-dato text-slate-500' : 'mt-0.5 text-sm text-tinta-media'" data-testid="evento-proceso">
              {{ etiquetaDelProceso() }}:
              <a [routerLink]="rutaDelProceso()" class="font-bold text-morado hover:text-morado-claro focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado" data-testid="evento-proceso-enlace">{{ p.nombre }}</a>
            </dd>
          }
        </div>
      </div>
    } @else if (proceso(); as p) {
      <div [class]="compacto() ? 'flex gap-2' : 'flex gap-3'" data-testid="evento-proceso">
        <svg lucideUsers2 [size]="compacto() ? 14 : 18" aria-hidden="true" class="mt-0.5 shrink-0 text-morado"></svg>
        <div>
          <dt [class]="compacto() ? 'text-dato font-bold text-slate-500' : 'tipo-etiqueta text-tinta-media'">{{ etiquetaDelProceso() }}</dt>
          <dd [class]="compacto() ? 'text-cuerpo font-semibold text-slate-700' : 'mt-1 font-nunito text-base font-bold text-titulo'">
            <a [routerLink]="rutaDelProceso()" class="text-morado hover:text-morado-claro focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado" data-testid="evento-proceso-enlace">{{ p.nombre }}</a>
          </dd>
        </div>
      </div>
    }
  `,
  host: { style: 'display: contents' },
})
export class OrigenDelEventoComponent {
  /**
   * La versión de la tarjeta del mapa: textos del tamaño estándar (cuerpo y dato), iconos pequeños y sin el
   * tratamiento de ficha completa. La ficha del evento y la Agenda siguen con el tamaño grande.
   */
  readonly compacto = input(false);
  readonly lugar = input<string>('');
  readonly territorio = input<string>('');
  readonly modalidad = input<string>('');
  /** El organizador escrito en el evento; si el proceso trae una organización pública, esa manda. */
  readonly organizador = input<string>('');
  readonly proceso = input<ProcesoDelEvento | null | undefined>(null);

  readonly organizacion = computed(() => this.proceso()?.organizacionNombre || this.organizador());

  readonly etiquetaDelProceso = computed(() => {
    const tipo = this.proceso()?.tipo ?? '';
    return tipo === 'mercado' ? 'Mercado musical' : ETIQUETAS_DE_PROCESO_DEL_EVENTO[tipo] ?? 'Proceso';
  });

  /** La ficha pública del proceso: el servidor solo manda el proceso si está publicado. */
  readonly rutaDelProceso = computed((): string[] => {
    const p = this.proceso();
    if (!p) return [];
    const base: Record<string, string> = {
      festival: 'festivales', mercado: 'mercados-musicales', taller: 'luteria', espacio: 'espacios', red: 'redes',
    };
    return ['/ecosistema', base[p.tipo] ?? 'festivales', String(p.id)];
  });

  /** La ficha de la organización, solo si es pública (el servidor no manda el id si no lo es). */
  readonly rutaDeLaOrganizacion = computed((): string[] | null => {
    const id = this.proceso()?.organizacionId;
    return id ? ['/ecosistema', 'organizaciones', String(id)] : null;
  });
}
