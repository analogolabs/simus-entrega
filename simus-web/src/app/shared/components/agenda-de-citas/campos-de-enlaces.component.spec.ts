import { TestBed } from '@angular/core/testing';

import { CamposDeEnlacesComponent, enlacesDeTexto, esEnlaceHttps, tipoDeEnlace } from './campos-de-enlaces.component';

describe('Los campos de enlaces', () => {
  it('detecta el tipo de cada enlace y exige https', () => {
    expect(tipoDeEnlace('https://open.spotify.com/artist/1')).toBe('Spotify');
    expect(tipoDeEnlace('https://youtu.be/abc')).toBe('YouTube');
    expect(tipoDeEnlace('https://grupo.bandcamp.com')).toBe('Bandcamp');
    expect(tipoDeEnlace('https://soundcloud.com/grupo')).toBe('SoundCloud');
    expect(tipoDeEnlace('https://grupo.test')).toBe('Sitio web');
    expect(esEnlaceHttps('http://grupo.test')).toBeFalse();
    expect(esEnlaceHttps('https://grupo.test')).toBeTrue();
  });

  it('toma hasta cinco enlaces de un texto', () => {
    expect(enlacesDeTexto('a\n\nb\nc\nd\ne\nf')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('muestra un campo por enlace, deja agregar otro hasta cinco y devuelve una línea por enlace', () => {
    const fixture = TestBed.createComponent(CamposDeEnlacesComponent);
    fixture.componentRef.setInput('valor', 'https://youtu.be/abc\nhttps://grupo.bandcamp.com');
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('input').length).toBe(2);
    expect(raiz.textContent).toContain('Enlace 1 · YouTube');
    expect(raiz.textContent).toContain('Enlace 2 · Bandcamp');

    (raiz.querySelector('[data-testid="agregar-enlace"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(raiz.querySelectorAll('input').length).toBe(3);

    const entradas = Array.from(raiz.querySelectorAll('input'));
    entradas[2].value = 'https://open.spotify.com/artist/1';
    entradas[2].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.valor()).toBe('https://youtu.be/abc\nhttps://grupo.bandcamp.com\nhttps://open.spotify.com/artist/1');
  });

  it('avisa cuando un enlace no es https', () => {
    const fixture = TestBed.createComponent(CamposDeEnlacesComponent);
    fixture.componentRef.setInput('valor', 'http://grupo.test');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('empiece por https://');
  });
});
