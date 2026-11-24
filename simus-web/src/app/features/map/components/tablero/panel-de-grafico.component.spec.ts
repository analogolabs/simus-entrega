import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PanelDeGraficoComponent } from './panel-de-grafico.component';
import { fichaDelIndicador } from '../../domain/indicadores-del-tablero';

describe('PanelDeGraficoComponent', () => {
  let fixture: ComponentFixture<PanelDeGraficoComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const verTabla = () => (el().querySelector('[data-testid="ver-tabla"]') as HTMLButtonElement).click();

  beforeEach(() => {
    fixture = TestBed.createComponent(PanelDeGraficoComponent);
    fixture.componentRef.setInput('idDelTitulo', 'p');
    fixture.componentRef.setInput('pregunta', '¿Cuántos hay?');
    fixture.componentRef.setInput('titulo', 'Registros');
    fixture.componentRef.setInput('lectura', 'La longitud es la cantidad.');
    fixture.componentRef.setInput('encabezados', ['Departamento', 'Registros']);
    fixture.componentRef.setInput('filas', [{ clave: 'Cauca', celdas: ['Cauca', 7] }, { clave: 'Meta', celdas: ['Meta', 5] }]);
    fixture.componentRef.setInput('elegible', true);
    fixture.componentRef.setInput('ficha', fichaDelIndicador('registros-por-departamento'));
    fixture.componentRef.setInput('filtros', ['Departamento: Cauca']);
    fixture.detectChanges();
  });

  it('«Ver tabla» muestra de verdad la tabla equivalente y «Ocultar tabla» la quita', () => {
    expect(el().querySelector('table')).toBeNull();
    const boton = el().querySelector('[data-testid="ver-tabla"]') as HTMLButtonElement;
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.textContent!.trim()).toBe('Ver tabla');
    verTabla();
    fixture.detectChanges();
    expect(el().querySelectorAll('tbody tr').length).toBe(2);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.textContent!.trim()).toBe('Ocultar tabla');
    verTabla();
    fixture.detectChanges();
    expect(el().querySelector('table')).toBeNull();
  });

  it('la tabla equivalente permite aplicar el mismo filtro desde el teclado', () => {
    const elegidas: string[] = [];
    fixture.componentInstance.elegir.subscribe((c) => elegidas.push(c));
    verTabla();
    fixture.detectChanges();
    const boton = el().querySelector('tbody button') as HTMLButtonElement;
    expect(boton.textContent!.trim()).toBe('Cauca');
    boton.click();
    expect(elegidas).toEqual(['Cauca']);
  });

  it('ofrece descargar el CSV de la misma tabla', () => {
    expect(el().querySelector('[data-testid="descargar-csv"]')).not.toBeNull();
  });

  it('la ficha del indicador dice definición, fuente, fecha, filtros y limitaciones', () => {
    const ficha = el().querySelector('[data-testid="ficha-registros-por-departamento"]') as HTMLElement;
    const texto = ficha.textContent!;
    for (const rotulo of ['Definición', 'Fórmula', 'Unidad', 'Fuente', 'Periodo', 'Cobertura', 'Actualización', 'Fecha de la lectura', 'Filtros aplicados', 'Limitaciones']) {
      expect(texto).toContain(rotulo);
    }
    expect(texto).toContain('Departamento: Cauca');
  });
});
