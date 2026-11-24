import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VistaPreviaDeAgendaComponent } from './vista-previa-de-agenda.component';

describe('La vista previa de la agenda', () => {
  let fixture: ComponentFixture<VistaPreviaDeAgendaComponent>;
  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const ancho = (): string => ((fixture.nativeElement as HTMLElement).querySelector('.barra > span') as HTMLElement).style.width;

  beforeEach(() => { fixture = TestBed.createComponent(VistaPreviaDeAgendaComponent); });

  it('antes de guardar la agenda cuenta 0 admitidos', () => {
    fixture.componentRef.setInput('cupoDeArtistas', 5);
    fixture.detectChanges();
    expect(texto()).toContain('Artistas admitidos: 0 de 5');
  });

  it('con la agenda ya en marcha dice los admitidos reales y llena la barra en proporción', () => {
    fixture.componentRef.setInput('cupoDeArtistas', 5);
    fixture.componentRef.setInput('admitidos', 5);
    fixture.detectChanges();
    expect(texto()).toContain('Artistas admitidos: 5 de 5');
    expect(ancho()).toBe('100%');
  });

  it('sin cupo dice «sin límite»', () => {
    fixture.componentRef.setInput('admitidos', 3);
    fixture.detectChanges();
    expect(texto()).toContain('Artistas admitidos: 3 de sin límite');
  });
});
