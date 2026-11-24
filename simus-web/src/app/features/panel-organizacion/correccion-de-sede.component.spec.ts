import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { UbicacionDivipola } from '../../core/territorio/ubicacion-divipola';
import { CorreccionDeSedeComponent } from './correccion-de-sede.component';
import { PanelOrganizacionApi } from './panel-organizacion.api';

const UBICACIONES: UbicacionDivipola[] = [
  { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05001', municipalityName: 'Medellín' },
  { departmentCode: '76', departmentName: 'Valle del Cauca', municipalityCode: '76001', municipalityName: 'Cali' },
];

describe('CorreccionDeSedeComponent', () => {
  let fixture: ComponentFixture<CorreccionDeSedeComponent>;
  let componente: CorreccionDeSedeComponent;
  let corregirSede: jasmine.Spy;

  beforeEach(async () => {
    corregirSede = jasmine.createSpy('corregirSede');
    await TestBed.configureTestingModule({
      imports: [CorreccionDeSedeComponent],
      providers: [{ provide: PanelOrganizacionApi, useValue: { corregirSede } }],
    }).compileComponents();
    fixture = TestBed.createComponent(CorreccionDeSedeComponent);
    fixture.componentRef.setInput('tipo', 'festivales');
    fixture.componentRef.setInput('procesoId', '7');
    fixture.componentRef.setInput('ubicaciones', UBICACIONES);
    fixture.componentRef.setInput('sede', null);
    fixture.detectChanges();
    componente = fixture.componentInstance;
  });

  it('no guarda sin elegir nada ni con la sede a medias', () => {
    expect(componente.completa()).toBeFalse();
    componente.elegir({ departamento: '76', municipio: '' });
    expect(componente.completa()).toBeFalse();
    componente.guardar();
    expect(corregirSede).not.toHaveBeenCalled();
  });

  it('guarda la sede elegida como errata y avisa', () => {
    corregirSede.and.returnValue(of({ codigoDepartamento: '76', nombreDepartamento: 'Valle del Cauca', codigoMunicipio: '76001', nombreMunicipio: 'Cali' }));
    let corregida: unknown = null;
    componente.corregida.subscribe(sede => (corregida = sede));
    componente.elegir({ departamento: '76', municipio: '76001' });
    componente.guardar();

    expect(corregirSede).toHaveBeenCalledWith('festivales', '7', { sedeCodigoDepartamento: '76', sedeCodigoMunicipio: '76001' });
    expect(componente.aviso()).toBe('La sede quedó guardada.');
    expect(corregida).not.toBeNull();
  });

  it('pone el error del servidor junto a su campo', () => {
    corregirSede.and.returnValue(throwError(() => ({ message: 'x', payload: { errors: { sedeCodigoMunicipio: ['Ese municipio no pertenece.'] } } })));
    componente.elegir({ departamento: '76', municipio: '76001' });
    componente.guardar();

    expect(componente.errorMunicipio()).toBe('Ese municipio no pertenece.');
    expect(componente.error()).toBe('Revisa la sede.');
  });
});
