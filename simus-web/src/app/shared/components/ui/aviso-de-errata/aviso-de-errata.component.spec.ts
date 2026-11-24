import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AvisoDeErrataComponent, mensajeDeGuardadoDeLoPublicado } from './aviso-de-errata.component';

@Component({
  standalone: true,
  imports: [AvisoDeErrataComponent],
  template: `
    <app-aviso-de-errata nombre="noticia" [femenino]="true" deFondo="el titular, el resumen o la fecha" />
    <app-aviso-de-errata nombre="evento" deFondo="la fecha o el lugar" />
  `,
})
class Anfitrion {}

describe('AvisoDeErrataComponent', () => {
  it('dice una sola cosa en las tres pantallas y concuerda el género; no hay casilla que marcar', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const avisos = Array.from(raiz.querySelectorAll('[data-aviso-de-errata]'));

    expect(avisos.length).toBe(2);
    expect(avisos[0].textContent!.replace(/\s+/g, ' ')).toContain(
      'Esta noticia está publicada. Si solo corriges ortografía o redacción, sigue publicada. Si cambias el titular, el resumen o la fecha, vuelve a revisión hasta republicarse.');
    expect(avisos[1].textContent!.replace(/\s+/g, ' ')).toContain('Este evento está publicado.');
    expect(raiz.querySelector('input[type="checkbox"]')).toBeNull();
  });

  describe('mensajeDeGuardadoDeLoPublicado', () => {
    const noticia = { nombre: 'noticia', femenino: true };
    const evento = { nombre: 'evento', femenino: false };

    it('un guardado corriente no habla de errata', () => {
      expect(mensajeDeGuardadoDeLoPublicado('Mi noticia', noticia, false, false)).toBe('«Mi noticia» quedó guardada.');
    });

    it('lo que el servidor dejó publicado fue una errata', () => {
      expect(mensajeDeGuardadoDeLoPublicado('Mi evento', evento, true, true))
        .toBe('«Mi evento» quedó guardado y sigue publicado: el cambio era una errata.');
    });

    it('lo que el servidor devolvió a revisión fue un cambio de fondo', () => {
      expect(mensajeDeGuardadoDeLoPublicado('Mi noticia', noticia, true, false))
        .toBe('«Mi noticia» quedó guardada. Como el cambio es de fondo, vuelve a revisión y deja de verse hasta republicarse.');
    });
  });
});
