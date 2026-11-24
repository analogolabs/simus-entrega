import { motivoDeLaAccion } from './traductor-de-errores';

/**
 * El motivo de una acción que falló, el mismo en toda la consola (FOR-01).
 *
 * Noticias, Agenda, Catálogo, las ediciones y el panel tenían cada uno su copia de «leer el primer
 * mensaje que encuentre». Aquí se fija lo que dicen todos.
 */
describe('motivoDeLaAccion', () => {
  const respaldo = 'No fue posible guardar.';

  it('dice TODOS los motivos, cada uno con el rótulo de su campo y no con su nombre interno', () => {
    const fallo = { status: 400, payload: { errors: { titulo: ['Escribe el título.'], fechaFin: ['La fecha de cierre no puede ser anterior a la de inicio.'] } } };
    expect(motivoDeLaAccion(fallo, respaldo))
      .toBe('Título: Escribe el título. Fecha de cierre: La fecha de cierre no puede ser anterior a la de inicio.');
  });

  it('un mapa sin envoltorio (los endpoints escritos a mano) se lee igual', () => {
    const fallo = { status: 400, payload: { url: ['Ingresa una dirección web válida.'] } };
    expect(motivoDeLaAccion(fallo, respaldo)).toBe('Enlace: Ingresa una dirección web válida.');
  });

  it('el motivo de «estado» o «version» se dice como frase, sin rótulo', () => {
    expect(motivoDeLaAccion({ status: 400, payload: { estado: ['No se puede publicar: no tiene fecha.'] } }, respaldo))
      .toBe('No se puede publicar: no tiene fecha.');
    expect(motivoDeLaAccion({ status: 409, payload: { version: ['La noticia cambió mientras la editabas (versión 3).'] } }, respaldo))
      .toBe('La noticia cambió mientras la editabas (versión 3).');
  });

  it('sin cuerpo ni código, gana el respaldo de quien llama', () => {
    expect(motivoDeLaAccion({ message: 'Error al consultar backend' }, respaldo)).toBe(respaldo);
    expect(motivoDeLaAccion(null, respaldo)).toBe(respaldo);
  });

  it('sin cuerpo pero con código, se dice lo que corresponde al código', () => {
    expect(motivoDeLaAccion({ status: 403 }, respaldo)).toContain('No tienes permiso');
    expect(motivoDeLaAccion({ status: 0 }, respaldo)).toContain('No hay conexión');
    expect(motivoDeLaAccion({ status: 500 }, respaldo)).toContain('Algo falló de nuestro lado');
  });

  it('un campo que no conoce no se dice con su nombre interno', () => {
    const fallo = { status: 400, payload: { errors: { campoInternoRaro: ['Este dato no es válido.'] } } };
    expect(motivoDeLaAccion(fallo, respaldo)).toBe('Este dato no es válido.');
  });
});
