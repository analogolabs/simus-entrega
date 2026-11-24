/**
 * Si la cámara quedó lejos de donde «Ubicar en el mapa» la mandó.
 *
 * <b>REPRODUCIDO EL 22 DE NOVIEMBRE DE 2026.</b> El salto al municipio es un `setView(..., { animate: false })`.
 * Si en ese instante hay un zoom animado en curso —el encuadre del departamento o de Colombia, una rueda de
 * ratón, un botón de acercar— Leaflet lo deja correr y, al terminar su transición (250 ms), mueve el mapa a SU
 * destino: el salto se deshace. Con un mapa de prueba en Chromium, un `fitBounds` animado y un `setView` 40 ms
 * después dejaban el mapa en zoom 6 y centro (4,51; -74,00) en lugar de zoom 9 sobre (6,2; -75,5). `map.stop()`
 * no lo evita. Por eso la página vuelve a mirar dónde quedó la cámara cuando las animaciones ya acabaron, y
 * repite el salto solo si de verdad quedó fuera de sitio.
 */
export interface DestinoDeCamara {
  readonly lat: number;
  readonly lng: number;
  readonly zoom: number;
}

/** Distancia máxima, en metros, a la que se acepta que el centro quedó «en el destino». */
export const TOLERANCIA_DEL_CENTRO_EN_METROS = 500;

/** Los instantes (ms tras el salto) en que se comprueba, cubriendo el encuadre de 550 ms y la transición de 250 ms. */
export const MOMENTOS_DE_COMPROBACION_MS: readonly number[] = [350, 900];

export function distanciaEnMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radio = 6371000;
  const rad = (grados: number): number => (grados * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radio * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function camaraFueraDeDestino(
  actual: { lat: number; lng: number; zoom: number },
  destino: DestinoDeCamara,
): boolean {
  return actual.zoom !== destino.zoom || distanciaEnMetros(actual, destino) > TOLERANCIA_DEL_CENTRO_EN_METROS;
}
