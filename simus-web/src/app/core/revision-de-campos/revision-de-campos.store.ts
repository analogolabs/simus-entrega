import { Injectable, computed, signal } from '@angular/core';
import { Observable } from 'rxjs';
import {
  GuardarRevisionSolicitud,
  ObservacionDeCampo,
  RevisionDeCampos,
  ComparacionEnviosFestival,
  llaveDelCampo,
  revisionVacia,
} from './revision-de-campos';

/**
 * En qué papel se está mirando la ficha.
 *
 * · `lectura`  — nadie pide ni atiende nada. Es el modo por omisión y no pinta ningún control.
 * · `revision` — el funcionario escribe las notas.
 * · `atencion` — la organización las lee y las va marcando.
 */
export type ModoDeRevision = 'lectura' | 'revision' | 'atencion';

/**
 * El estado de la revisión campo por campo, compartido por la ficha y por el panel que la monta.
 *
 * <b>POR QUÉ UN ALMACÉN Y NO UNAS ENTRADAS EN LA FICHA.</b> Porque quien necesita la nota es cada
 * uno de los cuarenta y siete campos, repartidos por 1.751 líneas de plantilla y nueve niveles de
 * anidamiento. Pasarla por `@Input` obligaría a que cada nivel intermedio la reenviara, y el que se
 * olvide no falla: deja de pintar el control y nadie se entera. `<app-dato-de-la-ficha>` lo pide
 * por inyección, que es una sola línea y no depende de por dónde cuelgue.
 *
 * <b>NO SABE DE HTTP, Y ES DELIBERADO.</b> Las dos pantallas hablan con puertas distintas —el
 * funcionario con `/institucional`, la organización con `/externo`— y con cookies distintas. El
 * almacén guarda el estado; quien lo monta hace las llamadas y le pasa lo que llega. Así se puede
 * probar entero sin red.
 *
 * <b>NO ES `providedIn: 'root'`.</b> Se provee en el componente que abre la ficha, de modo que
 * cerrarla lo destruye: un almacén global se quedaría con las notas del Festival anterior, y la
 * ficha siguiente abriría con ellas puestas.
 */
@Injectable()
export class RevisionDeCamposStore {
  readonly modo = signal<ModoDeRevision>('lectura');

  /** Lo que vino del servidor. `null` mientras se carga. */
  readonly revision = signal<RevisionDeCampos | null>(null);
  readonly comparacionEnvios = signal<ComparacionEnviosFestival | null>(null);

  /**
   * Las notas tal como están AHORA en la pantalla.
   *
   * <b>SE SEPARA DE `revision()` PORQUE SON DOS COSAS.</b> Aquella es lo último que dijo el
   * servidor; esta es el borrador vivo, con lo que el funcionario acaba de escribir y todavía no ha
   * guardado. Sin la separación no hay forma de saber si hay cambios sin guardar, que es lo que
   * decide si cerrar el diálogo tiene que avisar.
   */
  readonly notas = signal<ObservacionDeCampo[]>([]);

  readonly guardando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  /**
   * La pantalla que monta el almacén resuelve una observación al guardar el campo corregido.
   * En ese recorrido no se pinta una segunda casilla de confirmación.
   */
  readonly resolucionAutomatica = signal(false);

  /** En Gestión las notas se anuncian junto al campo y su detalle vive en un único inspector. */
  readonly presentacionAtencion = signal<'detalle' | 'indicador'>('detalle');
  readonly notaSeleccionadaId = signal<number | null>(null);
  alSeleccionarNota: ((nota: ObservacionDeCampo) => void) | null = null;

  /** El campo cuya caja de nota está abierta. Uno a la vez: dos cajas abiertas invitan a confundirlas. */
  readonly campoEnEdicion = signal<string | null>(null);

  /**
   * Lo que se está escribiendo en la caja de nota abierta (LIS-03). La caja guarda su
   * texto en el componente del campo hasta que se pulsa «Guardar sugerencia»; sin esto, publicar
   * con la caja abierta TIRABA lo escrito sin decir nada.
   */
  readonly textoEnEdicion = signal('');

  /**
   * Hay una sugerencia escrita en una caja abierta que todavía no es una nota. Mientras sea cierto,
   * ni «Publicar» ni «Enviar sugerencias» deben seguir: una dejaría lo escrito fuera, la otra lo
   * perdería.
   */
  readonly notaSinGuardar = computed(() => {
    const campo = this.campoEnEdicion();
    if (campo === null) { return false; }
    const escrito = this.textoEnEdicion().trim();
    return escrito.length > 0 && escrito !== (this.nota(campo)?.nota ?? '').trim();
  });

  /** Hay algo escrito que el servidor todavía no tiene. */
  readonly sinGuardar = signal(false);

  /** Cambia con cada edición del borrador, incluso si ya estaba pendiente de guardar. */
  readonly versionDelBorrador = signal(0);

  /**
   * Qué hacer cuando la organización marca un punto como atendido.
   *
   * <b>ES UNA FUNCIÓN Y NO UN `@Output`.</b> Quien pulsa la casilla es
   * `<div app-dato-de-la-ficha>`, uno de cuarenta y siete repartidos por 1.751 líneas de plantilla
   * y nueve niveles de anidamiento: un `@Output` obligaría a que cada nivel intermedio lo
   * reenviara, y el que se olvidara dejaría la casilla muda —sin error, sin aviso—.
   *
   * <b>NO LO RESUELVE EL ALMACÉN</b> porque marcar llama al servidor, y las dos pantallas hablan
   * con puertas distintas y con cookies distintas. Lo pone el panel que provee el almacén.
   *
   * <b>DEVUELVE LO QUE DIJO EL SERVIDOR</b> y no marca nada por su cuenta: quien decide el estado de
   * la nota es {@link atender}, que es donde vive también el deshacer.
   */
  alAtender: ((observacionId: number, atendida: boolean) => Observable<ObservacionDeCampo>) | null = null;

  /**
   * Marca —o desmarca— un cambio, y deja la casilla diciendo la verdad.
   *
   * <b>EL DESHACER LO DESTAPÓ EL RECORRIDO DE PUNTA A PUNTA.</b> El
   * `<input>` no está atado a ninguna señal: `[checked]` solo se reescribe cuando el valor ATADO
   * cambia, y al fallar la petición ese valor sigue siendo `pendiente`, así que Angular no vuelve a
   * escribirlo y la casilla se queda marcada. Una marca que dice «ya lo corregí» sobre algo que el
   * servidor nunca recibió es lo contrario de la trazabilidad que este circuito existe para dar.
   *
   * <b>VIVE EN EL ALMACÉN Y NO EN LAS DOS PLANTILLAS</b> que pintan casillas —la nota pegada al
   * campo y el resumen de cada paso—: escrito dos veces, la segunda copia se queda sin el deshacer
   * y nadie lo nota, porque solo se ve cuando el servidor falla.
   */
  atender(observacionId: number, casilla: { checked: boolean }): void {
    const querida = casilla.checked;
    const llamar = this.alAtender;
    if (!llamar) {
      casilla.checked = !querida;
      return;
    }
    this.error.set('');
    llamar(observacionId, querida).subscribe({
      next: nota => this.marcarAtendida(nota.id, nota.estado === 'atendida', nota.fechaAtencion),
      error: (fallo: { message?: string }) => {
        casilla.checked = !querida;
        this.error.set(fallo?.message ?? 'No fue posible marcar el cambio');
      },
    });
  }

  readonly esRevision = computed(() => this.modo() === 'revision');
  readonly esAtencion = computed(() => this.modo() === 'atencion');

  /** Cuántos campos llevan nota. Es el número del botón de enviar. */
  readonly cuantasNotas = computed(() => this.notas().length);

  /** Cuántas quedan sin atender. En modo revisión coincide con el total: nacen pendientes. */
  readonly cuantasPendientes = computed(() => this.notas().filter(nota => nota.estado === 'pendiente').length);

  readonly hayNotas = computed(() => this.notas().length > 0);

  seleccionarNota(nota: ObservacionDeCampo): void {
    this.notaSeleccionadaId.set(nota.id);
    this.alSeleccionarNota?.(nota);
  }

  /** La solicitud ya salió hacia la organización: el funcionario no puede seguir escribiendo. */
  readonly yaEnviada = computed(() => this.revision()?.estado === 'enviada');

  /**
   * Deja el almacén con lo que acaba de decir el servidor.
   *
   * <b>PISA EL BORRADOR VIVO A PROPÓSITO.</b> Se llama al abrir la ficha y después de guardar; en
   * los dos casos lo que hay en el servidor es más nuevo que lo que hay en pantalla. Conservar lo
   * de pantalla dejaría notas fantasma: escritas, no guardadas, y con aspecto de guardadas.
   */
  sembrar(revision: RevisionDeCampos | null, registroId: string, registroNombre = ''): void {
    const llegada = revision ?? revisionVacia(registroId, registroNombre);
    this.revision.set(llegada);
    this.notas.set(llegada.observaciones.map(nota => ({ ...nota })));
    this.sinGuardar.set(false);
    this.campoEnEdicion.set(null);
  }

  /** La nota de un campo, si la hay. */
  nota(campoId: string): ObservacionDeCampo | undefined {
    const llave = llaveDelCampo(campoId);
    return this.notas().find(nota => this.llaveDe(nota) === llave);
  }

  tieneNota(campoId: string): boolean {
    return this.nota(campoId) !== undefined;
  }

  cambioDelEnvio(campoId: string) {
    return this.comparacionEnvios()?.cambios.find(cambio => cambio.campoId === campoId);
  }

  /**
   * Escribe o corrige la nota de un campo.
   *
   * <b>UN TEXTO VACÍO LA RETIRA</b>, y no es un atajo: es como se quita una nota desde la pantalla.
   * El servidor hace lo mismo con lo que le llega vacío, así que las dos mitades dicen la regla
   * igual y no hay una que la olvide.
   */
  escribir(campo: { campoId: string; seccionId: string; campoEtiqueta: string; valorObservado: string | null }, texto: string): void {
    const limpio = texto.trim();
    if (!limpio) {
      this.quitar(campo.campoId);
      return;
    }

    const llave = llaveDelCampo(campo.campoId);
    const anterior = this.notas().find(nota => this.llaveDe(nota) === llave);

    const nueva: ObservacionDeCampo = {
      id: anterior?.id ?? 0,
      ambito: 'principal',
      subregistroId: null,
      seccionId: campo.seccionId,
      campoId: campo.campoId,
      campoEtiqueta: campo.campoEtiqueta,
      valorObservado: campo.valorObservado,
      nota: limpio,
      // AL REESCRIBIR VUELVE A PENDIENTE: el texto es otro, así que lo que la organización dio por
      // atendido ya no vale. Es la misma regla que aplica el servidor al guardar.
      estado: anterior && anterior.nota === limpio ? anterior.estado : 'pendiente',
      fechaAtencion: anterior && anterior.nota === limpio ? anterior.fechaAtencion : null,
    };

    this.notas.update(notas => anterior
      ? notas.map(nota => (this.llaveDe(nota) === llave ? nueva : nota))
      : [...notas, nueva]);
    this.sinGuardar.set(true);
    this.versionDelBorrador.update(version => version + 1);
    this.campoEnEdicion.set(null);
  }

  quitar(campoId: string): void {
    const llave = llaveDelCampo(campoId);
    if (!this.notas().some(nota => this.llaveDe(nota) === llave)) {
      this.campoEnEdicion.set(null);
      return;
    }
    this.notas.update(notas => notas.filter(nota => this.llaveDe(nota) !== llave));
    this.sinGuardar.set(true);
    this.versionDelBorrador.update(version => version + 1);
    this.campoEnEdicion.set(null);
  }

  /** La marca que pone la organización cuando ya corrigió un punto. */
  marcarAtendida(observacionId: number, atendida: boolean, fechaAtencion: string | null): void {
    this.notas.update(notas => notas.map(nota => nota.id === observacionId
      ? { ...nota, estado: atendida ? 'atendida' : 'pendiente', fechaAtencion }
      : nota));
  }

  /**
   * Las notas de un grupo de secciones, para el resumen que va encima de cada paso.
   *
   * RECIBE VARIAS SECCIONES porque un paso agrupa dos: «Organización» son «Organizador» y «Fuente
   * de financiación». Pedir sección a sección obligaría a la plantilla a unir las listas.
   */
  notasDe(seccionIds: readonly string[]): ObservacionDeCampo[] {
    return this.notas().filter(nota => seccionIds.includes(nota.seccionId));
  }

  cuantasEn(seccionIds: readonly string[]): number {
    return this.notasDe(seccionIds).length;
  }

  /** Las que quedan sin atender en un grupo de secciones. Es lo que pinta el distintivo del paso. */
  cuantasPendientesEn(seccionIds: readonly string[]): number {
    return this.notasDe(seccionIds).filter(nota => nota.estado === 'pendiente').length;
  }

  /**
   * El cuerpo que se manda al servidor.
   *
   * <b>VAN TODAS, INCLUIDAS LAS DE OTROS PERFILES VERSIONADOS.</b> El PUT reemplaza la lista entera,
   * así que mandar solo las del perfil abierto borraría en silencio las demás.
   */
  paraGuardar(observacionGeneral: string | null): GuardarRevisionSolicitud {
    return {
      observacionGeneral: observacionGeneral?.trim() || null,
      observaciones: this.notas().map(nota => ({
        ambito: nota.ambito,
        subregistroId: nota.subregistroId,
        seccionId: nota.seccionId,
        campoId: nota.campoId,
        campoEtiqueta: nota.campoEtiqueta,
        valorObservado: nota.valorObservado,
        nota: nota.nota,
      })),
    };
  }

  private llaveDe(nota: ObservacionDeCampo): string {
    return llaveDelCampo(nota.campoId);
  }
}
