import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { BotonNativoDirective } from '../boton/boton.component';
import { CampoDeSeleccionComponent } from '../campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from './filtro-desplegable.component';
import { OpcionesDesdePipe } from './opciones-desde.pipe';

describe('OpcionesDesdePipe', () => {
  const pipe = new OpcionesDesdePipe();
  const lista = [{ code: '05', name: 'ANTIOQUIA' }, { code: '41', name: 'HUILA' }];

  it('nombra el valor y el texto por su propiedad y antepone la opción vacía', () => {
    expect(pipe.transform(lista, 'code', 'name', 'Selecciona')).toEqual([
      { id: '', etiqueta: 'Selecciona' },
      { id: '05', etiqueta: 'ANTIOQUIA' },
      { id: '41', etiqueta: 'HUILA' },
    ]);
  });

  it('escribe el texto como nombre propio cuando se pide', () => {
    expect(pipe.transform(lista, 'code', 'name', null, true).map(o => o.etiqueta)).toEqual(['Antioquia', 'Huila']);
  });

  it('una lista que aún no llegó da una lista vacía', () => {
    expect(pipe.transform(null, 'code', 'name')).toEqual([]);
  });
});

@Component({
  standalone: true,
  imports: [FormsModule, FiltroDesplegableComponent, CampoDeSeleccionComponent, OpcionesDesdePipe, BotonNativoDirective],
  template: `
    <app-campo-de-seleccion etiqueta="Tipo" name="tipo" [(ngModel)]="tipo" comoNumero vacioComoNulo>
      <option value="">Sin tipo</option>
      <option value="7">Siete</option>
    </app-campo-de-seleccion>
    <app-filtro-desplegable etiqueta="Departamento" idDelControl="dep" [(ngModel)]="departamento"
      [opciones]="lista | opcionesDesde:'code':'name':'Selecciona'" />
    <button type="button" appBoton="destructiva" tamano="menudo">Quitar</button>
  `,
})
class Anfitrion {
  readonly lista = [{ code: '41', name: 'Huila' }];
  tipo: number | null = null;
  departamento = '';
  readonly nada = signal(0);
}

describe('Piezas de formulario de UI-D', () => {
  it('el campo de selección con opciones escritas dentro guarda un número o null', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '7';
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.tipo).toBe(7);
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.tipo).toBeNull();
  });

  it('el desplegable de territorio funciona con ngModel y su botón lleva el id del rótulo', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const boton = fixture.nativeElement.querySelector('#dep') as HTMLButtonElement;
    expect(boton).not.toBeNull();
    boton.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-valor="41"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.departamento).toBe('41');
    expect(boton.textContent).toContain('Huila');
  });

  it('appBoton viste el elemento nativo con la misma altura de los tokens', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const quitar = fixture.nativeElement.querySelector('button[appBoton]') as HTMLButtonElement;
    expect(quitar.className).toContain('min-h-control-minimo');
    expect(quitar.className).toContain('border-red-600');
  });
});
