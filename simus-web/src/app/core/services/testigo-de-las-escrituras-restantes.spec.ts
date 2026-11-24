import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService } from './admin.service';
import { AdministracionDeCuentasService } from './administracion-de-cuentas.service';
import { AsistenciaAOrganizacionService } from './asistencia-a-organizacion.service';
import { BoletinService } from './boletin.service';

/**
 * Todas las escrituras de la consola que antes se mandaban sin testigo lo mandan ahora (G5, SEG-03):
 * cuentas y sus módulos, asistencia a organizaciones, baja del boletín y gobernanza de registros.
 *
 * <b>EL DEFECTO QUE TRAJO ESTAS PRUEBAS.</b> El servidor exigía el testigo en una parte de las
 * escrituras de la consola y no en estas; al cerrarlas, si la web dejara de mandarlo, todas
 * fallarían con «no pudo validarse». Cada prueba pide el testigo a la ruta común y comprueba la
 * cabecera de la escritura.
 */
describe('Testigo de las escrituras restantes de la consola', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** El testigo se resuelve en una microtarea: se espera a que la escritura salga. */
  async function microtareas(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  /** Atiende el testigo y devuelve la escritura que salió con él, comprobando la cabecera. */
  async function escrituraConTestigo(metodo: string, fin: string, testigo: string) {
    http.expectOne(r => r.url.endsWith('/api/v1/admin/csrf')).flush({ requestToken: testigo });
    await microtareas();
    const escritura = http.expectOne(r => r.method === metodo && r.url.endsWith(fin));
    expect(escritura.request.headers.get('X-CSRF-TOKEN')).toBe(testigo);
    return escritura;
  }

  it('guardar una cuenta, cambiar contraseña y completar perfil mandan el testigo', async () => {
    const servicio = TestBed.inject(AdministracionDeCuentasService);

    servicio.guardarCuentaAdministrativa({} as never).subscribe();
    (await escrituraConTestigo('POST', '/api/v1/admin/auth/users', 'u1')).flush({ user: {} });

    servicio.cambiarMiContrasena('a', 'b').subscribe();
    (await escrituraConTestigo('POST', '/api/v1/admin/auth/mi-contrasena', 'u2')).flush({});

    servicio.completarMiPerfil({} as never).subscribe();
    (await escrituraConTestigo('POST', '/api/v1/admin/auth/mi-perfil', 'u3')).flush({});

    servicio.actualizarPerfil({}).subscribe();
    (await escrituraConTestigo('PUT', '/api/v1/admin/auth/profile', 'u4')).flush({});
  });

  it('guardar los módulos, desactivar y eliminar una cuenta mandan el testigo de la consola', async () => {
    const servicio = TestBed.inject(AdministracionDeCuentasService);

    servicio.guardarModulosDeCuenta('7', ['agenda']).subscribe();
    (await escrituraConTestigo('PUT', '/api/v1/admin/usuarios/7/modulos', 'm1')).flush({});

    servicio.desactivarCuenta('7').subscribe();
    (await escrituraConTestigo('DELETE', '/api/v1/admin/auth/users/7', 'm2')).flush(null);

    servicio.eliminarCuentaDefinitivamente('7').subscribe();
    (await escrituraConTestigo('DELETE', '/api/v1/admin/auth/users/7/definitiva', 'm3')).flush(null);
  });

  it('la asistencia a una organización manda el testigo en sus cuatro escrituras', async () => {
    const servicio = TestBed.inject(AsistenciaAOrganizacionService);

    const a = servicio.escribir(3, { asunto: 'a', mensaje: 'b' });
    (await escrituraConTestigo('POST', '/api/v1/admin/organizaciones/3/mensajes', 'o1')).flush({ destinatarios: 1 });
    await a;

    const b = servicio.cambiarEstado(3, { activa: false, motivo: 'x' });
    (await escrituraConTestigo('POST', '/api/v1/admin/organizaciones/3/estado', 'o2')).flush({});
    await b;

    const c = servicio.confirmarCorreo(3, { motivo: 'x' });
    (await escrituraConTestigo('POST', '/api/v1/admin/organizaciones/3/confirmar-correo', 'o3')).flush({});
    await c;

    const d = servicio.revisar(3, { revisada: true });
    (await escrituraConTestigo('POST', '/api/v1/admin/organizaciones/3/revision', 'o4')).flush({});
    await d;
  });

  it('dar de baja una suscripción del boletín manda el testigo', async () => {
    TestBed.inject(BoletinService).darDeBaja(5).subscribe();
    (await escrituraConTestigo('POST', '/api/v1/admin/comunicaciones/boletin/5/baja', 'b1')).flush({ message: 'ok' });
  });

  it('las decisiones de gobernanza de registros mandan el testigo', async () => {
    const servicio = TestBed.inject(AdminService);

    servicio.decidirSolicitudDeVinculacion({ id: '1', status: 'aprobada' }).subscribe();
    (await escrituraConTestigo('POST', '/api/v1/admin/solicitudes-de-vinculacion/1/status', 'g1')).flush({});

    servicio.crearPosibleDuplicado({ moduleId: 'festivals', sourceRecordId: '1', candidateRecordId: '2', similarityLevel: 'alta' }).subscribe();
    (await escrituraConTestigo('POST', '/api/v1/admin/duplicates', 'g2')).flush({});

    servicio.decidirPosibleDuplicado({ id: '1', decision: 'descartar' }).subscribe();
    (await escrituraConTestigo('POST', '/api/v1/admin/duplicates/1/decision', 'g3')).flush({});

    servicio.crearAlertaDeCalidad({ moduleId: 'festivals', recordId: '1', flagType: 'x', severity: 'baja', detail: 'd' }).subscribe();
    (await escrituraConTestigo('POST', '/api/v1/admin/data-quality/flags', 'g4')).flush({});

    servicio.decidirAlertaDeCalidad({ id: '1', status: 'resuelta' }).subscribe();
    (await escrituraConTestigo('POST', '/api/v1/admin/data-quality/flags/1/status', 'g5')).flush({});
  });
});
