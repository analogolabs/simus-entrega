import { FotoDeGaleria, nombreDeDescarga, repartirEnFilas } from './galeria-modelo';

const foto = (id: number, razon = 1.5): FotoDeGaleria => ({ id, url: `/api/v1/publico/archivos/${id}`, alt: `Foto ${id}`, titulo: null, credito: null, fecha: null, lugar: null, albumSlug: 'a', albumTitulo: 'Álbum', razon });

describe('repartirEnFilas (mosaico justificado)', () => {
  it('calcula las filas por el ancho real y recorta a un máximo de filas completas, sin fila colgando', () => {
    const fotos = Array.from({ length: 40 }, (_, i) => foto(i + 1, i % 3 === 0 ? 0.75 : 1.5));
    const r = repartirEnFilas(fotos, 1000, 210, 6, 3);
    let y = 0; let acumulado = 0; let fila: number[] = [];
    const grupos: number[][] = [];
    for (const c of r.celdas) {
      if (acumulado + c.ancho > 1000 + 0.5) { grupos.push(fila); fila = []; acumulado = 0; y++; }
      fila.push(c.ancho); acumulado += c.ancho + 6;
    }
    grupos.push(fila);
    expect(y + 1).toBe(3);
    expect(r.ocultas).toBe(40 - r.celdas.length);
    expect(r.ocultas).toBeGreaterThan(0);
    // Cada fila llena el ancho (menos el redondeo de unos pocos píxeles).
    for (const g of grupos) {
      const total = g.reduce((s, a) => s + a, 0) + 6 * (g.length - 1);
      expect(total).toBeLessThanOrEqual(1000);
      expect(total).toBeGreaterThan(1000 - g.length - 1);
    }
  });

  it('un álbum corto se muestra entero y su última fila queda a su alto natural', () => {
    const r = repartirEnFilas([foto(1), foto(2)], 1000, 210, 6, 3);
    expect(r.ocultas).toBe(0);
    expect(r.celdas.map(c => c.alto)).toEqual([210, 210]);
  });

  it('sin tope muestra todas las fotos y sin ancho no calcula nada', () => {
    expect(repartirEnFilas(Array.from({ length: 30 }, (_, i) => foto(i)), 800, 200, 6, null).ocultas).toBe(0);
    expect(repartirEnFilas([foto(1)], 0, 200, 6, 3).celdas).toEqual([]);
  });
});

describe('nombreDeDescarga', () => {
  it('arma un nombre legible, sin tildes ni símbolos y con la extensión del tipo', () => {
    expect(nombreDeDescarga({ id: 12, titulo: 'Mesa Nacional de Rock: ¡Inauguración!', alt: '', albumTitulo: null }, 'image/png')).toBe('mesa-nacional-de-rock-inauguracion-foto-12.png');
  });
  it('usa el álbum o solo el número si no hay texto, y JPG por omisión', () => {
    expect(nombreDeDescarga({ id: 5, titulo: null, alt: '', albumTitulo: 'Congreso' })).toBe('congreso-foto-5.jpg');
    expect(nombreDeDescarga({ id: 7, titulo: null, alt: '', albumTitulo: null }, 'application/octet-stream')).toBe('foto-7.jpg');
  });
});
