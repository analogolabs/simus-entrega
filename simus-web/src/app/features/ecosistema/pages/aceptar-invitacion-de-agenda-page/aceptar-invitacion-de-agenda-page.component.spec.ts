import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApiClientService } from '../../../../core/http/api-client.service';
import { ExternalSessionService } from '../../../../core/services/external-session.service';
import { AceptarInvitacionDeAgendaPageComponent } from './aceptar-invitacion-de-agenda-page.component';

/**
 * La invitación a una agenda de citas (docs/referencia/26-agenda-de-citas-y-mercados.md §26.10): el mismo flujo que la invitación a una organización.
 * Es anónima, solo la cuenta del correo invitado acepta, y quien no tiene cuenta la crea y vuelve aquí.
 */
describe('la página de la invitación a una agenda de citas', () => {
  const ABIERTA = {
    mercadoNombre: 'Mercado Musical del Valle', anio: 2026, edicionNombre: null, correoEnmascarado: 'b•••r@correo.test',
    estado: 'pendiente', fechaExpiracion: '2026-11-19',
  };

  async function montar(opciones: { invitacion?: unknown; falla?: boolean; sesion?: { email: string } | null } = {}) {
    const llamadas: { url: string; cuerpo: unknown }[] = [];
    const api = {
      get: () => of({ requestToken: 't' }),
      post: (url: string, cuerpo: unknown) => {
        llamadas.push({ url, cuerpo });
        if (url.endsWith('/consultar')) return opciones.falla ? throwError(() => ({ status: 404 })) : of(opciones.invitacion ?? ABIERTA);
        return of({ agendaId: 7 });
      },
    };
    await TestBed.configureTestingModule({
      imports: [AceptarInvitacionDeAgendaPageComponent],
      providers: [
        provideRouter([]),
        { provide: ApiClientService, useValue: api },
        { provide: ExternalSessionService, useValue: { actual: signal(opciones.sesion ?? null), cargarUnaVez: () => undefined, salir: () => of(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ testigo: 'x'.repeat(64) }) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AceptarInvitacionDeAgendaPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement, llamadas };
  }

  it('sin sesión dice a qué Mercado es y ofrece entrar o crear la cuenta de ese correo', async () => {
    const { raiz } = await montar();

    expect(raiz.textContent).toContain('Mercado Musical del Valle');
    expect(raiz.textContent).toContain('b•••r@correo.test');
    expect(raiz.querySelector('[data-testid="invitacion-ingresar"]')).not.toBeNull();
    expect(raiz.textContent).toContain('al terminar volverás aquí');
  });

  it('con otra cuenta no deja aceptar: pide entrar con la del correo invitado', async () => {
    const { raiz } = await montar({ sesion: { email: 'otra.persona@correo.test' } });

    expect(raiz.querySelector('[data-testid="invitacion-otra-cuenta"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="aceptar-invitacion"]')).toBeNull();
  });

  it('una invitación que ya no sirve no deja sin salida', async () => {
    const { raiz } = await montar({ invitacion: { ...ABIERTA, estado: 'revocada' } });

    expect(raiz.querySelector('[data-testid="invitacion-no-vigente"]')?.textContent).toContain('sin efecto');
    expect(raiz.querySelector('[data-testid="invitacion-ir-al-inicio"]')).not.toBeNull();
  });

  it('un enlace que no existe lo dice y ofrece ingresar', async () => {
    const { raiz } = await montar({ falla: true });

    expect(raiz.querySelector('[data-testid="invitacion-error"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="invitacion-ir-a-ingresar"]')).not.toBeNull();
  });

  it('al aceptar con la cuenta del correo abre la agenda y manda el testigo en el cuerpo', async () => {
    const { fixture, llamadas } = await montar({ sesion: { email: 'booker@correo.test' } });
    const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    await fixture.componentInstance.aceptar();

    const aceptar = llamadas.find(l => l.url.endsWith('/aceptar'));
    expect(aceptar?.cuerpo).toEqual({ testigo: 'x'.repeat(64) });
    expect(navegar).toHaveBeenCalledWith('/gestion/cuenta/agenda-de-citas/7');
  });
});
