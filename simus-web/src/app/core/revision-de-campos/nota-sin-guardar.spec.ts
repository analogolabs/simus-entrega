import { RevisionDeCamposStore } from './revision-de-campos.store';

/**
 * UNA SUGERENCIA ESCRITA Y SIN GUARDAR NO SE PIERDE EN SILENCIO (LIS-03).
 *
 * Con la caja de nota abierta y texto dentro, «Publicar» seguía su camino y lo escrito se tiraba.
 * El almacén ahora sabe que hay algo sin guardar, y la pantalla de revisión se detiene.
 */
describe('RevisionDeCamposStore · sugerencia sin guardar (LIS-03)', () => {
  const campo = { campoId: 'festival.nombre', seccionId: 'generales', campoEtiqueta: 'Nombre', valorObservado: 'Candelaria' };

  it('sin caja abierta no hay nada sin guardar', () => {
    const almacen = new RevisionDeCamposStore();
    expect(almacen.notaSinGuardar()).toBeFalse();
  });

  it('una caja abierta y vacía no cuenta', () => {
    const almacen = new RevisionDeCamposStore();
    almacen.campoEnEdicion.set('festival.nombre');
    almacen.textoEnEdicion.set('   ');
    expect(almacen.notaSinGuardar()).toBeFalse();
  });

  it('texto escrito en una caja abierta cuenta como sin guardar', () => {
    const almacen = new RevisionDeCamposStore();
    almacen.campoEnEdicion.set('festival.nombre');
    almacen.textoEnEdicion.set('Falta el nombre completo.');
    expect(almacen.notaSinGuardar()).toBeTrue();
  });

  it('guardar la nota la convierte en nota y ya no hay nada sin guardar', () => {
    const almacen = new RevisionDeCamposStore();
    almacen.campoEnEdicion.set('festival.nombre');
    almacen.textoEnEdicion.set('Falta el nombre completo.');
    almacen.escribir(campo, 'Falta el nombre completo.');
    expect(almacen.cuantasNotas()).toBe(1);
    // Abrir la caja de una nota ya guardada, sin tocarla, no es «sin guardar».
    almacen.campoEnEdicion.set('festival.nombre');
    almacen.textoEnEdicion.set('Falta el nombre completo.');
    expect(almacen.notaSinGuardar()).toBeFalse();
    // Pero cambiar su texto sí lo es.
    almacen.textoEnEdicion.set('Falta el nombre y el año.');
    expect(almacen.notaSinGuardar()).toBeTrue();
  });

  it('cerrar la caja descarta lo sin guardar', () => {
    const almacen = new RevisionDeCamposStore();
    almacen.campoEnEdicion.set('festival.nombre');
    almacen.textoEnEdicion.set('Algo');
    almacen.campoEnEdicion.set(null);
    expect(almacen.notaSinGuardar()).toBeFalse();
  });
});
