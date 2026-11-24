import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ConfirmarBoletinPageComponent } from './confirmar-boletin-page.component';
import { ApiClientService } from '../../../../core/http/api-client.service';

/** La página del enlace del boletín: confirma el botón, no la carga (los antivirus abren los enlaces). */
describe('la página de confirmación del boletín', () => {
  let llamadas: { url: string; cuerpo: unknown }[];

  async function montar(testigo: string | null, responde: 'ok' | 'falla' = 'ok') {
    llamadas = [];
    const api = {
      post: (url: string, cuerpo: unknown) => {
        llamadas.push({ url, cuerpo });
        return responde === 'ok' ? of({}) : throwError(() => ({ payload: { message: 'Este enlace ya venció.' } }));
      },
    };
    await TestBed.configureTestingModule({
      imports: [ConfirmarBoletinPageComponent],
      providers: [
        provideRouter([]),
        { provide: ApiClientService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(testigo ? { testigo } : {}) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmarBoletinPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  const boton = (raiz: HTMLElement) => raiz.querySelector<HTMLButtonElement>('[data-testid="confirmar-boletin-boton"]');

  it('abrir la página no confirma nada: hace falta pulsar el botón', async () => {
    const fixture = await montar('abc123');
    expect(llamadas.length).toBe(0);
    boton(fixture.nativeElement)!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(llamadas).toEqual([{ url: '/api/v1/publico/boletin/confirmar', cuerpo: { testigo: 'abc123' } }]);
    const listo = fixture.nativeElement.querySelector('[data-testid="confirmar-boletin-listo"]');
    expect(listo).not.toBeNull();
    expect(listo.textContent).toContain('Suscripción confirmada');
    expect(listo.querySelector('a[href="/"]')).not.toBeNull();
  });

  it('lleva la identidad del SIMUS y reserva el alto de la barra fija', async () => {
    const fixture = await montar('abc123');
    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelector('img[alt="SIMUS"]')).not.toBeNull();
    expect(raiz.querySelector('main')?.className).toContain('--alto-barra-superior');
    expect(raiz.textContent).toContain('Sistema de Información de la Música');
    expect(raiz.textContent).not.toContain('PNMC');
  });

  it('mientras confirma muestra el estado «confirmando»', async () => {
    const fixture = await montar('abc123');
    fixture.componentInstance.trabajando.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="confirmar-boletin-confirmando"]')).not.toBeNull();
  });

  it('sin testigo no ofrece confirmar y lo dice', async () => {
    const fixture = await montar(null);
    expect(boton(fixture.nativeElement)).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="confirmar-boletin-invalido"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('incompleto');
    expect(fixture.nativeElement.querySelector('a[href="/"]')).not.toBeNull();
  });

  it('muestra el motivo que da el servidor si el enlace venció', async () => {
    const fixture = await montar('abc123', 'falla');
    boton(fixture.nativeElement)!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="confirmar-boletin-error"]')?.textContent).toContain('venció');
    expect(boton(fixture.nativeElement)).not.toBeNull();
  });
});
