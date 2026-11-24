import { IMAGENES_DE_RESPALDO_DE_NOTICIAS, imagenDeNoticia } from './imagen-de-noticia';

/**, L8): la misma noticia lleva la misma foto en la portada, en la lista y en el detalle. */
describe('imagenDeNoticia', () => {
  it('usa la imagen propia cuando la hay', () => {
    expect(imagenDeNoticia({ img: '/media/portada.webp', id: 3 })).toBe('/media/portada.webp');
  });

  it('sin imagen propia cae a una de respaldo, estable por noticia y nunca vacía', () => {
    for (const id of [1, 2, 3, 4, 5, 6, 100, '17', 'noticia-sin-numero']) {
      const imagen = imagenDeNoticia({ img: '', id });
      expect(IMAGENES_DE_RESPALDO_DE_NOTICIAS).toContain(imagen);
      expect(imagenDeNoticia({ img: null, id })).withContext(`la misma noticia, la misma foto (${id})`).toBe(imagen);
    }
  });

  it('reparte las noticias entre las fotos de respaldo y no usa una sola', () => {
    const usadas = new Set([1, 2, 3, 4, 5, 6].map(id => imagenDeNoticia({ id })));
    expect(usadas.size).toBe(IMAGENES_DE_RESPALDO_DE_NOTICIAS.length);
  });
});
