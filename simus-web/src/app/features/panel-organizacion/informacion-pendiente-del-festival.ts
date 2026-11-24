import { FestivalDeLaOrganizacion } from './panel-organizacion.api';

/**
 * Qué le falta a un Festival en borrador.
 *
 * <b>«COMPLETAR INFORMACIÓN» TIENE QUE DECIR QUÉ.</b> El resumen invitaba a completar sin nombrar
 * nada, y quien abría la ficha no sabía si faltaba algo que impide el envío o solo algo que mejora
 * la ficha pública. Son dos listas porque piden dos cosas distintas:
 *
 * - <b>Para enviarlo</b>: lo mismo que comprueba el servidor antes de aceptar el envío
 *   (`ValidarFestivalParaRevisionAsync` en `FestivalesExternosEndpoints.cs`): nombre, alcance
 *   territorial y, según el alcance, departamento y municipio.
 * - <b>Para la ficha pública</b>: datos opcionales que el público ve. No bloquean nada.
 *
 * Como en `informacion-pendiente.ts` (organización), se nombra el dato y no un porcentaje.
 */

/** Un dato que falta, con el campo de la ficha al que lleva. */
export interface DatoPendienteDelFestival {
  /** La clave que entiende `FichaFestivalComponent.campoInicial` para llevar el foco. */
  campo: string;
  /** Cómo se nombra: «el departamento». */
  etiqueta: string;
}

export interface InformacionPendienteDelFestival {
  /** Sin esto el servidor no acepta el envío a revisión. */
  paraEnviar: DatoPendienteDelFestival[];
  /** Opcional: completa lo que verá el público al publicarse. */
  paraLaFichaPublica: DatoPendienteDelFestival[];
}

const vacio = (valor: string | null | undefined): boolean => !(valor ?? '').trim();

export function informacionPendienteDelFestival(festival: FestivalDeLaOrganizacion | null): InformacionPendienteDelFestival {
  if (!festival) return { paraEnviar: [], paraLaFichaPublica: [] };

  const paraEnviar: DatoPendienteDelFestival[] = [];
  if (vacio(festival.nombre)) paraEnviar.push({ campo: 'nombre', etiqueta: 'el nombre' });
  const nivel = (festival.nivelCobertura ?? '').trim().toLowerCase();
  if (!['municipal', 'departamental', 'nacional'].includes(nivel)) {
    paraEnviar.push({ campo: 'nivelCobertura', etiqueta: 'el alcance territorial' });
  } else if (nivel !== 'nacional') {
    if (vacio(festival.codigoDepartamento)) paraEnviar.push({ campo: 'codigoDepartamento', etiqueta: 'el departamento' });
    if (nivel === 'municipal' && vacio(festival.codigoMunicipio)) paraEnviar.push({ campo: 'codigoMunicipio', etiqueta: 'el municipio' });
  }

  const paraLaFichaPublica: DatoPendienteDelFestival[] = [];
  if (vacio(festival.descripcion)) paraLaFichaPublica.push({ campo: 'descripcion', etiqueta: 'la descripción' });
  if (vacio(festival.periodicidad)) paraLaFichaPublica.push({ campo: 'periodicidad', etiqueta: 'la periodicidad' });
  if (!festival.practicasMusicales?.length) paraLaFichaPublica.push({ campo: 'practicasMusicales', etiqueta: 'las prácticas musicales' });
  if (!festival.territoriosSonoros?.length) paraLaFichaPublica.push({ campo: 'territoriosSonoros', etiqueta: 'los territorios sonoros' });
  if (vacio(festival.correoContacto)) paraLaFichaPublica.push({ campo: 'correoContacto', etiqueta: 'el correo de contacto' });
  if ([festival.paginaWeb, festival.instagram, festival.facebook, festival.otroEnlace].every(vacio)) {
    paraLaFichaPublica.push({ campo: 'paginaWeb', etiqueta: 'un enlace (sitio web o redes)' });
  }

  return { paraEnviar, paraLaFichaPublica };
}
