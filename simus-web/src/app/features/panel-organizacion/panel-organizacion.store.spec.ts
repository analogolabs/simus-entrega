import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExternalSessionService, OrganizacionDeSesion } from '../../core/services/external-session.service';
import { PanelOrganizacionStore } from './panel-organizacion.store';

/**
 * El rol de la organización abierta, una sola vez para todo el panel.
 */
describe('PanelOrganizacionStore · rol', () => {
  const organizaciones = signal<OrganizacionDeSesion[]>([]);
  let store: PanelOrganizacionStore;

  beforeEach(() => {
    organizaciones.set([
      { id: '1', name: 'Administrada', role: 'administrador' },
      { id: '2', name: 'Editada', role: 'editor' },
    ]);
    TestBed.configureTestingModule({
      providers: [
        PanelOrganizacionStore,
        { provide: ExternalSessionService, useValue: { organizaciones: computed(() => organizaciones()) } },
      ],
    });
    store = TestBed.inject(PanelOrganizacionStore);
    TestBed.tick();
  });

  it('no elige ninguna organización por su cuenta: la fija el armazón con la de la URL', () => {
    // Antes elegía la primera al entrar, y recargar o abrir un enlace volvía siempre a ella.
    expect(store.organizacionId()).toBe('');
    expect(store.rol()).toBe('');
  });

  it('sigue a la organización abierta: administra una y edita la otra', () => {
    store.organizacionId.set('1');
    expect(store.rol()).toBe('administrador');
    expect(store.esAdministradora()).toBeTrue();

    store.organizacionId.set('2');
    expect(store.rol()).toBe('editor');
    expect(store.esAdministradora()).toBeFalse();
  });

  it('sabe de qué organizaciones es miembro la cuenta, según la sesión', () => {
    expect(store.esMiembroDe('1')).toBeTrue();
    expect(store.esMiembroDe('99')).toBeFalse();
    expect(store.esMiembroDe('')).toBeFalse();
  });

  it('un rol desconocido o ausente no se trata como administración', () => {
    organizaciones.set([{ id: '3', name: 'Sin rol', role: '' }]);
    store.organizacionId.set('3');
    expect(store.esAdministradora()).toBeFalse();
  });

  it('sin organizaciones no hay rol', () => {
    organizaciones.set([]);
    TestBed.tick();
    expect(store.rol()).toBe('');
    expect(store.esAdministradora()).toBeFalse();
  });
});
