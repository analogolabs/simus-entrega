import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConmutadorDeOjoComponent } from './conmutador-de-ojo.component';

@Component({
  standalone: true,
  imports: [ConmutadorDeOjoComponent],
  template: `<app-conmutador-de-ojo identificador="alternar" grupo="Borradores" deQue="los Festivales en borrador"
    [visible]="visible()" (alternar)="visible.set($event)" />`,
})
class Anfitrion { readonly visible = signal(true); }

/** UI-F: el nombre accesible del conmutador contiene el texto visible («Borradores», WCAG 2.5.3). */
describe('el conmutador de ojo', () => {
  it('su nombre accesible empieza por el texto que se ve y dice qué hace', () => {
    const f = TestBed.configureTestingModule({ imports: [Anfitrion] }).createComponent(Anfitrion);
    f.detectChanges();
    const boton = f.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(boton.textContent).toContain('Borradores');
    expect(boton.getAttribute('aria-label')).toBe('Borradores: ocultar los Festivales en borrador');
    f.componentInstance.visible.set(false);
    f.detectChanges();
    expect(boton.getAttribute('aria-label')).toBe('Borradores: mostrar también los Festivales en borrador');
  });
});
