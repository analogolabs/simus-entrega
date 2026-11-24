import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { estadoDelServicioInterceptor } from './estado-del-servicio.interceptor';
import { EstadoDelServicioService } from './estado-del-servicio.service';

describe('estadoDelServicioInterceptor', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;
  let servicio: EstadoDelServicioService;
  let navegar: jasmine.Spy;

  beforeEach(() => {
    navegar = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([estadoDelServicioInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl: navegar } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(EstadoDelServicioService);
  });

  afterEach(() => controlador.verify());

  it('un 503 con la marca de mantenimiento lleva a la pantalla y guarda mensaje y hora', () => {
    http.get('/api/v1/noticias').subscribe({ error: () => undefined });
    controlador.expectOne('/api/v1/noticias').flush(
      { codigo: 'mantenimiento', mensaje: 'Volvemos pronto', hastaAprox: '2026-11-22T14:00:00-05:00' },
      { status: 503, statusText: 'Service Unavailable', headers: { 'X-Mantenimiento': '1', 'Retry-After': '300' } },
    );
    expect(servicio.estado()).toBe('mantenimiento');
    expect(servicio.datos().mensaje).toBe('Volvemos pronto');
    expect(servicio.datos().hastaAprox).toContain('2026-11-22');
    expect(navegar).toHaveBeenCalledWith('/mantenimiento');
  });

  it('un 503 SIN la marca no es mantenimiento', () => {
    http.get('/api/v1/noticias').subscribe({ error: () => undefined });
    controlador.expectOne('/api/v1/noticias').flush({}, { status: 503, statusText: 'x' });
    expect(servicio.estado()).toBe('normal');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('no mira lo que no es del API', () => {
    http.get('/otra/cosa').subscribe({ error: () => undefined });
    controlador.expectOne('/otra/cosa').flush({}, { status: 503, statusText: 'x', headers: { 'X-Mantenimiento': '1' } });
    expect(servicio.estado()).toBe('normal');
  });

  it('el error sigue llegando a quien hizo la petición', () => {
    let status = 0;
    http.get('/api/v1/x').subscribe({ error: e => (status = e.status) });
    controlador.expectOne('/api/v1/x').flush({}, { status: 503, statusText: 'x', headers: { 'X-Mantenimiento': '1' } });
    expect(status).toBe(503);
  });

  it('sin respuesta, solo declara «sin conexión» si la sonda de salud tampoco contesta', async () => {
    const sondaViva = jasmine.createSpy().and.resolveTo(true);
    await servicio.sospecharCaida(sondaViva);
    expect(servicio.estado()).toBe('normal');

    await servicio.sospecharCaida(() => Promise.resolve(false));
    expect(servicio.estado()).toBe('sin-conexion');
    expect(navegar).toHaveBeenCalledWith('/mantenimiento');
  });

  it('un error de red en el API dispara la sospecha', () => {
    const sospechar = spyOn(servicio, 'sospecharCaida').and.resolveTo();
    http.get('/api/v1/x').subscribe({ error: () => undefined });
    controlador.expectOne('/api/v1/x').error(new ProgressEvent('error'));
    expect(sospechar).toHaveBeenCalled();
  });

  it('un 500 corriente no activa nada', () => {
    const sospechar = spyOn(servicio, 'sospecharCaida').and.resolveTo();
    http.get('/api/v1/x').subscribe({ error: () => undefined });
    controlador.expectOne('/api/v1/x').flush({}, { status: 500, statusText: 'x' });
    expect(sospechar).not.toHaveBeenCalled();
    expect(servicio.estado()).toBe('normal');
  });
});
