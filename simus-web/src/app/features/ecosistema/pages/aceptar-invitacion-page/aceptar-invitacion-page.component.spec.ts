import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiClientService } from '../../../../core/http/api-client.service';
import { ExternalSessionService } from '../../../../core/services/external-session.service';
import { AceptarInvitacionPageComponent } from './aceptar-invitacion-page.component';

/**
 * La página de la invitación a una organización: textos que no mienten sobre el
 * regreso, una salida cuando la invitación no sirve y la bienvenida con el rol al aceptar.
 */
describe('la página de la invitación a una organización', () => {
  const ABIERTA = { organizacion: 'Red de Gaitas', rol: 'editor', correoInvitado: 'l•••a@example.com', estado: 'pendiente', fechaExpiracion: '2026-11-13' };

  async function montar(opciones: { invitacion?: unknown; falla?: boolean; sesion?: { email: string } | null; testigo?: string | null } = {}) {
    const llamadas: { url: string; cuerpo: unknown }[] = [];
    const api = {
      get: () => of({ requestToken: 't' }),
      post: (url: string, cuerpo: unknown) => {
        llamadas.push({ url, cuerpo });
        if (url.endsWith('/consultar')) return opciones.falla ? throwError(() => ({ status: 404 })) : of(opciones.invitacion ?? ABIERTA);
        return of({ organizacionId: '7', rol: 'editor' });
      },
    };
    await TestBed.configureTestingModule({
      imports: [AceptarInvitacionPageComponent],
      providers: [
        provideRouter([]),
        { provide: ApiClientService, useValue: api },
        { provide: ExternalSessionService, useValue: { actual: signal(opciones.sesion ?? null), cargarUnaVez: () => undefined, refrescar: () => of(null), salir: () => of(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(opciones.testigo === null ? {} : { testigo: opciones.testigo ?? 'x'.repeat(64) }) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AceptarInvitacionPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement, llamadas };
  }

  it('sin sesión, dice que al crear la cuenta se vuelve aquí (no «vuelve a abrir este enlace»)', async () => {
    const { raiz } = await montar();

    expect(raiz.textContent).toContain('al terminar volverás aquí para aceptar la invitación');
    expect(raiz.textContent).not.toContain('vuelve a abrir este enlace');
  });

  it('una invitación inexistente no deja sin salida: ofrece ingresar y volver al inicio', async () => {
    const { raiz } = await montar({ falla: true });

    expect(raiz.querySelector('[data-testid="invitacion-error"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="invitacion-ir-a-ingresar"]')?.getAttribute('href')).toBe('/ingresar');
    expect(raiz.querySelector('[data-testid="invitacion-ir-al-inicio"]')?.getAttribute('href')).toBe('/');
  });

  it('una invitación ya usada, con sesión, lleva a «mis organizaciones» y no dice «ya puedes entrar a tu panel» sin enlace', async () => {
    const { raiz } = await montar({ invitacion: { ...ABIERTA, estado: 'aceptada' }, sesion: { email: 'luis@example.com' } });

    expect(raiz.querySelector('[data-testid="invitacion-no-vigente"]')?.textContent).toContain('ya se usó');
    expect(raiz.querySelector('[data-testid="invitacion-no-vigente"]')?.textContent).not.toContain('panel');
    expect(raiz.querySelector('[data-testid="invitacion-ir-a-mis-organizaciones"]')?.getAttribute('href')).toBe('/gestion/cuenta/organizaciones');
    expect(raiz.querySelector('[data-testid="invitacion-ir-al-inicio"]')).not.toBeNull();
  });

  it('una invitación vigente no muestra las salidas de «no sirve»', async () => {
    const { raiz } = await montar({ sesion: { email: 'l.x.a@example.com' } });

    expect(raiz.querySelector('[data-testid="invitacion-salidas"]')).toBeNull();
  });

  it('al aceptar, abre la organización con su rol para que el panel dé la bienvenida', async () => {
    const { fixture } = await montar({ sesion: { email: 'luisa@example.com' } });
    const router = TestBed.inject(Router);
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);

    await fixture.componentInstance.aceptar();

    const [comandos, extras] = navegar.calls.mostRecent().args;
    expect(String((comandos as string[]).join('/'))).toContain('7');
    expect(extras).toEqual({ queryParams: { unido: 'editor' } });
  });
});
