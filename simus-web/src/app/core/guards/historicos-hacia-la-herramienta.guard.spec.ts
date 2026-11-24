import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { historicosHaciaLaHerramienta } from './historicos-hacia-la-herramienta.guard';

/** Los enlaces de antes a «reclamar» (`?reclamar=` y `#historicos`) llevan a la herramienta (decisión 74). */
describe('historicosHaciaLaHerramienta', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function ejecutar(url: string): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      historicosHaciaLaHerramienta({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as boolean | UrlTree;
  }
  const texto = (resultado: boolean | UrlTree) => TestBed.inject(Router).serializeUrl(resultado as UrlTree);

  it('un enlace con ?reclamar= va a la herramienta y conserva el Festival buscado', () => {
    expect(texto(ejecutar('/gestion/o/117/procesos/festivales?reclamar=107&buscar=Festival%20del%20Bambuco')))
      .toBe('/gestion/o/117/herramientas/procesos-historicos?reclamar=107&buscar=Festival%20del%20Bambuco');
  });

  it('el fragmento #historicos también va a la herramienta, sin el fragmento', () => {
    expect(texto(ejecutar('/gestion/o/117/procesos/festivales#historicos')))
      .toBe('/gestion/o/117/herramientas/procesos-historicos');
  });

  it('la lista de Festivales abre con normalidad cuando no piden reclamar', () => {
    expect(ejecutar('/gestion/o/117/procesos/festivales')).toBeTrue();
    expect(ejecutar('/gestion/o/117/procesos/festivales?ajustes=1')).toBeTrue();
  });

  it('no actúa sin organización en la dirección', () => {
    expect(ejecutar('/gestion/procesos/festivales?reclamar=107')).toBeTrue();
  });
});
