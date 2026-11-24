import { Caja, cabeEnElMarco, cajaUnida, correccionDeDesplazamiento, correccionParaEncuadrar, decisionDeRueda, factorDeZoom, porcentajeDeZoom, ZOOM_MAXIMO } from './lienzo-de-red';

const marco: Caja = { izquierda: 0, arriba: 0, derecha: 600, abajo: 400 };

describe('lienzo de la red', () => {
  it('la rueda sola es de la página; con Ctrl, ⌘, lienzo activo o ampliado, es del zoom', () => {
    const sin = { activo: false, ampliado: false };
    expect(decisionDeRueda({ ctrlKey: false, metaKey: false }, sin)).toBe('pagina');
    expect(decisionDeRueda({ ctrlKey: true, metaKey: false }, sin)).toBe('zoom');
    expect(decisionDeRueda({ ctrlKey: false, metaKey: true }, sin)).toBe('zoom');
    expect(decisionDeRueda({ ctrlKey: false, metaKey: false }, { activo: true, ampliado: false })).toBe('zoom');
    expect(decisionDeRueda({ ctrlKey: false, metaKey: false }, { activo: false, ampliado: true })).toBe('zoom');
  });

  it('une cajas y descarta las vacías', () => {
    expect(cajaUnida([])).toBeNull();
    expect(cajaUnida([{ izquierda: 0, arriba: 0, derecha: 0, abajo: 0 }])).toBeNull();
    expect(cajaUnida([{ izquierda: 10, arriba: 20, derecha: 30, abajo: 40 }, { izquierda: -5, arriba: 25, derecha: 12, abajo: 90 }]))
      .toEqual({ izquierda: -5, arriba: 20, derecha: 30, abajo: 90 });
  });

  it('encuadra un grafo más grande que el marco: reduce y centra', () => {
    const grande: Caja = { izquierda: -300, arriba: -100, derecha: 900, abajo: 500 };
    const c = correccionParaEncuadrar(grande, marco, 20);
    expect(c.zoom).toBeCloseTo(560 / 1200, 5);
    expect(c.dx).toBeCloseTo(300 - 300, 5);
    expect(c.dy).toBeCloseTo(200 - 200, 5);
  });

  it('un grafo pequeño no se agranda más del tope y queda centrado', () => {
    const c = correccionParaEncuadrar({ izquierda: 0, arriba: 0, derecha: 50, abajo: 50 }, marco);
    expect(c.zoom).toBe(1.6);
    expect(c.dx).toBe(275);
    expect(c.dy).toBe(175);
  });

  it('no deja perder el grafo: si se sale casi por completo lo devuelve', () => {
    expect(correccionDeDesplazamiento({ izquierda: 100, arriba: 100, derecha: 300, abajo: 300 }, marco)).toEqual({ dx: 0, dy: 0 });
    expect(correccionDeDesplazamiento({ izquierda: 1000, arriba: 100, derecha: 1200, abajo: 300 }, marco).dx).toBe(536 - 1000);
    expect(correccionDeDesplazamiento({ izquierda: 100, arriba: -500, derecha: 300, abajo: -300 }, marco).dy).toBe(364);
  });

  it('cabe en el marco con una pequeña tolerancia', () => {
    expect(cabeEnElMarco({ izquierda: 0, arriba: 0, derecha: 600, abajo: 400 }, marco)).toBeTrue();
    expect(cabeEnElMarco({ izquierda: -20, arriba: 0, derecha: 600, abajo: 400 }, marco)).toBeFalse();
  });

  it('el zoom se limita y el porcentaje se cuenta desde la vista encuadrada', () => {
    expect(porcentajeDeZoom(0.8, 0.8)).toBe(100);
    expect(porcentajeDeZoom(1.2, 0.8)).toBe(150);
    expect(factorDeZoom(5, 2) * 5).toBeCloseTo(ZOOM_MAXIMO, 5);
    expect(factorDeZoom(1, 1.25)).toBe(1.25);
  });
});
