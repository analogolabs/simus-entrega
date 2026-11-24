import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LineaDeEtapasComponent } from './linea-de-etapas.component';

describe('La línea de etapas de la agenda', () => {
  let fixture: ComponentFixture<LineaDeEtapasComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LineaDeEtapasComponent);
    fixture.componentRef.setInput('etapas', [
      { id: 'borrador', texto: 'En preparación', actual: false, hecha: true },
      { id: 'abierta', texto: 'Inscripción abierta', actual: true, hecha: false },
      { id: 'en_curso', texto: 'En curso', actual: false, hecha: false },
    ]);
    fixture.detectChanges();
  });

  it('marca la etapa actual y dice con palabras cuál ya se hizo', () => {
    const items = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li'));
    expect(items.map(i => i.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    expect(items[0].textContent).toContain('(hecha)');
    expect(items[1].textContent).toContain('Inscripción abierta');
  });
});
