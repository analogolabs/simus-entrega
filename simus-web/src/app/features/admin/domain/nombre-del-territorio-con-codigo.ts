import type { TerritorioConCodigo } from '../../../core/services/catalog.service';

/**
 * «Atlántico (08)» y «Barranquilla (08001)»: el territorio con su NOMBRE y el código DIVIPOLA como detalle accesorio.
 *
 * Las comparaciones de la consola mostraban «08» y «08001», que la persona que revisa no sabe leer. El nombre se resuelve contra el
 * catálogo; si todavía no llegó (o el código no está), se deja el código solo para no perder el dato. Vacío = `null` (la fila pone «—»).
 */
export function nombreDelTerritorioConCodigo(
  territorios: readonly TerritorioConCodigo[],
  nivel: 'departamento' | 'municipio',
  codigo: string | null | undefined,
): string | null {
  const limpio = (codigo ?? '').trim();
  if (!limpio) return null;
  let nombre: string | undefined;
  if (nivel === 'departamento') {
    nombre = territorios.find(d => d.codigo === limpio)?.nombre;
  } else {
    for (const departamento of territorios) {
      nombre = departamento.municipios.find(m => m.codigo === limpio)?.nombre;
      if (nombre) break;
    }
  }
  return nombre ? `${nombre} (${limpio})` : limpio;
}
