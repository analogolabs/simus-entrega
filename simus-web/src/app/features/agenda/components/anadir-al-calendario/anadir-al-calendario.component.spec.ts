import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EventoDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { AnadirAlCalendarioComponent } from './anadir-al-calendario.component';

@Component({
  standalone: true,
  imports: [AnadirAlCalendarioComponent],
  template: '<app-anadir-al-calendario [evento]="evento" />',
})
class AnfitrionComponent {
  evento: EventoDeDiseno = {
    id: '1', slug: 'semana-de-la-musica', t: 'Semana de la Música', desc: 'Encuentro.', d: '11', m: 'SEP', y: '2026',
    fechaFin: '2026-09-11', time: '7:30 PM', horaInicio: '19:30:00', horaFin: '22:00:00', l: 'PAIPA, BOYACÁ', cat: '', img: '',
    organizer: '', exactLocation: 'Teatro Municipal', link: '', dateObj: new Date(2026, 8, 11, 12), departmentCode: '', municipalityCode: '',
    department: '', municipality: '', situacion: 'proximo',
  };
}

describe('AnadirAlCalendarioComponent (A-6)', () => {
  function montar() {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const disparador = () => raiz.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
    return { fixture, raiz, disparador };
  }

  it('cerrado no pinta el menú, y el disparador dice que abre uno', () => {
    const { raiz, disparador } = montar();
    expect(raiz.querySelector('[role="menu"]')).toBeNull();
    expect(disparador().getAttribute('aria-expanded')).toBe('false');
  });

  it('abre un menú con tres caminos; los dos enlaces salen a otra pestaña con el evento ya escrito', () => {
    const { fixture, raiz, disparador } = montar();
    disparador().click();
    fixture.detectChanges();

    expect(disparador().getAttribute('aria-expanded')).toBe('true');
    const google = raiz.querySelector<HTMLAnchorElement>('[data-testid="calendario-google"]')!;
    const outlook = raiz.querySelector<HTMLAnchorElement>('[data-testid="calendario-outlook"]')!;
    expect(google.href).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(google.href).toContain('dates=20260911T193000/20260911T220000');
    expect(google.target).toBe('_blank');
    expect(google.rel).toContain('noopener');
    expect(outlook.href).toContain('https://outlook.live.com/calendar/0/deeplink/compose');
    expect(raiz.querySelector('[data-testid="calendario-ics"]')).not.toBeNull();
  });

  it('Escape cierra el menú y devuelve el foco al botón', () => {
    const { fixture, raiz, disparador } = montar();
    disparador().click();
    fixture.detectChanges();

    raiz.querySelector('[role="menu"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(raiz.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(disparador());
  });

  it('un clic fuera lo cierra', () => {
    const { fixture, raiz, disparador } = montar();
    disparador().click();
    fixture.detectChanges();

    document.body.click();
    fixture.detectChanges();
    expect(raiz.querySelector('[role="menu"]')).toBeNull();
  });
});
