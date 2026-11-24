/**
 * Los enlaces para compartir una página en redes, por dirección (sin scripts ni botones de terceros).
 *
 * Cada red recibe la dirección y, cuando lo admite, el título. Todo va codificado: un título con «&», «#» o tildes
 * no puede romper el enlace ni colar parámetros.
 */
export type RedParaCompartir = 'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'correo';

export interface EnlaceParaCompartir {
  red: RedParaCompartir;
  nombre: string;
  href: string;
}

export function enlacesParaCompartir(url: string, titulo: string): EnlaceParaCompartir[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(titulo);
  return [
    { red: 'whatsapp', nombre: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${titulo} ${url}`)}` },
    { red: 'facebook', nombre: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { red: 'x', nombre: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { red: 'linkedin', nombre: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { red: 'correo', nombre: 'Correo', href: `mailto:?subject=${t}&body=${encodeURIComponent(`${titulo}\n${url}`)}` },
  ];
}
