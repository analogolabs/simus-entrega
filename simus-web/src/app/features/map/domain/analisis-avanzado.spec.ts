import {
  RegistroAnalitico, SIN_DECLARAR, SIN_FILTROS, barrasApiladas, construirRegistros, diagramaAluvial, filtrarRegistros,
  jerarquia, matrizDeCoincidencias, perfilParaElRecomendador, tiposPresentes,
} from './analisis-avanzado';
import { recomendarVisualizaciones } from './recomendador-de-visualizacion';

const r = (tipo: string, departamento: string, practicas: string[], territorios: string[]): RegistroAnalitico =>
  ({ tipo, departamento, practicas, territorios });

const REGISTROS: RegistroAnalitico[] = [
  r('Festival', 'Cauca', ['Marimba', 'Gaita'], ['Pacífico']),
  r('Festival', 'Cauca', ['Marimba'], ['Pacífico']),
  r('Festival', 'Meta', [SIN_DECLARAR], [SIN_DECLARAR]),
  r('Mercado', 'Meta', ['Gaita'], ['Llanos']),
  r('Mercado', 'Chocó', ['Marimba'], ['Pacífico', 'Llanos']),
];

describe('análisis avanzado: aritmética del tablero', () => {
  it('reduce los registros crudos y rotula lo que no se declara como «Sin declarar»', () => {
    const registros = construirRegistros(
      [['Festival', { cauca: [{ department: 'Cauca', practices: 'Marimba\u001FGaita', linkedSonorousTerritories: '' }] }]],
      (nombre) => nombre);
    expect(registros).toEqual([{ tipo: 'Festival', departamento: 'Cauca', practicas: ['Marimba', 'Gaita'], territorios: [SIN_DECLARAR] }]);
  });

  it('el filtro por tipo de proceso y por marca recorta todos los registros', () => {
    expect(filtrarRegistros(REGISTROS, { ...SIN_FILTROS, tipos: ['Mercado'] }).length).toBe(2);
    expect(filtrarRegistros(REGISTROS, { ...SIN_FILTROS, departamento: 'Cauca', practica: 'Gaita' }).length).toBe(1);
    expect(filtrarRegistros(REGISTROS, SIN_FILTROS).length).toBe(5);
  });

  it('las barras apiladas cuentan cada registro una vez y ordenan por total', () => {
    const barras = barrasApiladas(REGISTROS);
    expect(barras.departamentos).toEqual(['Cauca', 'Meta', 'Chocó']);
    expect(barras.valores['Festival']).toEqual([2, 1, 0]);
    expect(barras.valores['Mercado']).toEqual([0, 1, 1]);
    expect(barras.totales).toEqual([2, 2, 1]);
  });

  it('las barras recortan a los primeros y dicen cuántos quedaron fuera', () => {
    expect(barrasApiladas(REGISTROS, 2).ocultos).toBe(1);
  });

  it('la jerarquía baja de tipo a departamento y a práctica, contando declaraciones', () => {
    const arbol = jerarquia(REGISTROS);
    const festival = arbol.find((n) => n.name === 'Festival')!;
    expect(festival.value).toBe(3);
    const cauca = festival.children!.find((n) => n.name === 'Cauca')!;
    expect(cauca.value).toBe(2);
    expect(cauca.children!.find((n) => n.name === 'Marimba')!.value).toBe(2);
    expect(cauca.children!.find((n) => n.name === 'Gaita')!.value).toBe(1);
  });

  it('el aluvial lleva un hilo por registro en cada paso y suma lo mismo en los dos', () => {
    const d = diagramaAluvial(REGISTROS);
    const paso1 = d.enlaces.filter((e) => e.source.startsWith('t:')).reduce((s, e) => s + e.value, 0);
    const paso2 = d.enlaces.filter((e) => e.source.startsWith('d:')).reduce((s, e) => s + e.value, 0);
    expect(paso1).toBe(5);
    expect(paso2).toBe(5);
    expect(d.enlaces.every((e) => e.value > 0)).toBeTrue();
  });

  it('el aluvial agrupa lo menos frecuente en «Otros» sin perder registros', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => r('Festival', `Depto ${i}`, ['Marimba'], []));
    const d = diagramaAluvial(muchos, 4);
    expect(d.nodos.some((n) => n.name === 'd:Otros')).toBeTrue();
    expect(d.enlaces.filter((e) => e.source.startsWith('t:')).reduce((s, e) => s + e.value, 0)).toBe(12);
  });

  it('la matriz cuenta coincidencias entre dos ejes y solo guarda las celdas con datos', () => {
    const m = matrizDeCoincidencias(REGISTROS, 'practicas', 'territorios');
    const valor = (fila: string, columna: string) =>
      m.celdas.find(([c, f]) => m.columnas[c] === columna && m.filas[f] === fila)?.[2] ?? 0;
    expect(valor('Marimba', 'Pacífico')).toBe(3);
    expect(valor('Gaita', 'Llanos')).toBe(1);
    expect(m.columnas).not.toContain('Sin declarar');
    expect(m.filas).not.toContain('Sin declarar');
    expect(m.maximo).toBe(3);
  });

  it('los tipos presentes salen de mayor a menor', () => {
    expect(tiposPresentes(REGISTROS)).toEqual([{ nombre: 'Festival', total: 3 }, { nombre: 'Mercado', total: 2 }]);
  });

  it('el recomendador no ofrece red ni Sankey sin relaciones ni flujos registrados, y ofrece el aluvial como reparto', () => {
    const relaciones = recomendarVisualizaciones(perfilParaElRecomendador('relaciones', REGISTROS)).map((x) => x.forma);
    expect(relaciones).toEqual(['tabla']);
    const flujos = recomendarVisualizaciones(perfilParaElRecomendador('flujos', REGISTROS)).map((x) => x.forma);
    expect(flujos).not.toContain('sankey');
    const composicion = recomendarVisualizaciones({ ...perfilParaElRecomendador('composicion', REGISTROS), criterios: 3 }).map((x) => x.forma);
    expect(composicion).toContain('tabla');
  });
});
