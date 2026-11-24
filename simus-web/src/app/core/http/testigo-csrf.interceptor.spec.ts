import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { testigoCsrfInterceptor } from './testigo-csrf.interceptor';

describe('testigoCsrfInterceptor', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([testigoCsrfInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controlador.verify());

  it('pide el testigo y lo adjunta a una escritura del API que no lo lleva', () => {
    http.post('/api/v1/institucional/noticias', { a: 1 }).subscribe();

    const pedido = controlador.expectOne('/api/v1/csrf');
    expect(pedido.request.method).toBe('GET');
    pedido.flush({ requestToken: 'abc' });

    const escritura = controlador.expectOne('/api/v1/institucional/noticias');
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('abc');
    escritura.flush({});
  });

  it('cubre PUT, PATCH y DELETE', () => {
    for (const metodo of ['put', 'patch', 'delete'] as const) {
      const ruta = `/api/v1/admin/x/${metodo}`;
      (metodo === 'delete' ? http.delete(ruta) : http[metodo](ruta, {})).subscribe();
      controlador.expectOne('/api/v1/csrf').flush({ requestToken: 't' });
      const escritura = controlador.expectOne(ruta);
      expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('t');
      escritura.flush({});
    }
  });

  it('respeta el testigo que la petición ya lleva y no pide otro', () => {
    http.post('/api/v1/admin/organizaciones', {}, { headers: { 'X-CSRF-TOKEN': 'propio' } }).subscribe();

    const escritura = controlador.expectOne('/api/v1/admin/organizaciones');
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('propio');
    escritura.flush({});
  });

  it('no toca las lecturas', () => {
    http.get('/api/v1/institucional/noticias').subscribe();
    const lectura = controlador.expectOne('/api/v1/institucional/noticias');
    expect(lectura.request.headers.has('X-CSRF-TOKEN')).toBeFalse();
    lectura.flush([]);
  });

  it('no toca las escrituras anónimas (ingreso, alta, boletín)', () => {
    for (const ruta of [
      '/api/v1/admin/auth/login',
      '/api/v1/externo/auth/login',
      '/api/v1/externo/auth/register',
      '/api/v1/externo/auth/olvide-contrasena',
      '/api/v1/publico/boletin/suscripciones',
    ]) {
      http.post(ruta, {}).subscribe();
      const escritura = controlador.expectOne(ruta);
      expect(escritura.request.headers.has('X-CSRF-TOKEN')).toBeFalse();
      escritura.flush({});
    }
  });

  it('si el testigo no se puede obtener, la escritura sale igual sin él', () => {
    http.post('/api/v1/externo/cuenta/algo', {}).subscribe();

    controlador.expectOne('/api/v1/csrf').flush({}, { status: 401, statusText: 'No autenticado' });

    const escritura = controlador.expectOne('/api/v1/externo/cuenta/algo');
    expect(escritura.request.headers.has('X-CSRF-TOKEN')).toBeFalse();
    escritura.flush({});
  });

  it('no toca lo que no es del API', () => {
    http.post('/otra/cosa', {}).subscribe();
    const escritura = controlador.expectOne('/otra/cosa');
    expect(escritura.request.headers.has('X-CSRF-TOKEN')).toBeFalse();
    escritura.flush({});
  });
});
