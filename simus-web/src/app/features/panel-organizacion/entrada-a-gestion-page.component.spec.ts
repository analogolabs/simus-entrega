import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { EntradaAGestionPageComponent } from './entrada-a-gestion-page.component';

/**
 * «¿Cómo quieres entrar?» (ACC2): lo que ve una cuenta con organizaciones tras iniciar sesión,
 * y lo que NO ve una cuenta sin ellas.
 */
describe('EntradaAGestionPageComponent', () => {
  const CON_DOS = {
    userId: '31',
    fullName: 'Camilo Rojas',
    email: 'camilo.rojas@llanoadentro.test',
    accountStatus: 'activo',
    organizations: [
      { id: '41', name: 'Colectivo Llano Adentro', role: 'administrador' },
      { id: '42', name: 'Corporación Cultural Cantaclaro', role: 'editor' },
    ],
  };
  const SIN_ORGANIZACION = { userId: '32', fullName: 'Valentina Ocampo', email: 'valentina.ocampo@correo.test', accountStatus: 'activo', organizations: [] };

  let router: Router;
  let sesion: ExternalSessionService;

  function montar() {
    const fixture = TestBed.createComponent(EntradaAGestionPageComponent);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [EntradaAGestionPageComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    router = TestBed.inject(Router);
    sesion = TestBed.inject(ExternalSessionService);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  it('ofrece Mi espacio y cada organización con su rol, sin «Actuando como»', () => {
    sesion.establecer(CON_DOS);
    const { raiz } = montar();

    expect(raiz.querySelector('h1')?.textContent?.trim()).toBe('¿Cómo quieres entrar?');
    const tarjetas = Array.from(raiz.querySelectorAll('[data-testid="opciones-de-entrada"] button')).map(b => (b.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(tarjetas.length).toBe(3);
    expect(tarjetas[0]).toContain('Mi espacio');
    expect(tarjetas[1]).toContain('Colectivo Llano Adentro');
    expect(tarjetas[1]).toContain('Administrador');
    expect(tarjetas[2]).toContain('Corporación Cultural Cantaclaro');
    expect(tarjetas[2]).toContain('Editor');
    expect(raiz.textContent).not.toContain('Actuando como');
    // Sin mayúscula sostenida: la guía de estilo (docs/usuario/23-guia-de-estilo-de-textos.md).
    expect(raiz.querySelector('.uppercase')).toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('entrar a una organización abre su panel, en su dirección, y la recuerda', () => {
    sesion.establecer(CON_DOS);
    const { raiz } = montar();

    (raiz.querySelector('[data-testid="entrar-organizacion-42"]') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/gestion/o/42/resumen');
    expect(localStorage.getItem('simus.gestion.ultimaOrganizacion.31')).toBe('42');
    expect(localStorage.getItem('simus.gestion.ultimoModo.31')).toBe('42');
  });

  it('entrar a Mi espacio abre el espacio personal y lo deja como último modo sin cambiar la organización por omisión', () => {
    sesion.establecer(CON_DOS);
    localStorage.setItem('simus.gestion.ultimaOrganizacion.31', '41');
    const { raiz } = montar();

    (raiz.querySelector('[data-testid="entrar-mi-espacio"]') as HTMLButtonElement).click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/gestion/cuenta');
    expect(localStorage.getItem('simus.gestion.ultimoModo.31')).toBe('persona');
    expect(localStorage.getItem('simus.gestion.ultimaOrganizacion.31')).toBe('41');
  });

  it('preselecciona la tarjeta de la última vez y le da el foco, pero muestra la pantalla igual', async () => {
    sesion.establecer(CON_DOS);
    localStorage.setItem('simus.gestion.ultimoModo.31', '41');
    const { fixture, raiz } = montar();
    await fixture.whenStable();
    await Promise.resolve();

    const recordada = raiz.querySelector('[data-recordada="true"]') as HTMLButtonElement;
    expect(recordada?.getAttribute('data-testid')).toBe('entrar-organizacion-41');
    expect(recordada.textContent).toContain('La última vez');
    expect(raiz.querySelectorAll('[data-recordada="true"]').length).toBe(1);
    expect(raiz.querySelector('[data-testid="entrada-a-gestion"]')).not.toBeNull();
  });

  it('un modo recordado que ya no es de la cuenta no preselecciona nada', () => {
    sesion.establecer(CON_DOS);
    localStorage.setItem('simus.gestion.ultimoModo.31', '999');
    const { raiz } = montar();

    expect(raiz.querySelector('[data-recordada="true"]')).toBeNull();
  });

  it('una cuenta sin organización pasa de largo hacia su espacio personal y no pinta la pantalla', () => {
    sesion.establecer(SIN_ORGANIZACION);
    const { raiz } = montar();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/gestion/cuenta', { replaceUrl: true });
    expect(raiz.querySelector('[data-testid="entrada-a-gestion"]')).toBeNull();
  });
});
