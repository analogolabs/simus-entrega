import { conEtiquetasQueCaben, evolucionPorAnio, opcionBarras, opcionColumnas, opcionMosaico } from './opciones-del-tablero';

const mayus = (nombre: string) => nombre.toUpperCase();

describe('opciones del tablero', () => {
  const filas = [
    { clave: 'A', etiqueta: 'Antioquia', valor: 16 },
    { clave: 'B', etiqueta: 'Boyacá', valor: 4 },
  ];

  it('las barras atenúan lo no elegido y no lo ocultan', () => {
    const opcion = opcionBarras(filas, { color: '#7a2f97', seleccion: 'A', total: 20 }) as any;
    const datos = opcion.series[0].data;
    expect(datos.length).toBe(2);
    expect(datos[0].itemStyle.opacity).toBe(1);
    expect(datos[1].itemStyle.opacity).toBeLessThan(0.5);
  });

  it('sin elección todas las barras van llenas', () => {
    const opcion = opcionBarras(filas, { color: '#7a2f97', total: 20 }) as any;
    expect(opcion.series[0].data.every((d: any) => d.itemStyle.opacity === 1)).toBeTrue();
  });

  it('el tooltip dice el valor y su cuota del total, y escapa el nombre', () => {
    const opcion = opcionBarras([{ clave: 'x', etiqueta: '<b>x</b>', valor: 5 }], { color: '#000', total: 20 }) as any;
    const texto = opcion.tooltip.formatter({ dataIndex: 0 });
    expect(texto).toContain('25 % del total');
    expect(texto).not.toContain('<b>x</b><br/>5');
    expect(texto).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('el mosaico pinta «Sin clasificar» en gris', () => {
    const opcion = opcionMosaico(
      [{ nombre: 'Joropo', total: 3, color: '#7a2f97' }, { nombre: 'Sin clasificar', total: 2, color: '#000' }],
      { fichas: 5, sinClasificar: 'Sin clasificar' }) as any;
    expect(opcion.series[0].data[1].itemStyle.color).toBe('#94a3b8');
    expect(opcion.series[0].data[0].itemStyle.color).toBe('#7a2f97');
  });

  it('las columnas con una serie no llevan leyenda y con dos sí, apiladas', () => {
    const una = opcionColumnas(['2024'], [{ nombre: 'A', color: '#111', datos: [1] }], { unidad: 'ediciones' }) as any;
    expect(una.legend.show).toBeFalse();
    const dos = opcionColumnas(['2024'], [
      { nombre: 'A', color: '#111', datos: [1] }, { nombre: 'B', color: '#222', datos: [2] }], { unidad: 'ediciones' }) as any;
    expect(dos.legend.show).toBeUndefined();
    expect(dos.series[0].stack).toBe('total');
  });

  describe('evolución por año', () => {
    const puntos = [
      { proceso: 'festival', anio: 2019, departamento: 'Caldas', total: 2 },
      { proceso: 'festival', anio: 2023, departamento: 'Cauca', total: 1 },
      { proceso: 'mercado', anio: 2023, departamento: 'Caldas', total: 1 },
    ];

    it('muestra los años sin ediciones en cero, sin saltarlos', () => {
      const evolucion = evolucionPorAnio(puntos, '', mayus);
      expect(evolucion.anios).toEqual([2019, 2020, 2021, 2022, 2023]);
      expect(evolucion.series.find((s) => s.proceso === 'festival')!.datos).toEqual([2, 0, 0, 0, 1]);
      expect(evolucion.total).toBe(4);
    });

    it('acota por departamento sin importar cómo lo escribe cada fuente', () => {
      const evolucion = evolucionPorAnio(puntos, 'CALDAS', mayus);
      expect(evolucion.total).toBe(3);
      expect(evolucion.anios).toEqual([2019, 2020, 2021, 2022, 2023]);
    });

    it('sin puntos no inventa años', () => {
      expect(evolucionPorAnio([], '', mayus)).toEqual({ anios: [], series: [], total: 0 });
    });
  });

  describe('conEtiquetasQueCaben', () => {
    const anios = Array.from({ length: 14 }, (_, i) => String(2012 + i));
    const opcion = (data: string[]) => ({ xAxis: { type: 'category', data, axisLabel: { fontSize: 12 } }, series: [] });

    it('deja horizontales las etiquetas que caben', () => {
      const original = opcion(['ene', 'feb', 'mar']);
      expect(conEtiquetasQueCaben(original, 600)).toBe(original);
    });

    it('las pone en vertical cuando no caben: catorce años en un lienzo estrecho', () => {
      const girada = conEtiquetasQueCaben(opcion(anios), 360) as { xAxis: { axisLabel: { rotate: number; interval: number } } };
      expect(girada.xAxis.axisLabel.rotate).toBe(90);
      expect(girada.xAxis.axisLabel.interval).toBe(0);
    });

    it('los mismos catorce años caben horizontales en un lienzo ancho', () => {
      const original = opcion(anios);
      expect(conEtiquetasQueCaben(original, 1000)).toBe(original);
    });

    it('no toca opciones sin eje de categorías', () => {
      const sin = { series: [] };
      expect(conEtiquetasQueCaben(sin, 100)).toBe(sin);
    });
  });
});
