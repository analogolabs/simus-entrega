import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router, UrlTree } from '@angular/router';
import { routes, rutasPlanas } from '../../app.routes';

/**
 * LAS DIRECCIONES ANTERIORES DE EL PLAN SIGUEN LLEVANDO A ALGUNA PARTE.
 *
 * «Sobre el PNMC», «Ejes», las fichas de componente y las dos estrategias se publicaron con
 * direcciones propias y pueden estar guardadas o enlazadas desde fuera. Al reunirse en `/pnmc`,
 * cada una redirige a su página o a su ancla. Si alguien retira una redirección, esta prueba falla.
 */
describe('El Plan · redirecciones de las direcciones anteriores', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

  const ruta = (path: string): Route => {
    const encontrada = rutasPlanas.find((r) => r.path === path);
    expect(encontrada).withContext(path).toBeDefined();
    return encontrada as Route;
  };

  const destino = (path: string): string => {
    const redirect = ruta(path).redirectTo;
    if (typeof redirect === 'string') return redirect;
    const arbol = TestBed.runInInjectionContext(() => (redirect as unknown as () => UrlTree)());
    return TestBed.inject(Router).serializeUrl(arbol);
  };

  it('El Plan y sus fichas tienen página', () => {
    expect(ruta('pnmc').loadComponent).toBeDefined();
    expect(ruta('pnmc/ejes/:componentSlug').loadComponent).toBeDefined();
  });

  it('cada dirección anterior lleva a su sitio en El Plan', () => {
    expect(destino('ejes')).toBe('/pnmc#ejes');
    expect(destino('ejes/:componentSlug')).toBe('pnmc/ejes/:componentSlug');
    expect(destino('estrategia/circulacion')).toBe('/pnmc#celebra-la-musica');
    expect(destino('estrategia/investigacion')).toBe('/pnmc#territorios-sonoros');
  });
});

describe('El Plan · estrategias con micrositio', () => {
  it('Celebra la música tiene ruta propia y Territorios sonoros no', () => {
    const paths = rutasPlanas.map((r) => r.path);
    expect(paths).toContain('pnmc/estrategias/celebra-la-musica');
    expect(paths.some((p) => p?.includes('estrategias/territorios'))).toBeFalse();
  });
});
