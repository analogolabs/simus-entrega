import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  ETIQUETAS_ESTADO_RED,
  GuardarRedSolicitud,
  RedesService,
  etiquetaDeEstadoDeRed,
  etiquetaDeTipoDeNodo,
} from './redes.service';

/**
 * El servicio de redes y documentación: a qué ruta va cada acción y con qué testigo.
 *
 * <b>LO QUE SE FIJA.</b> Que la red de una organización y el de una persona vayan a rutas
 * distintas —la organización la pone la ruta, no el cuerpo—, que toda escritura mande el testigo
 * antiforgery, y que las decisiones de la consola usen el de la consola.
 */
describe('RedesService', () => {
  let http: HttpTestingController;
  let servicio: RedesService;

  const solicitud: GuardarRedSolicitud = {
    nombre: 'Red de prueba', descripcion: null, tipoDeNodo: 'red', accesoAbierto: false,
    acervosYColecciones: null, correoRed: null, telefonoRed: null, sitioWebRed: null,
    instagramRed: null, facebookRed: null, otroEnlaceRed: null, nivelCobertura: 'nacional',
    codigoDepartamento: null, codigoMunicipio: null, lugarEspecifico: null,
    formasDeAccesoIds: [1], formatosIds: [2], practicasMusicalesIds: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(RedesService);
  });

  afterEach(() => http.verify());

  it('la red de una organización se crea en la ruta de esa organización, con testigo', () => {
    servicio.crear(77, solicitud).subscribe();

    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'tok' });
    const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/organizaciones/77/redes'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('tok');
    expect(escritura.request.body).toEqual(solicitud);
    escritura.flush({});
  });

  it('la red de una persona sin organización se crea en «mis redes»', () => {
    servicio.crear(null, solicitud).subscribe();

    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'tok' });
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/mis-redes')).flush({});
  });

  it('guardar, enviar, retirar de la revisión y retirar uno publicado mandan el testigo', () => {
    servicio.guardar(5, solicitud).subscribe();
    http.expectOne(r => r.url.endsWith('/csrf')).flush({ requestToken: 'a' });
    expect(http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/api/v1/externo/redes/5')).request.headers.get('X-CSRF-TOKEN')).toBe('a');

    servicio.enviarARevision(5).subscribe();
    http.expectOne(r => r.url.endsWith('/csrf')).flush({ requestToken: 'b' });
    expect(http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/redes/5/enviar-a-revision')).request.headers.get('X-CSRF-TOKEN')).toBe('b');

    servicio.retirarDeRevisionOAbandonar(5).subscribe();
    http.expectOne(r => r.url.endsWith('/csrf')).flush({ requestToken: 'c' });
    expect(http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/api/v1/externo/redes/5')).request.headers.get('X-CSRF-TOKEN')).toBe('c');

    servicio.retirarPublicado(5, 'Cierro la red.').subscribe();
    http.expectOne(r => r.url.endsWith('/csrf')).flush({ requestToken: 'd' });
    const retiro = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/redes/5/retirar'));
    expect(retiro.request.body).toEqual({ motivo: 'Cierro la red.' });
    expect(retiro.request.headers.get('X-CSRF-TOKEN')).toBe('d');
  });

  it('la decisión de la consola pide el testigo de la consola y manda el motivo', async () => {
    const promesa = servicio.decidir(9, 'ajustes', 'Falta el barrio.');

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: 'consola' });
    await Promise.resolve();
    await Promise.resolve();
    const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/institucional/redes/9/decision'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('consola');
    expect(escritura.request.body).toEqual({ decision: 'ajustes', motivo: 'Falta el barrio.' });
    escritura.flush({ id: 9 });
    expect(await promesa).toEqual(jasmine.objectContaining({ id: 9 }));
  });

  it('la lista de la consola manda los filtros que se eligieron y no los que no', () => {
    servicio.listarEnLaConsola({ estado: 'en_revision', responsable: 'persona' }).subscribe();

    const lectura = http.expectOne(r => r.url.endsWith('/api/v1/institucional/redes'));
    expect(lectura.request.params.get('estado')).toBe('en_revision');
    expect(lectura.request.params.get('responsable')).toBe('persona');
    expect(lectura.request.params.has('q')).toBeFalse();
    lectura.flush({ items: [], total: 0, limit: 25, offset: 0 });
  });

  it('las palabras de los estados son las del circuito editorial', () => {
    expect(ETIQUETAS_ESTADO_RED.en_revision).toBe('En revisión');
    expect(etiquetaDeEstadoDeRed('ajustes_solicitados')).toBe('Ajustes solicitados');
    expect(etiquetaDeEstadoDeRed('inventado')).toBe('Sin estado');
    expect(etiquetaDeTipoDeNodo('archivo')).toBe('Archivo');
  });
});
