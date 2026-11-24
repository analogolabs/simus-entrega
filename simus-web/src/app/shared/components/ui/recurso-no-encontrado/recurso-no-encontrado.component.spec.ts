import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RecursoNoEncontradoComponent } from './recurso-no-encontrado.component';

@Component({
  standalone: true,
  imports: [RecursoNoEncontradoComponent],
  template: `<app-recurso-no-encontrado titulo="Esta noticia no está publicada" etiquetaDeLista="Ver todas las noticias" rutaDeLista="/noticias" />`,
})
class AnfitrionComponent {}

/**
 *, L8): un solo «no encontrado» para los recursos del portal. Título que nombra lo
 * buscado, causa probable y dos salidas: la lista de la que cuelga y el inicio.
 */
describe('RecursoNoEncontradoComponent', () => {
  it('nombra lo buscado, dice la causa probable y ofrece la lista y el inicio como enlaces', () => {
    TestBed.configureTestingModule({ imports: [AnfitrionComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('h1')?.textContent?.trim()).toBe('Esta noticia no está publicada');
    expect(raiz.textContent).toContain('la publicación se haya retirado');
    const lista = raiz.querySelector<HTMLAnchorElement>('[data-testid="rne-lista"]')!;
    const inicio = raiz.querySelector<HTMLAnchorElement>('[data-testid="rne-inicio"]')!;
    expect(lista.tagName).toBe('A');
    expect(lista.getAttribute('href')).toBe('/noticias');
    expect(lista.textContent?.trim()).toBe('Ver todas las noticias');
    expect(inicio.getAttribute('href')).toBe('/');
    // Se anuncia como estado y el título es el encabezado de la sección.
    expect(raiz.querySelector('section')?.getAttribute('role')).toBe('status');
    expect(raiz.querySelector('section')?.getAttribute('aria-labelledby')).toBe(raiz.querySelector('h1')?.id);
  });
});
