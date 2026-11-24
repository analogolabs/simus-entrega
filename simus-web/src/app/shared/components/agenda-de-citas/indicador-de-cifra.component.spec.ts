import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IndicadorDeCifraComponent } from './indicador-de-cifra.component';

describe('El indicador de cifra de la agenda', () => {
  let fixture: ComponentFixture<IndicadorDeCifraComponent>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const poner = (valores: Record<string, unknown>): void => {
    for (const [k, v] of Object.entries(valores)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  };

  beforeEach(() => { fixture = TestBed.createComponent(IndicadorDeCifraComponent); });

  it('con total muestra la barra de avance y su porcentaje en texto accesible', () => {
    poner({ etiqueta: 'Artistas admitidos', valor: 5, de: 8 });
    expect(raiz().querySelector('[data-testid="cifra-valor"]')?.textContent).toContain('5');
    expect(raiz().querySelector('[data-testid="cifra-valor"]')?.textContent).toContain('de 8');
    expect(raiz().querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('63 por ciento');
  });

  it('sin total la cifra va sola, sin barra', () => {
    poner({ etiqueta: 'Citas pedidas', valor: 7, pie: '3 confirmadas' });
    expect(raiz().querySelector('[role="img"]')).toBeNull();
    expect(raiz().textContent).toContain('3 confirmadas');
  });
});
