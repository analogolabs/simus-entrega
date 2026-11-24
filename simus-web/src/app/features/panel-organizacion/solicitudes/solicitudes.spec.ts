import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ListaDeSolicitudesComponent } from './lista-de-solicitudes.component';
import { MiActividadComponent, motivoDeLaFalla } from './mi-actividad.component';
import { ApiError } from '../../../core/http/api-client.service';
import { SolicitudDeLaCuenta, SolicitudesDeLaCuentaService } from './solicitudes-de-la-cuenta.service';

function fila(sobre: Partial<SolicitudDeLaCuenta>): SolicitudDeLaCuenta {
  return {
    clave: 'festival-1', tipo: 'festival', tipoEtiqueta: 'Festival', titulo: 'Festival del Pacífico', espera: 'tu_accion',
    estadoEtiqueta: 'Ajustes pedidos', detalle: null, organizacionId: 4, organizacionNombre: 'Corporación Pacífico',
    fecha: '2026-11-10T10:00:00Z', ruta: '/gestion/o/4/procesos/festivales/1', ...sobre,
  };
}

const MUESTRA: SolicitudDeLaCuenta[] = [
  fila({}),
  fila({ clave: 'taller-2', tipo: 'proceso', tipoEtiqueta: 'Taller de lutería', titulo: 'Taller de Lucho', espera: 'en_espera', estadoEtiqueta: 'En revisión', ruta: '/gestion/cuenta/talleres/2', organizacionId: null, organizacionNombre: null, fecha: '2026-11-12T10:00:00Z' }),
  fila({ clave: 'mercado-3', tipo: 'mercado', tipoEtiqueta: 'Mercado', titulo: 'Mercado del Valle', espera: 'en_espera', estadoEtiqueta: 'En revisión', ruta: '/gestion/o/4/procesos/mercados/3', fecha: '2026-11-11T10:00:00Z' }),
  fila({ clave: 'cita-9', tipo: 'cita', tipoEtiqueta: 'Cita del agendamiento', titulo: 'Mercado del Valle', espera: 'resuelta', estadoEtiqueta: 'Confirmada', ruta: '/gestion/cuenta/agenda-de-citas', organizacionId: null, organizacionNombre: null, fecha: '2026-11-13T10:00:00Z' }),
];

describe('Lista de solicitudes (SOL)', () => {
  function montar(solicitudes: SolicitudDeLaCuenta[]) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ListaDeSolicitudesComponent);
    fixture.componentRef.setInput('solicitudes', solicitudes);
    fixture.detectChanges();
    return fixture;
  }
  const textos = (f: { nativeElement: HTMLElement }) => Array.from((f.nativeElement as HTMLElement).querySelectorAll('[data-testid="fila-de-solicitud"] .tg-titulo')).map(e => e.textContent?.trim());

  it('las pestañas son el tipo de proceso, con su conteo, y la lista abre con todo, lo más reciente primero', () => {
    const fixture = montar(MUESTRA);
    // La cita no es de un proceso: va a «Citas e invitaciones». Por omisión se ordena por fecha, de la más reciente a la más antigua.
    const fechas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr td:nth-child(3)')).map(e => e.textContent?.trim());
    expect(fechas.length).toBe(4);
    expect(textos(fixture)[0]).toBe('Mercado del Valle');
    expect(fixture.componentInstance.orden()).toEqual({ columna: 'fecha', direccion: 'desc' });
    const pestanas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')).map(e => e.textContent?.replace(/\s+/g, ' ').trim());
    // Solo los tipos con solicitudes: nada de Redes ni Espacios en cero.
    expect(pestanas).toEqual(['Todos4', 'Festivales1', 'Mercados1', 'Lutería1', 'Citas e invitaciones1']);
  });

  it('trata todos los tipos con la misma fila: el estado «Esperan respuesta» mezcla Mercado y Taller', () => {
    const fixture = montar(MUESTRA);
    fixture.componentInstance.estado.set('en_espera');
    fixture.detectChanges();
    expect(textos(fixture)).toEqual(['Taller de Lucho', 'Mercado del Valle']);
  });

  it('el estado es un filtro con conteo y no otra fila de pestañas', () => {
    const fixture = montar(MUESTRA);
    fixture.componentInstance.estado.set('en_espera');
    fixture.componentInstance.tipo.set('mercados');
    fixture.detectChanges();
    expect(textos(fixture)).toEqual(['Mercado del Valle']);
    expect(fixture.nativeElement.querySelectorAll('[role="tablist"]').length).toBe(1);
    expect(fixture.componentInstance.opcionesDeEstado().map(o => [o.id, o.conteo])).toEqual([['todos', 1], ['tu_accion', 0], ['en_espera', 1], ['resuelta', 0], ['archivadas', undefined]]);
  });

  it('con «Todos» junta todos los estados, y ordenar por «Estado» deja primero lo que espera la acción de la persona', () => {
    const fixture = montar(MUESTRA);
    fixture.componentInstance.orden.set({ columna: 'estado', direccion: 'asc' });
    fixture.detectChanges();
    expect(textos(fixture)[0]).toBe('Festival del Pacífico');
    expect(textos(fixture).length).toBe(4);
    fixture.componentInstance.orden.set({ columna: 'estado', direccion: 'desc' });
    fixture.detectChanges();
    expect(textos(fixture)[0]).toBe('Mercado del Valle');
  });

  it('la tabla tiene encabezados ordenables con aria-sort, y la barra ofrece «Ordenar por» y la cuenta', () => {
    const fixture = montar(MUESTRA);
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('th[aria-sort="descending"]')?.textContent).toContain('Fecha');
    expect(raiz.querySelectorAll('th[aria-sort="none"]').length).toBe(2);
    expect(raiz.querySelector('app-orden-de-lista')?.textContent).toContain('Ordenar por');
    expect(raiz.querySelector('[data-cuenta-de-lista]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('4 de 4');
    (raiz.querySelector('[data-ordenar="nombre"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(textos(fixture)).toEqual(['Festival del Pacífico', 'Mercado del Valle', 'Mercado del Valle', 'Taller de Lucho']);
  });

  it('«Quitar filtros» aparece al filtrar, la cuenta lo dice y devuelve tipo, estado y búsqueda a «todos»', () => {
    const fixture = montar(MUESTRA);
    const raiz = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.estado.set('en_espera');
    fixture.componentInstance.busqueda.set('lucho');
    fixture.detectChanges();
    expect(raiz.querySelector('[data-cuenta-de-lista]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 de 4 · Quitar filtros');
    (raiz.querySelector('[data-quitar-filtros]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.estado()).toBe('todos');
    expect(fixture.componentInstance.busqueda()).toBe('');
    expect(textos(fixture).length).toBe(4);
    expect(raiz.querySelector('[data-quitar-filtros]')).toBeNull();
  });

  it('dice qué falta cuando el filtro deja una lista vacía, y el menú de acciones nombra la fila para el lector de pantalla', () => {
    const fixture = montar([fila({})]);
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('a.tg-titulo')?.textContent).toContain('Festival del Pacífico');
    expect(raiz.querySelector('[data-disparador-acciones]')?.getAttribute('aria-label')).toBe('Acciones de Festival del Pacífico');
    (raiz.querySelector('[data-disparador-acciones]') as HTMLElement).click();
    fixture.detectChanges();
    expect(raiz.querySelector('[data-accion-principal]')?.textContent).toContain('Atender');
    fixture.componentInstance.estado.set('resuelta');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="sin-solicitudes"]')?.textContent).toContain('Todavía no hay solicitudes resueltas');
  });
});

describe('Solicitudes archivadas (resueltas hace más de 90 días)', () => {
  const ANTIGUA = fila({ clave: 'festival-77', titulo: 'Festival de 2025', espera: 'resuelta', estadoEtiqueta: 'Rechazado', fecha: '2025-01-10T10:00:00Z' });
  function montar(servicio: Partial<SolicitudesDeLaCuentaService>, organizacionId: string | null = null) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SolicitudesDeLaCuentaService, useValue: servicio }] });
    const fixture = TestBed.createComponent(ListaDeSolicitudesComponent);
    fixture.componentRef.setInput('solicitudes', MUESTRA);
    fixture.componentRef.setInput('organizacionId', organizacionId);
    fixture.detectChanges();
    return fixture;
  }
  const raiz = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

  it('«Archivadas» es un estado del filtro; no se pide nada hasta elegirlo y luego explica qué significa', () => {
    let llamadas = 0;
    const fixture = montar({ deLaCuenta: () => { llamadas++; return of([ANTIGUA]); } });
    expect(llamadas).toBe(0);
    fixture.componentInstance.elegirEstado('archivadas');
    fixture.detectChanges();
    expect(llamadas).toBe(1);
    expect(raiz(fixture).querySelector('[data-testid="aviso-de-archivadas"]')?.textContent).toContain('hace más de 90 días');
    expect(Array.from(raiz(fixture).querySelectorAll('[data-testid="fila-de-solicitud"] .tg-titulo')).map(e => e.textContent?.trim())).toEqual(['Festival de 2025']);
    // Volver a elegirlo no repite la lectura.
    fixture.componentInstance.elegirEstado('todos');
    fixture.componentInstance.elegirEstado('archivadas');
    expect(llamadas).toBe(1);
  });

  it('en una organización pide las archivadas de esa organización', () => {
    const pedidas: [string, boolean][] = [];
    const fixture = montar({ deLaOrganizacion: (id: string, archivadas?: boolean) => { pedidas.push([id, !!archivadas]); return of([]); } }, '4');
    fixture.componentInstance.elegirEstado('archivadas');
    fixture.detectChanges();
    expect(pedidas).toEqual([['4', true]]);
    expect(raiz(fixture).querySelector('[data-testid="sin-solicitudes"]')?.textContent).toContain('No hay solicitudes archivadas');
  });

  it('muestra la carga y, si falla, el error con «Reintentar» sin dar la lista por vacía', () => {
    const respuesta = new Subject<SolicitudDeLaCuenta[]>();
    let llamadas = 0;
    const fixture = montar({ deLaCuenta: () => (++llamadas === 1 ? respuesta : of([ANTIGUA])) });
    fixture.componentInstance.elegirEstado('archivadas');
    fixture.detectChanges();
    expect(raiz(fixture).querySelector('[data-testid="sin-solicitudes"]')).toBeNull();
    expect(raiz(fixture).querySelector('app-esqueleto')).not.toBeNull();
    respuesta.error(new Error('x'));
    fixture.detectChanges();
    expect(raiz(fixture).querySelector('[data-testid="error-de-archivadas"]')?.textContent).toContain('siguen guardadas');
    expect(raiz(fixture).querySelector('[data-testid="sin-solicitudes"]')).toBeNull();
    (raiz(fixture).querySelector('[data-reintentar-archivadas]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(llamadas).toBe(2);
    expect(raiz(fixture).querySelector('[data-testid="error-de-archivadas"]')).toBeNull();
    expect(raiz(fixture).querySelectorAll('[data-testid="fila-de-solicitud"]').length).toBe(1);
  });
});

describe('Mi actividad y solicitudes (SOL)', () => {
  it('lee las solicitudes de la cuenta y las muestra', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SolicitudesDeLaCuentaService, useValue: { deLaCuenta: () => of(MUESTRA) } }] });
    const fixture = TestBed.createComponent(MiActividadComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mi actividad y solicitudes');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="fila-de-solicitud"]').length).toBe(4);
  });

  it('si falla la lectura lo dice, sin inventar una lista vacía', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SolicitudesDeLaCuentaService, useValue: { deLaCuenta: () => throwError(() => new Error('x')) } }] });
    const fixture = TestBed.createComponent(MiActividadComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('No fue posible consultar tus solicitudes');
  });

  it('dice el motivo real: sin conexión, tiempo agotado, sesión vencida, no disponible o error del servidor', () => {
    expect(motivoDeLaFalla(new ApiError('x', { code: 'NETWORK' })).mensaje).toContain('No hay conexión');
    expect(motivoDeLaFalla(new ApiError('x', { code: 'TIMEOUT' })).mensaje).toContain('tardó demasiado');
    expect(motivoDeLaFalla(new ApiError('x', { status: 401 })).mensaje).toContain('sesión venció');
    expect(motivoDeLaFalla(new ApiError('x', { status: 404 })).mensaje).toContain('no está disponible');
    const servidor = motivoDeLaFalla(new ApiError('x', { status: 500, requestId: 'abc123' }));
    expect(servidor.mensaje).toContain('error');
    expect(servidor.detalle).toContain('Código 500');
    expect(servidor.detalle).toContain('abc123');
  });

  it('ofrece «Reintentar» y vuelve a consultar', () => {
    let llamadas = 0;
    const servicio = { deLaCuenta: () => (++llamadas === 1 ? throwError(() => new ApiError('x', { status: 503 })) : of(MUESTRA)) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SolicitudesDeLaCuentaService, useValue: servicio }] });
    const fixture = TestBed.createComponent(MiActividadComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-detalle-del-error]')?.textContent).toContain('Código 503');
    (raiz.querySelector('[data-reintentar]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(llamadas).toBe(2);
    expect(raiz.querySelector('[data-error-de-solicitudes]')).toBeNull();
    expect(raiz.querySelectorAll('[data-testid="fila-de-solicitud"]').length).toBe(MUESTRA.length);
  });
});
