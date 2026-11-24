import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IndicadorDePasosComponent } from './indicador-de-pasos.component';

describe('IndicadorDePasosComponent', () => {
  let fixture: ComponentFixture<IndicadorDePasosComponent>;
  let componente: IndicadorDePasosComponent;

  const PASOS = [
    { id: 1, titulo: 'Uno' },
    { id: 2, titulo: 'Dos' },
    { id: 3, titulo: 'Tres' },
  ];

  function montar(pasoActivo: number): void {
    fixture = TestBed.createComponent(IndicadorDePasosComponent);
    componente = fixture.componentInstance;
    componente.pasos = PASOS;
    componente.pasoActivo = pasoActivo;
    fixture.detectChanges();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('el paso activo lleva aria-current="step" y ningún otro', () => {
    montar(2);

    const botones = Array.from(raiz().querySelectorAll('button'));
    expect(botones.map(b => b.getAttribute('aria-current'))).toEqual([null, 'step', null]);
  });

  it('los pasos anteriores al activo se marcan completados -con su SVG de visto-, los siguientes no', () => {
    montar(2);

    expect(componente.estadoDelPaso(1)).toBe('completado');
    expect(componente.estadoDelPaso(2)).toBe('activo');
    expect(componente.estadoDelPaso(3)).toBe('pendiente');

    const botones = Array.from(raiz().querySelectorAll('button'));
    expect(botones[0].querySelector('svg')).withContext('el paso completado lleva el visto').not.toBeNull();
    expect(botones[1].querySelector('svg')).withContext('el paso activo muestra su número, no un visto').toBeNull();
    expect(botones[2].querySelector('svg')).withContext('el paso pendiente muestra su número, no un visto').toBeNull();
  });

  it('un clic en un paso emite su id', () => {
    montar(1);
    const emitidos: number[] = [];
    componente.irAlPaso.subscribe((id: number) => emitidos.push(id));

    raiz().querySelectorAll('button')[2].click();

    expect(emitidos).toEqual([3]);
  });

  it('con `estados`, un paso anterior al activo NO es «completado» solo por haberse visitado', () => {
    montar(3);
    componente.estados = { 1: 'completo', 2: 'incompleto' };

    expect(componente.estadoDelPaso(1)).toBe('completado');
    expect(componente.estadoDelPaso(2)).toBe('incompleto');
    expect(componente.estadoDelPaso(3)).toBe('activo');
  });

  it('con `estados`, un paso sin visitar queda pendiente aunque esté antes del activo', () => {
    montar(3);
    componente.estados = { 2: 'completo' };

    expect(componente.estadoDelPaso(1)).toBe('pendiente');
  });

  it('el paso incompleto lo dice a quien usa lector de pantalla y se pinta con «!»', () => {
    montar(1);
    componente.estados = { 2: 'incompleto' };
    fixture.detectChanges();

    const botones = Array.from(raiz().querySelectorAll('button'));
    expect(botones[1].textContent).toContain('!');
    expect(botones[1].querySelector('.sr-only')?.textContent).toContain('Falta completar');
  });

  it('`numero` cambia lo que se pinta sin cambiar el id que se emite (el registro individual va 1 → 2)', () => {
    montar(1);
    componente.pasos = [{ id: 1, titulo: 'Uno' }, { id: 3, titulo: 'Tres', numero: 2 }];
    fixture.detectChanges();
    const emitidos: number[] = [];
    componente.irAlPaso.subscribe((id: number) => emitidos.push(id));

    const botones = Array.from(raiz().querySelectorAll('button'));
    expect(botones[1].textContent).toContain('2');
    botones[1].click();
    expect(emitidos).toEqual([3]);
  });
});
