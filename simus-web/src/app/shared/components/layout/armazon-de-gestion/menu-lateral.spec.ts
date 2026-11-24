import { estaEnRiel, guardarEleccionDelMenu, inicialesDe, leerEleccionDelMenu, modoPorAncho, CLAVE_DEL_MENU } from './menu-lateral';

describe('menú lateral del espacio externo (reglas por ancho)', () => {
  it('el modo sale del ancho: móvil < 700, tableta < 1100, escritorio desde 1100', () => {
    expect([390, 699, 700, 1099, 1100, 1440].map(modoPorAncho)).toEqual(['movil', 'movil', 'tableta', 'tableta', 'escritorio', 'escritorio']);
  });

  it('sin elección, manda el ancho: riel por debajo de 1280 px y abierto desde ahí', () => {
    expect(estaEnRiel(1100, null)).toBeTrue();
    expect(estaEnRiel(1279, null)).toBeTrue();
    expect(estaEnRiel(1280, null)).toBeFalse();
    expect(estaEnRiel(1440, null)).toBeFalse();
  });

  it('en tableta siempre es riel y en móvil no hay columna', () => {
    expect(estaEnRiel(900, { forma: 'abierto', ancho: 1440 })).toBeTrue();
    expect(estaEnRiel(390, null)).toBeFalse();
  });

  it('con elección, manda la elección mientras el ancho no cambie en más de 400 px', () => {
    expect(estaEnRiel(1440, { forma: 'riel', ancho: 1440 })).toBeTrue();
    expect(estaEnRiel(1200, { forma: 'abierto', ancho: 1200 })).toBeFalse();
    expect(estaEnRiel(1600, { forma: 'riel', ancho: 1440 })).toBeTrue();
  });

  it('la elección se olvida si el ancho cambia más de 400 px o se eligió en una ventana de menos de 1100 px', () => {
    expect(estaEnRiel(1920, { forma: 'riel', ancho: 1440 })).toBeFalse();
    expect(estaEnRiel(1150, { forma: 'abierto', ancho: 1600 })).toBeTrue();
    expect(estaEnRiel(1440, { forma: 'riel', ancho: 900 })).toBeFalse();
  });

  it('la elección se guarda y se lee; un contenido roto equivale a no tener elección', () => {
    localStorage.removeItem(CLAVE_DEL_MENU);
    expect(leerEleccionDelMenu(localStorage)).toBeNull();
    guardarEleccionDelMenu(localStorage, { forma: 'riel', ancho: 1300 });
    expect(leerEleccionDelMenu(localStorage)).toEqual({ forma: 'riel', ancho: 1300 });
    localStorage.setItem(CLAVE_DEL_MENU, '{"forma":"otra","ancho":"x"}');
    expect(leerEleccionDelMenu(localStorage)).toBeNull();
    localStorage.setItem(CLAVE_DEL_MENU, 'no es json');
    expect(leerEleccionDelMenu(localStorage)).toBeNull();
    localStorage.removeItem(CLAVE_DEL_MENU);
    expect(leerEleccionDelMenu(null)).toBeNull();
  });

  it('las iniciales saltan los conectores y toleran nombres vacíos', () => {
    expect(inicialesDe('Corporación Cultural Cantaclaro')).toBe('CC');
    expect(inicialesDe('Banda de Oriente')).toBe('BO');
    expect(inicialesDe('Lucía')).toBe('L');
    expect(inicialesDe('')).toBe('');
    expect(inicialesDe(null)).toBe('');
  });
});
