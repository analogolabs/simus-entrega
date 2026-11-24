import { TIPOS_DE_PROCESO, tipoDeProcesoDeLaRuta } from './tipos-de-proceso';

describe('catálogo único de tipos de proceso (PANEL, decisión 126)', () => {
  it('va en el orden fijo del Ecosistema (decisión 118): Festivales, Mercados, Redes, Lutería y Espacios', () => {
    expect(TIPOS_DE_PROCESO.map(t => t.clave)).toEqual(['festivales', 'mercados', 'redes', 'luteria', 'espacios']);
    expect(TIPOS_DE_PROCESO.map(t => t.etiquetaDePestana)).toEqual(['Festivales', 'Mercados', 'Redes y documentación', 'Lutería', 'Espacios para música en vivo']);
  });

  it('cada tipo apunta a su lista dentro del panel', () => {
    expect(TIPOS_DE_PROCESO.map(t => t.ruta)).toEqual(['procesos/festivales', 'procesos/mercados', 'procesos/redes', 'procesos/luteria', 'procesos/espacios']);
  });

  it('reconoce el tipo por la dirección, en el panel y en Mi espacio, y lo que no es un proceso devuelve null', () => {
    expect(tipoDeProcesoDeLaRuta('/gestion/o/4/procesos/festivales/1?seccion=informacion')).toBe('festivales');
    expect(tipoDeProcesoDeLaRuta('/gestion/o/4/procesos/mercados/3')).toBe('mercados');
    expect(tipoDeProcesoDeLaRuta('/gestion/cuenta/talleres/2')).toBe('luteria');
    expect(tipoDeProcesoDeLaRuta('/gestion/o/4/procesos/luteria/2')).toBe('luteria');
    expect(tipoDeProcesoDeLaRuta('/gestion/cuenta/espacios/9')).toBe('espacios');
    expect(tipoDeProcesoDeLaRuta('/gestion/o/4/procesos/redes/5')).toBe('redes');
    expect(tipoDeProcesoDeLaRuta('/gestion/cuenta/agenda-de-citas')).toBeNull();
    expect(tipoDeProcesoDeLaRuta('/gestion/o/4/solicitudes?solicitud=9')).toBeNull();
  });
});
