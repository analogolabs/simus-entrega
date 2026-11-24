import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { analizarNit, AYUDA_DEL_NIT, mensajeDeNit, MENSAJE_DE_NIT_CEDULA, MENSAJE_DE_NIT_DIGITO, MENSAJE_DE_NIT_FORMATO } from '../../../../core/formularios/nit';
import { CampoDeNitComponent } from './campo-de-nit.component';

@Component({
  standalone: true,
  imports: [FormsModule, CampoDeNitComponent],
  template: `<app-campo-de-nit identificador="nit" [(ngModel)]="nit" [valorGuardado]="guardado" [error]="errorDelServidor" />`,
})
class AnfitrionComponent {
  nit = '';
  guardado: string | null = null;
  errorDelServidor: string | null = null;
}

describe('NIT de una organización (decisión 96)', () => {
  it('acepta el NIT de una persona jurídica con y sin dígito de verificación y lo deja canónico', () => {
    expect(analizarNit('900123456-8').canonico).toBe('900123456-8');
    expect(analizarNit('900.123.456-8').canonico).toBe('900123456-8');
    expect(analizarNit('9001234568').canonico).toBe('900123456-8');
    expect(analizarNit('900123456').canonico).toBe('900123456-8');
    expect(analizarNit('860002964-4').resultado).toBe('valido');
    expect(analizarNit('800197268-4').resultado).toBe('valido');
  });

  it('todo ejemplo de NIT que muestran la ayuda y los mensajes es un NIT válido', () => {
    for (const texto of [AYUDA_DEL_NIT, MENSAJE_DE_NIT_CEDULA, MENSAJE_DE_NIT_DIGITO, MENSAJE_DE_NIT_FORMATO]) {
      for (const ejemplo of texto.match(/\d{3}\.?\d{3}\.?\d{3}-\d/g) ?? []) {
        expect(analizarNit(ejemplo).resultado).withContext(`ejemplo «${ejemplo}» en «${texto.slice(0, 40)}…»`).toBe('valido');
      }
    }
  });

  it('el campo vacío es válido: una organización sin personería jurídica no tiene NIT', () => {
    expect(mensajeDeNit('')).toBeNull();
    expect(mensajeDeNit('   ')).toBeNull();
    expect(mensajeDeNit(null)).toBeNull();
  });

  it('rechaza lo que tiene forma de cédula', () => {
    for (const cedula of ['1020304050', '1.020.304.050', '80123456', '52123456', '700123456', '10203040-5']) {
      expect(mensajeDeNit(cedula)).toBe(MENSAJE_DE_NIT_CEDULA);
    }
  });

  it('rechaza un dígito de verificación que no corresponde y los símbolos extraños', () => {
    expect(mensajeDeNit('900123456-7')).toBe(MENSAJE_DE_NIT_DIGITO);
    expect(mensajeDeNit('9001234567')).toBe(MENSAJE_DE_NIT_DIGITO);
    expect(analizarNit('NIT 900123456').resultado).toBe('formato');
    expect(analizarNit('900123456-78').resultado).toBe('formato');
    expect(analizarNit('12').resultado).toBe('formato');
  });
});

describe('CampoDeNitComponent', () => {
  async function montar() {
    const fixture = TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).createComponent(AnfitrionComponent);
    fixture.detectChanges();
    // `ngModel` escribe su valor inicial en una microtarea: se agota antes de teclear.
    await fixture.whenStable();
    const entrada = () => fixture.nativeElement.querySelector('#nit') as HTMLInputElement;
    const escribir = async (texto: string) => {
      entrada().value = texto;
      entrada().dispatchEvent(new Event('input'));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const salir = async () => {
      entrada().dispatchEvent(new Event('focusout', { bubbles: true }));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    return { fixture, escribir, salir, texto };
  }

  it('dice cuándo se escribe y cuándo se deja vacío', async () => {
    const { texto } = await montar();
    expect(texto()).toContain('personería jurídica');
    expect(texto()).toContain('deja el campo vacío');
  });

  it('muestra el error en español al salir con una cédula y lo quita al corregir', async () => {
    const { escribir, salir, texto } = await montar();
    await escribir('1020304050');
    await salir();
    expect(texto()).toContain('no para una cédula');
    await escribir('900123456-8');
    expect(texto()).not.toContain('no para una cédula');
  });

  it('no juzga el valor que la organización ya tenía guardado', async () => {
    const { fixture, escribir, salir, texto } = await montar();
    fixture.componentInstance.guardado = '1020304050';
    fixture.detectChanges();
    await escribir('1020304050');
    await salir();
    expect(texto()).not.toContain('no para una cédula');
  });

  it('el error del servidor gana sobre el local', async () => {
    const { fixture, escribir, texto } = await montar();
    fixture.componentInstance.errorDelServidor = 'Ya existe una organización registrada con este NIT.';
    await escribir('900123456-8');
    fixture.detectChanges();
    expect(texto()).toContain('Ya existe una organización registrada con este NIT.');
  });
});
