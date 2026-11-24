import { OpcionDePestana } from '../pestanas/pestanas.component';
import { TIPOS_DE_PROCESO } from '../../../../core/navegacion/tipos-de-proceso';

/** La opción de lo que no es de un proceso (una invitación, una cita…). */
export const TIPO_OTRAS = 'otras';

export interface ParametrosDeOpcionesDeTipo {
  /** Cuántos hay de cada tipo (`festivales`, `mercados`…) y `otras`. Lo que falta cuenta cero. */
  readonly conteos: Readonly<Record<string, number>>;
  /** El total de «Todos»; sin él, la suma de los tipos. */
  readonly total?: number | null;
  /** Los tipos que se ofrecen; por omisión los cinco, en el orden del Ecosistema. */
  readonly tipos?: readonly string[] | null;
  /** Añade «Citas e invitaciones» (con el conteo de `otras`). */
  readonly conOtras?: boolean;
}

/**
 * Las opciones de `app-barra-de-tipo` para una lista de procesos: «Todos», Festivales, Mercados, Redes,
 * Lutería y Espacios, en el orden fijo del Ecosistema y con su conteo. La misma fuente que
 * `app-pestanas-de-tipo` (`TIPOS_DE_PROCESO`): no hay una segunda lista de tipos que pueda divergir.
 */
export function opcionesDeTipoDeProceso(p: ParametrosDeOpcionesDeTipo): readonly OpcionDePestana[] {
  const suma = Object.values(p.conteos).reduce((a, n) => a + n, 0);
  return [
    { id: 'todos', etiqueta: 'Todos', conteo: p.total ?? suma },
    ...TIPOS_DE_PROCESO.filter(t => !p.tipos || p.tipos.includes(t.clave))
      .map(t => ({ id: t.clave, etiqueta: t.etiquetaDePestana, conteo: p.conteos[t.clave] ?? 0 })),
    ...(p.conOtras ? [{ id: TIPO_OTRAS, etiqueta: 'Citas e invitaciones', conteo: p.conteos[TIPO_OTRAS] ?? 0 }] : []),
  ];
}
