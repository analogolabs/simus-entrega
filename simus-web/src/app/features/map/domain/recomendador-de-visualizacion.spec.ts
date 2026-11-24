import { recomendarVisualizaciones } from './recomendador-de-visualizacion';

const formas = (p: Parameters<typeof recomendarVisualizaciones>[0]) => recomendarVisualizaciones(p).map((r) => r.forma);

describe('recomendador de visualización', () => {
  it('comparar pocas categorías: barras primero y la tabla como alternativa', () => {
    const resultado = formas({ pregunta: 'comparar', categorias: 8 });
    expect(resultado[0]).toBe('barras-ordenadas');
    expect(resultado).toContain('tabla');
  });

  it('composición con solapamiento y muchos grupos: mosaico, nunca barras apiladas', () => {
    const resultado = formas({ pregunta: 'composicion', categorias: 15, solapan: true });
    expect(resultado).toContain('mosaico');
    expect(resultado).not.toContain('barras-apiladas');
  });

  it('una serie anual corta se dibuja en columnas, no en línea', () => {
    const resultado = formas({ pregunta: 'tendencia', categorias: 1, periodos: 9 });
    expect(resultado[0]).toBe('columnas-por-periodo');
    expect(resultado).not.toContain('linea');
  });

  it('la red solo se recomienda con relaciones registradas', () => {
    expect(formas({ pregunta: 'relaciones', categorias: 30 })).not.toContain('red-de-relaciones');
    expect(formas({ pregunta: 'relaciones', categorias: 30, relacionesRegistradas: true })[0]).toBe('red-de-relaciones');
  });

  it('el Sankey solo existe con flujos cuantificados', () => {
    expect(formas({ pregunta: 'flujos', categorias: 5 })).not.toContain('sankey');
    expect(formas({ pregunta: 'flujos', categorias: 5, flujosCuantificados: true })).toContain('sankey');
  });

  it('un conteo absoluto por área va en puntos, no en coroplético', () => {
    const resultado = formas({ pregunta: 'territorio', categorias: 33, conteoAbsolutoPorArea: true });
    expect(resultado).toContain('mapa-de-puntos');
    expect(resultado).not.toContain('mapa-coropletico');
    expect(formas({ pregunta: 'territorio', categorias: 33 })).toContain('mapa-coropletico');
  });

  it('para registros precisos la tabla va primera y nunca se devuelven más de tres', () => {
    expect(formas({ pregunta: 'registros', categorias: 100 })[0]).toBe('tabla');
    for (const pregunta of ['comparar', 'tendencia', 'composicion', 'relaciones', 'flujos', 'territorio', 'registros'] as const) {
      expect(recomendarVisualizaciones({ pregunta, categorias: 20, periodos: 20, relacionesRegistradas: true, flujosCuantificados: true }).length).toBeLessThanOrEqual(3);
    }
  });

  it('cada recomendación explica cuándo usarla y cuándo no', () => {
    for (const r of recomendarVisualizaciones({ pregunta: 'composicion', categorias: 10 })) {
      expect(r.cuandoUsarla.length).toBeGreaterThan(20);
      expect(r.cuandoNo.length).toBeGreaterThan(20);
    }
  });
});
