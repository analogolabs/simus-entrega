import { enumerarDatosPendientes, informacionPendienteDelMercado } from './informacion-pendiente-del-mercado';
import { MercadoDeLaOrganizacion } from './panel-organizacion.api';

/** Lo que falta para enviar un Mercado: lo mismo que comprueba el servidor, dicho antes. */
describe('informacionPendienteDelMercado', () => {
  const completo = {
    id: 4, nombre: 'Mercado', descripcion: 'Un mercado', alcanceId: 1, modalidadId: 2, correoMercado: 'a@b.co', telefonoMercado: null,
  } as MercadoDeLaOrganizacion;

  it('un mercado completo no tiene nada pendiente', () => {
    expect(informacionPendienteDelMercado(completo).paraEnviar).toEqual([]);
    expect(informacionPendienteDelMercado(null).paraEnviar).toEqual([]);
  });

  it('nombra lo que el servidor exigiría: descripción, alcance, modalidad y una forma de contacto', () => {
    const vacio = { ...completo, descripcion: '  ', alcanceId: null, modalidadId: null, correoMercado: null, telefonoMercado: ' ' } as MercadoDeLaOrganizacion;
    const faltas = informacionPendienteDelMercado(vacio).paraEnviar;

    expect(faltas.map(f => f.campo)).toEqual(['descripcion', 'alcanceId', 'modalidadId', 'correoMercado']);
    expect(enumerarDatosPendientes(faltas)).toBe('la descripción, el alcance, la modalidad y un correo o un teléfono de contacto');
  });

  it('un teléfono basta como forma de contacto', () => {
    const conTelefono = { ...completo, correoMercado: null, telefonoMercado: '3001234567' } as MercadoDeLaOrganizacion;
    expect(informacionPendienteDelMercado(conTelefono).paraEnviar).toEqual([]);
  });

  it('enumera en singular y en plural', () => {
    expect(enumerarDatosPendientes([{ etiqueta: 'el alcance' }])).toBe('el alcance');
    expect(enumerarDatosPendientes([{ etiqueta: 'el alcance' }, { etiqueta: 'la modalidad' }])).toBe('el alcance y la modalidad');
  });
});
