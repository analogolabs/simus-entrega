import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CatalogService } from '../../../core/services/catalog.service';
import { EspaciosService } from '../../../core/services/espacios.service';
import { RedesService } from '../../../core/services/redes.service';
import { TalleresService } from '../../../core/services/talleres.service';
import { AdminProcesosPanelComponent } from './admin-procesos-panel.component';

/**
 * LA LISTA ÚNICA DE PROCESOS DE LA CONSOLA (decisión 132): Lutería, Espacios y Redes en una sola lista, con el
 * tipo como pestaña y el estado como filtro. Conserva lo que hacían las tres listas por tipo: buscar, filtrar por
 * estado, responsable y sede principal, importar, descargar la plantilla y abrir la ficha.
 */
const DIVIPOLA = [{ codigo: '41', nombre: 'Huila', municipios: [{ codigo: '41001', nombre: 'Neiva' }] }];

function fila(id: number, nombre: string, fecha: string, extra: Record<string, unknown> = {}) {
  return { id, nombre, estadoRegistro: 'en_revision', nivelCobertura: 'nacional', sede: null, fechaActualizacion: fecha, ...extra };
}

describe('Lista única de procesos de la consola', () => {
  let pedidos: { tipo: string; filtros: Record<string, unknown> }[];

  function servicio(tipo: string, items: unknown[]) {
    return {
      listarEnLaConsola: (filtros: Record<string, unknown>) => {
        pedidos.push({ tipo, filtros });
        return of({ items, total: items.length });
      },
      catalogos: () => of({}),
    };
  }

  beforeEach(async () => {
    pedidos = [];
    await TestBed.configureTestingModule({
      imports: [AdminProcesosPanelComponent],
      providers: [
        provideRouter([]),
        { provide: CatalogService, useValue: { fetchDivipolaConCodigos: () => of(DIVIPOLA) } },
        { provide: TalleresService, useValue: servicio('talleres', [fila(1, 'Taller Uno', '2026-11-10T00:00:00Z', { modalidad: 'fijo' })]) },
        { provide: EspaciosService, useValue: servicio('espacios', [fila(2, 'Espacio Dos', '2026-11-12T00:00:00Z', { ambiente: 'cerrado' })]) },
        { provide: RedesService, useValue: servicio('redes', [fila(3, 'Red Tres', '2026-11-11T00:00:00Z', { tipoDeNodo: 'red' })]) },
      ],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(AdminProcesosPanelComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('«Todos» junta los tres tipos, el más reciente primero, y cada pestaña lleva su conteo', () => {
    const c = crear().componentInstance;
    expect(c.filas().map(f => f.nombre)).toEqual(['Espacio Dos', 'Red Tres', 'Taller Uno']);
    expect(c.conteos()).toEqual({ luteria: 1, espacios: 1, redes: 1 });
    expect(c.cuenta()).toBe('3 procesos');
  });

  it('un tipo elegido solo muestra los suyos, y el estado de partida es «En revisión»', () => {
    const c = crear().componentInstance;
    c.tipo.set('luteria');
    expect(c.filas().map(f => f.nombre)).toEqual(['Taller Uno']);
    expect(pedidos.every(p => p.filtros['estado'] === 'en_revision')).toBeTrue();
  });

  it('con un permiso solo se ofrece y se pide ese tipo', () => {
    const fixture = TestBed.createComponent(AdminProcesosPanelComponent);
    fixture.componentRef.setInput('modulos', ['redes']);
    fixture.detectChanges();
    expect(fixture.componentInstance.pestanasOfrecidas()).toEqual(['redes']);
    expect(pedidos.map(p => p.tipo)).toEqual(['redes']);
  });

  it('el estado, la búsqueda, el responsable y la sede se piden al servidor en los tres tipos', () => {
    const c = crear().componentInstance;
    pedidos = [];
    c.estado.set('publicado');
    c.responsable.set('persona');
    c.filtrarPorSede({ departamento: '41', municipio: '41001', pendiente: false });
    const ultimos = pedidos.slice(-3).map(p => p.filtros);
    for (const f of ultimos) {
      expect(f).toEqual(jasmine.objectContaining({ estado: 'publicado', responsable: 'persona', sedeDepartamento: '41', sedeMunicipio: '41001' }));
    }
    c.estado.set('todos');
    c.filtrarPorSede({ departamento: '', municipio: '', pendiente: true });
    expect(pedidos.at(-1)!.filtros).toEqual(jasmine.objectContaining({ estado: undefined, sedePendiente: true, sedeDepartamento: undefined }));
  });

  it('pide la sede con el municipio deshabilitado hasta elegir departamento', () => {
    const raiz = crear().nativeElement as HTMLElement;
    const filtros = raiz.querySelectorAll('app-filtro-de-sede app-filtro-desplegable button');
    expect(filtros.length).toBe(2);
    expect(filtros[1].hasAttribute('disabled')).toBeTrue();
  });

  it('sin sede dice «Sede pendiente» y deja la cobertura de respaldo', () => {
    const c = crear().componentInstance;
    expect(c.territorio({ nivelCobertura: 'nacional', sede: null, nombreMunicipio: null, nombreDepartamento: null })).toBe('Sede pendiente (cobertura: Todo el país)');
    expect(c.territorio({ nivelCobertura: 'nacional', sede: { nombreMunicipio: 'Neiva', nombreDepartamento: 'Huila' }, nombreMunicipio: null, nombreDepartamento: null })).toBe('Neiva, Huila');
  });

  it('abrir una fila pide la ficha de su módulo, con su identificador', () => {
    const fixture = crear();
    const abiertas: { modulo: string; id: string }[] = [];
    fixture.componentInstance.ficha.subscribe(a => abiertas.push(a));
    const botones = fixture.nativeElement.querySelectorAll('[data-testid="fila-de-proceso-consola"] button') as NodeListOf<HTMLButtonElement>;
    botones[2].click();
    expect(abiertas).toEqual([{ modulo: 'talleres', id: '1' }]);
  });

  describe('importar desde un archivo', () => {
    it('en un tipo, «Más acciones» ofrece importar y la plantilla de ese tipo, en ese orden', () => {
      const c = crear().componentInstance;
      c.tipo.set('espacios');
      expect(c.acciones().map(a => a.etiqueta)).toEqual(['Importar espacios', 'Descargar la plantilla']);
      c.tipo.set('redes');
      expect(c.acciones().map(a => a.etiqueta)).toEqual(['Importar redes', 'Descargar la plantilla']);
      c.tipo.set('luteria');
      expect(c.acciones().map(a => a.etiqueta)).toEqual(['Importar talleres', 'Descargar la plantilla']);
    });

    it('en «Todos» ofrece la importación y la plantilla de los tres', () => {
      const c = crear().componentInstance;
      expect(c.acciones().filter(a => a.id.startsWith('importar:')).length).toBe(3);
      expect(c.acciones().filter(a => a.id.startsWith('plantilla:')).length).toBe(3);
    });

    it('elegir «importar» lo pide al armazón con el módulo y no descarga nada', () => {
      const c = crear().componentInstance;
      const pedidas: string[] = [];
      c.importar.subscribe(m => pedidas.push(m));
      const descarga = spyOn(c, 'descargarPlantilla');
      c.elegirAccionDeLaLista('importar:espacios');
      expect(pedidas).toEqual(['espacios']);
      expect(descarga).not.toHaveBeenCalled();
    });

    it('elegir la plantilla la descarga y no abre la importación', () => {
      const c = crear().componentInstance;
      const pedidas: string[] = [];
      c.importar.subscribe(m => pedidas.push(m));
      const descarga = spyOn(c, 'descargarPlantilla').and.resolveTo();
      c.elegirAccionDeLaLista('plantilla:redes');
      expect(descarga).toHaveBeenCalledOnceWith('redes');
      expect(pedidas).toEqual([]);
    });
  });
});
