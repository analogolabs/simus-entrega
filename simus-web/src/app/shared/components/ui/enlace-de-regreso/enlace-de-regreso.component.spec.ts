import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EnlaceDeRegresoComponent } from './enlace-de-regreso.component';

@Component({
  standalone: true,
  imports: [EnlaceDeRegresoComponent],
  template: `<app-enlace-de-regreso destino="a la agenda" [enlace]="['/agenda']" [queryParams]="{ q: 'jazz' }" />`,
})
class Anfitrion {}

describe('EnlaceDeRegresoComponent (A-7)', () => {
  function montar() {
    TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] });
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('es un enlace dentro de una navegación con nombre, con el texto «Volver a la agenda»', () => {
    const raiz = montar();
    expect(raiz.querySelector('nav')?.getAttribute('aria-label')).toBe('Volver');
    const a = raiz.querySelector('a') as HTMLAnchorElement;
    expect(a.textContent?.replace(/\s+/g, ' ').trim()).toBe('Volver a la agenda');
  });

  it('conserva los filtros de la lista en la dirección', () => {
    const a = montar().querySelector('a') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/agenda?q=jazz');
  });

  it('la flecha es un icono decorativo, no un carácter', () => {
    const raiz = montar();
    expect(raiz.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(raiz.textContent).not.toContain('←');
  });
});
