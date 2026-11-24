import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { appConfig } from '../../../../app.config';
import { NavigationService } from '../../../../core/services/navigation.service';
import { CatalogosDeRed, RedPublica, RedesService } from '../../../../core/services/redes.service';
import { RedesPublicasPageComponent } from './redes-publicas-page.component';

/**
 * El directorio público de redes y documentación.
 *
 * <b>LO QUE SE FIJA.</b> Que sea el directorio estándar del Ecosistema (columna de filtros, cifras,
 * listado, paginación), que los filtros funcionen sin tildes ni mayúsculas —el formato con su
 * subnivel—, que los filtros lleguen por la URL, y que un fallo del servidor se diga y no se
 * confunda con «no hay redes».
 */
describe('RedesPublicasPageComponent', () => {
  const opcion = (id: number, nombre: string) => ({ id, nombre, slug: nombre.toLowerCase(), padreId: null, estadoAprobacion: 'propuesto' });
  const catalogos: CatalogosDeRed = {
    formasDeAcceso: [opcion(1, 'Consulta en sala'), opcion(2, 'Con cita previa')],
    formatos: [opcion(10, 'Impreso'), { ...opcion(11, 'Partituras'), padreId: 10 }, opcion(12, 'Sonoro')],
    practicasMusicales: [],
  };

  const red = (id: number, nombre: string, departamento: string, formasDeAcceso: number[], formatos: number[],
    accesoAbierto = false, municipio = 'Popayán'): RedPublica => ({
    id, nombre, descripcion: `Descripción de ${nombre}.`, tipoDeNodo: 'red', accesoAbierto, acervosYColecciones: null,
    correoRed: null, telefonoRed: null, sitioWebRed: null, instagramRed: null, facebookRed: null, otroEnlaceRed: null,
    nivelCobertura: 'municipal', codigoDepartamento: '19', nombreDepartamento: departamento, codigoMunicipio: '19001', nombreMunicipio: municipio,
    lugarEspecifico: null, esIndependiente: false, organizacionNombre: 'Cantaclaro', organizacionPublicaId: null, fechaPublicacion: null,
    formasDeAcceso: catalogos.formasDeAcceso.filter(s => formasDeAcceso.includes(s.id)),
    formatos: catalogos.formatos.filter(f => formatos.includes(f.id)),
    practicasMusicales: [],
  });

  const REDES = [
    red(1, 'Red Los Cedros', 'Cauca', [1, 2], [11], true),
    red(2, 'Archivo del Pacífico', 'Valle del Cauca', [1], [12], false, 'Buenaventura'),
    red(3, 'Centro del Sur', 'Cauca', [2], [11], false, 'Timbío'),
  ];

  let fixture: ComponentFixture<RedesPublicasPageComponent>;
  let componente: RedesPublicasPageComponent;
  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));

  function montar(consulta = of({ items: REDES, total: 3, limit: 500, offset: 0 }) as ReturnType<RedesService['consultarPublicos']>,
    parametros: Record<string, string> = {}): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RedesPublicasPageComponent],
      providers: [
        provideRouter([]),
        { provide: RedesService, useValue: { consultarPublicos: () => consulta, catalogosPublicos: () => of(catalogos) } },
        { provide: NavigationService, useValue: { navigateToMapLayer: jasmine.createSpy('navigateToMapLayer') } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(parametros) } } },
      ],
    });
    fixture = TestBed.createComponent(RedesPublicasPageComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const filas = () => Array.from(raiz().querySelectorAll('[data-testid="tarjeta-de-red"]'));

  it('es el directorio estándar: filtros a la izquierda, cifras con conmutador de vista y listado', () => {
    montar();

    expect(raiz().querySelector('aside[aria-label^="Filtros del directorio"]')).not.toBeNull();
    expect(raiz().querySelector('app-barra-exploracion-ecosistema')).not.toBeNull();
    expect(raiz().querySelector('[data-directorio-conteo]')?.textContent).toContain('Mostrando 1–3 de 3');
    expect(raiz().querySelector('[data-directorio-listado]')).not.toBeNull();
  });

  it('lista las redes, cada registro lleva a su ficha y dice cómo se consulta', () => {
    montar();

    expect(filas().length).toBe(3);
    expect(raiz().querySelector('a[href="/ecosistema/redes/1"]')).not.toBeNull();
    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Acceso abierto');
    expect(texto).toContain('Acceso con condiciones');
  });

  it('las cifras hablan de la consulta, no del total publicado', () => {
    montar();
    componente.actualizarDepartamento('Cauca');

    const cifras = componente.metricas();
    expect(cifras[0]).toEqual(jasmine.objectContaining({ label: 'Resultados', value: 2, detail: 'de 3 publicados' }));
    expect(cifras[3]).toEqual(jasmine.objectContaining({ label: 'Formatos', value: 1 }));
  });

  it('busca sin distinguir tildes ni mayúsculas', () => {
    montar();

    componente.actualizarBusqueda('PACIFICO');

    expect(componente.filtrados().map(r => r.id)).toEqual([2]);
  });

  it('filtra por departamento, forma de acceso y formato (con su subnivel)', () => {
    montar();

    componente.actualizarDepartamento('Cauca');
    expect(componente.filtrados().map(r => r.id)).toEqual([3, 1]);

    componente.cambiarFiltro({ id: 'forma-de-acceso', valor: 'Con cita previa' });
    expect(componente.filtrados().map(r => r.id)).toEqual([3, 1]);

    componente.limpiarFiltros();
    // «Impreso» incluye a los de su subnivel «Partituras».
    componente.cambiarFiltro({ id: 'formato', valor: 'Impreso' });
    expect(componente.filtrados().map(r => r.id)).toEqual([3, 1]);
  });

  it('solo ofrece los departamentos y los municipios que de verdad tienen redes', () => {
    montar();

    expect(componente.departamentos()).toEqual(['Cauca', 'Valle del Cauca']);
    componente.actualizarDepartamento('Cauca');
    expect(componente.municipios()).toEqual(['Popayán', 'Timbío']);
  });

  it('los filtros llegan desde la URL', () => {
    montar(undefined, { departamento: 'Cauca', formato: 'Impreso' });

    expect(componente.filtrados().map(r => r.id)).toEqual([3, 1]);
  });

  it('limpiar devuelve el directorio entero y apaga el contador de filtros', () => {
    montar();
    componente.actualizarBusqueda('Pacífico');
    componente.cambiarFiltro({ id: 'formato', valor: 'Sonoro' });
    expect(componente.filtrosActivos()).toBe(1);

    componente.limpiarFiltros();

    expect(componente.hayFiltros()).toBeFalse();
    expect(componente.filtrados().length).toBe(3);
  });

  it('un fallo del servidor se dice y no se confunde con «no hay redes»', () => {
    montar(throwError(() => new Error('caído')) as unknown as ReturnType<RedesService['consultarPublicos']>);

    expect(raiz().textContent).toContain('No fue posible consultar las redes y documentación.');
    expect(raiz().querySelector('[data-sin-resultados]')).toBeNull();
  });

  it('sin resultados con los filtros puestos lo dice, cuenta las publicadas y sugiere quitarlos', () => {
    montar();
    componente.actualizarBusqueda('inexistente');
    fixture.detectChanges();

    const vacio = raiz().querySelector('[data-sin-resultados]')!;
    expect(vacio.textContent).toContain('Ninguna red coincide con esta consulta');
    expect(vacio.textContent).toContain('3 redes publicadas');
  });

  it('el paso al mapa abre la capa de Redes y documentación', () => {
    montar();

    componente.abrirMapa();

    const navegacion = TestBed.inject(NavigationService) as unknown as { navigateToMapLayer: jasmine.Spy };
    expect(navegacion.navigateToMapLayer).toHaveBeenCalledWith('Redes de Documentación', { targetView: 'map' });
  });
});
