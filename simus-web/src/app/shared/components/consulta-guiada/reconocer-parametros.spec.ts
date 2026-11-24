import { reconocerParametros } from './reconocer-parametros';
import { CatalogosDeConsultaPublica, ParametroDePregunta, PreguntaPublica } from './consulta-guiada.service';

const p = (nombre: ParametroDePregunta['nombre'], obligatorio = true): ParametroDePregunta => ({ nombre, rotulo: nombre, obligatorio });
const q = (id: string, ...parametros: ParametroDePregunta[]): PreguntaPublica => ({ id, rotulo: id, descripcion: id, parametros });

const tipos = ['festivales', 'mercados', 'talleres', 'espacios', 'redes'] as const;
const preguntas: PreguntaPublica[] = [
  ...tipos.flatMap(t => [q(`publica_${t}_en_departamento`, p('departamento')), q(`publica_${t}_en_municipio`, p('municipio')), q(`publica_${t}_por_departamento`)]),
  q('publica_procesos_por_tipo'), q('publica_procesos_por_departamento'), q('publica_procesos_en_departamento', p('departamento')),
  q('publica_procesos_en_municipio', p('municipio')), q('publica_festivales_con_practica', p('practica')),
  q('publica_festivales_con_territorio', p('territorio')), q('publica_practicas_en_departamento', p('departamento')),
  q('publica_practicas_musicales'), q('publica_agenda_por_mes'), q('publica_completitud_del_dato'),
  q('publica_organizaciones_con_mas_procesos'), q('publica_procesos_de_organizacion', p('organizacion')),
  q('publica_agenda_filtrada', p('departamento', false), p('municipio', false), p('tipo', false), p('mes', false), p('anio', false)),
];

const catalogos: CatalogosDeConsultaPublica = {
  departamentos: [
    { id: '52', nombre: 'Nariño' }, { id: '11', nombre: 'Bogotá, D.C.' }, { id: '76', nombre: 'Valle del Cauca' },
    { id: '88', nombre: 'Archipiélago de San Andrés, Providencia y Santa Catalina' }, { id: '44', nombre: 'La Guajira' }, { id: '05', nombre: 'Antioquia' },
  ],
  municipios: [['52001', 'Pasto'], ['11001', 'Bogotá, D.C.'], ['05001', 'Medellín'], ['76001', 'Cali'], ['05615', 'Rionegro'], ['68615', 'Rionegro'], ['52835', 'San Andrés de Tumaco']],
  tipos: tipos.map(id => ({ id, singular: id, plural: id, pistas: { festivales: ['festival'], mercados: ['mercado'], talleres: ['taller', 'luteria', 'lutier'], espacios: ['espacio'], redes: ['red', 'documentacion'] }[id] })),
  practicas: [{ id: '3', nombre: 'Marimba de chonta' }, { id: '4', nombre: 'Chirimía' }],
  territorios: [{ id: '7', nombre: 'Pacífico sur' }],
  organizaciones: [{ id: '9', nombre: 'Corporación Cultural del Sur' }],
};

const reconocer = (texto: string) => reconocerParametros(texto, preguntas, catalogos, new Date(2026, 10, 22));

describe('reconocerParametros', () => {
  it('«festivales en Nariño» ejecuta la plantilla de festivales por departamento, sin tildes ni mayúsculas', () => {
    const r = reconocer('¿Qué FESTIVALES hay en nariño?');
    expect(r.estado).toBe('ejecutar');
    expect(r.pregunta?.id).toBe('publica_festivales_en_departamento');
    expect(r.parametros).toEqual({ departamento: '52' });
    expect(r.entendido).toEqual(['departamento: Nariño']);
  });

  it('reconoce sinónimos de tipo (lutería, redes) y municipios', () => {
    expect(reconocer('talleres de luteria en pasto').pregunta?.id).toBe('publica_talleres_en_municipio');
    expect(reconocer('talleres de luteria en pasto').parametros).toEqual({ municipio: '52001' });
    expect(reconocer('redes en medellin').pregunta?.id).toBe('publica_redes_en_municipio');
    expect(reconocer('espacios en la guajira').parametros).toEqual({ departamento: '44' });
    expect(reconocer('mercados en san andres').parametros).toEqual({ departamento: '88' });
  });

  it('Bogotá es el departamento antes que el municipio', () => {
    expect(reconocer('festivales en Bogotá').pregunta?.id).toBe('publica_festivales_en_departamento');
  });

  it('«mercados de Bogotá en diciembre» va a la agenda con tipo, departamento y mes (próximo diciembre sin año)', () => {
    const r = reconocer('mercados de Bogotá en diciembre');
    expect(r.estado).toBe('ejecutar');
    expect(r.pregunta?.id).toBe('publica_agenda_filtrada');
    expect(r.parametros).toEqual({ departamento: '11', tipo: 'mercados', mes: '12' });
    expect(reconocer('eventos en Cali en marzo de 2027').parametros).toEqual({ municipio: '76001', mes: '3', anio: '2027' });
  });

  it('si falta el parámetro obligatorio lo pide, y si el municipio es ambiguo lo dice', () => {
    const sinLugar = reconocer('que festivales hay');
    expect(sinLugar.estado).toBe('pedir');
    expect(sinLugar.faltantes).toEqual(['departamento']);
    const ambiguo = reconocer('talleres en Rionegro');
    expect(ambiguo.estado).toBe('pedir');
    expect(ambiguo.faltantes).toEqual(['municipio']);
    expect(ambiguo.ambiguo).toBe('Rionegro');
    expect(reconocer('talleres en Rionegro Antioquia').parametros).toEqual({ municipio: '05615' });
  });

  it('prácticas, territorios y organizaciones salen de sus catálogos', () => {
    expect(reconocer('festivales de marimba de chonta').parametros).toEqual({ practica: '3' });
    expect(reconocer('festivales del pacifico sur').pregunta?.id).toBe('publica_festivales_con_territorio');
    expect(reconocer('procesos de corporacion cultural del sur').parametros).toEqual({ organizacion: '9' });
    expect(reconocer('que practicas hay en Nariño').pregunta?.id).toBe('publica_practicas_en_departamento');
  });

  it('cuántos, por departamento, completitud y organizaciones', () => {
    expect(reconocer('cuantos mercados hay por departamento').pregunta?.id).toBe('publica_mercados_por_departamento');
    expect(reconocer('cuantos procesos hay').pregunta?.id).toBe('publica_procesos_por_tipo');
    expect(reconocer('que tan completo esta el dato').pregunta?.id).toBe('publica_completitud_del_dato');
    expect(reconocer('organizaciones con mas procesos').pregunta?.id).toBe('publica_organizaciones_con_mas_procesos');
    expect(reconocer('eventos por mes').pregunta?.id).toBe('publica_agenda_por_mes');
  });

  it('lo que no entiende devuelve «ninguno»', () => {
    expect(reconocer('presupuesto del ministerio').estado).toBe('ninguno');
    expect(reconocer('   ').estado).toBe('ninguno');
    expect(reconocerParametros('festivales en Nariño', preguntas, undefined).estado).toBe('ninguno');
  });

  it('un valor con comillas o SQL no coincide con ningún catálogo', () => {
    const r = reconocer("festivales en 05' OR 1=1 --");
    expect(r.parametros['departamento']).toBeUndefined();
    expect(r.estado).toBe('pedir');
  });
});
