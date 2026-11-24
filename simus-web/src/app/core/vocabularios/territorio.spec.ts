import { SEPARADOR_DE_CLASIFICACION } from './clasificacion';
import { normalizarNombreDeDepartamento } from './territorio';

describe('vocabularios territoriales compartidos', () => {
  it('normaliza acentos, puntuación y las equivalencias territoriales conocidas', () => {
    expect(normalizarNombreDeDepartamento(' Bogotá, D.C. ')).toBe('BOGOTA');
    expect(normalizarNombreDeDepartamento('Archipiélago de San Andrés, Providencia y Santa Catalina'))
      .toBe('SAN ANDRES Y PROVIDENCIA');
  });

  it('usa un separador que no fragmenta nombres válidos con comas', () => {
    expect(['Cantos, Pitos y Tambores', 'Otra práctica'].join(SEPARADOR_DE_CLASIFICACION)
      .split(SEPARADOR_DE_CLASIFICACION))
      .toEqual(['Cantos, Pitos y Tambores', 'Otra práctica']);
  });
});
