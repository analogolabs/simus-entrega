import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCatalogosComponent } from './admin-catalogos.component';
import { BancoDeArchivosService } from '../../../core/services/banco-de-archivos.service';
import {
  CatalogosAdminService, ElementoDeCatalogo, FormularioDeElemento, ResultadoDeImportacion, TipoDeCatalogo,
} from '../../../core/services/catalogos-admin.service';

/**
 * La sección «Catálogos»: territorios sonoros y prácticas musicales.
 *
 * <b>LO QUE FIJAN.</b> Que cada pestaña muestra su catálogo con el estado de su ficha; que la búsqueda ignora tildes y
 * encuentra por sinónimo; que con filtros no se puede reordenar (movería lo que no se ve); que crear manda lo que el
 * servidor valida; que lo que está en uso no ofrece «Eliminar»; que el orden se manda completo con cada principal y sus
 * subcategorías; y que la importación pide vista previa y no se aplica con errores.
 */
describe('administración de los catálogos conceptuales', () => {
  let fixture: ComponentFixture<AdminCatalogosComponent>;
  let componente: AdminCatalogosComponent;
  let creados: { tipo: TipoDeCatalogo; cuerpo: FormularioDeElemento }[];
  let ordenes: { tipo: TipoDeCatalogo; ids: number[] }[];
  let importaciones: { aplicar: boolean }[];
  let resultadoDeImportacion: ResultadoDeImportacion;

  const e = (id: number, nombre: string, extra: Partial<ElementoDeCatalogo> = {}): ElementoDeCatalogo => ({
    id, nombre, slug: nombre.toLowerCase().replace(/\s+/g, '-'), orden: id, activo: true, padreId: null, padreNombre: null, sinonimos: null,
    observaciones: null, definicionBreve: null, definicionAmpliada: null, caracteristicas: null, relacionTerritorial: null, contextos: null,
    ejemplos: null, fuentes: null, esPreliminar: false, imagenArchivoId: null, imagenUrl: null, textoAlternativoRecurso: null,
    fechaActualizacion: null, totalDeUsos: 0, usos: [], subelementos: 0, estadoDeFicha: 'pendiente', ...extra,
  });

  const TERRITORIOS = [
    e(1, 'Joropo', { estadoDeFicha: 'completa', definicionBreve: 'Texto.', totalDeUsos: 4, usos: [{ fuente: 'Festivales', total: 4 }] }),
    e(2, 'Marimba', { estadoDeFicha: 'preliminar', definicionBreve: 'Borrador.', esPreliminar: true }),
  ];
  const PRACTICAS = [
    e(10, 'Músicas vocales', { orden: 1, subelementos: 1, sinonimos: 'coros; canto coral' }),
    e(11, 'Coros infantiles', { padreId: 10, padreNombre: 'Músicas vocales', orden: 2 }),
    e(12, 'Electrónica', { activo: false, orden: 3 }),
  ];

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    creados = []; ordenes = []; importaciones = [];
    resultadoDeImportacion = { aplicada: false, crea: 1, actualiza: 0, sinCambios: 0, conErrores: 0, filas: [{ numero: 1, nombre: 'Nueva', accion: 'crear', cambios: ['Elemento nuevo'], errores: [] }] };
    const servicio: Partial<CatalogosAdminService> = {
      listar: (async (tipo: TipoDeCatalogo) => ({ ok: true, data: { items: tipo === 'territorios-sonoros' ? TERRITORIOS : PRACTICAS, total: 0 } })) as CatalogosAdminService['listar'],
      crear: (async (tipo: TipoDeCatalogo, cuerpo: FormularioDeElemento) => { creados.push({ tipo, cuerpo }); return { ok: true, data: e(99, cuerpo.nombre) }; }) as unknown as CatalogosAdminService['crear'],
      ordenar: (async (tipo: TipoDeCatalogo, ids: number[]) => { ordenes.push({ tipo, ids }); return { ok: true, data: { items: PRACTICAS, total: 3 } }; }) as unknown as CatalogosAdminService['ordenar'],
      importar: (async (_t: TipoDeCatalogo, _f: unknown, aplicar: boolean) => { importaciones.push({ aplicar }); return { ok: true, data: { ...resultadoDeImportacion, aplicada: aplicar && resultadoDeImportacion.conErrores === 0 } }; }) as unknown as CatalogosAdminService['importar'],
    };
    await TestBed.configureTestingModule({
      imports: [AdminCatalogosComponent],
      providers: [
        { provide: CatalogosAdminService, useValue: servicio },
        { provide: BancoDeArchivosService, useValue: { listar: async () => ({ ok: true, data: { items: [] } }) } },
      ],
    }).compileComponents();
  });

  async function abrir(): Promise<void> {
    fixture = TestBed.createComponent(AdminCatalogosComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra cada catálogo en su pestaña, con el estado de la ficha y el uso', async () => {
    await abrir();
    expect(componente.pestanas().map(p => p.conteo)).toEqual([2, 3]);
    expect(texto()).toContain('Joropo');
    expect(texto()).toContain('Ficha completa');
    expect(texto()).toContain('Definición preliminar');

    componente.elegirPestana('practicas-musicales');
    fixture.detectChanges();
    expect(texto()).toContain('Músicas vocales');
    expect(texto()).toContain('Coros infantiles');
    expect(texto()).toContain('Desactivado');
    expect(texto()).toContain('Sin uso');
  });

  it('las subcategorías van debajo de su principal y la búsqueda ignora tildes y encuentra por sinónimo', async () => {
    await abrir();
    componente.elegirPestana('practicas-musicales');
    expect(componente.filas().map(f => [f.e.id, f.nivel])).toEqual([[10, 0], [11, 1], [12, 0]]);

    componente.busqueda.set('MUSICAS');
    expect(componente.filas().map(f => f.e.id)).toEqual([10]);
    componente.busqueda.set('canto coral');
    expect(componente.filas().map(f => f.e.id)).toEqual([10]);
    componente.filtroActivo.set('desactivados');
    componente.busqueda.set('');
    expect(componente.filas().map(f => f.e.id)).toEqual([12]);
  });

  it('con búsqueda o filtros no se reordena', async () => {
    await abrir();
    componente.elegirPestana('practicas-musicales');
    componente.busqueda.set('musicas');
    await componente.mover(PRACTICAS[0], 1);
    expect(ordenes).toEqual([]);
  });

  it('el orden se manda completo: cada principal seguida de sus subcategorías', async () => {
    await abrir();
    componente.elegirPestana('practicas-musicales');
    await componente.mover(PRACTICAS[0], 1);
    expect(ordenes).toEqual([{ tipo: 'practicas-musicales', ids: [12, 10, 11] }]);
  });

  it('crear manda el formulario limpio y nunca la relación territorial de una práctica', async () => {
    await abrir();
    componente.elegirPestana('practicas-musicales');
    componente.nuevo();
    componente.campo('nombre', '  Músicas nuevas  ');
    componente.campo('relacionTerritorial', 'No va');
    componente.campo('definicionBreve', '  ');
    await componente.guardar();
    expect(creados.length).toBe(1);
    expect(creados[0].cuerpo.nombre).toBe('Músicas nuevas');
    expect(creados[0].cuerpo.relacionTerritorial).toBeNull();
    expect(creados[0].cuerpo.definicionBreve).toBeNull();
    expect(componente.formulario()).toBeNull();
  });

  it('no guarda sin nombre ni una imagen sin texto alternativo', async () => {
    await abrir();
    componente.nuevo();
    await componente.guardar();
    expect(creados.length).toBe(0);
    expect(componente.error()).toBe('Escribe el nombre.');
    componente.campo('nombre', 'Algo');
    componente.campo('imagenArchivoId', 5);
    expect(componente.problemas()).toEqual(['La imagen necesita su texto alternativo.']);
  });

  it('lo que está en uso no ofrece eliminar y dice por qué', async () => {
    await abrir();
    const eliminar = componente.accionesDe(TERRITORIOS[0]).find(a => a.id === 'eliminar');
    expect(eliminar?.deshabilitada).toBeTrue();
    expect(eliminar?.motivo).toContain('desactívalo');
    expect(componente.accionesDe(TERRITORIOS[1]).find(a => a.id === 'eliminar')?.deshabilitada).toBeFalse();
  });

  it('la importación pide vista previa y con errores no se puede aplicar', async () => {
    await abrir();
    componente.importacion.set({ nombreDelArchivo: 'hoja.csv', filas: [{ Nombre: 'Nueva' }], resultado: { ...resultadoDeImportacion, conErrores: 1 } });
    await componente.aplicarImportacion();
    expect(importaciones).toEqual([]);

    componente.importacion.set({ nombreDelArchivo: 'hoja.csv', filas: [{ Nombre: 'Nueva' }], resultado: resultadoDeImportacion });
    await componente.aplicarImportacion();
    expect(importaciones).toEqual([{ aplicar: true }]);
    expect(componente.importacion()).toBeNull();
    expect(componente.aviso()).toContain('1 nuevos');
  });
});
