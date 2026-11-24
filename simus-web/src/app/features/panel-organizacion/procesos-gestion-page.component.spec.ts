import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ProcesosGestionPageComponent } from './procesos-gestion-page.component';
import { PanelOrganizacionApi } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { TalleresService } from '../../core/services/talleres.service';
import { EspaciosService } from '../../core/services/espacios.service';
import { RedesService } from '../../core/services/redes.service';

describe('ProcesosGestionPageComponent', () => {
  let fixture: ComponentFixture<ProcesosGestionPageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProcesosGestionPageComponent],
      providers: [
        provideRouter([]),
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('117') } },
        { provide: PanelOrganizacionApi, useValue: { obtenerFestivales: () => of([]), obtenerMercados: () => of([]) } },
        { provide: TalleresService, useValue: { deLaOrganizacion: () => of([]) } },
        { provide: EspaciosService, useValue: { deLaOrganizacion: () => of([]) } },
        { provide: RedesService, useValue: { deLaOrganizacion: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(ProcesosGestionPageComponent);
    fixture.detectChanges();
  });

  it('describe Festival sin etiquetas temporales de disponibilidad', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('información permanente del Festival');
    expect(texto).not.toContain('Disponible ahora');
    expect(texto).not.toContain('Disponible para registrar ahora');
    expect(texto).not.toContain('Aún no disponibles');
  });

  it('Mercado musical ya es un tipo real y no una opción apagada', () => {
    // ESTA PRUEBA ESPERABA CINCO OPCIONES DESHABILITADAS, y tenía razón hasta el 15 de septiembre
    // de 2026: ese día Mercados Musicales dejó de ser un proceso proyectado y pasó a registrarse de
    // verdad, con su asistente, su ficha y su circuito de revisión. Lutería (el taller) pasó igual a
    // registrarse de verdad el 10 de noviembre de 2026, y Espacios para música en vivo igual. Queda uno apagado:
    // el que `CATEGORIAS_ECOSISTEMA` declara «Próximamente» (Escuelas de música quedó fuera ese mismo día).
    fixture.componentInstance.opcionesAbiertas.set(true);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-menu-registrar-mercado]')).not.toBeNull();
    // EL TALLER DE LUTERÍA ES UNA OPCIÓN REAL Y LLEVA A SU ALTA.
    expect(raiz.querySelector('[data-menu-registrar-taller]')).not.toBeNull();
    // Y EL ESPACIO PARA MÚSICA EN VIVO TAMBIÉN.
    expect(raiz.querySelector('[data-menu-registrar-espacio]')).not.toBeNull();
    // REDES Y DOCUMENTACIÓN TAMBIÉN: una opción real que lleva a su alta.
    expect(raiz.querySelector('[data-menu-registrar-red]')).not.toBeNull();
    expect(raiz.querySelectorAll('button[role="menuitem"]:disabled').length).toBe(0);
    const apagados = Array.from(raiz.querySelectorAll('button[role="menuitem"]:disabled')).map(b => b.textContent ?? '');
    expect(apagados.some(texto => texto.includes('Espacios para música en vivo'))).toBeFalse();
    expect(apagados.some(texto => /escuelas/i.test(texto))).toBeFalse();
    expect(apagados.some(texto => texto.includes('Lutería'))).toBeFalse();
    expect(apagados.some(texto => texto.includes('Redes y documentación'))).toBeFalse();
    expect(raiz.textContent).not.toContain('Próximamente');
    expect(raiz.textContent).not.toContain('en construcción');
  });

  it('la lista vacía ofrece los dos tipos que ya se pueden registrar', () => {
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('[data-registrar-mercado]')).not.toBeNull();
    expect(raiz.textContent).toContain('Mercado musical');
  });

  it('LIS-02: una sola lista con los cinco tipos, sin bloques por tipo', () => {
    const c = fixture.componentInstance;
    c.festivales.set([{ id: '92', nombre: 'Festival del Río', estado: 'Borrador' }]);
    c.mercados.set([{ id: 7, nombre: 'Mercado del Mar', estadoRegistro: 'publicado', numeroDeEdiciones: 1 } as never]);
    c.talleres.set([{ id: 3, nombre: 'Taller Los Andes', estadoRegistro: 'borrador', modalidad: 'fijo' } as never]);
    c.espacios.set([{ id: 4, nombre: 'Sala Central', estadoRegistro: 'en_revision', ambiente: 'cerrado' } as never]);
    c.redes.set([{ id: 5, nombre: 'Red de archivos', estadoRegistro: 'ajustes_solicitados', tipoDeNodo: 'red' } as never]);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const filas = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('[data-proceso-tipo]'));
    // Por omisión se ordena por estado, lo más urgente primero: ajustes, revisión, borrador (festival, taller) y publicado.
    expect(filas.map(f => f.getAttribute('data-proceso-tipo'))).toEqual(['redes', 'espacios', 'festivales', 'luteria', 'mercados']);
    expect(filas.map(f => f.getAttribute('href'))).toEqual([
      '/gestion/o/117/procesos/redes/5', '/gestion/o/117/procesos/espacios/4', '/gestion/o/117/procesos/festivales/92',
      '/gestion/o/117/procesos/luteria/3', '/gestion/o/117/procesos/mercados/7']);
    // SIN CABECERAS DE GRUPO NI INSIGNIAS DE LETRA: el tipo se lee en la propia fila.
    expect(raiz.querySelector('#festivales-titulo')).toBeNull();
    // Es una tabla de gestión: una fila por proceso, sin cabeceras de grupo.
    expect(raiz.querySelectorAll('tbody tr[data-fila]').length).toBe(filas.length);
    const pestanas = Array.from(raiz.querySelectorAll<HTMLElement>('[role="tab"]')).map(t => t.textContent?.replace(/\s+/g, ''));
    expect(pestanas[0]).toBe('Todos5');
  });

  it('con un tipo elegido solo quedan sus filas y Festivales ofrece su administración', () => {
    const c = fixture.componentInstance;
    c.festivales.set([{ id: '92', nombre: 'Festival del Río', estado: 'Borrador' }]);
    c.talleres.set([{ id: 3, nombre: 'Taller Los Andes', estadoRegistro: 'borrador', modalidad: 'fijo' } as never]);
    c.tipoFiltro.set('festivales');
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('[data-proceso-tipo]').length).toBe(1);
    const enlace = raiz.querySelector<HTMLAnchorElement>('[data-administrar-festivales]');
    expect(enlace?.textContent).toContain('Administrar Festivales');
    expect(enlace?.getAttribute('href')).toBe('/gestion/o/117/procesos/festivales');

    c.tipoFiltro.set('luteria');
    fixture.detectChanges();
    expect(raiz.querySelector('[data-administrar-festivales]')).toBeNull();
    expect(raiz.querySelectorAll('[data-proceso-tipo="luteria"]').length).toBe(1);
  });

  it('un tipo sin procesos deja el mensaje de que nada coincide', () => {
    fixture.componentInstance.festivales.set([{ id: '92', nombre: 'Festival del Río', estado: 'Borrador' }]);
    fixture.componentInstance.tipoFiltro.set('mercados');
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-administrar-festivales]')).toBeNull();
    expect(raiz.textContent).toContain('No hay procesos que coincidan.');
  });

  it('la barra de filtros usa las piezas comunes y ningún control suelto', () => {
    // UI-C. MUTANTE QUE MATA: volver a un <input> o <select> con su caja propia (medían 21 px y radio 0).
    fixture.componentInstance.festivales.set([{ id: '92', nombre: 'Festival del Río', estado: 'Borrador' }]);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const barra = raiz.querySelector('[data-barra-de-lista]')!;
    expect(barra.querySelectorAll('select').length).toBe(0);
    // P3: UN buscador (nombre o territorio), el estado y «Ordenar por».
    expect(barra.querySelectorAll('app-buscador-de-lista').length).toBe(1);
    expect(barra.querySelectorAll('app-filtro-desplegable').length).toBe(2);
    expect(barra.querySelectorAll('app-orden-de-lista').length).toBe(1);
    const alturas = Array.from(barra.querySelectorAll<HTMLElement>('input, .filtro__control'))
      .map(el => Math.round(el.getBoundingClientRect().height));
    expect(alturas.length).toBe(3);
    for (const altura of alturas) { expect(altura).toBe(36); }
  });

  it('P3: el buscador único encuentra por territorio, «Quitar filtros» lo reinicia y la tabla se ordena por sus encabezados', () => {
    const c = fixture.componentInstance;
    c.festivales.set([
      { id: '92', nombre: 'Festival del Río', estado: 'Borrador', nombreMunicipio: 'Silvia', nombreDepartamento: 'Cauca' } as never,
      { id: '93', nombre: 'Festival del Mar', estado: 'Publicado', nombreMunicipio: 'Tumaco', nombreDepartamento: 'Nariño' } as never,
    ]);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const nombres = () => Array.from(raiz.querySelectorAll('tbody .tg-titulo')).map(a => a.textContent?.trim());
    expect(nombres()).toEqual(['Festival del Río', 'Festival del Mar']);

    c.busqueda.set('tumaco');
    fixture.detectChanges();
    expect(nombres()).toEqual(['Festival del Mar']);
    expect(raiz.querySelector('[data-cuenta-de-lista]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 de 2 · Quitar filtros');
    (raiz.querySelector('[data-quitar-filtros]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(c.busqueda()).toBe('');
    expect(nombres().length).toBe(2);

    (raiz.querySelector('[data-ordenar="nombre"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(nombres()).toEqual(['Festival del Mar', 'Festival del Río']);
    expect(raiz.querySelector('th[aria-sort="ascending"]')?.textContent).toContain('Nombre');
  });

  it('las pestañas son el tipo de proceso, con conteo y en el orden del Ecosistema; el estado es un filtro', () => {
    fixture.componentInstance.festivales.set([
      { id: '92', nombre: 'Festival del Río', estado: 'Borrador' },
      { id: '93', nombre: 'Festival del Mar', estado: 'Publicado' },
    ]);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const pestanas = Array.from(raiz.querySelectorAll<HTMLElement>('[role="tab"]')).map(t => t.textContent?.replace(/\s+/g, ''));
    expect(pestanas).toEqual(['Todos2', 'Festivales2', 'Mercados0', 'Redesydocumentación0', 'Lutería0', 'Espaciosparamúsicaenvivo0']);
    expect(fixture.componentInstance.opcionesDeEstado().map(o => [o.id, o.conteo])).toEqual([['todos', 2], ['borrador', 1], ['publicado', 1]]);

    fixture.componentInstance.estadoFiltro.set('publicado');
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Festival del Mar');
    expect(raiz.textContent).not.toContain('Festival del Río');
    expect(raiz.querySelectorAll('[role="tablist"]').length).toBe(1);
  });

  it('un solo h1, «Procesos», con un contador en texto y sin recuadros de cifras', () => {
    fixture.componentInstance.festivales.set([{ id: '92', nombre: 'Festival del Río', estado: 'EnRevision' }]);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(Array.from(raiz.querySelectorAll('h1')).map(h => h.textContent?.trim())).toEqual(['Procesos']);
    expect(raiz.querySelector('[data-testid="contador-de-la-pantalla"]')?.textContent).toContain('1 proceso · 1 en revisión');
  });
});

describe('ProcesosGestionPageComponent en Mi espacio (PANEL, decisión 126)', () => {
  it('es la misma lista con pestañas por tipo, solo con Lutería, Espacios y Redes, y lleva a las fichas de la persona', () => {
    TestBed.configureTestingModule({
      imports: [ProcesosGestionPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { responsable: 'persona' }, queryParamMap: convertToParamMap({ tipo: 'luteria' }) } } },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('') } },
        { provide: PanelOrganizacionApi, useValue: {} },
        { provide: TalleresService, useValue: { mios: () => of([{ id: 3, nombre: 'Taller del Valle', estadoRegistro: 'borrador', nivelCobertura: 'municipal' }]) } },
        { provide: EspaciosService, useValue: { mios: () => of([]) } },
        { provide: RedesService, useValue: { mios: () => of([{ id: 5, nombre: 'Archivo del Valle', estadoRegistro: 'publicado', nivelCobertura: 'municipal' }]) } },
      ],
    });
    const fixture = TestBed.createComponent(ProcesosGestionPageComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(Array.from(raiz.querySelectorAll('[role="tab"]')).map(t => t.textContent?.replace(/\s+/g, ''))).toEqual(['Todos2', 'Redesydocumentación1', 'Lutería1', 'Espaciosparamúsicaenvivo0']);
    // `?tipo=luteria` abre su pestaña: solo el taller.
    expect(Array.from(raiz.querySelectorAll('[data-proceso-tipo]')).map(a => a.getAttribute('href'))).toEqual(['/gestion/cuenta/talleres/3']);
    fixture.componentInstance.tipoFiltro.set('todos');
    fixture.detectChanges();
    expect(Array.from(raiz.querySelectorAll('[data-proceso-tipo]')).map(a => a.getAttribute('href'))).toEqual(['/gestion/cuenta/talleres/3', '/gestion/cuenta/redes/5']);
    expect(Array.from(raiz.querySelectorAll('h1')).map(h => h.textContent?.trim())).toEqual(['Procesos']);
  });

  it('PROP: con ?tipo= en la dirección abre filtrada por ese tipo y las listas por tipo ya no tienen pantalla propia', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProcesosGestionPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ tipo: 'luteria' }) } } },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('117') } },
        { provide: PanelOrganizacionApi, useValue: { obtenerFestivales: () => of([]), obtenerMercados: () => of([]) } },
        { provide: TalleresService, useValue: { deLaOrganizacion: () => of([]) } },
        { provide: EspaciosService, useValue: { deLaOrganizacion: () => of([]) } },
        { provide: RedesService, useValue: { deLaOrganizacion: () => of([]) } },
      ],
    });
    const filtrada = TestBed.createComponent(ProcesosGestionPageComponent);
    filtrada.detectChanges();
    expect(filtrada.componentInstance.tipoFiltro()).toBe('luteria');

    // UN TIPO QUE NO EXISTE SE IGNORA: la lista abre con todos.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProcesosGestionPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ tipo: 'inventado' }) } } },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('117') } },
        { provide: PanelOrganizacionApi, useValue: { obtenerFestivales: () => of([]), obtenerMercados: () => of([]) } },
        { provide: TalleresService, useValue: { deLaOrganizacion: () => of([]) } },
        { provide: EspaciosService, useValue: { deLaOrganizacion: () => of([]) } },
        { provide: RedesService, useValue: { deLaOrganizacion: () => of([]) } },
      ],
    });
    const todos = TestBed.createComponent(ProcesosGestionPageComponent);
    todos.detectChanges();
    expect(todos.componentInstance.tipoFiltro()).toBe('todos');
  });
});
