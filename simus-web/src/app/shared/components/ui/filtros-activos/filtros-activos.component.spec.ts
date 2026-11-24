import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';

import { FiltroActivo, FiltrosActivosComponent } from './filtros-activos.component';

@Component({
  standalone: true,
  imports: [FiltrosActivosComponent],
  template: `<app-filtros-activos [filtros]="filtros()" (quitar)="quitar($event)" (limpiar)="limpiados = limpiados + 1" />`,
})
class Anfitrion {
  readonly filtros = signal<readonly FiltroActivo[]>([
    { clave: 'dia', rotulo: 'Día', valor: '12 de diciembre' },
    { clave: 'depto', rotulo: 'Departamento', valor: 'Casanare' },
    { clave: 'tipo', valor: 'Festivales' },
  ]);
  limpiados = 0;
  quitar(clave: string): void { this.filtros.update(f => f.filter(x => x.clave !== clave)); }
}

describe('FiltrosActivosComponent (A-1)', () => {
  let f: ComponentFixture<Anfitrion>;
  const raiz = () => f.nativeElement as HTMLElement;
  const equis = () => Array.from(raiz().querySelectorAll<HTMLButtonElement>('.chip__quitar'));
  const limpiar = () => raiz().querySelector<HTMLButtonElement>('[data-testid="limpiar-filtros"]');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
  });

  it('pinta un chip con «X» por filtro y «Limpiar filtros» en la misma fila', () => {
    expect(equis().length).toBe(3);
    expect(equis()[0].getAttribute('aria-label')).toBe('Quitar filtro Día: 12 de diciembre');
    expect(limpiar()?.textContent).toContain('Limpiar filtros');
    expect(raiz().querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Filtros aplicados');
  });

  it('desde el primer filtro ya ofrece «Limpiar filtros»', () => {
    f.componentInstance.filtros.set([{ clave: 'dia', valor: 'Hoy' }]);
    f.detectChanges();
    expect(limpiar()).not.toBeNull();
  });

  it('sin filtros no pinta nada visible', () => {
    f.componentInstance.filtros.set([]);
    f.detectChanges();
    expect(equis().length).toBe(0);
    expect(limpiar()).toBeNull();
    expect(raiz().querySelector('[data-filtros-activos]')).toBeNull();
  });

  it('la «X» quita ese filtro, anuncia el cambio y pasa el foco al chip que ocupa su lugar', fakeAsync(() => {
    equis()[1].click();
    f.detectChanges();
    flush();
    f.detectChanges();
    expect(f.componentInstance.filtros().map(x => x.clave)).toEqual(['dia', 'tipo']);
    expect(raiz().querySelector('[role="status"]')?.textContent).toContain('Filtro quitado: Departamento: Casanare');
    expect(document.activeElement).toBe(equis()[1]);
  }));

  it('«Limpiar filtros» avisa a quien la usa y lo anuncia', () => {
    limpiar()!.click();
    f.detectChanges();
    expect(f.componentInstance.limpiados).toBe(1);
    expect(raiz().querySelector('[role="status"]')?.textContent).toContain('Filtros limpiados');
  });
});
