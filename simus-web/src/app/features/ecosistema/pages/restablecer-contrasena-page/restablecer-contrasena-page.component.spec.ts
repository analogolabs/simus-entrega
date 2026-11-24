import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { RestablecerContrasenaPageComponent } from './restablecer-contrasena-page.component';
import { EstadoDelEnlaceDeRecuperacion, RecuperacionDeContrasenaService } from '../../../../core/services/recuperacion-de-contrasena.service';

/**
 * La página que abre el enlace de «¿Olvidaste tu contraseña?».
 *
 * Vigila lo que importa de una pantalla de seguridad: que se compruebe el enlace antes de pedir una
 * contraseña, que cada motivo de rechazo diga qué hacer, que los errores del servidor vuelvan a su
 * campo (con el traductor compartido), que el campo se pueda mostrar con un nombre accesible y que al
 * terminar no inicie sesión sino que lleve a ingresar.
 */
describe('la página de restablecer contraseña', () => {
  class ServicioFalso {
    estado: EstadoDelEnlaceDeRecuperacion = { valido: true, motivo: null, correoEnmascarado: 'l•••a@example.com' };
    fallaAlRestablecer: unknown = null;
    comprobados: string[] = [];
    restablecidos: { testigo: string; nueva: string }[] = [];
    async comprobar(testigo: string) { this.comprobados.push(testigo); return this.estado; }
    async restablecer(testigo: string, nueva: string) {
      this.restablecidos.push({ testigo, nueva });
      if (this.fallaAlRestablecer) throw this.fallaAlRestablecer;
    }
  }

  async function montar(testigo: string | null, ajustar?: (servicio: ServicioFalso) => void) {
    const servicio = new ServicioFalso();
    ajustar?.(servicio);
    await TestBed.configureTestingModule({
      imports: [RestablecerContrasenaPageComponent],
      providers: [
        provideRouter([]),
        { provide: RecuperacionDeContrasenaService, useValue: servicio },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(testigo ? { testigo } : {}) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RestablecerContrasenaPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, servicio, raiz: fixture.nativeElement as HTMLElement };
  }

  const escribir = (raiz: HTMLElement, id: string, valor: string) => {
    const campo = raiz.querySelector<HTMLInputElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };

  it('comprueba el enlace antes de pedir la contraseña y dice de qué cuenta es, sin el correo completo', async () => {
    const { raiz, servicio } = await montar('a'.repeat(64));

    expect(servicio.comprobados).toEqual(['a'.repeat(64)]);
    expect(raiz.querySelector('#restablecer-nueva')).not.toBeNull();
    expect(raiz.textContent).toContain('l•••a@example.com');
  });

  it('sin testigo en la dirección no hay formulario: dice que el enlace no es válido y ofrece pedir otro', async () => {
    const { raiz, servicio } = await montar(null);

    expect(servicio.comprobados).toEqual([]);
    expect(raiz.querySelector('#restablecer-nueva')).toBeNull();
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('no es válido');
    expect(raiz.querySelector('[data-testid="restablecer-pedir-otro"]')?.getAttribute('href')).toBe('/ingresar?recuperar=1');
  });

  it('cada motivo de rechazo dice qué pasó y qué hacer', async () => {
    for (const [motivo, texto] of [
      ['enlace_vencido', 'ya venció'], ['enlace_usado', 'ya se usó'],
      ['enlace_reemplazado', 'más reciente'], ['enlace_no_valido', 'no es válido'],
    ] as const) {
      TestBed.resetTestingModule();
      const { raiz } = await montar('b'.repeat(64), servicio => { servicio.estado = { valido: false, motivo, correoEnmascarado: null }; });

      expect(raiz.querySelector('[role="alert"]')?.textContent).withContext(motivo).toContain(texto);
      expect(raiz.querySelector('[data-testid="restablecer-pedir-otro"]')).withContext(motivo).not.toBeNull();
    }
  });

  it('valida en la página: 12 caracteres y que las dos coincidan, cada error junto a su campo', async () => {
    const { fixture, raiz, servicio } = await montar('c'.repeat(64));

    escribir(raiz, 'restablecer-nueva', 'corta');
    escribir(raiz, 'restablecer-confirmacion', 'otra');
    await fixture.componentInstance.restablecer();
    fixture.detectChanges();

    expect(servicio.restablecidos).toEqual([]);
    expect(raiz.querySelector('#restablecer-nueva-error')?.textContent).toContain('12 caracteres');
    expect(raiz.querySelector('#restablecer-confirmacion-error')?.textContent).toContain('no coinciden');
    expect(raiz.querySelector('#restablecer-nueva')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('muestra u oculta la contraseña con un botón que tiene nombre accesible', async () => {
    const { fixture, raiz } = await montar('d'.repeat(64));
    const campo = raiz.querySelector<HTMLInputElement>('#restablecer-nueva')!;
    const boton = raiz.querySelector<HTMLButtonElement>('button[aria-pressed]')!;

    expect(boton.getAttribute('aria-label')).toBe('Mostrar contraseña');
    expect(campo.type).toBe('password');
    boton.click();
    fixture.detectChanges();

    expect(raiz.querySelector('button[aria-pressed]')?.getAttribute('aria-label')).toBe('Ocultar contraseña');
    expect(raiz.querySelector<HTMLInputElement>('#restablecer-nueva')!.type).toBe('text');
  });

  it('lo que rechaza la política de contraseñas del servidor vuelve a su campo, traducido', async () => {
    const { fixture, raiz } = await montar('e'.repeat(64), servicio => {
      servicio.fallaAlRestablecer = { status: 400, message: 'x', payload: { errors: { nueva: ['Esta contraseña es demasiado común. Elige una frase de paso distinta.'] } } };
    });

    escribir(raiz, 'restablecer-nueva', 'unaFraseLargaYUnica#1');
    escribir(raiz, 'restablecer-confirmacion', 'unaFraseLargaYUnica#1');
    await fixture.componentInstance.restablecer();
    fixture.detectChanges();

    expect(raiz.querySelector('#restablecer-nueva-error')?.textContent).toContain('demasiado común');
    expect(raiz.querySelector('[data-testid="restablecer-hecho"]')).toBeNull();
  });

  it('si el enlace deja de servir mientras se escribía, la página lo dice y ofrece pedir otro', async () => {
    const { fixture, raiz } = await montar('f'.repeat(64), servicio => {
      servicio.fallaAlRestablecer = { status: 400, message: 'x', payload: { motivo: 'enlace_usado', testigo: ['Este enlace ya se usó.'] } };
    });

    escribir(raiz, 'restablecer-nueva', 'unaFraseLargaYUnica#1');
    escribir(raiz, 'restablecer-confirmacion', 'unaFraseLargaYUnica#1');
    await fixture.componentInstance.restablecer();
    fixture.detectChanges();

    expect(raiz.querySelector('[data-testid="restablecer-sin-enlace"]')?.textContent).toContain('ya se usó');
  });

  it('al terminar no inicia sesión: lleva a ingresar con la contraseña nueva, y no conserva lo escrito', async () => {
    const { fixture, raiz, servicio } = await montar('9'.repeat(64));

    escribir(raiz, 'restablecer-nueva', 'unaFraseLargaYUnica#1');
    escribir(raiz, 'restablecer-confirmacion', 'unaFraseLargaYUnica#1');
    await fixture.componentInstance.restablecer();
    fixture.detectChanges();

    expect(servicio.restablecidos).toEqual([{ testigo: '9'.repeat(64), nueva: 'unaFraseLargaYUnica#1' }]);
    expect(raiz.querySelector('[data-testid="restablecer-hecho"]')?.textContent).toContain('cerramos las demás sesiones');
    expect(raiz.querySelector('[data-testid="restablecer-ir-a-ingresar"]')?.getAttribute('href')).toBe('/ingresar');
    expect(fixture.componentInstance.nueva).toBe('');
    expect(fixture.componentInstance.confirmacion).toBe('');
  });
});
