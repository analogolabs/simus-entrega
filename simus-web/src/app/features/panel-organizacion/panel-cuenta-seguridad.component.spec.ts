import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { computed, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { CuentaExternaApi, PerfilDeCuenta } from './cuenta-externa.api';
import { PanelCuentaSeguridadComponent } from './panel-cuenta-seguridad.component';
import { ExternalSessionService, SesionExterna } from '../../core/services/external-session.service';
import { AdminService } from '../../core/services/admin.service';
import { UbicacionDivipola } from '../../core/territorio/ubicacion-divipola';

/**
 * La ruta «Cuenta y seguridad», en /gestion/cuenta-seguridad.
 *
 * El correo de acceso de solo lectura, los datos personales y la contraseña, y «Cerrar
 * sesión».
 */
class SesionFalsa {
  readonly interna = signal<SesionExterna | null>(null);
  readonly actual = this.interna.asReadonly();
  readonly organizaciones = computed(() => this.interna()?.organizations ?? []);
  vecesQueSalio = 0;

  establecer(sesion: SesionExterna | null): void {
    this.interna.set(sesion);
  }

  salir(): Observable<unknown> {
    this.vecesQueSalio += 1;
    this.interna.set(null);
    return of(null);
  }
}

const SESION: SesionExterna = {
  userId: '9',
  fullName: 'Ana Restrepo',
  email: 'ana@fmv.org',
  accountStatus: 'activa',
  organizations: [{ id: '117', name: 'Fundación Musical del Valle', role: 'administrador' }],
};

const PERFIL: PerfilDeCuenta = {
  email: 'ana@fmv.org', tipoPerfil: 'organizacion', primerNombre: 'Ana', segundoNombre: null,
  primerApellido: 'Restrepo', segundoApellido: null, tipoDocumento: 'cc', numeroDocumento: '43123456', telefono: null,
};

const UBICACIONES = [
  { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05001', municipalityName: 'Medellín' },
  { departmentCode: '11', departmentName: 'Bogotá D.C.', municipalityCode: '11001', municipalityName: 'Bogotá D.C.' },
] as unknown as UbicacionDivipola[];
const ADMIN_FALSO = { provide: AdminService, useValue: { cargarDivipolaPublica: () => of(UBICACIONES) } };

describe('PanelCuentaSeguridadComponent', () => {
  let fixture: ComponentFixture<PanelCuentaSeguridadComponent>;
  let sesion: SesionFalsa;
  let navegar: jasmine.Spy;
  let cuentaApi: jasmine.SpyObj<CuentaExternaApi>;

  beforeEach(() => {
    sesion = new SesionFalsa();
    sesion.establecer(SESION);
    cuentaApi = jasmine.createSpyObj<CuentaExternaApi>('CuentaExternaApi', ['obtenerPerfil', 'actualizarPerfil', 'cambiarContrasena']);
    cuentaApi.obtenerPerfil.and.returnValue(of(PERFIL));
    cuentaApi.actualizarPerfil.and.callFake(cambios => of({ ...PERFIL, ...cambios }));
    cuentaApi.cambiarContrasena.and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [PanelCuentaSeguridadComponent],
      providers: [
        provideRouter([]),
        { provide: ExternalSessionService, useValue: sesion },
        { provide: CuentaExternaApi, useValue: cuentaApi },
        ADMIN_FALSO,
      ],
    });
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(PanelCuentaSeguridadComponent);
    fixture.detectChanges();
  });

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('muestra el correo de acceso de la sesión', () => {
    expect(raiz().textContent).toContain('ana@fmv.org');
  });

  it('no promete una segunda foto: la de la persona es la de su perfil público', () => {
    expect(raiz().textContent).not.toContain('Editar foto de perfil');
    expect(raiz().textContent).not.toContain('cuando el almacenamiento de imágenes esté disponible');
    expect(raiz().querySelector('[data-testid="foto-de-la-persona"] a')?.getAttribute('href')).toBe('/gestion/cuenta/perfil-publico');
  });

  it('carga los datos personales en el formulario y los guarda (#39)', async () => {
    await fixture.whenStable();
    const componente = fixture.componentInstance;
    expect(componente.perfil.primerNombre).toBe('Ana');

    componente.perfil.segundoNombre = 'María';
    componente.guardarPerfil();
    fixture.detectChanges();

    expect(cuentaApi.actualizarPerfil).toHaveBeenCalledWith(jasmine.objectContaining({ segundoNombre: 'María', numeroDocumento: '43123456' }));
    expect(raiz().textContent).toContain('Tus datos quedaron guardados.');
  });

  it('no envía datos personales incompletos', () => {
    const componente = fixture.componentInstance;
    componente.perfil = { ...componente.perfil, primerNombre: ' ', numeroDocumento: '12' };
    componente.guardarPerfil();
    fixture.detectChanges();

    expect(cuentaApi.actualizarPerfil).not.toHaveBeenCalled();
    expect(raiz().querySelector('#perfil-primerNombre')?.getAttribute('aria-invalid')).toBe('true');
    expect(raiz().querySelector('#perfil-numeroDocumento')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('guarda la residencia y el canal de contacto como datos opcionales (docs/desarrollo/19-cuentas-y-organizaciones.md §19.14)', () => {
    const componente = fixture.componentInstance;
    expect(componente.perfil.residenciaCodigoMunicipio).toBe('');

    componente.elegirResidencia({ departamento: '05', municipio: '05001' });
    componente.perfil.canalDeContactoPreferido = 'correo';
    componente.guardarPerfil();
    fixture.detectChanges();

    expect(cuentaApi.actualizarPerfil).toHaveBeenCalledWith(jasmine.objectContaining({
      residenciaCodigoDepartamento: '05', residenciaCodigoMunicipio: '05001', canalDeContactoPreferido: 'correo',
    }));
    expect(raiz().querySelector('[data-datos-opcionales]')?.textContent).toContain('opcionales y privados');
    // Opcionales: sin elegir nada se guarda igual, con vacíos como nulos.
    componente.elegirResidencia({ departamento: '', municipio: '' });
    componente.perfil.canalDeContactoPreferido = '';
    componente.guardarPerfil();
    expect(cuentaApi.actualizarPerfil.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      residenciaCodigoDepartamento: null, residenciaCodigoMunicipio: null, canalDeContactoPreferido: null,
    }));
  });

  it('no deja preferir el teléfono sin teléfono', () => {
    const componente = fixture.componentInstance;
    componente.perfil.canalDeContactoPreferido = 'telefono';
    componente.guardarPerfil();
    fixture.detectChanges();
    expect(cuentaApi.actualizarPerfil).not.toHaveBeenCalled();
    expect(raiz().querySelector('#perfil-canalDeContactoPreferido-error')?.textContent).toContain('escribe tu número');
  });

  it('cambia la contraseña y avisa que se cerraron las demás sesiones', () => {
    const componente = fixture.componentInstance;
    componente.clave = { actual: 'ClaveExterna123', nueva: 'NuevaClaveSegura#2026', confirmacion: 'NuevaClaveSegura#2026' };
    componente.cambiarContrasena();
    fixture.detectChanges();

    expect(cuentaApi.cambiarContrasena).toHaveBeenCalledWith('ClaveExterna123', 'NuevaClaveSegura#2026');
    expect(raiz().textContent).toContain('Las demás sesiones abiertas con tu cuenta se cerraron.');
    expect(componente.clave.actual).toBe('');
  });

  it('pone junto al campo el rechazo del servidor a la contraseña actual', () => {
    cuentaApi.cambiarContrasena.and.returnValue(throwError(() => ({ message: 'x', payload: { errors: { actual: ['La contraseña actual no es la correcta.'] } } })));
    const componente = fixture.componentInstance;
    componente.clave = { actual: 'otra', nueva: 'NuevaClaveSegura#2026', confirmacion: 'NuevaClaveSegura#2026' };
    componente.cambiarContrasena();
    fixture.detectChanges();

    expect(raiz().querySelector('#clave-actual-error')?.textContent).toContain('no es la correcta');
  });

  it('«Cerrar sesión» cierra la sesión y vuelve al inicio', () => {
    const boton = Array.from(raiz().querySelectorAll('button'))
      .find(candidato => (candidato.textContent ?? '').trim() === 'Cerrar sesión');
    expect(boton).withContext('no se pintó «Cerrar sesión»').toBeTruthy();

    boton!.click();

    expect(sesion.vecesQueSalio).toBe(1);
    expect(navegar).toHaveBeenCalledWith(['/']);
  });
});

describe('PanelCuentaSeguridadComponent: carga de los datos', () => {
  it('enseña la forma mientras carga y un error con Reintentar si falla, y se recupera', async () => {
    const sesion = new SesionFalsa();
    sesion.establecer(SESION);
    const cuentaApi = jasmine.createSpyObj<CuentaExternaApi>('CuentaExternaApi', ['obtenerPerfil', 'actualizarPerfil', 'cambiarContrasena']);
    cuentaApi.obtenerPerfil.and.returnValue(throwError(() => new Error('Sin conexión')));
    TestBed.configureTestingModule({
      imports: [PanelCuentaSeguridadComponent],
      providers: [provideRouter([]), { provide: ExternalSessionService, useValue: sesion }, { provide: CuentaExternaApi, useValue: cuentaApi }, ADMIN_FALSO,
        { provide: ActivatedRoute, useValue: { snapshot: { data: { vista: 'datos' } } } }],
    });
    const fixture = TestBed.createComponent(PanelCuentaSeguridadComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('[data-testid="datos-con-error"]')?.textContent).toContain('Sin conexión');
    expect(raiz.querySelector('#perfil-primerNombre')).toBeNull();

    cuentaApi.obtenerPerfil.and.returnValue(of(PERFIL));
    (raiz.querySelector('[data-testid="datos-reintentar"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    // ngModel escribe el valor del campo en una microtarea: se espera a que se asiente.
    await fixture.whenStable();
    fixture.detectChanges();
    expect(raiz.querySelector('[data-testid="datos-con-error"]')).toBeNull();
    expect((raiz.querySelector('#perfil-primerNombre') as HTMLInputElement).value).toBe('Ana');
  });

  it('pinta el esqueleto de inmediato, antes de que lleguen los datos', () => {
    const sesion = new SesionFalsa();
    sesion.establecer(SESION);
    const cuentaApi = jasmine.createSpyObj<CuentaExternaApi>('CuentaExternaApi', ['obtenerPerfil', 'actualizarPerfil', 'cambiarContrasena']);
    cuentaApi.obtenerPerfil.and.returnValue(new Observable(() => undefined));
    TestBed.configureTestingModule({
      imports: [PanelCuentaSeguridadComponent],
      providers: [provideRouter([]), { provide: ExternalSessionService, useValue: sesion }, { provide: CuentaExternaApi, useValue: cuentaApi }, ADMIN_FALSO,
        { provide: ActivatedRoute, useValue: { snapshot: { data: { vista: 'datos' } } } }],
    });
    const fixture = TestBed.createComponent(PanelCuentaSeguridadComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="datos-cargando"]')).not.toBeNull();
  });
});

/**
 * LAS DOS VISTAS (ME): `datos` y `seguridad` salen de `data.vista` de la ruta y cada una usa todo el
 * ancho, con su cuadrícula; antes todo se apilaba en una columna estrecha (`max-w-xl`).
 */
describe('PanelCuentaSeguridadComponent: vistas de la ruta', () => {
  function montar(vista?: 'datos' | 'seguridad'): HTMLElement {
    const sesion = new SesionFalsa();
    sesion.establecer(SESION);
    const cuentaApi = jasmine.createSpyObj<CuentaExternaApi>('CuentaExternaApi', ['obtenerPerfil', 'actualizarPerfil', 'cambiarContrasena']);
    cuentaApi.obtenerPerfil.and.returnValue(of(PERFIL));
    TestBed.configureTestingModule({
      imports: [PanelCuentaSeguridadComponent],
      providers: [
        provideRouter([]),
        { provide: ExternalSessionService, useValue: sesion },
        { provide: CuentaExternaApi, useValue: cuentaApi },
        ADMIN_FALSO,
        { provide: ActivatedRoute, useValue: { snapshot: { data: vista ? { vista } : {} } } },
      ],
    });
    const fixture = TestBed.createComponent(PanelCuentaSeguridadComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('«Datos personales» muestra los datos y el correo de acceso, y manda a seguridad por la contraseña', () => {
    const raiz = montar('datos');

    expect(raiz.querySelector('#datos-titulo')).not.toBeNull();
    expect(raiz.querySelector('#cuenta-titulo')?.textContent).toContain('Correo de acceso');
    expect(raiz.querySelector('#seguridad-titulo')).toBeNull();
    expect(raiz.querySelector('app-mis-autorizaciones')).toBeNull();
    expect(raiz.querySelector('a[href="/gestion/cuenta/seguridad"]')).not.toBeNull();
    expect(raiz.querySelector('.max-w-xl')).toBeNull();
  });

  it('«Contraseña y seguridad» muestra la contraseña y cerrar sesión, sin las autorizaciones, que tienen su pantalla; y manda a datos por lo personal', () => {
    const raiz = montar('seguridad');

    expect(raiz.querySelector('#seguridad-titulo')).not.toBeNull();
    // Las autorizaciones ya no viven aquí (PERF): son «Mis autorizaciones», en /gestion/cuenta/autorizaciones.
    expect(raiz.querySelector('app-mis-autorizaciones')).toBeNull();
    expect(raiz.querySelector('a[href="/gestion/cuenta/autorizaciones"]')).not.toBeNull();
    expect(raiz.querySelector('#cerrar-sesion-titulo')).not.toBeNull();
    expect(raiz.querySelector('#datos-titulo')).toBeNull();
    expect(raiz.querySelector('a[href="/gestion/cuenta/datos"]')).not.toBeNull();
  });

  it('sin vista en la ruta se ve todo, como la pantalla de antes', () => {
    const raiz = montar();

    expect(raiz.querySelector('#datos-titulo')).not.toBeNull();
    expect(raiz.querySelector('#seguridad-titulo')).not.toBeNull();
  });
});
