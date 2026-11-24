import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, UrlSegment, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  ALIAS_DE_LA_CONSOLA, emparejaAliasDeLaConsola, emparejaLaConsolaAdministrativa, haciaLaConsolaCanonica, rutasConArmazonPropio,
} from './app.routes';

@Component({ standalone: true, template: 'Consola' })
class ConsolaComponent {}

const segmentos = (...rutas: string[]) => rutas.map(r => new UrlSegment(r, {}));

/**
 * `/admin` es el atajo de `/administracion`: escribir «administración» entera es largo. Es una
 * redirección de ruta, no una segunda puerta: la dirección que queda es siempre la canónica.
 */
describe('alias cortos de la consola administrativa', () => {
  it('el emparejador reconoce /admin y /administrador con o sin resto, y no toca /administracion', () => {
    expect(ALIAS_DE_LA_CONSOLA).toEqual(['admin', 'administrador']);
    expect(emparejaAliasDeLaConsola(segmentos('admin'))).not.toBeNull();
    expect(emparejaAliasDeLaConsola(segmentos('admin', 'festivales', '173'))).not.toBeNull();
    expect(emparejaAliasDeLaConsola(segmentos('administrador', 'agenda'))).not.toBeNull();
    expect(emparejaAliasDeLaConsola(segmentos('administracion'))).toBeNull();
    expect(emparejaAliasDeLaConsola(segmentos('administradores'))).toBeNull();
    expect(emparejaAliasDeLaConsola([])).toBeNull();
  });

  it('la ruta de la consola real sigue declarada y el alias va antes que ella', () => {
    const matchers = rutasConArmazonPropio.map(r => r.matcher);
    const alias = matchers.indexOf(emparejaAliasDeLaConsola);
    expect(alias).toBeGreaterThanOrEqual(0);
    expect(matchers.indexOf(emparejaLaConsolaAdministrativa)).toBeGreaterThan(alias);
  });

  describe('redirección', () => {
    const RUTAS: Routes = [
      { matcher: emparejaAliasDeLaConsola, canActivate: [haciaLaConsolaCanonica], children: [] },
      { matcher: emparejaLaConsolaAdministrativa, component: ConsolaComponent },
    ];
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(RUTAS)] }));

    async function ir(url: string): Promise<string> {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      return TestBed.inject(Router).url;
    }

    it('/admin lleva a /administracion', async () => { expect(await ir('/admin')).toBe('/administracion'); });
    it('conserva sección, id, vista, consulta y fragmento', async () => {
      expect(await ir('/admin/solicitudes/review-festivals-173/ficha?x=1#y')).toBe('/administracion/solicitudes/review-festivals-173/ficha?x=1#y');
    });
    it('/administrador/agenda lleva a /administracion/agenda', async () => {
      expect(await ir('/administrador/agenda')).toBe('/administracion/agenda');
    });
  });
});
