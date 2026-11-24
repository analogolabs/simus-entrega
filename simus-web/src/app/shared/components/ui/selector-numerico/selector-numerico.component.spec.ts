import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SelectorNumericoComponent } from './selector-numerico.component';

@Component({
  standalone: true,
  imports: [SelectorNumericoComponent],
  template: `<app-selector-numerico etiqueta="Cupo" [(valor)]="valor" [minimo]="1" [maximo]="5" [permiteVacio]="vacio()" />`,
})
class Anfitrion { readonly valor = signal<number | null>(2); readonly vacio = signal(true); }

describe('SelectorNumericoComponent', () => {
  function montar() {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const botones = el.querySelectorAll<HTMLButtonElement>('button.paso');
    return { f, el, menos: botones[0], mas: botones[1], casilla: el.querySelector<HTMLInputElement>('input')! };
  }

  it('sube y baja de uno en uno y respeta el máximo', () => {
    const { f, mas, menos } = montar();
    mas.click(); f.detectChanges();
    expect(f.componentInstance.valor()).toBe(3);
    menos.click(); menos.click(); f.detectChanges();
    expect(f.componentInstance.valor()).toBe(1);
    for (let i = 0; i < 9; i++) { mas.click(); f.detectChanges(); }
    expect(f.componentInstance.valor()).toBe(5);
    expect(mas.disabled).toBeTrue();
  });

  it('en el mínimo, «−» vuelve a «sin límite» si se permite, y «+» parte del mínimo', () => {
    const { f, mas, menos, casilla } = montar();
    f.componentInstance.valor.set(1); f.detectChanges();
    menos.click(); f.detectChanges();
    expect(f.componentInstance.valor()).toBeNull();
    expect(casilla.value).toBe('');
    expect(casilla.placeholder).toBe('Sin límite');
    mas.click(); f.detectChanges();
    expect(f.componentInstance.valor()).toBe(1);
  });

  it('un número escrito fuera de rango se lleva al rango y un texto no numérico no cambia nada', () => {
    const { f, casilla } = montar();
    casilla.value = '99'; casilla.dispatchEvent(new Event('change')); f.detectChanges();
    expect(f.componentInstance.valor()).toBe(5);
    casilla.value = 'abc'; casilla.dispatchEvent(new Event('change')); f.detectChanges();
    expect(f.componentInstance.valor()).toBe(5);
    expect(casilla.value).toBe('5');
  });

  it('el «−», la casilla y el «+» miden lo mismo (una sola altura)', () => {
    const { f, el } = montar();
    f.detectChanges();
    const alturas = Array.from(el.querySelectorAll<HTMLElement>('.paso, .casilla')).map(x => Math.round(x.getBoundingClientRect().height));
    expect(new Set(alturas).size).toBe(1);
  });
});
