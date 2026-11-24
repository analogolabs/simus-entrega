import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChipDeFiltroComponent } from './chip-de-filtro.component';

@Component({
  standalone: true,
  imports: [ChipDeFiltroComponent],
  template: `
    <app-chip-de-filtro rotulo="Territorio" valor="Casanare" (quitar)="quitados = quitados + 1" />
    <app-chip-de-filtro valor="Solo publicados" (quitar)="quitados = quitados + 1" />
  `,
})
class Anfitrion { quitados = 0; }

describe('ChipDeFiltroComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  const botones = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  it('quitar es un botón con nombre, que dice qué filtro se quita', () => {
    expect(botones()[0].getAttribute('aria-label')).toBe('Quitar filtro Territorio: Casanare');
    expect(botones()[1].getAttribute('aria-label')).toBe('Quitar filtro Solo publicados');
    expect(botones()[0].getAttribute('type')).toBe('button');
  });

  it('un clic en la «✕» avisa para quitarlo', () => {
    botones()[0].click();
    expect(fixture.componentInstance.quitados).toBe(1);
  });

  it('el rótulo es opcional', () => {
    const chips = (fixture.nativeElement as HTMLElement).querySelectorAll('.chip');
    expect(chips[0].querySelector('.chip__rotulo')?.textContent).toContain('Territorio');
    expect(chips[1].querySelector('.chip__rotulo')).toBeNull();
  });
});
