import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { AgendaService, EventoAgenda } from '../../../../core/services/agenda.service';
import { EventoAgendaPageComponent } from './evento-agenda-page.component';

/**
 * La ficha de un evento de la Agenda, en `/agenda/:slug`.
 *
 * El defecto que fija: el evento vivía dentro de un acordeón sin dirección, «Más información» no
 * hacía nada sin enlace externo, y un evento que no existe no tenía estado propio.
 */
describe('EventoAgendaPageComponent', () => {
  const evento: EventoAgenda = {
    id: 7, slug: 'conciertos-de-chirimia', titulo: 'Conciertos de Chirimía', descripcion: 'Programación central.',
    fechaInicio: '2026-11-07', fechaFin: '2026-11-09', horaInicio: '15:00:00', modalidad: 'presencial',
    lugar: 'Casa de la Cultura', codigoDepartamento: '15', nombreDepartamento: 'Boyacá', codigoMunicipio: '15087', nombreMunicipio: 'Bojacá',
    url: null, imagenRuta: null, imagenAlternativa: null, categoriaId: 1, categoria: 'Festivales', organizador: 'Corporación Tambó',
    descripcionLarga: null, horaFin: null, nivelCobertura: 'municipal', ordenVisualizacion: null, festivalId: null, imagenArchivoId: null,
    imagenUrl: null, imagenAlt: null, estado: 'publicado', situacion: 'proximo', version: 1, etiquetas: [], practicasMusicales: [],
    territoriosSonoros: [], procedencia: null, proyectosTransversales: [], fechaActualizacion: '2026-11-01T00:00:00Z',
  };

  function montar(respuesta: { ok: boolean; data?: EventoAgenda | null; error?: string }) {
    TestBed.resetTestingModule();
    const pedidos: string[] = [];
    TestBed.configureTestingModule({
      imports: [EventoAgendaPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ slug: 'conciertos-de-chirimia' })) } },
        { provide: AgendaService, useValue: { obtenerPublico: (slug: string) => { pedidos.push(slug); return Promise.resolve(respuesta); } } },
      ],
    });
    const fixture = TestBed.createComponent(EventoAgendaPageComponent);
    fixture.detectChanges();
    return { fixture, pedidos, raiz: fixture.nativeElement as HTMLElement };
  }

  async function esperar(fixture: ReturnType<typeof montar>['fixture']) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('«Volver a la agenda» es el enlace común (flecha de icono) y devuelve los filtros con que se abrió el evento (A-7)', async () => {
    sessionStorage.setItem('simus:agenda:filtros', '?q=chirimia&mes=11');
    const { fixture, raiz } = montar({ ok: true, data: evento });
    await esperar(fixture);

    const enlace = raiz.querySelector<HTMLAnchorElement>('[data-testid="evento-volver-a-la-agenda"] a, a[data-testid="evento-volver-a-la-agenda"]')!;
    expect(enlace.textContent).toContain('Volver a la agenda');
    expect(enlace.querySelector('svg')).not.toBeNull();
    expect(enlace.getAttribute('href')).toBe('/agenda?q=chirimia&mes=11');
    // Ya no existe la flecha de texto.
    expect(raiz.textContent).not.toContain('← Agenda');
    expect(raiz.textContent).not.toContain('← Toda la agenda');
    sessionStorage.removeItem('simus:agenda:filtros');
  });

  it('si se llegó por un enlace, «Volver a la agenda» abre la lista sin filtros', async () => {
    sessionStorage.removeItem('simus:agenda:filtros');
    const { fixture, raiz } = montar({ ok: true, data: evento });
    await esperar(fixture);

    expect(raiz.querySelector<HTMLAnchorElement>('a[data-testid="evento-volver-a-la-agenda"]')!.getAttribute('href')).toBe('/agenda');
  });

  it('«Añadir a mi calendario» es un menú con Google Calendar, Outlook y el archivo (A-6)', async () => {
    const { fixture, raiz } = montar({ ok: true, data: evento });
    await esperar(fixture);

    raiz.querySelector<HTMLButtonElement>('[data-testid="evento-calendario"]')!.click();
    fixture.detectChanges();
    const opciones = Array.from(raiz.querySelectorAll('[role="menuitem"]')).map(o => o.textContent?.replace(/\s+/g, ' ').trim());
    expect(opciones[0]).toContain('Google Calendar');
    expect(opciones[1]).toContain('Outlook');
    expect(opciones[2]).toContain('Descargar archivo (.ics)');
  });

  it('pide el evento por la dirección de la URL y lo pinta con lugar y territorio en renglones propios', async () => {
    const { fixture, raiz, pedidos } = montar({ ok: true, data: evento });
    await esperar(fixture);

    expect(pedidos).toEqual(['conciertos-de-chirimia']);
    expect(raiz.querySelector('h1')?.textContent).toContain('Conciertos de Chirimía');
    expect(raiz.querySelector('[data-testid="evento-lugar"]')?.textContent?.trim()).toBe('Casa de la Cultura');
    // El territorio es municipio y departamento, en su propia línea (antes: «Casa de la Cultura de 76100, Colombia»).
    expect(raiz.querySelector('[data-testid="evento-territorio"]')?.textContent?.trim()).toBe('Bojacá, Boyacá');
    expect(raiz.querySelector('[data-testid="evento-cuando"]')?.textContent).toContain('2026');
    expect(raiz.querySelector('[data-testid="evento-situacion"]')?.textContent?.trim()).toBe('Próximo');
  });

  it('la pestaña dice qué evento es', async () => {
    const { fixture } = montar({ ok: true, data: evento });
    await esperar(fixture);

    expect(TestBed.inject(Title).getTitle()).toBe('Conciertos de Chirimía · Agenda · SIMUS');
  });

  it('«Más información» solo existe cuando el evento trae un enlace, y se abre en otra pestaña', async () => {
    const sin = montar({ ok: true, data: evento });
    await esperar(sin.fixture);
    expect(sin.raiz.querySelector('[data-testid="evento-mas-informacion"]')).withContext('sin enlace no debe haber botón muerto').toBeNull();

    const con = montar({ ok: true, data: { ...evento, url: 'https://ejemplo.org/chirimia' } });
    await esperar(con.fixture);
    const enlace = con.raiz.querySelector<HTMLAnchorElement>('[data-testid="evento-mas-informacion"]')!;
    expect(enlace.getAttribute('href')).toBe('https://ejemplo.org/chirimia');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(enlace.getAttribute('rel')).toContain('noopener');
    // Rótulo corto con icono; el aviso de pestaña nueva queda para lectores de pantalla (no se pinta en el texto).
    expect(enlace.textContent?.trim()).toBe('Enlace externo');
    expect(enlace.getAttribute('aria-label')).toContain('se abre en otra pestaña');
    expect(enlace.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('las etiquetas del evento van al final de «Más información» y cada una lleva a la agenda filtrada', async () => {
    const etiquetado = montar({ ok: true, data: { ...evento, proyectosTransversales: [{ id: 3, nombre: 'Celebra la Música 2026', slug: 'celebra-la-musica-2026' }] } });
    await esperar(etiquetado.fixture);
    const seccion = etiquetado.raiz.querySelector('[data-testid="evento-mas-informacion-seccion"]')!;
    const enlace = seccion.querySelector<HTMLAnchorElement>('a[data-etiqueta]')!;
    expect(enlace.textContent).toContain('Celebra la Música 2026');
    expect(enlace.getAttribute('href')).toContain('/agenda?proyecto=celebra-la-musica-2026');
    expect(seccion.querySelector('select, [role="listbox"]')).toBeNull();
  });

  it('un evento cancelado sigue en la agenda, dice que fue cancelado y por qué (D3-13)', async () => {
    const { fixture, raiz } = montar({ ok: true, data: { ...evento, cancelado: true, motivoCancelacion: 'Lluvia en toda la región.' } });
    await esperar(fixture);

    expect(raiz.querySelector('[data-testid="evento-cancelado"]')?.textContent).toContain('Este evento fue cancelado');
    expect(raiz.querySelector('[data-testid="evento-motivo-cancelacion"]')?.textContent?.trim()).toBe('Lluvia en toda la región.');
    // LA SITUACIÓN DE TIEMPO NO SE PISA, pero la marca manda en lo que se lee.
    expect(raiz.querySelector('[data-testid="evento-situacion"]')?.textContent?.trim()).toBe('Cancelado');
  });

  it('un evento sin cancelar no enseña el aviso', async () => {
    const { fixture, raiz } = montar({ ok: true, data: evento });
    await esperar(fixture);

    expect(raiz.querySelector('[data-testid="evento-cancelado"]')).toBeNull();
  });

  it('dice de qué Festival es y quién lo organiza, con enlaces, cuando el servidor lo manda (D3-15)', async () => {
    const { fixture, raiz } = montar({
      ok: true,
      data: { ...evento, proceso: { tipo: 'festival', id: 12, nombre: 'Festival de Chirimía', organizacionId: 5, organizacionNombre: 'Corporación Tambó' } },
    });
    await esperar(fixture);

    const enlace = raiz.querySelector<HTMLAnchorElement>('[data-testid="evento-proceso-enlace"]')!;
    expect(enlace.textContent?.trim()).toBe('Festival de Chirimía');
    expect(enlace.getAttribute('href')).toBe('/ecosistema/festivales/12');
    expect(raiz.querySelector('[data-testid="evento-organiza"] dd:first-of-type a')?.getAttribute('href')).toBe('/ecosistema/organizaciones/5');
  });

  it('un evento de un Mercado enlaza al Mercado musical, y una organización que no es pública se nombra sin enlace', async () => {
    const { fixture, raiz } = montar({
      ok: true,
      data: { ...evento, proceso: { tipo: 'mercado', id: 3, nombre: 'Mercado del Valle', organizacionId: null, organizacionNombre: 'Colectivo Valle' } },
    });
    await esperar(fixture);

    expect(raiz.querySelector('[data-testid="evento-proceso-enlace"]')?.getAttribute('href')).toBe('/ecosistema/mercados-musicales/3');
    expect(raiz.querySelector('[data-testid="evento-organiza"]')?.textContent).toContain('Colectivo Valle');
    expect(raiz.querySelector('[data-testid="evento-organiza"] dd:first-of-type a')).toBeNull();
  });

  it('un evento que no existe o no está publicado dice qué pasó y ofrece la lista y el inicio', async () => {
    const { fixture, raiz } = montar({ ok: false, error: 'No fue posible abrir el evento.' });
    await esperar(fixture);

    expect(raiz.querySelector('[data-testid="recurso-no-encontrado"]')).not.toBeNull();
    expect(raiz.querySelector('h1')?.textContent).toContain('No encontramos ese evento');
    expect(raiz.querySelector('[data-testid="rne-lista"]')?.getAttribute('href')).toBe('/agenda');
    expect(raiz.querySelector('[data-testid="rne-inicio"]')?.getAttribute('href')).toBe('/');
    expect(raiz.querySelector('[data-testid="evento-agenda"]')).toBeNull();
  });
});
