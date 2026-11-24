import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TarjetaDeMesaComponent } from './tarjeta-de-mesa.component';

describe('La tarjeta de mesa de la agenda', () => {
  let fixture: ComponentFixture<TarjetaDeMesaComponent>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const poner = (valores: Record<string, unknown>): void => {
    for (const [k, v] of Object.entries(valores)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  };

  beforeEach(() => { fixture = TestBed.createComponent(TarjetaDeMesaComponent); });

  it('dice quién ocupa la mesa y cuántas franjas tiene tomadas', () => {
    poner({ espacio: 'Mesa 2', ocupante: 'Ana Gil', entidad: 'Festival Sur', ocupadas: 3, total: 6 });
    expect(raiz().querySelector('[data-testid="mesa-nombre"]')?.textContent).toContain('Mesa 2');
    expect(raiz().textContent).toContain('Ana Gil');
    expect(raiz().querySelector('[data-testid="mesa-ocupacion"]')?.textContent).toContain('3 de 6 franjas ocupadas');
    expect(raiz().textContent).not.toContain('Completa');
  });

  it('marca la mesa completa y dice cuando no tiene ocupante ni nombre', () => {
    poner({ espacio: null, ocupante: null, ocupadas: 4, total: 4 });
    expect(raiz().textContent).toContain('Mesa sin asignar');
    expect(raiz().textContent).toContain('Sin ocupante');
    expect(raiz().textContent).toContain('Completa');
  });
});
