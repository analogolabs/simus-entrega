import { buildAgendaEventIcs, enlaceDeGoogleCalendar, enlaceDeOutlook, intervaloDelEvento, nombreDelIcs, plegarLinea } from './agenda-ics';
import { EventoDeDiseno } from '../../../core/services/adaptadores-del-diseno';

/**
 * El evento en el calendario de quien lo añade.
 *
 * <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que un evento de un solo día llegue al calendario con
 * duración cero. `DTEND` es EXCLUSIVO en el formato ICS: declarar el mismo día como fin produce un
 * evento que varios clientes no dibujan. Por eso el fin es siempre el día siguiente al último.
 */
describe('construirIcsDeEvento', () => {
  function evento(parcial: Partial<EventoDeDiseno> = {}): EventoDeDiseno {
    return {
      id: '1', slug: 'semana-de-la-musica', t: 'Semana de la Música', desc: 'Encuentro abierto.',
      d: '11', m: 'SEP', y: '2026', fechaFin: '2026-09-11', time: '',
      l: 'PAIPA, BOYACÁ', cat: 'Festivales', img: '', organizer: '',
      exactLocation: 'Teatro Municipal', link: '', dateObj: new Date(2026, 8, 11, 12),
      departmentCode: '15', municipalityCode: '15516',
      department: 'BOYACÁ', municipality: 'PAIPA', situacion: 'proximo',
      ...parcial,
    };
  }

  it('un evento cancelado se añade como cancelado, para que el calendario lo tache (D3-13)', () => {
    const ics = buildAgendaEventIcs(evento({ cancelado: true, motivoCancelacion: 'Lluvia.' }));

    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('SUMMARY:Cancelado: Semana de la Música');
  });

  it('un evento sin cancelar no lleva estado ni se renombra', () => {
    const ics = buildAgendaEventIcs(evento({}));

    expect(ics).not.toContain('STATUS:');
    expect(ics).toContain('SUMMARY:Semana de la Música');
  });

  it('un evento de un solo día termina al día siguiente, porque DTEND es exclusivo', () => {
    const ics = buildAgendaEventIcs(evento({}));

    expect(ics).toContain('DTSTART;VALUE=DATE:20260911');
    expect(ics).toContain('DTEND;VALUE=DATE:20260912');
  });

  it('un evento de varios días llega entero', () => {
    const ics = buildAgendaEventIcs(evento({ fechaFin: '2026-09-16' }));

    expect(ics).toContain('DTSTART;VALUE=DATE:20260911');
    expect(ics).toContain('DTEND;VALUE=DATE:20260917');
  });

  it('con hora, inicio y fin van en hora de Bogotá, con su zona declarada (A-6)', () => {
    const ics = buildAgendaEventIcs(evento({ horaInicio: '19:30:00', horaFin: '22:00:00', time: '7:30 PM' }));

    // ANTES: `DTSTART:...T193000` sin zona (hora flotante) y un `DTEND` de día completo, que mezcla dos tipos y
    // el estándar no admite. Cada calendario ponía la hora en SU zona.
    expect(ics).toContain('DTSTART;TZID=America/Bogota:20260911T193000');
    expect(ics).toContain('DTEND;TZID=America/Bogota:20260911T220000');
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:America/Bogota');
    expect(ics).not.toContain('DTEND;VALUE=DATE');
  });

  it('con hora y sin hora de fin, dura una hora si es de un día (no se inventa una jornada)', () => {
    const ics = buildAgendaEventIcs(evento({ horaInicio: '19:30:00', time: '7:30 PM' }));

    expect(ics).toContain('DTSTART;TZID=America/Bogota:20260911T193000');
    expect(ics).toContain('DTEND;TZID=America/Bogota:20260911T203000');
  });

  it('con hora, sin hora de fin y de varios días, llega al final del último día', () => {
    const ics = buildAgendaEventIcs(evento({ horaInicio: '09:00:00', time: '9:00 AM', fechaFin: '2026-09-13' }));

    expect(ics).toContain('DTSTART;TZID=America/Bogota:20260911T090000');
    expect(ics).toContain('DTEND;TZID=America/Bogota:20260913T235900');
  });

  it('una hora de fin que no es posterior al inicio se descarta', () => {
    const ics = buildAgendaEventIcs(evento({ horaInicio: '22:00:00', horaFin: '21:00:00', time: '10:00 PM' }));

    expect(ics).toContain('DTEND;TZID=America/Bogota:20260911T230000');
  });

  it('un inicio a las 23:30 sin fin cruza la medianoche al día siguiente', () => {
    const ics = buildAgendaEventIcs(evento({ horaInicio: '23:30:00', time: '11:30 PM' }));

    expect(ics).toContain('DTEND;TZID=America/Bogota:20260912T003000');
  });

  it('sin la hora del servidor, usa la del diseño («7:30 PM») para no perderla', () => {
    expect(intervaloDelEvento(evento({ time: '7:30 PM' })).inicio).toBe('20260911T193000');
  });

  it('la entrada lleva la página del evento, el organizador y un recordatorio', () => {
    // Se desdobla (CRLF + espacio): las líneas largas viajan plegadas.
    const ics = buildAgendaEventIcs(evento({ organizer: 'Tambó' }), 'https://simus.test/agenda/semana-de-la-musica').replace(/\r\n /g, '');

    expect(ics).toContain('URL:https://simus.test/agenda/semana-de-la-musica');
    expect(ics).toContain('Organiza: Tambó\\nPágina del evento: https://simus.test/agenda/semana-de-la-musica');
    expect(ics).toContain('BEGIN:VALARM');
    // Día completo: a las 9 de la mañana del día anterior.
    expect(ics).toContain('TRIGGER:-PT15H');
    expect(buildAgendaEventIcs(evento({ horaInicio: '19:30:00' })).includes('TRIGGER:-PT1H')).toBeTrue();
  });

  it('un evento cancelado no lleva recordatorio', () => {
    expect(buildAgendaEventIcs(evento({ cancelado: true }))).not.toContain('VALARM');
  });

  it('usa CRLF, termina con salto de línea y ninguna línea pasa de 75 octetos', () => {
    const ics = buildAgendaEventIcs(evento({ desc: 'Una descripción muy larga con tildes y eñes: ' + 'música colombiana, '.repeat(20) }));

    expect(ics.endsWith('\r\n')).toBeTrue();
    expect(ics).not.toMatch(/[^\r]\n/);
    for (const linea of ics.split('\r\n')) {
      expect(new TextEncoder().encode(linea).length).toBeLessThanOrEqual(75);
    }
  });

  it('plegar no parte un carácter de varios octetos', () => {
    const plegada = plegarLinea('DESCRIPTION:' + 'ñ'.repeat(60));
    // Desplegada (se quita CRLF + espacio) vuelve a ser la misma línea.
    expect(plegada.replace(/\r\n /g, '')).toBe('DESCRIPTION:' + 'ñ'.repeat(60));
  });

  it('el enlace de Google Calendar lleva fechas, zona, lugar y la página del evento', () => {
    const enlace = enlaceDeGoogleCalendar(evento({ horaInicio: '19:30:00', horaFin: '22:00:00' }), 'https://simus.test/agenda/x');
    const url = new URL(enlace);

    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Semana de la Música');
    expect(url.searchParams.get('dates')).toBe('20260911T193000/20260911T220000');
    expect(url.searchParams.get('ctz')).toBe('America/Bogota');
    expect(url.searchParams.get('details')).toContain('https://simus.test/agenda/x');
    expect(url.searchParams.get('location')).toContain('Teatro Municipal');
  });

  it('el enlace de Google Calendar de un evento de día completo usa fechas sin hora y fin exclusivo', () => {
    const url = new URL(enlaceDeGoogleCalendar(evento({ fechaFin: '2026-09-16' })));

    expect(url.searchParams.get('dates')).toBe('20260911/20260917');
    expect(url.searchParams.has('ctz')).toBeFalse();
  });

  it('el enlace de Outlook lleva el desfase de Bogotá, o «allday» si no hay hora', () => {
    const conHora = new URL(enlaceDeOutlook(evento({ horaInicio: '19:30:00', horaFin: '22:00:00' })));
    expect(conHora.searchParams.get('startdt')).toBe('2026-09-11T19:30:00-05:00');
    expect(conHora.searchParams.get('enddt')).toBe('2026-09-11T22:00:00-05:00');
    expect(conHora.searchParams.has('allday')).toBeFalse();

    const diaCompleto = new URL(enlaceDeOutlook(evento({})));
    expect(diaCompleto.searchParams.get('startdt')).toBe('2026-09-11');
    expect(diaCompleto.searchParams.get('allday')).toBe('true');
  });

  it('el archivo se llama como el evento, sin tildes ni signos', () => {
    expect(nombreDelIcs(evento({ t: 'Semana de la Música: ¡Paipa 2026!' }))).toBe('semana-de-la-musica-paipa-2026.ics');
  });

  it('el lugar reúne sede, municipio y departamento, y siempre acaba en Colombia', () => {
    const ics = buildAgendaEventIcs(evento({}));

    expect(ics).toContain('LOCATION:Teatro Municipal\\, PAIPA\\, BOYACÁ\\, Colombia');
  });

  it('un evento virtual sin sede no deja separadores sueltos en el lugar', () => {
    const ics = buildAgendaEventIcs(evento({ exactLocation: '', l: '' }));

    expect(ics).toContain('LOCATION:Colombia');
  });

  it('escapa las comas y los puntos y coma del texto', () => {
    // EL PUNTO Y COMA LLEGABA SIN ESCAPAR: el código escribía '\;', que en JavaScript es solo
    // ';', y ICS lo lee como separador de parámetros, partiendo el campo en dos. Un título con
    // «Bandas; edición 2026» rompía la línea SUMMARY en el calendario de quien lo añadía.
    const ics = buildAgendaEventIcs(evento({ t: 'Bandas; edición 2026, Paipa' }));

    expect(ics).toContain('SUMMARY:Bandas\\; edición 2026\\, Paipa');
  });

  it('la identidad del evento es su dirección, que no cambia', () => {
    const ics = buildAgendaEventIcs(evento({}));

    // ASI EL CALENDARIO ACTUALIZA en vez de duplicar cuando alguien lo vuelve a añadir.
    expect(ics).toContain('UID:semana-de-la-musica@simus-web');
  });
});
