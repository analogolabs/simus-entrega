import { EventoDeDiseno } from '../../../core/services/adaptadores-del-diseno';

/**
 * Un evento de la Agenda, en el formato que entienden los calendarios (A-6).
 *
 * <b>QUÉ HACÍA MAL EL ARCHIVO ANTERIOR.</b> Con hora, escribía `DTSTART:20260911T193000` (hora «flotante»: cada
 * calendario la interpreta en SU zona, así que un concierto a las 7 p. m. en Bogotá aparecía a otra hora fuera de
 * Colombia) y un `DTEND;VALUE=DATE:` de otro tipo: inicio con hora y fin de día completo, una combinación que el
 * estándar (RFC 5545 §3.8.2.2) no admite y que varios clientes rechazan o interpretan a su manera. Tampoco llevaba
 * la dirección del evento en el portal, ni recordatorio, ni plegado de líneas largas.
 *
 * <b>QUÉ HACE AHORA.</b>
 * <ul>
 *   <li>Con hora, `DTSTART;TZID=America/Bogota` y `DTEND;TZID=America/Bogota`, con su `VTIMEZONE` (Colombia no
 *       tiene horario de verano: UTC−5 todo el año). Sin hora, día completo (`VALUE=DATE`), con el fin exclusivo.</li>
 *   <li>El fin sale de la hora de fin del evento si la tiene. Si no la tiene, la Agenda no inventa una jornada:
 *       un evento de un día dura una hora desde el inicio (el valor por omisión de Google Calendar) y uno de varios
 *       días llega hasta el final del último día.</li>
 *   <li>La descripción lleva la página del evento en el portal (`URL` y texto), el organizador y, si existe, el
 *       enlace externo.</li>
 *   <li>Un recordatorio: una hora antes (con hora) o a las 9 de la mañana del día anterior (día completo).</li>
 *   <li>Las líneas de más de 75 octetos se pliegan, como exige el estándar, sin partir un carácter.</li>
 * </ul>
 *
 * El mismo intervalo alimenta los enlaces de «Google Calendar» y «Outlook», para que las tres vías del menú
 * añadan exactamente lo mismo.
 */

const ZONA = 'America/Bogota';
/** Colombia no cambia de hora: siempre UTC−5. */
const DESFASE = '-05:00';

const escaparTexto = (valor: string | null | undefined): string => String(valor ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/\r\n|\r|\n/g, '\\n')
  .replace(/,/g, '\\,')
  // DOS BARRAS Y NO UNA: en JavaScript '\;' es solo ';', así que el punto y coma llegaba sin
  // escapar al fichero y ICS lo lee como separador de parámetros, partiendo el campo en dos.
  .replace(/;/g, '\\;');

const marcaDeAhora = (): string => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Los meses del adaptador, para volver de «SEP» a «09». */
const MESES_ICS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** De «7:00 PM» a «190000». Solo para quien construye el evento sin la hora del servidor. */
const horaVeinticuatro = (hora: string): string | null => {
  const partes = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(hora.trim());
  if (!partes) { return null; }
  let horas = Number(partes[1]) % 12;
  if (partes[3].toUpperCase() === 'PM') { horas += 12; }
  return `${String(horas).padStart(2, '0')}${partes[2]}00`;
};

/** De «19:30» o «19:30:00» a «193000»; `null` si no hay hora legible. */
const horaDelServidor = (hora: string | null | undefined): string | null => {
  const partes = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec((hora ?? '').trim());
  if (!partes) { return null; }
  return `${partes[1].padStart(2, '0')}${partes[2]}${(partes[3] ?? '00')}`;
};

const horaDe = (evento: EventoDeDiseno, de: 'inicio' | 'fin'): string | null => {
  if (de === 'fin') { return horaDelServidor(evento.horaFin); }
  return horaDelServidor(evento.horaInicio) ?? horaVeinticuatro(evento.time ?? '');
};

/** Un instante en hora de Bogotá, sin zona: se opera con aritmética UTC sobre los mismos números. */
interface Local { f: string; h: string }
const aDate = ({ f, h }: Local): Date =>
  new Date(Date.UTC(+f.slice(0, 4), +f.slice(4, 6) - 1, +f.slice(6, 8), +h.slice(0, 2), +h.slice(2, 4), +h.slice(4, 6)));
const deDate = (d: Date): Local => ({
  f: d.toISOString().slice(0, 10).replace(/-/g, ''),
  h: d.toISOString().slice(11, 19).replace(/:/g, ''),
});

const diaSiguiente = (fecha: string): string =>
  deDate(new Date(aDate({ f: fecha, h: '000000' }).getTime() + 86_400_000)).f;

/** Cuándo ocurre el evento: lo único que los tres formatos de salida necesitan saber. */
export interface IntervaloDelEvento {
  diaCompleto: boolean;
  /** `YYYYMMDD` (día completo) o `YYYYMMDDTHHMMSS` (con hora, en hora de Bogotá). */
  inicio: string;
  /** El fin; en día completo es EXCLUSIVO (el día siguiente al último). */
  fin: string;
}

export function intervaloDelEvento(evento: EventoDeDiseno): IntervaloDelEvento {
  const inicioIso = `${evento.y}${String(MESES_ICS.indexOf(evento.m) + 1).padStart(2, '0')}${String(evento.d).padStart(2, '0')}`;
  const finDeclarado = (evento.fechaFin || '').replace(/-/g, '').slice(0, 8);
  // Un fin anterior al inicio es un dato roto: se trata como evento de un día.
  const ultimoDia = finDeclarado && finDeclarado >= inicioIso ? finDeclarado : inicioIso;

  const horaIni = horaDe(evento, 'inicio');
  if (!horaIni) {
    return { diaCompleto: true, inicio: inicioIso, fin: diaSiguiente(ultimoDia) };
  }

  const inicio: Local = { f: inicioIso, h: horaIni };
  const horaFin = horaDe(evento, 'fin');
  let fin: Local;
  if (horaFin) {
    fin = { f: ultimoDia, h: horaFin };
    // Una hora de fin que no es posterior al inicio es un dato roto (o un evento que cruza la medianoche
    // sin declararlo): se cae al valor por omisión.
    if (aDate(fin) <= aDate(inicio)) { fin = deDate(new Date(aDate(inicio).getTime() + 3_600_000)); }
  } else if (ultimoDia > inicioIso) {
    fin = { f: ultimoDia, h: '235900' };
  } else {
    fin = deDate(new Date(aDate(inicio).getTime() + 3_600_000));
  }
  return { diaCompleto: false, inicio: `${inicio.f}T${inicio.h}`, fin: `${fin.f}T${fin.h}` };
}

/** Dónde ocurre, tal como lo leería una persona en su calendario. */
const lugarDe = (evento: EventoDeDiseno): string => {
  const partes = [evento.exactLocation, evento.l, 'Colombia'];
  return [...new Set(partes.filter(p => p && String(p).trim().length > 0))].join(', ');
};

/** La dirección del evento en el portal. Sin `origen` (pruebas, servidor) devuelve la ruta relativa. */
export function urlDelEvento(evento: EventoDeDiseno, origen = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origen}/agenda/${encodeURIComponent(evento.slug || evento.id)}`;
}

/** El texto largo de la entrada de calendario: descripción, quién organiza y a dónde ir. */
function descripcionDe(evento: EventoDeDiseno, url: string): string {
  return [
    evento.desc,
    evento.organizer ? `Organiza: ${evento.organizer}` : '',
    url ? `Página del evento: ${url}` : '',
    evento.link ? `Más información: ${evento.link}` : '',
  ].filter(Boolean).join('\n');
}

/** Pliega una línea a 75 octetos UTF-8 como máximo por tramo (RFC 5545 §3.1), sin partir un carácter. */
export function plegarLinea(linea: string): string {
  const codificador = new TextEncoder();
  if (codificador.encode(linea).length <= 75) { return linea; }
  const tramos: string[] = [];
  let actual = '';
  let octetos = 0;
  // El primer tramo admite 75 octetos; los siguientes 74, porque llevan un espacio delante.
  let tope = 75;
  for (const caracter of linea) {
    const largo = codificador.encode(caracter).length;
    if (octetos + largo > tope) {
      tramos.push(actual);
      actual = '';
      octetos = 0;
      tope = 74;
    }
    actual += caracter;
    octetos += largo;
  }
  if (actual) { tramos.push(actual); }
  return tramos.join('\r\n ');
}

const ZONA_HORARIA = [
  'BEGIN:VTIMEZONE',
  `TZID:${ZONA}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0500',
  'TZNAME:-05',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/**
 * El evento del diseño aprobado, en formato de calendario.
 *
 * <b>CONSERVA EL NOMBRE QUE USA LA PLANTILLA</b> —`buildAgendaEventIcs`—. `url` es la página del evento en el
 * portal; si no se da, se calcula con el origen de la ventana.
 */
export function buildAgendaEventIcs(evento: EventoDeDiseno, url: string = urlDelEvento(evento)): string {
  const { diaCompleto, inicio, fin } = intervaloDelEvento(evento);
  const resumen = escaparTexto(evento.t);

  const tiempo = diaCompleto
    ? [`DTSTART;VALUE=DATE:${inicio}`, `DTEND;VALUE=DATE:${fin}`]
    : [`DTSTART;TZID=${ZONA}:${inicio}`, `DTEND;TZID=${ZONA}:${fin}`];

  const recordatorio = evento.cancelado ? [] : [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escaparTexto(`Recordatorio: ${evento.t}`)}`,
    // Con hora, una hora antes; de día completo, a las 9 de la mañana del día anterior.
    `TRIGGER:${diaCompleto ? '-PT15H' : '-PT1H'}`,
    'END:VALARM',
  ];

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIMUS//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${ZONA}`,
    ...(diaCompleto ? [] : ZONA_HORARIA),
    'BEGIN:VEVENT',
    `UID:${evento.slug || evento.id}@simus-web`,
    `DTSTAMP:${marcaDeAhora()}`,
    'SEQUENCE:0',
    ...tiempo,
    // UN EVENTO CANCELADO SE AÑADE COMO CANCELADO: el calendario de quien ya lo tenía lo tacha en
    // vez de dejarlo esperándolo (D3-13).
    ...(evento.cancelado ? ['STATUS:CANCELLED'] : []),
    `SUMMARY:${evento.cancelado ? `Cancelado: ${resumen}` : resumen}`,
    `DESCRIPTION:${escaparTexto(descripcionDe(evento, url))}`,
    `LOCATION:${escaparTexto(lugarDe(evento))}`,
    ...(url ? [`URL:${url}`] : []),
    ...recordatorio,
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(plegarLinea).join('\r\n') + '\r\n';
}

const codificar = (valor: string): string => encodeURIComponent(valor);

/** El enlace que abre «Nuevo evento» en Google Calendar con todo ya escrito. */
export function enlaceDeGoogleCalendar(evento: EventoDeDiseno, url: string = urlDelEvento(evento)): string {
  const { diaCompleto, inicio, fin } = intervaloDelEvento(evento);
  const partes = [
    'action=TEMPLATE',
    `text=${codificar(evento.cancelado ? `Cancelado: ${evento.t}` : evento.t)}`,
    // La barra entre fechas es literal: así lo documenta Google y así lo lee.
    `dates=${inicio}/${fin}`,
    `details=${codificar(descripcionDe(evento, url))}`,
    `location=${codificar(lugarDe(evento))}`,
    ...(diaCompleto ? [] : [`ctz=${ZONA}`]),
  ];
  return `https://calendar.google.com/calendar/render?${partes.join('&')}`;
}

/** El enlace que abre «Nuevo evento» en Outlook en la web (outlook.live.com; las cuentas de trabajo lo redirigen a Office). */
export function enlaceDeOutlook(evento: EventoDeDiseno, url: string = urlDelEvento(evento)): string {
  const { diaCompleto, inicio, fin } = intervaloDelEvento(evento);
  const iso = (valor: string): string => diaCompleto
    ? `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6, 8)}`
    : `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6, 8)}T${valor.slice(9, 11)}:${valor.slice(11, 13)}:${valor.slice(13, 15)}${DESFASE}`;
  const partes = [
    'path=%2Fcalendar%2Faction%2Fcompose',
    'rru=addevent',
    `subject=${codificar(evento.cancelado ? `Cancelado: ${evento.t}` : evento.t)}`,
    `startdt=${codificar(iso(inicio))}`,
    `enddt=${codificar(iso(fin))}`,
    ...(diaCompleto ? ['allday=true'] : []),
    `body=${codificar(descripcionDe(evento, url))}`,
    `location=${codificar(lugarDe(evento))}`,
  ];
  return `https://outlook.live.com/calendar/0/deeplink/compose?${partes.join('&')}`;
}

/** El nombre del archivo `.ics`: el título sin tildes ni signos. */
export function nombreDelIcs(evento: EventoDeDiseno): string {
  const nombreSeguro = (evento.t || 'evento-simus').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${nombreSeguro || 'evento-simus'}.ics`;
}

/**
 * Descarga el evento como archivo `.ics`. Lo comparten la lista de Agenda y la ficha del evento
 *: un solo camino para «Añadir a mi calendario».
 */
export function descargarEventoIcs(evento: EventoDeDiseno): void {
  const contenido = buildAgendaEventIcs(evento);
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreDelIcs(evento);
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  window.URL.revokeObjectURL(url);
}
