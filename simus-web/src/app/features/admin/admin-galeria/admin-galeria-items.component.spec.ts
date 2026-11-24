import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminGaleriaItemsComponent } from './admin-galeria-items.component';
import { ArchivoEnElBanco, BancoDeArchivosService } from '../../../core/services/banco-de-archivos.service';
import { ItemEditable, itemNuevo } from '../domain/galeria-edicion';

/**
 * Los ítems de un álbum: añadir fotos del Banco (heredan su texto alternativo), pegar enlaces de video (solo YouTube), reordenar, portada y paginación.
 */
describe('ítems de la Galería en la consola', () => {
  let fixture: ComponentFixture<AdminGaleriaItemsComponent>;
  let componente: AdminGaleriaItemsComponent;
  let items: ItemEditable[];
  let portadas: ({ archivoId: number; url: string } | null)[];
  let listas: string[];
  let subidas: { alt: string; credito?: string }[];

  const archivo = (id: number, extra: Partial<ArchivoEnElBanco> = {}): ArchivoEnElBanco => ({
    id, nombre: `foto-${id}.jpg`, tipo: 'image/jpeg', bytes: 1000, alt: `Descripción ${id}`, pie: null, credito: 'Archivo PNMC', ancho: 100, alto: 80, url: `/api/v1/publico/archivos/${id}`,
    fechaCarga: '2026-11-01', procedencia: 'institucional', organizacionId: null, organizacionNombre: null, subidoPor: null, usos: [], huerfano: true, visiblePublicamente: false, ...extra,
  });

  beforeEach(async () => {
    items = []; portadas = []; listas = []; subidas = [];
    await TestBed.configureTestingModule({
      imports: [AdminGaleriaItemsComponent],
      providers: [{
        provide: BancoDeArchivosService,
        useValue: {
          listar: async () => ({ ok: true, data: { items: [archivo(1), archivo(2, { alt: null, credito: null }), archivo(3, { tipo: 'application/pdf' })] } }),
          subirImagen: async (_f: File, alt: string, extras: { credito?: string }) => { subidas.push({ alt, credito: extras.credito }); return { ok: true, archivo: archivo(50, { alt }) }; },
        },
      }],
    }).compileComponents();
  });

  function montar(inicial: ItemEditable[] = [], tipo: 'fotos' | 'videos' | 'mixto' | null = 'mixto'): void {
    items = inicial;
    fixture = TestBed.createComponent(AdminGaleriaItemsComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('tipoDeAlbum', tipo);
    componente.itemsChange.subscribe(l => { items = l; fixture.componentRef.setInput('items', l); });
    componente.portadaChange.subscribe(p => portadas.push(p));
    componente.listaDetectada.subscribe(u => listas.push(u));
    fixture.detectChanges();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('un álbum de fotos no ofrece añadir videos y uno de videos no ofrece añadir fotos', () => {
    montar([], 'fotos');
    expect(texto()).toContain('Añadir fotos');
    expect(texto()).not.toContain('Añadir un video');
    montar([], 'videos');
    expect(texto()).not.toContain('Añadir fotos');
    expect(texto()).toContain('Añadir un video');
    expect(texto()).toContain('Pegar varios enlaces');
  });

  it('al añadir del Banco solo se ofrecen imágenes y la foto hereda su texto alternativo y su crédito; sin él queda señalada', async () => {
    montar([]);
    componente.abrir('fotos');
    await fixture.whenStable();
    expect(componente.archivosDelBanco().map(a => a.id)).toEqual([1, 2]);
    componente.alternarElegida(componente.archivosDelBanco()[0]);
    componente.alternarElegida(componente.archivosDelBanco()[1]);
    componente.anadirElegidas();
    expect(items.map(i => [i.archivoId, i.textoAlternativo, i.credito])).toEqual([[1, 'Descripción 1', 'Archivo PNMC'], [2, '', '']]);
    fixture.detectChanges();
    expect(texto()).toContain('necesita su texto alternativo');
  });

  it('no repite una foto que ya está y no cierra si no se eligió ninguna', async () => {
    montar([itemNuevo({ tipoItem: 'foto', archivoId: 1, textoAlternativo: 'x', imagenUrl: '/a' })]);
    componente.abrir('fotos');
    await fixture.whenStable();
    expect(componente.yaEstaEnLaLista(1)).toBeTrue();
    componente.alternarElegida(archivo(1));
    expect(componente.elegidas().size).toBe(0);
    componente.anadirElegidas();
    expect(componente.errorDelDialogo()).toContain('Pulsa una o más imágenes');
    expect(items.length).toBe(1);
  });

  it('subir exige elegir el archivo y escribir el texto alternativo antes; luego sube con el crédito y añade la foto', async () => {
    montar([]);
    componente.abrir('fotos');
    await componente.subirYAnadir();
    expect(componente.errorDelDialogo()).toContain('Elige primero la imagen');
    componente.archivoParaSubir.set(new File(['x'], 'foto.png', { type: 'image/png' }));
    await componente.subirYAnadir();
    expect(componente.errorDelDialogo()).toContain('texto alternativo');
    componente.altParaSubir.set('Plaza llena de gente');
    componente.creditoParaSubir.set('Foto: Ana');
    await componente.subirYAnadir();
    expect(subidas).toEqual([{ alt: 'Plaza llena de gente', credito: 'Foto: Ana' }]);
    expect(items[0]).toEqual(jasmine.objectContaining({ archivoId: 50, textoAlternativo: 'Plaza llena de gente', credito: 'Foto: Ana' }));
  });

  it('una imagen que no es WebP/PNG/JPEG o pesa más de 2 MB se rechaza al elegirla', () => {
    montar([]);
    componente.abrir('fotos');
    const entrada = document.createElement('input');
    Object.defineProperty(entrada, 'files', { value: [new File([new Uint8Array(3 * 1048576)], 'grande.jpg', { type: 'image/jpeg' })] });
    componente.alElegirArchivo({ target: entrada } as unknown as Event);
    expect(componente.errorDelDialogo()).toContain('3,0 MB');
    expect(componente.archivoParaSubir()).toBeNull();
  });

  it('un enlace de YouTube se reconoce; uno de Vimeo, de otro sitio o de una lista se rechaza con su motivo', () => {
    montar([]);
    componente.abrir('video');
    componente.tituloNuevo.set('Carlos Delgado');
    componente.enlaceNuevo.set('https://vimeo.com/123');
    componente.anadirVideo();
    expect(componente.errorDelDialogo()).toContain('Vimeo');
    componente.enlaceNuevo.set('https://example.com/x');
    componente.anadirVideo();
    expect(componente.errorDelDialogo()).toContain('YouTube');
    componente.enlaceNuevo.set('https://youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8');
    componente.anadirVideo();
    expect(componente.errorDelDialogo()).toContain('lista de reproducción');
    expect(items.length).toBe(0);

    componente.enlaceNuevo.set('https://www.youtube.com/watch?v=Rv5Oiq8UXi0');
    componente.anadirVideo();
    expect(items.map(i => [i.tipoItem, i.videoId, i.titulo])).toEqual([['video', 'Rv5Oiq8UXi0', 'Carlos Delgado']]);
  });

  it('el video lleva título obligatorio y no se repite', () => {
    montar([itemNuevo({ tipoItem: 'video', videoId: 'Rv5Oiq8UXi0', titulo: 'Uno' })]);
    componente.abrir('video');
    componente.enlaceNuevo.set('Rv5Oiq8UXi0');
    componente.anadirVideo();
    expect(componente.errorDelDialogo()).toContain('título');
    componente.tituloNuevo.set('Otra vez');
    componente.anadirVideo();
    expect(componente.errorDelDialogo()).toContain('ya está');
  });

  it('pegar varios enlaces arma los videos de la lista, ofrece la lista de origen y enumera lo que no sirve', () => {
    montar([]);
    componente.abrir('varios');
    componente.textoDeVarios.set('https://youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8\nhttps://youtu.be/Rv5Oiq8UXi0\nhttps://www.youtube.com/watch?v=FqTfFxwH8QA&list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8\nhttps://vimeo.com/9');
    componente.anadirVarios();
    expect(componente.errorDelDialogo()).toContain('Línea 4');
    expect(items.length).toBe(0);

    componente.textoDeVarios.set('https://youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8\nhttps://youtu.be/Rv5Oiq8UXi0\nhttps://www.youtube.com/watch?v=FqTfFxwH8QA');
    componente.anadirVarios();
    expect(items.map(i => i.videoId)).toEqual(['Rv5Oiq8UXi0', 'FqTfFxwH8QA']);
    expect(items.every(i => i.titulo === '')).toBeTrue();
    expect(listas).toEqual(['https://www.youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8']);
  });

  it('reordena con las flechas, quita ítems y, si se quita la portada, avisa para volver a la de omisión', () => {
    const a = itemNuevo({ tipoItem: 'foto', archivoId: 1, textoAlternativo: 'a', imagenUrl: '/1' });
    const b = itemNuevo({ tipoItem: 'foto', archivoId: 2, textoAlternativo: 'b', imagenUrl: '/2' });
    montar([a, b], 'fotos');
    fixture.componentRef.setInput('portadaArchivoId', 2);
    componente.moverItem(1, -1);
    expect(items.map(i => i.archivoId)).toEqual([2, 1]);
    componente.quitar(b.clave);
    expect(items.map(i => i.archivoId)).toEqual([1]);
    expect(portadas).toEqual([null]);
    componente.comoPortada(items[0]);
    expect(portadas[1]).toEqual({ archivoId: 1, url: '/1' });
  });

  it('pagina las filas con selector de cantidad cuando hay más de las que caben', () => {
    const muchas = Array.from({ length: 30 }, (_, n) => itemNuevo({ tipoItem: 'foto', archivoId: n + 1, textoAlternativo: `f${n}`, imagenUrl: `/${n}` }));
    montar(muchas, 'fotos');
    expect(componente.visibles().length).toBe(12);
    expect(componente.totalDePaginas()).toBe(3);
    expect(texto()).toContain('Ítems por página');
    componente.pagina.set(3);
    expect(componente.visibles().map(v => v.indice)[0]).toBe(24);
    componente.cambiarPorPagina(48);
    expect(componente.visibles().length).toBe(30);
    expect(componente.pagina()).toBe(1);
  });

  it('el posible texto alternativo vacío marca la fila con aria-invalid', () => {
    montar([itemNuevo({ tipoItem: 'foto', archivoId: 1, textoAlternativo: '', imagenUrl: '/1' })], 'fotos');
    const campo = (fixture.nativeElement as HTMLElement).querySelector('[data-campo="alternativo"]');
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
  });
});
