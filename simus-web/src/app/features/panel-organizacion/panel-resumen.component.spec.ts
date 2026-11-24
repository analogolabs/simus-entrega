import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { PanelResumenComponent } from './panel-resumen.component';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { SolicitudDeLaCuenta, SolicitudesDeLaCuentaService } from './solicitudes/solicitudes-de-la-cuenta.service';
import { EventosDeOrganizacionService } from './eventos-de-organizacion.service';
import { TalleresService } from '../../core/services/talleres.service';
import { EspaciosService } from '../../core/services/espacios.service';
import { RedesService } from '../../core/services/redes.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  CatalogosDelFestival,
  FestivalDeLaOrganizacion,
  NotificacionDelPanel,
  PaginaDeNotificaciones,
  PanelOrganizacionApi,
  PerfilOrganizacion,
  ResponsableOrganizacion,
  TipoDocumento,
  UbicacionDivipola,
} from './panel-organizacion.api';

/**
 * La ruta «Resumen», en /gestion/resumen: la vista de aterrizaje del panel.
 *
 * NUEVA EN EL REDISEÑO DEL 1 DE SEPTIEMBRE DE 2026. Pide su propio perfil, Festivales y
 * notificaciones -no hay estado compartido de eso en {@link PanelOrganizacionStore}, solo qué
 * organización está abierta- así que el doble del API cubre esas tres llamadas y lanza en las
 * demás, con el mismo criterio que el resto de secciones del panel.
 */
const PERFIL: PerfilOrganizacion = {
  id: '117', nombre: 'Fundación Musical del Valle', nombreLegal: null, numeroIdentificacion: '900123456',
  tipoIdentificacion: 'NIT', descripcion: null, correoContacto: 'contacto@fmv.org', telefonoContacto: null,
  sitioWeb: null, facebook: null, instagram: null, otroEnlace: null, direccion: null,
  codigoDepartamentoSede: '05', nombreDepartamentoSede: 'Antioquia',
  codigoMunicipioSede: '05001', nombreMunicipioSede: 'Medellín', estadoRegistro: 'activa',
  estadoRegistroEtiqueta: 'Registrada', fechaActualizacion: null,
};

class ApiFalso extends PanelOrganizacionApi {
  perfil: PerfilOrganizacion = PERFIL;
  festivales: FestivalDeLaOrganizacion[] = [];

  override obtenerPerfil(): Observable<PerfilOrganizacion> { return of(this.perfil); }
  override obtenerFestivales(): Observable<FestivalDeLaOrganizacion[]> { return of(this.festivales); }
  falla = false;
  override obtenerMercados(): Observable<never[]> {
    return this.falla ? throwError(() => ({ status: 503, message: 'Servicio no disponible' })) : of([]);
  }
  override obtenerNotificaciones(): Observable<PaginaDeNotificaciones> { throw new Error('Los avisos viven en la campana.'); }

  override guardarPerfil(): Observable<PerfilOrganizacion> { throw new Error('Resumen no escribe el perfil.'); }
  override obtenerResponsable(): Observable<ResponsableOrganizacion> { throw new Error('La persona responsable es de otra ruta.'); }
  override guardarResponsable(): Observable<ResponsableOrganizacion> { throw new Error('La persona responsable es de otra ruta.'); }
  override obtenerTiposDocumento(): Observable<TipoDocumento[]> { throw new Error('Los tipos de documento son de otra ruta.'); }
  override enviarFestivalARevision(): Observable<FestivalDeLaOrganizacion> { throw new Error('Enviar a revisión es de otra ruta.'); }
  override enviarPropuestaARevision(): Observable<unknown> { throw new Error('Enviar la propuesta es de otra ruta.'); }
  override iniciarPropuesta(): Observable<never> { throw new Error('Las propuestas de cambio son de otra ruta.'); }
  override obtenerPropuestaActiva(): Observable<never> { throw new Error('Las propuestas de cambio son de otra ruta.'); }
  override guardarPropuesta(): Observable<never> { throw new Error('Las propuestas de cambio son de otra ruta.'); }
  override marcarNotificacionLeida(): Observable<NotificacionDelPanel> { throw new Error('Marcar como leída es de Solicitudes.'); }
  override obtenerCatalogosDelFestival(): Observable<CatalogosDelFestival> { throw new Error('Los catálogos del Festival son de Ecosistema.'); }
  override obtenerUbicaciones(): Observable<UbicacionDivipola[]> { throw new Error('DIVIPOLA es de Organización.'); }
  override crearFestival(): Observable<FestivalDeLaOrganizacion> { throw new Error('El alta de Festival es de Ecosistema.'); }
  override guardarFestival(): Observable<FestivalDeLaOrganizacion> { throw new Error('El alta de Festival es de Ecosistema.'); }
}

describe('PanelResumenComponent (Inicio, PANEL)', () => {
  let fixture: ComponentFixture<PanelResumenComponent>;
  let componente: PanelResumenComponent;
  let api: ApiFalso;
  let solicitudes: SolicitudDeLaCuenta[] = [];
  let eventos: unknown[] = [];

  function montar(): void {
    TestBed.configureTestingModule({
      imports: [PanelResumenComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: PanelOrganizacionApi, useValue: api },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('117'), esAdministradora: signal(true) } },
        { provide: SolicitudesDeLaCuentaService, useValue: { deLaOrganizacion: () => of(solicitudes) } },
        { provide: EventosDeOrganizacionService, useValue: { eventosDeLaOrganizacion: () => of(eventos) } },
        { provide: TalleresService, useValue: { deLaOrganizacion: () => of([{ id: 1, estadoRegistro: 'en_revision' }]) } },
        { provide: EspaciosService, useValue: { deLaOrganizacion: () => of([]) } },
        { provide: RedesService, useValue: { deLaOrganizacion: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(PanelResumenComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const accion = (clave: string, titulo: string, ruta: string): SolicitudDeLaCuenta => ({
    clave, tipo: 'festival', tipoEtiqueta: 'Festival', titulo, espera: 'tu_accion', estadoEtiqueta: 'Ajustes pedidos',
    detalle: null, organizacionId: 117, organizacionNombre: 'Fundación', fecha: '2026-11-10T10:00:00Z', ruta,
  });

  beforeEach(() => {
    api = new ApiFalso();
    solicitudes = [];
    eventos = [];
  });

  it('cuenta los procesos por tipo y por estado, en el orden fijo del Ecosistema', () => {
    api.festivales = [
      { id: '1', nombre: 'A', estado: 'Publicado' },
      { id: '2', nombre: 'B', estado: 'EnRevision' },
      { id: '3', nombre: 'C', estado: 'AjustesSolicitados' },
      { id: '4', nombre: 'D', estado: 'Borrador' },
    ];
    montar();

    const filas = Array.from(raiz().querySelectorAll('[data-testid="resumen-estado-de-procesos"] li'));
    expect(filas.map(f => f.getAttribute('data-tipo'))).toEqual(['festivales', 'mercados', 'redes', 'luteria', 'espacios']);
    expect(componente.estadoPorTipo().find(t => t.clave === 'festivales')).toEqual(jasmine.objectContaining({ total: 4, borrador: 1, enRevision: 1, ajustes: 1, publicados: 1 }));
    expect(componente.estadoPorTipo().find(t => t.clave === 'luteria')).toEqual(jasmine.objectContaining({ total: 1, borrador: 0, enRevision: 1, ajustes: 0, publicados: 0 }));
    expect(componente.totalDeProcesos()).toBe(5);
    expect(raiz().querySelector('[data-testid="resumen-total"]')?.textContent?.trim()).toBe('5');
    expect(componente.resumenDelInforme()).toBe('5 procesos: 1 publicado, 2 en revisión, 1 con ajustes pedidos y 1 en borrador.');
    expect(componente.porcentaje(1)).toBe('20 %');
  });

  it('el informe es solo lectura: un único enlace, «Ver todos los procesos»', () => {
    api.festivales = [{ id: '1', nombre: 'A', estado: 'Publicado' }];
    montar();
    const panel = raiz().querySelector('[aria-labelledby="inicio-procesos"]') as HTMLElement;
    expect(Array.from(panel.querySelectorAll('a')).map(a => a.textContent?.trim())).toEqual(['Ver todos los procesos']);
  });

  it('lo que requiere acción sale de las solicitudes y lleva a atenderlo', () => {
    solicitudes = [accion('festival-5', 'Festival con ajustes', '/gestion/o/117/procesos/festivales/5?seccion=informacion&ajustes=1')];
    montar();

    expect(raiz().querySelector('[data-testid="resumen-acciones"]')).not.toBeNull();
    const enlace = raiz().querySelector<HTMLAnchorElement>('[data-testid="resumen-accion"] a');
    expect(enlace?.getAttribute('href')).toContain('/gestion/o/117/procesos/festivales/5');
    expect(enlace?.href).toContain('ajustes=1');
    expect(enlace?.textContent).toContain('Atender ajustes');
    expect(raiz().textContent).toContain('Requiere atención');
    expect(raiz().querySelector('[aria-labelledby="inicio-atencion"] .panel__contador')?.textContent?.trim()).toBe('1');
  });

  it('sin nada pendiente dice que no hay nada pendiente y el inicio no queda vacío', () => {
    montar();

    expect(raiz().querySelector('[data-testid="resumen-acciones"]')).toBeNull();
    expect(raiz().querySelector('[data-testid="resumen-sin-atencion"]')).not.toBeNull();
    expect(raiz().textContent).toContain('Agenda');
    expect(raiz().textContent).toContain('Últimas acciones');
  });

  it('los eventos en borrador y las invitaciones por aceptar se suman a «Requiere atención»', () => {
    eventos = [{ id: 1, titulo: 'Ensayo abierto', fechaInicio: '2030-12-14T10:00:00', fechaFin: null, cancelado: false, estado: 'borrador', estadoEtiqueta: 'Borrador', procesoNombre: null }];
    montar();
    expect(raiz().querySelector('[data-testid="resumen-tambien"]')?.textContent).toContain('1 evento en borrador sin enviar');
    expect(raiz().querySelector('[data-testid="resumen-tambien"]')?.textContent).toContain('Ensayo abierto');
    componente.invitacionesPendientes.set([{ correo: 'v@correo.test', vence: '2030-11-25' }]);
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid="resumen-tambien"]')?.textContent).toContain('1 invitación al equipo por aceptar');
    expect(componente.totalDeAtencion()).toBe(2);
  });

  it('el h1 es el nombre de la organización, con «Inicio» como antetítulo, su rol y las acciones de la banda', () => {
    montar();

    expect(Array.from(raiz().querySelectorAll('h1')).map(h => h.textContent?.trim())).toEqual(['Fundación Musical del Valle']);
    expect(raiz().querySelector('.inicio__ojo')?.textContent?.trim()).toBe('Inicio');
    expect(raiz().querySelector('[data-testid="inicio-rol"]')?.textContent?.trim()).toBe('Administrador');
    expect(raiz().querySelector('[data-testid="inicio-editar"]')?.textContent).toContain('Editar los datos');
    expect(componente.iniciales()).toBe('FM');
  });

  it('«Crear» ofrece registrar, anunciar e invitar (esto último solo a quien administra)', () => {
    montar();
    expect(componente.accionesDeCrear().map(a => a.etiqueta)).toEqual(['Registrar un proceso', 'Anunciar un evento', 'Invitar a una persona']);
  });

  it('las últimas acciones son solo las solicitudes que ya no esperan a la organización, de la más nueva a la más vieja', () => {
    solicitudes = [
      { ...accion('a', 'Pendiente', '/x'), espera: 'tu_accion' },
      { ...accion('b', 'Vieja', '/x'), espera: 'en_espera', estadoEtiqueta: 'En revisión', fecha: '2026-11-01T10:00:00Z' },
      { ...accion('c', 'Nueva', '/x'), espera: 'resuelta', estadoEtiqueta: 'Publicado', fecha: '2026-11-15T10:00:00Z' },
    ];
    montar();
    const titulos = Array.from(raiz().querySelectorAll('[data-testid="resumen-actividad"] li p.font-bold')).map(p => p.textContent?.trim());
    expect(titulos).toEqual(['Nueva', 'Vieja']);
    expect(raiz().querySelector('[data-testid="resumen-en-curso"]')?.textContent).toContain('Vieja');
  });

  it('una caída del API NO se lee como «no tienes procesos»: dice qué falló, con su motivo, y permite reintentar', () => {
    api.falla = true;
    montar();

    const error = raiz().querySelector('[data-testid="resumen-error"]');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain('mercados');
    expect(error?.textContent).toContain('503');
    expect(error?.querySelector('button')?.textContent).toContain('Reintentar');

    // Reintentar vuelve a pedir y, si ya responde, el aviso desaparece.
    api.falla = false;
    componente.reintentar();
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid="resumen-error"]')).toBeNull();
  });

  it('sin fallas no se pinta ningún aviso de error', () => {
    montar();
    expect(raiz().querySelector('[data-testid="resumen-error"]')).toBeNull();
  });

  it('cada bloque es un panel con su encabezado y la agenda enseña los próximos eventos con su día', () => {
    const futuro = new Date(); futuro.setFullYear(futuro.getFullYear() + 1); futuro.setMonth(11, 9);
    eventos = [{ id: 1, titulo: 'Concierto', fechaInicio: `${futuro.getFullYear()}-12-09T19:00:00`, fechaFin: null, cancelado: false, estado: 'publicado', estadoEtiqueta: 'Publicado', procesoNombre: 'Festival X' }];
    montar();
    const titulos = Array.from(raiz().querySelectorAll('app-panel-de-seccion h2')).map(h => h.textContent?.trim());
    expect(titulos).toEqual(['Requiere atención', 'Informe de procesos', 'Agenda', 'Últimas acciones']);
    const fecha = raiz().querySelector('[data-testid="agenda-eventos"] li .evl__dia');
    expect(fecha?.textContent?.replace(/\s+/g, '')).toMatch(/^9(lun|mar|mié|jue|vie|sáb|dom)$/);
    // El calendario marca el día con evento y pulsarlo filtra la lista.
    const dia = raiz().querySelector<HTMLButtonElement>('.cal__dia--con');
    expect(dia?.textContent?.trim()).toBe('9');
    dia?.click();
    fixture.detectChanges();
    expect(dia?.getAttribute('aria-pressed')).toBe('true');
  });

  it('resume los estados de cada tipo en una línea', () => {
    montar();
    expect(componente.resumenDeEstados({ clave: 'festivales', nombre: 'Festivales', total: 4, borrador: 1, enRevision: 0, ajustes: 2, publicados: 1 }))
      .toBe('2 con ajustes pedidos · 1 en borrador · 1 publicado');
  });
});
