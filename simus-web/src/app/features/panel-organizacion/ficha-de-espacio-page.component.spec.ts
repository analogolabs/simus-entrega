import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { appConfig } from '../../app.config';
import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { CatalogosDeEspacio, GuardarEspacioSolicitud, Espacio, EspaciosService } from '../../core/services/espacios.service';
import { PropuestasDeProcesoService } from '../../core/services/propuestas-de-proceso.service';
import { FichaDeEspacioPageComponent } from './ficha-de-espacio-page.component';
import { PanelOrganizacionApi } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';

/**
 * La ficha de un espacio para música en vivo en el panel.
 *
 * <b>LO QUE SE FIJA.</b> Que lo que se ofrece dependa del estado y no haya botones apagados sin
 * explicación, que un cambio de fondo en un espacio publicado se AVISE antes de guardar, que el
 * espacio de una persona y el de una organización vayan a rutas distintas, y que los errores del
 * servidor se pinten junto al campo que corresponde.
 */
describe('FichaDeEspacioPageComponent', () => {
  const catalogos: CatalogosDeEspacio = {
    equipamiento: [
      { id: 1, nombre: 'Sistema de sonido', slug: 'sonido', estadoAprobacion: 'propuesto' },
      { id: 2, nombre: 'Camerinos', slug: 'camerinos', estadoAprobacion: 'propuesto' },
    ],
    tipos: [
      { id: 10, nombre: 'Sala de conciertos', slug: 'sala-de-conciertos', estadoAprobacion: 'propuesto' },
      { id: 11, nombre: 'Bar o taberna', slug: 'bar', estadoAprobacion: 'propuesto' },
      { id: 12, nombre: 'Teatro', slug: 'teatro', estadoAprobacion: 'propuesto' },
    ],
    practicasMusicales: [{ id: 100, nombre: 'Músicas campesinas' }],
  };

  const espacio = (estadoRegistro: string, cambios: Partial<Espacio> = {}): Espacio => ({
    id: 7, nombre: 'Sala Los Cedros', descripcion: 'Sala de conciertos de música tradicional.', ambiente: 'cerrado', aforoMaximo: 80,
    esAccesible: true, horarioYProgramacion: null, correoEspacio: 'cedros@espacio.test', telefonoEspacio: null,
    sitioWebEspacio: null, instagramEspacio: null, facebookEspacio: null, otroEnlaceEspacio: null,
    nivelCobertura: 'municipal', codigoDepartamento: '19', nombreDepartamento: 'Cauca',
    codigoMunicipio: '19001', nombreMunicipio: 'Popayán', lugarEspecifico: 'Carrera 6 # 5-22',
    organizacionId: 3104, organizacionNombre: 'Cantaclaro', usuarioResponsableId: null, responsableNombre: null,
    estadoRegistro, motivoDeLaDecision: null,
    equipamiento: [catalogos.equipamiento[0]], tipos: [catalogos.tipos[0]], practicasMusicales: [],
    fechaCreacion: '2026-10-01T00:00:00Z', fechaActualizacion: null, fechaEnvioARevision: null, fechaPublicacion: null,
    ...cambios,
  });

  let fixture: ComponentFixture<FichaDeEspacioPageComponent>;
  let componente: FichaDeEspacioPageComponent;
  let navegadoA: unknown[] | null;
  let respuestaDeConfirmacion: { motivo: string } | null;
  let pedidas: { titulo: string }[];
  let guardado: { id: string | number; cuerpo: GuardarEspacioSolicitud } | null;
  let creado: { organizacionId: string | number | null; cuerpo: GuardarEspacioSolicitud } | null;
  let enviadoARevision: string | number | null;
  let retiradoPublicado: { id: string | number; motivo: string } | null;
  let fallo: unknown;
  let propuestaGuardada: { id: string | number; campos: { campoId: string; valorPropuesto: string | null }[] } | null;
  const esAdministradora = signal(true);

  // `formatDate` necesita los datos de es-CO, y los registra `appConfig`.
  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));
  beforeEach(() => esAdministradora.set(true));

  function montar(opciones: { estado?: string; id?: string | null; persona?: boolean; cambios?: Partial<Espacio> } = {}): void {
    const estado = opciones.estado ?? 'borrador';
    const id = opciones.id === undefined ? '7' : opciones.id;
    navegadoA = null; respuestaDeConfirmacion = { motivo: '' }; pedidas = [];
    guardado = null; propuestaGuardada = null; creado = null; enviadoARevision = null; retiradoPublicado = null; fallo = null;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FichaDeEspacioPageComponent],
      providers: [
        provideRouter([]),
        { provide: ServicioDeConfirmacion, useValue: { pedir: (p: { titulo: string }) => { pedidas.push(p); return Promise.resolve(respuestaDeConfirmacion); } } },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('3104'), esAdministradora } },
        { provide: PanelOrganizacionApi, useValue: { obtenerUbicaciones: () => of([
          { departmentCode: '19', departmentName: 'Cauca', municipalityCode: '19001', municipalityName: 'Popayán' },
          { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05001', municipalityName: 'Medellín' },
        ]) } },
        { provide: EspaciosService, useValue: {
          catalogos: () => of(catalogos),
          obtener: () => id ? of(espacio(estado, opciones.cambios)) : throwError(() => ({ message: 'No existe' })),
          crear: (organizacionId: string | number | null, cuerpo: GuardarEspacioSolicitud) => {
            creado = { organizacionId, cuerpo };
            return fallo ? throwError(() => fallo) : of(espacio('borrador', { id: 99 }));
          },
          guardar: (idDelEspacio: string | number, cuerpo: GuardarEspacioSolicitud) => {
            guardado = { id: idDelEspacio, cuerpo };
            return fallo ? throwError(() => fallo) : of(espacio(estado, { nombre: cuerpo.nombre }));
          },
          enviarARevision: (idDelEspacio: string | number) => { enviadoARevision = idDelEspacio; return of(espacio('en_revision')); },
          retirarDeRevisionOAbandonar: () => of(undefined),
          retirarPublicado: (idDelEspacio: string | number, motivo: string) => {
            retiradoPublicado = { id: idDelEspacio, motivo };
            return of(espacio('archivado'));
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
    fixture = TestBed.createComponent(FichaDeEspacioPageComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const boton = (testid: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testid}"]`);

  it('un espacio nuevo ofrece guardar como borrador y nada más', () => {
    montar({ id: null });

    expect(componente.esNuevo()).toBeTrue();
    expect(texto()).toContain('Registrar un espacio para música en vivo');
    expect(boton('guardar-espacio')?.textContent).toContain('Guardar como borrador');
    expect(boton('enviar-espacio')).toBeNull();
    expect(boton('abandonar-espacio')).toBeNull();
  });

  it('en borrador se guarda, se envía y se abandona; en revisión solo se retira de la revisión', () => {
    montar({ estado: 'borrador' });
    expect(boton('guardar-espacio')).not.toBeNull();
    expect(boton('enviar-espacio')?.textContent).toContain('Enviar a revisión');
    expect(boton('abandonar-espacio')).not.toBeNull();

    montar({ estado: 'en_revision' });
    expect(boton('guardar-espacio')).toBeNull();
    expect(boton('enviar-espacio')).toBeNull();
    expect(boton('retirar-de-revision')).not.toBeNull();
    expect(texto()).toContain('El espacio está en revisión');
  });

  it('con ajustes pedidos enseña el motivo del PNMC y ofrece reenviar', () => {
    montar({ estado: 'ajustes_solicitados', cambios: { motivoDeLaDecision: 'Falta el barrio del espacio.' } });

    expect(boton('ajustes-del-espacio')?.textContent).toContain('Falta el barrio del espacio.');
    expect(boton('enviar-espacio')?.textContent).toContain('Reenviar a revisión');
  });

  it('publicado se edita y se retira del ecosistema; rechazado y archivado no se editan', () => {
    montar({ estado: 'publicado' });
    expect(boton('guardar-espacio')).not.toBeNull();
    expect(boton('retirar-espacio')).not.toBeNull();

    montar({ estado: 'rechazado', cambios: { motivoDeLaDecision: 'No es espacios para música en vivo.' } });
    expect(boton('guardar-espacio')).toBeNull();
    expect(texto()).toContain('El PNMC rechazó este espacio');
    expect(texto()).toContain('No es espacios para música en vivo.');

    montar({ estado: 'archivado' });
    expect(componente.editable()).toBeFalse();
  });

  it('quien solo edita no ve enviar ni retirar y se le dice por qué', () => {
    esAdministradora.set(false);
    montar({ estado: 'borrador' });

    expect(boton('enviar-espacio')).toBeNull();
    expect(texto()).toContain('Enviar a revisión y retirar lo hace quien administra la organización');
  });

  it('un cambio de nombre en un espacio publicado se guarda como PROPUESTA, no en caliente, y se avisa ANTES', async () => {
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

  it('un espacio está siempre en un municipio y el aforo se manda como número, o vacío', async () => {
    montar({ id: null });
    componente.cambiar('nombre', 'Sala nueva');
    componente.elegirDepartamento('19');
    componente.cambiar('codigoMunicipio', '19001');
    componente.cambiar('aforoMaximo', '120');

    await componente.guardar();

    expect(creado!.cuerpo.nivelCobertura).toBe('municipal');
    expect(creado!.cuerpo.codigoDepartamento).toBe('19');
    expect(creado!.cuerpo.codigoMunicipio).toBe('19001');
    expect(creado!.cuerpo.aforoMaximo).toBe(120);

    componente.cambiar('aforoMaximo', '');
    await componente.guardar();
    expect(creado!.cuerpo.aforoMaximo).toBeNull();
  });

  it('el espacio de una organización se crea con la de la URL y el de una persona, sin organización', async () => {
    montar({ id: null });
    componente.cambiar('nombre', 'Espacio de la organización');
    await componente.guardar();
    expect(creado!.organizacionId).toBe('3104');

    montar({ id: null, persona: true });
    componente.cambiar('nombre', 'Espacio de una persona');
    await componente.guardar();
    expect(creado!.organizacionId).toBeNull();
    // Una persona administra lo suyo: ve enviar y retirar sin ser «administradora» de nada.
    expect(componente.puedeAdministrar()).toBeTrue();
  });

  it('tras crear lleva a la ficha del espacio nuevo, en la lista de su responsable', async () => {
    montar({ id: null });
    componente.cambiar('nombre', 'Espacio nuevo');

    await componente.guardar();

    expect(navegadoA).toEqual(['/gestion/o', '3104', 'procesos', 'espacios', '99']);
  });

  it('los errores del servidor se pintan junto al campo y no se pierde lo escrito', async () => {
    montar({ id: null });
    componente.cambiar('nombre', 'Espacio con error');
    fallo = { message: 'Revisa', payload: { errors: { equipamientoIds: ['Algún elemento de equipamiento no existe en el catálogo.'] } } };

    await componente.guardar();
    fixture.detectChanges();

    expect(componente.erroresDeCampo()['equipamientoIds']).toContain('Algún elemento de equipamiento');
    expect(texto()).toContain('Revisa los campos marcados.');
    expect(componente.formulario().nombre).toBe('Espacio con error');
  });

  it('enviar a revisión pide confirmación; retirar uno publicado exige el motivo', async () => {
    montar({ estado: 'borrador' });
    await componente.enviar();
    expect(pedidas.at(-1)?.titulo).toBe('Enviar a revisión');
    expect(enviadoARevision).toBe(7);

    montar({ estado: 'publicado' });
    respuestaDeConfirmacion = { motivo: 'Cierro el espacio.' };
    await componente.retirarPublicado();
    expect(retiradoPublicado).toEqual({ id: 7, motivo: 'Cierro el espacio.' });
  });

  it('un espacio que no existe se dice y ofrece volver a la lista', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FichaDeEspacioPageComponent],
      providers: [
        provideRouter([]),
        { provide: ServicioDeConfirmacion, useValue: { pedir: () => Promise.resolve(null) } },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('3104'), esAdministradora } },
        { provide: PanelOrganizacionApi, useValue: { obtenerUbicaciones: () => of([]) } },
        { provide: EspaciosService, useValue: { catalogos: () => of(catalogos), obtener: () => throwError(() => ({ message: 'No encontramos ese espacio.' })) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '404' }), data: { responsable: 'organizacion' } } } },
      ],
    });
    const f = TestBed.createComponent(FichaDeEspacioPageComponent);
    f.detectChanges();

    expect((f.nativeElement as HTMLElement).textContent).toContain('No encontramos ese espacio.');
  });

  it('el equipamiento y los tipos de espacio se marcan y desmarcan', () => {
    montar({ id: null });

    componente.alternar('equipamientoIds', 2);
    componente.alternar('tiposIds', 11);
    expect(componente.formulario().equipamientoIds).toEqual([2]);
    expect(componente.formulario().tiposIds).toEqual([11]);
    componente.alternar('equipamientoIds', 2);
    expect(componente.formulario().equipamientoIds).toEqual([]);
    componente.alternar('tiposIds', 11);
    expect(componente.formulario().tiposIds).toEqual([]);
  });
});
