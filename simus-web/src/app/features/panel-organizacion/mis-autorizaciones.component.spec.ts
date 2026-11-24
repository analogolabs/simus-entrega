import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { AutorizacionDeDatos, PoliticaPublica } from '../../core/services/politicas-de-datos';
import { TextosWebService } from '../../core/services/textos-web.service';
import { MisAutorizacionesComponent } from './mis-autorizaciones.component';

/**
 * «Mis autorizaciones». El TEXTO de las autorizaciones no se toca (decisión de la
 * dirección, docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1 decisión 12): lo que se vigila es dónde se muestra, que lo voluntario sin
 * otorgar se pueda otorgar y que «escríbenos» diga adónde.
 */
describe('Mis autorizaciones', () => {
  const tratamiento: AutorizacionDeDatos = {
    id: 1, finalidad: 'tratamiento', titulo: 'Tratamiento de datos', version: '2026-09-12', textoAceptado: 'Texto', textoReconstruido: false,
    origen: 'registro', fechaOtorgada: '2026-11-05T10:00:00Z', fechaRevocacion: null, vigente: true, sePuedeRevocar: false,
    motivoSinRevocar: 'Esta autorización sostiene tu cuenta. Escríbenos para solicitarlo.',
  };
  const boletinPolitica: PoliticaPublica = {
    clave: 'boletin', version: '2026-11-22', titulo: 'Boletín informativo', texto: 'Autorizo recibir el boletín del SIMUS.', urlOficial: null, referenciaOficial: null,
  };

  async function montar(autorizaciones: AutorizacionDeDatos[], politicas: PoliticaPublica[] = [boletinPolitica]) {
    const otorgadas: string[] = [];
    const admin = {
      cargarMisAutorizaciones: () => of(autorizaciones),
      cargarPoliticas: () => of(politicas),
      otorgarAutorizacion: (finalidad: string) => {
        otorgadas.push(finalidad);
        return of([...autorizaciones, { ...tratamiento, id: 2, finalidad, titulo: 'Boletín informativo', textoAceptado: boletinPolitica.texto, sePuedeRevocar: true, motivoSinRevocar: null }]);
      },
    };
    await TestBed.configureTestingModule({
      imports: [MisAutorizacionesComponent],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: TextosWebService, useValue: { getWebText: (clave: string) => clave === 'footer_col3_email' ? 'atencion@ministerio.example' : '' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MisAutorizacionesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement, otorgadas };
  }

  it('«Escríbenos para solicitarlo» dice adónde: un enlace al correo de atención', async () => {
    const { raiz } = await montar([tratamiento]);
    const enlace = raiz.querySelector<HTMLAnchorElement>('[data-testid="autorizaciones-contacto"]');

    expect(enlace?.getAttribute('href')).toBe('mailto:atencion@ministerio.example');
    expect(enlace?.textContent).toContain('atencion@ministerio.example');
  });

  it('el boletín que no se marcó al registrarse aparece como voluntaria sin otorgar, con su texto antes del botón', async () => {
    const { fixture, raiz } = await montar([tratamiento]);
    const grupo = raiz.querySelector('[data-testid="autorizaciones-voluntarias"]')!;

    expect(grupo.textContent).toContain('Boletín informativo');
    expect(grupo.textContent).not.toContain('Autorizo recibir el boletín');
    grupo.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click();
    fixture.detectChanges();
    expect(grupo.textContent).toContain('Autorizo recibir el boletín del SIMUS.');
    expect(grupo.querySelector('button[aria-label^="Autorizar"]')).not.toBeNull();
  });

  it('«Autorizar» otorga la voluntaria y la pasa a la lista de vigentes', async () => {
    const { fixture, raiz, otorgadas } = await montar([tratamiento]);

    raiz.querySelector<HTMLButtonElement>('[data-testid="autorizaciones-voluntarias"] button[aria-label^="Autorizar"]')!.click();
    fixture.detectChanges();

    expect(otorgadas).toEqual(['boletin']);
    expect(raiz.querySelector('[data-testid="autorizaciones-voluntarias"]')).toBeNull();
    expect(raiz.textContent).toContain('Boletín informativo');
  });

  it('si el boletín ya está vigente no se ofrece otra vez', async () => {
    const vigente = { ...tratamiento, id: 3, finalidad: 'boletin', titulo: 'Boletín informativo', sePuedeRevocar: true, motivoSinRevocar: null };
    const { raiz } = await montar([tratamiento, vigente]);

    expect(raiz.querySelector('[data-testid="autorizaciones-voluntarias"]')).toBeNull();
  });
});
