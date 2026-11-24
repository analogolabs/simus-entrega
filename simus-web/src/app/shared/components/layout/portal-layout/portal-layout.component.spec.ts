import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PortalLayoutComponent } from './portal-layout.component';
import { rutasConArmazonPropio, rutasDelPortal, routes } from '../../../../app.routes';

/**
 * UI-G: un único `<main id="contenido-principal">` por pantalla, y la cabecera y la navegación del
 * portal fuera de él. El armazón del portal es el dueño del suyo; los armazones propios (acceso, Mi
 * espacio, panel, consola) declaran el de sus plantillas.
 */
describe('PortalLayoutComponent', () => {
  it('dibuja un solo <main> con el destino del enlace de salto y tabindex -1', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(PortalLayoutComponent);
    f.detectChanges();
    const mains = f.nativeElement.querySelectorAll('main');
    expect(mains.length).toBe(1);
    expect(mains[0].id).toBe('contenido-principal');
    expect(mains[0].getAttribute('tabindex')).toBe('-1');
    expect(mains[0].querySelector('router-outlet')).not.toBeNull();
  });

  it('las rutas cuelgan del armazón del portal o declaran armazón propio, sin repetirse', () => {
    const portal = routes.find((r) => r.component === PortalLayoutComponent);
    expect(portal?.children).toBe(rutasDelPortal);
    const propios = new Set(rutasConArmazonPropio.map((r) => r.path ?? '(emparejador)'));
    expect(propios.has('gestion')).toBeTrue();
    expect(propios.has('ingresar')).toBeTrue();
    expect(propios.has('registro')).toBeTrue();
    const delPortal = rutasDelPortal.map((r) => r.path);
    for (const p of ['gestion', 'ingresar', 'registro']) expect(delPortal).not.toContain(p);
    expect(delPortal).toContain('**');
  });
});
