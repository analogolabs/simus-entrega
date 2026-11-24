import { enmascararCorreo } from './correo-enmascarado';

describe('enmascararCorreo', () => {
  it('deja la primera y la última letra de la parte local y el dominio entero', () => {
    expect(enmascararCorreo('aud-pub.cuatro@ejemplo.org')).toBe('a•••o@ejemplo.org');
  });

  it('con una parte local corta solo deja la primera letra', () => {
    expect(enmascararCorreo('ana@ejemplo.org')).toBe('a•••@ejemplo.org');
  });

  it('normaliza antes de enmascarar, como el servidor', () => {
    expect(enmascararCorreo('  Ana.Maria@Ejemplo.ORG ')).toBe('a•••a@ejemplo.org');
  });

  it('un valor vacío no inventa un correo', () => {
    expect(enmascararCorreo('')).toBe('');
    expect(enmascararCorreo(null)).toBe('');
  });
});
