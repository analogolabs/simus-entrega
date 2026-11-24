import { EnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ExternalSessionService } from '../services/external-session.service';
import {
  ConCambiosSinGuardar,
  ConfirmacionDeCambioDeOrganizacion,
  confirmarCambioDeOrganizacion,
  confirmarSalida,
} from './cambio-de-organizacion';

/**
 * La confirmación de salida con cambios sin guardar, que reutiliza el diálogo del
 * cambio de organización de L2. Se prueba la guarda tal cual la llama el enrutador.
 */
describe('confirmarSalida', () => {
  const estado = (url: string) => ({ url }) as RouterStateSnapshot;
  const ruta = {} as ActivatedRouteSnapshot;
  let confirmacion: ConfirmacionDeCambioDeOrganizacion;
  let inyector: EnvironmentInjector;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{
        provide: ExternalSessionService,
        useValue: { organizaciones: signal([{ id: '1', name: 'Caribe' }, { id: '2', name: 'Pacífico' }]) },
      }],
    });
    confirmacion = TestBed.inject(ConfirmacionDeCambioDeOrganizacion);
    inyector = TestBed.inject(EnvironmentInjector);
  });

  const ejecutar = (componente: ConCambiosSinGuardar, desde: string, hacia: string) =>
    runInInjectionContext(inyector, () => confirmarSalida(componente, ruta, estado(desde), estado(hacia)));

  it('sin aviso, deja salir sin preguntar', async () => {
    const componente: ConCambiosSinGuardar = { avisoAlSalir: () => null };

    expect(await ejecutar(componente, '/gestion/o/1/procesos/mercados/nuevo', '/gestion/o/1/resumen')).toBeTrue();
    expect(confirmacion.pendiente()).toBeNull();
  });

  it('con cambios sin guardar pregunta con las palabras de la salida y espera la respuesta', async () => {
    const componente: ConCambiosSinGuardar = { avisoAlSalir: () => 'Se perderá lo escrito.' };

    const decision = ejecutar(componente, '/gestion/o/1/procesos/mercados/nuevo', '/gestion/o/1/resumen');
    expect(confirmacion.pendiente()?.mensaje).toBe('Se perderá lo escrito.');
    expect(confirmacion.pendiente()?.salida?.titulo).toBe('¿Salir sin terminar?');

    confirmacion.responder(false);
    expect(await decision).toBeFalse();
  });

  it('si la persona confirma, hace lo previo a la salida y deja salir', async () => {
    const antes = jasmine.createSpy('antesDeSalir').and.resolveTo();
    const componente: ConCambiosSinGuardar = { avisoAlSalir: () => 'Se perderá lo escrito.', antesDeSalir: antes };

    const decision = ejecutar(componente, '/gestion/cuenta/perfil-publico', '/gestion/cuenta/seguridad');
    confirmacion.responder(true);

    expect(await decision).toBeTrue();
    expect(antes).toHaveBeenCalled();
  });

  it('navegar a la misma pantalla con otros parámetros (el paso del asistente) no es salir', async () => {
    const componente: ConCambiosSinGuardar = { avisoAlSalir: () => 'Se perderá lo escrito.' };

    expect(await ejecutar(componente, '/gestion/o/1/procesos/festivales/nuevo?paso=1', '/gestion/o/1/procesos/festivales/nuevo?paso=2')).toBeTrue();
    expect(confirmacion.pendiente()).toBeNull();
  });

  it('al cambiar de organización usa el aviso de L2, no el de salida', async () => {
    const componente: ConCambiosSinGuardar = {
      avisoAlSalir: () => 'Aviso de salida.',
      avisoAlCambiarDeOrganizacion: (_actual, nueva) => `Se queda como borrador; no pasa a «${nueva}».`,
    };

    const decision = ejecutar(componente, '/gestion/o/1/procesos/festivales/nuevo', '/gestion/o/2/procesos/festivales');
    expect(confirmacion.pendiente()?.mensaje).toContain('«Pacífico»');
    expect(confirmacion.pendiente()?.salida).toBeUndefined();

    confirmacion.responder(true);
    expect(await decision).toBeTrue();
  });

  it('la guarda de L2 sigue sin preguntar dentro de la misma organización', async () => {
    const componente: ConCambiosSinGuardar = { avisoAlCambiarDeOrganizacion: () => 'x' };

    const resultado = await runInInjectionContext(inyector, () =>
      confirmarCambioDeOrganizacion(componente, ruta, estado('/gestion/o/1/a'), estado('/gestion/o/1/b')));
    expect(resultado).toBeTrue();
  });
});
