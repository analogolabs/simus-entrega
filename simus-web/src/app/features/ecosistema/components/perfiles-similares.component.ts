import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { RouterLink } from '@angular/router';

import { DirectorioDePersonasService, PerfilesSimilares, TaxonomiaDePerfiles } from '../../../core/services/directorio-de-personas.service';
import { NombrePropioPipe } from '../../../shared/texto/nombre-propio.pipe';
import { EsqueletoComponent } from '../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * «Perfiles similares» al lado de la ficha de una persona (DIR, docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).
 *
 * <b>EL CRITERIO SE DICE.</b> Cada persona sugerida indica en qué coincide (servicio, rol, instrumento o práctica) y
 * el servidor explica la regla. Nunca aparece la misma persona ni perfiles no publicados: el servidor ya filtra.
 * También muestra cómo se clasificó quien se está viendo.
 */
@Component({
  selector: 'app-perfiles-similares',
  standalone: true,
  imports: [RouterLink, EsqueletoComponent],
  template: `
    <aside aria-labelledby="similares-titulo" data-testid="perfiles-similares" class="space-y-6">
      @if (cargando()) {
        <app-esqueleto variante="fila" [cantidad]="3" etiqueta="Buscando perfiles similares…" />
      } @else {
        @if (datos(); as d) {
          <section class="rounded-2xl border border-filete bg-white p-6" aria-labelledby="clasificacion-titulo" data-clasificacion>
            <h2 id="clasificacion-titulo" class="font-alternate text-sm font-bold text-tinta-media">Cómo se le encuentra</h2>
            @if (d.persona.completo) {
              <dl class="mt-3 space-y-3 text-sm">
                @for (grupo of grupos(); track grupo.rotulo) {
                  <div><dt class="text-xs font-bold text-tinta-media">{{ grupo.rotulo }}</dt>
                    <dd class="mt-1 flex flex-wrap gap-1.5">@for (v of grupo.valores; track v) { <span class="rounded-full bg-morado/10 px-2.5 py-0.5 text-xs text-morado">{{ v }}</span> }</dd></div>
                }
              </dl>
            } @else {
              <p class="mt-3 text-sm text-tinta-media" data-pendiente>Pendiente de completar: esta persona todavía no ha elegido sus roles ni sus servicios.</p>
            }
          </section>
        }
        <section class="rounded-2xl border border-filete bg-white p-6" aria-labelledby="similares-titulo">
          <h2 id="similares-titulo" class="font-alternate text-base font-bold text-titulo">Perfiles similares</h2>
          @if (error()) {
            <p role="alert" class="mt-3 text-sm text-red-700">{{ error() }}</p>
          } @else if (datos(); as d) {
            <p class="mt-1 text-xs text-tinta-media" data-criterio>{{ d.criterio }}</p>
            @if (d.similares.length) {
              <ul class="mt-4 space-y-4">
                @for (s of d.similares; track s.persona.clave) {
                  <li data-similar class="border-t border-filete pt-4 first:border-t-0 first:pt-0">
                    <a [routerLink]="['/ecosistema/personas', s.persona.clave]" class="font-bold text-morado no-underline hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado">{{ s.persona.nombreVisible }}</a>
                    @if (s.persona.municipio) { <p class="text-xs text-tinta-media">{{ lugar(s.persona.municipio, s.persona.departamento) }}</p> }
                    <p class="mt-1 text-xs text-titulo"><span class="font-bold">Coincide en:</span> {{ s.coincidencias.join(', ') }}</p>
                  </li>
                }
              </ul>
            } @else {
              <p class="mt-4 text-sm text-tinta-media" data-sin-similares>Todavía no hay otros perfiles públicos que coincidan con este.</p>
            }
          }
          <a routerLink="/ecosistema/personas" class="mt-5 inline-block text-sm font-bold text-morado underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado">Ver todo el directorio</a>
        </section>
      }
    </aside>
  `,
})
export class PerfilesSimilaresComponent {
  private readonly servicio = inject(DirectorioDePersonasService);
  private readonly nombrePropio = new NombrePropioPipe();
  private readonly destruccion = inject(DestroyRef);

  readonly clave = input.required<string>();

  readonly datos = signal<PerfilesSimilares | null>(null);
  readonly taxonomia = signal<TaxonomiaDePerfiles | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');

  readonly grupos = computed(() => {
    const d = this.datos();
    const t = this.taxonomia();
    if (!d) return [];
    const nombres = (codigos: string[], lista: { codigo: string; nombre: string }[] | undefined) => codigos.map(c => lista?.find(v => v.codigo === c)?.nombre ?? c);
    return [
      { rotulo: 'Roles', valores: nombres(d.persona.roles, t?.roles) },
      { rotulo: 'Servicios que ofrece', valores: nombres(d.persona.servicios, t?.servicios) },
      { rotulo: 'Instrumentos', valores: nombres(d.persona.instrumentos, t?.instrumentos) },
      { rotulo: 'Actúa en', valores: d.persona.territorios.map(t => this.nombrePropio.transform(t)) },
    ].filter(g => g.valores.length);
  });

  /** Los similares siguen a la clave: al pasar de una persona a otra se vuelven a pedir (la consulta anterior se cancela). */
  constructor() {
    this.servicio.taxonomia().pipe(takeUntilDestroyed(this.destruccion)).subscribe({ next: t => this.taxonomia.set(t), error: () => undefined });
    toObservable(this.clave).pipe(
      tap(() => { this.cargando.set(true); this.error.set(''); this.datos.set(null); }),
      switchMap(clave => this.servicio.similares(clave).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destruccion),
    ).subscribe(d => {
      if (d) this.datos.set(d); else this.error.set('No fue posible cargar los perfiles similares.');
      this.cargando.set(false);
    });
  }

  lugar(municipio: string, departamento: string | null): string {
    return this.nombrePropio.transform(departamento && departamento !== municipio ? `${municipio}, ${departamento}` : municipio);
  }
}
