import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CatalogService } from '../../../../core/services/catalog.service';
import { EventoAgenda } from '../../../../core/services/agenda.service';
import { EventoDeDiseno, aEventoDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { AgendaPageComponent } from './agenda-page.component';
import { CLAVE_DE_FILTROS_RECORDADOS } from '../../domain/filtros-recordados';

/**
 * La lista de Agenda: empieza por lo que viene, cada evento lleva a SU dirección,
 * «Más información» hace algo y el acordeón dice si está abierto.
 */
describe('AgendaPageComponent', () => {
  function evento(id: number, titulo: string, fechaInicio: string, situacion: 'proximo' | 'en_curso' | 'finalizado', extra: Partial<EventoAgenda> = {}): EventoDeDiseno {
    return aEventoDeDiseno({
      id, slug: `evento-${id}`, titulo, descripcion: 'Descripción.', fechaInicio, fechaFin: null, horaInicio: null, modalidad: 'presencial',
      lugar: 'Casa de la Cultura', codigoDepartamento: '15', nombreDepartamento: 'Boyacá', codigoMunicipio: '15087', nombreMunicipio: 'Bojacá',
      url: null, imagenRuta: null, imagenAlternativa: null, categoriaId: 1, categoria: 'Festivales', organizador: 'Tambó',
      descripcionLarga: null, horaFin: null, nivelCobertura: 'municipal', ordenVisualizacion: null, festivalId: null, imagenArchivoId: null,
      imagenUrl: null, imagenAlt: null, estado: 'publicado', situacion, version: 1, etiquetas: [], practicasMusicales: [],
      territoriosSonoros: [], procedencia: null, proyectosTransversales: [], fechaActualizacion: '2026-11-01T00:00:00Z', ...extra,
    });
  }

  // Desordenados a propósito: la pantalla es la que decide qué va primero.
  const AGENDA: EventoDeDiseno[] = [
    evento(1, 'Pasado antiguo', '2026-09-07', 'finalizado'),
    evento(2, 'Lejano', '2026-12-20', 'proximo'),
    evento(3, 'Pasado reciente', '2026-10-30', 'finalizado'),
    evento(4, 'Cercano', '2026-11-07', 'proximo'),
    evento(5, 'En curso', '2026-11-05', 'en_curso', { fechaFin: '2026-11-08' }),
  ];

  function montar(items: EventoDeDiseno[] = AGENDA) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AgendaPageComponent],
      providers: [
        provideRouter([{ path: 'agenda', children: [] }]),
        {
          provide: CatalogService,
          useValue: {
            fetchAgendaEvents: () => of({ items }),
            fetchDivipolaConCodigos: () => of([]),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AgendaPageComponent);
    fixture.detectChanges();
    const titulos = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('h2.tipo-titulo-lista')).map(h => h.textContent?.trim());
    return { fixture, componente: fixture.componentInstance, raiz: fixture.nativeElement as HTMLElement, titulos };
  }

  it('arranca por lo que viene, del más cercano al más lejano, y no por lo ya pasado', () => {
    const { titulos } = montar();

    // El que está en curso cuenta como «por venir»: un festival que empezó ayer sigue siendo algo a lo que se puede ir.
    expect(titulos()).toEqual(['En curso', 'Cercano', 'Lejano']);
  });

  it('un evento sin categoría no dibuja una etiqueta vacía (D3-05)', () => {
    const { raiz } = montar([
      evento(7, 'Con categoría', '2026-12-01', 'proximo'),
      evento(8, 'Sin categoría', '2026-12-02', 'proximo', { categoria: null, categoriaId: null }),
    ]);

    const etiquetas = Array.from(raiz.querySelectorAll('.tipo-etiqueta.bg-verde')).map(etiqueta => etiqueta.textContent?.trim());
    expect(etiquetas).toContain('Festivales');
    expect(etiquetas.filter(texto => !texto)).toEqual([]);
  });

  it('la Agenda no ofrece filtro por tipo de proceso ni lo lleva como etiqueta: el proceso se lee en la ficha del evento (decisión 116)', () => {
    const { raiz } = montar([
      evento(11, 'Barnizado abierto', '2026-12-01', 'proximo', { procesoTipo: 'taller' }),
      evento(12, 'Jornada de catalogación', '2026-12-02', 'proximo', { procesoTipo: 'red' }),
    ]);

    expect(raiz.querySelector('[data-testid="filtro-de-proceso"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="evento-tipo-de-proceso"]')).toBeNull();
  });

  it('la tarjeta que se abre en la Agenda trae el proceso bajo la organización, con enlace a su ficha (decisión 130)', () => {
    const { raiz } = montar([
      evento(21, 'Barnizado abierto', '2026-12-01', 'proximo', {
        organizador: 'Corporación Tambó',
        proceso: { tipo: 'taller', id: 4, nombre: 'Taller Los Cedros', organizacionId: 9, organizacionNombre: 'Corporación Tambó' },
      }),
    ]);

    const proceso = raiz.querySelector('[data-testid="evento-organiza"] [data-testid="evento-proceso"]');
    expect(proceso?.textContent).toContain('Taller de lutería');
    expect(proceso?.querySelector('a')?.getAttribute('href')).toBe('/ecosistema/luteria/4');
  });

  it('sin «Próximos / Pasados / Todos»: la fecha es lo que abre lo ya realizado, del más antiguo al más reciente', () => {
    const { fixture, componente, titulos, raiz } = montar();

    // Ya no hay botones de tiempo: por omisión solo lo que viene.
    expect(raiz.querySelector('[data-tiempo]')).toBeNull();
    expect(raiz.textContent).not.toContain('Pasados');

    componente.setDateMode('month');
    componente.setAnio('2026');
    fixture.detectChanges();
    expect(titulos()).toEqual(['Pasado antiguo', 'Pasado reciente', 'En curso', 'Cercano', 'Lejano']);

    componente.setMes('10');
    fixture.detectChanges();
    expect(titulos()).toEqual(['Pasado reciente']);
  });

  it('los meses se escriben solo como mes, en minúscula y sin año; el año va en su propio filtro', () => {
    const { componente } = montar();

    componente.setDateMode('month');
    expect(componente.opcionesDeMes().map(o => o.etiqueta)).toEqual(['Todos los meses', 'septiembre', 'octubre', 'noviembre', 'diciembre']);
    expect(componente.opcionesDeAnio().map(o => o.etiqueta)).toEqual(['Todos los años', '2026']);

    // Con un año puesto, solo los meses que tienen eventos en ese año.
    componente.setAnio('2027');
    expect(componente.opcionesDeMes().map(o => o.etiqueta)).toEqual(['Todos los meses']);
  });

  it('el modo de fecha es un selector segmentado con tres posiciones, y el panel no usa mayúsculas sostenidas en sus controles', () => {
    const { raiz, componente, fixture } = montar();
    const posiciones = Array.from(raiz.querySelectorAll('#agenda-filtros app-selector-segmentado [data-opcion]')).map(b => b.textContent?.trim());

    expect(posiciones).toEqual(['Día', 'Mes', 'Rango']);
    expect(componente.dateMode()).toBe('exact');

    (raiz.querySelector('#agenda-filtros app-selector-segmentado [data-opcion="month"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(componente.dateMode()).toBe('month');
    // Año y mes son el mismo filtro común, con el mismo tamaño que departamento y municipio.
    expect(raiz.querySelectorAll('#agenda-filtros app-filtro-desplegable').length).toBe(4);
    expect(raiz.querySelector('#agenda-filtros select')).toBeNull();
  });

  it('cada evento tiene su dirección: «Más información» es un enlace a /agenda/:slug', () => {
    const { fixture, raiz, componente } = montar();

    componente.toggleOpenIndex(0);
    fixture.detectChanges();
    const enlaces = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('[data-testid="agenda-mas-informacion"]'));

    expect(enlaces.length).toBeGreaterThan(0);
    expect(enlaces[0].tagName).toBe('A');
    // El primero de la lista es «En curso» (id 5).
    expect(enlaces[0].getAttribute('href')).toBe('/agenda/evento-5');
  });

  it('el acordeón dice si está abierto (aria-expanded) y a qué panel controla', () => {
    const { fixture, raiz, componente } = montar();
    const disparador = () => raiz.querySelector<HTMLButtonElement>('button[aria-controls^="agenda-detalle-"]')!;

    expect(disparador().getAttribute('aria-expanded')).toBe('false');
    expect(raiz.querySelector(`#${disparador().getAttribute('aria-controls')}`)).not.toBeNull();

    componente.toggleOpenIndex(0);
    fixture.detectChanges();
    expect(disparador().getAttribute('aria-expanded')).toBe('true');
  });

  it('en teléfono la tarjeta no usa la rejilla de 12 columnas: título a su ancho, fecha en fila propia y detalle en una columna (revisión responsive)', () => {
    const { raiz } = montar();
    const fila = raiz.querySelector<HTMLElement>('button[aria-controls^="agenda-detalle-"]')!;
    const hijos = Array.from(fila.children).map(h => h.className);
    // imagen, título y fecha: cada uno ocupa columnas solo desde `md`; en teléfono la fecha va en una fila de 12
    expect(hijos[1]).toContain('col-span-7');
    expect(hijos[1]).toContain('md:col-span-5');
    expect(hijos[1]).toContain('min-w-0');
    expect(hijos[2]).toContain('col-span-12');
    expect(hijos[2]).toContain('md:col-span-3');
    const detalle = raiz.querySelector<HTMLElement>('[id^="agenda-detalle-"] > div')!;
    expect(detalle.className).toContain('grid-cols-1');
    expect(detalle.className).toContain('md:grid-cols-12');
  });

  it('sin eventos por venir dice que no hay y explica cómo llegar a los ya realizados', () => {
    const { raiz, titulos } = montar([evento(1, 'Pasado', '2026-09-07', 'finalizado')]);

    expect(titulos()).not.toContain('Pasado');
    expect(raiz.textContent).toContain('No hay eventos programados');
    expect(raiz.textContent).toContain('Elige un mes, un año o un tramo de fechas');
  });

  it('el año y el mes viajan en la dirección: ?anio=2026&mes=10 abre octubre de 2026', async () => {
    const { titulos } = await montarConDireccion('/agenda?anio=2026&mes=10');

    expect(titulos).toEqual(['Pasado reciente']);
  });

  it('un enlace antiguo con el mes como «2026-10» sigue abriendo octubre de 2026', async () => {
    const { titulos } = await montarConDireccion('/agenda?mes=2026-10');

    expect(titulos).toEqual(['Pasado reciente']);
  });

  it('cada filtro puesto es un chip con su «X», y quitar uno no toca los demás (A-1)', () => {
    const { fixture, raiz, componente } = montar();
    expect(raiz.querySelector('[data-filtros-activos]')).toBeNull();

    componente.setSelectedCategory('Festivales');
    componente.setDateMode('month');
    componente.setAnio('2026');
    fixture.detectChanges();

    const chips = Array.from(raiz.querySelectorAll('[data-filtros-activos] app-chip-de-filtro')).map(c => c.textContent?.replace(/\s+/g, '').trim());
    expect(chips).toEqual(['Tipo:Festivales', 'Año:2026']);

    (raiz.querySelector('[data-filtros-activos] button[aria-label="Quitar filtro Año: 2026"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(componente.anioElegido()).toBe('');
    expect(componente.selectedCategory()).toBe('Festivales');
  });

  it('«Limpiar filtros» está junto a los chips, los quita todos y conserva la vista elegida (A-1)', () => {
    const { fixture, raiz, componente } = montar();
    componente.setViewMode('calendar');
    componente.alBuscar('cercano');
    componente.setSelectedCategory('Festivales');
    fixture.detectChanges();

    (raiz.querySelector('[data-testid="agenda-filtros-aplicados"] [data-testid="limpiar-filtros"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(componente.busqueda()).toBe('');
    expect(componente.selectedCategory()).toBe('Todos');
    expect(componente.viewMode()).toBe('calendar');
    expect(raiz.querySelector('[data-filtros-activos]')).toBeNull();
  });

  it('un día elegido y abandonado por «Mes» ya no acota la lista, y su chip tampoco se pinta', () => {
    const { fixture, componente } = montar();
    componente.selectedExactDate.set('2026-11-07');
    componente.setDateMode('month');
    fixture.detectChanges();

    expect(componente.filtrosActivos().map(f => f.clave)).toEqual([]);
  });

  it('el selector de vista es solo iconos, con nombre accesible, y va en la línea del título (A-4)', () => {
    const { raiz } = montar();
    const fila = raiz.querySelector('#agenda-lista-eventos')!;

    expect(fila.querySelector('app-section-header')).not.toBeNull();
    const botones = Array.from(fila.querySelectorAll<HTMLButtonElement>('app-selector-segmentado button'));
    expect(botones.map(b => b.getAttribute('aria-label'))).toEqual(['Vista de lista', 'Vista de mosaico']);
    expect(botones.map(b => b.getAttribute('title'))).toEqual(['Vista de lista', 'Vista de mosaico']);
  });

  it('el buscador es el común: escribe con pausa y su «X» limpia (B-1, B-2)', fakeAsync(() => {
    const { fixture, raiz, componente } = montar();
    const campo = raiz.querySelector<HTMLInputElement>('#busqueda-de-agenda')!;

    campo.value = 'cerc';
    campo.dispatchEvent(new Event('input'));
    expect(componente.busqueda()).toBe('');
    tick(300);
    fixture.detectChanges();
    expect(componente.busqueda()).toBe('cerc');
    expect(raiz.querySelector('app-buscador-de-lista .buscador__limpiar')).not.toBeNull();
  }));

  it('filtra por etiqueta (palabra enlace) con el código de la campaña, y solo la ofrece si hay eventos con ella (A-1, campaña)', () => {
    const celebra = [{ id: 1, nombre: 'Celebra la música', slug: 'celebra-la-musica' }];
    const { fixture, raiz, componente, titulos } = montar([
      evento(31, 'De campaña', '2026-12-01', 'proximo', { proyectosTransversales: celebra }),
      evento(32, 'Sin campaña', '2026-12-02', 'proximo'),
    ]);
    expect(componente.etiquetasDeLaAgenda().map(e => [e.codigo, e.total])).toEqual([['celebra-la-musica', 1]]);
    const palabras = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('#agenda-filtros a[data-etiqueta]'));
    expect(palabras.map(a => a.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['#Celebra la música(1)']);
    expect(raiz.querySelector('#agenda-filtros [data-filtro="proyecto-de-agenda"]')).toBeNull();

    palabras[0].click();
    fixture.detectChanges();
    expect(titulos()).toEqual(['De campaña']);
    expect(raiz.querySelector('[data-filtros-activos]')?.textContent).toContain('Celebra la música');
  });

  it('sin eventos con etiqueta no aparece el bloque de etiquetas', () => {
    const { componente, raiz } = montar();
    expect(componente.etiquetasDeLaAgenda()).toEqual([]);
    expect(raiz.querySelector('app-etiquetas-de-contenido')).toBeNull();
  });

  it('?proyecto=<código> abre la agenda ya acotada a la campaña', async () => {
    const celebra = [{ id: 1, nombre: 'Celebra la música', slug: 'celebra-la-musica' }];
    const { titulos } = await montarConDireccion('/agenda?proyecto=celebra-la-musica', [
      evento(31, 'De campaña', '2026-12-01', 'proximo', { proyectosTransversales: celebra }),
      evento(32, 'Sin campaña', '2026-12-02', 'proximo'),
    ]);
    expect(titulos).toEqual(['De campaña']);
  });

  it('trae el selector común de cantidad por página: 12 de partida, elegir otra vuelve a la primera y no cuenta como filtro', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => evento(100 + i, `Evento ${i}`, '2026-12-01', 'proximo'));
    const { fixture, raiz, componente } = montar(muchos);
    expect(componente.porPagina()).toBe(12);
    expect(raiz.querySelector('app-paginacion-de-lista')).not.toBeNull();
    expect(componente.paginatedAgendaItems().length).toBe(12);

    componente.setCurrentPage(3);
    componente.cambiarPorPagina(24);
    fixture.detectChanges();
    expect(componente.currentPage()).toBe(1);
    expect(componente.paginatedAgendaItems().length).toBe(24);
    expect(componente.filtrosPuestos()).toBe(0);
  });

  it('el vacío con filtros ofrece «Limpiar filtros» y mientras carga no dice que no hay nada', () => {
    const { fixture, raiz, componente } = montar();
    componente.alBuscar('zzz');
    fixture.detectChanges();

    expect(raiz.querySelector('app-estado-de-lista')?.textContent).toContain('No hay eventos programados');
    expect(raiz.querySelector('[data-testid="agenda-vacio-limpiar"]') ?? raiz.querySelector('app-estado-de-lista button')).not.toBeNull();
  });

  it('recordarFiltros guarda la búsqueda actual para que la ficha pueda devolverla (A-7)', () => {
    sessionStorage.removeItem(CLAVE_DE_FILTROS_RECORDADOS);
    const { componente } = montar();
    componente.recordarFiltros();
    expect(sessionStorage.getItem(CLAVE_DE_FILTROS_RECORDADOS)).toBe(window.location.search);
  });

  async function montarConDireccion(direccion: string, items: EventoDeDiseno[] = AGENDA) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AgendaPageComponent],
      providers: [
        provideRouter([{ path: 'agenda', children: [] }]),
        { provide: CatalogService, useValue: { fetchAgendaEvents: () => of({ items }), fetchDivipolaConCodigos: () => of([]) } },
      ],
    });
    await TestBed.inject(Router).navigateByUrl(direccion);
    const fixture = TestBed.createComponent(AgendaPageComponent);
    fixture.detectChanges();
    const titulos = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('h2.tipo-titulo-lista')).map(h => h.textContent?.trim());
    return { titulos };
  }
});
