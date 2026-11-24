import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BuscadorDeListaComponent } from './buscador-de-lista.component';

@Component({
  standalone: true,
  imports: [BuscadorDeListaComponent],
  template: `
    <span class="campo__rotulo">Buscar</span>
    <app-buscador-de-lista identificador="solo-span" etiqueta="Buscar en el mapa" [etiquetaVisible]="true" [valor]="''" />
    <label for="con-label">Buscar</label>
    <app-buscador-de-lista identificador="con-label" etiqueta="Buscar cosas" [etiquetaVisible]="true" [valor]="''" />
    <app-buscador-de-lista identificador="suelto" etiqueta="Buscar sueltos" [valor]="''" />
  `,
})
class AnfitrionDeNombres {}

/** UI-F: todo buscador tiene nombre accesible; si la pantalla pinta su rótulo con `<label for>`, no se duplica. */
describe('el nombre accesible del buscador de una lista', () => {
  it('con `etiquetaVisible` y sin `<label for>`, el campo lleva `aria-label` (antes solo tenía el placeholder)', async () => {
    const f = TestBed.configureTestingModule({ imports: [AnfitrionDeNombres] }).createComponent(AnfitrionDeNombres);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const q = (id: string) => f.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    expect(q('solo-span').getAttribute('aria-label')).toBe('Buscar en el mapa');
    expect(q('con-label').getAttribute('aria-label')).toBeNull();
    expect(q('con-label').labels?.length).toBe(1);
    expect(q('suelto').getAttribute('aria-label')).toBeNull();
    expect(q('suelto').labels?.length).toBe(1);
  });
});
