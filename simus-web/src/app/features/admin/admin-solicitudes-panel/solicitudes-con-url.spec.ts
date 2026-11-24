import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FichaDeConsola } from '../domain/ficha-de-consola';
import { AdminSolicitudesPanelComponent } from './admin-solicitudes-panel.component';
import { BandejaDeTrabajoService } from './bandeja-de-trabajo.service';

/**
 * LA REVISIÓN DE UNA SOLICITUD TIENE DIRECCIÓN PROPIA.
 *
 * `/administracion/solicitudes/{id}[/ficha]` abre ese asunto; quitar el id —«Atrás»— lo cierra; un
 * enlace a algo que ya no está pendiente lo dice en vez de quedarse en una lista muda.
 */
describe('AdminSolicitudesPanelComponent · el asunto en la dirección', () => {
  let fixture: ComponentFixture<AdminSolicitudesPanelComponent>;
  let componente: AdminSolicitudesPanelComponent;
  let bandeja: BandejaDeTrabajoService;
  let ficha: FichaDeConsola;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminSolicitudesPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(AdminSolicitudesPanelComponent);
    componente = fixture.componentInstance;
    bandeja = TestBed.inject(BandejaDeTrabajoService);
    ficha = TestBed.inject(FichaDeConsola);
    http = TestBed.inject(HttpTestingController);
    spyOn(ficha, 'abrir');
    spyOn(ficha, 'cerrar');
    fixture.detectChanges();
  });

  afterEach(() => {
    ficha.fijar(null);
    // La comparación de una propuesta pide el catálogo DIVIPOLA para nombrar departamento y municipio.
    http.match('/api/v1/publico/divipola').forEach(r => r.flush([]));
    http.verify();
  });

  const solicitud = (id: string) => ({ id, status: 'pendiente', recordName: `Registro ${id}`, moduleId: 'festivales' });

  it('una dirección con el asunto lo abre en cuanto la cola lo tiene', () => {
    bandeja.solicitudes.set([solicitud('7')]);
    bandeja.colaCargada.set(true);

    ficha.fijar('request-7');
    fixture.detectChanges();

    expect(componente.tramiteElegidoId()).toBe('request-7');
    expect(componente.avisoDeEnlace()).toBe('');
  });

  it('si el enlace llega antes que la cola, no dice «no existe»: espera', () => {
    ficha.fijar('request-7');
    fixture.detectChanges();

    expect(componente.tramiteElegidoId()).toBeNull();
    expect(componente.avisoDeEnlace()).toBe('');
    expect(ficha.cerrar).not.toHaveBeenCalled();

    bandeja.solicitudes.set([solicitud('7')]);
    fixture.detectChanges();

    expect(componente.tramiteElegidoId()).toBe('request-7');
  });

  it('un enlace a un asunto que ya no está pendiente lo dice y corrige la dirección', () => {
    bandeja.solicitudes.set([solicitud('7')]);
    bandeja.colaCargada.set(true);

    ficha.fijar('request-99');
    fixture.detectChanges();

    expect(componente.tramiteElegidoId()).toBeNull();
    expect(componente.avisoDeEnlace()).toContain('ya no está pendiente');
    // Sin apilar una entrada: «Atrás» no vuelve al enlace roto.
    expect(ficha.cerrar).toHaveBeenCalledWith('solicitudes', { reemplazar: true });
    expect(fixture.nativeElement.querySelector('[data-aviso-de-enlace]')?.textContent).toContain('ya no está pendiente');
  });

  it('quitar el id de la dirección —«Atrás»— cierra el asunto', () => {
    bandeja.solicitudes.set([solicitud('7')]);
    bandeja.colaCargada.set(true);
    ficha.fijar('request-7');
    fixture.detectChanges();
    expect(componente.tramiteElegidoId()).toBe('request-7');

    ficha.fijar(null);
    fixture.detectChanges();

    expect(componente.tramiteElegidoId()).toBeNull();
  });

  it('un asunto recién pulsado no se cierra mientras la dirección aún no lo alcanza', () => {
    bandeja.solicitudes.set([solicitud('7')]);
    fixture.detectChanges();

    componente.elegirTramite({ id: 'request-7', kind: 'solicitud', rawId: '7', module: 'festivales' });
    // La cola cambia (el sondeo) antes de que la dirección tenga el id.
    bandeja.solicitudes.set([solicitud('7'), solicitud('8')]);
    fixture.detectChanges();

    expect(componente.tramiteElegidoId()).toBe('request-7');
    expect(ficha.abrir).toHaveBeenCalledWith('solicitudes', 'request-7');
  });

  it('el filtro de la bandeja no esconde el asunto que pide la dirección', () => {
    bandeja.solicitudes.set([solicitud('7')]);
    bandeja.colaCargada.set(true);
    bandeja.cambiarFiltro('duplicado');

    ficha.fijar('request-7');
    fixture.detectChanges();

    expect(bandeja.filtro()).toBe('todos');
    expect(componente.tramiteElegido()?.id).toBe('request-7');
  });

  it('la ficha completa tiene su propia dirección y volver al resumen la quita', () => {
    bandeja.propuestas.set([{ id: 3, nombreFestival: 'Festival X', organizacionNombre: 'Org', fechaEnvioRevision: '2026-11-01T10:00:00Z' }]);
    fixture.detectChanges();
    componente.elegirTramite({ id: 'proposal-3', kind: 'propuesta', rawId: 3, module: 'festivals' });
    http.match(() => true).forEach(peticion => peticion.flush(null));

    componente.cambiarVistaDelTramite('ficha');
    expect(ficha.abrir).toHaveBeenCalledWith('solicitudes', 'proposal-3', { vista: 'ficha' });
  });

  describe('el tipo de asunto es un filtro y no una segunda fila de pestañas', () => {
    it('el desplegable de tipo ofrece las nueve posiciones, también las que están en cero, con su recuento', () => {
      bandeja.solicitudes.set([solicitud('7')]);
      fixture.detectChanges();

      const posiciones = componente.filtrosDeLaBandeja();
      expect(posiciones.length).toBe(9);
      expect(posiciones.find(f => f.id === 'solicitud')?.conteo).toBe(1);
      // Una capacidad que no se ve no existe: lo que está en cero sigue ahí, con su cero.
      expect(posiciones.find(f => f.id === 'revision')?.conteo).toBe(0);
      expect(posiciones.find(f => f.id === 'duplicado')?.conteo).toBe(0);
      expect(fixture.nativeElement.querySelector('[data-aviso-de-enlace]')).toBeNull();
    });

    it('hay UNA sola fila de pestañas (el estado) y un solo selector segmentado en la página', () => {
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelectorAll('app-selector-segmentado').length).toBe(1);
      expect(raiz.querySelector('[data-vista-de-la-bandeja] app-selector-segmentado')).not.toBeNull();
      expect(raiz.querySelector('[data-filtro="mas-tipos-de-la-bandeja"]')).toBeNull();
      expect(raiz.querySelector('[data-filtro="tipo-de-la-bandeja"]')).not.toBeNull();
      expect(raiz.querySelector('[data-filtro="orden-de-la-bandeja"]')).not.toBeNull();
    });

    it('«Quitar el filtro» solo aparece mientras hay un tipo puesto, y lo quita', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-limpiar-filtro]')).toBeNull();

      bandeja.cambiarFiltro('retiro');
      fixture.detectChanges();
      const quitar = fixture.nativeElement.querySelector('[data-limpiar-filtro]') as HTMLButtonElement;
      expect(quitar).not.toBeNull();

      quitar.click();
      fixture.detectChanges();
      expect(bandeja.filtro()).toBe('todos');
      expect(fixture.nativeElement.querySelector('[data-limpiar-filtro]')).toBeNull();
    });

    it('la pestaña «Pendientes» lleva el conteo de lo que espera decisión', () => {
      bandeja.solicitudes.set([solicitud('7')]);
      fixture.detectChanges();

      const pendientes = componente.vistasDeLaBandeja().find(v => v.id === 'pendientes');
      expect(pendientes?.conteo).toBe(1);
    });
  });

  it('un Festival nuevo se decide con la misma barra que los demás asuntos', () => {
    bandeja.revisiones.set([{ id: '12', moduleId: 'festivals', title: 'Festival Nuevo', owner: 'Org', status: 'en_revision' }]);
    fixture.detectChanges();
    const item = componente.colaVisible().find(i => i.kind === 'revision')!;

    expect(componente.seDecideAqui(item)).toBeTrue();

    componente.elegirTramite(item);
    http.match(() => true).forEach(peticion => peticion.flush(null));
    fixture.detectChanges();

    const botones = Array.from(fixture.nativeElement.querySelectorAll('.revision-acciones app-boton') as NodeListOf<HTMLElement>)
      .map(boton => boton.textContent?.trim());
    expect(botones).toEqual(jasmine.arrayContaining(['Publicar', 'Pedir ajustes', 'Rechazar']));
  });
});
