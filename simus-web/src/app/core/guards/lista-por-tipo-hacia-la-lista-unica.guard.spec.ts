import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { listaPorTipoHaciaLaListaUnica } from './lista-por-tipo-hacia-la-lista-unica.guard';

/** Las listas por tipo de Talleres, Espacios y Redes llevan a la lista única de procesos con el tipo elegido (PROP). */
describe('listaPorTipoHaciaLaListaUnica', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function ejecutar(url: string, tipo?: string): boolean | UrlTree {
    return TestBed.runInInjectionContext(() => listaPorTipoHaciaLaListaUnica(
      { data: tipo ? { tipo } : {} } as unknown as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as boolean | UrlTree;
  }
  const texto = (resultado: boolean | UrlTree) => TestBed.inject(Router).serializeUrl(resultado as UrlTree);

  it('la lista de talleres de una organización va a la lista única con el tipo «luteria»', () => {
    expect(texto(ejecutar('/gestion/o/117/procesos/luteria', 'luteria'))).toBe('/gestion/o/117/procesos?tipo=luteria');
  });

  it('las de espacios y de redes también', () => {
    expect(texto(ejecutar('/gestion/o/117/procesos/espacios', 'espacios'))).toBe('/gestion/o/117/procesos?tipo=espacios');
    expect(texto(ejecutar('/gestion/o/9/procesos/redes', 'redes'))).toBe('/gestion/o/9/procesos?tipo=redes');
  });

  it('no actúa sin organización en la dirección ni sin tipo en la ruta', () => {
    expect(ejecutar('/gestion/procesos/luteria', 'luteria')).toBeTrue();
    expect(ejecutar('/gestion/o/117/procesos/luteria')).toBeTrue();
  });
});
