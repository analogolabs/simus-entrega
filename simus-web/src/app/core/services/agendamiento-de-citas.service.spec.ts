import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import {
  AgendamientoDeCitasService, etiquetaDeEstadoDeAgenda, etiquetaDeEstadoDeCita, etiquetaDeEstadoDeParticipante, etiquetaDeModo, vocabularioDeModo,
} from './agendamiento-de-citas.service';

/**
 * La agenda de citas (docs/referencia/26-agenda-de-citas-y-mercados.md): toda escritura pide primero el testigo de la página y lo manda en la
 * cabecera; las lecturas no lo piden. Si el servicio dejara de mandarlo, el servidor rechazaría todo.
 */
describe('AgendamientoDeCitasService', () => {
  let http: HttpTestingController;
  let servicio: AgendamientoDeCitasService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(AgendamientoDeCitasService);
  });

  afterEach(() => http.verify());

  it('las lecturas no piden el testigo', () => {
    servicio.misAgendas().subscribe();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/api/v1/externo/agendas-de-citas')).flush([]);

    servicio.agendasPublicas().subscribe();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/api/v1/publico/agendas-de-citas')).flush([]);
  });

  it('pedir una cita pide el testigo y lo manda con el cuerpo', () => {
    servicio.pedirCita(7, 3, 12, 'Quiero escucharte.').subscribe();

    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'abc' });
    const peticion = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/agendas-de-citas/7/citas'));
    expect(peticion.request.headers.get('X-CSRF-TOKEN')).toBe('abc');
    expect(peticion.request.body).toEqual({ anfitrionId: 3, franjaId: 12, mensaje: 'Quiero escucharte.' });
    peticion.flush({});
  });

  it('inscribirse, confirmar, rechazar y cancelar mandan el testigo y la ruta de la cita', () => {
    const casos: { nombre: string; llamar: () => void; ruta: string }[] = [
      { nombre: 'inscribirme', llamar: () => servicio.inscribirme(7, { nombre: null, entidad: null, presentacion: 'Música del Pacífico.', enlaces: null, representaA: null, contactoCorreo: null, contactoTelefono: null }).subscribe(), ruta: '/agendas-de-citas/7/inscripcion' },
      { nombre: 'confirmar', llamar: () => servicio.confirmarCita(7, 21).subscribe(), ruta: '/agendas-de-citas/7/citas/21/confirmar' },
      { nombre: 'rechazar', llamar: () => servicio.rechazarCita(7, 21, 'Ese día no puedo.').subscribe(), ruta: '/agendas-de-citas/7/citas/21/rechazar' },
      { nombre: 'cancelar', llamar: () => servicio.cancelarCita(7, 21, 'Se me cruzó una gira.').subscribe(), ruta: '/agendas-de-citas/7/citas/21/cancelar' },
      { nombre: 'retirarme', llamar: () => servicio.retirarme(7, null).subscribe(), ruta: '/agendas-de-citas/7/inscripcion/retirar' },
    ];

    for (const caso of casos) {
      caso.llamar();
      http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: caso.nombre });
      const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith(caso.ruta));
      expect(escritura.request.headers.get('X-CSRF-TOKEN')).withContext(caso.nombre).toBe(caso.nombre);
      escritura.flush({});
    }
  });

  it('las escrituras de la organización van por la organización y llevan el testigo', () => {
    servicio.configurar(5, 9, {
      modo: 'compradores_fijos', duracionMinutos: 20, pausaMinutos: 5, topeSolicitudesPendientes: 5,
      vencimientoSolicitudHoras: 72, cupoArtistas: null, aperturaInscripcionUtc: null, cierreInscripcionUtc: null,
      aprobacionDeArtistas: 'aceptacion',
    }).subscribe();
    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'o' });
    const configuracion = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/api/v1/externo/organizaciones/5/ediciones-de-mercado/9/agenda'));
    expect(configuracion.request.headers.get('X-CSRF-TOKEN')).toBe('o');
    expect(configuracion.request.body.modo).toBe('compradores_fijos');
    expect(configuracion.request.body.aprobacionDeArtistas).toBe('aceptacion');
    configuracion.flush({});

    servicio.cambiarEstado(5, 3, 'abrir').subscribe();
    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'p' });
    const estado = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/organizaciones/5/agendas-de-citas/3/estado'));
    expect(estado.request.body).toEqual({ accion: 'abrir' });
    estado.flush({});
  });

  it('aprobar manda la acción sin motivo y la invitación a un comprador va por su participante', () => {
    servicio.decidirSobreParticipante(5, 3, 8, 'aprobar', null).subscribe();
    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'a' });
    const decision = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/organizaciones/5/agendas-de-citas/3/participantes/8/decision'));
    expect(decision.request.headers.get('X-CSRF-TOKEN')).toBe('a');
    expect(decision.request.body).toEqual({ accion: 'aprobar', motivo: null });
    decision.flush({});

    servicio.emitirInvitacion(5, 3, 9).subscribe();
    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'b' });
    const invitacion = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/organizaciones/5/agendas-de-citas/3/participantes/9/invitacion'));
    expect(invitacion.request.headers.get('X-CSRF-TOKEN')).toBe('b');
    invitacion.flush({ participanteId: 9, enlace: '/ecosistema/invitacion-agenda?testigo=abc', fechaExpiracion: '2026-11-19T00:00:00Z' });
  });

  it('las direcciones del CSV y del calendario son las del servidor', () => {
    expect(servicio.urlDelCsv(5, 3)).toBe('/api/v1/externo/organizaciones/5/agendas-de-citas/3/exportar.csv');
    expect(servicio.urlDelCalendario(3)).toBe('/api/v1/externo/agendas-de-citas/3/mi-agenda.ics');
  });

  it('los estados se dicen en palabras de la persona, no como códigos', () => {
    expect(etiquetaDeEstadoDeAgenda('en_curso')).toBe('En curso');
    expect(etiquetaDeEstadoDeCita('solicitada')).toBe('Esperando respuesta');
    expect(etiquetaDeEstadoDeParticipante('lista_de_espera')).toBe('En lista de espera');
    expect(etiquetaDeEstadoDeParticipante('pendiente')).toBe('Pendiente de aprobación');
    expect(etiquetaDeModo('compradores_fijos')).toBe('Los artistas rotan; los compradores tienen mesa fija');
    expect(etiquetaDeModo('compradores_rotan')).toBe('Los compradores rotan; los artistas tienen stand fijo');
    expect(etiquetaDeEstadoDeCita('inventado')).toBe('Sin estado');
  });

  it('el vocabulario del modo dice quién rota, quién tiene sitio fijo y de qué es el cupo de citas', () => {
    const rotan = vocabularioDeModo('compradores_rotan');
    expect(rotan.rota.plural).toBe('compradores o bookers');
    expect(rotan.fijo.plural).toBe('artistas');
    expect(rotan.sitioFijo).toBe('stand');
    expect(rotan.cupoDeCitas).toBe('Cupo de citas por comprador o booker');

    const fijos = vocabularioDeModo('compradores_fijos');
    expect(fijos.rota.plural).toBe('artistas');
    expect(fijos.sitioFijo).toBe('mesa');
    expect(fijos.cupoDeCitas).toBe('Cupo de citas por artista');
  });
});
