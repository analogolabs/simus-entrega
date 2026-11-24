import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RevelarDirective, TOPE_DE_RETARDO_MS } from './revelar.directive';

@Component({
  standalone: true,
  imports: [RevelarDirective],
  template: `<div id="a" [appRevelar]="120">uno</div>`,
})
class Anfitrion {}

@Component({ standalone: true, imports: [RevelarDirective], template: `<div id="tarde" [appRevelar]="2000">veinte</div>` })
class AnfitrionDeListaLarga {}

describe('RevelarDirective', () => {
  let original: typeof IntersectionObserver;
  let avisar: (visible: boolean) => void;
  let desconectado = false;

  beforeEach(() => {
    original = window.IntersectionObserver;
    desconectado = false;
    window.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        avisar = (v) => cb([{ isIntersecting: v } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe(): void { /* la prueba dispara la intersección a mano */ }
      disconnect() { desconectado = true; }
    } as unknown as typeof IntersectionObserver;
  });
  afterEach(() => { window.IntersectionObserver = original; });

  it('nace oculto, escalona con su retardo y se muestra una sola vez al entrar en pantalla', () => {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement.querySelector('#a');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { expect(el.classList).toContain('revelar--visto'); return; }

    expect(el.classList).toContain('revelar');
    expect(el.classList).not.toContain('revelar--visto');
    expect(el.style.getPropertyValue('--retardo')).toBe('120ms');

    avisar(false);
    f.detectChanges();
    expect(el.classList).not.toContain('revelar--visto');

    avisar(true);
    f.detectChanges();
    expect(el.classList).toContain('revelar--visto');
    expect(desconectado).toBe(true);
  });

  it('la espera de un elemento tardío de la lista tiene tope: no espera segundos a que se le dé permiso de verse', () => {
    const f = TestBed.createComponent(AnfitrionDeListaLarga);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement.querySelector('#tarde');
    expect(el.style.getPropertyValue('--retardo')).toBe(`${TOPE_DE_RETARDO_MS}ms`);
  });
});
