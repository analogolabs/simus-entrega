import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RecuperacionDeContrasenaService } from './recuperacion-de-contrasena.service';

/** El servicio de la recuperación de contraseña: testigo antiforgery anónimo antes de cada escritura. */
describe('RecuperacionDeContrasenaService', () => {
  let servicio: RecuperacionDeContrasenaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(RecuperacionDeContrasenaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const atender = async (promesa: Promise<unknown>, ruta: string, respuesta: object | null) => {
    await Promise.resolve();
    http.expectOne(candidata => candidata.url.endsWith('/api/v1/externo/auth/csrf')).flush({ requestToken: 'token-csrf' });
    await Promise.resolve();
    const peticion = http.expectOne(candidata => candidata.url.endsWith(ruta));
    expect(peticion.request.headers.get('X-CSRF-TOKEN')).toBe('token-csrf');
    const cuerpo = peticion.request.body;
    peticion.flush(respuesta);
    await promesa;
    return cuerpo;
  };

  it('solicitar pide el testigo antiforgery por la ruta anónima y devuelve el mensaje neutro del servidor', async () => {
    const promesa = servicio.solicitar('lucia@example.com');
    const cuerpo = await atender(promesa, '/api/v1/externo/auth/olvide-contrasena', { message: 'Si existe una cuenta…' });

    expect(cuerpo).toEqual({ correo: 'lucia@example.com' });
    expect(await promesa).toBe('Si existe una cuenta…');
  });

  it('restablecer manda el testigo del enlace y la contraseña en el CUERPO, con el testigo antiforgery', async () => {
    const promesa = servicio.restablecer('a'.repeat(64), 'unaFraseLarga#2026');
    const cuerpo = await atender(promesa, '/api/v1/externo/auth/restablecer-contrasena', null);

    expect(cuerpo).toEqual({ testigo: 'a'.repeat(64), nueva: 'unaFraseLarga#2026' });
  });

  it('comprobar manda el testigo en el cuerpo, nunca en la dirección', async () => {
    const promesa = servicio.comprobar('b'.repeat(64));
    await Promise.resolve();
    const peticion = http.expectOne(candidata => candidata.url.endsWith('/api/v1/externo/auth/restablecer-contrasena/comprobar'));
    expect(peticion.request.url).not.toContain('b'.repeat(64));
    expect(peticion.request.body).toEqual({ testigo: 'b'.repeat(64) });
    peticion.flush({ valido: true, motivo: null, correoEnmascarado: 'l•••a@example.com' });

    expect((await promesa).valido).toBeTrue();
  });
});
