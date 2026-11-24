import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
import { PropuestasDeProcesoService } from '../../../core/services/propuestas-de-proceso.service';
import { ProcesosDeLaConsolaService } from '../../../core/services/procesos-de-la-consola.service';
import { SessionService } from '../../../core/services/session.service';
import { BandejaDeTrabajoService } from './bandeja-de-trabajo.service';

/**
 * La bandeja solo pide y cuenta lo de los módulos concedidos.
 *
 * «Solicitudes» la tiene toda cuenta, pero cada cola es trabajo de un módulo. Un gestor sin Agenda
 * veía —y publicaba— eventos desde aquí. El servidor responde ahora 403; la bandeja, además, no pide
 * la cola, de modo que ni ella ni el Resumen ni la barra prometen decisiones que la cuenta no puede
 * tomar.
 */
describe('BandejaDeTrabajoService · colas por módulo', () => {
  let bandeja: BandejaDeTrabajoService;
  let admin: jasmine.SpyObj<AdminService>;
  let propuestas: jasmine.SpyObj<PropuestasDeProcesoService>;
  let procesos: jasmine.SpyObj<ProcesosDeLaConsolaService>;

  beforeEach(() => {
    admin = jasmine.createSpyObj<AdminService>('AdminService', [
      'cargarBandejaDeFestivales', 'cargarBandejaDePropuestas',
      'cargarEventosEnRevision', 'cargarSolicitudesDeVinculacion', 'cargarReclamacionesDeAdministracion',
      'cargarPosiblesDuplicados', 'cargarAlertasDeCalidad',
    ]);
    admin.cargarBandejaDeFestivales.and.returnValue(of([]));
    admin.cargarBandejaDePropuestas.and.returnValue(of([]));
    admin.cargarEventosEnRevision.and.returnValue(of([]));
    admin.cargarSolicitudesDeVinculacion.and.returnValue(of({ items: [], limit: 50, offset: 0, total: 0 }));
    admin.cargarReclamacionesDeAdministracion.and.returnValue(of([]));
    admin.cargarPosiblesDuplicados.and.returnValue(of({ items: [], limit: 50, offset: 0, total: 0 }));
    admin.cargarAlertasDeCalidad.and.returnValue(of({ items: [], limit: 50, offset: 0, total: 0 }));
    propuestas = jasmine.createSpyObj<PropuestasDeProcesoService>('PropuestasDeProcesoService', ['enRevision']);
    propuestas.enRevision.and.returnValue(of([]));

    procesos = jasmine.createSpyObj<ProcesosDeLaConsolaService>('ProcesosDeLaConsolaService', ['enRevision']);
    procesos.enRevision.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        { provide: ProcesosDeLaConsolaService, useValue: procesos },
        { provide: AdminService, useValue: admin },
        { provide: PropuestasDeProcesoService, useValue: propuestas },
        { provide: SessionService, useValue: { isAuthenticated: () => true } },
      ],
    });
    bandeja = TestBed.inject(BandejaDeTrabajoService);
  });

  it('sin módulos concedidos no pide las colas de Agenda, Ecosistema ni Mercados', () => {
    bandeja.fijarModulos(['monitor', 'solicitudes']);
    bandeja.recargar();

    expect(admin.cargarEventosEnRevision).not.toHaveBeenCalled();
    expect(admin.cargarBandejaDeFestivales).not.toHaveBeenCalled();
    expect(admin.cargarBandejaDePropuestas).not.toHaveBeenCalled();
    expect(admin.cargarReclamacionesDeAdministracion).not.toHaveBeenCalled();
    expect(propuestas.enRevision).not.toHaveBeenCalled();
    // Las que comparten ruta entre módulos se piden siempre: el servidor filtra fila a fila.
    expect(admin.cargarSolicitudesDeVinculacion).toHaveBeenCalled();
  });

  it('una cola de un módulo que se retiró se vacía, no se queda con lo de antes', () => {
    bandeja.eventos.set([{ id: '1', titulo: 'Evento de antes' } as never]);
    bandeja.fijarModulos(['monitor', 'solicitudes']);
    bandeja.recargar();

    expect(bandeja.eventos()).toEqual([]);
    expect(bandeja.colaCompleta().some(fila => fila.kind === 'evento')).toBeFalse();
  });

  it('con Agenda pide los eventos, y solo eso', () => {
    bandeja.fijarModulos(['monitor', 'solicitudes', 'agenda']);
    bandeja.recargar();

    expect(admin.cargarEventosEnRevision).toHaveBeenCalled();
    expect(admin.cargarBandejaDeFestivales).not.toHaveBeenCalled();
  });

  it('mientras no se saben los módulos, pide todo, como la barra', () => {
    bandeja.recargar();

    expect(admin.cargarEventosEnRevision).toHaveBeenCalled();
    expect(admin.cargarBandejaDeFestivales).toHaveBeenCalled();
    expect(propuestas.enRevision).toHaveBeenCalledWith('mercados');
  });

  // DECISIÓN 123: Taller, Espacio y Red entran a la bandeja con la misma fila que cualquier registro nuevo.
  it('con los módulos de Talleres, Espacios y Redes pide cada cola y las junta como registros nuevos', () => {
    const fila = (id: number, nombre: string) => ({ id, nombre, organizacionNombre: 'Cuerdas del Sur', responsableNombre: null, fechaEnvioARevision: '2026-11-16T10:00:00Z' });
    procesos.enRevision.and.callFake(tipo => of(tipo === 'talleres' ? [fila(7, 'Taller Los Cedros') as never] : tipo === 'redes' ? [fila(3, 'Red de archivos') as never] : []));
    bandeja.fijarModulos(['solicitudes', 'talleres', 'redes']);
    bandeja.recargar();

    expect(procesos.enRevision).toHaveBeenCalledWith('talleres');
    expect(procesos.enRevision).toHaveBeenCalledWith('redes');
    expect(procesos.enRevision).not.toHaveBeenCalledWith('espacios');
    const filas = bandeja.colaCompleta().filter(item => item.kind === 'revision');
    expect(filas.map(item => item.id)).toEqual(['review-talleres-7', 'review-redes-3']);
    expect(filas[0].type).toBe('Taller de lutería en revisión');
    expect(filas[0].organization).toBe('Cuerdas del Sur');
    expect(filas[1].module).toBe('redes');
  });

  it('al vaciar la bandeja no quedan procesos de la sesión anterior', () => {
    bandeja.procesosEnRevision.set({ talleres: [{ id: 1, nombre: 'X' } as never], espacios: [], redes: [] });
    bandeja.vaciar();
    expect(bandeja.colaCompleta().filter(item => item.kind === 'revision')).toEqual([]);
  });
});
