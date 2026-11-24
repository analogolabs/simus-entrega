import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EstadoDelServicioService } from '../../core/http/estado-del-servicio.service';
import { MantenimientoPageComponent } from './mantenimiento-page.component';

describe('MantenimientoPageComponent', () => {
  let servicio: EstadoDelServicioService;
  let controlador: HttpTestingController;
  let irA: jasmine.Spy;

  async function montar(): Promise<ComponentFixture<MantenimientoPageComponent>> {
    await TestBed.configureTestingModule({
      imports: [MantenimientoPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } }],
    }).compileComponents();
    servicio = TestBed.inject(EstadoDelServicioService);
    controlador = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(MantenimientoPageComponent);
  }

  function texto(f: ComponentFixture<MantenimientoPageComponent>): string {
    return (f.nativeElement as HTMLElement).textContent ?? '';
  }

  it('en mantenimiento muestra título, mensaje, hora estimada, Reintentar y las redes oficiales', async () => {
    const f = await montar();
    servicio.marcarMantenimiento({ mensaje: 'Actualizamos la base de datos.', hastaAprox: '2026-11-22T14:00:00-05:00' });
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('main#contenido-principal')).toBeTruthy();
    expect(el.querySelector('h1')?.textContent).toContain('Estamos mejorando SIMUS');
    expect(texto(f)).toContain('Actualizamos la base de datos.');
    expect(el.querySelector('time')?.getAttribute('datetime')).toContain('2026-11-22');
    expect(Array.from(el.querySelectorAll('button')).some(b => b.textContent?.includes('Reintentar'))).toBeTrue();
    expect(el.querySelectorAll('nav a').length).toBe(4);
    el.querySelectorAll('nav a').forEach(a => expect(a.getAttribute('rel')).toContain('noopener'));
  });

  it('sin mensaje usa el texto de fábrica y sin hora no muestra la línea de la hora', async () => {
    const f = await montar();
    servicio.marcarMantenimiento({});
    f.detectChanges();
    expect(texto(f)).toContain('tareas de mantenimiento');
    expect((f.nativeElement as HTMLElement).querySelector('time')).toBeNull();
  });

  it('sin conexión dice otra cosa, coherente', async () => {
    const f = await montar();
    servicio.marcarSinConexion();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('No logramos conectar');
    expect(texto(f)).toContain('Reintentar');
  });

  it('el título recibe el foco y la región de estado es polite', async () => {
    const f = await montar();
    servicio.marcarMantenimiento({});
    f.detectChanges();
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(document.activeElement).toBe(el.querySelector('h1'));
    expect(el.querySelector('[role="status"][aria-live="polite"]')).toBeTruthy();
  });

  it('Reintentar: si el API contesta, restablece y devuelve a la ruta de origen', async () => {
    const f = await montar();
    irA = spyOn(f.componentInstance as unknown as { irA(r: string): void }, 'irA');
    servicio.marcarMantenimiento({});
    servicio.rutaDeRetorno.set('/noticias?p=2');
    f.detectChanges();
    const promesa = f.componentInstance.reintentar();
    controlador.expectOne('/api/v1/contenido-web').flush({});
    await promesa;
    expect(servicio.estado()).toBe('normal');
    expect(irA).toHaveBeenCalledWith('/noticias?p=2');
  });

  it('Reintentar: si sigue en mantenimiento, avisa y se queda', async () => {
    const f = await montar();
    irA = spyOn(f.componentInstance as unknown as { irA(r: string): void }, 'irA');
    servicio.marcarMantenimiento({});
    f.detectChanges();
    const promesa = f.componentInstance.reintentar();
    controlador.expectOne('/api/v1/contenido-web').flush({}, { status: 503, statusText: 'x' });
    await promesa;
    f.detectChanges();
    expect(servicio.estado()).toBe('mantenimiento');
    expect(irA).not.toHaveBeenCalled();
    expect(texto(f)).toContain('Todavía no está disponible');
  });

  it('llegar directo con el servicio sano dice que funciona y ofrece ir al inicio', async () => {
    const f = await montar();
    f.detectChanges();
    controlador.expectOne('/api/v1/contenido-web').flush({});
    await f.whenStable();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('funciona con normalidad');
    expect((f.nativeElement as HTMLElement).querySelector('a[href="/"]')).toBeTruthy();
  });
});
