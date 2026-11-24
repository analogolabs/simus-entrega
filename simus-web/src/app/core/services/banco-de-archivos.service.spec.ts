import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BancoDeArchivosService } from './banco-de-archivos.service';

/**
 * Subir y retirar archivos del banco llevan el testigo de seguridad (hallazgo D5-09).
 *
 * <b>EL DEFECTO QUE TRAJO ESTAS PRUEBAS.</b> Las subidas y los retiros del banco no pedían el
 * testigo antiforgery y solo los cubría la cookie `SameSite=Lax`. Ahora el servidor lo exige por la
 * consola y por el portal de las organizaciones: si la web dejara de mandarlo, todo subir y retirar
 * fallaría con «no pudo validarse». Cada canal lo pide a su propia ruta.
 */
describe('Banco de archivos: testigo de las escrituras (D5-09) y aviso de descripción (D5-06)', () => {
  let http: HttpTestingController;
  let servicio: BancoDeArchivosService;
  const archivo = new File([new Uint8Array([1, 2, 3])], 'imagen.png', { type: 'image/png' });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(BancoDeArchivosService);
  });

  afterEach(() => http.verify());

  /** El testigo se resuelve en una microtarea: se espera a que la escritura salga. */
  async function esperarLaEscritura(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('subir una imagen por la consola pide el testigo de la consola', async () => {
    const promesa = servicio.subirImagen(archivo, 'Una imagen');

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: 'consola' });
    await esperarLaEscritura();
    const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/institucional/archivos'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('consola');
    escritura.flush({ id: 5, nombre: 'imagen.png', url: '/x' });

    expect((await promesa).ok).toBe(true);
  });

  it('subir una imagen por el portal pide el testigo del portal', async () => {
    const promesa = servicio.subirImagen(archivo, 'Una imagen', { canal: 'externo' });

    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'portal' });
    await esperarLaEscritura();
    const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/archivos'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('portal');
    escritura.flush({ id: 6, nombre: 'imagen.png', url: '/y' });

    expect((await promesa).ok).toBe(true);
  });

  it('subir un documento manda el testigo del canal', async () => {
    const promesa = servicio.subirDocumento(new File(['%PDF'], 'acta.pdf', { type: 'application/pdf' }), 'externo');

    http.expectOne(r => r.url.endsWith('/api/v1/externo/organizaciones/csrf')).flush({ requestToken: 'doc' });
    await esperarLaEscritura();
    const escritura = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/externo/archivos/documentos'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('doc');
    escritura.flush({ id: 7, nombre: 'acta.pdf', url: '/z' });

    expect((await promesa).ok).toBe(true);
  });

  it('retirar un archivo manda el testigo del canal', async () => {
    const promesa = servicio.retirar('institucional', 9);

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: 'retiro' });
    await esperarLaEscritura();
    const escritura = http.expectOne(r => r.method === 'DELETE' && r.url.endsWith('/api/v1/institucional/archivos/9'));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe('retiro');
    escritura.flush(null);

    expect((await promesa).ok).toBe(true);
  });

  it('si no se puede pedir el testigo, no escribe y lo dice', async () => {
    const promesa = servicio.subirImagen(archivo, 'Una imagen');

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush('error', { status: 500, statusText: 'Error' });

    const resultado = await promesa;
    expect(resultado.ok).toBe(false);
    http.expectNone(r => r.method === 'POST');
  });

  it('devuelve el aviso del servidor cuando se reutilizó la imagen y se actualizó su descripción (D5-06)', async () => {
    const promesa = servicio.subirImagen(archivo, 'Nueva');

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: 'consola' });
    await esperarLaEscritura();
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/institucional/archivos')).flush({
      id: 5, nombre: 'imagen.png', tipo: 'image/png', bytes: 3, alt: 'Nueva', pie: null, credito: null,
      ancho: 1, alto: 1, url: '/api/v1/publico/archivos/5',
      descripcionActualizada: true, aviso: 'Ya tenías esta imagen; actualicé su descripción.',
    });

    const resultado = await promesa;
    expect(resultado.ok).toBeTrue();
    expect(resultado.aviso).toBe('Ya tenías esta imagen; actualicé su descripción.');
  });

  it('no trae aviso cuando la imagen es nueva o la descripción no cambió (D5-06)', async () => {
    const promesa = servicio.subirImagen(archivo, 'Misma');

    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: 'consola' });
    await esperarLaEscritura();
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/api/v1/institucional/archivos')).flush({
      id: 6, nombre: 'imagen.png', tipo: 'image/png', bytes: 3, alt: 'Misma', pie: null, credito: null,
      ancho: 1, alto: 1, url: '/api/v1/publico/archivos/6',
    });

    const resultado = await promesa;
    expect(resultado.ok).toBeTrue();
    expect(resultado.aviso).toBeUndefined();
  });
});
