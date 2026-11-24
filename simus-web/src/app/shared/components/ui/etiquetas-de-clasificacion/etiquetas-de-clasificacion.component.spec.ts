import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EtiquetasDeClasificacionComponent } from './etiquetas-de-clasificacion.component';

describe('EtiquetasDeClasificacionComponent', () => {
  let fixture: ComponentFixture<EtiquetasDeClasificacionComponent>;
  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EtiquetasDeClasificacionComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(EtiquetasDeClasificacionComponent);
    fixture.componentRef.setInput('practicas', [{ id: 1, nombre: 'Cuerdas' }]);
    fixture.componentRef.setInput('territorios', [{ id: 2, nombre: 'caribe' }]);
  });

  it('en un listado cada etiqueta es un botón que filtra, con su estado', () => {
    const elegidas: string[] = [];
    fixture.componentInstance.practicaElegida.subscribe(n => elegidas.push(n));
    fixture.componentRef.setInput('practicaActiva', 'Cuerdas');
    fixture.detectChanges();

    const practica = raiz().querySelector<HTMLButtonElement>('[data-etiqueta-practica]')!;
    expect(practica.getAttribute('aria-pressed')).toBe('true');
    practica.click();
    expect(elegidas).toEqual(['Cuerdas']);
    expect(raiz().querySelector('[data-etiqueta-territorio]')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('en una ficha cada etiqueta es un enlace real al directorio filtrado', () => {
    fixture.componentRef.setInput('modo', 'enlazar');
    fixture.componentRef.setInput('ruta', '/ecosistema/luteria');
    fixture.detectChanges();

    expect(raiz().querySelector('a[data-etiqueta-practica]')!.getAttribute('href')).toBe('/ecosistema/luteria?practica=Cuerdas');
    expect(raiz().querySelector('a[data-etiqueta-territorio]')!.getAttribute('href')).toBe('/ecosistema/luteria?territorio=caribe');
  });
});
