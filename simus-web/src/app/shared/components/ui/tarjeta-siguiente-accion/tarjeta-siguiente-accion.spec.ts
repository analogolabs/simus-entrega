import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccionDeProceso, ContextoDeProceso, siguienteAccion } from '../../../../core/acciones/acciones-por-estado';
import { TarjetaSiguienteAccionComponent } from './tarjeta-siguiente-accion.component';

@Component({
  standalone: true,
  imports: [TarjetaSiguienteAccionComponent],
  template: `
    <app-tarjeta-siguiente-accion [siguiente]="siguiente()" (elegida)="elegidas.push($event.id)">
      <p data-extra>Falta el municipio</p>
    </app-tarjeta-siguiente-accion>
  `,
})
class Anfitrion {
  readonly contexto = signal<ContextoDeProceso>({ tipo: 'festival', nombre: 'Festival del Río', estado: 'borrador', esAdministradora: true });
  readonly siguiente = () => siguienteAccion(this.contexto());
  elegidas: string[] = [];
}

describe('TarjetaSiguienteAccionComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  const raiz = () => fixture.nativeElement as HTMLElement;
  const boton = (id: string) => raiz().querySelector<HTMLButtonElement>(`[data-accion="${id}"]`)!;

  function con(ctx: Partial<ContextoDeProceso>): void {
    fixture.componentInstance.contexto.update(actual => ({ ...actual, ...ctx }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  it('pinta el título del estado, el contenido proyectado y las acciones del modelo', () => {
    expect(raiz().querySelector('h2')?.textContent).toContain('El registro tiene lo necesario');
    expect(raiz().querySelector('[data-extra]')?.textContent).toContain('Falta el municipio');
    expect(boton('enviar').textContent).toContain('Enviar a revisión');
    expect(boton('completar')).not.toBeNull();
  });

  it('una acción habilitada emite al pulsarla', () => {
    boton('enviar').click();
    expect(fixture.componentInstance.elegidas).toEqual(['enviar']);
  });

  it('una acción apagada sigue ahí, con su motivo escrito, y no emite', () => {
    con({ faltaParaEnviar: 'el municipio' });

    const enviar = boton('enviar');
    expect(enviar.getAttribute('aria-disabled')).toBe('true');
    const motivo = raiz().querySelector<HTMLElement>(`#${enviar.getAttribute('aria-describedby')}`)!;
    expect(motivo.textContent).toContain('Para enviarlo falta el municipio.');

    enviar.click();
    expect(fixture.componentInstance.elegidas).toEqual([]);
  });

  it('para un editor, las acciones de administración llevan la explicación del rol', () => {
    con({ esAdministradora: false });
    expect(boton('enviar').getAttribute('aria-disabled')).toBe('true');
    expect(raiz().textContent).toContain('quien administra la organización');
  });

  it('un Festival publicado ofrece desde la ficha proponer cambios', () => {
    con({ estado: 'Publicado' });
    expect(boton('proponer-cambios')).not.toBeNull();
    expect(boton('solicitar-retiro')).toBeNull(); // las de peligro viven solo en el menú
  });

  it('con una propuesta en borrador ofrece enviarla desde la ficha', () => {
    con({ estado: 'Publicado', estadoPropuesta: 'Borrador' });
    expect(boton('continuar-propuesta')).not.toBeNull();
    boton('enviar-propuesta').click();
    expect(fixture.componentInstance.elegidas).toEqual(['enviar-propuesta']);
  });

  it('los mismos verbos para el mismo estado en Festival y Mercado', () => {
    con({ tipo: 'mercado' });
    const verbos = Array.from(raiz().querySelectorAll('[data-accion]')).map(b => b.textContent?.trim());
    expect(verbos).toEqual(['Enviar a revisión', 'Continuar registro']);
  });

  it('el tipo AccionDeProceso exporta el identificador que la pantalla recibe', () => {
    const accion: AccionDeProceso = siguienteAccion(fixture.componentInstance.contexto()).acciones[0];
    expect(accion.id).toBe('enviar');
  });
});
