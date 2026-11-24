import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FiltroDesplegableComponent } from './filtro-desplegable.component';

@Component({
  standalone: true,
  imports: [FiltroDesplegableComponent],
  template: `
    <app-filtro-desplegable etiqueta="Departamento" identificador="d" [opciones]="opciones" [elegida]="elegida()"
      (cambiar)="elegida.set($event)" />
    <app-filtro-desplegable etiqueta="Estado" rotulo="Estado" identificador="e" [opciones]="opciones" [elegida]="elegida()"
      (cambiar)="elegida.set($event)" />
  `,
})
class Anfitrion {
  readonly opciones = [{ id: '', etiqueta: 'Departamento' }, { id: 'a', etiqueta: 'Antioquia' }, { id: 'b', etiqueta: 'Bolívar' }];
  readonly elegida = signal<string | null>('');
}

/** UI-F: el nombre accesible del desplegable contiene el texto que se ve (WCAG 2.5.3) y su lista es válida para ARIA. */
describe('accesibilidad del desplegable de filtro', () => {
  function montar() {
    const f = TestBed.configureTestingModule({ imports: [Anfitrion] }).createComponent(Anfitrion);
    f.detectChanges();
    return f;
  }
  const botones = (f: ReturnType<typeof montar>) =>
    Array.from(f.nativeElement.querySelectorAll('button.filtro__control')) as HTMLButtonElement[];

  it('sin nada elegido, el nombre es el propio rótulo', () => {
    expect(botones(montar())[0].getAttribute('aria-label')).toBe('Departamento');
  });

  it('con una opción elegida, el nombre incluye el valor que se ve', () => {
    const f = montar();
    f.componentInstance.elegida.set('a');
    f.detectChanges();
    const [sinRotulo, conRotulo] = botones(f);
    expect(sinRotulo.getAttribute('aria-label')).toBe('Departamento: Antioquia');
    expect(sinRotulo.textContent).toContain('Antioquia');
    expect(conRotulo.getAttribute('aria-label')).toBe('Estado: Antioquia');
  });

  it('las opciones de la lista van en un `li` de presentación y el `button` es la opción', () => {
    const f = montar();
    botones(f)[0].click();
    f.detectChanges();
    const lista = f.nativeElement.querySelector('[role="listbox"]') as HTMLElement;
    const items = Array.from(lista.children) as HTMLElement[];
    expect(items.length).toBe(3);
    for (const li of items) {
      expect(li.getAttribute('role')).toBe('presentation');
      expect(li.querySelector('button')?.getAttribute('role')).toBe('option');
    }
  });
});
