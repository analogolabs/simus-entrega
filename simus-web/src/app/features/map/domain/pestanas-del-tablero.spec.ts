import { PESTANAS_DEL_TABLERO, PREGUNTAS_ORIENTADORAS, nombreDeLaPestana, pestanaDesdeTexto } from './pestanas-del-tablero';

describe('pestañas del tablero', () => {
  it('van en el orden pedido y no hay «Lecturas» ni «Panorama»', () => {
    expect(PESTANAS_DEL_TABLERO.map((p) => p.nombre)).toEqual(['Panel general', 'Flujos', 'Redes', 'Coincidencias', 'Barras', 'Jerarquías']);
  });

  it('cada pestaña de análisis tiene su pregunta orientadora y todas son distintas', () => {
    expect(PREGUNTAS_ORIENTADORAS.map((p) => p.id)).toEqual(['flujos', 'redes', 'coincidencias', 'barras', 'jerarquias']);
    expect(new Set(PREGUNTAS_ORIENTADORAS.map((p) => p.pregunta)).size).toBe(5);
    expect(PREGUNTAS_ORIENTADORAS.find((p) => p.id === 'redes')!.pregunta).toBe('¿Quién se conecta con quién o con qué?');
  });

  it('los enlaces antiguos siguen abriendo una pestaña que existe', () => {
    expect(pestanaDesdeTexto('panorama')).toBe('panel');
    expect(pestanaDesdeTexto('lecturas')).toBe('panel');
    expect(pestanaDesdeTexto('avanzado')).toBe('flujos');
    expect(pestanaDesdeTexto('redes')).toBe('redes');
    expect(pestanaDesdeTexto('xyz')).toBe('panel');
    expect(nombreDeLaPestana('jerarquias')).toBe('Jerarquías');
  });
});
