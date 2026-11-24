import { informacionPendienteDelFestival } from './informacion-pendiente-del-festival';

describe('informacionPendienteDelFestival (#48)', () => {
  it('pide lo mismo que el servidor según el alcance territorial', () => {
    const campos = (nivel: string, dep?: string, mun?: string) => informacionPendienteDelFestival({
      id: '1', nombre: 'F', estado: 'Borrador', nivelCobertura: nivel, codigoDepartamento: dep, codigoMunicipio: mun,
    }).paraEnviar.map(d => d.campo);

    expect(campos('nacional')).toEqual([]);
    expect(campos('departamental')).toEqual(['codigoDepartamento']);
    expect(campos('departamental', '05')).toEqual([]);
    expect(campos('municipal', '05')).toEqual(['codigoMunicipio']);
    expect(campos('municipal', '05', '05001')).toEqual([]);
    expect(campos('')).toEqual(['nivelCobertura']);
  });

  it('lo opcional no bloquea y deja de pedirse cuando consta', () => {
    const completo = informacionPendienteDelFestival({
      id: '1', nombre: 'F', estado: 'Borrador', nivelCobertura: 'nacional', descripcion: 'D', periodicidad: 'anual',
      practicasMusicales: [{ id: 1, nombre: 'P' }], territoriosSonoros: [{ id: 2, nombre: 'T' }],
      correoContacto: 'a@b.co', instagram: 'https://instagram.com/f',
    });
    expect(completo).toEqual({ paraEnviar: [], paraLaFichaPublica: [] });

    const vacio = informacionPendienteDelFestival({ id: '1', nombre: 'F', estado: 'Borrador', nivelCobertura: 'nacional', descripcion: '   ' });
    expect(vacio.paraEnviar).toEqual([]);
    expect(vacio.paraLaFichaPublica.map(d => d.campo)).toEqual(
      ['descripcion', 'periodicidad', 'practicasMusicales', 'territoriosSonoros', 'correoContacto', 'paginaWeb']);
  });

  it('sin Festival no hay nada que pedir', () => {
    expect(informacionPendienteDelFestival(null)).toEqual({ paraEnviar: [], paraLaFichaPublica: [] });
  });
});
