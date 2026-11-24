import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TerritorioSonoroConceptual } from '../../../../core/services/territorios-sonoros.service';
import { TerritorioSonoroDetallePageComponent } from './territorio-sonoro-detalle-page.component';

/**
 * La ficha de un Territorio sonoro no ensancha la página (revisión responsive del portal).
 *
 * <b>El defecto.</b> La fuente de un territorio es una dirección web larga y sin puntos de corte; en un teléfono de 390 px la página
 * pasaba a medir 507 px y toda la barra se descuadraba. La tarjeta tiene que poder partir las palabras largas.
 */
describe('TerritorioSonoroDetallePageComponent · palabras largas', () => {
  it('la tarjeta de la ficha parte las palabras largas (break-words) para que una dirección web no ensanche la página', () => {
    TestBed.configureTestingModule({ imports: [TerritorioSonoroDetallePageComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(TerritorioSonoroDetallePageComponent);
    fixture.componentInstance.ficha.set({
      nombre: 'Cantos', definicionBreve: 'Definición',
      fuentes: 'https://ejemplo.gov.co/' + 'documento-muy-largo-'.repeat(12) + '.pdf',
    } as unknown as TerritorioSonoroConceptual);
    fixture.detectChanges();
    const tarjeta = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('article');
    expect(tarjeta).withContext('no se dibujó la tarjeta de la ficha').not.toBeNull();
    expect(tarjeta!.className).toContain('break-words');
  });
});
