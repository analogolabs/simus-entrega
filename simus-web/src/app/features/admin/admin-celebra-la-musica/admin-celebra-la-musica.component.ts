import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowDown, LucideArrowUp, LucideTrash2 } from '@lucide/angular';
import {
  CambioDeEdicion,
  CelebraLaMusicaService,
  EdicionDeCelebra,
  EdicionDeCelebraResumen,
  GuardarEdicionDeCelebra,
} from '../../../core/services/celebra-la-musica.service';
import { ArchivoEnElBanco, BancoDeArchivosService } from '../../../core/services/banco-de-archivos.service';
import { CargadorDeImagenComponent } from '../../../shared/components/cargador-de-imagen/cargador-de-imagen.component';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { CampoDeSeleccionComponent } from '../../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { DialogoDeFormularioComponent } from '../../../shared/components/ui/dialogo-de-formulario/dialogo-de-formulario.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { CONTRASTE_MINIMO_AA, esColorHexadecimal, mejorContrasteSobre } from '../../../shared/utils/contraste-de-color';

interface RecursoEditable {
  grupo: string;
  titulo: string;
  descripcion: string;
  tipo: 'enlace' | 'archivo';
  url: string;
  archivoId: number | null;
  archivoNombre: string;
}

interface ImagenEditable { archivoId: number; url: string; textoAlternativo: string; credito: string }

interface ModeloDeEdicion {
  anio: number;
  nueva: boolean;
  nombre: string;
  hashtag: string;
  resumen: string;
  presentacion: string;
  aliados: string;
  fechaInicio: string;
  fechaFin: string;
  actividades: number | null;
  municipios: number | null;
  departamentos: number | null;
  organizaciones: number | null;
  musicos: number | null;
  colorPrincipal: string;
  colorSecundario: string;
  portada: { id: number; url: string } | null;
  actual: boolean;
  publicada: boolean;
  fuente: string;
  pendienteDeValidar: boolean;
  categorias: { nombre: string; descripcion: string }[];
  recursos: RecursoEditable[];
  preguntas: { pregunta: string; respuesta: string }[];
  galeria: ImagenEditable[];
}

const ID_DE_ARCHIVO = /\/archivos\/(\d+)/;

function modeloVacio(anio: number): ModeloDeEdicion {
  return {
    anio, nueva: true, nombre: `Celebra la Música ${anio}`, hashtag: '', resumen: '', presentacion: '', aliados: '',
    fechaInicio: `${anio}-11-01`, fechaFin: `${anio}-11-30`,
    actividades: null, municipios: null, departamentos: null, organizaciones: null, musicos: null,
    colorPrincipal: '#D8175A', colorSecundario: '#09153C', portada: null, actual: false, publicada: false,
    fuente: '', pendienteDeValidar: false, categorias: [], recursos: [], preguntas: [], galeria: [],
  };
}

function desdeEdicion(e: EdicionDeCelebra): ModeloDeEdicion {
  return {
    anio: e.anio, nueva: false, nombre: e.nombre, hashtag: e.hashtag ?? '', resumen: e.resumen ?? '', presentacion: e.presentacion ?? '',
    aliados: e.aliados ?? '', fechaInicio: e.fechaInicio ?? '', fechaFin: e.fechaFin ?? '',
    actividades: e.actividades, municipios: e.municipios, departamentos: e.departamentos, organizaciones: e.organizaciones, musicos: e.musicos,
    colorPrincipal: e.colorPrincipal, colorSecundario: e.colorSecundario,
    portada: e.imagenPortadaArchivoId && e.imagenPortadaUrl ? { id: e.imagenPortadaArchivoId, url: e.imagenPortadaUrl } : null,
    actual: e.actual, publicada: e.publicada, fuente: e.fuente ?? '', pendienteDeValidar: e.pendienteDeValidar,
    categorias: e.categorias.map((c) => ({ nombre: c.nombre, descripcion: c.descripcion ?? '' })),
    recursos: e.recursos.map((r) => ({
      grupo: r.grupo, titulo: r.titulo, descripcion: r.descripcion ?? '', tipo: r.archivoId ? 'archivo' : 'enlace',
      url: r.archivoId ? '' : r.url ?? '', archivoId: r.archivoId, archivoNombre: r.archivoId ? (r.titulo) : '',
    })),
    preguntas: e.preguntas.map((p) => ({ pregunta: p.pregunta, respuesta: p.respuesta })),
    galeria: e.galeria.map((g) => ({ archivoId: g.archivoId, url: g.url, textoAlternativo: g.textoAlternativo, credito: g.credito ?? '' })),
  };
}

const vacioANulo = (t: string): string | null => (t.trim() === '' ? null : t.trim());

/**
 * LA CONSOLA DE «CELEBRA LA MÚSICA»: lista de ediciones y editor de una edición completa (pestaña de «Categorías y proyectos»).
 *
 * <b>EDITA LO EDITORIAL, NO LA AGENDA NI LAS NOTICIAS.</b> La programación y la sala de prensa de una edición son la agenda y las
 * noticias generales etiquetadas con el proyecto de la edición; aquí solo se guarda lo que el micrositio muestra además de eso.
 * Un año nuevo crea su edición y su proyecto transversal sin migración (lo hace el servidor al guardar).
 *
 * <b>UNA SOLA EDICIÓN VIGENTE, Y PUBLICAR ES UN PASO APARTE.</b> Un borrador solo se ve con la vista previa de la consola; al
 * publicar, el servidor deja de marcar vigente a la anterior si esta lo pide.
 */
@Component({
  selector: 'app-admin-celebra-la-musica',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, FechaPipe, CampoDeSeleccionComponent, LucideArrowDown, LucideArrowUp, LucideTrash2, BotonComponent, CargadorDeImagenComponent,
    DialogoDeFormularioComponent, EstadoDeListaComponent, IndicadorDeEstadoComponent,
  ],
  templateUrl: './admin-celebra-la-musica.component.html',
})
export class AdminCelebraLaMusicaComponent {
  private readonly servicio = inject(CelebraLaMusicaService);
  private readonly banco = inject(BancoDeArchivosService);

  readonly enabled = input(true);

  readonly cargando = signal(true);
  readonly errorDeLista = signal('');
  readonly ediciones = signal<EdicionDeCelebraResumen[]>([]);

  readonly modelo = signal<ModeloDeEdicion | null>(null);
  readonly cargandoEdicion = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly historial = signal<CambioDeEdicion[]>([]);
  readonly sinGuardar = signal(false);

  readonly nuevoAnio = signal<{ anio: number | null; error: string } | null>(null);
  readonly selectorDeBanco = signal<'portada' | 'galeria' | null>(null);
  readonly archivosDelBanco = signal<ArchivoEnElBanco[]>([]);
  readonly cargandoBanco = signal(false);
  readonly errorDelBanco = signal('');
  readonly subiendoRecurso = signal<number | null>(null);

  /** Lo que impide guardar, dicho en claro. Vacío si se puede guardar. */
  readonly problemas = computed<string[]>(() => {
    const m = this.modelo();
    if (!m) { return []; }
    const p: string[] = [];
    if (!m.nombre.trim()) { p.push('El nombre de la edición es obligatorio.'); }
    if (!esColorHexadecimal(m.colorPrincipal) || !esColorHexadecimal(m.colorSecundario)) { p.push('Los colores son valores como #D8175A.'); }
    if (m.fechaInicio && m.fechaFin && m.fechaFin < m.fechaInicio) { p.push('La fecha de fin no puede ser anterior a la de inicio.'); }
    [m.actividades, m.municipios, m.departamentos, m.organizaciones, m.musicos].forEach((c) => { if (c !== null && c < 0) { p.push('Las cifras no pueden ser negativas.'); } });
    if (m.categorias.some((c) => !c.nombre.trim())) { p.push('Cada categoría lleva su nombre.'); }
    if (new Set(m.categorias.map((c) => c.nombre.trim().toLowerCase())).size !== m.categorias.length) { p.push('Dos categorías no pueden llamarse igual.'); }
    if (m.preguntas.some((q) => !q.pregunta.trim() || !q.respuesta.trim())) { p.push('Cada pregunta frecuente lleva su pregunta y su respuesta.'); }
    m.recursos.forEach((r, i) => {
      if (!r.grupo.trim() || !r.titulo.trim()) { p.push(`El recurso ${i + 1} necesita un grupo y un título.`); }
      else if (r.tipo === 'enlace' && !/^https:\/\//i.test(r.url.trim())) { p.push(`El recurso «${r.titulo}» necesita un enlace que empiece por https://.`); }
      else if (r.tipo === 'archivo' && r.archivoId === null) { p.push(`El recurso «${r.titulo}» necesita un archivo del Banco.`); }
    });
    m.galeria.forEach((g, i) => {
      if (!g.textoAlternativo.trim()) { p.push(`La imagen ${i + 1} de la galería necesita su texto alternativo.`); }
      if (!g.credito.trim()) { p.push(`La imagen ${i + 1} de la galería necesita su crédito.`); }
    });
    return p;
  });

  /** Aviso de contraste de cada color: si ni el mejor texto (blanco o negro violáceo) llega a AA, no se puede leer el encabezado. */
  readonly contrasteDelPrincipal = computed(() => mejorContrasteSobre(this.modelo()?.colorPrincipal ?? ''));
  readonly contrasteDelSecundario = computed(() => mejorContrasteSobre(this.modelo()?.colorSecundario ?? ''));
  readonly minimoAA = CONTRASTE_MINIMO_AA;

  constructor() {
    effect(() => {
      if (!this.enabled()) { return; }
      untracked(() => { void this.cargarLista(); });
    });
  }

  async cargarLista(): Promise<void> {
    this.cargando.set(true);
    this.errorDeLista.set('');
    const r = await this.servicio.ediciones(true);
    if (r.ok) { this.ediciones.set(r.data ?? []); } else { this.errorDeLista.set(r.error ?? ''); }
    this.cargando.set(false);
  }

  // ── Lista y alta ────────────────────────────────────────────────────────────────────────────
  abrirNuevo(): void { this.nuevoAnio.set({ anio: (this.ediciones()[0]?.anio ?? new Date().getFullYear() - 1) + 1, error: '' }); }
  cerrarNuevo(): void { this.nuevoAnio.set(null); }
  cambiarAnio(valor: number | null): void { this.nuevoAnio.update((n) => (n ? { anio: valor, error: '' } : n)); }

  crearEdicion(): void {
    const n = this.nuevoAnio();
    if (!n) { return; }
    const anio = Number(n.anio);
    if (!Number.isInteger(anio) || anio < 2011 || anio > 2100) { this.nuevoAnio.set({ anio: n.anio, error: 'El año debe estar entre 2011 y 2100.' }); return; }
    if (this.ediciones().some((e) => e.anio === anio)) { this.nuevoAnio.set({ anio: n.anio, error: `La edición ${anio} ya existe: ábrela desde la lista.` }); return; }
    this.nuevoAnio.set(null);
    this.error.set('');
    this.aviso.set('');
    this.historial.set([]);
    this.sinGuardar.set(true);
    this.modelo.set(modeloVacio(anio));
  }

  async abrir(anio: number): Promise<void> {
    this.cargandoEdicion.set(true);
    this.error.set('');
    this.aviso.set('');
    const r = await this.servicio.edicion(anio, true);
    this.cargandoEdicion.set(false);
    if (!r.ok || !r.data) { this.errorDeLista.set(r.error ?? 'No encontramos esa edición.'); return; }
    this.modelo.set(desdeEdicion(r.data));
    this.sinGuardar.set(false);
    void this.cargarHistorial(anio);
  }

  async cargarHistorial(anio: number): Promise<void> {
    const r = await this.servicio.historial(anio);
    this.historial.set(r.ok ? r.data ?? [] : []);
  }

  volver(): void {
    if (this.sinGuardar() && !globalThis.confirm('Hay cambios sin guardar. ¿Salir sin guardarlos?')) { return; }
    this.modelo.set(null);
    this.sinGuardar.set(false);
    void this.cargarLista();
  }

  // ── Edición del modelo ──────────────────────────────────────────────────────────────────────
  campo<K extends keyof ModeloDeEdicion>(clave: K, valor: ModeloDeEdicion[K]): void {
    this.modelo.update((m) => (m ? { ...m, [clave]: valor } : m));
    this.sinGuardar.set(true);
  }

  private cambiarLista<K extends 'categorias' | 'recursos' | 'preguntas' | 'galeria'>(clave: K, f: (lista: ModeloDeEdicion[K]) => ModeloDeEdicion[K]): void {
    this.modelo.update((m) => (m ? { ...m, [clave]: f(m[clave]) } : m));
    this.sinGuardar.set(true);
  }

  agregar(clave: 'categorias' | 'recursos' | 'preguntas'): void {
    if (clave === 'categorias') { this.cambiarLista('categorias', (l) => [...l, { nombre: '', descripcion: '' }]); }
    if (clave === 'preguntas') { this.cambiarLista('preguntas', (l) => [...l, { pregunta: '', respuesta: '' }]); }
    if (clave === 'recursos') {
      this.cambiarLista('recursos', (l) => [...l, { grupo: l[l.length - 1]?.grupo ?? '', titulo: '', descripcion: '', tipo: 'enlace', url: '', archivoId: null, archivoNombre: '' }]);
    }
  }

  editarItem<K extends 'categorias' | 'recursos' | 'preguntas' | 'galeria'>(clave: K, indice: number, parte: Partial<ModeloDeEdicion[K][number]>): void {
    this.cambiarLista(clave, (l) => (l as unknown[]).map((x, i) => (i === indice ? { ...(x as object), ...parte } : x)) as ModeloDeEdicion[K]);
  }

  quitar(clave: 'categorias' | 'recursos' | 'preguntas' | 'galeria', indice: number): void {
    this.cambiarLista(clave, (l) => (l as unknown[]).filter((_, i) => i !== indice) as ModeloDeEdicion[typeof clave]);
  }

  mover(clave: 'categorias' | 'recursos' | 'preguntas' | 'galeria', indice: number, sentido: -1 | 1): void {
    this.cambiarLista(clave, (l) => {
      const copia = [...(l as unknown[])];
      const destino = indice + sentido;
      if (destino < 0 || destino >= copia.length) { return l; }
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia as ModeloDeEdicion[typeof clave];
    });
  }

  // ── Imágenes del Banco ──────────────────────────────────────────────────────────────────────
  alSubirImagen(destino: 'portada' | 'galeria', url: string): void {
    if (!url) { if (destino === 'portada') { this.campo('portada', null); } return; }
    const id = Number(ID_DE_ARCHIVO.exec(url)?.[1]);
    if (!id) { return; }
    this.usarImagen(destino, id, url);
  }

  private usarImagen(destino: 'portada' | 'galeria', id: number, url: string, alt = '', credito = ''): void {
    if (destino === 'portada') { this.campo('portada', { id, url }); return; }
    if (this.modelo()?.galeria.some((g) => g.archivoId === id)) { this.aviso.set('Esa imagen ya está en la galería.'); return; }
    this.cambiarLista('galeria', (l) => [...l, { archivoId: id, url, textoAlternativo: alt, credito }]);
  }

  async abrirBanco(para: 'portada' | 'galeria'): Promise<void> {
    this.selectorDeBanco.set(para);
    this.cargandoBanco.set(true);
    this.errorDelBanco.set('');
    const r = await this.banco.listar('institucional', { tamano: 60 });
    if (r.ok && r.data) { this.archivosDelBanco.set(r.data.items.filter((a) => a.tipo.startsWith('image/'))); }
    else { this.errorDelBanco.set(r.error ?? 'No fue posible consultar el Banco de archivos.'); }
    this.cargandoBanco.set(false);
  }

  elegirDelBanco(a: ArchivoEnElBanco): void {
    const para = this.selectorDeBanco();
    if (!para) { return; }
    this.usarImagen(para, a.id, a.url, a.alt ?? '', a.credito ?? '');
    this.selectorDeBanco.set(null);
  }

  async subirRecurso(indice: number, evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) { return; }
    this.subiendoRecurso.set(indice);
    const r = await this.banco.subirDocumento(archivo, 'institucional');
    this.subiendoRecurso.set(null);
    entrada.value = '';
    if (r.ok && r.archivo) { this.editarItem('recursos', indice, { archivoId: r.archivo.id, archivoNombre: r.archivo.nombre }); }
    else { this.error.set(r.error ?? 'No fue posible subir el documento.'); }
  }

  // ── Guardar y publicar ──────────────────────────────────────────────────────────────────────
  private solicitud(m: ModeloDeEdicion): GuardarEdicionDeCelebra {
    return {
      nombre: m.nombre.trim(), hashtag: vacioANulo(m.hashtag), actual: m.actual, publicada: m.publicada,
      colorPrincipal: m.colorPrincipal.trim(), colorSecundario: m.colorSecundario.trim(),
      imagenPortadaArchivoId: m.portada?.id ?? null, fechaInicio: m.fechaInicio || null, fechaFin: m.fechaFin || null,
      resumen: vacioANulo(m.resumen), presentacion: vacioANulo(m.presentacion), aliados: vacioANulo(m.aliados),
      actividades: m.actividades, municipios: m.municipios, departamentos: m.departamentos, organizaciones: m.organizaciones, musicos: m.musicos,
      fuente: vacioANulo(m.fuente), pendienteDeValidar: m.pendienteDeValidar,
      categorias: m.categorias.map((c, i) => ({ nombre: c.nombre.trim(), descripcion: vacioANulo(c.descripcion), orden: i + 1 })),
      recursos: m.recursos.map((r) => ({
        grupo: r.grupo.trim(), titulo: r.titulo.trim(), descripcion: vacioANulo(r.descripcion),
        archivoId: r.tipo === 'archivo' ? r.archivoId : null, url: r.tipo === 'enlace' ? r.url.trim() : null,
      })),
      preguntas: m.preguntas.map((q, i) => ({ pregunta: q.pregunta.trim(), respuesta: q.respuesta.trim(), orden: i + 1 })),
      galeria: m.galeria.map((g) => ({ archivoId: g.archivoId, textoAlternativo: g.textoAlternativo.trim(), credito: vacioANulo(g.credito) })),
    };
  }

  async guardar(cambios: Partial<Pick<ModeloDeEdicion, 'publicada' | 'actual'>> = {}): Promise<void> {
    const actual = this.modelo();
    if (!actual || this.guardando()) { return; }
    const m = { ...actual, ...cambios };
    if (this.problemas().length > 0) { this.error.set('Corrige lo señalado antes de guardar.'); return; }
    this.guardando.set(true);
    this.error.set('');
    this.aviso.set('');
    const r = await this.servicio.guardar(m.anio, this.solicitud(m));
    this.guardando.set(false);
    if (!r.ok || !r.data) { this.error.set(r.error ?? 'No fue posible guardar la edición.'); return; }
    this.modelo.set(desdeEdicion(r.data));
    this.sinGuardar.set(false);
    this.aviso.set(cambios.publicada === true ? 'La edición quedó publicada.' : cambios.publicada === false ? 'La edición dejó de estar publicada.' : 'Cambios guardados.');
    void this.cargarHistorial(m.anio);
  }

  publicar(): Promise<void> { return this.guardar({ publicada: true }); }
  despublicar(): Promise<void> { return this.guardar({ publicada: false, actual: false }); }

  rutaDeVistaPrevia(anio: number): string { return `/pnmc/estrategias/celebra-la-musica/${anio}?vistaPrevia=1`; }
  rutaPublica(anio: number): string { return `/pnmc/estrategias/celebra-la-musica/${anio}`; }

  numero(valor: unknown): number | null {
    return valor === '' || valor === null || valor === undefined ? null : Number(valor);
  }
}
