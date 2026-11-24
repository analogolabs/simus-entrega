import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Franja } from '../../../core/services/agendamiento-de-citas.service';
import { CalendarioDeAgendaComponent, CeldaDeFranja } from './calendario-de-agenda.component';

const FRANJAS: Franja[] = [
  { id: 1, inicioUtc: '2026-12-19T14:00:00Z', finUtc: '2026-12-19T14:20:00Z' },
  { id: 2, inicioUtc: '2026-12-19T14:25:00Z', finUtc: '2026-12-19T14:45:00Z' },
  { id: 3, inicioUtc: '2026-12-20T14:00:00Z', finUtc: '2026-12-20T14:20:00Z' },
];

@Component({
  standalone: true,
  imports: [CalendarioDeAgendaComponent],
  template: `<app-calendario-de-agenda [franjas]="franjas" [celdas]="celdas()" (elegir)="elegida = $event" />`,
})
class AnfitrionDePrueba {
  franjas = FRANJAS;
  elegida: number | null = null;
  celdas = signal<CeldaDeFranja[]>([
    { franjaId: 1, estado: 'confirmada', lineas: ['Con Ana'], etiqueta: 'sáb 09:00. Con Ana. Confirmada', accionable: true },
    { franjaId: 2, estado: 'disponible', lineas: ['Pedir cita'], etiqueta: 'sáb 09:25. Disponible', accionable: true },
  ]);
}

describe('El calendario de la agenda', () => {
  let fixture: ComponentFixture<AnfitrionDePrueba>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const celda = (id: number): HTMLButtonElement => raiz().querySelector(`[data-celda="${id}"]`) as HTMLButtonElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(AnfitrionDePrueba);
    fixture.detectChanges();
  });

  it('dibuja una celda por franja, con su estado en palabras y un nombre accesible', () => {
    expect(celda(1).textContent).toContain('Confirmada');
    expect(celda(2).textContent).toContain('Disponible para pedir');
    expect(celda(3).getAttribute('data-estado')).toBe('libre');
    expect(celda(1).getAttribute('aria-label')).toContain('Con Ana');
    expect(raiz().querySelector('[data-testid="calendario-leyenda"]')?.textContent).toContain('Confirmada');
  });

  it('solo una celda entra en el orden de tabulación', () => {
    const con = Array.from(raiz().querySelectorAll('button[data-celda]')).filter(b => b.getAttribute('tabindex') === '0');
    expect(con.length).toBe(1);
  });

  it('las flechas mueven el foco entre celdas y Enter la elige', () => {
    celda(1).focus();
    celda(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(celda(2));
    celda(2).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(celda(1));
    celda(1).click();
    expect(fixture.componentInstance.elegida).toBe(1);
  });

  it('la vista de día muestra una sola jornada y se navega entre jornadas con franjas', () => {
    const dia = Array.from(raiz().querySelectorAll('app-selector-segmentado button')).find(b => b.textContent?.trim() === 'Día') as HTMLButtonElement;
    dia.click();
    fixture.detectChanges();
    expect(raiz().querySelectorAll('thead th[data-dia]').length).toBe(1);
    (raiz().querySelector('[data-testid="calendario-siguiente"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(raiz().querySelector('[data-celda="3"]')).not.toBeNull();
  });
});
