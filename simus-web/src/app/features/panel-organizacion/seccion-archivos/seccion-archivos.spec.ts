import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SeccionArchivosComponent } from './seccion-archivos.component';
import { BibliotecaDeArchivosComponent } from './biblioteca-de-archivos.component';

/**
 * «Archivos de la organización», en el espacio de la organización.
 *
 * <b>LA BIBLIOTECA LEE EL BANCO POR EL CANAL EXTERNO.</b> El servidor decide qué devuelve según por dónde se pregunta, y
 * esta sección solo monta la biblioteca. El canal equivocado haría que una organización viera el banco del PNMC entero:
 * eso se comprueba en `biblioteca-de-archivos.spec.ts`, que mira la ruta que se pide.
 */
describe('«Archivos de la organización»', () => {
  let fixture: ComponentFixture<SeccionArchivosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeccionArchivosComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(SeccionArchivosComponent);
    fixture.detectChanges();
  });

  it('monta la biblioteca de archivos con su título y su explicación', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    expect(fixture.debugElement.query(e => e.componentInstance instanceof BibliotecaDeArchivosComponent)).not.toBeNull();
    expect(raiz.querySelector('h1')?.textContent).toContain('Archivos de la organización');
  });
});
