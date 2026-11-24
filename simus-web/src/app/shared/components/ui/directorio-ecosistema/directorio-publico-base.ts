import { computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CANTIDADES_POR_PAGINA, enlazarFiltrosConLaUrl, filtroDeCantidad, filtroDePagina } from '../../../utils/filtros-en-la-url';

import { NombrePropioPipe } from '../../../texto/nombre-propio.pipe';
import { VistaEcosistema } from '../barra-exploracion-ecosistema/barra-exploracion-ecosistema.component';
import { MetricaEcosistema } from '../franja-metricas-ecosistema/franja-metricas-ecosistema.component';
import { FiltroDeDirectorio, OrdenDeDirectorio } from './directorio-ecosistema.component';

/** Cuántos caben en una página del directorio de partida. El mismo número que usan Festivales y Mercados. */
export const POR_PAGINA_DEL_DIRECTORIO = CANTIDADES_POR_PAGINA[0];

/** Lo que tiene en común cualquier registro de un directorio con territorio. */
export interface RegistroConTerritorio {
  id: number;
  nombre: string;
  descripcion: string | null;
  nivelCobertura: string;
  nombreDepartamento: string | null;
  nombreMunicipio: string | null;
  organizacionNombre: string | null;
  /** Las prácticas musicales del registro (etiquetas clicables que filtran). */
  practicasMusicales?: readonly { id: number | string; nombre: string }[];
  /** Los territorios sonoros del registro, cuando el proceso los declara. */
  territoriosSonoros?: readonly { id: number | string; nombre: string }[];
}

/** Quita tildes y pasa a minúscula: la búsqueda no distingue «Pacífico» de «pacifico». */
export function sinTildes(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Dónde ocurre, dicho en una línea y según su nivel de cobertura. */
export function dondeEstaRegistro(registro: RegistroConTerritorio): string {
  if (registro.nivelCobertura === 'nacional') return 'Todo el país';
  return [registro.nombreMunicipio, registro.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
}

/**
 * La lógica común de los directorios públicos de proceso (Lutería, Espacios, Redes y documentación).
 *
 * <b>EL FILTRO Y EL ORDEN SE RESUELVEN EN MEMORIA, y aquí es correcto.</b> El directorio trae de una
 * vez todo lo publicado —igual que el de Mercados y que el geovisor—, así que filtrar y ordenar en
 * memoria actúa sobre TODOS los registros; la paginación es solo de pintado.
 *
 * <b>CADA CAMBIO VUELVE A LA PRIMERA PÁGINA:</b> quedarse en la página 4 de una consulta que ahora
 * tiene dos resultados enseña una lista vacía sobre un directorio que sí tiene registros.
 *
 * Cada proceso aporta lo suyo: qué texto se busca, sus filtros propios y la cuarta cifra de la
 * franja. Territorio (departamento y municipio), búsqueda, orden, vista y paginación son comunes.
 */
export abstract class DirectorioPublicoBase<T extends RegistroConTerritorio> {
  protected readonly nombrePropio = new NombrePropioPipe();

  readonly lista = signal<T[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');

  readonly busqueda = signal('');
  readonly departamento = signal('');
  readonly municipio = signal('');
  /** Filtros por clasificación (`?practica=`, `?territorio=`): las etiquetas de un registro filtran el listado y vienen de la URL. */
  readonly practica = signal('');
  readonly territorioSonoro = signal('');
  readonly orden = signal<'nombre' | 'territorio'>('nombre');
  readonly vista = signal<VistaEcosistema>('listado');
  readonly pagina = signal(1);
  /** Cuántos registros por página (`?por=`): el selector común de la paginación. */
  readonly porPagina = signal(POR_PAGINA_DEL_DIRECTORIO);
  readonly cantidadesPorPagina = CANTIDADES_POR_PAGINA;

  /** La página y la cantidad viajan en la URL (`?pagina=`, `?por=`): recargar o compartir conserva lo que se veía. */
  private readonly rutaActiva = inject(ActivatedRoute, { optional: true });

  constructor() {
    const parametros = this.rutaActiva?.snapshot?.queryParamMap;
    this.practica.set(parametros?.get('practica') ?? '');
    this.territorioSonoro.set(parametros?.get('territorio') ?? '');
    enlazarFiltrosConLaUrl([filtroDePagina(this.pagina), filtroDeCantidad(this.porPagina)]);
  }

  readonly ordenes: readonly OrdenDeDirectorio[] = [
    { valor: 'nombre', etiqueta: 'Nombre (A–Z)' },
    { valor: 'territorio', etiqueta: 'Territorio (A–Z)' },
  ];

  /** El texto donde busca la búsqueda libre. */
  protected abstract textoDeBusqueda(registro: T): string;
  /** Los filtros propios del proceso, ya con valor y opciones. */
  protected abstract filtrosPropios(): FiltroDeDirectorio[];
  /** Si el registro cumple los filtros propios elegidos. */
  protected abstract cumpleFiltrosPropios(registro: T): boolean;
  /** Cuántos filtros propios hay puestos. */
  protected abstract propiosActivos(): number;
  /** Apaga los filtros propios. */
  protected abstract limpiarPropios(): void;
  /** Cambia un filtro propio; devuelve `false` si el `id` no es suyo. */
  protected abstract fijarPropio(id: string, valor: string): boolean;
  /** La cuarta cifra de la franja: lo que distingue a este proceso (servicios, tipos, formatos). */
  protected abstract metricaPropia(lista: readonly T[]): MetricaEcosistema;

  /** Los departamentos que de verdad tienen registros. Ofrecer los 33 sería mentir. */
  readonly departamentos = computed(() => [...new Set(
    this.lista().map(r => r.nombreDepartamento).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es')));

  /** Los municipios del departamento elegido; sin departamento no se ofrecen. */
  readonly municipios = computed(() => {
    const departamento = this.departamento();
    if (!departamento) return [];
    return [...new Set(this.lista()
      .filter(r => r.nombreDepartamento === departamento)
      .map(r => r.nombreMunicipio)
      .filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es'));
  });

  /** Territorio primero y los propios después, en la columna de filtros. */
  readonly filtros = computed<FiltroDeDirectorio[]>(() => [
    {
      id: 'departamento', etiqueta: 'Departamento', textoTodos: 'Todos los departamentos', valor: this.departamento(),
      opciones: this.departamentos().map(d => ({ valor: d, etiqueta: this.nombrePropio.transform(d) })),
    },
    {
      id: 'municipio', etiqueta: 'Municipio', textoTodos: 'Todos los municipios', valor: this.municipio(),
      deshabilitado: !this.departamento(), textoDeshabilitado: 'Elige un departamento primero',
      opciones: this.municipios().map(m => ({ valor: m, etiqueta: this.nombrePropio.transform(m) })),
    },
    ...this.filtrosPropios(),
    ...this.filtrosDeClasificacion(),
  ]);

  /** Prácticas musicales y territorios sonoros: solo se ofrecen si algún registro los trae. */
  private filtrosDeClasificacion(): FiltroDeDirectorio[] {
    const unicos = (leer: (r: T) => readonly { nombre: string }[] | undefined) =>
      [...new Set(this.lista().flatMap(r => (leer(r) ?? []).map(x => x.nombre)))].sort((a, b) => a.localeCompare(b, 'es'));
    const practicas = unicos(r => r.practicasMusicales);
    const territorios = unicos(r => r.territoriosSonoros);
    const filtros: FiltroDeDirectorio[] = [];
    if (practicas.length) {
      filtros.push({ id: 'practica', etiqueta: 'Prácticas musicales', textoTodos: 'Todas las prácticas', valor: this.practica(),
        opciones: practicas.map(n => ({ valor: n, etiqueta: n })) });
    }
    if (territorios.length) {
      filtros.push({ id: 'territorio-sonoro', etiqueta: 'Territorios sonoros', textoTodos: 'Todos los territorios sonoros', valor: this.territorioSonoro(),
        opciones: territorios.map(n => ({ valor: n, etiqueta: this.nombrePropio.transform(n) })) });
    }
    return filtros;
  }

  readonly filtrosActivos = computed(() =>
    [this.departamento(), this.municipio(), this.practica(), this.territorioSonoro()].filter(Boolean).length + this.propiosActivos());

  readonly hayFiltros = computed(() => this.filtrosActivos() > 0 || this.busqueda().trim().length > 0);

  readonly filtrados = computed(() => {
    const texto = sinTildes(this.busqueda().trim());
    const departamento = this.departamento();
    const municipio = this.municipio();
    const practica = this.practica();
    const territorioSonoro = this.territorioSonoro();
    const lista = this.lista().filter(r =>
      (!departamento || r.nombreDepartamento === departamento)
      && (!municipio || r.nombreMunicipio === municipio)
      && (!practica || (r.practicasMusicales ?? []).some(p => p.nombre === practica))
      && (!territorioSonoro || (r.territoriosSonoros ?? []).some(t => t.nombre === territorioSonoro))
      && this.cumpleFiltrosPropios(r)
      && (!texto || sinTildes(this.textoDeBusqueda(r)).includes(texto)));

    const orden = this.orden();
    return [...lista].sort((a, b) => orden === 'territorio'
      ? dondeEstaRegistro(a).localeCompare(dondeEstaRegistro(b), 'es')
      : a.nombre.localeCompare(b.nombre, 'es'));
  });

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.porPagina())));

  readonly visibles = computed(() => {
    const desde = (this.pagina() - 1) * this.porPagina();
    return this.filtrados().slice(desde, desde + this.porPagina());
  });

  readonly desdeMostrado = computed(() => (this.filtrados().length === 0 ? 0 : (this.pagina() - 1) * this.porPagina() + 1));
  readonly hastaMostrado = computed(() => Math.min(this.pagina() * this.porPagina(), this.filtrados().length));

  /** Las cuatro cifras de la franja: las mismas tres preguntas que responde la de Mercados y la propia. */
  readonly metricas = computed<MetricaEcosistema[]>(() => {
    const lista = this.filtrados();
    const departamentos = new Set(lista.map(r => r.nombreDepartamento).filter(Boolean)).size;
    const municipios = new Set(lista.map(r => r.nombreMunicipio).filter(Boolean)).size;
    return [
      { label: 'Resultados', value: lista.length, detail: `de ${this.lista().length} publicados` },
      { label: 'Departamentos', value: departamentos, detail: 'con registros en esta consulta' },
      { label: 'Municipios', value: municipios, detail: 'con registros en esta consulta' },
      this.metricaPropia(lista),
    ];
  });

  // ─────────────────────────── Los gestos de la pantalla ───────────────────────────

  actualizarBusqueda(valor: string): void { this.busqueda.set(valor); this.pagina.set(1); }

  actualizarDepartamento(valor: string): void {
    this.departamento.set(valor);
    // EL MUNICIPIO SE LIMPIA AL CAMBIAR DE DEPARTAMENTO: uno de Huila filtrando sobre Amazonas no
    // devuelve nada, y quien lo ve no sabe que el filtro de antes sigue puesto.
    this.municipio.set('');
    this.pagina.set(1);
  }

  actualizarMunicipio(valor: string): void { this.municipio.set(valor); this.pagina.set(1); }
  actualizarOrden(valor: string): void { this.orden.set(valor === 'territorio' ? 'territorio' : 'nombre'); this.pagina.set(1); }
  cambiarVista(vista: VistaEcosistema): void { this.vista.set(vista); }

  /** Un filtro del directorio cambió: se reparte al gesto que le corresponde. */
  cambiarFiltro(cambio: { id: string; valor: string }): void {
    if (cambio.id === 'departamento') this.actualizarDepartamento(cambio.valor);
    else if (cambio.id === 'municipio') this.actualizarMunicipio(cambio.valor);
    else if (cambio.id === 'practica') this.alternarPractica(cambio.valor, true);
    else if (cambio.id === 'territorio-sonoro') this.alternarTerritorioSonoro(cambio.valor, true);
    else if (this.fijarPropio(cambio.id, cambio.valor)) this.pagina.set(1);
  }

  /** Una etiqueta de práctica musical en un registro: pone el filtro y, si ya estaba puesto, lo quita. */
  alternarPractica(nombre: string, fijar = false): void {
    this.practica.set(!fijar && this.practica() === nombre ? '' : nombre);
    this.pagina.set(1);
  }

  /** Lo mismo con el territorio sonoro. */
  alternarTerritorioSonoro(nombre: string, fijar = false): void {
    this.territorioSonoro.set(!fijar && this.territorioSonoro() === nombre ? '' : nombre);
    this.pagina.set(1);
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.departamento.set('');
    this.municipio.set('');
    this.practica.set('');
    this.territorioSonoro.set('');
    this.limpiarPropios();
    this.pagina.set(1);
  }

  /** Otra cantidad por página: vuelve a la primera, porque quedarse en la 4 de una lista más corta enseña un vacío falso. */
  cambiarPorPagina(cantidad: number): void {
    this.porPagina.set(cantidad);
    this.pagina.set(1);
  }

  irAPagina(numero: number): void {
    this.pagina.set(Math.min(Math.max(1, numero), this.totalPaginas()));
  }

  donde(registro: RegistroConTerritorio): string {
    return dondeEstaRegistro(registro);
  }
}
