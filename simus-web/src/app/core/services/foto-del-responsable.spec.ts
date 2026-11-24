import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClientService } from '../http/api-client.service';
import { PerfilPublicoService } from './perfil-publico.service';
import { subirFotoDelResponsable } from './foto-del-responsable';

/**
 * Las subidas de foto personal (perfil público, taller, espacio y red) mandan el testigo CSRF, como las del Banco de
 * archivos: el servidor las rechaza sin él (400, «no pudo validarse»).
 */
describe('Subidas de foto personal', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const archivo = () => new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' });

  async function pedirTestigoYResponder(ruta: string): Promise<void> {
    // El testigo se pide justo antes de subir.
    await Promise.resolve();
    const csrf = http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf'));
    csrf.flush({ requestToken: 'token-de-prueba' });
    await Promise.resolve();
    const subida = http.expectOne(r => r.url.endsWith(ruta));
    expect(subida.request.method).toBe('POST');
    expect(subida.request.headers.get('X-CSRF-TOKEN')).toBe('token-de-prueba');
    subida.flush({ id: 7, url: '/api/v1/publico/archivos/7' });
  }

  for (const ruta of ['/api/v1/externo/mis-talleres/foto', '/api/v1/externo/mis-espacios/foto', '/api/v1/externo/mis-redes/foto']) {
    it(`la foto del responsable de ${ruta} lleva el testigo`, async () => {
      const api = TestBed.inject(ApiClientService);
      const resultado = subirFotoDelResponsable(api, ruta, archivo(), 'Fachada');
      await pedirTestigoYResponder(ruta);
      expect((await resultado).ok).toBeTrue();
    });
  }

  it('la foto del perfil público lleva el testigo', async () => {
    const servicio = TestBed.inject(PerfilPublicoService);
    const resultado = new Promise(resolver => servicio.subirFoto(archivo(), 'Retrato').subscribe(resolver));
    await pedirTestigoYResponder('/api/v1/externo/cuenta/perfil-publico/foto');
    expect(await resultado).toEqual({ id: 7, url: '/api/v1/publico/archivos/7' });
  });
});
