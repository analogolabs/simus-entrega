import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BuscadorDeListaComponent } from './buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent } from './filtro-desplegable/filtro-desplegable.component';
import { FiltroDeSedeComponent } from './filtro-de-sede/filtro-de-sede.component';
import { SelectorMultipleComponent } from './selector-multiple/selector-multiple.component';
import { BotonNativoDirective } from './boton/boton.component';

/**
 * UNA SOLA ALTURA PARA LOS CONTROLES DE UNA MISMA FILA. El token es `--spacing-control` (36 px) o
 * `--spacing-control-comodo` (44 px); lo que se prueba es que buscador, listas, filtro de sede, selector múltiple y
 * botones de una fila que piden el mismo tamaño miden lo mismo. En «Procesos históricos» el buscador y «Tipo» eran de 44
 * y los dos filtros de sede, de 36.
 */
@Component({
  standalone: true,
  imports: [BuscadorDeListaComponent, FiltroDesplegableComponent, FiltroDeSedeComponent, SelectorMultipleComponent, BotonNativoDirective],
  template: `
    <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap" [attr.data-fila]="tamano()">
      <app-buscador-de-lista identificador="a-buscar" etiqueta="Buscar" valor="" [tamano]="tamano()" />
      <app-filtro-desplegable identificador="a-tipo" rotulo="Tipo" etiqueta="Tipo" [tamano]="tamano()"
        [opciones]="[{ id: '', etiqueta: 'Todos' }]" elegida="" />
      <app-filtro-de-sede idBase="a" [tamano]="tamano()" [ubicaciones]="[]" />
      <app-selector-multiple identificador="a-multi" etiqueta="Varios" [tamano]="tamano()" [opciones]="[]" />
      <button type="button" appBoton="secundaria" [tamano]="tamano()">Botón</button>
    </div>
  `,
})
class FilaDePruebaComponent { readonly tamano = signal<'normal' | 'comodo'>('normal'); }

describe('altura común de los controles de una fila', () => {
  async function alturas(tamano: 'normal' | 'comodo'): Promise<number[]> {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(FilaDePruebaComponent);
    fixture.componentInstance.tamano.set(tamano);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const controles = [
      raiz.querySelector('input'),
      ...Array.from(raiz.querySelectorAll('app-filtro-desplegable button, app-filtro-desplegable [role="combobox"]')),
      raiz.querySelector('app-selector-multiple button'),
      raiz.querySelector('button[appBoton], button.inline-flex:last-of-type'),
    ].filter((c): c is Element => !!c);
    const medidas = controles.map(c => Math.round(c.getBoundingClientRect().height));
    fixture.nativeElement.remove();
    return medidas;
  }

  for (const [tamano, px] of [['normal', 36], ['comodo', 44]] as const) {
    it(`en tamaño «${tamano}» todos miden ${px} px`, async () => {
      const medidas = await alturas(tamano);
      expect(medidas.length).toBeGreaterThanOrEqual(5);
      expect(medidas.every(m => m === px)).withContext(`alturas medidas: ${medidas.join(', ')}`).toBeTrue();
    });
  }
});
