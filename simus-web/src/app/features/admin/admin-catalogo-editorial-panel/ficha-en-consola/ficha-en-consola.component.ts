import { etiquetaDeEstado } from '../../domain/admin-config';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ACCIONES_DEL_HILO_EDITORIAL, AnotacionEditorial, CatalogoEditorialService, DerechosEditoriales, DerechosEditorialesSolicitud,
  ETIQUETAS_CATALOGACION, ETIQUETAS_DERECHOS, ETIQUETAS_PUBLICACION, FuenteEditorial, PublicacionEditorial,
} from '../../../../core/services/catalogo-editorial.service';

/** Una decisión de derechos en edición: la de la ficha o la de uno de sus accesos. */
export interface DerechosEnEdicion extends DerechosEditorialesSolicitud {
  /** `null` para la ficha; el identificador del acceso, si es de un acceso. */
  accesoId: number | null;
  /** Cómo se nombra en pantalla: «La ficha» o la etiqueta del acceso. */
  nombre: string;
}

function enEdicion(d: DerechosEditoriales, accesoId: number | null, nombre: string): DerechosEnEdicion {
  return {
    accesoId, nombre, estado: d.estado || 'pendiente',
    permitePublicarFicha: d.permitePublicarFicha, permitePublicarArchivo: d.permitePublicarArchivo,
    licenciaONota: d.licenciaONota ?? '', fuenteId: d.fuenteId ?? null,
  };
}
import { aRecursoEditorialDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { FichaEditorialComponent } from '../../../editorial/components/ficha-editorial/ficha-editorial.component';
import { IndicadorDeEstadoComponent } from '../../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { FechaPipe } from '../../../../shared/utils/fecha.pipe';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * La ficha del Catálogo Editorial **en la consola**: la misma que ve el portal, y encima el trabajo.
 *
 * <b>POR QUE DOS VERSIONES Y NO UNA.</b> El criterio es este: «una versión visible de
 * este catálogo, y una versión un poco más avanzada con los comentarios, revisiones, anotaciones,
 * de cara al panel de gestión administrativa». Son dos lecturas distintas del mismo registro:
 * quien consulta quiere la obra; quien cataloga quiere además saber en qué estado está, quién la
 * validó, qué se dijo de ella y qué falta.
 *
 * <b>EL CUERPO CATALOGRAFICO ES EL MISMO COMPONENTE, Y ESO ES LO IMPORTANTE.</b> Se reutiliza
 * `FichaEditorialComponent` tal cual, así que quien cataloga ve EXACTAMENTE lo que va a ver el
 * portal —ni una tarjeta de más ni una de menos— y no tiene que imaginárselo. Una segunda versión
 * escrita a mano divergiría de la pública en el primer cambio, que es el defecto que este mismo
 * corte acaba de cerrar en el portal.
 *
 * <b>LO QUE SE AÑADE ENCIMA</b> es justo lo que el criterio de biblioteca dejó fuera de lo público:
 * los dos estados, la confianza de la ficha, las banderas de revisión, las notas de catalogación,
 * la procedencia, las fuentes con su verificador, los derechos con quién los comprobó, y el hilo de
 * decisiones y anotaciones.
 */
@Component({
  selector: 'app-ficha-en-consola',
  standalone: true,
  imports: [EsqueletoComponent, FechaPipe, CommonModule, FormsModule, FichaEditorialComponent, IndicadorDeEstadoComponent],
  templateUrl: './ficha-en-consola.component.html',
})
export class FichaEnConsolaComponent {
  private readonly api = inject(CatalogoEditorialService);

  @Input({ required: true }) set publicacion(valor: PublicacionEditorial) {
    this.ficha.set(valor);
    this.derechosEnEdicion.set(null);
    this.fuenteEnEdicion.set(null);
    void this.cargarHistorial();
  }

  @Output() cerrar = new EventEmitter<void>();

  /**
   * Dentro del cajón lateral común el título, el código y el cierre los pone el
   * cajón: aquí quedan los dos estados y todo lo demás.
   */
  @Input() enCajon = false;
  /** Para que el panel recargue su lista cuando algo cambia desde aquí. */
  @Output() cambio = new EventEmitter<void>();

  readonly ficha = signal<PublicacionEditorial | null>(null);
  readonly historial = signal<AnotacionEditorial[]>([]);
  readonly cargandoHistorial = signal(false);
  readonly anotacion = signal('');
  readonly guardandoAnotacion = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;
  readonly etiquetasCatalogacion = ETIQUETAS_CATALOGACION;
  readonly etiquetasPublicacion = ETIQUETAS_PUBLICACION;
  readonly etiquetasDerechos = ETIQUETAS_DERECHOS;
  readonly estadosDerechos = Object.keys(ETIQUETAS_DERECHOS);

  // ═══════════ Fuentes: sin fuente, la ficha no puede publicarse ═══════════
  //
  // HASTA ESTE LOTE LA FICHA DECÍA «No cita ninguna fuente» Y «Las fuentes y los derechos no se
  // editan aquí», pero no existía ningún control para añadir una: una publicación creada en la
  // consola no se podía publicar nunca. Se registran y se corrigen aquí; cada cambio queda en el
  // hilo de la ficha y quién la verificó lo pone el servidor.

  /** `null` mientras no se edita; `id: null` es una fuente nueva. */
  readonly fuenteEnEdicion = signal<{ id: number | null; nombre: string; referencia: string; url: string; fechaFuente: string } | null>(null);
  readonly guardandoFuente = signal(false);
  readonly errorDeLaFuente = signal('');

  agregarFuente(): void {
    this.error.set(''); this.aviso.set(''); this.errorDeLaFuente.set('');
    this.fuenteEnEdicion.set({ id: null, nombre: '', referencia: '', url: '', fechaFuente: '' });
  }

  editarFuente(fuente: FuenteEditorial): void {
    this.error.set(''); this.aviso.set(''); this.errorDeLaFuente.set('');
    this.fuenteEnEdicion.set({
      id: fuente.id, nombre: fuente.nombre, referencia: fuente.referencia ?? '', url: fuente.url ?? '',
      fechaFuente: (fuente.fechaFuente ?? '').slice(0, 10),
    });
  }

  cancelarFuente(): void { this.fuenteEnEdicion.set(null); this.errorDeLaFuente.set(''); }

  cambiarFuente(clave: 'nombre' | 'referencia' | 'url' | 'fechaFuente', valor: string): void {
    this.fuenteEnEdicion.update(f => f ? { ...f, [clave]: valor } : f);
  }

  async guardarFuente(): Promise<void> {
    const f = this.ficha();
    const edicion = this.fuenteEnEdicion();
    if (!f || !edicion || this.guardandoFuente()) { return; }
    const nombre = edicion.nombre.trim();
    const referencia = edicion.referencia.trim();
    const url = edicion.url.trim();
    // LO MISMO QUE EXIGE EL SERVIDOR, dicho antes de enviar.
    if (!nombre) { this.errorDeLaFuente.set('Escribe cómo se llama la fuente.'); return; }
    if (!referencia && !url) { this.errorDeLaFuente.set('Indica el enlace o la referencia con la que se localiza la fuente.'); return; }

    this.errorDeLaFuente.set(''); this.aviso.set('');
    this.guardandoFuente.set(true);
    const solicitud = {
      version: f.version, nombre, referencia: referencia || null, url: url || null, fechaFuente: edicion.fechaFuente || null,
    };
    const resultado = edicion.id === null
      ? await this.api.registrarFuente(f.id, solicitud)
      : await this.api.corregirFuente(f.id, edicion.id, solicitud);
    this.guardandoFuente.set(false);

    if (!resultado.ok || !resultado.data) {
      this.errorDeLaFuente.set(resultado.error ?? 'No fue posible guardar la fuente.');
      return;
    }
    this.ficha.set(resultado.data);
    this.fuenteEnEdicion.set(null);
    this.aviso.set(edicion.id === null ? 'La fuente quedó registrada en el historial de la ficha.' : 'La fuente quedó corregida en el historial de la ficha.');
    this.cambio.emit();
    await this.cargarHistorial();
  }

  // ═══════════ Derechos: los registra quien cataloga ═══════════
  //
  // REGISTRAR DERECHOS NO ES PUBLICAR. Cualquiera con el módulo los fija aquí; sacar la ficha al
  // portal sigue siendo del webmaster. Quién y cuándo los pone el servidor, y queda en el hilo.

  /** `null` mientras no se editan; si no, la ficha primero y después cada acceso. */
  readonly derechosEnEdicion = signal<DerechosEnEdicion[] | null>(null);
  readonly guardandoDerechos = signal(false);

  editarDerechos(): void {
    const f = this.ficha();
    if (!f) { return; }
    this.error.set(''); this.aviso.set('');
    this.derechosEnEdicion.set([
      enEdicion(f.derechos, null, 'La ficha'),
      ...(f.accesos ?? []).map(a => enEdicion(a.derechos, a.id, a.etiqueta || a.url || a.ubicacionFisica || a.tipo)),
    ]);
  }

  cancelarDerechos(): void { this.derechosEnEdicion.set(null); }

  /**
   * Cambia un dato de una decisión. Con los derechos pendientes no se autoriza nada: el servidor lo
   * rechazaría, así que la pantalla apaga los permisos en vez de dejar que alguien lo descubra al guardar.
   */
  cambiarDerecho<K extends keyof DerechosEditorialesSolicitud>(indice: number, clave: K, valor: DerechosEditorialesSolicitud[K]): void {
    this.derechosEnEdicion.update(lista => (lista ?? []).map((d, i) => {
      if (i !== indice) { return d; }
      const nuevo = { ...d, [clave]: valor };
      if (nuevo.estado === 'pendiente') { nuevo.permitePublicarFicha = false; nuevo.permitePublicarArchivo = false; }
      return nuevo;
    }));
  }

  async guardarDerechos(): Promise<void> {
    const f = this.ficha();
    const lista = this.derechosEnEdicion();
    if (!f || !lista || this.guardandoDerechos()) { return; }

    const limpiar = (d: DerechosEnEdicion): DerechosEditorialesSolicitud => ({
      estado: d.estado, permitePublicarFicha: d.permitePublicarFicha, permitePublicarArchivo: d.permitePublicarArchivo,
      licenciaONota: d.licenciaONota?.trim() || null, fuenteId: d.fuenteId,
    });
    const ficha = lista.find(d => d.accesoId === null);
    const accesos = lista.filter(d => d.accesoId !== null).map(d => ({ ...limpiar(d), accesoId: d.accesoId as number }));

    this.error.set(''); this.aviso.set('');
    this.guardandoDerechos.set(true);
    const resultado = await this.api.guardarDerechos(f.id, {
      version: f.version,
      ...(ficha ? { ficha: limpiar(ficha) } : {}),
      ...(accesos.length > 0 ? { accesos } : {}),
    });
    this.guardandoDerechos.set(false);

    if (!resultado.ok || !resultado.data) {
      this.error.set(resultado.error ?? 'No fue posible guardar los derechos.');
      return;
    }
    this.ficha.set(resultado.data);
    this.derechosEnEdicion.set(null);
    this.aviso.set('Los derechos quedaron registrados en el historial de la ficha.');
    this.cambio.emit();
    await this.cargarHistorial();
  }

  /*
    EL CODIGO NUNCA SALE A PANTALLA: el respaldo era `|| codigo`, que escribia «en_revision» tal
    cual en la ficha. El respaldo compartido lo pasa a lenguaje humano.
  */
  rotuloDeCatalogacion(codigo: string | null | undefined): string {
    return this.etiquetasCatalogacion[(codigo ?? '').trim()] ?? etiquetaDeEstado(codigo);
  }

  rotuloDePublicacion(codigo: string | null | undefined): string {
    return this.etiquetasPublicacion[(codigo ?? '').trim()] ?? etiquetaDeEstado(codigo);
  }

  /**
   * La ficha en la forma que consume la pantalla del portal.
   *
   * SE TRADUCE AQUI Y NO SE DUPLICA LA VISTA. El adaptador espera la forma PUBLICA, que es la que
   * recibe el portal; la consola tiene la interna, que la contiene entera. Pasar por el adaptador
   * garantiza que lo que se ve aquí es lo que se verá allí.
   */
  /**
   * Los términos normalizados, con su norma, para quien cataloga.
   *
   * Vive aquí y no en la ficha pública a propósito: el eje DCMI va en inglés porque es un
   * identificador de intercambio —«MovingImage», «InteractiveResource»— y citar «RDA 336» junto al
   * valor solo tiene sentido para quien tiene que sostener esa clasificación ante otro catálogo.
   */
  readonly normalizacionInterna = computed(() => {
    const f = this.ficha();
    if (!f) { return []; }
    const eje = (clave: string, norma: string) => ({
      rotulo: norma,
      valor: (f.tipologia ?? []).filter(x => x.eje === clave).map(x => x.etiqueta).join(' · '),
    });
    return [
      { rotulo: 'Fecha normalizada (EDTF)', valor: f.fechaEdtf ?? '' },
      { rotulo: 'Idiomas', valor: (f.idiomas ?? []).map(i => i.nombre).join(' · ') },
      eje('recurso', 'Tipo de recurso (DCMI Type Vocabulary)'),
      eje('contenido', 'Contenido (RDA 336)'),
      eje('medio', 'Medio (RDA 337)'),
      eje('soporte', 'Soporte (RDA 338)'),
    ].filter(fila => fila.valor);
  });

  readonly comoLoVeElPortal = computed(() => {
    const f = this.ficha();
    if (!f) { return null; }
    return aRecursoEditorialDeDiseno({
      codigo: f.codigo, titulo: f.titulo, subtitulo: f.subtitulo,
      designacionVolumen: f.designacionVolumen, serieOColeccion: f.serieOColeccion,
      resumen: f.resumen, fechaEdtf: f.fechaEdtf, anioInicio: f.anioInicio, anioFin: f.anioFin,
      notaFecha: f.notaFecha, idiomas: f.idiomas, tipoPublicacion: f.tipoPublicacion,
      formato: f.formato, tipologia: f.tipologia,
      tamanoFormato: f.tamanoFormato, paginas: f.paginas, duracion: f.duracion,
      categoria: f.categoria, categoriaSecundaria: f.categoriaSecundaria,
      practicaMusical: f.practicaMusical, subcategoria: f.subcategoria,
      palabrasClave: f.palabrasClave, ambito: f.ambito, ambitoTexto: f.ambitoTexto,
      seccionPrincipal: f.seccionPrincipal, rutaSeccion: f.rutaSeccion,
      miniaturaRuta: f.miniaturaRuta, textoPortada: f.textoPortada,
      creditos: (f.creditos ?? []).map(c => ({
        agenteId: c.agenteId, nombre: c.agenteNombre, tipo: c.agenteTipo,
        rolCodigo: c.rolCodigo, rol: c.rolEtiqueta, principal: c.principal,
      })),
      identificadores: (f.identificadores ?? []).map(i => ({
        esquema: i.esquema, codigo: i.codigoRecibido, cualificador: i.cualificador,
      })),
      accesos: (f.accesos ?? []).map(a => ({
        tipo: a.tipo, url: a.url, ubicacionFisica: a.ubicacionFisica,
        etiqueta: a.etiqueta, nota: a.nota,
      })),
      licencia: f.derechos?.licenciaONota ?? null,
      practicasMusicales: f.practicasMusicales ?? [],
      territoriosSonoros: f.territoriosSonoros ?? [],
      fechaActualizacion: f.fechaActualizacion,
    });
  });

  /**
   * Lo que le falta a esta ficha para poder verse en el portal.
   *
   * <b>SE DICE ANTES DE PULSAR, Y NO DESPUES.</b> La puerta pública exige cuatro cosas a la vez y
   * el servidor las comprueba al publicar; enterarse ahí es enterarse tarde. Aquí se enumera lo que
   * falta, que es lo que convierte «no se puede publicar» en una lista de tareas.
   */
  readonly loQueFalta = computed(() => {
    const f = this.ficha();
    if (!f) { return []; }
    const faltas: string[] = [];
    if (f.estadoCatalogacion !== 'validada') { faltas.push('La ficha todavía no está validada.'); }
    if ((f.fuentes ?? []).length === 0) { faltas.push('No cita ninguna fuente.'); }
    if (!f.derechos?.permitePublicarFicha) { faltas.push('Los derechos no permiten publicar la ficha.'); }
    return faltas;
  });

  readonly sePuedeVerEnElPortal = computed(() =>
    this.loQueFalta().length === 0 && this.ficha()?.estadoPublicacion === 'publicado');

  /** Lo que el portal NO enseña de esta ficha, y que es de lo que va esta pantalla. */
  administrativos(): { rotulo: string; valor: string }[] {
    const f = this.ficha();
    if (!f) { return []; }
    return [
      { rotulo: 'Confianza de la ficha', valor: f.confianza ?? '' },
      { rotulo: 'Revisar clasificación', valor: f.revisarClasificacion ? 'Sí' : '' },
      { rotulo: 'Revisar créditos', valor: f.revisarCreditos ? 'Sí' : '' },
      { rotulo: 'Notas de catalogación', valor: f.notasCatalogacion ?? '' },
      { rotulo: 'Lámina del catálogo original', valor: f.diapositivaOrigen ?? '' },
      { rotulo: 'Versión del registro', valor: String(f.version ?? '') },
    ].filter(d => d.valor.trim().length > 0);
  }

  derechos(): { rotulo: string; valor: string }[] {
    const d = this.ficha()?.derechos;
    if (!d) { return []; }
    return [
      { rotulo: 'Estado de los derechos', valor: this.etiquetasDerechos[d.estado] ?? d.estado ?? '' },
      { rotulo: 'Permite publicar la ficha', valor: d.permitePublicarFicha ? 'Sí' : 'No' },
      { rotulo: 'Permite publicar el archivo', valor: d.permitePublicarArchivo ? 'Sí' : 'No' },
      { rotulo: 'Licencia o nota', valor: d.licenciaONota ?? '' },
      { rotulo: 'Verificado por', valor: d.verificadoPor ?? '' },
    ].filter(x => x.valor.trim().length > 0);
  }

  /** Cómo se lee cada entrada del hilo. El verbo va en letra, no en clave. */
  tituloDeLaEntrada(entrada: AnotacionEditorial): string {
    if (entrada.accion === 'Anotacion') { return 'Anotación'; }
    if (entrada.accion === 'CatalogacionCambiada') {
      return `Catalogación · ${this.etiquetasCatalogacion[entrada.estadoNuevo] ?? entrada.estadoNuevo}`;
    }
    if (entrada.accion === 'FuenteRegistrada' || entrada.accion === 'FuenteCorregida') {
      return ACCIONES_DEL_HILO_EDITORIAL[entrada.accion];
    }
    if (entrada.accion === 'PublicacionCambiada') {
      return `Publicación · ${this.etiquetasPublicacion[entrada.estadoNuevo] ?? entrada.estadoNuevo}`;
    }
    return ACCIONES_DEL_HILO_EDITORIAL[entrada.accion] ?? entrada.accion;
  }

  esAnotacion(entrada: AnotacionEditorial): boolean { return entrada.accion === 'Anotacion'; }

  async cargarHistorial(): Promise<void> {
    const f = this.ficha();
    if (!f) { return; }
    this.cargandoHistorial.set(true);
    const resultado = await this.api.historial(f.id);
    this.cargandoHistorial.set(false);
    if (resultado.ok) { this.historial.set(resultado.data ?? []); }
    else { this.error.set(resultado.error ?? 'No fue posible consultar el historial.'); }
  }

  async guardarAnotacion(): Promise<void> {
    const f = this.ficha();
    const texto = this.anotacion().trim();
    if (!f || texto.length === 0) { return; }

    this.error.set(''); this.aviso.set('');
    this.guardandoAnotacion.set(true);
    const resultado = await this.api.anotar(f.id, texto);
    this.guardandoAnotacion.set(false);

    if (!resultado.ok) { this.error.set(resultado.error ?? 'No fue posible guardar la anotación.'); return; }
    this.anotacion.set('');
    this.aviso.set('La anotación quedó en el historial de la ficha.');
    await this.cargarHistorial();
  }
}
