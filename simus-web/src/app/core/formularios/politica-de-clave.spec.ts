import { mensajeDeClave, reglasDeClave } from './politica-de-clave';

describe('politica-de-clave (espejo de PoliticaDeContrasena)', () => {
  const nombres = ['Lucía', 'Mosquera'];
  const correo = 'lucia.ramirez@cantaclaro.test';

  it('con la clave vacía ninguna regla está cumplida y se pide la longitud', () => {
    expect(reglasDeClave('', correo, nombres).every(r => !r.cumple)).toBeTrue();
    expect(mensajeDeClave('', correo, nombres)).toBe('La contraseña debe tener al menos 12 caracteres.');
  });
  it('una clave corta incumple solo la longitud', () => {
    const reglas = reglasDeClave('Corta#1', correo, nombres);
    expect(reglas.filter(r => !r.cumple).map(r => r.id)).toEqual(['longitud']);
  });
  it('rechaza las comunes, las repetitivas y las consecutivas, igual que el servidor', () => {
    expect(mensajeDeClave('Password1234', correo, nombres)).toContain('común');
    expect(mensajeDeClave('qwerty123', correo, nombres)).toContain('al menos 12');
    expect(mensajeDeClave('aaaaaaaaaaaa', correo, nombres)).toContain('predecible');
    expect(mensajeDeClave('xx1234567890yy', correo, nombres)).toContain('predecible');
    expect(mensajeDeClave('zzzz9876zzzz', correo, nombres)).toContain('predecible');
    expect(mensajeDeClave('admin123456', correo, nombres)).toContain('al menos 12');
    expect(mensajeDeClave('ADMIN123456 ', correo, nombres)).toContain('común');
  });
  it('no admite el nombre ni la parte local del correo', () => {
    expect(mensajeDeClave('MiClave-Lucía-77!', correo, nombres)).toContain('nombre');
    expect(mensajeDeClave('Soy.lucia.ramirez!77', correo, [])).toContain('nombre');
    expect(mensajeDeClave('Mo-Pa-Ra-Xx-Zz-Qq9', correo, nombres)).toBeNull();
  });
  it('las partes de menos de tres letras no cuentan', () => {
    expect(mensajeDeClave('Xyzpq-mi-Cuenta-7', 'mi@x.org', ['Mi'])).toBeNull();
  });
  it('supera el máximo de 128', () => {
    expect(mensajeDeClave('aZ#9'.repeat(33), correo, nombres)).toContain('128');
  });
});
