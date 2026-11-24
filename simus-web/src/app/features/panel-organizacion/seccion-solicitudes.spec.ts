import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { ApiClientService } from '../../core/http/api-client.service';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { SolicitudesDeLaCuentaService, SolicitudDeLaCuenta } from './solicitudes/solicitudes-de-la-cuenta.service';
import { SeccionSolicitudesComponent } from './seccion-solicitudes.component';
import { valorLegibleDeUnCampo } from '../../core/vocabularios/periodicidad';

describe('SeccionSolicitudesComponent', () => {
  let fixture: ComponentFixture<SeccionSolicitudesComponent>;
  let componente: SeccionSolicitudesComponent;
  let get: jasmine.Spy;
  const esAdministradora = signal(true);
  beforeEach(() => esAdministradora.set(true));

  const reclamacion = {
    id: '17', dominio: 'festival', registroCanonicoId: '92', registroNombre: 'Festival del Río',
    estado: 'requiere_aclaracion', justificacion: 'Administración histórica',
    fechaCreacion: '2026-09-09T12:00:00Z', motivoDecision: null,
  };

  function fila(sobre: Partial<SolicitudDeLaCuenta>): SolicitudDeLaCuenta {
    return {
      clave: 'festival-1', tipo: 'festival', tipoEtiqueta: 'Festival', titulo: 'Festival A', espera: 'en_espera', estadoEtiqueta: 'En revisión',
      detalle: null, organizacionId: 117, organizacionNombre: null, fecha: '2026-11-10T10:00:00Z', ruta: '/gestion/o/117/procesos/festivales/1', ...sobre,
    };
  }
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function montar(
    filas: unknown[] = [],
    lista: SolicitudDeLaCuenta[] = [],
    parametros: Record<string, string> = {},
  ): void {
    get = jasmine.createSpy('get').and.returnValue(of(filas));
    const parametrosDeConsulta = new BehaviorSubject(convertToParamMap(parametros));
    TestBed.configureTestingModule({
      imports: [SeccionSolicitudesComponent],
      providers: [
        provideRouter([]),
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('117'), esAdministradora } },
        { provide: ApiClientService, useValue: { get, post: jasmine.createSpy('post') } },
        { provide: SolicitudesDeLaCuentaService, useValue: { deLaOrganizacion: () => of(lista) } },
        { provide: ActivatedRoute, useValue: { queryParamMap: parametrosDeConsulta } },
      ],
    });
    fixture = TestBed.createComponent(SeccionSolicitudesComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('sin solicitudes dice que nada espera la acción y no carga notificaciones', () => {
    montar([]);

    expect(get).toHaveBeenCalledWith('/api/v1/externo/organizaciones/117/reclamaciones-administracion', jasmine.any(Object));
    expect(texto()).toContain('Todavía no hay solicitudes ni actividad');
    expect(texto()).not.toContain('Notificaciones');
  });

  it('es la lista común: los ajustes pedidos llevan a la ficha del Festival con sus campos señalados', () => {
    montar([], [fila({ espera: 'tu_accion', estadoEtiqueta: 'Ajustes pedidos', titulo: 'Festival del Río', ruta: '/gestion/o/117/procesos/festivales/92?seccion=informacion&ajustes=1' })]);

    expect(texto()).toContain('Festival del Río');
    const enlace = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('[data-testid="fila-de-solicitud"] a.tg-titulo')!;
    expect(enlace.getAttribute('href')).toBe('/gestion/o/117/procesos/festivales/92?seccion=informacion&ajustes=1');
    // «Atender» vive en el menú de acciones de la fila.
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="fila-de-solicitud"] [data-disparador-acciones]')!.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-accion-principal]')?.textContent).toContain('Atender');
  });

  it('la ficha de una aclaración requerida ofrece responder y enlaza a la ficha pública del Festival', () => {
    montar([reclamacion], [], { solicitud: '17' });

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="ficha-de-solicitud"]')).not.toBeNull();
    expect(texto()).toContain('Festival del Río');
    expect(texto()).toContain('Requiere aclaración');
    expect(texto()).toContain('Responder aclaración');
    // (REC-04): antes de la transferencia el Festival no es de la organización; su ficha del panel no abre.
    expect(fixture.nativeElement.querySelector('a[href="/ecosistema/festivales/92"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/gestion/o/117/procesos/festivales/92"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="volver-a-solicitudes"]')).not.toBeNull();
  });

  it('la aclaración dice qué pregunta el PNMC (D3-02)', () => {
    montar([{ ...reclamacion, aclaracionPendiente: 'Adjunta el acta de la edición 2018.' }], [], { solicitud: '17' });

    const pregunta = fixture.nativeElement.querySelector('[data-testid="aclaracion-pendiente"]') as HTMLElement;
    expect(pregunta).not.toBeNull();
    expect(pregunta.textContent).toContain('El PNMC pregunta:');
    expect(pregunta.textContent).toContain('Adjunta el acta de la edición 2018.');
  });

  it('una solicitud rechazada dice por qué en su ficha (D3-03)', () => {
    montar([{ ...reclamacion, id: '18', estado: 'rechazada', motivoDecision: 'El acta no identifica a la organización.' }], [], { solicitud: '18' });

    const motivo = fixture.nativeElement.querySelector('[data-testid="motivo-del-rechazo"]') as HTMLElement;
    expect(motivo).not.toBeNull();
    expect(motivo.textContent).toContain('El acta no identifica a la organización.');
  });

  it('la conciliación dice la periodicidad como el resto de la plataforma, no como código (D3-04)', () => {
    expect(valorLegibleDeUnCampo('Periodicidad', 'bienal')).toBe('Bienal (cada dos años)');
    expect(valorLegibleDeUnCampo('Periodicidad', 'anual')).toBe('Anual');
    expect(valorLegibleDeUnCampo('Description', 'Texto que escribió la persona.')).toBe('Texto que escribió la persona.');
    expect(valorLegibleDeUnCampo('Periodicidad', '')).toBe('');
  });

  it('una administración transferida abre la ficha del Festival en el panel (#140)', () => {
    montar([{ ...reclamacion, estado: 'transferencia_ejecutada' }], [], { solicitud: '17' });

    expect(texto()).toContain('Administración transferida');
    expect(texto()).not.toContain('Sin estado');
    expect(texto()).not.toContain('está revisando');
    expect(fixture.nativeElement.querySelector('a[href="/gestion/o/117/procesos/festivales/92"]')).not.toBeNull();
  });

  it('abre la respuesta junto a la solicitud, sin llevarla a otra pantalla', () => {
    montar([reclamacion], [], { solicitud: '17' });
    const botones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));
    botones.find(item => item.textContent?.includes('Responder aclaración'))!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('textarea')).not.toBeNull();
    expect(texto()).toContain('Aclaración para la institución');
  });

  it('un aviso de aclaración abre directamente la ficha y la respuesta señaladas por su URL', () => {
    montar([reclamacion], [], { solicitud: '17', accion: 'aclarar' });

    expect(componente.aclaracionAbierta()).toBe('17');
    expect(fixture.nativeElement.querySelector('textarea')).not.toBeNull();
  });

  it('al editor no le ofrece responder, conciliar ni cancelar un trámite, y le explica por qué (#123)', () => {
    esAdministradora.set(false);
    montar([reclamacion, { ...reclamacion, id: '19', estado: 'aprobada' }], [], { solicitud: '17', accion: 'aclarar' });
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.textContent).toContain('Festival del Río');
    expect(raiz.textContent).not.toContain('Responder aclaración');
    expect(raiz.textContent).not.toContain('Conciliar datos');
    expect(Array.from(raiz.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Cancelar')).toBeFalse();
    expect(componente.aclaracionAbierta()).toBeNull();
    expect(raiz.querySelector('[data-testid="aviso-solo-administracion"]')).not.toBeNull();
  });

  it('una solicitud de acceso aparece en la lista común y su fila lleva a su ficha', () => {
    montar([reclamacion], [fila({ clave: 'acceso-17', tipo: 'acceso', tipoEtiqueta: 'Acceso a un Festival histórico', titulo: 'Festival del Río', espera: 'tu_accion', estadoEtiqueta: 'Requiere aclaración', ruta: '/gestion/o/117/solicitudes?solicitud=17' })]);

    expect(componente.fichaAbierta()).toBeNull();
    const enlace = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('[data-testid="fila-de-solicitud"] a.tg-titulo')!;
    expect(enlace.getAttribute('href')).toBe('/gestion/o/117/solicitudes?solicitud=17');
  });

  it('una solicitud que no existe avisa y deja la lista', () => {
    montar([reclamacion], [], { solicitud: '999' });

    expect(fixture.nativeElement.querySelector('[data-testid="solicitud-no-encontrada"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-lista-de-solicitudes')).not.toBeNull();
  });

  it('distingue el historial cerrado de los trámites en curso', () => {
    montar([{ ...reclamacion, id: '18', estado: 'rechazada', motivoDecision: 'No corresponde.' }]);

    expect(componente.activas()).toEqual([]);
    expect(componente.cerradas().length).toBe(1);
  });

  it('lo que espera respuesta mezcla todos los tipos en una sola vista (SOL)', () => {
    montar([], [
      fila({ clave: 'festival-1', titulo: 'Festival A' }),
      fila({ clave: 'propuesta-2', tipo: 'propuesta', tipoEtiqueta: 'Propuesta de cambios', titulo: 'Festival B' }),
      fila({ clave: 'retiro-3', tipo: 'retiro', tipoEtiqueta: 'Solicitud de retiro', titulo: 'Festival C' }),
      fila({ clave: 'mercado-7', tipo: 'mercado', tipoEtiqueta: 'Mercado', titulo: 'Mercado M' }),
      fila({ clave: 'evento-e1', tipo: 'evento', tipoEtiqueta: 'Evento de la Agenda', titulo: 'Evento E' }),
    ]);
    const lista = fixture.debugElement.query(l => l.name === 'app-lista-de-solicitudes').componentInstance as { estado: { set(v: string): void } };
    lista.estado.set('en_espera');
    fixture.detectChanges();

    const filas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="fila-de-solicitud"]')).map(f => f.textContent!.replace(/\s+/g, ' ').trim());
    expect(filas.length).toBe(5);
    expect(filas.join('|')).toContain('Propuesta de cambios');
    expect(filas.join('|')).toContain('Solicitud de retiro');
    expect(filas.join('|')).toContain('Mercado M');
    expect(filas.join('|')).toContain('Evento E');
  });
});
