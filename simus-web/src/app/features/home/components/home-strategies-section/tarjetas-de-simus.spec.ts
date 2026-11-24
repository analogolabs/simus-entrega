import { rutasPlanas } from '../../../../app.routes';
import { TARJETAS_DE_SIMUS } from './home-strategies-section.component';

/**
 * LA CUADRÍCULA DE LA PORTADA PRESENTA SIMUS, Y CADA CELDA LLEVA A UNA PÁGINA QUE EXISTE.
 *
 * Si una dirección cambia de nombre en el enrutador y nadie actualiza la celda, esta prueba lo
 * dice antes que un visitante.
 */
describe('portada · «Qué encuentras en SIMUS»', () => {
  it('son cinco puertas estables: Ecosistema en grande, Conocimiento, Historias, Agenda y PNMC', () => {
    // Puertas de entrada, no categorías: los tipos de registro viven dentro del Ecosistema.
    expect(TARJETAS_DE_SIMUS.map((t) => t.id)).toEqual([
      'ecosistema', 'conocimiento', 'historias', 'agenda', 'pnmc',
    ]);
    expect(TARJETAS_DE_SIMUS.map((t) => t.navigatePath)).toEqual([
      'ecosistema', 'editorial', 'noticias', 'agenda', 'pnmc',
    ]);
    expect(TARJETAS_DE_SIMUS.filter((t) => t.celda === 'grande').length).toBe(1);
  });

  it('cada celda lleva a una ruta declarada en el enrutador', () => {
    const declaradas = new Set(rutasPlanas.map((r) => r.path));
    for (const tarjeta of TARJETAS_DE_SIMUS) {
      expect(declaradas.has(tarjeta.navigatePath)).withContext(tarjeta.navigatePath).toBeTrue();
    }
  });

  it('cada celda conserva su propia clave del panel', () => {
    expect(new Set(TARJETAS_DE_SIMUS.map((t) => t.clave)).size).toBe(5);
  });
});
