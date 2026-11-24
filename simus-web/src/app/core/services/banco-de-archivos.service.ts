import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { TestigoDeLaConsolaService } from './testigo-de-la-consola.service';

/**
 * El banco de archivos: subir una imagen una vez y vincularla desde donde haga falta.
 *
 * <b>POR QUE EXISTE.</b> Los tres paneles de alta —Agenda, Noticias y Catálogo Editorial— pedían
 * la imagen como una RUTA QUE ALGUIEN TECLEABA. Eso no es subir un archivo: es confiar en que el
 * fichero ya esté puesto en el sitio correcto y bien escrito. El banco lo sube de verdad, valida
 * los bytes por su firma y exige el texto alternativo antes de aceptarlo.
 */

export interface ArchivoDelBanco {
  /** Si la imagen ya estaba y se le aplicó la descripción nueva (D5-06). */
  descripcionActualizada?: boolean;
  /** Lo que se le dice a la persona cuando se reutilizó una imagen suya. */
  aviso?: string;
  id: number;
  nombre: string;
  tipo: string;
  bytes: number | null;
  alt: string | null;
  pie: string | null;
  credito: string | null;
  ancho: number | null;
  alto: number | null;
  /** La dirección de lectura, anónima. El identificador es el dato; esto es cómo se sirve. */
  url: string;
}

/** Dónde está usado un archivo, y si ese uso lo hace visible al público. */
export interface UsoDeArchivo { modulo: string; descripcion: string; esPublico: boolean }

/** Un archivo tal como lo enseña la gestión del banco: con su procedencia y con sus usos. */
export interface ArchivoEnElBanco extends ArchivoDelBanco {
  fechaCarga: string;
  /** `institucional`, `organizacion` o `persona` (foto de un perfil público). Es la procedencia, no quién lo subió. */
  procedencia: string;
  organizacionId: number | null;
  organizacionNombre: string | null;
  subidoPor: string | null;
  usos: UsoDeArchivo[];
  /** No lo usa nadie: ocupa espacio sin que nadie lo eche de menos. */
  huerfano: boolean;
  visiblePublicamente: boolean;
}

export interface PaginaDelBanco {
  items: ArchivoEnElBanco[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
  /** Solo en el canal externo: el tope de la organización y lo que lleva usado. */
  cuotaBytes: number | null;
  usadoBytes: number | null;
  /**
   * Lo que ningún lugar usa, en el alcance de esta consulta y NO solo en esta página: cuántos
   * archivos y cuánto pesan. Es la cifra del aviso del banco.
   */
  sinUsar?: { total: number; bytes: number };
}

/** Una parte del informe de almacenamiento: cuántos archivos y cuántos bytes. */
export interface ParteDelAlmacenamiento { clave: string; etiqueta: string; archivos: number; bytes: number }

/**
 * El informe de almacenamiento del banco (`docs/operacion/28-tabla-de-retencion-documental.md` §28.14): solo lectura y solo para la consola.
 * Mide el banco y no el resto de la base, así que el porcentaje del tope es un mínimo.
 */
export interface InformeDeAlmacenamiento {
  generadoEn: string;
  total: { archivos: number; bytes: number };
  tope: {
    /** `null` si el entorno no trae tope: entonces solo hay cifra, sin porcentaje. */
    bytes: number | null; fraccionUsada: number | null; umbralDeAtencion: number; umbralDeAlarma: number;
    /** `normal` (menos del 80 %), `atencion` (del 80 al 90 %), `alarma` (desde el 90 %) o `sinTope`. */
    nivel: 'normal' | 'atencion' | 'alarma' | 'sinTope'; soloMideElBanco: boolean;
  };
  /** Con los últimos doce meses: cuándo se llegaría al umbral de alarma. `null` sin tope. */
  proyeccion?: { bytesPorMes: number; mesesHastaElUmbral: number | null; avisaDeLlegadaPronta: boolean } | null;
  /** Los medios del sitio (`dbo.MediosWeb`): bytes de la misma base que no son del Banco y no suman al total. */
  mediosDelSitio?: { medios: number; bytes: number };
  porProcedencia: ParteDelAlmacenamiento[];
  porTipo: { tipo: string; archivos: number; bytes: number }[];
  porAntiguedad: ParteDelAlmacenamiento[];
  sinUsar: { archivos: number; bytes: number };
  repetidos: { copiasSobrantes: number; bytes: number };
  organizacionesQueMasPesan: { organizacionId: number; nombre: string | null; archivos: number; bytes: number; cuotaBytes: number; fraccionDeLaCuota: number }[];
  crecimientoMensual: { mes: string; archivos: number; bytes: number }[];
}

export interface ResultadoDeSubida {
  ok: boolean;
  archivo?: ArchivoDelBanco;
  error?: string;
  /** «Ya tenías esta imagen; actualicé su descripción»: la subida se reutilizó, no se creó otra. */
  aviso?: string;
}

@Injectable({ providedIn: 'root' })
export class BancoDeArchivosService {
  private readonly api = inject(ApiClientService);
  private readonly testigoDeLaConsola = inject(TestigoDeLaConsolaService);

  /**
   * El testigo de seguridad de una escritura, del canal por el que se escribe.
   *
   * <b>SUBIR Y RETIRAR PIDEN EL TESTIGO</b>, igual que las demás escrituras: sin él el servidor
   * responde «no pudo validarse». Se pide justo antes de escribir, para no mandar uno vencido. La
   * consola y el portal de las organizaciones lo entregan por rutas distintas porque sus sesiones
   * lo son.
   */
  private async cabeceras(canal: 'institucional' | 'externo'): Promise<Record<string, string>> {
    if (canal !== 'externo') { return this.testigoDeLaConsola.cabeceras(); }
    const testigo = await firstValueFrom(
      this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {}));
    return { 'X-CSRF-TOKEN': testigo.requestToken };
  }

  /**
   * Sube una imagen al banco.
   *
   * EL TEXTO ALTERNATIVO VIAJA CON LOS BYTES y no se pide después: separarlos es como se llega a
   * publicar la imagen y olvidar la descripción. El servidor lo exige antes incluso de mirar si el
   * archivo es una imagen válida.
   */
  async subirImagen(
    archivo: File,
    alt: string,
    extras: { pie?: string; credito?: string; canal?: 'institucional' | 'externo' } = {},
  ): Promise<ResultadoDeSubida> {
    const cuerpo = new FormData();
    cuerpo.append('file', archivo, archivo.name);
    cuerpo.append('alt', alt);
    if (extras.pie) { cuerpo.append('caption', extras.pie); }
    if (extras.credito) { cuerpo.append('credit', extras.credito); }

    try {
      // LA MISMA SUBIDA POR DOS PUERTAS, y la diferencia está en el servidor, no aquí. La ruta
      // externa pone dos guardas que la institucional no necesita —correo confirmado y cuota por
      // organización— y delega en el MISMO manejador: la cadena que valida el formato por su firma
      // es una sola. Por eso este servicio solo elige a dónde llama.
      const ruta = extras.canal === 'externo'
        ? '/api/v1/externo/archivos'
        : '/api/v1/institucional/archivos';
      const headers = await this.cabeceras(extras.canal === 'externo' ? 'externo' : 'institucional');
      const subido = await firstValueFrom(
        this.api.postForm<ArchivoDelBanco>(ruta, cuerpo, { headers }));
      return { ok: true, archivo: subido, aviso: subido.descripcionActualizada ? subido.aviso : undefined };
    } catch (error: unknown) {
      // El motivo del servidor entero: dice si falta la alternativa, si el peso se pasa o si eso
      // no es una imagen, y cada uno se corrige de una manera distinta.
      const cuerpoDelError = (error as { payload?: unknown })?.payload;
      if (cuerpoDelError && typeof cuerpoDelError === 'object') {
        for (const valor of Object.values(cuerpoDelError as Record<string, unknown>)) {
          if (Array.isArray(valor)) {
            const mensaje = valor.find(m => typeof m === 'string' && m.trim().length > 0);
            if (typeof mensaje === 'string') { return { ok: false, error: mensaje.trim() }; }
          }
        }
      }
      return { ok: false, error: 'No fue posible subir el archivo.' };
    }
  }

  /**
   * Sube un PDF al banco.
   *
   * <b>POR EL CANAL EXTERNO, PARA LOS SOPORTES DE UNA SOLICITUD:</b> un acta o un
   * certificado. Un documento no lleva texto alternativo —se abre, no se describe—; el servidor lo
   * reconoce por su contenido y le aplica el correo confirmado y la cuota de la organización.
   */
  async subirDocumento(archivo: File, canal: 'institucional' | 'externo' = 'externo'): Promise<ResultadoDeSubida> {
    const cuerpo = new FormData();
    cuerpo.append('file', archivo, archivo.name);
    try {
      const ruta = canal === 'externo' ? '/api/v1/externo/archivos/documentos' : '/api/v1/institucional/archivos/documentos';
      const headers = await this.cabeceras(canal);
      const subido = await firstValueFrom(this.api.postForm<ArchivoDelBanco>(ruta, cuerpo, { headers }));
      return { ok: true, archivo: subido };
    } catch (error: unknown) {
      const cuerpoDelError = (error as { payload?: unknown })?.payload;
      if (cuerpoDelError && typeof cuerpoDelError === 'object') {
        // EL 409 DEL CANAL EXTERNO DICE QUÉ FALTA Y QUÉ HACER: correo sin confirmar o cuota agotada.
        const { message: mensajeDirecto, queFalta, queHacer } = cuerpoDelError as { message?: unknown; queFalta?: unknown; queHacer?: unknown };
        if (typeof queFalta === 'string' && queFalta.trim()) {
          return { ok: false, error: [queFalta, queHacer].filter(t => typeof t === 'string' && t.trim()).join(' ') };
        }
        if (typeof mensajeDirecto === 'string' && mensajeDirecto.trim()) { return { ok: false, error: mensajeDirecto.trim() }; }
        for (const valor of Object.values(cuerpoDelError as Record<string, unknown>)) {
          if (Array.isArray(valor)) {
            const mensaje = valor.find(m => typeof m === 'string' && m.trim().length > 0);
            if (typeof mensaje === 'string') { return { ok: false, error: mensaje.trim() }; }
          }
        }
      }
      return { ok: false, error: 'No fue posible subir el documento.' };
    }
  }

  /**
   * Lo que hay en el banco.
   *
   * <b>DOS CANALES, UNA SOLA FIRMA.</b> La consola ve el banco entero con su procedencia; una
   * organización ve lo suyo y su cuota. El servidor decide qué devuelve según por dónde se
   * pregunta, así que aquí lo único que cambia es la ruta.
   */
  async listar(canal: 'institucional' | 'externo', opciones: {
    procedencia?: string; soloHuerfanos?: boolean; pagina?: number; tamano?: number;
  } = {}): Promise<{ ok: boolean; data?: PaginaDelBanco; error?: string }> {
    const params = new URLSearchParams();
    if (opciones.procedencia) { params.set('procedencia', opciones.procedencia); }
    if (opciones.soloHuerfanos) { params.set('soloHuerfanos', 'true'); }
    if (opciones.pagina) { params.set('pagina', String(opciones.pagina)); }
    if (opciones.tamano) { params.set('tamano', String(opciones.tamano)); }
    const ruta = `/api/v1/${canal === 'externo' ? 'externo' : 'institucional'}/archivos?${params.toString()}`;
    try {
      const data = await firstValueFrom(this.api.get<PaginaDelBanco>(ruta, {}));
      return { ok: true, data };
    } catch (fallo: unknown) {
      // UN 403 POR EL CANAL EXTERNO TIENE UN SOLO SIGNIFICADO, y merece decirse. El servidor
      // responde eso cuando la cuenta no responde por ninguna organización; sin traducirlo, la
      // pantalla enseñaba el texto de último recurso del cliente HTTP y la persona no tenía forma
      // de saber que lo que le falta es estar vinculada a una organización.
      if (canal === 'externo' && (fallo as { status?: number })?.status === 403) {
        return { ok: false, error: 'Tu cuenta todavía no está vinculada a ninguna organización, así que aún no hay archivos que mostrar.' };
      }
      return { ok: false, error: (fallo as { message?: string })?.message ?? 'No fue posible consultar el banco de archivos.' };
    }
  }

  /**
   * Retira un archivo del banco.
   *
   * SOLO SI NO LO USA NADIE, y quien decide eso es el servidor: seis tablas pueden apuntar a un
   * archivo y comprobarlo aquí sería comprobarlo a medias. Si está en uso responde 409 con la
   * lista de dónde, que es lo que hay que enseñar.
   */
  async retirar(canal: 'institucional' | 'externo', id: number): Promise<{ ok: boolean; error?: string; usos?: string[] }> {
    const ruta = `/api/v1/${canal === 'externo' ? 'externo' : 'institucional'}/archivos/${id}`;
    try {
      const headers = await this.cabeceras(canal);
      await firstValueFrom(this.api.delete<void>(ruta, { headers }));
      return { ok: true };
    } catch (fallo: unknown) {
      const cuerpo = fallo as { message?: string; usos?: string[] };
      return { ok: false, error: cuerpo?.message ?? 'No fue posible retirar el archivo.', usos: cuerpo?.usos };
    }
  }

  /** El informe de almacenamiento (consola). No borra ni mueve nada: solo cuenta. */
  async informeDeAlmacenamiento(): Promise<{ ok: boolean; data?: InformeDeAlmacenamiento; error?: string }> {
    try {
      const data = await firstValueFrom(this.api.get<InformeDeAlmacenamiento>('/api/v1/institucional/archivos/almacenamiento', {}));
      return { ok: true, data };
    } catch (fallo: unknown) {
      return { ok: false, error: (fallo as { message?: string })?.message ?? 'No fue posible consultar el almacenamiento.' };
    }
  }
}
