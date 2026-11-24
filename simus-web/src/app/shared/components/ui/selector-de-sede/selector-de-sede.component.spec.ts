import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UbicacionDivipola } from '../../../../core/territorio/ubicacion-divipola';
import { SedeElegida, SelectorDeSedeComponent } from './selector-de-sede.component';

const UBICACIONES: UbicacionDivipola[] = [
  { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05001', municipalityName: 'Medellín' },
  { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05045', municipalityName: 'Apartadó' },
  { departmentCode: '76', departmentName: 'Valle del Cauca', municipalityCode: '76001', municipalityName: 'Cali' },
];

@Component({
  standalone: true,
  imports: [SelectorDeSedeComponent],
  template: `<app-selector-de-sede [ubicaciones]="ubicaciones" [departamento]="departamento()" [municipio]="municipio()"
    [errorMunicipio]="errorMunicipio()" idBase="prueba" (cambiar)="alCambiar($event)" />`,
})
class AnfitrionComponent {
  readonly ubicaciones = UBICACIONES;
  readonly departamento = signal('');
  readonly municipio = signal('');
  readonly errorMunicipio = signal<string | null>(null);
  emitido: SedeElegida | null = null;
  alCambiar(sede: SedeElegida): void { this.emitido = sede; this.departamento.set(sede.departamento); this.municipio.set(sede.municipio); }
}

describe('SelectorDeSedeComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let selector: SelectorDeSedeComponent;
  let anfitrion: AnfitrionComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionComponent);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
    selector = fixture.debugElement.children[0].componentInstance as SelectorDeSedeComponent;
  });

  it('ofrece los departamentos y ningún municipio hasta elegir departamento', () => {
    expect(selector.departamentos().map(d => d.nombre)).toEqual(['Antioquia', 'Valle del Cauca']);
    expect(selector.municipios()).toEqual([]);
  });

  it('deshabilita el municipio hasta que hay departamento y lo dice', () => {
    const controles = (fixture.nativeElement as HTMLElement).querySelectorAll('app-filtro-desplegable');
    expect(controles.length).toBe(2);
    const botones = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button[role="combobox"], button');
    const municipio = [...botones].find(b => b.id === 'prueba-sede-municipio');
    expect(municipio?.disabled).toBeTrue();
    expect(municipio?.textContent).toContain('Elige un departamento primero');
  });

  it('al elegir un departamento ofrece solo sus municipios y emite con el municipio vacío', () => {
    selector.elegirDepartamento('05');
    fixture.detectChanges();
    expect(anfitrion.emitido).toEqual({ departamento: '05', municipio: '' });
    expect(selector.municipios().map(m => m.municipalityName)).toEqual(['Apartadó', 'Medellín']);
  });

  it('al cambiar de departamento vacía el municipio', () => {
    anfitrion.departamento.set('05');
    anfitrion.municipio.set('05001');
    fixture.detectChanges();
    selector.elegirDepartamento('76');
    expect(anfitrion.emitido).toEqual({ departamento: '76', municipio: '' });
  });

  it('emite el municipio elegido junto al departamento', () => {
    anfitrion.departamento.set('76');
    fixture.detectChanges();
    selector.elegirMunicipio('76001');
    expect(anfitrion.emitido).toEqual({ departamento: '76', municipio: '76001' });
  });

  it('pinta el error del municipio bajo el campo', () => {
    anfitrion.errorMunicipio.set('Elige el municipio de la sede principal.');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Elige el municipio de la sede principal.');
  });
});
