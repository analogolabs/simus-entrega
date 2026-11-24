import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DatoEnLecturaComponent } from './dato-en-lectura.component';

@Component({
  standalone: true,
  imports: [DatoEnLecturaComponent],
  template: `
    <dl>
      <div app-dato-en-lectura rotulo="Correo" valor="a@b.test"></div>
      <div app-dato-en-lectura rotulo="Teléfono" valor="" nota="Se cambia desde la cuenta."></div>
    </dl>
  `,
})
class Anfitrion {}

/** UI-F: un `<dl>` solo admite `dt`/`dd` o un `div` que los agrupe; la pieza ES ese `div`. */
describe('el dato en lectura', () => {
  it('cada fila es un `div` hijo directo del `dl` con su `dt` y sus `dd`', () => {
    const f = TestBed.configureTestingModule({ imports: [Anfitrion] }).createComponent(Anfitrion);
    f.detectChanges();
    const dl = f.nativeElement.querySelector('dl') as HTMLElement;
    const filas = Array.from(dl.children) as HTMLElement[];
    expect(filas.map(x => x.tagName)).toEqual(['DIV', 'DIV']);
    for (const fila of filas) {
      for (const hijo of Array.from(fila.children)) expect(['DT', 'DD']).toContain(hijo.tagName);
      expect(fila.querySelectorAll('dt').length).toBe(1);
    }
    expect(filas[0].querySelector('dt')!.textContent).toContain('Correo');
    expect(filas[1].querySelectorAll('dd').length).toBe(2);
  });
});
