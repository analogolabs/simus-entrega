import { VERBOS_DE_EVENTO, accionesDeEvento } from './acciones-de-evento';

describe('acciones de un evento de la organización', () => {
  const base = { titulo: 'Concierto de clausura', esAdministradora: true };
  const ids = (estado: string, extra: { cancelado?: boolean; esAdministradora?: boolean; ocupado?: boolean } = {}) =>
    accionesDeEvento({ ...base, estado, ...extra });
  const habilitadas = (estado: string, extra = {}) => ids(estado, extra).filter(a => a.habilitada).map(a => a.id);

  it('un borrador se edita y se envía a revisión, y no se retira ni se cancela', () => {
    expect(ids('borrador').map(a => a.id)).toEqual(['editar', 'enviar']);
    expect(habilitadas('borrador')).toEqual(['editar', 'enviar']);
    expect(ids('borrador')[1].etiqueta).toBe(VERBOS_DE_EVENTO.enviar);
  });

  it('un evento en revisión solo se edita', () => {
    expect(ids('en_revision').map(a => a.id)).toEqual(['editar']);
  });

  it('un evento publicado se corrige, se cancela o se retira', () => {
    expect(habilitadas('publicado')).toEqual(['editar', 'cancelar', 'retirar']);
  });

  it('cancelar y retirar piden motivo en el diálogo común y lo dicen con el título del evento', () => {
    const [, cancelar, retirar] = ids('publicado');

    expect(cancelar.confirmacion?.pideMotivo).toBe(true);
    expect(cancelar.confirmacion?.detalle).toContain('«Concierto de clausura»');
    expect(cancelar.confirmacion?.detalle).toContain('seguirá en la agenda');

    expect(retirar.tono).toBe('peligro');
    expect(retirar.confirmacion?.pideMotivo).toBe(true);
    expect(retirar.confirmacion?.detalle).toContain('dejará de verse en la agenda');
    // El motivo viaja a una pantalla que otras personas leen: es obligatorio, no una opción.
    expect(retirar.confirmacion?.tono).toBe('destructiva');
  });

  it('un evento cancelado no se edita ni se cancela otra vez, pero se retira, y lo dice', () => {
    const lista = ids('publicado', { cancelado: true });

    expect(lista.find(a => a.id === 'editar')).toEqual(jasmine.objectContaining({ habilitada: false, motivo: 'Un evento cancelado ya no se edita.' }));
    expect(lista.find(a => a.id === 'cancelar')).toEqual(jasmine.objectContaining({ habilitada: false, motivo: 'Este evento ya está cancelado.' }));
    expect(lista.find(a => a.id === 'retirar')?.habilitada).toBe(true);
  });

  it('un evento archivado o rechazado ofrece Editar apagado con su motivo, no lo esconde', () => {
    for (const estado of ['archivado', 'rechazado']) {
      expect(ids(estado)).toEqual([jasmine.objectContaining({
        id: 'editar', habilitada: false, motivo: 'Un evento archivado o rechazado ya no se edita.',
      })]);
    }
  });

  it('un editor ve las acciones apagadas, con quién las hace', () => {
    const lista = ids('publicado', { esAdministradora: false });

    expect(lista.every(a => !a.habilitada)).toBe(true);
    expect(lista.every(a => a.motivo === 'Lo hace quien administra la organización. Tu rol es editor.')).toBe(true);
  });

  it('con una petición en vuelo las acciones esperan', () => {
    const lista = ids('publicado', { ocupado: true });

    expect(lista.every(a => !a.habilitada)).toBe(true);
    expect(lista[0].motivo).toContain('acción en curso');
  });

  it('entiende el estado en cualquiera de sus grafías', () => {
    expect(habilitadas('EnRevision')).toEqual(['editar']);
    expect(habilitadas(' publicado ')).toEqual(['editar', 'cancelar', 'retirar']);
  });
});
