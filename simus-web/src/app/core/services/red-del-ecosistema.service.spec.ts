import { normalizarRed } from './red-del-ecosistema.service';

describe('normalizarRed', () => {
  it('quita nodos de tipo desconocido y aristas con un extremo que no existe', () => {
    const red = normalizarRed({
      nodos: [
        { id: 'organizacion:1', tipo: 'organizacion', nombre: 'Corporación' },
        { id: 'festival:2', tipo: 'festival', nombre: 'Festival', departamento: 'Cauca' },
        { id: 'persona:9', tipo: 'persona', nombre: 'Alguien' },
      ],
      aristas: [
        { origen: 'organizacion:1', destino: 'festival:2', tipo: 'responsable' },
        { origen: 'organizacion:1', destino: 'persona:9', tipo: 'responsable' },
        { origen: 'festival:2', destino: 'festival:77', tipo: 'declara' },
        { origen: 'organizacion:1', destino: 'festival:2', tipo: 'inferida' },
      ],
    });
    expect(red.nodos.map((n) => n.id)).toEqual(['organizacion:1', 'festival:2']);
    expect(red.aristas.length).toBe(1);
    expect(red.nodos[1].departamento).toBe('Cauca');
  });

  it('una respuesta vacía o nula es una red vacía', () => {
    expect(normalizarRed(null)).toEqual({ nodos: [], aristas: [], truncada: false });
    expect(normalizarRed({ truncada: true }).truncada).toBeTrue();
  });
});
