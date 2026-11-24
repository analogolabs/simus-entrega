import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AsistenteDeMercadoComponent } from './asistente-de-mercado.component';
import { PanelOrganizacionApi } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { BorradorDeProceso, BorradoresDeProcesoApi } from './borradores-de-proceso.api';

/**
 * El alta de un mercado desde su organización.
 *
 * <b>LO QUE FIJAN.</b> Que la pregunta del festival produzca una RELACION y no un nombre suelto:
 * que responder que no borre el festival elegido, que decir que sí sin elegir no se guarde, y que
 * cuando la organización no tiene ningún festival la pantalla lo diga en vez de dejar un selector
 * vacío. Es la regla que la estructura heredada no tenía —guardaba el festival como clave ajena y
 * como texto, sin nada que obligara a que coincidieran— y la que el criterio pide
 * explícitamente.
 */
describe('el asistente de alta de un mercado', () => {
  let fixture: ComponentFixture<AsistenteDeMercadoComponent>;
  let componente: AsistenteDeMercadoComponent;

  const FESTIVALES = [
    { id: 7, nombre: 'Festival de Prueba', estadoRegistro: 'borrador' },
    { id: 9, nombre: 'Festival Publicado', estadoRegistro: 'publicado' },
  ];

  let borradores: jasmine.SpyObj<BorradoresDeProcesoApi>;
  let crear: jasmine.Spy;

  function montar(festivales: unknown = FESTIVALES, borrador: BorradorDeProceso | 'falla' = { id: '77', moduloId: 'mercados', datosJson: '{}', version: 1 }): void {
    TestBed.resetTestingModule();
    borradores = jasmine.createSpyObj<BorradoresDeProcesoApi>('BorradoresDeProcesoApi', ['obtener', 'guardar', 'descartar', 'pendientes']);
    borradores.obtener.and.returnValue(borrador === 'falla' ? throwError(() => new Error('sin red')) : of(borrador));
    borradores.guardar.and.resolveTo({ version: 2 });
    borradores.descartar.and.returnValue(of(undefined));
    crear = jasmine.createSpy('crearMercado').and.returnValue(of({ id: 1 }));
    TestBed.configureTestingModule({
      imports: [AsistenteDeMercadoComponent],
      providers: [
        provideRouter([]),
        { provide: PanelOrganizacionStore, useValue: {
          organizacionId: () => '42',
          esAdministradora: () => true,
          organizacionElegida: () => ({ id: '42', name: 'Fundación de Prueba' }),
        } },
        { provide: PanelOrganizacionApi, useValue: {
          obtenerCatalogosDeMercado: () => of({
            alcances: [{ id: 1, nombre: 'Local', slug: 'local' }],
            modalidades: [{ id: 1, nombre: 'Presencial', slug: 'presencial' }],
          }),
          obtenerUbicaciones: () => of([
            { departmentCode: '05', departmentName: 'ANTIOQUIA', municipalityCode: '05001', municipalityName: 'MEDELLIN' },
          ]),
          obtenerFestivalesElegibles: () => (festivales === 'falla' ? throwError(() => new Error('sin red')) : of(festivales)),
          crearMercado: crear,
        } },
        { provide: BorradoresDeProcesoApi, useValue: borradores },
      ],
    });
    fixture = TestBed.createComponent(AsistenteDeMercadoComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('los festivales que ofrece son los de la organización, en cualquier estado', () => {
    // EL ESTADO NO EXCLUYE: la condición es existir y pertenecer. Un festival en borrador se puede
    // elegir igual que uno publicado.
    montar();

    expect(componente.festivales().map(f => f.id)).toEqual([7, 9]);
  });

  it('responder que no borra el festival que se hubiera elegido', () => {
    montar();
    componente.cambiarSiEstaEnUnFestival(true);
    componente.formulario.festivalId = 7;

    componente.cambiarSiEstaEnUnFestival(false);

    expect(componente.formulario.festivalId).toBeNull();
  });

  it('decir que sí y no elegir no pasa la validación', () => {
    montar();
    componente.formulario.nombre = 'Mercado con festival sin elegir';
    componente.formulario.nivelCobertura = 'nacional';
    componente.formulario.sedeCodigoDepartamento = '05';
    componente.formulario.sedeCodigoMunicipio = '05001';
    componente.cambiarSiEstaEnUnFestival(true);

    expect(componente.validar()).toBeFalse();
    expect(componente.errores()['festivalId']).toBeTruthy();
  });

  it('sin festivales propios, el paso lo dice en vez de dejar un selector vacío', () => {
    // NI SE CREA AL VUELO NI SE ESCRIBE A MANO: registrar un festival tiene su propio recorrido.
    montar([]);
    componente.cambiarSiEstaEnUnFestival(true);
    componente.irAlPaso(3);
    fixture.detectChanges();

    const html: HTMLElement = fixture.nativeElement;
    expect(html.querySelector('[data-sin-festivales-propios]')).not.toBeNull();
    expect(html.querySelector('[data-festival-elegido]')).toBeNull();
  });

  it('si la consulta falla NO dice que no tengas festivales', () => {
    // EL DEFECTO QUE TRAJO ESTA PRUEBA. se detectó el 15 de septiembre de
    // 2026: una organización con festivales registrados leía «Todavía no tienes ningún festival
    // registrado en SIMUS». El error de la consulta se convertía en una lista vacía, y una lista
    // vacía se enseñaba como una afirmación sobre sus datos. Ahora son dos cosas distintas.
    montar('falla');
    componente.cambiarSiEstaEnUnFestival(true);
    componente.irAlPaso(3);
    fixture.detectChanges();

    const html: HTMLElement = fixture.nativeElement;
    expect(componente.consultaDeFestivales()).toBe('fallida');
    expect(html.querySelector('[data-fallo-al-consultar-festivales]')).not.toBeNull();
    expect(html.querySelector('[data-sin-festivales-propios]')).toBeNull();
  });

  it('pasar a cobertura nacional suelta el territorio que deja de tener sentido', () => {
    montar();
    componente.cambiarDepartamento('05');
    componente.formulario.codigoMunicipio = '05001';

    componente.cambiarCobertura('nacional');

    expect(componente.formulario.codigoDepartamento).toBe('');
    expect(componente.formulario.codigoMunicipio).toBe('');
  });

  // ───────────────────────── autoguardado y aviso al salir ─────────────────────────

  it('abre el borrador privado de la organización al empezar', () => {
    montar();

    expect(borradores.obtener).toHaveBeenCalledWith('mercados', '42');
  });

  it('recupera lo escrito en una visita anterior y lo dice', () => {
    montar(FESTIVALES, { id: '77', moduloId: 'mercados', version: 4, datosJson: JSON.stringify({ nombre: 'Mercado a medias', nivelCobertura: 'nacional', practicasMusicalesIds: [3] }) });
    fixture.detectChanges();

    expect(componente.formulario.nombre).toBe('Mercado a medias');
    expect(componente.formulario.nivelCobertura).toBe('nacional');
    expect(componente.formulario.practicasMusicalesIds).toEqual([3]);
    expect(componente.borradorRecuperado()).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="mercado-borrador-recuperado"]')).not.toBeNull();
    expect(componente.estadoGuardado()).toBe('guardado');
  });

  it('con el formulario en blanco NO dice «Borrador guardado»', () => {
    montar();
    fixture.detectChanges();

    expect(componente.estadoGuardado()).toBe('inactivo');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="mercado-estado-guardado"]')?.textContent?.trim()).toBe('');
  });

  it('escribir manda el borrador tras un momento de quietud y entonces dice la hora', fakeAsync(() => {
    montar();
    fixture.detectChanges();

    componente.formulario.nombre = 'Mercado Costa';
    componente.alCambiarAlgo();
    tick(900);
    fixture.detectChanges();

    expect(borradores.guardar).toHaveBeenCalledTimes(1);
    const [id, datos, version] = borradores.guardar.calls.mostRecent().args;
    expect(id).toBe('77');
    expect((datos as { nombre: string }).nombre).toBe('Mercado Costa');
    expect(version).toBe(1);
    expect(componente.estadoGuardado()).toBe('guardado');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="mercado-estado-guardado"]')?.textContent).toContain('Borrador guardado a las');
  }));

  it('con el borrador respaldado salir no pregunta; si el guardado falló, avisa de que se perderá', fakeAsync(() => {
    montar();
    fixture.detectChanges();
    componente.formulario.nombre = 'Mercado Costa';
    componente.alCambiarAlgo();
    tick(900);

    expect(componente.avisoAlSalir()).toBeNull();

    borradores.guardar.and.resolveTo(null);
    componente.formulario.nombre = 'Mercado Costa 2';
    componente.alCambiarAlgo();
    tick(900);

    expect(componente.estadoGuardado()).toBe('fallido');
    expect(componente.avisoAlSalir()).toContain('se perderá');
  }));

  it('si el borrador no se pudo abrir, lo escrito no está respaldado y salir pregunta', () => {
    montar(FESTIVALES, 'falla');
    fixture.detectChanges();
    componente.formulario.nombre = 'Sin respaldo';

    expect(componente.avisoAlSalir()).toContain('se perderá');
  });

  it('sin nada escrito no hay nada que avisar', () => {
    montar();
    expect(componente.avisoAlSalir()).toBeNull();
  });

  it('al cambiar de organización con el borrador activo, lo escrito se queda como borrador de esta', () => {
    montar();
    fixture.detectChanges();
    componente.formulario.nombre = 'Mercado Costa';

    expect(componente.avisoAlCambiarDeOrganizacion('Caribe', 'Pacífico')).toContain('borrador de «Caribe»');
  });

  it('cancelar con algo escrito pregunta; descartar borra el borrador en el servidor', () => {
    montar();
    fixture.detectChanges();
    componente.formulario.nombre = 'Mercado Costa';

    componente.cancelar();
    fixture.detectChanges();
    expect(componente.confirmandoSalida()).toBeTrue();

    componente.descartarYSalir();
    expect(borradores.descartar).toHaveBeenCalledWith('77');
  });

  it('después de descartar o de guardar, la salida que viene NO vuelve a preguntar (la guarda no puede bloquear)', () => {
    montar();
    fixture.detectChanges();
    componente.formulario.nombre = 'Mercado Costa';
    componente.formulario.nivelCobertura = 'nacional';
    componente.formulario.sedeCodigoDepartamento = '05';
    componente.formulario.sedeCodigoMunicipio = '05001';

    componente.descartarYSalir();
    expect(componente.avisoAlSalir()).toBeNull();

    montar();
    componente.formulario.nombre = 'Mercado Costa';
    componente.formulario.nivelCobertura = 'nacional';
    componente.formulario.sedeCodigoDepartamento = '05';
    componente.formulario.sedeCodigoMunicipio = '05001';
    componente.guardar();
    expect(componente.avisoAlSalir()).toBeNull();
  });

  it('cancelar sin nada escrito sale sin preguntar', () => {
    montar();
    componente.cancelar();
    expect(componente.confirmandoSalida()).toBeFalse();
  });

  // ───────────────────── visitado no es completo, y «Falta:» en la revisión ─────────────────────

  it('avanzar con el nombre vacío NO pinta el paso 1 como completo', () => {
    montar();
    componente.siguiente();
    componente.siguiente();

    expect(componente.estadoDeLosPasos()[1]).toBe('incompleto');
  });

  it('con el paso bien diligenciado sí queda completo', () => {
    montar();
    componente.formulario.nombre = 'Mercado Costa';
    componente.siguiente();

    expect(componente.estadoDeLosPasos()[1]).toBe('completo');
  });

  it('la revisión dice qué falta y cada ítem lleva al paso y al campo', () => {
    montar();
    componente.formulario.nivelCobertura = 'municipal';
    componente.irAlPaso(4);
    fixture.detectChanges();

    const falta: HTMLElement = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="mercado-falta"]')!;
    expect(falta.textContent).toContain('Nombre del mercado');
    expect(falta.textContent).toContain('Municipio');

    componente.irAlCampo('codigoDepartamento');
    expect(componente.pasoActivo()).toBe(2);
  });

  // ─────────────────────────── reglas únicas y errores del servidor ───────────────────────────

  it('la misma regla de dirección y teléfono que el servidor, junto al campo y al salir de él', () => {
    montar();
    componente.formulario.sitioWebMercado = 'no es una dirección';
    componente.formulario.telefonoMercado = 'abc';
    componente.formulario.correoMercado = 'juan@alcaldia';

    componente.alSalirDelCampo('sitioWebMercado');
    componente.alSalirDelCampo('telefonoMercado');
    componente.alSalirDelCampo('correoMercado');

    expect(componente.errores()['sitioWebMercado']).toContain('dirección web');
    expect(componente.errores()['telefonoMercado']).toContain('teléfono');
    expect(componente.errores()['correoMercado']).toContain('correo');
  });

  it('una dirección sin esquema se acepta y viaja con https://, junto con el borrador que cierra', () => {
    montar();
    componente.formulario.nombre = 'Mercado Costa';
    componente.formulario.nivelCobertura = 'nacional';
    componente.formulario.sedeCodigoDepartamento = '05';
    componente.formulario.sedeCodigoMunicipio = '05001';
    componente.formulario.sitioWebMercado = 'www.mercado.example.org';

    componente.guardar();

    const solicitud = crear.calls.mostRecent().args[1];
    expect(solicitud.sitioWebMercado).toBe('https://www.mercado.example.org');
    expect(solicitud.borradorProcesoId).toBe('77');
  });

  it('el rechazo del servidor vuelve junto a su campo, con su nombre y sin la jerga interna', () => {
    montar();
    crear.and.returnValue(throwError(() => ({ status: 400, message: 'No fue posible. sitioWebMercado: x', payload: { errors: { sitioWebMercado: ['Escribe una dirección web completa.'] } } })));
    componente.formulario.nombre = 'Mercado Costa';
    componente.formulario.nivelCobertura = 'nacional';
    componente.formulario.sedeCodigoDepartamento = '05';
    componente.formulario.sedeCodigoMunicipio = '05001';

    componente.guardar();

    expect(componente.errores()['sitioWebMercado']).toBe('Escribe una dirección web completa.');
    expect(componente.error()).toBe('Revisa los campos marcados.');
    expect(componente.pasoActivo()).toBe(2);
  });
});
