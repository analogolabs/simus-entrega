import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { appConfig } from '../../../../app.config';
import { NavigationService } from '../../../../core/services/navigation.service';
import { CatalogosDeTaller, TallerPublico, TalleresService } from '../../../../core/services/talleres.service';
import { TalleresPublicosPageComponent } from './talleres-publicos-page.component';

/**
 * El directorio público de talleres de lutería.
 *
 * <b>LO QUE SE FIJA.</b> Que sea el directorio estándar del Ecosistema (columna de filtros, cifras,
 * listado, paginación), que los filtros funcionen sin tildes ni mayúsculas, que el departamento
 * solo se ofrezca si tiene talleres, que los filtros lleguen por la URL, y que un fallo del servidor
 * se diga y no se confunda con «no hay talleres».
 */
describe('TalleresPublicosPageComponent', () => {
  const servicio = (id: number, nombre: string) => ({ id, nombre, slug: nombre.toLowerCase(), padreId: null, estadoAprobacion: 'propuesto' });
  const catalogos: CatalogosDeTaller = {
    servicios: [servicio(1, 'Construcción'), servicio(2, 'Reparación')],
    familias: [servicio(10, 'Cordófonos'), { ...servicio(11, 'Cordófonos frotados'), padreId: 10 }, servicio(12, 'Idiófonos')],
    practicasMusicales: [],
  };

  const taller = (id: number, nombre: string, departamento: string, servicios: number[], familias: number[], municipio = 'Popayán'): TallerPublico => ({
    id, nombre, descripcion: `Descripción de ${nombre}.`, modalidad: 'fijo', recibeAprendices: false, saberesYTecnicas: null,
    correoTaller: null, telefonoTaller: null, sitioWebTaller: null, instagramTaller: null, facebookTaller: null, otroEnlaceTaller: null,
    nivelCobertura: 'municipal', codigoDepartamento: '19', nombreDepartamento: departamento, codigoMunicipio: '19001', nombreMunicipio: municipio,
    lugarEspecifico: null, esIndependiente: false, organizacionNombre: 'Cantaclaro', organizacionPublicaId: null, fechaPublicacion: null,
    servicios: catalogos.servicios.filter(s => servicios.includes(s.id)),
    familias: catalogos.familias.filter(f => familias.includes(f.id)),
    practicasMusicales: [],
  });

  const TALLERES = [
    taller(1, 'Taller Los Cedros', 'Cauca', [1, 2], [11]),
    taller(2, 'Marimbas del Pacífico', 'Valle del Cauca', [1], [12], 'Buenaventura'),
    taller(3, 'Reparaciones del Sur', 'Cauca', [2], [11], 'Timbío'),
  ];

  let fixture: ComponentFixture<TalleresPublicosPageComponent>;
  let componente: TalleresPublicosPageComponent;
  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));

  function montar(consulta = of({ items: TALLERES, total: 3, limit: 500, offset: 0 }) as ReturnType<TalleresService['consultarPublicos']>,
    parametros: Record<string, string> = {}): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TalleresPublicosPageComponent],
      providers: [
        provideRouter([]),
        { provide: TalleresService, useValue: { consultarPublicos: () => consulta, catalogosPublicos: () => of(catalogos) } },
        { provide: NavigationService, useValue: { navigateToMapLayer: jasmine.createSpy('navigateToMapLayer') } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(parametros) } } },
      ],
    });
    fixture = TestBed.createComponent(TalleresPublicosPageComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const filas = () => Array.from(raiz().querySelectorAll('[data-testid="tarjeta-de-taller"]'));

  it('es el directorio estándar: filtros a la izquierda, cifras con conmutador de vista y listado', () => {
    montar();

    expect(raiz().querySelector('aside[aria-label^="Filtros del directorio"]')).not.toBeNull();
    expect(raiz().querySelector('app-barra-exploracion-ecosistema')).not.toBeNull();
    expect(raiz().querySelector('[data-directorio-conteo]')?.textContent).toContain('Mostrando 1–3 de 3');
    expect(raiz().querySelector('[data-directorio-listado]')).not.toBeNull();
  });

  it('las prácticas musicales son etiquetas clicables que filtran el listado, y también llegan por la URL', () => {
    const conPractica = { ...TALLERES[0], practicasMusicales: [{ id: 5, nombre: 'Cuerdas', slug: 'cuerdas', padreId: null, estadoAprobacion: 'propuesto' }] };
    montar(of({ items: [conPractica, TALLERES[1], TALLERES[2]], total: 3, limit: 500, offset: 0 }) as ReturnType<TalleresService['consultarPublicos']>);

    const etiqueta = raiz().querySelector<HTMLButtonElement>('button[data-etiqueta-practica]')!;
    expect(etiqueta).not.toBeNull();
    etiqueta.click();
    fixture.detectChanges();
    expect(filas().length).toBe(1);
    expect(componente.filtrosActivos()).toBe(1);

    montar(of({ items: [conPractica, TALLERES[1], TALLERES[2]], total: 3, limit: 500, offset: 0 }) as ReturnType<TalleresService['consultarPublicos']>, { practica: 'Cuerdas' });
    expect(filas().length).toBe(1);
  });

  it('lista los talleres y cada registro lleva a su ficha', () => {
    montar();

    expect(filas().length).toBe(3);
    expect(raiz().querySelector('a[href="/ecosistema/luteria/1"]')).not.toBeNull();
    // POR NOMBRE (A–Z): «Marimbas del Pacífico» (2) va antes que «Taller Los Cedros» (1).
    expect(raiz().querySelector('[data-abrir-registro]')?.getAttribute('href')).toBe('/ecosistema/luteria/2');
  });

  it('las cifras hablan de la consulta, no del total publicado', () => {
    montar();
    componente.actualizarDepartamento('Cauca');

    const cifras = componente.metricas();
    expect(cifras[0]).toEqual(jasmine.objectContaining({ label: 'Resultados', value: 2, detail: 'de 3 publicados' }));
    expect(cifras[1].value).toBe(1);   // un departamento
    expect(cifras[2].value).toBe(2);   // dos municipios
    expect(cifras[3]).toEqual(jasmine.objectContaining({ label: 'Servicios', value: 2 }));
  });

  it('busca sin distinguir tildes ni mayúsculas', () => {
    montar();

    componente.actualizarBusqueda('PACIFICO');
    fixture.detectChanges();

    expect(componente.filtrados().map(t => t.id)).toEqual([2]);
  });

  it('filtra por departamento, municipio, servicio y por familia (con su subnivel)', () => {
    montar();

    componente.actualizarDepartamento('Cauca');
    expect(componente.filtrados().map(t => t.id)).toEqual([3, 1]);

    componente.actualizarMunicipio('Timbío');
    expect(componente.filtrados().map(t => t.id)).toEqual([3]);

    componente.limpiarFiltros();
    componente.cambiarFiltro({ id: 'servicio', valor: 'Construcción' });
    expect(componente.filtrados().map(t => t.id)).toEqual([2, 1]);

    componente.cambiarFiltro({ id: 'servicio', valor: '' });
    // «Cordófonos» incluye a los de su subnivel «Cordófonos frotados».
    componente.cambiarFiltro({ id: 'familia', valor: 'Cordófonos' });
    expect(componente.filtrados().map(t => t.id)).toEqual([3, 1]);
  });

  it('cambiar de departamento limpia el municipio que había', () => {
    montar();
    componente.actualizarDepartamento('Cauca');
    componente.actualizarMunicipio('Timbío');

    componente.actualizarDepartamento('Valle del Cauca');

    expect(componente.municipio()).toBe('');
  });

  it('solo ofrece los departamentos y los municipios que de verdad tienen talleres', () => {
    montar();

    expect(componente.departamentos()).toEqual(['Cauca', 'Valle del Cauca']);
    expect(componente.municipios()).toEqual([]);   // sin departamento no se ofrecen
    componente.actualizarDepartamento('Cauca');
    expect(componente.municipios()).toEqual(['Popayán', 'Timbío']);
  });

  it('los filtros llegan desde la URL', () => {
    montar(undefined, { departamento: 'Cauca', servicio: 'Reparación' });

    expect(componente.departamento()).toBe('Cauca');
    expect(componente.filtrados().map(t => t.id)).toEqual([3, 1]);
  });

  it('el orden por territorio actúa sobre todos los registros', () => {
    montar();

    componente.actualizarOrden('territorio');

    expect(componente.filtrados().map(t => t.id)).toEqual([2, 1, 3]); // Buenaventura, Popayán, Timbío
  });

  it('pagina de 12 en 12 y cada cambio vuelve a la primera página', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => taller(100 + i, `Taller ${String(i).padStart(2, '0')}`, 'Cauca', [1], [11]));
    montar(of({ items: muchos, total: 30, limit: 500, offset: 0 }) as ReturnType<TalleresService['consultarPublicos']>);

    expect(componente.totalPaginas()).toBe(3);
    expect(componente.visibles().length).toBe(12);
    componente.irAPagina(3);
    expect(componente.visibles().length).toBe(6);
    expect(componente.desdeMostrado()).toBe(25);

    componente.actualizarBusqueda('Taller 0');
    expect(componente.pagina()).toBe(1);
  });

  it('limpiar devuelve el directorio entero y apaga el contador de filtros', () => {
    montar();
    componente.actualizarBusqueda('Pacífico');
    componente.actualizarDepartamento('Valle del Cauca');
    componente.cambiarFiltro({ id: 'servicio', valor: 'Construcción' });
    expect(componente.hayFiltros()).toBeTrue();
    expect(componente.filtrosActivos()).toBe(2);

    componente.limpiarFiltros();

    expect(componente.hayFiltros()).toBeFalse();
    expect(componente.filtrados().length).toBe(3);
  });

  it('un fallo del servidor se dice y no se confunde con «no hay talleres»', () => {
    montar(throwError(() => new Error('caído')) as unknown as ReturnType<TalleresService['consultarPublicos']>);

    const texto = raiz().textContent ?? '';
    expect(texto).toContain('No fue posible consultar los talleres de lutería.');
    expect(raiz().querySelector('[data-sin-resultados]')).toBeNull();
  });

  it('sin resultados con los filtros puestos lo dice, cuenta los publicados y sugiere quitarlos', () => {
    montar();
    componente.actualizarBusqueda('inexistente');
    fixture.detectChanges();

    const vacio = raiz().querySelector('[data-sin-resultados]')!;
    expect(vacio.textContent).toContain('Ningún taller coincide con esta consulta');
    expect(vacio.textContent).toContain('3 talleres publicados');
  });

  it('el paso al mapa abre la capa de Lutería', () => {
    montar();

    componente.abrirMapa();

    const navegacion = TestBed.inject(NavigationService) as unknown as { navigateToMapLayer: jasmine.Spy };
    expect(navegacion.navigateToMapLayer).toHaveBeenCalledWith('Lutieres', { targetView: 'map' });
  });
});
