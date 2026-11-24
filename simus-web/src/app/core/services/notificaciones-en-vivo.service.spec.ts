import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  INTERVALO_NOTIFICACIONES_MS,
  NotificacionEnVivo,
  NotificacionesEnVivoService,
  destinoExternoDe,
  destinoInstitucionalDe,
  organizacionNombreDelAviso,
} from './notificaciones-en-vivo.service';

const AJUSTE: NotificacionEnVivo = {
  id: '1', recipientUserId: '9', recipientEmail: 'persona@example.org',
  eventType: 'FestivalCambiosPedidosPorCampo', channel: 'internal',
  title: 'Sugerencias de ajuste', body: 'Revisa tres campos.', status: 'enviada',
  moduleId: 'festivales', recordId: '92', createdAt: '2026-09-09T12:00:00Z',
  sentAt: '2026-09-09T12:00:00Z', readAt: null,
};

describe('NotificacionesEnVivoService', () => {
  let servicio: NotificacionesEnVivoService;
  let http: HttpTestingController;

  beforeEach(() => {
    spyOnProperty(document, 'hidden', 'get').and.returnValue(false);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(NotificacionesEnVivoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta al entrar y vuelve a consultar sin recargar la página', fakeAsync(() => {
    const recibidas: string[][] = [];
    const suscripcion = servicio.observar('externo').subscribe(pagina => recibidas.push(pagina.items.map(item => item.id)));

    tick();
    http.expectOne('/api/v1/notificaciones?ambito=externo&limite=50').flush({ items: [], limit: 50, offset: 0, total: 0 });
    tick(INTERVALO_NOTIFICACIONES_MS);
    http.expectOne('/api/v1/notificaciones?ambito=externo&limite=50').flush({ items: [AJUSTE], limit: 50, offset: 0, total: 1 });

    expect(recibidas).toEqual([[], ['1']]);
    suscripcion.unsubscribe();
  }));

  it('no solapa lecturas lentas y conserva la última lista ante un fallo transitorio', fakeAsync(() => {
    const recibidas: string[][] = [];
    const suscripcion = servicio.observar('institucional').subscribe(pagina => recibidas.push(pagina.items.map(item => item.id)));
    tick();
    const primera = http.expectOne('/api/v1/notificaciones?ambito=institucional&limite=50');

    tick(INTERVALO_NOTIFICACIONES_MS * 2);
    http.expectNone('/api/v1/notificaciones?ambito=institucional&limite=50');
    primera.flush({ items: [AJUSTE], limit: 50, offset: 0, total: 1 });
    tick(INTERVALO_NOTIFICACIONES_MS);
    http.expectOne('/api/v1/notificaciones?ambito=institucional&limite=50').flush({}, { status: 503, statusText: 'Unavailable' });

    expect(recibidas).toEqual([['1']]);
    suscripcion.unsubscribe();
  }));

  it('actualiza inmediatamente cuando se solicita o la ventana recupera el foco', fakeAsync(() => {
    let emisiones = 0;
    const suscripcion = servicio.observar('externo').subscribe(() => emisiones++);
    tick();
    http.expectOne('/api/v1/notificaciones?ambito=externo&limite=50').flush({ items: [], limit: 50, offset: 0, total: 0 });

    servicio.actualizarAhora();
    http.expectOne('/api/v1/notificaciones?ambito=externo&limite=50').flush({ items: [], limit: 50, offset: 0, total: 0 });
    window.dispatchEvent(new Event('focus'));
    http.expectOne('/api/v1/notificaciones?ambito=externo&limite=50').flush({ items: [], limit: 50, offset: 0, total: 0 });

    expect(emisiones).toBe(1);
    suscripcion.unsubscribe();
  }));

  it('marca y oculta avisos en el ámbito solicitado', () => {
    servicio.marcarComoLeida('institucional', '42').subscribe();
    const lectura = http.expectOne('/api/v1/notificaciones/42/lectura?ambito=institucional');
    expect(lectura.request.method).toBe('POST');
    lectura.flush({ ...AJUSTE, id: '42', readAt: '2026-10-26T19:00:00Z' });

    servicio.ocultarLeidas('externo').subscribe();
    const ocultar = http.expectOne('/api/v1/notificaciones/leidas/ocultar?ambito=externo');
    expect(ocultar.request.method).toBe('POST');
    ocultar.flush({ ocultadas: 3 });
  });
});

describe('destinoExternoDe', () => {
  it('lleva la sugerencia por campos al inspector del Festival, en la organización abierta', () => {
    expect(destinoExternoDe(AJUSTE, '117')).toEqual({
      ruta: ['/gestion/o', '117', 'procesos', 'festivales', '92'],
      parametros: { seccion: 'informacion', ajustes: '1' },
      accion: 'Resolver ajustes',
    });
  });

  it('si el aviso dice de qué organización es, va a esa y no a la abierta', () => {
    const aviso = { ...AJUSTE, metadataJson: '{"OrganizacionPrincipalId":1117}' };
    expect(destinoExternoDe(aviso, '117')?.ruta).toEqual(['/gestion/o', '1117', 'procesos', 'festivales', '92']);
  });

  it('sin organización conocida usa la dirección antigua, que lleva a la organización por omisión', () => {
    expect(destinoExternoDe(AJUSTE)?.ruta).toEqual(['/gestion', 'procesos', 'festivales', '92']);
  });

  it('lleva una aclaración y una conciliación a la solicitud concreta', () => {
    const aclarar = destinoExternoDe({ ...AJUSTE, eventType: 'ReclamacionRequiereAclaracion', recordId: '17' });
    const conciliar = destinoExternoDe({ ...AJUSTE, eventType: 'ReclamacionAprobadaPendienteConciliacion', recordId: '17' });

    expect(aclarar?.parametros).toEqual({ solicitud: '17', accion: 'aclarar' });
    expect(conciliar?.parametros).toEqual({ solicitud: '17', accion: 'conciliar' });
  });

  it('convierte el enlace de confirmación del cuerpo en un destino pulsable', () => {
    const aviso = {
      ...AJUSTE, eventType: 'ConfirmacionDeCorreo', channel: 'email', recordId: '',
      title: 'Confirma tu correo en SIMUS',
      body: 'Hola.\n\nAbre este enlace:\n\n/ecosistema/confirmar-correo?testigo=Ab3_x-9\n\nEl enlace vence en 3 días.',
    };

    expect(destinoExternoDe(aviso)).toEqual({
      ruta: ['/ecosistema/confirmar-correo'],
      parametros: { testigo: 'Ab3_x-9' },
      accion: 'Confirmar mi correo',
    });
    // SIN ENLACE EN EL CUERPO NO SE INVENTA UNA ACCION.
    expect(destinoExternoDe({ ...aviso, body: 'Sin enlace.' })).toBeNull();
  });

  it('no convierte un aviso informativo en una acción', () => {
    expect(destinoExternoDe({ ...AJUSTE, eventType: 'FestivalPublicado' })).toBeNull();
  });
});

describe('avisos de la consola · destino', () => {
  const RECIBIDO: NotificacionEnVivo = {
    ...AJUSTE, eventType: 'FestivalRecibidoParaRevision', recordId: '173',
    metadataJson: '{"OrganizacionPrincipalId":4,"OrganizacionNombre":"Fundación Prueba"}',
  };

  it('un Festival recibido abre su revisión concreta, no la bandeja genérica', () => {
    expect(destinoInstitucionalDe(RECIBIDO)).toEqual({
      ruta: ['/administracion', 'solicitudes', 'review-festivals-173'],
      parametros: null,
      accion: 'Revisar solicitud',
    });
  });

  it('un Mercado recibido abre su ficha', () => {
    const destino = destinoInstitucionalDe({ ...RECIBIDO, eventType: 'MercadoRecibidoParaRevision', recordId: '9' });
    expect(destino?.ruta).toEqual(['/administracion', 'mercados', '9']);
  });

  it('un aviso informativo o sin registro identificable no finge una tarea', () => {
    expect(destinoInstitucionalDe({ ...RECIBIDO, eventType: 'FestivalPublicado' })).toBeNull();
    expect(destinoInstitucionalDe({ ...RECIBIDO, recordId: '' })).toBeNull();
    expect(destinoInstitucionalDe({ ...RECIBIDO, recordId: '../../x' })).toBeNull();
  });

  it('dice de qué organización es el aviso cuando el servidor la anotó', () => {
    expect(organizacionNombreDelAviso(RECIBIDO)).toBe('Fundación Prueba');
    expect(organizacionNombreDelAviso({ ...RECIBIDO, metadataJson: null })).toBeNull();
  });
});
