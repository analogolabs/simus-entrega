import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TextosWebService } from '../services/textos-web.service';
import { WEB_TEXT_KEYS_LIST } from './registro-de-textos-web';
import {
  DEFAULT_IMAGE_ALTS,
  DEFAULT_IMAGE_URLS,
  IMAGENES_DEL_BLOQUE,
  PRESENTACION_DE_LA_RANURA,
  WEB_IMAGE_GROUPS,
  WEB_IMAGE_KEYS,
} from './registro-de-imagenes-web';
import { WEB_TEXT_GROUPS } from './registro-de-textos-web';

/*
  LAS IMAGENES ADMINISTRABLES, del lado del sitio.

  La propiedad que sostiene todo lo demas: `getWebImage` NUNCA devuelve cadena
  vacia. Un <img src=""> no deja un hueco — hace que el navegador vuelva a pedir
  la URL de la pagina —, asi que un fallo aqui costaria una peticion extra por
  cada imagen del sitio y ninguna se veria.

  Los tres caminos que tienen que caer en la imagen compilada son distintos y
  cada uno tiene su caso: el manifiesto sin cargar (el arranque), la clave
  ausente (retirada o nunca publicada) y la clave desconocida.
*/
describe('registro de imágenes · lo que el sitio pinta', () => {
  let servicio: TextosWebService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(TextosWebService);
  });

  /** Mete un manifiesto en la señal privada sin pasar por la API. */
  function conManifiesto(imagenes: Record<string, unknown>): void {
    (servicio as unknown as { serverImages: { set: (v: unknown) => void } })
      .serverImages.set(imagenes);
  }

  it('el catálogo declara 26 ranuras y ninguna clave repetida', () => {
    // Ronda final del CMS (23 nov 2026): se retiraron las tres portadas de página (`hero_*`) y las tres fotos de
    // eje (`eje_0N_media`), que ninguna pantalla pinta, y el logotipo del PNMC (`marca_pnmc_blanco`), que nadie
    // leía. Entraron la portada del documento del Plan, las tres fotos de respaldo de las noticias, el logotipo
    // de SIMUS de la portada y la marca del Ministerio de la pantalla de registro; las dos estrategias pasaron
    // a declarar como fábrica la foto que la página muestra de verdad.
    expect(WEB_IMAGE_KEYS.length).toBe(26);
    expect(new Set(WEB_IMAGE_KEYS.map(i => i.key)).size).toBe(26);
    expect(WEB_IMAGE_GROUPS.length).toBe(9);
  });

  it('ninguna clave de imagen choca con una de texto', () => {
    // La puerta `cms:huerfanas` busca por SUBCADENA. Una clave que existiera en
    // los dos catálogos se daría por conectada gracias al lector del otro.
    const claves = new Set(WEB_TEXT_KEYS_LIST.map(k => k.key));
    const chocan = WEB_IMAGE_KEYS.filter(i => claves.has(i.key)).map(i => i.key);
    expect(chocan).toEqual([]);
  });

  it('las tres marcas institucionales ajenas inventariadas no son editables', () => {
    // Que el panel deje reemplazar el escudo nacional no es una función. La base
    // lo impone además por CHECK; esto vigila el otro extremo.
    const noEditables = WEB_IMAGE_KEYS.filter(i => !i.editable).map(i => i.key).sort();
    expect(noEditables).toEqual(['marca_culturas_blanco', 'marca_gov_co', 'marca_gov_co_sello']);

    // Y el logotipo de SIMUS sí lo es: es la marca propia.
    expect(WEB_IMAGE_KEYS.find(i => i.key === 'marca_simus_blanco')?.editable).toBeTrue();
  });

  it('durante el arranque todas devuelven su imagen compilada', () => {
    // El estado inicial: la aplicación pinta antes de que llegue la respuesta.
    for (const imagen of WEB_IMAGE_KEYS) {
      const url = servicio.getWebImage(imagen.key);
      expect(url)
        .withContext(`${imagen.key} quedó sin URL durante el arranque`)
        .toBe(imagen.defaultUrl);
      expect(url.length).toBeGreaterThan(0);
    }
  });

  it('una clave ausente del manifiesto vuelve a la imagen de fábrica', () => {
    // ES EL CASO DE «RETIRAR», y es la diferencia con los textos: retirar una
    // portada no deja la página sin portada, la devuelve a la compilada.
    conManifiesto({
      estrategia_celebra_media: { url: '/api/v1/imagenes-web/estrategia_celebra_media?v=3', alt: 'Foto publicada' },
    });

    expect(servicio.getWebImage('estrategia_celebra_media')).toBe('/api/v1/imagenes-web/estrategia_celebra_media?v=3');
    expect(servicio.getWebImage('estrategia_territorios_media')).toBe(DEFAULT_IMAGE_URLS['estrategia_territorios_media']);
    expect(servicio.getWebImage('estrategia_territorios_media').length).toBeGreaterThan(0);
  });

  it('una clave desconocida devuelve cadena vacía y no revienta', () => {
    // No hay imagen de fábrica que servir. Devolver vacío es lo correcto; lo que
    // no puede es lanzar y tumbar la página entera.
    conManifiesto({});
    expect(servicio.getWebImage('clave_que_no_existe')).toBe('');
  });

  it('el texto alternativo sale del CMS si está publicado y del registro si no', () => {
    conManifiesto({
      estrategia_celebra_media: { url: '/api/v1/imagenes-web/estrategia_celebra_media?v=3', alt: 'Lo que escribió la editora' },
      pnmc_documento_portada: { url: '/api/v1/imagenes-web/pnmc_documento_portada?v=1', alt: '' },
    });

    expect(servicio.getWebImageAlt('estrategia_celebra_media')).toBe('Lo que escribió la editora');

    // UN ALT VACIO CAE AL DEL REGISTRO, y aquí `||` es lo correcto justo al
    // revés que en los textos: una imagen sin texto alternativo es un fallo de
    // accesibilidad, y publicar en blanco no debe poder provocarlo.
    expect(servicio.getWebImageAlt('pnmc_documento_portada')).toBe(DEFAULT_IMAGE_ALTS['pnmc_documento_portada']);
    expect(servicio.getWebImageAlt('pnmc_documento_portada').length).toBeGreaterThan(0);

    // Y sin publicar, el del registro.
    expect(servicio.getWebImageAlt('estrategia_territorios_media')).toBe(DEFAULT_IMAGE_ALTS['estrategia_territorios_media']);
  });

  it('todas las ranuras declaran alto, ancho, uso y texto alternativo', () => {
    const incompletas = WEB_IMAGE_KEYS.filter(i =>
      !i.alt || !i.defaultUrl || !i.suggestedWidth || !i.suggestedHeight
      || (i.use !== 'fondo' && i.use !== 'logotipo'),
    ).map(i => i.key);

    // Sin `alt`, la ranura nace con un fallo de accesibilidad. Sin `defaultUrl`,
    // retirarla dejaría un `src` vacío.
    expect(incompletas).toEqual([]);
  });
});

/*
  LAS DOS TABLAS QUE ATAN LAS IMAGENES AL PANEL DE TEXTOS.

  `IMAGENES_DEL_BLOQUE` dice qué ranuras se editan dentro de qué bloque, y
  `PRESENTACION_DE_LA_RANURA` cómo las pinta el sitio. Las dos se escriben a mano, y una clave
  mal tecleada en cualquiera de las dos no rompe nada: produce una ranura que no aparece en
  ningún sitio, o un tratamiento que no se aplica a nadie. Sin estas pruebas, eso se descubre
  cuando alguien pregunta por qué no puede cambiar una imagen.
*/
describe('registro de imágenes · las tablas que lo atan al panel', () => {
  const clavesConocidas = new Set(WEB_IMAGE_KEYS.map((i) => i.key));
  const gruposDeTexto = new Set(WEB_TEXT_GROUPS.map((g) => g.id));

  it('cada bloque nombrado es un grupo de texto que existe', () => {
    for (const bloque of Object.keys(IMAGENES_DEL_BLOQUE)) {
      expect(gruposDeTexto.has(bloque))
        .withContext(`«${bloque}» no es un grupo del registro de textos`)
        .toBeTrue();
    }
  });

  it('cada ranura asignada a un bloque existe en el catálogo', () => {
    for (const [bloque, claves] of Object.entries(IMAGENES_DEL_BLOQUE)) {
      for (const clave of claves) {
        expect(clavesConocidas.has(clave))
          .withContext(`«${clave}», asignada a «${bloque}», no existe en el catálogo`)
          .toBeTrue();
      }
    }
  });

  it('ninguna ranura se edita en dos bloques a la vez', () => {
    // Dos bloques con la misma ranura serían dos editores del mismo archivo en la misma
    // pantalla, cada uno con su propia idea de qué hay guardado.
    const vistas = new Set<string>();
    for (const claves of Object.values(IMAGENES_DEL_BLOQUE)) {
      for (const clave of claves) {
        expect(vistas.has(clave)).withContext(`«${clave}» está en dos bloques`).toBeFalse();
        vistas.add(clave);
      }
    }
  });

  it('cada tratamiento declarado corresponde a una ranura real', () => {
    for (const clave of Object.keys(PRESENTACION_DE_LA_RANURA)) {
      expect(clavesConocidas.has(clave))
        .withContext(`«${clave}» tiene tratamiento pero no es una ranura`)
        .toBeTrue();
    }
  });

  it('las cinco puertas de la portada comparten tratamiento: foto a color, sin tinte', () => {
    // Comparten objeto, pero NO rotan: cada celda tiene su foto (ver `ROTAN_JUNTAS`).
    const celdas = ['home_ruta_1', 'home_ruta_2', 'home_ruta_3', 'home_ruta_4', 'home_ruta_5'];
    for (const clave of celdas) {
      expect(PRESENTACION_DE_LA_RANURA[clave]).toBe(PRESENTACION_DE_LA_RANURA['home_ruta_1']);
    }
    const p = PRESENTACION_DE_LA_RANURA['home_ruta_1'];
    expect(p.clase).toBe('variable');
    expect(p.filtro).toBe('none');
    expect(p.opacidad).toBe(1);
  });
});
