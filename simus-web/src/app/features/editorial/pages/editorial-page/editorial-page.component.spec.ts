import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { CatalogoEditorialService } from '../../../../core/services/catalogo-editorial.service';
import { RecursoEditorialDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { ConsultaDelCatalogoPublico, FacetasDelCatalogoEditorial } from '../../../../core/contratos/catalogo-editorial';
import { EditorialPageComponent } from './editorial-page.component';

/**
 * El listado del Catálogo Editorial.
 *
 * <b>EL SERVIDOR FILTRA, ORDENA Y PAGINA.</b> Estas pruebas no calculan nada del acervo: fijan qué se le
 * pide al servidor (`consulta`) cuando alguien pulsa un filtro, un encabezado de columna o el selector de
 * cantidad por página, y que la pantalla pinta lo que éste devuelve.
 *
 * <b>Y SIGUE FIJANDO LO QUE YA FIJABA.</b> Nueve series del acervo tienen varios volúmenes con el mismo
 * título, así que dos publicaciones llamadas «Acento» daban dos tarjetas y dos filas idénticas: el
 * subtítulo y el volumen son lo único que las separa sin abrirlas, y tienen que verse en las dos vistas.
 */
function recurso(cambios: Partial<RecursoEditorialDeDiseno> = {}): RecursoEditorialDeDiseno {
  return {
    id: 'PNMC-ED-012', title: 'Acento', year: '2011', section: 'Repertorio',
    sectionPath: 'Repertorio > Banda', publicationType: 'Libro', practice: 'Banda',
    category: 'Formación', subcategory: '', regionalScope: 'Nacional',
    author: 'Ana Restrepo', corporateAuthor: '', additionalCredits: '',
    displayAuthor: 'Ana Restrepo', isbn: '', ismn: '', formatSize: '', pages: '', duration: '',
    summary: '', coverText: '', thumbnail: '',
    keywords: [], subtitle: 'Arreglos para banda-escuela', volume: 'Volumen I', series: '',
    language: 'es', edtfDate: '2011', dateNote: '', secondaryCategory: '', scopeText: 'Nacional',
    mediaFormat: '', licence: '', typology: [], credits: [], identifiers: [], access: [],
    ...cambios,
  };
}

const FACETAS: FacetasDelCatalogoEditorial = {
  totalAcervo: 30, totalEnAlcance: 30,
  categorias: [{ valor: 'Formación', nombre: 'Formación', total: 20 }, { valor: 'Repertorio', nombre: 'Repertorio', total: 10 }],
  subcategorias: [{ valor: 'Pedagogía instrumental', nombre: 'Pedagogía instrumental', total: 6 }],
  materiales: [{ valor: 'libro', nombre: 'Libro', total: 20 }, { valor: 'mixto', nombre: 'Material mixto', total: 10 }],
  soportes: [{ valor: 'volumen', nombre: 'Impreso', total: 25 }],
  anios: [{ valor: '2016', nombre: '2016', total: 4 }, { valor: '2011', nombre: '2011', total: 8 }],
  temas: Array.from({ length: 14 }, (_, i) => ({ valor: `tema ${i + 1}`, nombre: `tema ${i + 1}`, total: 14 - i })),
};

describe('EditorialPageComponent', () => {
  let fixture: ComponentFixture<EditorialPageComponent>;
  let consultas: ConsultaDelCatalogoPublico[];

  const montar = (items: RecursoEditorialDeDiseno[], respuesta?: () => Observable<unknown>) => {
    consultas = [];
    TestBed.overrideProvider(CatalogoEditorialService, {
      useValue: {
        explorarParaElPortal: (c: ConsultaDelCatalogoPublico) => {
          consultas.push(c);
          return respuesta?.() ?? of({ items, total: items.length, totalPaginas: Math.max(1, Math.ceil(items.length / (c.tamano ?? 24))), pagina: c.pagina ?? 1, tamano: c.tamano ?? 24, facetas: FACETAS });
        },
        obtenerPublica: () => Promise.resolve({ ok: false, error: 'no existe' }),
      } as unknown as Partial<CatalogoEditorialService>,
    });
    fixture = TestBed.createComponent(EditorialPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const ultima = () => consultas[consultas.length - 1];
  const refrescar = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorialPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('pide al servidor la primera página con el orden de partida y 24 por página', () => {
    montar([recurso()]);
    expect(ultima()).toEqual(jasmine.objectContaining({ orden: 'titulo', sentido: 'asc', pagina: 1, tamano: 24, categoria: '', palabraClave: '' }));
  });

  it('cada filtro vuelve a pedir al servidor desde la página 1 y los chips lo dicen', async () => {
    const raiz = montar([recurso()]);
    const c = fixture.componentInstance;
    c.currentPage.set(3);
    c.setActiveTab('Formación');
    c.setMaterial('mixto');
    c.setSoporte('volumen');
    c.setSelectedYearFilter('2016');
    await refrescar();

    expect(ultima()).toEqual(jasmine.objectContaining({ categoria: 'Formación', material: 'mixto', soporte: 'volumen', anio: '2016', pagina: 1 }));
    const chips = Array.from(raiz.querySelectorAll('[data-testid="filtros-aplicados"] app-chip-de-filtro')).map(e => e.textContent!.replace(/\s+/g, ''));
    expect(chips.some(t => t.includes('Categoría:Formación'))).toBeTrue();
    expect(chips.some(t => t.includes('Tipo:Materialmixto'))).toBeTrue();
    expect(chips.some(t => t.includes('Soporte:Impreso'))).toBeTrue();
    expect(chips.some(t => t.includes('Año:2016'))).toBeTrue();

    c.limpiarFiltrosAplicados();
    await refrescar();
    expect(ultima()).toEqual(jasmine.objectContaining({ categoria: '', material: '', soporte: '', anio: '' }));
    expect(raiz.querySelectorAll('[data-testid="filtros-aplicados"] app-chip-de-filtro').length).toBe(0);
  });

  it('la «X» de un chip quita solo ese filtro, conserva el orden y los demás, y «Limpiar filtros» quita el resto', async () => {
    const raiz = montar([recurso()]);
    const c = fixture.componentInstance;
    c.setActiveTab('Formación');
    c.setSoporte('volumen');
    c.ordenarPor(c.columnas.find(col => col.campo === 'autoria')!);
    await refrescar();

    const quitar = raiz.querySelector<HTMLElement>('[data-testid="filtros-aplicados"] app-chip-de-filtro button');
    expect(quitar).not.toBeNull();
    quitar!.click();
    await refrescar();
    expect(ultima()).toEqual(jasmine.objectContaining({ categoria: '', soporte: 'volumen', orden: 'autoria' }));
    expect(raiz.querySelectorAll('[data-testid="filtros-aplicados"] app-chip-de-filtro').length).toBe(1);

    raiz.querySelector<HTMLElement>('[data-testid="filtros-aplicados"] [data-filtros-activos] button:last-of-type')!.click();
    await refrescar();
    expect(ultima()).toEqual(jasmine.objectContaining({ soporte: '', orden: 'autoria' }));
    expect(raiz.querySelectorAll('[data-testid="filtros-aplicados"] app-chip-de-filtro').length).toBe(0);
  });

  it('cambiar de categoría limpia subcategoría y tema, que ya no corresponden', () => {
    montar([recurso()]);
    const c = fixture.componentInstance;
    c.setActiveTab('Formación');
    c.selectedSubcategory.set('Pedagogía instrumental');
    c.selectedKeyword.set('banda');
    c.setActiveTab('Repertorio');
    expect(c.selectedSubcategory()).toBe('');
    expect(c.selectedKeyword()).toBe('');
  });

  it('E-3: elegir otra cantidad por página vuelve a la página 1 y la pide al servidor', async () => {
    const raiz = montar([recurso()]);
    fixture.componentInstance.currentPage.set(4);
    fixture.componentInstance.cambiarPorPagina(12);
    await refrescar();
    expect(ultima()).toEqual(jasmine.objectContaining({ tamano: 12, pagina: 1 }));
    // El selector de cantidad está en la página aunque haya una sola página de resultados.
    expect(raiz.querySelector('app-paginacion-de-lista')).not.toBeNull();
  });

  it('E-2: enseña diez temas como etiquetas y solo los demás en el desplegable «Más temas»', () => {
    const raiz = montar([recurso()]);
    const botones = Array.from(raiz.querySelectorAll('aside button[aria-pressed]')).filter(b => b.textContent!.includes('#tema'));
    expect(botones.length).toBe(10);
    expect(raiz.querySelector('app-filtro-desplegable[identificador="tema-del-catalogo"], [id*="tema-del-catalogo"]')).not.toBeNull();
    expect(fixture.componentInstance.opcionesDeTema().length).toBe(15);
    // El desplegable no repite las etiquetas: «elige otro tema» y los cuatro restantes.
    expect(fixture.componentInstance.opcionesDeOtrosTemas().length).toBe(5);
  });

  it('E-5: los encabezados de la lista ordenan por el servidor y dicen su estado con aria-sort', async () => {
    const raiz = montar([recurso()]);
    fixture.componentInstance.setViewMode('table');
    await refrescar();

    const cabecera = (campo: string) => raiz.querySelector<HTMLButtonElement>(`th button[data-ordenar="${campo}"]`)!;
    const th = (campo: string) => cabecera(campo).closest('th')!;
    expect(th('titulo').getAttribute('aria-sort')).toBe('ascending');
    expect(th('anio').getAttribute('aria-sort')).toBe('none');

    // El año arranca del más reciente.
    cabecera('anio').click();
    await refrescar();
    expect(ultima()).toEqual(jasmine.objectContaining({ orden: 'anio', sentido: 'desc', pagina: 1 }));
    expect(th('anio').getAttribute('aria-sort')).toBe('descending');
    expect(th('titulo').getAttribute('aria-sort')).toBe('none');

    // Pulsarla otra vez la invierte.
    cabecera('anio').click();
    await refrescar();
    expect(ultima()).toEqual(jasmine.objectContaining({ orden: 'anio', sentido: 'asc' }));
    expect(th('anio').getAttribute('aria-sort')).toBe('ascending');

    // Las demás empiezan de la A a la Z.
    cabecera('autoria').click();
    await refrescar();
    expect(ultima()).toEqual(jasmine.objectContaining({ orden: 'autoria', sentido: 'asc' }));
    expect(raiz.querySelector('p[role="status"].sr-only')?.textContent).toContain('Ordenado por autoría, de la A a la Z');
  });

  it('E-5: las direcciones antiguas con orden=az|za se entienden', () => {
    montar([recurso()]);
    const c = fixture.componentInstance;
    c.orden.set('za');
    (c as unknown as { normalizarElOrdenDeLaUrl(): void }).normalizarElOrdenDeLaUrl();
    expect(c.orden()).toBe('titulo');
    expect(c.sentido()).toBe('desc');
  });

  it('E-5: los valores de la lista filtran por sí mismos sin abrir la ficha', async () => {
    const raiz = montar([recurso({ displayAuthor: 'Ana Restrepo; Luis Franco y 3 más' })]);
    fixture.componentInstance.setViewMode('table');
    await refrescar();
    const valor = (que: string, indice = 0) => raiz.querySelectorAll<HTMLButtonElement>(`tbody button[data-filtrar="${que}"]`)[indice];

    valor('categoria').click();
    await refrescar();
    expect(ultima().categoria).toBe('Formación');

    valor('autor', 1).click();
    await refrescar();
    // Cada nombre filtra por sí mismo; «y 3 más» no es un nombre y no es un botón.
    expect(ultima().autor).toBe('Luis Franco');
    expect(raiz.querySelectorAll('tbody button[data-filtrar="autor"]').length).toBe(2);

    valor('anio').click();
    await refrescar();
    expect(ultima().anio).toBe('2011');

    valor('material').click();
    await refrescar();
    expect(ultima().material).toBe('libro');
    // Ninguno de esos clics expandió la fila.
    expect(fixture.componentInstance.expandedId()).toBeNull();
  });

  it('E-4: en la lista, los encabezados quedan pegados a la barra de resultados', async () => {
    const raiz = montar([recurso()]);
    fixture.componentInstance.setViewMode('table');
    await refrescar();
    const barra = raiz.querySelector('.border-b.border-filete.pb-5')!;
    expect(barra.className).toContain('mb-0');
    expect(raiz.querySelector('table')!.className).not.toContain('border-spacing');
  });

  it('enseña el subtítulo y el volumen en el mosaico, que es donde se eligen las obras', () => {
    const raiz = montar([recurso()]);

    expect(raiz.textContent).toContain('Arreglos para banda-escuela');
    expect(raiz.textContent).toContain('Volumen I');
  });

  it('los enseña también en la vista de lista, donde ni siquiera hay portada que distinga', async () => {
    montar([
      recurso({ id: 'PNMC-ED-012', subtitle: 'Arreglos para banda-escuela', volume: 'Volumen I' }),
      recurso({ id: 'PNMC-ED-013', subtitle: 'Arreglos para banda-escuela', volume: 'Volumen II' }),
    ]);
    fixture.componentInstance.setViewMode('table');
    await refrescar();

    const filas = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(filas.length).toBeGreaterThan(1);
    // Las dos se llaman «Acento»: lo que las separa es el volumen, y tiene que estar en la fila.
    expect(filas[0].textContent).toContain('Volumen I');
    expect(filas[1].textContent).toContain('Volumen II');
  });

  it('una publicación sin subtítulo no deja una línea vacía debajo del título', () => {
    const raiz = montar([recurso({ subtitle: '', volume: '' })]);

    expect(raiz.textContent).toContain('Acento');
    expect(raiz.textContent).not.toContain('Volumen');
  });

  it('un fallo del servidor dice el motivo y ofrece «Reintentar», que vuelve a pedir', async () => {
    let falla = true;
    const raiz = montar([recurso()], () => (falla ? throwError(() => new Error('El servidor no responde')) : of({ items: [recurso()], total: 1, totalPaginas: 1, pagina: 1, tamano: 24, facetas: FACETAS })));
    await refrescar();
    expect(raiz.textContent).toContain('El servidor no responde');
    const reintentar = Array.from(raiz.querySelectorAll('button')).find(b => b.textContent!.includes('Reintentar'))!;
    falla = false;
    reintentar.click();
    await refrescar();
    expect(raiz.textContent).toContain('Acento');
    expect(raiz.textContent).not.toContain('El servidor no responde');
  });

  it('sin resultados no dice «no hay» mientras carga, y al terminar ofrece limpiar los filtros', async () => {
    const raiz = montar([], () => of({ items: [], total: 0, totalPaginas: 0, pagina: 1, tamano: 24, facetas: FACETAS }));
    await refrescar();
    expect(raiz.textContent).toContain('No encontramos resultados');
    expect(Array.from(raiz.querySelectorAll('button')).some(b => b.textContent!.includes('Limpiar filtros'))).toBeTrue();
  });
});
