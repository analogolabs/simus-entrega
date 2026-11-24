import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideSlidersHorizontal } from '@lucide/angular';
import { catchError, of, switchMap, tap } from 'rxjs';

import {
  ConsultaDelDirectorio, DirectorioDePersonasService, recordarConsultaDelDirectorio, FacetaDelDirectorio, PaginaDelDirectorioDePersonas, PersonaDelDirectorio, TaxonomiaDePerfiles,
} from '../../../../core/services/directorio-de-personas.service';
import { BarraExploracionEcosistemaComponent, VistaEcosistema } from '../../../../shared/components/ui/barra-exploracion-ecosistema/barra-exploracion-ecosistema.component';
import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';
import { BuscadorDeListaComponent } from '../../../../shared/components/ui/buscador/buscador-de-lista.component';
import { ChipDeFiltroComponent } from '../../../../shared/components/ui/chip-de-filtro/chip-de-filtro.component';
import { CompactHeroComponent } from '../../../../shared/components/ui/compact-hero/compact-hero.component';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import { FiltroDesplegableComponent } from '../../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { MetricaEcosistema } from '../../../../shared/components/ui/franja-metricas-ecosistema/franja-metricas-ecosistema.component';
import { OpcionSeleccionable, SelectorMultipleComponent } from '../../../../shared/components/ui/selector-multiple/selector-multiple.component';
import { PaginacionDeListaComponent } from '../../../../shared/components/ui/paginacion-de-lista/paginacion-de-lista.component';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';
import { TarjetaDePersonaComponent } from '../../components/tarjeta-de-persona.component';

/** Las dimensiones de selección múltiple del directorio y el campo de la consulta que alimentan. */
type DimensionMultiple = 'categoria' | 'rol' | 'servicio' | 'instrumento' | 'practica';

const CANTIDADES = [12, 24, 48] as const;

/**
 * El DIRECTORIO DE AGENTES Y ACTORES DE LA MÚSICA EN COLOMBIA, en /ecosistema/personas (EC-3, EC-4; docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).
 *
 * <b>NO ES UNA BÚSQUEDA DE PERSONAS: ES UN DIRECTORIO.</b> Es distinto del directorio de procesos (Festivales, Mercados…):
 * aquí se habla de personas, con su foto, en lista o en mosaico, y se recorre por categoría y subcategoría de rol,
 * servicio, instrumento, práctica y territorio, con la taxonomía de perfiles de personas (decisión 133 y 135).
 *
 * <b>EL SERVIDOR FILTRA, ORDENA, CUENTA Y PAGINA</b> (`GET /publico/directorio-de-personas`): la página trae solo las
 * personas que se ven, y cada opción de filtro dice cuántas hay con ella sin ofrecer una que devolvería cero.
 *
 * <b>SOLO LO QUE LA PERSONA PUBLICÓ.</b> Nombre público, foto, biografía corta, roles, servicios, instrumentos, prácticas
 * y el municipio del PERFIL PÚBLICO (nunca el de residencia, que es privado, ni el nombre civil sin su consentimiento).
 *
 * <b>EL ESTADO VIAJA EN LA URL</b> (`?q=&categoria=&rol=&servicio=&instrumento=&practica=&departamento=&municipio=&actua=&orden=&pagina=&por=&vista=`)
 * para compartir y volver desde la ficha sin perder la consulta. Cada cambio de filtro vuelve a la página 1.
 */
@Component({
  selector: 'app-directorio-de-personas-page',
  standalone: true,
  imports: [TextoWebPipe, 
    BarraExploracionEcosistemaComponent, BotonNativoDirective, BuscadorDeListaComponent, ChipDeFiltroComponent, CompactHeroComponent,
    EsqueletoComponent, FiltroDesplegableComponent, LucideSlidersHorizontal, PaginacionDeListaComponent, SelectorMultipleComponent,
    TarjetaDePersonaComponent,
  ],
  template: `
    <section class="min-h-screen bg-hueso pb-24 font-nunito text-titulo">
      <app-compact-hero backLabel="Ecosistema" current="Agentes y actores" [title]="'personas_titulo' | textoWeb"
        [subtitle]="'personas_subtitulo' | textoWeb"
        (regresoSolicitado)="volver()"></app-compact-hero>

      <div class="mx-auto max-w-[100rem]" role="region" aria-label="Directorio de agentes y actores de la música">
        <div class="grid grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)]">

          <!-- ============================ FILTROS ============================ -->
          <aside aria-label="Filtros del directorio de agentes y actores"
            class="self-start border-b border-filete bg-niebla/50 p-5 lg:sticky lg:top-[72px] lg:flex lg:h-[calc(100dvh-72px)] lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-8">
            <div class="space-y-3">
              <label for="personas-buscar" class="block text-sm font-bold text-tinta-media">{{ 'personas_buscar_etiqueta' | textoWeb }}</label>
              <app-buscador-de-lista ancho tamano="comodo" [etiquetaVisible]="true" identificador="personas-buscar"
                etiqueta="Buscar en el directorio" [marcador]="'personas_buscar_marcador' | textoWeb"
                [valor]="busqueda()" [espera]="300" (cambiar)="cambiarBusqueda($event)" />
            </div>

            <button type="button" appBoton="secundaria" tamano="comodo" class="mt-4 w-full lg:hidden" data-alternar-filtros
              [attr.aria-expanded]="filtrosAbiertos()" aria-controls="personas-filtros" (click)="filtrosAbiertos.set(!filtrosAbiertos())">
              <svg lucideSlidersHorizontal [size]="15" aria-hidden="true"></svg>
              {{ filtrosAbiertos() ? 'Ocultar filtros' : 'Mostrar filtros' }}@if (filtrosActivos()) { ({{ filtrosActivos() }}) }
            </button>

            <div id="personas-filtros" class="mt-6 border-t border-filete pt-6 lg:block" [class.hidden]="!filtrosAbiertos()">
              <div class="mb-4 flex items-center justify-between gap-3">
                <p class="flex items-center gap-2 text-sm font-bold text-tinta-media"><svg lucideSlidersHorizontal [size]="15" class="text-morado" aria-hidden="true"></svg> Filtros</p>
                <button type="button" (click)="limpiarFiltros()" [disabled]="!hayFiltros()" data-limpiar-filtros
                  class="cursor-pointer border-0 bg-transparent text-xs font-semibold text-morado transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline">
                  Limpiar filtros @if (filtrosActivos()) { ({{ filtrosActivos() }}) }
                </button>
              </div>

              <div class="space-y-4">
                @for (m of multiples(); track m.id) {
                  <app-selector-multiple [identificador]="'personas-' + m.id" [etiqueta]="m.etiqueta" [opciones]="m.opciones" [seleccionados]="m.marcadas" tamano="comodo"
                    [textoVacio]="m.textoTodos" (alternar)="alternar(m.id, m.valores, $event)" />
                }
                <div>
                  <span class="mb-1 block text-xs font-bold text-tinta-media">Departamento</span>
                  <app-filtro-desplegable [completo]="true" tamano="comodo" etiqueta="Departamento" identificador="personas-departamento"
                    [opciones]="opcionesDeDepartamento()" [elegida]="departamento()" (cambiar)="cambiarDepartamento($event)" />
                </div>
                <div>
                  <span class="mb-1 block text-xs font-bold text-tinta-media">Municipio</span>
                  <app-filtro-desplegable [completo]="true" tamano="comodo" etiqueta="Municipio" identificador="personas-municipio"
                    [deshabilitado]="!departamento()" [opciones]="opcionesDeMunicipio()" [elegida]="municipio()" (cambiar)="cambiarMunicipio($event)" />
                </div>
                <div>
                  <span class="mb-1 block text-xs font-bold text-tinta-media">Actúa en</span>
                  <app-filtro-desplegable [completo]="true" tamano="comodo" etiqueta="Actúa en" identificador="personas-actua"
                    [opciones]="opcionesDeActua()" [elegida]="actua()" (cambiar)="cambiarActua($event)" />
                </div>
              </div>

              <div class="mt-8 border-t border-filete pt-6">
                <span class="mb-1 block text-xs font-bold text-tinta-media">Ordenar</span>
                <app-filtro-desplegable [completo]="true" tamano="comodo" etiqueta="Ordenar" identificador="personas-orden"
                  [opciones]="opcionesDeOrden" [elegida]="orden()" (cambiar)="cambiarOrden($event)" />
                <p class="mt-3 text-xs leading-relaxed text-tinta-media">{{ 'personas_filtros_ayuda' | textoWeb }}</p>
              </div>
            </div>
          </aside>

          <!-- ============================ RESULTADOS ============================ -->
          <section class="min-w-0 bg-white p-5 lg:p-10">
            <h2 class="sr-only">{{ 'personas_cifra_rotulo' | textoWeb }}</h2>
            <app-barra-exploracion-ecosistema class="block" [metricas]="metricas()" [vista]="vista()" (cambioVista)="cambiarVista($event)" />

            @if (chips().length) {
              <div class="mt-5 flex flex-wrap items-center gap-2" data-filtros-aplicados>
                @for (chip of chips(); track chip.clave) {
                  <app-chip-de-filtro [rotulo]="chip.rotulo" [valor]="chip.valor" (quitar)="quitarChip(chip)" />
                }
                <button type="button" (click)="limpiarFiltros()" data-limpiar-chips
                  class="cursor-pointer border-0 bg-transparent px-1 text-sm font-semibold text-morado hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde">Limpiar filtros</button>
              </div>
            }

            <p id="resultados-de-personas" aria-live="polite" data-directorio-conteo class="mt-6 scroll-mt-24 text-sm font-bold text-tinta-media">
              @if (pagina(); as p) { @if (p.total === 0) { Sin resultados } @else { Mostrando {{ desde() }}–{{ hasta() }} de {{ p.total }} } } @else { &nbsp; }
            </p>

            @if (error()) {
              <div class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800" role="alert" data-directorio-error>
                <p>{{ error() }}</p>
                <button type="button" appBoton="secundaria" tamano="comodo" class="mt-4" (click)="reintentar()">Reintentar</button>
              </div>
            } @else if (!pagina()) {
              <div class="mt-6" data-directorio-cargando>
                <app-esqueleto [variante]="vista() === 'listado' ? 'fila' : 'persona'" [cantidad]="vista() === 'listado' ? 6 : 8" [etiqueta]="'personas_cargando' | textoWeb" />
              </div>
            } @else if (pagina()!.total === 0) {
              <div class="mt-8 border border-filete bg-niebla px-6 py-8" data-sin-resultados>
                @if (pagina()!.totalPublicadas === 0) {
                  <h3 class="text-lg font-bold text-titulo">{{ 'personas_vacio_titulo' | textoWeb }}</h3>
                  <p class="mt-2 max-w-2xl text-sm leading-relaxed text-tinta-media">{{ 'personas_vacio_texto' | textoWeb }}</p>
                } @else {
                  <h3 class="text-lg font-bold text-titulo">{{ 'personas_sin_resultados' | textoWeb }}</h3>
                  <p class="mt-2 max-w-2xl text-sm leading-relaxed text-tinta-media">Hay {{ pagina()!.totalPublicadas }} {{ pagina()!.totalPublicadas === 1 ? 'persona publicada' : 'personas publicadas' }} en el directorio. Prueba con menos filtros.</p>
                  <button type="button" (click)="limpiarFiltros()" appBoton="principal" tamano="comodo" class="mt-5">Limpiar filtros</button>
                }
              </div>
            } @else {
              <div [class.opacity-60]="actualizando()" [attr.aria-busy]="actualizando()" class="transition-opacity motion-reduce:transition-none">
                @if (vista() === 'listado') {
                  <ul class="aparece mt-4 divide-y divide-slate-100" data-directorio-listado>
                    @for (p of pagina()!.items; track p.clave) {
                      <li><app-tarjeta-de-persona modo="lista" data-testid="tarjeta-de-persona" [persona]="p" [contexto]="contextoDe(p)" [etiquetas]="etiquetasDe(p)" [lugar]="lugarDe(p)" /></li>
                    }
                  </ul>
                } @else {
                  <ul class="aparece mt-6 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" data-directorio-cuadricula>
                    @for (p of pagina()!.items; track p.clave) {
                      <li><app-tarjeta-de-persona modo="mosaico" data-testid="tarjeta-de-persona" [persona]="p" [contexto]="contextoDe(p)" [etiquetas]="etiquetasDe(p)" [lugar]="lugarDe(p)" /></li>
                    }
                  </ul>
                }
              </div>
              <div class="mt-10">
                <app-paginacion-de-lista nombre="personas" identificador="personas" [pagina]="pagina()!.pagina" [totalPaginas]="pagina()!.totalPaginas"
                  [porPagina]="porPagina()" [cantidades]="cantidades" (paginaCambiada)="irAPagina($event)" (porPaginaCambiado)="cambiarPorPagina($event)" />
              </div>
            }
          </section>
        </div>
      </div>
    </section>
  `,
})
export class DirectorioDePersonasPageComponent {
  private readonly servicio = inject(DirectorioDePersonasService);
  private readonly router = inject(Router);
  private readonly ubicacion = inject(Location);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruccion = inject(DestroyRef);
  private readonly nombrePropio = new NombrePropioPipe();

  readonly cantidades = CANTIDADES;
  readonly opcionesDeOrden = [{ id: 'nombre', etiqueta: 'Nombre (A–Z)' }, { id: 'territorio', etiqueta: 'Territorio (A–Z)' }];

  // ── El estado de la consulta (todo viaja en la URL) ──
  readonly busqueda = signal('');
  readonly categorias = signal<string[]>([]);
  readonly roles = signal<string[]>([]);
  readonly servicios = signal<string[]>([]);
  readonly instrumentos = signal<string[]>([]);
  readonly practicas = signal<string[]>([]);
  readonly departamento = signal('');
  readonly municipio = signal('');
  readonly actua = signal('');
  readonly orden = signal<'nombre' | 'territorio'>('nombre');
  readonly paginaActual = signal(1);
  readonly porPagina = signal<number>(CANTIDADES[0]);
  readonly vista = signal<VistaEcosistema>('cuadricula');
  readonly filtrosAbiertos = signal(false);

  // ── Lo que responde el servidor ──
  readonly taxonomia = signal<TaxonomiaDePerfiles | null>(null);
  readonly pagina = signal<PaginaDelDirectorioDePersonas | null>(null);
  readonly actualizando = signal(false);
  readonly error = signal('');
  private readonly reintento = signal(0);

  private readonly consulta = computed<ConsultaDelDirectorio>(() => ({
    q: this.busqueda(), categoria: this.categorias(), rol: this.roles(), servicio: this.servicios(), instrumento: this.instrumentos(),
    practica: this.practicas(), departamento: this.departamento(), municipio: this.municipio(), actua: this.actua(),
    orden: this.orden(), pagina: this.paginaActual(), porPagina: this.porPagina(),
  }));

  readonly desde = computed(() => { const p = this.pagina(); return p && p.total ? (p.pagina - 1) * p.porPagina + 1 : 0; });
  readonly hasta = computed(() => { const p = this.pagina(); return p ? Math.min(p.pagina * p.porPagina, p.total) : 0; });

  readonly filtrosActivos = computed(() =>
    this.categorias().length + this.roles().length + this.servicios().length + this.instrumentos().length + this.practicas().length
    + [this.departamento(), this.municipio(), this.actua()].filter(Boolean).length);
  readonly hayFiltros = computed(() => this.filtrosActivos() > 0 || this.busqueda().trim().length > 0);

  readonly metricas = computed<MetricaEcosistema[]>(() => {
    const p = this.pagina();
    const f = p?.facetas;
    const cargando = !p;
    return [
      { label: 'Personas', value: cargando ? '–' : p.total, detail: cargando ? '…' : `de ${p.totalPublicadas} con perfil público` },
      { label: 'Categorías de rol', value: cargando ? '–' : (f?.categorias.filter(c => c.total > 0).length ?? 0), detail: 'en esta consulta' },
      { label: 'Departamentos', value: cargando ? '–' : (f?.departamentos.filter(c => c.total > 0).length ?? 0), detail: 'con personas' },
      { label: 'Servicios', value: cargando ? '–' : (f?.servicios.filter(c => c.total > 0).length ?? 0), detail: 'que ofrecen' },
    ];
  });

  /** Los filtros de selección múltiple, con sus casillas y su conteo (las opciones con cero no se ofrecen salvo marcadas). */
  readonly multiples = computed(() => {
    const f = this.pagina()?.facetas;
    const t = this.taxonomia();
    const definicion: { id: DimensionMultiple; etiqueta: string; textoTodos: string; facetas: FacetaDelDirectorio[]; marcadas: string[]; grupo?: boolean }[] = [
      { id: 'categoria', etiqueta: 'Categoría de rol', textoTodos: 'Todas las categorías', facetas: f?.categorias ?? [], marcadas: this.categorias() },
      { id: 'rol', etiqueta: 'Subcategoría o rol', textoTodos: 'Todos los roles', facetas: f?.roles.filter(r => !!this.categoriaDe(t, r.valor)) ?? [], marcadas: this.roles(), grupo: true },
      { id: 'servicio', etiqueta: 'Tipo de servicio', textoTodos: 'Todos los servicios', facetas: f?.servicios ?? [], marcadas: this.servicios() },
      { id: 'instrumento', etiqueta: 'Instrumento', textoTodos: 'Todos los instrumentos', facetas: f?.instrumentos ?? [], marcadas: this.instrumentos() },
      { id: 'practica', etiqueta: 'Práctica musical', textoTodos: 'Todas las prácticas', facetas: f?.practicas ?? [], marcadas: this.practicas() },
    ];
    return definicion.map(d => {
      const visibles = d.facetas.filter(x => x.total > 0 || d.marcadas.includes(x.valor));
      const opciones: OpcionSeleccionable[] = visibles.map((x, i) => ({
        id: i + 1, nombre: `${x.nombre} (${x.total})`, grupo: d.grupo ? this.categoriaDe(t, x.valor) : null,
      }));
      return {
        id: d.id, etiqueta: d.etiqueta, textoTodos: d.textoTodos, opciones,
        valores: visibles.map(x => x.valor),
        marcadas: visibles.flatMap((x, i) => (d.marcadas.includes(x.valor) ? [i + 1] : [])),
      };
    });
  });

  readonly opcionesDeDepartamento = computed(() => [{ id: '', etiqueta: 'Todos los departamentos' },
    ...this.conMarcada(this.pagina()?.facetas.departamentos, this.departamento())
      .map(d => ({ id: d.valor, etiqueta: `${this.nombrePropio.transform(d.nombre)} (${d.total})` }))]);
  readonly opcionesDeMunicipio = computed(() => [{ id: '', etiqueta: this.departamento() ? 'Todos los municipios' : 'Elige un departamento primero' },
    ...this.conMarcada(this.pagina()?.facetas.municipios, this.municipio())
      .map(d => ({ id: d.valor, etiqueta: `${this.nombrePropio.transform(d.nombre)} (${d.total})` }))]);
  readonly opcionesDeActua = computed(() => [{ id: '', etiqueta: 'Todo el país' },
    ...this.conMarcada(this.pagina()?.facetas.territorios, this.actua())
      .map(d => ({ id: d.valor, etiqueta: `${this.nombrePropio.transform(d.nombre)} (${d.total})` }))]);

  /** Un chip por cada filtro aplicado, para quitarlo con un clic. */
  readonly chips = computed(() => {
    const f = this.pagina()?.facetas;
    const nombre = (lista: FacetaDelDirectorio[] | undefined, valor: string) => lista?.find(x => x.valor === valor)?.nombre ?? valor;
    const t = this.taxonomia();
    const nombreRol = (v: string) => t?.roles.find(r => r.codigo === v)?.nombre ?? nombre(f?.roles, v);
    return [
      ...this.categorias().map(v => ({ clave: 'categoria:' + v, campo: 'categoria', valor: nombreRol(v), original: v, rotulo: 'Categoría' })),
      ...this.roles().map(v => ({ clave: 'rol:' + v, campo: 'rol', valor: nombreRol(v), original: v, rotulo: 'Rol' })),
      ...this.servicios().map(v => ({ clave: 'servicio:' + v, campo: 'servicio', valor: nombre(f?.servicios, v), original: v, rotulo: 'Servicio' })),
      ...this.instrumentos().map(v => ({ clave: 'instrumento:' + v, campo: 'instrumento', valor: nombre(f?.instrumentos, v), original: v, rotulo: 'Instrumento' })),
      ...this.practicas().map(v => ({ clave: 'practica:' + v, campo: 'practica', valor: v, original: v, rotulo: 'Práctica' })),
      ...(this.departamento() ? [{ clave: 'departamento', campo: 'departamento', valor: this.nombrePropio.transform(this.departamento()), original: this.departamento(), rotulo: 'Departamento' }] : []),
      ...(this.municipio() ? [{ clave: 'municipio', campo: 'municipio', valor: this.nombrePropio.transform(this.municipio()), original: this.municipio(), rotulo: 'Municipio' }] : []),
      ...(this.actua() ? [{ clave: 'actua', campo: 'actua', valor: this.nombrePropio.transform(this.actua()), original: this.actua(), rotulo: 'Actúa en' }] : []),
    ];
  });

  constructor() {
    this.leerLaUrl();
    this.servicio.taxonomia().pipe(takeUntilDestroyed(this.destruccion)).subscribe({ next: t => this.taxonomia.set(t), error: () => undefined });

    // LA CONSULTA SE REHACE CUANDO CAMBIA ALGO; la anterior se cancela (`switchMap`) para que no lleguen respuestas desordenadas.
    toObservable(computed(() => ({ c: this.consulta(), n: this.reintento() }))).pipe(
      tap(() => { this.actualizando.set(true); this.error.set(''); }),
      switchMap(({ c }) => this.servicio.pagina(c).pipe(catchError(() => {
        this.error.set('No fue posible consultar el directorio de agentes y actores.');
        return of(null);
      }))),
      takeUntilDestroyed(this.destruccion),
    ).subscribe(respuesta => {
      this.actualizando.set(false);
      if (!respuesta) return;
      this.pagina.set(respuesta);
      // Si pidió una página que ya no existe (por ejemplo tras reducir los resultados), el servidor la acota.
      if (respuesta.pagina !== this.paginaActual()) this.paginaActual.set(respuesta.pagina);
    });

    effect(() => {
      const c = this.consulta();
      const pares: [string, string][] = [
        ['q', c.q], ['categoria', c.categoria.join(',')], ['rol', c.rol.join(',')], ['servicio', c.servicio.join(',')],
        ['instrumento', c.instrumento.join(',')], ['practica', c.practica.join(',')], ['departamento', c.departamento],
        ['municipio', c.municipio], ['actua', c.actua], ['orden', c.orden === 'nombre' ? '' : c.orden],
        ['pagina', c.pagina > 1 ? String(c.pagina) : ''], ['por', c.porPagina === CANTIDADES[0] ? '' : String(c.porPagina)],
        ['vista', this.vista() === 'cuadricula' ? '' : 'lista'],
      ];
      const consulta = new URLSearchParams(pares.filter(([, v]) => v)).toString();
      this.ubicacion.replaceState('/ecosistema/personas', consulta);
      recordarConsultaDelDirectorio(consulta);
    });
  }

  private leerLaUrl(): void {
    const q = this.ruta.snapshot?.queryParamMap;
    const lista = (clave: string) => (q?.get(clave) ?? '').split(',').map(v => v.trim()).filter(Boolean);
    this.busqueda.set(q?.get('q') ?? '');
    this.categorias.set(lista('categoria'));
    this.roles.set(lista('rol'));
    this.servicios.set(lista('servicio'));
    this.instrumentos.set(lista('instrumento'));
    this.practicas.set(lista('practica'));
    this.departamento.set(q?.get('departamento') ?? '');
    this.municipio.set(q?.get('municipio') ?? '');
    this.actua.set(q?.get('actua') ?? '');
    this.orden.set(q?.get('orden') === 'territorio' ? 'territorio' : 'nombre');
    this.paginaActual.set(Math.max(1, Number(q?.get('pagina') ?? 1) || 1));
    const por = Number(q?.get('por') ?? 0);
    this.porPagina.set((CANTIDADES as readonly number[]).includes(por) ? por : CANTIDADES[0]);
    this.vista.set(q?.get('vista') === 'lista' ? 'listado' : 'cuadricula');
    this.filtrosAbiertos.set(this.filtrosActivos() > 0);
  }

  // ── Gestos: cada cambio de filtro vuelve a la página 1 ──
  cambiarBusqueda(valor: string): void { this.busqueda.set(valor); this.paginaActual.set(1); }
  cambiarOrden(valor: string): void { this.orden.set(valor === 'territorio' ? 'territorio' : 'nombre'); this.paginaActual.set(1); }
  cambiarVista(vista: VistaEcosistema): void { this.vista.set(vista); }
  cambiarDepartamento(valor: string): void { this.departamento.set(valor); this.municipio.set(''); this.paginaActual.set(1); }
  cambiarMunicipio(valor: string): void { this.municipio.set(valor); this.paginaActual.set(1); }
  cambiarActua(valor: string): void { this.actua.set(valor); this.paginaActual.set(1); }
  irAPagina(n: number): void {
    this.paginaActual.set(Math.max(1, n));
    document.getElementById('resultados-de-personas')?.scrollIntoView({ block: 'start' });
  }
  cambiarPorPagina(n: number): void { this.porPagina.set(n); this.paginaActual.set(1); }
  reintentar(): void { this.reintento.update(n => n + 1); }

  /** Marca o desmarca una casilla; `valores` es el valor que corresponde a cada casilla, en su orden. */
  alternar(dimension: string, valores: string[], indice: number): void {
    const valor = valores[indice - 1];
    const senal = this.senalDe(dimension);
    if (!valor || !senal) return;
    senal.update(a => (a.includes(valor) ? a.filter(v => v !== valor) : [...a, valor]));
    this.paginaActual.set(1);
  }

  quitarChip(chip: { campo: string; original: string }): void {
    if (chip.campo === 'departamento') this.cambiarDepartamento('');
    else if (chip.campo === 'municipio') this.cambiarMunicipio('');
    else if (chip.campo === 'actua') this.cambiarActua('');
    else { this.senalDe(chip.campo)?.update(a => a.filter(v => v !== chip.original)); this.paginaActual.set(1); }
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    for (const s of [this.categorias, this.roles, this.servicios, this.instrumentos, this.practicas]) s.set([]);
    this.departamento.set(''); this.municipio.set(''); this.actua.set('');
    this.paginaActual.set(1);
  }

  volver(): void { void this.router.navigateByUrl('/ecosistema'); }

  private senalDe(dimension: string) {
    return ({ categoria: this.categorias, rol: this.roles, servicio: this.servicios, instrumento: this.instrumentos, practica: this.practicas } as Record<string, typeof this.categorias>)[dimension];
  }

  private conMarcada(facetas: FacetaDelDirectorio[] | undefined, marcada: string): FacetaDelDirectorio[] {
    const lista = (facetas ?? []).filter(f => f.total > 0 || f.valor === marcada);
    return lista;
  }

  /** La categoría (nombre) de un rol, para agrupar las subcategorías; las categorías mismas no son subcategorías. */
  private categoriaDe(t: TaxonomiaDePerfiles | null, codigo: string): string | null {
    const rol = t?.roles.find(r => r.codigo === codigo);
    if (!t) return '';
    if (!rol?.padre) return null;
    return t.roles.find(r => r.codigo === rol.padre)?.nombre ?? null;
  }

  // ── Cómo se dice cada persona ──
  private nombres(lista: 'roles' | 'servicios' | 'instrumentos', p: PersonaDelDirectorio): string[] {
    const vocabulario = this.taxonomia()?.[lista] ?? [];
    return p[lista].map(codigo => vocabulario.find(v => v.codigo === codigo)?.nombre ?? codigo);
  }
  contextoDe(p: PersonaDelDirectorio): string {
    const roles = this.nombres('roles', p);
    return roles.length ? roles.join(' · ') : 'Pendiente de completar';
  }
  etiquetasDe(p: PersonaDelDirectorio): string[] { return [...this.nombres('servicios', p), ...this.nombres('instrumentos', p)]; }
  lugarDe(p: PersonaDelDirectorio): string {
    return this.nombrePropio.transform([p.municipio, p.departamento].filter(Boolean).join(', '));
  }
}
