import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdminService } from '../../core/services/admin.service';
import { BancoDeArchivosService } from '../../core/services/banco-de-archivos.service';
import { HistorialDeCambiosService } from '../../core/services/historial-de-cambios.service';
import { FichaEdicionFestivalComponent } from './ficha-edicion-festival.component';

/**
 * Subir el material de una edición con una imagen que ya estaba en el banco.
 *
 * <b>EL DEFECTO.</b> Quien escribía otra descripción y subía la MISMA imagen no veía nada: el servidor
 * reutilizaba la imagen, actualizaba su descripción y lo avisaba, pero esta pantalla tiraba el aviso. Parecía
 * que la descripción nueva se había perdido.
 */
describe('FichaEdicionFestivalComponent · subir material con una imagen repetida', () => {
  function montar(resultado: unknown) {
    const subirImagen = jasmine.createSpy('subirImagen').and.resolveTo(resultado);
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminService, useValue: {} },
        { provide: HistorialDeCambiosService, useValue: {} },
        { provide: BancoDeArchivosService, useValue: { subirImagen } },
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      ],
    });
    const componente = TestBed.runInInjectionContext(() => new FichaEdicionFestivalComponent());
    componente.form.materiales = [{ descripcionArchivo: 'Afiche de la edición', url: '' } as never];
    const entrada = { files: [new File(['x'], 'afiche.png', { type: 'image/png' })], value: 'afiche.png' } as unknown as HTMLInputElement;
    return { componente, entrada, subirImagen };
  }

  it('enseña el aviso del servidor cuando se reutilizó la imagen y se actualizó su descripción', async () => {
    const { componente, entrada } = montar({
      ok: true, archivo: { id: 7, url: '/api/v1/publico/archivos/7' },
      aviso: 'Ya tenías esta imagen; actualicé su descripción.',
    });

    await componente.subirMaterial(0, entrada);

    expect(componente.avisoDeMaterial()[0]).toBe('Ya tenías esta imagen; actualicé su descripción.');
    expect(componente.errorDeMaterial()[0]).toBeUndefined();
  });

  it('no enseña ningún aviso cuando la imagen es nueva, y borra el de una subida anterior', async () => {
    const { componente, entrada } = montar({ ok: true, archivo: { id: 8, url: '/api/v1/publico/archivos/8' } });
    componente.avisoDeMaterial.set({ 0: 'Ya tenías esta imagen; actualicé su descripción.' });

    await componente.subirMaterial(0, entrada);

    expect(componente.avisoDeMaterial()[0]).toBeUndefined();
  });
});
