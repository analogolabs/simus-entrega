import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgendamientoDeCitasService, EdicionConAgenda } from '../../../core/services/agendamiento-de-citas.service';
import { PanelOrganizacionStore } from '../panel-organizacion.store';
import { AgendaDeCitasHerramientaComponent } from './agenda-de-citas-herramienta.component';

function edicion(parcial: Partial<EdicionConAgenda>): EdicionConAgenda {
  return {
    edicionId: 1, mercadoId: 10, mercadoNombre: 'Mercado A', anio: 2026, edicionNombre: null, estadoEdicion: 'programada',
    fechaInicio: null, fechaFin: null, agendaId: null, agendaEstado: null, agendas: null, ...parcial,
  };
}

describe('AgendaDeCitasHerramientaComponent', () => {
  function montar(ediciones: EdicionConAgenda[]): HTMLElement {
    TestBed.configureTestingModule({
      imports: [AgendaDeCitasHerramientaComponent],
      providers: [
        provideRouter([]),
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('31') } },
        { provide: AgendamientoDeCitasService, useValue: { edicionesConAgenda: () => of(ediciones) } },
      ],
    });
    const fixture = TestBed.createComponent(AgendaDeCitasHerramientaComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('agrupa las ediciones por Mercado y resume el contador', () => {
    const el = montar([
      edicion({ edicionId: 1, mercadoId: 10, mercadoNombre: 'Mercado A', anio: 2026 }),
      edicion({ edicionId: 2, mercadoId: 10, mercadoNombre: 'Mercado A', anio: 2025, agendaId: 7, agendaEstado: 'abierta' as never }),
      edicion({ edicionId: 3, mercadoId: 11, mercadoNombre: 'Mercado B', anio: 2026 }),
    ]);
    const grupos = Array.from(el.querySelectorAll('[data-testid="ediciones-por-mercado"] > section'));
    expect(grupos.length).toBe(2);
    expect(grupos[0].querySelector('h2')?.textContent).toContain('Mercado A');
    expect(grupos[0].querySelectorAll('[data-testid="fila-de-edicion"]').length).toBe(2);
    expect(el.querySelector('[data-testid="contador-de-la-pantalla"]')?.textContent).toContain('2 Mercados · 3 ediciones · 1 con agenda');
  });

  it('ofrece habilitar donde no hay agenda y gestionar donde ya existe, con las rutas de siempre', () => {
    const el = montar([
      edicion({ edicionId: 1, mercadoId: 10 }),
      edicion({ edicionId: 2, mercadoId: 10, anio: 2025, agendaId: 7, agendaEstado: 'abierta' as never }),
    ]);
    expect(el.querySelector('[data-testid="habilitar-agenda"]')?.getAttribute('href')).toBe('/gestion/o/31/procesos/mercados/10/agenda-de-citas/nueva/1');
    expect(el.querySelector('[data-testid="gestionar-agenda"]')?.getAttribute('href')).toBe('/gestion/o/31/procesos/mercados/10/agenda-de-citas/7');
  });
});
