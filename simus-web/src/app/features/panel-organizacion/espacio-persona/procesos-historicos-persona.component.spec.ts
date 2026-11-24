import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ExternalSessionService, OrganizacionDeSesion } from '../../../core/services/external-session.service';
import { ProcesosHistoricosPersonaComponent } from './procesos-historicos-persona.component';

/**
 * «Festivales históricos» para quien aún no tiene organización (D3-10, decisión 74): le dice qué falta
 * en lugar de dejarla en «Mi espacio» sin contexto, y si ya administra alguna, elige con cuál pedirlo.
 */
describe('ProcesosHistoricosPersonaComponent', () => {
  function crear(organizaciones: OrganizacionDeSesion[], consulta: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [ProcesosHistoricosPersonaComponent],
      providers: [
        provideRouter([]),
        { provide: ExternalSessionService, useValue: { organizaciones: signal(organizaciones) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(consulta) } } },
      ],
    });
    const fixture = TestBed.createComponent(ProcesosHistoricosPersonaComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sin organización dice qué falta y ofrece registrar una o pedir una invitación', () => {
    const el = crear([], { reclamar: '107', buscar: 'Festival del Bambuco' });
    expect(el.querySelector('[data-testid="historicos-persona-sin-organizacion"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="historicos-persona-festival"]')?.textContent).toContain('«Festival del Bambuco»');
    expect(el.querySelector('a[href="/gestion/cuenta/organizaciones/registrar"]')).not.toBeNull();
    expect(el.textContent).toContain('pide a quien la administra que te invite');
    expect(el.querySelector('[data-testid="historicos-persona-con-organizacion"]')).toBeNull();
  });

  it('con organizaciones elige con cuál pedirlo y conserva el Festival buscado', () => {
    const el = crear([{ id: '117', name: 'Corporación Cantaclaro', role: 'administrador' }, { id: '5', name: 'Colectivo Llano Adentro', role: 'editor' }],
      { reclamar: '107', buscar: 'Bambuco' });
    expect(el.querySelector('[data-testid="historicos-persona-sin-organizacion"]')).toBeNull();
    // DECISIÓN 90: nunca se elige por la persona.
    expect(el.querySelector('[data-testid="historicos-persona-con-organizacion"]')?.textContent).toContain('no escogemos una por ti');
    const enlaces = Array.from(el.querySelectorAll<HTMLAnchorElement>('[data-testid="historicos-persona-con-organizacion"] a'));
    expect(enlaces.map(a => a.getAttribute('href'))).toEqual([
      '/gestion/o/117/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco',
      '/gestion/o/5/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco',
    ]);
  });

  it('sin Festival pedido no enseña el aviso del Festival', () => {
    expect(crear([]).querySelector('[data-testid="historicos-persona-festival"]')).toBeNull();
  });
});
