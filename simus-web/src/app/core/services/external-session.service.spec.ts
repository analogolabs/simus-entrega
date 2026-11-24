import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExternalSessionService } from './external-session.service';

/**
 * La sesión externa vista por el sitio público.
 *
 * <b>Qué se vigila y por qué.</b>
 *
 * 1. QUE UN 401 NO SEA UN ERROR. Es la respuesta normal para un visitante anónimo, que es la
 *    mayoría de las cargas del portal. Si esto propagara el fallo, cada visita sin sesión pintaría
 *    un aviso de error en una página que no lo necesita.
 *
 * 2. QUE SE PREGUNTE UNA SOLA VEZ. La barra de navegación vive en el armazón y la pantalla de
 *    acceso también quiere la sesión. Sin la guarda, cada visita a /registro haría dos peticiones
 *    idénticas.
 *
 * 3. QUE SALIR SEA SALIR. Si la petición de cierre falla y la sesión local se quedara puesta, la
 *    barra seguiría diciendo que hay alguien dentro y el botón no volvería a servir de nada.
 */
describe('ExternalSessionService', () => {
  let servicio: ExternalSessionService;
  let http: HttpTestingController;

  const SESION = {
    userId: '13',
    fullName: 'Camila Prueba Responsable',
    email: 'creacionorgprueba@pnmc.test',
    accountStatus: 'activo',
    organizations: [{ id: '117', name: 'Fundación Sonidos', role: 'administrador' }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ExternalSessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // D-09: se pregunta a `/estado`, que contesta 200 siempre (con `autenticado: false` si no hay sesión), y no a
  // `/me`, cuyo 401 deja un error rojo en la consola de cada página pública.
  const responder = (cuerpo: Record<string, unknown>, estado = 200) => {
    const peticion = http.expectOne('/api/v1/externo/auth/estado');
    if (estado !== 200) peticion.flush(cuerpo, { status: estado, statusText: 'Error' });
    else peticion.flush(Object.keys(cuerpo).length === 0 ? { autenticado: false, sesion: null } : { autenticado: true, sesion: cuerpo });
  };

  it('sin sesión: la respuesta 200 «no autenticado» deja el sitio anónimo, sin pedir nada que dé 401', () => {
    servicio.refrescar().subscribe();
    responder({});

    expect(servicio.dentro()).toBeFalse();
    expect(servicio.actual()).toBeNull();
    expect(servicio.rotulo()).toBe('');
    expect(servicio.organizaciones()).toEqual([]);
  });

  it('si la consulta falla, el sitio queda anónimo y no revienta', () => {
    servicio.refrescar().subscribe();
    responder({}, 500);

    expect(servicio.dentro()).toBeFalse();
  });

  it('con sesión: expone la organización y sus iniciales', () => {
    servicio.refrescar().subscribe();
    responder(SESION);

    expect(servicio.dentro()).toBeTrue();
    expect(servicio.organizacionPrincipal()?.name).toBe('Fundación Sonidos');
    expect(servicio.organizacionPrincipal()?.role).toBe('administrador');
    expect(servicio.rotulo()).toBe('Fundación Sonidos');
    expect(servicio.iniciales()).toBe('FS');
  });

  it('una organización de una sola palabra da dos letras, no una', () => {
    servicio.refrescar().subscribe();
    responder({ ...SESION, organizations: [{ id: '117', name: 'CreacionOrgPrueba', role: 'administrador' }] });

    expect(servicio.iniciales()).toBe('CR');
  });

  it('el chip de la barra lleva solo la primera palabra, y el rótulo entero sigue disponible', () => {
    // EL CHIP MIDE 11rem. «Antiguo Colectivo de Vientos y Cañas» se leía «Antiguo Colectivo de
    // Vi…». Se acorta a la primera palabra, y el nombre completo se conserva en `rotulo` para el
    // menú de cuenta: son dos sitios con espacio distinto, no dos verdades distintas.
    servicio.refrescar().subscribe();
    responder({ ...SESION, organizations: [{ id: '115', name: 'Antiguo Colectivo de Vientos y Cañas', role: 'propietario' }] });

    expect(servicio.rotuloCorto()).toBe('Antiguo');
    expect(servicio.rotulo()).toBe('Antiguo Colectivo de Vientos y Cañas');
  });

  it('un nombre de una sola palabra pasa entero por el chip', () => {
    servicio.refrescar().subscribe();
    responder({ ...SESION, organizations: [{ id: '117', name: 'CreacionOrgPrueba222', role: 'administrador' }] });

    expect(servicio.rotuloCorto()).toBe('CreacionOrgPrueba222');
  });

  it('sin sesión el chip queda vacío en vez de decir «undefined»', () => {
    servicio.refrescar().subscribe();
    responder({}, 401);

    expect(servicio.rotuloCorto()).toBe('');
  });

  it('el distintivo circular sigue leyendo el nombre completo, no la palabra recortada', () => {
    // SI LAS INICIALES SALIERAN DE `rotuloCorto`, «Antiguo Colectivo…» daría «AN» en vez de «AC»:
    // dos organizaciones que empiezan por la misma palabra tendrían además el mismo distintivo.
    servicio.refrescar().subscribe();
    responder({ ...SESION, organizations: [{ id: '115', name: 'Antiguo Colectivo de Vientos y Cañas', role: 'propietario' }] });

    expect(servicio.iniciales()).toBe('AC');
  });

  it('sin organizaciones cae al nombre de la persona, no a un botón vacío', () => {
    servicio.refrescar().subscribe();
    responder({ ...SESION, organizations: [] });

    expect(servicio.dentro()).toBeTrue();
    expect(servicio.rotulo()).toBe('Camila Prueba Responsable');
  });

  it('cargarUnaVez() no pregunta dos veces', () => {
    servicio.cargarUnaVez();
    responder(SESION);

    servicio.cargarUnaVez();
    http.expectNone('/api/v1/externo/auth/estado');
    expect(servicio.dentro()).toBeTrue();
  });

  it('salir borra la sesión local aunque el servidor falle', () => {
    servicio.establecer(SESION);
    expect(servicio.dentro()).toBeTrue();

    servicio.salir().subscribe();
    http.expectOne('/api/v1/externo/auth/logout').flush({}, { status: 500, statusText: 'Server Error' });

    expect(servicio.dentro()).toBeFalse();
  });
});
