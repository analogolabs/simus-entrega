import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FiltroDesplegableComponent, OpcionDeFiltro } from './filtro-desplegable.component';

/**
 * Un desplegable anclado DENTRO de un asistente: ancestro con transform (la animación de entrada de un diálogo), un
 * buscador que se activa por el número de opciones, y opciones que llegan como un arreglo NUEVO en cada detección de
 * cambios (lo que hace el asistente de registro de Festival al derivar la lista de municipios del departamento).
 * Regresión de la cola de: el panel abría y la página dejaba de responder, así que las opciones nunca se podían elegir.
 */
@Component({
  standalone: true,
  imports: [FiltroDesplegableComponent],
  styles: [`.asistente { position: fixed; top: 40px; left: 40px; width: 24rem; height: 10rem; overflow: auto; transform: translateY(0); }`],
  template: `
    <div class="asistente" role="dialog" aria-label="Asistente">
      <app-filtro-desplegable etiqueta="Departamento" identificador="asistente-departamento" idDelControl="asistente-departamento"
        [completo]="true" [opciones]="opciones()" [elegida]="elegida()" (cambiar)="elegida.set($event); cambios = cambios + 1" />
    </div>
  `,
})
class Asistente {
  readonly elegida = signal('');
  cambios = 0;
  /** Un arreglo nuevo cada vez que se lee, como una lista derivada que se recalcula. */
  opciones(): readonly OpcionDeFiltro[] {
    return [{ id: '', etiqueta: 'Departamento' }, ...Array.from({ length: 32 }, (_, i) => ({ id: `d${i}`, etiqueta: `Departamento ${i + 1}` }))];
  }
}

describe('selección en un desplegable anclado dentro de un asistente', () => {
  let f: ComponentFixture<Asistente>;
  const tick = () => new Promise(r => setTimeout(r, 30));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Asistente] });
    f = TestBed.createComponent(Asistente);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
  });
  afterEach(() => f.nativeElement.remove());

  it('abre, muestra las opciones, se elige una con el ratón y se cierra', async () => {
    (f.nativeElement.querySelector('#asistente-departamento') as HTMLButtonElement).click();
    f.detectChanges(); await tick(); f.detectChanges();
    const opciones = f.nativeElement.querySelectorAll('[role="option"]');
    expect(opciones.length).toBe(33);
    (opciones[1] as HTMLButtonElement).click();
    f.detectChanges(); await tick(); f.detectChanges();
    expect(f.componentInstance.elegida()).toBe('d0');
    expect(f.componentInstance.cambios).toBe(1);
    expect(f.nativeElement.querySelector('.filtro__panel')).toBeNull();
  });

  it('se elige con el teclado: flechas y Enter, sin que el panel se quede colgado', async () => {
    (f.nativeElement.querySelector('#asistente-departamento') as HTMLButtonElement).click();
    f.detectChanges(); await tick();
    const campo = f.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    for (let i = 0; i < 3; i++) { campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); f.detectChanges(); }
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    f.detectChanges(); await tick();
    expect(f.componentInstance.elegida()).toBe('d2');
  });

  it('el panel queda dentro de la ventana aunque el asistente tenga transform y scroll', async () => {
    (f.nativeElement.querySelector('#asistente-departamento') as HTMLButtonElement).click();
    f.detectChanges(); await tick(); await new Promise(r => requestAnimationFrame(() => r(null)));
    const p = (f.nativeElement.querySelector('.filtro__panel') as HTMLElement).getBoundingClientRect();
    const b = (f.nativeElement.querySelector('#asistente-departamento') as HTMLElement).getBoundingClientRect();
    expect(p.top).toBeGreaterThanOrEqual(b.bottom - 1);
    expect(p.bottom).toBeLessThanOrEqual(window.innerHeight);
  });
});
