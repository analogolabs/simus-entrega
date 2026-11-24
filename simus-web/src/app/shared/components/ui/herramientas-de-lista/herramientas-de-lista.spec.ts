import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HerramientasDeListaComponent } from './herramientas-de-lista.component';

@Component({
  standalone: true,
  imports: [HerramientasDeListaComponent],
  template: `
    <app-herramientas-de-lista [conteos]="conteos" [total]="3" [elegida]="elegida()" (elegir)="elegida.set($event)" controla="lista">
      <button extremo type="button">Nuevo</button>
      <app-filtro-desplegable></app-filtro-desplegable>
      <app-buscador-de-lista></app-buscador-de-lista>
    </app-herramientas-de-lista>
  `,
})
class ConPestanas { conteos = { festivales: 2, mercados: 1 }; elegida = signal('todos'); }

@Component({
  standalone: true,
  imports: [HerramientasDeListaComponent],
  template: `<app-herramientas-de-lista><app-buscador-de-lista></app-buscador-de-lista></app-herramientas-de-lista>`,
})
class SinPestanas {}

describe('las herramientas de lista', () => {
  it('ponen las pestañas primero y la barra debajo, con el buscador antes que el filtro', async () => {
    await TestBed.configureTestingModule({ imports: [ConPestanas], errorOnUnknownElements: false }).compileComponents();
    const fixture = TestBed.createComponent(ConPestanas);
    fixture.detectChanges();
    const raiz: HTMLElement = fixture.nativeElement.querySelector('[data-herramientas-de-lista]');
    expect([...raiz.children].map(e => e.tagName.toLowerCase())).toEqual(['app-pestanas-de-tipo', 'app-barra-de-lista']);
    const barra: HTMLElement = raiz.querySelector('[data-barra-de-lista]')!;
    expect([...barra.children].map(e => e.tagName.toLowerCase()).slice(0, 2)).toEqual(['app-buscador-de-lista', 'app-filtro-desplegable']);
    expect(barra.querySelector('.barra-de-lista__extremo button')?.textContent?.trim()).toBe('Nuevo');
  });

  it('elegir una pestaña lo comunica a la pantalla', async () => {
    await TestBed.configureTestingModule({ imports: [ConPestanas], errorOnUnknownElements: false }).compileComponents();
    const fixture = TestBed.createComponent(ConPestanas);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-pestana="mercados"]') as HTMLElement).click();
    expect(fixture.componentInstance.elegida()).toBe('mercados');
  });

  it('sin conteos no pinta pestañas', async () => {
    await TestBed.configureTestingModule({ imports: [SinPestanas], errorOnUnknownElements: false }).compileComponents();
    const fixture = TestBed.createComponent(SinPestanas);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-pestanas-de-tipo')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-buscador-de-lista')).not.toBeNull();
  });
});
