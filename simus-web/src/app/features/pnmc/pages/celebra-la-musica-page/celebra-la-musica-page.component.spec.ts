import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CelebraLaMusicaPageComponent } from './celebra-la-musica-page.component';
import { textoLegibleSobre } from '../../../../shared/utils/contraste-de-color';
import { CelebraLaMusicaService, EdicionDeCelebra, EdicionDeCelebraResumen } from '../../../../core/services/celebra-la-musica.service';
import { AgendaService } from '../../../../core/services/agenda.service';
import { NoticiasService } from '../../../../core/services/noticias.service';

const RESUMEN = (anio: number, actual: boolean): EdicionDeCelebraResumen => ({
  anio, nombre: `Celebra la Música ${anio}`, hashtag: `#CelebraLaMúsica${anio}`, proyectoCodigo: `celebra-la-musica-${anio}`,
  actual, publicada: true, colorPrincipal: anio === 2025 ? '#F2B705' : '#E5007E', colorSecundario: '#3A1366', imagenPortadaUrl: null, resumen: 'Resumen.',
});
const EDICION = (anio: number, actual: boolean): EdicionDeCelebra => ({
  ...RESUMEN(anio, actual), imagenPortadaArchivoId: null, fechaInicio: `${anio}-11-01`, fechaFin: `${anio}-11-30`,
  presentacion: 'Primer párrafo.\n\nSegundo párrafo.', aliados: 'Aliados de prueba', actividades: 190, municipios: null, departamentos: 28,
  organizaciones: null, musicos: 1300, fuente: 'Fuente: sitio oficial; PENDIENTE DE VALIDAR por el PNMC.', pendienteDeValidar: true, fechaActualizacion: null,
  categorias: [{ nombre: 'Circuitos sonoros', descripcion: 'Mercados.', orden: 1 }],
  recursos: [
    { id: 1, grupo: 'Guías', titulo: 'Guía visual', descripcion: null, archivoId: null, url: 'https://example.test/guia.pdf', orden: 1 },
    { id: 2, grupo: 'Guías', titulo: 'Logo', descripcion: null, archivoId: 9, url: '/api/v1/publico/archivos/9', orden: 2 },
  ],
  preguntas: [{ pregunta: '¿Cuesta?', respuesta: 'Casi siempre es gratis.', orden: 1 }],
  galeria: [{ archivoId: 3, url: '/api/v1/publico/archivos/3', textoAlternativo: 'Concierto', credito: 'Crédito de prueba', orden: 1 }],
});

describe('CelebraLaMusicaPageComponent', () => {
  let fixture: ComponentFixture<CelebraLaMusicaPageComponent>;
  let agenda: { listarPublicos: jasmine.Spy };
  let noticias: { listarPublicas: jasmine.Spy };
  let servicio: { ediciones: jasmine.Spy; edicion: jasmine.Spy };
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  async function montar(anio?: string): Promise<HTMLElement> {
    params = new BehaviorSubject(convertToParamMap(anio ? { anio } : {}));
    await TestBed.configureTestingModule({
      imports: [CelebraLaMusicaPageComponent],
      providers: [
        provideRouter([]),
        { provide: CelebraLaMusicaService, useValue: servicio },
        { provide: AgendaService, useValue: agenda },
        { provide: NoticiasService, useValue: noticias },
        { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: new BehaviorSubject(convertToParamMap({})), snapshot: { paramMap: params.value, queryParamMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CelebraLaMusicaPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    servicio = {
      ediciones: jasmine.createSpy().and.resolveTo({ ok: true, data: [RESUMEN(2026, true), RESUMEN(2025, false)] }),
      edicion: jasmine.createSpy().and.callFake(async (anio: number) => ({ ok: true, data: EDICION(anio, anio === 2026) })),
    };
    agenda = { listarPublicos: jasmine.createSpy().and.resolveTo({ ok: true, data: { items: [], pagina: 1, tamano: 50, total: 0, totalPaginas: 0 } }) };
    noticias = { listarPublicas: jasmine.createSpy().and.resolveTo({ ok: true, data: { items: [], pagina: 1, tamano: 6, total: 0, totalPaginas: 0 } }) };
  });

  it('abre la edición vigente y pide la agenda y las noticias filtradas por SU proyecto, sin módulos propios', async () => {
    const raiz = await montar();
    expect(raiz.querySelector('[data-testid="celebra-titulo"]')?.textContent).toContain('Celebra la Música 2026');
    expect(agenda.listarPublicos.calls.mostRecent().args[0].proyecto).toBe('celebra-la-musica-2026');
    expect(noticias.listarPublicas.calls.mostRecent().args[0].proyecto).toBe('celebra-la-musica-2026');
  });

  it('una edición histórica por la dirección usa su propio proyecto y sus propios colores', async () => {
    const raiz = await montar('2025');
    expect(raiz.querySelector('[data-testid="celebra-titulo"]')?.textContent).toContain('2025');
    expect(agenda.listarPublicos.calls.mostRecent().args[0].proyecto).toBe('celebra-la-musica-2025');
    expect((raiz.querySelector('[data-testid="celebra-la-musica"]') as HTMLElement).getAttribute('style')).toContain('--cl-principal: #F2B705');
  });

  it('la portada ya no lleva selector de ediciones: el histórico es un apartado cerca del final, con acceso a las demás', async () => {
    const raiz = await montar();
    expect(raiz.querySelector('header [data-testid="selector-de-edicion"]')).toBeNull();
    const apartado = raiz.querySelector('#ediciones[data-testid="selector-de-edicion"]') as HTMLElement;
    expect(apartado.textContent).not.toContain('Ediciones anteriores');
    expect(apartado.textContent).toContain('Explora Celebra la Música');
    expect(apartado.textContent).toContain('Todas las ediciones');
    const botones = Array.from(apartado.querySelectorAll('[data-testid="botones-de-edicion"] a')) as HTMLAnchorElement[];
    expect(botones.map((b) => b.textContent?.trim())).toEqual(['2026', '2025']);
    expect(botones[0].getAttribute('aria-current')).toBe('page');
    expect(botones[1].getAttribute('href')).toBe('/pnmc/estrategias/celebra-la-musica/2025');
  });

  it('la portada no lleva la cápsula «Estrategia del PNMC» y el menú interno son pestañas de sección', async () => {
    const raiz = await montar();
    expect(raiz.querySelector('header')?.textContent).not.toContain('Estrategia del PNMC');
    expect(raiz.querySelectorAll('app-pestanas-de-seccion nav button').length).toBeGreaterThanOrEqual(6);
  });

  it('las categorías van apiladas y numeradas en la columna de «La celebración»', async () => {
    const raiz = await montar();
    const lista = raiz.querySelector('#celebracion [data-testid="categorias"] ol') as HTMLElement;
    expect(lista).not.toBeNull();
    expect(lista.querySelectorAll('li').length).toBe(1);
    expect(lista.querySelector('li')?.textContent).toContain('Circuitos sonoros');
  });

  it('«Eventos destacados» enlaza a la agenda filtrada por el proyecto de la edición', async () => {
    agenda.listarPublicos.and.resolveTo({ ok: true, data: { items: [{ id: 1, slug: 'concierto', titulo: 'Concierto', fechaInicio: '2026-11-05T19:00:00', fechaFin: null, ciudad: 'Bogotá' }], pagina: 1, tamano: 50, total: 1, totalPaginas: 1 } });
    const raiz = await montar('2025');
    expect(raiz.querySelector('#programacion-titulo')?.textContent).toContain('Eventos destacados');
    const enlace = raiz.querySelector('[data-testid="ver-toda-la-agenda"]') as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toBe('/agenda?proyecto=celebra-la-musica-2025');
  });

  it('muestra cifras solo si existen, categorías, caja de herramientas con pestañas, preguntas y galería con crédito', async () => {
    const raiz = await montar();
    expect(raiz.querySelectorAll('[data-testid="cifras"] dt').length).toBe(3);
    expect(raiz.querySelector('[data-testid="cifras"]')?.textContent).toContain('1.300');
    expect(raiz.querySelector('[data-testid="cifras"]')?.textContent).toContain('Más de');
    expect(raiz.querySelectorAll('[data-testid="caja-de-herramientas"] [role="tab"]').length).toBe(1);
    expect(raiz.querySelectorAll('[data-testid="caja-de-herramientas"] [role="tabpanel"] li').length).toBe(2);
    expect(raiz.querySelectorAll('[data-testid="preguntas"] details').length).toBe(1);
    expect(raiz.querySelector('[data-testid="galeria-pie"]')?.textContent).toContain('Crédito de prueba');
    expect(raiz.querySelector('[data-testid="fuente"]')).toBeNull();
    expect(raiz.textContent).not.toContain('PENDIENTE DE VALIDAR');
  });

  it('la caja de herramientas es un solo visor: cada grupo es una pestaña y el teclado las recorre', async () => {
    const dos = EDICION(2026, true);
    dos.recursos = [
      { id: 1, grupo: 'Guía visual', titulo: 'Guía.pdf', descripcion: null, archivoId: 5, url: '/api/v1/publico/archivos/5', orden: 1 },
      { id: 2, grupo: 'Logos', titulo: 'Logo.png', descripcion: null, archivoId: 6, url: '/api/v1/publico/archivos/6', orden: 1 },
    ];
    servicio.edicion.and.resolveTo({ ok: true, data: dos });
    const raiz = await montar();
    const pestanas = Array.from(raiz.querySelectorAll('[data-testid="caja-de-herramientas"] [role="tab"]')) as HTMLElement[];
    expect(pestanas.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    pestanas[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(pestanas.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(raiz.querySelector('[data-testid="caja-de-herramientas"] [role="tabpanel"]')?.textContent).toContain('Logo.png');
    expect(raiz.querySelector('[data-testid="caja-descarga"]')?.getAttribute('href')).toBe('/api/v1/publico/archivos/6');
  });

  it('la galería muestra una imagen a la vez y cambia con flechas e indicadores', async () => {
    const dos = EDICION(2026, true);
    dos.galeria = [
      { archivoId: 3, url: '/api/v1/publico/archivos/3', textoAlternativo: 'Uno', credito: null, orden: 1 },
      { archivoId: 4, url: '/api/v1/publico/archivos/4', textoAlternativo: 'Dos', credito: 'Foto de prueba', orden: 2 },
    ];
    servicio.edicion.and.resolveTo({ ok: true, data: dos });
    const raiz = await montar();
    const pie = () => raiz.querySelector('[data-testid="galeria-pie"]')?.textContent ?? '';
    expect(pie()).toContain('1 / 2');
    (raiz.querySelector('[aria-label="Imagen siguiente"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(pie()).toContain('2 / 2');
    expect(pie()).toContain('Foto de prueba');
    (raiz.querySelector('[aria-label="Ir a la imagen 1"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(pie()).toContain('1 / 2');
  });

  it('los aliados muestran su logo del banco de archivos o, sin logo, su nombre; sin texto de fuente', async () => {
    const con = EDICION(2026, true);
    con.aliados = 'Alfa, Beta y 15 organizaciones aliadas';
    con.recursos = [{ id: 7, grupo: 'Aliados', titulo: 'Alfa', descripcion: null, archivoId: 8, url: '/api/v1/publico/archivos/8', orden: 1 }];
    servicio.edicion.and.resolveTo({ ok: true, data: con });
    const raiz = await montar();
    const aliados = raiz.querySelector('[data-testid="aliados"]') as HTMLElement;
    expect(aliados.querySelector('img')?.getAttribute('alt')).toBe('Alfa');
    expect(aliados.textContent).toContain('Beta');
    expect(raiz.querySelector('#aliados')?.textContent).toContain('15 organizaciones aliadas');
    expect(raiz.querySelector('#aliados')?.textContent).not.toMatch(/consultad|fuente/i);
    expect(raiz.querySelector('[data-testid="piezas-oficiales"]')).toBeNull();
    // El Ministerio y el PNMC organizan, no son aliados: no hay fila de logos «Organiza».
    expect(raiz.querySelector('[data-testid="organiza"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="aliados"] .cl-aliado--sin-logo')?.textContent).toContain('Beta');
    expect(raiz.querySelector('#aliados')?.textContent).not.toContain('Piezas oficiales');
  });

  it('el fondo de los aliados en 2025 es el morado, no el amarillo, porque los logos oficiales son blancos', async () => {
    const e2025 = EDICION(2025, false);
    e2025.colorPrincipal = '#4C007E'; e2025.colorSecundario = '#FEF43D';
    servicio.edicion.and.resolveTo({ ok: true, data: e2025 });
    const raiz = await montar();
    expect((raiz.querySelector('#aliados') as HTMLElement).style.getPropertyValue('--cl-aliados-fondo').toLowerCase()).toBe('#4c007e');
  });

  it('el fondo de los aliados en 2026 es el azul oscuro de la edición', async () => {
    const e2026 = EDICION(2026, true);
    e2026.colorPrincipal = '#D8175A'; e2026.colorSecundario = '#09153C';
    servicio.edicion.and.resolveTo({ ok: true, data: e2026 });
    const raiz = await montar();
    expect((raiz.querySelector('#aliados') as HTMLElement).style.getPropertyValue('--cl-aliados-fondo').toLowerCase()).toBe('#09153c');
  });

  it('sin actividades ni noticias etiquetadas dice qué falta, solo al terminar la carga', async () => {
    const raiz = await montar();
    expect(raiz.querySelector('[data-testid="programacion"]')).toBeNull();
    expect(raiz.textContent).toContain('Todavía no hay actividades etiquetadas en esta edición');
    expect(raiz.textContent).toContain('Todavía no hay noticias de esta edición');
  });

  it('una edición que no existe lo dice y devuelve a las estrategias', async () => {
    servicio.edicion.and.resolveTo({ ok: true, data: null });
    const raiz = await montar('2019');
    expect(raiz.textContent).toContain('Esta edición no está disponible');
    expect(raiz.querySelector('a[href="/pnmc#estrategias"]')).not.toBeNull();
  });

  it('un fallo de la API se dice con el motivo y ofrece Reintentar', async () => {
    servicio.ediciones.and.resolveTo({ ok: false, error: 'No fue posible consultar las ediciones.' });
    const raiz = await montar();
    expect(raiz.textContent).toContain('No pudimos cargar Celebra la música');
    expect(raiz.textContent).toContain('No fue posible consultar las ediciones.');
    expect(Array.from(raiz.querySelectorAll('button')).some((b) => b.textContent?.includes('Reintentar'))).toBeTrue();
  });

  it('el texto del encabezado siempre tiene contraste sobre el color de la edición', () => {
    expect(textoLegibleSobre('#F2B705')).toBe('#1B1230');
    expect(textoLegibleSobre('#E5007E')).toBe('#FFFFFF');
    expect(textoLegibleSobre('no-es-un-color')).toBe('#FFFFFF');
  });
});
