import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ExternalAccessPageComponent } from './external-access-page.component';
import { AdminService } from '../../core/services/admin.service';
import { TextosWebService } from '../../core/services/textos-web.service';
import { DEFAULT_TEXTS, WEB_TEXT_KEY_INDEX } from '../../core/cms/registro-de-textos-web';
import { NIT_DE_EJEMPLO, analizarNit } from '../../core/formularios/nit';
import { MENSAJE_DE_CORREO } from '../../core/formularios/telefono';
import { RecuperacionDeContrasenaService } from '../../core/services/recuperacion-de-contrasena.service';

/**
 * Lo que defiende esta prueba es la promesa entera del CMS aplicada a
 * /registro: que lo que una editora publica sea lo que ve el visitante, y que
 * no publicar nada no deje la página con huecos.
 *
 * Los consentimientos juridicos salen de los documentos vigentes entregados
 * por el API, no del catalogo editorial.
 */
describe('ExternalAccessPageComponent · textos del CMS', () => {
  // Las siete claves de las dos tarjetas de eleccion se fueron con las tarjetas: el alta dejo de
  // ser una eleccion entre cuenta personal y organizacion. Queda la entradilla del formulario.
  const CLAVES_DE_LA_PORTADA = [
    'access_eyebrow',
    'access_title',
    'access_intro',
    'access_footer_note',
  ];

  const montar = async (publicados: Record<string, string>) => {
    await TestBed.configureTestingModule({
      imports: [ExternalAccessPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    // Se replica el contrato del servicio, no su implementación: lo publicado
    // manda —incluida una cadena vacía, que es una publicación deliberada— y,
    // si la clave no viaja en el diccionario, entra el compilado. De ahí `??`
    // y no `||`; esa distinción se prueba donde vive, en
    // `textos-web.service.spec.ts` (PNMC-040).
    const textos = TestBed.inject(TextosWebService);
    spyOn(textos, 'getWebText').and.callFake((clave: string) => publicados[clave] ?? DEFAULT_TEXTS[clave] ?? '');

    const fixture: ComponentFixture<ExternalAccessPageComponent> = TestBed.createComponent(ExternalAccessPageComponent);
    // El registro abre en el selector de camino; estas pruebas miran el de organización.
    fixture.componentInstance.tipoDeRegistro.set('organizacion');
    fixture.detectChanges();
    return fixture;
  };

  it('todas las claves que pide la portada existen en el registro del panel', () => {
    const desconocidas = CLAVES_DE_LA_PORTADA
      .filter((clave) => !WEB_TEXT_KEY_INDEX.has(clave));

    expect(desconocidas).toEqual([]);
  });

  it('sin nada publicado la página muestra su texto compilado', async () => {
    const fixture = await montar({});
    const texto: string = fixture.nativeElement.textContent;

    expect(texto).toContain(DEFAULT_TEXTS['access_title']);
  });

  it('lo publicado reemplaza el texto compilado en la pantalla', async () => {
    const publicados = Object.fromEntries(CLAVES_DE_LA_PORTADA.map((clave) => [clave, `<<${clave}>>`]));
    const fixture = await montar(publicados);
    const texto: string = fixture.nativeElement.textContent;

    const invisibles = CLAVES_DE_LA_PORTADA.filter((clave) => !texto.includes(`<<${clave}>>`));
    expect(invisibles).toEqual([]);
  });

  it('los consentimientos muestran el TEXTO que sirve el servidor, no un enlace a él', async () => {
    // ESTE ES EL CAMBIO QUE IMPORTA. Antes la pantalla componía su propia frase —«Acepto los
    // {título} {versión}»— y lo único que viajaba era un enlace a un PDF alojado en
    // mincultura.gov.co: la evidencia de lo aceptado vivía en un servidor ajeno que puede cambiar
    // el documento sin dejar rastro aquí. Ahora se muestra el texto que el servidor copiará dentro
    // de la autorización, que es lo que la Ley 1581 obliga a poder demostrar.
    const fixture = await montar({});
    fixture.componentInstance.politicasDelRegistro.set([
      { clave: 'terminos', version: '2026-09-12', titulo: 'Términos vigentes', texto: 'ESTE ES EL TEXTO DE LOS TERMINOS', urlOficial: '/legal/terminos-v3', referenciaOficial: 'PL-GSI-001 v0', obligatoria: true },
      { clave: 'boletin', version: '2026-09-12', titulo: 'Boletín del PNMC', texto: 'ESTE ES EL TEXTO DEL BOLETIN', urlOficial: null, referenciaOficial: null, obligatoria: false },
    ]);
    fixture.componentInstance.pasoDeRegistro.set(3);
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('ESTE ES EL TEXTO DE LOS TERMINOS');
    expect(texto).toContain('ESTE ES EL TEXTO DEL BOLETIN');
    expect(texto).toContain('2026-09-12');

    // LO OBLIGATORIO SE MARCA, y por contraste lo que no lleva marca es lo opcional: el boletín. Las
    // dos autorizaciones obligatorias llevan asterisco; el rótulo «Opcional» ya no hace falta.
    expect(fixture.nativeElement.querySelectorAll('.simus-obligatorio').length).toBe(2);
    expect(texto).not.toContain('Opcional');
  });
});

/**
 * Cada pestaña, con su propia dirección.
 *
 * Hasta «Ingresar» y «Registrarse» solo cambiaban `view()`: la barra
 * de direcciones se quedaba diciendo lo mismo al pasar de una a otra, así que ningún estado se
 * podía compartir, guardar en marcadores ni recorrer con «Atrás». Lo pidió la dirección de producto.
 */
describe('ExternalAccessPageComponent · el modo de acceso en la URL', () => {
  let fixture: ComponentFixture<ExternalAccessPageComponent>;
  let componente: ExternalAccessPageComponent;
  let navegar: jasmine.Spy;

  /** `modoAcceso` reproduce la ruta explícita que montó la pantalla. */
  const montar = (modoAcceso: 'ingresar' | 'registro') => {

    TestBed.configureTestingModule({
      imports: [ExternalAccessPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}), data: { modoAcceso } },
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(ExternalAccessPageComponent);
    navegar = spyOn(TestBed.inject(Router), 'navigate');
    fixture.detectChanges();
    componente = fixture.componentInstance;
  };

  it('«Registrarse» abre la ruta pública de registro', () => {
    montar('ingresar');

    componente.openRegistrationForm();

    expect(componente.view()).toBe('register');
    expect(navegar).toHaveBeenCalledWith(['/registro']);
  });

  it('«Ingresar» abre la ruta pública de acceso', () => {
    montar('registro');

    componente.openExternalLogin();

    expect(componente.view()).toBe('login');
    expect(navegar).toHaveBeenCalledWith(['/ingresar']);
  });

  it('la dirección de acceso determina la pestaña visible al cargar', () => {
    montar('ingresar');
    expect(componente.view()).toBe('login');
    TestBed.resetTestingModule();
    montar('registro');
    expect(componente.view()).toBe('register');
  });

  it('la contraseña nace tapada y el control la muestra u oculta', () => {
    montar('ingresar');

    expect(componente.mostrarContrasena()).toBeFalse();
    componente.alternarMostrarContrasena();
    expect(componente.mostrarContrasena()).toBeTrue();
    componente.alternarMostrarContrasena();
    expect(componente.mostrarContrasena()).toBeFalse();
  });

  it('integra el control de visibilidad en el campo, sin una casilla separada', () => {
    montar('ingresar');
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector<HTMLInputElement>('#acceso-contrasena')?.type).toBe('password');
    expect(raiz.querySelector<HTMLButtonElement>('[aria-label="Mostrar contraseña"]')).not.toBeNull();
    expect(raiz.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('no revela si una cuenta existe cuando el acceso falla', () => {
    montar('ingresar');
    (componente as any).fallarInicioSesion({ status: 401, message: 'La cuenta no existe.' });

    expect(componente.error()).toBe('El correo electrónico o la contraseña no son correctos.');
  });
});

describe('ExternalAccessPageComponent · camino de registro', () => {
  const montar = () => {
    TestBed.configureTestingModule({
      imports: [ExternalAccessPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(ExternalAccessPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('el registro empieza ofreciendo dos caminos, uno individual y otro de organización', () => {
    const fixture = montar();
    const texto: string = fixture.nativeElement.textContent;

    expect(texto).toContain('Agente o actor de la música');
    expect(texto).toContain('Organización');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('el camino individual (#39) salta el paso de la organización', () => {
    const fixture = montar();
    const pagina = fixture.componentInstance;
    pagina.tipoDeRegistro.set('individual');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(pagina.pasosDelCamino().map(paso => paso.id)).toEqual([1, 3]);
    Object.assign(pagina.alta, {
      firstName: 'Lucía', firstSurname: 'Mosquera', documentType: 'cc', documentNumber: '52000111',
      email: 'lucia@example.com', password: 'ClaveExterna123', confirmPassword: 'ClaveExterna123',
    });
    pagina.pasoSiguienteRegistro();
    expect(pagina.pasoDeRegistro()).toBe(3);
    pagina.pasoAnteriorRegistro();
    expect(pagina.pasoDeRegistro()).toBe(1);
  });

  it('la cuenta individual se registra sin organización y entra a su cuenta', () => {
    const fixture = montar();
    const pagina = fixture.componentInstance;
    const admin = TestBed.inject(AdminService);
    const registrar = spyOn(admin, 'registrarCuentaExterna').and.returnValue(of({}));
    spyOn(admin, 'iniciarSesionExterna').and.returnValue(of({ userId: '1', fullName: 'Lucía', email: 'lucia@example.com', accountStatus: 'activa', organizations: [] }));
    const navegar = spyOn(TestBed.inject(Router), 'navigateByUrl').and.returnValue(Promise.resolve(true));
    pagina.tipoDeRegistro.set('individual');
    pagina.politicasDelRegistro.set([]);
    Object.assign(pagina.alta, {
      firstName: 'Lucía', firstSurname: 'Mosquera', documentType: 'cc', documentNumber: '52000111',
      email: 'lucia@example.com', password: 'ClaveExterna123', confirmPassword: 'ClaveExterna123',
    });

    pagina.registrar();

    expect(pagina.erroresAlta()).toEqual({});
    expect(registrar).toHaveBeenCalledWith(jasmine.objectContaining({ registrationType: 'individual' }));
    // llega a su espacio con la bienvenida, no a un formulario de contraseña.
    expect(navegar).toHaveBeenCalledWith('/gestion/cuenta?bienvenida=1');
  });
});

describe('ExternalAccessPageComponent · categorías opcionales del registro (DIR)', () => {
  const montar = (tipo: 'individual' | 'organizacion') => {
    TestBed.configureTestingModule({
      imports: [ExternalAccessPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(ExternalAccessPageComponent);
    fixture.componentInstance.tipoDeRegistro.set(tipo);
    fixture.detectChanges();
    return fixture;
  };

  it('solo la cuenta personal ofrece «Cómo quieres que te encuentren», y es opcional', () => {
    expect(montar('individual').nativeElement.querySelector('[data-categorias-del-registro]')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(montar('organizacion').nativeElement.querySelector('[data-categorias-del-registro]')).toBeNull();
  });

  it('envía las categorías elegidas y, si no hay ninguna, no envía nada', () => {
    const fixture = montar('individual');
    const pagina = fixture.componentInstance;
    const registrar = spyOn(TestBed.inject(AdminService), 'registrarCuentaExterna').and.returnValue(of({}));
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.returnValue(Promise.resolve(true));
    pagina.politicasDelRegistro.set([]);
    Object.assign(pagina.alta, {
      firstName: 'Lucía', firstSurname: 'Mosquera', documentType: 'cc', documentNumber: '52000111',
      email: 'lucia@example.com', password: 'ClaveExterna123', confirmPassword: 'ClaveExterna123',
    });
    pagina.registrar();
    expect(registrar.calls.mostRecent().args[0].clasificacion).toBeNull();

    pagina.categorias.set({ roles: ['docente'], servicios: ['clases'], instrumentos: [], codigosDeDepartamento: [] });
    pagina.registrar();
    expect(registrar.calls.mostRecent().args[0].clasificacion).toEqual({ roles: ['docente'], servicios: ['clases'], instrumentos: [], codigosDeDepartamento: [] });
  });
});

describe('ExternalAccessPageComponent · validación por paso y por campo', () => {
  const montar = (tipo: 'individual' | 'organizacion' = 'organizacion') => {
    TestBed.configureTestingModule({
      imports: [ExternalAccessPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(ExternalAccessPageComponent);
    fixture.componentInstance.tipoDeRegistro.set(tipo);
    fixture.detectChanges();
    return fixture;
  };
  const DATOS_DEL_PASO_1 = {
    firstName: 'Lucía', firstSurname: 'Mosquera', documentType: 'cc', documentNumber: '52000111',
    email: 'lucia@example.com', password: 'ClaveExterna123', confirmPassword: 'ClaveExterna123',
  };

  it('«Siguiente» con todo vacío NO avanza, marca el paso incompleto y dice qué falta junto a cada campo', () => {
    const fixture = montar();
    const pagina = fixture.componentInstance;

    pagina.pasoSiguienteRegistro();
    fixture.detectChanges();

    expect(pagina.pasoDeRegistro()).toBe(1);
    expect(pagina.estadoDeLosPasos()[1]).toBe('incompleto');
    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelector('#registro-firstName-error')?.textContent).toContain('Escribe el primer nombre');
    expect(raiz.querySelector('#registro-documentNumber-error')?.textContent).toContain('entre 6 y 15 cifras');
    expect(raiz.querySelector('#registro-password-error')?.textContent).toContain('12 caracteres');
    // No sale ningún aviso flotante que tape las pestañas: el mensaje vive junto al campo.
    expect(raiz.querySelector('[role="alert"].fixed')).toBeNull();
  });

  it('el foco va al primer campo con error', fakeAsync(() => {
    const fixture = montar();
    document.body.appendChild(fixture.nativeElement);

    fixture.componentInstance.pasoSiguienteRegistro();
    fixture.detectChanges();
    tick();

    expect(document.activeElement?.id).toBe('registro-firstName');
    fixture.nativeElement.remove();
  }));

  it('con el paso bien diligenciado avanza y lo marca completo', () => {
    const fixture = montar();
    const pagina = fixture.componentInstance;
    Object.assign(pagina.alta, DATOS_DEL_PASO_1);

    pagina.pasoSiguienteRegistro();

    expect(pagina.pasoDeRegistro()).toBe(2);
    expect(pagina.estadoDeLosPasos()[1]).toBe('completo');
  });

  it('el indicador no deja saltar al paso siguiente con el actual incompleto', () => {
    const fixture = montar();
    const pagina = fixture.componentInstance;

    pagina.irAlPasoDeRegistro(3);

    expect(pagina.pasoDeRegistro()).toBe(1);
    expect(pagina.erroresAlta()['firstName']).toBeTruthy();
  });

  it('cada campo se valida al salir de él, y solo ese', () => {
    const fixture = montar();
    const pagina = fixture.componentInstance;
    pagina.alta.documentNumber = '123';

    pagina.alSalirDelCampo('documentNumber');

    expect(pagina.erroresAlta()['documentNumber']).toBeTruthy();
    expect(pagina.erroresAlta()['firstName']).toBeUndefined();
  });

  it('las reglas se dicen desde el principio, también en el tipo Organización', () => {
    const fixture = montar();
    const texto: string = fixture.nativeElement.textContent;

    expect(texto).toContain('Entre 6 y 15 cifras');
    expect(texto).toContain('Entre 12 y 128 caracteres');
  });

  it('la cuenta individual se numera 1 → 2, no 1 → 3', () => {
    const fixture = montar('individual');
    const numeros = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-indicador-de-pasos li button > span:first-child'))
      .map(nodo => nodo.textContent?.trim());

    expect(numeros).toEqual(['1', '2']);
  });

  it('ofrece los diez tipos de documento del servidor', () => {
    const fixture = montar();
    const opciones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>('#registro-documentType option'))
      .map(opcion => opcion.value).filter(Boolean);

    expect(opciones).toEqual(['cc', 'ce', 'ti', 'rc', 'nuip', 'pa', 'pep', 'ppt', 'die', 'cd']);
  });

  it('al crear la cuenta con todo vacío vuelve al paso con error, sin aviso flotante, con el indicador marcado', () => {
    const fixture = montar();
    const pagina = fixture.componentInstance;
    pagina.pasoDeRegistro.set(3);

    pagina.registrar();
    fixture.detectChanges();

    expect(pagina.pasoDeRegistro()).toBe(1);
    expect(pagina.estadoDeLosPasos()[2]).toBe('incompleto');
    expect(pagina.erroresAlta()['organizationName']).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"].fixed')).toBeNull();
  });

  it('un correo ya registrado vuelve al campo con «¿Quieres ingresar?» en lugar de un error técnico', () => {
    const fixture = montar('individual');
    const pagina = fixture.componentInstance;
    const admin = TestBed.inject(AdminService);
    spyOn(admin, 'registrarCuentaExterna').and.returnValue(throwError(() => ({
      status: 409, message: 'No fue posible registrar el usuario externo. Ya existe una cuenta registrada con ese correo.',
      payload: { message: 'Ya existe una cuenta registrada con ese correo.' },
    })));
    pagina.politicasDelRegistro.set([]);
    Object.assign(pagina.alta, DATOS_DEL_PASO_1);

    pagina.registrar();
    fixture.detectChanges();

    expect(pagina.pasoDeRegistro()).toBe(1);
    expect(pagina.erroresAlta()['email']).toBe('Ya hay una cuenta con este correo. ¿Quieres ingresar?');
    expect(pagina.error()).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-correo-ya-registrado]')).not.toBeNull();
  });

  it('el motivo que rechaza el servidor vuelve a su campo, con su paso marcado', () => {
    const fixture = montar();
    const pagina = fixture.componentInstance;
    spyOn(TestBed.inject(AdminService), 'registrarCuentaExterna').and.returnValue(throwError(() => ({
      status: 400, message: 'x', payload: { errors: { documentNumber: ['Ya existe una cuenta con ese documento. Si es tuya, inicia sesión.'] } },
    })));
    pagina.politicasDelRegistro.set([]);
    Object.assign(pagina.alta, DATOS_DEL_PASO_1, { organizationName: 'Org', headquartersDepartmentCode: '05', headquartersMunicipalityCode: '05001' });

    pagina.registrar();

    expect(pagina.erroresAlta()['documentNumber']).toContain('Ya existe una cuenta');
    expect(pagina.pasoDeRegistro()).toBe(1);
  });
});

describe('ExternalAccessPageComponent · recuperar la contraseña', () => {
  class ServicioFalso {
    pedidos: string[] = [];
    fallo: unknown = null;
    async solicitar(correo: string): Promise<string> {
      this.pedidos.push(correo);
      if (this.fallo) throw this.fallo;
      return 'Si existe una cuenta externa con ese correo, te enviamos un enlace.';
    }
  }

  const montar = (consulta: Record<string, string> = {}) => {
    const servicio = new ServicioFalso();
    TestBed.configureTestingModule({
      imports: [ExternalAccessPageComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: RecuperacionDeContrasenaService, useValue: servicio },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { modoAcceso: 'ingresar' }, queryParamMap: convertToParamMap(consulta) } } },
      ],
    });
    const fixture = TestBed.createComponent(ExternalAccessPageComponent);
    fixture.detectChanges();
    return { fixture, servicio, raiz: fixture.nativeElement as HTMLElement };
  };

  it('«¿Olvidaste tu contraseña?» abre el formulario de recuperación, con el correo ya escrito, y no el aviso de «muy pronto»', () => {
    const { fixture, raiz } = montar();
    fixture.componentInstance.login.email = 'lucia@example.com';

    raiz.querySelector<HTMLButtonElement>('[data-testid="olvide-mi-contrasena"]')!.click();
    fixture.detectChanges();

    expect(raiz.querySelector('[data-testid="recuperacion-formulario"]')).not.toBeNull();
    expect(fixture.componentInstance.correoDeRecuperacion).toBe('lucia@example.com');
    expect(raiz.textContent).not.toContain('muy pronto');
  });

  it('dice explícitamente que las cuentas de la consola no usan este flujo', () => {
    const { fixture, raiz } = montar();
    raiz.querySelector<HTMLButtonElement>('[data-testid="olvide-mi-contrasena"]')!.click();
    fixture.detectChanges();

    expect(raiz.querySelector('#recuperacion-nota')?.textContent).toContain('consola de administración no se recuperan por correo');
  });

  it('el enlace ?recuperar=1 desde una página de enlace vencido abre directamente el formulario', () => {
    const { raiz } = montar({ recuperar: '1' });

    expect(raiz.querySelector('[data-testid="recuperacion-formulario"]')).not.toBeNull();
  });

  it('un correo mal escrito se dice junto al campo y no se envía nada', async () => {
    const { fixture, raiz, servicio } = montar({ recuperar: '1' });
    fixture.componentInstance.correoDeRecuperacion = 'no-es-un-correo';

    await fixture.componentInstance.solicitarRecuperacion();
    fixture.detectChanges();

    expect(servicio.pedidos).toEqual([]);
    expect(raiz.querySelector('#recuperacion-correo-error')?.textContent).toContain('correo');
    expect(raiz.querySelector('#recuperacion-correo')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('al enviar muestra «Revisa tu correo» con el mensaje neutro del servidor, igual exista o no la cuenta', async () => {
    const { fixture, raiz, servicio } = montar({ recuperar: '1' });
    fixture.componentInstance.correoDeRecuperacion = 'alguien@example.com';

    await fixture.componentInstance.solicitarRecuperacion();
    fixture.detectChanges();

    expect(servicio.pedidos).toEqual(['alguien@example.com']);
    const enviada = raiz.querySelector('[data-testid="recuperacion-enviada"]')!;
    expect(enviada.querySelector('h2')?.textContent).toContain('Revisa tu correo');
    expect(enviada.querySelector('[role="status"]')?.textContent).toContain('Si existe una cuenta');
  });

  it('un 429 se traduce con el traductor compartido, junto al campo', async () => {
    const { fixture, raiz, servicio } = montar({ recuperar: '1' });
    servicio.fallo = { status: 429, message: 'x', payload: null };
    fixture.componentInstance.correoDeRecuperacion = 'alguien@example.com';

    await fixture.componentInstance.solicitarRecuperacion();
    fixture.detectChanges();

    expect(raiz.querySelector('#recuperacion-correo-error')?.textContent).toContain('demasiados intentos');
  });

  it('«Volver a ingresar» regresa al formulario de ingreso conservando el correo', () => {
    const { fixture, raiz } = montar({ recuperar: '1' });
    fixture.componentInstance.correoDeRecuperacion = 'lucia@example.com';

    fixture.componentInstance.cerrarRecuperacion();
    fixture.detectChanges();

    expect(raiz.querySelector('#acceso-correo')).not.toBeNull();
    expect(fixture.componentInstance.login.email).toBe('lucia@example.com');
  });
});

describe('ExternalAccessPageComponent · una sola cabecera y registro de invitados', () => {
  const montar = (modo: 'registro' | 'ingresar') => {
    TestBed.configureTestingModule({
      imports: [ExternalAccessPageComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { modoAcceso: modo }, queryParamMap: convertToParamMap({}) } } },
      ],
    });
    const fixture = TestBed.createComponent(ExternalAccessPageComponent);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement, http: TestBed.inject(HttpTestingController) };
  };

  afterEach(() => { try { sessionStorage.removeItem('simus.invitacionPendiente'); } catch { /* sin almacenamiento */ } });

  it('el registro dice su mensaje UNA vez: la columna blanca no repite el título ni la presentación, y no llama «Acceso externo» a la cuenta', () => {
    const { raiz } = montar('registro');
    const texto = raiz.textContent ?? '';

    expect(texto.match(/Haz parte del ecosistema/g)?.length).toBe(1);
    expect(texto.match(/Crea tu cuenta, gestiona organizaciones/g)?.length).toBe(1);
    expect(texto).not.toContain('Acceso externo');
    expect(texto).toContain('mantén actualizada');
    expect(raiz.querySelector('h1')?.textContent).toContain('Crea tu cuenta');
  });

  it('quien llega desde una invitación pendiente no elige tipo: se le dice a qué organización, con qué rol y a qué correo', async () => {
    sessionStorage.setItem('simus.invitacionPendiente', '/ecosistema/invitacion?testigo=' + 'a'.repeat(64));
    const { fixture, raiz, http } = montar('registro');

    http.expectOne(candidata => candidata.url.endsWith('/api/v1/externo/invitaciones/consultar')).flush({
      organizacion: 'Red de Gaitas', rol: 'editor', correoInvitado: 'l•••a@example.com', estado: 'pendiente', fechaExpiracion: '2026-11-13',
    });
    await new Promise<void>(resolver => setTimeout(resolver));
    fixture.detectChanges();

    expect(fixture.componentInstance.tipoDeRegistro()).toBe('individual');
    expect(raiz.querySelector('[data-testid="registro-invitacion"]')?.textContent).toContain('Red de Gaitas');
    expect(raiz.querySelector('[data-testid="registro-invitacion"]')?.textContent).toContain('l•••a@example.com');
    // ACC-02: se dice para qué se piden el nombre y el documento, y solo lo que el sistema cumple.
    expect(raiz.querySelector('[data-testid="registro-invitacion-datos"]')?.textContent).toContain('ninguna ficha pública');
    expect(raiz.textContent).not.toContain('¿Cómo quieres registrarte?');
    expect(Array.from(raiz.querySelectorAll('button')).some(b => b.textContent?.includes('Cambiar tipo de registro'))).toBeFalse();
  });

  it('una invitación que ya no sirve no cambia el registro', async () => {
    sessionStorage.setItem('simus.invitacionPendiente', '/ecosistema/invitacion?testigo=' + 'b'.repeat(64));
    const { fixture, raiz, http } = montar('registro');

    http.expectOne(candidata => candidata.url.endsWith('/api/v1/externo/invitaciones/consultar')).flush({
      organizacion: 'Red de Gaitas', rol: 'editor', correoInvitado: 'l•••a@example.com', estado: 'revocada', fechaExpiracion: '2026-11-13',
    });
    await new Promise<void>(resolver => setTimeout(resolver));
    fixture.detectChanges();

    expect(fixture.componentInstance.tipoDeRegistro()).toBeNull();
    expect(raiz.querySelector('[data-testid="registro-invitacion"]')).toBeNull();
  });
});

/** L-1, L-2 y L-3: ejemplos de fondo, validación en vivo con pausa y política de claves a la vista. */
describe('ExternalAccessPageComponent · ejemplos y validación en vivo (L-1, L-2, L-3)', () => {
  const montar = (modoAcceso: 'ingresar' | 'registro', tipo: 'individual' | 'organizacion' | null = null) => {
    TestBed.configureTestingModule({
      imports: [ExternalAccessPageComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}), data: { modoAcceso } }, queryParamMap: of(convertToParamMap({})) } },
      ],
    });
    const fixture = TestBed.createComponent(ExternalAccessPageComponent);
    if (tipo) fixture.componentInstance.tipoDeRegistro.set(tipo);
    fixture.detectChanges();
    flushMicrotasks(); // ngModel registra sus controles en una microtarea
    fixture.detectChanges();
    return fixture;
  };
  const escribir = (fixture: ComponentFixture<ExternalAccessPageComponent>, id: string, valor: string) => {
    const campo = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('los campos vacíos muestran un ejemplo y conservan su etiqueta visible', fakeAsync(() => {
    const fixture = montar('registro', 'individual');
    const raiz: HTMLElement = fixture.nativeElement;
    for (const id of ['registro-documentNumber', 'registro-phone', 'registro-email', 'registro-password']) {
      expect(raiz.querySelector(`#${id}`)?.getAttribute('placeholder')).toBeTruthy();
      expect(raiz.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
    expect(raiz.querySelector('#registro-email')?.getAttribute('placeholder')).toContain('nombre@correo.org');
  }));

  it('el ejemplo es solo el valor: sin «Ejemplo:» y sin «opcional» (esa palabra va una sola vez, en la etiqueta)', fakeAsync(() => {
    const fixture = montar('registro', 'individual');
    const raiz: HTMLElement = fixture.nativeElement;
    for (const campo of Array.from(raiz.querySelectorAll('input[placeholder]'))) {
      expect(campo.getAttribute('placeholder')).not.toMatch(/ejemplo|opcional/i);
    }
    for (const id of ['registro-secondName', 'registro-secondSurname', 'registro-phone']) {
      expect(raiz.querySelector(`label[for="${id}"]`)?.textContent).toContain('(opcional)');
    }
    expect(MENSAJE_DE_CORREO).toContain('nombre@correo.org');
  }));

  it('los cuatro campos de nombre no llevan marcador: etiqueta visible, pista persistente una vez y autocomplete del estándar', fakeAsync(() => {
    const fixture = montar('registro', 'individual');
    const raiz: HTMLElement = fixture.nativeElement;
    const esperado: Record<string, [string, string]> = {
      'registro-firstName': ['Primer nombre', 'given-name'],
      'registro-secondName': ['Segundo nombre (opcional)', 'additional-name'],
      'registro-firstSurname': ['Primer apellido', 'family-name'],
      'registro-secondSurname': ['Segundo apellido (opcional)', 'off'],
    };
    for (const [id, [etiqueta, auto]] of Object.entries(esperado)) {
      const campo = raiz.querySelector(`#${id}`) as HTMLInputElement;
      expect(campo.hasAttribute('placeholder')).withContext(id).toBeFalse();
      expect(raiz.querySelector(`label[for="${id}"]`)?.textContent).toContain(etiqueta);
      expect(campo.getAttribute('autocomplete')).toBe(auto);
      expect(campo.getAttribute('spellcheck')).toBe('false');
      expect(campo.getAttribute('autocapitalize')).toBe('words');
      expect(campo.getAttribute('aria-describedby')).toContain('registro-nombres-ayuda');
    }
    const ayuda = raiz.querySelectorAll('#registro-nombres-ayuda');
    expect(ayuda.length).toBe(1);
    expect(ayuda[0].textContent).toContain('Escríbelos como figuran en tu documento de identidad.');
  }));

  it('el marcador se distingue del texto escrito: más claro, sin cursiva y con contraste AA', fakeAsync(() => {
    const fixture = montar('registro', 'individual');
    document.body.appendChild(fixture.nativeElement);
    const campo = fixture.nativeElement.querySelector('#registro-email') as HTMLInputElement;
    const pie = getComputedStyle(campo, '::placeholder');
    expect(pie.fontStyle).toBe('normal');
    const luz = (css: string) => {
      const [r, g, b] = (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contraste = (1 + 0.05) / (luz(pie.color) + 0.05);
    expect(contraste).toBeGreaterThanOrEqual(4.5);
    expect(luz(pie.color)).toBeGreaterThan(luz(getComputedStyle(campo).color));
    fixture.nativeElement.remove();
  }));

  it('el ejemplo de fondo del NIT es un NIT válido', fakeAsync(() => {
    const fixture = montar('registro', 'organizacion');
    fixture.componentInstance.preparando.set(false);
    fixture.componentInstance.pasoDeRegistro.set(2);
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    const marcador = fixture.nativeElement.querySelector('#registro-organizationIdentificationNumber')?.getAttribute('placeholder');
    expect(marcador).toBe(NIT_DE_EJEMPLO);
    expect(analizarNit(marcador).resultado).toBe('valido');
  }));

  it('el ingreso también muestra un correo de ejemplo', fakeAsync(() => {
    const fixture = montar('ingresar');
    expect(fixture.nativeElement.querySelector('#acceso-correo').getAttribute('placeholder')).toContain('@');
  }));

  it('el correo mal escrito se avisa solo tras una pausa, y uno bueno se marca al instante', fakeAsync(() => {
    const fixture = montar('registro', 'individual');
    escribir(fixture, 'registro-email', 'lucia@');
    expect(fixture.componentInstance.erroresAlta()['email']).toBeUndefined();
    tick(450); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#registro-email-error')?.textContent).toContain('correo electrónico válido');

    escribir(fixture, 'registro-email', 'lucia@example.com');
    expect(fixture.componentInstance.erroresAlta()['email']).toBeUndefined();
    expect(fixture.nativeElement.querySelector('[data-campo-correcto]')?.textContent).toContain('Correo');
  }));

  it('la contraseña marca cada regla de la política mientras se escribe', fakeAsync(() => {
    const fixture = montar('registro', 'individual');
    const raiz: HTMLElement = fixture.nativeElement;
    const cumple = (regla: string) => raiz.querySelector(`[data-regla="${regla}"]`)?.getAttribute('data-cumple');
    expect(cumple('longitud')).toBe('false');
    escribir(fixture, 'registro-password', 'corta');
    expect(cumple('longitud')).toBe('false');
    escribir(fixture, 'registro-password', 'Una frase larga y rara 77');
    expect(cumple('longitud')).toBe('true');
    expect(cumple('predecible')).toBe('true');
    escribir(fixture, 'registro-password', 'aaaaaaaaaaaaaa');
    expect(cumple('predecible')).toBe('false');
  }));

  it('la confirmación avisa que no coincide tras una pausa y se marca cuando coincide', fakeAsync(() => {
    const fixture = montar('registro', 'individual');
    escribir(fixture, 'registro-password', 'Una frase larga y rara 77');
    escribir(fixture, 'registro-confirmPassword', 'Otra');
    tick(450); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#registro-confirmPassword-error')?.textContent).toContain('no coinciden');
    escribir(fixture, 'registro-confirmPassword', 'Una frase larga y rara 77');
    expect(fixture.nativeElement.querySelector('#registro-confirmPassword-error')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Las contraseñas coinciden');
  }));

  it('el botón del ingreso queda en progreso mientras se envía', fakeAsync(() => {
    const fixture = montar('ingresar');
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    const boton = fixture.nativeElement.querySelector('[data-testid="acceso-ingresar"]') as HTMLButtonElement;
    expect(boton.disabled).toBeTrue();
    expect(boton.getAttribute('aria-busy')).toBe('true');
    expect(boton.textContent).toContain('Ingresando');
  }));

  it('el registro ofrece volver a ingresar y el ingreso ofrece crear una cuenta', fakeAsync(() => {
    const registro = montar('registro');
    expect(registro.nativeElement.textContent).toContain('¿Ya tienes cuenta?');
    expect(registro.nativeElement.querySelector('[data-testid="registro-tipo-individual"]')).not.toBeNull();
    TestBed.resetTestingModule();
    const ingreso = montar('ingresar');
    expect(ingreso.nativeElement.querySelector('[data-testid="acceso-ir-a-registro"]')).not.toBeNull();
  }));
});
