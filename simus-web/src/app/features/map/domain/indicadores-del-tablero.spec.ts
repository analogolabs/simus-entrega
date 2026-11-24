import { FICHAS_DE_INDICADORES, fichaDelIndicador } from './indicadores-del-tablero';

describe('fichas de indicadores del tablero', () => {
  it('cada ficha documenta los nueve datos de gobernanza, sin vacíos', () => {
    for (const ficha of FICHAS_DE_INDICADORES) {
      for (const campo of ['nombre', 'definicion', 'formula', 'unidad', 'fuente', 'periodo', 'cobertura', 'actualizacion', 'limitaciones'] as const) {
        expect(ficha[campo].trim().length).withContext(`${ficha.id}.${campo}`).toBeGreaterThan(3);
      }
    }
  });

  it('los identificadores son únicos y se encuentran', () => {
    const ids = FICHAS_DE_INDICADORES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(fichaDelIndicador('ediciones-por-anio').nombre).toContain('Ediciones');
  });

  it('toda ficha avisa de que cuenta registros de la plataforma o publicados, no el universo', () => {
    for (const ficha of FICHAS_DE_INDICADORES) {
      expect((ficha.limitaciones + ficha.cobertura + ficha.fuente).toLowerCase()).toMatch(/registr|publicad|agenda|edici/);
    }
  });
});
