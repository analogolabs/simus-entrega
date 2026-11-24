import { nombreLegibleDelTerritorio } from './nombre-legible-del-territorio';

describe('nombreLegibleDelTerritorio (DAT-01)', () => {
  it('pasa a mayúscula inicial los nombres del DANE que llegan en mayúsculas', () => {
    expect(nombreLegibleDelTerritorio('ANTIOQUIA')).toBe('Antioquia');
    expect(nombreLegibleDelTerritorio('MEDELLÍN')).toBe('Medellín');
    expect(nombreLegibleDelTerritorio('EL ENCANTO')).toBe('El Encanto');
    expect(nombreLegibleDelTerritorio('PUERTO ALEGRÍA')).toBe('Puerto Alegría');
  });

  it('deja en minúscula las partículas, salvo al comienzo', () => {
    expect(nombreLegibleDelTerritorio('SAN VICENTE DEL CAGUÁN')).toBe('San Vicente del Caguán');
    expect(nombreLegibleDelTerritorio('VALLE DEL CAUCA')).toBe('Valle del Cauca');
    expect(nombreLegibleDelTerritorio('SANTIAGO DE CALI')).toBe('Santiago de Cali');
    expect(nombreLegibleDelTerritorio('SAN PEDRO DE LOS MILAGROS')).toBe('San Pedro de los Milagros');
    expect(nombreLegibleDelTerritorio('LA PAZ')).toBe('La Paz');
    expect(nombreLegibleDelTerritorio('DE LA CRUZ')).toBe('De la Cruz');
  });

  it('conserva las siglas con puntos y la coma', () => {
    expect(nombreLegibleDelTerritorio('BOGOTÁ, D.C.')).toBe('Bogotá, D.C.');
    expect(nombreLegibleDelTerritorio('ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA'))
      .toBe('Archipiélago de San Andrés, Providencia y Santa Catalina');
  });

  it('respeta los guiones y capitaliza lo que va después', () => {
    expect(nombreLegibleDelTerritorio('MIRITÍ - PARANÁ')).toBe('Mirití - Paraná');
  });

  it('un nombre que ya trae minúsculas se deja tal cual (idempotente)', () => {
    expect(nombreLegibleDelTerritorio('Bogotá D.C.')).toBe('Bogotá D.C.');
    expect(nombreLegibleDelTerritorio('Villa del Rosario')).toBe('Villa del Rosario');
    expect(nombreLegibleDelTerritorio(nombreLegibleDelTerritorio('SAN JOSÉ DEL GUAVIARE')))
      .toBe('San José del Guaviare');
  });

  it('los vacíos y los espacios sobrantes no rompen', () => {
    expect(nombreLegibleDelTerritorio('')).toBe('');
    expect(nombreLegibleDelTerritorio(null)).toBe('');
    expect(nombreLegibleDelTerritorio(undefined)).toBe('');
    expect(nombreLegibleDelTerritorio('  LA   GUAJIRA ')).toBe('La Guajira');
  });
});
