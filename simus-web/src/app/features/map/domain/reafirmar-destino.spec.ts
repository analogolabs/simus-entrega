import { camaraFueraDeDestino, distanciaEnMetros } from './reafirmar-destino';

describe('reafirmar-destino', () => {
  const destino = { lat: 6.2, lng: -75.5, zoom: 9 };

  it('la distancia entre dos puntos iguales es cero y crece con la separación', () => {
    expect(distanciaEnMetros(destino, destino)).toBe(0);
    expect(distanciaEnMetros({ lat: 6.2, lng: -75.5 }, { lat: 6.3, lng: -75.5 })).toBeGreaterThan(10000);
  });

  it('acepta la cámara puesta en el destino', () => {
    expect(camaraFueraDeDestino({ ...destino }, destino)).toBeFalse();
    expect(camaraFueraDeDestino({ lat: 6.2001, lng: -75.5001, zoom: 9 }, destino)).toBeFalse();
  });

  it('detecta el caso reproducido: el zoom animado en curso dejó el mapa en zoom 6 sobre otro centro', () => {
    expect(camaraFueraDeDestino({ lat: 4.508, lng: -74, zoom: 6 }, destino)).toBeTrue();
  });

  it('detecta un zoom distinto aunque el centro coincida, y un centro lejano con el zoom correcto', () => {
    expect(camaraFueraDeDestino({ lat: 6.2, lng: -75.5, zoom: 8 }, destino)).toBeTrue();
    expect(camaraFueraDeDestino({ lat: 6.5, lng: -75.5, zoom: 9 }, destino)).toBeTrue();
  });
});
