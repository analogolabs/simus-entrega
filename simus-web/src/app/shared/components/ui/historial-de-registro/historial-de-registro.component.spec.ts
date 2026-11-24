import { TestBed, ComponentFixture } from '@angular/core/testing';
import { appConfig } from '../../../../app.config';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HistorialDeRegistroComponent } from './historial-de-registro.component';
import { ProcedenciaDeRegistro } from '../../../../core/services/procedencia';

/**
 * El panel que responde «quién tocó esto y de dónde vino», compartido por las cinco pantallas.
 *
 * <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que el panel afirme cosas que nadie le ha dicho. Tenía dos
 * formas de hacerlo y las dos se veían en pantalla:
 *
 * <ul>
 *   <li>Una lectura fallida devolvía lista vacía, y el panel decía «no hay actuaciones
 *       registradas» —una afirmación falsa sobre el registro, indistinguible de la verdadera—.</li>
 *   <li>Si quien abría el panel no le pasaba la procedencia, decía «este registro es anterior al
 *       seguimiento de procedencia». El mismo Festival decía una cosa abierto desde su ficha y otra
 *       desde la tabla, porque la tabla no tiene ese dato a mano.</li>
 * </ul>
 */
describe('el panel de historial no afirma lo que no sabe', () => {
  // LAS FECHAS SE ESCRIBEN EN es-CO, y el locale lo registra `app.config.ts` al cargarse. Nombrar
  // `appConfig` obliga a cargar ese módulo; sin esto la prueba solo pasa cuando corre junto a otra
  // que lo cargue, que es una dependencia del orden de ejecución y no de lo que se prueba.
  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));

  let fixture: ComponentFixture<HistorialDeRegistroComponent>;
  let http: HttpTestingController;

  const PROCEDENCIA: ProcedenciaDeRegistro = {
    contextoOrigen: 'administrativo',
    contextoEtiqueta: 'Gestión administrativa',
    esInstitucional: true,
    organizacionProcedenciaId: 1,
    organizacionProcedenciaNombre: 'Plan Nacional de Música para la Convivencia',
    usuarioCreadorId: 9,
    usuarioCreadorNombre: 'Webmaster SIMUS',
    fechaRegistro: '2026-09-01T10:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HistorialDeRegistroComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(HistorialDeRegistroComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('titulo', 'Festival de prueba');
    fixture.componentRef.setInput('registro', { tabla: 'Festivales', id: '105' });
  });

  afterEach(() => http.verify());

  function responder(cuerpo: { items: unknown[] } | null, fallar = false): void {
    const peticion = http.expectOne(p => p.url.includes('/admin/auditoria'));
    if (fallar) peticion.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });
    else peticion.flush(cuerpo as object);
  }

  it('sin procedencia declarada, no dice nada sobre de dónde vino', async () => {
    fixture.detectChanges();
    responder({ items: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).not.toContain('anterior al seguimiento de procedencia');
    expect(texto).not.toContain('De dónde vino');
    // Y el rótulo del panel tampoco promete una procedencia que no va a enseñar.
    expect(texto).toContain('Historial');
    expect(texto).not.toContain('Historial y procedencia');
  });

  it('con procedencia nula —consultada y ausente— sí lo dice, porque eso sí es un hecho', async () => {
    fixture.componentRef.setInput('procedencia', null);
    fixture.detectChanges();
    responder({ items: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('anterior al seguimiento de procedencia');
  });

  it('con procedencia, la enseña entera', async () => {
    fixture.componentRef.setInput('procedencia', PROCEDENCIA);
    fixture.detectChanges();
    responder({ items: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Plan Nacional de Música para la Convivencia');
    expect(texto).toContain('Webmaster SIMUS');
    expect(texto).toContain('Historial y procedencia');
  });

  it('si la consulta falla, lo dice y lo anuncia: no se hace pasar por un historial vacío', async () => {
    fixture.detectChanges();
    responder(null, true);
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('No fue posible consultar el historial');
    // MUTANTE QUE MATA: devolver `[]` en el `catch` y dejar que caiga en el caso vacío. Quien
    // administra leería «no hay actuaciones registradas» sobre un registro que sí las tiene.
    expect(texto).not.toContain('No hay actuaciones registradas');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('cuando hay líneas, enseña la etiqueta de la acción y no el verbo crudo de la bitácora', async () => {
    fixture.detectChanges();
    responder({ items: [{ id: '1', accion: 'actualizar', accionEtiqueta: 'Actualizó', tabla: 'Festivales', registroId: '105', nombreRegistro: null, autor: { id: '9', nombre: 'Webmaster SIMUS', correo: 'w@p.co' }, fecha: '2026-09-12T00:55:00Z' }] });
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Actualizó');
    expect(texto).not.toContain('actualizar');
  });

  // ───────────────── Qué cambió: los cambios de datos campo por campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md) ─────────────────
  //
  // TRES ESTADOS, COMO LA PROCEDENCIA Y POR EL MISMO MOTIVO. Sustituye a la lista de «versiones» del
  // Festival: la pregunta sigue siendo «¿qué valía esto y quién lo cambió?», pero ahora responde con
  // el campo, el valor anterior y el nuevo, y es la misma para todos los módulos. Confundir «no se
  // preguntó» con «no hay ninguno» diría algo falso sobre el registro, que es lo que el resto de
  // este fichero vigila.

  const LINEA_CON_CAMBIOS = {
    moduloId: 'festivales',
    registroId: '105',
    inicioDelRegistro: '2026-11-10',
    camposOcultos: 0,
    entradas: [
      {
        tipo: 'cambios', fecha: '2026-11-11T15:00:00Z', titulo: 'Cambió 2 campos', actor: 'Ana Gómez',
        actorRol: 'Organización', origen: 'directo', motivo: null, estadoAnterior: null, estadoNuevo: null,
        cambios: [
          { campoId: 'director', campo: 'Director o directora', clase: 'publico', valorAnterior: 'Ana', valorNuevo: 'Beatriz' },
          { campoId: 'correoContacto', campo: 'Correo de contacto', clase: 'contacto', valorAnterior: null, valorNuevo: 'nuevo@festival.test' },
        ],
      },
      {
        tipo: 'estado', fecha: '2026-11-10T10:00:00Z', titulo: 'Publicó', actor: 'Equipo del PNMC', actorRol: null,
        origen: null, motivo: null, estadoAnterior: 'en_revision', estadoNuevo: 'publicado', cambios: [],
      },
    ],
  };

  function responderCambios(cuerpo: object | null, fallar = false): void {
    const peticion = http.expectOne(p => p.url.includes('/admin/historial/'));
    if (fallar) peticion.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });
    else peticion.flush(cuerpo as object);
  }

  it('sin pedir cambios, no dice nada sobre lo que cambió', async () => {
    fixture.detectChanges();
    responder({ items: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).not.toContain('Qué cambió');
  });

  it('si la consulta de cambios falla, lo dice en vez de hacerse pasar por «ninguno»', async () => {
    // MUTANTE QUE MATA: tratar el fallo como lista vacía. La pantalla diría «todavía no hay cambios»
    // sobre un registro que puede llevar años cambiando.
    fixture.componentRef.setInput('cambiosDe', { moduloId: 'festivales', registroId: '105' });
    fixture.detectChanges();
    responder({ items: [] });
    responderCambios(null, true);
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('No fue posible consultar los cambios de datos');
    expect(texto).not.toContain('Todavía no hay cambios de datos registrados');
  });

  it('con cambios, enseña el campo, lo que valía, lo que vale y quién lo cambió', async () => {
    fixture.componentRef.setInput('cambiosDe', { moduloId: 'festivales', registroId: '105' });
    fixture.detectChanges();
    responder({ items: [] });
    responderCambios(LINEA_CON_CAMBIOS);
    await fixture.whenStable();
    fixture.detectChanges();

    const lista = fixture.nativeElement.querySelector('[data-testid="cambios-de-datos"]') as HTMLElement;
    expect(lista).not.toBeNull();
    const texto = lista.textContent as string;
    expect(texto).toContain('Cambió 2 campos');
    expect(texto).toContain('Ana Gómez');
    expect(texto).toContain('Director o directora');
    expect(texto).toContain('Ana');
    expect(texto).toContain('Beatriz');
    // UN CAMPO VACÍO SE DICE «vacío» y no se deja un hueco que parezca un fallo de carga.
    expect(texto).toContain('vacío');
    // UN DATO PERSONAL SE MARCA COMO TAL, para que quien lee sepa qué está viendo.
    expect(texto).toContain('dato personal');
    // LOS ESTADOS NO SE REPITEN AQUÍ: los enseña «Estados y motivos».
    expect(texto).not.toContain('Publicó');
  });

  it('sin cambios registrados lo dice, dice desde cuándo existe el registro y no es un fallo', async () => {
    fixture.componentRef.setInput('cambiosDe', { moduloId: 'festivales', registroId: '105' });
    fixture.detectChanges();
    responder({ items: [] });
    responderCambios({ ...LINEA_CON_CAMBIOS, entradas: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Todavía no hay cambios de datos registrados');
    expect(texto).toContain('Lo anterior no se reconstruye');
    expect(texto).not.toContain('No fue posible consultar los cambios');
  });

  it('avisa cuántos cambios de datos personales no puede ver esta cuenta', async () => {
    fixture.componentRef.setInput('cambiosDe', { moduloId: 'organizaciones', registroId: '105' });
    fixture.detectChanges();
    responder({ items: [] });
    responderCambios({ ...LINEA_CON_CAMBIOS, camposOcultos: 2 });
    await fixture.whenStable();
    fixture.detectChanges();

    const aviso = fixture.nativeElement.querySelector('[data-testid="cambios-ocultos"]') as HTMLElement;
    expect(aviso).not.toBeNull();
    expect(aviso.textContent).toContain('2 cambios de datos personales');
  });

  it('un código de catálogo se lee por su nombre: el código es interno', async () => {
    // MUTANTE QUE MATA: pintar el valor y no el nombre. La persona leería «05001 → 11001» en vez de
    // «Medellín (ANTIOQUIA) → Bogotá, D.C. (BOGOTÁ, D.C.)».
    fixture.componentRef.setInput('cambiosDe', { moduloId: 'organizaciones', registroId: '105' });
    fixture.detectChanges();
    responder({ items: [] });
    responderCambios({
      ...LINEA_CON_CAMBIOS,
      entradas: [{
        tipo: 'cambios', fecha: '2026-11-11T15:00:00Z', titulo: 'Cambió 1 campo', actor: 'Ana Gómez',
        actorRol: 'Organización', origen: 'directo', motivo: null, estadoAnterior: null, estadoNuevo: null,
        cambios: [{
          campoId: 'codigoMunicipioSede', campo: 'Municipio de la sede', clase: 'publico',
          valorAnterior: '05001', valorNuevo: '11001',
          nombreAnterior: 'Medellín (ANTIOQUIA)', nombreNuevo: 'Bogotá, D.C. (BOGOTÁ, D.C.)',
        }],
      }],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = (fixture.nativeElement.querySelector('[data-testid="cambios-de-datos"]') as HTMLElement).textContent as string;
    expect(texto).toContain('Medellín (ANTIOQUIA)');
    expect(texto).toContain('Bogotá, D.C. (BOGOTÁ, D.C.)');
    expect(texto).not.toContain('05001');
    expect(texto).not.toContain('11001');
  });

  it('un dato de la organización (su NIT) no se marca como dato personal', async () => {
    fixture.componentRef.setInput('cambiosDe', { moduloId: 'organizaciones', registroId: '105' });
    fixture.detectChanges();
    responder({ items: [] });
    responderCambios({
      ...LINEA_CON_CAMBIOS,
      entradas: [{
        tipo: 'cambios', fecha: '2026-11-11T15:00:00Z', titulo: 'Cambió 1 campo', actor: 'Ana Gómez',
        actorRol: 'Organización', origen: 'directo', motivo: null, estadoAnterior: null, estadoNuevo: null,
        cambios: [{
          campoId: 'numeroIdentificacion', campo: 'NIT o número de identificación', clase: 'organizacion',
          valorAnterior: null, valorNuevo: '900123456-7',
        }],
      }],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = (fixture.nativeElement.querySelector('[data-testid="cambios-de-datos"]') as HTMLElement).textContent as string;
    expect(texto).toContain('900123456-7');
    expect(texto).not.toContain('dato personal');
  });

});
