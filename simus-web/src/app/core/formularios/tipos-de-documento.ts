/**
 * Los tipos de documento de identidad, en UNA sola lista.
 *
 * <b>ANTES HABÍA TRES.</b> El registro ofrecía tres (cédula, extranjería y pasaporte), «Cuenta y
 * seguridad» diez y el alta de una organización en la consola otros cuatro con un «NIT» que el
 * servidor rechaza. Quien tiene un PPT no podía registrarse con él y después sí podía elegirlo.
 * Esta lista es la que acepta el servidor (`ExternalOrganizationEndpoints.TiposDeDocumento`) y la
 * que siembra la base (`EnsureTiposDeDocumentoAsync`): los mismos diez códigos, en minúscula.
 */
export interface TipoDeDocumento {
  codigo: string;
  nombre: string;
}

export const TIPOS_DE_DOCUMENTO: readonly TipoDeDocumento[] = [
  { codigo: 'cc', nombre: 'Cédula de ciudadanía' },
  { codigo: 'ce', nombre: 'Cédula de extranjería' },
  { codigo: 'ti', nombre: 'Tarjeta de identidad' },
  { codigo: 'rc', nombre: 'Registro civil de nacimiento' },
  { codigo: 'nuip', nombre: 'Número único de identificación personal' },
  { codigo: 'pa', nombre: 'Pasaporte' },
  { codigo: 'pep', nombre: 'Permiso especial de permanencia' },
  { codigo: 'ppt', nombre: 'Permiso por protección temporal' },
  { codigo: 'die', nombre: 'Documento de identificación extranjero' },
  { codigo: 'cd', nombre: 'Carné diplomático' },
];

/**
 * El código tal como lo espera la lista: en minúscula y sin espacios.
 *
 * <b>ES LA CAUSA DEL DESPLEGABLE VACÍO.</b> Algunas cuentas guardan «CC» (el alta heredada lo
 * escribía así) y el `<select>` solo conoce «cc»: no encontraba su opción y se pintaba en blanco,
 * como si la persona hubiera perdido el dato. Un código que no está en la lista devuelve vacío.
 */
export function normalizarTipoDeDocumento(codigo: string | null | undefined): string {
  const limpio = (codigo ?? '').trim().toLowerCase();
  return TIPOS_DE_DOCUMENTO.some(tipo => tipo.codigo === limpio) ? limpio : '';
}

/** El nombre legible de un código; si no se conoce, el código tal cual. */
export function nombreDelTipoDeDocumento(codigo: string | null | undefined): string {
  const normal = normalizarTipoDeDocumento(codigo);
  return TIPOS_DE_DOCUMENTO.find(tipo => tipo.codigo === normal)?.nombre ?? (codigo ?? '');
}
