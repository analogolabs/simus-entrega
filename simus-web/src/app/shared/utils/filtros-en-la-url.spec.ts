import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import {
  contarFiltrosPuestos,
  filtroDeCantidad,
  enlazarFiltrosConLaUrl,
  filtroDePagina,
  filtroDeTexto,
  filtroDeVista,
  limpiarFiltros,
} from './filtros-en-la-url';

/**
 * Los filtros de un listado, guardados en la URL.
 *
 * <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que vuelva a haber cuatro implementaciones de lo mismo, y
 * que las tres consecuencias que se notan usando el sitio reaparezcan: que una búsqueda filtrada no
 * se pueda compartir, que recargar la pierda, y que «Atrás» no la deshaga.
 */
@Component({ selector: 'app-listado-de-prueba', standalone: true, template: '' })
class ListadoDePrueba {
  readonly busqueda = signal('');
  readonly categoria = signal('todas');
  readonly pagina = signal(1);
  readonly vista = signal<'mosaico' | 'tabla'>('mosaico');

  readonly filtros = [
    filtroDeTexto('q', this.busqueda),
    filtroDeTexto('categoria', this.categoria, 'todas'),
    filtroDeVista('vista', this.vista, 'mosaico'),
    filtroDePagina(this.pagina),
  ];

  constructor() {
    enlazarFiltrosConLaUrl(this.filtros);
  }
}

describe('los filtros de un listado viven en la URL', () => {
  let fixture: ComponentFixture<ListadoDePrueba>;
  let componente: ListadoDePrueba;
  let navegaciones: { queryParams: Record<string, string | null> }[];

  function montar(urlDeEntrada: Record<string, string> = {}): void {
    navegaciones = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ListadoDePrueba],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(urlDeEntrada) } } },
      ],
    });
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.callFake((_comandos: unknown[], extras?: { queryParams?: Record<string, string | null> }) => {
      navegaciones.push({ queryParams: extras?.queryParams ?? {} });
      return Promise.resolve(true);
    });
    fixture = TestBed.createComponent(ListadoDePrueba);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const ultima = () => navegaciones[navegaciones.length - 1].queryParams;

  it('lee de la URL al entrar: es lo que sostiene recargar y abrir un enlace compartido', () => {
    montar({ q: 'bambuco', categoria: 'Convocatorias', pagina: '3', vista: 'tabla' });

    expect(componente.busqueda()).toBe('bambuco');
    expect(componente.categoria()).toBe('Convocatorias');
    expect(componente.pagina()).toBe(3);
    expect(componente.vista()).toBe('tabla');
  });

  it('un parámetro ausente no machaca el valor con el que arranca la pantalla', () => {
    // MUTANTE QUE MATA: poner `vacio` cuando la URL no trae el parámetro. El orden de Noticias
    // arranca en «newest», que no es su valor vacío: machacarlo cambiaría lo que se ve al entrar.
    montar({ q: 'bambuco' });

    expect(componente.categoria()).toBe('todas');
    expect(componente.vista()).toBe('mosaico');
    expect(componente.pagina()).toBe(1);
  });

  it('escribe en la URL lo que se filtra, y solo eso', () => {
    montar();
    componente.categoria.set('Convocatorias');
    fixture.detectChanges();

    expect(ultima()['categoria']).toBe('Convocatorias');
    // LO VACIO NO SE ESCRIBE: una URL con `?q=&pagina=1` no aporta nada y estorba al compartirla.
    expect(ultima()['q']).toBeNull();
    expect(ultima()['pagina']).toBeNull();
    expect(ultima()['vista']).toBeNull();
  });

  it('al entrar con todo en su valor de partida no navega: una navegación de más pisa el «Atrás»', () => {
    // EL DEFECTO: el efecto corría al montar y navegaba a la misma URL. Esa navegación imperativa
    // cambiaba el origen de la anterior, el enrutador dejaba de restaurar el desplazamiento y al
    // volver de una noticia la lista quedaba arriba. MUTANTE QUE MATA: quitar la comparación con
    // la dirección actual.
    montar();

    expect(navegaciones.length).toBe(0);
  });

  it('no apila una entrada de historial por cada tecla', () => {
    montar();
    componente.busqueda.set('ba');
    fixture.detectChanges();

    // «Atrás» tiene que volver a la pantalla anterior, no deshacer letra a letra lo escrito.
    const extras = navegaciones.length;
    expect(extras).toBeGreaterThan(0);
    const llamada = (TestBed.inject(Router).navigate as jasmine.Spy).calls.mostRecent();
    expect(llamada.args[1].replaceUrl).toBeTrue();
    expect(llamada.args[1].queryParamsHandling).toBe('merge');
  });

  it('una página que no es un entero positivo cae en la primera, no deja la lista en blanco', () => {
    // `?pagina=abc` llega de un enlace mal copiado, no de un ataque.
    montar({ pagina: 'abc' });
    expect(componente.pagina()).toBe(1);

    montar({ pagina: '-2' });
    expect(componente.pagina()).toBe(1);

    montar({ pagina: '2.5' });
    expect(componente.pagina()).toBe(1);
  });

  it('cuenta los filtros puestos con el vacío que cada uno declara', () => {
    montar();
    expect(contarFiltrosPuestos(componente.filtros)).toBe(0);

    componente.categoria.set('Convocatorias');
    expect(contarFiltrosPuestos(componente.filtros)).toBe(1);

    // MUTANTE QUE MATA: comparar contra `''` en vez de contra el vacío declarado. «todas» es el
    // vacío de esta categoría, y contarlo daría «1 filtro» sobre una lista sin filtrar.
    componente.categoria.set('todas');
    componente.busqueda.set('bambuco');
    expect(contarFiltrosPuestos(componente.filtros)).toBe(1);
  });

  it('limpiar devuelve cada filtro a SU vacío, la página incluida', () => {
    montar({ q: 'bambuco', categoria: 'Convocatorias', pagina: '4' });

    limpiarFiltros(componente.filtros);

    expect(componente.busqueda()).toBe('');
    // MUTANTE QUE MATA: dejar la página donde estaba. Quitar los filtros en la página 4 deja la
    // lista en blanco si la consulta sin filtrar no llega a cuatro páginas.
    expect(componente.pagina()).toBe(1);
    expect(componente.categoria()).toBe('todas');
    expect(contarFiltrosPuestos(componente.filtros)).toBe(0);
  });
});

describe('la cantidad por página (`por`)', () => {
  it('la de partida es el vacío (no se escribe) y una cantidad que no se ofrece cae en la de partida', () => {
    const senal = signal(12);
    const filtro = filtroDeCantidad(senal);
    expect(filtro.parametro).toBe('por');
    expect(filtro.vacio).toBe(12);
    expect(filtro.desdeTexto?.('24')).toBe(24);
    expect(filtro.desdeTexto?.('1000')).toBe(12);
    expect(filtro.desdeTexto?.('abc')).toBe(12);
  });

  it('un listado puede declarar sus propias cantidades', () => {
    const filtro = filtroDeCantidad(signal(6), [6, 12, 24]);
    expect(filtro.vacio).toBe(6);
    expect(filtro.desdeTexto?.('12')).toBe(12);
    expect(filtro.desdeTexto?.('48')).toBe(6);
  });
});
