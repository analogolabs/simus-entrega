import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminTaxonomiaDePerfilesComponent } from './admin-taxonomia-de-perfiles.component';
import {
  ListaDeTaxonomia,
  TaxonomiaDePerfilesAdminService,
  ValorDeTaxonomiaAdministrado,
} from '../../../core/services/taxonomia-de-perfiles-admin.service';

/**
 * Roles, servicios e instrumentos de los perfiles de personas, administrables desde el Catálogo (decisión 133).
 *
 * <b>LO QUE FIJAN.</b> Que cada lista muestra solo lo suyo; que desactivar no borra (el valor sigue en la tabla con su
 * estado y cuántas personas lo tienen); que el error de carga ofrece Reintentar y no deja la pantalla vacía como si no
 * hubiera nada; y que crear y renombrar mandan lo que corresponde (la dimensión solo al crear).
 */
describe('administración de la taxonomía de perfiles', () => {
  let fixture: ComponentFixture<AdminTaxonomiaDePerfilesComponent>;
  let componente: AdminTaxonomiaDePerfilesComponent;
  let llamadas: { categorias: { id: number; idPadre: number | null }[]; creado: unknown[]; guardado: { id: number; cambios: unknown }[]; movido: { id: number; sentido: number }[]; listados: number };
  let fallar: boolean;

  const valor = (id: number, dimension: ValorDeTaxonomiaAdministrado['dimension'], codigo: string, nombre: string, extra: Partial<ValorDeTaxonomiaAdministrado> = {}): ValorDeTaxonomiaAdministrado => ({
    id, dimension, codigo, nombre, grupoSoyCultura: null, fuente: null, activo: true, ordenVisualizacion: id, personas: 0, idPadre: null, codigoDePadre: null, subcategorias: 0, ...extra,
  });
  const LISTA: ListaDeTaxonomia = {
    items: [
      valor(1, 'rol', 'docente', 'Docente', { personas: 3, grupoSoyCultura: 'otro' }),
      valor(2, 'rol', 'luthier', 'Lutier', { activo: false }),
      valor(3, 'servicio', 'clases', 'Clases'),
      valor(4, 'instrumento', 'voz', 'Voz'),
    ],
    total: 4,
    maximos: { rol: 6, servicio: 8, instrumento: 8 },
  };

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    llamadas = { categorias: [], creado: [], guardado: [], movido: [], listados: 0 };
    fallar = false;
    const servicio: Partial<TaxonomiaDePerfilesAdminService> = {
      listar: (async () => { llamadas.listados++; return fallar ? { ok: false, error: 'Sin conexión.' } : { ok: true, data: LISTA }; }) as TaxonomiaDePerfilesAdminService['listar'],
      crear: (async (cambios: unknown) => { llamadas.creado.push(cambios); return { ok: true }; }) as unknown as TaxonomiaDePerfilesAdminService['crear'],
      guardar: (async (id: number, cambios: unknown) => { llamadas.guardado.push({ id, cambios }); return { ok: true }; }) as unknown as TaxonomiaDePerfilesAdminService['guardar'],
      cambiarDeCategoria: (async (id: number, idPadre: number | null) => { llamadas.categorias.push({ id, idPadre }); return { ok: true }; }) as unknown as TaxonomiaDePerfilesAdminService['cambiarDeCategoria'],
      mover: (async (id: number, sentido: number) => { llamadas.movido.push({ id, sentido }); return { ok: true }; }) as unknown as TaxonomiaDePerfilesAdminService['mover'],
    };
    await TestBed.configureTestingModule({
      imports: [AdminTaxonomiaDePerfilesComponent],
      providers: [{ provide: TaxonomiaDePerfilesAdminService, useValue: servicio }],
    }).compileComponents();
  });

  async function abrir(): Promise<void> {
    fixture = TestBed.createComponent(AdminTaxonomiaDePerfilesComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra una lista por dimensión, con el estado y cuántos perfiles tiene cada valor', async () => {
    await abrir();

    expect(componente.valores().map(v => v.codigo)).toEqual(['docente', 'luthier']);
    expect(texto()).toContain('Docente');
    expect(texto()).toContain('Desactivado');
    expect(texto()).toContain('3');
    componente.dimension.set('servicio');
    fixture.detectChanges();
    expect(componente.valores().map(v => v.codigo)).toEqual(['clases']);
    expect(componente.pestanas().map(p => p.conteo)).toEqual([2, 1, 1]);
  });

  it('si la carga falla dice el motivo y ofrece Reintentar, en vez de parecer una lista vacía', async () => {
    fallar = true;
    await abrir();

    expect(texto()).toContain('No fue posible leer las listas de perfiles');
    expect(texto()).toContain('Sin conexión.');
    const reintentar = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.includes('Reintentar'));
    expect(reintentar).toBeTruthy();

    fallar = false;
    reintentar!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(llamadas.listados).toBe(2);
    expect(componente.errorDeCarga()).toBeNull();
    expect(texto()).toContain('Docente');
  });

  it('un valor sin nombre no se guarda y se dice por qué', async () => {
    await abrir();
    componente.nuevo();

    await componente.guardar();

    expect(componente.error()).toBe('Escribe el nombre.');
    expect(llamadas.creado.length).toBe(0);
  });

  it('crear manda la dimensión que se está viendo; el grupo de Soy Cultura solo va en los roles', async () => {
    await abrir();
    componente.nuevo();
    componente.campo('nombre', ' Arreglista ');
    componente.campo('grupoSoyCultura', 'creador');
    await componente.guardar();

    componente.dimension.set('servicio');
    componente.nuevo();
    componente.campo('nombre', 'Transporte');
    componente.campo('grupoSoyCultura', 'creador');
    await componente.guardar();

    expect(llamadas.creado).toEqual([
      { nombre: 'Arreglista', grupoSoyCultura: 'creador', fuente: null, activo: true, dimension: 'rol', idPadre: null },
      { nombre: 'Transporte', grupoSoyCultura: null, fuente: null, activo: true, dimension: 'servicio', idPadre: null },
    ]);
  });

  it('desactivar es un guardado con activo falso: el valor no se borra', async () => {
    await abrir();
    componente.editar(LISTA.items[0]);
    componente.campo('activo', false);

    await componente.guardar();

    expect(llamadas.guardado).toEqual([{ id: 1, cambios: { nombre: 'Docente', grupoSoyCultura: 'otro', fuente: null, activo: false } }]);
    expect(componente.aviso()).toContain('quedó guardado');
  });

  it('mover pide al servidor subir o bajar y vuelve a leer la lista', async () => {
    await abrir();

    await componente.mover(LISTA.items[1], -1);

    expect(llamadas.movido).toEqual([{ id: 2, sentido: -1 }]);
    expect(llamadas.listados).toBe(2);
  });

  describe('roles en categorías y subcategorías (decisión 135)', () => {
    const ARBOL: ListaDeTaxonomia = {
      items: [
        valor(10, 'rol', 'creacion', 'Creación', { subcategorias: 2, ordenVisualizacion: 1, grupoSoyCultura: 'creador' }),
        valor(11, 'rol', 'cantante', 'Cantante', { idPadre: 10, codigoDePadre: 'creacion', ordenVisualizacion: 2 }),
        valor(12, 'rol', 'interprete', 'Intérprete', { idPadre: 10, codigoDePadre: 'creacion', ordenVisualizacion: 1 }),
        valor(13, 'rol', 'gestor', 'Gestor(a)', { ordenVisualizacion: 2 }),
        valor(14, 'servicio', 'clases', 'Clases'),
      ],
      total: 5,
      maximos: { rol: 6, servicio: 8, instrumento: 8 },
    };

    async function abrirArbol(): Promise<void> {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [AdminTaxonomiaDePerfilesComponent],
        providers: [{ provide: TaxonomiaDePerfilesAdminService, useValue: {
          listar: async () => ({ ok: true, data: ARBOL }),
          crear: async (c: unknown) => { llamadas.creado.push(c); return { ok: true }; },
          guardar: async (id: number, cambios: unknown) => { llamadas.guardado.push({ id, cambios }); return { ok: true }; },
          cambiarDeCategoria: async (id: number, idPadre: number | null) => { llamadas.categorias.push({ id, idPadre }); return { ok: true }; },
          mover: async () => ({ ok: true }),
        } }],
      }).compileComponents();
      await abrir();
    }

    it('pinta cada categoría con sus subcategorías debajo y el orden es entre hermanas', async () => {
      await abrirArbol();
      expect(componente.filas().map(f => [f.valor.codigo, f.nivel, f.primero, f.ultimo])).toEqual([
        ['creacion', 0, true, false], ['interprete', 1, true, false], ['cantante', 1, false, true], ['gestor', 0, false, true],
      ]);
      expect(texto()).toContain('Categoría · 2 subcategorías');
      expect(texto()).toContain('Categoría sin subcategorías');
      expect(texto()).toContain('Añadir subcategoría');
    });

    it('«Añadir subcategoría» crea el rol dentro de su categoría', async () => {
      await abrirArbol();
      componente.nuevaSubcategoria(ARBOL.items[0]);
      componente.campo('nombre', 'Arreglista');
      await componente.guardar();
      expect(llamadas.creado).toEqual([{ nombre: 'Arreglista', grupoSoyCultura: 'creador', fuente: null, activo: true, dimension: 'rol', idPadre: 10 }]);
    });

    it('cambiar de categoría es una llamada aparte; renombrar sin cambiarla no la hace', async () => {
      await abrirArbol();
      componente.editar(ARBOL.items[1]);
      componente.campo('nombre', 'Cantante o cantautor(a)');
      await componente.guardar();
      expect(llamadas.categorias).toEqual([]);

      componente.editar(ARBOL.items[1]);
      componente.campo('categoria', '');
      await componente.guardar();
      expect(llamadas.categorias).toEqual([{ id: 11, idPadre: null }]);
    });

    it('una categoría con subcategorías no puede pasar a ser subcategoría', async () => {
      await abrirArbol();
      expect(componente.tieneSubcategorias(10)).toBeTrue();
      expect(componente.tieneSubcategorias(13)).toBeFalse();
    });
  });
});
