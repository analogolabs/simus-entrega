import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArchivoEnElBanco, BancoDeArchivosService, PaginaDelBanco } from '../../../core/services/banco-de-archivos.service';
import { PeticionDeConfirmacion, RespuestaDeConfirmacion, ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { BibliotecaDeArchivosComponent } from './biblioteca-de-archivos.component';

function archivo(id: number, resto: Partial<ArchivoEnElBanco> = {}): ArchivoEnElBanco {
  return {
    id, nombre: `afiche-${id}.jpg`, tipo: 'image/jpeg', bytes: 48 * 1024, alt: `Afiche ${id}`, pie: null, credito: null, ancho: 720, alto: 960,
    url: `/api/v1/archivos/${id}`, fechaCarga: `2026-11-${10 + id}T21:14:00Z`, procedencia: 'organizacion', organizacionId: 7, organizacionNombre: 'Casa Taller',
    subidoPor: null, usos: [{ modulo: 'festivales', descripcion: 'Festival del Macizo', esPublico: true }], huerfano: false, visiblePublicamente: true,
    ...resto,
  };
}

const ARCHIVOS: ArchivoEnElBanco[] = [
  archivo(1, { nombre: 'mercado.jpg', alt: 'Afiche del mercado', bytes: 48 * 1024, huerfano: true, usos: [], visiblePublicamente: false }),
  archivo(2, { nombre: 'chirimias.jpg', alt: 'Chirimías en la plaza', bytes: 43 * 1024 }),
  archivo(3, { nombre: 'macizo.png', tipo: 'image/png', alt: null, bytes: 90 * 1024 }),
];

class BancoFalso {
  rutas: { canal: string; opciones: unknown }[] = [];
  retirados: number[] = [];
  respuestaDeRetiro: { ok: boolean; error?: string; usos?: string[] } = { ok: true };
  paginas: PaginaDelBanco[] = [{ items: ARCHIVOS, pagina: 1, tamano: 100, total: 3, totalPaginas: 1, cuotaBytes: null, usadoBytes: null }];
  async listar(canal: string, opciones: unknown): Promise<{ ok: boolean; data?: PaginaDelBanco; error?: string }> {
    this.rutas.push({ canal, opciones });
    const n = (opciones as { pagina: number }).pagina;
    return { ok: true, data: this.paginas[n - 1] };
  }
  async retirar(_canal: string, id: number): Promise<{ ok: boolean; error?: string; usos?: string[] }> {
    this.retirados.push(id);
    return this.respuestaDeRetiro;
  }
}

class ConfirmacionesFalsas {
  respuesta: RespuestaDeConfirmacion = { motivo: '' };
  pedidas: PeticionDeConfirmacion[] = [];
  pedir(peticion: PeticionDeConfirmacion): Promise<RespuestaDeConfirmacion> { this.pedidas.push(peticion); return Promise.resolve(this.respuesta); }
}

describe('BibliotecaDeArchivosComponent', () => {
  let fixture: ComponentFixture<BibliotecaDeArchivosComponent>;
  let banco: BancoFalso;
  let confirmaciones: ConfirmacionesFalsas;
  let el: HTMLElement;

  async function montar(ajustar?: (b: BancoFalso) => void): Promise<void> {
    banco = new BancoFalso();
    confirmaciones = new ConfirmacionesFalsas();
    ajustar?.(banco);
    await TestBed.configureTestingModule({
      imports: [BibliotecaDeArchivosComponent],
      providers: [{ provide: BancoDeArchivosService, useValue: banco }, { provide: ServicioDeConfirmacion, useValue: confirmaciones }],
    }).compileComponents();
    fixture = TestBed.createComponent(BibliotecaDeArchivosComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }
  const nombres = (): string[] => Array.from(el.querySelectorAll('[data-testid="archivo-tarjeta"] .tarjeta__nombre')).map(n => n.textContent!.trim());
  const limpiar = (t: string | null): string => (t ?? '').replace(/\s+/g, ' ').trim();

  it('lee el banco por el canal EXTERNO, todos los archivos de una vez', async () => {
    await montar();
    expect(banco.rutas.map(r => r.canal)).toEqual(['externo']);
    expect((banco.rutas[0].opciones as { tamano: number }).tamano).toBe(100);
  });

  it('abre en cuadrícula, con lo último que se cargó primero, y marca «Sin usar» sobre la miniatura', async () => {
    await montar();
    expect(nombres()).toEqual(['macizo.png', 'chirimias.jpg', 'mercado.jpg']);
    const sinUsar = el.querySelector('[data-testid="archivo-tarjeta"][data-uso="sin-usar"]')!;
    expect(sinUsar.textContent).toContain('Sin usar');
    expect(limpiar(el.querySelector('[data-testid="resumen-de-archivos"]')!.textContent)).toContain('3 archivos · 1 sin usar (48 KB). No se borra nada por sí solo.');
    expect(limpiar(el.querySelector('[data-testid="archivo-tarjeta"]')!.textContent)).toContain('90 KB · 720×960 · Pública');
  });

  it('busca por nombre o por texto alternativo, sin tildes ni mayúsculas', async () => {
    await montar();
    fixture.componentInstance.busqueda.set('CHIRIMIAS');
    fixture.detectChanges();
    expect(nombres()).toEqual(['chirimias.jpg']);
    fixture.componentInstance.busqueda.set('afiche del mercado');
    fixture.detectChanges();
    expect(nombres()).toEqual(['mercado.jpg']);
    expect(limpiar(el.querySelector('[role="status"]')!.textContent)).toBeDefined();
  });

  it('filtra por uso y por visibilidad, y «Quitar filtros» los devuelve todos', async () => {
    await montar();
    fixture.componentInstance.uso.set('sin_usar');
    fixture.detectChanges();
    expect(nombres()).toEqual(['mercado.jpg']);
    fixture.componentInstance.uso.set('todos');
    fixture.componentInstance.visibilidad.set('privada');
    fixture.detectChanges();
    expect(nombres()).toEqual(['mercado.jpg']);
    fixture.componentInstance.busqueda.set('no existe');
    fixture.detectChanges();
    expect(el.textContent).toContain('No hay archivos que coincidan');
    fixture.componentInstance.quitarFiltros();
    fixture.detectChanges();
    expect(nombres().length).toBe(3);
  });

  it('ordena por nombre, tamaño o tipo, en cualquier sentido', async () => {
    await montar();
    fixture.componentInstance.orden.set({ columna: 'nombre', direccion: 'asc' });
    fixture.detectChanges();
    expect(nombres()).toEqual(['chirimias.jpg', 'macizo.png', 'mercado.jpg']);
    fixture.componentInstance.orden.set({ columna: 'tamano', direccion: 'desc' });
    fixture.detectChanges();
    expect(nombres()[0]).toBe('macizo.png');
    fixture.componentInstance.orden.set({ columna: 'tipo', direccion: 'asc' });
    fixture.detectChanges();
    expect(nombres()[2]).toBe('macizo.png');
  });

  it('la vista de lista es una tabla con encabezados ordenables y la fila abre la ficha', async () => {
    await montar();
    fixture.componentInstance.vista.set('lista');
    fixture.detectChanges();
    const tabla = el.querySelector('[data-testid="archivos-lista"] table')!;
    expect(Array.from(tabla.querySelectorAll('th')).map(th => limpiar(th.textContent).replace(/[▲▼]/g, ''))).toEqual(['Nombre', 'Uso', 'Visibilidad', 'Tamaño', 'Fecha de carga', 'Acciones']);
    expect(tabla.querySelector('th[aria-sort="descending"]')?.textContent).toContain('Fecha de carga');
    tabla.querySelector<HTMLElement>('[data-testid="fila-de-archivo"] td:last-of-type')!.parentElement!.querySelector<HTMLElement>('td')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.seleccionado()?.nombre).toBe('macizo.png');
  });

  it('la ficha lateral dice tipo, tamaño, dónde se usa y el texto alternativo, y ofrece ver y descargar', async () => {
    await montar();
    el.querySelector<HTMLButtonElement>('[data-testid="archivo-tarjeta"][data-uso="sin-usar"] .tarjeta__nombre')!.click();
    fixture.detectChanges();
    const ficha = document.body.querySelector('[data-testid="ficha-de-archivo"]')!;
    const texto = limpiar(ficha.textContent);
    expect(texto).toContain('JPG · imagen');
    expect(texto).toContain('48 KB · 720×960 px');
    expect(texto).toContain('Ninguna ficha usa este archivo');
    expect(texto).toContain('Afiche del mercado');
    expect(texto).toContain('Ver el archivo');
    expect(ficha.querySelector('a[download]')?.getAttribute('href')).toBe('/api/v1/archivos/1');
    fixture.componentInstance.cerrarFicha();
    fixture.detectChanges();
    expect(document.body.querySelector('[data-testid="ficha-de-archivo"]')).toBeNull();
  });

  it('un archivo en uso no se puede retirar, y la ficha dice dónde se usa', async () => {
    await montar();
    fixture.componentInstance.abrirFicha(ARCHIVOS[1]);
    fixture.detectChanges();
    const ficha = document.body.querySelector('[data-testid="ficha-de-archivo"]')!;
    expect(ficha.querySelector('[data-testid="usos-del-archivo"]')?.textContent).toContain('Festival del Macizo');
    expect(ficha.querySelector<HTMLButtonElement>('[data-testid="ficha-retirar"]')!.disabled).toBeTrue();
    const acciones = fixture.componentInstance.accionesDe(ARCHIVOS[1]);
    expect(acciones.find(a => a.id === 'retirar')?.deshabilitada).toBeTrue();
    expect(acciones.find(a => a.id === 'retirar')?.motivo).toContain('Festival del Macizo');
  });

  it('retirar uno sin usar pide confirmación, lo retira y recarga la lista', async () => {
    await montar();
    await fixture.componentInstance.retirar(ARCHIVOS[0]);
    expect(confirmaciones.pedidas.map(p => p.titulo)).toEqual(['Retirar del banco']);
    expect(banco.retirados).toEqual([1]);
    expect(banco.rutas.length).toBe(2);
    fixture.detectChanges();
    expect(el.textContent).toContain('Se retiró mercado.jpg.');
  });

  it('cancelar la confirmación no retira nada', async () => {
    await montar();
    confirmaciones.respuesta = null;
    await fixture.componentInstance.retirar(ARCHIVOS[0]);
    expect(banco.retirados).toEqual([]);
  });

  it('si el servidor rechaza el retiro, dice por qué y no pierde la lista', async () => {
    await montar(b => { b.respuestaDeRetiro = { ok: false, error: 'No se puede retirar.', usos: ['Festival del Macizo'] }; });
    await fixture.componentInstance.retirarConfirmado(ARCHIVOS[0]);
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se puede retirar. Festival del Macizo');
    expect(nombres().length).toBe(3);
  });

  it('lee todas las páginas si el servidor las devuelve partidas', async () => {
    await montar(b => {
      b.paginas = [
        { items: [ARCHIVOS[0]], pagina: 1, tamano: 100, total: 2, totalPaginas: 2, cuotaBytes: null, usadoBytes: null },
        { items: [ARCHIVOS[1]], pagina: 2, tamano: 100, total: 2, totalPaginas: 2, cuotaBytes: null, usadoBytes: null },
      ];
    });
    expect(nombres().length).toBe(2);
  });

  it('sin archivos lo dice, y no ofrece buscar ni filtrar', async () => {
    await montar(b => { b.paginas = [{ items: [], pagina: 1, tamano: 100, total: 0, totalPaginas: 1, cuotaBytes: null, usadoBytes: null }]; });
    expect(el.textContent).toContain('Todavía no hay archivos');
    expect(el.querySelector('app-barra-de-herramientas')).toBeNull();
  });
});
