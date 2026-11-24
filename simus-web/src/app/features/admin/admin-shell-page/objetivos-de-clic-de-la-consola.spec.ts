import { TestBed } from '@angular/core/testing';

/**
 * Los controles de la consola no bajan de 32 px con puntero fino (44 px con puntero táctil, que Karma no emula).
 * La regla vive en `styles.css`, acotada a `.admin-foundation`; fuera de la consola no debe aplicarse.
 */
describe('Objetivos de clic de la consola', () => {
  let raiz: HTMLElement;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    raiz = document.createElement('div');
    raiz.innerHTML = `
      <div class="admin-foundation"><button id="dentro" style="height:20px;width:10px">Ver</button></div>
      <div><button id="fuera" style="height:20px;width:10px">Ver</button></div>`;
    document.body.appendChild(raiz);
  });
  afterEach(() => raiz.remove());

  it('un botón de la consola mide al menos 32 px de alto y de ancho', () => {
    const b = raiz.querySelector('#dentro') as HTMLElement;
    expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    expect(b.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
  });

  it('un botón fuera de la consola no se toca', () => {
    expect((raiz.querySelector('#fuera') as HTMLElement).getBoundingClientRect().height).toBeLessThan(32);
  });
});
