import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServicioDeConfirmacion } from '../../../../core/confirmacion/servicio-de-confirmacion';
import { ConfirmacionGlobalComponent } from './confirmacion-global.component';

/** El diálogo de confirmación común: una promesa, un solo anfitrión. */
describe('Diálogo de confirmación común', () => {
  let fixture: ComponentFixture<ConfirmacionGlobalComponent>;
  let servicio: ServicioDeConfirmacion;
  const raiz = () => fixture.nativeElement as HTMLElement;
  const aceptar = () => raiz().querySelector<HTMLButtonElement>('[data-testid="confirmacion-comun-aceptar"]')!;
  const area = () => raiz().querySelector<HTMLTextAreaElement>('textarea')!;

  beforeEach(() => {
    fixture = TestBed.createComponent(ConfirmacionGlobalComponent);
    servicio = TestBed.inject(ServicioDeConfirmacion);
    fixture.detectChanges();
  });

  it('no pinta nada mientras nadie pide confirmación', () => {
    expect(raiz().querySelector('[role="dialog"]')).toBeNull();
  });

  it('muestra qué va a pasar y resuelve con el motivo vacío al confirmar', async () => {
    const respuesta = servicio.pedir({
      titulo: 'Salir de la organización',
      detalle: 'Dejarás de ver los procesos de «Casa Taller».',
      accion: 'Salir',
      tono: 'destructiva',
    });
    fixture.detectChanges();

    expect(raiz().querySelector('h3')?.textContent).toContain('Salir de la organización');
    expect(raiz().textContent).toContain('Dejarás de ver los procesos de «Casa Taller».');
    expect(aceptar().textContent).toContain('Salir');

    aceptar().click();
    fixture.detectChanges();

    expect(await respuesta).toEqual({ motivo: '' });
    expect(raiz().querySelector('[role="dialog"]')).toBeNull();
  });

  it('cancelar resuelve con null y cierra', async () => {
    const respuesta = servicio.pedir({ titulo: 'Publicar la noticia' });
    fixture.detectChanges();

    const cancelar = Array.from(raiz().querySelectorAll('button')).find(b => b.textContent?.includes('Cancelar'))!;
    cancelar.click();
    fixture.detectChanges();

    expect(await respuesta).toBeNull();
    expect(raiz().querySelector('[role="dialog"]')).toBeNull();
  });

  it('con motivo obligatorio no deja confirmar en blanco y devuelve lo escrito', async () => {
    const respuesta = servicio.pedir({
      titulo: 'Rechazar la noticia',
      accion: 'Rechazar',
      tono: 'destructiva',
      pideMotivo: true,
      rotuloDelMotivo: 'Por qué se rechaza',
    });
    fixture.detectChanges();

    expect(raiz().textContent).toContain('Por qué se rechaza');
    expect(aceptar().disabled).toBeTrue();

    area().value = '  No cumple la línea editorial.  ';
    area().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(aceptar().disabled).toBeFalse();

    aceptar().click();
    expect(await respuesta).toEqual({ motivo: 'No cumple la línea editorial.' });
  });

  it('una petición nueva cancela la anterior: nunca hay dos diálogos', async () => {
    const primera = servicio.pedir({ titulo: 'Primera' });
    const segunda = servicio.pedir({ titulo: 'Segunda' });
    fixture.detectChanges();

    expect(await primera).toBeNull();
    expect(raiz().querySelectorAll('[role="dialog"]').length).toBe(1);
    expect(raiz().querySelector('h3')?.textContent).toContain('Segunda');
    servicio.cancelar();
    expect(await segunda).toBeNull();
  });
});
