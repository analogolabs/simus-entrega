import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FichaDePersonaComponent, enlacesDePortafolio } from './ficha-de-persona.component';

describe('La ficha de persona de la agenda', () => {
  let fixture: ComponentFixture<FichaDePersonaComponent>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(FichaDePersonaComponent);
    fixture.componentRef.setInput('nombre', 'Lucía Ramírez');
    fixture.componentRef.setInput('rol', 'Artista');
    fixture.componentRef.setInput('entidad', 'Canta Claro');
    fixture.componentRef.setInput('estado', 'Admitido');
    fixture.componentRef.setInput('tono', 'logrado');
    fixture.componentRef.setInput('sitio', 'Stand 4');
    fixture.componentRef.setInput('portafolio', 'https://www.spotify.com/artista\njavascript:alert(1)\nhttps://youtu.be/x');
    fixture.detectChanges();
  });

  it('muestra la persona con su rol, su agrupación, su estado con palabras y su sitio', () => {
    expect(raiz().querySelector('[data-testid="ficha-nombre"]')?.textContent).toContain('Lucía Ramírez');
    expect(raiz().querySelector('[data-testid="ficha-entidad"]')?.textContent).toContain('Canta Claro');
    expect(raiz().querySelector('[data-testid="ficha-rol"]')?.textContent).toContain('Artista');
    expect(raiz().textContent).toContain('Admitido');
    expect(raiz().querySelector('[data-testid="ficha-sitio"]')?.textContent).toContain('Stand 4');
  });

  it('el portafolio son enlaces seguros: solo http o https, abiertos en otra pestaña y con el sitio como rótulo', () => {
    const enlaces = Array.from(raiz().querySelectorAll<HTMLAnchorElement>('[data-testid="ficha-portafolio"] a'));
    expect(enlaces.map(a => a.textContent?.trim())).toEqual(['spotify.com/artista', 'youtu.be/x']);
    expect(enlaces.every(a => a.rel.includes('noopener') && a.target === '_blank')).toBeTrue();
  });

  it('enlacesDePortafolio descarta lo que no es web y limita a cinco', () => {
    expect(enlacesDePortafolio('ftp://x\nhttps://a.co')).toEqual([{ url: 'https://a.co', rotulo: 'a.co' }]);
    expect(enlacesDePortafolio(Array.from({ length: 8 }, (_, i) => `https://s${i}.co`).join('\n')).length).toBe(5);
    expect(enlacesDePortafolio(null)).toEqual([]);
  });
});
