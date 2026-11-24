import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminNoticiasPanelComponent } from './admin-noticias-panel.component';
import { Noticia, NoticiasService } from '../../../core/services/noticias.service';
import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';

/**
 * Noticias en la consola.
 *
 * <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que «publicada» y «visible» vuelvan a confundirse. Una
 * noticia fechada el lunes queda publicada hoy y NO aparece en el portal hasta el lunes; sin el
 * aviso de la lista, el «la publiqué y no sale» es seguro, y acaba en alguien publicándola otra
 * vez con la fecha de hoy.
 */
describe('el panel de Noticias distingue publicada de visible', () => {
  function crear() {
    TestBed.configureTestingModule({
      imports: [AdminNoticiasPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(AdminNoticiasPanelComponent);
    return fixture.componentInstance;
  }

  function noticia(parcial: Partial<Noticia>): Noticia {
    const base = {
      id: 1, slug: 'una-noticia', titulo: 'Una noticia', resumen: 'Resumen', cuerpo: 'Cuerpo',
      fechaPublicacion: null as string | null, imagenRuta: null, imagenAlternativa: null, autoriaNombre: null,
      imagenArchivoId: null, imagenUrl: null, imagenAlt: null,
      estado: 'borrador', version: 1, etiquetas: [], categoriaId: null, categoria: null,
      practicasMusicales: [], territoriosSonoros: [], procedencia: null, proyectosTransversales: [], fechaActualizacion: '2026-09-11T00:00:00Z',
      ...parcial,
    };
    // EL ESTADO EFECTIVO LO CALCULA EL SERVIDOR; aquí se reproduce su regla para que el fijador
    // no pueda inventar una combinación que el API nunca devuelve —«publicado» con fecha futura y
    // efectivo «publicado»—, que es exactamente el defecto que esta pantalla vino a cerrar.
    const programada = base.estado === 'publicado'
      && base.fechaPublicacion !== null
      && base.fechaPublicacion > new Date().toISOString().slice(0, 10);
    return { ...base, estadoEfectivo: parcial.estadoEfectivo ?? (programada ? 'programada' : base.estado) } as Noticia;
  }

  const hoy = () => new Date().toISOString().slice(0, 10);
  const enDias = (dias: number) => new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10);

  it('una noticia en revisión ofrece devolverla o rechazarla, y las dos piden motivo (#124)', async () => {
    const componente = crear();
    const enRevision = noticia({ estado: 'en_revision' });
    const servicio = TestBed.inject(NoticiasService);
    const cambiar = spyOn(servicio, 'cambiarEstado').and.resolveTo({ ok: true, data: enRevision });
    spyOn(componente, 'cargar').and.resolveTo();

    const acciones = componente.accionesDe(enRevision).map(accion => accion.id);
    expect(acciones).toContain('devolver');
    expect(acciones).toContain('rechazar');
    expect(componente.accionesDe(noticia({ estado: 'borrador' })).map(a => a.id)).not.toContain('devolver');

    const confirmaciones = TestBed.inject(ServicioDeConfirmacion);
    const pedir = spyOn(confirmaciones, 'pedir').and.resolveTo({ motivo: '  Falta la fuente.  ' });

    componente.ejecutarAccion(enRevision, 'devolver');
    await Promise.resolve(); await Promise.resolve();
    // LA DECISIÓN VA POR EL DIÁLOGO COMÚN (LIS-05, G1): pide motivo, y el motivo es obligatorio.
    expect(pedir.calls.mostRecent().args[0].pideMotivo).toBeTrue();
    expect(pedir.calls.mostRecent().args[0].titulo).toContain('Devolver');
    expect(cambiar).toHaveBeenCalledWith(1, 'borrador', 'Falta la fuente.');

    pedir.and.resolveTo({ motivo: 'Duplicada.' });
    componente.ejecutarAccion(enRevision, 'rechazar');
    await Promise.resolve(); await Promise.resolve();
    // (L6): rechazar deja la noticia «rechazada», no «archivada».
    expect(cambiar).toHaveBeenCalledWith(1, 'rechazado', 'Duplicada.');

    // Cancelar el diálogo no toca nada.
    cambiar.calls.reset();
    pedir.and.resolveTo(null);
    componente.ejecutarAccion(enRevision, 'rechazar');
    await Promise.resolve(); await Promise.resolve();
    expect(cambiar).not.toHaveBeenCalled();
  });

  it('«Publicar» sin lo necesario se ofrece apagado y dice qué falta; completa, pregunta antes', async () => {
    const componente = crear();
    const sinFecha = noticia({ estado: 'borrador', fechaPublicacion: null });

    const publicar = componente.accionesDe(sinFecha).find(a => a.id === 'publicar')!;
    expect(publicar.deshabilitada).toBeTrue();
    expect(publicar.motivo).toBe('No se puede publicar: no tiene fecha de publicación.');

    const completa = noticia({ estado: 'borrador', fechaPublicacion: hoy() });
    expect(componente.accionesDe(completa).find(a => a.id === 'publicar')!.deshabilitada).toBeFalsy();

    const servicio = TestBed.inject(NoticiasService);
    const cambiar = spyOn(servicio, 'cambiarEstado').and.resolveTo({ ok: true, data: completa });
    spyOn(componente, 'cargar').and.resolveTo();
    const confirmaciones = TestBed.inject(ServicioDeConfirmacion);
    const pedir = spyOn(confirmaciones, 'pedir').and.resolveTo(null);

    await componente.publicar(completa);
    expect(pedir.calls.mostRecent().args[0].titulo).toBe('Publicar «Una noticia»');
    expect(cambiar).not.toHaveBeenCalled();

    pedir.and.resolveTo({ motivo: '' });
    await componente.publicar(completa);
    expect(cambiar).toHaveBeenCalledWith(1, 'publicado');
  });

  it('una noticia rechazada se reabre como borrador y no se publica de un clic', () => {
    const componente = crear();
    const ids = componente.accionesDe(noticia({ estado: 'rechazado' })).map(a => a.id);

    expect(ids).toContain('reabrir');
    expect(ids).not.toContain('publicar');
    expect(componente.FILTRO_DE_ESTADO.map(o => o.id)).toContain('rechazado');
  });

  it('abrir el historial pide los estados y distingue «falló» de «vacío» (#124)', async () => {
    const componente = crear();
    const servicio = TestBed.inject(NoticiasService);
    const leer = spyOn(servicio, 'historial').and.resolveTo({ ok: false, error: 'x' });

    componente.abrirHistorial(noticia({ id: 7 }));
    await Promise.resolve(); await Promise.resolve();

    expect(leer).toHaveBeenCalledWith(7);
    expect(componente.estadosDelHistorial()).toBeNull();
  });

  it('avisa de que una noticia publicada con fecha futura aún no se ve', () => {
    const componente = crear();

    expect(componente.esperandoSuFecha(noticia({ estado: 'publicado', fechaPublicacion: enDias(7) }))).toBe(true);
  });

  it('no avisa cuando la fecha ya llegó', () => {
    const componente = crear();

    expect(componente.esperandoSuFecha(noticia({ estado: 'publicado', fechaPublicacion: hoy() }))).toBe(false);
    expect(componente.esperandoSuFecha(noticia({ estado: 'publicado', fechaPublicacion: enDias(-3) }))).toBe(false);
  });

  it('no avisa de un borrador, por futura que sea su fecha', () => {
    const componente = crear();

    // UN BORRADOR NO ESTA ESPERANDO SU FECHA: está esperando una decisión, que es otra cosa.
    expect(componente.esperandoSuFecha(noticia({ estado: 'borrador', fechaPublicacion: enDias(7) }))).toBe(false);
  });

  it('una noticia programada ofrece previsualizar y NO «Ver en el portal»', () => {
    const componente = crear();
    const programada = noticia({ estado: 'publicado', fechaPublicacion: enDias(7) });

    const acciones = componente.accionesDe(programada).map(accion => accion.id);

    // POR QUE EXISTE: la noticia está guardada como publicada, así que la consola ofrecía
    // «Ver en el portal» y ese enlace devolvía un 404 —la lectura pública no la enseña hasta su
    // fecha—. Una acción que lleva a una vista vacía es justo lo que el proyecto no admite.
    expect(acciones).not.toContain('ver');
    expect(acciones).toContain('previsualizar');
  });

  it('una noticia que ya se ve ofrece abrirla, y no previsualizarla', () => {
    const componente = crear();
    const publicada = noticia({ estado: 'publicado', fechaPublicacion: hoy() });

    const acciones = componente.accionesDe(publicada).map(accion => accion.id);

    // OFRECER LAS DOS obligaría a elegir entre dos acciones que hacen casi lo mismo, y la buena
    // —abrir la noticia de verdad— quedaría escondida detrás de la otra.
    expect(acciones).toContain('ver');
    expect(acciones).not.toContain('previsualizar');
  });

  it('un borrador se puede previsualizar antes de existir para nadie', () => {
    const componente = crear();

    expect(componente.accionesDe(noticia({ estado: 'borrador' })).map(a => a.id)).toContain('previsualizar');
  });
  // ── Seguimiento de G1 (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 97): la errata la decide el servidor, como en el Catálogo ──

  it('al guardar algo publicado no se manda ninguna marca de errata y el aviso cuenta lo que decidió el servidor', async () => {
    const componente = crear();
    const servicio = TestBed.inject(NoticiasService);
    spyOn(componente, 'cargar').and.resolveTo();
    const guardar = spyOn(servicio, 'guardar');

    // ERRATA: el servidor la deja publicada.
    componente.editar(noticia({ estado: 'publicado', version: 3 }));
    guardar.and.resolveTo({ ok: true, data: noticia({ estado: 'publicado', version: 4 }) });
    await componente.guardar();
    expect('esErrata' in guardar.calls.mostRecent().args[1]).toBeFalse();
    expect(componente.aviso()).toContain('sigue publicada');

    // CAMBIO DE FONDO: el servidor la devuelve a revisión.
    componente.editar(noticia({ estado: 'publicado', version: 4 }));
    guardar.and.resolveTo({ ok: true, data: noticia({ estado: 'en_revision', version: 5 }) });
    await componente.guardar();
    expect(componente.aviso()).toContain('vuelve a revisión');
  });

  it('el formulario de una noticia publicada avisa al abrirla y ya no ofrece la casilla «es una errata»', () => {
    TestBed.configureTestingModule({
      imports: [AdminNoticiasPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(AdminNoticiasPanelComponent);
    const panel = fixture.componentInstance;
    spyOn(panel, 'cargar').and.resolveTo();
    fixture.detectChanges();
    panel.editar(noticia({ estado: 'publicado' }));
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('[data-aviso-de-errata]')?.textContent).toContain('Esta noticia está publicada');
    expect(raiz.textContent).not.toContain('Es una errata.');
  });

  it('escribe la regla de las destacadas y marca las que hoy están arriba en el portal (N-1)', async () => {
    TestBed.configureTestingModule({
      imports: [AdminNoticiasPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const servicio = TestBed.inject(NoticiasService);
    const publicas = spyOn(servicio, 'listarPublicas').and.resolveTo({
      ok: true, data: { items: [noticia({ id: 7 }), noticia({ id: 9 })], pagina: 1, tamano: 3, total: 2, totalPaginas: 1 },
    });
    spyOn(servicio, 'listarInternas').and.resolveTo({
      ok: true, data: { items: [noticia({ id: 7, estado: 'publicado' }), noticia({ id: 8, estado: 'publicado' })], pagina: 1, tamano: 12, total: 2, totalPaginas: 1 },
    });
    const fixture = TestBed.createComponent(AdminNoticiasPanelComponent);
    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges();
    // Con `provideHttpClientTesting` las peticiones de catálogo quedan abiertas y `whenStable` no termina: se espera a los dos servicios simulados.
    await new Promise(resolver => setTimeout(resolver, 20));
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    // La misma lista y el mismo tope que lee el portal: tres.
    expect(publicas).toHaveBeenCalledWith({ tamano: 3 });
    expect(raiz.querySelector('[data-testid="regla-de-destacadas-consola"]')?.textContent).toContain('no se eligen a mano');
    // Solo la 7 está en la página de la consola y entre las destacadas.
    expect(raiz.querySelectorAll('[data-testid="noticia-destacada-hoy"]').length).toBe(1);
  });
});
