import { enumerar } from './enumerar';

describe('enumerar', () => {
  it('une el último con «y», como se dice', () => {
    expect(enumerar(['la descripción', 'el lugar'])).toBe('la descripción y el lugar');
    expect(enumerar(['el nombre', 'la fecha', 'el lugar'])).toBe('el nombre, la fecha y el lugar');
  });

  it('uno solo o ninguno', () => {
    expect(enumerar(['el nombre'])).toBe('el nombre');
    expect(enumerar([])).toBe('');
    expect(enumerar(null)).toBe('');
  });
});
