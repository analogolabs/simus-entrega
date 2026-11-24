import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowDown, LucideArrowUp } from '@lucide/angular';

import { BarraDeListaComponent } from '../../../shared/components/ui/barra-de-lista/barra-de-lista.component';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { DialogoDeFormularioComponent } from '../../../shared/components/ui/dialogo-de-formulario/dialogo-de-formulario.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import {
  DimensionDePerfil,
  TaxonomiaDePerfilesAdminService,
  ValorDeTaxonomiaAdministrado,
} from '../../../core/services/taxonomia-de-perfiles-admin.service';

interface FormularioDeValor {
  id: number | null;
  nombre: string;
  grupoSoyCultura: string;
  fuente: string;
  activo: boolean;
  /** Solo roles: id de la categoría ('' es una categoría o un valor sin jerarquía). */
  categoria: string;
}

/** Una fila de la tabla: en roles, las categorías con sus subcategorías debajo (decisión 135). */
interface FilaDeValor {
  valor: ValorDeTaxonomiaAdministrado;
  nivel: 0 | 1;
  /** Primero y último ENTRE SUS HERMANAS: el orden es dentro de cada categoría. */
  primero: boolean;
  ultimo: boolean;
}

const ROTULOS: Record<DimensionDePerfil, { plural: string; singular: string }> = {
  rol: { plural: 'Roles', singular: 'rol' },
  servicio: { plural: 'Servicios', singular: 'servicio' },
  instrumento: { plural: 'Instrumentos', singular: 'instrumento' },
};

/**
 * Las listas con las que una persona se clasifica y con las que otras la buscan en el directorio: roles, servicios e
 * instrumentos (decisión 133, DIR). Antes eran constantes del código; ahora se administran aquí, como las categorías.
 *
 * <b>NADA SE BORRA, SE DESACTIVA.</b> Un valor desactivado deja de ofrecerse a quien elige, pero los perfiles que ya
 * lo tienen lo conservan y se siguen encontrando por él. La fila dice cuántos perfiles lo tienen antes de desactivarlo.
 * El código se genera del nombre y no cambia al renombrar.
 *
 * <b>LOS ROLES SON UN ÁRBOL DE DOS NIVELES</b> (decisión 135): categorías con sus subcategorías debajo. Se ordena dentro de
 * cada categoría, se añade una subcategoría desde la fila de su categoría y se cambia de categoría desde «Editar».
 */
@Component({
  selector: 'app-admin-taxonomia-de-perfiles',
  standalone: true,
  imports: [
    FormsModule, LucideArrowUp, LucideArrowDown, BarraDeListaComponent, BotonComponent, CampoDeSeleccionComponent,
    DialogoDeFormularioComponent, EstadoDeListaComponent, IndicadorDeEstadoComponent, SelectorSegmentadoComponent,
  ],
  template: `
    <app-selector-segmentado
      [opciones]="pestanas()"
      [elegida]="dimension()"
      etiquetaDelGrupo="Listas de perfiles de personas"
      (elegir)="dimension.set($any($event))"></app-selector-segmentado>

    @if (aviso()) { <p class="mt-5 text-cuerpo font-semibold text-verde-texto" role="status">{{ aviso() }}</p> }

    @if (cargando() && !cargado()) {
      <app-estado-de-lista tipo="cargando" titulo="Cargando las listas de perfiles" />
    } @else if (errorDeCarga()) {
      <app-estado-de-lista tipo="error" titulo="No fue posible leer las listas de perfiles" [detalle]="errorDeCarga()">
        <app-boton importancia="secundaria" tamano="menudo" (accion)="cargar()">Reintentar</app-boton>
      </app-estado-de-lista>
    } @else {
      <app-barra-de-lista>
        <p class="barra-de-lista__resumen">
          Con estas listas una persona se clasifica en su perfil y otras la encuentran en el directorio.
          Elige hasta {{ maximo() }} {{ rotulo().plural.toLowerCase() }}. Un valor desactivado deja de ofrecerse, pero los perfiles que ya lo tienen lo conservan.
        </p>
        <ng-container extremo>
          <app-boton importancia="principal" (accion)="nuevo()">Añadir {{ rotulo().singular }}</app-boton>
        </ng-container>
      </app-barra-de-lista>

      @if (error()) { <p class="mb-4 text-cuerpo font-semibold text-amber-800" role="alert">{{ error() }}</p> }

      @if (valores().length === 0) {
        <app-estado-de-lista
          [titulo]="'Todavía no hay ' + rotulo().plural.toLowerCase()"
          detalle="Añade el primero para que las personas puedan elegirlo en su perfil." />
      } @else {
        <div class="overflow-x-auto">
          <table class="tabla-administrativa">
            <thead class="tabla-administrativa__cabecera">
              <tr>
                <th scope="col">{{ rotulo().plural }}</th>
                <th scope="col">Estado</th>
                <th scope="col">Personas</th>
                <th scope="col">Orden</th>
                <th scope="col" class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (fila of filas(); track fila.valor.id) {
                @let valor = fila.valor;
                @let primero = fila.primero;
                @let ultimo = fila.ultimo;
                <tr class="tabla-administrativa__fila" [attr.data-nivel]="fila.nivel">
                  <td [class.pl-8]="fila.nivel === 1">
                    <span class="tabla-administrativa__principal">{{ fila.nivel === 1 ? '↳ ' : '' }}{{ valor.nombre }}</span>
                    @if (dimension() === 'rol') {
                      <span class="tabla-administrativa__secundaria">{{ fila.nivel === 1 ? 'Subcategoría' : valor.subcategorias > 0 ? 'Categoría · ' + valor.subcategorias + (valor.subcategorias === 1 ? ' subcategoría' : ' subcategorías') : 'Categoría sin subcategorías' }}</span>
                    }
                    <span class="tabla-administrativa__secundaria font-mono">{{ valor.codigo }}</span>
                    @if (valor.grupoSoyCultura) {
                      <span class="tabla-administrativa__secundaria">Grupo en Soy Cultura: {{ valor.grupoSoyCultura }}</span>
                    }
                    @if (valor.fuente) { <span class="tabla-administrativa__secundaria">{{ valor.fuente }}</span> }
                  </td>
                  <td>
                    <app-indicador-de-estado
                      [etiqueta]="valor.activo ? 'Se ofrece' : 'Desactivado'"
                      [tono]="valor.activo ? 'logrado' : 'cerrado'"
                      [conTexto]="true"></app-indicador-de-estado>
                  </td>
                  <td>
                    @if (fila.nivel === 0 && valor.subcategorias > 0) {
                      <span class="text-rotulo">En sus subcategorías</span>
                    } @else if (valor.personas === 0) {
                      <span class="text-rotulo">Sin personas</span>
                    } @else {
                      <span class="tabla-administrativa__cifra">{{ valor.personas }}</span>
                      <span class="tabla-administrativa__secundaria">{{ valor.personas === 1 ? 'perfil' : 'perfiles' }}</span>
                    }
                  </td>
                  <td>
                    <span class="flex items-center gap-1">
                      <app-boton importancia="terciaria" tamano="menudo" [deshabilitado]="primero || guardando()" etiqueta="Mover arriba" (accion)="mover(valor, -1)"><svg lucideArrowUp [size]="14" aria-hidden="true"></svg></app-boton>
                      <app-boton importancia="terciaria" tamano="menudo" [deshabilitado]="ultimo || guardando()" etiqueta="Mover abajo" (accion)="mover(valor, 1)"><svg lucideArrowDown [size]="14" aria-hidden="true"></svg></app-boton>
                    </span>
                  </td>
                  <td class="tabla-administrativa__acciones">
                    @if (dimension() === 'rol' && fila.nivel === 0) {
                      <app-boton importancia="terciaria" tamano="menudo" (accion)="nuevaSubcategoria(valor)">Añadir subcategoría</app-boton>
                    }
                    <app-boton importancia="secundaria" tamano="menudo" (accion)="editar(valor)">Editar</app-boton>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    @if (formulario(); as f) {
      <app-dialogo-de-formulario
        [titulo]="f.id === null ? 'Nuevo ' + rotulo().singular : 'Editar ' + rotulo().singular"
        [guardando]="guardando()"
        [error]="error()"
        identificador="guardar-valor-de-perfil"
        (guardar)="guardar()"
        (cerrar)="cerrar()">
        <label class="block campo__rotulo" for="valor-de-perfil-nombre">Nombre</label>
        <input id="valor-de-perfil-nombre" name="nombreValor" class="campo__control" [ngModel]="f.nombre" (ngModelChange)="campo('nombre', $event)" />
        @if (f.id !== null) {
          <small class="mt-1 block text-dato text-slate-400">Su código no cambia al renombrarlo: los perfiles lo guardan.</small>
        }

        @if (dimension() === 'rol') {
          <app-campo-de-seleccion class="mt-4 block" tamano="normal" etiqueta="Categoría" identificador="valor-de-perfil-categoria"
            name="categoriaDelRol" [ngModel]="f.categoria" (ngModelChange)="campo('categoria', $event)" [deshabilitado]="f.id !== null && tieneSubcategorias(f.id)">
            <option value="">Ninguna: es una categoría</option>
            @for (c of categorias(); track c.id) {
              @if (c.id !== f.id) { <option [value]="'' + c.id">{{ c.nombre }}</option> }
            }
          </app-campo-de-seleccion>
          @if (f.id !== null && tieneSubcategorias(f.id)) {
            <small class="mt-1 block text-dato text-slate-400">Tiene subcategorías: no puede pasar a ser subcategoría de otra.</small>
          }
          <app-campo-de-seleccion class="mt-4 block" tamano="normal" etiqueta="Grupo en Soy Cultura" identificador="valor-de-perfil-grupo"
            name="grupoSoyCultura" [ngModel]="f.grupoSoyCultura" (ngModelChange)="campo('grupoSoyCultura', $event)">
            <option value="">Sin indicar</option>
            <option value="creador">Creador</option>
            <option value="gestor">Gestor</option>
            <option value="otro">Otro</option>
          </app-campo-de-seleccion>
        }

        <label class="mt-4 block campo__rotulo" for="valor-de-perfil-fuente">Fuente <span class="font-normal normal-case tracking-normal text-slate-400">(opcional)</span></label>
        <input id="valor-de-perfil-fuente" name="fuenteValor" class="campo__control" [ngModel]="f.fuente" (ngModelChange)="campo('fuente', $event)" />

        <label class="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 p-3">
          <input type="checkbox" name="activoValor" class="mt-0.5 accent-morado" [ngModel]="f.activo" (ngModelChange)="campo('activo', $event)" />
          <span class="text-dato leading-relaxed text-slate-600">
            Se ofrece al elegir. Si se desmarca, deja de ofrecerse, pero las personas que ya lo tienen lo conservan.
          </span>
        </label>
      </app-dialogo-de-formulario>
    }
  `,
})
export class AdminTaxonomiaDePerfilesComponent {
  private readonly api = inject(TaxonomiaDePerfilesAdminService);

  readonly enabled = input(true);

  readonly dimension = signal<DimensionDePerfil>('rol');
  readonly todos = signal<ValorDeTaxonomiaAdministrado[]>([]);
  readonly maximos = signal<Record<DimensionDePerfil, number>>({ rol: 0, servicio: 0, instrumento: 0 });
  readonly cargando = signal(false);
  readonly cargado = signal(false);
  readonly errorDeCarga = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly formulario = signal<FormularioDeValor | null>(null);

  readonly valores = computed(() => this.todos().filter(v => v.dimension === this.dimension()));
  /** Las categorías de roles (los valores sin padre), para elegir de cuál es subcategoría un rol. */
  readonly categorias = computed(() => this.todos().filter(v => v.dimension === 'rol' && v.idPadre === null));

  /** En roles, en árbol; en las demás listas, plana. El orden de cada fila es entre sus hermanas. */
  readonly filas = computed<FilaDeValor[]>(() => {
    const ordenadas = [...this.valores()].sort((a, b) => a.ordenVisualizacion - b.ordenVisualizacion || a.nombre.localeCompare(b.nombre, 'es'));
    const hermanas = (padre: number | null) => ordenadas.filter(v => v.idPadre === padre);
    const fila = (valor: ValorDeTaxonomiaAdministrado, nivel: 0 | 1, lista: ValorDeTaxonomiaAdministrado[]): FilaDeValor =>
      ({ valor, nivel, primero: lista[0] === valor, ultimo: lista[lista.length - 1] === valor });
    const raices = hermanas(null);
    return raices.flatMap(raiz => {
      const hijas = hermanas(raiz.id);
      return [fila(raiz, 0, raices), ...hijas.map(h => fila(h, 1, hijas))];
    });
  });
  readonly rotulo = computed(() => ROTULOS[this.dimension()]);
  readonly maximo = computed(() => this.maximos()[this.dimension()]);

  readonly pestanas = computed<readonly OpcionSegmentada[]>(() =>
    (Object.keys(ROTULOS) as DimensionDePerfil[]).map(d => ({
      id: d, etiqueta: ROTULOS[d].plural, conteo: this.todos().filter(v => v.dimension === d).length,
    })));

  constructor() {
    effect(() => {
      if (!this.enabled()) { return; }
      untracked(() => { void this.cargar(); });
    });
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorDeCarga.set(null);
    const resultado = await this.api.listar();
    if (resultado.ok && resultado.data) {
      this.todos.set(resultado.data.items);
      this.maximos.set(resultado.data.maximos);
      this.cargado.set(true);
    } else {
      this.errorDeCarga.set(resultado.error ?? 'No fue posible consultar las listas de perfiles.');
    }
    this.cargando.set(false);
  }

  nuevo(): void {
    this.aviso.set(null);
    this.error.set(null);
    this.formulario.set({ id: null, nombre: '', grupoSoyCultura: '', fuente: '', activo: true, categoria: '' });
  }

  /** Una subcategoría nueva dentro de una categoría: hereda su grupo en Soy Cultura como punto de partida. */
  nuevaSubcategoria(categoria: ValorDeTaxonomiaAdministrado): void {
    this.aviso.set(null);
    this.error.set(null);
    this.formulario.set({ id: null, nombre: '', grupoSoyCultura: categoria.grupoSoyCultura ?? '', fuente: '', activo: true, categoria: String(categoria.id) });
  }

  tieneSubcategorias(id: number): boolean {
    return (this.todos().find(v => v.id === id)?.subcategorias ?? 0) > 0;
  }

  editar(valor: ValorDeTaxonomiaAdministrado): void {
    this.aviso.set(null);
    this.error.set(null);
    this.formulario.set({
      id: valor.id, nombre: valor.nombre, grupoSoyCultura: valor.grupoSoyCultura ?? '', fuente: valor.fuente ?? '', activo: valor.activo,
      categoria: valor.idPadre === null ? '' : String(valor.idPadre),
    });
  }

  cerrar(): void { this.formulario.set(null); }

  campo<K extends keyof FormularioDeValor>(clave: K, valor: FormularioDeValor[K]): void {
    const actual = this.formulario();
    if (actual) { this.formulario.set({ ...actual, [clave]: valor }); }
  }

  async guardar(): Promise<void> {
    const f = this.formulario();
    if (!f) { return; }
    const nombre = f.nombre.trim();
    if (!nombre) { this.error.set('Escribe el nombre.'); return; }

    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    const cambios = {
      nombre,
      grupoSoyCultura: this.dimension() === 'rol' && f.grupoSoyCultura ? f.grupoSoyCultura : null,
      fuente: f.fuente.trim() || null,
      activo: f.activo,
    };
    const idPadre = this.dimension() === 'rol' && f.categoria ? Number(f.categoria) : null;
    try {
      let resultado = f.id === null
        ? await this.api.crear({ ...cambios, dimension: this.dimension(), idPadre })
        : await this.api.guardar(f.id, cambios);
      // Cambiar de categoría va aparte de guardar: renombrar no mueve el rol de lugar.
      const actual = f.id === null ? null : this.todos().find(v => v.id === f.id);
      if (resultado.ok && f.id !== null && this.dimension() === 'rol' && actual && actual.idPadre !== idPadre) {
        resultado = await this.api.cambiarDeCategoria(f.id, idPadre);
      }
      if (resultado.ok) {
        this.aviso.set(f.id === null ? `«${nombre}» quedó disponible.` : `«${nombre}» quedó guardado.`);
        this.formulario.set(null);
        await this.cargar();
      } else {
        this.error.set(resultado.error ?? 'No fue posible guardar el valor.');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  async mover(valor: ValorDeTaxonomiaAdministrado, sentido: -1 | 1): Promise<void> {
    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      const resultado = await this.api.mover(valor.id, sentido);
      if (!resultado.ok) { this.error.set(resultado.error ?? 'No fue posible reordenar.'); }
      await this.cargar();
    } finally {
      this.guardando.set(false);
    }
  }
}
