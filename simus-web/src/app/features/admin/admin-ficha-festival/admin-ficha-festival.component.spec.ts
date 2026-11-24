import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminFichaFestivalComponent, FichaFestivalAdministrativa } from './admin-ficha-festival.component';

/**
 * El historial del Festival en la consola.
 *
 * <b>LO QUE ESTA PRUEBA IMPIDE.</b> Que la entidad principal del Ecosistema vuelva a ser la única
 * cuyo historial no se puede abrir. `TABLA_DE_AUDITORIA` declaraba `festivales: 'Festivales'` y la
 * bitácora venía registrando cada actuación desde hacía cortes, pero ninguna pantalla llamaba a
 * `/admin/auditoria` con esa tabla: el dato existía y era inalcanzable. Noticias, Agenda y Catálogo
 * ya lo abrían con la misma pieza; aquí no había nada.
 */
describe('la ficha administrativa de un Festival', () => {
  let fixture: ComponentFixture<AdminFichaFestivalComponent>;
  let http: HttpTestingController;

  const FICHA: FichaFestivalAdministrativa = {
    id: '105',
    nombre: 'Festival de Prueba',
    descripcion: null,
    estado: 'publicado',
    nivelCobertura: 'municipal',
    departamento: 'Antioquia',
    municipio: 'Medellín',
    periodicidad: null,
    correoContacto: null,
    telefono: null,
    sitioWeb: null,
    organizacionResponsableId: 117,
    organizacionResponsableNombre: 'Fundación X',
    procedencia: null,
    practicasMusicales: [],
    territoriosSonoros: [],
    ediciones: [],
    fechaCreacion: '2026-09-01T10:00:00Z',
    fechaActualizacion: null,
  };

  async function montar(ficha: FichaFestivalAdministrativa = FICHA): Promise<void> {
    TestBed.configureTestingModule({
      imports: [AdminFichaFestivalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(AdminFichaFestivalComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('festivalId', '105');
    fixture.detectChanges();
    http.expectOne('/api/v1/admin/festivales/105').flush(ficha);
    // LA CARGA ES `async`: el `set` de la señal ocurre en una microtarea posterior al `flush`, así
    // que sin esperar aquí la plantilla se comprueba todavía en «cargando» y no hay nada que mirar.
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  it('abre el historial del Festival con la misma pieza que las demás pantallas', async () => {
    await montar();

    // `data-testid` Y NO `data-abrir-historial`: «Ver historial» es ahora un `app-boton`, que pone el
    // identificador de prueba en el botón real (su anfitrión es `display: contents`). Lo que se
    // vigila —que la ficha ofrezca el historial y que no dependa del permiso de publicar— no cambia.
    const boton = fixture.nativeElement.querySelector('[data-testid="abrir-historial"]') as HTMLButtonElement;
    expect(boton).withContext('la ficha del Festival no ofrecía historial').toBeTruthy();
    boton.click();
    fixture.detectChanges();

    const peticion = http.expectOne(p => p.url.includes('/admin/auditoria'));
    // LA TABLA ES LA QUE EL CODIGO ESCRIBE DE VERDAD: `TableName = "Festivales"`. Pedirla con el
    // nombre del módulo devolvería una lista vacía y parecería que el Festival no tiene historia.
    expect(peticion.request.urlWithParams).toContain('tabla=Festivales');
    expect(peticion.request.urlWithParams).toContain('registroId=105');
    peticion.flush({ items: [] });
    // LOS ESTADOS Y SUS MOTIVOS, de la lectura compartida del historial de estados.
    http.expectOne('/api/v1/institucional/festivales/105/historial').flush([]);
    // LOS CAMBIOS DE DATOS (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md): la ficha pide «Qué cambió» al sistema único, no una lista de versiones.
    http.expectOne('/api/v1/admin/historial/festivales/105').flush({
      moduloId: 'festivales', registroId: '105', inicioDelRegistro: '2026-11-10', camposOcultos: 0, entradas: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Historial y procedencia');
    expect(fixture.nativeElement.textContent).toContain('Estados y motivos');
    expect(fixture.nativeElement.textContent).toContain('Qué cambió');
  });

  it('el historial no depende del permiso de publicar', async () => {
    // ES UNA LECTURA. Los botones de publicar, despublicar y archivar sí están tras `puedePublicar`
    // porque cambian el registro; saber quién lo tocó no cambia nada y lo necesita cualquiera que
    // pueda abrir la ficha para entender en qué estado está y por qué.
    await montar();
    expect(fixture.componentInstance.puedePublicar).toBeFalse();
    expect(fixture.nativeElement.querySelector('[data-testid="abrir-historial"]')).toBeTruthy();
  });

  describe('fusionar duplicados del registro histórico (#147)', () => {
    const HISTORICO: FichaFestivalAdministrativa = { ...FICHA, organizacionResponsableId: 1, organizacionResponsableNombre: 'Plan Nacional de Música para la Convivencia', esRegistroHistorico: true };

    const COMPARACION = {
      conservado: { id: '105', nombre: 'Festival de Prueba', estado: 'publicado', nombreMunicipio: 'Medellín', nombreDepartamento: 'Antioquia', aniosDeEdiciones: [2019, 2018], ediciones: 2 },
      absorbido: { id: '106', nombre: 'Festival de Prueba', estado: 'publicado', nombreMunicipio: 'Medellín', nombreDepartamento: 'Antioquia', aniosDeEdiciones: [2020, 2019], ediciones: 2 },
      campos: [
        { clave: 'nombre', etiqueta: 'Nombre', enLoQueSeConserva: 'Festival de Prueba', enLaCopia: 'Festival de Prueba', resultado: 'igual', quedaAsi: 'Festival de Prueba' },
        { clave: 'correoContacto', etiqueta: 'Correo de contacto', enLoQueSeConserva: null, enLaCopia: 'cuerdas@historico.test', resultado: 'completa', quedaAsi: 'cuerdas@historico.test' },
        { clave: 'descripcion', etiqueta: 'Descripción', enLoQueSeConserva: 'Una redacción.', enLaCopia: 'Otra redacción.', resultado: 'conserva', quedaAsi: 'Una redacción.' },
        { clave: 'instagram', etiqueta: 'Instagram', enLoQueSeConserva: null, enLaCopia: null, resultado: 'vacio', quedaAsi: null },
      ],
      traslado: { ediciones: 2, mercados: 0, eventos: 0, archivos: 0, clasificaciones: 0, reclamaciones: 0, aniosEnLasDos: [2019] },
      codigoBloqueo: null,
      bloqueo: null,
    };

    async function montarComoWebmaster(ficha: FichaFestivalAdministrativa): Promise<void> {
      TestBed.configureTestingModule({ imports: [AdminFichaFestivalComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
      fixture = TestBed.createComponent(AdminFichaFestivalComponent);
      http = TestBed.inject(HttpTestingController);
      fixture.componentRef.setInput('puedePublicar', true);
      fixture.componentRef.setInput('festivalId', '105');
      fixture.detectChanges();
      http.expectOne('/api/v1/admin/festivales/105').flush(ficha);
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('un histórico no nombra al PNMC como su organización y ofrece fusionar', async () => {
      await montarComoWebmaster(HISTORICO);
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Ninguna todavía: registro histórico');
      expect(fixture.nativeElement.querySelector('[data-testid="fusionar-festival"]')).toBeTruthy();
    });

    it('un Festival con organización no ofrece fusionar', async () => {
      await montarComoWebmaster(FICHA);
      expect(fixture.nativeElement.querySelector('[data-testid="fusionar-festival"]')).toBeNull();
    });

    it('enseña por qué una copia no se puede fusionar y fusiona la que sí', async () => {
      await montarComoWebmaster(HISTORICO);
      (fixture.nativeElement.querySelector('[data-testid="fusionar-festival"]') as HTMLButtonElement).click();
      http.expectOne('/api/v1/admin/festivales/105/fusion/candidatos').flush({
        festivalId: '105', nombre: 'Festival de Prueba', codigoBloqueo: null, bloqueo: null,
        candidatos: [
          { id: '106', nombre: 'Festival de Prueba', estado: 'publicado', nombreMunicipio: 'Medellín', nombreDepartamento: 'Antioquia', aniosDeEdiciones: [2019], ediciones: 1, reclamacionAbiertaDe: null, reclamacionAbiertaEstado: null, parecido: true, codigoBloqueo: null, bloqueo: null, razonDelParecido: 'Es el mismo nombre.' },
          { id: '107', nombre: 'Festival de Prueba', estado: 'publicado', nombreMunicipio: null, nombreDepartamento: 'Antioquia', aniosDeEdiciones: [], ediciones: 0, reclamacionAbiertaDe: 'Fundación Y', reclamacionAbiertaEstado: 'enviada', parecido: true, codigoBloqueo: 'tiene_organizacion', bloqueo: 'Ya lo administra Fundación Y.' },
        ],
      });
      await fixture.whenStable();
      fixture.detectChanges();
      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Ya lo administra Fundación Y.');
      // M2: la consola dice por qué se propone cada copia, no solo que se parece.
      expect(fixture.nativeElement.querySelectorAll('[data-testid="razon-del-parecido"]').length).toBe(1);
      expect(texto).toContain('Por qué se propone: Es el mismo nombre.');
      const radios = fixture.nativeElement.querySelectorAll('input[name="absorbido"]') as NodeListOf<HTMLInputElement>;
      expect(radios[1].disabled).toBeTrue();

      // T2: al elegir una copia se leen las dos lado a lado, y la fusión no se confirma sin entenderla.
      fixture.componentInstance.cambiarFusion({ elegido: '106', motivo: 'Dos fuentes del mismo Festival.' });
      http.expectOne('/api/v1/admin/festivales/105/fusion/comparar?con=106').flush(COMPARACION);
      await fixture.whenStable();
      fixture.detectChanges();
      const cmp = fixture.nativeElement.querySelector('[data-testid="comparacion-de-copias"]') as HTMLElement;
      expect(cmp).withContext('al elegir una copia aparece la comparación').toBeTruthy();
      const textoCmp = cmp.textContent as string;
      expect(textoCmp).toContain('Se completa con el de la copia');
      expect(textoCmp).toContain('Queda: cuerdas@historico.test');
      expect(textoCmp).toContain('Se queda el de este Festival');
      expect(textoCmp).toContain('Pasan a este Festival: 2 ediciones');
      expect(fixture.nativeElement.querySelector('[data-testid="anios-en-las-dos"]')?.textContent).toContain('2019');
      expect(fixture.componentInstance.puedeFusionar(fixture.componentInstance.fusion()!))
        .withContext('sin confirmar que entiende, no se puede fusionar').toBeFalse();
      fixture.componentInstance.cambiarFusion({ entendido: true });
      expect(fixture.componentInstance.puedeFusionar(fixture.componentInstance.fusion()!)).toBeTrue();
      const fusion = fixture.componentInstance.fusionar();
      // La escritura lleva el testigo de seguridad: primero se pide, luego se fusiona.
      http.expectOne('/api/v1/admin/csrf').flush({ requestToken: 'testigo-de-fusion' });
      for (let i = 0; i < 10; i++) await Promise.resolve();
      const peticion = http.expectOne('/api/v1/admin/festivales/105/fusion');
      expect(peticion.request.headers.get('X-CSRF-TOKEN')).toBe('testigo-de-fusion');
      expect(peticion.request.body).toEqual({ absorbidoId: '106', motivo: 'Dos fuentes del mismo Festival.' });
      peticion.flush({ festivalId: '105', absorbidoId: '106', ediciones: 1, mercados: 0, eventos: 0, archivos: 0, clasificaciones: 0, reclamaciones: 0, datosCompletados: ['Correo de contacto'] });
      for (let i = 0; i < 10; i++) await Promise.resolve();
      http.expectOne('/api/v1/admin/festivales/105').flush({ ...HISTORICO, absorbidos: [{ id: '106', nombre: 'Festival de Prueba', fechaFusion: '2026-11-06T10:00:00Z' }] });
      await fusion;
      fixture.detectChanges();
      expect(fixture.componentInstance.avisoDePublicacion()).toContain('1 edición');
      expect(fixture.nativeElement.querySelector('[data-testid="festival-absorbidos"]')).toBeTruthy();
    });

    it('no deja fusionar si la comparación dice que la fusión no se permite', async () => {
      await montarComoWebmaster(HISTORICO);
      (fixture.nativeElement.querySelector('[data-testid="fusionar-festival"]') as HTMLButtonElement).click();
      http.expectOne('/api/v1/admin/festivales/105/fusion/candidatos').flush({
        festivalId: '105', nombre: 'Festival de Prueba', codigoBloqueo: null, bloqueo: null,
        candidatos: [{ id: '106', nombre: 'Festival de Prueba', estado: 'publicado', nombreMunicipio: null, nombreDepartamento: null, aniosDeEdiciones: [], ediciones: 0, reclamacionAbiertaDe: null, reclamacionAbiertaEstado: null, parecido: true, codigoBloqueo: null, bloqueo: null }],
      });
      await fixture.whenStable();

      fixture.componentInstance.cambiarFusion({ elegido: '106', motivo: 'Mismo Festival.' });
      http.expectOne('/api/v1/admin/festivales/105/fusion/comparar?con=106')
        .flush({ ...COMPARACION, codigoBloqueo: 'dos_reclamaciones_abiertas', bloqueo: 'Las dos copias tienen solicitudes abiertas.' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="comparacion-de-copias"]')?.textContent).toContain('Las dos copias tienen solicitudes abiertas.');
      fixture.componentInstance.cambiarFusion({ entendido: true });
      expect(fixture.componentInstance.puedeFusionar(fixture.componentInstance.fusion()!)).toBeFalse();
    });

    it('al cambiar de copia se descarta lo confirmado sobre la anterior', async () => {
      await montarComoWebmaster(HISTORICO);
      (fixture.nativeElement.querySelector('[data-testid="fusionar-festival"]') as HTMLButtonElement).click();
      http.expectOne('/api/v1/admin/festivales/105/fusion/candidatos').flush({
        festivalId: '105', nombre: 'Festival de Prueba', codigoBloqueo: null, bloqueo: null, candidatos: [],
      });
      await fixture.whenStable();

      fixture.componentInstance.cambiarFusion({ elegido: '106' });
      http.expectOne('/api/v1/admin/festivales/105/fusion/comparar?con=106').flush(COMPARACION);
      await fixture.whenStable();
      fixture.componentInstance.cambiarFusion({ entendido: true });
      expect(fixture.componentInstance.fusion()!.entendido).toBeTrue();

      fixture.componentInstance.cambiarFusion({ elegido: '108' });
      expect(fixture.componentInstance.fusion()!.entendido).withContext('otra copia, otra confirmación').toBeFalse();
      expect(fixture.componentInstance.fusion()!.comparacion).toBeNull();
      http.expectOne('/api/v1/admin/festivales/105/fusion/comparar?con=108').flush(COMPARACION);
      await fixture.whenStable();
    });

    it('un registro absorbido dice en cuál se fusionó', async () => {
      await montarComoWebmaster({ ...HISTORICO, estado: 'archivado', fusionadoEnId: '200', fusionadoEnNombre: 'Festival Conservado' });
      expect(fixture.nativeElement.querySelector('[data-testid="festival-fusionado"]')?.textContent).toContain('Festival Conservado');
      expect(fixture.nativeElement.querySelector('[data-testid="fusionar-festival"]')).toBeNull();
    });
  });

  it('una edición publicada se observa desde la ficha, no desde la bandeja (#139)', async () => {
    // LA ORGANIZACIÓN LA PUBLICÓ SIN REVISIÓN. La bandeja la listaba como «Edición en revisión»
    //; la supervisión posterior quedó aquí, solo para lo publicado.
    const edicion = (id: string, estadoVisibilidad: string) => ({
      id, anio: 2026, numeroEdicion: 1, nombre: `Edición ${id}`, fechaInicio: null, fechaFin: null, estadoVisibilidad, procedencia: null,
    });
    await montar({ ...FICHA, ediciones: [edicion('7', 'publicada'), edicion('8', 'borrador')] });

    const botones = fixture.nativeElement.querySelectorAll('[data-testid="observar-edicion"]') as NodeListOf<HTMLButtonElement>;
    expect(botones.length).withContext('solo la publicada se observa').toBe(1);
    botones[0].click();
    fixture.detectChanges();

    http.expectOne('/api/v1/institucional/ediciones-festival/7/revision')
      .flush({ id: 0, edicionId: '7', estado: 'borrador', observacionGeneral: null, fechaEnvio: null, observaciones: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-admin-edition-review-panel')).toBeTruthy();
  });

  describe('reabrir la revisión de un Festival rechazado (T2)', () => {
    it('lo ofrece a quien abre la ficha, aunque no pueda publicar, y lo pide con motivo', async () => {
      await montar({ ...FICHA, estado: 'rechazado' });
      const raiz = fixture.nativeElement as HTMLElement;
      expect(fixture.componentInstance.puedePublicar).toBeFalse();

      const boton = raiz.querySelector<HTMLButtonElement>('[data-testid="reabrir-revision"]');
      expect(boton).withContext('un rechazado debe tener salida desde la consola').toBeTruthy();

      const pedir = spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo({ motivo: '  La organización aclaró el municipio.  ' });
      boton!.click();
      for (let i = 0; i < 10; i++) await Promise.resolve();

      const peticion = pedir.calls.mostRecent().args[0];
      expect(peticion.titulo).toContain('Reabrir la revisión');
      expect(peticion.pideMotivo).toBeTrue();
      expect(peticion.motivoObligatorio).toBeTrue();

      // La escritura lleva el testigo: primero se pide, luego se reabre.
      http.expectOne('/api/v1/admin/csrf').flush({ requestToken: 'testigo-de-la-consola' });
      for (let i = 0; i < 10; i++) await Promise.resolve();
      const reapertura = http.expectOne('/api/v1/institucional/festivales/105/reabrir-revision');
      expect(reapertura.request.headers.get('X-CSRF-TOKEN')).toBe('testigo-de-la-consola');
      expect(reapertura.request.body).toEqual({ motivo: 'La organización aclaró el municipio.' });
      reapertura.flush({ id: 105, estado: 'EnRevision' });
      for (let i = 0; i < 10; i++) await Promise.resolve();
      http.expectOne('/api/v1/admin/festivales/105').flush({ ...FICHA, estado: 'en_revision' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.avisoDePublicacion()).toContain('se reabrió');
      expect(raiz.querySelector('[data-testid="reabrir-revision"]')).withContext('ya no está rechazado').toBeNull();
    });

    it('si se cancela el diálogo no se escribe nada', async () => {
      await montar({ ...FICHA, estado: 'rechazado' });
      spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo(null);

      await fixture.componentInstance.reabrirRevision();

      http.expectNone('/api/v1/institucional/festivales/105/reabrir-revision');
      expect(fixture.componentInstance.avisoDePublicacion()).toBeNull();
      expect(fixture.componentInstance.error()).toBeNull();
    });

    it('dice por qué falló si el servidor lo rechaza', async () => {
      await montar({ ...FICHA, estado: 'rechazado' });
      spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo({ motivo: 'Probar.' });

      const reapertura = fixture.componentInstance.reabrirRevision();
      for (let i = 0; i < 10; i++) await Promise.resolve();
      http.expectOne('/api/v1/admin/csrf').flush({ requestToken: 't' });
      for (let i = 0; i < 10; i++) await Promise.resolve();
      http.expectOne('/api/v1/institucional/festivales/105/reabrir-revision')
        .flush({ motivo: ['Escribe por qué se reabre la revisión.'] }, { status: 400, statusText: 'Bad Request' });
      await reapertura;

      expect(fixture.componentInstance.error()).toContain('Escribe por qué se reabre la revisión.');
    });

    it('un Festival que no está rechazado no lo ofrece', async () => {
      await montar({ ...FICHA, estado: 'publicado' });
      expect(fixture.nativeElement.querySelector('[data-testid="reabrir-revision"]')).toBeNull();
    });
  });

  describe('un Festival rechazado', () => {
    it('no ofrece «Publicar» como acción principal: dice que fue rechazado y pregunta antes de revertirlo', async () => {
      await montar({ ...FICHA, estado: 'rechazado' });
      fixture.componentRef.setInput('puedePublicar', true);
      fixture.detectChanges();
      const raiz = fixture.nativeElement as HTMLElement;

      expect(raiz.querySelector('[data-testid="festival-rechazado"]')?.textContent).toContain('rechazado');
      expect(Array.from(raiz.querySelectorAll('button')).map(b => b.textContent?.trim())).not.toContain('Publicar');

      const confirmacion = TestBed.inject(ServicioDeConfirmacion);
      const pedir = spyOn(confirmacion, 'pedir').and.resolveTo(null);
      raiz.querySelector<HTMLButtonElement>('[data-testid="publicar-rechazado"]')!.click();
      await fixture.whenStable();

      expect(pedir.calls.mostRecent().args[0].titulo).toContain('que fue rechazado');
      expect(pedir.calls.mostRecent().args[0].detalle).toContain('revierte esa decisión');
      http.expectNone('/api/v1/admin/festivales/105/publicacion');
    });
  });
});
