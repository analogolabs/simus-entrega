import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { EtiquetaDeContenido } from '../../../utils/etiquetas';
import { EtiquetasDeContenidoComponent } from './etiquetas-de-contenido.component';

const ETIQUETAS: EtiquetaDeContenido[] = [
  { codigo: 'celebra-la-musica-2026', nombre: 'Celebra la Música 2026', total: 4 },
  { codigo: 'colombia-cumbia', nombre: 'Colombia Cumbia', total: 1 },
];

@Component({
  standalone: true,
  imports: [EtiquetasDeContenidoComponent],
  template: `<app-etiquetas-de-contenido [etiquetas]="etiquetas" ruta="/agenda" [activa]="activa" [interceptar]="interceptar"
    [conConteo]="true" (elegida)="elegidas.push($event)" />`,
})
class Anfitrion {
  etiquetas = ETIQUETAS;
  activa = '';
  interceptar = false;
  elegidas: (string | null)[] = [];
}

describe('EtiquetasDeContenidoComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  const enlaces = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a[data-etiqueta]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  it('muestra cada etiqueta como texto dentro de un enlace rastreable hacia el listado filtrado', () => {
    expect(enlaces().map(a => a.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['#Celebra la Música 2026(4)', '#Colombia Cumbia(1)']);
    expect(enlaces()[0].getAttribute('href')).toContain('/agenda?proyecto=celebra-la-musica-2026');
    expect(enlaces()[0].getAttribute('rel')).toBe('tag');
    expect((fixture.nativeElement as HTMLElement).querySelector('select, [role="listbox"]')).toBeNull();
  });

  it('es un grupo con nombre y los enlaces dicen a dónde llevan', () => {
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Etiquetas');
    expect(enlaces()[1].getAttribute('aria-label')).toBe('Ver todo lo etiquetado con Colombia Cumbia');
  });

  it('sin etiquetas no pinta nada', () => {
    fixture.componentInstance.etiquetas = [];
    fixture.changeDetectorRef.markForCheck();
    fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.etiquetas = [];
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
  });

  it('un clic navega al listado filtrado cuando no se intercepta', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    enlaces()[1].click();
    expect(navegar).toHaveBeenCalledWith('/agenda?proyecto=colombia-cumbia');
  });

  it('con interceptar avisa el código en vez de navegar, y volver a pulsar la activa la quita', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const anfitrion = fixture.componentInstance;
    anfitrion.interceptar = true;
    fixture.detectChanges();
    enlaces()[0].click();
    anfitrion.activa = 'celebra-la-musica-2026';
    fixture.detectChanges();
    expect(enlaces()[0].getAttribute('aria-current')).toBe('true');
    expect(enlaces()[0].getAttribute('href')).not.toContain('proyecto=');
    enlaces()[0].click();
    expect(anfitrion.elegidas).toEqual(['celebra-la-musica-2026', null]);
    expect(navegar).not.toHaveBeenCalled();
  });
});
