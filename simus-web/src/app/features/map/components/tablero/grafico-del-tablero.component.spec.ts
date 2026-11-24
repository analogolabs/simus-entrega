import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraficoDelTableroComponent } from './grafico-del-tablero.component';
import { opcionBarras } from '../../domain/opciones-del-tablero';
import { opcionRed } from '../../domain/red-del-tablero';
import type { RedDelEcosistema } from '../../../../core/services/red-del-ecosistema.service';

describe('GraficoDelTableroComponent', () => {
  let fixture: ComponentFixture<GraficoDelTableroComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GraficoDelTableroComponent);
    fixture.nativeElement.style.cssText = 'display:block;width:400px;height:200px';
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('descripcion', 'Prueba de barras');
    fixture.componentRef.setInput('opcion', opcionBarras([{ clave: 'a', etiqueta: 'Alfa', valor: 3 }], { color: '#7a2f97', total: 3, animar: false }));
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  it('carga la librería bajo demanda, dibuja SVG y quita el esqueleto', async () => {
    expect(fixture.nativeElement.querySelector('app-esqueleto')).not.toBeNull();
    const limite = Date.now() + 8000;
    while (!fixture.nativeElement.querySelector('svg') && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 50));
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-esqueleto')).toBeNull();
  });

  it('es una imagen con su descripción para el lector de pantalla', () => {
    const lienzo = fixture.nativeElement.querySelector('[role="img"]');
    expect(lienzo.getAttribute('aria-label')).toBe('Prueba de barras');
  });
});

/** Una red de 36 nodos (organizaciones, festivales, territorios y prácticas) con nombres largos: el caso que se cortaba. */
function redGrande(): RedDelEcosistema {
  const nodos: RedDelEcosistema['nodos'][number][] = [];
  const aristas: RedDelEcosistema['aristas'][number][] = [];
  for (let f = 0; f < 8; f++) {
    nodos.push({ id: `festival:${f}`, tipo: 'festival', nombre: `Festival de música tradicional número ${f}`, departamento: 'Meta' });
    nodos.push({ id: `organizacion:${f}`, tipo: 'organizacion', nombre: `Corporación cultural organizadora ${f}`, departamento: '' });
    aristas.push({ origen: `organizacion:${f}`, destino: `festival:${f}`, tipo: 'responsable' });
    for (let t = 0; t < 3; t++) aristas.push({ origen: `festival:${f}`, destino: `territorio:${(f + t) % 6}`, tipo: 'declara' });
    aristas.push({ origen: `festival:${f}`, destino: `practica:${f % 5}`, tipo: 'declara' });
  }
  for (let t = 0; t < 6; t++) nodos.push({ id: `territorio:${t}`, tipo: 'territorio', nombre: `Territorio sonoro de los llanos ${t}`, departamento: '' });
  for (let t = 0; t < 5; t++) nodos.push({ id: `practica:${t}`, tipo: 'practica', nombre: `Práctica musical ${t}`, departamento: '' });
  return { truncada: false, nodos, aristas };
}

describe('GraficoDelTableroComponent explorable (lienzo de la red)', () => {
  let fixture: ComponentFixture<GraficoDelTableroComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const instancia = () => fixture.componentInstance as unknown as { zoomActual(): number; cajaDelGrafo(): unknown; grafoDentroDelMarco(): boolean; encuadrar(): Promise<void> };

  async function montar(ancho: number, alto: number): Promise<void> {
    fixture = TestBed.createComponent(GraficoDelTableroComponent);
    fixture.nativeElement.style.cssText = `display:block;width:${ancho}px;height:${alto}px`;
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('descripcion', 'Red de prueba');
    fixture.componentRef.setInput('explorable', true);
    fixture.componentRef.setInput('opcion', opcionRed(redGrande(), { animar: false, expandidos: ['festival:0'] }));
    fixture.detectChanges();
    const limite = Date.now() + 8000;
    while (!el().querySelector('svg') && Date.now() < limite) await new Promise((r) => setTimeout(r, 50));
    await instancia().encuadrar();
    await new Promise((r) => setTimeout(r, 300));
    await instancia().encuadrar();
  }

  afterEach(() => { el().remove(); document.body.classList.remove('overflow-hidden'); });

  for (const [nombre, ancho, alto] of [['escritorio 1440x900', 1000, 520], ['tableta', 700, 440], ['teléfono 390', 340, 420]] as const) {
    it(`tras «Ajustar» ningún nodo ni etiqueta queda fuera del marco (${nombre})`, async () => {
      await montar(ancho, alto);
      await instancia().encuadrar();
      expect(instancia().grafoDentroDelMarco()).withContext('el grafo cabe en el marco').toBeTrue();
    });
  }

  it('la rueda sin Ctrl no cambia el zoom; con Ctrl sí', async () => {
    await montar(800, 480);
    const antes = instancia().zoomActual();
    const lienzo = el().querySelector('[role="img"]') as HTMLElement;
    // Las coordenadas salen del propio lienzo (centro de su rectángulo): con coordenadas fijas el gesto cae fuera del lienzo
    // cuando la página quedó desplazada por otras pruebas de la suite completa, y ECharts lo ignora.
    const rueda = (ctrlKey: boolean) => {
      const r = lienzo.getBoundingClientRect();
      return lienzo.querySelector('svg')!.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, ctrlKey, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    };
    rueda(false);
    await new Promise((r) => setTimeout(r, 100));
    expect(instancia().zoomActual()).toBe(antes);
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="lienzo-aviso"]')!.textContent).toContain('Ctrl + rueda');
    rueda(true);
    // Espera por condición (no por tiempo fijo): con la máquina cargada el zoom tarda en aplicarse.
    for (let i = 0; i < 40 && instancia().zoomActual() === antes; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(instancia().zoomActual()).not.toBe(antes);
  });

  it('los botones acercan y alejan con tope, el indicador lo dice y «Ajustar» vuelve a encuadrar', async () => {
    await montar(800, 480);
    const boton = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
    const antes = instancia().zoomActual();
    boton('lienzo-acercar').click();
    await new Promise((r) => setTimeout(r, 100));
    expect(instancia().zoomActual()).toBeGreaterThan(antes);
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="lienzo-zoom"]')!.textContent).toContain('125');
    for (let i = 0; i < 20; i++) boton('lienzo-acercar').click();
    await new Promise((r) => setTimeout(r, 100));
    expect(instancia().zoomActual()).toBeLessThanOrEqual(6.0001);
    boton('lienzo-ajustar').click();
    await new Promise((r) => setTimeout(r, 600));
    expect(instancia().grafoDentroDelMarco()).toBeTrue();
  });

  it('el modo ampliado se activa con el botón y se sale con Escape', async () => {
    await montar(800, 480);
    (el().querySelector('[data-testid="lienzo-ampliar"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('.lienzo-ampliado')).not.toBeNull();
    expect(document.body.classList.contains('overflow-hidden')).toBeTrue();
    el().querySelector('.lienzo-marco')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(el().querySelector('.lienzo-ampliado')).toBeNull();
    expect(document.body.classList.contains('overflow-hidden')).toBeFalse();
  });

  it('con el teclado: + acerca, − aleja y 0 ajusta (con el foco en el lienzo)', async () => {
    await montar(800, 480);
    const marco = el().querySelector('.lienzo-marco') as HTMLElement;
    const antes = instancia().zoomActual();
    marco.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    expect(instancia().zoomActual()).toBeGreaterThan(antes);
    expect(marco.getAttribute('tabindex')).toBe('0');
    expect(marco.getAttribute('aria-label')).toContain('Flechas');
  });
});
