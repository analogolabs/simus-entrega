import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsistenteDeAltaComponent } from './asistente-de-alta.component';
import { PASOS_DE_UN_ALTA } from '../../../../core/vocabularios/pasos-de-un-alta';

@Component({
  standalone: true,
  imports: [AsistenteDeAltaComponent],
  template: `
    <app-asistente-de-alta
      antetitulo="Ecosistema musical"
      titulo="Registrar mercado musical"
      proposito="Lo incorpora el PNMC."
      [pasos]="pasos"
      [(paso)]="paso"
      [loQueFalta]="loQueFalta()"
      [loQueFaltaPorPaso]="porPaso()"
      verbo="Registrar mercado"
      identificador="registrar-mercado"
      (registrar)="registros = registros + 1"
      (cancelar)="cancelaciones = cancelaciones + 1">
      <p data-paso>Contenido del paso {{ paso() }}</p>
    </app-asistente-de-alta>
  `,
})
class Anfitrion {
  readonly pasos = PASOS_DE_UN_ALTA;
  readonly paso = signal(1);
  readonly loQueFalta = signal<string[]>([]);
  readonly porPaso = signal<Record<number, readonly string[]>>({});
  registros = 0;
  cancelaciones = 0;
}

describe('AsistenteDeAltaComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;

  const raiz = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    [...raiz().querySelectorAll<HTMLButtonElement>('button')].find(b => (b.textContent ?? '').trim() === texto);
  const crear = () => raiz().querySelector<HTMLButtonElement>('[data-testid="registrar-mercado"]');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('en el primer paso no ofrece «Atrás» y todavía no ofrece crear', () => {
    expect(boton('Atrás')).toBeUndefined();
    expect(boton('Siguiente')).toBeDefined();
    expect(crear()).toBeNull();
    expect(raiz().querySelector('[data-paso]')?.textContent).toContain('paso 1');
  });

  it('«Siguiente» y «Atrás» mueven el paso, y la pantalla ve el cambio', () => {
    boton('Siguiente')!.click();
    fixture.detectChanges();

    expect(anfitrion.paso()).toBe(2);
    expect(raiz().querySelector('[data-paso]')?.textContent).toContain('paso 2');

    boton('Atrás')!.click();
    fixture.detectChanges();
    expect(anfitrion.paso()).toBe(1);
  });

  it('en el último paso cambia «Siguiente» por el verbo que crea', () => {
    anfitrion.paso.set(PASOS_DE_UN_ALTA.length);
    fixture.detectChanges();

    expect(boton('Siguiente')).toBeUndefined();
    expect(crear()!.textContent).toContain('Registrar mercado');

    crear()!.click();
    expect(anfitrion.registros).toBe(1);
  });

  it('lo que falta se dice en la revisión, y hasta entonces no se estorba', () => {
    anfitrion.loQueFalta.set(['el nombre', 'la organización responsable']);
    fixture.detectChanges();

    // MUTANTE QUE MATA: enseñarlo en todos los pasos. Quien está en «Qué es» no necesita que le
    // recuerden que falta el territorio, que es lo que va a contestar dos pasos después.
    expect(raiz().textContent).not.toContain('Falta el nombre');

    anfitrion.paso.set(PASOS_DE_UN_ALTA.length);
    fixture.detectChanges();

    expect(raiz().textContent).toContain('Falta el nombre y la organización responsable.');
    expect(crear()!.disabled).toBeTrue();
  });

  it('el indicador deja volver a un paso ya recorrido', () => {
    anfitrion.paso.set(4);
    fixture.detectChanges();

    const segundo = [...raiz().querySelectorAll<HTMLButtonElement>('app-indicador-de-pasos button')][1];
    segundo.click();
    fixture.detectChanges();

    expect(anfitrion.paso()).toBe(2);
  });

  it('es un diálogo modal titulado por su propio título, y Escape pide cerrarlo', () => {
    const dialogo = raiz().querySelector('[role="dialog"]')!;
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(raiz().querySelector(`#${dialogo.getAttribute('aria-labelledby')}`)?.textContent)
      .toContain('Registrar mercado musical');

    dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(anfitrion.cancelaciones).toBe(1);
  });

  // ───────── visitado no es completo, y la revisión dice qué falta con enlace ─────────

  it('sin información por paso se comporta como siempre: los pasos anteriores se pintan completados', () => {
    boton('Siguiente')!.click();
    fixture.detectChanges();

    expect(raiz().querySelector('app-indicador-de-pasos li button svg')).not.toBeNull();
  });

  it('con información por paso, pasar por un paso con algo pendiente lo pinta incompleto, no completo', () => {
    anfitrion.porPaso.set({ 1: ['el nombre'], 2: [] });
    fixture.detectChanges();

    boton('Siguiente')!.click();
    boton('Siguiente')!.click();
    fixture.detectChanges();

    const botones = raiz().querySelectorAll('app-indicador-de-pasos li button');
    expect(botones[0].textContent).toContain('!');
    expect(botones[1].querySelector('svg')).not.toBeNull();
  });

  it('al intentar seguir con algo pendiente en el paso lo dice, sin bloquear', () => {
    anfitrion.porPaso.set({ 1: ['el nombre'] });
    fixture.detectChanges();

    boton('Siguiente')!.click();
    fixture.detectChanges();

    expect(anfitrion.paso()).toBe(2);
    boton('Atrás')!.click();
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid="asistente-falta-del-paso"]')?.textContent).toContain('falta el nombre');
  });

  it('en la revisión lista lo que falta por paso y cada ítem lleva a su paso', () => {
    anfitrion.loQueFalta.set(['el nombre', 'el municipio']);
    anfitrion.porPaso.set({ 1: ['el nombre'], 3: ['el municipio'] });
    anfitrion.paso.set(PASOS_DE_UN_ALTA.length);
    fixture.detectChanges();

    const falta = raiz().querySelector('[data-testid="asistente-falta"]')!;
    expect(falta.textContent).toContain('Falta antes de registrar');
    expect(falta.textContent).toContain('el nombre');
    expect(falta.textContent).toContain('el municipio');

    (falta.querySelectorAll('button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(anfitrion.paso()).toBe(3);
  });
});
