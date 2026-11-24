import { FechaPipe } from './fecha.pipe';
import { formatearFecha } from './formatos-de-fecha';

/**
 * El formateador único de fechas.
 *
 * <b>Lo que fija.</b> Que una hora se lea siempre en Bogotá —también en un equipo configurado en
 * otra zona, que es justo el caso que el navegador escondía— y que una fecha de calendario no se
 * corra de día.
 */
describe('formatearFecha', () => {
  // SIN REGISTRAR NADA AQUÍ: el formateador registra es-CO al importarse.

  it('un instante UTC se pinta en hora de Bogotá (cinco horas menos)', () => {
    // «Enviado 23:23» era esto mismo leído como hora local: lo que ocurrió a las 18:23 en Bogotá.
    expect(formatearFecha('2026-11-05T23:23:00Z', 'fecha-hora')).toBe('5 nov 2026, 18:23');
    expect(formatearFecha('2026-11-05T23:23:00Z', 'hora')).toBe('18:23');
  });

  it('el cambio de día también se hace en Bogotá', () => {
    // Las 02:00 UTC del 6 son todavía las 21:00 del 5 en Colombia.
    expect(formatearFecha('2026-11-06T02:00:00Z', 'fecha')).toBe('5 nov 2026');
    expect(formatearFecha('2026-11-06T02:00:00.1234567Z', 'fecha-hora')).toBe('5 nov 2026, 21:00');
  });

  it('un instante con desfase explícito se respeta', () => {
    expect(formatearFecha('2026-11-05T20:23:00-03:00', 'fecha-hora')).toBe('5 nov 2026, 18:23');
  });

  it('un instante sin zona se lee como UTC, que es la convención de la API', () => {
    expect(formatearFecha('2026-11-05T23:23:00', 'fecha-hora')).toBe('5 nov 2026, 18:23');
  });

  it('un Date o un número son instantes', () => {
    const instante = Date.UTC(2026, 10, 5, 23, 23);
    expect(formatearFecha(instante, 'fecha-hora')).toBe('5 nov 2026, 18:23');
    expect(formatearFecha(new Date(instante), 'fecha-hora')).toBe('5 nov 2026, 18:23');
  });

  it('una fecha de calendario (DateOnly) no se desplaza por zona', () => {
    // Leída como instante UTC sería el 4 a las 19:00 en Bogotá.
    expect(formatearFecha('2026-11-05')).toBe('5 nov 2026');
    expect(formatearFecha('2026-01-01', 'fecha-larga')).toBe('1 de enero de 2026');
    expect(formatearFecha('2026-11-05', 'fecha-hora')).toBe('5 nov 2026');
    expect(formatearFecha('2026-11-05', 'hora')).toBe('');
  });

  it('un Date de calendario se pinta con sus propios componentes', () => {
    expect(formatearFecha(new Date(2026, 0, 1), 'fecha', { calendario: true })).toBe('1 ene 2026');
    expect(formatearFecha(new Date(2026, 0, 1), 'mes-anio', { calendario: true })).toBe('enero de 2026');
  });

  it('en español de Colombia, nunca en inglés', () => {
    expect(formatearFecha('2026-11-05', 'fecha-larga')).toBe('5 de noviembre de 2026');
    expect(formatearFecha('2026-09-13', 'fecha')).toBe('13 sept 2026');
    expect(formatearFecha('2026-11-05', 'mes')).toBe('nov');
    expect(formatearFecha('2026-11-05', 'fecha-larga')).not.toContain('November');
  });

  it('lo vacío o ilegible no se pinta como «Invalid Date»', () => {
    expect(formatearFecha(null)).toBe('');
    expect(formatearFecha(undefined, 'fecha', { vacio: 'Sin fecha' })).toBe('Sin fecha');
    expect(formatearFecha('no es una fecha')).toBe('');
  });

  it('el pipe es el mismo formateador', () => {
    const pipe = new FechaPipe();
    expect(pipe.transform('2026-11-05T23:23:00Z', 'fecha-hora')).toBe('5 nov 2026, 18:23');
    expect(pipe.transform('2026-11-05')).toBe('5 nov 2026');
  });
});
