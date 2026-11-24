import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CampoDeTextoComponent } from './campo-de-texto.component';

@Component({
  standalone: true,
  imports: [CampoDeTextoComponent, ReactiveFormsModule],
  template: `
    <app-campo-de-texto
      etiqueta="Nombre del Festival"
      identificador="nombre"
      [ayuda]="ayuda()"
      [error]="error()"
      [obligatorio]="obligatorio()"
      [tamano]="tamano()"
      [conBusqueda]="conBusqueda()"
      [multilinea]="multilinea()"
      [formControl]="control"
      (cambiar)="ultimo = $event" />
  `,
})
class Anfitrion {
  readonly ayuda = signal<string | null>('Como aparece en el cartel.');
  readonly error = signal<string | null>(null);
  readonly obligatorio = signal(false);
  readonly tamano = signal<'normal' | 'comodo'>('normal');
  readonly conBusqueda = signal(false);
  readonly multilinea = signal(false);
  readonly control = new FormControl('');
  ultimo = '';
}

describe('CampoDeTextoComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;
  const raiz = () => fixture.nativeElement as HTMLElement;
  const entrada = () => raiz().querySelector('input, textarea') as HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('el rótulo va ENCIMA del campo y apunta a su id: nunca un placeholder haciendo de rótulo', () => {
    const rotulo = raiz().querySelector('label') as HTMLLabelElement;
    expect(rotulo.textContent).toContain('Nombre del Festival');
    expect(rotulo.getAttribute('for')).toBe('nombre');
    expect(entrada().id).toBe('nombre');
    // El rótulo precede al control en el DOM, y el control no usa el placeholder como rótulo.
    expect(rotulo.compareDocumentPosition(entrada()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(entrada().getAttribute('placeholder')).toBeNull();
  });

  it('la ayuda se cita con aria-describedby y desaparece cuando hay un error', () => {
    expect(raiz().querySelector('.campo-de-texto__ayuda')?.textContent).toContain('Como aparece en el cartel.');
    expect(entrada().getAttribute('aria-describedby')).toBe('nombre-ayuda');

    anfitrion.error.set('Escribe el nombre del Festival.');
    fixture.detectChanges();

    expect(raiz().querySelector('.campo-de-texto__ayuda')).toBeNull();
    expect(raiz().querySelector('[data-error-de-campo]')?.textContent).toContain('Escribe el nombre del Festival.');
    expect(entrada().getAttribute('aria-describedby')).toBe('nombre-error');
    expect(entrada().getAttribute('aria-invalid')).toBe('true');
  });

  it('marca lo obligatorio con aria-required y un asterisco que el lector no repite', () => {
    anfitrion.obligatorio.set(true);
    fixture.detectChanges();
    expect(entrada().getAttribute('aria-required')).toBe('true');
    expect(raiz().querySelector('.campo-de-texto__obligatorio')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('las dos alturas salen de los tokens: 36 px por omisión y 44 px en cómodo', () => {
    const anfitrionDelCampo = raiz().querySelector('app-campo-de-texto') as HTMLElement;
    expect(anfitrionDelCampo.getAttribute('data-tamano')).toBe('normal');
    anfitrion.tamano.set('comodo');
    fixture.detectChanges();
    expect(anfitrionDelCampo.getAttribute('data-tamano')).toBe('comodo');
  });

  it('funciona con formularios reactivos: escribe hacia el control y lee su valor', () => {
    entrada().value = 'Festival Macizo';
    entrada().dispatchEvent(new Event('input'));
    expect(anfitrion.control.value).toBe('Festival Macizo');
    expect(anfitrion.ultimo).toBe('Festival Macizo');

    anfitrion.control.setValue('Otro nombre');
    fixture.detectChanges();
    expect(entrada().value).toBe('Otro nombre');
  });

  it('con búsqueda lleva lupa y un «✕» que limpia y devuelve el foco; sin texto no hay «✕»', () => {
    anfitrion.conBusqueda.set(true);
    fixture.detectChanges();
    expect(raiz().querySelector('.campo-de-texto__lupa')).not.toBeNull();
    expect(raiz().querySelector('.campo-de-texto__limpiar')).toBeNull();

    entrada().value = 'macizo';
    entrada().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const limpiar = raiz().querySelector('.campo-de-texto__limpiar') as HTMLButtonElement;
    expect(limpiar.getAttribute('aria-label')).toBe('Limpiar nombre del festival');

    limpiar.click();
    fixture.detectChanges();
    expect(anfitrion.control.value).toBe('');
    expect(document.activeElement).toBe(entrada());
  });

  it('en modo multilínea pinta un área de texto con el mismo rótulo', () => {
    anfitrion.multilinea.set(true);
    fixture.detectChanges();
    expect(raiz().querySelector('textarea')).not.toBeNull();
    expect((raiz().querySelector('label') as HTMLLabelElement).getAttribute('for')).toBe('nombre');
  });

  it('un formulario puede deshabilitarlo', () => {
    anfitrion.control.disable();
    fixture.detectChanges();
    expect(entrada().disabled).toBeTrue();
  });
});
