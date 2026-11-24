import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ContadorComponent } from './contador.component';

@Component({ standalone: true, imports: [ContadorComponent], template: `<span id="c"><app-contador [valor]="valor" [duracion]="60"></app-contador></span>` })
class Anfitrion { valor = 1234; }

describe('ContadorComponent', () => {
  let original: typeof IntersectionObserver;
  let entrar: () => void;
  beforeEach(() => {
    original = window.IntersectionObserver;
    window.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) { entrar = () => cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
      observe(): void { /* se dispara a mano */ }
      disconnect(): void { /* nada */ }
    } as unknown as typeof IntersectionObserver;
  });
  afterEach(() => { window.IntersectionObserver = original; });

  it('muestra el valor final antes de entrar en pantalla y, al entrar, termina en el número exacto', async () => {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement.querySelector('#c');
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    expect(el.textContent?.trim()).toBe((1234).toLocaleString('es-CO'));
    if (reducido) return;
    entrar();
    f.detectChanges();
    await new Promise((r) => setTimeout(r, 200));
    f.detectChanges();
    expect(el.textContent?.trim()).toBe((1234).toLocaleString('es-CO'));
  });
});
