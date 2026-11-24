import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ConfirmarCorreoPageComponent } from './confirmar-correo-page.component';
import { ApiClientService } from '../../../../core/http/api-client.service';

/**
 * La página que abre el enlace de confirmación de correo.
 *
 * <b>.</b> En los tres desenlaces —enlace incompleto, rechazado y confirmado— el botón
 * llevaba a <code>/ecosistema/mi-panel</code>, una ruta retirada que daba 404: el único camino para
 * confirmar el correo terminaba en una página de error. Y al confirmar decía «Tu organización…» a
 * cuentas que quizá no tienen ninguna.
 */
describe('la página de confirmación de correo', () => {
  async function montar(testigo: string | null, responde: 'ok' | 'falla' = 'ok') {
    const api = {
      post: () => responde === 'ok'
        ? of({})
        : throwError(() => ({ payload: { testigo: ['El enlace venció. Pide otro desde tu panel.'] } })),
    };
    await TestBed.configureTestingModule({
      imports: [ConfirmarCorreoPageComponent],
      providers: [
        provideRouter([]),
        { provide: ApiClientService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(testigo ? { testigo } : {}) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConfirmarCorreoPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const enlace = (raiz: HTMLElement) =>
    raiz.querySelector<HTMLAnchorElement>('[data-testid="confirmar-correo-ir-al-panel"]');

  it('con el enlace incompleto, el botón lleva al panel que existe', async () => {
    const raiz = await montar(null);

    expect(enlace(raiz)?.getAttribute('href')).toBe('/gestion');
  });

  it('con el enlace rechazado, el botón lleva al panel que existe', async () => {
    const raiz = await montar('vencido', 'falla');

    expect(raiz.textContent).toContain('El enlace venció');
    expect(enlace(raiz)?.getAttribute('href')).toBe('/gestion');
  });

  it('al confirmar, habla de la cuenta y lleva al panel que existe', async () => {
    const raiz = await montar('bueno');

    expect(raiz.textContent).toContain('Tu correo quedó confirmado');
    expect(raiz.textContent).toContain('Tu cuenta ya puede');
    expect(raiz.textContent).not.toContain('Tu organización');
    expect(enlace(raiz)?.getAttribute('href')).toBe('/gestion');
  });

  it('ningún enlace apunta a la ruta retirada', async () => {
    const raiz = await montar('bueno');

    expect(raiz.querySelector('a[href*="mi-panel"]')).toBeNull();
  });
});
