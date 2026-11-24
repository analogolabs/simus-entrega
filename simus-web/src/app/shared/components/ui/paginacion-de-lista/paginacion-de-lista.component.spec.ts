import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaginacionDeListaComponent } from './paginacion-de-lista.component';

describe('PaginacionDeListaComponent', () => {
  let fixture: ComponentFixture<PaginacionDeListaComponent>;

  function montar(pagina: number, totalPaginas: number, porPagina = 12) {
    fixture = TestBed.createComponent(PaginacionDeListaComponent);
    fixture.componentRef.setInput('pagina', pagina);
    fixture.componentRef.setInput('totalPaginas', totalPaginas);
    fixture.componentRef.setInput('porPagina', porPagina);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [PaginacionDeListaComponent] }));

  it('con una sola página no pinta los botones pero conserva la cantidad por página', () => {
    const el = montar(1, 1);
    expect(el.querySelector('[data-pagina-anterior]')).toBeNull();
    expect(el.textContent).toContain('Por página');
  });

  it('deshabilita Anterior en la primera y Siguiente en la última', () => {
    let el = montar(1, 3);
    expect((el.querySelector('[data-pagina-anterior]') as HTMLButtonElement).disabled).toBeTrue();
    expect((el.querySelector('[data-pagina-siguiente]') as HTMLButtonElement).disabled).toBeFalse();
    el = montar(3, 3);
    expect((el.querySelector('[data-pagina-siguiente]') as HTMLButtonElement).disabled).toBeTrue();
    expect(el.textContent).toContain('Página 3 de 3');
  });

  it('avisa la página pedida', () => {
    const el = montar(2, 4);
    const pedidas: number[] = [];
    fixture.componentInstance.paginaCambiada.subscribe(n => pedidas.push(n));
    (el.querySelector('[data-pagina-siguiente]') as HTMLButtonElement).click();
    (el.querySelector('[data-pagina-anterior]') as HTMLButtonElement).click();
    expect(pedidas).toEqual([3, 1]);
  });

  it('avisa un cambio de cantidad solo si es distinta y válida', () => {
    montar(1, 2, 12);
    const cantidades: number[] = [];
    fixture.componentInstance.porPaginaCambiado.subscribe(n => cantidades.push(n));
    (fixture.componentInstance as unknown as { cambiarCantidad(v: string): void }).cambiarCantidad('24');
    (fixture.componentInstance as unknown as { cambiarCantidad(v: string): void }).cambiarCantidad('12');
    (fixture.componentInstance as unknown as { cambiarCantidad(v: string): void }).cambiarCantidad('x');
    expect(cantidades).toEqual([24]);
  });
});
