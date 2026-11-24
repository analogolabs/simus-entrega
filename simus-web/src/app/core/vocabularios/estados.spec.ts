import { ETIQUETAS_ESTADO_EVENTO } from '../services/agenda.service';
import { ETIQUETAS_ESTADO_MERCADO } from '../services/mercados.service';
import { ETIQUETAS_ESTADO_NOTICIA } from '../services/noticias.service';
import { ADMIN_STATUS } from '../../features/admin/domain/admin-config';
import { etiquetaDeEstado } from '../../shared/components/ui/historial-de-estados/historial-de-estados.component';
import { ETIQUETAS_DE_ESTADO_EDITORIAL, ETIQUETAS_DE_ESTADO_GENERAL, claveDeEstado, etiquetaDeEstadoEditorial, etiquetasDeEstados, humanizarCodigoDeEstado, rotuloDeEstado } from './estados';

/**
 * El vocabulario único de estados.
 *
 * <b>Lo que fija.</b> Que el mismo estado se lea con la misma palabra en Agenda, Noticias, Mercados,
 * la consola y el historial: las tablas de cada módulo se construyen eligiendo de esta, y una
 * copia a mano que diverja salta aquí.
 */
describe('Vocabulario de estados', () => {
  it('los seis del circuito, con sus palabras', () => {
    expect(ETIQUETAS_DE_ESTADO_EDITORIAL).toEqual(jasmine.objectContaining({
      borrador: 'Borrador',
      en_revision: 'En revisión',
      ajustes_solicitados: 'Ajustes solicitados',
      publicado: 'Publicado',
      rechazado: 'Rechazado',
      archivado: 'Archivado',
    }));
  });

  it('lee las dos grafías del proyecto', () => {
    expect(claveDeEstado('AjustesSolicitados')).toBe('ajustes_solicitados');
    expect(claveDeEstado('EnRevision')).toBe('en_revision');
    expect(claveDeEstado(' en-revision ')).toBe('en_revision');
    expect(etiquetaDeEstadoEditorial('AjustesSolicitados')).toBe('Ajustes solicitados');
    expect(etiquetaDeEstadoEditorial('lo_que_sea', 'Sin estado')).toBe('Sin estado');
  });

  it('cada módulo elige del mismo vocabulario y no lo copia', () => {
    const tablas: Readonly<Record<string, string>>[] = [
      ETIQUETAS_ESTADO_EVENTO,
      ETIQUETAS_ESTADO_NOTICIA,
      ETIQUETAS_ESTADO_MERCADO,
      Object.fromEntries(Object.entries(ADMIN_STATUS).map(([codigo, config]) => [codigo, config.label])),
    ];
    for (const tabla of tablas) {
      for (const [codigo, palabra] of Object.entries(tabla)) {
        const comun = (ETIQUETAS_DE_ESTADO_EDITORIAL as Record<string, string>)[codigo];
        if (comun) expect(palabra).withContext(codigo).toBe(comun);
      }
    }
    for (const codigo of Object.keys(ETIQUETAS_DE_ESTADO_EDITORIAL)) {
      expect(etiquetaDeEstado(codigo)).toBe((ETIQUETAS_DE_ESTADO_EDITORIAL as Record<string, string>)[codigo]);
    }
  });

  it('una tabla de módulo solo trae los estados que el módulo admite', () => {
    expect(Object.keys(etiquetasDeEstados('borrador', 'publicado'))).toEqual(['borrador', 'publicado']);
    expect(ETIQUETAS_ESTADO_EVENTO['ajustes_solicitados']).toBeUndefined();
  });

  it('rotuloDeEstado nunca enseña un código de base de datos', () => {
    expect(rotuloDeEstado('enviado_a_revision')).toBe('Enviado a revisión');
    expect(rotuloDeEstado('EnviadoARevision')).toBe('Enviado a revisión');
    expect(rotuloDeEstado('requiere_aclaracion')).toBe('Requiere aclaración');
    // Un estado que nadie dio de alta se vuelve legible igualmente.
    expect(rotuloDeEstado('en_espera_de_decision')).toBe('En espera de decisión');
    expect(humanizarCodigoDeEstado('')).toBe('');
    expect(rotuloDeEstado(null)).toBe('');
    // Ningún rótulo del mapa lleva guion bajo ni está en minúsculas de código.
    for (const [codigo, rotulo] of Object.entries(ETIQUETAS_DE_ESTADO_GENERAL)) {
      expect(rotulo).withContext(codigo).not.toContain('_');
      expect(rotulo[0]).withContext(codigo).toBe(rotulo[0].toUpperCase());
    }
  });

  it('el circuito editorial sin respaldo se lee legible y con respaldo gana el respaldo', () => {
    expect(etiquetaDeEstadoEditorial('enviado_a_revision')).toBe('Enviado a revisión');
    expect(etiquetaDeEstadoEditorial('lo_que_sea', 'Sin estado')).toBe('Sin estado');
  });
});
