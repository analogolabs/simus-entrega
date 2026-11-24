import { ENLACES_DEL_PANEL, GRUPOS_DEL_PANEL, buscarSeccionesDelPanel } from './secciones-del-panel';
import { SECCIONES_DEL_PANEL } from '../../core/navegacion/rutas-de-gestion';

describe('secciones del panel de la organización (UI-E)', () => {
  it('son ocho destinos en tres grupos, con las etiquetas de siempre', () => {
    expect(GRUPOS_DEL_PANEL.map(grupo => grupo.etiqueta)).toEqual(['Trabajo', 'Mis procesos', 'Mi organización']);
    expect(ENLACES_DEL_PANEL.map(enlace => enlace.etiqueta)).toEqual([
      'Inicio', 'Solicitudes', 'Procesos', 'Eventos', 'Herramientas', 'Datos de la organización', 'Archivos de la organización', 'Equipo',
    ]);
  });

  it('cada destino es una sección que el enrutador del panel conoce, y ninguno se repite', () => {
    const rutas = ENLACES_DEL_PANEL.map(enlace => enlace.ruta);
    expect(new Set(rutas).size).toBe(rutas.length);
    for (const ruta of rutas) expect(SECCIONES_DEL_PANEL as readonly string[]).toContain(ruta);
  });

  it('el buscador encuentra por nombre, por grupo y por tarea, sin tildes ni mayúsculas', () => {
    expect(buscarSeccionesDelPanel('equipo').map(r => r.ruta)).toEqual(['equipo']);
    expect(buscarSeccionesDelPanel('INVITAR').map(r => r.ruta)).toEqual(['equipo']);
    expect(buscarSeccionesDelPanel('revision').map(r => r.ruta)).toEqual(['solicitudes']);
    expect(buscarSeccionesDelPanel('mi organizacion').map(r => r.ruta)).toEqual(['organizacion', 'archivos', 'equipo']);
  });

  it('los destinos cuyo título coincide van primero', () => {
    // «procesos» es el título de uno y el nombre de un grupo («Mis procesos»).
    expect(buscarSeccionesDelPanel('procesos')[0].ruta).toBe('procesos');
  });

  it('con menos de dos letras o sin coincidencias no devuelve nada', () => {
    expect(buscarSeccionesDelPanel('e')).toEqual([]);
    expect(buscarSeccionesDelPanel('zzzz')).toEqual([]);
  });

  it('cada resultado dice a qué grupo pertenece', () => {
    expect(buscarSeccionesDelPanel('archivos')[0]).toEqual({ ruta: 'archivos', etiqueta: 'Archivos de la organización', grupo: 'Mi organización' });
  });
});
