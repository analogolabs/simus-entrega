import { departamentosDe, municipiosDe, sedeCompleta, sedeDelFormulario, sedeParaEnviar, ubicacionesDesdeTerritorios } from './sede-principal';

const FILAS = [
  { departmentCode: '76', departmentName: 'Valle del Cauca', municipalityCode: '76001', municipalityName: 'Cali' },
  { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05001', municipalityName: 'Medellín' },
  { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05045', municipalityName: 'Apartadó' },
];

describe('sede principal', () => {
  it('lee la sede del servidor y deja códigos vacíos si está pendiente', () => {
    expect(sedeDelFormulario(null)).toEqual({ sedeCodigoDepartamento: '', sedeCodigoMunicipio: '' });
    expect(sedeDelFormulario({ codigoDepartamento: '05', nombreDepartamento: 'Antioquia', codigoMunicipio: '05001', nombreMunicipio: 'Medellín' }))
      .toEqual({ sedeCodigoDepartamento: '05', sedeCodigoMunicipio: '05001' });
  });

  it('manda la sede elegida aunque la cobertura sea nacional', () => {
    expect(sedeParaEnviar({ sedeCodigoDepartamento: '11', sedeCodigoMunicipio: '11001' }, 'nacional', '', ''))
      .toEqual({ sedeCodigoDepartamento: '11', sedeCodigoMunicipio: '11001' });
  });

  it('sin sede elegida, una cobertura municipal usa su municipio; la nacional no manda nada', () => {
    const vacia = { sedeCodigoDepartamento: '', sedeCodigoMunicipio: '' };
    expect(sedeParaEnviar(vacia, 'municipal', '76', '76001')).toEqual({ sedeCodigoDepartamento: '76', sedeCodigoMunicipio: '76001' });
    expect(sedeParaEnviar(vacia, 'departamental', '76', '')).toEqual({ sedeCodigoDepartamento: '76', sedeCodigoMunicipio: null });
    expect(sedeParaEnviar(vacia, 'nacional', '', '')).toEqual({ sedeCodigoDepartamento: null, sedeCodigoMunicipio: null });
  });

  it('una sede a medias no se completa con el territorio de la cobertura', () => {
    expect(sedeParaEnviar({ sedeCodigoDepartamento: '05', sedeCodigoMunicipio: '' }, 'municipal', '76', '76001'))
      .toEqual({ sedeCodigoDepartamento: '05', sedeCodigoMunicipio: null });
  });

  it('la sede está completa solo con departamento y municipio', () => {
    expect(sedeCompleta({ sedeCodigoDepartamento: '05', sedeCodigoMunicipio: '' })).toBeFalse();
    expect(sedeCompleta({ sedeCodigoDepartamento: '05', sedeCodigoMunicipio: '05001' })).toBeTrue();
  });

  it('ordena departamentos y municipios por nombre y no ofrece municipios sin departamento', () => {
    expect(departamentosDe(FILAS).map(d => d.nombre)).toEqual(['Antioquia', 'Valle del Cauca']);
    expect(municipiosDe(FILAS, '05').map(m => m.municipalityName)).toEqual(['Apartadó', 'Medellín']);
    expect(municipiosDe(FILAS, '')).toEqual([]);
  });

  it('aplana el catálogo anidado de la consola', () => {
    const filas = ubicacionesDesdeTerritorios([{ codigo: '05', nombre: 'Antioquia', municipios: [{ codigo: '05001', nombre: 'Medellín' }] }]);
    expect(filas).toEqual([{ departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05001', municipalityName: 'Medellín' }]);
  });
});
