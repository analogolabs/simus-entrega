import { esColorHexadecimal, mejorContrasteSobre, razonDeContraste, textoLegibleSobre } from './contraste-de-color';

describe('contraste-de-color', () => {
  it('elige el texto que más contraste da', () => {
    expect(textoLegibleSobre('#F2B705')).toBe('#1B1230');
    expect(textoLegibleSobre('#D8175A')).toBe('#FFFFFF');
    expect(textoLegibleSobre('#4C007E')).toBe('#FFFFFF');
    expect(textoLegibleSobre('no es un color')).toBe('#FFFFFF');
  });

  it('calcula la razón de contraste de WCAG', () => {
    expect(razonDeContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(razonDeContraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('los colores oficiales de las dos ediciones cumplen AA y uno de tono medio no', () => {
    expect(mejorContrasteSobre('#D8175A')).toBeGreaterThanOrEqual(4.5);
    expect(mejorContrasteSobre('#4C007E')).toBeGreaterThanOrEqual(4.5);
    expect(mejorContrasteSobre('#FF004F')).toBeGreaterThanOrEqual(4.5);
    expect(mejorContrasteSobre('#7B7B7B')).toBeLessThan(4.5);
  });

  it('reconoce un color hexadecimal de seis dígitos', () => {
    expect(esColorHexadecimal('#6b2a8c')).toBeTrue();
    expect(esColorHexadecimal('#6b2a8')).toBeFalse();
    expect(esColorHexadecimal('6b2a8c')).toBeFalse();
  });
});
