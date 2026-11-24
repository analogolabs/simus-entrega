import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Franja } from '../../../core/services/agendamiento-de-citas.service';
import { CeldaDeParrilla, FilaDeParrilla, ParrillaDeAgendaComponent } from './parrilla-de-agenda.component';

const FRANJAS: Franja[] = [
  { id: 1, inicioUtc: '2026-12-19T14:00:00Z', finUtc: '2026-12-19T14:20:00Z' },
  { id: 2, inicioUtc: '2026-12-19T14:25:00Z', finUtc: '2026-12-19T14:45:00Z' },
  { id: 3, inicioUtc: '2026-12-20T14:00:00Z', finUtc: '2026-12-20T14:20:00Z' },
];
const PERSONAS: FilaDeParrilla[] = [
  { id: 10, nombre: 'Diana Zapata', entidad: 'Bandas del Oriente', espacio: 'Mesa 1' },
  { id: 11, nombre: 'Booking Sala del Mar', entidad: null },
];

@Component({
  standalone: true,
  imports: [ParrillaDeAgendaComponent],
  template: `<app-parrilla-de-agenda [personas]="personas" [ahora]="ahora" [franjas]="franjas" [celdas]="celdas" (elegir)="elegida = $event" />`,
})
class Anfitrion {
  personas = PERSONAS;
  ahora = new Date('2026-12-19T14:10:00Z');
  franjas = FRANJAS;
  elegida: { columnaId: number; franjaId: number } | null = null;
  celdas = new Map<string, CeldaDeParrilla>([
    ['10-1', { estado: 'confirmada', texto: 'Valentina' }],
    ['10-2', { estado: 'solicitada', texto: 'José' }],
    ['11-2', { estado: 'rechazada', texto: 'Andrés' }],
  ]);
}

describe('La parrilla de la agenda', () => {
  let fixture: ComponentFixture<Anfitrion>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const celda = (c: number, f: number): HTMLButtonElement => raiz().querySelector(`[data-celda="${c}-${f}"]`) as HTMLButtonElement;

  beforeEach(() => { fixture = TestBed.createComponent(Anfitrion); fixture.detectChanges(); });

  it('pone a las personas en filas, con su organización y su mesa, y las franjas en columnas', () => {
    expect(raiz().querySelectorAll('tbody th[data-columna]').length).toBe(2);
    expect(raiz().querySelector('[data-columna="10"]')?.textContent).toContain('Bandas del Oriente');
    expect(raiz().querySelector('[data-columna="10"]')?.textContent).toContain('Mesa o sala: Mesa 1');
    expect(raiz().querySelectorAll('tbody button[data-celda]').length).toBe(6);
  });

  it('cada celda dice su estado con palabras y lo que no está en el mapa es libre', () => {
    expect(celda(10, 1).textContent).toContain('Confirmada');
    expect(celda(10, 2).getAttribute('data-estado')).toBe('solicitada');
    expect(celda(11, 1).textContent).toContain('Libre');
    expect(celda(10, 1).getAttribute('aria-label')).toContain('Diana Zapata');
  });

  it('cuenta las franjas ocupadas por comprador y marca «Completo» cuando no le queda ninguna libre', () => {
    expect(raiz().querySelector('[data-testid="ocupacion-10"]')?.textContent).toContain('2 de 3 franjas ocupadas');
    expect(raiz().querySelector('[data-testid="ocupacion-10"]')?.textContent).not.toContain('Completo');
    fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.celdas = new Map<string, CeldaDeParrilla>([
      ['10-1', { estado: 'confirmada' }], ['10-2', { estado: 'confirmada' }], ['10-3', { estado: 'solicitada' }],
    ]);
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid="ocupacion-10"]')?.textContent).toContain('Completo');
  });

  it('marca las franjas en las que nadie tiene nada y se mueve con las flechas', () => {
    expect(raiz().textContent).toContain('Sin citas');
    celda(10, 1).focus();
    celda(10, 1).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(celda(10, 2));
    celda(10, 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(celda(11, 2));
    celda(11, 1).click();
    expect(fixture.componentInstance.elegida).toEqual({ columnaId: 11, franjaId: 1 });
  });

  it('marca en la cabecera la franja de ahora y señala los cruces de horario', () => {
    expect(raiz().querySelector('thead th.ahora')?.textContent).toContain('Ahora');
    expect(raiz().querySelector('thead th.ahora')?.textContent).toContain('09:00');
    fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.celdas = new Map<string, CeldaDeParrilla>([['10-1', { estado: 'solicitada', texto: 'Ana', conflicto: true }]]);
    fixture.detectChanges();
    expect(celda(10, 1).textContent).toContain('Cruce de horario');
    expect(celda(10, 1).getAttribute('aria-label')).toContain('cruce de horario');
    expect(raiz().querySelector('[data-testid="total-cruces"]')?.textContent).toContain('1');
  });

  it('la leyenda siempre dice cuántos cruces hay, también cuando no hay ninguno', () => {
    const indicador = raiz().querySelector('[data-testid="total-cruces"]');
    expect(indicador?.textContent).toContain('Cruces');
    expect(raiz().querySelector('[data-testid="cantidad-de-cruces"]')?.textContent).toContain('ninguno');
  });

  it('filtra por día', () => {
    (Array.from(raiz().querySelectorAll('app-selector-segmentado button')).find(b => b.textContent?.includes('Domingo')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(raiz().querySelectorAll('tbody button[data-celda]').length).toBe(2);
  });

  it('cuenta las celdas de cada estado en la leyenda y marca el estado con una forma, no solo con color', () => {
    expect(raiz().querySelector('[data-testid="total-confirmada"]')?.textContent?.trim()).toBe('1');
    expect(raiz().querySelector('[data-testid="total-libre"]')?.textContent?.trim()).toBe('3');
    expect(celda(10, 1).querySelector('.glifo')?.getAttribute('aria-hidden')).toBe('true');
  });
});
