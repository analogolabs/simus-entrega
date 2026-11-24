import {
  contarRegistrosPlanosPorDepartamento,
  contarRegistrosPorDepartamento,
  crearConteosBaseDeCartografia,
} from './conteos-territoriales';

describe('conteos territoriales compartidos', () => {
  it('crea una base normalizada desde la cartografía', () => {
    expect(crearConteosBaseDeCartografia({ features: [
      { properties: { departmentName: 'Bogotá D.C.' } },
      { properties: { dpto_cnmbr: 'Antioquia' } },
    ] })).toEqual({ BOGOTA: 0, ANTIOQUIA: 0 });
  });

  it('cuenta las formas de registros que consumen los lectores territoriales', () => {
    expect(contarRegistrosPorDepartamento([
      { fields: { dpt: 'Antioquia' } },
      { fields: { departamento: 'Bogotá D.C.' } },
      { fields: { dpt: 'Desconocido' } },
    ])).toEqual({ ANTIOQUIA: 1, BOGOTA: 1 });
    expect(contarRegistrosPlanosPorDepartamento([
      { department: 'Antioquia' }, { department: 'Antioquia' }, { department: '' },
    ])).toEqual({ ANTIOQUIA: 2 });
  });
});
