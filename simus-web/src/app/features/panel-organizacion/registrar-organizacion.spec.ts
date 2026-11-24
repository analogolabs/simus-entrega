import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ExternalSessionService, SesionExterna } from '../../core/services/external-session.service';
import { RegistrarOrganizacionComponent } from './registrar-organizacion.component';

const UBICACIONES = [
  { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05001', municipalityName: 'Medellín' },
  { departmentCode: '11', departmentName: 'Bogotá, D. C.', municipalityCode: '11001', municipalityName: 'Bogotá, D. C.' },
];

describe('RegistrarOrganizacionComponent (#40)', () => {
  const interna = signal<SesionExterna | null>({
    userId: '9', fullName: 'Ana Restrepo', email: 'ana@fmv.org', accountStatus: 'activa',
    organizations: [{ id: '117', name: 'Fundación Musical del Valle', role: 'administrador' }],
  });
  let crear: jasmine.Spy;
  let refrescar: jasmine.Spy;

  beforeEach(() => {
    crear = jasmine.createSpy('crearOrganizacionExterna').and.returnValue(of({ id: '500', name: 'Corporación Tambó' }));
    refrescar = jasmine.createSpy('refrescar').and.callFake(() => {
      interna.update(s => s && ({ ...s, organizations: [...s.organizations, { id: '500', name: 'Corporación Tambó', role: 'administrador' }] }));
      return of(interna());
    });
    TestBed.configureTestingModule({
      imports: [RegistrarOrganizacionComponent],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: { cargarDivipolaPublica: () => of(UBICACIONES), crearOrganizacionExterna: crear } },
        { provide: ExternalSessionService, useValue: { actual: interna.asReadonly(), organizaciones: computed(() => interna()?.organizations ?? []), refrescar } },
      ],
    });
  });

  function montar() {
    const fixture = TestBed.createComponent(RegistrarOrganizacionComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('no propone el correo personal y exige nombre, correo y sede antes de enviar', () => {
    const fixture = montar();
    const c = fixture.componentInstance;
    // EL CORREO PERSONAL SE RECHAZABA si ya lo usaba otra organización: el error era evitable.
    expect(c.formulario.contactEmail).toBe('');

    c.registrar();
    fixture.detectChanges();

    expect(crear).not.toHaveBeenCalled();
    expect(Object.keys(c.errores())).toEqual(['name', 'contactEmail', 'headquartersDepartmentCode', 'headquartersMunicipalityCode']);
    expect(fixture.nativeElement.querySelector('#nueva-org-name').getAttribute('aria-invalid')).toBe('true');
  });

  it('crea la organización, refresca la sesión y abre su panel con la confirmación', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    const c = montar().componentInstance;
    c.formulario.name = ' Corporación Tambó ';
    c.formulario.contactEmail = 'contacto@tambo.org';
    c.elegirDepartamento('11');
    c.formulario.headquartersMunicipalityCode = '11001';

    c.registrar();

    expect(crear).toHaveBeenCalledWith({
      name: 'Corporación Tambó', identificationNumber: null, contactEmail: 'contacto@tambo.org',
      headquartersDepartmentCode: '11', headquartersMunicipalityCode: '11001',
    });
    expect(refrescar).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/gestion/o', '500', 'resumen'], { queryParams: { registrada: '1' } });
  });

  it('pone junto a cada campo el error que devuelve el servidor', () => {
    crear.and.returnValue(throwError(() => ({ message: 'Revisa los datos.', payload: { errors: { ContactEmail: ['Ya existe una organización con ese correo.'] } } })));
    const c = montar().componentInstance;
    c.formulario.name = 'Corporación Tambó';
    c.formulario.contactEmail = 'ana@fmv.org';
    c.elegirDepartamento('05');
    c.formulario.headquartersMunicipalityCode = '05001';

    c.registrar();

    expect(c.errores()['contactEmail']).toBe('Ya existe una organización con ese correo.');
    expect(c.error()).toBe('Revisa los campos marcados.');
    expect(c.guardando()).toBeFalse();
  });
});
