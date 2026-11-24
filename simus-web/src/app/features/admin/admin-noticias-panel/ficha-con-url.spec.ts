import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AdminNoticiasPanelComponent } from './admin-noticias-panel.component';
import { Noticia } from '../../../core/services/noticias.service';
import { FichaDeConsola } from '../domain/ficha-de-consola';

/**
 * La ficha de una noticia tiene dirección propia: `/administracion/noticias/{id}` (;
 * G1). «Atrás» la cierra, recargar la conserva y un id que no existe se dice.
 */
describe('Noticias · la ficha vive en la dirección', () => {
  function montar() {
    TestBed.configureTestingModule({
      imports: [AdminNoticiasPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(AdminNoticiasPanelComponent);
    return { fixture, panel: fixture.componentInstance, url: TestBed.inject(FichaDeConsola) };
  }

  const noticia = (id: number): Noticia => ({
    id, slug: `n-${id}`, titulo: `Noticia ${id}`, resumen: 'Resumen', cuerpo: 'Cuerpo', estado: 'borrador', estadoEfectivo: 'borrador', version: 1,
    fechaPublicacion: null, imagenRuta: null, imagenAlternativa: null, autoriaNombre: null, imagenArchivoId: null, imagenUrl: null,
    imagenAlt: null, etiquetas: [], categoriaId: null, categoria: null, practicasMusicales: [], territoriosSonoros: [],
    proyectosTransversales: [], procedencia: null, fechaActualizacion: '2026-09-11T00:00:00Z',
  } as unknown as Noticia);

  it('abrir una ficha navega a su dirección', () => {
    const { panel } = montar();
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    panel.consultar(noticia(7));

    expect(panel.fichaEnLectura()?.id).toBe(7);
    expect(navegar.calls.mostRecent().args[0]).toEqual(['/administracion', 'noticias', '7']);
  });

  it('un enlace con id abre la ficha cuando la lista ya está cargada', () => {
    const { fixture, panel, url } = montar();
    fixture.detectChanges();
    panel.cargando.set(false);
    panel.noticias.set([noticia(1), noticia(2)]);

    url.fijar('2');
    fixture.detectChanges();

    expect(panel.fichaEnLectura()?.id).toBe(2);
  });

  it('«Atrás» quita el id y la ficha se cierra', () => {
    const { fixture, panel, url } = montar();
    fixture.detectChanges();
    panel.cargando.set(false);
    panel.noticias.set([noticia(1)]);
    url.fijar('1');
    fixture.detectChanges();
    expect(panel.fichaEnLectura()).not.toBeNull();

    url.fijar(null);
    fixture.detectChanges();

    expect(panel.fichaEnLectura()).toBeNull();
  });

  it('un id que no está en la página abierta se pide por su id y abre la ficha', async () => {
    const { fixture, panel, url } = montar();
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    panel.cargando.set(false);
    panel.noticias.set([noticia(1)]);

    url.fijar('300');
    fixture.detectChanges();
    const peticion = http.expectOne(r => r.url.endsWith('/api/v1/institucional/noticias/300'));
    peticion.flush(noticia(300));
    await new Promise<void>(r => setTimeout(r, 30));

    expect(panel.fichaEnLectura()?.id).toBe(300);
  });

  it('un id que no existe se dice y se corrige la dirección', async () => {
    const { fixture, panel, url } = montar();
    const http = TestBed.inject(HttpTestingController);
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    panel.cargando.set(false);
    panel.noticias.set([noticia(1)]);

    url.fijar('999');
    fixture.detectChanges();
    http.expectOne(r => r.url.endsWith('/api/v1/institucional/noticias/999'))
      .flush({ message: 'No existe.' }, { status: 404, statusText: 'Not Found' });
    await new Promise<void>(r => setTimeout(r, 30));

    expect(panel.fichaEnLectura()).toBeNull();
    expect(panel.error()).toContain('Esa noticia no existe');
    expect(navegar.calls.mostRecent().args[0]).toEqual(['/administracion', 'noticias']);
  });
});
