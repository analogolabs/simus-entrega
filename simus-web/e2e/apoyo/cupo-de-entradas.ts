import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Las entradas por API (`/auth/login`) tienen un cupo por dirección: 10 por minuto las externas y 20 las del
 * panel institucional (`Program.cs`, «external-login» y «admin-login»). La suite completa, con un solo trabajador y
 * decenas de recorridos que abren sesión, lo agota hacia la mitad y la entrada siguiente recibe 429: el recorrido
 * fallaba por la carga y no por el producto («Unexpected end of JSON input» al leer `/me`, o «Expected 200, received 429»).
 *
 * Esta función hace la misma petición y, si el servidor responde 429, espera lo que él mismo pide (`Retry-After`) y
 * reintenta: se espera por la condición (el cupo se repone), no por un tiempo fijo, y se devuelve la primera respuesta
 * que no sea 429. Tras agotar el plazo devuelve el 429 para que la prueba lo diga con su mensaje.
 */
export async function postConCupo(
  request: APIRequestContext,
  url: string,
  opciones: Parameters<APIRequestContext['post']>[1] = {},
  plazoMs = 90_000,
): Promise<APIResponse> {
  const limite = Date.now() + plazoMs;
  let respuesta = await request.post(url, opciones);
  while (respuesta.status() === 429 && Date.now() < limite) {
    const pedido = Number(respuesta.headers()['retry-after']);
    const esperaMs = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, 30) * 1000 : 5_000;
    await new Promise(r => setTimeout(r, esperaMs));
    respuesta = await request.post(url, opciones);
  }
  return respuesta;
}
