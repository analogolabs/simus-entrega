import { normalizarNombreDeDepartamento } from '../vocabularios/territorio';

interface RegistroConCampos {
  readonly fields?: Record<string, unknown>;
}

interface RegistroPlano {
  readonly department?: string | null;
}

interface Cartografia {
  readonly features?: readonly { readonly properties?: Record<string, unknown> | null }[] | null;
}

const nombreDeDepartamento = (valor: unknown): string =>
  typeof valor === 'string' ? valor : '';

/** Construye el cero de cada departamento a partir de la cartografía recibida. */
export const crearConteosBaseDeCartografia = (cartografia: Cartografia | null | undefined): Record<string, number> => {
  const conteos: Record<string, number> = {};
  for (const rasgo of cartografia?.features ?? []) {
    const propiedades = rasgo?.properties ?? {};
    const departamento = normalizarNombreDeDepartamento(nombreDeDepartamento(
      propiedades['departmentName'] ?? propiedades['dpto_cnmbr'],
    ));
    if (departamento) conteos[departamento] = 0;
  }
  return conteos;
};

/** Cuenta registros con la forma `{ fields }` que comparten Festivales y Agenda. */
export const contarRegistrosPorDepartamento = (registros: readonly RegistroConCampos[]): Record<string, number> =>
  registros.reduce<Record<string, number>>((conteos, registro) => {
    const campos = registro?.fields ?? {};
    const bruto = campos['dpt'] ?? campos['dpto'] ?? campos['departamento'] ?? campos['department'];
    const departamento = normalizarNombreDeDepartamento(Array.isArray(bruto) ? nombreDeDepartamento(bruto[0]) : nombreDeDepartamento(bruto));
    if (!departamento || departamento === 'DESCONOCIDO') return conteos;
    conteos[departamento] = (conteos[departamento] ?? 0) + 1;
    return conteos;
  }, {});

/** Cuenta registros planos, forma que entrega el contrato público de Mercados. */
export const contarRegistrosPlanosPorDepartamento = (registros: readonly RegistroPlano[]): Record<string, number> =>
  registros.reduce<Record<string, number>>((conteos, registro) => {
    const departamento = normalizarNombreDeDepartamento(registro?.department ?? '');
    if (!departamento || departamento === 'DESCONOCIDO') return conteos;
    conteos[departamento] = (conteos[departamento] ?? 0) + 1;
    return conteos;
  }, {});
