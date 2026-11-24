import { TestBed } from '@angular/core/testing';
import { PreguntaPublicaService } from './pregunta-publica.service';

describe('PreguntaPublicaService', () => {
  it('abrir enciende el panel (con o sin pregunta) y cerrar lo apaga', () => {
    const servicio = TestBed.inject(PreguntaPublicaService);
    expect(servicio.abierta()).toBeFalse();
    servicio.abrir(undefined, 'festivales en Nariño');
    expect(servicio.abierta()).toBeTrue();
    expect(servicio.semilla()).toBe('festivales en Nariño');
    servicio.cerrar();
    expect(servicio.abierta()).toBeFalse();
    servicio.abrir();
    expect(servicio.semilla()).toBe('');
  });
});
