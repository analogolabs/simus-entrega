import { diferenciaDeModulos, MODULOS_CONCEDIBLES, MODULOS_DEL_GESTOR, nombreDelPerfil, PERFILES_DE_MODULOS } from './modulos-del-gestor';

describe('el catálogo de módulos del gestor', () => {
  it('expande «procesos» en los tres módulos de permiso que el servidor conoce', () => {
    const codigos = MODULOS_DEL_GESTOR.map(m => m.codigo);
    expect(codigos).toEqual(jasmine.arrayContaining(['talleres', 'espacios', 'redes']));
    expect(codigos).not.toContain('procesos');
  });

  it('no ofrece a un gestor lo exclusivo del webmaster ni lo fijo', () => {
    const concedibles = MODULOS_CONCEDIBLES.map(m => m.codigo);
    expect(concedibles).not.toContain('usuarios');
    expect(concedibles).not.toContain('sistema');
    expect(concedibles).not.toContain('monitor');
    expect(concedibles).not.toContain('solicitudes');
    expect(concedibles.length).toBe(16);
  });

  it('«Celebra la Música» es un módulo propio, concedible, con nombre y descripción claros y fuera de los perfiles', () => {
    const celebra = MODULOS_CONCEDIBLES.find(m => m.codigo === 'celebra');
    expect(celebra?.nombre).toBe('Celebra la Música');
    expect(celebra?.descripcion).toContain('Solo para las personas a quienes se les concede');
    expect(celebra?.soloWebmaster).toBeFalse();
    // Ningún perfil lo concede de paso: se da persona por persona.
    expect(PERFILES_DE_MODULOS.some(p => p.modulos.includes('celebra'))).toBeFalse();
  });

  it('los perfiles solo usan módulos concedibles', () => {
    const concedibles = new Set(MODULOS_CONCEDIBLES.map(m => m.codigo));
    for (const perfil of PERFILES_DE_MODULOS) {
      for (const m of perfil.modulos) { expect(concedibles.has(m)).withContext(`${perfil.id}: ${m}`).toBeTrue(); }
    }
  });

  it('nombra el perfil que coincide exactamente y, si no, «Personalizado»', () => {
    expect(nombreDelPerfil(['monitor', 'solicitudes'])).toBe('Solo lo esencial');
    expect(nombreDelPerfil(['agenda', 'noticias'])).toBe('Personalizado');
    expect(nombreDelPerfil([...PERFILES_DE_MODULOS[0].modulos, 'monitor'])).toBe('Gestor de contenidos');
    expect(nombreDelPerfil(MODULOS_CONCEDIBLES.map(m => m.codigo))).toBe('Todos los módulos');
  });

  it('calcula qué se quita y qué se da, sin contar los fijos', () => {
    expect(diferenciaDeModulos(['monitor', 'agenda', 'noticias'], ['monitor', 'noticias', 'boletin']))
      .toEqual({ quita: ['agenda'], da: ['boletin'] });
  });
});
