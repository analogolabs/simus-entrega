import { nombreDelTerritorioConCodigo } from './nombre-del-territorio-con-codigo';

const CATALOGO = [
  { codigo: '08', nombre: 'Atlántico', municipios: [{ codigo: '08001', nombre: 'Barranquilla' }, { codigo: '08433', nombre: 'Malambo' }] },
  { codigo: '41', nombre: 'Huila', municipios: [{ codigo: '41001', nombre: 'Neiva' }] },
];

describe('nombreDelTerritorioConCodigo', () => {
  it('dice el departamento con su nombre y el código como detalle', () => {
    expect(nombreDelTerritorioConCodigo(CATALOGO, 'departamento', '08')).toBe('Atlántico (08)');
  });

  it('dice el municipio con su nombre, en cualquier departamento', () => {
    expect(nombreDelTerritorioConCodigo(CATALOGO, 'municipio', '41001')).toBe('Neiva (41001)');
    expect(nombreDelTerritorioConCodigo(CATALOGO, 'municipio', '08433')).toBe('Malambo (08433)');
  });

  it('sin catálogo todavía, o con un código desconocido, deja el código y no lo pierde', () => {
    expect(nombreDelTerritorioConCodigo([], 'departamento', '08')).toBe('08');
    expect(nombreDelTerritorioConCodigo(CATALOGO, 'municipio', '99999')).toBe('99999');
  });

  it('un valor vacío es null (la fila pone «—»)', () => {
    expect(nombreDelTerritorioConCodigo(CATALOGO, 'departamento', null)).toBeNull();
    expect(nombreDelTerritorioConCodigo(CATALOGO, 'municipio', '  ')).toBeNull();
  });
});
