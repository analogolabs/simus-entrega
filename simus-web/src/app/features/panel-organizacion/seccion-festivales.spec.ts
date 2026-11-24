import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeccionFestivalesComponent } from './seccion-festivales.component';
import { FestivalDeLaOrganizacion } from './panel-organizacion.api';

describe('SeccionFestivalesComponent · centro de gestión', () => {
  let fixture: ComponentFixture<SeccionFestivalesComponent>;
  let componente: SeccionFestivalesComponent;

  const festivalCon = (extra: Partial<FestivalDeLaOrganizacion> = {}): FestivalDeLaOrganizacion => ({
    id: '1', nombre: 'Festival de prueba', estado: 'Borrador', ...extra,
  });
  const pintar = (festivales: FestivalDeLaOrganizacion[], ocupado = false): void => {
    fixture.componentRef.setInput('festivales', festivales);
    fixture.componentRef.setInput('ocupado', ocupado);
    fixture.detectChanges();
  };
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SeccionFestivalesComponent] }).compileComponents();
    fixture = TestBed.createComponent(SeccionFestivalesComponent);
    componente = fixture.componentInstance;
  });

  it('presenta cada Festival como una fila con organización, territorio, estados y resumen', () => {
    pintar([festivalCon({
      organizacionPrincipalNombre: 'Corporación Cultural de Neiva',
      nombreMunicipio: 'Neiva', nombreDepartamento: 'Huila', cuantasEdiciones: 4,
      fechaActualizacion: '2026-09-01T00:00:00Z', estadoPropuesta: 'borrador', cambiosPedidos: 2,
    })]);
    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Corporación Cultural de Neiva · Neiva (Huila)');
    expect(texto).toContain('4 ediciones registradas');
    expect(texto).toContain('Propuesta Borrador');
    expect(texto).toContain('2 ajustes pendientes');
    expect(raiz().querySelectorAll('li').length).toBe(1);
  });

  /** Abre el menú «Acciones» de la fila `indice` y devuelve sus opciones con el motivo si están apagadas. */
  const opciones = (indice = 0): { texto: string; apagada: boolean; motivo: string | null }[] => {
    const disparador = raiz().querySelectorAll<HTMLButtonElement>('[data-disparador-acciones]')[indice];
    disparador.click();
    fixture.detectChanges();
    return Array.from(raiz().querySelectorAll<HTMLElement>('[data-opcion-accion]')).map(opcion => ({
      texto: (opcion.childNodes[0]?.textContent ?? '').trim(),
      apagada: (opcion as HTMLButtonElement).disabled === true,
      motivo: opcion.querySelector('[data-motivo-de-opcion]')?.textContent?.trim() ?? null,
    }));
  };
  const elegir = (texto: string): void => {
    Array.from(raiz().querySelectorAll<HTMLButtonElement>('[data-opcion-accion]'))
      .find(opcion => (opcion.childNodes[0]?.textContent ?? '').trim() === texto)!.click();
  };

  it('al editor le ofrece preparar y consultar, y lo que no puede hacer lo ofrece apagado con su motivo', () => {
    fixture.componentRef.setInput('esAdministradora', false);
    pintar([festivalCon(), festivalCon({ id: '2', nombre: 'Publicado', estado: 'Publicado' })]);

    const borrador = opciones(0);
    expect(borrador.find(o => o.texto === 'Continuar registro')?.apagada).toBeFalse();
    const enviar = borrador.find(o => o.texto === 'Enviar a revisión')!;
    expect(enviar.apagada).toBeTrue();
    expect(enviar.motivo).toContain('quien administra la organización');

    const publicado = opciones(1);
    expect(publicado.find(o => o.texto === 'Proponer cambios')?.apagada).toBeTrue();
    expect(publicado.find(o => o.texto === 'Solicitar retiro')?.motivo).toContain('Tu rol es editor');
    expect(raiz().querySelector('[data-testid="aviso-solo-administracion"]')?.getAttribute('role')).toBe('note');
  });

  it('mantiene solo Ver ficha visible y concentra el resto dentro del menú «Acciones»', () => {
    pintar([festivalCon()]);
    expect(Array.from(raiz().querySelectorAll('button')).map(item => item.textContent?.trim()))
      .toEqual(['Ver ficha', '']);
    expect(opciones().map(o => o.texto)).toEqual(['Enviar a revisión', 'Continuar registro', 'Eliminar borrador']);
  });

  it('ofrece las operaciones válidas del borrador con los verbos del modelo y emite el registro correcto', () => {
    const festival = festivalCon({ id: '10' });
    pintar([festival]);
    const emitidos: string[] = [];
    componente.editar.subscribe(item => emitidos.push(`editar:${item.id}`));
    componente.enviarARevision.subscribe(item => emitidos.push(`revisar:${item.id}`));
    componente.retirar.subscribe(item => emitidos.push(`retirar:${item.id}`));
    opciones(); elegir('Continuar registro');
    fixture.detectChanges(); opciones(); elegir('Enviar a revisión');
    fixture.detectChanges(); opciones(); elegir('Eliminar borrador');
    expect(emitidos).toEqual(['editar:10', 'revisar:10', 'retirar:10']);
  });

  it('el reenvío con ajustes por atender está apagado y dice cuántos quedan', () => {
    pintar([festivalCon({ estado: 'AjustesSolicitados', cambiosPedidos: 1 })]);
    const todas = opciones();
    const reenviar = todas.find(o => o.texto === 'Volver a enviar a revisión')!;
    expect(reenviar.apagada).toBeTrue();
    expect(reenviar.motivo).toBe('Queda 1 ajuste por atender.');
    expect(todas.map(o => o.texto)).toContain('Atender ajustes');
    expect((raiz().textContent ?? '')).toContain('1 ajuste pendiente');
  });

  it('en revisión permite retirar; editar queda apagado con su motivo y no hay reenvío', () => {
    pintar([festivalCon({ estado: 'EnRevision' })]);
    const todas = opciones();
    expect(todas.find(o => o.texto === 'Retirar de revisión')).toBeTruthy();
    expect(todas.find(o => o.texto === 'Continuar registro')?.apagada).toBeTrue();
    expect(todas.find(o => o.texto === 'Continuar registro')?.motivo).toContain('revisando este Festival');
    expect(todas.map(o => o.texto)).not.toContain('Enviar a revisión');
  });

  it('un Festival publicado usa los verbos del modelo: Proponer cambios, ediciones y Solicitar retiro', () => {
    pintar([festivalCon({ id: '22', estado: 'Publicado', cuantasEdiciones: 2 })]);
    const textos = opciones().map(o => o.texto);
    expect(textos).toEqual(['Proponer cambios', 'Editar contacto', 'Ver ediciones (2)', 'Solicitar retiro']);
    expect(textos).not.toContain('Eliminar borrador');
    expect(textos).not.toContain('Editar Festival');
    expect(textos).not.toContain('Solicitar eliminación');
  });

  it('con una propuesta viva ofrece continuarla y enviarla, no una propuesta adicional', () => {
    pintar([festivalCon({ estado: 'Publicado', estadoPropuesta: 'borrador' })]);
    const textos = opciones().map(o => o.texto);
    expect(textos).toContain('Continuar propuesta');
    expect(textos).toContain('Enviar propuesta a revisión');
    expect(textos).not.toContain('Proponer cambios');
  });

  it('Ver ficha está disponible para consulta en todos los estados', () => {
    pintar([festivalCon({ id: '30', estado: 'Borrador' }), festivalCon({ id: '31', estado: 'Publicado' })]);
    const emitidos: string[] = [];
    componente.abrirFicha.subscribe(item => emitidos.push(item.id));
    raiz().querySelector<HTMLButtonElement>('[data-testid="abrir-ficha-31"]')!.click();
    expect(emitidos).toEqual(['31']);
  });

  it('preserva la descripción completa en el DOM y no deja huecos cuando falta', () => {
    const descripcion = 'Encuentro de tamboras, alegres y llamadores de los municipios ribereños.';
    pintar([festivalCon({ id: '7', descripcion }), festivalCon({ id: '8', descripcion: null })]);
    expect(raiz().querySelector<HTMLElement>('[data-testid="descripcion-festival-7"]')!.textContent?.trim()).toBe(descripcion);
    expect(raiz().querySelector('[data-testid="descripcion-festival-8"]')).toBeNull();
  });
});
