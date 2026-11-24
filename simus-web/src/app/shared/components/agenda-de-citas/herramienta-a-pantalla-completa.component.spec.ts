import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HerramientaAPantallaCompletaComponent } from './herramienta-a-pantalla-completa.component';

describe('La herramienta a pantalla completa (teléfono y tableta)', () => {
  let fixture: ComponentFixture<HerramientaAPantallaCompletaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(HerramientaAPantallaCompletaComponent);
    fixture.componentRef.setInput('titulo', 'Rueda de citas');
    fixture.componentRef.setInput('procedencia', 'Agenda de citas · Edición 2027');
    fixture.componentRef.setInput('volverA', '/gestion');
    fixture.componentRef.setInput('secciones', [
      { id: 'resumen', rotulo: 'Resumen', icono: 'resumen' }, { id: 'personas', rotulo: 'Personas', icono: 'personas', pendientes: 2 },
      { id: 'ajustes', rotulo: 'Ajustes', icono: 'ajustes' },
    ]);
    fixture.componentRef.setInput('seccionActiva', 'resumen');
    fixture.detectChanges();
  });

  it('marca la sección activa y su aviso de trabajo pendiente', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.app__item[aria-current="page"]')?.getAttribute('data-pestana')).toBe('resumen');
    expect(el.querySelector('[data-pestana="personas"] .app__marca')?.textContent).toContain('2');
  });

  it('trae a la vista la sección activa cuando la barra se desplaza de lado', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const visto: string[] = [];
    el.querySelectorAll<HTMLElement>('.app__item').forEach(b => {
      b.scrollIntoView = () => { visto.push(b.getAttribute('data-pestana') ?? ''); };
    });
    fixture.componentRef.setInput('seccionActiva', 'ajustes');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(visto).toContain('ajustes');
  });

  it('la cabecera es una sola y las acciones se parten en lugar de esconderse', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-testid="cabecera-de-la-herramienta"]').length).toBe(1);
    expect(el.querySelector('.app__acciones')).not.toBeNull();
  });
});
