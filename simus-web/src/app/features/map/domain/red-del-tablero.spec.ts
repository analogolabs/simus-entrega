import {
  MAXIMO_DE_NODOS_A_LA_VISTA, VECINOS_POR_NODO, buscarNodos, enlaceDeLaFicha, filtrarRed, opcionRed, semillasDeLaRed, tablaDeVinculos, vecinosDe, vinculosDe, vistaDeLaRed,
} from './red-del-tablero';
import { RedDelEcosistema } from '../../../core/services/red-del-ecosistema.service';

const mayus = (n: string) => n.toUpperCase();
const red: RedDelEcosistema = {
  truncada: false,
  nodos: [
    { id: 'organizacion:1', tipo: 'organizacion', nombre: 'Corporación A', departamento: '' },
    { id: 'organizacion:2', tipo: 'organizacion', nombre: 'Corporación B', departamento: '' },
    { id: 'festival:10', tipo: 'festival', nombre: 'Festival Meta', departamento: 'Meta' },
    { id: 'festival:11', tipo: 'festival', nombre: 'Festival Cauca', departamento: 'Cauca' },
    { id: 'mercado:5', tipo: 'mercado', nombre: 'Mercado Cauca', departamento: 'Cauca' },
    { id: 'territorio:1', tipo: 'territorio', nombre: 'Joropo', departamento: '' },
    { id: 'practica:3', tipo: 'practica', nombre: 'Arpa llanera', departamento: '' },
  ],
  aristas: [
    { origen: 'organizacion:1', destino: 'festival:10', tipo: 'responsable' },
    { origen: 'organizacion:2', destino: 'festival:11', tipo: 'responsable' },
    { origen: 'organizacion:2', destino: 'mercado:5', tipo: 'responsable' },
    { origen: 'festival:10', destino: 'territorio:1', tipo: 'declara' },
    { origen: 'festival:10', destino: 'practica:3', tipo: 'declara' },
    { origen: 'mercado:5', destino: 'festival:11', tipo: 'en_el_marco' },
  ],
};
const SIN_AMBITO = { departamento: '', procesos: null };

describe('red del tablero', () => {
  it('filtrar por departamento deja los procesos de ese sitio y solo lo que se une a ellos', () => {
    const cauca = filtrarRed(red, { departamento: 'CAUCA', procesos: null }, mayus);
    expect(cauca.nodos.map((n) => n.id).sort()).toEqual(['festival:11', 'mercado:5', 'organizacion:2']);
    expect(cauca.aristas.length).toBe(3);
  });

  it('no inventa vínculos: un mercado en el marco de un festival que no se ve pierde esa arista', () => {
    const soloMercados = filtrarRed(red, { departamento: '', procesos: ['mercado'] }, mayus);
    expect(soloMercados.aristas.every((a) => a.tipo !== 'en_el_marco')).toBeTrue();
    expect(soloMercados.nodos.some((n) => n.tipo === 'festival')).toBeFalse();
  });

  it('filtrar por territorio o práctica deja los procesos que lo declaran', () => {
    expect(filtrarRed(red, { ...SIN_AMBITO, territorio: 'Joropo' }, mayus).nodos.map((n) => n.id).sort())
      .toEqual(['festival:10', 'organizacion:1', 'practica:3', 'territorio:1']);
    expect(filtrarRed(red, { ...SIN_AMBITO, practica: 'Arpa llanera' }, mayus).nodos.some((n) => n.id === 'festival:11')).toBeFalse();
  });

  it('ocultar un tipo de nodo quita sus nodos y las relaciones que los tocan, sin inventar otras', () => {
    const sinOrganizaciones = filtrarRed(red, { ...SIN_AMBITO, tiposDeNodo: ['festival', 'mercado', 'territorio', 'practica'] }, mayus);
    expect(sinOrganizaciones.nodos.some((n) => n.tipo === 'organizacion')).toBeFalse();
    expect(sinOrganizaciones.aristas.some((a) => a.tipo === 'responsable')).toBeFalse();
    expect(sinOrganizaciones.aristas.length).toBe(3);
  });

  it('sin ámbito entrega la red completa', () => {
    expect(filtrarRed(red, SIN_AMBITO, mayus).aristas.length).toBe(6);
  });

  it('las semillas son los nodos más conectados', () => {
    expect(semillasDeLaRed(red, 2)[0]).toBe('festival:10');
  });

  it('ampliar un nodo muestra sus vecinos y solo las relaciones registradas entre los que se ven', () => {
    const vista = vistaDeLaRed(red, { expandidos: ['organizacion:2'], extra: {} });
    expect(vista.red.nodos.map((n) => n.id).sort()).toEqual(['festival:11', 'mercado:5', 'organizacion:2']);
    // el mercado y el festival se ven, y entre ellos SÍ hay una relación registrada
    expect(vista.red.aristas.length).toBe(3);
    // el territorio de otro festival no aparece: no está ampliado ni es vecino
    expect(vista.red.nodos.some((n) => n.id === 'territorio:1')).toBeFalse();
  });

  it('otro clic suma las conexiones del segundo nodo sin perder las del primero', () => {
    const vista = vistaDeLaRed(red, { expandidos: ['organizacion:2', 'festival:11'], extra: {} });
    expect(vista.red.nodos.length).toBe(3);
    const ambos = vistaDeLaRed(red, { expandidos: ['organizacion:1', 'festival:10'], extra: {} });
    expect(ambos.red.nodos.map((n) => n.id).sort()).toEqual(['festival:10', 'organizacion:1', 'practica:3', 'territorio:1']);
  });

  it('el límite por nodo deja vecinos sin mostrar y «ver más» los pide', () => {
    const muchos: RedDelEcosistema = {
      truncada: false,
      nodos: [{ id: 'territorio:1', tipo: 'territorio', nombre: 'T', departamento: '' },
        ...Array.from({ length: 20 }, (_, i) => ({ id: `festival:${i}`, tipo: 'festival' as const, nombre: `F${String(i).padStart(2, '0')}`, departamento: '' }))],
      aristas: Array.from({ length: 20 }, (_, i) => ({ origen: `festival:${i}`, destino: 'territorio:1', tipo: 'declara' as const })),
    };
    const base = vistaDeLaRed(muchos, { expandidos: ['territorio:1'], extra: {} });
    expect(base.red.nodos.length).toBe(1 + VECINOS_POR_NODO);
    expect(base.ocultos['territorio:1']).toBe(20 - VECINOS_POR_NODO);
    const mas = vistaDeLaRed(muchos, { expandidos: ['territorio:1'], extra: { 'territorio:1': VECINOS_POR_NODO } });
    expect(mas.red.nodos.length).toBe(1 + 2 * VECINOS_POR_NODO);
    expect(MAXIMO_DE_NODOS_A_LA_VISTA).toBeGreaterThan(40);
  });

  it('busca por nombre sin acentos ni mayúsculas', () => {
    expect(buscarNodos(red, 'corporacion').map((n) => n.id)).toEqual(['organizacion:2', 'organizacion:1']);
    expect(buscarNodos(red, 'x')).toEqual([]);
  });

  it('los vínculos de un nodo dicen con quién y de qué manera', () => {
    expect(vecinosDe(red, 'festival:11').map((v) => v.id).sort()).toEqual(['mercado:5', 'organizacion:2']);
    const vinculos = vinculosDe(red, 'festival:10');
    expect(vinculos.find((v) => v.nodo.id === 'practica:3')?.relacion).toBe('declara la práctica');
    expect(vinculos.find((v) => v.nodo.id === 'organizacion:1')?.relacion).toBe('tiene como responsable a');
  });

  it('la alternativa tabular tiene una fila por relación, en palabras', () => {
    const filas = tablaDeVinculos(red);
    expect(filas.length).toBe(6);
    expect(filas[0].celdas[2]).toBe('es responsable de');
  });

  it('solo festivales, mercados y organizaciones tienen ficha pública', () => {
    expect(enlaceDeLaFicha(red.nodos[2])).toEqual(['/ecosistema/festivales', '10']);
    expect(enlaceDeLaFicha(red.nodos[0])).toEqual(['/ecosistema/organizaciones', '1']);
    expect(enlaceDeLaFicha(red.nodos[5])).toBeNull();
  });

  it('el grafo atenúa lo que no es vecino del nodo elegido y rotula las aristas', () => {
    const opcion = opcionRed(red, { seleccion: 'festival:10', animar: false }) as any;
    const nodos = opcion.series[0].data;
    expect(nodos.find((n: any) => n.id === 'festival:10').itemStyle.opacity).toBe(1);
    expect(nodos.find((n: any) => n.id === 'organizacion:1').itemStyle.opacity).toBe(1);
    expect(nodos.find((n: any) => n.id === 'festival:11').itemStyle.opacity).toBeLessThan(0.5);
    expect(opcion.series[0].links[0].rotulo).toBe('es responsable de');
  });
});
