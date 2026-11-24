import { TestBed } from '@angular/core/testing';
import { PanelLateralComponent } from './panel-lateral.component';

/**
 * El cajón lateral común admite un ancho mayor para fichas con mucho contenido: la ficha catalográfica con su hilo de revisiones sigue siendo el mismo cajón —velo,
 * encabezado, cierre y foco—, solo que a 64rem y no a 40.
 */
describe('PanelLateralComponent · ancho', () => {
  function montar(ancho?: 'normal' | 'ancho') {
    TestBed.configureTestingModule({ imports: [PanelLateralComponent] });
    const fixture = TestBed.createComponent(PanelLateralComponent);
    fixture.componentRef.setInput('titulo', 'Una ficha');
    fixture.componentRef.setInput('contexto', 'Catálogo editorial');
    if (ancho) { fixture.componentRef.setInput('ancho', ancho); }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('por omisión es el cajón de siempre', () => {
    const raiz = montar();
    expect(raiz.querySelector('.panel')).not.toBeNull();
    expect(raiz.querySelector('.panel--ancho')).toBeNull();
  });

  it('con «ancho» es el mismo cajón, más ancho, con su título y su cierre', () => {
    const raiz = montar('ancho');
    expect(raiz.querySelector('.panel--ancho')).not.toBeNull();
    expect(raiz.querySelector('h2')?.textContent).toContain('Una ficha');
    expect(raiz.querySelector('[etiqueta="Cerrar la ficha"], app-boton')).not.toBeNull();
  });
});
