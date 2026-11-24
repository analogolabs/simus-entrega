import { buscarPreguntas } from './buscar-preguntas';
import { ConsultaOfrecida } from './consulta-guiada.service';

const banco: ConsultaOfrecida[] = [
  { id: 'a', rotulo: '¿En qué departamentos hay festivales?', descripcion: 'Festivales publicados por departamento de su sede principal.' },
  { id: 'b', rotulo: '¿En qué departamentos hay mercados musicales?', descripcion: 'Mercados musicales publicados por departamento.' },
  { id: 'c', rotulo: '¿Qué hay en la agenda próxima?', descripcion: 'Los próximos eventos publicados en la agenda, con fecha y lugar.' },
  { id: 'd', rotulo: '¿Cuáles son las noticias más recientes?', descripcion: 'Las últimas noticias publicadas, con su fecha.' },
];

describe('buscarPreguntas', () => {
  it('sin texto devuelve todo el banco', () => {
    expect(buscarPreguntas(banco, '  ').coincidencias.length).toBe(4);
  });

  it('coincide por palabras, sin tildes ni plurales', () => {
    expect(buscarPreguntas(banco, 'mercado').coincidencias.map(p => p.id)).toEqual(['b']);
    expect(buscarPreguntas(banco, 'proximos eventos').coincidencias.map(p => p.id)[0]).toBe('c');
    expect(buscarPreguntas(banco, 'FESTIVAL departamento').coincidencias[0].id).toBe('a');
  });

  it('descarta palabras vacías: «que hay» no casa con todo', () => {
    expect(buscarPreguntas(banco, 'noticias que hay').coincidencias[0].id).toBe('d');
  });

  it('sin coincidencias ofrece las más cercanas y nunca inventa una respuesta', () => {
    const r = buscarPreguntas(banco, 'presupuesto');
    expect(r.coincidencias).toEqual([]);
    expect(r.cercanas.length).toBeGreaterThan(0);
    expect(r.cercanas.length).toBeLessThanOrEqual(3);
  });
});
