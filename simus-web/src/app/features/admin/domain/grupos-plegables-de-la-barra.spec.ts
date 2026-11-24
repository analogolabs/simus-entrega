import {
  CLAVE_GRUPOS_PLEGADOS,
  GRUPOS_PLEGADOS_POR_OMISION,
  AlmacenDePlegado,
  alternarPlegado,
  grupoPlegado,
  guardarEleccionDePlegado,
  leerEleccionDePlegado,
} from './grupos-plegables-de-la-barra';

/** Un almacén en memoria con la misma forma que `localStorage`. */
function almacenEnMemoria(inicial: Record<string, string> = {}): AlmacenDePlegado & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: clave => (clave in datos ? datos[clave] : null),
    setItem: (clave, valor) => { datos[clave] = valor; },
  };
}

describe('Grupos plegables de la barra lateral de la consola (UI-06)', () => {
  it('por omisión quedan plegados «Sitio web y comunicación» y «Gobierno y control», y nada más', () => {
    expect(GRUPOS_PLEGADOS_POR_OMISION).toEqual(['sitio', 'gobierno']);
    expect(grupoPlegado('sitio', {}, false)).toBeTrue();
    expect(grupoPlegado('gobierno', {}, false)).toBeTrue();
    expect(grupoPlegado('bandeja', {}, false)).toBeFalse();
    expect(grupoPlegado('ecosistema', {}, false)).toBeFalse();
    expect(grupoPlegado('publicaciones', {}, false)).toBeFalse();
  });

  it('un grupo con la sección que se está viendo nunca se pliega, ni por omisión ni por elección', () => {
    expect(grupoPlegado('gobierno', {}, true)).toBeFalse();
    expect(grupoPlegado('gobierno', { gobierno: true }, true)).toBeFalse();
    expect(grupoPlegado('ecosistema', { ecosistema: true }, true)).toBeFalse();
  });

  it('lo elegido explícitamente manda sobre la omisión, en un sentido y en el otro', () => {
    expect(grupoPlegado('sitio', { sitio: false }, false)).toBeFalse();
    expect(grupoPlegado('ecosistema', { ecosistema: true }, false)).toBeTrue();
  });

  it('pulsar el título de un grupo plegado lo despliega, y al revés, sin tocar los demás', () => {
    const despues = alternarPlegado('sitio', { ecosistema: true }, true);
    expect(despues).toEqual({ ecosistema: true, sitio: false });
    expect(alternarPlegado('sitio', despues, false)).toEqual({ ecosistema: true, sitio: true });
  });

  it('la elección se recuerda por cuenta y se lee igual', () => {
    const almacen = almacenEnMemoria();
    guardarEleccionDePlegado(almacen, '7', { sitio: false, ecosistema: true });
    expect(leerEleccionDePlegado(almacen, '7')).toEqual({ sitio: false, ecosistema: true });
    expect(leerEleccionDePlegado(almacen, '8')).toEqual({});
    expect(Object.keys(almacen.datos)).toEqual([`${CLAVE_GRUPOS_PLEGADOS}.7`]);
  });

  it('un dato dañado, de otra forma o con valores que no son booleanos no rompe la barra', () => {
    expect(leerEleccionDePlegado(almacenEnMemoria({ [`${CLAVE_GRUPOS_PLEGADOS}.7`]: '{no es json' }), '7')).toEqual({});
    expect(leerEleccionDePlegado(almacenEnMemoria({ [`${CLAVE_GRUPOS_PLEGADOS}.7`]: '[1,2]' }), '7')).toEqual({});
    expect(leerEleccionDePlegado(almacenEnMemoria({ [`${CLAVE_GRUPOS_PLEGADOS}.7`]: '{"sitio":"si","gobierno":false}' }), '7'))
      .toEqual({ gobierno: false });
  });

  it('sin almacén, o con un almacén que falla, la barra funciona y solo olvida', () => {
    expect(leerEleccionDePlegado(null, '7')).toEqual({});
    expect(() => guardarEleccionDePlegado(null, '7', { sitio: false })).not.toThrow();
    const roto: AlmacenDePlegado = {
      getItem: () => { throw new Error('modo privado'); },
      setItem: () => { throw new Error('cuota'); },
    };
    expect(leerEleccionDePlegado(roto, '7')).toEqual({});
    expect(() => guardarEleccionDePlegado(roto, '7', { sitio: false })).not.toThrow();
  });

  it('otra barra (el panel de la organización) usa su propia clave y su propia omisión (UI-E)', () => {
    const almacen = almacenEnMemoria();
    guardarEleccionDePlegado(almacen, '7', { procesos: true }, 'simus.panel.grupos-plegados');
    expect(Object.keys(almacen.datos)).toEqual(['simus.panel.grupos-plegados.7']);
    expect(leerEleccionDePlegado(almacen, '7', 'simus.panel.grupos-plegados')).toEqual({ procesos: true });
    // La consola no lee lo del panel, ni al revés.
    expect(leerEleccionDePlegado(almacen, '7')).toEqual({});
    // Sin omisión propia, ningún grupo del panel nace plegado; con ella, sí.
    expect(grupoPlegado('procesos', {}, false, [])).toBeFalse();
    expect(grupoPlegado('procesos', {}, false, ['procesos'])).toBeTrue();
  });
});
