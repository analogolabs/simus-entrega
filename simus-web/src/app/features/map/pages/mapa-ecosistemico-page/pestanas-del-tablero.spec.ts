import { PESTANAS_DEL_TABLERO, pestanasConTextos } from '../../domain/pestanas-del-tablero';
import { DEFAULT_TEXTS } from '../../../../core/cms/registro-de-textos-web';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MapDataService } from '../../../../core/services/map-data.service';
import { MapaEcosistemicoPageComponent } from './mapa-ecosistemico-page.component';

/**
 * LAS PESTAÑAS DE LA VISTA GRÁFICO (puntos 89 a 93 de los comentarios del mapa): Panel general, Flujos, Redes,
 * Coincidencias, Barras y Jerarquías, sin «Lecturas». Las preguntas orientadoras del Panel general llevan a la
 * pestaña que las responde conservando lo elegido.
 */
describe('Pestañas del tablero (Gráfico)', () => {
  const departmentFeature = (code: string, name: string) => ({
    type: 'Feature',
    properties: { departmentCode: code, departmentName: name },
    geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  });

  const rawRecord = (id: string, name: string, deptCode: string, deptName: string, extra: Record<string, unknown> = {}) => ({
    id,
    fields: {
      name,
      departamento: deptName,
      deptCode,
      municipio: 'Medellin',
      divipola: '05001',
      descripcion: 'Registro de prueba',
      ...extra,
    },
  });

  const bundle = {
    geoJson: {
      type: 'FeatureCollection',
      features: [
        departmentFeature('05', 'ANTIOQUIA'),
        departmentFeature('08', 'ATLANTICO'),
        departmentFeature('13', 'BOLIVAR'),
        departmentFeature('76', 'VALLE DEL CAUCA'),
      ],
      municipalities: { type: 'FeatureCollection', features: [] },
    },
    baseCounts: {},
    festivalRecords: [],
    schoolRecords: [],
    marketRecords: [],
    redesRecords: [
      rawRecord('r1', 'Centro Uno', '05', 'Antioquia', { centerType: 'Archivo' }),
      rawRecord('r2', 'Centro Dos', '05', 'Antioquia', { centerType: 'Archivo' }),
      rawRecord('r3', 'Centro Tres', '05', 'Antioquia', { centerType: 'Biblioteca' }),
      rawRecord('r4', 'Centro Cuatro', '08', 'Atlantico', { centerType: 'Archivo' }),
      // SIN MUNICIPIO, y a proposito. Ver la prueba «un registro sin municipio».
      rawRecord('r5', 'Centro Sin Sede', '05', 'Antioquia', { centerType: 'Fonoteca', municipio: '' }),
    ],
    luthierRecords: [
      rawRecord('l1', 'Taller Uno', '13', 'Bolivar', { oficio: 'Cuerdas' }),
      rawRecord('l2', 'Taller Dos', '13', 'Bolivar', { oficio: 'Percusion' }),
    ],
    festivalCounts: {},
    schoolCounts: {},
    marketCounts: {},
  };

  let component: MapaEcosistemicoPageComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MapaEcosistemicoPageComponent],
      providers: [
        provideRouter([]),
        { provide: MapDataService, useValue: { fetchMapCountsBundle: () => of(bundle) } },
      ],
    });
    component = TestBed.createComponent(MapaEcosistemicoPageComponent).componentInstance;
    component.fetchMapData();
  });

  it('la vista abre en el Panel general y ya no existe «Lecturas»', () => {
    expect(component.vistaDelTablero()).toBe('panel');
    expect(component.pestanasDelTablero().map((p) => p.nombre)).toEqual(['Panel general', 'Flujos', 'Redes', 'Coincidencias', 'Barras', 'Jerarquías']);
  });

  it('cada pregunta orientadora lleva a su pestaña', () => {
    for (const pregunta of component.preguntasOrientadoras()) {
      component.irAPestana(pregunta.id);
      expect(component.vistaDelTablero()).toBe(pregunta.id);
    }
    expect(component.preguntasOrientadoras().map((p) => p.id)).toEqual(['flujos', 'redes', 'coincidencias', 'barras', 'jerarquias']);
  });

  it('al ir desde una pregunta se conservan el departamento, la capa y el grupo elegidos', () => {
    component.capaActiva.set('Festivales');
    component.departamentoElegido.set('ANTIOQUIA');
    component.dimensionDeComposicion.set('practicas');
    component.grupoResaltado.set('Marimba');
    component.irAPestana('redes');
    expect(component.filtrosDelAnalisis().tipos).toEqual(['Festivales']);
    expect(component.filtrosDelAnalisis().departamento).toBe('Antioquia');
    expect(component.filtrosDelAnalisis().practica).toBe('Marimba');
  });

  it('sin nada elegido en el Panel, ir a una pestaña no borra los filtros que ya tenía el análisis', () => {
    component.cambiarFiltrosDelAnalisis({ territorio: 'Pacífico' });
    component.irAPestana('barras');
    component.vistaDelTablero.set('flujos');
    expect(component.filtrosDelAnalisis().territorio).toBe('Pacífico');
  });

  it('lo que el análisis le pide a la página llega a los filtros compartidos', () => {
    const entradas = component.entradasDelAnalisis();
    entradas.alCambiarFiltros({ departamento: 'Meta' });
    expect(component.entradasDelAnalisis().filtrosDeLaPagina.departamento).toBe('Meta');
    expect(component.entradasDelAnalisis().vista).toBe('panel');
  });

  it('las flechas pasan de una pestaña a la siguiente', () => {
    const evento = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    component.moverPestana(evento, 'panel');
    expect(component.vistaDelTablero()).toBe('flujos');
    component.moverPestana(new KeyboardEvent('keydown', { key: 'ArrowLeft' }), 'flujos');
    expect(component.vistaDelTablero()).toBe('panel');
    component.moverPestana(new KeyboardEvent('keydown', { key: 'End' }), 'panel');
    expect(component.vistaDelTablero()).toBe('jerarquias');
  });

  // El DOM de la página (barra de pestañas, preguntas orientadoras y apartados migrados) lo cubre
  // `e2e/mapa-pestanas-del-tablero.spec.ts`: aquí no se llama a `detectChanges()` para no levantar Leaflet.
});

describe('pestanasConTextos · los textos de las pestañas salen del CMS', () => {
  it('con los textos de fábrica del registro devuelve exactamente las pestañas de la lista', () => {
    const leidas = pestanasConTextos((clave) => DEFAULT_TEXTS[clave] ?? '');
    expect(leidas).toEqual(PESTANAS_DEL_TABLERO.map((p) => ({ ...p })));
  });

  it('un nombre publicado cambia solo esa pestaña', () => {
    const leidas = pestanasConTextos((clave) => (clave === 'mapa_tab_redes_nombre' ? 'Conexiones' : DEFAULT_TEXTS[clave] ?? ''));
    expect(leidas.find((p) => p.id === 'redes')!.nombre).toBe('Conexiones');
    expect(leidas.find((p) => p.id === 'flujos')!.nombre).toBe('Flujos');
  });
});
