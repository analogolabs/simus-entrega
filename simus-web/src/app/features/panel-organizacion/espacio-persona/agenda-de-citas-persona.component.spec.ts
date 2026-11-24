import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import {
  AgendamientoDeCitasService, Cita, MiAgenda, Participante,
} from '../../../core/services/agendamiento-de-citas.service';
import { MiPerfilPublico, PerfilPublicoService } from '../../../core/services/perfil-publico.service';
import { MiAgendaDeCitasComponent, MisAgendasDeCitasComponent } from './agenda-de-citas-persona.component';

function persona(sobre: Partial<Participante>): Participante {
  return {
    id: 1, rol: 'artista', nombre: 'Valeria Ocampo', entidad: null, tipoDeComprador: null, presentacion: 'Música del Pacífico.',
    enlaces: null, representaA: null, espacio: null, estado: 'aprobado', motivoDeLaDecision: null,
    fechaInscripcion: '2026-11-11T14:00:00Z', tieneCuenta: true, posicionEnLaLista: null, correoInvitacion: null,
    contactoCorreo: null, contactoTelefono: null, invitacionPendiente: false, ...sobre,
  };
}

function cita(sobre: Partial<Cita>): Cita {
  return {
    id: 21, franjaId: 100, inicioUtc: '2026-11-21T14:00:00Z', finUtc: '2026-11-21T14:20:00Z', estado: 'solicitada',
    anfitrionId: 1, anfitrionNombre: 'Valeria Ocampo', anfitrionEntidad: null, anfitrionEspacio: null,
    visitanteId: 2, visitanteNombre: 'Camilo Comprador', visitanteEntidad: null, mensajeInicial: null,
    motivoDeLaDecision: null, venceUtc: '2026-11-24T14:00:00Z', fechaSolicitud: '2026-11-11T14:00:00Z',
    contactoCorreo: null, contactoTelefono: null, ...sobre,
  };
}

function vista(sobre: Partial<MiAgenda>): MiAgenda {
  return {
    agenda: {
      agendaId: 7, edicionMercadoId: 3, mercadoNombre: 'Mercado Musical del Valle', anio: 2026, edicionNombre: null,
      fechaInicio: null, fechaFin: null, estado: 'abierta', modo: 'compradores_rotan', duracionMinutos: 20,
      cupoArtistas: 40, artistasAprobados: 12, inscripcionAbierta: true, miRol: null, miEstado: null, aprobacionDeArtistas: 'automatica',
    },
    miParticipacion: null, posicionEnLaLista: null, rotoYPidoCitas: false, puedoInscribirme: false, puedoPedirCitas: false,
    solicitudesPendientes: 0, topeSolicitudesPendientes: 5, vencimientoSolicitudHoras: 72, franjas: [], citas: [], anfitriones: [],
    ...sobre,
  };
}

describe('Mi agenda de citas', () => {
  let servicio: jasmine.SpyObj<AgendamientoDeCitasService>;
  let perfiles: jasmine.SpyObj<PerfilPublicoService>;
  const PERFIL = {
    existe: true, clave: 'v', nombreVisible: 'Valeria Ocampo', organizaciones: [{ id: 1, nombre: 'Sonora Caribe' }], biografiaCorta: 'Corta.',
    biografiaLarga: 'Música del Pacífico en cuarteto.', enlaces: ['https://youtu.be/abc', 'https://v.bandcamp.com'],
  } as unknown as MiPerfilPublico;

  function montar(contenido: MiAgenda): ComponentFixture<MiAgendaDeCitasComponent> {
    servicio.miAgenda.and.returnValue(of(contenido));
    const fixture = TestBed.createComponent(MiAgendaDeCitasComponent);
    fixture.detectChanges();
    return fixture;
  }

  const texto = (fixture: ComponentFixture<unknown>): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const buscar = (fixture: ComponentFixture<unknown>, id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    servicio = jasmine.createSpyObj<AgendamientoDeCitasService>('AgendamientoDeCitasService', [
      'miAgenda', 'misAgendas', 'guardarMiFoto', 'inscribirme', 'retirarme', 'pedirCita', 'confirmarCita', 'rechazarCita', 'cancelarCita', 'urlDelCalendario',
    ]);
    servicio.urlDelCalendario.and.returnValue('/api/v1/externo/agendas-de-citas/7/mi-agenda.ics');
    perfiles = jasmine.createSpyObj<PerfilPublicoService>('PerfilPublicoService', ['mio', 'subirFoto']);
    perfiles.mio.and.returnValue(of({ ...PERFIL, existe: false }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PerfilPublicoService, useValue: perfiles },
        { provide: AgendamientoDeCitasService, useValue: servicio },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ agendaId: '7' }) } } },
      ],
    });
  });

  it('quien aún no se inscribe ve el formulario y que inscribirse no garantiza una cita', () => {
    const fixture = montar(vista({ puedoInscribirme: true }));

    expect(buscar(fixture, 'inscribirme')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('#ins-presentacion')).not.toBeNull();
    expect(texto(fixture)).toContain('no garantiza una cita');
    // Y se le dice el cupo, para que entienda la lista de espera.
    expect(texto(fixture)).toContain('Artistas admitidos: 12 de 40 lugares ocupados');
  });

  it('al abrir la agenda explica la modalidad, el lugar de cada quien y las reglas', () => {
    const fixture = montar(vista({ agenda: { ...vista({}).agenda, citasMaximasPorVisitante: 4 }, miParticipacion: persona({ rol: 'artista', espacio: null }) }));

    expect(buscar(fixture, 'modalidad')!.textContent).toContain('stand fijo');
    expect(buscar(fixture, 'tu-lugar')!.textContent).toContain('tienes stand fijo');
    const reglas = buscar(fixture, 'reglas-de-la-agenda')!.textContent ?? '';
    expect(reglas).toContain('No puedes tener dos citas en el mismo horario');
    expect(reglas).toContain('Máximo 4 citas');
    expect(reglas).toContain('orden de inscripción');
  });

  it('quien tiene stand fijo ve el sitio asignado y lo registrado en su horario', () => {
    const fixture = montar(vista({
      miParticipacion: persona({ id: 1, rol: 'artista', espacio: 'Stand 7' }),
      citas: [cita({ estado: 'confirmada' })],
    }));

    expect(buscar(fixture, 'mi-sitio')!.textContent).toContain('Se te asignó: Stand 7');
    expect(buscar(fixture, 'citas-en-mi-horario')!.textContent).toContain('Camilo Comprador');
  });

  it('el título del sitio no repite «mesa» ni «stand» cuando el nombre ya lo dice', () => {
    const fixture = montar(vista({ miParticipacion: persona({ rol: 'artista', espacio: 'Pabellón 3' }) }));
    const c = fixture.componentInstance;
    expect(c.tituloDelSitio({ espacio: 'Mesa 1', tipo: 'mesa' })).toBe('Se te asignó: Mesa 1');
    expect(c.tituloDelSitio({ espacio: 'Sala B', tipo: 'mesa' })).toBe('Se te asignó la mesa Sala B');
    expect(c.tituloDelSitio({ espacio: 'Pabellón 3', tipo: 'stand' })).toBe('Se te asignó el stand Pabellón 3');
    expect(c.tituloDelSitio({ espacio: null, tipo: 'stand' })).toBe('Tu stand fijo');
  });

  it('en una agenda cerrada con citas, «Mis citas» lo dice y no ofrece cancelar', () => {
    const fixture = montar(vista({
      agenda: { ...vista({}).agenda, estado: 'cerrada', inscripcionAbierta: false },
      miParticipacion: persona({ id: 2, rol: 'comprador' }),
      citas: [cita({ id: 31, estado: 'confirmada', anfitrionId: 1, visitanteId: 2 }), cita({ id: 32, estado: 'rechazada' })],
    }));
    fixture.componentInstance.pestana.set('citas');
    fixture.detectChanges();

    expect(buscar(fixture, 'siguiente-paso')!.textContent).toContain('La agenda está cerrada');
    expect(buscar(fixture, 'siguiente-paso')!.textContent).toContain('Tuviste 2 citas');
    expect(buscar(fixture, 'cancelar-cita')).toBeNull();
    expect(buscar(fixture, 'agenda-cerrada-sin-cancelar')!.textContent).toContain('ya no se puede cancelar');
  });

  it('con citas en una agenda abierta ya no dice «cuando haya»', () => {
    const fixture = montar(vista({ miParticipacion: persona({ id: 2, rol: 'comprador' }), citas: [cita({ estado: 'confirmada', visitanteId: 2 })] }));
    expect(buscar(fixture, 'siguiente-paso')!.textContent).toContain('Tienes 1 cita');
    expect(buscar(fixture, 'siguiente-paso')!.textContent).not.toContain('cuando haya');
  });

  it('«Mi día» usa la foto de la otra parte cuando existe', () => {
    const fixture = montar(vista({
      miParticipacion: persona({ id: 2, rol: 'comprador' }),
      citas: [cita({ estado: 'confirmada', visitanteId: 2, otraParte: { nombre: 'Valeria Ocampo', entidad: null, presentacion: null, enlaces: null, fotoUrl: '/api/v1/publico/archivos/9' } })],
    }));
    const img = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="cita-del-dia"] img');
    expect(img?.getAttribute('src')).toBe('/api/v1/publico/archivos/9');
  });

  it('al inscribirse, el formulario llega precargado con el perfil público (presentación, agrupación y enlaces) y se puede restaurar', () => {
    perfiles.mio.and.returnValue(of(PERFIL));
    const fixture = montar(vista({ puedoInscribirme: true }));
    const c = fixture.componentInstance;
    expect(c.iPresentacion()).toBe('Música del Pacífico en cuarteto.');
    expect(c.iEntidad()).toBe('Sonora Caribe');
    expect(c.iEnlaces()).toBe('https://youtu.be/abc\nhttps://v.bandcamp.com');
    c.iPresentacion.set('Otra cosa');
    c.restaurarDesdeElPerfil();
    expect(c.iPresentacion()).toBe('Música del Pacífico en cuarteto.');
    expect(buscar(fixture, 'restaurar-desde-el-perfil')).not.toBeNull();
  });

  it('el portafolio vacío se precarga del perfil, pero uno ya guardado no se pisa', () => {
    perfiles.mio.and.returnValue(of(PERFIL));
    const vacio = montar(vista({ miParticipacion: persona({ presentacion: null }) }));
    expect(vacio.componentInstance.pPresentacion()).toBe('Música del Pacífico en cuarteto.');
    const propio = montar(vista({ miParticipacion: persona({ presentacion: 'La mía', enlaces: 'https://mio.test' }) }));
    expect(propio.componentInstance.pPresentacion()).toBe('La mía');
    expect(propio.componentInstance.pEnlaces()).toBe('https://mio.test');
  });

  it('al elegir un hueco libre se ofrece con quién agendar, en el panel de la derecha', () => {
    const fixture = montar(vista({
      agenda: { ...vista({}).agenda, modo: 'compradores_rotan' },
      miParticipacion: persona({ id: 2, rol: 'comprador' }), rotoYPidoCitas: true, puedoPedirCitas: true,
      franjas: [{ id: 100, inicioUtc: '2026-12-19T14:00:00Z', finUtc: '2026-12-19T14:20:00Z' }],
      anfitriones: [{ anfitrion: persona({ id: 1, nombre: 'Valeria Ocampo' }), franjasLibres: [100] }],
    }));
    fixture.componentInstance.franjaElegida.set(100);
    fixture.detectChanges();

    expect(buscar(fixture, 'detalle-de-la-franja')!.tagName).toBe('ASIDE');
    expect(buscar(fixture, 'libres-en-la-franja')!.textContent).toContain('Valeria Ocampo');
  });

  it('inscribirse manda la presentación y no un correo propio', () => {
    servicio.inscribirme.and.returnValue(of(vista({ miParticipacion: persona({}) })));
    const fixture = montar(vista({ puedoInscribirme: true }));
    const componente = fixture.componentInstance;
    componente.iPresentacion.set('Música del Pacífico para cuarteto.');

    componente.inscribirme();

    expect(servicio.inscribirme).toHaveBeenCalledWith(7, jasmine.objectContaining({
      presentacion: 'Música del Pacífico para cuarteto.', contactoCorreo: null,
    }));
  });

  it('el comprador ve a los artistas con sus franjas libres y cuántas solicitudes le quedan', () => {
    const fixture = montar(vista({
      miParticipacion: persona({ id: 2, rol: 'comprador', nombre: 'Camilo Comprador' }),
      rotoYPidoCitas: true, puedoPedirCitas: true, solicitudesPendientes: 1,
      franjas: [
        { id: 100, inicioUtc: '2026-11-21T14:00:00Z', finUtc: '2026-11-21T14:20:00Z' },
        { id: 101, inicioUtc: '2026-11-21T14:25:00Z', finUtc: '2026-11-21T14:45:00Z' },
      ],
      anfitriones: [{ anfitrion: persona({ id: 1 }), franjasLibres: [100, 101] }],
    }));

    // Paso 1: la tarjeta de la persona dice cuántas franjas libres tiene.
    expect(buscar(fixture, 'anfitrion')?.textContent).toContain('2 franjas libres');
    expect(texto(fixture)).toContain('Tienes 1 de 5 solicitudes pendientes');
    expect(texto(fixture)).toContain('vence a las 72 horas');

    // Paso 2: sus franjas libres, como botones de hora.
    buscar(fixture, 'anfitrion')!.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="pedir-franja"]').length).toBe(2);
  });

  it('pedir una cita es un recorrido de tres pasos: persona, franja y confirmación con mensaje', () => {
    servicio.pedirCita.and.returnValue(of(vista({ citas: [cita({ id: 30, anfitrionId: 1, visitanteId: 2 })] })));
    const fixture = montar(vista({
      miParticipacion: persona({ id: 2, rol: 'comprador', nombre: 'Camilo Comprador' }),
      rotoYPidoCitas: true, puedoPedirCitas: true,
      franjas: [{ id: 100, inicioUtc: '2026-11-21T14:00:00Z', finUtc: '2026-11-21T14:20:00Z' }],
      anfitriones: [{ anfitrion: persona({ id: 1 }), franjasLibres: [100] }],
    }));
    const raiz = fixture.nativeElement as HTMLElement;

    buscar(fixture, 'anfitrion')!.click(); fixture.detectChanges();
    (raiz.querySelector('[data-testid="pedir-franja"]') as HTMLElement).click(); fixture.detectChanges();
    expect(buscar(fixture, 'paso-de-confirmar')).not.toBeNull();
    fixture.componentInstance.mensajeDelPedido.set('Quiero escucharte.');
    buscar(fixture, 'confirmar-pedido')!.click();

    expect(servicio.pedirCita).toHaveBeenCalledWith(7, 1, 100, 'Quiero escucharte.');
  });

  it('un artista sin franjas libres que pedir lo lee en la tarjeta y no puede elegirlo', () => {
    const fixture = montar(vista({
      miParticipacion: persona({ id: 2, rol: 'comprador', nombre: 'Camilo Comprador' }),
      rotoYPidoCitas: true, puedoPedirCitas: true,
      anfitriones: [{ anfitrion: persona({ id: 1 }), franjasLibres: [] }],
    }));
    expect(buscar(fixture, 'anfitrion')?.textContent).toContain('Sin franjas libres');
    expect((buscar(fixture, 'anfitrion') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('el contacto de la otra persona solo aparece con la cita confirmada', () => {
    const antes = montar(vista({
      miParticipacion: persona({ id: 2, rol: 'comprador' }),
      citas: [cita({ estado: 'solicitada', contactoCorreo: null })],
    }));
    expect(buscar(antes, 'contacto')).toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AgendamientoDeCitasService, useValue: servicio },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ agendaId: '7' }) } } },
      ],
    });
    const despues = montar(vista({
      miParticipacion: persona({ id: 2, rol: 'comprador' }),
      citas: [cita({ estado: 'confirmada', contactoCorreo: 'valeria@correo.test', contactoTelefono: '3001234567' })],
    }));
    expect(buscar(despues, 'contacto')?.textContent).toContain('valeria@correo.test');
    expect(buscar(despues, 'agregar-al-calendario')).not.toBeNull();
  });

  it('quien recibe la solicitud puede confirmarla o rechazarla; quien la pidió, retirarla', () => {
    const comoAnfitrion = montar(vista({
      miParticipacion: persona({ id: 1 }),
      citas: [cita({ estado: 'solicitada', anfitrionId: 1, visitanteId: 2 })],
    }));
    expect(buscar(comoAnfitrion, 'confirmar-cita')).not.toBeNull();
    expect(buscar(comoAnfitrion, 'rechazar-cita')).not.toBeNull();
    expect(buscar(comoAnfitrion, 'cancelar-cita')).toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AgendamientoDeCitasService, useValue: servicio },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ agendaId: '7' }) } } },
      ],
    });
    const comoVisitante = montar(vista({
      miParticipacion: persona({ id: 2, rol: 'comprador' }),
      citas: [cita({ estado: 'solicitada', anfitrionId: 1, visitanteId: 2 })],
    }));
    expect(buscar(comoVisitante, 'confirmar-cita')).toBeNull();
    expect(buscar(comoVisitante, 'cancelar-cita')?.textContent).toContain('Retirar la solicitud');
  });

  it('quien espera la aprobación de la organización lo lee y no puede pedir citas', () => {
    const fixture = montar(vista({
      agenda: { ...vista({}).agenda, aprobacionDeArtistas: 'aceptacion', miRol: 'artista', miEstado: 'pendiente' },
      miParticipacion: persona({ estado: 'pendiente' }),
    }));

    expect(buscar(fixture, 'mi-participacion')?.textContent).toContain('Pendiente de aprobación');
    expect(buscar(fixture, 'inscripcion-pendiente')?.textContent).toContain('Te avisaremos');
    expect(buscar(fixture, 'lista-de-anfitriones')).toBeNull();
  });

  it('antes de inscribirse, con aprobación por aceptación, avisa que quedará pendiente', () => {
    const fixture = montar(vista({
      agenda: { ...vista({}).agenda, aprobacionDeArtistas: 'aceptacion' },
      puedoInscribirme: true,
    }));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('quedarás pendiente hasta su decisión');
  });

  it('quien está en la lista de espera lo lee con su lugar y no puede pedir citas', () => {
    const fixture = montar(vista({
      miParticipacion: persona({ estado: 'lista_de_espera' }), posicionEnLaLista: 3,
    }));

    expect(buscar(fixture, 'mi-participacion')?.textContent).toContain('En lista de espera');
    expect(buscar(fixture, 'mi-participacion')?.textContent).toContain('lugar 3');
    expect(buscar(fixture, 'lista-de-anfitriones')).toBeNull();
  });
  it('«Tu foto»: quien participa la ve y, al elegir una, se sube al Banco y se vincula a su participación', () => {
    const conFoto = vista({ miParticipacion: persona({ id: 2, fotoUrl: '/api/v1/publico/archivos/9' }) });
    servicio.guardarMiFoto.and.returnValue(of(conFoto));
    const fixture = montar(conFoto);
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-foto-del-participante]')).not.toBeNull();
    expect(raiz.querySelector('[data-foto-del-participante] img')?.getAttribute('src')).toBe('/api/v1/publico/archivos/9');

    let alt = '';
    (fixture.componentInstance as unknown as { perfiles: unknown }).perfiles = {
      subirFoto: (_: File, texto: string) => { alt = texto; return of({ id: 41, url: '/api/v1/publico/archivos/41' }); },
    };
    fixture.componentInstance.elegirFoto(new File(['x'], 'yo.jpg', { type: 'image/jpeg' }));

    expect(alt).toContain('Foto de');
    expect(servicio.guardarMiFoto).toHaveBeenCalledWith(7, 41);
  });

  it('«Tu foto»: antes de inscribirse la foto espera y no se sube todavía', () => {
    const fixture = montar(vista({ puedoInscribirme: true }));
    fixture.componentInstance.elegirFoto(new File(['x'], 'yo.jpg', { type: 'image/jpeg' }));
    expect(fixture.componentInstance.fotoPendiente()).not.toBeNull();
    expect(servicio.guardarMiFoto).not.toHaveBeenCalled();
  });
});

describe('Mis agendas de citas (lista)', () => {
  it('sin agendas abiertas lo dice y no deja la pantalla en blanco', () => {
    const servicio = jasmine.createSpyObj<AgendamientoDeCitasService>('AgendamientoDeCitasService', ['misAgendas']);
    servicio.misAgendas.and.returnValue(of([]));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AgendamientoDeCitasService, useValue: servicio }] });

    const fixture = TestBed.createComponent(MisAgendasDeCitasComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="sin-agendas"]')).not.toBeNull();
  });

});
