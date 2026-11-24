import { FUENTE_DEL_SISTEMA, aCsv, aSvg, celdaCsv, fechaLegible, lineasDeCabecera, nombreDeArchivo, partirEnLineas } from './exportar-consulta';

describe('exportar-consulta', () => {
  const fecha = new Date(2026, 10, 17);
  const cabecera = { titulo: 'Festivales en el país', filtros: ['Departamento: Meta', 'Capa: Festivales'], fecha };

  it('la cabecera trae título, filtros, fecha de generación y la fuente completa', () => {
    const lineas = lineasDeCabecera(cabecera);
    expect(lineas[0]).toBe('Festivales en el país');
    expect(lineas[1]).toBe('Filtros aplicados: Departamento: Meta; Capa: Festivales');
    expect(lineas[2]).toBe('Fecha de generación: 17 de noviembre de 2026');
    expect(lineas[3]).toBe(`Fuente: ${FUENTE_DEL_SISTEMA}`);
    expect(FUENTE_DEL_SISTEMA).toBe('Sistema de Información de la Música (SIMUS) — Plan Nacional de Música para la Convivencia');
  });

  it('sin filtros lo dice, en vez de callar', () => {
    expect(lineasDeCabecera({ ...cabecera, filtros: [] })[1]).toBe('Filtros aplicados: ninguno');
    expect(fechaLegible(new Date(2026, 0, 5))).toBe('5 de enero de 2026');
  });

  it('el CSV lleva la cabecera de fuente, una línea en blanco, los encabezados y las filas', () => {
    const csv = aCsv(cabecera, ['Departamento', 'Registros'], [['Meta', 12], ['Valle, del Cauca', 7]]);
    expect(csv.startsWith('﻿"Festivales en el país"\r\n')).toBeTrue();
    expect(csv).toContain(`"Fuente: ${FUENTE_DEL_SISTEMA}"`);
    expect(csv).toContain('"Fecha de generación: 17 de noviembre de 2026"');
    expect(csv).toContain('\r\n\r\n"Departamento","Registros"\r\n"Meta","12"\r\n"Valle, del Cauca","7"\r\n');
  });

  it('una celda que parece fórmula se neutraliza y las comillas se duplican', () => {
    expect(celdaCsv('=SUMA(A1)')).toBe(`"'=SUMA(A1)"`);
    expect(celdaCsv('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(celdaCsv(-3)).toBe('"-3"');
  });

  it('el SVG es autónomo y lleva título, filtros, fecha y fuente, con el texto escapado', () => {
    const { svg, alto } = aSvg({ ...cabecera, titulo: 'Rock & <Pop>' }, [{ etiqueta: 'Meta', valor: 12 }, { etiqueta: 'Cauca', valor: 6 }]);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBeTrue();
    expect(svg).toContain('Rock &amp; &lt;Pop&gt;');
    expect(svg).toContain('Departamento: Meta');
    expect(svg).toContain('Fecha de generación: 17 de noviembre de 2026');
    expect(svg).toContain('Sistema de Información de la Música (SIMUS)');
    expect(svg).toContain('Plan Nacional de Música para la Convivencia');
    expect(alto).toBeGreaterThan(150);
    expect((svg.match(/<rect /g) ?? []).length).toBe(3); // fondo y dos barras
  });

  it('sin datos lo dice y avisa cuando recorta filas', () => {
    expect(aSvg(cabecera, []).svg).toContain('Sin datos para estos filtros.');
    const muchas = Array.from({ length: 5 }, (_, i) => ({ etiqueta: `F${i}`, valor: i + 1 }));
    expect(aSvg(cabecera, muchas, { maximoDeBarras: 3 }).svg).toContain('Se muestran 3 de 5 filas');
  });

  it('nombra el archivo sin acentos y con la fecha', () => {
    expect(nombreDeArchivo('Mapa: Lutería en el país', fecha, 'png')).toBe('mapa-luteria-en-el-pais-2026-11-17.png');
    expect(partirEnLineas('uno dos tres cuatro', 8)).toEqual(['uno dos', 'tres', 'cuatro']);
  });
});
