/**
 * ACCESO RÁPIDO DE CUENTAS DE DEMOSTRACIÓN: lectura de la configuración de tiempo de ejecución.
 *
 * TEMPORAL Y QUITABLE. Nada de esto vive en el paquete inicial: `main.ts` pide este trozo con `import()` solo
 * en un build de desarrollo y solo desde una dirección local. Las cuentas y sus claves NO están en el código
 * ni en el repositorio: las escribe `scripts/demo/reiniciar-demo.sh` en `simus-web/public/config-demo.js`
 * (ignorado por git y excluido del build de producción). Sin ese archivo no se muestra nada.
 */
export type AmbitoDeCuenta = 'externo' | 'administrativo';

export interface CuentaDeDemostracion {
  rotulo: string;
  correo: string;
  clave: string;
  ambito: AmbitoDeCuenta;
}

export interface ConfiguracionDeDemostracion {
  accesoRapido: boolean;
  cuentas: CuentaDeDemostracion[];
}

/** Valida lo que dejó el archivo; devuelve `null` si no hay nada utilizable (entonces no se dibuja nada). */
export function leerConfiguracion(bruto: unknown): ConfiguracionDeDemostracion | null {
  if (!bruto || typeof bruto !== 'object') { return null; }
  const candidata = bruto as { accesoRapido?: unknown; cuentas?: unknown };
  if (candidata.accesoRapido !== true || !Array.isArray(candidata.cuentas)) { return null; }
  const cuentas = candidata.cuentas.filter((c): c is CuentaDeDemostracion =>
    !!c && typeof c === 'object'
    && typeof (c as CuentaDeDemostracion).rotulo === 'string'
    && typeof (c as CuentaDeDemostracion).correo === 'string'
    && typeof (c as CuentaDeDemostracion).clave === 'string'
    && ((c as CuentaDeDemostracion).ambito === 'externo' || (c as CuentaDeDemostracion).ambito === 'administrativo'));
  return cuentas.length ? { accesoRapido: true, cuentas } : null;
}

/** Solo direcciones locales: nunca se intenta fuera del equipo de quien prueba. */
export function esDireccionLocal(nombre: string): boolean {
  return nombre === 'localhost' || nombre === '127.0.0.1' || nombre === '[::1]' || nombre.endsWith('.localhost');
}
