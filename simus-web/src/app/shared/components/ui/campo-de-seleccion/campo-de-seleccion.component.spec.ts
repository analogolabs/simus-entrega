import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CampoDeSeleccionComponent, OpcionDeSeleccion } from './campo-de-seleccion.component';

const OPCIONES: readonly OpcionDeSeleccion[] = [
  { valor: 'cc', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'ce', etiqueta: 'Cédula de extranjería' },
  { valor: 'pa', etiqueta: 'Pasaporte', deshabilitada: true },
];

@Component({
  standalone: true,
  imports: [CampoDeSeleccionComponent, ReactiveFormsModule],
  template: `
    <app-campo-de-seleccion
      etiqueta="Tipo de documento" identificador="documento" textoVacio="Elige una"
      [opciones]="opciones" [ayuda]="ayuda()" [error]="error()" [tamano]="tamano()"
      [formControl]="control" (cambiar)="ultimo = $event" />
  `,
})
class Anfitrion {
  readonly opciones = OPCIONES;
  readonly ayuda = signal<string | null>('Como figura en tu documento.');
  readonly error = signal<string | null>(null);
  readonly tamano = signal<'normal' | 'comodo'>('normal');
  readonly control = new FormControl('');
  ultimo = '';
}

describe('CampoDeSeleccionComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;
  const raiz = () => fixture.nativeElement as HTMLElement;
  const lista = () => raiz().querySelector('select') as HTMLSelectElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('el rótulo va encima y apunta al id del control', () => {
    const rotulo = raiz().querySelector('label') as HTMLLabelElement;
    expect(rotulo.textContent).toContain('Tipo de documento');
    expect(rotulo.getAttribute('for')).toBe('documento');
    expect(lista().id).toBe('documento');
    expect(rotulo.compareDocumentPosition(lista()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('pone la opción vacía primero y respeta las opciones apagadas', () => {
    const textos = Array.from(lista().options).map(o => o.textContent?.trim());
    expect(textos).toEqual(['Elige una', 'Cédula de ciudadanía', 'Cédula de extranjería', 'Pasaporte']);
    expect(lista().options[3].disabled).toBeTrue();
  });

  it('el valor viaja con el formulario en las dos direcciones', () => {
    lista().value = 'ce';
    lista().dispatchEvent(new Event('change'));
    expect(anfitrion.control.value).toBe('ce');
    expect(anfitrion.ultimo).toBe('ce');

    anfitrion.control.setValue('cc');
    fixture.detectChanges();
    expect(lista().value).toBe('cc');
  });

  it('la ayuda se cita y cede su sitio al error, que marca el control', () => {
    expect(lista().getAttribute('aria-describedby')).toBe('documento-ayuda');
    anfitrion.error.set('Elige un tipo de documento.');
    fixture.detectChanges();
    expect(lista().getAttribute('aria-describedby')).toBe('documento-error');
    expect(lista().getAttribute('aria-invalid')).toBe('true');
    expect(raiz().querySelector('.campo-de-seleccion__ayuda')).toBeNull();
  });

  it('se apaga con el formulario', () => {
    anfitrion.control.disable();
    fixture.detectChanges();
    expect(lista().disabled).toBeTrue();
  });

  it('mide 36 px y, en cómodo, 44 px: la altura la da el token', () => {
    expect(Math.round(lista().getBoundingClientRect().height)).toBe(36);
    anfitrion.tamano.set('comodo');
    fixture.detectChanges();
    expect(Math.round(lista().getBoundingClientRect().height)).toBe(44);
  });
});
