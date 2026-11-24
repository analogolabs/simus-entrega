import { ActivatedRouteSnapshot } from '@angular/router';
import { debeAnimarseLaNavegacion } from './transicion-entre-pantallas';

/** Un árbol mínimo de instantáneas: cada tramo con componente cuenta como pantalla (ver `identidadDePantalla`). */
function instantanea(path: string, params: Record<string, string> = {}, conComponente = true): ActivatedRouteSnapshot {
  const hoja = { routeConfig: { path, ...(conComponente ? { component: class {} } : {}) }, params, url: [], firstChild: null } as unknown as ActivatedRouteSnapshot;
  const raiz = { routeConfig: null, params: {}, url: [], firstChild: hoja } as unknown as ActivatedRouteSnapshot;
  (hoja as { root: ActivatedRouteSnapshot }).root = raiz;
  (raiz as { root: ActivatedRouteSnapshot }).root = raiz;
  return hoja;
}

describe('debeAnimarseLaNavegacion', () => {
  it('anima el cambio de una pantalla a otra', () => {
    expect(debeAnimarseLaNavegacion(instantanea('agenda'), instantanea('noticias'), false)).toBeTrue();
  });

  it('no anima cuando solo cambia el estado de la misma pantalla (filtros, página, ancla)', () => {
    expect(debeAnimarseLaNavegacion(instantanea('agenda'), instantanea('agenda'), false)).toBeFalse();
  });

  it('anima de una ficha a otra distinta (cambia el parámetro de una pantalla que sí monta componente)', () => {
    expect(debeAnimarseLaNavegacion(instantanea('agenda/:slug', { slug: 'a' }), instantanea('agenda/:slug', { slug: 'b' }), false)).toBeTrue();
  });

  it('no anima nada con «reducir movimiento», aunque cambie la pantalla', () => {
    expect(debeAnimarseLaNavegacion(instantanea('agenda'), instantanea('noticias'), true)).toBeFalse();
  });
});
