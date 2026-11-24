import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PersonaDelDirectorio } from '../../../core/services/directorio-de-personas.service';
import { TarjetaDePersonaComponent, inicialesDe, tonoDe } from './tarjeta-de-persona.component';

const persona = (cambios: Partial<PersonaDelDirectorio> = {}): PersonaDelDirectorio => ({
  clave: '11111111-1111-1111-1111-111111111111', nombreVisible: 'Ana Lucía Mora', fotoUrl: null, biografiaCorta: 'Construye tiples.',
  municipio: 'Bogotá', departamento: 'Bogotá D.C.', roles: ['luthier'], servicios: [], instrumentos: [], practicas: [], territorios: [], completo: true, ...cambios,
});

describe('TarjetaDePersonaComponent', () => {
  let fixture: ComponentFixture<TarjetaDePersonaComponent>;

  function montar(p: PersonaDelDirectorio, modo: 'mosaico' | 'lista', etiquetas: string[] = []) {
    fixture = TestBed.createComponent(TarjetaDePersonaComponent);
    fixture.componentRef.setInput('persona', p);
    fixture.componentRef.setInput('modo', modo);
    fixture.componentRef.setInput('contexto', 'Luthier');
    fixture.componentRef.setInput('etiquetas', etiquetas);
    fixture.componentRef.setInput('lugar', 'Bogotá, Bogotá D.C.');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [TarjetaDePersonaComponent], providers: [provideRouter([])] }));

  it('las iniciales toman la primera y la última palabra', () => {
    expect(inicialesDe('Ana Lucía Mora')).toBe('AM');
    expect(inicialesDe('Cantaclaro')).toBe('C');
    expect(inicialesDe('  ')).toBe('?');
  });

  it('el tono es estable para un mismo nombre', () => {
    expect(tonoDe('Ana')).toBe(tonoDe('Ana'));
  });

  it('sin foto muestra las iniciales y el enlace a la ficha', () => {
    const el = montar(persona(), 'mosaico');
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-iniciales]')?.textContent?.trim()).toBe('AM');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/ecosistema/personas/11111111-1111-1111-1111-111111111111');
  });

  it('con foto la pinta con texto alternativo y vuelve a las iniciales si falla', () => {
    const el = montar(persona({ fotoUrl: '/api/v1/publico/archivos/9' }), 'lista');
    const img = el.querySelector('img') as HTMLImageElement;
    expect(img.alt).toBe('Foto de Ana Lucía Mora');
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-iniciales]')).not.toBeNull();
  });

  it('en mosaico resume las etiquetas con «+n» y marca el perfil por completar', () => {
    const el = montar(persona({ completo: false }), 'mosaico', ['Clases', 'Lutería', 'Tiple', 'Guitarra', 'Cuatro']);
    expect(el.textContent).toContain('+2');
    expect(el.textContent).toContain('Perfil por completar');
    expect(el.textContent).not.toContain('Cuatro');
  });
});
