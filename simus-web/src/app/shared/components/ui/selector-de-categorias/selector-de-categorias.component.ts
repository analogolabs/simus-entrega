import { Component, OnInit, inject, input, model, signal } from '@angular/core';

import { CambiosDeClasificacion, DirectorioDePersonasService, RolElegible, TaxonomiaDePerfiles, ValorDeTaxonomia, rolesElegibles } from '../../../../core/services/directorio-de-personas.service';
import { OpcionSeleccionable, SelectorMultipleComponent } from '../selector-multiple/selector-multiple.component';

/** Las categorías vacías: lo que hay antes de elegir. */
export const CATEGORIAS_VACIAS: CambiosDeClasificacion = { roles: [], servicios: [], instrumentos: [], codigosDeDepartamento: [] };

/**
 * Las categorías con las que una persona quiere que la encuentren (DIR, docs/desarrollo/19-cuentas-y-organizaciones.md §19.13): roles, servicios, instrumentos y
 * departamentos donde actúa. Selección múltiple sobre la taxonomía controlada del servidor.
 *
 * <b>UNA SOLA PIEZA PARA EL REGISTRO Y EL PERFIL.</b> Solo pinta y avisa de lo elegido (`valor`); quien la usa decide
 * cuándo y cómo guardar. Respeta los máximos de la taxonomía y lo dice.
 */
@Component({
  selector: 'app-selector-de-categorias',
  standalone: true,
  imports: [SelectorMultipleComponent],
  template: `
    @if (taxonomia(); as t) {
      <div class="fila-de-campos" data-selector-de-categorias>
        <app-selector-multiple [identificador]="prefijo() + '-roles'" [etiqueta]="'Roles, por categoría (hasta ' + t.maximoDeRoles + ')'" [opciones]="opciones(roles(t))" [seleccionados]="ids(valor().roles, roles(t))" (alternar)="alternar('roles', roles(t), $event, t.maximoDeRoles)" />
        <app-selector-multiple [identificador]="prefijo() + '-servicios'" [etiqueta]="'Servicios que ofreces (hasta ' + t.maximoDeServicios + ')'" [opciones]="opciones(ofrecidos(t.servicios, valor().servicios))" [seleccionados]="ids(valor().servicios, ofrecidos(t.servicios, valor().servicios))" (alternar)="alternar('servicios', ofrecidos(t.servicios, valor().servicios), $event, t.maximoDeServicios)" />
        <app-selector-multiple [identificador]="prefijo() + '-instrumentos'" [etiqueta]="'Instrumentos (hasta ' + t.maximoDeInstrumentos + ')'" [opciones]="opciones(ofrecidos(t.instrumentos, valor().instrumentos))" [seleccionados]="ids(valor().instrumentos, ofrecidos(t.instrumentos, valor().instrumentos))" (alternar)="alternar('instrumentos', ofrecidos(t.instrumentos, valor().instrumentos), $event, t.maximoDeInstrumentos)" />
        <app-selector-multiple [identificador]="prefijo() + '-territorios'" [etiqueta]="'Departamentos donde actúas (hasta ' + t.maximoDeTerritorios + ')'" [opciones]="opcionesDeDepartamentos()" [seleccionados]="idsDeDepartamentos()" (alternar)="alternarDepartamento($event, t.maximoDeTerritorios)" />
      </div>
      @if (aviso()) { <p role="alert" class="mt-2 text-sm text-red-700" data-aviso-de-maximo>{{ aviso() }}</p> }
    }
  `,
})
export class SelectorDeCategoriasComponent implements OnInit {
  private readonly servicio = inject(DirectorioDePersonasService);

  /** Distingue los `id` si hay dos en la misma página. */
  readonly prefijo = input('categorias');
  readonly departamentos = input<{ codigo: string; nombre: string }[]>([]);
  readonly valor = model<CambiosDeClasificacion>(CATEGORIAS_VACIAS);

  readonly taxonomia = signal<TaxonomiaDePerfiles | null>(null);
  readonly aviso = signal('');

  ngOnInit(): void {
    this.servicio.taxonomia().subscribe({ next: t => this.taxonomia.set(t), error: () => this.aviso.set('No fue posible cargar las categorías.') });
  }

  /**
   * Lo que se ofrece: lo activo, más lo que la persona ya tiene aunque se haya desactivado (decisión 133). Así un valor
   * retirado del catálogo no desaparece de un perfil que lo tenía ni se pierde al guardar; solo no se ofrece a nadie más.
   */
  ofrecidos(valores: ValorDeTaxonomia[], elegidos: string[]): ValorDeTaxonomia[] {
    return valores.filter(v => v.activo !== false || elegidos.includes(v.codigo));
  }

  /** Los roles en árbol: subcategorías agrupadas bajo su categoría (decisión 135). */
  roles(t: TaxonomiaDePerfiles): RolElegible[] {
    return rolesElegibles(t, this.valor().roles);
  }

  opciones(valores: (ValorDeTaxonomia & { categoria?: string | null })[]): OpcionSeleccionable[] {
    return valores.map((v, i) => ({ id: i + 1, nombre: v.nombre, grupo: v.categoria ?? null }));
  }

  ids(elegidos: string[], valores: ValorDeTaxonomia[]): number[] {
    return valores.flatMap((v, i) => (elegidos.includes(v.codigo) ? [i + 1] : []));
  }

  alternar(campo: 'roles' | 'servicios' | 'instrumentos', valores: ValorDeTaxonomia[], id: number, maximo: number): void {
    this.cambiar(campo, valores[id - 1]?.codigo, maximo);
  }

  opcionesDeDepartamentos(): OpcionSeleccionable[] {
    return this.departamentos().map((d, i) => ({ id: i + 1, nombre: d.nombre }));
  }

  idsDeDepartamentos(): number[] {
    return this.departamentos().flatMap((d, i) => (this.valor().codigosDeDepartamento.includes(d.codigo) ? [i + 1] : []));
  }

  alternarDepartamento(id: number, maximo: number): void {
    this.cambiar('codigosDeDepartamento', this.departamentos()[id - 1]?.codigo, maximo);
  }

  private cambiar(campo: keyof CambiosDeClasificacion, codigo: string | undefined, maximo: number): void {
    if (!codigo) return;
    const actuales = this.valor()[campo];
    if (actuales.includes(codigo)) { this.aviso.set(''); this.valor.set({ ...this.valor(), [campo]: actuales.filter(c => c !== codigo) }); return; }
    if (actuales.length >= maximo) { this.aviso.set(`Puedes elegir como máximo ${maximo}.`); return; }
    this.aviso.set('');
    this.valor.set({ ...this.valor(), [campo]: [...actuales, codigo] });
  }
}
