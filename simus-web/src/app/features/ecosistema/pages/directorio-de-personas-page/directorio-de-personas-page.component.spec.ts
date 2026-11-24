import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import {
  ConsultaDelDirectorio, DirectorioDePersonasService, PaginaDelDirectorioDePersonas, PersonaDelDirectorio, TaxonomiaDePerfiles,
} from '../../../../core/services/directorio-de-personas.service';
import { DirectorioDePersonasPageComponent } from './directorio-de-personas-page.component';

/**
 * El directorio de agentes y actores (EC-3, EC-4): lista y mosaico con foto, filtros que viajan en la URL, conteos del
 * servidor, chips, paginación con cantidad por página, esqueleto, vacío y error con «Reintentar».
 */
describe('DirectorioDePersonasPageComponent', () => {
  const v = (codigo: string, nombre: string, padre: string | null = null) => ({ codigo, nombre, grupoSoyCultura: null, fuente: null, padre });
  const taxonomia: TaxonomiaDePerfiles = {
    roles: [v('creador', 'Creación'), v('luthier', 'Lutier', 'creador'), v('docente', 'Docente')],
    servicios: [v('clases', 'Clases')], instrumentos: [v('tiple', 'Tiple')],
    maximoDeRoles: 6, maximoDeServicios: 8, maximoDeInstrumentos: 8, maximoDeTerritorios: 10,
  };
  const persona = (nombre: string, extra: Partial<PersonaDelDirectorio> = {}): PersonaDelDirectorio => ({
    clave: nombre.toLowerCase().replace(/\s/g, '-'), nombreVisible: nombre, fotoUrl: null, biografiaCorta: `Bio de ${nombre}.`,
    municipio: 'Popayán', departamento: 'Cauca', roles: ['docente'], servicios: ['clases'], instrumentos: [], practicas: [], territorios: [], completo: true, ...extra,
  });
  const faceta = (valor: string, nombre: string, total: number) => ({ valor, nombre, total });
  const pagina = (items: PersonaDelDirectorio[], extra: Partial<PaginaDelDirectorioDePersonas> = {}): PaginaDelDirectorioDePersonas => ({
    items, total: items.length, totalPublicadas: 3, pagina: 1, porPagina: 12, totalPaginas: 1,
    facetas: {
      categorias: [faceta('creador', 'Creación', 1), faceta('docente', 'Docente', 2)],
      roles: [faceta('luthier', 'Lutier', 1)], servicios: [faceta('clases', 'Clases', 2), faceta('vacio', 'Sin nadie', 0)],
      instrumentos: [faceta('tiple', 'Tiple', 1)], practicas: [], territorios: [faceta('Cauca', 'Cauca', 1)],
      departamentos: [faceta('Cauca', 'Cauca', 2)], municipios: [],
    }, ...extra,
  });

  let fixture: ComponentFixture<DirectorioDePersonasPageComponent>;
  let c: DirectorioDePersonasPageComponent;
  let consultas: ConsultaDelDirectorio[];
  const raiz = () => fixture.nativeElement as HTMLElement;

  function montar(respuesta: (c: ConsultaDelDirectorio) => Observable<PaginaDelDirectorioDePersonas>, parametros: Record<string, string> = {}): void {
    consultas = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DirectorioDePersonasPageComponent],
      providers: [
        provideRouter([]),
        { provide: DirectorioDePersonasService, useValue: { pagina: (q: ConsultaDelDirectorio) => { consultas.push(q); return respuesta(q); }, taxonomia: () => of(taxonomia) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(parametros) } } },
      ],
    });
    fixture = TestBed.createComponent(DirectorioDePersonasPageComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  }

  const dos = [persona('Ana Docente'), persona('Beto Lutier', { roles: ['luthier'], fotoUrl: '/api/v1/publico/archivos/5' })];

  it('muestra el mosaico por omisión, con la foto cuando existe y las iniciales cuando no', () => {
    montar(() => of(pagina(dos)));
    expect(raiz().querySelector('[data-directorio-cuadricula]')).not.toBeNull();
    expect(raiz().querySelectorAll('[data-testid="tarjeta-de-persona"]').length).toBe(2);
    expect(raiz().querySelectorAll('img').length).toBe(1);
    expect(raiz().querySelector('[data-iniciales]')).not.toBeNull();
    expect(raiz().textContent).toContain('Mostrando 1–2 de 2');
  });

  it('cambia a la lista y lo guarda en la URL', () => {
    montar(() => of(pagina(dos)));
    c.cambiarVista('listado');
    fixture.detectChanges();
    expect(raiz().querySelector('[data-directorio-listado]')).not.toBeNull();
    expect(raiz().querySelector('[data-directorio-cuadricula]')).toBeNull();
  });

  it('lee los filtros de la URL y los pide al servidor', () => {
    montar(() => of(pagina(dos)), { q: 'tiple', rol: 'luthier,docente', servicio: 'clases', departamento: 'Cauca', pagina: '2', por: '24', vista: 'lista' });
    const q = consultas[0];
    expect(q.q).toBe('tiple');
    expect(q.rol).toEqual(['luthier', 'docente']);
    expect(q.servicio).toEqual(['clases']);
    expect(q.departamento).toBe('Cauca');
    expect(q.pagina).toBe(2);
    expect(q.porPagina).toBe(24);
    expect(c.vista()).toBe('listado');
  });

  it('las opciones traen su conteo y no ofrecen las que valen cero', () => {
    montar(() => of(pagina(dos)));
    const servicio = c.multiples().find(m => m.id === 'servicio')!;
    expect(servicio.opciones.map(o => o.nombre)).toEqual(['Clases (2)']);
    const rol = c.multiples().find(m => m.id === 'rol')!;
    expect(rol.opciones[0].grupo).toBe('Creación');
  });

  it('marcar una casilla vuelve a la primera página, consulta de nuevo y deja un chip que se quita', () => {
    montar(() => of(pagina(dos)), { pagina: '3' });
    const antes = consultas.length;
    c.alternar('servicio', ['clases'], 1);
    TestBed.tick();
    fixture.detectChanges();
    expect(consultas.length).toBeGreaterThan(antes);
    expect(consultas.at(-1)!.servicio).toEqual(['clases']);
    expect(consultas.at(-1)!.pagina).toBe(1);
    expect(raiz().querySelector('[data-filtros-aplicados]')?.textContent).toContain('Clases');
    c.quitarChip(c.chips()[0]);
    expect(c.servicios()).toEqual([]);
  });

  it('cambiar de departamento limpia el municipio', () => {
    montar(() => of(pagina(dos)), { departamento: 'Cauca', municipio: 'Popayán' });
    c.cambiarDepartamento('Valle');
    expect(c.municipio()).toBe('');
  });

  it('cambiar la cantidad por página vuelve a la primera', () => {
    montar(() => of(pagina(dos)), { pagina: '2' });
    c.cambiarPorPagina(48);
    expect(c.porPagina()).toBe(48);
    expect(c.paginaActual()).toBe(1);
  });

  it('con filtros que no devuelven nada dice cuántas hay y ofrece limpiar', () => {
    montar(() => of(pagina([], { total: 0 })), { q: 'zzz' });
    const vacio = raiz().querySelector('[data-sin-resultados]');
    expect(vacio?.textContent).toContain('Ninguna persona coincide');
    expect(vacio?.textContent).toContain('Hay 3 personas publicadas');
    c.limpiarFiltros();
    expect(c.busqueda()).toBe('');
  });

  it('sin nadie publicado explica cómo aparecer', () => {
    montar(() => of(pagina([], { total: 0, totalPublicadas: 0 })));
    expect(raiz().querySelector('[data-sin-resultados]')?.textContent).toContain('Todavía no hay personas');
  });

  it('antes de que llegue la respuesta pinta el esqueleto y no un vacío', () => {
    montar(() => new Observable<PaginaDelDirectorioDePersonas>(() => undefined));
    expect(raiz().querySelector('[data-directorio-cargando]')).not.toBeNull();
    expect(raiz().querySelector('[data-sin-resultados]')).toBeNull();
  });

  it('si falla dice el motivo y «Reintentar» consulta otra vez', () => {
    let falla = true;
    montar(() => (falla ? throwError(() => new Error('x')) : of(pagina(dos))));
    expect(raiz().querySelector('[data-directorio-error]')?.textContent).toContain('No fue posible consultar');
    falla = false;
    c.reintentar();
    TestBed.tick();
    fixture.detectChanges();
    expect(raiz().querySelector('[data-directorio-error]')).toBeNull();
    expect(raiz().querySelectorAll('[data-testid="tarjeta-de-persona"]').length).toBe(2);
  });

  it('se presenta como directorio de agentes y actores, no como una búsqueda de personas', () => {
    montar(() => of(pagina(dos)));
    expect(raiz().querySelector('h1')?.textContent).toContain('Directorio de agentes y actores de la música');
    expect(raiz().textContent).not.toContain('Buscar una persona');
  });
});
