import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { SeccionEquipoComponent, EquipoDeOrganizacion } from './seccion-equipo.component';
import { ApiClientService } from '../../core/http/api-client.service';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { PeticionDeConfirmacion, RespuestaDeConfirmacion, ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';

/** La pantalla «Equipo»: pinta lo que dice el servidor y muestra sus rechazos. */
class ApiFalsa {
  equipo: EquipoDeOrganizacion = {
    organizacionId: '7',
    puedeAdministrar: true,
    miembros: [
      { usuarioId: '1', nombre: 'Ana', correo: 'ana@org.test', rol: 'administrador', desde: '2026-11-01', esUsted: true, cuentaActiva: true },
      { usuarioId: '2', nombre: 'Luis', correo: 'luis@org.test', rol: 'editor', desde: '2026-11-02', esUsted: false, cuentaActiva: true },
    ],
    invitaciones: [{ id: '9', correo: 'eva@org.test', rol: 'editor', estado: 'pendiente', fechaEmision: '2026-11-05', fechaExpiracion: '2026-11-12' }],
  };
  respuestaPost: Observable<unknown> = of({ id: '10', correo: 'nuevo@org.test', rol: 'editor', estado: 'pendiente', fechaEmision: '', fechaExpiracion: '', enlace: '/ecosistema/invitacion?testigo=abc' });
  respuestaDelete: Observable<unknown> = of(null);
  posts: { url: string; cuerpo: unknown }[] = [];
  get(url: string): Observable<unknown> {
    return url.endsWith('/csrf') ? of({ requestToken: 't' }) : of(this.equipo);
  }
  post(url: string, cuerpo: unknown): Observable<unknown> { this.posts.push({ url, cuerpo }); return this.respuestaPost; }
  respuestaPut: Observable<unknown> = of(null);
  borrados = 0;
  put(): Observable<unknown> { return this.respuestaPut; }
  delete(): Observable<unknown> { this.borrados++; return this.respuestaDelete; }
}

/** El diálogo común, sin pantalla: contesta lo que la prueba decida y recuerda qué se le pidió. */
class ConfirmacionesFalsas {
  respuesta: RespuestaDeConfirmacion = { motivo: '' };
  pedidas: PeticionDeConfirmacion[] = [];
  pedir(peticion: PeticionDeConfirmacion): Promise<RespuestaDeConfirmacion> {
    this.pedidas.push(peticion);
    return Promise.resolve(this.respuesta);
  }
}

describe('SeccionEquipoComponent', () => {
  let fixture: ComponentFixture<SeccionEquipoComponent>;
  let api: ApiFalsa;
  let confirmaciones: ConfirmacionesFalsas;
  const avisoDeCambio = signal('');

  async function montar(ajustar?: (api: ApiFalsa) => void): Promise<HTMLElement> {
    api = new ApiFalsa();
    confirmaciones = new ConfirmacionesFalsas();
    avisoDeCambio.set('');
    ajustar?.(api);
    await TestBed.configureTestingModule({
      imports: [SeccionEquipoComponent],
      providers: [
        provideRouter([]),
        { provide: ApiClientService, useValue: api },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: signal('7'), organizacionElegida: () => ({ id: '7', name: 'Casa Taller' }), avisoDeCambio } },
        { provide: ServicioDeConfirmacion, useValue: confirmaciones },
        { provide: ExternalSessionService, useValue: { refrescar: () => of(null) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SeccionEquipoComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** Abre el menú de la fila y devuelve la opción con ese texto (o `undefined` si el menú no la ofrece). */
  function opcion(fila: HTMLElement, etiqueta: string): HTMLButtonElement | undefined {
    if (!fila.querySelector('[data-opcion-accion]')) { fila.querySelector<HTMLButtonElement>('[data-disparador-acciones]')?.click(); fixture.detectChanges(); }
    return Array.from(fila.querySelectorAll<HTMLButtonElement>('[data-opcion-accion]')).find(o => o.textContent?.includes(etiqueta));
  }
  const filaDeMiembro = (el: HTMLElement, usuario: string): HTMLElement => el.querySelector<HTMLElement>(`[data-testid="fila-de-miembro"][data-usuario="${usuario}"]`)!;

  it('lista miembros e invitaciones y ofrece invitar a quien administra', async () => {
    const el = await montar();
    expect(el.querySelector('[data-testid="equipo-miembros"]')?.textContent).toContain('Luis');
    expect(el.querySelector('[data-testid="equipo-invitaciones"]')?.textContent).toContain('eva@org.test');
    expect(el.querySelector('[data-testid="equipo-invitar"]')).not.toBeNull();
    expect(el.querySelector('label[for="invitar-correo"]')).not.toBeNull();
  });

  it('al invitar muestra el enlace completo para copiarlo', async () => {
    const el = await montar();
    fixture.componentInstance.correo.set('nuevo@org.test');
    fixture.componentInstance.invitar();
    fixture.detectChanges();
    expect(api.posts[0].url).toBe('/api/v1/externo/organizaciones/7/equipo/invitaciones');
    const enlace = el.querySelector<HTMLInputElement>('[data-testid="equipo-enlace"]');
    expect(enlace?.value).toContain('/ecosistema/invitacion?testigo=abc');
  });

  it('una invitación pendiente se puede reemitir: «Generar enlace nuevo» muestra el enlace nuevo', async () => {
    const el = await montar();
    api.respuestaPost = of({ id: '9', correo: 'eva@org.test', rol: 'editor', estado: 'pendiente', fechaEmision: '', fechaExpiracion: '', enlace: '/ecosistema/invitacion?testigo=nuevo' });

    opcion(el.querySelector<HTMLElement>('[data-testid="fila-de-invitacion"]')!, 'Generar enlace nuevo')!.click();
    fixture.detectChanges();

    expect(api.posts[0].url).toBe('/api/v1/externo/organizaciones/7/equipo/invitaciones/9/enlace-nuevo');
    expect(el.querySelector<HTMLInputElement>('[data-testid="equipo-enlace"]')?.value).toContain('testigo=nuevo');
    expect(el.textContent).toContain('el anterior ya no sirve');
  });

  it('un editor ve el equipo sin controles de administración', async () => {
    const el = await montar(a => { a.equipo = { ...a.equipo, puedeAdministrar: false, invitaciones: [] }; });
    expect(el.querySelector('[data-testid="equipo-invitar"]')).toBeNull();
    // Sin menú de «Cambiar rol» ni «Quitar»: solo «Salir», y solo en la fila propia.
    expect(el.querySelector('[data-testid="equipo-invitaciones"]')).toBeNull();
    expect(opcion(filaDeMiembro(el, '2'), 'Cambiar')).toBeUndefined();
    expect(filaDeMiembro(el, '2').querySelector('[data-disparador-acciones]')).toBeNull();
    expect(opcion(filaDeMiembro(el, '1'), 'Salir de la organización')).toBeDefined();
    expect(opcion(filaDeMiembro(el, '1'), 'Cambiar')).toBeUndefined();
    expect(el.textContent).toContain('Solo la administración invita personas');
  });

  it('busca por nombre, correo o rol y ordena por nombre (A–Z) o en el sentido contrario', async () => {
    const el = await montar();
    const nombres = () => Array.from(el.querySelectorAll('[data-testid="fila-de-miembro"] p.font-bold')).map(p => p.textContent?.replace('(tú)', '').trim());
    expect(nombres()).toEqual(['Ana', 'Luis']);

    fixture.componentInstance.orden.set({ columna: 'nombre', direccion: 'desc' });
    fixture.detectChanges();
    expect(nombres()).toEqual(['Luis', 'Ana']);

    fixture.componentInstance.busqueda.set('EDITOR');
    fixture.detectChanges();
    expect(nombres()).toEqual(['Luis']);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('1 de 2');

    fixture.componentInstance.busqueda.set('nadie');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="equipo-miembros"]')).toBeNull();
    expect(el.textContent).toContain('Nadie coincide con la búsqueda');
  });

  it('la invitación dice cuándo se envió y cuándo vence', async () => {
    const el = await montar();
    const texto = el.querySelector('[data-testid="fila-de-invitacion"]')?.textContent ?? '';
    expect(texto).toContain('Pendiente');
    expect(texto).toContain('enviada el');
    expect(texto).toContain('vence el');
  });

  const DOS_ADMINISTRADORES = (a: ApiFalsa): void => {
    a.equipo = {
      ...a.equipo,
      miembros: [
        a.equipo.miembros[0],
        { usuarioId: '3', nombre: 'Marta', correo: 'marta@org.test', rol: 'administrador', desde: '2026-11-03', esUsted: false, cuentaActiva: true },
        a.equipo.miembros[1],
      ],
    };
  };

  it('la única persona que administra no puede pasar a editor ni salir, y lo dice', async () => {
    const el = await montar();
    const yo = filaDeMiembro(el, '1');
    const aEditor = opcion(yo, 'Cambiar a editor')!;
    expect(aEditor.disabled).toBeTrue();
    expect(aEditor.textContent).toContain('única persona que administra');
    expect(opcion(yo, 'Salir de la organización')!.disabled).toBeTrue();
    expect(el.querySelector('[data-testid="equipo-ultima-administracion"]')?.textContent).toContain('única persona que administra');
    // Luis, que es editor, conserva todas sus opciones.
    expect(opcion(filaDeMiembro(el, '2'), 'Cambiar a administrador')!.disabled).toBeFalse();

    await fixture.componentInstance.salir();
    expect(confirmaciones.pedidas.length).toBe(0);
    expect(api.borrados).toBe(0);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="equipo-error"]')?.textContent).toContain('Nombra a otra antes');
  });

  it('con otra persona que administra, salir pide confirmación en el diálogo común con el nombre de la organización', async () => {
    await montar(DOS_ADMINISTRADORES);
    await fixture.componentInstance.salir();

    expect(confirmaciones.pedidas.map(p => p.titulo)).toEqual(['Salir de Casa Taller']);
    expect(confirmaciones.pedidas[0].detalle).toContain('Dejarás de ver los procesos');
    expect(api.borrados).toBe(1);
    // EL MENSAJE POSTERIOR: «Saliste de X».
    expect(avisoDeCambio()).toBe('Saliste de «Casa Taller».');
  });

  it('cancelar el diálogo no sale ni quita a nadie', async () => {
    await montar(DOS_ADMINISTRADORES);
    confirmaciones.respuesta = null;
    await fixture.componentInstance.salir();
    await fixture.componentInstance.quitar(fixture.componentInstance.equipo()!.miembros[2]);

    expect(confirmaciones.pedidas.length).toBe(2);
    expect(api.borrados).toBe(0);
  });

  it('quitar a alguien dice a quién y qué pierde, en el diálogo común', async () => {
    await montar();
    await fixture.componentInstance.quitar(fixture.componentInstance.equipo()!.miembros[1]);

    expect(confirmaciones.pedidas[0].titulo).toBe('Quitar a Luis del equipo');
    expect(confirmaciones.pedidas[0].detalle).toContain('Casa Taller');
    expect(api.borrados).toBe(1);
  });

  it('«Cambiar a editor» desde el menú envía el rol nuevo y lo anuncia', async () => {
    const el = await montar(DOS_ADMINISTRADORES);
    const puts: unknown[] = [];
    api.put = ((_u: string, cuerpo: unknown) => { puts.push(cuerpo); return of(null); }) as never;
    opcion(filaDeMiembro(el, '3'), 'Cambiar a editor')!.click();
    fixture.detectChanges();
    expect(puts).toEqual([{ rol: 'editor' }]);
    expect(el.querySelector('[data-testid="equipo-aviso"]')?.textContent).toContain('Marta ahora es editor');
  });

  it('si el servidor rechaza el cambio de rol, la pantalla dice el motivo y no cambia nada', async () => {
    const el = await montar(DOS_ADMINISTRADORES);
    api.respuestaPut = throwError(() => ({ status: 409, payload: { message: 'No se puede cambiar el rol.' } }));

    fixture.componentInstance.cambiarRol(fixture.componentInstance.equipo()!.miembros[1], 'editor');
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="equipo-error"]')?.textContent).toContain('No se puede cambiar el rol.');
    expect(fixture.componentInstance.equipo()!.miembros[1].rol).toBe('administrador');
  });

  it('«Quitar del equipo» y «Revocar la invitación» van al final del menú, en rojo, y llevan su confirmación', async () => {
    const el = await montar();
    const quitar = opcion(filaDeMiembro(el, '2'), 'Quitar del equipo')!;
    expect(quitar.className).toContain('text-rose-700');
    const acciones = fixture.componentInstance.accionesDeMiembro(fixture.componentInstance.equipo()!.miembros[1]);
    expect(acciones.find(a => a.id === 'quitar')?.confirmacion?.titulo).toBe('Quitar a Luis del equipo');
    const revocar = fixture.componentInstance.accionesDeInvitacion(fixture.componentInstance.equipo()!.invitaciones[0]).find(a => a.id === 'revocar');
    expect(revocar?.tono).toBe('peligro');
    expect(revocar?.confirmacion?.titulo).toContain('eva@org.test');
  });

  it('muestra el motivo cuando el servidor protege al último administrador', async () => {
    const el = await montar(a => {
      DOS_ADMINISTRADORES(a);
      a.respuestaDelete = throwError(() => ({ status: 409, payload: { queFalta: 'La organización se quedaría sin administradores.', queHacer: 'Nombra antes a otra persona como administradora.' } }));
    });
    await fixture.componentInstance.salir();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="equipo-error"]')?.textContent).toContain('sin administradores');
  });
});
