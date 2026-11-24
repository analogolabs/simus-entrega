import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminCelebraLaMusicaComponent } from './admin-celebra-la-musica.component';
import { CelebraLaMusicaService, EdicionDeCelebra, EdicionDeCelebraResumen } from '../../../core/services/celebra-la-musica.service';
import { BancoDeArchivosService } from '../../../core/services/banco-de-archivos.service';

const RESUMEN = (anio: number, publicada: boolean, actual = false): EdicionDeCelebraResumen => ({
  anio, nombre: `Celebra la Música ${anio}`, hashtag: null, proyectoCodigo: `celebra-la-musica-${anio}`, actual, publicada,
  colorPrincipal: '#D8175A', colorSecundario: '#09153C', imagenPortadaUrl: null, resumen: null,
});
const EDICION = (anio: number, publicada: boolean): EdicionDeCelebra => ({
  ...RESUMEN(anio, publicada), imagenPortadaArchivoId: null, fechaInicio: `${anio}-11-01`, fechaFin: `${anio}-11-30`, presentacion: 'Texto.', aliados: null,
  actividades: 10, municipios: null, departamentos: null, organizaciones: null, musicos: null, fuente: null, pendienteDeValidar: false, fechaActualizacion: null,
  categorias: [{ nombre: 'Circuitos sonoros', descripcion: null, orden: 1 }],
  recursos: [{ id: 1, grupo: 'Guías', titulo: 'Guía', descripcion: null, archivoId: null, url: 'https://example.test/g.pdf', orden: 1 }],
  preguntas: [{ pregunta: 'Uno', respuesta: 'a', orden: 1 }, { pregunta: 'Dos', respuesta: 'b', orden: 2 }],
  galeria: [{ archivoId: 7, url: '/api/v1/publico/archivos/7', textoAlternativo: 'Foto', credito: 'Fuente: prueba', orden: 1 }],
});

describe('AdminCelebraLaMusicaComponent', () => {
  let fixture: ComponentFixture<AdminCelebraLaMusicaComponent>;
  let comp: AdminCelebraLaMusicaComponent;
  let servicio: { ediciones: jasmine.Spy; edicion: jasmine.Spy; guardar: jasmine.Spy; historial: jasmine.Spy };
  let raiz: HTMLElement;

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminCelebraLaMusicaComponent],
      providers: [
        { provide: CelebraLaMusicaService, useValue: servicio },
        { provide: BancoDeArchivosService, useValue: { listar: jasmine.createSpy().and.resolveTo({ ok: true, data: { items: [] } }), subirDocumento: jasmine.createSpy() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminCelebraLaMusicaComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    raiz = fixture.nativeElement as HTMLElement;
  }

  const refrescar = async (): Promise<void> => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };

  beforeEach(() => {
    servicio = {
      ediciones: jasmine.createSpy().and.resolveTo({ ok: true, data: [RESUMEN(2026, true, true), RESUMEN(2025, false)] }),
      edicion: jasmine.createSpy().and.callFake(async (anio: number) => ({ ok: true, data: EDICION(anio, anio === 2026) })),
      guardar: jasmine.createSpy().and.callFake(async (anio: number, s: { publicada: boolean }) => ({ ok: true, data: EDICION(anio, s.publicada) })),
      historial: jasmine.createSpy().and.resolveTo({ ok: true, data: [{ fecha: '2026-11-20T10:00:00Z', usuario: 'Gestora', accion: 'actualizar', resumen: 'Actualizó el contenido.' }] }),
    };
  });

  it('lista las ediciones con su estado y su proyecto, y pide la lista de la consola (con borradores)', async () => {
    await montar();
    expect(servicio.ediciones).toHaveBeenCalledWith(true);
    const filas = raiz.querySelectorAll('[data-testid="celebra-ediciones"] tbody tr');
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Publicada');
    expect(filas[0].textContent).toContain('Edición vigente');
    expect(filas[1].textContent).toContain('Borrador');
    expect(filas[1].textContent).toContain('celebra-la-musica-2025');
  });

  it('un error de la lista dice el motivo y deja reintentar', async () => {
    servicio.ediciones.and.resolveTo({ ok: false, error: 'No fue posible consultar las ediciones.' });
    await montar();
    expect(raiz.textContent).toContain('No pudimos consultar las ediciones');
    expect(raiz.textContent).toContain('No fue posible consultar las ediciones.');
    expect(Array.from(raiz.querySelectorAll('button')).some((b) => b.textContent?.includes('Reintentar'))).toBeTrue();
  });

  it('crear un año que ya existe se rechaza; uno nuevo abre el editor sin guardar todavía', async () => {
    await montar();
    comp.abrirNuevo();
    comp.cambiarAnio(2026);
    comp.crearEdicion();
    expect(comp.nuevoAnio()?.error).toContain('ya existe');
    comp.cambiarAnio(2027);
    comp.crearEdicion();
    await refrescar();
    expect(comp.modelo()?.anio).toBe(2027);
    expect(comp.modelo()?.nueva).toBeTrue();
    expect(servicio.guardar).not.toHaveBeenCalled();
    expect(raiz.textContent).toContain('Crear la edición');
  });

  it('al abrir una edición carga su contenido y su historial', async () => {
    await montar();
    await comp.abrir(2026);
    await refrescar();
    expect(raiz.querySelectorAll('[data-testid="celebra-preguntas"] li').length).toBe(2);
    expect(raiz.querySelectorAll('[data-testid="celebra-galeria"] li').length).toBe(1);
    expect(raiz.querySelector('[data-testid="celebra-historial"]')?.textContent).toContain('Actualizó el contenido.');
    expect(raiz.querySelector('[data-testid="celebra-vista-previa"]')?.getAttribute('href')).toContain('/2026?vistaPrevia=1');
  });

  it('avisa si el color no deja leer el encabezado con contraste AA', async () => {
    await montar();
    await comp.abrir(2026);
    comp.campo('colorPrincipal', '#7B7B7B');
    await refrescar();
    expect(raiz.querySelector('[data-testid="celebra-contraste-principal"]')?.textContent).toContain('no cumple el contraste AA');
    comp.campo('colorPrincipal', '#4C007E');
    await refrescar();
    expect(raiz.querySelector('[data-testid="celebra-contraste-principal"]')).toBeNull();
  });

  it('no guarda con una imagen de la galería sin crédito ni con un recurso sin destino, y lo dice', async () => {
    await montar();
    await comp.abrir(2026);
    comp.editarItem('galeria', 0, { credito: '' });
    comp.agregar('recursos');
    comp.editarItem('recursos', 1, { titulo: 'Sin enlace', grupo: 'Guías' });
    await refrescar();
    const problemas = comp.problemas().join(' ');
    expect(problemas).toContain('crédito');
    expect(problemas).toContain('https://');
    await comp.guardar();
    expect(servicio.guardar).not.toHaveBeenCalled();
    await refrescar();
    expect(raiz.querySelector('[data-testid="celebra-error"]')?.textContent).toContain('Corrige');
  });

  it('guarda la edición completa con el orden de las listas y las cifras vacías como nulo', async () => {
    await montar();
    await comp.abrir(2025);
    comp.mover('preguntas', 0, 1);
    await comp.guardar();
    const [anio, solicitud] = servicio.guardar.calls.mostRecent().args;
    expect(anio).toBe(2025);
    expect(solicitud.preguntas.map((q: { pregunta: string; orden: number }) => `${q.orden}:${q.pregunta}`)).toEqual(['1:Dos', '2:Uno']);
    expect(solicitud.municipios).toBeNull();
    expect(solicitud.actividades).toBe(10);
    expect(solicitud.recursos[0]).toEqual(jasmine.objectContaining({ archivoId: null, url: 'https://example.test/g.pdf' }));
    expect(comp.aviso()).toBe('Cambios guardados.');
  });

  it('publicar y despublicar guardan el estado, y un error del servidor se muestra tal cual', async () => {
    await montar();
    await comp.abrir(2025);
    await comp.publicar();
    expect(servicio.guardar.calls.mostRecent().args[1].publicada).toBeTrue();
    expect(comp.aviso()).toBe('La edición quedó publicada.');
    servicio.guardar.and.resolveTo({ ok: false, error: 'La fecha de fin no puede ser anterior a la de inicio.' });
    await comp.despublicar();
    expect(comp.error()).toBe('La fecha de fin no puede ser anterior a la de inicio.');
  });
});
