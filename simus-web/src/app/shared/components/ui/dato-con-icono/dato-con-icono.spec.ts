import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DatoConIconoComponent } from './dato-con-icono.component';

@Component({
  standalone: true,
  imports: [DatoConIconoComponent],
  template: `<dl>
    <div app-dato-con-icono rotulo="Dirección" icono="direccion" valor="Carrera 9 # 4-37"></div>
    <div app-dato-con-icono rotulo="Sitio web" icono="sitioWeb" valor="cantaclaro.test" [enlace]="true"></div>
    <div app-dato-con-icono rotulo="Otro enlace" icono="otroEnlace" valor="javascript:alert(1)" [enlace]="true"></div>
    <div app-dato-con-icono rotulo="Correo" icono="correo" valor="hola@cantaclaro.test" vinculoDe="mailto"></div>
    <div app-dato-con-icono rotulo="Teléfono" icono="telefono" valor="+57 602 000 1144" vinculoDe="tel"></div>
    <div app-dato-con-icono rotulo="Instagram" icono="instagram" valor=""></div>
  </dl>`,
})
class Anfitrion {}

describe('DatoConIconoComponent', () => {
  function montar(): HTMLElement {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const dato = (el: HTMLElement, rotulo: string): HTMLElement =>
    Array.from(el.querySelectorAll<HTMLElement>('[app-dato-con-icono]')).find(d => d.querySelector('dt')?.textContent === rotulo)!;

  it('pone el rótulo y el valor, con un icono decorativo', () => {
    const d = dato(montar(), 'Dirección');
    expect(d.querySelector('dd')?.textContent?.trim()).toBe('Carrera 9 # 4-37');
    expect(d.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });

  it('una dirección web válida es un enlace seguro en otra pestaña, completada con https', () => {
    const a = dato(montar(), 'Sitio web').querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://cantaclaro.test');
    expect(a.getAttribute('rel')).toContain('noopener');
    expect(a.getAttribute('target')).toBe('_blank');
  });

  it('un valor que no es una dirección web válida se lee como texto, nunca como enlace', () => {
    const d = dato(montar(), 'Otro enlace');
    expect(d.querySelector('a')).toBeNull();
    expect(d.querySelector('dd')?.textContent).toContain('javascript:alert(1)');
  });

  it('el correo y el teléfono se vuelven mailto y tel', () => {
    const el = montar();
    expect(dato(el, 'Correo').querySelector('a')?.getAttribute('href')).toBe('mailto:hola@cantaclaro.test');
    expect(dato(el, 'Teléfono').querySelector('a')?.getAttribute('href')).toBe('tel:+576020001144');
  });

  it('lo que falta se dice «Sin registrar»', () => {
    const d = dato(montar(), 'Instagram');
    expect(d.querySelector('dd')?.textContent?.trim()).toBe('Sin registrar');
    expect(d.querySelector('a')).toBeNull();
  });
});
