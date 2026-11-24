import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CatalogService } from '../../core/services/catalog.service';
import { ProcesosHistoricosReclamablesComponent } from './procesos-historicos-reclamables.component';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { ProcesoHistoricoReclamable, ProcesosHistoricos, ReclamacionesDeProcesosService, TipoDeProcesoHistorico } from './reclamaciones-de-procesos.service';

/**
 * «Buscar un proceso histórico» (decisión 129): sin lista por defecto, con sugerencias solo por
 * coincidencia fuerte, filtros en la URL, y la solicitud desde la misma tarjeta.
 */
describe('ProcesosHistoricosReclamablesComponent', () => {
  const TIPOS: TipoDeProcesoHistorico[] = [
    { modulo: 'festivales', etiqueta: 'Festival', etiquetaPlural: 'Festivales', reclamable: true, motivoNoReclamable: null },
    { modulo: 'mercados', etiqueta: 'Mercado musical', etiquetaPlural: 'Mercados musicales', reclamable: true, motivoNoReclamable: null },
    { modulo: 'redes', etiqueta: 'Red o documentación', etiquetaPlural: 'Redes y documentación', reclamable: true, motivoNoReclamable: null },
    { modulo: 'talleres', etiqueta: 'Taller de lutería', etiquetaPlural: 'Lutería', reclamable: true, motivoNoReclamable: null },
    { modulo: 'espacios', etiqueta: 'Espacio para música en vivo', etiquetaPlural: 'Espacios para música en vivo', reclamable: true, motivoNoReclamable: null },
  ];
  const proceso = (cambios: Partial<ProcesoHistoricoReclamable> = {}): ProcesoHistoricoReclamable => ({
    modulo: 'festivales', tipoEtiqueta: 'Festival', id: '172', nombre: 'Festival del Bambuco', descripcion: 'Concurso de bambuco.', organizadorAnterior: null,
    nivelCobertura: 'municipal', codigoDepartamento: '41', nombreDepartamento: 'HUILA', codigoMunicipio: '41001', nombreMunicipio: 'NEIVA',
    periodicidad: 'anual', aniosDeEdiciones: [2019, 2018], reclamacionEnCurso: false, reclamacionPropiaId: null, reclamacionPropiaEstado: null,
    coincidenciaFuerte: false, puntajeDeCoincidencia: null, motivoDeCoincidencia: null, ...cambios,
  });
  const respuesta = (cambios: Partial<ProcesosHistoricos> = {}): ProcesosHistoricos =>
    ({ hayBusqueda: false, tipos: TIPOS, resultados: [], sugeridos: [], avisoDelTipo: null, ...cambios });

  function crear(datos: ProcesosHistoricos, esAdministradora = true, consulta: Record<string, string> = {}) {
    const servicio = {
      procesos: jasmine.createSpy('procesos').and.returnValue(of(datos)),
      reclamar: jasmine.createSpy('reclamar').and.returnValue(of({ id: '9', estado: 'enviada' })),
    };
    TestBed.configureTestingModule({
      imports: [ProcesosHistoricosReclamablesComponent],
      providers: [
        provideRouter([]),
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('31'), esAdministradora: signal(esAdministradora) } },
        { provide: ReclamacionesDeProcesosService, useValue: servicio },
        { provide: CatalogService, useValue: { fetchDivipolaConCodigos: () => of([{ codigo: '41', nombre: 'Huila', municipios: [{ codigo: '41001', nombre: 'Neiva' }] }]) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) } } },
      ],
    });
    const fixture = TestBed.createComponent(ProcesosHistoricosReclamablesComponent);
    fixture.detectChanges();
    return { fixture, servicio, el: fixture.nativeElement as HTMLElement };
  }

  it('al abrir no lista ni sugiere nada: solo el buscador y la instrucción de búsqueda', () => {
    const { el, servicio } = crear(respuesta());
    expect(servicio.procesos).toHaveBeenCalledWith('31', { tipo: '', buscar: '', codigoDepartamento: '', codigoMunicipio: '' });
    expect(el.querySelector('[data-testid="historicos-estado-inicial"]')?.textContent).toContain('Busca por nombre, organizador anterior, municipio, departamento o tipo');
    expect(el.querySelectorAll('[data-testid^="historico-"]').length).toBe(0);
    expect(el.querySelector('[data-testid="historicos-sugeridos"]')).toBeNull();
    expect(el.querySelector('#historicos-buscar')).not.toBeNull();
    // Los cinco tipos se reclaman: no hay nada que decir de tipos que no aplican.
    expect(el.querySelector('[data-testid="historicos-tipos-no-aplican"]')).toBeNull();
  });

  it('con coincidencia fuerte sugiere ese proceso, destacado y con su motivo', () => {
    const fuerte = proceso({ coincidenciaFuerte: true, puntajeDeCoincidencia: 5, motivoDeCoincidencia: 'El organizador se llama igual y queda en el mismo municipio.' });
    const { el } = crear(respuesta({ sugeridos: [fuerte] }));
    expect(el.querySelector('[data-testid="historicos-estado-inicial"]')).toBeNull();
    expect(el.querySelector('[data-testid="historicos-sugeridos"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="coincidencia-fuerte"]')?.textContent).toContain('El organizador se llama igual y queda en el mismo municipio.');
  });

  it('con una búsqueda enseña los resultados de cualquier tipo con su tipo, territorio y ediciones', () => {
    const { el } = crear(respuesta({ hayBusqueda: true, resultados: [proceso(), proceso({ modulo: 'mercados', tipoEtiqueta: 'Mercado musical', id: '8', nombre: 'Mercado de Saberes' })] }), true, { buscar: 'bambuco' });
    expect(el.textContent).toContain('Neiva, Huila');
    expect(el.textContent).toContain('Ediciones 2019, 2018');
    expect(el.querySelector('[data-testid="historico-8"]')?.getAttribute('data-tipo')).toBe('mercados');
    expect(el.querySelector('[data-testid="historicos-cuenta"]')?.textContent).toContain('2 procesos');
  });

  it('sin resultados dice que no hay coincidencias y ofrece limpiar los filtros', () => {
    const { el } = crear(respuesta({ hayBusqueda: true }), true, { buscar: 'zzz' });
    expect(el.querySelector('[data-testid="historicos-sin-resultados"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="historicos-estado-inicial"]')).toBeNull();
  });

  it('los filtros vienen de la URL y al cambiarlos se vuelven a escribir en ella', () => {
    const { fixture, servicio } = crear(respuesta({ hayBusqueda: true }), true, { buscar: 'cuerdas', tipo: 'mercados', departamento: '41', municipio: '41001' });
    expect(servicio.procesos).toHaveBeenCalledWith('31', { tipo: 'mercados', buscar: 'cuerdas', codigoDepartamento: '41', codigoMunicipio: '41001' });
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.cambiar({ departamento: '05' });
    expect(servicio.procesos).toHaveBeenCalledWith('31', { tipo: 'mercados', buscar: 'cuerdas', codigoDepartamento: '05', codigoMunicipio: '' });
    expect(navegar.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({
      queryParams: { buscar: 'cuerdas', tipo: 'mercados', departamento: '05', municipio: null }, replaceUrl: true,
    }));
  });

  it('ofrece los cinco tipos en el filtro, en el orden fijo, y enlaza la ficha pública de cada uno', () => {
    const { el, fixture } = crear(respuesta({ hayBusqueda: true, resultados: [
      proceso({ modulo: 'talleres', tipoEtiqueta: 'Taller de lutería', id: '3', nombre: 'Taller de Luthería Andina' }),
      proceso({ modulo: 'redes', tipoEtiqueta: 'Red o documentación', id: '4', nombre: 'Archivo Sonoro' }),
      proceso({ modulo: 'espacios', tipoEtiqueta: 'Espacio para música en vivo', id: '5', nombre: 'Sala del Río' }),
    ] }), true, { buscar: 'a' });
    expect(fixture.componentInstance.opcionesDeTipo.map(o => o.id)).toEqual(['', 'festivales', 'mercados', 'redes', 'talleres', 'espacios']);
    expect(el.querySelector('[data-testid="historico-3"] a[href="/ecosistema/luteria/3"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="historico-4"] a[href="/ecosistema/redes/4"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="historico-5"] a[href="/ecosistema/espacios/5"]')).not.toBeNull();
  });

  it('pide la administración de una Red, un Taller o un Espacio con su tipo', () => {
    const { fixture, el, servicio } = crear(respuesta({ hayBusqueda: true, resultados: [proceso({ modulo: 'talleres', tipoEtiqueta: 'Taller de lutería', id: '3', nombre: 'Taller de Luthería Andina' })] }), true, { buscar: 'taller' });
    (el.querySelector('[data-testid="historico-3"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const caja = el.querySelector('#justificacion-historico-3') as HTMLTextAreaElement;
    caja.value = 'Lo gestionamos desde 2019.';
    caja.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Enviar solicitud')) as HTMLButtonElement).click();
    expect(servicio.reclamar).toHaveBeenCalledWith('31', '3', 'Lo gestionamos desde 2019.', null, [], 'talleres');
  });

  it('pide la administración de un Mercado con su tipo y deja la tarjeta como «Ya lo pediste»', () => {
    const { fixture, el, servicio } = crear(respuesta({ hayBusqueda: true, resultados: [proceso({ modulo: 'mercados', tipoEtiqueta: 'Mercado musical', id: '8', nombre: 'Mercado de Saberes' })] }), true, { buscar: 'saberes' });
    (el.querySelector('[data-testid="historico-8"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const caja = el.querySelector('#justificacion-historico-8') as HTMLTextAreaElement;
    caja.value = 'Lo organizamos desde 2010.';
    caja.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Enviar solicitud')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(servicio.reclamar).toHaveBeenCalledWith('31', '8', 'Lo organizamos desde 2010.', null, [], 'mercados');
    expect(el.textContent).toContain('Ya lo pediste');
  });

  it('llegando desde la ficha pública busca por su nombre y abre la solicitud (#147, REC-13)', () => {
    const { el, servicio } = crear(respuesta({ hayBusqueda: true, resultados: [proceso()] }), true, { reclamar: '172', buscar: 'Festival del Bambuco', tipo: 'festivales' });
    expect(servicio.procesos).toHaveBeenCalledWith('31', { tipo: 'festivales', buscar: 'Festival del Bambuco', codigoDepartamento: '', codigoMunicipio: '' });
    expect(el.querySelector('#justificacion-historico-172')).not.toBeNull();
    expect(el.querySelector('[data-testid="soportes-de-solicitud"]')).not.toBeNull();
  });

  it('no ofrece pedirlo si otra organización ya tiene una solicitud en curso', () => {
    const { el } = crear(respuesta({ hayBusqueda: true, resultados: [proceso({ reclamacionEnCurso: true })] }), true, { buscar: 'bambuco' });
    expect(el.textContent).toContain('Otra organización ya pidió administrarlo');
    expect(el.textContent).not.toContain('Es mío: pedir administración');
  });

  it('a un editor no le ofrece pedirlo y le explica por qué', () => {
    const { el } = crear(respuesta({ hayBusqueda: true, resultados: [proceso()] }), false, { buscar: 'bambuco' });
    expect(el.textContent).not.toContain('Es mío: pedir administración');
    expect(el.textContent).toContain('Tu rol es editor');
  });

  it('no usa «el PNMC» en sus textos', () => {
    const { el } = crear(respuesta({ hayBusqueda: true, resultados: [proceso()] }), true, { buscar: 'bambuco' });
    (el.querySelector('[data-testid="historico-172"] button') as HTMLButtonElement).click();
    expect(el.textContent).not.toMatch(/Programa/i);
  });
});
