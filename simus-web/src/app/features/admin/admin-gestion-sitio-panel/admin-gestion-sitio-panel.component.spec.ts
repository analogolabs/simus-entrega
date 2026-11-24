import { appConfig } from '../../../app.config';
import { TestBed } from '@angular/core/testing';
import { AdminGestionSitioPanelComponent } from './admin-gestion-sitio-panel.component';
import { ContenidoWebApiService } from '../../../core/services/contenido-web-api.service';

/**
 * El armazón de Gestión del sitio ().
 *
 * <b>El defecto que estas pruebas fijan, y que era real.</b> El efecto de arranque llamaba a
 * `cargarResumen()` desde su propio cuerpo. Esa función empieza SÍNCRONAMENTE leyendo y
 * escribiendo `cargando`, así que el efecto acababa suscrito a una señal que él mismo cambia:
 * pedía el resumen, `cargando` cambiaba, el cambio volvía a disparar el efecto, y así sin
 * final. En pantalla se veía como un «Cargando el estado del sitio…» permanente mientras el
 * API recibía peticiones sin parar.
 *
 * Por eso la primera prueba cuenta LLAMADAS y no mira la pantalla: el síntoma visible era un
 * texto de carga, pero el defecto es el número de peticiones, y es lo único que al medirlo
 * distingue «tarda» de «no para nunca».
 */
class ApiDoble {
  llamadas = 0;
  respuesta: { ok: boolean; data?: unknown; error?: string } = {
    ok: true,
    data: {
      generatedAt: '2026-09-11T00:00:00Z',
      pendingTotal: 0,
      texts: { total: 26, published: 26, pending: 0, retired: 0, groups: [] },
      images: { total: 13, published: 13, pending: 0, retired: 0, groups: [] },
      team: { members: 4, published: true, pending: false, updatedAt: null },
    },
  };

  // «Textos y páginas» es el área con la que abre el panel: monta el estudio, que lee su bloque del servidor.
  async getGroup() { return { ok: false, error: 'sin servidor en la prueba' }; }
  async getImageGroup() { return { ok: false, error: 'sin servidor en la prueba' }; }
  async getTeam() { return { ok: false, error: 'sin servidor en la prueba' }; }

  async getSiteManagementSummary() {
    this.llamadas += 1;
    return this.respuesta;
  }
}

describe('AdminGestionSitioPanelComponent', () => {
  // LAS CIFRAS Y FECHAS SE ESCRIBEN EN es-CO, y el locale lo registra `app.config.ts` al cargarse.
  // Nombrar `appConfig` obliga a cargar ese módulo; sin esto la prueba solo pasa cuando corre junto
  // a otra que lo cargue, que es una dependencia del orden de ejecución y no de lo que se prueba.
  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));

  let api: ApiDoble;

  async function montar(vistaInicial: 'textos' | 'imagenes' | 'equipo' | 'pendientes' = 'pendientes') {
    api = new ApiDoble();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AdminGestionSitioPanelComponent],
      providers: [{ provide: ContenidoWebApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminGestionSitioPanelComponent);
    // El panel abre en «Textos y páginas», cuyo estudio carga la página real en un marco: dentro de Karma ese
    // marco es la propia página de la prueba. Estas pruebas miran el armazón, así que arrancan en otra área.
    fixture.componentInstance.vista.set(vistaInicial);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('pide el resumen UNA sola vez al abrirse, no en bucle', async () => {
    await montar();

    expect(api.llamadas).toBe(1);
  });

  it('deja de anunciar carga cuando el resumen llega', async () => {
    const fixture = await montar();

    expect(fixture.componentInstance.cargando()).toBeFalse();
    expect(fixture.componentInstance.resumen()).not.toBeNull();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Cargando el estado del sitio');
    expect(texto).toContain('Guardar un borrador no cambia el portal');
  });

  it('muestra las cuatro áreas: sin «Resumen», y con cambios pendientes y respaldos en un solo apartado', async () => {
    const fixture = await montar();

    const areas = fixture.componentInstance.opciones.map(o => o.etiqueta);
    expect(areas).toEqual([
      'Textos y páginas',
      'Imágenes del sitio',
      'Equipo',
      'Cambios y respaldos',
    ]);
    expect(TestBed.createComponent(AdminGestionSitioPanelComponent).componentInstance.vista()).toBe('textos');
  });

  it('«Cambios y respaldos» reúne la lista de pendientes y los respaldos', async () => {
    const fixture = await montar();
    await fixture.componentInstance.seleccionar('pendientes');
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Cambios pendientes');
    expect(raiz.querySelector('app-admin-respaldos-sitio')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="cobertura-del-sitio"]')?.textContent).toContain('26 textos');
  });

  it('si el servidor falla lo dice y ofrece reintentar, sin quedarse cargando', async () => {
    api = new ApiDoble();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AdminGestionSitioPanelComponent],
      providers: [{ provide: ContenidoWebApiService, useValue: api }],
    }).compileComponents();
    api.respuesta = { ok: false, error: 'No fue posible leer el estado.' };

    const fixture = TestBed.createComponent(AdminGestionSitioPanelComponent);
    fixture.componentInstance.vista.set('pendientes');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.cargando()).toBeFalse();
    expect(fixture.componentInstance.error()).toBe('No fue posible leer el estado.');
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Reintentar');
  });

  it('cambiar de área no dispara una carga por cada clic en las que no la necesitan', async () => {
    const fixture = await montar();

    // Textos e imágenes se sostienen solos: no dependen del resumen.
    await fixture.componentInstance.seleccionar('textos');
    await fixture.componentInstance.seleccionar('imagenes');

    expect(api.llamadas).toBe(1);

    // «Cambios pendientes» sí relee, porque su contenido ES el resumen.
    await fixture.componentInstance.seleccionar('pendientes');
    expect(api.llamadas).toBe(2);
  });

  it('«Abrir» un pendiente lleva al grupo con el borrador, y cambiar de área por la pestaña lo olvida', async () => {
    const fixture = await montar();

    await fixture.componentInstance.seleccionar('textos', 'ecosistema_hero');
    expect(fixture.componentInstance.vista()).toBe('textos');
    expect(fixture.componentInstance.grupoAbierto()).toBe('ecosistema_hero');

    // Volver a otra área y regresar por la pestaña no debe saltar a un grupo viejo.
    await fixture.componentInstance.seleccionar('imagenes');
    expect(fixture.componentInstance.grupoAbierto()).toBeNull();
  });
});
