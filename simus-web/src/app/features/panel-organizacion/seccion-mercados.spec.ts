import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { SeccionMercadosComponent } from './seccion-mercados.component';
import { MercadoDeLaOrganizacion, PanelOrganizacionApi } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';

describe('SeccionMercadosComponent · menú de acciones por fila', () => {
  let fixture: ComponentFixture<SeccionMercadosComponent>;
  let mercados: MercadoDeLaOrganizacion[];
  let administra: boolean;
  const api = {
    obtenerMercados: jasmine.createSpy('obtenerMercados').and.callFake(() => of(mercados)),
    enviarMercadoARevision: jasmine.createSpy('enviar').and.returnValue(of({})),
    retirarMercado: jasmine.createSpy('retirar').and.returnValue(of(void 0)),
    solicitarRetiroDeMercado: jasmine.createSpy('solicitar').and.returnValue(of(void 0)),
  };
  let respuesta: { motivo: string } | null;
  const pedir = jasmine.createSpy('pedir').and.callFake(() => Promise.resolve(respuesta));

  const mercado = (extra: Partial<MercadoDeLaOrganizacion> = {}): MercadoDeLaOrganizacion => ({
    id: 7, nombre: 'Mercado de prueba', estadoRegistro: 'borrador', numeroDeEdiciones: 0,
    nivelCobertura: 'municipal', descripcion: null, ...extra,
  } as MercadoDeLaOrganizacion);
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const pintar = (lista: MercadoDeLaOrganizacion[]): void => {
    mercados = lista;
    fixture = TestBed.createComponent(SeccionMercadosComponent);
    fixture.detectChanges();
  };
  const opciones = (indice = 0) => {
    raiz().querySelectorAll<HTMLButtonElement>('[data-disparador-acciones]')[indice].click();
    fixture.detectChanges();
    return Array.from(raiz().querySelectorAll<HTMLElement>('[data-opcion-accion]')).map(o => ({
      texto: (o.childNodes[0]?.textContent ?? '').trim(),
      apagada: (o as HTMLButtonElement).disabled === true,
      motivo: o.querySelector('[data-motivo-de-opcion]')?.textContent?.trim() ?? null,
    }));
  };
  const elegir = async (texto: string): Promise<void> => {
    Array.from(raiz().querySelectorAll<HTMLButtonElement>('[data-opcion-accion]'))
      .find(o => (o.childNodes[0]?.textContent ?? '').trim() === texto)!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    administra = true;
    respuesta = { motivo: '' };
    [api.enviarMercadoARevision, api.retirarMercado, api.solicitarRetiroDeMercado, pedir].forEach(s => s.calls.reset());
    await TestBed.configureTestingModule({
      imports: [SeccionMercadosComponent],
      providers: [
        provideRouter([]),
        { provide: PanelOrganizacionApi, useValue: api },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: () => '5', esAdministradora: () => administra } },
        { provide: ServicioDeConfirmacion, useValue: { pedir } },
      ],
    }).compileComponents();
  });

  it('deja «Ver ficha» visible y concentra el resto en el menú «Acciones», como Festivales', () => {
    pintar([mercado()]);
    expect(Array.from(raiz().querySelectorAll('[data-testid="acciones-mercado"] a, [data-testid="acciones-mercado"] button'))
      .map(e => e.textContent?.trim())).toEqual(['Ver ficha', '']);
    expect(opciones().map(o => o.texto)).toEqual(['Enviar a revisión', 'Continuar registro', 'Eliminar borrador']);
  });

  it('a quien solo edita le ofrece enviar apagado con su motivo', () => {
    administra = false;
    pintar([mercado()]);
    const enviar = opciones().find(o => o.texto === 'Enviar a revisión')!;
    expect(enviar.apagada).toBeTrue();
    expect(enviar.motivo).toContain('quien administra la organización');
  });

  it('un Mercado publicado ofrece ediciones, Agenda de citas y Solicitar retiro al final', () => {
    pintar([mercado({ estadoRegistro: 'publicado', numeroDeEdiciones: 2 })]);
    expect(opciones().map(o => o.texto)).toEqual(
      ['Proponer cambios', 'Editar contacto', 'Ver ediciones (2)', 'Agenda de citas', 'Solicitar retiro']);
  });

  it('enviar pide la confirmación común y llama al servicio', async () => {
    pintar([mercado()]);
    opciones();
    await elegir('Enviar a revisión');
    expect(pedir).toHaveBeenCalled();
    expect(api.enviarMercadoARevision).toHaveBeenCalledWith('7');
    expect(raiz().querySelector('[data-testid="aviso-mercados"]')?.textContent).toContain('quedó en revisión');
  });

  it('si se cancela la confirmación no se llama al servicio', async () => {
    respuesta = null;
    pintar([mercado()]);
    opciones();
    await elegir('Eliminar borrador');
    expect(api.retirarMercado).not.toHaveBeenCalled();
  });

  it('solicitar el retiro exige el motivo escrito', async () => {
    respuesta = { motivo: 'Ya no se realiza' };
    pintar([mercado({ estadoRegistro: 'publicado' })]);
    opciones();
    await elegir('Solicitar retiro');
    expect(api.solicitarRetiroDeMercado).toHaveBeenCalledWith('7', 'Ya no se realiza');
  });

  it('las acciones de la ficha navegan a la sección que corresponde', async () => {
    pintar([mercado({ estadoRegistro: 'publicado', numeroDeEdiciones: 1 })]);
    const ir = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    opciones();
    await elegir('Ver ediciones (1)');
    expect(ir.calls.mostRecent().args[1]).toEqual({ queryParams: { seccion: 'ediciones' } });
    opciones();
    await elegir('Agenda de citas');
    expect((ir.calls.mostRecent().args[0] as string[]).join('/')).toContain('herramientas/agenda-de-citas');
  });
});
