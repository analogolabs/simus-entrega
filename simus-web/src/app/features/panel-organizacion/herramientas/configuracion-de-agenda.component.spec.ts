import { TestBed } from '@angular/core/testing';

import { MODOS_DE_AGENDA, vocabularioDeModo } from '../../../core/services/agendamiento-de-citas.service';
import { ConfiguracionDeAgendaComponent } from './configuracion-de-agenda.component';

describe('La modalidad de la agenda', () => {
  it('la más común (compradores con mesa fija, artistas que rotan) va primera y es la predeterminada', () => {
    expect(MODOS_DE_AGENDA[0].valor).toBe('compradores_fijos');
    expect(MODOS_DE_AGENDA[0].frecuencia).toBe('La más común');
    expect(MODOS_DE_AGENDA[1].frecuencia).toBe('Menos frecuente');
    expect(vocabularioDeModo(null).sitioFijo).toBe('mesa');
    expect(vocabularioDeModo('compradores_rotan').sitioFijo).toBe('stand');
  });

  it('el asistente la ofrece primero, rotulada, y arranca con ella elegida', () => {
    const fixture = TestBed.createComponent(ConfiguracionDeAgendaComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const opciones = Array.from(raiz.querySelectorAll('[role="radiogroup"] [role="radio"]'));
    expect(opciones[0].getAttribute('data-testid')).toBe('modo-compradores_fijos');
    expect(opciones[0].getAttribute('aria-checked')).toBe('true');
    expect(opciones[0].textContent).toContain('La más común');
    expect(opciones[1].textContent).toContain('Menos frecuente');
  });
});
