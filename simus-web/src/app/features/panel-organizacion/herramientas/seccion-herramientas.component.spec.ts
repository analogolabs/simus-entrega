import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PanelOrganizacionStore } from '../panel-organizacion.store';
import { SeccionHerramientasComponent } from './seccion-herramientas.component';

describe('SeccionHerramientasComponent', () => {
  function montar(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [SeccionHerramientasComponent],
      providers: [provideRouter([]), { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('31') } }],
    });
    const fixture = TestBed.createComponent(SeccionHerramientasComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('ofrece la herramienta de procesos históricos con su propia dirección', () => {
    const el = montar();
    expect(el.querySelector('[data-testid="herramienta-procesos-historicos"]')?.textContent).toContain('Procesos históricos');
    expect(el.querySelector('[data-testid="abrir-procesos-historicos"]')?.getAttribute('href'))
      .toBe('/gestion/o/31/herramientas/procesos-historicos');
  });

  it('ofrece la agenda de citas como una herramienta con su propia entrada, igual que las demás', () => {
    const el = montar();
    expect(el.querySelector('[data-testid="herramienta-agenda-de-citas"]')?.textContent).toContain('Agenda de citas');
    expect(el.querySelector('[data-testid="abrir-agenda-de-citas"]')?.getAttribute('href'))
      .toBe('/gestion/o/31/herramientas/agenda-de-citas');
    expect(el.querySelectorAll('[data-testid="lista-de-herramientas"] > li').length).toBe(2);
    // El listado de ediciones ya no está en esta pantalla: vive dentro de la herramienta.
    expect(el.querySelector('[data-testid="fila-de-edicion"]')).toBeNull();
  });
});
