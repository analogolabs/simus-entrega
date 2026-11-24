import { computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';

import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { BancoDeArchivosService } from '../../core/services/banco-de-archivos.service';
import {
  CampoDeLaPropuesta, PropuestaDeCambio, PropuestasDeProcesoService, RutaDeProcesoConPropuestas,
} from '../../core/services/propuestas-de-proceso.service';
import { FotoDelProceso, ResultadoDeFotoSubida } from '../../shared/components/ui/foto-del-proceso/foto-del-proceso.component';
import { FalloDelServidor, PanelOrganizacionApi, UbicacionDivipola } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';

/** Lo que la ficha necesita de la API de cada proceso: los tres servicios tienen esta misma forma. */
export interface ServicioDeProceso<P, S> {
  obtener(id: string | number): Observable<P>;
  crear(organizacionId: string | number | null, solicitud: S): Observable<P>;
  guardar(id: string | number, solicitud: S): Observable<P>;
  enviarARevision(id: string | number): Observable<P>;
  retirarDeRevisionOAbandonar(id: string | number): Observable<void>;
  retirarPublicado(id: string | number, motivo: string): Observable<P>;
  subirFotoDelResponsable(archivo: File, alt: string): Promise<ResultadoDeFotoSubida>;
}

/** Los textos que dependen del tipo de proceso (género y nombre); lo demás es común. */
export interface TextosDeLaFicha {
  noSePudoConsultar: string;
  detalleDeProponerElFondo: string;
  guardadoConCambioDeFondo: string;
  detalleDeEnviar: string;
  enviado: string;
  detalleDeRetirarDeRevision: string;
  volvioABorrador: string;
  detalleDeRetirarPublicado: string;
  retiradoDelEcosistema: string;
}

/** Lo que toda ficha de proceso tiene en su formulario. */
export interface FormularioConTerritorioYFoto extends FotoDelProceso {
  codigoDepartamento: string;
}

/**
 * La base de la ficha de un proceso del ecosistema en el panel (LUT-02, B2 de docs/desarrollo/30-consola-y-acceso.md §30.17): el
 * taller, el espacio y la red compartían, copiadas, las mismas 200 líneas de circuito —cargar, guardar,
 * enviar, retirar de revisión, abandonar, retirar lo publicado—, la lista de territorios y la foto.
 *
 * <b>Qué queda en cada ficha.</b> Solo lo que el tipo exige: sus campos, sus vocabularios, cómo se
 * traducen a la petición y qué cambios son de fondo. El estado, los mensajes de error y las
 * confirmaciones son de aquí, y por eso no pueden volver a separarse entre un proceso y otro.
 */
export abstract class FichaDeProcesoBase<P extends { id: number; estadoRegistro: string }, S, F extends FormularioConTerritorioYFoto> {
  protected readonly panel = inject(PanelOrganizacionApi);
  protected readonly store = inject(PanelOrganizacionStore);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly confirmaciones = inject(ServicioDeConfirmacion);
  protected readonly banco = inject(BancoDeArchivosService);
  protected readonly propuestas = inject(PropuestasDeProcesoService);

  protected abstract readonly servicio: ServicioDeProceso<P, S>;
  protected abstract readonly textos: TextosDeLaFicha;
  /** El último tramo de la ruta del proceso: `luteria`, `espacios` o `redes`. */
  protected abstract readonly tramoDeLaRuta: string;
  /** El segmento de la cuenta personal: `talleres`, `espacios` o `redes`. */
  protected abstract readonly tramoPersonal: string;
  /** El tipo con el que el diálogo de retiro cuenta los eventos que se archivan con el proceso (AJU). */
  protected abstract readonly tipoDeProceso: 'taller' | 'espacio' | 'red';
  /** El segmento de las rutas de propuestas del servidor: `talleres`, `espacios` o `redes`. */
  protected abstract readonly rutaDePropuestas: RutaDeProcesoConPropuestas;
  protected abstract readonly formularioVacio: F;

  protected abstract adoptarDeLaApi(proceso: P): void;
  protected abstract solicitud(): S;

  /**
   * Lo que el formulario cambia de FONDO frente al proceso publicado, con los nombres de campo del servidor y el valor
   * como texto (los identificadores de un vocabulario van separados por coma). Vacío si nada de fondo cambió.
   *
   * <b>LA LISTA ES LA DE `ProcesoConPropuestas` DEL SERVIDOR</b> (nombre, territorio y lo que defina al proceso): un
   * nombre que el servidor no reconozca lo rechaza con un 400, que es lo que tiene que pasar si se separan.
   */
  abstract readonly diferenciaDeFondo: () => CampoDeLaPropuesta[];

  /** La petición de guardar con los campos de fondo tal como están publicados: lo que se guarda al instante es la errata. */
  protected abstract solicitudSinFondo(): S;

  /** Escribe en el formulario lo que dice una propuesta guardada, para retomarla donde se dejó. */
  protected abstract aplicarPropuestaAlFormulario(campos: CampoDeLaPropuesta[]): void;

  /** Si el responsable es la propia persona (sin organización) y no una organización. */
  readonly esPersona = signal(false);
  readonly esAdministradora = this.store.esAdministradora;

  readonly proceso = signal<P | null>(null);
  readonly ubicaciones = signal<UbicacionDivipola[]>([]);
  readonly formulario = signal<F>(undefined as unknown as F);

  /** La propuesta de cambio viva sobre lo publicado, o `null` si no hay ninguna. */
  readonly propuesta = signal<PropuestaDeCambio | null>(null);
  readonly motivoDeLaPropuesta = signal('');
  readonly guardandoLaPropuesta = signal(false);

  readonly cargando = signal(true);
  readonly noEncontrado = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly erroresDeCampo = signal<Record<string, string>>({});

  /** Un proceso nuevo no existe todavía en el servidor. */
  readonly esNuevo = computed(() => this.proceso() === null);
  readonly estado = computed(() => this.proceso()?.estadoRegistro ?? 'borrador');

  /** Se edita en borrador, con ajustes pedidos y publicado (donde la errata es al instante). */
  readonly editable = computed(() =>
    this.esNuevo() || ['borrador', 'ajustes_solicitados', 'publicado'].includes(this.estado()));

  /**
   * Lo que de fondo hay escrito y todavía no está guardado como propuesta, sobre un proceso publicado (PROP). El
   * resto de lo escrito es errata y se guarda al instante.
   */
  readonly cambiosDeFondo = computed(() => this.estado() === 'publicado' && this.proceso() !== null
    ? this.diferenciaDeFondo() : []);

  /**
   * Cuántos campos de fondo hay escritos que NO están ya en el borrador de la propuesta: lo que se perdería al salir y
   * lo que impide enviarla tal como está guardada.
   */
  readonly cambiosSinGuardar = computed(() => {
    const viva = this.propuesta();
    const guardado = new Map((viva && ['borrador', 'ajustes_solicitados', 'en_revision'].includes(viva.estado) ? viva.campos : [])
      .map(c => [c.campoId, c.valorPropuesto ?? null]));
    const ahora = new Map(this.cambiosDeFondo().map(c => [c.campoId, c.valorPropuesto ?? null]));
    let cuantos = 0;
    for (const [campo, valor] of ahora) if (!guardado.has(campo) || guardado.get(campo) !== valor) cuantos++;
    for (const campo of guardado.keys()) if (!ahora.has(campo)) cuantos++;
    return cuantos;
  });

  /** Puede enviar, retirar y abandonar: lo hace quien administra, o la propia persona. */
  readonly puedeAdministrar = computed(() => this.esPersona() || this.esAdministradora());

  readonly departamentos = computed(() => {
    const unicos = new Map(this.ubicaciones().map(fila => [fila.departmentCode, fila.departmentName]));
    return [...unicos].map(([codigo, nombre]) => ({ codigo, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });
  readonly municipios = computed(() => this.ubicaciones()
    .filter(fila => fila.departmentCode === this.formulario().codigoDepartamento)
    .sort((a, b) => a.municipalityName.localeCompare(b.municipalityName, 'es')));

  /**
   * A dónde se vuelve: la lista única de procesos de la organización con el tipo elegido (LIS; las listas por tipo ya
   * no existen) o la lista de esa persona.
   */
  readonly rutaDeLaLista = computed<string[]>(() => this.esPersona()
    ? ['/gestion', 'cuenta', this.tramoPersonal]
    : rutaDelPanel(this.store.organizacionId(), 'procesos'));

  /** La dirección de la ficha de este tipo: el tramo del tipo y el identificador; no es la lista. */
  protected rutaDeLaFicha(id: number): string[] {
    return this.esPersona()
      ? ['/gestion', 'cuenta', this.tramoPersonal, String(id)]
      : rutaDelPanel(this.store.organizacionId(), 'procesos', this.tramoDeLaRuta, id);
  }

  /**
   * Quien sube la foto: una organización por el Banco de archivos, una persona sin organización por su
   * puerta con cuota propia.
   */
  readonly subirFoto = (archivo: File, alt: string): Promise<ResultadoDeFotoSubida> => this.esPersona()
    ? this.servicio.subirFotoDelResponsable(archivo, alt)
    : this.banco.subirImagen(archivo, alt, { canal: 'externo' });

  cambiarFoto(foto: FotoDelProceso): void {
    this.formulario.update(f => ({ ...f, ...foto }));
  }

  cambiar<K extends keyof F>(campo: K, valor: F[K]): void {
    this.formulario.update(f => ({ ...f, [campo]: valor }));
  }

  elegirDepartamento(codigo: string): void {
    this.formulario.update(f => ({ ...f, codigoDepartamento: codigo, codigoMunicipio: '' }));
  }

  /** Carga el vocabulario, los territorios y, si hay identificador, el proceso. */
  protected cargar<C>(catalogos$: Observable<C>, alCargarCatalogos: (catalogos: C) => void): void {
    this.formulario.set({ ...this.formularioVacio });
    this.esPersona.set(this.route.snapshot.data['responsable'] === 'persona');
    const id = this.route.snapshot.paramMap.get('id');

    forkJoin({
      catalogos: catalogos$,
      ubicaciones: this.panel.obtenerUbicaciones().pipe(catchError(() => of([] as UbicacionDivipola[]))),
      proceso: id ? this.servicio.obtener(id).pipe(catchError((fallo: FalloDelServidor) => {
        this.error.set(fallo?.message ?? this.textos.noSePudoConsultar);
        this.noEncontrado.set(true);
        return of(null);
      })) : of(null),
    }).subscribe(({ catalogos, ubicaciones, proceso }) => {
      alCargarCatalogos(catalogos);
      this.ubicaciones.set(ubicaciones ?? []);
      if (proceso) this.adoptar(proceso);
      this.cargando.set(false);
    });
  }

  /** Un valor como texto comparable: vacío y nulo son lo mismo. */
  protected comoTexto(valor: unknown): string | null {
    return valor === null || valor === undefined || valor === '' ? null : String(valor);
  }

  /** Una lista de identificadores como la guarda el servidor: ordenada y separada por coma; vacía es nula. */
  protected comoLista(ids: readonly number[]): string | null {
    return ids.length === 0 ? null : [...ids].sort((a, b) => a - b).join(',');
  }

  /** Los identificadores de un texto «3,5,9». */
  protected deLista(valor: string | null): number[] {
    return valor ? valor.split(',').map(Number).filter(n => n > 0) : [];
  }

  /** Lo que cambia entre lo publicado y lo escrito: pares «campo, valor publicado, valor escrito». */
  protected diferenciasEntre(pares: readonly (readonly [string, string | null, string | null])[]): CampoDeLaPropuesta[] {
    return pares
      .filter(([, publicado, escrito]) => (publicado ?? null) !== (escrito ?? null))
      .map(([campoId, , escrito]) => ({ campoId, valorPropuesto: escrito }));
  }

  protected adoptar(proceso: P, recargarLaPropuesta = true): void {
    this.proceso.set(proceso);
    this.adoptarDeLaApi(proceso);
    if (recargarLaPropuesta) this.cargarLaPropuesta(proceso);
  }

  /**
   * La propuesta viva, si la hay. Se pide solo con el proceso publicado, que es cuando puede haberla, y lo que tenga
   * escrito se vuelca en el formulario para que quien la retoma vea lo que dejó y no la ficha en limpio.
   */
  private cargarLaPropuesta(proceso: P): void {
    if (proceso.estadoRegistro !== 'publicado') {
      this.propuesta.set(null);
      return;
    }
    this.propuestas.deMi(this.rutaDePropuestas, proceso.id).pipe(catchError(() => of(null))).subscribe(propuesta => {
      const viva = propuesta && propuesta.id > 0 ? propuesta : null;
      this.propuesta.set(viva);
      if (viva && ['borrador', 'ajustes_solicitados', 'en_revision'].includes(viva.estado)) {
        this.aplicarPropuestaAlFormulario(viva.campos.map(c => ({ campoId: c.campoId, valorPropuesto: c.valorPropuesto })));
        this.motivoDeLaPropuesta.set(viva.motivo ?? '');
      }
    });
  }

  protected mostrarFallo(fallo: FalloDelServidor): void {
    const errores = fallo?.payload?.errors;
    if (errores) {
      this.erroresDeCampo.set(Object.fromEntries(
        Object.entries(errores).map(([clave, mensajes]) => [clave, [mensajes].flat().filter(Boolean).join(' ')])));
    }
    this.error.set(errores ? 'Revisa los campos marcados.' : (fallo?.message ?? 'No fue posible completar la acción.'));
  }

  protected limpiarMensajes(): void {
    this.error.set('');
    this.aviso.set('');
    this.erroresDeCampo.set({});
  }

  async guardar(): Promise<void> {
    if (this.guardando()) return;
    this.limpiarMensajes();

    // LO PUBLICADO NO CAMBIA DE FONDO EN CALIENTE: la errata se guarda ahora y lo de fondo viaja como propuesta, que
    // el Programa decide. Se dice antes de guardar, no después.
    const deFondo = this.cambiosDeFondo();
    if (this.cambiosSinGuardar() > 0) {
      const respuesta = await this.confirmaciones.pedir({
        titulo: 'Guardar y proponer el cambio',
        detalle: this.textos.detalleDeProponerElFondo,
        accion: 'Guardar y proponer',
        tono: 'confirmar',
      });
      if (!respuesta) return;
    }

    this.guardando.set(true);
    const actual = this.proceso();
    const peticion = actual
      ? this.servicio.guardar(actual.id, deFondo.length > 0 ? this.solicitudSinFondo() : this.solicitud())
      : this.servicio.crear(this.esPersona() ? null : this.store.organizacionId(), this.solicitud());
    peticion.subscribe({
      next: guardado => {
        if (!actual) {
          this.guardando.set(false);
          void this.router.navigate(this.rutaDeLaFicha(guardado.id), { replaceUrl: true });
          return;
        }
        if (deFondo.length === 0) {
          this.guardando.set(false);
          this.adoptar(guardado);
          this.aviso.set('Los cambios quedaron guardados.');
          return;
        }
        // LA ERRATA YA ESTA GUARDADA; AHORA, LO DE FONDO COMO BORRADOR DE PROPUESTA. No se envía solo: quien responde
        // la revisa y la manda cuando esté lista.
        this.propuestas.guardar(this.rutaDePropuestas, actual.id, this.motivoDeLaPropuesta().trim() || null, deFondo).subscribe({
          next: propuesta => {
            this.guardando.set(false);
            this.adoptar(guardado, false);
            this.propuesta.set(propuesta.id > 0 ? propuesta : null);
            // EL FORMULARIO SIGUE MOSTRANDO LO PROPUESTO, no vuelve a lo publicado: quien lo retoma ve lo que dejó escrito.
            this.aplicarPropuestaAlFormulario(propuesta.campos.map(c => ({ campoId: c.campoId, valorPropuesto: c.valorPropuesto })));
            this.aviso.set(this.textos.guardadoConCambioDeFondo);
          },
          error: (fallo: FalloDelServidor) => { this.guardando.set(false); this.adoptar(guardado); this.mostrarFallo(fallo); },
        });
      },
      error: (fallo: FalloDelServidor) => { this.guardando.set(false); this.mostrarFallo(fallo); },
    });
  }

  /** Manda la propuesta al Programa. Desde aquí ya no se toca hasta que decida. */
  async enviarLaPropuesta(): Promise<void> {
    const actual = this.proceso();
    if (!actual || this.guardando() || this.guardandoLaPropuesta()) return;
    this.limpiarMensajes();
    const respuesta = await this.confirmaciones.pedir({
      titulo: 'Enviar la propuesta al PNMC',
      detalle: 'El PNMC compara tu propuesta con lo publicado y decide si se aplica. Mientras decide, no podrás modificarla.',
      accion: 'Enviar la propuesta',
      tono: 'principal',
    });
    if (!respuesta) return;

    this.guardandoLaPropuesta.set(true);
    this.propuestas.enviar(this.rutaDePropuestas, actual.id).subscribe({
      next: propuesta => {
        this.guardandoLaPropuesta.set(false);
        this.propuesta.set(propuesta);
        this.aviso.set('Tu propuesta está en la bandeja del PNMC. Te avisaremos cuando decida.');
      },
      error: (fallo: FalloDelServidor) => { this.guardandoLaPropuesta.set(false); this.mostrarFallo(fallo); },
    });
  }

  /** Abandona el borrador de la propuesta y devuelve el formulario a lo publicado. Lo ya enviado no se abandona. */
  async abandonarLaPropuesta(): Promise<void> {
    const actual = this.proceso();
    if (!actual || this.guardando() || this.guardandoLaPropuesta()) return;
    this.limpiarMensajes();
    const respuesta = await this.confirmaciones.pedir({
      titulo: 'Descartar la propuesta',
      detalle: 'Se descarta lo que habías propuesto. Lo publicado no cambia.',
      accion: 'Descartar la propuesta',
      tono: 'destructiva',
    });
    if (!respuesta) return;

    this.guardandoLaPropuesta.set(true);
    this.propuestas.abandonar(this.rutaDePropuestas, actual.id).subscribe({
      next: () => {
        this.guardandoLaPropuesta.set(false);
        this.propuesta.set(null);
        this.motivoDeLaPropuesta.set('');
        this.adoptarDeLaApi(actual);
        this.aviso.set('La propuesta se descartó.');
      },
      error: (fallo: FalloDelServidor) => { this.guardandoLaPropuesta.set(false); this.mostrarFallo(fallo); },
    });
  }

  async enviar(): Promise<void> {
    const actual = this.proceso();
    if (!actual || this.guardando()) return;
    this.limpiarMensajes();
    const respuesta = await this.confirmaciones.pedir({
      titulo: 'Enviar a revisión',
      detalle: this.textos.detalleDeEnviar,
      accion: 'Enviar a revisión',
      tono: 'principal',
    });
    if (!respuesta) return;

    this.guardando.set(true);
    this.servicio.enviarARevision(actual.id).subscribe({
      next: enviado => {
        this.guardando.set(false);
        this.adoptar(enviado);
        this.aviso.set(this.textos.enviado);
      },
      error: (fallo: FalloDelServidor) => { this.guardando.set(false); this.mostrarFallo(fallo); },
    });
  }

  async retirarDeRevisionOAbandonar(): Promise<void> {
    const actual = this.proceso();
    if (!actual || this.guardando()) return;
    this.limpiarMensajes();
    const enRevision = actual.estadoRegistro === 'en_revision';
    const respuesta = await this.confirmaciones.pedir(enRevision
      ? {
        titulo: 'Retirar de la revisión',
        detalle: this.textos.detalleDeRetirarDeRevision,
        accion: 'Retirar de la revisión',
        tono: 'confirmar',
      }
      : {
        titulo: 'Abandonar el borrador',
        detalle: 'El borrador se archiva y deja de aparecer en tu lista.',
        accion: 'Abandonar el borrador',
        tono: 'destructiva',
      });
    if (!respuesta) return;

    this.guardando.set(true);
    this.servicio.retirarDeRevisionOAbandonar(actual.id).subscribe({
      next: () => {
        this.guardando.set(false);
        if (enRevision) {
          this.servicio.obtener(actual.id).subscribe(t => this.adoptar(t));
          this.aviso.set(this.textos.volvioABorrador);
        } else {
          void this.router.navigate(this.rutaDeLaLista());
        }
      },
      error: (fallo: FalloDelServidor) => { this.guardando.set(false); this.mostrarFallo(fallo); },
    });
  }

  async retirarPublicado(): Promise<void> {
    const actual = this.proceso();
    if (!actual || this.guardando()) return;
    this.limpiarMensajes();
    const respuesta = await this.confirmaciones.pedir({
      titulo: 'Retirar del ecosistema',
      detalle: this.textos.detalleDeRetirarPublicado,
      accion: 'Retirar del ecosistema',
      eventosDelProceso: { tipo: this.tipoDeProceso, id: actual.id, ambito: 'externo' },
      tono: 'destructiva',
      pideMotivo: true,
      rotuloDelMotivo: 'Motivo del retiro',
      motivoObligatorio: true,
    });
    if (!respuesta) return;

    this.guardando.set(true);
    this.servicio.retirarPublicado(actual.id, respuesta.motivo).subscribe({
      next: retirado => {
        this.guardando.set(false);
        this.adoptar(retirado);
        this.aviso.set(this.textos.retiradoDelEcosistema);
      },
      error: (fallo: FalloDelServidor) => { this.guardando.set(false); this.mostrarFallo(fallo); },
    });
  }
}
