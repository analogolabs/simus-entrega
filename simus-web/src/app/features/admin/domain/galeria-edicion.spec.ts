import {
  albumDesdeServidor, albumNuevo, albumParaGuardar, esListaDeYoutube, esSlugValido, itemNuevo, leerEnlaceDeVideo, mover, problemaDeImagen, problemasDeAlbum,
  problemasDeItems, segundosDeDuracion, slugDeTitulo,
} from './galeria-edicion';
import type { AlbumDeLaConsolaCompleto } from '../../../core/services/galeria-admin.service';

/**
 * Las reglas de la gestión de la Galería: enlaces solo de YouTube, imagen de hasta 2 MB, texto alternativo obligatorio, coherencia entre el tipo del álbum
 * y sus ítems, y las condiciones para publicar. Reflejan lo que exige el servidor.
 */
describe('reglas de la gestión de la Galería', () => {
  describe('enlaces de video', () => {
    it('lee los formatos habituales de YouTube y el identificador suelto', () => {
      for (const t of [
        'https://www.youtube.com/watch?v=Rv5Oiq8UXi0', 'youtube.com/watch?v=Rv5Oiq8UXi0&t=3s', 'https://youtu.be/Rv5Oiq8UXi0?si=abc',
        'https://m.youtube.com/watch?v=Rv5Oiq8UXi0', 'https://www.youtube.com/embed/Rv5Oiq8UXi0', 'https://www.youtube.com/shorts/Rv5Oiq8UXi0',
        'https://www.youtube-nocookie.com/embed/Rv5Oiq8UXi0', 'Rv5Oiq8UXi0',
      ]) {
        expect(leerEnlaceDeVideo(t)).toEqual(jasmine.objectContaining({ tipo: 'video', videoId: 'Rv5Oiq8UXi0' }));
      }
    });

    it('un video dentro de una lista devuelve también la lista; una lista sola se reconoce como lista', () => {
      expect(leerEnlaceDeVideo('https://www.youtube.com/watch?v=Rv5Oiq8UXi0&list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8'))
        .toEqual({ tipo: 'video', videoId: 'Rv5Oiq8UXi0', listaUrl: 'https://www.youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8' });
      expect(leerEnlaceDeVideo('https://youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8').tipo).toBe('lista');
    });

    it('rechaza otros proveedores con su motivo (Vimeo dicho aparte), enlaces rotos y vacíos', () => {
      expect(leerEnlaceDeVideo('https://vimeo.com/123456')).toEqual({ tipo: 'error', motivo: jasmine.stringContaining('Vimeo') });
      expect(leerEnlaceDeVideo('https://example.com/watch?v=Rv5Oiq8UXi0')).toEqual({ tipo: 'error', motivo: jasmine.stringContaining('YouTube') });
      expect(leerEnlaceDeVideo('https://www.youtube.com/watch?v=corto').tipo).toBe('error');
      expect(leerEnlaceDeVideo('javascript:alert(1)').tipo).toBe('error');
      expect(leerEnlaceDeVideo('   ').tipo).toBe('error');
    });

    it('la lista de origen es https de YouTube, igual que en el servidor', () => {
      expect(esListaDeYoutube('https://youtube.com/playlist?list=PLx')).toBeTrue();
      expect(esListaDeYoutube('https://youtu.be/abc')).toBeTrue();
      expect(esListaDeYoutube('http://youtube.com/playlist?list=PLx')).toBeFalse();
      expect(esListaDeYoutube('https://vimeo.com/x')).toBeFalse();
      expect(esListaDeYoutube('no es un enlace')).toBeFalse();
    });
  });

  it('la imagen debe ser WebP, PNG o JPEG y pesar hasta 2 MB', () => {
    expect(problemaDeImagen({ name: 'a.png', type: 'image/png', size: 1000 })).toBeNull();
    expect(problemaDeImagen({ name: 'a.gif', type: 'image/gif', size: 1000 })).toContain('WebP, PNG o JPEG');
    expect(problemaDeImagen({ name: 'grande.jpg', type: 'image/jpeg', size: 3 * 1048576 })).toContain('3,0 MB');
    expect(problemaDeImagen({ name: 'justa.jpg', type: 'image/jpeg', size: 2 * 1048576 })).toBeNull();
  });

  it('la dirección sale del título sin tildes ni símbolos y se valida como el servidor', () => {
    expect(slugDeTitulo('Voces y Saberes · Edición 2026')).toBe('voces-y-saberes-edicion-2026');
    expect(slugDeTitulo('  ¡Hola!  ')).toBe('hola');
    expect(esSlugValido('mesa-nacional-2026')).toBeTrue();
    expect(esSlugValido('Mala Clave')).toBeFalse();
    expect(esSlugValido('')).toBeFalse();
  });

  it('la duración se escribe como minutos:segundos y se convierte', () => {
    expect(segundosDeDuracion('6:17')).toBe(377);
    expect(segundosDeDuracion('1:02:05')).toBe(3725);
    expect(segundosDeDuracion('')).toBeNull();
    expect(Number.isNaN(segundosDeDuracion('seis'))).toBeTrue();
  });

  describe('ítems y álbum', () => {
    const foto = (extra = {}) => itemNuevo({ tipoItem: 'foto', archivoId: 1, textoAlternativo: 'Una foto', ...extra });
    const video = (extra = {}) => itemNuevo({ tipoItem: 'video', videoId: 'Rv5Oiq8UXi0', titulo: 'Un video', ...extra });

    it('una foto sin texto alternativo no se guarda y el motivo dice cuál es', () => {
      const p = problemasDeItems([foto(), foto({ archivoId: 2, textoAlternativo: '  ' })], 'fotos');
      expect(p).toEqual([jasmine.stringContaining('La foto 2 necesita su texto alternativo')]);
    });

    it('un video necesita enlace válido y título; la duración mal escrita se señala', () => {
      expect(problemasDeItems([video({ videoId: 'x' })], 'videos')).toEqual([jasmine.stringContaining('enlace de YouTube válido')]);
      expect(problemasDeItems([video({ titulo: '' })], 'videos')).toEqual([jasmine.stringContaining('necesita su título')]);
      expect(problemasDeItems([video({ duracion: 'seis' })], 'videos')).toEqual([jasmine.stringContaining('6:17')]);
    });

    it('los ítems deben corresponder al tipo del álbum (los sueltos no tienen esa exigencia)', () => {
      expect(problemasDeItems([video()], 'fotos').length).toBe(1);
      expect(problemasDeItems([foto()], 'videos').length).toBe(1);
      expect(problemasDeItems([foto(), video()], 'mixto')).toEqual([]);
      expect(problemasDeItems([foto(), video()], null)).toEqual([]);
    });

    it('no admite una foto ni un video repetidos, ni textos más largos que el límite', () => {
      expect(problemasDeItems([foto(), foto()], 'fotos')).toContain('Una foto aparece dos veces.');
      expect(problemasDeItems([video(), video()], 'videos')).toContain('Un video aparece dos veces.');
      expect(problemasDeItems([video({ titulo: 'x'.repeat(251) })], 'videos')[0]).toContain('250');
    });

    it('un álbum publicado necesita ítems y, si es mixto, al menos una foto y un video', () => {
      const base = { ...albumNuevo(1), titulo: 'Voces', slug: 'voces', publicado: true };
      expect(problemasDeAlbum({ ...base, items: [] })).toContain('Para publicar, el álbum necesita al menos un ítem.');
      expect(problemasDeAlbum({ ...base, tipo: 'mixto', items: [video()] })).toContain('Un álbum mixto publicado necesita al menos una foto y un video.');
      expect(problemasDeAlbum({ ...base, tipo: 'videos', items: [video()] })).toEqual([]);
    });

    it('exige título, dirección válida (si es nuevo) y una lista de origen de YouTube', () => {
      const p = problemasDeAlbum({ ...albumNuevo(1), slug: 'Mala', listaOrigenUrl: 'http://x.test' });
      expect(p.length).toBe(3);
      expect(p[0]).toContain('título');
    });

    it('lo que se manda al servidor lleva cada ítem con su forma y sin lo que no corresponde', () => {
      const a = { ...albumNuevo(2), titulo: ' Voces ', slug: 'voces', tipo: 'mixto' as const, items: [foto({ credito: ' Archivo ' }), video({ duracion: '6:17', miniaturaArchivoId: 9 })] };
      const s = albumParaGuardar(a);
      expect(s.titulo).toBe('Voces');
      expect(s.items[0]).toEqual(jasmine.objectContaining({ tipoItem: 'foto', archivoId: 1, videoId: null, credito: 'Archivo', miniaturaArchivoId: null }));
      expect(s.items[1]).toEqual(jasmine.objectContaining({ tipoItem: 'video', archivoId: null, videoId: 'Rv5Oiq8UXi0', duracionSegundos: 377, miniaturaArchivoId: 9, textoAlternativo: null }));
    });

    it('lo que llega del servidor vuelve a ser editable con la duración legible', () => {
      const servidor = {
        slug: 'voces', titulo: 'Voces', descripcion: null, tipo: 'videos', lugar: null, fechaReferencia: '2026-08-06', portadaUrl: null, portadaArchivoId: null, listaOrigenUrl: null,
        orden: 3, publicado: true, fechaActualizacion: null, destacado: true,
        items: [{ id: 1, tipoItem: 'video', orden: 1, titulo: 'Carlos', descripcion: null, fecha: null, credito: null, textoAlternativo: null, archivoId: null, url: null, videoId: 'Rv5Oiq8UXi0',
          urlYoutube: null, duracionSegundos: 377, miniaturaArchivoId: 5, miniaturaUrl: '/api/v1/publico/archivos/5', publicado: true }],
      } as AlbumDeLaConsolaCompleto;
      const a = albumDesdeServidor(servidor);
      expect(a.destacado).toBeTrue();
      expect(a.items[0]).toEqual(jasmine.objectContaining({ duracion: '6:17', imagenUrl: '/api/v1/publico/archivos/5', miniaturaArchivoId: 5 }));
    });
  });

  it('mover cambia una posición y no se sale de los extremos', () => {
    expect(mover([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(mover([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
    expect(mover([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
});
