import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { BancoDeArchivosService } from '../../core/services/banco-de-archivos.service';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { ConfirmacionDeCorreoService, SesionExterna } from '../../core/services/confirmacion-de-correo.service';
import { SeccionOrganizacionComponent } from './seccion-organizacion.component';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import {
  CatalogosDelFestival,
  FalloDelServidor,
  FestivalDeLaOrganizacion,
  NotificacionDelPanel,
  PaginaDeNotificaciones,
  PanelOrganizacionApi,
  PerfilOrganizacion,
  PerfilOrganizacionSolicitud,
  ResponsableOrganizacion,
  TipoDocumento,
  UbicacionDivipola,
} from './panel-organizacion.api';

/*
  QUÉ SE INSTRUMENTA AQUÍ.

  El defecto reportado: `/ecosistema/mi-panel?pestana=organizacion` abría
  directamente en el formulario con los campos rellenos. Criterio: «el default es
  sin edición los datos que actualmente tiene». Se invirtió: por omisión se leen los datos y el
  formulario aparece al pulsar «Editar», ya relleno con lo que hay guardado.

  REDISEÑO DEL 1 DE SEPTIEMBRE DE 2026: esta ruta perdió el bloque de «Persona responsable» —se fue
  a `SeccionResponsableComponent`, su propio fichero de pruebas— y dejó de recibir
  `organizacionId`/`perfil` por `@Input`: ahora inyecta `PanelOrganizacionStore` y pide su propio
  perfil a `PanelOrganizacionApi`, como cualquier otra sección enrutada del panel.

  SE COMPARAN TEXTOS, NO SE CUENTAN ELEMENTOS. Contar filas no distingue «los campos correctos» de
  «campos cualesquiera»: una plantilla que pintara `nombre` en la fila de `nombreLegal` seguiría
  contando igual. Por eso la vista de lectura se lee como un diccionario
  rótulo → valor y se compara entera con `toEqual`, que además falla si sobra una fila o falta.

  SE ENTRA POR LA PANTALLA. `editarPerfil()` y `cancelarPerfil()` llamados a mano probarían que los
  métodos hacen lo que dicen, no que el botón los llama.

  SIN HTTP. Se inyecta un doble de `PanelOrganizacionApi`.

  EL `tick()` NO ES ADORNO. Los campos llevan `ngModel` dentro de un `<form>` y `NgModel` aplaza a
  una microtarea el volcado del modelo al elemento.
*/

const PERFIL: PerfilOrganizacion = {
  id: '117',
  nombre: 'Fundación Musical del Valle',
  nombreLegal: 'Fundación Musical del Valle S.A.S.',
  numeroIdentificacion: '900123456',
  tipoIdentificacion: 'NIT',
  descripcion: 'Formación musical en el suroccidente.',
  correoContacto: 'contacto@fmv.org',
  telefonoContacto: '3001234567',
  sitioWeb: 'https://fmv.org',
  facebook: 'https://facebook.com/fmv',
  instagram: 'https://instagram.com/fmv',
  otroEnlace: 'https://youtube.com/@fmv',
  direccion: 'Calle 5 # 10-20',
  codigoDepartamentoSede: '05',
  nombreDepartamentoSede: 'Antioquia',
  codigoMunicipioSede: '05001',
  nombreMunicipioSede: 'Medellín',
  estadoRegistro: 'activa',
  estadoRegistroEtiqueta: 'Activa',
 
  fechaActualizacion: '2026-08-20T14:30:00Z',
};

/** Dos departamentos; 05001 tiene que estar porque `guardarPerfil()` valida el municipio contra esta lista. */
const DIVIPOLA: UbicacionDivipola[] = [
  { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05001', municipalityName: 'Medellín' },
  { departmentCode: '05', departmentName: 'Antioquia', municipalityCode: '05088', municipalityName: 'Bello' },
  { departmentCode: '91', departmentName: 'Amazonas', municipalityCode: '91263', municipalityName: 'El Encanto' },
];

/** Lo que el servidor devuelve tras el PUT: la misma ficha con los trece campos escritos. */
function perfilTrasGuardar(solicitud: PerfilOrganizacionSolicitud): PerfilOrganizacion {
  return {
    ...PERFIL,
    nombre: solicitud.nombre,
    nombreLegal: solicitud.nombreLegal,
    numeroIdentificacion: solicitud.numeroIdentificacion,
    descripcion: solicitud.descripcion,
    correoContacto: solicitud.correoContacto,
    telefonoContacto: solicitud.telefonoContacto,
    sitioWeb: solicitud.sitioWeb,
    facebook: solicitud.facebook,
    instagram: solicitud.instagram,
    otroEnlace: solicitud.otroEnlace,
    direccion: solicitud.direccion,
    codigoDepartamentoSede: solicitud.codigoDepartamentoSede,
    codigoMunicipioSede: solicitud.codigoMunicipioSede,
    nombreDepartamentoSede: DIVIPOLA.find(fila => fila.departmentCode === solicitud.codigoDepartamentoSede)?.departmentName ?? null,
    nombreMunicipioSede: DIVIPOLA.find(fila => fila.municipalityCode === solicitud.codigoMunicipioSede)?.municipalityName ?? null,
  };
}

/**
 * El doble del API mantiene aislada la ficha de la organización. La persona responsable ahora se
 * presenta como subsección de esta misma ruta: responde un 404 controlado para representar una
 * ficha todavía no creada, sin añadir datos ajenos a estas pruebas.
 */
class ApiFalso extends PanelOrganizacionApi {
  perfilInicial: PerfilOrganizacion = PERFIL;
  /** Un GET que no vuelve, para medir la pantalla antes de que el perfil llegue. */
  demorarPerfil = false;
  perfilesPedidos: string[] = [];

  perfilGuardado: PerfilOrganizacionSolicitud | null = null;
  falloAlGuardarPerfil: FalloDelServidor | null = null;
  /** Un guardado que no vuelve, para medir la pantalla con la petición en vuelo. */
  demorarGuardadoDePerfil = false;

  override obtenerPerfil(organizacionId: string): Observable<PerfilOrganizacion> {
    this.perfilesPedidos.push(organizacionId);
    if (this.demorarPerfil) return new Observable<PerfilOrganizacion>(() => undefined);
    return of({ ...this.perfilInicial, id: organizacionId });
  }

  override guardarPerfil(_organizacionId: string, solicitud: PerfilOrganizacionSolicitud): Observable<PerfilOrganizacion> {
    this.perfilGuardado = solicitud;
    if (this.demorarGuardadoDePerfil) return new Observable<PerfilOrganizacion>(() => undefined);
    if (this.falloAlGuardarPerfil) return throwError(() => this.falloAlGuardarPerfil);
    return of(perfilTrasGuardar(solicitud));
  }

  override obtenerResponsable(): Observable<ResponsableOrganizacion> {
    return of(null as unknown as ResponsableOrganizacion);
  }
  override guardarResponsable(): Observable<ResponsableOrganizacion> { throw new Error('La persona responsable no se guarda en estas pruebas.'); }
  override obtenerTiposDocumento(): Observable<TipoDocumento[]> { return of([]); }

  override obtenerFestivales(): Observable<FestivalDeLaOrganizacion[]> {
    throw new Error('Los Festivales son de otra ruta.');
  }

  override enviarFestivalARevision(): Observable<FestivalDeLaOrganizacion> {
    throw new Error('Los Festivales son de otra ruta.');
  }

  override enviarPropuestaARevision(): Observable<unknown> {
    throw new Error('Las propuestas son de otra ruta.');
  }

  override iniciarPropuesta(): Observable<never> { throw new Error('Las propuestas son de otra ruta.'); }
  override obtenerPropuestaActiva(): Observable<never> { throw new Error('Las propuestas son de otra ruta.'); }
  override guardarPropuesta(): Observable<never> { throw new Error('Las propuestas son de otra ruta.'); }

  override obtenerNotificaciones(): Observable<PaginaDeNotificaciones> {
    throw new Error('Las notificaciones son de otra ruta.');
  }

  override marcarNotificacionLeida(): Observable<NotificacionDelPanel> {
    throw new Error('Las notificaciones son de otra ruta.');
  }

  override obtenerCatalogosDelFestival(): Observable<CatalogosDelFestival> {
    throw new Error('Los catálogos del Festival son de otra ruta.');
  }

  override obtenerUbicaciones(): Observable<UbicacionDivipola[]> {
    throw new Error('Esta ruta recibe DIVIPOLA por AdminService.');
  }

  override crearFestival(): Observable<FestivalDeLaOrganizacion> {
    throw new Error('El alta de Festival es de otra ruta.');
  }

  override guardarFestival(): Observable<FestivalDeLaOrganizacion> {
    throw new Error('El alta de Festival es de otra ruta.');
  }
}

/** `AdminService` solo aporta DIVIPOLA a esta ruta, y solo para los dos desplegables. */
const adminFalso = { cargarDivipolaPublica: () => of(DIVIPOLA) };
const sesionFalsa = {
  organizaciones: signal([
    { id: '117', name: 'Fundación Musical del Valle', role: 'administrador' },
    { id: '1117', name: 'Corporación Tambó', role: 'administrador' },
    { id: '2117', name: 'Colectivo Editor', role: 'editor' },
  ]),
};

/** Lo que la sesión dice de la confirmación de correo; cada prueba puede cambiar el modo. */
const confirmacionFalsa = { estado: signal<SesionExterna | null>(null) };

describe('SeccionOrganizacionComponent · por omisión se lee, se edita bajo petición', () => {
  beforeEach(() => confirmacionFalsa.estado.set(null));

  let fixture: ComponentFixture<SeccionOrganizacionComponent>;
  let componente: SeccionOrganizacionComponent;
  let api: ApiFalso;

  /** Los trece campos escribibles del perfil, por el `id` con el que la plantilla los rotula. */
  const CAMPOS_DEL_PERFIL = [
    'perfil-nombre', 'perfil-nombre-legal', 'perfil-nit', 'perfil-correo', 'perfil-telefono',
    'perfil-direccion', 'perfil-descripcion', 'perfil-departamento',
    'perfil-municipio', 'perfil-sitio', 'perfil-facebook', 'perfil-instagram', 'perfil-otro-enlace',
  ];

  /**
   * Monta la ruta con un perfil dado. `perfil: null` simula «todavía no ha llegado»: demora la
   * respuesta del GET en vez de devolver un valor.
   */
  function montar(perfil: PerfilOrganizacion | null = PERFIL, organizacionId = '117'): void {
    // `resetTestingModule()` A PROPÓSITO: una sola prueba de más abajo monta tres veces seguidas
    // `TestBed` no deja reconfigurar el módulo una vez instanciado. El reinicio mantiene aislado
    // cada montaje, también cuando una prueba necesita volver a crear la ficha.
    TestBed.resetTestingModule();
    api = new ApiFalso();
    if (perfil === null) api.demorarPerfil = true;
    else api.perfilInicial = perfil;

    TestBed.configureTestingModule({
      imports: [SeccionOrganizacionComponent],
      providers: [
        { provide: PanelOrganizacionApi, useValue: api },
        { provide: AdminService, useValue: adminFalso },
        { provide: ExternalSessionService, useValue: sesionFalsa },
        { provide: ConfirmacionDeCorreoService, useValue: confirmacionFalsa },
        PanelOrganizacionStore,
      ],
    });
    // `PanelOrganizacionStore` se construye por DI -no con `new`-: su constructor inyecta
    // `ExternalSessionService`, e `inject()` fuera de un contexto de inyección revienta con NG0203.
    TestBed.inject(PanelOrganizacionStore).organizacionId.set(organizacionId);

    fixture = TestBed.createComponent(SeccionOrganizacionComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const limpiar = (texto: string | null): string => (texto ?? '').replace(/\s+/g, ' ').trim();
  const buscar = <T extends HTMLElement>(testid: string): T | null =>
    raiz().querySelector<T>('[data-testid="' + testid + '"]');
  const porId = <T extends HTMLElement>(id: string): T | null => raiz().querySelector<T>('#' + id);
  const texto = (): string => limpiar(raiz().textContent);
  const formularios = (): HTMLFormElement[] => Array.from(raiz().querySelectorAll('form'));
  const botones = (): HTMLButtonElement[] => Array.from(raiz().querySelectorAll('button'));
  const rotulosDeBotones = (): string[] => botones().map(boton => limpiar(boton.textContent));

  /**
   * La ficha de lectura como diccionario rótulo → valor.
   *
   * SE TOMA EL PRIMER `dd` DE CADA FILA: en el NIT, la etiqueta del tipo va en un `<span>` dentro
   * del mismo `dd`, y ese es el único que hay aquí.
   */
  function ficha(testid: string): Record<string, string> {
    const bloque = buscar(testid);
    if (!bloque) throw new Error('No está en pantalla el bloque de lectura «' + testid + '».');
    const salida: Record<string, string> = {};
    for (const fila of Array.from(bloque.querySelectorAll('dl > div'))) {
      const rotulo = fila.querySelector('dt');
      const valor = fila.querySelector('dd');
      if (rotulo && valor) salida[limpiar(rotulo.textContent)] = limpiar(valor.textContent);
    }
    return salida;
  }

  /**
   * La identidad de la lectura como diccionario: el nombre, la razón social, el NIT, la sede y la descripción, que viven en
   * el bloque de identidad y en «Qué hace la organización» (no en una lista de rótulos y valores).
   */
  function identidad(): Record<string, string> {
    const dato = (testid: string): string => limpiar(buscar(testid)?.textContent ?? null);
    return {
      nombre: dato('perfil-nombre'),
      razonSocial: dato('perfil-razon-social'),
      nit: dato('perfil-nit'),
      sede: dato('perfil-sede'),
      descripcion: dato('perfil-descripcion'),
    };
  }

  /** Lo que el formulario tiene escrito, campo por campo; `null` es «no está en pantalla». */
  function valoresDelFormulario(ids: string[]): Record<string, string | null> {
    const salida: Record<string, string | null> = {};
    for (const id of ids) {
      const campo = porId<HTMLInputElement>(id);
      salida[id] = campo ? campo.value : null;
    }
    return salida;
  }

  function pulsar(testid: string): void {
    const boton = buscar<HTMLButtonElement>(testid);
    if (!boton) throw new Error('No está en pantalla el botón «' + testid + '».');
    boton.click();
    fixture.detectChanges();
  }

  function pulsarPorTexto(rotulo: string): void {
    const boton = botones().find(candidato => limpiar(candidato.textContent) === rotulo);
    if (!boton) throw new Error('No hay ningún botón rotulado «' + rotulo + '».');
    boton.click();
    fixture.detectChanges();
  }

  function escribir(id: string, valor: string): void {
    const campo = porId<HTMLInputElement>(id);
    if (!campo) throw new Error('No está en pantalla el campo #' + id + '.');
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Abrir la edición y agotar la microtarea de `NgModel`; siempre dentro de `fakeAsync`. */
  function abrirEdicion(testid: string): void {
    pulsar(testid);
    tick();
    // El campo del NIT es una pieza propia: su valor llega al DOM en el ciclo siguiente.
    fixture.detectChanges();
  }

  // ─────────────────────── 1. El defecto reportado el 28 de agosto ───────────────────────

  it('al editor no le ofrece editar los datos de la organización: le explica por qué (#123)', () => {
    montar(PERFIL, '2117');

    expect(buscar('perfil-lectura')).not.toBeNull();
    expect(raiz().querySelector('[aria-label="Editar los datos de la organización"]')).toBeNull();
    expect(buscar('aviso-solo-administracion')?.textContent).toContain('Cambiar los datos de la organización');
  });

  it('al abrirse NO hay ningún formulario: se leen los datos y se ofrece editarlos', () => {
    montar();

    expect(formularios().length).toBe(0);
    for (const id of CAMPOS_DEL_PERFIL) {
      expect(porId(id)).withContext('sigue en pantalla el campo #' + id).toBeNull();
    }
    expect(buscar('perfil-lectura')).not.toBeNull();

    // SE COMPRUEBA EL NOMBRE ACCESIBLE Y NO EL TEXTO VISIBLE. Hasta
    // esta prueba exigía que el botón dijera «Editar los datos de la organización» a la vista: era
    // la forma de garantizar que un lector de pantalla, que lee los botones seguidos y fuera de su
    // apartado, supiera cuál de los dos «Editar» de la pantalla era este. Lo que hay que garantizar
    // es eso —el nombre accesible—, no el tamaño del rótulo: el botón pasó a ser una opción
    // discreta junto al título, como pidió la dirección de producto, y el nombre completo viaja en
    // `aria-label`.
    // «Editar» y, junto a la foto, «Subir foto» (que abre la misma edición).
    expect(rotulosDeBotones()).toEqual(['Editar', 'Subir foto']);
    expect(botones().map(boton => boton.getAttribute('aria-label'))).toEqual(['Editar los datos de la organización', 'Subir foto de la organización (abre la edición de los datos)']);
    expect(botones().map(boton => boton.getAttribute('type'))).toEqual(['button', 'button']);
  });

  // ─────────────────── 2. Los trece campos, con su valor de verdad ───────────────────

  it('la ficha de lectura muestra el valor real de los trece campos', () => {
    montar();

    expect(identidad()).toEqual({
      nombre: 'Fundación Musical del Valle',
      razonSocial: 'Razón social: Fundación Musical del Valle S.A.S.',
      nit: 'NIT 900123456',
      sede: 'Medellín, Antioquia',
      descripcion: 'Formación musical en el suroccidente.',
    });
    expect(ficha('perfil-lectura')).toEqual({
      'Dirección': 'Calle 5 # 10-20',
      'Teléfono de contacto': '3001234567',
      'Correo de contacto': 'contacto@fmv.org',
      'Sitio web': 'https://fmv.org',
      'Facebook': 'https://facebook.com/fmv',
      'Instagram': 'https://instagram.com/fmv',
      'Otro enlace': 'https://youtube.com/@fmv',
    });

    expect(limpiar(buscar('perfil-lectura')!.textContent)).not.toContain('05001');
  });

  it('la lectura muestra la foto de la organización y, sin foto, sus iniciales (P4)', () => {
    montar({ ...PERFIL, fotoUrl: '/api/v1/archivos/9' } as PerfilOrganizacion);
    const foto = raiz().querySelector<HTMLImageElement>('[data-foto-lectura]');
    expect(foto?.getAttribute('src')).toBe('/api/v1/archivos/9');
    expect(foto?.alt).toBe('Foto de perfil de Fundación Musical del Valle');
    expect(rotulosDeBotones()).toContain('Cambiar foto');
  });

  it('sin foto se leen las iniciales, que son el respaldo, y no una imagen rota', () => {
    montar({ ...PERFIL, fotoUrl: null } as PerfilOrganizacion);
    expect(raiz().querySelector('[data-foto-lectura]')).toBeNull();
    expect(limpiar(raiz().querySelector('[data-iniciales-lectura]')?.textContent ?? null)).toBe('FM');
  });

  it('las direcciones web de la lectura son enlaces seguros y el correo y el teléfono, mailto y tel', () => {
    montar();
    const href = (rotulo: string): string | null | undefined =>
      Array.from(raiz().querySelectorAll('[app-dato-con-icono]')).find(d => d.querySelector('dt')?.textContent === rotulo)?.querySelector('a')?.getAttribute('href');
    expect(href('Sitio web')).toBe('https://fmv.org');
    expect(href('Correo de contacto')).toBe('mailto:contacto@fmv.org');
    expect(href('Teléfono de contacto')).toBe('tel:3001234567');
  });

  // ──────────────────────── 3. Un campo vacío se dice, no se calla ────────────────────────

  it('un campo sin dato se lee «Sin registrar» y no queda en blanco', () => {
    montar({
      ...PERFIL,
      nombre: '',
      nombreLegal: null,
      numeroIdentificacion: null,
      tipoIdentificacion: null,
      descripcion: null,
      correoContacto: null,
      telefonoContacto: null,
      sitioWeb: null,
      facebook: null,
      instagram: null,
      otroEnlace: null,
      direccion: null,
      nombreDepartamentoSede: null,
      nombreMunicipioSede: null,
    });

    expect(identidad()).toEqual({
      nombre: 'Sin registrar',
      razonSocial: '',
      nit: 'NIT sin registrar',
      sede: 'Sede sin registrar',
      descripcion: 'Sin registrar',
    });
    expect(ficha('perfil-lectura')).toEqual({
      'Dirección': 'Sin registrar',
      'Teléfono de contacto': 'Sin registrar',
      'Correo de contacto': 'Sin registrar',
      'Sitio web': 'Sin registrar',
      'Facebook': 'Sin registrar',
      'Instagram': 'Sin registrar',
      'Otro enlace': 'Sin registrar',
    });
  });

  // ─────────────────── 4. La sede se lee desde el perfil guardado ───────────────────

  it('la lectura de la sede responde al perfil guardado, no a lo que se teclee', () => {
    montar();

    componente.formulario.codigoDepartamentoSede = '91';
    componente.alCambiarDepartamento();
    fixture.detectChanges();

    expect(identidad()['sede']).toBe('Medellín, Antioquia');
  });

  // ─────────────────────── 5. «Editar» abre el formulario relleno ───────────────────────

  it('«Editar» abre el formulario con los trece campos ya rellenos', fakeAsync(() => {
    montar();

    abrirEdicion('perfil-editar');

    expect(buscar('perfil-lectura')).toBeNull();
    expect(formularios().length).toBe(1);
    expect(valoresDelFormulario(CAMPOS_DEL_PERFIL)).toEqual({
      'perfil-nombre': 'Fundación Musical del Valle',
      'perfil-nombre-legal': 'Fundación Musical del Valle S.A.S.',
      'perfil-nit': '900123456',
      'perfil-correo': 'contacto@fmv.org',
      'perfil-telefono': '3001234567',
      'perfil-direccion': 'Calle 5 # 10-20',
      'perfil-descripcion': 'Formación musical en el suroccidente.',
      'perfil-departamento': '05',
      'perfil-municipio': '05001',
      'perfil-sitio': 'https://fmv.org',
      'perfil-facebook': 'https://facebook.com/fmv',
      'perfil-instagram': 'https://instagram.com/fmv',
      'perfil-otro-enlace': 'https://youtube.com/@fmv',
    });
    expect(api.perfilGuardado).toBeNull();
  }));

  it('la organización ve en qué estado está ante la institución', fakeAsync(() => {
    // EL DATO VIAJABA EN EL PERFIL DESDE SIEMPRE Y NO LO PINTABA NINGUNA PANTALLA. Con los ocho
    // códigos del circuito editorial daba igual —«Publicado» no significaba nada para una
    // organización—; con los cuatro de un actor, esconderlo deja sin explicación el único momento
    // en que algo cambia para ella: que le pidan ajustes o que le cierren la edición del NIT.
    montar({
      ...PERFIL, estadoRegistro: 'pendiente_de_confirmacion', estadoRegistroEtiqueta: 'Pendiente de confirmación',
    });

    expect(raiz().querySelector('[data-estado-organizacion]')!.textContent!.trim()).toBe('Pendiente de confirmación');
    expect(raiz().querySelector('[data-explicacion-estado]')!.textContent)
      .toContain('no podrás enviarlo a revisión');
  }));

  it('con la confirmación dispensada, el estado no promete un bloqueo que no existe', fakeAsync(() => {
    // EL HALLAZGO: aquí decía «no podrás enviarlo a revisión ni publicar» y en la misma sesión se
    // enviaron cinco registros y se publicó una edición; el Resumen decía lo contrario. Un solo
    // aviso, el del modo real que dice la sesión.
    confirmacionFalsa.estado.set({
      userId: '9', fullName: 'Ana', email: 'ana@example.org', accountStatus: 'activa',
      correoConfirmado: false, confirmacionCorreoObligatoria: false,
    });
    montar({
      ...PERFIL, estadoRegistro: 'pendiente_de_confirmacion', estadoRegistroEtiqueta: 'Pendiente de confirmación',
    });

    const explicacion = raiz().querySelector('[data-explicacion-estado]')!.textContent ?? '';
    expect(explicacion).not.toContain('no podrás');
    expect(explicacion).toContain('puedes enviar a revisión');
  }));

  it('el NIT se lee y se corrige siempre', fakeAsync(() => {
    // ESTA PRUEBA VIGILABA LO CONTRARIO HASTA EL 14 DE SEPTIEMBRE DE 2026: que con el NIT ya
    // comprobado el formulario NO ofreciera el campo y explicara por qué. La dirección de producto
    // retiró ese bloqueo —una errata en el NIT es justo lo que hay que poder arreglar sin escribir
    // un correo— y con él desapareció la bandera `puedeEditarIdentificacion` del contrato, en el
    // servidor y aquí. Lo que se vigila ahora es que el campo esté siempre y traiga lo guardado.
    montar({
      ...PERFIL, estadoRegistro: 'activa', estadoRegistroEtiqueta: 'Activa',
    });

    expect(identidad()['nit']).toBe('NIT 900123456');
    expect(texto()).not.toContain('No se puede cambiar');

    abrirEdicion('perfil-editar');

    expect(porId<HTMLInputElement>('perfil-nit')).not.toBeNull();
    expect(porId<HTMLInputElement>('perfil-nit')!.value).toBe('900123456');
  }));

  it('el NIT que cambia por una cédula no se envía y dice por qué; el que no cambia no se reprueba (decisión 96)', fakeAsync(() => {
    montar({ ...PERFIL, numeroIdentificacion: '1020304050' });

    abrirEdicion('perfil-editar');
    // Sin tocarlo: un valor de antes de la regla no impide guardar lo demás.
    componente.guardarPerfil();
    fixture.detectChanges();
    expect(componente.erroresPerfil()['identificationNumber']).toBeUndefined();
    // El guardado válido cierra la edición: se vuelve a abrir para escribir una cédula en el NIT.
    api.perfilGuardado = null;
    abrirEdicion('perfil-editar');

    escribir('perfil-nit', '52123456');
    componente.guardarPerfil();
    fixture.detectChanges();
    expect(componente.erroresPerfil()['identificationNumber']).toContain('no para una cédula');
    expect(api.perfilGuardado).toBeNull();
  }));

  // ────────────────────────── 6. Cancelar descarta lo escrito ──────────────────────────

  it('cancelar descarta lo tecleado y la próxima edición vuelve a traer lo guardado', fakeAsync(() => {
    montar();

    abrirEdicion('perfil-editar');
    escribir('perfil-nombre', 'Nombre que nadie llegó a guardar');
    escribir('perfil-correo', 'tecleado@fmv.org');
    expect(componente.formulario.nombre).toBe('Nombre que nadie llegó a guardar');

    pulsar('perfil-cancelar');

    expect(componente.formulario.nombre).toBe('Fundación Musical del Valle');
    expect(componente.formulario.correoContacto).toBe('contacto@fmv.org');

    expect(api.perfilGuardado).toBeNull();
    expect(identidad()['nombre']).toBe('Fundación Musical del Valle');
    expect(texto()).not.toContain('Nombre que nadie llegó a guardar');

    abrirEdicion('perfil-editar');

    expect(porId<HTMLInputElement>('perfil-nombre')!.value).toBe('Fundación Musical del Valle');
    expect(porId<HTMLInputElement>('perfil-correo')!.value).toBe('contacto@fmv.org');
  }));

  // ──────────────────────── 7. Guardar bien devuelve a la lectura ────────────────────────

  it('guardar con éxito vuelve a la lectura, con el aviso y con el dato nuevo', fakeAsync(() => {
    montar();

    abrirEdicion('perfil-editar');
    escribir('perfil-nombre', 'Fundación Musical del Valle II');
    pulsarPorTexto('Guardar datos de la organización');

    // La sección ya no depende de que el armazón le devuelva el perfil por `input`: guarda su
    // propia señal directamente con lo que respondió el PUT.
    expect(api.perfilGuardado!.nombre).toBe('Fundación Musical del Valle II');
    expect(componente.perfil()!.nombre).toBe('Fundación Musical del Valle II');
    expect(formularios().length).toBe(0);
    expect(buscar('perfil-lectura')).not.toBeNull();
    expect(identidad()['nombre']).toBe('Fundación Musical del Valle II');

    const aviso = raiz().querySelector('[role="status"]');
    expect(aviso).not.toBeNull();
    expect(limpiar(aviso!.textContent)).toBe('Los datos de la organización quedaron guardados.');
  }));

  // ─────────────────── 8. Guardar mal se queda en el formulario ───────────────────

  it('un error del servidor deja el formulario abierto, con lo escrito y con el motivo', fakeAsync(() => {
    montar();
    api.falloAlGuardarPerfil = {
      status: 422,
      message: 'Revisa los datos enviados.',
      payload: { errors: { contactEmail: ['Ya hay otra organización con ese correo.'] } },
    };

    abrirEdicion('perfil-editar');
    escribir('perfil-nombre', 'Fundación Musical del Valle II');
    escribir('perfil-correo', 'repetido@fmv.org');
    pulsarPorTexto('Guardar datos de la organización');

    expect(formularios().length).toBe(1);
    expect(buscar('perfil-lectura')).toBeNull();
    expect(buscar('perfil-editar')).toBeNull();
    expect(porId<HTMLInputElement>('perfil-nombre')!.value).toBe('Fundación Musical del Valle II');
    expect(porId<HTMLInputElement>('perfil-correo')!.value).toBe('repetido@fmv.org');

    const alerta = raiz().querySelector('[role="alert"]');
    expect(alerta).not.toBeNull();
    // El aviso general NO repite el nombre interno del campo: el motivo va junto al campo.
    expect(limpiar(alerta!.textContent)).toBe('Revisa los campos marcados.');
    expect(limpiar(porId('perfil-correo-error')!.textContent)).toBe('Ya hay otra organización con ese correo.');
    expect(porId('perfil-correo')!.getAttribute('aria-invalid')).toBe('true');
  }));

  it('con el guardado en vuelo no se puede cancelar ni volver a enviar', fakeAsync(() => {
    montar();
    api.demorarGuardadoDePerfil = true;

    abrirEdicion('perfil-editar');
    pulsarPorTexto('Guardar datos de la organización');

    const delFormulario = Array.from(formularios()[0].querySelectorAll('button'));
    expect(delFormulario.map(boton => limpiar(boton.textContent))).toEqual(['Guardando…', 'Cancelar']);
    expect(delFormulario.map(boton => boton.disabled)).toEqual([true, true]);

    pulsar('perfil-cancelar');
    expect(formularios().length).toBe(1);
    expect(componente.editandoPerfil()).toBeTrue();
  }));

  // ─────────────────────────── Los bordes del cambio de vista ───────────────────────────

  it('cambiar de organización pide el perfil de la nueva y cierra el formulario abierto', fakeAsync(() => {
    // QUEDARSE EN EDICIÓN AL CAMBIAR DE ORGANIZACIÓN DEJARÍA EN PANTALLA LOS CAMPOS DE LA ANTERIOR
    // SOBRE EL NOMBRE DE LA NUEVA. Ahora la sección pide su propio perfil: la organización nueva se
    // simula respondiendo distinto según el id que llegue.
    montar();
    const otra: PerfilOrganizacion = { ...PERFIL, id: '1117', nombre: 'Corporación Tambó' };
    spyOn(api, 'obtenerPerfil').and.callFake((id: string) => of(id === '1117' ? otra : PERFIL));

    abrirEdicion('perfil-editar');
    expect(formularios().length).toBe(1);

    // `organizacionId` es de solo lectura desde el store compartido: se cambia ahí.
    TestBed.inject(PanelOrganizacionStore).organizacionId.set('1117');
    fixture.detectChanges();
    tick();

    expect(formularios().length).toBe(0);
    expect(identidad()['nombre']).toBe('Corporación Tambó');
  }));

  it('mientras el perfil no ha llegado se dice, y no se ofrece editar la nada', () => {
    montar(null);

    expect(buscar('perfil-editar')).toBeNull();
    expect(formularios().length).toBe(0);
    expect(texto()).toContain('Los datos de la organización todavía no han llegado');

    componente.editarPerfil();
    fixture.detectChanges();
    expect(componente.editandoPerfil()).toBeFalse();
    expect(formularios().length).toBe(0);
  });

  // ───────────────────────────── El foco en las transiciones ─────────────────────────────

  /*
   * POR QUÉ ESTAS PRUEBAS EXISTEN, con la fecha. El 28 de agosto de 2026 una revisión adversarial
   * midió que las transiciones de esta pantalla destruyen el botón que tiene el foco —el `@if` lo
   * saca del DOM— y ninguna se lo pasaba a nadie.
   *
   * EL FIXTURE SE ATA AL DOCUMENTO. Sin `document.body.appendChild`, Karma monta el componente
   * fuera del documento y `HTMLElement.focus()` no hace nada.
   */
  function montarEnElDocumento(perfil = PERFIL): void {
    montar(perfil);
    document.body.appendChild(fixture.nativeElement);
  }

  afterEach(() => {
    fixture?.nativeElement?.remove?.();
  });

  it('«Editar» deja el foco en el primer campo, no en el cuerpo del documento', fakeAsync(() => {
    montarEnElDocumento();

    pulsar('perfil-editar');
    tick();

    expect(document.activeElement).toBe(porId('perfil-nombre'));
  }));

  it('«Cancelar» devuelve el foco al botón que abrió el formulario', fakeAsync(() => {
    montarEnElDocumento();
    pulsar('perfil-editar');
    tick();

    pulsar('perfil-cancelar');
    tick();

    expect(document.activeElement).toBe(buscar('perfil-editar'));
  }));

  it('guardar bien devuelve el foco al botón, que es donde queda el aviso', fakeAsync(() => {
    montarEnElDocumento();
    pulsar('perfil-editar');
    tick();

    pulsarPorTexto('Guardar datos de la organización');
    tick();
    fixture.detectChanges();

    expect(document.activeElement).toBe(buscar('perfil-editar'));
  }));

  // NO SE MIGRÓ: «los dos Cancelar se distinguen fuera de contexto» comprobaba que el `aria-label`
  // de esta sección y el de Responsable no coincidieran teniendo los dos formularios abiertos A LA
  // VEZ en la misma pantalla. Desde el rediseño son dos rutas
  // separadas: nunca están montadas juntas, así que la prueba dejó de tener premisa. El `aria-label`
  // propio de esta sección sigue cubierto arriba en cada prueba que abre el formulario.

  // ───────────────────── la foto se sube al guardar, no al elegirla ─────────────────────

  function elegirFoto(): File {
    const archivo = new File(['x'], 'logo.png', { type: 'image/png' });
    const entrada = raiz().querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return archivo;
  }

  it('elegir la foto NO la sube: queda de vista previa y salir pregunta', fakeAsync(() => {
    montar();
    const subir = spyOn(TestBed.inject(BancoDeArchivosService), 'subirImagen');
    abrirEdicion('perfil-editar');

    elegirFoto();

    expect(subir).not.toHaveBeenCalled();
    expect(buscar('perfil-lectura')).toBeNull();
    expect(raiz().querySelector('[data-foto-pendiente]')).not.toBeNull();
    expect(raiz().querySelector('[data-foto-vista]')).not.toBeNull();
    expect(componente.avisoAlSalir()).toContain('no guardaste');
  }));

  it('guardar sube la foto elegida y manda su identificador en el mismo guardado', fakeAsync(() => {
    montar();
    const archivo = new File(['x'], 'logo.png', { type: 'image/png' });
    const subir = spyOn(TestBed.inject(BancoDeArchivosService), 'subirImagen').and.resolveTo({ ok: true, archivo: { id: 55, url: '/archivos/55' } } as never);
    abrirEdicion('perfil-editar');
    const entrada = raiz().querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    pulsarPorTexto('Guardar datos de la organización');
    tick();

    expect(subir).toHaveBeenCalledTimes(1);
    expect(api.perfilGuardado!.archivoFotoId).toBe(55);
    expect(componente.avisoAlSalir()).toBeNull();
  }));

  it('cancelar descarta la foto elegida sin haber subido nada: no queda un archivo huérfano', fakeAsync(() => {
    montar();
    const subir = spyOn(TestBed.inject(BancoDeArchivosService), 'subirImagen');
    abrirEdicion('perfil-editar');
    elegirFoto();

    pulsarPorTexto('Cancelar');

    expect(subir).not.toHaveBeenCalled();
    expect(componente.avisoAlSalir()).toBeNull();
  }));

  it('una dirección sin esquema se acepta y se guarda con https://; el teléfono «abc» no pasa', fakeAsync(() => {
    montar();
    abrirEdicion('perfil-editar');
    escribir('perfil-telefono', 'abc');
    pulsarPorTexto('Guardar datos de la organización');

    expect(api.perfilGuardado).toBeNull();
    expect(limpiar(porId('perfil-telefono-error')!.textContent)).toContain('teléfono');

    escribir('perfil-telefono', '3001234567');
    escribir('perfil-sitio', 'www.fmv.example.org');
    pulsarPorTexto('Guardar datos de la organización');

    expect(api.perfilGuardado!.sitioWeb).toBe('https://www.fmv.example.org');
  }));

  it('el rechazo de una dirección vuelve junto a su campo con su nombre, no como «sitioWeb:»', fakeAsync(() => {
    montar();
    api.falloAlGuardarPerfil = { status: 422, message: 'x', payload: { errors: { sitioWeb: ['Escribe una dirección web completa.'] } } };
    abrirEdicion('perfil-editar');

    pulsarPorTexto('Guardar datos de la organización');

    expect(limpiar(porId('perfil-sitio-error')!.textContent)).toBe('Escribe una dirección web completa.');
    expect(texto()).not.toContain('sitioWeb:');
  }));
});
