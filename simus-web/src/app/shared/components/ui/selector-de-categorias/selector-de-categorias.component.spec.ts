import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DirectorioDePersonasService, TaxonomiaDePerfiles, rolesElegibles } from '../../../../core/services/directorio-de-personas.service';
import { CATEGORIAS_VACIAS, SelectorDeCategoriasComponent } from './selector-de-categorias.component';

describe('SelectorDeCategoriasComponent', () => {
  const v = (codigo: string, nombre: string) => ({ codigo, nombre, grupoSoyCultura: null, fuente: null });
  const TAXONOMIA = {
    roles: [v('docente', 'Docente'), v('luthier', 'Lutier')], servicios: [v('clases', 'Clases')], instrumentos: [v('voz', 'Voz')],
    maximoDeRoles: 1, maximoDeServicios: 8, maximoDeInstrumentos: 8, maximoDeTerritorios: 10,
  };

  function montar() {
    TestBed.configureTestingModule({ imports: [SelectorDeCategoriasComponent], providers: [
      { provide: DirectorioDePersonasService, useValue: { taxonomia: () => of(TAXONOMIA) } },
    ] });
    const fixture = TestBed.createComponent(SelectorDeCategoriasComponent);
    fixture.componentRef.setInput('departamentos', [{ codigo: '19', nombre: 'Cauca' }]);
    fixture.componentRef.setInput('valor', CATEGORIAS_VACIAS);
    fixture.detectChanges();
    return fixture;
  }

  it('pinta los cuatro selectores múltiples', () => {
    const fixture = montar();
    expect(fixture.nativeElement.querySelectorAll('app-selector-multiple').length).toBe(4);
  });

  it('marca y desmarca, respeta el máximo y lo dice', () => {
    const fixture = montar();
    const c = fixture.componentInstance;
    c.alternar('roles', TAXONOMIA.roles, 1, 1);
    c.alternar('roles', TAXONOMIA.roles, 2, 1);
    expect(c.valor().roles).toEqual(['docente']);
    expect(c.aviso()).toContain('máximo 1');
    c.alternar('roles', TAXONOMIA.roles, 1, 1);
    expect(c.valor().roles).toEqual([]);
    c.alternarDepartamento(1, 10);
    expect(c.valor().codigosDeDepartamento).toEqual(['19']);
  });

  describe('roles en categorías y subcategorías (decisión 135)', () => {
    const h = (codigo: string, nombre: string, padre: string, activo = true) => ({ ...v(codigo, nombre), padre, activo });
    const ARBOL: TaxonomiaDePerfiles = {
      ...TAXONOMIA,
      roles: [],
      rolesPorCategoria: [
        { codigo: 'creacion', nombre: 'Creación', grupoSoyCultura: 'creador', fuente: null, activo: true,
          subcategorias: [h('interprete', 'Intérprete', 'creacion'), h('cantante', 'Cantante', 'creacion', false)] },
        { codigo: 'formacion', nombre: 'Formación', grupoSoyCultura: 'otro', fuente: null, activo: false,
          subcategorias: [h('docente', 'Docente', 'formacion')] },
        { codigo: 'gestor', nombre: 'Gestor(a) cultural', grupoSoyCultura: 'gestor', fuente: null, activo: true, subcategorias: [] },
      ],
      maximoDeRoles: 6,
    };

    it('ofrece subcategorías agrupadas, la categoría sin hijas suelta y nada de una categoría desactivada', () => {
      const ofrecidos = rolesElegibles(ARBOL, []);
      expect(ofrecidos.map(r => [r.codigo, r.categoria])).toEqual([['interprete', 'Creación'], ['gestor', null]]);
    });

    it('conserva lo que la persona ya tenía aunque esté desactivado', () => {
      const ofrecidos = rolesElegibles(ARBOL, ['cantante', 'docente']);
      expect(ofrecidos.map(r => r.codigo)).toEqual(['interprete', 'cantante', 'docente', 'gestor']);
    });

    it('pinta el título de cada categoría y permite elegir varias subcategorías', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [SelectorDeCategoriasComponent], providers: [
        { provide: DirectorioDePersonasService, useValue: { taxonomia: () => of({ ...ARBOL, rolesPorCategoria: [
          { ...ARBOL.rolesPorCategoria![0], subcategorias: [h('interprete', 'Intérprete', 'creacion'), h('cantante', 'Cantante', 'creacion')] },
          { ...ARBOL.rolesPorCategoria![2] },
        ] }) } },
      ] });
      const fixture = TestBed.createComponent(SelectorDeCategoriasComponent);
      fixture.componentRef.setInput('valor', CATEGORIAS_VACIAS);
      fixture.detectChanges();
      const c = fixture.componentInstance;
      const opciones = c.opciones(c.roles(c.taxonomia()!));
      expect(opciones.map(o => o.grupo)).toEqual(['Creación', 'Creación', null]);
      c.alternar('roles', c.roles(c.taxonomia()!), 1, 6);
      c.alternar('roles', c.roles(c.taxonomia()!), 3, 6);
      expect(c.valor().roles).toEqual(['interprete', 'gestor']);
    });
  });
});
