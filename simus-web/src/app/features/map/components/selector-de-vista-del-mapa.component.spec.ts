import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectorDeVistaDelMapaComponent } from './selector-de-vista-del-mapa.component';

describe('SelectorDeVistaDelMapaComponent', () => {
  let fixture: ComponentFixture<SelectorDeVistaDelMapaComponent>;
  const botones = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectorDeVistaDelMapaComponent);
    fixture.componentRef.setInput('elegida', 'mapa');
    fixture.detectChanges();
  });

  it('son dos iconos con nombre accesible y sin texto visible', () => {
    expect(botones().map((b) => b.getAttribute('aria-label'))).toEqual(['Mapa', 'Gráfico']);
    expect(botones().map((b) => b.getAttribute('title'))).toEqual(['Mapa', 'Gráfico']);
    expect(botones().every((b) => b.textContent!.trim() === '' && !!b.querySelector('svg'))).toBeTrue();
  });

  it('marca la vista puesta con aria-pressed y emite la que se elige', () => {
    expect(botones().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    const elegidas: string[] = [];
    fixture.componentInstance.elegir.subscribe((v) => elegidas.push(v));
    botones()[1].click();
    expect(elegidas).toEqual(['grafico']);
  });
});
