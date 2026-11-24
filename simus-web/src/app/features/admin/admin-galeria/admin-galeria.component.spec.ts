import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminGaleriaComponent } from './admin-galeria.component';
import { BancoDeArchivosService } from '../../../core/services/banco-de-archivos.service';
import { AlbumDeLaConsola, AlbumDeLaConsolaCompleto, AlbumParaGuardar, GaleriaAdminService } from '../../../core/services/galeria-admin.service';

/**
 * La sección «Galería» de la consola.
 *
 * <b>LO QUE FIJAN.</b> Que la lista muestra tipo, contenido y estado con rótulos legibles y se pagina con selector de cantidad; que buscar ignora
 * tildes y con filtros no se reordena; que publicar/destacar/ordenar/eliminar van al servidor con lo que dice la fila; que eliminar pide
 * confirmación y avisa de lo que se pierde; que un álbum nuevo toma su dirección del título, no se guarda con un texto alternativo vacío ni con
 * enlaces que no son de YouTube, y se envía completo; y que la vista previa refleja lo editado.
 */
describe('administración de la Galería', () => {
  let fixture: ComponentFixture<AdminGaleriaComponent>;
  let componente: AdminGaleriaComponent;
  let estados: { slug: string; cambio: { publicado?: boolean; destacado?: boolean } }[];
  let ordenes: string[][];
  let eliminados: string[];
  let guardados: { slug: string; album: AlbumParaGuardar }[];
  let respuestaDeCambio: 'ok' | 'error';

  const album = (n: number, extra: Partial<AlbumDeLaConsola> = {}): AlbumDeLaConsola => ({
    slug: `album-${n}`, titulo: `Álbum ${n}`, descripcion: null, tipo: 'fotos', lugar: null, fechaReferencia: `2026-0${(n % 9) + 1}-01`, portadaUrl: null,
    totalFotos: 3, totalVideos: 0, listaOrigenUrl: null, publicado: true, destacado: false, orden: n, ...extra,
  });
  const ALBUMES = [
    album(1, { titulo: 'Mesa Nacional de Rock', lugar: 'Medellín', destacado: true }),
    album(2, { titulo: 'Voces y Saberes', tipo: 'videos', totalFotos: 0, totalVideos: 4, publicado: false }),
    album(3, { titulo: 'Fotografía del festival', tipo: 'mixto', totalFotos: 2, totalVideos: 1 }),
  ];

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    estados = []; ordenes = []; eliminados = []; guardados = []; respuestaDeCambio = 'ok';
    const servicio: Partial<GaleriaAdminService> = {
      albumes: async () => ({ ok: true, data: ALBUMES }),
      cambiarEstado: (async (slug: string, cambio: { publicado?: boolean; destacado?: boolean }) => {
        estados.push({ slug, cambio });
        if (respuestaDeCambio === 'error') { return { ok: false, error: 'Un álbum sin ítems no se publica.' }; }
        return { ok: true, data: { ...ALBUMES.find(a => a.slug === slug)!, ...cambio } };
      }) as GaleriaAdminService['cambiarEstado'],
      ordenar: (async (slugs: string[]) => { ordenes.push(slugs); return { ok: true, data: slugs.map((s, i) => ({ ...ALBUMES.find(a => a.slug === s)!, orden: i + 1 })) }; }) as GaleriaAdminService['ordenar'],
      eliminar: (async (slug: string) => { eliminados.push(slug); return { ok: true }; }) as GaleriaAdminService['eliminar'],
      album: (async (slug: string) => ({
        ok: true,
        data: {
          ...ALBUMES.find(a => a.slug === slug)!, portadaArchivoId: null, fechaActualizacion: null,
          items: [{ id: 1, tipoItem: 'foto', orden: 1, titulo: null, descripcion: null, fecha: null, credito: 'Archivo', textoAlternativo: 'Una foto', archivoId: 7, url: '/api/v1/publico/archivos/7',
            videoId: null, urlYoutube: null, duracionSegundos: null, miniaturaArchivoId: null, publicado: true }],
        } as AlbumDeLaConsolaCompleto,
      })) as GaleriaAdminService['album'],
      guardar: (async (slug: string, a: AlbumParaGuardar) => {
        guardados.push({ slug, album: a });
        return { ok: true, data: { slug, titulo: a.titulo, descripcion: a.descripcion, tipo: a.tipo, lugar: a.lugar, fechaReferencia: a.fechaReferencia, portadaUrl: null, portadaArchivoId: null,
          listaOrigenUrl: a.listaOrigenUrl, orden: a.orden, publicado: a.publicado, fechaActualizacion: null, destacado: a.destacado, items: [] } as AlbumDeLaConsolaCompleto };
      }) as GaleriaAdminService['guardar'],
      sueltos: async () => ({ ok: true, data: [] }),
    };
    await TestBed.configureTestingModule({
      imports: [AdminGaleriaComponent],
      providers: [
        { provide: GaleriaAdminService, useValue: servicio },
        { provide: BancoDeArchivosService, useValue: { listar: async () => ({ ok: true, data: { items: [] } }) } },
      ],
    }).compileComponents();
  });

  async function abrir(): Promise<void> {
    fixture = TestBed.createComponent(AdminGaleriaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('lista los álbumes con su tipo, su contenido y su estado en palabras', async () => {
    await abrir();
    expect(componente.pestanas().map(p => p.conteo)).toEqual([3, undefined]);
    expect(texto()).toContain('Mesa Nacional de Rock');
    expect(texto()).toContain('Fotos y videos');
    expect(texto()).toContain('4 videos');
    expect(texto()).toContain('Borrador');
    expect(texto()).toContain('Destacado');
    expect(texto()).toContain('1 en el carrusel «Destacados»');
    expect(texto()).not.toMatch(/\bmixto\b/);
  });

  it('ofrece el selector de cuántos álbumes ver por página', async () => {
    await abrir();
    const paginacion = (fixture.nativeElement as HTMLElement).querySelector('app-paginacion-de-lista');
    expect(paginacion?.textContent).toContain('Álbumes por página');
    componente.cambiarPorPagina(25);
    expect(componente.porPagina()).toBe(25);
    expect(componente.pagina()).toBe(1);
  });

  it('buscar ignora tildes y mayúsculas, filtra por tipo y estado, y con filtros no se puede reordenar', async () => {
    await abrir();
    componente.buscar('FOTOGRAFIA');
    expect(componente.filtrados().map(a => a.slug)).toEqual(['album-3']);
    componente.limpiarFiltros();
    componente.cambiarFiltro('tipo', 'videos');
    expect(componente.filtrados().map(a => a.slug)).toEqual(['album-2']);
    componente.limpiarFiltros();
    componente.cambiarFiltro('estado', 'borradores');
    expect(componente.filtrados().map(a => a.slug)).toEqual(['album-2']);
    componente.cambiarFiltro('estado', 'destacados');
    expect(componente.filtrados().map(a => a.slug)).toEqual(['album-1']);
    fixture.detectChanges();
    expect(texto()).toContain('Con búsqueda o filtros no se puede reordenar');
    const flechas = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-album] button[aria-label^="Mover"]')];
    expect(flechas.length).toBeGreaterThan(0);
    expect(flechas.every(b => b.disabled)).toBeTrue();
  });

  it('publicar, despublicar y destacar mandan solo lo que cambia y actualizan la fila', async () => {
    await abrir();
    await componente.cambiarEstado(ALBUMES[1], { publicado: true }, 'Publicado.');
    expect(estados).toEqual([{ slug: 'album-2', cambio: { publicado: true } }]);
    expect(componente.albumes().find(a => a.slug === 'album-2')?.publicado).toBeTrue();
    expect(componente.aviso()).toBe('Publicado.');

    componente.ejecutarAccion(ALBUMES[0], 'quitar-destacado');
    await fixture.whenStable();
    expect(estados[1]).toEqual({ slug: 'album-1', cambio: { destacado: false } });
  });

  it('si el servidor rechaza el cambio (álbum sin ítems) se dice el motivo y la fila no cambia', async () => {
    await abrir();
    respuestaDeCambio = 'error';
    await componente.cambiarEstado(ALBUMES[1], { publicado: true }, 'Publicado.');
    expect(componente.error()).toBe('Un álbum sin ítems no se publica.');
    expect(componente.albumes().find(a => a.slug === 'album-2')?.publicado).toBeFalse();
  });

  it('las acciones se ofrecen según el estado: un borrador no se ve en el portal y un álbum sin ítems no se publica', async () => {
    await abrir();
    const borrador = componente.accionesDe(ALBUMES[1]);
    expect(borrador.find(a => a.id === 'ver')?.deshabilitada).toBeTrue();
    expect(borrador.find(a => a.id === 'publicar')).toBeTruthy();
    const vacio = componente.accionesDe(album(9, { publicado: false, totalFotos: 0, totalVideos: 0 }));
    expect(vacio.find(a => a.id === 'publicar')?.deshabilitada).toBeTrue();
    const publicado = componente.accionesDe(ALBUMES[0]);
    expect(publicado.find(a => a.id === 'ver')?.enlace).toBe('/galeria/album/album-1');
    expect(publicado.find(a => a.id === 'quitar-destacado')).toBeTruthy();
    expect(publicado.find(a => a.id === 'eliminar')?.tono).toBe('peligro');
  });

  it('mover manda el orden completo; el primero no sube', async () => {
    await abrir();
    await componente.mover(ALBUMES[2], -1);
    expect(ordenes).toEqual([['album-1', 'album-3', 'album-2']]);
    expect(componente.albumes().map(a => a.slug)).toEqual(['album-1', 'album-3', 'album-2']);
    await componente.mover(componente.albumes()[0], -1);
    expect(ordenes.length).toBe(1);
  });

  it('eliminar pide confirmación, dice lo que se pierde y solo entonces llama al servidor', async () => {
    await abrir();
    componente.ejecutarAccion(ALBUMES[0], 'eliminar');
    fixture.detectChanges();
    expect(eliminados).toEqual([]);
    expect(texto()).toContain('con sus 3 ítems');
    expect(texto()).toContain('siguen en el Banco de archivos');
    await componente.confirmarEliminar();
    expect(eliminados).toEqual(['album-1']);
    expect(componente.albumes().map(a => a.slug)).toEqual(['album-2', 'album-3']);
    expect(componente.aviso()).toContain('Sus fotos siguen en el Banco de archivos');
  });

  describe('editor', () => {
    it('un álbum nuevo toma su dirección del título y no se guarda incompleto', async () => {
      await abrir();
      componente.nuevo();
      fixture.detectChanges();
      componente.campo('titulo', 'Voces y Saberes · Edición 2026');
      expect(componente.modelo()?.slug).toBe('voces-y-saberes-edicion-2026');
      componente.escribirDireccion('mi-direccion');
      componente.campo('titulo', 'Otro título');
      expect(componente.modelo()?.slug).toBe('mi-direccion');

      componente.campo('tipo', 'videos');
      componente.cambiarItems([{ clave: 1, tipoItem: 'video', titulo: '', descripcion: '', detalle: '', fecha: '', credito: '', textoAlternativo: '', archivoId: null, imagenUrl: null,
        videoId: 'no-es-youtube', duracion: '', miniaturaArchivoId: null, publicado: true }]);
      await componente.guardar();
      expect(guardados).toEqual([]);
      expect(componente.errorDelEditor()).toContain('Corrige');
      expect(componente.problemas().some(p => p.includes('enlace de YouTube válido'))).toBeTrue();
    });

    it('guarda el álbum completo con su marca de destacado y vuelve del servidor como lo guardado', async () => {
      await abrir();
      await componente.abrir('album-1');
      fixture.detectChanges();
      expect(texto()).toContain('Vista previa en el portal');
      componente.campo('destacado', true);
      componente.campo('lugar', 'Medellín');
      await componente.guardar();
      expect(guardados.length).toBe(1);
      expect(guardados[0].slug).toBe('album-1');
      expect(guardados[0].album).toEqual(jasmine.objectContaining({ destacado: true, lugar: 'Medellín', tipo: 'fotos' }));
      expect(guardados[0].album.items[0]).toEqual(jasmine.objectContaining({ tipoItem: 'foto', archivoId: 7, textoAlternativo: 'Una foto', credito: 'Archivo' }));
      expect(componente.sinGuardar()).toBeFalse();
      expect(componente.avisoDelEditor()).toBe('Cambios guardados.');
    });

    it('la vista previa refleja el título, el tipo, el conteo y la portada que se están editando', async () => {
      await abrir();
      await componente.abrir('album-1');
      componente.campo('titulo', 'Título nuevo');
      componente.campo('destacado', true);
      fixture.detectChanges();
      const tarjeta = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="galeria-previa-tarjeta"]')!;
      expect(tarjeta.textContent).toContain('Título nuevo');
      expect(tarjeta.textContent).toContain('1 foto');
      expect(tarjeta.textContent).toContain('Destacado');
      expect(tarjeta.querySelector('img')?.getAttribute('src')).toBe('/api/v1/publico/archivos/7');
    });

    it('una lista de reproducción detectada al pegar enlaces queda como «Ver la lista en YouTube» si el álbum aún no tiene una', async () => {
      await abrir();
      componente.nuevo();
      componente.listaDetectada('https://www.youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8');
      expect(componente.modelo()?.listaOrigenUrl).toContain('playlist?list=');
      componente.listaDetectada('https://www.youtube.com/playlist?list=OTRA00000000');
      expect(componente.modelo()?.listaOrigenUrl).toContain('PLhJl63hJ1X');
    });
  });

  describe('sin álbum', () => {
    it('carga los ítems sueltos al abrir su pestaña y avisa de lo que se pierde al guardarlos', async () => {
      await abrir();
      componente.elegirPestana('sin-album');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(componente.sueltosCargados()).toBeTrue();
      expect(texto()).toContain('lo que quites de esta lista deja de existir');
    });
  });
});
