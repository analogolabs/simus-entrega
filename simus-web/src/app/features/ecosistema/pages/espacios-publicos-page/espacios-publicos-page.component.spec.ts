import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { appConfig } from '../../../../app.config';
import { CatalogosDeEspacio, EspacioPublico, EspaciosService } from '../../../../core/services/espacios.service';
import { NavigationService } from '../../../../core/services/navigation.service';
import { EspaciosPublicosPageComponent } from './espacios-publicos-page.component';

/**
 * El directorio público de espacios para música en vivo.
 *
 * <b>LO QUE SE FIJA.</b> Que sea el directorio estándar del Ecosistema (columna de filtros, cifras,
 * listado, paginación), que los filtros funcionen sin tildes ni mayúsculas —incluida la
 * accesibilidad, donde «sin dato» no cuenta como ninguna de las dos—, que los filtros lleguen por la
 * URL, y que un fallo del servidor se diga y no se confunda con «no hay espacios».
 */
describe('EspaciosPublicosPageComponent', () => {
  const opcion = (id: number, nombre: string) => ({ id, nombre, slug: nombre.toLowerCase(), estadoAprobacion: 'propuesto' });
  const catalogos: CatalogosDeEspacio = {
    equipamiento: [opcion(1, 'Sistema de sonido'), opcion(2, 'Camerinos')],
    tipos: [opcion(10, 'Sala de conciertos'), opcion(11, 'Bar o taberna'), opcion(12, 'Teatro')],
    practicasMusicales: [],
  };

  const espacio = (id: number, nombre: string, departamento: string, equipamiento: number[], tipos: number[],
    esAccesible: boolean | null = false, municipio = 'Popayán'): EspacioPublico => ({
    id, nombre, descripcion: `Descripción de ${nombre}.`, ambiente: 'cerrado', aforoMaximo: 80, esAccesible, horarioYProgramacion: null,
    correoEspacio: null, telefonoEspacio: null, sitioWebEspacio: null, instagramEspacio: null, facebookEspacio: null, otroEnlaceEspacio: null,
    nivelCobertura: 'municipal', codigoDepartamento: '19', nombreDepartamento: departamento, codigoMunicipio: '19001', nombreMunicipio: municipio,
    lugarEspecifico: null, esIndependiente: false, organizacionNombre: 'Cantaclaro', organizacionPublicaId: null, fechaPublicacion: null,
    equipamiento: catalogos.equipamiento.filter(s => equipamiento.includes(s.id)),
    tipos: catalogos.tipos.filter(f => tipos.includes(f.id)),
    practicasMusicales: [],
  });

  const ESPACIOS = [
    espacio(1, 'Sala Los Cedros', 'Cauca', [1, 2], [11], true),
    espacio(2, 'Marimbas del Pacífico', 'Valle del Cauca', [1], [12], false, 'Buenaventura'),
    espacio(3, 'Bar del Sur', 'Cauca', [2], [11], null, 'Timbío'),
  ];

  let fixture: ComponentFixture<EspaciosPublicosPageComponent>;
  let componente: EspaciosPublicosPageComponent;
  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));

  function montar(consulta = of({ items: ESPACIOS, total: 3, limit: 500, offset: 0 }) as ReturnType<EspaciosService['consultarPublicos']>,
    parametros: Record<string, string> = {}): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EspaciosPublicosPageComponent],
      providers: [
        provideRouter([]),
        { provide: EspaciosService, useValue: { consultarPublicos: () => consulta, catalogosPublicos: () => of(catalogos) } },
        { provide: NavigationService, useValue: { navigateToMapLayer: jasmine.createSpy('navigateToMapLayer') } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(parametros) } } },
      ],
    });
    fixture = TestBed.createComponent(EspaciosPublicosPageComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const filas = () => Array.from(raiz().querySelectorAll('[data-testid="tarjeta-de-espacio"]'));

  it('es el directorio estándar: filtros a la izquierda, cifras con conmutador de vista y listado', () => {
    montar();

    expect(raiz().querySelector('aside[aria-label^="Filtros del directorio"]')).not.toBeNull();
    expect(raiz().querySelector('app-barra-exploracion-ecosistema')).not.toBeNull();
    expect(raiz().querySelector('[data-directorio-conteo]')?.textContent).toContain('Mostrando 1–3 de 3');
    expect(raiz().querySelector('[data-directorio-listado]')).not.toBeNull();
  });

  it('lista los espacios, cada registro lleva a su ficha y dice aforo y accesibilidad', () => {
    montar();

    expect(filas().length).toBe(3);
    expect(raiz().querySelector('a[href="/ecosistema/espacios/1"]')).not.toBeNull();
    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Aforo de 80 personas');
    expect(texto).toContain('Accesible');
    expect(texto).toContain('No accesible');
    expect(texto).toContain('Accesibilidad sin dato');
  });

  it('la línea bajo el nombre dice el tipo de espacio y su ambiente', () => {
    montar();

    expect(componente.ambiente(ESPACIOS[0])).toBe('Bar o taberna · Cerrado');
  });

  it('las cifras hablan de la consulta, no del total publicado', () => {
    montar();
    componente.actualizarDepartamento('Cauca');

    const cifras = componente.metricas();
    expect(cifras[0]).toEqual(jasmine.objectContaining({ label: 'Resultados', value: 2, detail: 'de 3 publicados' }));
    expect(cifras[3]).toEqual(jasmine.objectContaining({ label: 'Tipos de espacio', value: 1 }));
  });

  it('busca sin distinguir tildes ni mayúsculas', () => {
    montar();

    componente.actualizarBusqueda('PACIFICO');

    expect(componente.filtrados().map(e => e.id)).toEqual([2]);
  });

  it('filtra por departamento, tipo de espacio y equipamiento', () => {
    montar();

    componente.actualizarDepartamento('Cauca');
    expect(componente.filtrados().map(e => e.id)).toEqual([3, 1]);

    componente.cambiarFiltro({ id: 'tipo', valor: 'Bar o taberna' });
    componente.cambiarFiltro({ id: 'equipamiento', valor: 'Sistema de sonido' });
    expect(componente.filtrados().map(e => e.id)).toEqual([1]);
  });

  it('la accesibilidad filtra «sí» y «no», y un espacio sin dato no entra en ninguno', () => {
    montar();

    componente.cambiarFiltro({ id: 'accesibilidad', valor: 'si' });
    expect(componente.filtrados().map(e => e.id)).toEqual([1]);

    componente.cambiarFiltro({ id: 'accesibilidad', valor: 'no' });
    expect(componente.filtrados().map(e => e.id)).toEqual([2]);
  });

  it('solo ofrece los departamentos y los municipios que de verdad tienen espacios', () => {
    montar();

    expect(componente.departamentos()).toEqual(['Cauca', 'Valle del Cauca']);
    componente.actualizarDepartamento('Cauca');
    expect(componente.municipios()).toEqual(['Popayán', 'Timbío']);
  });

  it('los filtros llegan desde la URL', () => {
    montar(undefined, { departamento: 'Cauca', tipo: 'Bar o taberna' });

    expect(componente.filtrados().map(e => e.id)).toEqual([3, 1]);
  });

  it('limpiar devuelve el directorio entero y apaga el contador de filtros', () => {
    montar();
    componente.actualizarBusqueda('Pacífico');
    componente.cambiarFiltro({ id: 'accesibilidad', valor: 'no' });
    expect(componente.filtrosActivos()).toBe(1);

    componente.limpiarFiltros();

    expect(componente.hayFiltros()).toBeFalse();
    expect(componente.filtrados().length).toBe(3);
  });

  it('un fallo del servidor se dice y no se confunde con «no hay espacios»', () => {
    montar(throwError(() => new Error('caído')) as unknown as ReturnType<EspaciosService['consultarPublicos']>);

    expect(raiz().textContent).toContain('No fue posible consultar los espacios para música en vivo.');
    expect(raiz().querySelector('[data-sin-resultados]')).toBeNull();
  });

  it('sin resultados con los filtros puestos lo dice, cuenta los publicados y sugiere quitarlos', () => {
    montar();
    componente.actualizarBusqueda('inexistente');
    fixture.detectChanges();

    const vacio = raiz().querySelector('[data-sin-resultados]')!;
    expect(vacio.textContent).toContain('Ningún espacio coincide con esta consulta');
    expect(vacio.textContent).toContain('3 espacios publicados');
  });

  it('el paso al mapa abre la capa de Espacios', () => {
    montar();

    componente.abrirMapa();

    const navegacion = TestBed.inject(NavigationService) as unknown as { navigateToMapLayer: jasmine.Spy };
    expect(navegacion.navigateToMapLayer).toHaveBeenCalledWith('Espacios', { targetView: 'map' });
  });
});
