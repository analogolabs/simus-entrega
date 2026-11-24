import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { appConfig } from '../../app.config';
import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { CatalogosDeRed, GuardarRedSolicitud, Red, RedesService } from '../../core/services/redes.service';
import { PropuestasDeProcesoService } from '../../core/services/propuestas-de-proceso.service';
import { FichaDeRedPageComponent } from './ficha-de-red-page.component';
import { PanelOrganizacionApi } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';

/**
 * La ficha de una red o centro de documentación en el panel.
 *
 * <b>LO QUE SE FIJA.</b> Que lo que se ofrece dependa del estado y no haya botones apagados sin
 * explicación, que un cambio de fondo en una red publicada se AVISE antes de guardar, que el
 * red de una persona y el de una organización vayan a rutas distintas, y que los errores del
 * servidor se pinten junto al campo que corresponde.
 */
describe('FichaDeRedPageComponent', () => {
  const catalogos: CatalogosDeRed = {
    formasDeAcceso: [
      { id: 1, nombre: 'Consulta en sala', slug: 'construccion', padreId: null, estadoAprobacion: 'propuesto' },
      { id: 2, nombre: 'Con cita previa', slug: 'reparacion', padreId: null, estadoAprobacion: 'propuesto' },
    ],
    formatos: [
      { id: 10, nombre: 'Impreso', slug: 'cordofonos', padreId: null, estadoAprobacion: 'propuesto' },
      { id: 11, nombre: 'Partituras', slug: 'cordofonos-frotados', padreId: 10, estadoAprobacion: 'propuesto' },
      { id: 12, nombre: 'Audiovisual', slug: 'aerofonos', padreId: null, estadoAprobacion: 'propuesto' },
    ],
    practicasMusicales: [{ id: 100, nombre: 'Músicas campesinas' }],
  };

  const red = (estadoRegistro: string, cambios: Partial<Red> = {}): Red => ({
    id: 7, nombre: 'Red Los Cedros', descripcion: 'Consulta en sala de guitarras.', tipoDeNodo: 'red',
    accesoAbierto: true, acervosYColecciones: null, correoRed: 'cedros@red.test', telefonoRed: null,
    sitioWebRed: null, instagramRed: null, facebookRed: null, otroEnlaceRed: null,
    nivelCobertura: 'municipal', codigoDepartamento: '19', nombreDepartamento: 'Cauca',
    codigoMunicipio: '19001', nombreMunicipio: 'Popayán', lugarEspecifico: null,
    organizacionId: 3104, organizacionNombre: 'Cantaclaro', usuarioResponsableId: null, responsableNombre: null,
    estadoRegistro, motivoDeLaDecision: null,
    formasDeAcceso: [catalogos.formasDeAcceso[0]], formatos: [catalogos.formatos[0]], practicasMusicales: [],
    fechaCreacion: '2026-10-01T00:00:00Z', fechaActualizacion: null, fechaEnvioARevision: null, fechaPublicacion: null,
    ...cambios,
  });

  let fixture: ComponentFixture<FichaDeRedPageComponent>;
  let componente: FichaDeRedPageComponent;
  let navegadoA: unknown[] | null;
  let respuestaDeConfirmacion: { motivo: string } | null;
  let pedidas: { titulo: string }[];
  let guardado: { id: string | number; cuerpo: GuardarRedSolicitud } | null;
  let creado: { organizacionId: string | number | null; cuerpo: GuardarRedSolicitud } | null;
  let enviadoARevision: string | number | null;
  let retiradoPublicado: { id: string | number; motivo: string } | null;
  let fallo: unknown;
  let propuestaGuardada: { id: string | number; campos: { campoId: string; valorPropuesto: string | null }[] } | null;
  const esAdministradora = signal(true);

  // `formatDate` necesita los datos de es-CO, y los registra `appConfig`.
  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));
  beforeEach(() => esAdministradora.set(true));

  function montar(opciones: { estado?: string; id?: string | null; persona?: boolean; cambios?: Partial<Red> } = {}): void {
    const estado = opciones.estado ?? 'borrador';
    const id = opciones.id === undefined ? '7' : opciones.id;
    navegadoA = null; respuestaDeConfirmacion = { motivo: '' }; pedidas = [];
    guardado = null; propuestaGuardada = null; creado = null; enviadoARevision = null; retiradoPublicado = null; fallo = null;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FichaDeRedPageComponent],
      providers: [
        provideRouter([]),
        { provide: ServicioDeConfirmacion, useValue: { pedir: (p: { titulo: string }) => { pedidas.push(p); return Promise.resolve(respuestaDeConfirmacion); } } },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('3104'), esAdministradora } },
        { provide: PanelOrganizacionApi, useValue: { obtenerUbicaciones: () => of([
          { departmentCode: '19', departmentName: 'Cauca', municipalityCode: '19001', municipalityName: 'Popayán' },
          { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05001', municipalityName: 'Medellín' },
        ]) } },
        { provide: RedesService, useValue: {
          catalogos: () => of(catalogos),
          obtener: () => id ? of(red(estado, opciones.cambios)) : throwError(() => ({ message: 'No existe' })),
          crear: (organizacionId: string | number | null, cuerpo: GuardarRedSolicitud) => {
            creado = { organizacionId, cuerpo };
            return fallo ? throwError(() => fallo) : of(red('borrador', { id: 99 }));
          },
          guardar: (idDelRed: string | number, cuerpo: GuardarRedSolicitud) => {
            guardado = { id: idDelRed, cuerpo };
            return fallo ? throwError(() => fallo) : of(red(estado, { nombre: cuerpo.nombre }));
          },
          enviarARevision: (idDelRed: string | number) => { enviadoARevision = idDelRed; return of(red('en_revision')); },
          retirarDeRevisionOAbandonar: () => of(undefined),
          retirarPublicado: (idDelRed: string | number, motivo: string) => {
            retiradoPublicado = { id: idDelRed, motivo };
            return of(red('archivado'));
          },
        } },
        { provide: PropuestasDeProcesoService, useValue: {
          deMi: () => of({ id: 0, moduloId: '', registroId: '', nombreDelRegistro: '', estado: 'borrador', motivo: null, organizacionNombre: null,
            proponenteNombre: null, decideNombre: null, motivoDeLaDecision: null, fechaEnvio: null, fechaDecision: null, campos: [] }),
          guardar: (_ruta: string, idDelProceso: string | number, motivo: string | null, campos: { campoId: string; valorPropuesto: string | null }[]) => {
            propuestaGuardada = { id: idDelProceso, campos };
            return of({ id: 5, moduloId: '', registroId: String(idDelProceso), nombreDelRegistro: '', estado: 'borrador', motivo, organizacionNombre: null,
              proponenteNombre: null, decideNombre: null, motivoDeLaDecision: null, fechaEnvio: null, fechaDecision: null,
              campos: campos.map((c, i) => ({ id: i + 1, seccionId: '', campoEtiqueta: c.campoId, valorAnterior: null, ...c })) });
          },
        } },
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: convertToParamMap(id ? { id } : {}), data: { responsable: opciones.persona ? 'persona' : 'organizacion' } },
        } },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.callFake((destino: unknown[]) => { navegadoA = destino; return Promise.resolve(true); });
    fixture = TestBed.createComponent(FichaDeRedPageComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const boton = (testid: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testid}"]`);

  it('una red nuevo ofrece guardar como borrador y nada más', () => {
    montar({ id: null });

    expect(componente.esNuevo()).toBeTrue();
    expect(texto()).toContain('Registrar una red o centro de documentación');
    expect(boton('guardar-red')?.textContent).toContain('Guardar como borrador');
    expect(boton('enviar-red')).toBeNull();
    expect(boton('abandonar-red')).toBeNull();
  });

  it('en borrador se guarda, se envía y se abandona; en revisión solo se retira de la revisión', () => {
    montar({ estado: 'borrador' });
    expect(boton('guardar-red')).not.toBeNull();
    expect(boton('enviar-red')?.textContent).toContain('Enviar a revisión');
    expect(boton('abandonar-red')).not.toBeNull();

    montar({ estado: 'en_revision' });
    expect(boton('guardar-red')).toBeNull();
    expect(boton('enviar-red')).toBeNull();
    expect(boton('retirar-de-revision')).not.toBeNull();
    expect(texto()).toContain('La red está en revisión');
  });

  it('con ajustes pedidos enseña el motivo del PNMC y ofrece reenviar', () => {
    montar({ estado: 'ajustes_solicitados', cambios: { motivoDeLaDecision: 'Falta el barrio de la red.' } });

    expect(boton('ajustes-del-red')?.textContent).toContain('Falta el barrio de la red.');
    expect(boton('enviar-red')?.textContent).toContain('Reenviar a revisión');
  });

  it('publicado se edita y se retira del ecosistema; rechazado y archivado no se editan', () => {
    montar({ estado: 'publicado' });
    expect(boton('guardar-red')).not.toBeNull();
    expect(boton('retirar-red')).not.toBeNull();

    montar({ estado: 'rechazado', cambios: { motivoDeLaDecision: 'No es redes y documentación.' } });
    expect(boton('guardar-red')).toBeNull();
    expect(texto()).toContain('El PNMC rechazó esta red');
    expect(texto()).toContain('No es redes y documentación.');

    montar({ estado: 'archivado' });
    expect(componente.editable()).toBeFalse();
  });

  it('quien solo edita no ve enviar ni retirar y se le dice por qué', () => {
    esAdministradora.set(false);
    montar({ estado: 'borrador' });

    expect(boton('enviar-red')).toBeNull();
    expect(texto()).toContain('Enviar a revisión y retirar lo hace quien administra la organización');
  });

  it('un cambio de nombre en una red publicado se guarda como PROPUESTA, no en caliente, y se avisa ANTES', async () => {
    montar({ estado: 'publicado' });
    expect(componente.cambiosDeFondo()).toEqual([]);

    componente.cambiar('descripcion', 'Una errata corregida.');
    expect(componente.cambiosDeFondo()).withContext('una errata no se propone').toEqual([]);

    componente.cambiar('nombre', 'Otro nombre');
    fixture.detectChanges();
    expect(componente.cambiosDeFondo().map(c => c.campoId)).toEqual(['nombre']);
    expect(componente.cambiosSinGuardar()).toBe(1);
    expect(texto()).toContain('Hay un cambio de fondo sin guardar');

    respuestaDeConfirmacion = null; // se cancela
    await componente.guardar();
    expect(pedidas.map(p => p.titulo)).toEqual(['Guardar y proponer el cambio']);
    expect(guardado).withContext('si se cancela no se guarda').toBeNull();

    respuestaDeConfirmacion = { motivo: '' };
    await componente.guardar();
    // LA ERRATA SE GUARDA AHORA CON EL NOMBRE PUBLICADO; EL NOMBRE NUEVO VIAJA COMO PROPUESTA.
    expect(guardado!.cuerpo.nombre).not.toBe('Otro nombre');
    expect(guardado!.cuerpo.descripcion).toBe('Una errata corregida.');
    expect(propuestaGuardada!.campos).toEqual([{ campoId: 'nombre', valorPropuesto: 'Otro nombre' }]);
    // Y EL FORMULARIO SIGUE MOSTRANDO LO PROPUESTO, ya guardado: nada queda por guardar.
    expect(componente.formulario().nombre).toBe('Otro nombre');
    expect(componente.cambiosSinGuardar()).toBe(0);
  });

  it('cambiar el alcance a todo el país limpia el departamento y el municipio que se mandan', async () => {
    montar({ id: null });
    componente.cambiar('nombre', 'Red nacional');
    componente.elegirDepartamento('19');
    componente.cambiar('codigoMunicipio', '19001');
    componente.cambiar('nivelCobertura', 'nacional');

    await componente.guardar();

    expect(creado!.cuerpo.codigoDepartamento).toBeNull();
    expect(creado!.cuerpo.codigoMunicipio).toBeNull();
  });

  it('la red de una organización se crea con la de la URL y el de una persona, sin organización', async () => {
    montar({ id: null });
    componente.cambiar('nombre', 'Red de la organización');
    await componente.guardar();
    expect(creado!.organizacionId).toBe('3104');

    montar({ id: null, persona: true });
    componente.cambiar('nombre', 'Red de una persona');
    await componente.guardar();
    expect(creado!.organizacionId).toBeNull();
    // Una persona administra lo suyo: ve enviar y retirar sin ser «administradora» de nada.
    expect(componente.puedeAdministrar()).toBeTrue();
  });

  it('tras crear lleva a la ficha de la red nuevo, en la lista de su responsable', async () => {
    montar({ id: null });
    componente.cambiar('nombre', 'Red nuevo');

    await componente.guardar();

    expect(navegadoA).toEqual(['/gestion/o', '3104', 'procesos', 'redes', '99']);
  });

  it('los errores del servidor se pintan junto al campo y no se pierde lo escrito', async () => {
    montar({ id: null });
    componente.cambiar('nombre', 'Red con error');
    fallo = { message: 'Revisa', payload: { errors: { formasDeAccesoIds: ['Algún servicio no existe en el catálogo.'] } } };

    await componente.guardar();
    fixture.detectChanges();

    expect(componente.erroresDeCampo()['formasDeAccesoIds']).toContain('Algún servicio');
    expect(texto()).toContain('Revisa los campos marcados.');
    expect(componente.formulario().nombre).toBe('Red con error');
  });

  it('enviar a revisión pide confirmación; retirar uno publicado exige el motivo', async () => {
    montar({ estado: 'borrador' });
    await componente.enviar();
    expect(pedidas.at(-1)?.titulo).toBe('Enviar a revisión');
    expect(enviadoARevision).toBe(7);

    montar({ estado: 'publicado' });
    respuestaDeConfirmacion = { motivo: 'Cierro la red.' };
    await componente.retirarPublicado();
    expect(retiradoPublicado).toEqual({ id: 7, motivo: 'Cierro la red.' });
  });

  it('una red que no existe se dice y ofrece volver a la lista', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FichaDeRedPageComponent],
      providers: [
        provideRouter([]),
        { provide: ServicioDeConfirmacion, useValue: { pedir: () => Promise.resolve(null) } },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('3104'), esAdministradora } },
        { provide: PanelOrganizacionApi, useValue: { obtenerUbicaciones: () => of([]) } },
        { provide: RedesService, useValue: { catalogos: () => of(catalogos), obtener: () => throwError(() => ({ message: 'No encontramos esa red.' })) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '404' }), data: { responsable: 'organizacion' } } } },
      ],
    });
    const f = TestBed.createComponent(FichaDeRedPageComponent);
    f.detectChanges();

    expect((f.nativeElement as HTMLElement).textContent).toContain('No encontramos esa red.');
  });

  it('las formas de acceso y los formatos se marcan y desmarcan, y el subnivel cuelga de su formato', () => {
    montar({ id: null });

    componente.alternar('formasDeAccesoIds', 2);
    componente.alternar('formatosIds', 11);
    expect(componente.formulario().formasDeAccesoIds).toEqual([2]);
    expect(componente.formulario().formatosIds).toEqual([11]);
    componente.alternar('formasDeAccesoIds', 2);
    expect(componente.formulario().formasDeAccesoIds).toEqual([]);

    expect(componente.formatosPrincipales().map(f => f.nombre)).toEqual(['Impreso', 'Audiovisual']);
    expect(componente.subniveles(componente.formatosPrincipales()[0]).map(f => f.nombre)).toEqual(['Partituras']);
  });
});
