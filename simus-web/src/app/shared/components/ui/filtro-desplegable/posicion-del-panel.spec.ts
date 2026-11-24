import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FiltroDesplegableComponent } from './filtro-desplegable.component';

const DEPARTAMENTOS = Array.from({ length: 33 }, (_, i) => ({ id: `d${i}`, etiqueta: `Departamento ${i + 1}` }));

@Component({
  standalone: true,
  imports: [FiltroDesplegableComponent],
  styles: [`.caja { position: fixed; left: 0; width: 18rem; height: 6rem; overflow-y: auto; padding: 1rem; }`],
  template: `
    <div class="caja" [style.top.px]="arriba" data-caja>
      <app-filtro-desplegable etiqueta="Departamento" identificador="d" [completo]="true" [opciones]="opciones" />
    </div>
  `,
})
class Anfitrion {
  arriba = 8;
  readonly opciones = DEPARTAMENTOS;
}

/** A-3: el panel se calcula contra la ventana, no contra la caja con scroll que lo contiene. */
describe('posición del panel del desplegable (A-3)', () => {
  let f: ComponentFixture<Anfitrion>;
  const boton = () => f.nativeElement.querySelector('button.filtro__control') as HTMLButtonElement;
  const panel = () => f.nativeElement.querySelector('.filtro__panel') as HTMLElement | null;
  const abrir = async () => { boton().click(); f.detectChanges(); await f.whenStable(); await new Promise(r => requestAnimationFrame(() => r(null))); f.detectChanges(); };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    f = TestBed.createComponent(Anfitrion);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
  });
  afterEach(() => f.nativeElement.remove());

  it('no queda recortado por la caja con overflow: sale de ella y cabe en la ventana', async () => {
    await abrir();
    const p = panel()!.getBoundingClientRect();
    const caja = (f.nativeElement.querySelector('[data-caja]') as HTMLElement).getBoundingClientRect();
    expect(getComputedStyle(panel()!).position).toBe('fixed');
    expect(p.height).toBeGreaterThan(caja.height);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(p.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
  });

  it('la lista recorre sus opciones con scroll interno y el buscador queda fijo', async () => {
    await abrir();
    const lista = f.nativeElement.querySelector('.filtro__lista') as HTMLElement;
    expect(lista.scrollHeight).toBeGreaterThan(lista.clientHeight);
    expect(getComputedStyle(lista).overflowY).toBe('auto');
    expect(f.nativeElement.querySelector('.filtro__buscador')).not.toBeNull();
  });

  it('si no cabe debajo, se abre hacia arriba', async () => {
    f.componentInstance.arriba = Math.max(120, window.innerHeight - 150);
    f.detectChanges();
    await abrir();
    expect(panel()!.dataset['lado']).toBe('arriba');
    const p = panel()!.getBoundingClientRect();
    const b = boton().getBoundingClientRect();
    expect(p.bottom).toBeLessThanOrEqual(b.top + 1);
    expect(p.top).toBeGreaterThanOrEqual(0);
  });

  it('Escape lo cierra devolviendo el foco al disparador; un clic fuera lo cierra', async () => {
    await abrir();
    f.nativeElement.querySelector('input[type="search"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(boton());
    await abrir();
    document.body.click();
    f.detectChanges();
    expect(panel()).toBeNull();
  });

  it('las flechas mueven la opción activa (aria-activedescendant) y la mantienen a la vista', async () => {
    await abrir();
    const campo = f.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    for (let i = 0; i < 20; i++) { campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); f.detectChanges(); }
    await new Promise(r => setTimeout(r));
    const activa = document.getElementById(campo.getAttribute('aria-activedescendant')!)!;
    expect(activa.textContent).toContain('Departamento 21');
    const lista = f.nativeElement.querySelector('.filtro__lista') as HTMLElement;
    const a = activa.getBoundingClientRect(), l = lista.getBoundingClientRect();
    expect(a.top).toBeGreaterThanOrEqual(l.top - 1);
    expect(a.bottom).toBeLessThanOrEqual(l.bottom + 1);
  });
});
