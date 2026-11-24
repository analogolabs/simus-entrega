import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { sanitizeArticleContent } from './article-content';

/**
 * PNMC-004 — segunda mitad, la del navegador.
 *
 * La página de noticias pintaba el cuerpo con `[innerHTML]` sobre el resultado de
 * `bypassSecurityTrustHtml(...)`. Ese método no limpia: desactiva el saneador de
 * Angular para esa cadena. Con el saneador del servidor sorteado (ver PNMC-004 en
 * el backend), un `<img onerror=...>` guardado en la base llegaba al navegador del
 * lector sin una sola barrera por el camino.
 *
 * Estas pruebas comprueban dos cosas: que el marcado activo no sobrevive, y —la
 * mitad que suele faltar— que el texto editorial legítimo sí sobrevive. Una función
 * que devolviera siempre cadena vacía pasaría la primera mitad en verde.
 */
describe('sanitizeArticleContent (PNMC-004)', () => {
  let sanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    sanitizer = TestBed.inject(DomSanitizer);
  });

  it('devuelve una cadena ya saneada, no un valor de confianza', () => {
    const result = sanitizeArticleContent(sanitizer, '<p>Hola</p>');

    // `bypassSecurityTrustHtml` devuelve un objeto SafeHtml: si alguien lo
    // reintroduce, esta comprobación se pone roja.
    expect(typeof result).toBe('string');
  });

  it('quita las etiquetas de script', () => {
    const result = sanitizeArticleContent(sanitizer, '<p>ok</p><script>alert(1)</script>');

    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)');
    expect(result).toContain('ok');
  });

  it('quita los atributos de evento', () => {
    const result = sanitizeArticleContent(sanitizer, '<img src="x" onerror="alert(1)">');

    expect(result.toLowerCase()).not.toContain('onerror');
  });

  it('quita los atributos de evento aunque no lleven espacio delante', () => {
    const result = sanitizeArticleContent(sanitizer, '<img/onerror="alert(1)" src="x">');

    expect(result.toLowerCase()).not.toContain('onerror');
  });

  it('neutraliza javascript: en un enlace', () => {
    const result = sanitizeArticleContent(sanitizer, '<a href="javascript:alert(1)">x</a>');

    expect(result).not.toContain('href="javascript:');
  });

  it('neutraliza javascript: escrito con entidades HTML', () => {
    const result = sanitizeArticleContent(sanitizer, '<a href="&#106;avascript:alert(1)">x</a>');

    expect(result).not.toContain('href="javascript:');
  });

  it('quita svg y su onload', () => {
    const result = sanitizeArticleContent(sanitizer, '<svg onload="alert(1)"></svg>');

    expect(result.toLowerCase()).not.toContain('onload');
    expect(result.toLowerCase()).not.toContain('<svg');
  });

  it('quita iframes', () => {
    const result = sanitizeArticleContent(sanitizer, '<iframe src="https://malo.example"></iframe>');

    expect(result.toLowerCase()).not.toContain('<iframe');
  });

  it('conserva el texto enriquecido legítimo', () => {
    const result = sanitizeArticleContent(
      sanitizer,
      '<p>Hola <strong>mundo</strong></p><ul><li>uno</li></ul>'
    );

    expect(result).toContain('<strong>mundo</strong>');
    expect(result).toContain('<li>uno</li>');
  });

  it('conserva los enlaces https', () => {
    const result = sanitizeArticleContent(sanitizer, '<a href="https://pnmc.gov.co/a">link</a>');

    expect(result).toContain('https://pnmc.gov.co/a');
    expect(result).toContain('link');
  });

  it('devuelve cadena vacía cuando no hay cuerpo', () => {
    expect(sanitizeArticleContent(sanitizer, '')).toBe('');
    expect(sanitizeArticleContent(sanitizer, null)).toBe('');
    expect(sanitizeArticleContent(sanitizer, undefined)).toBe('');
  });
});

/**
 * S-02 — hasta el DOM. Se enlaza el resultado con `[innerHTML]`, como hace la página, y se
 * comprueba el árbol real: ni `<script>`, ni atributos `on*`, ni `javascript:` llegan al
 * navegador, y el texto legítimo sí.
 */
@Component({
  selector: 'app-cuerpo-de-prueba',
  template: '<div class="cuerpo" [innerHTML]="html()"></div>',
})
class CuerpoDePruebaComponent {
  html = input<string>('');
}

describe('cuerpo de noticia en el DOM (S-02)', () => {
  function pintar(contenido: string): HTMLElement {
    TestBed.configureTestingModule({ imports: [CuerpoDePruebaComponent] });
    const sanitizer = TestBed.inject(DomSanitizer);
    const fixture = TestBed.createComponent(CuerpoDePruebaComponent);
    fixture.componentRef.setInput('html', sanitizeArticleContent(sanitizer, contenido));
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.cuerpo') as HTMLElement;
  }

  it('un <script> y un <img onerror> no llegan al DOM', () => {
    const cuerpo = pintar('<p>Hola</p><script>window.__xss = 1</script><img src="x" onerror="window.__xss = 2">');

    expect(cuerpo.querySelector('script')).toBeNull();
    expect(cuerpo.querySelectorAll('[onerror]').length).toBe(0);
    expect(cuerpo.innerHTML.toLowerCase()).not.toContain('onerror');
    expect(cuerpo.textContent).toContain('Hola');
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it('un enlace javascript: pierde su destino', () => {
    const cuerpo = pintar('<a href="javascript:alert(1)">clic</a>');

    // Angular lo deja inerte con el prefijo `unsafe:`: el navegador no lo trata como esquema javascript.
    const href = cuerpo.querySelector('a')?.getAttribute('href') ?? '';
    expect(href.startsWith('javascript:')).toBeFalse();
  });
});
