import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SECCIONES_DE_GESTION_ADMINISTRATIVA } from '../domain/navegacion-administrativa';
import { AdminShellPageComponent } from './admin-shell-page.component';

/**
 * El buscador de secciones encuentra por tarea, y Enter lo abre.
 *
 * <b>LO QUE FALLABA.</b> Solo encontraba títulos —«publicar» respondía «Ninguna sección se llama
 * así»—, Enter no hacía nada con un único resultado, y la moderación de perfiles de personas no
 * tenía entrada en ninguna parte.
 */
describe('AdminShellPageComponent · buscador de secciones', () => {
  let fixture: ComponentFixture<AdminShellPageComponent>;
  let componente: AdminShellPageComponent;
  let http: HttpTestingController;
  let router: Router;

  const tecla = (key: string) => {
    const evento = new KeyboardEvent('keydown', { key, cancelable: true });
    componente.teclaEnElBuscadorDeSeccion(evento);
    return evento;
  };
  const ids = () => componente.seccionesEncontradas().map(r => (r.vista ? `${r.id}:${r.vista}` : r.id));

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminShellPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(AdminShellPageComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
    http.expectOne('/api/v1/admin/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    // La barra y el buscador no ofrecen nada hasta saber los módulos de la cuenta: aquí, todos.
    componente.modulosDeMiCuenta.set(SECCIONES_DE_GESTION_ADMINISTRATIVA.map(seccion => seccion.id));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('«publicar» encuentra las secciones donde se publica, aunque ninguna se llame así', () => {
    componente.escribirBusquedaDeSeccion('publicar');

    expect(ids()).toEqual(jasmine.arrayContaining(['solicitudes', 'ecosistema', 'agenda', 'noticias']));
  });

  it('busca sin tildes ni mayúsculas y por varias palabras a la vez', () => {
    componente.escribirBusquedaDeSeccion('PUBLICAR Noticia');
    expect(ids()).toEqual(['noticias']);

    componente.escribirBusquedaDeSeccion('bitacora');
    expect(ids()).toEqual(['auditoria']);

    componente.escribirBusquedaDeSeccion('correo');
    expect(ids()).toContain('boletin');
  });

  it('los títulos que coinciden van antes que los que coinciden por sinónimo', () => {
    componente.escribirBusquedaDeSeccion('festival');
    expect(ids()[0]).toBe('ecosistema');
  });

  it('los perfiles de personas son un destino propio dentro de Organizaciones', () => {
    componente.escribirBusquedaDeSeccion('personas');
    expect(ids()).toEqual(['organizaciones:personas']);
    expect(componente.seccionesEncontradas()[0].label).toBe('Perfiles públicos de personas');
  });

  it('Enter abre el primer resultado aunque sea el único', () => {
    componente.escribirBusquedaDeSeccion('bitacora');

    const evento = tecla('Enter');

    expect(evento.defaultPrevented).toBeTrue();
    expect(componente.activeSection()).toBe('auditoria');
    expect(componente.busquedaDeSeccion()).toBe('');
  });

  it('las flechas recorren los resultados y Enter abre el resaltado', () => {
    componente.escribirBusquedaDeSeccion('publicar');
    const esperados = ids();
    expect(esperados.length).toBeGreaterThan(1);

    tecla('ArrowDown');
    expect(componente.resultadoActivo()).toBe(1);
    tecla('ArrowUp');
    tecla('ArrowUp');
    expect(componente.resultadoActivo()).toBe(esperados.length - 1);

    tecla('Enter');
    expect(componente.activeSection()).toBe(esperados[esperados.length - 1]);
  });

  it('Enter sin resultados no hace nada, y Escape vacía el campo', () => {
    componente.escribirBusquedaDeSeccion('zzzzz');
    expect(ids()).toEqual([]);

    tecla('Enter');
    expect(componente.activeSection()).toBe('monitor');

    tecla('Escape');
    expect(componente.busquedaDeSeccion()).toBe('');
  });

  it('una vista buscable abre su sección con ?vista= en la dirección', () => {
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    componente.irASeccionEncontrada('organizaciones', 'personas');

    expect(navegar).toHaveBeenCalledWith(['/administracion', 'organizaciones'], { queryParams: { vista: 'personas' } });
  });
});
