import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AgendaService, EventoAgenda } from '../../../../core/services/agenda.service';
import { Noticia, NoticiasService } from '../../../../core/services/noticias.service';
import { IMAGENES_DE_RESPALDO_DE_NOTICIAS } from '../../../../shared/utils/imagen-de-noticia';
import { NoticiasAgendaPreviewComponent } from './noticias-agenda-preview.component';

/**
 * «Actualidad» de la portada: las noticias y los eventos son enlaces a SU
 * dirección, el evento no se pinta con la categoría encima del lugar y las noticias sin portada
 * llevan la misma foto de respaldo que en la lista.
 */
describe('NoticiasAgendaPreviewComponent', () => {
  const noticia = (id: number, extra: Partial<Noticia> = {}): Noticia => ({
    id, slug: `noticia-${id}`, titulo: `Noticia ${id}`, resumen: 'Resumen.', cuerpo: null, fechaPublicacion: '2026-11-04T10:00:00Z',
    imagenRuta: null, imagenAlternativa: null, autoriaNombre: null, imagenArchivoId: null, imagenUrl: null, imagenAlt: null,
    categoriaId: 1, categoria: 'Institucional', estado: 'publicado', estadoEfectivo: 'publicado', version: 1, etiquetas: [],
    practicasMusicales: [], territoriosSonoros: [], procedencia: null, proyectosTransversales: [], fechaActualizacion: '2026-11-04T10:00:00Z',
    ...extra,
  } as Noticia);

  const evento = (id: number, extra: Partial<EventoAgenda> = {}): EventoAgenda => ({
    id, slug: `evento-${id}`, titulo: `Evento ${id}`, descripcion: 'Descripción del evento.', fechaInicio: '2026-11-0' + id, fechaFin: null,
    horaInicio: null, modalidad: 'presencial', lugar: null, codigoDepartamento: '15', nombreDepartamento: 'Boyacá', codigoMunicipio: '15087',
    nombreMunicipio: 'Bojacá', url: null, imagenRuta: null, imagenAlternativa: null, categoriaId: 1, categoria: 'Festivales', organizador: null,
    descripcionLarga: null, horaFin: null, nivelCobertura: 'municipal', ordenVisualizacion: null, festivalId: null, imagenArchivoId: null,
    imagenUrl: null, imagenAlt: null, estado: 'publicado', situacion: 'proximo', version: 1, etiquetas: [], practicasMusicales: [],
    territoriosSonoros: [], procedencia: null, proyectosTransversales: [], fechaActualizacion: '2026-11-01T00:00:00Z', ...extra,
  } as EventoAgenda);

  async function montar(noticias: Noticia[], eventos: EventoAgenda[]) {
    TestBed.configureTestingModule({
      imports: [NoticiasAgendaPreviewComponent],
      providers: [
        provideRouter([]),
        { provide: NoticiasService, useValue: { listarPublicas: () => Promise.resolve({ ok: true, data: { items: noticias } }) } },
        { provide: AgendaService, useValue: { listarPublicos: () => Promise.resolve({ ok: true, data: { items: eventos } }) } },
      ],
    });
    const fixture = TestBed.createComponent(NoticiasAgendaPreviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('cada evento es un enlace a su propia dirección y no a la Agenda en general', async () => {
    const raiz = await montar([noticia(1)], [evento(1), evento(2)]);
    const enlaces = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('[data-testid="portada-evento"]'));

    expect(enlaces.map(a => a.getAttribute('href'))).toEqual(['/agenda/evento-1', '/agenda/evento-2']);
  });

  it('con categoría y municipio largos, cada dato queda en su renglón con recorte y nada se superpone', async () => {
    const raiz = await montar([noticia(1)], [evento(1, {
      categoria: 'Convocatorias y oportunidades para la circulación',
      nombreMunicipio: 'San Juan Bautista de Guacarí del Valle',
    })]);
    const tarjeta = raiz.querySelector('[data-testid="portada-evento"]')!;
    const categoria = Array.from(tarjeta.querySelectorAll('span.truncate')).find(s => s.textContent?.includes('Convocatorias'))!;
    const lugar = Array.from(tarjeta.querySelectorAll('span.truncate')).find(s => s.textContent?.includes('Guacarí'))!;

    // Cada uno en su propio renglón (bloques distintos) y con elipsis, no uno al lado del otro.
    expect(categoria.className).toContain('truncate');
    expect(lugar).toBeTruthy();
    expect(categoria.parentElement).toBe(lugar.parentElement!.parentElement as HTMLElement);
    // La altura ya no es fija: una tarjeta con más renglones crece en lugar de taparse.
    expect(tarjeta.className).not.toMatch(/(^|\s)h-\[7\.5rem\]/);
    expect(tarjeta.className).toContain('min-h-[7.5rem]');
  });

  it('las noticias son enlaces a su dirección y una sin portada lleva la foto de respaldo, la misma que en la lista', async () => {
    const raiz = await montar([noticia(1), noticia(2), noticia(3)], [evento(1)]);
    const titulares = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('h4 a'));

    expect(titulares.map(a => a.getAttribute('href'))).toEqual(['/noticias/noticia-1', '/noticias/noticia-2', '/noticias/noticia-3']);
    const imagenes = Array.from(raiz.querySelectorAll<HTMLImageElement>('article img')).map(i => i.getAttribute('src'));
    expect(imagenes.length).toBe(3);
    imagenes.forEach(src => expect(IMAGENES_DE_RESPALDO_DE_NOTICIAS).toContain(src as string));
  });

  it('lleva la principal y cuatro secundarias, y en pantalla estrecha solo se ven dos de ellas (H-3)', async () => {
    const raiz = await montar([1, 2, 3, 4, 5, 6].map(id => noticia(id)), [evento(1)]);
    const secundarias = Array.from(raiz.querySelectorAll<HTMLElement>('[data-testid="noticias-secundarias-inicio"] article'));

    // Se pintan la principal (1) y las cuatro siguientes; la sexta sobra.
    expect(raiz.querySelectorAll('h4 a').length).toBe(5);
    expect(secundarias.map(a => a.querySelector('a')!.getAttribute('href'))).toEqual([
      '/noticias/noticia-2', '/noticias/noticia-3', '/noticias/noticia-4', '/noticias/noticia-5',
    ]);
    // A <768 px las dos últimas se ocultan, como antes de H-3.
    expect(secundarias.map(a => a.className.includes('max-md:hidden'))).toEqual([false, false, true, true]);
  });
});
