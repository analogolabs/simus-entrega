import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { PanelOrganizacionStore } from '../panel-organizacion.store';
import { CatalogService } from '../../../core/services/catalog.service';
import { ReclamacionDeFestival, ReclamacionesDeProcesosService } from '../reclamaciones-de-procesos.service';
import { ProcesosHistoricosReclamablesComponent } from '../procesos-historicos-reclamables.component';
import { ProcesosHistoricosPageComponent } from './procesos-historicos-page.component';

/**
 * «Procesos históricos» como herramienta aparte (decisión 74): qué es, mis solicitudes y la búsqueda.
 */
describe('ProcesosHistoricosPageComponent', () => {
  const solicitud = (cambios: Partial<ReclamacionDeFestival> = {}): ReclamacionDeFestival => ({
    id: '9', dominio: 'festival', registroCanonicoId: '172', estado: 'enviada', justificacion: 'Lo organizamos desde 2010.',
    fechaCreacion: '2026-11-10T15:00:00Z', registroNombre: 'Festival del Bambuco', ...cambios,
  });

  function crear(reclamaciones: ReclamacionDeFestival[] | 'falla', consulta: Record<string, string> = {}, variasOrganizaciones = true) {
    const servicio = {
      procesos: jasmine.createSpy('procesos').and.returnValue(of({ hayBusqueda: false, tipos: [], resultados: [], sugeridos: [], avisoDelTipo: null })),
      reclamaciones: jasmine.createSpy('reclamaciones').and.returnValue(reclamaciones === 'falla' ? throwError(() => new Error('x')) : of(reclamaciones)),
      reclamar: jasmine.createSpy('reclamar'),
    };
    TestBed.configureTestingModule({
      imports: [ProcesosHistoricosPageComponent],
      providers: [
        provideRouter([]),
        { provide: PanelOrganizacionStore, useValue: {
          organizacionId: signal('31'), esAdministradora: signal(true), hayVariasOrganizaciones: signal(variasOrganizaciones),
          organizacionElegida: () => ({ id: '31', name: 'Corporación Cantaclaro', role: 'administrador' }),
        } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) } } },
        { provide: ReclamacionesDeProcesosService, useValue: servicio },
        { provide: CatalogService, useValue: { fetchDivipolaConCodigos: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(ProcesosHistoricosPageComponent);
    fixture.detectChanges();
    return { fixture, servicio, el: fixture.nativeElement as HTMLElement };
  }

  it('explica qué es la herramienta y enlaza al asistente de alta y a Herramientas', () => {
    const { el } = crear([]);
    const texto = el.textContent ?? '';
    expect(texto).toContain('Procesos históricos');
    expect(texto).toContain('Lutería o Espacios para música en vivo');
    expect(texto).not.toContain('Programa');
    expect(el.querySelector('a[href="/gestion/o/31/herramientas"]')).not.toBeNull();
    expect(el.querySelector('a[href="/gestion/o/31/procesos/festivales/nuevo"]')).not.toBeNull();
  });

  it('muestra mis solicitudes con su estado y, si siguen abiertas, el enlace a Solicitudes', () => {
    const { el, servicio } = crear([solicitud(), solicitud({ id: '10', registroNombre: 'Festival de la Guabina', estado: 'requiere_aclaracion' })]);
    expect(servicio.reclamaciones).toHaveBeenCalledWith('31');
    const texto = el.textContent ?? '';
    expect(texto).toContain('Festival del Bambuco');
    expect(texto).toContain('Enviada');
    expect(texto).toContain('Requiere aclaración');
    expect(el.querySelectorAll('[data-testid="historicos-mis-solicitudes"] a[href="/gestion/o/31/solicitudes"]').length).toBe(2);
  });

  it('una solicitud rechazada dice el motivo y no ofrece volver a Solicitudes', () => {
    const { el } = crear([solicitud({ estado: 'rechazada', motivoDecision: 'No hay soporte suficiente.' })]);
    const texto = el.textContent ?? '';
    expect(texto).toContain('Rechazada');
    expect(texto).toContain('Motivo: No hay soporte suficiente.');
    expect(el.querySelector('[data-testid="historicos-mis-solicitudes"] a[href="/gestion/o/31/solicitudes"]')).toBeNull();
  });

  it('sin solicitudes lo dice, y si la consulta falla no rompe la página', () => {
    expect(crear([]).el.textContent).toContain('Todavía no has pedido la administración');
    TestBed.resetTestingModule();
    const { el } = crear('falla');
    expect(el.textContent).toContain('Todavía no has pedido la administración');
  });

  it('incluye la búsqueda de procesos históricos y al abrir NO pide ni lista ningún proceso por criterio', () => {
    const { el, servicio } = crear([]);
    expect(el.querySelector('app-procesos-historicos-reclamables')).not.toBeNull();
    expect(servicio.procesos).toHaveBeenCalledWith('31', { tipo: '', buscar: '', codigoDepartamento: '', codigoMunicipio: '' });
  });

  it('con un Festival pedido dice con qué organización se pide y deja cambiarla si hay varias (decisión 90)', () => {
    const { el } = crear([], { reclamar: '107', buscar: 'Festival del Bambuco' }, true);
    const aviso = el.querySelector('[data-testid="historicos-organizacion-elegida"]');
    expect(aviso?.textContent).toContain('Vas a pedir la administración de «Festival del Bambuco» con');
    expect(aviso?.textContent).toContain('«Corporación Cantaclaro»');
    const cambiar = el.querySelector('[data-testid="historicos-cambiar-organizacion"]');
    expect(cambiar?.getAttribute('href')).toBe('/gestion/cuenta/herramientas/procesos-historicos?reclamar=107&buscar=Festival%20del%20Bambuco');
  });

  it('con una sola organización dice cuál usa y no ofrece cambiarla', () => {
    const { el } = crear([], { reclamar: '107', buscar: 'Festival del Bambuco' }, false);
    expect(el.querySelector('[data-testid="historicos-organizacion-elegida"]')?.textContent).toContain('«Corporación Cantaclaro»');
    expect(el.querySelector('[data-testid="historicos-cambiar-organizacion"]')).toBeNull();
  });

  it('sin un Festival pedido no enseña el aviso de la organización', () => {
    expect(crear([]).el.querySelector('[data-testid="historicos-organizacion-elegida"]')).toBeNull();
  });

  it('al enviarse una solicitud nueva refresca «Mis solicitudes» sin recargar la página (D-03)', () => {
    const { fixture, servicio, el } = crear([]);
    expect(el.textContent).toContain('Todavía no has pedido la administración');
    servicio.reclamaciones.and.returnValue(of([solicitud({ registroNombre: 'Festival de la Guabina' })]));
    const hijo = fixture.debugElement.query(By.directive(ProcesosHistoricosReclamablesComponent)).componentInstance as ProcesosHistoricosReclamablesComponent;
    hijo.solicitudEnviada.emit();
    fixture.detectChanges();
    expect(servicio.reclamaciones).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Festival de la Guabina');
    expect(el.textContent).not.toContain('Todavía no has pedido la administración');
  });
});
