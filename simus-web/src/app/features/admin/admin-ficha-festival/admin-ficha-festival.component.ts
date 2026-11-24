import { CommonModule } from '@angular/common';
import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { DialogoDePrevisualizacionComponent } from '../../../shared/components/previsualizacion-en-listado/dialogo-de-previsualizacion.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { FormsModule } from '@angular/forms';
import { Component, EventEmitter, Input, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Output } from '@angular/core';
import { ApiClientService } from '../../../core/http/api-client.service';
import { TestigoDeLaConsolaService } from '../../../core/services/testigo-de-la-consola.service';
import { ProcedenciaDeRegistro } from '../../../core/services/procedencia';
import { ElementoDeClasificacion } from '../../../core/services/clasificacion-de-contenido.service';
import { SelloDeProcedenciaComponent } from '../../../shared/components/ui/sello-de-procedencia/sello-de-procedencia.component';
import { HistorialDeRegistroComponent } from '../../../shared/components/ui/historial-de-registro/historial-de-registro.component';
import { TABLA_DE_AUDITORIA } from '../../../core/services/historial-de-registro.service';
import { EntradaDeHistorialDeEstados } from '../../../shared/components/ui/historial-de-estados/historial-de-estados.component';
import { NombrePropioPipe } from '../../../shared/texto/nombre-propio.pipe';
import { DialogoDeFormularioComponent } from '../../../shared/components/ui/dialogo-de-formulario/dialogo-de-formulario.component';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { DatoEnLecturaComponent } from '../../../shared/components/ui/dato-en-lectura/dato-en-lectura.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { PanelLateralComponent } from '../../../shared/components/ui/panel-lateral/panel-lateral.component';
import { etiquetaDeEstado } from '../domain/admin-config';
import { AdminEditionReviewPanelComponent } from '../admin-edition-review-panel.component';
import { etiquetaDePeriodicidad } from '../../../core/vocabularios/periodicidad';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';

/**
 * La ficha de un Festival en la consola, con sus Ediciones dentro.
 *
 * <b>EL FESTIVAL ES LA ENTIDAD PRINCIPAL Y LAS EDICIONES CUELGAN DE ÉL.</b> No son un módulo
 * equivalente: son el historial de realizaciones de ese Festival. Presentarlas al mismo nivel
 * sugiere que son cosas comparables y lleva a construir dos altas paralelas en vez de una anidada
 * en la otra.
 *
 * <b>LO QUE FALTABA.</b> La consola listaba Festivales y llevaba a la bandeja de revisión, pero no
 * había forma de abrir uno y ver qué es: sus datos permanentes, quién responde por él, de dónde
 * vino y qué ediciones tiene. Eso vivía solo en el panel de la organización.
 *
 * <b>NO DUPLICA EL CIRCUITO DE REVISIÓN.</b> Publicar o supervisar una Edición sigue donde estaba.
 * Esta es la vista que faltaba, no una segunda administración.
 */

export interface EdicionDelFestival {
  id: string;
  anio: number | null;
  numeroEdicion: number | null;
  nombre: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estadoVisibilidad: string;
  procedencia: ProcedenciaDeRegistro | null;
}

export interface FichaFestivalAdministrativa {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  nivelCobertura: string;
  departamento: string | null;
  municipio: string | null;
  periodicidad: string | null;
  correoContacto: string | null;
  telefono: string | null;
  sitioWeb: string | null;
  organizacionResponsableId: number | null;
  organizacionResponsableNombre: string | null;
  procedencia: ProcedenciaDeRegistro | null;
  practicasMusicales: ElementoDeClasificacion[];
  territoriosSonoros: ElementoDeClasificacion[];
  ediciones: EdicionDelFestival[];
  fechaCreacion: string;
  fechaActualizacion: string | null;
  /** En custodia del Programa: un registro histórico que todavía ninguna organización administra. */
  esRegistroHistorico?: boolean;
  /** Si otra copia lo absorbió al fusionar duplicados, cuál. */
  fusionadoEnId?: string | null;
  fusionadoEnNombre?: string | null;
  /** Las copias que este absorbió. */
  absorbidos?: { id: string; nombre: string; fechaFusion: string | null }[] | null;
}

/** Otra copia del mismo Festival histórico, con lo que impediría fusionarla. */
export interface CandidatoDeFusion {
  id: string;
  nombre: string;
  estado: string;
  nombreMunicipio: string | null;
  nombreDepartamento: string | null;
  aniosDeEdiciones: number[];
  ediciones: number;
  reclamacionAbiertaDe: string | null;
  reclamacionAbiertaEstado: string | null;
  parecido: boolean;
  codigoBloqueo: string | null;
  bloqueo: string | null;
  /** Por qué se propone esta copia: qué palabras del nombre coinciden. */
  razonDelParecido?: string | null;
}

export interface CandidatosDeFusion {
  festivalId: string;
  nombre: string;
  codigoBloqueo: string | null;
  bloqueo: string | null;
  candidatos: CandidatoDeFusion[];
}

/** Una de las dos copias que se comparan antes de fusionar (T2). */
export interface CopiaComparada {
  id: string;
  nombre: string;
  estado: string;
  nombreMunicipio: string | null;
  nombreDepartamento: string | null;
  aniosDeEdiciones: number[];
  ediciones: number;
}

/**
 * Qué hará la fusión con un dato (T2): `igual` (las dos dicen lo mismo), `conserva` (se queda lo de
 * este Festival), `completa` (le falta y se completa con la copia), `une` (se suman las listas) o
 * `vacio` (ninguna lo tiene).
 */
export type ResultadoDeUnCampo = 'igual' | 'conserva' | 'completa' | 'une' | 'vacio';

export interface CampoComparado {
  clave: string;
  etiqueta: string;
  enLoQueSeConserva: string | null;
  enLaCopia: string | null;
  resultado: ResultadoDeUnCampo;
  quedaAsi: string | null;
}

/** Lo que cuelga de la copia y pasará al Festival que se conserva. */
export interface TrasladoDeFusion {
  ediciones: number;
  mercados: number;
  eventos: number;
  archivos: number;
  clasificaciones: number;
  reclamaciones: number;
  aniosEnLasDos: number[];
}

/** Las dos copias lado a lado, con lo que la fusión haría con cada dato (T2). */
export interface ComparacionDeCopias {
  conservado: CopiaComparada;
  absorbido: CopiaComparada;
  campos: CampoComparado[];
  traslado: TrasladoDeFusion;
  codigoBloqueo: string | null;
  bloqueo: string | null;
}

/** El estado del diálogo de fusión. */
export interface FormularioDeFusion {
  candidatos: CandidatosDeFusion | null;
  elegido: string | null;
  motivo: string;
  numero: string;
  cargando: boolean;
  /** La comparación de la copia elegida, o `null` mientras se lee. */
  comparacion: ComparacionDeCopias | null;
  comparando: boolean;
  /** Si la persona confirmó que entiende lo que la fusión no deshace. */
  entendido: boolean;
}

/** Lo que se movió al Festival que se conserva. */
export interface ResultadoDeFusion {
  festivalId: string;
  absorbidoId: string;
  ediciones: number;
  mercados: number;
  eventos: number;
  archivos: number;
  clasificaciones: number;
  reclamaciones: number;
  datosCompletados: string[];
}

/** Cómo se lee cada estado de visibilidad de una Edición. */
const ETIQUETAS_DE_EDICION: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  publicada: 'Publicada',
  retirada: 'Retirada',
};

@Component({
  selector: 'app-admin-ficha-festival',
  standalone: true,
  imports: [FechaPipe, BotonComponent, DatoEnLecturaComponent, EstadoDeListaComponent, PanelLateralComponent, NombrePropioPipe, CommonModule, FormsModule, SelloDeProcedenciaComponent, IndicadorDeEstadoComponent,
    DialogoDePrevisualizacionComponent, HistorialDeRegistroComponent, DialogoDeFormularioComponent, AdminEditionReviewPanelComponent],
  templateUrl: './admin-ficha-festival.component.html',
})
export class AdminFichaFestivalComponent {
  /** El tono y el matiz del indicador, desde el criterio único del proyecto. */
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  private readonly api = inject(ApiClientService);
  private readonly testigo = inject(TestigoDeLaConsolaService);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);
  private readonly nombrePropio = new NombrePropioPipe();

  /**
   * Quién ha tocado este Festival, con la misma pieza que Noticias, Agenda y Catálogo.
   *
   * <b>ANTES NO SE PODIA SABER.</b> `TABLA_DE_AUDITORIA` ya declaraba `festivales: 'Festivales'`
   * y la bitácora venía registrando cada actuación, pero ninguna pantalla la abría: el dato
   * existía y era inalcanzable. Es justo la pregunta que sostiene la procedencia —quién lo
   * incorporó, quién lo cambió y cuándo— sobre la entidad principal del Ecosistema.
   */
  readonly historialAbierto = signal(false);

  /**
   * Los estados y sus motivos, con la pieza compartida de: de qué estado a cuál, quién,
   * cuándo y por qué, para el Festival y sus Ediciones. `null` si la consulta falló.
   */
  readonly estadosDelHistorial = signal<EntradaDeHistorialDeEstados[] | null | undefined>(undefined);
  readonly cargandoEstados = signal(false);

  abrirHistorial(): void {
    this.historialAbierto.set(true);
    const ficha = this.ficha();
    if (ficha) void this.cargarEstados(ficha.id);
  }

  private async cargarEstados(id: string | number): Promise<void> {
    this.cargandoEstados.set(true);
    this.estadosDelHistorial.set(undefined);
    try {
      this.estadosDelHistorial.set(await firstValueFrom(
        this.api.get<EntradaDeHistorialDeEstados[]>(`/api/v1/institucional/festivales/${id}/historial`, {})) ?? []);
    } catch {
      this.estadosDelHistorial.set(null);
    } finally {
      this.cargandoEstados.set(false);
    }
  }

  /**
   * El estado con su nombre —«En revisión»— y no su código —«en_revision»—, que es lo que se leía
   * antes. Usa el ayudante compartido, que además humaniza cualquier código que no esté en la tabla.
   */
  readonly etiquetaDeEstado = etiquetaDeEstado;

  nombresDe(elementos: readonly { nombre: string }[]): string {
    return elementos.map(e => e.nombre).join(', ');
  }
  readonly tablaDeAuditoria = TABLA_DE_AUDITORIA.festivales;

  @Output() cerrar = new EventEmitter<void>();

  /**
   * Si quien mira puede publicar.
   *
   * <b>SOLO EL WEBMASTER.</b> Lo decidió la dirección: un Festival que el propio Programa incorporó
   * no tiene a quién esperar, y obligarlo a recorrer una bandeja donde el revisor y el registrador
   * son la misma persona convierte el circuito en un trámite vacío. El servidor lo comprueba
   * igual; esto solo evita ofrecer un botón que va a devolver un 403.
   */
  @Input() puedePublicar = false;
  /** Pide abrir la ficha de la organización responsable, que vive en otra sección. */
  @Output() verOrganizacion = new EventEmitter<number>();

  /** Si se está mirando cómo quedará este Festival en el listado público. */
  readonly previsualizando = signal(false);

  readonly ficha = signal<FichaFestivalAdministrativa | null>(null);
  /** La periodicidad se lee por su nombre, no por su código: «otra_regular» no es una palabra. */
  readonly etiquetaDePeriodicidad = etiquetaDePeriodicidad;

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly etiquetasDeEdicion = ETIQUETAS_DE_EDICION;

  /* El codigo nunca sale a pantalla: el respaldo era `|| codigo`. */
  rotuloDeEdicion(codigo: string | null | undefined): string {
    return this.etiquetasDeEdicion[(codigo ?? '').trim()] ?? etiquetaDeEstado(codigo);
  }
  readonly publicando = signal(false);
  readonly avisoDePublicacion = signal<string | null>(null);

  /**
   * La edición publicada que se está observando, o `null`.
   *
   * <b>LA SUPERVISIÓN POSTERIOR VIVE AQUÍ, NO EN LA BANDEJA (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1 decisión 13).</b>
   * La organización publica sus ediciones sin revisión del Programa. La bandeja las listaba ya
   * publicadas como «Edición en revisión»; ahora el Programa las observa, si hace falta,
   * desde la ficha del Festival al que pertenecen.
   */
  readonly edicionObservada = signal<{ id: string; nombre: string } | null>(null);

  observarEdicion(edicion: EdicionDelFestival): void {
    this.avisoDePublicacion.set(null);
    this.edicionObservada.set({
      id: String(edicion.id),
      nombre: edicion.nombre || (edicion.anio ? `Edición ${edicion.anio}` : 'Edición sin nombre'),
    });
  }

  cerrarObservacion(): void { this.edicionObservada.set(null); }

  alEnviarObservacion(): void {
    this.edicionObservada.set(null);
    this.avisoDePublicacion.set('Las observaciones se enviaron a la organización. La edición sigue publicada.');
  }

  /**
   * La fusión de duplicados abierta (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1 decisión 18), o `null`.
   *
   * <b>SE CONSERVA ESTE FESTIVAL</b> y se elige la copia que se absorbe. El servidor dice qué
   * copias hay y por qué alguna no se puede fusionar —ya tiene organización, las dos tienen
   * solicitudes abiertas, la conciliación está a medias—; aquí se enseña en vez de ofrecer un
   * botón que va a responder 409.
   */
  readonly fusion = signal<FormularioDeFusion | null>(null);

  async abrirFusion(con?: string): Promise<void> {
    const ficha = this.ficha();
    if (!ficha) { return; }
    this.avisoDePublicacion.set(null);
    this.error.set(null);
    const previo = this.fusion();
    this.fusion.set({
      candidatos: previo?.candidatos ?? null, elegido: previo?.elegido ?? null, motivo: previo?.motivo ?? '',
      numero: previo?.numero ?? '', cargando: true,
      comparacion: previo?.comparacion ?? null, comparando: false, entendido: previo?.entendido ?? false,
    });
    try {
      const ruta = `/api/v1/admin/festivales/${ficha.id}/fusion/candidatos${con ? '?con=' + encodeURIComponent(con) : ''}`;
      const candidatos = await firstValueFrom(this.api.get<CandidatosDeFusion>(ruta, {}));
      const elegido = con && candidatos.candidatos.some(c => c.id === con && !c.codigoBloqueo) ? con : this.fusion()?.elegido ?? null;
      this.fusion.update(f => f ? { ...f, candidatos, cargando: false, elegido } : f);
      // SI SE ELIGIÓ UNA COPIA POR SU NÚMERO, SE COMPARA EN EL ACTO: la persona no tiene que volver a marcarla.
      if (con && elegido === con) { void this.compararCon(con); }
    } catch (fallo: unknown) {
      this.fusion.set(null);
      this.error.set(this.motivoDelServidor(fallo) ?? 'No fue posible consultar las copias de este Festival.');
    }
  }

  cambiarFusion(cambio: Partial<{ elegido: string | null; motivo: string; numero: string; entendido: boolean }>): void {
    const anterior = this.fusion()?.elegido ?? null;
    this.fusion.update(f => f ? { ...f, ...cambio } : f);
    // OTRA COPIA, OTRA COMPARACIÓN: lo confirmado sobre la anterior no vale para la nueva.
    if ('elegido' in cambio && cambio.elegido !== anterior) {
      this.fusion.update(f => f ? { ...f, comparacion: null, entendido: false } : f);
      if (cambio.elegido) { void this.compararCon(cambio.elegido); }
    }
  }

  /**
   * Lee cómo quedarían las dos copias (T2): lado a lado, qué se conserva, qué se completa y qué
   * pasa a este Festival. Solo lee: no cambia nada hasta que se confirma la fusión.
   */
  async compararCon(absorbidoId: string): Promise<void> {
    const ficha = this.ficha();
    if (!ficha) { return; }
    this.fusion.update(f => f ? { ...f, comparando: true, comparacion: null } : f);
    try {
      const comparacion = await firstValueFrom(this.api.get<ComparacionDeCopias>(
        `/api/v1/admin/festivales/${ficha.id}/fusion/comparar?con=${encodeURIComponent(absorbidoId)}`, {}));
      // SI MIENTRAS TANTO ELIGIÓ OTRA COPIA, ESTA RESPUESTA YA NO LE SIRVE.
      this.fusion.update(f => f && f.elegido === absorbidoId ? { ...f, comparacion, comparando: false } : f);
    } catch (fallo: unknown) {
      this.fusion.update(f => f && f.elegido === absorbidoId ? { ...f, comparando: false } : f);
      this.error.set(this.motivoDelServidor(fallo) ?? 'No fue posible comparar las dos copias.');
    }
  }

  /** Si se puede confirmar la fusión: copia elegida, comparada, con motivo y entendida. */
  puedeFusionar(f: FormularioDeFusion): boolean {
    return !!f.elegido && !!f.motivo.trim() && !f.candidatos?.codigoBloqueo
      && !!f.comparacion && !f.comparacion.codigoBloqueo && f.entendido;
  }

  /** Cómo se lee un dato en la comparación: el estado y la periodicidad con su vocabulario. */
  valorComparado(campo: CampoComparado, valor: string | null): string {
    if (!valor) { return 'Sin dato'; }
    if (campo.clave === 'estado') { return etiquetaDeEstado(valor); }
    if (campo.clave === 'periodicidad') { return etiquetaDePeriodicidad(valor); }
    // LA DIVIPOLA LLEGA EN MAYÚSCULAS («NEIVA»): se lee como en el resto de la ficha, «Neiva».
    if (campo.clave === 'departamento' || campo.clave === 'municipio') { return this.nombrePropio.transform(valor); }
    return valor;
  }

  /** Lo que la fusión hará con ese dato, dicho con el verbo. */
  resultadoComparado(campo: CampoComparado): string {
    switch (campo.resultado) {
      case 'igual': return 'Es igual';
      case 'conserva': return 'Se queda el de este Festival';
      case 'completa': return 'Se completa con el de la copia';
      case 'une': return 'Se suman los de las dos';
      default: return 'Ninguna lo tiene';
    }
  }

  /** Los datos que difieren, primero; los que son iguales o están vacíos en las dos, aparte. */
  camposQueDifieren(cmp: ComparacionDeCopias): CampoComparado[] {
    return cmp.campos.filter(c => c.resultado !== 'igual' && c.resultado !== 'vacio');
  }

  camposIguales(cmp: ComparacionDeCopias): CampoComparado[] {
    return cmp.campos.filter(c => c.resultado === 'igual');
  }

  camposVacios(cmp: ComparacionDeCopias): number {
    return cmp.campos.filter(c => c.resultado === 'vacio').length;
  }

  /** Lo que pasa a este Festival, contado: «2 ediciones, 1 solicitud de administración». */
  resumenDeTraslado(t: TrasladoDeFusion): string {
    const partes = [
      t.ediciones ? `${t.ediciones} ${t.ediciones === 1 ? 'edición' : 'ediciones'}` : '',
      t.reclamaciones ? `${t.reclamaciones} ${t.reclamaciones === 1 ? 'solicitud de administración' : 'solicitudes de administración'}` : '',
      t.mercados ? `${t.mercados} ${t.mercados === 1 ? 'mercado' : 'mercados'}` : '',
      t.eventos ? `${t.eventos} ${t.eventos === 1 ? 'evento' : 'eventos'}` : '',
      t.archivos ? `${t.archivos} ${t.archivos === 1 ? 'archivo' : 'archivos'}` : '',
      t.clasificaciones ? `${t.clasificaciones} ${t.clasificaciones === 1 ? 'clasificación nueva' : 'clasificaciones nuevas'}` : '',
    ].filter(Boolean);
    return partes.join(', ');
  }

  /** «Antes» o «durante» una reclamación: lo que cambia es dónde queda la solicitud, no el gesto. */
  async fusionar(): Promise<void> {
    const ficha = this.ficha();
    const formulario = this.fusion();
    if (!ficha || !formulario?.elegido || !formulario.motivo.trim()) { return; }
    const absorbido = formulario.candidatos?.candidatos.find(c => c.id === formulario.elegido);
    this.publicando.set(true);
    this.error.set(null);
    try {
      const resultado = await firstValueFrom(this.api.post<ResultadoDeFusion>(
        `/api/v1/admin/festivales/${ficha.id}/fusion`, { absorbidoId: formulario.elegido, motivo: formulario.motivo.trim() },
        { headers: await this.testigo.cabeceras() }));
      this.fusion.set(null);
      this.avisoDePublicacion.set(this.resumenDeFusion(absorbido?.nombre ?? 'la otra copia', resultado));
      await this.cargar(ficha.id);
    } catch (fallo: unknown) {
      this.error.set(this.motivoDelServidor(fallo) ?? 'No fue posible fusionar los dos registros.');
      await this.abrirFusion();
    } finally {
      this.publicando.set(false);
    }
  }

  /** Lo que pasó, contado: qué se movió y qué datos se completaron. */
  resumenDeFusion(nombre: string, r: ResultadoDeFusion): string {
    const partes = [
      r.ediciones ? `${r.ediciones} ${r.ediciones === 1 ? 'edición' : 'ediciones'}` : '',
      r.reclamaciones ? `${r.reclamaciones} ${r.reclamaciones === 1 ? 'solicitud de administración' : 'solicitudes de administración'}` : '',
      r.mercados ? `${r.mercados} ${r.mercados === 1 ? 'mercado' : 'mercados'}` : '',
      r.eventos ? `${r.eventos} ${r.eventos === 1 ? 'evento' : 'eventos'}` : '',
      r.archivos ? `${r.archivos} ${r.archivos === 1 ? 'archivo' : 'archivos'}` : '',
    ].filter(Boolean);
    return `«${nombre}» quedó fusionado en este Festival y archivado.`
      + (partes.length ? ` Pasaron aquí: ${partes.join(', ')}.` : '')
      + (r.datosCompletados.length ? ` Se completó: ${r.datosCompletados.join(', ').toLowerCase()}.` : '');
  }

  /** «Manizales, Caldas», sin comas sueltas cuando falta una parte. */
  lugarDe(candidato: CandidatoDeFusion): string {
    return [candidato.nombreMunicipio, candidato.nombreDepartamento].filter(parte => !!parte).join(', ') || 'Sin territorio';
  }

  /** Abre otra ficha en este mismo cajón: la del Festival que absorbió a este. */
  abrirOtraFicha(id: string): void { void this.cargar(id); }

  /** El formulario de liberación, abierto o no. El motivo es obligatorio y por eso vive aquí. */
  readonly liberando = signal<{ motivo: string } | null>(null);

  @Input({ required: true }) set festivalId(id: string) { void this.cargar(id); }

  pedirLiberacion(): void {
    this.avisoDePublicacion.set(null);
    this.error.set(null);
    this.liberando.set({ motivo: '' });
  }

  cancelarLiberacion(): void { this.liberando.set(null); }

  motivoDeLiberacion(valor: string): void { this.liberando.set({ motivo: valor }); }

  /**
   * Devuelve el Festival a custodia del Programa para que otra organización pueda reclamarlo.
   *
   * <b>ES LA ALTERNATIVA A TOCAR CREDENCIALES.</b> Cuando nadie de la organización puede entrar, su
   * Festival se queda congelado: nadie lo edita y ninguna otra organización puede tomarlo, porque
   * el circuito de reclamación solo ofrece los que ya están en custodia. Esto no recupera el acceso
   * de nadie: desbloquea el proceso.
   */
  async liberar(): Promise<void> {
    const ficha = this.ficha();
    const formulario = this.liberando();
    if (!ficha || !formulario || !formulario.motivo.trim()) { return; }

    this.publicando.set(true);
    this.error.set(null);

    try {
      const respuesta = await firstValueFrom(this.api.post<{ reclamable: boolean }>(
        `/api/v1/admin/festivales/${ficha.id}/liberar-administracion`,
        { motivo: formulario.motivo.trim() },
        { headers: await this.testigo.cabeceras() }));
      this.liberando.set(null);
      this.avisoDePublicacion.set(respuesta?.reclamable
        ? 'El Festival volvió al PNMC y ya puede ser reclamado por otra organización.'
        : 'El Festival volvió al PNMC. Podrá ser reclamado cuando esté publicado.');
      await this.cargar(ficha.id);
    } catch (fallo: unknown) {
      // EL MOTIVO DEL SERVIDOR ENTERO. Aquí hay tres razones distintas por las que puede negarse
      // —ya está en custodia, falta la entidad institucional del Programa, no hay permiso— y un
      // «no fue posible» genérico deja a quien administra sin saber cuál de las tres arreglar.
      this.error.set(this.motivoDelServidor(fallo) ?? 'No fue posible devolver el Festival al PNMC.');
    } finally {
      this.publicando.set(false);
    }
  }

  /**
   * El mensaje que explica por qué el servidor dijo que no.
   *
   * SE MIRAN LAS DOS FORMAS en que el API responde un fallo: los errores por campo —una lista de
   * textos bajo el nombre del campo— y el `detail` de un problema HTTP, que es donde viaja el
   * aviso de que falta la entidad institucional.
   */
  private motivoDelServidor(fallo: unknown): string | null {
    const cuerpo = (fallo as { payload?: unknown })?.payload;
    if (!cuerpo || typeof cuerpo !== 'object') { return null; }

    const detalle = (cuerpo as { detail?: unknown }).detail;
    if (typeof detalle === 'string' && detalle.trim()) { return detalle.trim(); }

    for (const valor of Object.values(cuerpo as Record<string, unknown>)) {
      if (Array.isArray(valor)) {
        const mensaje = valor.find(m => typeof m === 'string' && m.trim().length > 0);
        if (typeof mensaje === 'string') { return mensaje.trim(); }
      }
    }
    return null;
  }

  /**
   * Publica, archiva o devuelve a borrador el Festival.
   *
   * TRES ESTADOS Y NO LOS SIETE: los demás —en revisión, ajustes solicitados, aprobado,
   * rechazado— pertenecen al circuito de revisión del canal externo, y escribirlos desde aquí
   * dejaría la bandeja diciendo cosas que nadie decidió en ella.
   */
  async cambiarPublicacion(estado: 'publicado' | 'archivado' | 'borrador'): Promise<void> {
    const ficha = this.ficha();
    if (!ficha) { return; }

    // LO PÚBLICO O LO QUE NO SE DESHACE SE CONFIRMA EN EL DIÁLOGO COMÚN. Un Festival
    // rechazado ofrecía «Publicar» como acción principal y revertía el rechazo de un clic, sin
    // decirlo ni mostrar por qué se rechazó: aquí se dice qué pasa y que revierte una decisión.
    if (estado !== 'borrador') {
      const rechazado = estado === 'publicado' && ficha.estado === 'rechazado';
      const respuesta = await this.confirmaciones.pedir(
        estado === 'archivado'
          ? {
              titulo: `Archivar «${ficha.nombre}»`,
              detalle: 'El Festival deja de verse en el portal y sale del trabajo diario. Conserva su historial y puede recuperarse.',
              accion: 'Archivar',
              tono: 'destructiva',
            }
          : {
              titulo: rechazado ? `Publicar «${ficha.nombre}», que fue rechazado` : `Publicar «${ficha.nombre}»`,
              detalle: rechazado
                ? 'El equipo rechazó este Festival. Publicarlo revierte esa decisión y lo hace visible en el portal. Revisa el motivo en el historial antes de seguir.'
                : 'El Festival será visible en el portal público. Podrás despublicarlo cuando quieras.',
              accion: 'Publicar',
              tono: rechazado ? 'destructiva' : 'confirmar',
            });
      if (!respuesta) { return; }
    }

    this.publicando.set(true);
    this.error.set(null);
    this.avisoDePublicacion.set(null);

    try {
      await firstValueFrom(this.api.post<{ estado: string }>(
        `/api/v1/admin/festivales/${ficha.id}/publicacion`, { estado }, { headers: await this.testigo.cabeceras() }));
      this.avisoDePublicacion.set(
        estado === 'publicado' ? 'El Festival quedó publicado en el ecosistema.'
          : estado === 'archivado' ? 'El Festival quedó archivado.'
            : 'El Festival volvió a borrador y ya no se ve en el portal.');
      await this.cargar(ficha.id);
    } catch (fallo: unknown) {
      this.error.set(this.motivoDelServidor(fallo) ?? 'No fue posible cambiar el estado del Festival.');
    } finally {
      this.publicando.set(false);
    }
  }

  /**
   * Devuelve a revisión un Festival rechazado (T2, `docs/referencia/20-decisiones-y-flujos-por-modulo.md` decisión 19).
   *
   * <b>ES LA SALIDA DEL RECHAZO.</b> Antes «rechazado» no tenía salida desde la consola: la bandeja
   * solo decide sobre lo que está en revisión y la única opción era publicarlo de todos modos, que
   * revierte el rechazo sin que nadie lo revise. Esto lo devuelve a la bandeja, con un motivo que
   * queda en el historial y que la organización lee; la decisión se toma de nuevo con los botones
   * de siempre.
   */
  async reabrirRevision(): Promise<void> {
    const ficha = this.ficha();
    if (!ficha) { return; }
    const respuesta = await this.confirmaciones.pedir({
      titulo: `Reabrir la revisión de «${ficha.nombre}»`,
      detalle: 'El Festival vuelve a «en revisión» y a la bandeja, donde se decide de nuevo. El rechazo anterior queda en el historial y la organización recibe el aviso con tu motivo.',
      accion: 'Reabrir revisión',
      tono: 'confirmar',
      pideMotivo: true,
      motivoObligatorio: true,
      rotuloDelMotivo: 'Por qué se reabre',
      ayudaDelMotivo: 'Queda en el historial del Festival y la organización lo lee.',
    });
    if (!respuesta) { return; }

    this.publicando.set(true);
    this.error.set(null);
    this.avisoDePublicacion.set(null);
    try {
      await firstValueFrom(this.api.post<{ estado: string }>(
        `/api/v1/institucional/festivales/${ficha.id}/reabrir-revision`,
        { motivo: respuesta.motivo.trim() },
        { headers: await this.testigo.cabeceras() }));
      this.avisoDePublicacion.set('La revisión se reabrió: el Festival volvió a «en revisión» y está en la bandeja.');
      await this.cargar(ficha.id);
    } catch (fallo: unknown) {
      this.error.set(this.motivoDelServidor(fallo) ?? 'No fue posible reabrir la revisión del Festival.');
    } finally {
      this.publicando.set(false);
    }
  }

  private async cargar(id: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.ficha.set(await firstValueFrom(
        this.api.get<FichaFestivalAdministrativa>(`/api/v1/admin/festivales/${id}`, {})));
    } catch {
      this.ficha.set(null);
      this.error.set('No fue posible abrir la ficha del Festival.');
    } finally {
      this.cargando.set(false);
    }
  }
}
