import { firstValueFrom } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';

/**
 * La foto de quien responde por un proceso SIN organización (LUT-02, decisión 120): entra por su propia
 * puerta, con cuota personal, porque `/externo/archivos` exige una organización. La misma función sirve
 * a talleres, espacios y redes; solo cambia la ruta.
 */
export async function subirFotoDelResponsable(
  api: ApiClientService, ruta: string, archivo: File, alt: string,
): Promise<{ ok: boolean; archivo?: { id: number; url: string }; error?: string }> {
  const cuerpo = new FormData();
  cuerpo.append('file', archivo, archivo.name);
  cuerpo.append('alt', alt);
  try {
    // EL TESTIGO CSRF VA EN LA SUBIDA (como en el Banco): se pide justo antes para no mandar uno vencido.
    const testigo = await firstValueFrom(api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {}));
    const subido = await firstValueFrom(api.postForm<{ id: number; url: string }>(ruta, cuerpo, {
      headers: { 'X-CSRF-TOKEN': testigo.requestToken },
      errorFallback: 'No fue posible subir la foto.',
    }));
    return { ok: true, archivo: subido };
  } catch (fallo: unknown) {
    const mensaje = (fallo as { message?: string })?.message;
    return { ok: false, error: mensaje || 'No fue posible subir la foto.' };
  }
}
