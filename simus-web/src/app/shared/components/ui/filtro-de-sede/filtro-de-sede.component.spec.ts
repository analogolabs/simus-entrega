import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CatalogService } from '../../../../core/services/catalog.service';
import { FiltroDeSede, FiltroDeSedeComponent, SIN_FILTRO_DE_SEDE } from './filtro-de-sede.component';

const DIVIPOLA = [
  { codigo: '52', nombre: 'Nariño', municipios: [{ codigo: '52001', nombre: 'Pasto' }, { codigo: '52356', nombre: 'Ipiales' }] },
  { codigo: '41', nombre: 'Huila', municipios: [{ codigo: '41001', nombre: 'Neiva' }] },
];

@Component({
  standalone: true,
  imports: [FiltroDeSedeComponent],
  template: `<app-filtro-de-sede [departamento]="sede.departamento" [municipio]="sede.municipio"
    [pendiente]="sede.pendiente" (cambiar)="elegida = $event" />`,
})
class AnfitrionComponent {
  sede: FiltroDeSede = SIN_FILTRO_DE_SEDE;
  elegida: FiltroDeSede | null = null;
}

/**
 * El filtro por sede de la consola (decisión 124): departamento primero, municipio deshabilitado hasta
 * elegirlo, «Pendiente de completar» entre los departamentos, y al cambiar de departamento el municipio se vacía.
 */
describe('FiltroDeSedeComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;
  let filtro: FiltroDeSedeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnfitrionComponent],
      providers: [{ provide: CatalogService, useValue: { fetchDivipolaConCodigos: () => of(DIVIPOLA) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    filtro = fixture.debugElement.query(el => el.componentInstance instanceof FiltroDeSedeComponent).componentInstance;
  });

  it('ofrece todos los departamentos y «Pendiente de completar»', () => {
    const etiquetas = filtro.opcionesDeDepartamento().map(o => o.etiqueta);
    expect(etiquetas.slice(0, 2)).toEqual(['Todos los departamentos', 'Pendiente de completar']);
    expect(etiquetas).toContain('Huila');
    expect(etiquetas).toContain('Nariño');
  });

  it('deja el municipio deshabilitado hasta elegir un departamento', () => {
    const botones = (fixture.nativeElement as HTMLElement).querySelectorAll('app-filtro-desplegable button');
    expect(botones[1].hasAttribute('disabled')).toBe(true);
    expect(filtro.opcionesDeMunicipio().map(o => o.etiqueta)).toEqual(['Elige un departamento primero']);
  });

  it('con un departamento ofrece solo sus municipios y emite la sede', () => {
    fixture.componentInstance.sede = { departamento: '52', municipio: '', pendiente: false };
    fixture.detectChanges();
    expect(filtro.opcionesDeMunicipio().map(o => o.etiqueta)).toEqual(['Todos los municipios', 'Ipiales', 'Pasto']);

    filtro.elegirMunicipio('52001');
    expect(fixture.componentInstance.elegida).toEqual({ departamento: '52', municipio: '52001', pendiente: false });
  });

  it('cambiar de departamento vacía el municipio y «pendiente» se emite aparte', () => {
    fixture.componentInstance.sede = { departamento: '52', municipio: '52001', pendiente: false };
    fixture.detectChanges();
    filtro.elegirDepartamento('41');
    expect(fixture.componentInstance.elegida).toEqual({ departamento: '41', municipio: '', pendiente: false });

    filtro.elegirDepartamento('__pendiente__');
    expect(fixture.componentInstance.elegida).toEqual({ departamento: '', municipio: '', pendiente: true });
  });
});
