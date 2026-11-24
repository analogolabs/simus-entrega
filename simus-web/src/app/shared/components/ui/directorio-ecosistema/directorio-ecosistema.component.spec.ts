import { DEFAULT_TEXTS } from '../../../../core/cms/registro-de-textos-web';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { PaginacionDeListaComponent } from '../paginacion-de-lista/paginacion-de-lista.component';

import { DirectorioEcosistemaComponent, FiltroDeDirectorio, TextosDeDirectorio, textosDeDirectorio } from './directorio-ecosistema.component';

/**
 * El directorio estándar del Ecosistema.
 *
 * <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que cada proceso vuelva a dibujar su directorio a mano y se
 * aleje del de Festivales y Mercados. Lo que se fija es lo que hace de esto un directorio y no una
 * lista: la columna de búsqueda y filtros, las cifras con el conmutador de vista, el «Mostrando
 * 1–12 de N», los tres estados (carga, error, vacío) con el vacío que dice qué hacer, la
 * paginación, y que ninguna etiqueta use mayúsculas sostenidas (docs/usuario/23-guia-de-estilo-de-textos.md).
 */
@Component({
  standalone: true,
  imports: [DirectorioEcosistemaComponent],
  template: `
    <app-directorio-ecosistema
      clave="cosas" titulo="Cosas" subtitulo="Lo que hay" [migaActual]="miga" [etiquetaDeRegion]="region" etiquetaBusqueda="Buscar una cosa" etiquetaMapa="Ver cosas en el mapa"
      [filtros]="filtros" [busqueda]="busqueda()" [ordenes]="[{ valor: 'nombre', etiqueta: 'Nombre (A–Z)' }]" orden="nombre"
      [metricas]="[{ label: 'Resultados', value: total(), detail: 'de 30 publicados' }]"
      [textos]="textos" [visibles]="visibles()" [total]="total()" [totalPublicados]="publicados()"
      [desde]="desde()" [hasta]="hasta()" [pagina]="pagina()" [totalPaginas]="totalPaginas()" [porPagina]="porPagina()"
      [filtrosActivos]="filtrosActivos()" [hayFiltros]="filtrosActivos() > 0" [cargando]="cargando()" [error]="error()"
      [vista]="vista()"
      (busquedaCambiada)="busqueda.set($event)" (filtroCambiado)="cambios.push($event)"
      (vistaCambiada)="vista.set($event)" (paginaCambiada)="pagina.set($event)" (porPaginaCambiado)="porPagina.set($event)" (filtrosLimpiados)="limpiezas = limpiezas + 1"
      (mapaSolicitado)="mapas = mapas + 1">
      <ng-template #listado let-registro><span data-fila>{{ $any(registro).nombre }}</span></ng-template>
      <ng-template #tarjeta let-registro><span data-celda>{{ $any(registro).nombre }}</span></ng-template>
    </app-directorio-ecosistema>
  `,
})
class AnfitrionDePruebaComponent {
  filtros: FiltroDeDirectorio[] = [
    { id: 'departamento', etiqueta: 'Departamento', textoTodos: 'Todos los departamentos', valor: '', opciones: [{ valor: 'Cauca', etiqueta: 'Cauca' }] },
    { id: 'municipio', etiqueta: 'Municipio', textoTodos: 'Todos los municipios', valor: '', opciones: [], deshabilitado: true, textoDeshabilitado: 'Elige un departamento primero' },
  ];
  textos: TextosDeDirectorio = textosDeDirectorio('cosa', 'cosas', true);
  miga = '';
  region = '';
  busqueda = signal('');
  vista = signal<'listado' | 'cuadricula'>('listado');
  pagina = signal(1);
  porPagina = signal(12);
  total = signal(3);
  publicados = signal(3);
  desde = signal(1);
  hasta = signal(3);
  totalPaginas = signal(1);
  filtrosActivos = signal(0);
  cargando = signal(false);
  error = signal('');
  visibles = signal<{ nombre: string }[]>([{ nombre: 'Una' }, { nombre: 'Otra' }, { nombre: 'Tercera' }]);
  cambios: { id: string; valor: string }[] = [];
  limpiezas = 0;
  mapas = 0;
}

describe('DirectorioEcosistemaComponent', () => {
  let fixture: ComponentFixture<AnfitrionDePruebaComponent>;
  let anfitrion: AnfitrionDePruebaComponent;
  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AnfitrionDePruebaComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(AnfitrionDePruebaComponent);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('dibuja la columna de búsqueda y filtros, las cifras, el conteo y el listado', () => {
    expect(raiz().querySelector('input[type="search"]')).not.toBeNull();
    expect(raiz().querySelector('label[for="cosas-buscar"]')?.textContent).toContain('Buscar una cosa');
    // UI-C: ni un <select> suelto. Dos filtros y el orden son el desplegable estándar, a 44 px.
    expect(raiz().querySelectorAll('select').length).toBe(0);
    expect(raiz().querySelectorAll('app-filtro-desplegable').length).toBe(3);
    expect(raiz().querySelector('app-buscador-de-lista')?.getAttribute('data-tamano')).toBe('comodo');
    expect(raiz().textContent).toContain('Resultados');
    expect(raiz().querySelector('[data-directorio-conteo]')?.textContent).toContain('Mostrando 1–3 de 3');
    expect(raiz().querySelectorAll('[data-fila]').length).toBe(3);
  });

  it('en tableta los filtros van en dos columnas y en escritorio apilados en la columna lateral (revisión responsive)', () => {
    const rejilla = raiz().querySelector<HTMLElement>('[data-directorio-filtros]');
    expect(rejilla).withContext('no hay rejilla de filtros').not.toBeNull();
    expect(rejilla!.className).toContain('md:grid-cols-2');
    expect(rejilla!.className).toContain('lg:grid-cols-1');
    expect(raiz().querySelector<HTMLElement>('[data-limpiar-filtros]')!.className).toContain('min-h-11');
  });

  it('un filtro que depende de otro se apaga y dice qué falta', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const municipio = raiz().querySelector<HTMLButtonElement>('[data-filtro="cosas-municipio"]')!;
    expect(municipio.disabled).toBeTrue();
    expect(municipio.textContent).toContain('Elige un departamento primero');
  });

  it('los controles del directorio miden 44 px: el buscador y cada desplegable', async () => {
    // MUTANTE QUE MATA: un <input> o un <select> con su caja propia. Las alturas las da el token.
    await fixture.whenStable();
    const alturas = [
      raiz().querySelector<HTMLElement>('#cosas-buscar')!,
      ...Array.from(raiz().querySelectorAll<HTMLElement>('app-filtro-desplegable .filtro__control')),
    ].map(el => Math.round(el.getBoundingClientRect().height));
    expect(alturas.length).toBe(4);
    for (const altura of alturas) { expect(altura).toBe(44); }
  });

  it('avisa del filtro que se elige y del paso al mapa', async () => {
    await fixture.whenStable();
    raiz().querySelector<HTMLButtonElement>('[data-filtro="cosas-departamento"]')!.click();
    fixture.detectChanges();
    const opcion = Array.from(raiz().querySelectorAll<HTMLElement>('[role="option"]')).find(o => o.textContent?.includes('Cauca'))!;
    opcion.click();
    expect(anfitrion.cambios).toEqual([{ id: 'departamento', valor: 'Cauca' }]);

    raiz().querySelector<HTMLButtonElement>('[data-testid="ir-al-mapa-festivales"]')!.click();
    expect(anfitrion.mapas).toBe(1);
  });

  it('el conmutador de vista pinta la cuadrícula con la plantilla de tarjeta', () => {
    raiz().querySelector<HTMLButtonElement>('button[title="Ver en cuadrícula"]')!.click();
    fixture.detectChanges();

    expect(raiz().querySelectorAll('[data-celda]').length).toBe(3);
    expect(raiz().querySelectorAll('[data-fila]').length).toBe(0);
  });

  it('una consulta sin resultados dice cuántos hay y ofrece deshacerla', () => {
    // MUTANTE QUE MATA: un «no hay resultados» a secas. Quien busca no sabe si el directorio está
    // vacío o si es su consulta la que no encuentra nada.
    anfitrion.total.set(0); anfitrion.visibles.set([]); anfitrion.desde.set(0); anfitrion.hasta.set(0);
    fixture.detectChanges();

    const vacio = raiz().querySelector('[data-sin-resultados]')!;
    expect(vacio.textContent).toContain('Ninguna cosa coincide con esta consulta');
    expect(vacio.textContent).toContain('Hay 3 cosas publicadas en el Ecosistema.');
    vacio.querySelector<HTMLButtonElement>('button')!.click();
    expect(anfitrion.limpiezas).toBe(1);
  });

  it('la miga, la región y el consejo del vacío se pueden poner desde fuera (Festivales los lee del CMS)', () => {
    anfitrion.miga = 'Cosas varias';
    anfitrion.region = 'Consulta pública';
    anfitrion.textos = { ...textosDeDirectorio('cosa', 'cosas', true), vacioConsultaTexto: 'Prueba con otro nombre o territorio.' };
    anfitrion.total.set(0); anfitrion.visibles.set([]);
    fixture.detectChanges();

    expect(raiz().querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Consulta pública');
    expect(raiz().textContent).toContain('Cosas varias');
    expect(raiz().querySelector('[data-sin-resultados]')!.textContent).toContain('Prueba con otro nombre o territorio.');
    expect(raiz().querySelector('[data-sin-resultados]')!.textContent).not.toContain('Prueba con menos filtros.');
  });

  it('un directorio vacío no ofrece «limpiar»: no hay nada que deshacer', () => {
    anfitrion.total.set(0); anfitrion.publicados.set(0); anfitrion.visibles.set([]);
    fixture.detectChanges();

    const vacio = raiz().querySelector('[data-sin-resultados]')!;
    expect(vacio.textContent).toContain('Todavía no hay cosas publicadas');
    expect(vacio.querySelector('button')).toBeNull();
  });

  it('un fallo se dice y no se confunde con «no hay resultados»', () => {
    anfitrion.error.set('No fue posible consultar las cosas.');
    fixture.detectChanges();

    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('No fue posible consultar las cosas.');
    expect(raiz().querySelector('[data-sin-resultados]')).toBeNull();
  });

  it('mientras carga lo dice, y no enseña el vacío', () => {
    anfitrion.cargando.set(true);
    fixture.detectChanges();

    expect(raiz().textContent).toContain('Consultando las cosas…');
    expect(raiz().querySelector('[data-sin-resultados]')).toBeNull();
  });

  it('mientras carga dibuja la estructura de la lista, sin «0 de 0» ni vacío, y al terminar la reemplaza por los datos', () => {
    anfitrion.cargando.set(true);
    anfitrion.total.set(0);
    anfitrion.publicados.set(0);
    fixture.detectChanges();

    const carga = raiz().querySelector('[data-directorio-cargando] app-esqueleto')!;
    expect(carga.getAttribute('aria-busy')).toBe('true');
    expect(carga.getAttribute('data-esqueleto')).toBe('fila');
    expect(raiz().querySelector('[data-directorio-conteo]')!.textContent).not.toContain('Mostrando');
    expect(raiz().querySelector('[data-sin-resultados]')).toBeNull();
    expect(raiz().querySelector('[data-directorio-listado]')).toBeNull();

    anfitrion.cargando.set(false);
    anfitrion.total.set(3);
    anfitrion.publicados.set(3);
    fixture.detectChanges();
    expect(raiz().querySelector('[data-directorio-cargando]')).toBeNull();
    expect(raiz().querySelector('[data-directorio-conteo]')!.textContent).toContain('Mostrando');
  });

  it('pagina solo cuando hay más de una página, y apaga los extremos', () => {
    expect(raiz().querySelector('nav[aria-label="Paginación de Cosas"]')).toBeNull();

    anfitrion.totalPaginas.set(3);
    fixture.detectChanges();
    const anterior = raiz().querySelector<HTMLButtonElement>('[data-pagina-anterior]')!;
    const siguiente = raiz().querySelector<HTMLButtonElement>('[data-pagina-siguiente]')!;
    expect(anterior.disabled).toBeTrue();
    expect(raiz().textContent).toContain('Página 1 de 3');

    siguiente.click();
    expect(anfitrion.pagina()).toBe(2);
  });

  it('con más registros que la cantidad mínima trae el selector común de cuántos por página, y avisa al elegir otra', () => {
    expect(raiz().querySelector('app-paginacion-de-lista')).toBeNull();

    anfitrion.total.set(30);
    anfitrion.totalPaginas.set(3);
    fixture.detectChanges();
    expect(raiz().querySelector('app-paginacion-de-lista [id$="-por-pagina-rotulo"]')?.textContent).toContain('Por página');

    fixture.debugElement.query(By.directive(PaginacionDeListaComponent)).componentInstance.porPaginaCambiado.emit(24);
    expect(anfitrion.porPagina()).toBe(24);
  });

  it('ninguna etiqueta usa mayúsculas sostenidas (docs/usuario/23-guia-de-estilo-de-textos.md)', () => {
    anfitrion.totalPaginas.set(2);
    fixture.detectChanges();

    // El directorio mismo no escribe `uppercase` en su marcado: la columna de filtros, la paginación y
    // el vacío. El encabezado (miga de pan) y la franja de cifras son piezas compartidas con su propio
    // estilo, que se normalizan en el lote del portal, y no se miden aquí.
    const sosteniendo = Array.from(raiz().querySelectorAll('aside *, nav[aria-label^="Paginación"] *, [data-sin-resultados] *'))
      .filter(el => /\buppercase\b/.test(el.getAttribute('class') ?? ''));
    expect(sosteniendo.map(el => el.outerHTML.slice(0, 120))).toEqual([]);
  });
});

describe('textosDeDirectorio', () => {
  it('concuerda el género y el número en cada frase', () => {
    const redes = textosDeDirectorio('red', 'redes', true);
    expect(redes.vacioTotalTitulo).toBe('Todavía no hay redes publicadas');
    expect(redes.vacioConsultaTitulo).toBe('Ninguna red coincide con esta consulta');
    expect(redes.hayTotal(1)).toBe('Hay 1 red publicada en el Ecosistema.');
    expect(redes.cargando).toBe('Consultando las redes…');

    const mercados = textosDeDirectorio('mercado', 'mercados');
    expect(mercados.vacioConsultaTitulo).toBe('Ningún mercado coincide con esta consulta');
    expect(mercados.hayTotal(3)).toBe('Hay 3 mercados publicados en el Ecosistema.');
  });
});

describe('DirectorioEcosistemaComponent · textos del CMS (claveCms)', () => {
  function montar(publicados: Record<string, string>, claveCms: string) {
    TestBed.configureTestingModule({
      imports: [DirectorioEcosistemaComponent],
      providers: [
        provideRouter([]),
        { provide: TextosWebService, useValue: { getWebText: (k: string) => publicados[k] ?? DEFAULT_TEXTS[k] ?? '' } },
      ],
    });
    const fixture = TestBed.createComponent(DirectorioEcosistemaComponent);
    fixture.componentRef.setInput('clave', 'mercados');
    fixture.componentRef.setInput('titulo', 'Respaldo de la pantalla');
    fixture.componentRef.setInput('textos', textosDeDirectorio('mercado', 'mercados'));
    fixture.componentRef.setInput('claveCms', claveCms);
    return fixture;
  }

  it('sin nada publicado el encabezado y los mensajes son los de fábrica del registro', () => {
    const fixture = montar({}, 'dir_mercados');
    const directorio = fixture.componentInstance;
    expect(directorio.titulo).toBe(DEFAULT_TEXTS['dir_mercados_title']);
    expect(directorio.subtitulo).toBe('Nodos de intercambio, visibilización y profesionalización');
    expect(directorio.textos.vacioConsultaTitulo).toBe('Ningún mercado coincide con esta consulta');
  });

  it('un texto publicado en el CMS reemplaza al de la pantalla', () => {
    const fixture = montar({ dir_mercados_title: 'Mercados de la música', dir_mercados_empty_total_title: 'Aún no hay mercados' }, 'dir_mercados');
    fixture.detectChanges();
    const directorio = fixture.componentInstance;
    expect(directorio.titulo).toBe('Mercados de la música');
    expect(directorio.textos.vacioTotalTitulo).toBe('Aún no hay mercados');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mercados de la música');
  });

  it('sin prefijo del CMS se queda con lo que la pantalla pasa (es el caso de Festivales)', () => {
    const fixture = montar({ dir_mercados_title: 'No debe verse' }, '');
    expect(fixture.componentInstance.titulo).toBe('Respaldo de la pantalla');
  });
});
