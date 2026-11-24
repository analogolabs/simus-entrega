import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AltaAdministrativaService } from './alta-administrativa.service';
import { TestigoDeLaConsolaService } from './testigo-de-la-consola.service';

/**
 * Las escrituras de la consola llevan el testigo de seguridad.
 *
 * <b>EL DEFECTO QUE TRAJO ESTAS PRUEBAS.</b> El alta de organizaciones y de Festivales, la
 * publicación de Festivales y de mercados, la liberación y la fusión eran escrituras de la consola
 * que no mandaban el testigo. Ahora el servidor lo exige: si la web dejara de mandarlo, todas
 * fallarían con «no pudo validarse».
 */
describe('Testigo de las escrituras de la consola', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el testigo a la ruta de la consola y lo devuelve como cabecera', async () => {
    const promesa = TestBed.inject(TestigoDeLaConsolaService).cabeceras();

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: 'abc' });

    expect(await promesa).toEqual({ 'X-CSRF-TOKEN': 'abc' });
  });

  it('el alta de una organización manda el testigo en la cabecera', async () => {
    const promesa = TestBed.inject(AltaAdministrativaService).crearOrganizacion({} as never);

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: 'org' });
    await Promise.resolve();
    await Promise.resolve();
    const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/admin/organizaciones'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('org');
    escritura.flush({ id: '3', nombre: 'Organización' });

    expect((await promesa).ok).toBe(true);
  });

  it('el alta de un Festival manda el testigo en la cabecera', async () => {
    const promesa = TestBed.inject(AltaAdministrativaService).crearFestival({} as never);

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: 'xyz' });
    // El testigo se resuelve en una microtarea: se espera a que la escritura salga.
    await Promise.resolve();
    await Promise.resolve();
    const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/admin/festivales'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('xyz');
    escritura.flush({ id: '9', nombre: 'Festival' });

    expect((await promesa).ok).toBe(true);
  });
});
