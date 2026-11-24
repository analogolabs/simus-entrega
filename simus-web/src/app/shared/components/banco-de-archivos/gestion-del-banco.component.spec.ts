import { TestBed } from '@angular/core/testing';
import { ArchivoEnElBanco, BancoDeArchivosService, InformeDeAlmacenamiento, PaginaDelBanco } from '../../../core/services/banco-de-archivos.service';
import { GestionDelBancoComponent } from './gestion-del-banco.component';

/**
 * La procedencia de cada archivo en la gestión del banco.
 *
 * <b>SIN ORGANIZACIÓN NO SIGNIFICA «DEL PROGRAMA».</b> Desde la foto de un perfil público entra
 * al banco sin organización; el servidor la marca `persona` y la consola tiene que decirlo, no
 * presentarla como material del PNMC.
 */

describe('GestionDelBancoComponent · procedencia', () => {
  function archivo(id: number, procedencia: string, organizacionNombre: string | null = null): ArchivoEnElBanco {
    return {
      id, nombre: `archivo-${id}.png`, tipo: 'image/png', bytes: 100, alt: 'Una imagen', pie: null, credito: null, ancho: 1, alto: 1,
      url: `/api/v1/publico/archivos/${id}`, fechaCarga: '2026-11-05T10:00:00Z', procedencia,
      organizacionId: organizacionNombre ? 9 : null, organizacionNombre, subidoPor: null,
      usos: [], huerfano: true, visiblePublicamente: false,
    };
  }

  async function montar(totalPaginas = 1, conUsos = false, sinUsar?: { total: number; bytes: number }, informe?: InformeDeAlmacenamiento) {
    const pagina: PaginaDelBanco = {
      items: [archivo(1, 'institucional'), archivo(2, 'organizacion', 'Fundación de prueba'), archivo(3, 'persona')]
        .map(a => (conUsos ? { ...a, huerfano: false, usos: [{ modulo: 'agenda', descripcion: 'Un evento', esPublico: true }] } : a)),
      pagina: 1, tamano: 24, total: 3, totalPaginas, cuotaBytes: null, usadoBytes: null, sinUsar,
    };
    const listar = jasmine.createSpy('listar').and.resolveTo({ ok: true, data: pagina });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [GestionDelBancoComponent],
      providers: [{
        provide: BancoDeArchivosService,
        useValue: { listar, informeDeAlmacenamiento: () => Promise.resolve(informe ? { ok: true, data: informe } : { ok: false }) },
      }],
    });
    const fixture = TestBed.createComponent(GestionDelBancoComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, listar, componente: fixture.componentInstance };
  }

  it('la foto de un perfil público se lee «Persona», no «PNMC»', async () => {
    const { fixture } = await montar();
    const etiquetas = Array.from(fixture.nativeElement.querySelectorAll('[data-procedencia]') as NodeListOf<HTMLElement>)
      .map(e => [e.getAttribute('data-procedencia'), e.textContent!.trim()]);

    expect(etiquetas).toEqual([
      ['institucional', 'PNMC'],
      ['organizacion', 'Fundación de prueba'],
      ['persona', 'Persona'],
    ]);
  });

  it('se puede filtrar por las fotos de personas', async () => {
    const { componente, listar } = await montar();
    expect(componente.PROCEDENCIAS.map(p => p.id)).toContain('personas');

    await componente.filtrarPor('personas');

    expect(listar).toHaveBeenCalledWith('institucional', jasmine.objectContaining({ procedencia: 'personas' }));
  });

  it('el botón y el aviso cuentan los archivos sin usar de TODO el banco, no los de la página', async () => {
    // La página abierta trae 3 archivos usados; el servidor dice que en total hay 7 sin usar (5 MB).
    const { fixture, componente } = await montar(2, true, { total: 7, bytes: 5 * 1024 * 1024 });

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(componente.huerfanos()).toBe(7);
    expect(texto).toContain('Sin usar: 7');
    expect(texto).toContain('Hay 7 archivos sin usar');
    expect(texto).toContain('no se borra nada por sí solo');
    expect(texto).not.toContain('en esta página');
  });

  it('el aviso lleva a la lista de los sin usar y se oculta mientras se mira esa lista', async () => {
    const { fixture, componente, listar } = await montar(1, true, { total: 2, bytes: 2048 });
    const boton = (fixture.nativeElement as HTMLElement).querySelector('[data-aviso-sin-usar] button') as HTMLButtonElement;

    boton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(componente.soloHuerfanos()).toBeTrue();
    expect(listar).toHaveBeenCalledWith('institucional', jasmine.objectContaining({ soloHuerfanos: true }));
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-aviso-sin-usar]')).toBeNull();
  });

  it('sin archivos sin usar no hay aviso, y el filtro lo dice sin salvedades de página', async () => {
    const { fixture, componente, listar } = await montar(2, true, { total: 0, bytes: 0 });
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-aviso-sin-usar]')).toBeNull();

    listar.and.resolveTo({ ok: true, data: { items: [], pagina: 1, tamano: 24, total: 0, totalPaginas: 0, cuotaBytes: null, usadoBytes: null, sinUsar: { total: 0, bytes: 0 } } });
    await componente.alternarHuerfanos();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('No hay archivos sin usar');
    expect(texto).toContain('Todo lo que hay en el banco está vinculado a alguna ficha.');
    // El servidor filtra antes de paginar: ya no hay que decir «mira las otras páginas».
    expect(texto).not.toContain('mira las otras');
  });

  describe('informe de almacenamiento', () => {
    beforeEach(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });

    function informeCon(nivel: 'normal' | 'atencion' | 'alarma', fraccion: number): InformeDeAlmacenamiento {
      return {
        generadoEn: '2026-11-16T10:00:00Z',
        total: { archivos: 12, bytes: 20 * 1024 * 1024 },
        tope: { bytes: 32 * 1024 * 1024 * 1024, fraccionUsada: fraccion, umbralDeAtencion: 0.8, umbralDeAlarma: 0.9, nivel, soloMideElBanco: true },
        porProcedencia: [], porTipo: [], porAntiguedad: [],
        sinUsar: { archivos: 1, bytes: 10 }, repetidos: { copiasSobrantes: 2, bytes: 2048 },
        organizacionesQueMasPesan: [{ organizacionId: 9, nombre: 'Fundación de prueba', archivos: 3, bytes: 5 * 1024 * 1024, cuotaBytes: 50 * 1024 * 1024, fraccionDeLaCuota: 0.1 }],
        crecimientoMensual: [],
      };
    }

    it('la consola ve cuánto pesa el banco frente al tope, que solo mide el banco', async () => {
      const { fixture } = await montar(1, true, undefined, informeCon('normal', 0.0006));
      const bloque = (fixture.nativeElement as HTMLElement).querySelector('[data-informe-de-almacenamiento]') as HTMLElement;

      expect(bloque.textContent).toContain('20.0 MB en 12 archivos');
      expect(bloque.textContent).toContain('del tope de 32.00 GB');
      expect(bloque.textContent).toContain('No incluye los medios del sitio');
      expect(bloque.textContent).toContain('2 copias repetidas');
      expect(bloque.textContent).toContain('Fundación de prueba');
      expect(bloque.querySelector('[data-nivel]')).toBeNull();
    });

    it('al pasar el umbral de atención o de alarma lo dice', async () => {
      const atencion = await montar(1, true, undefined, informeCon('atencion', 0.85));
      expect((atencion.fixture.nativeElement as HTMLElement).querySelector('[data-nivel="atencion"]')).not.toBeNull();

      const alarma = await montar(1, true, undefined, informeCon('alarma', 0.93));
      const aviso = (alarma.fixture.nativeElement as HTMLElement).querySelector('[data-nivel="alarma"]') as HTMLElement;
      expect(aviso.textContent).toContain('90 %');
    });

    it('sin tope configurado solo enseña la cifra, sin porcentaje ni aviso', async () => {
      const informe = informeCon('normal', 0);
      informe.tope = { ...informe.tope, bytes: null, fraccionUsada: null, nivel: 'sinTope' };
      const { fixture } = await montar(1, true, undefined, informe);
      const bloque = (fixture.nativeElement as HTMLElement).querySelector('[data-informe-de-almacenamiento]') as HTMLElement;

      expect(bloque.textContent).toContain('20.0 MB en 12 archivos');
      expect(bloque.textContent).not.toContain('%');
      expect(bloque.querySelector('[data-aviso-de-almacenamiento]')).toBeNull();
    });

    it('en normal con una proyección que llega al 90 % en menos de seis meses lo avisa', async () => {
      const informe = informeCon('normal', 0.5);
      informe.proyeccion = { bytesPorMes: 1024 * 1024, mesesHastaElUmbral: 4, avisaDeLlegadaPronta: true };
      const { fixture } = await montar(1, true, undefined, informe);
      const proyeccion = (fixture.nativeElement as HTMLElement).querySelector('[data-proyeccion]') as HTMLElement;

      expect(proyeccion.textContent).toContain('se llegaría al 90 % del tope en 4 meses');
    });

    it('el aviso se puede ocultar siete días y la cifra se queda', async () => {
      const { fixture } = await montar(1, true, undefined, informeCon('alarma', 0.93));
      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('[data-nivel="alarma"]')).not.toBeNull();

      (raiz.querySelector('[data-aviso-de-almacenamiento] button') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(raiz.querySelector('[data-aviso-de-almacenamiento]')).toBeNull();
      expect(raiz.querySelector('[data-informe-de-almacenamiento]')).not.toBeNull();
    });

    it('si el informe no carga, la lista sigue igual y no hay bloque', async () => {
      const { fixture } = await montar();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-informe-de-almacenamiento]')).toBeNull();
    });
  });
});
