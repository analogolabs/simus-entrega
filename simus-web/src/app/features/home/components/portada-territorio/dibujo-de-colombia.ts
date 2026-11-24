/**
 * DIBUJO DE COLOMBIA PARA LA PORTADA: los departamentos como trazados SVG, sin Leaflet.
 *
 * Proyección equirectangular corregida por la latitud media (cos 4,5°): a esta escala y en un país
 * que cruza el ecuador basta, y no exige ninguna librería. El archipiélago de San Andrés queda a
 * 700 km de la costa; se dibuja en un recuadro arriba a la izquierda, como en los mapas oficiales.
 */
export interface DepartamentoDibujado {
  codigo: string;
  nombre: string;
  trazado: string;
  enRecuadro: boolean;
}

const ANCHO = 1000;
const COS_LAT = Math.cos((4.5 * Math.PI) / 180);
const CODIGO_SAN_ANDRES = '88';

type Anillo = number[][];

function anillosDe(geometria: { type: string; coordinates: unknown } | null | undefined): Anillo[] {
  if (!geometria) return [];
  if (geometria.type === 'Polygon') return geometria.coordinates as Anillo[];
  if (geometria.type === 'MultiPolygon') return (geometria.coordinates as Anillo[][]).flat();
  return [];
}

export function dibujarColombia(
  rasgos: readonly { properties?: Record<string, unknown>; geometry?: { type: string; coordinates: unknown } }[],
  codigoDe: (rasgo: unknown) => string,
  nombreDe: (rasgo: unknown) => string,
): { departamentos: DepartamentoDibujado[]; alto: number } {
  const continentales = rasgos.filter((r) => codigoDe(r) !== CODIGO_SAN_ANDRES);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const rasgo of continentales) {
    for (const anillo of anillosDe(rasgo.geometry)) {
      for (const [lon, lat] of anillo) {
        const x = lon * COS_LAT, y = -lat;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const escala = ANCHO / (maxX - minX);
  const alto = Math.round((maxY - minY) * escala);

  const trazar = (anillos: Anillo[], proyectar: (lon: number, lat: number) => [number, number]) =>
    anillos.map((anillo) => {
      let previo = '';
      const puntos: string[] = [];
      for (const [lon, lat] of anillo) {
        const [x, y] = proyectar(lon, lat);
        const p = `${x.toFixed(1)} ${y.toFixed(1)}`;
        if (p !== previo) puntos.push(p);
        previo = p;
      }
      return puntos.length > 2 ? `M${puntos.join('L')}Z` : '';
    }).join('');

  const continental = (lon: number, lat: number): [number, number] => [(lon * COS_LAT - minX) * escala, (-lat - minY) * escala];

  const departamentos: DepartamentoDibujado[] = rasgos.map((rasgo) => {
    const codigo = codigoDe(rasgo);
    const anillos = anillosDe(rasgo.geometry);
    if (codigo !== CODIGO_SAN_ANDRES) {
      return { codigo, nombre: nombreDe(rasgo), trazado: trazar(anillos, continental), enRecuadro: false };
    }
    // Recuadro de 90 × 120 en la esquina superior izquierda, con el archipiélago ampliado.
    let aMinX = Infinity, aMaxX = -Infinity, aMinY = Infinity, aMaxY = -Infinity;
    for (const anillo of anillos) for (const [lon, lat] of anillo) {
      const x = lon * COS_LAT, y = -lat;
      aMinX = Math.min(aMinX, x); aMaxX = Math.max(aMaxX, x); aMinY = Math.min(aMinY, y); aMaxY = Math.max(aMaxY, y);
    }
    const e = Math.min(70 / (aMaxX - aMinX), 100 / (aMaxY - aMinY));
    const recuadro = (lon: number, lat: number): [number, number] => [20 + (lon * COS_LAT - aMinX) * e, 20 + (-lat - aMinY) * e];
    return { codigo, nombre: nombreDe(rasgo), trazado: trazar(anillos, recuadro), enRecuadro: true };
  });

  return { departamentos, alto };
}
