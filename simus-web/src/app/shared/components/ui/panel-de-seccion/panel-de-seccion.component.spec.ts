import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanelDeSeccionComponent } from './panel-de-seccion.component';

@Component({
  standalone: true,
  imports: [PanelDeSeccionComponent],
  template: `
    <app-panel-de-seccion titulo="Próximos eventos" idDelTitulo="p1" [contador]="contador" [nivel]="nivel" [tono]="tono">
      <a accion href="#">Ver eventos</a>
      <p data-contenido>Contenido</p>
    </app-panel-de-seccion>
  `,
})
class Anfitrion {
  contador: number | null = 3;
  nivel: 2 | 3 = 2;
  tono: 'neutro' | 'atencion' = 'neutro';
}

describe('PanelDeSeccionComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  it('nombra la región con su encabezado, que es un h2 por omisión', () => {
    const region = raiz().querySelector('section')!;
    const titulo = raiz().querySelector('h2')!;
    expect(titulo.textContent).toContain('Próximos eventos');
    expect(region.getAttribute('aria-labelledby')).toBe('p1');
    expect(titulo.id).toBe('p1');
  });

  it('usa un h3 cuando el panel vive dentro de otra sección', () => {
    fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.nivel = 3;
    fixture.detectChanges();
    expect(raiz().querySelector('h3')?.textContent).toContain('Próximos eventos');
    expect(raiz().querySelector('h2')).toBeNull();
  });

  it('proyecta la acción y el contenido, y muestra el contador solo si hay', () => {
    expect(raiz().querySelector('.panel__accion a')?.textContent).toContain('Ver eventos');
    expect(raiz().querySelector('[data-contenido]')).not.toBeNull();
    expect(raiz().querySelector('.panel__contador')?.textContent?.trim()).toBe('3');
    fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.contador = null;
    fixture.detectChanges();
    expect(raiz().querySelector('.panel__contador')).toBeNull();
  });

  it('tiñe el panel de atención sin tocar el resto', () => {
    expect(raiz().querySelector('.panel--atencion')).toBeNull();
    fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.tono = 'atencion';
    fixture.detectChanges();
    expect(raiz().querySelector('.panel--atencion')).not.toBeNull();
  });
});
