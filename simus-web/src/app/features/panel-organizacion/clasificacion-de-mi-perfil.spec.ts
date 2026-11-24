import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminService } from '../../core/services/admin.service';
import { DirectorioDePersonasService, MiClasificacion } from '../../core/services/directorio-de-personas.service';
import { ClasificacionDeMiPerfilComponent } from './clasificacion-de-mi-perfil.component';

describe('ClasificacionDeMiPerfilComponent', () => {
  const v = (codigo: string, nombre: string) => ({ codigo, nombre, grupoSoyCultura: null, fuente: null });
  const TAXONOMIA = {
    roles: [v('docente', 'Docente'), v('luthier', 'Lutier')], servicios: [v('clases', 'Clases')], instrumentos: [v('voz', 'Voz')],
    maximoDeRoles: 1, maximoDeServicios: 8, maximoDeInstrumentos: 8, maximoDeTerritorios: 10,
  };

  function montar(mia: MiClasificacion) {
    const servicio = jasmine.createSpyObj<DirectorioDePersonasService>('s', ['taxonomia', 'mia', 'guardar']);
    servicio.taxonomia.and.returnValue(of(TAXONOMIA));
    servicio.mia.and.returnValue(of(mia));
    servicio.guardar.and.callFake(c => of({ ...mia, ...c, pendiente: false }));
    TestBed.configureTestingModule({ imports: [ClasificacionDeMiPerfilComponent], providers: [
      { provide: DirectorioDePersonasService, useValue: servicio },
      { provide: AdminService, useValue: { cargarDivipolaPublica: () => of([{ departmentCode: '19', departmentName: 'Cauca', municipalityCode: '19001', municipalityName: 'Popayán' }]) } },
    ] });
    const fixture = TestBed.createComponent(ClasificacionDeMiPerfilComponent);
    fixture.detectChanges();
    return { fixture, servicio, el: fixture.nativeElement as HTMLElement };
  }

  it('sin categorías dice «pendiente de completar»', () => {
    const { el } = montar({ existe: true, roles: [], servicios: [], instrumentos: [], codigosDeDepartamento: [], pendiente: true });
    expect(el.querySelector('[data-pendiente]')).not.toBeNull();
  });

  it('guarda lo elegido con la pieza común y avisa', () => {
    const { fixture, servicio, el } = montar({ existe: true, roles: [], servicios: [], instrumentos: [], codigosDeDepartamento: [], pendiente: true });
    const c = fixture.componentInstance;
    c.elegido.set({ roles: ['docente'], servicios: [], instrumentos: [], codigosDeDepartamento: ['19'] });
    c.guardar();
    fixture.detectChanges();
    expect(servicio.guardar).toHaveBeenCalledWith({ roles: ['docente'], servicios: [], instrumentos: [], codigosDeDepartamento: ['19'] });
    expect(el.querySelector('[data-aviso-clasificacion]')!.textContent).toContain('guardadas');
  });

  it('sin perfil guardado no deja guardar', () => {
    const { el } = montar({ existe: false, roles: [], servicios: [], instrumentos: [], codigosDeDepartamento: [], pendiente: true });
    expect((el.querySelector('[data-guardar-clasificacion]') as HTMLButtonElement).disabled).toBeTrue();
  });
});
