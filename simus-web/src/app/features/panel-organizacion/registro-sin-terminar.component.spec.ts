import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { BorradorPendiente, BorradoresDeProcesoApi } from './borradores-de-proceso.api';
import { RegistroSinTerminarComponent } from './registro-sin-terminar.component';

/**
 * «Tienes un registro sin terminar»: el borrador abandonado deja de ser invisible.
 */
describe('RegistroSinTerminarComponent', () => {
  let fixture: ComponentFixture<RegistroSinTerminarComponent>;
  let api: jasmine.SpyObj<BorradoresDeProcesoApi>;

  const FESTIVAL: BorradorPendiente = { id: '7', moduloId: 'festivales', nombre: 'Festival del Río', version: 3, fechaActualizacion: '2026-11-06T15:30:00Z' };
  const MERCADO: BorradorPendiente = { id: '8', moduloId: 'mercados', nombre: null, version: 2, fechaActualizacion: '2026-11-06T16:00:00Z' };

  function montar(filas: BorradorPendiente[] | 'falla', modulo: 'festivales' | 'mercados' | null = null): HTMLElement {
    api = jasmine.createSpyObj<BorradoresDeProcesoApi>('BorradoresDeProcesoApi', ['pendientes', 'descartar']);
    api.pendientes.and.returnValue(filas === 'falla' ? throwError(() => new Error('sin red')) : of(filas));
    api.descartar.and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [RegistroSinTerminarComponent],
      providers: [provideRouter([]), { provide: BorradoresDeProcesoApi, useValue: api }],
    });
    fixture = TestBed.createComponent(RegistroSinTerminarComponent);
    fixture.componentRef.setInput('organizacionId', '42');
    if (modulo) fixture.componentRef.setInput('modulo', modulo);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dice que hay un registro sin terminar, cuál es y desde cuándo, en hora de Colombia', () => {
    const raiz = montar([FESTIVAL]);

    const aviso = raiz.querySelector('[data-testid="registro-sin-terminar"]')!;
    expect(aviso.textContent).toContain('Tienes un Festival sin terminar: «Festival del Río»');
    // 15:30 UTC son las 10:30 en Bogotá.
    expect(aviso.textContent).toContain('10:30');
    expect(aviso.textContent).toContain('Aún no está registrado');
  });

  it('«Continuar» lleva al asistente de su proceso, en la organización de la URL', () => {
    const raiz = montar([FESTIVAL, MERCADO]);

    const enlaces = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('[data-testid="continuar-registro"]')).map(a => a.getAttribute('href'));
    expect(enlaces).toEqual(['/gestion/o/42/procesos/festivales/nuevo', '/gestion/o/42/procesos/mercados/nuevo']);
  });

  it('una lista de Festivales solo habla de Festivales', () => {
    const raiz = montar([FESTIVAL, MERCADO], 'festivales');

    expect(raiz.querySelectorAll('[data-testid="registro-sin-terminar"]').length).toBe(1);
    expect(raiz.textContent).not.toContain('Mercado');
  });

  it('«Descartar» pregunta y, al confirmar, borra el borrador y quita el aviso', () => {
    const raiz = montar([FESTIVAL]);

    (raiz.querySelector('[data-testid="descartar-registro"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Descartar el registro sin terminar');
    expect(api.descartar).not.toHaveBeenCalled();

    fixture.componentInstance.descartar(FESTIVAL);
    fixture.detectChanges();

    expect(api.descartar).toHaveBeenCalledWith('7');
    expect(raiz.querySelector('[data-testid="registro-sin-terminar"]')).toBeNull();
  });

  it('sin registros sin terminar, o si la consulta falla, no pinta nada', () => {
    expect(montar([]).querySelector('[data-testid="registro-sin-terminar"]')).toBeNull();
    TestBed.resetTestingModule();
    expect(montar('falla').querySelector('[data-testid="registro-sin-terminar"]')).toBeNull();
  });
});
