import { TipoDeEnlace } from '../components/ui/icono-de-enlace/icono-de-enlace.component';
import { enlaceExterno } from './enlace-externo';

/** Un enlace de un registro público, listo para pintarlo como icono. */
export interface EnlaceDeRegistro {
  clave: TipoDeEnlace;
  etiqueta: string;
  href: string;
}

/**
 * Los enlaces que un registro declaró (sitio web, Instagram, Facebook y otro), normalizados y sin los vacíos.
 * Los cinco procesos los muestran igual: como iconos bajo el nombre de la organización.
 */
export function enlacesDeRegistro(datos: {
  sitioWeb?: string | null; instagram?: string | null; facebook?: string | null; otroEnlace?: string | null;
}): EnlaceDeRegistro[] {
  const candidatos: readonly [TipoDeEnlace, string, string | null | undefined][] = [
    ['sitioWeb', 'Sitio web', datos.sitioWeb],
    ['instagram', 'Instagram', datos.instagram],
    ['facebook', 'Facebook', datos.facebook],
    ['otroEnlace', 'Otro enlace', datos.otroEnlace],
  ];
  const enlaces: EnlaceDeRegistro[] = [];
  for (const [clave, etiqueta, valor] of candidatos) {
    const href = enlaceExterno(valor ?? null);
    if (href) enlaces.push({ clave, etiqueta, href });
  }
  return enlaces;
}
