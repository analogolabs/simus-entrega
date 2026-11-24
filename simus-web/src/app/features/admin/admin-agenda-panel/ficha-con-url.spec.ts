import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AdminAgendaPanelComponent } from './admin-agenda-panel.component';
import { EventoAgenda } from '../../../core/services/agenda.service';
import { FichaDeConsola } from '../domain/ficha-de-consola';

/**
 * La ficha de un evento tiene dirección propia: `/administracion/agenda/{id}` (; G1
 *). «Atrás» la cierra, recargar la conserva y un id que no existe se dice.
 */
describe('Agenda · la ficha vive en la dirección', () => {
  function montar() {
    TestBed.configureTestingModule({
      imports: [AdminAgendaPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(AdminAgendaPanelComponent);
    return { fixture, panel: fixture.componentInstance, url: TestBed.inject(FichaDeConsola) };
  }

  const evento = (id: number): EventoAgenda => ({ id, slug: `e-${id}`, titulo: `Evento ${id}`, estado: 'borrador', version: 1 } as unknown as EventoAgenda);

  it('abrir una ficha navega a su dirección', () => {
    const { panel } = montar();
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

    panel.consultar(evento(4));

    expect(panel.fichaEnLectura()?.id).toBe(4);
    expect(navegar.calls.mostRecent().args[0]).toEqual(['/administracion', 'agenda', '4']);
  });

  it('un enlace con id abre la ficha y «Atrás» la cierra', () => {
    const { fixture, panel, url } = montar();
    fixture.detectChanges();
    panel.cargando.set(false);
    panel.eventos.set([evento(1), evento(2)]);

    url.fijar('2');
    fixture.detectChanges();
    expect(panel.fichaEnLectura()?.id).toBe(2);

    url.fijar(null);
    fixture.detectChanges();
    expect(panel.fichaEnLectura()).toBeNull();
  });

  it('un id que no está en la página abierta se pide por su id y abre la ficha', async () => {
    const { fixture, panel, url } = montar();
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    panel.cargando.set(false);
    panel.eventos.set([evento(1)]);

    url.fijar('300');
    fixture.detectChanges();
    http.expectOne(r => r.url.endsWith('/api/v1/institucional/agenda/300')).flush(evento(300));
    await new Promise<void>(r => setTimeout(r, 30));

    expect(panel.fichaEnLectura()?.id).toBe(300);
  });

  it('un id que no existe se dice y se corrige la dirección', async () => {
    const { fixture, panel, url } = montar();
    const http = TestBed.inject(HttpTestingController);
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    panel.cargando.set(false);
    panel.eventos.set([evento(1)]);

    url.fijar('999');
    fixture.detectChanges();
    http.expectOne(r => r.url.endsWith('/api/v1/institucional/agenda/999'))
      .flush({ message: 'No existe.' }, { status: 404, statusText: 'Not Found' });
    await new Promise<void>(r => setTimeout(r, 30));

    expect(panel.fichaEnLectura()).toBeNull();
    expect(panel.error()).toContain('Ese evento no existe');
    expect(navegar.calls.mostRecent().args[0]).toEqual(['/administracion', 'agenda']);
  });

  it('devolver pide el motivo en el diálogo común y lo manda (LIS-05)', async () => {
    const { panel } = montar();
    const { ServicioDeConfirmacion } = await import('../../../core/confirmacion/servicio-de-confirmacion');
    const pedir = spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo({ motivo: ' Falta el lugar. ' });
    const cambiar = spyOn((panel as unknown as { api: { cambiarEstado: (...a: unknown[]) => Promise<unknown> } }).api, 'cambiarEstado')
      .and.resolveTo({ ok: true, data: evento(1) });
    spyOn(panel, 'cargar').and.resolveTo();

    await panel.decidir(evento(1), 'borrador');

    expect(pedir.calls.mostRecent().args[0].pideMotivo).toBeTrue();
    expect(pedir.calls.mostRecent().args[0].titulo).toContain('Devolver');
    expect(cambiar).toHaveBeenCalledWith(1, 'borrador', 'Falta el lugar.');
  });
});

/**
 * Seguimiento de G1 (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 97): Agenda no pide marcar «es una errata»; el servidor lo decide
 * con la misma regla de los eventos de una organización y la pantalla lo cuenta.
 */
describe('Agenda · la errata la decide el servidor', () => {
  function montar() {
    TestBed.configureTestingModule({
      imports: [AdminAgendaPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(AdminAgendaPanelComponent);
    return { fixture, panel: fixture.componentInstance };
  }

  it('un evento publicado avisa al abrirlo y no ofrece casilla de errata', () => {
    const { fixture, panel } = montar();
    fixture.detectChanges();
    panel.editar({ id: 3, slug: 'e', titulo: 'Evento', descripcion: 'Texto', estado: 'publicado', version: 2, fechaInicio: '2026-12-05', modalidad: 'presencial', etiquetas: [], practicasMusicales: [], territoriosSonoros: [], proyectosTransversales: [] } as unknown as EventoAgenda);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelector('[data-aviso-de-errata]')?.textContent).toContain('Este evento está publicado');
    expect(raiz.textContent).not.toContain('Es una errata.');
  });
});
