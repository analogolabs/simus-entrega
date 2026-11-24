import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BarraDeHerramientasComponent } from './barra-de-herramientas.component';
import { BuscadorDeListaComponent } from '../buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent } from '../filtro-desplegable/filtro-desplegable.component';
import { OrdenDeListaComponent } from '../orden-de-lista/orden-de-lista.component';
import { opcionesDeTipoDeProceso } from '../barra-de-tipo/opciones-de-tipo';

@Component({
  standalone: true,
  imports: [BarraDeHerramientasComponent, BuscadorDeListaComponent, FiltroDesplegableComponent, OrdenDeListaComponent],
  template: `
    <app-barra-de-herramientas etiqueta="Filtrar y ordenar los procesos" [tipos]="conTipos() ? tipos : null" tipo="todos"
      [mostradas]="mostradas()" [total]="total()" (quitarFiltros)="quitadas = quitadas + 1">
      <!-- A PROPÓSITO EN DESORDEN: la barra los coloca por tipo. -->
      <app-orden-de-lista [columnas]="[{ id: 'n', etiqueta: 'Nombre', tipo: 'texto' }]" [orden]="{ columna: 'n', direccion: 'asc' }" />
      <app-filtro-desplegable rotulo="Estado" etiqueta="Estado" [opciones]="[{ id: 'todos', etiqueta: 'Todos' }]" elegida="todos" />
      <app-buscador-de-lista identificador="b" etiqueta="Buscar" valor="" />
    </app-barra-de-herramientas>`,
})
class Anfitrion {
  readonly conTipos = signal(true);
  readonly mostradas = signal(4);
  readonly total = signal(5);
  quitadas = 0;
  readonly tipos = opcionesDeTipoDeProceso({ conteos: { festivales: 2 } });
}

describe('BarraDeHerramientasComponent (P3)', () => {
  function montar() { const f = TestBed.createComponent(Anfitrion); f.detectChanges(); return f; }

  it('coloca el buscador antes que el filtro y «Ordenar por» al final, aunque se escriban al revés', () => {
    const raiz = montar().nativeElement as HTMLElement;
    const barra = raiz.querySelector('[data-barra-de-lista]')!;
    const orden = Array.from(barra.children).map(h => h.tagName.toLowerCase()).filter(t => t.startsWith('app-'));
    expect(orden.indexOf('app-buscador-de-lista')).toBeLessThan(orden.indexOf('app-filtro-desplegable'));
    expect(orden.indexOf('app-filtro-desplegable')).toBeLessThan(orden.indexOf('app-orden-de-lista'));
  });

  it('la barra de tipo va arriba, antes de la fila de búsqueda; sin tipos no se pinta', () => {
    const f = montar();
    const raiz = f.nativeElement as HTMLElement;
    const tipo = raiz.querySelector('app-barra-de-tipo')!;
    const busqueda = raiz.querySelector('[role="search"]')!;
    expect(tipo.compareDocumentPosition(busqueda) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    f.componentInstance.conTipos.set(false);
    f.detectChanges();
    expect(raiz.querySelector('app-barra-de-tipo')).toBeNull();
  });

  it('la fila de búsqueda es una región de búsqueda con nombre', () => {
    expect(montar().nativeElement.querySelector('[role="search"]')?.getAttribute('aria-label')).toBe('Filtrar y ordenar los procesos');
  });

  it('la cuenta es un estado hablado: «4 de 5», con «Quitar filtros» solo si algo filtra', () => {
    const f = montar();
    const raiz = f.nativeElement as HTMLElement;
    const cuenta = raiz.querySelector('[data-cuenta-de-lista]')!;
    expect(cuenta.getAttribute('role')).toBe('status');
    expect(cuenta.textContent?.replace(/\s+/g, ' ').trim()).toBe('4 de 5 · Quitar filtros');
    (raiz.querySelector('[data-quitar-filtros]') as HTMLButtonElement).click();
    expect(f.componentInstance.quitadas).toBe(1);
    f.componentInstance.mostradas.set(5);
    f.detectChanges();
    expect(raiz.querySelector('[data-quitar-filtros]')).toBeNull();
    expect(raiz.querySelector('[data-cuenta-de-lista]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('5 de 5');
  });

  it('sin filas posibles (total 0) no se pinta la cuenta', () => {
    const f = montar();
    f.componentInstance.total.set(0);
    f.componentInstance.mostradas.set(0);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('[data-cuenta-de-lista]')).toBeNull();
  });
});
