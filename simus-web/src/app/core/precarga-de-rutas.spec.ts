import { fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { Routes } from '@angular/router';

import { PrecargaDeRutasPublicas, marcarSinPrecarga } from './precarga-de-rutas';
import { routes, rutasConArmazonPropio } from '../app.routes';

describe('PrecargaDeRutasPublicas', () => {
  const estrategia = new PrecargaDeRutasPublicas();

  it('precarga una pantalla del portal pasados dos segundos, no antes', fakeAsync(() => {
    let cargadas = 0;
    estrategia.preload({ path: 'noticias' }, () => { cargadas++; return of(true); }).subscribe();
    tick(PrecargaDeRutasPublicas.ESPERA_MS - 1);
    expect(cargadas).toBe(0);
    tick(1);
    expect(cargadas).toBe(1);
  }));

  it('no precarga la consola ni lo marcado con sinPrecarga', fakeAsync(() => {
    let cargadas = 0;
    const cargar = () => { cargadas++; return of(true); };
    estrategia.preload({ path: 'gestion' }, cargar).subscribe();
    estrategia.preload({ path: 'otra', data: { sinPrecarga: true } }, cargar).subscribe();
    tick(PrecargaDeRutasPublicas.ESPERA_MS + 1);
    expect(cargadas).toBe(0);
  }));

  it('no precarga el mapa, que pesa más de un megabyte', fakeAsync(() => {
    let cargadas = 0;
    const cargar = () => { cargadas++; return of(true); };
    estrategia.preload({ path: 'mapa-ecosistemico' }, cargar).subscribe();
    estrategia.preload({ path: 'mapa-ecosistemico/sobre-el-mapa' }, cargar).subscribe();
    tick(PrecargaDeRutasPublicas.ESPERA_MS + 1);
    expect(cargadas).toBe(0);
  }));

  it('marcarSinPrecarga marca la ruta y TODAS sus hijas, y conserva lo que ya traían en data', () => {
    const rutas: Routes = [{ path: 'a', data: { titulo: 'A' }, children: [{ path: 'b', children: [{ path: 'c' }] }] }];
    marcarSinPrecarga(rutas);
    expect(rutas[0].data).toEqual({ titulo: 'A', sinPrecarga: true });
    expect(rutas[0].children![0].data?.['sinPrecarga']).toBe(true);
    expect(rutas[0].children![0].children![0].data?.['sinPrecarga']).toBe(true);
  });

  /** Lo que importa: la consola de administración y todo el panel de gestión quedan fuera de la precarga. */
  it('la consola y el panel de gestión (con sus hijas) no se precargan en las rutas reales', () => {
    const sinMarcar: string[] = [];
    const revisar = (rutas: Routes, ruta: string) => {
      for (const r of rutas) {
        if (r.data?.['sinPrecarga'] !== true) sinMarcar.push(`${ruta}/${r.path ?? '(matcher)'}`);
        if (r.children) revisar(r.children, `${ruta}/${r.path ?? ''}`);
      }
    };
    revisar(rutasConArmazonPropio.filter(r => r.path === 'gestion' || r.matcher !== undefined), '');
    expect(sinMarcar).toEqual([]);
    // Y el portal público sí sigue precargándose: sus rutas no se marcaron.
    const portal = routes.find(r => r.component !== undefined)?.children ?? [];
    expect(portal.filter(r => r.data?.['sinPrecarga'] === true).length).toBe(0);
  });
});
