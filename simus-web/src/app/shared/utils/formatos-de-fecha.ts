import { formatDate, registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';

/**
 * EL ÚNICO FORMATEADOR DE FECHAS DE SIMUS.
 *
 * <b>Qué estaba roto.</b> Convivían `| date` sin idioma (salían en inglés: «5 November 2026»),
 * `| date` en es-CO pero sin zona, `toLocaleDateString('es-ES')` y `formatDate` sueltos, con cinco
 * formas de escribir lo mismo («5 Nov», «5 nov 2026», «5 Nov 2026», ISO). Y ninguno fijaba la zona:
 * la hora se pintaba en la del navegador, y la API mandaba los instantes sin «Z», así que la
 * consola enseñaba «Enviado 23:23» junto a un historial «18:23» en la misma ficha.
 *
 * <b>La regla, en dos líneas.</b>
 * - Un INSTANTE (algo que pasó a una hora: creado, enviado, decidido) llega de la API en UTC con
 *   «Z» y se pinta SIEMPRE en hora de Colombia (`America/Bogota`), sea cual sea la zona del equipo.
 * - Una FECHA DE CALENDARIO (`DateOnly` en la API: «2026-11-05», la fecha de una edición o de un
 *   evento de día completo) no tiene zona y NO se desplaza: el 5 de noviembre es el 5 en cualquier
 *   parte. Correrla a Bogotá la convertiría en el 4 a las 19:00.
 *
 * Se formatea con el `formatDate` de Angular y los datos de `es-CO`, con patrones fijos: el
 * resultado no depende de la versión de ICU del navegador. No se fija `LOCALE_ID` (ver
 * `localizacion-es-co.spec.ts`): el idioma se pide aquí, expresamente.
 */

/**
 * EL FORMATEADOR REGISTRA SU PROPIO IDIOMA. `app.config.ts` también lo hace, pero quien importe
 * solo esto —una prueba, una función de dominio— no debe depender de que la aplicación haya
 * arrancado: sin los datos, `formatDate` lanza «Missing locale data for the locale "es-CO"».
 * Registrar dos veces es inocuo.
 */
registerLocaleData(localeEsCO, 'es-CO');

/** La zona en la que se lee toda hora en SIMUS. */
export const ZONA_HORARIA_SIMUS = 'America/Bogota';

/** El idioma de todas las fechas. */
export const IDIOMA_DE_FECHAS = 'es-CO';

/**
 * Los estilos que existen. No hay más a propósito: dos pantallas que escriben la misma fecha de
 * dos maneras obligan a quien compara a traducir.
 *
 * - `fecha`: «5 nov 2026». Donde la hora no aporta.
 * - `fecha-hora`: «5 nov 2026, 18:23». Todo lo que se ordena dentro del día.
 * - `hora`: «18:23». Solo para lo que acaba de pasar (autoguardado, «comprobado a las»).
 * - `fecha-larga`: «5 de noviembre de 2026». Prosa: la fecha de una noticia, «responsable desde».
 * - `mes`: «nov». Rótulos de calendario.
 * - `mes-anio`: «noviembre de 2026». Cabeceras de agrupación por mes.
 * - `mes-nombre`: «noviembre». El mes solo, en minúscula, para los selectores (G6): el año va en su propio filtro.
 */
export type EstiloDeFecha = 'fecha' | 'fecha-hora' | 'hora' | 'fecha-larga' | 'mes' | 'mes-anio' | 'mes-nombre';

const PATRONES: Readonly<Record<EstiloDeFecha, string>> = {
  fecha: 'd MMM y',
  'fecha-hora': 'd MMM y, HH:mm',
  hora: 'HH:mm',
  'fecha-larga': "d 'de' MMMM 'de' y",
  mes: 'MMM',
  'mes-anio': "MMMM 'de' y",
  'mes-nombre': 'MMMM',
};

/** «13 sept 2026». Patrón del estilo `fecha`; se conserva para quien lo citaba. */
export const FECHA_ADMINISTRATIVA = PATRONES.fecha;

/** «13 sept 2026, 16:29». Patrón del estilo `fecha-hora`. */
export const FECHA_Y_HORA_ADMINISTRATIVA = PATRONES['fecha-hora'];

export type ValorDeFecha = string | number | Date | null | undefined;

export interface OpcionesDeFecha {
  /**
   * El valor es una fecha de calendario aunque llegue como `Date` (p. ej. uno construido con
   * `new Date(año, mes, día)` para un evento de día completo): se pinta con sus componentes
   * locales, sin pasar por la zona de Bogotá. Las cadenas «AAAA-MM-DD» ya se reconocen solas.
   */
  calendario?: boolean;
  /** Lo que se devuelve si no hay fecha o no se puede leer. Por omisión, cadena vacía. */
  vacio?: string;
}

/** «2026-11-05»: lo que serializa un `DateOnly`. */
const FECHA_DE_CALENDARIO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** «2026-11-05T23:23:00» o con fracción, SIN zona. */
const INSTANTE_SIN_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/**
 * El desfase de Bogotá para ese instante, en el formato que admite `formatDate` («-0500»).
 *
 * Colombia no tiene horario de verano desde 1993 y el desfase es siempre −05:00, pero se calcula
 * con `Intl` para que la zona declarada sea de verdad `America/Bogota` y no un número escrito a
 * mano. Si el navegador no sabe calcularlo, se usa el valor conocido.
 */
function desfaseDeBogota(instante: Date): string {
  try {
    const nombre = new Intl.DateTimeFormat('en-US', { timeZone: ZONA_HORARIA_SIMUS, timeZoneName: 'longOffset' })
      .formatToParts(instante)
      .find(parte => parte.type === 'timeZoneName')?.value;
    const partes = /GMT([+-])(\d{2}):(\d{2})/.exec(nombre ?? '');
    if (partes) return `${partes[1]}${partes[2]}${partes[3]}`;
  } catch {
    // Navegador sin datos de zonas: se cae al valor conocido.
  }
  return '-0500';
}

/**
 * Formatea un instante o una fecha de calendario en español de Colombia y hora de Bogotá.
 *
 * - Cadena «AAAA-MM-DD» → fecha de calendario: no se desplaza.
 * - Cadena con hora y «Z» u desfase → instante: se pinta en hora de Bogotá.
 * - Cadena con hora SIN zona → se lee como UTC, que es la convención de la API de SIMUS.
 * - `Date` o número → instante, salvo `{ calendario: true }`.
 *
 * Una fecha de calendario no tiene hora: con el estilo `fecha-hora` se pinta solo la fecha, y con
 * `hora` no se pinta nada.
 */
export function formatearFecha(valor: ValorDeFecha, estilo: EstiloDeFecha = 'fecha', opciones: OpcionesDeFecha = {}): string {
  const vacio = opciones.vacio ?? '';
  if (valor === null || valor === undefined || valor === '') return vacio;

  if (typeof valor === 'string') {
    const texto = valor.trim();
    const calendario = FECHA_DE_CALENDARIO.exec(texto);
    if (calendario) {
      const [, anio, mes, dia] = calendario;
      return formatearCalendario(new Date(Number(anio), Number(mes) - 1, Number(dia)), estilo, vacio);
    }
    return formatearInstante(leerInstante(texto) ?? new Date(Number.NaN), estilo, vacio);
  }

  const fecha = valor instanceof Date ? valor : new Date(valor);
  return opciones.calendario ? formatearCalendario(fecha, estilo, vacio) : formatearInstante(fecha, estilo, vacio);
}

/**
 * «5 nov 2026 al 7 nov 2026», o una sola fecha si solo hay una o coinciden. Para ediciones y
 * eventos: fechas de calendario, que no se desplazan. Sin ninguna, cadena vacía.
 */
export function formatearRango(inicio: ValorDeFecha, fin: ValorDeFecha, estilo: EstiloDeFecha = 'fecha'): string {
  const desde = formatearFecha(inicio, estilo);
  const hasta = formatearFecha(fin, estilo);
  if (desde && hasta && desde !== hasta) return `${desde} al ${hasta}`;
  return desde || hasta;
}

/**
 * Lee un instante de la API como `Date`, con la misma regla: sin zona es UTC.
 *
 * Para cálculos («hace 3 horas»), no para pintar. `new Date('2026-11-05T23:23:00')` lo lee como
 * hora LOCAL, y con eso una solicitud recién enviada quedaba cinco horas en el futuro y decía
 * «ahora mismo» para siempre.
 */
export function leerInstante(valor: string | Date | null | undefined): Date | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const texto = valor.trim();
  const instante = new Date(INSTANTE_SIN_ZONA.test(texto) ? `${texto}Z` : texto);
  return Number.isNaN(instante.getTime()) ? null : instante;
}

function formatearInstante(instante: Date, estilo: EstiloDeFecha, vacio: string): string {
  if (Number.isNaN(instante.getTime())) return vacio;
  return formatDate(instante, PATRONES[estilo], IDIOMA_DE_FECHAS, desfaseDeBogota(instante));
}

/** Con los componentes locales del `Date` (sin zona): así no se corre de día. */
function formatearCalendario(fecha: Date, estilo: EstiloDeFecha, vacio: string): string {
  if (Number.isNaN(fecha.getTime())) return vacio;
  if (estilo === 'hora') return vacio;
  const sinHora: EstiloDeFecha = estilo === 'fecha-hora' ? 'fecha' : estilo;
  return formatDate(fecha, PATRONES[sinHora], IDIOMA_DE_FECHAS);
}
