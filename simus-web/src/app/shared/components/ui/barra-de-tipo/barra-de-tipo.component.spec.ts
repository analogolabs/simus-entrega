import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BarraDeTipoComponent } from './barra-de-tipo.component';
import { opcionesDeTipoDeProceso } from './opciones-de-tipo';

@Component({
  standalone: true,
  imports: [BarraDeTipoComponent],
  template: `<div [style.width.px]="ancho()"><app-barra-de-tipo [opciones]="opciones" [elegida]="elegida()" controla="lista" (elegir)="elegida.set($event)" /></div>`,
})
class Anfitrion {
  readonly ancho = signal(1200);
  readonly elegida = signal('todos');
  readonly opciones = opcionesDeTipoDeProceso({ conteos: { festivales: 3, mercados: 2, luteria: 1, espacios: 1 } });
}

async function estable(f: { detectChanges(): void; whenStable(): Promise<unknown> }) {
  f.detectChanges(); await f.whenStable();
  await new Promise(r => setTimeout(r, 60));
  f.detectChanges(); await f.whenStable();
}

describe('opcionesDeTipoDeProceso (P3)', () => {
  it('«Todos» y los cinco tipos en el orden del Ecosistema; lo que falta cuenta cero', () => {
    const o = opcionesDeTipoDeProceso({ conteos: { festivales: 2, luteria: 1 } });
    expect(o.map(x => `${x.etiqueta} ${x.conteo}`)).toEqual(['Todos 3', 'Festivales 2', 'Mercados 0', 'Redes y documentación 0', 'Lutería 1', 'Espacios para música en vivo 0']);
  });
  it('acepta un total propio, un subconjunto de tipos y «Citas e invitaciones»', () => {
    const o = opcionesDeTipoDeProceso({ conteos: { luteria: 1, otras: 2 }, total: 9, tipos: ['luteria'], conOtras: true });
    expect(o.map(x => `${x.id}:${x.conteo}`)).toEqual(['todos:9', 'luteria:1', 'otras:2']);
  });
});

describe('BarraDeTipoComponent (P3)', () => {
  it('con ancho de sobra pinta los segmentos, como tablist, con rótulo «Tipo» y conteos', async () => {
    const f = TestBed.createComponent(Anfitrion);
    await estable(f);
    const raiz = f.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-barra-de-tipo]')?.getAttribute('data-forma')).toBe('segmentada');
    expect(raiz.querySelector('[role="tablist"]')).not.toBeNull();
    expect(raiz.querySelector('.bt__rotulo')?.textContent).toContain('Tipo');
    const tabs = Array.from(raiz.querySelectorAll('[role="tab"]'));
    expect(tabs.length).toBe(6);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-controls')).toBe('lista');
    expect(tabs.map(t => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1', '-1']);
    expect(tabs[1].textContent?.replace(/\s+/g, '')).toBe('Festivales3');
  });

  it('si los segmentos no caben en el ancho del contenedor se cambia por el desplegable, sin perder la opción elegida', async () => {
    const f = TestBed.createComponent(Anfitrion);
    f.componentInstance.elegida.set('mercados');
    await estable(f);
    f.componentInstance.ancho.set(320);
    await estable(f);
    const raiz = f.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-barra-de-tipo]')?.getAttribute('data-forma')).toBe('desplegable');
    expect(raiz.querySelector('[role="tablist"]')).toBeNull();
    const desplegable = raiz.querySelector('app-filtro-desplegable');
    expect(desplegable?.textContent).toContain('Tipo');
    expect(desplegable?.textContent).toContain('Mercados');
  });

  it('vuelve a los segmentos cuando el contenedor se ensancha', async () => {
    const f = TestBed.createComponent(Anfitrion);
    f.componentInstance.ancho.set(320);
    await estable(f);
    expect((f.nativeElement as HTMLElement).querySelector('[data-barra-de-tipo]')?.getAttribute('data-forma')).toBe('desplegable');
    f.componentInstance.ancho.set(1200);
    await estable(f);
    expect((f.nativeElement as HTMLElement).querySelector('[data-barra-de-tipo]')?.getAttribute('data-forma')).toBe('segmentada');
  });

  it('la copia que mide no es accesible ni enfocable', async () => {
    const f = TestBed.createComponent(Anfitrion);
    await estable(f);
    const medida = (f.nativeElement as HTMLElement).querySelector('.bt__medida')!;
    expect(medida.getAttribute('aria-hidden')).toBe('true');
    expect(medida.hasAttribute('inert')).toBeTrue();
    expect(medida.querySelectorAll('button, a, [tabindex]').length).toBe(0);
  });

  it('elegir un segmento emite su id; las flechas, Inicio y Fin mueven y activan', async () => {
    const f = TestBed.createComponent(Anfitrion);
    await estable(f);
    const raiz = f.nativeElement as HTMLElement;
    (raiz.querySelector('[data-pestana="mercados"]') as HTMLElement).click();
    expect(f.componentInstance.elegida()).toBe('mercados');
    f.detectChanges();
    const tecla = (key: string) => (raiz.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    tecla('ArrowRight'); f.detectChanges();
    expect(f.componentInstance.elegida()).toBe('redes');
    tecla('End'); f.detectChanges();
    expect(f.componentInstance.elegida()).toBe('espacios');
    tecla('Home'); f.detectChanges();
    expect(f.componentInstance.elegida()).toBe('todos');
    tecla('ArrowLeft'); f.detectChanges();
    expect(f.componentInstance.elegida()).toBe('espacios');
  });
});
