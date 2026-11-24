import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextoAlternativoDeImagenComponent } from './texto-alternativo-de-imagen.component';
import { AdminImage, ContenidoWebApiService } from '../../../core/services/contenido-web-api.service';

class ApiDoble {
  llamadas: { clave: string; version: number; alt: string }[] = [];
  respuesta: { ok: boolean; data?: unknown; error?: string; conflict?: boolean } = { ok: true, data: { changed: true } };

  async updateImageAlt(clave: string, version: number, alt: string) {
    this.llamadas.push({ clave, version, alt });
    return this.respuesta;
  }
}

function imagen(alt: string): AdminImage {
  return {
    key: 'home_ruta_1', label: 'Ruta 1', use: 'fondo', editable: true, alt,
    suggestedWidth: 400, suggestedHeight: 225, draft: null, published: null,
    state: 'no_publicado', version: 7, updatedBy: '', updatedAt: '',
  };
}

describe('TextoAlternativoDeImagenComponent', () => {
  let api: ApiDoble;
  let fixture: ComponentFixture<TextoAlternativoDeImagenComponent>;
  let guardados: number;

  beforeEach(async () => {
    api = new ApiDoble();
    guardados = 0;
    await TestBed.configureTestingModule({
      imports: [TextoAlternativoDeImagenComponent],
      providers: [{ provide: ContenidoWebApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(TextoAlternativoDeImagenComponent);
    fixture.componentRef.setInput('imagen', imagen('Ensayo en una escuela'));
    fixture.componentInstance.guardado.subscribe(() => guardados++);
    fixture.detectChanges();
  });

  const caja = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>('textarea')!;
  const boton = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="guardar-alt-home_ruta_1"]')!;

  function escribir(texto: string) {
    caja().value = texto;
    caja().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('arranca con la descripción vigente y sin permitir guardar lo que no cambió', () => {
    expect(caja().value).toBe('Ensayo en una escuela');
    expect(boton().disabled).toBeTrue();
  });

  it('no deja guardar una descripción vacía: una imagen sin descripción es lo que se evita', () => {
    escribir('   ');

    expect(boton().disabled).toBeTrue();
    expect(caja().getAttribute('aria-invalid')).toBe('true');
  });

  it('guarda con la versión de la ranura, recortada, y avisa al panel', async () => {
    escribir('  Niñas y niños ensayan  ');
    expect(boton().disabled).toBeFalse();

    await fixture.componentInstance.guardar();
    fixture.detectChanges();

    expect(api.llamadas).toEqual([{ clave: 'home_ruta_1', version: 7, alt: 'Niñas y niños ensayan' }]);
    expect(guardados).toBe(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Descripción guardada');
  });

  it('si otra persona cambió la imagen, lo dice y no avisa de un guardado', async () => {
    api.respuesta = { ok: false, conflict: true, error: 'conflicto' };
    escribir('Otra descripción');

    await fixture.componentInstance.guardar();
    fixture.detectChanges();

    expect(guardados).toBe(0);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Otra persona modificó esta imagen');
  });

  it('respeta el tope que publica el servidor', () => {
    fixture.componentRef.setInput('maximo', 10);
    fixture.detectChanges();
    escribir('Una descripción demasiado larga');

    expect(fixture.componentInstance.excede()).toBeTrue();
    expect(boton().disabled).toBeTrue();
  });

  it('sin permiso de edición no ofrece guardar', () => {
    fixture.componentRef.setInput('enabled', false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="guardar-alt-home_ruta_1"]')).toBeNull();
    expect(caja().disabled).toBeTrue();
  });
});
