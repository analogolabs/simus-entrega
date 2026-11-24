/**
 * Registro unico de las imagenes administrables del sitio publico.
 *
 * Gemelo de registro-de-textos-web.ts y con su misma disciplina: datos puros, sin
 * importar Angular y sin tocar almacenamiento, para que el exportador pueda
 * evaluarlo y sembrar la tabla dbo.MediosWeb desde aqui.
 *
 * UNA FILA POR RANURA, NO POR ARCHIVO. Los tres heroes comparten hoy la misma
 * URL de unsplash y aun asi llevan claves distintas: son decisiones editoriales
 * distintas, y quien cambie la portada de Ejes no quiere cambiar la de
 * Ecosistema. Son 16 ranuras sobre 10 archivos.
 *
 * `defaultUrl` es EXACTAMENTE lo que la plantilla tiene escrito hoy. Ese es el
 * mecanismo por el que el sitio se ve igual el dia que esto entre: mientras no
 * haya nada publicado en el CMS, `getWebImage` devuelve esta URL.
 *
 * LO QUE NO ENTRA, y no es un olvido:
 *  - La consola de administracion (admin-login.component.html) y las etiquetas
 *    Open Graph de index.html usan los mismos ficheros de marca, pero no son el
 *    sitio publico. Si entraran, el logotipo de la pantalla de inicio de sesion
 *    dependeria de lo que alguien publique.
 *  - NEWS_GALLERY_IMAGES: son las fotos de noticias y agenda, y las elige EL DATO
 *    —`buildNewsItemFromRecord` reparte por el id del registro—, no un editor.
 *
 * LO QUE SI ENTRO, y aqui estaba escrito lo contrario hasta. Este
 * comentario decia que las listas de `/Galeria/` eran «material de galeria, no ranuras de
 * diseno». El usuario lo revoco el 29 de agosto con un dato: una de ellas pintaba un archivo
 * de 725 KB y 1369x2048 dentro de un hueco apaisado de 438x318. Son decisiones editoriales de
 * portada elegidas a mano con un indice fijo, no galeria. Las dieciocho entraron el 30 de
 * agosto: la foto de «Huella y evolucion», las ocho tarjetas de Rutas, las tres diapositivas
 * del banner y las seis tarjetas del Ecosistema.
 */

export type UsoDeImagenWeb = 'fondo' | 'logotipo';

export interface DefinicionDeCampoDeImagen {
  key: string;
  label: string;
  /** fondo se recorta con object-cover; logotipo se encaja con object-contain. */
  use: UsoDeImagenWeb;
  /**
   * Falso para la marca institucional ajena. Que el panel deje reemplazar el
   * escudo nacional no es una funcion. La base lo impone ademas por CHECK
   * (CK_MediosWeb_NoEditableSinBytes), asi que no depende de que el API se
   * acuerde de comprobarlo.
   */
  editable: boolean;
  /** Texto alternativo de partida. El panel lo puede cambiar. */
  alt: string;
  /**
   * EL MARCO REAL, medido con el navegador sobre el sitio a 1440 px, no una medida deseable.
   *
   * Deja de ser «una guia para quien sube»: es el rectangulo al que el recortador ajusta la
   * imagen, asi que un numero mal puesto recorta al marco equivocado. Ocho de las catorce ranuras
   * lo tenian mal —las tres portadas de pagina declaraban 1600x900,
   * relacion 1,78, para un hueco cuya relacion real va de 4,00 a 4,44— y por eso este comentario
   * dice ahora de donde sale el numero.
   */
  suggestedWidth: number;
  suggestedHeight: number;
  /** Lo que el sitio muestra mientras no haya nada publicado en el CMS. */
  defaultUrl: string;
}

export interface DefinicionDeGrupoDeImagenes {
  id: string;
  label: string;
  section: string;
  images: DefinicionDeCampoDeImagen[];
}

const image = (
  key: string,
  label: string,
  use: UsoDeImagenWeb,
  editable: boolean,
  alt: string,
  suggestedWidth: number,
  suggestedHeight: number,
  defaultUrl: string,
): DefinicionDeCampoDeImagen => ({ key, label, use, editable, alt, suggestedWidth, suggestedHeight, defaultUrl });

/*
  Las fotos de `/Galeria/Congreso Nacional de Musica/` que la portada usa hoy se declaran
  directamente en cada ranura. No se importan porque `tools/export-content-catalog.mjs` evalua
  este trozo de fichero suelto: un `import` lo rompe.

  CINCO SE REPITEN entre bloques —el banner 2 y «Mercados» comparten la [1]; el banner 3 y
  «Mesas» la [3]; «Congreso» y «Escuelas» la [6]; «Tempos» y «Festivales» la [8]; «Voces» y
  «Redes» la [10]—. Cada ranura lleva clave propia igual: quien cambie el fondo del banner no
  quiere cambiar de paso una tarjeta del carrusel.
*/

export const WEB_IMAGE_GROUPS: DefinicionDeGrupoDeImagenes[] = [
  // «home_identidad» (la foto de «Qué es SIMUS», antes «Huella y evolución») se retiró el 5 de
  // octubre de 2026: la sección pasó a mostrar las grandes zonas de SIMUS en lugar de la foto.
  // REDISEÑO DE LA PORTADA (5 oct 2026). Se retiraron las cuatro portadas rotatorias del Home
  // (`home_hero_*`: el encabezado ya no lleva foto), los fondos del banner deslizante
  // (`home_banner_*`), las seis fotos de procesos (`home_eco_*`) y las Rutas 6 a 8: la portada pasó
  // de un carrusel de ocho tarjetas a una cuadrícula de cinco celdas.
  {
    id: 'home_rutas',
    label: 'Fotos de «Explora SIMUS»',
    section: 'Portada',
    images: [
      // home-strategies-section.component.ts arma `home_ruta_${posición}` en el orden de
      // TARJETAS_DE_SIMUS. La celda 1 es la grande (dos columnas por dos filas).
      image('home_ruta_1', 'Puerta principal · Ecosistema musical', 'fondo', true, 'Público en un auditorio', 640, 400, '/assets/home/banner-1.webp'),
      image('home_ruta_2', 'Conocimiento', 'fondo', true, 'Portadas del catálogo editorial', 400, 225, '/assets/home/editorial.webp'),
      image('home_ruta_3', 'Historias', 'fondo', true, 'Danza en la calle durante un encuentro musical', 400, 225, '/assets/home/galeria.webp'),
      image('home_ruta_4', 'Agenda', 'fondo', true, 'Concierto en vivo', 400, 225, '/assets/home/ruta-5.webp'),
      image('home_ruta_5', 'PNMC', 'fondo', true, 'Mesa de participación del PNMC', 400, 225, '/assets/home/ruta-8.webp'),
    ],
  },
  /*
    LAS TRES PORTADAS DE PAGINA, UNA POR SECCION.

    Hasta eran un solo grupo, `page_heroes`, declarado entero en la
    seccion «Sobre PNMC». Con el panel de imagenes aparte daba igual —era una lista—, pero al
    editarse dentro del bloque de texto que las acompana, la portada de /ejes se cambiaba desde
    la pestana de Sobre PNMC. La seccion de una ranura tiene que ser la de la pagina donde se ve.

    El sembrador refresca `GroupId`, `GroupLabel` y `Section` de las filas que ya existen
    (MediosWebSeeder.cs), asi que partir el grupo no pierde ninguna imagen publicada.
  */
  {
    id: 'about_hitos',
    label: 'Fotos de los cinco hitos',
    section: 'PNMC',
    images: [
      /*
        LAS ONCE ULTIMAS RANURAS DE LAS 45 MEDIDAS EL 29 DE AGOSTO DE 2026 — cinco aqui y seis en
        el marco normativo. Salian de `IMAGENES_DE_GALERIA` con el indice a mano en
        `sobre-el-pnmc-page.component.ts` y `:70`: [11..15] y [16, 17, 18, 0, 1, 3].

        EL MARCO ES EL DE LA TARJETA ABIERTA. Medido con el navegador en 1280, 1440, 1600 y 1920:
        700x398 siempre, porque la fila satura en su contenedor. Plegada mide 117x398, relacion
        0,29, y por eso estas ranuras son de `dos-marcos`: el recortador ensena las dos.
      */
      image('about_hito_1', 'Hito 1 · 2003-2006', 'fondo', true, 'Creacion e institucionalizacion del PNMC', 700, 398, '/assets/pnmc/hito-1.webp'),
      image('about_hito_2', 'Hito 2 · 2007-2014', 'fondo', true, 'Territorializacion y saberes', 700, 398, '/assets/pnmc/hito-2.webp'),
      image('about_hito_3', 'Hito 3 · 2015-2018', 'fondo', true, 'Profesionalizacion y SIMUS', 700, 398, '/assets/pnmc/hito-3.webp'),
      image('about_hito_4', 'Hito 4 · 2018-2022', 'fondo', true, 'Evaluacion y consolidacion', 700, 398, '/assets/pnmc/hito-4.webp'),
      image('about_hito_5', 'Hito 5 · 2023-2025', 'fondo', true, 'Actualizacion y proyeccion 2035', 700, 398, '/assets/pnmc/hito-5.webp'),
    ],
  },
  {
    id: 'about_normas',
    label: 'Fotos del marco normativo',
    section: 'PNMC',
    images: [
      // Seis tarjetas en la misma fila que los cinco hitos, asi que la abierta mide menos:
      // 629x398 medido, y la plegada 105x398 (relacion 0,26).
      image('about_norma_1', 'Norma 1 · Ley 397 de 1997', 'fondo', true, 'Ley General de Cultura', 629, 398, '/assets/pnmc/norma-1.webp'),
      image('about_norma_2', 'Norma 2 · CONPES 3409 de 2006', 'fondo', true, 'CONPES 3409', 629, 398, '/assets/pnmc/norma-2.webp'),
      image('about_norma_3', 'Norma 3 · Ley 1493 de 2011', 'fondo', true, 'Ley de Espectaculos Publicos', 629, 398, '/assets/pnmc/norma-3.webp'),
      image('about_norma_4', 'Norma 4 · Decreto 2120 de 2018', 'fondo', true, 'Decreto 2120 de 2018', 629, 398, '/assets/pnmc/norma-4.webp'),
      image('about_norma_5', 'Norma 5 · Plan Nacional de Cultura', 'fondo', true, 'Plan Nacional de Cultura 2024-2038', 629, 398, '/assets/pnmc/norma-5.webp'),
      image('about_norma_6', 'Norma 6 · Ley 2555 de 2025', 'fondo', true, 'Ley 2555 de 2025', 629, 398, '/assets/pnmc/norma-6.webp'),
    ],
  },
  {
    id: 'estrategias_media',
    label: 'Imágenes de las estrategias',
    section: 'PNMC',
    images: [
      // resolve-strategy.ts y :72.
      image('estrategia_celebra_media', 'Foto de la estrategia «Celebra la Música»', 'fondo', true, 'Escenario de un concierto de Celebra la Música', 1240, 608, '/assets/pnmc/estrategia-ruta-3.webp'),
      image('estrategia_territorios_media', 'Foto de la estrategia «Territorios Sonoros»', 'fondo', true, 'Músicos en un territorio sonoro de Colombia', 1240, 608, '/assets/pnmc/estrategia-ruta-1.webp'),
    ],
  },
  {
    id: 'pnmc_documento',
    label: 'Portada del documento del Plan',
    section: 'PNMC',
    images: [
      image('pnmc_documento_portada', 'Portada del documento «PNMC 2025–2035»', 'fondo', true, 'Portada del documento Plan Nacional de Música para la Convivencia 2025-2035', 256, 292, '/assets/pnmc/portada-pnmc-2025-2035.webp'),
    ],
  },
  {
    id: 'noticias_respaldo',
    label: 'Fotos de respaldo de las noticias',
    section: 'Noticias',
    images: [
      // Salen cuando una noticia no trae su propia portada. La noticia elige una por su identidad, no por su posición.
      image('noticia_respaldo_1', 'Foto de respaldo 1', 'fondo', true, 'Fotografía de actividades musicales del PNMC', 720, 540, '/assets/home/noticia-1.webp'),
      image('noticia_respaldo_2', 'Foto de respaldo 2', 'fondo', true, 'Fotografía de actividades musicales del PNMC', 720, 540, '/assets/home/noticia-2.webp'),
      image('noticia_respaldo_3', 'Foto de respaldo 3', 'fondo', true, 'Fotografía de actividades musicales del PNMC', 720, 540, '/assets/home/noticia-3.webp'),
    ],
  },
  {
    id: 'marca_simus',
    label: 'Logotipo de SIMUS',
    section: 'Portada',
    images: [
      // El logotipo blanco sobre morado: encabezado de la portada. Es la marca editable del propio SIMUS.
      image('marca_simus_blanco', 'Logotipo de SIMUS (fondo oscuro)', 'logotipo', true, 'SIMUS', 380, 135, '/assets/branding/logo-simus-blanco.svg'),
    ],
  },
  {
    id: 'marca',
    label: 'Identidad institucional del pie',
    section: 'Barra y pie',
    images: [
      // LAS DOS SIGUIENTES NO SON EDITABLES. Son marca institucional ajena: GOV.CO y el sello de Colombia.
      // Se declaran para que estén inventariadas (salen en el pie y en la pantalla de registro) y para que nadie
      // las busque, no para que se puedan reemplazar.
      image('marca_gov_co', 'Marca GOV.CO', 'logotipo', false, 'GOV.CO', 200, 40, '/assets/branding/logo-gov-co.png'),
      image('marca_gov_co_sello', 'Sello de Colombia', 'logotipo', false, 'Colombia', 71, 70, '/assets/branding/gov-co-footer.png'),
    ],
  },
  {
    id: 'marca_ministerio',
    label: 'Marca del Ministerio',
    section: 'Registro',
    images: [
      image('marca_culturas_blanco', 'Marca del Ministerio de las Culturas', 'logotipo', false, 'Ministerio de las Culturas, las Artes y los Saberes', 56, 43, '/assets/branding/Culturas-Blanco.png'),
    ],
  },
];

/** Todas las claves aplanadas, con la seccion y el grupo de su bloque. */
export const WEB_IMAGE_KEYS = WEB_IMAGE_GROUPS.flatMap((grupo) =>
  grupo.images.map((imagen) => ({
    ...imagen,
    groupId: grupo.id,
    groupLabel: grupo.label,
    section: grupo.section,
  })),
);

/** La URL compilada de una clave, o cadena vacia si la clave no existe. */
export const DEFAULT_IMAGE_URLS: Record<string, string> = Object.fromEntries(
  WEB_IMAGE_KEYS.map((imagen) => [imagen.key, imagen.defaultUrl]),
);

/** El texto alternativo de partida de cada clave. */
export const DEFAULT_IMAGE_ALTS: Record<string, string> = Object.fromEntries(
  WEB_IMAGE_KEYS.map((imagen) => [imagen.key, imagen.alt]),
);

/**
 * COMO PINTA EL SITIO CADA RANURA. Es lo que el recortador tiene que reproducir.
 *
 * NO ES DECORACION DEL PANEL. La portada del Home sale con `grayscale(1)` al 30 % sobre un
 * fondo `#291242`: una foto elegida a todo color se ve en el sitio como otra cosa. Los diez
 * tratamientos del sitio se midieron con el navegador el 29 y y
 * ninguno es neutro.
 *
 * VA DESPUES DE `WEB_IMAGE_KEYS` A PROPOSITO. `tools/export-content-catalog.mjs` recorta este
 * fichero entre `const image =` y el comentario de `WEB_IMAGE_KEYS`, y evalua lo que hay en
 * medio. Todo lo que se declare aqui abajo queda fuera de ese `eval` y no puede romper la
 * siembra de la base.
 */
export interface PresentacionDeLaRanura {
  /**
   * fija: la relacion no cambia nunca. variable: cambia con la ventana del visitante.
   * dos-marcos: el bloque se pinta abierto y plegado. encaje: el archivo se ve entero.
   */
  clase: 'fija' | 'variable' | 'dos-marcos' | 'encaje';
  /** El filtro CSS con el que el sitio pinta la imagen. */
  filtro: string;
  opacidad: number;
  /** El color que hay DEBAJO. Con opacidad menor que 1, el resultado depende de el. */
  fondo: string;
  /** La segunda relacion, en las ranuras de dos marcos. */
  relacionPlegada?: number;
  /** Donde el sitio pinta texto encima, en porcentaje del marco. Medido, no estimado. */
  zonaDeTexto?: { x: number; y: number; w: number; h: number };
}

/**
 * Los otros cuatro tratamientos de la portada, medidos con el navegador
 * a 1280, 1440, 1600 y 1920 de ancho.
 *
 * El `fondo` es el color que queda DEBAJO de la imagen, subiendo por los ancestros hasta el
 * primero que pinte algo opaco. Importa donde la opacidad no es 1: las tarjetas del Ecosistema
 * van al 30 % sobre `#0f172b`, asi que una foto clara ahi se ve casi blanca y una oscura casi
 * desaparece. Sin el fondo, la previsualizacion enseñaria la foto tal cual y la persona
 * elegiria a ciegas.
 */
const TARJETA_DE_RUTA: PresentacionDeLaRanura = {
  // Puertas de «Explora SIMUS»: la foto ocupa la parte de arriba de la tarjeta, a color y sin
  // tinte (desde el 6 oct 2026), y el texto va en un pie blanco aparte.
  clase: 'variable',
  filtro: 'none',
  opacidad: 1,
  fondo: '#EEE9EF',
};

/**
 * Las tarjetas de Hitos y de Marco normativo de `/pnmc`: la unica familia de DOS MARCOS del
 * catalogo junto con las que ya lo eran.
 *
 * La fila se pinta con la tarjeta elegida en `flex-[6]` y las demas en `flex-1`, asi que cada
 * foto se ve en dos rectangulos muy distintos. Medido, y constante de 1280 a 1920 porque la fila
 * satura en su contenedor: hitos 700x398 abierta y 117x398 plegada; normas 629x398 y 105x398.
 *
 * El filtro es el mismo en los dos estados —`brightness(0.95) grayscale(0.4)`—, pero la opacidad
 * y el color de debajo NO: abierta va al 22 % sobre `#0f172a`, y plegada al 10 % sobre blanco con
 * un velo `#291242` al 30 % encima. Se declara la ABIERTA porque es la que alguien lee; la
 * plegada es un lomo de 117 px y ahi no se juzga una fotografia.
 */
const TARJETA_DE_HITO: PresentacionDeLaRanura = {
  clase: 'dos-marcos',
  filtro: 'brightness(0.95) grayscale(0.4)',
  opacidad: 0.22,
  fondo: '#0f172a',
  relacionPlegada: 0.29,
};

/** Igual que la anterior, con seis tarjetas en la fila en vez de cinco. */
const TARJETA_DE_NORMA: PresentacionDeLaRanura = {
  clase: 'dos-marcos',
  filtro: 'brightness(0.95) grayscale(0.4)',
  opacidad: 0.22,
  fondo: '#0f172a',
  relacionPlegada: 0.26,
};

/** La foto de cada estrategia en `/pnmc`: a color y sin filtro, bajo un velo morado que oscurece de abajo hacia arriba. */
const TARJETA_DE_ESTRATEGIA: PresentacionDeLaRanura = {
  clase: 'variable',
  filtro: 'none',
  opacidad: 1,
  fondo: '#4C2C54',
};

/** La portada del documento del Plan, a color y con su proporción propia (cartel vertical). */
const PORTADA_DE_DOCUMENTO: PresentacionDeLaRanura = {
  clase: 'fija',
  filtro: 'none',
  opacidad: 1,
  fondo: '#FFFFFF',
};

/** La foto de respaldo de una noticia, a color. */
const FOTO_DE_NOTICIA: PresentacionDeLaRanura = {
  clase: 'variable',
  filtro: 'none',
  opacidad: 1,
  fondo: '#EEE9EF',
};

/**
 * Los cuatro logotipos. Se pintan con `object-contain` —se ven enteros, no se recortan— y por eso
 * son de clase `encaje`. Medidos: el del PNMC en 103x64 sobre el menu translucido, GOV.CO en
 * 160x32, el sello en 68x67 y el del Ministerio en la pantalla de acceso a la consola.
 *
 * Fondo `#291242` porque los cuatro se pintan sobre el morado de marca: un logotipo con fondo
 * blanco opaco se ve como un recorte, y en el recortador tiene que verse igual que en el sitio.
 */
const LOGOTIPO_SOBRE_MORADO: PresentacionDeLaRanura = {
  clase: 'encaje',
  filtro: 'none',
  opacidad: 1,
  fondo: '#4C2C54',
};

export const PRESENTACION_DE_LA_RANURA: Record<string, PresentacionDeLaRanura> = {

  home_ruta_1: TARJETA_DE_RUTA,
  home_ruta_2: TARJETA_DE_RUTA,
  home_ruta_3: TARJETA_DE_RUTA,
  home_ruta_4: TARJETA_DE_RUTA,
  home_ruta_5: TARJETA_DE_RUTA,



  // --- Fuera del Home. Las veintitres entraron: hasta ese dia caian en
  // `PRESENTACION_NEUTRA` y el recortador ensenaba a todo color lo que el sitio pinta en gris al
  // 28 %. Todas medidas con el navegador, ninguna estimada.
  about_hito_1: TARJETA_DE_HITO,
  about_hito_2: TARJETA_DE_HITO,
  about_hito_3: TARJETA_DE_HITO,
  about_hito_4: TARJETA_DE_HITO,
  about_hito_5: TARJETA_DE_HITO,

  about_norma_1: TARJETA_DE_NORMA,
  about_norma_2: TARJETA_DE_NORMA,
  about_norma_3: TARJETA_DE_NORMA,
  about_norma_4: TARJETA_DE_NORMA,
  about_norma_5: TARJETA_DE_NORMA,
  about_norma_6: TARJETA_DE_NORMA,

  estrategia_celebra_media: TARJETA_DE_ESTRATEGIA,
  estrategia_territorios_media: TARJETA_DE_ESTRATEGIA,

  pnmc_documento_portada: PORTADA_DE_DOCUMENTO,
  noticia_respaldo_1: FOTO_DE_NOTICIA,
  noticia_respaldo_2: FOTO_DE_NOTICIA,
  noticia_respaldo_3: FOTO_DE_NOTICIA,

  marca_simus_blanco: LOGOTIPO_SOBRE_MORADO,
  marca_culturas_blanco: LOGOTIPO_SOBRE_MORADO,
  marca_gov_co: LOGOTIPO_SOBRE_MORADO,
  marca_gov_co_sello: LOGOTIPO_SOBRE_MORADO,
};

/** Lo que se usa cuando una ranura todavia no declara su tratamiento. */
export const PRESENTACION_NEUTRA: PresentacionDeLaRanura = {
  clase: 'fija',
  filtro: 'none',
  opacidad: 1,
  fondo: '#0f172a',
};

/**
 * QUE RANURAS ENSENA EL SITIO EN EL MISMO HUECO, ALTERNANDOSE.
 *
 * Se declara y no se deduce. Hasta `rotanCon` lo deducia comparando la
 * identidad del objeto de presentacion —`PRESENTACION_DE_LA_RANURA[a] === PRESENTACION_DE_LA_RANURA[b]`—
 * y eso daba la respuesta correcta solo por casualidad: las cuatro portadas comparten
 * `PORTADA_DEL_HOME` Y ADEMAS rotan, pero las ocho Rutas comparten `TARJETA_DE_RUTA` y NO rotan,
 * cada tarjeta tiene su foto. Subir la foto de la Ruta 3 la pintaba en las ocho tarjetas de la
 * previsualizacion: una imagen valida en siete sitios equivocados.
 *
 * El tratamiento dice COMO SE PINTA una ranura; esta lista dice CUANDO SE VE. Son dos preguntas
 * distintas y por eso son dos datos distintos.
 *
 * HAY UN SOLO GRUPO, y el banner no esta en el. Las tres diapositivas se turnan solas cada pocos
 * segundos, asi que la que se acaba de cambiar aparece sin espejar nada: espejarla taparia las
 * otras dos y haria imposible mirar el banner entero. La portada del Home si entra porque el
 * sorteo es UNA VEZ POR VISITA (home.component.ts): sin espejar, recargar el marco para ver la
 * portada 2 sale a cara o cruz.
 */
export const ROTAN_JUNTAS: readonly (readonly string[])[] = [
  // Vacía desde el 5 de octubre de 2026: las cuatro portadas rotatorias del Home se retiraron.
];

/** Las claves que se alternan con esta en el mismo hueco. Vacio cuando la ranura no rota. */
export function ranurasQueRotanCon(clave: string): readonly string[] {
  return ROTAN_JUNTAS.find(grupo => grupo.includes(clave)) ?? [];
}

/**
 * QUE RANURAS DE IMAGEN SE EDITAN DENTRO DE QUE BLOQUE DEL PANEL DE TEXTOS.
 *
 * La clave es el id de un grupo de `registro-de-textos-web.ts`; el valor, las claves de imagen que
 * se pintan en ese mismo trozo de pagina. Es una tabla explicita y no una regla derivada del
 * nombre por el mismo motivo que `ENCUADRES`: adivinar produce parejas plausibles que ponen el
 * editor de una imagen debajo de unos textos que no la acompanan.
 *
 * LAS 34 RANURAS ESTAN AQUI, y las cuatro de marca tambien: tres no son editables y aun asi se
 * pintan, porque una persona que abre «Navegacion y Footer» necesita ver el escudo que hay puesto
 * para entender por que no se puede cambiar. El editor no ofrece el boton; la fila existe.
 *
 * SI UNA RANURA NO APARECE AQUI, no hay forma de editarla desde el estudio. Hay una prueba que
 * compara esta tabla contra `WEB_IMAGE_KEYS` y falla nombrando la clave que se quedo fuera.
 */
export const IMAGENES_DEL_BLOQUE: Record<string, string[]> = {
  // --- Home
  home_strategies_cards: ['home_ruta_1', 'home_ruta_2', 'home_ruta_3', 'home_ruta_4', 'home_ruta_5'],

  // --- Sobre PNMC
  about_documento: ['pnmc_documento_portada'],
  about_timeline: ['about_hito_1', 'about_hito_2', 'about_hito_3', 'about_hito_4', 'about_hito_5'],
  about_normative: [
    'about_norma_1', 'about_norma_2', 'about_norma_3',
    'about_norma_4', 'about_norma_5', 'about_norma_6',
  ],

  // --- Estrategias
  strategy_celebra_details: ['estrategia_celebra_media'],
  strategy_territorios_details: ['estrategia_territorios_media'],

  // --- Ecosistema
  // --- Navegacion y Footer. La clave es el id del grupo de TEXTO, no el del grupo de imagen:
  // `marca` es como se llama el grupo en `WEB_IMAGE_GROUPS`, y ponerlo aqui habria dejado las
  // cuatro ranuras sin bloque sin que nada fallara.
  footer_enlaces: ['marca_gov_co', 'marca_gov_co_sello'],
  home_botones: ['marca_simus_blanco'],
  noticias_textos: ['noticia_respaldo_1', 'noticia_respaldo_2', 'noticia_respaldo_3'],
  access_external_portal: ['marca_culturas_blanco'],
};
