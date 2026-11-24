import { comoEtiquetas, etiquetasDisponibles } from './etiquetas';

describe('etiquetas', () => {
  it('lleva los proyectos del servidor (slug) y de los adaptadores (codigo) a la etiqueta común, sin repetir', () => {
    expect(comoEtiquetas([{ slug: 'a', nombre: 'A' }, { codigo: 'b', nombre: 'B' }, { slug: 'a', nombre: 'A' }, { nombre: 'sin código' }]))
      .toEqual([{ codigo: 'a', nombre: 'A' }, { codigo: 'b', nombre: 'B' }]);
    expect(comoEtiquetas(undefined)).toEqual([]);
  });

  it('cuenta los contenidos de cada etiqueta, de más a menos y luego por nombre, sin lista escrita de antemano', () => {
    const lista = etiquetasDisponibles([
      { proyectos: [{ slug: 'z', nombre: 'Zeta' }, { slug: 'c', nombre: 'Celebra' }] },
      { proyectos: [{ slug: 'c', nombre: 'Celebra' }] },
      { proyectos: [{ slug: 'a', nombre: 'Alfa' }] },
      {},
    ]);
    expect(lista.map(e => [e.codigo, e.total])).toEqual([['c', 2], ['a', 1], ['z', 1]]);
  });
});
