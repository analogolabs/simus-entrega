import {
  ContextoDeProceso,
  accionesDeProceso,
  comoAccionesDeMenu,
  estadoDeLaPropuesta,
  siguienteAccion,
} from './acciones-por-estado';

/**
 * El modelo de acciones por estado. Una sola definición para
 * Festival y Mercado, para la tarjeta de la ficha y para el menú de la lista.
 */
describe('Modelo de acciones por estado', () => {
  const base: ContextoDeProceso = { tipo: 'festival', nombre: 'Festival del Río', estado: 'borrador', esAdministradora: true };
  const ids = (ctx: ContextoDeProceso) => accionesDeProceso(ctx).map(a => a.id);
  const accion = (ctx: ContextoDeProceso, id: string) => accionesDeProceso(ctx).find(a => a.id === id)!;

  describe('borrador', () => {
    it('con lo necesario, «Enviar a revisión» es la principal y pide confirmación', () => {
      const enviar = accion(base, 'enviar');
      expect(enviar.tono).toBe('principal');
      expect(enviar.habilitada).toBeTrue();
      expect(enviar.confirmacion?.titulo).toBe('Enviar a revisión');
    });

    it('si falta algo, el envío sigue ofrecido pero apagado y dice qué falta', () => {
      const ctx = { ...base, faltaParaEnviar: 'el municipio y el correo' };
      const enviar = accion(ctx, 'enviar');
      expect(enviar.habilitada).toBeFalse();
      expect(enviar.motivo).toBe('Para enviarlo falta el municipio y el correo.');
      expect(accion(ctx, 'completar').tono).toBe('principal');
    });

    it('un editor ve el envío apagado con la explicación del rol, no oculto', () => {
      const enviar = accion({ ...base, esAdministradora: false }, 'enviar');
      expect(enviar.habilitada).toBeFalse();
      expect(enviar.motivo).toContain('quien administra la organización');
    });

    it('eliminar el borrador es la acción de peligro, con confirmación destructiva', () => {
      const eliminar = accion(base, 'eliminar-borrador');
      expect(eliminar.tono).toBe('peligro');
      expect(eliminar.confirmacion?.tono).toBe('destructiva');
    });
  });

  describe('ajustes solicitados', () => {
    const conAjustes: ContextoDeProceso = { ...base, estado: 'AjustesSolicitados', ajustesPendientes: 2 };

    it('con ajustes sin atender, «Atender ajustes» es la principal y el reenvío está apagado con el recuento', () => {
      expect(accion(conAjustes, 'atender-ajustes').tono).toBe('principal');
      const reenviar = accion(conAjustes, 'reenviar');
      expect(reenviar.habilitada).toBeFalse();
      expect(reenviar.motivo).toBe('Quedan 2 ajustes por atender.');
    });

    it('con todos atendidos, el reenvío es la principal', () => {
      const listo = { ...conAjustes, ajustesPendientes: 0 };
      expect(accion(listo, 'reenviar').tono).toBe('principal');
      expect(accion(listo, 'reenviar').habilitada).toBeTrue();
      expect(siguienteAccion(listo).tono).toBe('exito');
    });

    it('con un solo ajuste lo dice en singular', () => {
      expect(accion({ ...conAjustes, ajustesPendientes: 1 }, 'reenviar').motivo).toBe('Queda 1 ajuste por atender.');
    });
  });

  describe('en revisión', () => {
    const enRevision: ContextoDeProceso = { ...base, estado: 'en_revision' };

    it('editar está apagado con el motivo y retirar de revisión es de peligro', () => {
      expect(accion(enRevision, 'completar').habilitada).toBeFalse();
      expect(accion(enRevision, 'completar').motivo).toContain('revisando este Festival');
      expect(accion(enRevision, 'retirar-de-revision').tono).toBe('peligro');
    });

    it('en un mercado el motivo nombra al mercado', () => {
      expect(accion({ ...enRevision, tipo: 'mercado' }, 'completar').motivo).toContain('este mercado');
    });

    it('la tarjeta no lleva acciones de peligro y añade el historial', () => {
      const tarjeta = siguienteAccion(enRevision);
      expect(tarjeta.acciones.some(a => a.tono === 'peligro')).toBeFalse();
      expect(tarjeta.acciones.map(a => a.id)).toContain('ver-historial');
    });
  });

  describe('publicado', () => {
    const publicado: ContextoDeProceso = { ...base, estado: 'Publicado', cuantasEdiciones: 3 };

    it('sin propuesta ofrece proponer cambios, contacto, ediciones y solicitar retiro', () => {
      expect(ids(publicado)).toEqual(['proponer-cambios', 'editar-contacto', 'ver-ediciones', 'solicitar-retiro']);
      expect(accion(publicado, 'ver-ediciones').etiqueta).toBe('Ver ediciones (3)');
      expect(accion(publicado, 'solicitar-retiro').confirmacion?.pideMotivo).toBeTrue();
    });

    it('sin ediciones el verbo es «Registrar edición»', () => {
      expect(accion({ ...publicado, cuantasEdiciones: 0 }, 'ver-ediciones').etiqueta).toBe('Registrar edición');
    });

    it('con una propuesta en borrador se puede continuar y ENVIAR desde la ficha', () => {
      const ctx = { ...publicado, estadoPropuesta: 'Borrador' };
      expect(ids(ctx)).toContain('continuar-propuesta');
      expect(accion(ctx, 'enviar-propuesta').habilitada).toBeTrue();
      expect(accion(ctx, 'enviar-propuesta').confirmacion?.tono).toBe('confirmar');
      expect(siguienteAccion(ctx).acciones[0].id).toBe('continuar-propuesta');
    });

    it('con la propuesta en revisión, proponer otra está apagado con su motivo', () => {
      const proponer = accion({ ...publicado, estadoPropuesta: 'EnRevision' }, 'proponer-cambios');
      expect(proponer.habilitada).toBeFalse();
      expect(proponer.motivo).toContain('en revisión');
    });

    it('una propuesta rechazada o aplicada deja proponer otra', () => {
      expect(accion({ ...publicado, estadoPropuesta: 'Rechazada' }, 'proponer-cambios').habilitada).toBeTrue();
      expect(accion({ ...publicado, estadoPropuesta: 'aplicada' }, 'proponer-cambios').habilitada).toBeTrue();
    });

    it('un editor ve apagadas las que son de administración, con el motivo', () => {
      const ctx = { ...publicado, esAdministradora: false };
      expect(accion(ctx, 'proponer-cambios').motivo).toContain('quien administra');
      expect(accion(ctx, 'solicitar-retiro').habilitada).toBeFalse();
      expect(accion(ctx, 'ver-ediciones').habilitada).toBeTrue();
    });

    it('un editor sí puede corregir el contacto de lo publicado: la API lo permite', () => {
      // MUTANTE QUE MATA: apagarlo por rol. El servidor exige solo poder editar la organización.
      expect(accion({ ...publicado, esAdministradora: false }, 'editar-contacto').habilitada).toBeTrue();
    });

    it('con el retiro en trámite, solicitarlo otra vez está apagado', () => {
      const retiro = accion({ ...publicado, retiroSolicitado: true }, 'solicitar-retiro');
      expect(retiro.habilitada).toBeFalse();
      expect(retiro.motivo).toContain('en trámite');
    });
  });

  describe('rechazado', () => {
    it('solo se consulta el historial', () => {
      const rechazado: ContextoDeProceso = { ...base, estado: 'Rechazado' };
      expect(ids(rechazado)).toEqual(['ver-historial']);
      expect(siguienteAccion(rechazado).tono).toBe('rechazo');
    });
  });

  it('una acción en curso apaga las demás con su motivo', () => {
    const ocupada = accionesDeProceso({ ...base, ocupado: true });
    expect(ocupada.every(a => !a.habilitada)).toBeTrue();
    expect(ocupada.every(a => !!a.motivo)).toBeTrue();
  });

  it('el menú de una lista recibe las mismas acciones con los mismos verbos y motivos', () => {
    const ctx: ContextoDeProceso = { ...base, estado: 'ajustes_solicitados', ajustesPendientes: 1 };
    const menu = comoAccionesDeMenu(accionesDeProceso(ctx));
    expect(menu.map(a => a.etiqueta)).toEqual(accionesDeProceso(ctx).map(a => a.etiqueta));
    const reenviar = menu.find(a => a.id === 'reenviar')!;
    expect(reenviar.deshabilitada).toBeTrue();
    expect(reenviar.motivo).toBe('Queda 1 ajuste por atender.');
  });

  it('Festival y Mercado ofrecen los mismos verbos para lo mismo', () => {
    for (const estado of ['borrador', 'en_revision', 'ajustes_solicitados', 'publicado', 'rechazado']) {
      const festival = accionesDeProceso({ ...base, estado }).map(a => `${a.id}:${a.etiqueta}`);
      const mercado = accionesDeProceso({ ...base, tipo: 'mercado', estado }).map(a => `${a.id}:${a.etiqueta}`);
      expect(mercado).toEqual(festival);
    }
  });

  it('normaliza el estado de la propuesta en cualquier grafía', () => {
    expect(estadoDeLaPropuesta(null)).toBeNull();
    expect(estadoDeLaPropuesta('EnRevision')).toBe('en_revision');
    expect(estadoDeLaPropuesta('AjustesSolicitados')).toBe('ajustes_solicitados');
    expect(estadoDeLaPropuesta('Publicada')).toBe('cerrada');
  });
});
