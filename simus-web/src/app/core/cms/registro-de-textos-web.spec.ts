import {
  DEFAULT_TEXTS,
  WEB_TEXT_FIELDS,
  WEB_TEXT_GROUPS,
  WEB_TEXT_KEY_INDEX,
  WEB_TEXT_KEYS_LIST,
  WEB_TEXT_SECTIONS,
} from './registro-de-textos-web';

/**
 * El registro es la unica fuente de claves editables del sitio publico. Estas
 * pruebas cubren lo que antes se rompia en silencio cuando las tres listas
 * paralelas se desincronizaban: claves huerfanas, duplicadas o inguardables.
 */
describe('Registro de textos editables', () => {
  it('no repite una clave en dos grupos', () => {
    const keys = WEB_TEXT_FIELDS.map((field) => field.key);
    const duplicated = keys.filter((key, index) => keys.indexOf(key) !== index);
    expect(duplicated).toEqual([]);
  });

  it('deriva las tres vistas del mismo conjunto de claves', () => {
    const keys = WEB_TEXT_FIELDS.map((field) => field.key).sort();
    expect(Object.keys(DEFAULT_TEXTS).sort()).toEqual(keys);
    expect(WEB_TEXT_KEYS_LIST.map((item) => item.key).sort()).toEqual(keys);
    expect(WEB_TEXT_KEY_INDEX.size).toBe(keys.length);
  });

  it('declara etiqueta y limite utilizables en cada campo', () => {
    const invalid = WEB_TEXT_FIELDS.filter((field) => !field.label.trim() || field.limit <= 0);
    expect(invalid.map((field) => field.key)).toEqual([]);
  });

  it('mantiene cada texto por defecto dentro de su propio limite', () => {
    // Un valor por defecto mas largo que su limite bloquea el guardado del grupo
    // completo: el panel valida el largo antes de escribir.
    const overflowing = WEB_TEXT_FIELDS
      .filter((field) => field.defaultValue.length > field.limit)
      .map((field) => `${field.key} (${field.defaultValue.length}/${field.limit})`);
    expect(overflowing).toEqual([]);
  });

  it('no deja campos sin contenido compilado', () => {
    const empty = WEB_TEXT_FIELDS.filter((field) => !field.defaultValue.trim());
    expect(empty.map((field) => field.key)).toEqual([]);
  });

  it('cubre con pestanas exactamente las secciones que tienen grupos', () => {
    const withGroups = [...new Set(WEB_TEXT_GROUPS.map((group) => group.section))].sort();
    const declared = WEB_TEXT_SECTIONS.map((section) => section.section).sort();
    expect(declared).toEqual(withGroups);
  });

  it('asigna a cada clave la seccion de su grupo', () => {
    const mismatched = WEB_TEXT_GROUPS.flatMap((group) =>
      group.fields
        .filter((field) => WEB_TEXT_KEY_INDEX.get(field.key)?.section !== group.section)
        .map((field) => field.key),
    );
    expect(mismatched).toEqual([]);
  });

  it('conserva un identificador unico por grupo', () => {
    const ids = WEB_TEXT_GROUPS.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no repite el nombre de la seccion en la etiqueta de un campo', () => {
    // Lo mismo que la prueba de abajo, un nivel más adentro. Un campo llamado
    // «Agenda - Título Filtros» dice «Agenda» por cuarta vez en la misma
    // pantalla: ya lo dicen la pestaña activa, la línea «Sección:» y —cuando lo
    // decía— la etiqueta del grupo.
    //
    // Se comprueba contra la sección Y contra su etiqueta corta de pestaña,
    // porque las dos se leen en pantalla: los campos de «Acceso externo» se
    // editan bajo una pestaña que dice «Registro», así que «Registro - Título»
    // repetía igual aunque el nombre no coincidiera literalmente.
    //
    // NO se prohíbe cualquier prefijo: «Card 3 - …» distingue partes DENTRO de
    // un grupo, que es lo contrario de repetirlo. Dónde está exactamente la
    // frontera lo decide la prueba de abajo, no esta.
    const pill = new Map(WEB_TEXT_SECTIONS.map((s) => [s.section, s.pill]));
    const redundantes = WEB_TEXT_GROUPS.flatMap((group) =>
      group.fields
        .filter((field) => [group.section, pill.get(group.section)]
          .some((nombre) => nombre && field.label.startsWith(`${nombre} - `)))
        .map((field) => `${field.key}: «${field.label}»`),
    );
    expect(redundantes).toEqual([]);
  });

  it('no repite el nombre del grupo en la etiqueta de TODOS sus campos', () => {
    // La segunda capa de la misma limpieza, y la que faltaba.
    //
    // La prueba de arriba quita el nombre de la SECCIÓN. Quedaban 82 campos en
    // doce grupos donde el prefijo repetía el nombre del GRUPO: «Eje 1 - Título
    // del Eje» bajo el encabezado «Eje 1 - Música para la Vida», «404 - Título»
    // bajo «Página no encontrada (error 404)», «Tutorial - Paso 1, título» bajo
    // «Tutorial del geovisor». El panel dibuja ese encabezado justo encima del
    // formulario (`admin-web-texts-panel.component.html:157`), así que el
    // prefijo no añade nada: lo dice la línea de arriba.
    //
    // LA FRONTERA ESTÁ EN SI EL PREFIJO VARÍA. «Card 1 - Título», «Card 2 -
    // Título» distinguen una tarjeta de otra dentro del mismo formulario y son
    // imprescindibles; «Eje 1 - » delante de los ocho campos del grupo del eje 1
    // no distingue nada de nada. Por eso la regla no es «ningún prefijo» sino
    // «ningún prefijo constante en todo el grupo».
    //
    // Se exige más de un campo: un grupo de uno solo no tiene con qué comparar,
    // y su rótulo no es un prefijo repetido sino simplemente su rótulo.
    const separador = / [-–] /;
    const constantes = WEB_TEXT_GROUPS
      .filter((group) => group.fields.length > 1)
      .map((group) => {
        const prefijos = group.fields.map((field) =>
          separador.test(field.label) ? field.label.split(separador)[0] : null);
        const todosIguales = prefijos.every((p) => p !== null && p === prefijos[0]);
        return todosIguales ? `${group.id}: los ${group.fields.length} campos empiezan por «${prefijos[0]} - »` : null;
      })
      .filter((x): x is string => x !== null);

    expect(constantes).toEqual([]);
  });

  it('no deja dos campos del mismo grupo con la misma etiqueta', () => {
    // Dos casillas con el mismo rótulo en un mismo formulario son peores que un
    // prefijo repetido: el editor no puede saber cuál de las dos está tocando.
    // Esta prueba es la red de la anterior — recortar etiquetas puede hacer que
    // dos que se distinguían dejen de distinguirse.
    const repetidas = WEB_TEXT_GROUPS.flatMap((group) => {
      const vistas = new Set<string>();
      return group.fields
        .filter((field) => !vistas.has(field.label) ? (vistas.add(field.label), false) : true)
        .map((field) => `${group.id} · «${field.label}» (${field.key})`);
    });
    expect(repetidas).toEqual([]);
  });

  it('no repite el nombre de la seccion en la etiqueta del grupo', () => {
    // En el panel la seccion ya se lee dos veces —la pestana activa y la linea
    // «Seccion: X» del editor—, asi que un grupo llamado «Home - Encabezado»
    // la dice tres. La lista de grupos es estrecha y trunca por la derecha, de
    // modo que el prefijo repetido se come el unico texto que distingue una
    // fila de la siguiente.
    const redundantes = WEB_TEXT_GROUPS
      .filter((group) => group.label.startsWith(`${group.section} - `))
      .map((group) => `${group.id}: «${group.label}»`);
    expect(redundantes).toEqual([]);
  });

  it('cada página del menú del CMS declara su encabezado de área', () => {
    for (const seccion of WEB_TEXT_SECTIONS) {
      expect(seccion.area.trim().length).withContext(seccion.section).toBeGreaterThan(0);
    }
  });

  it('las direcciones de las redes y del pie son claves del registro, y las de fábrica son las de la lista institucional', () => {
    const esperadas = {
      red_youtube_url: 'https://www.youtube.com/@MinCulturasCol',
      red_instagram_url: 'https://www.instagram.com/minculturascol',
      red_facebook_url: 'https://www.facebook.com/MinCulturasCol',
      red_x_url: 'https://x.com/MinCulturasCol',
    };
    for (const [clave, direccion] of Object.entries(esperadas)) {
      expect(DEFAULT_TEXTS[clave]).withContext(clave).toBe(direccion);
    }
    const claves = WEB_TEXT_GROUPS.find((g) => g.id === 'footer_enlaces')!.fields.map((f) => f.key);
    expect(claves.filter((k) => k.endsWith('_url')).length).toBe(13);
  });

  it('cada directorio con prefijo del CMS declara las trece claves que el directorio compartido lee', () => {
    const sufijos = ['title', 'subtitle', 'list_heading', 'search_label', 'search_placeholder', 'filters_title', 'map_label',
      'filters_help', 'loading', 'empty_total_title', 'empty_total_text', 'empty_query_title', 'empty_query_text'];
    for (const prefijo of ['dir_mercados', 'dir_luteria', 'dir_espacios', 'dir_redes']) {
      for (const sufijo of sufijos) {
        expect(DEFAULT_TEXTS[`${prefijo}_${sufijo}`]).withContext(`${prefijo}_${sufijo}`).toBeDefined();
      }
    }
  });

  it('el grupo de respaldo del recorrido anterior ya no existe', () => {
    expect(WEB_TEXT_GROUPS.some((g) => g.id === 'map_tutorial')).toBeFalse();
    expect(DEFAULT_TEXTS['map_explorar_capas']).toBeUndefined();
  });
});
