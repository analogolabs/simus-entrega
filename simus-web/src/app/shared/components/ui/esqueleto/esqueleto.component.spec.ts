import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { EsqueletoComponent, VarianteDeEsqueleto } from './esqueleto.component';

@Component({
  standalone: true,
  imports: [EsqueletoComponent],
  template: `<app-esqueleto [variante]="variante()" [cantidad]="cantidad()" [etiqueta]="etiqueta()" />`,
})
class Anfitrion {
  variante = signal<VarianteDeEsqueleto>('fila');
  cantidad = signal<number | undefined>(undefined);
  etiqueta = signal('Cargando las noticias');
}

describe('EsqueletoComponent', () => {
  function montar() {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    const raiz = f.nativeElement as HTMLElement;
    return { f, raiz, esqueleto: () => raiz.querySelector('app-esqueleto') as HTMLElement };
  }

  it('aparece en el primer fotograma, ocupado y con un único texto para lector de pantalla', () => {
    const { esqueleto } = montar();
    expect(esqueleto().getAttribute('aria-busy')).toBe('true');
    const textos = esqueleto().querySelectorAll('.sr-only');
    expect(textos.length).toBe(1);
    expect(textos[0].textContent).toContain('Cargando las noticias');
    expect(textos[0].getAttribute('role')).toBe('status');
  });

  it('con varias piezas el texto se dice una sola vez y los bloques se ocultan al lector', () => {
    const { f, esqueleto } = montar();
    f.componentInstance.variante.set('tarjeta');
    f.componentInstance.cantidad.set(4);
    f.detectChanges();
    expect(esqueleto().querySelectorAll('.tarjeta').length).toBe(4);
    expect(esqueleto().querySelectorAll('[role="status"]').length).toBe(1);
    expect(esqueleto().querySelector('.rejilla')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('cada variante dibuja su estructura y marca cuál es', () => {
    const { f, esqueleto } = montar();
    const clases: Record<VarianteDeEsqueleto, string> = {
      noticias: '.noticias__rejilla', tarjeta: '.tarjeta', fila: '.fila', ficha: '.ficha', tabla: '.tabla__fila', encabezado: '.encabezado', persona: '.persona', formulario: '.formulario__campo', concepto: '.concepto', articulo: '.articulo',
    };
    for (const variante of Object.keys(clases) as VarianteDeEsqueleto[]) {
      f.componentInstance.variante.set(variante);
      f.detectChanges();
      expect(esqueleto().getAttribute('data-esqueleto')).toBe(variante);
      expect(esqueleto().querySelectorAll(clases[variante]).length).toBeGreaterThan(0);
    }
  });

  it('la tabla lleva una cabecera más las filas pedidas', () => {
    const { f, esqueleto } = montar();
    f.componentInstance.variante.set('tabla');
    f.componentInstance.cantidad.set(3);
    f.detectChanges();
    expect(esqueleto().querySelectorAll('.tabla__fila').length).toBe(4);
  });

  it('no usa retardo y respeta prefers-reduced-motion', () => {
    const { esqueleto } = montar();
    const bloque = esqueleto().querySelector('.bloque') as HTMLElement;
    expect(getComputedStyle(bloque).animationDelay).toMatch(/^0s$/);
    const css = Array.from(document.querySelectorAll('style')).map(s => s.textContent ?? '').join('\n');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});
