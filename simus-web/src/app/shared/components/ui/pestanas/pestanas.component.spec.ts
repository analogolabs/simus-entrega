import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpcionDePestana, PestanasComponent } from './pestanas.component';

@Component({
  standalone: true,
  imports: [PestanasComponent],
  template: `
    <app-pestanas [opciones]="opciones" [elegida]="elegida()" etiquetaDelGrupo="Estado de las solicitudes"
      controla="lista-de-solicitudes" (elegir)="elegida.set($event)" />
  `,
})
class Anfitrion {
  readonly opciones: OpcionDePestana[] = [
    { id: 'pendientes', etiqueta: 'Pendientes', conteo: 12 },
    { id: 'resueltas', etiqueta: 'Resueltas', conteo: 30 },
    { id: 'todas', etiqueta: 'Todas' },
  ];
  readonly elegida = signal('pendientes');
}

describe('PestanasComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;
  const raiz = () => fixture.nativeElement as HTMLElement;
  const pestanas = () => Array.from(raiz().querySelectorAll<HTMLButtonElement>('[role="tab"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('es una lista de pestañas de verdad: tablist con nombre, y cada pestaña con rol y aria-controls', () => {
    const lista = raiz().querySelector('[role="tablist"]') as HTMLElement;
    expect(lista.getAttribute('aria-label')).toBe('Estado de las solicitudes');
    expect(pestanas().length).toBe(3);
    for (const pestana of pestanas()) {
      expect(pestana.getAttribute('aria-controls')).toBe('lista-de-solicitudes');
    }
  });

  it('solo la pestaña activa está seleccionada y entra en el orden de tabulación', () => {
    expect(pestanas().map(p => p.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(pestanas().map(p => p.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('el conteo es un numeral junto al rótulo, no una píldora; una pestaña sin conteo no lo pinta', () => {
    expect(pestanas()[0].querySelector('.pestana__conteo')?.textContent).toBe('12');
    expect(pestanas()[2].querySelector('.pestana__conteo')).toBeNull();
  });

  it('un clic activa la pestaña', () => {
    pestanas()[1].click();
    fixture.detectChanges();
    expect(anfitrion.elegida()).toBe('resueltas');
    expect(pestanas()[1].getAttribute('aria-selected')).toBe('true');
  });

  it('las flechas se mueven y activan, con vuelta al extremo; Inicio y Fin saltan a los extremos', () => {
    const teclear = (indice: number, tecla: string) => {
      pestanas()[indice].dispatchEvent(new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };

    teclear(0, 'ArrowRight');
    expect(anfitrion.elegida()).toBe('resueltas');
    expect(document.activeElement).toBe(pestanas()[1]);

    teclear(1, 'End');
    expect(anfitrion.elegida()).toBe('todas');

    teclear(2, 'ArrowRight');
    expect(anfitrion.elegida()).toBe('pendientes');

    teclear(0, 'ArrowLeft');
    expect(anfitrion.elegida()).toBe('todas');

    teclear(2, 'Home');
    expect(anfitrion.elegida()).toBe('pendientes');
  });

  it('otra tecla no cambia nada', () => {
    pestanas()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(anfitrion.elegida()).toBe('pendientes');
  });
});
