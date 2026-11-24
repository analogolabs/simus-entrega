import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ExternalSessionService, SesionExterna } from '../services/external-session.service';
import { ContextoDeOrganizacionService } from '../services/contexto-de-organizacion.service';
import { organizacionPropiaGuard } from './organizacion-propia.guard';

@Component({ standalone: true, template: 'Pantalla' })
class PantallaComponent {}

const SESION: SesionExterna = {
  userId: '9', fullName: 'Ana Restrepo', email: 'ana@fmv.org', accountStatus: 'activa',
  organizations: [{ id: '117', name: 'Fundación Musical del Valle', role: 'administrador' }],
};

const RUTAS: Routes = [{
  path: 'gestion/o/:organizacionId',
  canActivate: [organizacionPropiaGuard],
  children: [{ path: '**', component: PantallaComponent }],
}];

describe('organizacionPropiaGuard: /gestion/o/:id solo para quien es miembro', () => {
  const sesion = signal<SesionExterna | null>(SESION);
  const CLAVE = 'simus.gestion.ultimaOrganizacion.9';
  const MODO = 'simus.gestion.ultimoModo.9';

  beforeEach(() => {
    sesion.set(SESION);
    localStorage.removeItem(CLAVE);
    localStorage.removeItem(MODO);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(RUTAS),
        {
          provide: ExternalSessionService,
          useValue: { actual: sesion.asReadonly(), organizaciones: computed(() => sesion()?.organizations ?? []), dentro: () => sesion() !== null },
        },
      ],
    });
  });

  it('deja abrir una organización propia sin tocar lo recordado', async () => {
    localStorage.setItem(CLAVE, '117');
    await RouterTestingHarness.create('/gestion/o/117/resumen');
    expect(TestBed.inject(ContextoDeOrganizacionService).organizacionId()).toBe('117');
    expect(localStorage.getItem(CLAVE)).toBe('117');
  });

  it('con una organización ajena que era la «última» guardada, la olvida (y el modo recordado)', async () => {
    localStorage.setItem(CLAVE, '555');
    localStorage.setItem(MODO, '555');
    await RouterTestingHarness.create('/gestion/o/555/resumen');
    expect(localStorage.getItem(CLAVE)).toBeNull();
    expect(localStorage.getItem(MODO)).toBeNull();
  });

  it('con una organización ajena no borra la última guardada que sí es válida', async () => {
    localStorage.setItem(CLAVE, '117');
    await RouterTestingHarness.create('/gestion/o/555/resumen');
    expect(localStorage.getItem(CLAVE)).toBe('117');
  });

  it('porDefecto() limpia una «última organización» que ya no es de la cuenta y cae a la primera', () => {
    localStorage.setItem(CLAVE, '777');
    const contexto = TestBed.inject(ContextoDeOrganizacionService);
    expect(contexto.porDefecto()?.id).toBe('117');
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });
});
