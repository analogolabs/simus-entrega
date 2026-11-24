import { UbicacionDivipola } from './ubicacion-divipola';

/**
 * La SEDE PRINCIPAL de un proceso (Festival, Mercado, Taller, Espacio o Red): dónde está, aparte de
 * la cobertura (decisión 119). Los códigos viajan como texto vacío cuando no hay.
 */
export interface SedeDeProceso {
  sedeCodigoDepartamento: string;
  sedeCodigoMunicipio: string;
}

/** Lo que el servidor devuelve de la sede de un proceso: nulo mientras está pendiente de completar. */
export interface SedeDelServidor {
  codigoDepartamento: string | null;
  nombreDepartamento: string | null;
  codigoMunicipio: string | null;
  nombreMunicipio: string | null;
}

/** La sede del formulario a partir de la del servidor (códigos vacíos si está pendiente). */
export function sedeDelFormulario(sede: SedeDelServidor | null | undefined): SedeDeProceso {
  return {
    sedeCodigoDepartamento: sede?.codigoDepartamento ?? '',
    sedeCodigoMunicipio: sede?.codigoMunicipio ?? '',
  };
}

/**
 * Lo que se manda al servidor: la sede elegida o, si no se eligió ninguna y la cobertura es
 * municipal, el municipio de la cobertura (así una petición sin sede sigue siendo válida).
 */
export function sedeParaEnviar(sede: SedeDeProceso, nivel: string, departamento: string, municipio: string): {
  sedeCodigoDepartamento: string | null;
  sedeCodigoMunicipio: string | null;
} {
  const departamentoDeLaSede = sede.sedeCodigoDepartamento || (nivel === 'nacional' ? '' : departamento);
  const municipioDeLaSede = sede.sedeCodigoMunicipio || (nivel === 'municipal' && !sede.sedeCodigoDepartamento ? municipio : '');
  return {
    sedeCodigoDepartamento: departamentoDeLaSede || null,
    sedeCodigoMunicipio: municipioDeLaSede || null,
  };
}

/** ¿La sede está completa? El servidor exige las dos mitades para guardar o enviar a revisión. */
export function sedeCompleta(sede: SedeDeProceso): boolean {
  return !!sede.sedeCodigoDepartamento && !!sede.sedeCodigoMunicipio;
}

/** Departamentos distintos del catálogo, por nombre. */
export function departamentosDe(ubicaciones: readonly UbicacionDivipola[]): { codigo: string; nombre: string }[] {
  const unicos = new Map(ubicaciones.map(fila => [fila.departmentCode, fila.departmentName]));
  return [...unicos].map(([codigo, nombre]) => ({ codigo, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Municipios de un departamento, por nombre. Sin departamento no se ofrece ninguno. */
export function municipiosDe(ubicaciones: readonly UbicacionDivipola[], departamento: string): UbicacionDivipola[] {
  if (!departamento) return [];
  return ubicaciones
    .filter(fila => fila.departmentCode === departamento)
    .sort((a, b) => a.municipalityName.localeCompare(b.municipalityName, 'es'));
}

/** Un territorio con sus municipios (la forma del catálogo de la consola) en las filas planas que usa el selector. */
export function ubicacionesDesdeTerritorios(
  territorios: readonly { codigo: string; nombre: string; municipios: readonly { codigo: string; nombre: string }[] }[],
): UbicacionDivipola[] {
  return territorios.flatMap(t => t.municipios.map(m => ({
    departmentCode: t.codigo, departmentName: t.nombre, municipalityCode: m.codigo, municipalityName: m.nombre,
  })));
}
