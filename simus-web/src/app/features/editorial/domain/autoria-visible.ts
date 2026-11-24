/**
 * LOS NOMBRES DE LA AUTORÍA VISIBLE DE UNA FICHA, UNO POR UNO, para que cada uno sea un filtro.
 *
 * El servidor arma la autoría con que se cita la obra de un vistazo: hasta tres nombres separados por
 * «; » y, si hay más, la cola «y N más» (ver `CatalogoEditorialExploracion.cs`). Ningún nombre del
 * acervo lleva punto y coma, así que la separación es segura. La cola no es un nombre: no se puede
 * filtrar por «3 más», y por eso viaja aparte.
 */
export interface AutoriaPartida {
  readonly nombres: readonly string[];
  /** «y 3 más», o `null` si la autoría cabe entera. */
  readonly resto: string | null;
}

const COLA = /^(.*\S)\s+(y\s+\d+\s+más)$/;

export function partirAutoria(texto: string | null | undefined): AutoriaPartida {
  const partes = (texto ?? '').split(';').map(p => p.trim()).filter(Boolean);
  if (partes.length === 0) return { nombres: [], resto: null };
  const ultima = COLA.exec(partes[partes.length - 1]);
  if (!ultima) return { nombres: partes, resto: null };
  return { nombres: [...partes.slice(0, -1), ultima[1]], resto: ultima[2] };
}
