import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { DirectorioDePersonasService, PerfilesSimilares, PersonaDelDirectorio } from '../../../core/services/directorio-de-personas.service';
import { PerfilesSimilaresComponent } from './perfiles-similares.component';

describe('PerfilesSimilaresComponent', () => {
  const persona = (clave: string, nombre: string, extra: Partial<PersonaDelDirectorio> = {}): PersonaDelDirectorio => ({
    clave, nombreVisible: nombre, fotoUrl: null, biografiaCorta: null, municipio: 'Cali', departamento: 'Valle del Cauca',
    roles: [], servicios: [], instrumentos: [], practicas: [], territorios: [], completo: true, ...extra,
  });
  const DATOS: PerfilesSimilares = {
    persona: persona('a', 'Ana', { servicios: ['clases'] }),
    criterio: 'Personas con perfil público que comparten con esta al menos un servicio.',
    similares: [{ persona: persona('b', 'Beto'), coincidencias: ['Clases y formación musical'] }],
  };

  function montar(similares: ReturnType<DirectorioDePersonasService['similares']>) {
    TestBed.configureTestingModule({
      imports: [PerfilesSimilaresComponent],
      providers: [provideRouter([]), { provide: DirectorioDePersonasService, useValue: {
        similares: () => similares,
        taxonomia: () => of({ roles: [], servicios: [{ codigo: 'clases', nombre: 'Clases y formación musical', grupoSoyCultura: null, fuente: null }], instrumentos: [], maximoDeRoles: 6, maximoDeServicios: 8, maximoDeInstrumentos: 8, maximoDeTerritorios: 10 }),
      } }],
    });
    const fixture = TestBed.createComponent(PerfilesSimilaresComponent);
    fixture.componentRef.setInput('clave', 'a');
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lista a las personas similares con enlace, en qué coinciden y el criterio', () => {
    const el = montar(of(DATOS));
    const similares = el.querySelectorAll('[data-similar]');
    expect(similares.length).toBe(1);
    expect(similares[0].querySelector('a')!.getAttribute('href')).toBe('/ecosistema/personas/b');
    expect(similares[0].textContent).toContain('Coincide en: Clases y formación musical');
    expect(el.querySelector('[data-criterio]')!.textContent).toContain('comparten');
    expect(el.textContent).toContain('Servicios que ofrece');
  });

  it('sin similares lo dice; una persona sin categorías queda pendiente de completar', () => {
    const el = montar(of({ ...DATOS, persona: persona('a', 'Ana', { completo: false }), similares: [] }));
    expect(el.querySelector('[data-sin-similares]')).not.toBeNull();
    expect(el.querySelector('[data-pendiente]')).not.toBeNull();
  });

  it('un fallo se dice', () => {
    const el = montar(throwError(() => new Error('x')) as ReturnType<DirectorioDePersonasService['similares']>);
    expect(el.querySelector('[role=alert]')!.textContent).toContain('No fue posible');
  });

  it('si la clave cambia vuelve a pedir los similares de la nueva persona', () => {
    const pedidas: string[] = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DirectorioDePersonasService, useValue: {
        taxonomia: () => of({ roles: [], servicios: [], instrumentos: [], maximoDeRoles: 6, maximoDeServicios: 8, maximoDeInstrumentos: 8, maximoDeTerritorios: 10 }),
        similares: (clave: string) => { pedidas.push(clave); return of({ ...DATOS, persona: persona(clave, clave), similares: [{ persona: persona('x' + clave, `Similar de ${clave}`), coincidencias: ['Clases'] }] }); },
      } }],
    });
    const fixture = TestBed.createComponent(PerfilesSimilaresComponent);
    fixture.componentRef.setInput('clave', 'a');
    fixture.detectChanges();
    TestBed.tick();
    fixture.componentRef.setInput('clave', 'b');
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    expect(pedidas).toEqual(['a', 'b']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Similar de b');
  });
});
