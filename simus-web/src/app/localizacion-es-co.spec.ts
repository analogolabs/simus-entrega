import { DatePipe } from '@angular/common';
import { appConfig } from './app.config';

/**
 * Los datos de localización de es-CO.
 *
 * <b>El defecto que fija esta prueba.</b> Hasta no había en todo `src` ni
 * un `registerLocaleData` ni un `LOCALE_ID`, y la cola de revisión institucional pinta la fecha de
 * envío con `| date:'medium':'':'es-CO'`
 * (`admin-festival-review-panel.component.html:13` y `:16`). Angular solo trae los datos de
 * `en-US`, así que el pipe lanzaba
 * `NG02100: InvalidPipeArgument: 'NG0701: Missing locale data for the locale "es-CO"'` y el
 * párrafo entero se quedaba en blanco.
 *
 * <b>Por qué importa dónde pasaba.</b> Esa línea es la única que dice desde cuándo un Festival
 * espera decisión. Sin ella la bandeja del funcionario muestra una lista sin antigüedad: no se
 * puede priorizar, y nada en la pantalla avisa de que falta un dato. Medido abriendo /admin con
 * `gestor@simus.test` y leyendo la consola del navegador.
 *
 * <b>Por qué la prueba vive aquí.</b> El registro es un efecto de módulo de `app.config.ts`, no
 * una función que se pueda llamar. Se comprueba su consecuencia: que el pipe formatee.
 */
describe('Localización es-CO', () => {
  const INSTANTE = '2026-08-25T20:51:56';

  it('el pipe de fecha con es-CO formatea en vez de lanzar', () => {
    // Nombrar `appConfig` es lo que obliga a cargar el módulo, y cargarlo es lo que ejecuta
    // `registerLocaleData`. Sin esta línea el empaquetador podría descartar el import.
    expect(appConfig.providers.length).toBeGreaterThan(0);

    const pipe = new DatePipe('en-US');

    expect(() => pipe.transform(INSTANTE, 'medium', '', 'es-CO')).not.toThrow();
    expect(pipe.transform(INSTANTE, 'medium', '', 'es-CO')).toBeTruthy();
  });

  it('y formatea EN ESPAÑOL, no repitiendo el formato de en-US', () => {
    const pipe = new DatePipe('en-US');

    // CON UN PATRÓN QUE NOMBRA EL MES. Con `medium` esto solo pasaba por accidente: los datos
    // reales de es-CO escriben `medium` como «25/08/2026», sin mes en letras, y la prueba se
    // apoyaba en que otra prueba hubiera registrado los datos de `es` (España) bajo `es-CO`.
    const enEspanol = pipe.transform(INSTANTE, 'd MMMM y', '', 'es-CO');
    const porOmision = pipe.transform(INSTANTE, 'd MMMM y');

    // Si un día `registerLocaleData` se llamara con los datos equivocados, la llamada no
    // lanzaría y la prueba de arriba pasaría igual. Esta comprueba que el idioma registrado es
    // el que se pidió.
    //
    expect(enEspanol).toBe('25 agosto 2026');
    expect(enEspanol).not.toBe(porOmision);
  });

  it('no se cambia el idioma por omisión del sitio', () => {
    const pipe = new DatePipe('en-US');

    // REGISTRAR NO ES FIJAR. Si además se fijara `LOCALE_ID`, cambiarían todas las fechas del
    // sitio público —la Agenda pinta fechas— y `cms:snapshot:check` compara ese texto
    // renderizado: una corrección de dos líneas pondría esa puerta en rojo por otro motivo.
    expect(pipe.transform(INSTANTE, 'medium')).toContain('Aug');
  });
});
