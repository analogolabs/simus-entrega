import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  ETIQUETAS_ESTADO_ESPACIO,
  GuardarEspacioSolicitud,
  EspaciosService,
  etiquetaDeEstadoDeEspacio,
  etiquetaDeAmbiente,
} from './espacios.service';

/**
 * El servicio de espacios para música en vivo: a qué ruta va cada acción y con qué testigo.
 *
 * <b>LO QUE SE FIJA.</b> Que el espacio de una organización y el de una persona vayan a rutas
 * distintas —la organización la pone la ruta, no el cuerpo—, que toda escritura mande el testigo
 * antiforgery, y que las decisiones de la consola usen el de la consola.
 */
describe('EspaciosService', () => {
  let http: HttpTestingController;
  let servicio: EspaciosService;

  const solicitud: GuardarEspacioSolicitud = {
    nombre: 'Espacio de prueba', descripcion: null, ambiente: 'cerrado', aforoMaximo: null, esAccesible: false,
    horarioYProgramacion: null, correoEspacio: null, telefonoEspacio: null, sitioWebEspacio: null,
    instagramEspacio: null, facebookEspacio: null, otroEnlaceEspacio: null, nivelCobertura: 'municipal',
    codigoDepartamento: '19', codigoMunicipio: '19001', lugarEspecifico: 'Calle 5 # 3-20',
    equipamientoIds: [1], tiposIds: [2], practicasMusicalesIds: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(EspaciosService);
  });

  afterEach(() => http.verify());

  it('el espacio de una organización se crea en la ruta de esa organización, con testigo', () => {
    servicio.crear(77, solicitud).subscribe();

    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'tok' });
    const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/organizaciones/77/espacios'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('tok');
    expect(escritura.request.body).toEqual(solicitud);
    escritura.flush({});
  });

  it('el espacio de una persona sin organización se crea en «mis espacios»', () => {
    servicio.crear(null, solicitud).subscribe();

    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'tok' });
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/mis-espacios')).flush({});
  });

  it('guardar, enviar, retirar de la revisión y retirar uno publicado mandan el testigo', () => {
    servicio.guardar(5, solicitud).subscribe();
    http.expectOne(r => r.url.endsWith('/csrf')).flush({ requestToken: 'a' });
    expect(http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/api/v1/externo/espacios/5')).request.headers.get('X-CSRF-TOKEN')).toBe('a');

    servicio.enviarARevision(5).subscribe();
    http.expectOne(r => r.url.endsWith('/csrf')).flush({ requestToken: 'b' });
    expect(http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/espacios/5/enviar-a-revision')).request.headers.get('X-CSRF-TOKEN')).toBe('b');

    servicio.retirarDeRevisionOAbandonar(5).subscribe();
    http.expectOne(r => r.url.endsWith('/csrf')).flush({ requestToken: 'c' });
    expect(http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/api/v1/externo/espacios/5')).request.headers.get('X-CSRF-TOKEN')).toBe('c');

    servicio.retirarPublicado(5, 'Cierro el espacio.').subscribe();
    http.expectOne(r => r.url.endsWith('/csrf')).flush({ requestToken: 'd' });
    const retiro = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/espacios/5/retirar'));
    expect(retiro.request.body).toEqual({ motivo: 'Cierro el espacio.' });
    expect(retiro.request.headers.get('X-CSRF-TOKEN')).toBe('d');
  });

  it('la decisión de la consola pide el testigo de la consola y manda el motivo', async () => {
    const promesa = servicio.decidir(9, 'ajustes', 'Falta el barrio.');

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: 'consola' });
    await Promise.resolve();
    await Promise.resolve();
    const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/institucional/espacios/9/decision'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('consola');
    expect(escritura.request.body).toEqual({ decision: 'ajustes', motivo: 'Falta el barrio.' });
    escritura.flush({ id: 9 });
    expect(await promesa).toEqual(jasmine.objectContaining({ id: 9 }));
  });

  it('la lista de la consola manda los filtros que se eligieron y no los que no', () => {
    servicio.listarEnLaConsola({ estado: 'en_revision', responsable: 'persona' }).subscribe();

    const lectura = http.expectOne(r => r.url.endsWith('/api/v1/institucional/espacios'));
    expect(lectura.request.params.get('estado')).toBe('en_revision');
    expect(lectura.request.params.get('responsable')).toBe('persona');
    expect(lectura.request.params.has('q')).toBeFalse();
    lectura.flush({ items: [], total: 0, limit: 25, offset: 0 });
  });

  it('las palabras de los estados son las del circuito editorial', () => {
    expect(ETIQUETAS_ESTADO_ESPACIO.en_revision).toBe('En revisión');
    expect(etiquetaDeEstadoDeEspacio('ajustes_solicitados')).toBe('Ajustes solicitados');
    expect(etiquetaDeEstadoDeEspacio('inventado')).toBe('Sin estado');
    expect(etiquetaDeAmbiente('abierto')).toBe('Al aire libre');
  });
});
