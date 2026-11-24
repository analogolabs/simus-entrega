import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IconoFijoComponent } from './icono-fijo.component';

@Component({
  standalone: true,
  imports: [IconoFijoComponent],
  template: `<svg iconoFijo="user-plus" [size]="17"></svg><svg iconoFijo="menu"></svg>`,
})
class AnfitrionComponent {}

describe('IconoFijoComponent', () => {
  it('dibuja el mismo SVG que Lucide: clases, tamaño, aria-hidden y trazos', () => {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    const [userPlus, menu] = Array.from(fixture.nativeElement.querySelectorAll('svg')) as SVGElement[];

    expect(userPlus.getAttribute('class')).toBe('lucide lucide-user-plus');
    expect(userPlus.getAttribute('width')).toBe('17');
    expect(userPlus.getAttribute('aria-hidden')).toBe('true');
    expect(userPlus.getAttribute('stroke')).toBe('currentColor');
    expect(userPlus.querySelectorAll('path, circle, line').length).toBe(4);
    expect(userPlus.querySelector('circle')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(menu.getAttribute('width')).toBe('24');
    expect(menu.querySelectorAll('path').length).toBe(3);
  });
});
