import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdministracionDeCuentasService, CuentaConModulos } from '../../../core/services/administracion-de-cuentas.service';
import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { AdminModulosDelGestorComponent } from './admin-modulos-del-gestor.component';

const ANA: CuentaConModulos = { id: 7, nombre: 'Ana Gestora', correo: 'ana@pnmc.local', activa: true, esWebmaster: false, modulos: ['monitor', 'solicitudes', 'agenda', 'noticias'] };
const LUIS: CuentaConModulos = { id: 8, nombre: 'Luis Revisor', correo: 'luis@pnmc.local', activa: true, esWebmaster: false, modulos: ['monitor', 'solicitudes', 'ecosistema', 'mercados', 'talleres', 'espacios', 'redes', 'organizaciones'] };
const ADMIN: CuentaConModulos = { id: 1, nombre: 'Web Master', correo: 'webmaster@simus.test', activa: true, esWebmaster: true, modulos: [] };

describe('el apartado Módulos del gestor', () => {
  let fixture: ComponentFixture<AdminModulosDelGestorComponent>;
  let componente: AdminModulosDelGestorComponent;
  let cambios: { id: string | number; codigo: string; habilitado: boolean }[];
  let guardados: { id: string; modulos: readonly string[] }[];
  let respuesta: boolean;
  let preguntas: string[];
  let fallarElCambio: boolean;

  function montar(): void {
    cambios = []; guardados = []; preguntas = []; respuesta = true; fallarElCambio = false;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminModulosDelGestorComponent],
      providers: [
        { provide: AdministracionDeCuentasService, useValue: {
          cargarResumenDeModulos: () => of({ cuentas: [ANA, LUIS, ADMIN], siempreActivados: ['monitor', 'solicitudes'], soloWebmaster: ['usuarios', 'sistema'] }),
          cambiarModuloDeCuenta: (id: number, codigo: string, habilitado: boolean) => {
            if (fallarElCambio) { return throwError(() => new Error('x')); }
            cambios.push({ id, codigo, habilitado });
            const base = (id === 7 ? ANA : LUIS).modulos.filter(m => m !== codigo);
            return of({ idUsuario: id, modulos: habilitado ? [...base, codigo] : base, siempreActivados: [], todosPorSerWebmaster: false });
          },
          guardarModulosDeCuenta: (id: string, modulos: readonly string[]) => {
            guardados.push({ id, modulos });
            return of({ idUsuario: Number(id), modulos: [...modulos], siempreActivados: [], todosPorSerWebmaster: false });
          },
        } },
        { provide: ServicioDeConfirmacion, useValue: {
          pedir: (p: { titulo: string }) => { preguntas.push(p.titulo); return Promise.resolve(respuesta ? { motivo: '' } : null); },
        } },
      ],
    });
    fixture = TestBed.createComponent(AdminModulosDelGestorComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  it('lista los módulos con nombre, descripción y cuántos gestores lo tienen', () => {
    montar();
    const texto = el().textContent ?? '';
    expect(texto).toContain('Agenda y eventos');
    expect(texto).toContain('Convocatorias, eventos y programación');
    // Lutería, espacios y redes son tres módulos de permiso, y antes ninguno se podía conceder.
    expect(el().querySelector('[data-modulo-fila="talleres"]')).not.toBeNull();
    expect(el().querySelector('[data-modulo-fila="espacios"]')).not.toBeNull();
    expect(el().querySelector('[data-modulo-fila="redes"]')).not.toBeNull();
    // Los exclusivos del webmaster no se ofrecen.
    expect(el().querySelector('[data-modulo-fila="usuarios"]')).toBeNull();
    const agenda = el().querySelector('[data-modulo-fila="agenda"]')!.textContent ?? '';
    expect(agenda).toContain('1');
    expect(agenda).toContain('de 2 gestores');
    expect(el().querySelector('[data-modulo-fila="monitor"]')!.textContent).toContain('Siempre, para todos');
  });

  it('en la vista inversa dice quién tiene el módulo y habilitar no pide confirmación', () => {
    montar();
    componente.abrirModulo('agenda');
    fixture.detectChanges();
    expect(el().querySelector('[data-resumen-del-modulo]')!.textContent).toContain('1');
    const luis = el().querySelector('[data-cuenta="8"] button') as HTMLButtonElement;
    expect(luis.getAttribute('aria-checked')).toBe('false');
    luis.click();
    expect(preguntas).toEqual([]);
    expect(cambios).toEqual([{ id: 8, codigo: 'agenda', habilitado: true }]);
    fixture.detectChanges();
    expect(el().querySelector('[data-estado-de-cambio]')!.textContent).toContain('Habilitado: Agenda y eventos para Luis Revisor');
  });

  it('quitar acceso pide confirmación y, si se cancela, no cambia nada', async () => {
    montar();
    componente.abrirModulo('agenda');
    fixture.detectChanges();
    respuesta = false;
    await componente.cambiar(ANA, componente.moduloAbierto()!, false);
    expect(preguntas.length).toBe(1);
    expect(preguntas[0]).toContain('Quitar «Agenda y eventos» a Ana Gestora');
    expect(cambios).toEqual([]);

    respuesta = true;
    await componente.cambiar(ANA, componente.moduloAbierto()!, false);
    expect(cambios).toEqual([{ id: 7, codigo: 'agenda', habilitado: false }]);
    fixture.detectChanges();
    expect(el().querySelector('[data-resumen-del-modulo]')!.textContent).toContain('0');
  });

  it('un fallo al guardar lo dice y deja el módulo como estaba', async () => {
    montar();
    fallarElCambio = true;
    await componente.cambiar(LUIS, componente.filasDeModulo().find(f => f.modulo.codigo === 'agenda')!.modulo, true);
    fixture.detectChanges();
    expect(el().querySelector('[data-estado-de-cambio]')!.textContent).toContain('No fue posible cambiar');
    expect(LUIS.modulos).not.toContain('agenda');
  });

  it('por gestor muestra su perfil y aplicar uno que quita módulos lo confirma y guarda el conjunto con los fijos', async () => {
    montar();
    componente.cambiarVista('gestores');
    fixture.detectChanges();
    const fila = el().querySelector('[data-gestor-fila="8"]')!.textContent ?? '';
    expect(fila).toContain('Gestor de revisión');
    expect(el().querySelector('[data-gestor-fila="1"]')).toBeNull();

    const contenidos = componente.perfiles.find(p => p.id === 'contenidos')!;
    await componente.aplicarPerfil(LUIS, contenidos);
    expect(preguntas[0]).toContain('Aplicar «Gestor de contenidos» a Luis Revisor');
    expect(guardados.length).toBe(1);
    expect(guardados[0].id).toBe('8');
    expect(guardados[0].modulos).toEqual(jasmine.arrayContaining(['monitor', 'solicitudes', 'agenda', 'catalogo-editorial']));
    expect(guardados[0].modulos).not.toContain('talleres');
  });

  it('no pregunta al aplicar un perfil que solo da módulos', async () => {
    montar();
    const seguimiento = componente.perfiles.find(p => p.id === 'seguimiento')!;
    await componente.aplicarPerfil({ ...ANA, modulos: ['monitor', 'solicitudes'] }, seguimiento);
    expect(preguntas).toEqual([]);
    expect(guardados.length).toBe(1);
  });

  it('si no carga ofrece Reintentar', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AdminModulosDelGestorComponent],
      providers: [
        { provide: AdministracionDeCuentasService, useValue: { cargarResumenDeModulos: () => throwError(() => new Error('x')) } },
        { provide: ServicioDeConfirmacion, useValue: { pedir: () => Promise.resolve(null) } },
      ],
    });
    const f = TestBed.createComponent(AdminModulosDelGestorComponent);
    f.detectChanges();
    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('No fue posible leer los módulos de los gestores');
    expect(texto).toContain('Reintentar');
  });
});
