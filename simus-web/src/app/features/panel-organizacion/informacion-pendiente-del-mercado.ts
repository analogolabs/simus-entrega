import { MercadoDeLaOrganizacion } from './panel-organizacion.api';
import { DatoPendienteDelFestival } from './informacion-pendiente-del-festival';

/**
 * Qué le falta a un Mercado en borrador para poder enviarse.
 *
 * <b>EL MISMO CONCEPTO QUE EL FESTIVAL.</b> El Festival dice «Para enviarlo falta el municipio»
 * antes de pulsar; en el Mercado el alcance y la modalidad parecían opcionales y el error llegaba al
 * enviar («Indica el alcance… la modalidad»). Aquí va lo mismo que comprueba el servidor
 * (`ValidarMercadoParaRevisionAsync` en `MercadosExternosEndpoints.cs`): descripción, alcance,
 * modalidad y una forma de contacto. Reutiliza el tipo `DatoPendienteDelFestival` para que la
 * tarjeta de «siguiente acción» y su frase («el alcance y la modalidad») sean una sola.
 */
const vacio = (valor: string | null | undefined): boolean => !(valor ?? '').trim();

export function informacionPendienteDelMercado(mercado: MercadoDeLaOrganizacion | null): { paraEnviar: DatoPendienteDelFestival[] } {
  if (!mercado) return { paraEnviar: [] };
  const paraEnviar: DatoPendienteDelFestival[] = [];
  if (vacio(mercado.descripcion)) paraEnviar.push({ campo: 'descripcion', etiqueta: 'la descripción' });
  if (mercado.alcanceId === null || mercado.alcanceId === undefined) paraEnviar.push({ campo: 'alcanceId', etiqueta: 'el alcance' });
  if (mercado.modalidadId === null || mercado.modalidadId === undefined) paraEnviar.push({ campo: 'modalidadId', etiqueta: 'la modalidad' });
  if (vacio(mercado.correoMercado) && vacio(mercado.telefonoMercado)) {
    paraEnviar.push({ campo: 'correoMercado', etiqueta: 'un correo o un teléfono de contacto' });
  }
  return { paraEnviar };
}

/** «el alcance y la modalidad». */
export function enumerarDatosPendientes(datos: readonly { etiqueta: string }[]): string {
  const etiquetas = datos.map(dato => dato.etiqueta);
  if (etiquetas.length <= 1) return etiquetas.join('');
  return `${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}`;
}
