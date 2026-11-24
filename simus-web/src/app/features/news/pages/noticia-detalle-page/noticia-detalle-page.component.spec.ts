import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Noticia, NoticiasService } from '../../../../core/services/noticias.service';
import { NoticiaDetallePageComponent } from './noticia-detalle-page.component';

/** La ficha de una noticia: sus etiquetas filtran el listado y se puede compartir sin terceros. */
describe('NoticiaDetallePageComponent', () => {
  const noticia = {
    id: 5, slug: 'celebra-2026', titulo: 'Celebra la Música 2026 arranca', resumen: 'Resumen.', cuerpo: 'Primer párrafo.',
    fechaPublicacion: '2026-11-10', imagenRuta: null, imagenAlternativa: null, autoriaNombre: null, categoria: 'Actualidad',
    etiquetas: ['demostración'], proyectosTransversales: [{ id: 3, nombre: 'Celebra la Música 2026', slug: 'celebra-la-musica-2026' }],
  } as unknown as Noticia;

  async function montar(datos: Noticia) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NoticiaDetallePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ slug: datos.slug })) } },
        { provide: NoticiasService, useValue: {
          ultimaListaPublica: null,
          obtenerPublica: () => Promise.resolve({ ok: true, data: datos }),
          listarPublicas: () => Promise.resolve({ ok: true, data: { items: [], total: 0 } }),
        } },
      ],
    });
    const fixture = TestBed.createComponent(NoticiaDetallePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('las etiquetas de la noticia son enlaces al listado de noticias filtrado por cada una', async () => {
    const raiz = await montar(noticia);
    const enlace = raiz.querySelector<HTMLAnchorElement>('app-etiquetas-de-contenido a[data-etiqueta]')!;
    expect(enlace.textContent).toContain('Celebra la Música 2026');
    expect(enlace.getAttribute('href')).toContain('/noticias?proyecto=celebra-la-musica-2026');
  });

  it('ofrece compartir en WhatsApp, Facebook, X, LinkedIn y correo, además de copiar el enlace', async () => {
    const raiz = await montar(noticia);
    for (const red of ['whatsapp', 'facebook', 'x', 'linkedin', 'correo', 'copiar']) {
      expect(raiz.querySelector(`app-compartir-en-redes [data-compartir="${red}"]`)).withContext(red).not.toBeNull();
    }
  });
});
