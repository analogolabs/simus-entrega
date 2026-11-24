import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Agenda, AgendaDelOrganizador, AgendamientoDeCitasService, Participante } from '../../../core/services/agendamiento-de-citas.service';
import { PanelOrganizacionStore } from '../panel-organizacion.store';
import { AgendaDeCitasOrganizacionComponent, VistaDeLaAgenda } from './agenda-de-citas-organizacion.component';

function agenda(sobre: Partial<Agenda> = {}): Agenda {
  return {
    id: 7, edicionMercadoId: 9, mercadoId: 4, mercadoNombre: 'Mercado Musical del Valle', anio: 2026, edicionNombre: null,
    fechaInicio: null, fechaFin: null, estado: 'borrador', modo: 'compradores_rotan', duracionMinutos: 20, pausaMinutos: 5,
    topeSolicitudesPendientes: 5, vencimientoSolicitudHoras: 72, cupoArtistas: null, aperturaInscripcionUtc: null,
    cierreInscripcionUtc: null, aprobacionDeArtistas: 'automatica', franjas: 0, artistasAprobados: 0, artistasEnEspera: 0,
    artistasPendientes: 0, compradores: 0, citasSolicitadas: 0, citasConfirmadas: 0, ...sobre,
  };
}

describe('La agenda de citas, vista por la organización', () => {
  let servicio: jasmine.SpyObj<AgendamientoDeCitasService>;

  const buscar = (fixture: ComponentFixture<unknown>, id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  function irA(fixture: ComponentFixture<AgendaDeCitasOrganizacionComponent>, vista: VistaDeLaAgenda): void {
    fixture.componentInstance.vista.set(vista);
    fixture.detectChanges();
  }

  function montar(parametros: Record<string, string>, datos?: AgendaDelOrganizador): ComponentFixture<AgendaDeCitasOrganizacionComponent> {
    if (datos) servicio.agendaDelOrganizador.and.returnValue(of(datos));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AgendamientoDeCitasService, useValue: servicio },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('5') } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(parametros) }, paramMap: of(convertToParamMap(parametros)), queryParamMap: of(convertToParamMap({})) } },
      ],
    });
    const fixture = TestBed.createComponent(AgendaDeCitasOrganizacionComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    servicio = jasmine.createSpyObj<AgendamientoDeCitasService>('AgendamientoDeCitasService', [
      'agendaDelOrganizador', 'configurar', 'cambiarEstado', 'generarFranjas', 'agregarComprador', 'asignarEspacio',
      'decidirSobreParticipante', 'cancelarComoOrganizacion', 'urlDelCsv', 'emitirInvitacion', 'crearAgenda', 'actualizarAgenda',
      'retirarFranja', 'edicionesConAgenda', 'urlDelCalendarioDeLaOrganizacion',
    ]);
    servicio.urlDelCsv.and.returnValue('/api/v1/externo/organizaciones/5/agendas-de-citas/7/exportar.csv');
    servicio.urlDelCalendarioDeLaOrganizacion.and.returnValue('/api/v1/externo/organizaciones/5/agendas-de-citas/7/exportar.ics');
    servicio.edicionesConAgenda.and.returnValue(of([]));
  });

  it('sin agenda creada solo ofrece la configuración y no las franjas ni los invitados', () => {
    const fixture = montar({ id: '4', edicionId: '9' });
    fixture.componentInstance.paso.set(4);
    fixture.detectChanges();

    expect(buscar(fixture, 'guardar-configuracion')?.textContent).toContain('Habilitar la agenda');
    expect(buscar(fixture, 'siguiente-paso')).toBeNull();
    expect(buscar(fixture, 'generar-franjas')).toBeNull();
    expect(buscar(fixture, 'invitar-comprador')).toBeNull();
  });

  it('habilitar la agenda manda el modo elegido sobre la edición de la dirección', () => {
    servicio.crearAgenda.and.returnValue(of(agenda()));
    const fixture = montar({ id: '4', edicionId: '9' });
    fixture.componentInstance.cfgModo.set('compradores_fijos');
    fixture.componentInstance.cfgCupo.set(40);
    fixture.componentInstance.cfgCupoDeCitas.set(3);
    fixture.componentInstance.cfgSubtitulo.set('Ronda de bookers');

    fixture.componentInstance.guardarConfiguracion();

    expect(servicio.crearAgenda).toHaveBeenCalledWith('5', '9', jasmine.objectContaining({
      modo: 'compradores_fijos', duracionMinutos: 20, pausaMinutos: 5, cupoArtistas: 40, citasMaximasPorVisitante: 3, subtitulo: 'Ronda de bookers',
    }));
  });

  it('una agenda nueva parte del nombre del Mercado y de la edición como subtítulo', () => {
    servicio.edicionesConAgenda.and.returnValue(of([{
      edicionId: 9, mercadoId: 4, mercadoNombre: 'Mercado Musical del Valle', anio: 2026, edicionNombre: 'Edición del Pacífico',
      estadoEdicion: 'programada', fechaInicio: null, fechaFin: null, agendaId: null, agendaEstado: null,
    }]));
    const fixture = montar({ id: '4', edicionId: '9' });

    expect(fixture.componentInstance.cfgNombre()).toBe('Mercado Musical del Valle');
    expect(fixture.componentInstance.cfgSubtitulo()).toBe('Edición del Pacífico');
  });

  it('el rótulo del cupo de citas sigue a la modalidad y el plazo de respuesta se recoge con aprobación de la organización', () => {
    const fixture = montar({ id: '4', edicionId: '9' });
    fixture.componentInstance.paso.set(3);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    // La modalidad por omisión es la más común: compradores con mesa fija y artistas que rotan.
    expect(raiz.querySelector('[data-testid="cupo-de-citas"]')!.textContent).toContain('Cupo de citas por artista');
    expect(raiz.querySelector('[data-testid="plazo-de-respuesta"]')!.tagName).toBe('DIV');

    fixture.componentInstance.cfgModo.set('compradores_rotan');
    fixture.componentInstance.cfgAprobacion.set('aceptacion');
    fixture.detectChanges();
    expect(raiz.querySelector('[data-testid="cupo-de-citas"]')!.textContent).toContain('Cupo de citas por comprador o booker');
    expect(raiz.querySelector('[data-testid="quien-pide"]')!.textContent).toContain('Los compradores o bookers piden la cita al artista');
    expect(raiz.querySelector('[data-testid="plazo-de-respuesta"]')!.tagName).toBe('DETAILS');
  });

  it('en preparación muestra qué falta antes de abrir y la vista previa de lo que verán los artistas', () => {
    const fixture = montar({ agendaId: '7' }, { agenda: agenda({ franjas: 0, compradores: 0 }), franjas: [], participantes: [], citas: [] });

    expect(buscar(fixture, 'antes-de-abrir')).not.toBeNull();
    expect(buscar(fixture, 'verificacion-franjas')!.getAttribute('data-listo')).toBe('false');
    expect(buscar(fixture, 'verificacion-franjas')!.textContent).toContain('Sin franjas no se puede abrir la inscripción');
    expect(buscar(fixture, 'vista-previa-de-agenda')!.textContent).toContain('Los compradores rotan; los artistas tienen stand fijo');
    expect(buscar(fixture, 'recorrido-de-la-agenda')!.textContent).toContain('En preparación');
  });

  it('con franjas generadas la duración y la pausa quedan bloqueadas, y se explica por qué', () => {
    const fixture = montar({ agendaId: '7' }, {
      agenda: agenda({ franjas: 5 }), franjas: [], participantes: [], citas: [],
    });

    irA(fixture, 'configuracion');
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="duracion"]')!.closest('[aria-disabled="true"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="pausa"]')!.closest('[aria-disabled="true"]')).not.toBeNull();
    // Y pulsar otra opción no cambia nada.
    raiz.querySelector<HTMLButtonElement>('[data-testid="duracion"] [data-opcion="30"]')!.click();
    expect(fixture.componentInstance.cfgDuracion()).toBe(20);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ya no se pueden cambiar');
  });

  it('abrir la inscripción exige al menos una franja', () => {
    const sinFranjas = montar({ agendaId: '7' }, { agenda: agenda({ franjas: 0 }), franjas: [], participantes: [], citas: [] });
    expect((buscar(sinFranjas, 'abrir-agenda') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('una agenda cerrada no deja cambiar nada y solo permite exportar', () => {
    const fixture = montar({ agendaId: '7' }, {
      agenda: agenda({ estado: 'cerrada', franjas: 5 }), franjas: [], participantes: [], citas: [],
    });

    irA(fixture, 'configuracion');
    expect((buscar(fixture, 'guardar-configuracion') as HTMLButtonElement).disabled).toBeTrue();
    irA(fixture, 'franjas');
    expect(buscar(fixture, 'generar-franjas')).toBeNull();
    irA(fixture, 'participantes');
    expect(buscar(fixture, 'invitar-comprador')).toBeNull();
    expect(buscar(fixture, 'cerrar-agenda')).toBeNull();
    expect(buscar(fixture, 'exportar-csv')?.getAttribute('href')).toContain('/exportar.csv');
  });

  it('muestra el cupo y la lista de espera de los artistas con su lugar', () => {
    const fixture = montar({ agendaId: '7' }, {
      agenda: agenda({ estado: 'abierta', franjas: 5, cupoArtistas: 1, artistasAprobados: 1, artistasEnEspera: 1 }),
      franjas: [],
      participantes: [
        {
          id: 1, rol: 'artista', nombre: 'Primero Ocampo', entidad: null, tipoDeComprador: null, presentacion: 'Música del Pacífico.',
          enlaces: null, representaA: null, espacio: null, estado: 'aprobado', motivoDeLaDecision: null,
          fechaInscripcion: '2026-11-11T14:00:00Z', tieneCuenta: true, posicionEnLaLista: null, correoInvitacion: null,
          contactoCorreo: null, contactoTelefono: null, invitacionPendiente: false,
        },
        {
          id: 2, rol: 'artista', nombre: 'Segundo Ocampo', entidad: null, tipoDeComprador: null, presentacion: 'Música llanera.',
          enlaces: null, representaA: null, espacio: null, estado: 'lista_de_espera', motivoDeLaDecision: null,
          fechaInscripcion: '2026-11-11T14:05:00Z', tieneCuenta: true, posicionEnLaLista: 1, correoInvitacion: null,
          contactoCorreo: null, contactoTelefono: null, invitacionPendiente: false,
        },
      ],
      citas: [],
    });

    irA(fixture, 'participantes');
    expect(buscar(fixture, 'cifras-de-artistas')?.textContent).toContain('1 admitidos de 1');
    expect(buscar(fixture, 'cifras-de-artistas')?.textContent).toContain('1 en lista de espera');
    expect(buscar(fixture, 'lista-de-artistas')?.textContent).toContain('lugar 1');
  });

  const artista = (id: number, nombre: string, estado: Participante['estado']): Participante => ({
    id, rol: 'artista', nombre, entidad: null, tipoDeComprador: null, presentacion: 'Música del Pacífico.',
    enlaces: null, representaA: null, espacio: null, estado, motivoDeLaDecision: null,
    fechaInscripcion: '2026-11-11T14:00:00Z', tieneCuenta: true, posicionEnLaLista: null, correoInvitacion: null,
    contactoCorreo: null, contactoTelefono: null, invitacionPendiente: false,
  });

  it('el interruptor de aprobación manda la elección de la organización', () => {
    servicio.crearAgenda.and.returnValue(of(agenda()));
    const fixture = montar({ id: '4', edicionId: '9' });
    fixture.componentInstance.paso.set(4);
    fixture.detectChanges();

    (buscar(fixture, 'aprobacion-aceptacion') as HTMLInputElement).click();
    buscar(fixture, 'guardar-configuracion')!.click();

    expect(servicio.crearAgenda).toHaveBeenCalledWith('5', '9', jasmine.objectContaining({ aprobacionDeArtistas: 'aceptacion' }));
  });

  it('con aprobación por aceptación muestra la cola y aprueba sin pedir motivo', () => {
    servicio.decidirSobreParticipante.and.returnValue(of(artista(3, 'Tercera Ocampo', 'aprobado')));
    servicio.agendaDelOrganizador.and.returnValue(of({
      agenda: agenda({ estado: 'abierta', franjas: 5, aprobacionDeArtistas: 'aceptacion', artistasPendientes: 1 }),
      franjas: [], participantes: [artista(3, 'Tercera Ocampo', 'pendiente')], citas: [],
    }));
    const fixture = montar({ agendaId: '7' });

    expect(buscar(fixture, 'cola-de-aprobaciones')?.textContent).toContain('Tercera Ocampo');
    // Un solo pendiente se dice en singular («1 inscripción», no «1 inscripciones»).
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('1 inscripciones');
    irA(fixture, 'participantes');
    expect(buscar(fixture, 'cifras-de-artistas')?.textContent).toContain('1 por aprobar');
    irA(fixture, 'resumen');
    buscar(fixture, 'aprobar-3')!.click();

    expect(servicio.decidirSobreParticipante).toHaveBeenCalledWith('5', 7, 3, 'aprobar', null);
  });

  it('con aprobación automática no muestra la cola de aprobaciones', () => {
    const fixture = montar({ agendaId: '7' }, {
      agenda: agenda({ estado: 'abierta', franjas: 5 }), franjas: [], participantes: [], citas: [],
    });

    expect(buscar(fixture, 'cola-de-aprobaciones')).toBeNull();
  });

  it('a un comprador sin cuenta se le puede enviar otro enlace y se dice si ya tiene uno vigente', () => {
    servicio.emitirInvitacion.and.returnValue(of({ participanteId: 4, enlace: '/ecosistema/invitacion-agenda?testigo=abc', fechaExpiracion: '2026-11-19T14:00:00Z' }));
    const fixture = montar({ agendaId: '7' }, {
      agenda: agenda({ estado: 'abierta', franjas: 5, compradores: 1 }), franjas: [],
      participantes: [{
        id: 4, rol: 'comprador', nombre: 'Booker del Valle', entidad: 'Festival', tipoDeComprador: 'festival', presentacion: null,
        enlaces: null, representaA: null, espacio: null, estado: 'aprobado', motivoDeLaDecision: null,
        fechaInscripcion: '2026-11-11T14:00:00Z', tieneCuenta: false, posicionEnLaLista: null, correoInvitacion: 'booker@correo.test',
        contactoCorreo: null, contactoTelefono: null, invitacionPendiente: true,
      }],
      citas: [],
    });

    irA(fixture, 'participantes');
    expect(buscar(fixture, 'cuenta-de-4')?.textContent).toContain('Invitación enviada');
    expect(buscar(fixture, 'aviso-de-invitacion')?.textContent).toContain('7 días');
    buscar(fixture, 'reenviar-invitacion-4')!.click();

    expect(servicio.emitirInvitacion).toHaveBeenCalledWith('5', 7, 4);
  });

  it('la agenda se abre a pantalla completa, bajo el Mercado, y vuelve a su ficha', () => {
    const fixture = montar({ id: '4', agendaId: '7' }, { agenda: agenda({ estado: 'abierta', franjas: 2 }), franjas: [], participantes: [], citas: [] });
    const volver = buscar(fixture, 'volver-de-la-herramienta') as HTMLAnchorElement;

    expect(volver.getAttribute('href')).toBe('/gestion/o/5/procesos/mercados/4');
    expect(buscar(fixture, 'siguiente-paso')?.textContent).toContain('La inscripción está abierta');
  });

  it('el calendario muestra las franjas con sus citas por estado y la leyenda', () => {
    const fixture = montar({ id: '4', agendaId: '7' }, {
      agenda: agenda({ estado: 'en_curso', franjas: 2 }),
      franjas: [{ id: 100, inicioUtc: '2026-12-19T14:00:00Z', finUtc: '2026-12-19T14:20:00Z' }, { id: 101, inicioUtc: '2026-12-19T14:25:00Z', finUtc: '2026-12-19T14:45:00Z' }],
      participantes: [],
      citas: [{
        id: 1, franjaId: 100, inicioUtc: '2026-12-19T14:00:00Z', finUtc: '2026-12-19T14:20:00Z', estado: 'confirmada', anfitrionId: 1,
        anfitrionNombre: 'Ana', anfitrionEntidad: null, anfitrionEspacio: null, visitanteId: 2, visitanteNombre: 'Beto', visitanteEntidad: null,
        mensajeInicial: null, motivoDeLaDecision: null, venceUtc: null, fechaSolicitud: '2026-12-01T00:00:00Z', contactoCorreo: null, contactoTelefono: null,
      }],
    });
    irA(fixture, 'calendario');

    expect(buscar(fixture, 'calendario')).not.toBeNull();
    expect(buscar(fixture, 'calendario')?.querySelector('[data-celda="100"]')?.getAttribute('data-estado')).toBe('confirmada');
    expect(buscar(fixture, 'calendario')?.querySelector('[data-celda="101"]')?.getAttribute('data-estado')).toBe('libre');
    expect(buscar(fixture, 'calendario-leyenda')?.textContent).toContain('Confirmada');
  });
});
