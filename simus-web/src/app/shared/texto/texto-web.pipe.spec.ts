import { TestBed } from '@angular/core/testing';
import { DEFAULT_TEXTS } from '../../core/cms/registro-de-textos-web';
import { TextosWebService } from '../../core/services/textos-web.service';
import { TextoWebPipe } from './texto-web.pipe';

describe('TextoWebPipe · un texto fijo del portal, editable desde el CMS', () => {
  function crear(publicados: Record<string, string> | null) {
    TestBed.configureTestingModule({
      providers: [{ provide: TextosWebService, useValue: { getWebText: (clave: string) => publicados?.[clave] ?? DEFAULT_TEXTS[clave] ?? '' } }],
    });
    return TestBed.runInInjectionContext(() => new TextoWebPipe());
  }

  it('sin nada publicado devuelve el texto de respaldo del registro', () => {
    const pipe = crear(null);
    expect(pipe.transform('boletin_volver_inicio')).toBe('Volver al inicio');
  });

  it('con un texto publicado devuelve el publicado', () => {
    const pipe = crear({ boletin_volver_inicio: 'Ir a la portada' });
    expect(pipe.transform('boletin_volver_inicio')).toBe('Ir a la portada');
  });

  it('es impuro: tiene que releer el servicio cada vez que Angular revisa la plantilla', () => {
    const meta = (TextoWebPipe as unknown as { ɵpipe: { pure: boolean } }).ɵpipe;
    expect(meta.pure).toBeFalse();
  });
});
