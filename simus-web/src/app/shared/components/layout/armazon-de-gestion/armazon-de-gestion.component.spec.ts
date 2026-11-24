import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ArmazonDeGestionComponent } from './armazon-de-gestion.component';
import { GrupoDeGestion } from '../../../../core/navegacion/grupos-de-gestion';
import { ExternalSessionService } from '../../../../core/services/external-session.service';
import { PanelOrganizacionApi } from '../../../../features/panel-organizacion/panel-organizacion.api';
import { NotificacionesEnVivoService } from '../../../../core/services/notificaciones-en-vivo.service';

const GRUPOS: GrupoDeGestion[] = [
  { id: 'a', etiqueta: 'Trabajo', enlaces: [
    { ruta: 'inicio', comandos: ['/gestion/cuenta'], etiqueta: 'Inicio', icono: 'inicio', exacta: true, palabrasClave: [] },
    { ruta: 'solicitudes', comandos: ['/gestion/cuenta/solicitudes'], etiqueta: 'Solicitudes', icono: 'solicitudes', palabrasClave: [], insignia: 3, textoDeLaInsignia: '3 solicitudes esperan tu acción' },
  ] },
  { id: 'b', etiqueta: 'Mi cuenta', enlaces: [
    { ruta: 'datos', comandos: ['/gestion/cuenta/datos'], etiqueta: 'Datos personales', icono: 'datos', palabrasClave: [] },
  ] },
];

@Component({
  standalone: true,
  imports: [ArmazonDeGestionComponent],
  template: `<app-armazon-de-gestion [grupos]="grupos" clavePlegados="prueba.plegados" [marcaA]="['/gestion/cuenta']">
    <div identidad><p id="quien">Mi espacio</p></div><p id="contenido">Contenido</p></app-armazon-de-gestion>`,
})
class Anfitrion { grupos = GRUPOS; }

@Component({
  standalone: true,
  imports: [ArmazonDeGestionComponent],
  template: `<app-armazon-de-gestion [grupos]="grupos" clavePlegados="prueba.plegados" nombreDeLaIdentidad="Corporación Cultural Cantaclaro">
    <div identidad><p>Identidad</p></div><p id="contenido">Contenido</p></app-armazon-de-gestion>`,
})
class AnfitrionConIdentidad {
  grupos: GrupoDeGestion[] = [...GRUPOS, { id: 'c', etiqueta: 'Más cosas', enlaces: [
    { ruta: 'procesos', comandos: ['/gestion/cuenta/procesos'], etiqueta: 'Procesos', icono: 'procesos', palabrasClave: [] },
    { ruta: 'eventos', comandos: ['/gestion/cuenta/eventos'], etiqueta: 'Eventos', icono: 'eventos', palabrasClave: [] },
    { ruta: 'herramientas', comandos: ['/gestion/cuenta/herramientas'], etiqueta: 'Herramientas', icono: 'herramientas', palabrasClave: [] },
  ] }];
}

function ancharVentana(ancho: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: ancho });
}

// Descriptor nativo, capturado al cargar el archivo (antes de que ninguna prueba toque la ventana).
const ANCHO_NATIVO = Object.getOwnPropertyDescriptor(window, 'innerWidth');

/** Devuelve `innerWidth` a su valor nativo. Borrarlo lo dejaba en `undefined` para las demás pruebas (p. ej. el mapa). */
function restaurarVentana(): void {
  if (ANCHO_NATIVO) Object.defineProperty(window, 'innerWidth', ANCHO_NATIVO);
}

describe('ArmazonDeGestionComponent (PANEL, decisión 126)', () => {
  afterAll(() => restaurarVentana());
  const sesion = signal({ userId: 7, fullName: 'Ana', email: 'a@x.co' } as unknown);

  beforeEach(() => {
    localStorage.clear();
    ancharVentana(1440);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: ExternalSessionService, useValue: { actual: sesion.asReadonly(), organizaciones: () => [], dentro: () => true, refrescar: () => of(null), salir: () => of(null) } },
        { provide: PanelOrganizacionApi, useValue: {} },
        { provide: NotificacionesEnVivoService, useValue: { observar: () => of({ items: [], limit: 50, offset: 0, total: 0 }) } },
      ],
    });
  });

  it('proyecta la identidad arriba de la barra y el contenido a la derecha, con los grupos de la navegación', async () => {
    const f = TestBed.createComponent(Anfitrion);
    await TestBed.inject(Router).navigateByUrl('/gestion/cuenta/datos');
    f.detectChanges();
    const raiz = f.nativeElement as HTMLElement;

    expect(raiz.querySelector('aside #quien')).not.toBeNull();
    expect(raiz.querySelector('.foundation-main #contenido')).not.toBeNull();
    expect(Array.from(raiz.querySelectorAll('.sidebar-grupo-titulo')).map(b => b.textContent?.trim())).toEqual(['Trabajo', 'Mi cuenta']);
    expect(raiz.querySelectorAll('main').length).toBe(1);
  });

  it('marca la sección activa, solo el inicio con su dirección exacta, y dibuja la insignia con su texto para el lector', async () => {
    const f = TestBed.createComponent(Anfitrion);
    await TestBed.inject(Router).navigateByUrl('/gestion/cuenta/datos');
    f.detectChanges();
    const raiz = f.nativeElement as HTMLElement;

    expect(raiz.querySelector('a[aria-current="page"]')?.textContent).toContain('Datos personales');
    expect(raiz.querySelector('a[data-seccion="inicio"]')?.getAttribute('aria-current')).toBeNull();
    expect(raiz.querySelector('[data-testid="insignia-solicitudes"]')?.textContent?.trim()).toBe('3');
    expect(raiz.querySelector('a[data-seccion="solicitudes"] .sr-only')?.textContent).toContain('3 solicitudes esperan tu acción');
  });

  it('un grupo con la sección que se está viendo no se pliega; los otros se pliegan y se recuerdan por cuenta', async () => {
    const f = TestBed.createComponent(Anfitrion);
    await TestBed.inject(Router).navigateByUrl('/gestion/cuenta/datos');
    f.detectChanges();
    const raiz = f.nativeElement as HTMLElement;
    const titulos = Array.from(raiz.querySelectorAll<HTMLButtonElement>('.sidebar-grupo-titulo'));

    expect(titulos[1].disabled).toBeTrue();
    titulos[0].click();
    f.detectChanges();
    expect(titulos[0].getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem('prueba.plegados.7')).toContain('"a":true');
  });

  describe('el menú se adapta al ancho ', () => {
    async function montar(ancho: number, url = '/gestion/cuenta/datos') {
      ancharVentana(ancho);
      const f = TestBed.createComponent(AnfitrionConIdentidad);
      await TestBed.inject(Router).navigateByUrl(url);
      f.detectChanges();
      return { f, raiz: f.nativeElement as HTMLElement };
    }
    const armazon = (raiz: HTMLElement) => raiz.querySelector<HTMLElement>('.armazon-de-gestion')!;
    const control = (raiz: HTMLElement) => raiz.querySelector<HTMLButtonElement>('[data-testid="control-del-menu"]')!;

    afterEach(() => { restaurarVentana(); });

    it('a 1440 px el menú va abierto, con «Contraer menú» como único control', async () => {
      const { raiz } = await montar(1440);
      expect(armazon(raiz).classList).not.toContain('en-riel');
      expect(raiz.querySelectorAll('[data-testid="control-del-menu"]').length).toBe(1);
      expect(control(raiz).textContent).toContain('Contraer menú');
      expect(control(raiz).getAttribute('aria-expanded')).toBe('true');
    });

    it('contraer pasa a riel, recuerda la elección y la siguiente visita la respeta', async () => {
      const { f, raiz } = await montar(1440);
      control(raiz).click();
      f.detectChanges();
      expect(armazon(raiz).classList).toContain('en-riel');
      expect(control(raiz).textContent).toContain('Expandir menú');
      expect(JSON.parse(localStorage.getItem('simus.gestion.menu-lateral')!)).toEqual({ forma: 'riel', ancho: 1440 });
      // Cada destino sigue teniendo su nombre para el lector de pantalla aunque no se vea.
      expect(raiz.querySelector('a[data-seccion="datos"] .sidebar-rotulo')?.textContent).toContain('Datos personales');

      f.destroy();
      const otra = await montar(1440);
      expect(armazon(otra.raiz).classList).toContain('en-riel');
    });

    it('sin elección, por debajo de 1280 px el riel es automático', async () => {
      const { raiz } = await montar(1200);
      expect(armazon(raiz).classList).toContain('en-riel');
      expect(raiz.querySelector('.identidad-riel')?.textContent?.trim()).toBe('CC');
    });

    it('en riel, un destino enfocado con el teclado muestra su rótulo y Escape lo descarta', async () => {
      const { f, raiz } = await montar(1200);
      const enlace = raiz.querySelector<HTMLAnchorElement>('a[data-seccion="solicitudes"]')!;
      enlace.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      f.detectChanges();
      expect(raiz.querySelector('.etiqueta-emergente')?.textContent?.trim()).toBe('Solicitudes');
      raiz.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      expect(raiz.querySelector('.etiqueta-emergente')).toBeNull();
    });

    it('en tableta es riel y el control abre una expansión superpuesta que se cierra con Escape', async () => {
      const { f, raiz } = await montar(900);
      expect(armazon(raiz).classList).toContain('en-riel');
      expect(control(raiz).getAttribute('aria-expanded')).toBe('false');
      control(raiz).click();
      f.detectChanges();
      expect(armazon(raiz).classList).toContain('menu-superpuesto');
      expect(control(raiz).textContent).toContain('Contraer menú');
      expect(raiz.querySelector('.velo-del-menu')).not.toBeNull();
      raiz.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      expect(armazon(raiz).classList).not.toContain('menu-superpuesto');
    });

    it('en móvil no hay control de columna: barra inferior con cuatro destinos como máximo y «Más»', async () => {
      const { f, raiz } = await montar(390, '/gestion/cuenta/eventos');
      expect(raiz.querySelector('[data-testid="control-del-menu"]')).toBeNull();
      const barra = raiz.querySelector('nav[aria-label="Secciones principales"]')!;
      expect(barra.querySelectorAll('a').length).toBe(4);
      expect(barra.querySelector('[data-barra="solicitudes"] em')?.textContent?.trim()).toBe('3');
      const mas = raiz.querySelector<HTMLButtonElement>('[data-testid="boton-mas"]')!;
      expect(mas.getAttribute('aria-current')).toBe('page');
      mas.click();
      f.detectChanges();
      const hoja = raiz.querySelector('[role="dialog"]')!;
      expect(hoja.textContent).toContain('Eventos');
      expect(hoja.textContent).not.toContain('Datos personales');
      hoja.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    });

    it('en móvil el marco de la columna no ocupa lugar ni intercepta toques (empujaba el contenido 100 vh y lo tapaba)', async () => {
      const { raiz } = await montar(390, '/gestion/cuenta/eventos');
      const marco = raiz.querySelector<HTMLElement>('.barra-marco')!;
      expect(getComputedStyle(marco).display).toBe('none');
    });
  });
});
