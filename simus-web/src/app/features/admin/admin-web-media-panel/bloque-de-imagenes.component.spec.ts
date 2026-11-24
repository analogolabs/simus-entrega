import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BloqueDeImagenesComponent, ImagenEnVivo } from './bloque-de-imagenes.component';
import {
  AdminImage,
  AdminImageGroup,
  ApiOutcome,
  ContenidoWebApiService,
} from '../../../core/services/contenido-web-api.service';
import { DEFAULT_IMAGE_URLS, WEB_IMAGE_KEYS } from '../../../core/cms/registro-de-imagenes-web';

/*
  LAS IMÁGENES DENTRO DEL BLOQUE DE TEXTO QUE LAS ACOMPAÑA.

  Lo que estas pruebas defienden es lo que separa este editor del panel de imágenes aparte:

   · la tarjeta enseña LO QUE EL VISITANTE VE HOY, incluso cuando no hay nada publicado;
   · el marco al que se recorta sale del registro del front, que es donde se midió;
   · publicar y subir NO son lo mismo para la previsualización, y el componente lo dice;
   · una ranura de marca institucional no ofrece reemplazo.
*/
describe('BloqueDeImagenesComponent · editar la imagen donde está su texto', () => {
  let fixture: ComponentFixture<BloqueDeImagenesComponent>;
  let componente: BloqueDeImagenesComponent;
  let api: ApiDoble;

  // Tres ranuras de un mismo grupo, con imagen de fábrica remota. Eran las cuatro portadas
  // rotatorias del Home, retiradas con el rediseño de la portada (5 oct 2026).
  const PORTADAS = ['about_hito_1', 'about_hito_2', 'about_hito_3'];

  function ranura(clave: string, extra: Partial<AdminImage> = {}): AdminImage {
    const registro = WEB_IMAGE_KEYS.find(x => x.key === clave)!;
    return {
      key: clave,
      label: registro.label,
      use: registro.use,
      editable: registro.editable,
      alt: registro.alt,
      suggestedWidth: registro.suggestedWidth,
      suggestedHeight: registro.suggestedHeight,
      draft: null,
      published: null,
      state: 'no_publicado',
      version: 1,
      updatedBy: 'Sistema',
      updatedAt: '2026-08-30T00:00:00Z',
      ...extra,
    };
  }

  class ApiDoble {
    imagenes: AdminImage[] = PORTADAS.map(clave => ranura(clave));
    gruposPedidos: string[] = [];
    publicadas: string[] = [];
    retiradas: string[] = [];
    subidas: { key: string; bytes: number }[] = [];

    async getImageGroup(groupId: string): Promise<ApiOutcome<AdminImageGroup>> {
      this.gruposPedidos.push(groupId);
      return {
        ok: true,
        data: {
          groupId,
          groupLabel: 'Portadas rotatorias del Home',
          section: 'PNMC',
          images: this.imagenes,
          limits: {
            maxBytes: 2 * 1024 * 1024,
            maxThumbnailBytes: 24 * 1024,
            maxAltLength: 300,
            maxDimension: 12_000,
            allowedTypes: ['image/webp', 'image/png', 'image/jpeg'],
          },
        },
      };
    }

    async uploadImage(key: string, archivo: File) {
      this.subidas.push({ key, bytes: archivo.size });
      return { ok: true, data: { key, state: 'no_publicado', version: 2, changed: true, hash: 'aa', mime: 'image/webp', width: 10, height: 10, bytes: archivo.size } };
    }

    async publishImage(key: string) {
      this.publicadas.push(key);
      return { ok: true, data: { key, state: 'publicado', version: 3, changed: true, hash: 'aa', mime: 'image/webp', width: 10, height: 10, bytes: 1 } };
    }

    async republishImage(key: string) { return this.publishImage(key); }

    async retireImage(key: string) {
      this.retiradas.push(key);
      return { ok: true, data: { key, state: 'retirado', version: 4, changed: true, hash: null, mime: null, width: null, height: null, bytes: null } };
    }

    async getImageHistory() { return { ok: true, data: { key: 'x', entries: [] } }; }

    imagePreviewUrl(key: string, estado: string, version: number, miniatura = true): string {
      return `/api/v1/admin/imagenes-web/${key}/preview/${estado}?miniatura=${miniatura}&v=${version}`;
    }
  }

  async function montar(claves = PORTADAS, puedePublicar = true): Promise<void> {
    api = new ApiDoble();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BloqueDeImagenesComponent],
      providers: [{ provide: ContenidoWebApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(BloqueDeImagenesComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('claves', claves);
    fixture.componentRef.setInput('enabled', true);
    fixture.componentRef.setInput('puedePublicar', puedePublicar);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('pide UNA vez el grupo aunque el bloque tenga tres ranuras', async () => {
    // Las tres imágenes de eje viven en `ejes_media`. Una petición por tarjeta serían tres
    // respuestas idénticas y dos desperdiciadas cada vez que se abre el bloque.
    await montar();
    expect(api.gruposPedidos).toEqual(['about_hitos']);
    expect(componente.ranuras().length).toBe(3);
  });

  it('sin nada publicado enseña la imagen que el sitio pinta hoy, aligerada', async () => {
    // Hasta aquí había un recuadro gris con la frase «el sitio muestra
    // su imagen original», que obliga a abrir el sitio en otra pestaña para saber cuál es.
    await montar();
    const url = componente.urlEnElSitio(componente.ranuras()[0]);

    // La foto de fábrica del hito es un archivo del proyecto: se enseña tal cual, sin pedir nada a otro sitio.
    expect(DEFAULT_IMAGE_URLS['about_hito_1']).toContain('/assets/pnmc/hito-1.webp');
    expect(url).toContain('/assets/pnmc/hito-1.webp');
  });

  it('con algo publicado enseña lo publicado, no la de fábrica', async () => {
    await montar();
    api.imagenes = [ranura('about_hito_1', {
      state: 'publicado',
      published: { mime: 'image/webp', bytes: 40_000, width: 1670, height: 1044, hash: 'abc' },
      version: 7,
    })];
    await componente.recargar();

    expect(componente.urlEnElSitio(componente.ranuras()[0]))
      .toBe('/api/v1/admin/imagenes-web/about_hito_1/preview/publicado?miniatura=true&v=7');
  });

  it('el marco sale del registro del front, no de lo que responda el servidor', async () => {
    // El servidor guarda una copia de las medidas y se refresca al arrancar, así que puede ir
    // por detrás: la base tenía 1600×900 para esta ranura mientras el
    // registro ya decía 1670×1044. Recortar a la copia vieja recorta al marco equivocado.
    await montar();
    api.imagenes = [ranura('about_hito_1', { suggestedWidth: 1600, suggestedHeight: 900 })];
    await componente.recargar();

    expect(componente.marcoDe('about_hito_1')).toEqual({ w: 700, h: 398 });
  });

  it('hoy ninguna ranura rota: cada una tiene su foto', async () => {
    // Las únicas que rotaban eran las cuatro portadas del Home, retiradas el 5 de octubre de
    // 2026. Las celdas de la cuadrícula comparten tratamiento y NO rotan: espejar enseñaría en
    // las cinco una foto que el sitio solo pinta en una.
    const CELDAS = ['home_ruta_1', 'home_ruta_2', 'home_ruta_3', 'home_ruta_4', 'home_ruta_5'];
    await montar(CELDAS);
    for (const clave of CELDAS) {
      expect(componente.rotanCon(clave)).withContext(clave).toEqual([]);
    }
    await montar();
    expect(componente.rotanCon('about_hito_1')).toEqual([]);
  });

  it('la previsualización se pinta con el filtro y el fondo del sitio', async () => {
    // La tarjeta de hito va con `brightness(0.95) grayscale(0.4)` al 22 %. Pintarla a todo color
    // aquí haría elegir bien una imagen que en el sitio se ve de otra manera.
    await montar();
    const img = raiz().querySelector<HTMLImageElement>('[data-testid="ranura-about_hito_1"] img')!;
    expect(img.style.filter).toBe('brightness(0.95) grayscale(0.4)');
    expect(Number(img.style.opacity)).toBeCloseTo(0.22, 2);
  });

  it('una ranura de marca institucional no ofrece reemplazo', async () => {
    await montar(['marca_gov_co']);
    api.imagenes = [ranura('marca_gov_co')];
    await componente.recargar();

    expect(componente.ranuras()[0].editable).toBeFalse();
    expect(raiz().querySelector('[data-testid="cambiar-marca_gov_co"]')).toBeNull();
  });

  it('sin permiso para publicar no se pinta ni desplegar ni retirar', async () => {
    await montar(PORTADAS, false);
    api.imagenes = [ranura('about_hito_1', {
      state: 'publicado',
      draft: { mime: 'image/webp', bytes: 10, width: 1, height: 1, hash: 'nueva' },
      published: { mime: 'image/webp', bytes: 10, width: 1, height: 1, hash: 'vieja' },
    })];
    await componente.recargar();

    expect(componente.hayBorradorSinPublicar(componente.ranuras()[0])).toBeTrue();
    expect(raiz().querySelector('[data-testid="desplegar-about_hito_1"]')).toBeNull();
    expect(raiz().querySelector('[data-testid="retirar-about_hito_1"]')).toBeNull();
  });

  it('publicar y retirar piden recargar el marco; cargar la pantalla no', async () => {
    await montar();
    const anuncios: ImagenEnVivo[] = [];
    componente.enVivo.subscribe(e => anuncios.push(e));

    await componente.desplegar(componente.ranuras()[0]);
    await componente.retirar(componente.ranuras()[0]);

    expect(api.publicadas).toEqual(['about_hito_1']);
    expect(api.retiradas).toEqual(['about_hito_1']);

    // Publicar y retirar cambian el manifiesto y piden recarga; los anuncios que dispara volver
    // a leer el grupo, no.
    const conRecarga = anuncios.filter(a => a.recargarElSitio);
    expect(conRecarga.length).toBe(2);
    // Y no espejan sobre nadie: ninguna ranura rota hoy.
    expect(conRecarga[0].rotanConElla).toEqual([]);
  });

  it('al cargar anuncia lo que ya había sin publicar, y sin espejarlo', async () => {
    // Un borrador subido en otra sesión existe antes de que esta pantalla se abra. Sin este
    // anuncio, la previsualización pintaba lo publicado mientras la tarjeta de al lado enseñaba
    // otra imagen bajo el rótulo «sin publicar».
    //
    // SIN ESPEJAR, y es la mitad que importa: fijar una portada sobre las cuatro que rotan sirve
    // para poder mirar la que se está cambiando. Al cargar no se está cambiando ninguna, y
    // espejar aquí haría que el sitio se viera con una portada que no es la que le toca.
    await montar();
    api.imagenes = PORTADAS.map(clave => ranura(clave, clave === 'about_hito_2'
      ? { draft: { mime: 'image/webp', bytes: 10, width: 1, height: 1, hash: 'nueva' }, version: 5 }
      : {}));

    const anuncios: ImagenEnVivo[] = [];
    componente.enVivo.subscribe(e => anuncios.push(e));
    await componente.recargar();

    expect(anuncios.map(a => a.clave)).toEqual(PORTADAS);
    expect(anuncios.every(a => a.rotanConElla.length === 0)).toBeTrue();
    expect(anuncios.every(a => !a.recargarElSitio)).toBeTrue();
    expect(anuncios.filter(a => a.url !== null).map(a => a.clave)).toEqual(['about_hito_2']);
  });

  it('al marco le manda el archivo entero, no la miniatura de la tarjeta', async () => {
    // La miniatura mide 320 px de ancho. El marco la estiraría a 1440 como fondo de portada, y
    // la persona juzgaría la nitidez de una imagen que el sitio nunca va a servir así.
    await montar();
    api.imagenes = [ranura('about_hito_1', {
      draft: { mime: 'image/webp', bytes: 10, width: 2400, height: 1500, hash: 'nueva' },
      version: 5,
    })];
    await componente.recargar();

    const imagen = componente.ranuras()[0];
    expect(componente.urlSinPublicar(imagen)).toContain('miniatura=true');
    expect(componente.urlParaElMarco(imagen)).toContain('miniatura=false');
  });

  it('un archivo más pesado que el tope se rechaza antes de decodificarlo', async () => {
    await montar();
    const enorme = new File([new Uint8Array(3 * 1024 * 1024)], 'grande.png', { type: 'image/png' });
    const entrada = { target: { files: [enorme], value: 'x' } } as unknown as Event;

    componente.elegirArchivo(componente.ranuras()[0], entrada);
    fixture.detectChanges();

    expect(componente.ajustando())
      .withContext('se abrió el recortador con un archivo que el servidor va a rechazar')
      .toBeNull();
    expect(componente.aviso()?.tipo).toBe('error');
    expect(componente.aviso()?.texto).toContain('3.0 MB');
  });

  it('un archivo que cabe abre el ajuste y no sube nada todavía', async () => {
    // Subir es lo que hace «Usar esta imagen». Elegir el archivo solo abre el marco.
    await montar();
    const cabe = new File([new Uint8Array(1024)], 'ok.png', { type: 'image/png' });
    componente.elegirArchivo(
      componente.ranuras()[0],
      { target: { files: [cabe], value: 'x' } } as unknown as Event,
    );

    expect(componente.ajustando()?.clave).toBe('about_hito_1');
    expect(api.subidas).toEqual([]);
  });
});
