import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FotoDelProceso, FotoDelProcesoComponent } from './foto-del-proceso.component';

describe('FotoDelProcesoComponent', () => {
  let fixture: ComponentFixture<FotoDelProcesoComponent>;
  let subir: jasmine.Spy;
  let emitidos: FotoDelProceso[];

  function montar(fotoUrl: string | null = null): void {
    fixture = TestBed.createComponent(FotoDelProcesoComponent);
    subir = jasmine.createSpy('subir').and.resolveTo({ ok: true, archivo: { id: 7, url: '/api/v1/publico/archivos/7' } });
    emitidos = [];
    fixture.componentRef.setInput('subir', subir);
    fixture.componentRef.setInput('fotoUrl', fotoUrl);
    fixture.componentInstance.cambio.subscribe(f => emitidos.push(f));
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [FotoDelProcesoComponent] }));

  it('exige la descripción de la imagen antes de subirla', async () => {
    montar();
    fixture.componentInstance.archivo.set(new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));
    await fixture.componentInstance.subirLaElegida();
    expect(subir).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('Describe la imagen');
  });

  it('sube la imagen y avisa del identificador y de la dirección', async () => {
    montar();
    fixture.componentInstance.archivo.set(new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));
    fixture.componentInstance.alt.set('Fachada');
    await fixture.componentInstance.subirLaElegida();
    expect(subir).toHaveBeenCalledTimes(1);
    expect(emitidos).toEqual([{ archivoFotoId: 7, fotoUrl: '/api/v1/publico/archivos/7', fotoAlt: 'Fachada' }]);
  });

  it('muestra el error del servidor si la subida falla y no emite nada', async () => {
    montar();
    subir.and.resolveTo({ ok: false, error: 'Eso no es una imagen válida.' });
    fixture.componentInstance.archivo.set(new File([new Uint8Array([1])], 'a.png'));
    fixture.componentInstance.alt.set('x');
    await fixture.componentInstance.subirLaElegida();
    expect(fixture.componentInstance.error()).toBe('Eso no es una imagen válida.');
    expect(emitidos).toEqual([]);
  });

  it('quitar la foto la desvincula sin subir nada', () => {
    montar('/api/v1/publico/archivos/7');
    expect(fixture.nativeElement.querySelector('[data-foto-vista]')).not.toBeNull();
    fixture.componentInstance.quitar();
    expect(emitidos).toEqual([{ archivoFotoId: null, fotoUrl: null, fotoAlt: null }]);
  });
});
