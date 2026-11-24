import { dimensionesLegibles, formatoDeArchivo, pesoLegible, tipoLegible } from './datos-de-archivo';

describe('datos de un archivo', () => {
  it('el peso se lee en su unidad', () => {
    expect(pesoLegible(null)).toBe('—');
    expect(pesoLegible(512)).toBe('512 B');
    expect(pesoLegible(48 * 1024)).toBe('48 KB');
    expect(pesoLegible(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });

  it('el tipo MIME se lee como formato y clase', () => {
    expect(formatoDeArchivo('image/jpeg')).toBe('JPG');
    expect(formatoDeArchivo('image/png')).toBe('PNG');
    expect(formatoDeArchivo('image/svg+xml')).toBe('SVG');
    expect(formatoDeArchivo('')).toBe('Archivo');
    expect(tipoLegible('image/webp')).toBe('WEBP · imagen');
    expect(tipoLegible('application/pdf')).toBe('PDF · archivo');
  });

  it('las dimensiones solo se dicen si están las dos', () => {
    expect(dimensionesLegibles(720, 960)).toBe('720×960');
    expect(dimensionesLegibles(720, null)).toBe('');
  });
});
