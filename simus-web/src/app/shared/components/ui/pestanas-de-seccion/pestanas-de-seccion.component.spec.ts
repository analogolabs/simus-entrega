import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PestanasDeSeccionComponent } from './pestanas-de-seccion.component';

@Component({
  standalone: true,
  imports: [PestanasDeSeccionComponent],
  template: `
    <app-pestanas-de-seccion [secciones]="items" etiqueta="Secciones de prueba" />
    <section id="uno" style="height:2000px">uno</section>
    <section id="dos" style="height:2000px">dos</section>
  `,
})
class Anfitrion {
  items = [{ id: 'uno', rotulo: 'Uno' }, { id: 'dos', rotulo: 'Dos' }];
}

describe('PestanasDeSeccionComponent', () => {
  it('dibuja una pestaña por sección dentro de un nav con rótulo y queda pegada bajo la barra principal', () => {
    const f = TestBed.createComponent(Anfitrion);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const nav: HTMLElement = f.nativeElement.querySelector('nav');
    expect(nav.getAttribute('aria-label')).toBe('Secciones de prueba');
    expect(nav.querySelectorAll('button').length).toBe(2);
    const estilo = getComputedStyle(f.nativeElement.querySelector('app-pestanas-de-seccion'));
    expect(estilo.position).toBe('sticky');
    f.nativeElement.remove();
  });

  it('marca la sección activa por scroll y salta a la elegida', async () => {
    const f = TestBed.createComponent(Anfitrion);
    document.body.appendChild(f.nativeElement);
    // Anclado arriba del documento: si otras pruebas dejaron elementos en el <body>, la sección «uno» no queda
    // por debajo de la línea de lectura y la prueba pasaba sola pero fallaba dentro de la suite completa.
    Object.assign((f.nativeElement as HTMLElement).style, { position: 'absolute', top: '0', left: '0', width: '100%' });
    f.detectChanges();
    await f.whenStable();
    const botones = () => Array.from<HTMLElement>(f.nativeElement.querySelectorAll('nav button'));

    const scroll = spyOnProperty(window, 'scrollY', 'get').and.returnValue(0);
    window.dispatchEvent(new Event('scroll'));
    // Se espera la condición (hasta 2 s) en vez de un tiempo fijo: con la máquina cargada el cuadro de animación tarda más de 80 ms.
    for (let i = 0; i < 40 && !botones().some((b) => b.getAttribute('aria-current') === 'location'); i++) {
      await new Promise((r) => setTimeout(r, 50));
      f.detectChanges();
    }
    expect(botones().some((b) => b.getAttribute('aria-current') === 'location')).toBeTrue();

    const salto = spyOn(window, 'scrollTo');
    botones()[1].click();
    f.detectChanges();
    expect(salto).toHaveBeenCalled();
    expect(botones()[1].getAttribute('aria-current')).toBe('location');
    expect(botones()[0].getAttribute('aria-current')).toBeNull();
    scroll.and.returnValue(0);
    f.nativeElement.remove();
  });
});
