import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import * as MapDomain from '../../domain/map-domain';
import { nombrePropio } from '../../../../shared/texto/nombre-propio';
import {
  EjeDeBarras, EjeDeMatriz, FiltrosDelAnalisis, RegistroAnalitico, RegistroCrudo, SIN_FILTROS, barrasApiladas, construirRegistros, diagramaAluvial,
  filtrarRegistros, jerarquia, matrizDeCoincidencias, nombreDeNodo, tiposPresentes,
} from '../../domain/analisis-avanzado';
import { fichaDelIndicador } from '../../domain/indicadores-del-tablero';
import {
  opcionAluvial, opcionBarrasApiladas, opcionJerarquia, opcionMatriz,
} from '../../domain/opciones-del-analisis';
import { PestanaDeAnalisis, pestanasConTextos } from '../../domain/pestanas-del-tablero';
import { ChipDeFiltroComponent } from '../../../../shared/components/ui/chip-de-filtro/chip-de-filtro.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { clasesDeChip } from './clases-de-chip';
import { GraficoDelTableroComponent, MarcaElegida } from './grafico-del-tablero.component';
import { FilaDeDatos, PanelDeGraficoComponent } from './panel-de-grafico.component';
import { RedDeRelacionesComponent } from './red-de-relaciones.component';

type ParDeEjes = 'practicas-territorios' | 'practicas-departamentos' | 'territorios-departamentos';

/** Lo que el tablero entrega al análisis: las listas públicas por capa y departamento, tal como las usa el mapa. */
export type FuentesDelAnalisis = readonly (readonly [string, Readonly<Record<string, readonly RegistroCrudo[]>>])[];

/**
 * Las PESTAÑAS DE ANÁLISIS del tablero del ecosistema: Flujos, Redes, Coincidencias, Barras y Jerarquías
 * (decisión del usuario, puntos 89 a 93 de los comentarios del mapa). Una visualización por pestaña; el
 * «Panel general» vive en la página y lleva aquí con sus preguntas orientadoras.
 *
 * <b>SE CARGA BAJO DEMANDA</b> (`import()` desde la página del mapa): el bundle inicial no lo paga. Recibe las
 * mismas listas públicas que ya usa el mapa; cada visualización cuenta registros publicados, lleva su ficha
 * de indicador, su TABLA equivalente (botón «Ver tabla»), su CSV y respeta el filtro por tipo de proceso.
 *
 * <b>VISTAS COORDINADAS.</b> Los filtros (tipo de proceso, departamento, práctica, territorio sonoro) los guarda
 * la PÁGINA y llegan por `filtros`: recortan todas las pestañas, pulsar una marca los escribe y cambiar de
 * pestaña los conserva, también al volver al Panel general y regresar.
 */
@Component({
  selector: 'app-analisis-avanzado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipDeFiltroComponent, SelectorSegmentadoComponent, GraficoDelTableroComponent, PanelDeGraficoComponent, RedDeRelacionesComponent],
  styles: [':host { display: block; min-width: 0; }'],
  template: `
    <div data-testid="tablero-avanzado" [attr.data-pestana]="vista()">
      <!-- La pestaña dice qué responde, en una frase. -->
      <p class="mt-4 text-dato text-slate-700" data-testid="pestana-responde"><span class="font-bold text-morado">{{ datosDeLaPestana().nombre }}.</span> {{ datosDeLaPestana().responde }}</p>

      <!-- EL FILTRO POR TIPO DE PROCESO: el mismo en todas las pestañas. -->
      <section class="mt-4" aria-labelledby="tipos-titulo">
        <h3 id="tipos-titulo" class="text-dato font-bold text-rotulo">Tipo de proceso</h3>
        <div class="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de proceso">
          <button type="button" [class]="clasesDeChip(filtros().tipos.length === 0)" [attr.aria-pressed]="filtros().tipos.length === 0"
            (click)="poner({ tipos: [] })">Todos ({{ todos().length }})</button>
          @for (tipo of tiposDelUniverso(); track tipo.nombre) {
            <button type="button" [class]="clasesDeChip(filtros().tipos.includes(tipo.nombre))" [attr.aria-pressed]="filtros().tipos.includes(tipo.nombre)"
              (click)="alternarTipo(tipo.nombre)">
              <span class="inline-block h-2 w-2 shrink-0 rounded-full" [style.background-color]="colorDelTipo(tipo.nombre)" aria-hidden="true"></span>
              {{ tipo.nombre }} ({{ tipo.total }})
            </button>
          }
        </div>
      </section>

      @if (chipsDeFiltros().length > 0) {
        <div class="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filtros elegidos en el análisis">
          <span class="text-dato font-bold text-slate-600">Mostrando</span>
          @for (chip of chipsDeFiltros(); track chip.clave) {
            <app-chip-de-filtro [rotulo]="chip.rotulo" [valor]="chip.valor" (quitar)="quitar(chip.clave)" />
          }
        </div>
      } @else {
        <p class="mt-3 text-dato text-slate-600">Pulsa una barra, un nodo o una celda para filtrar todas las vistas; vuelve a pulsarla para quitar el filtro.</p>
      }

      @if (vista() === 'redes') {
        <div class="mt-5">
          <app-red-de-relaciones [filtros]="filtros()" [animar]="animar()" [alElegirFiltro]="alElegirFiltro" />
        </div>
      } @else if (registros().length === 0) {
        <p class="mt-4 rounded-md bg-slate-50 px-3 py-8 text-center text-dato font-bold text-rotulo" data-testid="avanzado-vacio">
          Sin registros con estos filtros
        </p>
      } @else {
        <div class="mt-5">
          @switch (vista()) {
            @case ('barras') {
              <app-panel-de-grafico idDelTitulo="av-barras" [ficha]="fichas.barras" [filtros]="textoDeFiltros()" [pregunta]="datosDeLaPestana().pregunta"
                [titulo]="'Registros por ' + rotuloDelEjeDeBarras() + ' y tipo de proceso'"
                lectura="La longitud total es la cantidad; el color, el tipo de proceso. Pulsa una barra para filtrar todas las vistas."
                [encabezados]="[rotuloDelEjeDeBarras()[0].toUpperCase() + rotuloDelEjeDeBarras().slice(1), 'Registros']" [filas]="filasDeBarras()"
                [elegible]="true" [seleccion]="seleccionDeBarras()" (elegir)="alternarEnBarras($event)">
                <app-selector-segmentado etiquetaDelGrupo="Agrupar las barras por" [opciones]="opcionesDeEjeDeBarras" [elegida]="ejeDeBarras()" (elegir)="ejeDeBarras.set($any($event))" />
                <app-grafico-del-tablero class="mt-3" [style.height.px]="alturaDeBarras()" [opcion]="opcionDeBarras()"
                  [descripcion]="'Registros por ' + rotuloDelEjeDeBarras() + ' y tipo de proceso, de mayor a menor; hay una tabla equivalente con el botón Ver tabla'"
                  (elegida)="alElegirEnBarras($event)" />
                @if (datosDeBarras().ocultos > 0) {
                  <p class="mt-2 text-dato text-slate-600">Se muestran los {{ datosDeBarras().departamentos.length }} con más registros; hay {{ datosDeBarras().ocultos }} más.</p>
                }
                @if (ejeDeBarras() !== 'departamentos') {
                  <p class="mt-2 text-dato text-slate-600">Un registro que declara varios cuenta en todos: las barras suman más que los registros.</p>
                }
              </app-panel-de-grafico>
            }
            @case ('jerarquias') {
              <app-panel-de-grafico idDelTitulo="av-mosaico" [ficha]="fichas.mosaico" [filtros]="textoDeFiltros()" [pregunta]="datosDeLaPestana().pregunta"
                titulo="Tipo de proceso, departamento y práctica"
                lectura="El área es la cantidad. Pulsa un mosaico para entrar a su interior y usa la ruta de arriba para volver."
                [encabezados]="['Tipo de proceso', 'Departamento', 'Práctica', 'Declaraciones']" [filas]="filasDeMosaico()">
                <app-grafico-del-tablero style="height: 24rem" [opcion]="opcionDeMosaico()"
                  descripcion="Mosaico jerárquico de tipo de proceso, departamento y práctica; hay una tabla equivalente con el botón Ver tabla" />
              </app-panel-de-grafico>
            }
            @case ('flujos') {
              <app-panel-de-grafico idDelTitulo="av-flujo" [ficha]="fichas.flujo" [filtros]="textoDeFiltros()" [pregunta]="datosDeLaPestana().pregunta"
                titulo="Del tipo de proceso al departamento y a la práctica"
                lectura="El grosor de cada banda es cuántos registros siguen ese camino. Es un reparto, no un movimiento. Pulsa un nodo para filtrar."
                [encabezados]="['Desde', 'Hacia', 'Registros']" [filas]="filasDeFlujo()">
                <app-grafico-del-tablero [style.height.px]="alturaDeFlujo()" [opcion]="opcionDeFlujo()"
                  descripcion="Diagrama aluvial de tipo de proceso, departamento y práctica principal; hay una tabla equivalente con el botón Ver tabla"
                  (elegida)="alElegirEnFlujo($event)" />
              </app-panel-de-grafico>
            }
            @case ('coincidencias') {
              <app-panel-de-grafico idDelTitulo="av-matriz" [ficha]="fichas.matriz" [filtros]="textoDeFiltros()" [pregunta]="datosDeLaPestana().pregunta"
                titulo="Coincidencias entre dos clasificaciones"
                lectura="Cada celda cuenta los registros que declaran a la vez el valor de la fila y el de la columna. Pulsa una celda para filtrar por ambos."
                [encabezados]="[rotuloDelEje(ejesDeLaMatriz().filas), rotuloDelEje(ejesDeLaMatriz().columnas), 'Registros']" [filas]="filasDeMatriz()">
                <app-selector-segmentado etiquetaDelGrupo="Ejes de la matriz" [opciones]="opcionesDeEjes" [elegida]="parDeEjes()" (elegir)="parDeEjes.set($any($event))" />
                @if (datosDeMatriz().celdas.length === 0) {
                  <p class="mt-3 rounded-md bg-slate-50 px-3 py-8 text-center text-dato font-bold text-rotulo">Sin coincidencias que mostrar</p>
                } @else {
                  <app-grafico-del-tablero class="mt-3" [style.height.px]="alturaDeMatriz()" [opcion]="opcionDeMatriz()"
                    descripcion="Matriz de coincidencias entre dos clasificaciones; hay una tabla equivalente con el botón Ver tabla"
                    (elegida)="alElegirEnMatriz($event)" />
                }
              </app-panel-de-grafico>
            }
          }
        </div>
        <p class="mt-4 text-dato text-slate-600">
          {{ registros().length }} de {{ todos().length }} registros publicados. Son registros de la plataforma, no el universo de procesos del país;
          «Sin declarar» es el dato que falta, no una categoría real.
        </p>
      }
    </div>
  `,
})
export class AnalisisAvanzadoComponent {
  /** Las listas públicas por capa (tipo de proceso) y departamento, las mismas del mapa. */
  readonly fuentes = input.required<FuentesDelAnalisis>();
  /** El color de cada tipo de proceso (el de su capa en el mapa). */
  readonly colores = input<Readonly<Record<string, string>>>({});
  readonly animar = input(true);
  /** La pestaña que se ve; la elige la página. */
  readonly vista = input<PestanaDeAnalisis>('flujos');
  /** Los filtros compartidos entre pestañas: los guarda la página para que sobrevivan al cambio de pestaña. */
  readonly filtrosDeLaPagina = input<FiltrosDelAnalisis>(SIN_FILTROS);
  /** Cómo se escribe un cambio en los filtros compartidos. Sin él, el componente guarda los suyos (pruebas aisladas). */
  readonly alCambiarFiltros = input<((cambio: Partial<FiltrosDelAnalisis>) => void) | null>(null);

  protected readonly clasesDeChip = clasesDeChip;
  protected readonly fichas = {
    barras: fichaDelIndicador('avanzado-barras'),
    mosaico: fichaDelIndicador('avanzado-mosaico'),
    flujo: fichaDelIndicador('avanzado-flujo'),
    matriz: fichaDelIndicador('avanzado-matriz'),
  };
  protected readonly opcionesDeEjes: readonly OpcionSegmentada[] = [
    { id: 'practicas-territorios', etiqueta: 'Práctica × territorio' },
    { id: 'practicas-departamentos', etiqueta: 'Práctica × departamento' },
    { id: 'territorios-departamentos', etiqueta: 'Territorio × departamento' },
  ];
  protected readonly opcionesDeEjeDeBarras: readonly OpcionSegmentada[] = [
    { id: 'departamentos', etiqueta: 'Departamento' },
    { id: 'practicas', etiqueta: 'Práctica' },
    { id: 'territorios', etiqueta: 'Territorio sonoro' },
  ];

  readonly parDeEjes = signal<ParDeEjes>('practicas-territorios');
  readonly ejeDeBarras = signal<EjeDeBarras>('departamentos');

  private readonly textosWeb = inject(TextosWebService);
  protected readonly datosDeLaPestana = computed(() => {
    const pestanas = pestanasConTextos((clave) => this.textosWeb.getWebText(clave));
    return pestanas.find((p) => p.id === this.vista()) ?? pestanas[1];
  });

  // — Filtros coordinados (los guarda la página; aquí se leen y se piden cambios) —
  private readonly propios = signal<FiltrosDelAnalisis>(SIN_FILTROS);
  readonly filtros = computed(() => (this.alCambiarFiltros() ? this.filtrosDeLaPagina() : this.propios()));
  /** Lo que se le pasa a la red para que un nodo pueda escribir un filtro compartido. */
  protected readonly alElegirFiltro = (cambio: Partial<FiltrosDelAnalisis>): void => this.poner(cambio);

  /** Todos los registros publicados, sin filtro: el universo contra el que se cuenta «x de y». */
  protected readonly todos = computed<RegistroAnalitico[]>(() => construirRegistros(
    this.fuentes() as never,
    (nombre) => nombrePropio(MapDomain.getDepartmentDisplayName(nombre)),
  ));
  protected readonly tiposDelUniverso = computed(() => tiposPresentes(this.todos()));
  protected readonly registros = computed(() => filtrarRegistros(this.todos(), this.filtros()));

  protected colorDelTipo = (tipo: string): string => this.colores()[tipo] ?? '#6d4a7b';

  poner(cambio: Partial<FiltrosDelAnalisis>): void {
    const escribir = this.alCambiarFiltros();
    if (escribir) escribir(cambio);
    else this.propios.update((actual) => ({ ...actual, ...cambio }));
  }
  alternarTipo(tipo: string): void {
    const tipos = this.filtros().tipos;
    this.poner({ tipos: tipos.includes(tipo) ? tipos.filter((t) => t !== tipo) : [...tipos, tipo] });
  }
  alternarDepartamento(departamento: string): void { this.alternar('departamento', departamento); }
  private alternar(clave: 'practica' | 'territorio' | 'departamento', valor: string): void {
    this.poner({ [clave]: this.filtros()[clave] === valor ? '' : valor });
  }
  quitar(clave: string): void {
    if (clave === 'tipos') this.poner({ tipos: [] });
    else this.poner({ [clave]: '' });
  }
  protected readonly chipsDeFiltros = computed(() => {
    const f = this.filtros();
    const chips: { clave: string; rotulo: string; valor: string }[] = [];
    if (f.tipos.length > 0) chips.push({ clave: 'tipos', rotulo: 'Tipo', valor: f.tipos.join(', ') });
    if (f.departamento) chips.push({ clave: 'departamento', rotulo: 'Departamento', valor: f.departamento });
    if (f.practica) chips.push({ clave: 'practica', rotulo: 'Práctica', valor: f.practica });
    if (f.territorio) chips.push({ clave: 'territorio', rotulo: 'Territorio sonoro', valor: f.territorio });
    return chips;
  });
  protected readonly textoDeFiltros = computed(() => this.chipsDeFiltros().map((c) => `${c.rotulo}: ${c.valor}`));

  // — Barras apiladas —
  protected readonly datosDeBarras = computed(() => barrasApiladas(this.registros(), 12, this.ejeDeBarras()));
  protected readonly claveDeFiltroDelEje = computed<'departamento' | 'practica' | 'territorio'>(() =>
    this.ejeDeBarras() === 'practicas' ? 'practica' : this.ejeDeBarras() === 'territorios' ? 'territorio' : 'departamento');
  protected readonly seleccionDeBarras = computed(() => this.filtros()[this.claveDeFiltroDelEje()]);
  protected readonly rotuloDelEjeDeBarras = computed(() =>
    this.ejeDeBarras() === 'practicas' ? 'práctica' : this.ejeDeBarras() === 'territorios' ? 'territorio sonoro' : 'departamento');
  protected readonly opcionDeBarras = computed(() => opcionBarrasApiladas(this.datosDeBarras(), {
    colorDelTipo: this.colorDelTipo, seleccion: this.seleccionDeBarras(), animar: this.animar(),
  }));
  protected readonly alturaDeBarras = computed(() => Math.max(200, this.datosDeBarras().departamentos.length * 30 + 48));
  protected readonly filasDeBarras = computed<FilaDeDatos[]>(() => {
    const d = this.datosDeBarras();
    return d.departamentos.map((nombre, i) => ({ clave: nombre, celdas: [nombre, d.totales[i]] }));
  });
  alternarEnBarras(nombre: string): void { this.alternar(this.claveDeFiltroDelEje(), nombre); }
  alElegirEnBarras(marca: MarcaElegida): void {
    if (marca.nombre) this.alternarEnBarras(marca.nombre);
  }

  // — Jerarquías (mosaico) —
  protected readonly arbol = computed(() => jerarquia(this.registros()));
  protected readonly opcionDeMosaico = computed(() => opcionJerarquia(this.arbol(), { colorDelTipo: this.colorDelTipo, animar: this.animar() }));
  protected readonly filasDeMosaico = computed<FilaDeDatos[]>(() => this.arbol().flatMap((tipo) =>
    (tipo.children ?? []).flatMap((departamento) => (departamento.children && departamento.children.length > 0
      ? departamento.children.map((practica) => [tipo.name, departamento.name, practica.name, practica.value] as const)
      : [[tipo.name, departamento.name, '—', departamento.value] as const]))
  ).map((celdas, i) => ({ clave: String(i), celdas })));

  // — Flujos (aluvial) —
  protected readonly aluvial = computed(() => diagramaAluvial(this.registros()));
  protected readonly opcionDeFlujo = computed(() => opcionAluvial(this.aluvial(), {
    colorDelTipo: this.colorDelTipo, animar: this.animar(),
    seleccion: this.filtros().departamento || this.filtros().practica || undefined,
  }));
  protected readonly alturaDeFlujo = computed(() => Math.max(260, Math.max(...[0, 1, 2].map((p) => this.aluvial().nodos.filter((n) => n.profundidad === p).length)) * 34 + 24));
  protected readonly filasDeFlujo = computed<FilaDeDatos[]>(() =>
    this.aluvial().enlaces.map((e, i) => ({ clave: String(i), celdas: [nombreDeNodo(e.source), nombreDeNodo(e.target), e.value] })));
  alElegirEnFlujo(marca: MarcaElegida): void {
    const nombre = marca.nombre;
    if (!/^[tdp]:/.test(nombre) || nombre.includes(' > ')) return; // una banda no es un filtro: lo es cada extremo
    const valor = nombreDeNodo(nombre);
    if (valor === 'Otros') return;
    if (nombre.startsWith('t:')) this.alternarTipo(valor);
    else if (nombre.startsWith('d:')) this.alternar('departamento', valor);
    else this.alternar('practica', valor);
  }

  // — Coincidencias (matriz) —
  protected readonly ejesDeLaMatriz = computed<{ filas: EjeDeMatriz; columnas: EjeDeMatriz }>(() => {
    const [filas, columnas] = this.parDeEjes().split('-') as [EjeDeMatriz, EjeDeMatriz];
    return { filas, columnas };
  });
  protected readonly datosDeMatriz = computed(() => matrizDeCoincidencias(this.registros(), this.ejesDeLaMatriz().filas, this.ejesDeLaMatriz().columnas));
  protected readonly opcionDeMatriz = computed(() => opcionMatriz(this.datosDeMatriz(), { color: this.colorDelTipo('Festivales'), animar: this.animar() }));
  protected readonly alturaDeMatriz = computed(() => Math.max(240, this.datosDeMatriz().filas.length * 32 + 110));
  protected rotuloDelEje = (eje: EjeDeMatriz): string => (eje === 'practicas' ? 'Práctica' : eje === 'territorios' ? 'Territorio sonoro' : 'Departamento');
  protected readonly filasDeMatriz = computed<FilaDeDatos[]>(() => {
    const m = this.datosDeMatriz();
    return [...m.celdas].sort((a, b) => b[2] - a[2]).map(([c, f, valor], i) => ({ clave: String(i), celdas: [m.filas[f], m.columnas[c], valor] }));
  });
  alElegirEnMatriz(marca: MarcaElegida): void {
    const valor = marca.valor;
    if (!Array.isArray(valor)) return;
    const m = this.datosDeMatriz();
    const { filas, columnas } = this.ejesDeLaMatriz();
    const claveDe = (eje: EjeDeMatriz): 'practica' | 'territorio' | 'departamento' =>
      eje === 'practicas' ? 'practica' : eje === 'territorios' ? 'territorio' : 'departamento';
    const fila = m.filas[Number(valor[1])];
    const columna = m.columnas[Number(valor[0])];
    if (fila === undefined || columna === undefined) return;
    const yaElegida = this.filtros()[claveDe(filas)] === fila && this.filtros()[claveDe(columnas)] === columna;
    this.poner({ [claveDe(filas)]: yaElegida ? '' : fila, [claveDe(columnas)]: yaElegida ? '' : columna });
  }
}
