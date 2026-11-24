import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CatalogService } from '../../core/services/catalog.service';
import { EventosDeOrganizacionService } from './eventos-de-organizacion.service';
import { PanelEventosComponent } from './panel-eventos.component';
import { AnunciarEventoSolicitud, EventoDeLaOrganizacion, ProcesoQueEnmarca } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { accionesDeEvento } from '../../core/acciones/acciones-de-evento';
import { mensajeDeGuardado } from './panel-eventos.component';

/**
 *: los eventos de organización pueden guardarse como borrador, enmarcarse en un Mercado y
 * editarse; un evento publicado que cambia vuelve a revisión.
 */
describe('PanelEventosComponent', () => {
  const procesos: ProcesoQueEnmarca[] = [
    { id: '7', tipo: 'festival', tipoEtiqueta: 'Festival', nombre: 'Festival del Valle', territorio: null },
    { id: '7', tipo: 'mercado', tipoEtiqueta: 'Mercado', nombre: 'Mercado del Valle', territorio: null },
  ];
  const borrador: EventoDeLaOrganizacion = {
    id: '31', titulo: 'Rueda de negocios', fechaInicio: '2026-11-20', fechaFin: null, modalidad: 'presencial',
    lugar: 'Centro', estado: 'borrador', estadoEtiqueta: 'Borrador', procesoNombre: 'Mercado del Valle',
    fechaActualizacion: '2026-11-05T00:00:00Z', procesoTipo: 'mercado', ultimoMotivo: 'Falta la hora.',
  };

  let enviados: AnunciarEventoSolicitud[];
  /** El rol de la sesión, por el store. */
  const esAdministradora = signal(true);
  let api: jasmine.SpyObj<EventosDeOrganizacionService>;

  beforeEach(async () => {
    enviados = [];
    esAdministradora.set(true);
    api = jasmine.createSpyObj<EventosDeOrganizacionService>('EventosDeOrganizacionService',
      ['procesosQueEnmarcan', 'eventosDeLaOrganizacion', 'anunciarEvento', 'editarEvento', 'enviarARevision', 'evento', 'historial',
        'cancelarEvento', 'retirarEvento']);
    api.cancelarEvento.and.returnValue(of({ id: '33', estado: 'publicado', cancelado: true }));
    api.retirarEvento.and.returnValue(of({ id: '33', estado: 'archivado' }));
    api.procesosQueEnmarcan.and.returnValue(of(procesos));
    api.eventosDeLaOrganizacion.and.returnValue(of([borrador]));
    api.anunciarEvento.and.callFake((_org, solicitud) => {
      enviados.push(solicitud);
      return of({ id: '40', estado: solicitud.borrador ? 'borrador' : 'en_revision' });
    });
    api.enviarARevision.and.returnValue(of({ id: '31', estado: 'en_revision' }));
    api.evento.and.returnValue(of({
      id: '50', titulo: 'Concierto', descripcion: 'Abierto', descripcionLarga: null, fechaInicio: '2026-11-20',
      fechaFin: null, horaInicio: '19:00:00', horaFin: null, modalidad: 'presencial', lugar: 'Plaza',
      codigoDepartamento: null, codigoMunicipio: null, url: null, festivalId: 7, mercadoId: null,
      estado: 'publicado', estadoEtiqueta: 'Publicado', ultimoMotivo: null,
    }));

    await TestBed.configureTestingModule({
      imports: [PanelEventosComponent],
      providers: [
        provideRouter([]),
        { provide: EventosDeOrganizacionService, useValue: api },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('117'), esAdministradora } },
        { provide: CatalogService, useValue: { fetchDivipolaConCodigos: () => of([]) } },
      ],
    }).compileComponents();
  });

  async function crear() {
    const fixture = TestBed.createComponent(PanelEventosComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  /** Abre el menú de acciones de una fila y devuelve la opción con esa etiqueta (las acciones viven en el menú, P3). */
  function opcion(fixture: { detectChanges(): void }, fila: HTMLElement, etiqueta: string): HTMLButtonElement {
    if (!fila.querySelector('[data-opcion-accion]')) { fila.querySelector<HTMLButtonElement>('[data-disparador-acciones]')!.click(); fixture.detectChanges(); }
    return Array.from(fila.querySelectorAll<HTMLButtonElement>('[data-opcion-accion]')).find(o => o.textContent?.includes(etiqueta))!;
  }

  it('un evento rechazado dice por qué y ofrece «Editar» apagado, con su motivo, en vez de esconderlo (D3-16)', async () => {
    api.eventosDeLaOrganizacion.and.returnValue(of([
      { ...borrador, id: '32', titulo: 'Evento rechazado', estado: 'rechazado', estadoEtiqueta: 'Rechazado', ultimoMotivo: 'No corresponde al Festival.' },
      { ...borrador, id: '33', titulo: 'Evento publicado', estado: 'publicado', estadoEtiqueta: 'Publicado', ultimoMotivo: null },
    ]));
    const fixture = await crear();
    const filas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')) as HTMLElement[];
    const rechazado = filas.find(fila => fila.textContent?.includes('Evento rechazado'))!;
    const publicado = filas.find(fila => fila.textContent?.includes('Evento publicado'))!;

    expect(rechazado.querySelector('[data-testid="motivo-del-rechazo-del-evento"]')?.textContent).toContain('No corresponde al Festival.');
    const editar = (fila: HTMLElement) => opcion(fixture, fila, 'Editar');
    // NO DESAPARECE SIN EXPLICACIÓN: queda apagado y dice por qué, escrito bajo la opción (modelo de acciones por estado).
    expect(editar(rechazado).disabled).toBeTrue();
    expect(editar(rechazado).querySelector('[data-motivo-de-opcion]')?.textContent).toBe('Un evento archivado o rechazado ya no se edita.');
    expect(editar(publicado).disabled).toBeFalse();
  });

  it('un evento publicado ofrece cancelar y retirar; uno cancelado sigue en la lista, marcado y sin «Editar»', async () => {
    api.eventosDeLaOrganizacion.and.returnValue(of([
      { ...borrador, id: '33', titulo: 'Evento publicado', estado: 'publicado', estadoEtiqueta: 'Publicado', ultimoMotivo: null },
      {
        ...borrador, id: '34', titulo: 'Evento cancelado', estado: 'publicado', estadoEtiqueta: 'Cancelado', ultimoMotivo: null,
        cancelado: true, motivoCancelacion: 'Lluvia en toda la región.',
      },
    ]));
    const fixture = await crear();
    const filas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')) as HTMLElement[];
    const publicado = filas.find(fila => fila.textContent?.includes('Evento publicado'))!;
    const cancelado = filas.find(fila => fila.textContent?.includes('Evento cancelado'))!;
    const boton = (fila: HTMLElement, etiqueta: string) => opcion(fixture, fila, etiqueta);

    expect(boton(publicado, 'Cancelar evento').disabled).toBeFalse();
    expect(boton(publicado, 'Retirar de la agenda').disabled).toBeFalse();

    expect(cancelado.querySelector('[data-testid="motivo-de-la-cancelacion"]')?.textContent).toContain('Lluvia en toda la región.');
    expect(boton(cancelado, 'Editar').disabled).toBeTrue();
    expect(boton(cancelado, 'Cancelar evento').disabled).toBeTrue();
    expect(boton(cancelado, 'Retirar de la agenda').disabled).toBeFalse();
  });

  it('cancelar pide el motivo en el diálogo común y deja el evento en la agenda', async () => {
    const fixture = await crear();
    const c = fixture.componentInstance;
    const pedir = spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo({ motivo: '  Lluvia en toda la región.  ' });
    const evento = { ...borrador, id: '33', titulo: 'Evento publicado', estado: 'publicado', estadoEtiqueta: 'Publicado' };
    const cancelar = accionesDeEvento({ titulo: evento.titulo, estado: 'publicado', esAdministradora: true }).find(a => a.id === 'cancelar')!;

    await c.ejecutar(cancelar, evento);

    expect(pedir).toHaveBeenCalledWith(jasmine.objectContaining({ pideMotivo: true, motivoObligatorio: true, tono: 'destructiva' }));
    expect(api.cancelarEvento).toHaveBeenCalledWith('117', '33', 'Lluvia en toda la región.');
    expect(c.aviso()).toContain('Sigue en la agenda pública');
  });

  it('retirar pide el motivo y avisa de que el evento salió de la agenda', async () => {
    const fixture = await crear();
    const c = fixture.componentInstance;
    spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo({ motivo: 'Se cayó el permiso del lugar.' });
    const evento = { ...borrador, id: '33', titulo: 'Evento publicado', estado: 'publicado', estadoEtiqueta: 'Publicado' };
    const retirar = accionesDeEvento({ titulo: evento.titulo, estado: 'publicado', esAdministradora: true }).find(a => a.id === 'retirar')!;

    await c.ejecutar(retirar, evento);

    expect(api.retirarEvento).toHaveBeenCalledWith('117', '33', 'Se cayó el permiso del lugar.');
    expect(c.aviso()).toContain('salió de la agenda pública');
  });

  it('si se cierra el diálogo sin confirmar no se retira ni se cancela nada', async () => {
    const fixture = await crear();
    const c = fixture.componentInstance;
    spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo(null);
    const evento = { ...borrador, id: '33', titulo: 'Evento publicado', estado: 'publicado', estadoEtiqueta: 'Publicado' };

    for (const accion of accionesDeEvento({ titulo: evento.titulo, estado: 'publicado', esAdministradora: true }).filter(a => a.confirmacion)) {
      await c.ejecutar(accion, evento);
    }

    expect(api.cancelarEvento).not.toHaveBeenCalled();
    expect(api.retirarEvento).not.toHaveBeenCalled();
  });

  it('el evento hereda el territorio del proceso, lo dice y deja cambiarlo (D3-14)', async () => {
    api.procesosQueEnmarcan.and.returnValue(of([
      { id: '7', tipo: 'festival', tipoEtiqueta: 'Festival', nombre: 'Festival del Valle', territorio: 'Cali', codigoDepartamento: '76', codigoMunicipio: '76001' },
      { id: '8', tipo: 'festival', tipoEtiqueta: 'Festival', nombre: 'Festival del Cauca', territorio: 'Popayán', codigoDepartamento: '19', codigoMunicipio: '19001' },
    ]));
    const fixture = await crear();
    const c = fixture.componentInstance;
    c.nuevo();

    c.campo('procesoId', 'festival:7');
    expect(c.formulario()?.codigoDepartamento).toBe('76');
    expect(c.formulario()?.codigoMunicipio).toBe('76001');
    expect(c.esElTerritorioDelProceso()).toBeTrue();

    // MIENTRAS NO ELIJA UNO PROPIO, CAMBIAR DE PROCESO LO ACOMPAÑA.
    c.campo('procesoId', 'festival:8');
    expect(c.formulario()?.codigoDepartamento).toBe('19');

    // SI ELIGE OTRO, YA NO SE LE PISA, y puede volver al del proceso.
    c.cambiarDepartamento('05');
    expect(c.esElTerritorioDelProceso()).toBeFalse();
    c.campo('procesoId', 'festival:7');
    expect(c.formulario()?.codigoDepartamento).toBe('05');
    c.usarElTerritorioDelProceso();
    expect(c.formulario()?.codigoDepartamento).toBe('76');
    expect(c.formulario()?.codigoMunicipio).toBe('76001');
    expect(c.esElTerritorioDelProceso()).toBeTrue();
  });

  it('un proceso sin territorio no propone ninguno', async () => {
    const fixture = await crear();
    const c = fixture.componentInstance;
    c.nuevo();
    c.campo('procesoId', 'festival:7');

    expect(c.formulario()?.codigoDepartamento).toBe('');
    expect(c.procesoConTerritorio()).toBeFalse();
  });

  describe('mensajeDeGuardado', () => {
    it('dice que una errata se corrigió y sigue en la agenda', () => {
      expect(mensajeDeGuardado({ id: '1', estado: 'publicado', esErrata: true }, true)).toContain('Sigue en la agenda pública');
    });

    it('dice qué cambió de fondo cuando vuelve a revisión', () => {
      const mensaje = mensajeDeGuardado({ id: '1', estado: 'en_revision', esErrata: false, cambiosDeFondo: ['la fecha', 'el lugar'] }, true);
      expect(mensaje).toContain('porque cambió la fecha y el lugar');
      expect(mensaje).toContain('Saldrá de la agenda');
    });

    it('conserva los mensajes de borrador y de envío', () => {
      expect(mensajeDeGuardado({ id: '1', estado: 'borrador' }, false)).toContain('borrador');
      expect(mensajeDeGuardado({ id: '1', estado: 'en_revision' }, false)).toContain('quedó enviado');
    });
  });

  it('cada evento abre su historial debajo de la fila, con el motivo de la devolución (#124)', async () => {
    api.historial.and.returnValue(of([{
      id: '9', accion: 'EventoDevuelto', accionEtiqueta: 'Devuelto para corregir', estadoAnterior: 'en_revision',
      estadoNuevo: 'borrador', motivo: 'Falta la hora.', actor: 'Equipo del PNMC', fecha: '2026-11-05T15:00:00Z',
    }]));
    const fixture = await crear();
    const raiz = fixture.nativeElement as HTMLElement;
    const fila0 = raiz.querySelector<HTMLElement>('tbody tr[data-fila]')!;
    expect(raiz.querySelector('#historial-evento-31')).toBeNull();

    opcion(fixture, fila0, 'Ver historial').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.historial).toHaveBeenCalledWith('117', '31');
    const fila = raiz.querySelector('#historial-evento-31')!;
    expect(fila.textContent).toContain('Devuelto para corregir');
    expect(fila.textContent).toContain('Equipo del PNMC');
    expect(fila.textContent).toContain('Falta la hora.');

    // La misma opción cambia a «Ocultar el historial» y lo cierra.
    opcion(fixture, fila0, 'Ocultar el historial').click();
    fixture.detectChanges();
    expect(raiz.querySelector('#historial-evento-31')).toBeNull();
  });

  it('al editor no le ofrece anunciar, editar ni enviar, y le explica por qué (#123)', async () => {
    esAdministradora.set(false);
    const fixture = await crear();
    const raiz = fixture.nativeElement as HTMLElement;
    const botones = Array.from(raiz.querySelectorAll('button')).map(b => b.textContent?.trim());

    expect(raiz.textContent).toContain('Rueda de negocios');
    expect(botones).not.toContain('Anunciar evento');
    // LAS ACCIONES DE LA ADMINISTRACIÓN SE VEN APAGADAS, con quién las hace, en vez de desaparecer.
    const fila = raiz.querySelector<HTMLElement>('tbody tr[data-fila]')!;
    const editar = opcion(fixture, fila, 'Editar');
    const enviar = opcion(fixture, fila, 'Enviar a revisión');
    expect(editar.disabled).toBeTrue();
    expect(enviar.disabled).toBeTrue();
    expect(editar.querySelector('[data-motivo-de-opcion]')?.textContent).toBe('Lo hace quien administra la organización. Tu rol es editor.');
    expect(raiz.querySelector('[data-testid="aviso-solo-administracion"]')?.textContent).toContain('Tu rol es editor');
  });

  it('a la administración le ofrece anunciar, editar y enviar, sin el aviso', async () => {
    const fixture = await crear();
    const raiz = fixture.nativeElement as HTMLElement;
    const botones = Array.from(raiz.querySelectorAll('button')).map(b => b.textContent?.trim());

    expect(botones).toContain('Anunciar evento');
    const enviar = opcion(fixture, raiz.querySelector<HTMLElement>('tbody tr[data-fila]')!, 'Enviar a revisión');
    expect(enviar.disabled).toBeFalse();
    expect(enviar.hasAttribute('data-accion-principal')).toBeTrue();
    expect(raiz.querySelector('[data-testid="aviso-solo-administracion"]')).toBeNull();
  });

  it('P3: la tabla abre con la fecha más cercana primero, se ordena por sus encabezados y «Quitar filtros» reinicia', async () => {
    api.eventosDeLaOrganizacion.and.returnValue(of([
      { ...borrador, id: '41', titulo: 'Concierto lejano', fechaInicio: '2026-12-19', estado: 'publicado', estadoEtiqueta: 'Publicado' },
      { ...borrador, id: '42', titulo: 'Ensayo cercano', fechaInicio: '2026-12-14', fechaFin: '2026-12-16', estado: 'borrador', estadoEtiqueta: 'Borrador' },
    ]));
    const fixture = await crear();
    const raiz = fixture.nativeElement as HTMLElement;
    const titulos = () => Array.from(raiz.querySelectorAll('tbody tr[data-fila] b')).map(b => b.textContent?.trim());
    expect(titulos()).toEqual(['Ensayo cercano', 'Concierto lejano']);
    expect(raiz.querySelector('th[aria-sort="ascending"]')?.textContent).toContain('Fecha');
    expect(raiz.querySelector('tbody tr[data-fila] .tg-aparte')?.textContent).toContain('hasta');

    (raiz.querySelector('[data-ordenar="fecha"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(titulos()).toEqual(['Concierto lejano', 'Ensayo cercano']);

    fixture.componentInstance.busqueda.set('lejano');
    fixture.detectChanges();
    expect(titulos()).toEqual(['Concierto lejano']);
    expect(raiz.querySelector('[data-cuenta-de-lista]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 de 2 · Quitar filtros');
    (raiz.querySelector('[data-quitar-filtros]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(titulos().length).toBe(2);
  });

  it('guarda un evento de Mercado como borrador', async () => {
    const fixture = await crear();
    const c = fixture.componentInstance;
    c.nuevo();
    c.campo('procesoId', 'mercado:7');
    c.campo('titulo', 'Feria');
    c.campo('descripcion', 'Encuentro');
    c.campo('lugar', 'Centro');
    c.campo('borrador', true);

    expect(c.verboDelDialogo()).toBe('Guardar borrador');
    await c.anunciar();

    expect(enviados[0].mercadoId).toBe(7);
    expect(enviados[0].festivalId).toBeNull();
    expect(enviados[0].borrador).toBeTrue();
    expect(c.aviso()).toContain('borrador');
  });

  it('muestra el motivo de la devolución y envía el borrador a revisión', async () => {
    const fixture = await crear();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Falta la hora.');

    await fixture.componentInstance.enviarARevision(borrador);
    expect(api.enviarARevision).toHaveBeenCalledWith('117', '31');
  });

  it('avisa que editar un evento publicado lo devuelve a revisión y no ofrece borrador', async () => {
    const fixture = await crear();
    const c = fixture.componentInstance;
    await c.editar({ ...borrador, id: '50', estado: 'publicado', estadoEtiqueta: 'Publicado' });

    expect(c.formulario()?.procesoId).toBe('festival:7');
    expect(c.formulario()?.horaInicio).toBe('19:00');
    expect(c.puedeSerBorrador()).toBeFalse();
    expect(c.propositoDelDialogo()).toContain('volverá a revisión');
    // Y DICE QUÉ ES UNA ERRATA, antes de guardar: ortografía y redacción se aplican al instante.
    expect(c.propositoDelDialogo()).toContain('se aplica al instante');
    expect(c.verboDelDialogo()).toBe('Guardar cambios');
  });

  it('un taller, un espacio o una red enmarcan el evento con su propio campo, uno solo a la vez (LUT-01)', async () => {
    api.procesosQueEnmarcan.and.returnValue(of([
      { id: '3', tipo: 'taller', tipoEtiqueta: 'Taller de lutería', nombre: 'Taller Los Cedros', territorio: null },
      { id: '5', tipo: 'espacio', tipoEtiqueta: 'Espacio para música en vivo', nombre: 'Sala Cuatro', territorio: null },
      { id: '2', tipo: 'red', tipoEtiqueta: 'Red y documentación', nombre: 'Red de archivos', territorio: null },
    ]));
    const fixture = await crear();
    const c = fixture.componentInstance;

    const casos: [string, Partial<AnunciarEventoSolicitud>][] = [
      ['taller:3', { tallerId: 3, espacioId: null, redId: null }],
      ['espacio:5', { tallerId: null, espacioId: 5, redId: null }],
      ['red:2', { tallerId: null, espacioId: null, redId: 2 }],
    ];
    for (const [clave, esperado] of casos) {
      c.nuevo();
      c.campo('procesoId', clave);
      c.campo('titulo', 'Taller de afinación');
      c.campo('descripcion', 'Abierto al público');
      c.campo('lugar', 'Casa del taller');
      await c.anunciar();
      expect(enviados.at(-1)).toEqual(jasmine.objectContaining({ festivalId: null, mercadoId: null, ...esperado }));
    }
  });

  it('abrir un evento de un taller deja elegido su proceso, y la lista dice de qué clase es (LUT-01)', async () => {
    api.eventosDeLaOrganizacion.and.returnValue(of([{ ...borrador, procesoTipo: 'taller', procesoNombre: 'Taller Los Cedros' }]));
    api.evento.and.returnValue(of({
      id: '50', titulo: 'Concierto', descripcion: 'Abierto', descripcionLarga: null, fechaInicio: '2026-11-20',
      fechaFin: null, horaInicio: null, horaFin: null, modalidad: 'presencial', lugar: 'Plaza',
      codigoDepartamento: null, codigoMunicipio: null, url: null, festivalId: null, mercadoId: null, tallerId: 3,
      estado: 'publicado', estadoEtiqueta: 'Publicado', ultimoMotivo: null,
    }));
    const fixture = await crear();
    const c = fixture.componentInstance;

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="tipo-de-proceso"]')?.textContent).toContain('Taller de lutería');
    await c.editar({ ...borrador, id: '50', estado: 'publicado', estadoEtiqueta: 'Publicado' });
    expect(c.formulario()?.procesoId).toBe('taller:3');
  });
});

/**
 * LUT-01 y LUT-02: la misma pantalla sirve a la persona sin organización desde «Mi espacio»
 * (`/gestion/cuenta/eventos`, `data.responsable = 'persona'`), con las operaciones de «Mis eventos».
 */
describe('PanelEventosComponent de una persona sin organización', () => {
  let api: jasmine.SpyObj<EventosDeOrganizacionService>;
  const taller: ProcesoQueEnmarca = { id: '3', tipo: 'taller', tipoEtiqueta: 'Taller de lutería', nombre: 'Taller Los Cedros', territorio: null };
  const publicado: EventoDeLaOrganizacion = {
    id: '60', titulo: 'Jornada de puertas abiertas', fechaInicio: '2026-11-20', fechaFin: null, modalidad: 'presencial',
    lugar: 'Casa del taller', estado: 'publicado', estadoEtiqueta: 'Publicado', procesoNombre: 'Taller Los Cedros',
    fechaActualizacion: '2026-11-05T00:00:00Z', procesoTipo: 'taller',
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<EventosDeOrganizacionService>('EventosDeOrganizacionService',
      ['procesosQueEnmarcan', 'eventosDeLaOrganizacion', 'anunciarEvento', 'editarEvento', 'enviarARevision', 'evento', 'historial',
        'cancelarEvento', 'retirarEvento']);
    api.procesosQueEnmarcan.and.returnValue(of([taller]));
    api.eventosDeLaOrganizacion.and.returnValue(of([publicado]));
    api.anunciarEvento.and.returnValue(of({ id: '61', estado: 'en_revision' }));
    api.retirarEvento.and.returnValue(of({ id: '60', estado: 'archivado' }));
    api.historial.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [PanelEventosComponent],
      providers: [
        provideRouter([]),
        { provide: EventosDeOrganizacionService, useValue: api },
        // SIN ORGANIZACIÓN: el almacén del panel no tiene identificador y la persona no tiene rol que comprobar.
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal(''), esAdministradora: signal(false) } },
        { provide: CatalogService, useValue: { fetchDivipolaConCodigos: () => of([]) } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { responsable: 'persona' } } } },
      ],
    }).compileComponents();
  });

  async function crear() {
    const fixture = TestBed.createComponent(PanelEventosComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('consulta sus procesos y sus eventos con la dirección de la persona, no la de una organización', async () => {
    const fixture = await crear();

    expect(api.procesosQueEnmarcan).toHaveBeenCalledWith('');
    expect(api.eventosDeLaOrganizacion).toHaveBeenCalledWith('');
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Jornada de puertas abiertas');
    // NO HAY AVISO DE «SOLO ADMINISTRACIÓN»: lo suyo es suyo.
    expect(raiz.querySelector('[data-testid="aviso-solo-administracion"]')).toBeNull();
    expect(Array.from(raiz.querySelectorAll('button')).map(b => b.textContent?.trim())).toContain('Anunciar evento');
  });

  it('anuncia y retira con la misma regla: el motivo del retiro viaja con la dirección de la persona', async () => {
    const fixture = await crear();
    const c = fixture.componentInstance;
    c.nuevo();
    // CON UN SOLO PROCESO YA VIENE ELEGIDO.
    expect(c.formulario()?.procesoId).toBe('taller:3');
    c.campo('titulo', 'Taller de barnizado');
    c.campo('descripcion', 'Abierto al público');
    c.campo('lugar', 'Casa del taller');
    await c.anunciar();
    expect(api.anunciarEvento).toHaveBeenCalledWith('', jasmine.objectContaining({ tallerId: 3, festivalId: null }));

    spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo({ motivo: 'Se cayó el permiso.' });
    const retirar = accionesDeEvento({ titulo: publicado.titulo, estado: 'publicado', esAdministradora: true }).find(a => a.id === 'retirar')!;
    await c.ejecutar(retirar, publicado);
    expect(api.retirarEvento).toHaveBeenCalledWith('', '60', 'Se cayó el permiso.');
  });

  it('sin procesos publicados explica por qué y lleva a sus talleres en Mi espacio', async () => {
    api.procesosQueEnmarcan.and.returnValue(of([]));
    api.eventosDeLaOrganizacion.and.returnValue(of([]));
    const fixture = await crear();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.textContent).toContain('Todavía no puedes anunciar eventos');
    expect(raiz.querySelector('a')?.getAttribute('href')).toBe('/gestion/cuenta/procesos');
  });
});
