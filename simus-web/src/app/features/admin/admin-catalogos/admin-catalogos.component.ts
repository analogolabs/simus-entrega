import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowDown, LucideArrowUp, LucideGripVertical } from '@lucide/angular';
import {
  CatalogosAdminService, ElementoDeCatalogo, EntradaDeHistorial, FormularioDeElemento, ResultadoDeImportacion, TipoDeCatalogo,
} from '../../../core/services/catalogos-admin.service';
import { ArchivoEnElBanco, BancoDeArchivosService } from '../../../core/services/banco-de-archivos.service';
import { BarraDeListaComponent } from '../../../shared/components/ui/barra-de-lista/barra-de-lista.component';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { BuscadorDeListaComponent } from '../../../shared/components/ui/buscador/buscador-de-lista.component';
import { CampoDeSeleccionComponent } from '../../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { CargadorDeImagenComponent } from '../../../shared/components/cargador-de-imagen/cargador-de-imagen.component';
import { DialogoDeFormularioComponent } from '../../../shared/components/ui/dialogo-de-formulario/dialogo-de-formulario.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { IndicadorDeEstadoComponent, TonoDeEstado } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { AccionDeRegistro, MenuDeAccionesComponent } from '../../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { aCsv, leerCsv } from '../domain/catalogos-csv';

/**
 * La sección «Catálogos» de la consola: los territorios sonoros y las prácticas musicales, con la ficha de cada uno.
 *
 * <b>POR QUÉ EXISTE.</b> Los dos catálogos eran tablas que solo se tocaban con una migración: el área misional no podía
 * agregar una práctica, ordenarlas ni completar su ficha, y el portal decía «Ficha conceptual en preparación» en todas.
 * Aquí se agregan, editan, ordenan (arrastrando o con los botones), se activan o desactivan y se completa la ficha;
 * también se exportan e importan por hoja de cálculo, con vista previa antes de aplicar.
 *
 * <b>NO SE BORRA LO QUE ESTÁ EN USO.</b> Festivales, mercados, noticias, agenda, talleres, espacios, redes y perfiles
 * apuntan a estos catálogos. El servidor rechaza eliminar un elemento en uso y aquí la acción ni se ofrece: se desactiva,
 * y deja de ofrecerse sin perder los vínculos que ya existen. «Dónde se usa» dice cuántos y en qué.
 *
 * <b>EL ORDEN SOLO SE CAMBIA SIN FILTROS.</b> Reordenar una lista filtrada movería elementos que no se ven; con búsqueda
 * o filtro activos las flechas y el arrastre se desactivan y se dice por qué.
 */
const ID_DE_ARCHIVO = /\/archivos\/(\d+)/;

interface FormularioUI extends FormularioDeElemento { id: number | null }

interface FilaDeCatalogo { e: ElementoDeCatalogo; nivel: 0 | 1; primero: boolean; ultimo: boolean }

const VACIO: FormularioUI = {
  id: null, nombre: '', activo: true, padreId: null, sinonimos: '', observaciones: '', definicionBreve: '', definicionAmpliada: '',
  caracteristicas: '', relacionTerritorial: '', contextos: '', ejemplos: '', fuentes: '', esPreliminar: false,
  imagenArchivoId: null, textoAlternativoRecurso: '',
};

const sinTildes = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Component({
  selector: 'app-admin-catalogos',
  standalone: true,
  imports: [
    FormsModule, FechaPipe, LucideArrowDown, LucideArrowUp, LucideGripVertical, BarraDeListaComponent, BotonComponent, BuscadorDeListaComponent,
    CampoDeSeleccionComponent, CargadorDeImagenComponent, DialogoDeFormularioComponent, EstadoDeListaComponent, FiltroDesplegableComponent,
    IndicadorDeEstadoComponent, MenuDeAccionesComponent, SelectorSegmentadoComponent,
  ],
  templateUrl: './admin-catalogos.component.html',
})
export class AdminCatalogosComponent {
  private readonly api = inject(CatalogosAdminService);
  private readonly banco = inject(BancoDeArchivosService);

  readonly enabled = input(true);

  readonly tipo = signal<TipoDeCatalogo>('territorios-sonoros');
  readonly listas = signal<Record<TipoDeCatalogo, ElementoDeCatalogo[]>>({ 'territorios-sonoros': [], 'practicas-musicales': [] });
  readonly cargando = signal(false);
  readonly cargado = signal(false);
  readonly errorDeCarga = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly busqueda = signal('');
  readonly filtroActivo = signal('todos');
  readonly filtroFicha = signal('todas');

  readonly formulario = signal<FormularioUI | null>(null);
  readonly confirmandoBorrado = signal<number | null>(null);
  readonly viendoUsos = signal<ElementoDeCatalogo | null>(null);
  readonly historial = signal<EntradaDeHistorial[] | null>(null);
  readonly cargandoHistorial = signal(false);
  readonly arrastrando = signal<number | null>(null);

  readonly selectorDeBanco = signal(false);
  readonly archivosDelBanco = signal<ArchivoEnElBanco[]>([]);
  readonly cargandoBanco = signal(false);
  readonly errorDelBanco = signal('');

  readonly importacion = signal<{ nombreDelArchivo: string; filas: Record<string, string>[]; resultado: ResultadoDeImportacion } | null>(null);
  readonly importando = signal(false);

  readonly FILTRO_ACTIVO: readonly OpcionDeFiltro[] = [
    { id: 'todos', etiqueta: 'Todos los estados' },
    { id: 'activos', etiqueta: 'Se ofrecen' },
    { id: 'desactivados', etiqueta: 'Desactivados' },
  ];
  readonly FILTRO_FICHA: readonly OpcionDeFiltro[] = [
    { id: 'todas', etiqueta: 'Todas las fichas' },
    { id: 'completa', etiqueta: 'Ficha completa' },
    { id: 'preliminar', etiqueta: 'Definición preliminar' },
    { id: 'pendiente', etiqueta: 'Ficha pendiente' },
  ];

  readonly pestanas = computed<readonly OpcionSegmentada[]>(() => [
    { id: 'territorios-sonoros', etiqueta: 'Territorios sonoros', conteo: this.listas()['territorios-sonoros'].length },
    { id: 'practicas-musicales', etiqueta: 'Prácticas musicales', conteo: this.listas()['practicas-musicales'].length },
  ]);

  readonly elementos = computed(() => this.listas()[this.tipo()]);
  readonly esPractica = computed(() => this.tipo() === 'practicas-musicales');
  readonly rotulo = computed(() => this.esPractica()
    ? { singular: 'práctica musical', plural: 'prácticas musicales', articulo: 'la' }
    : { singular: 'territorio sonoro', plural: 'territorios sonoros', articulo: 'el' });

  readonly hayFiltros = computed(() => this.busqueda().trim() !== '' || this.filtroActivo() !== 'todos' || this.filtroFicha() !== 'todas');

  /** Las filas visibles: las prácticas se agrupan bajo su principal; con filtros, cada una se ve por sí sola. */
  readonly filas = computed<FilaDeCatalogo[]>(() => {
    const todos = this.elementos();
    const termino = sinTildes(this.busqueda().trim());
    const coincide = (e: ElementoDeCatalogo): boolean =>
      (termino === '' || sinTildes(`${e.nombre} ${e.slug} ${e.sinonimos ?? ''}`).includes(termino))
      && (this.filtroActivo() === 'todos' || (this.filtroActivo() === 'activos') === e.activo)
      && (this.filtroFicha() === 'todas' || e.estadoDeFicha === this.filtroFicha());
    const porOrden = (a: ElementoDeCatalogo, b: ElementoDeCatalogo): number => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es');

    if (this.hayFiltros() || !this.esPractica()) {
      const visibles = todos.filter(coincide).sort(porOrden);
      return visibles.map((e, i) => ({ e, nivel: 0, primero: i === 0, ultimo: i === visibles.length - 1 }));
    }
    const raices = todos.filter(e => e.padreId === null).sort(porOrden);
    const salida: FilaDeCatalogo[] = [];
    raices.forEach((r, i) => {
      salida.push({ e: r, nivel: 0, primero: i === 0, ultimo: i === raices.length - 1 });
      const hijos = todos.filter(h => h.padreId === r.id).sort(porOrden);
      hijos.forEach((h, j) => salida.push({ e: h, nivel: 1, primero: j === 0, ultimo: j === hijos.length - 1 }));
    });
    return salida;
  });

  readonly principalesPosibles = computed(() => {
    const f = this.formulario();
    return this.listas()['practicas-musicales']
      .filter(e => e.padreId === null && e.id !== f?.id)
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
  });

  readonly resumen = computed(() => {
    const todos = this.elementos();
    return {
      total: todos.length,
      pendientes: todos.filter(e => e.estadoDeFicha === 'pendiente').length,
      preliminares: todos.filter(e => e.estadoDeFicha === 'preliminar').length,
    };
  });

  constructor() {
    effect(() => {
      if (!this.enabled()) { return; }
      untracked(() => { void this.cargar(); });
    });
  }

  elegirPestana(id: string): void {
    this.tipo.set(id as TipoDeCatalogo);
    this.busqueda.set('');
    this.filtroActivo.set('todos');
    this.filtroFicha.set('todas');
    this.aviso.set(null);
    this.error.set(null);
    this.confirmandoBorrado.set(null);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorDeCarga.set(null);
    const [t, p] = await Promise.all([this.api.listar('territorios-sonoros'), this.api.listar('practicas-musicales')]);
    if (t.ok && p.ok && t.data && p.data) {
      this.listas.set({ 'territorios-sonoros': t.data.items, 'practicas-musicales': p.data.items });
      this.cargado.set(true);
    } else {
      this.errorDeCarga.set(t.error ?? p.error ?? 'No fue posible consultar los catálogos.');
    }
    this.cargando.set(false);
  }

  private reemplazarLista(tipo: TipoDeCatalogo, items: ElementoDeCatalogo[]): void {
    this.listas.update(l => ({ ...l, [tipo]: items }));
  }

  private reemplazarElemento(tipo: TipoDeCatalogo, e: ElementoDeCatalogo): void {
    this.listas.update(l => {
      const actual = l[tipo];
      const existe = actual.some(x => x.id === e.id);
      return { ...l, [tipo]: existe ? actual.map(x => (x.id === e.id ? e : x)) : [...actual, e] };
    });
  }

  // ───────── Presentación ─────────

  tonoDeFicha(e: ElementoDeCatalogo): TonoDeEstado {
    return e.estadoDeFicha === 'completa' ? 'logrado' : e.estadoDeFicha === 'preliminar' ? 'en_curso' : 'requiere_accion';
  }

  etiquetaDeFicha(e: ElementoDeCatalogo): string {
    return e.estadoDeFicha === 'completa' ? 'Ficha completa' : e.estadoDeFicha === 'preliminar' ? 'Definición preliminar' : 'Ficha pendiente';
  }

  accionesDe(e: ElementoDeCatalogo): AccionDeRegistro[] {
    const enUso = e.totalDeUsos > 0 || e.subelementos > 0;
    return [
      { id: 'editar', etiqueta: 'Editar la ficha', tono: 'principal', deshabilitada: this.guardando() },
      { id: 'usos', etiqueta: 'Dónde se usa' },
      { id: 'activo', etiqueta: e.activo ? 'Desactivar' : 'Activar', deshabilitada: this.guardando() },
      {
        id: 'eliminar', etiqueta: 'Eliminar', tono: 'peligro', deshabilitada: this.guardando() || enUso,
        motivo: e.subelementos > 0 ? 'Tiene subelementos.' : 'Está en uso: desactívalo.',
      },
    ];
  }

  ejecutarAccion(e: ElementoDeCatalogo, accion: string): void {
    switch (accion) {
      case 'editar': this.editar(e); break;
      case 'usos': this.viendoUsos.set(e); break;
      case 'activo': void this.cambiarActivo(e); break;
      case 'eliminar': this.confirmandoBorrado.set(e.id); break;
    }
  }

  // ───────── Alta y edición ─────────

  nuevo(): void {
    this.aviso.set(null); this.error.set(null); this.historial.set(null);
    this.formulario.set({ ...VACIO });
  }

  editar(e: ElementoDeCatalogo): void {
    this.aviso.set(null); this.error.set(null); this.historial.set(null);
    this.formulario.set({
      id: e.id, nombre: e.nombre, activo: e.activo, padreId: e.padreId, sinonimos: e.sinonimos ?? '', observaciones: e.observaciones ?? '',
      definicionBreve: e.definicionBreve ?? '', definicionAmpliada: e.definicionAmpliada ?? '', caracteristicas: e.caracteristicas ?? '',
      relacionTerritorial: e.relacionTerritorial ?? '', contextos: e.contextos ?? '', ejemplos: e.ejemplos ?? '', fuentes: e.fuentes ?? '',
      esPreliminar: e.esPreliminar, imagenArchivoId: e.imagenArchivoId, textoAlternativoRecurso: e.textoAlternativoRecurso ?? '',
    });
  }

  cerrarFormulario(): void { this.formulario.set(null); this.selectorDeBanco.set(false); this.error.set(null); }

  campo<K extends keyof FormularioUI>(clave: K, valor: FormularioUI[K]): void {
    const f = this.formulario();
    if (f) { this.formulario.set({ ...f, [clave]: valor }); }
  }

  elegirPadre(valor: string): void { this.campo('padreId', valor === '' ? null : Number(valor)); }

  /** Lo que impide guardar, dicho en claro; el servidor repite estas reglas. */
  readonly problemas = computed<string[]>(() => {
    const f = this.formulario();
    if (!f) { return []; }
    const p: string[] = [];
    if (f.nombre.trim() === '') { p.push('Escribe el nombre.'); }
    if (f.nombre.trim().length > 140) { p.push('El nombre admite hasta 140 caracteres.'); }
    if ((f.definicionBreve ?? '').length > 800) { p.push('La definición breve admite hasta 800 caracteres.'); }
    if ((f.definicionAmpliada ?? '').length > 8000) { p.push('La ficha ampliada admite hasta 8000 caracteres.'); }
    if (f.imagenArchivoId !== null && (f.textoAlternativoRecurso ?? '').trim() === '') { p.push('La imagen necesita su texto alternativo.'); }
    return p;
  });

  private aSolicitud(f: FormularioUI): FormularioDeElemento {
    const t = (v: string | null): string | null => (v && v.trim() !== '' ? v.trim() : null);
    return {
      nombre: f.nombre.trim(), activo: f.activo, padreId: this.esPractica() ? f.padreId : null, sinonimos: t(f.sinonimos),
      observaciones: t(f.observaciones), definicionBreve: t(f.definicionBreve), definicionAmpliada: t(f.definicionAmpliada),
      caracteristicas: t(f.caracteristicas), relacionTerritorial: this.esPractica() ? null : t(f.relacionTerritorial),
      contextos: t(f.contextos), ejemplos: t(f.ejemplos), fuentes: t(f.fuentes), esPreliminar: f.esPreliminar,
      imagenArchivoId: f.imagenArchivoId, textoAlternativoRecurso: t(f.textoAlternativoRecurso),
    };
  }

  async guardar(): Promise<void> {
    const f = this.formulario();
    if (!f || this.guardando()) { return; }
    if (this.problemas().length > 0) { this.error.set(this.problemas()[0]); return; }
    this.guardando.set(true);
    this.error.set(null);
    const tipo = this.tipo();
    const r = f.id === null ? await this.api.crear(tipo, this.aSolicitud(f)) : await this.api.guardar(tipo, f.id, this.aSolicitud(f));
    this.guardando.set(false);
    if (!r.ok || !r.data) { this.error.set(r.error ?? 'No fue posible guardar.'); return; }
    this.reemplazarElemento(tipo, r.data);
    this.formulario.set(null);
    this.aviso.set(f.id === null ? `Se añadió «${r.data.nombre}».` : `Se guardó «${r.data.nombre}».`);
  }

  async cambiarActivo(e: ElementoDeCatalogo): Promise<void> {
    this.aviso.set(null); this.error.set(null);
    this.guardando.set(true);
    const r = await this.api.cambiarActivo(this.tipo(), e.id, !e.activo);
    this.guardando.set(false);
    if (!r.ok || !r.data) { this.error.set(r.error ?? 'No fue posible cambiar el estado.'); return; }
    this.reemplazarElemento(this.tipo(), r.data);
    this.aviso.set(r.data.activo ? `«${e.nombre}» vuelve a ofrecerse.` : `«${e.nombre}» deja de ofrecerse; conserva sus vínculos.`);
  }

  async eliminar(e: ElementoDeCatalogo): Promise<void> {
    this.guardando.set(true);
    const r = await this.api.eliminar(this.tipo(), e.id);
    this.guardando.set(false);
    this.confirmandoBorrado.set(null);
    if (!r.ok) { this.error.set(r.error ?? 'No fue posible eliminar.'); return; }
    this.listas.update(l => ({ ...l, [this.tipo()]: l[this.tipo()].filter(x => x.id !== e.id) }));
    this.aviso.set(`Se eliminó «${e.nombre}».`);
  }

  async verHistorial(): Promise<void> {
    const f = this.formulario();
    if (!f || f.id === null) { return; }
    if (this.historial() !== null) { this.historial.set(null); return; }
    this.cargandoHistorial.set(true);
    const r = await this.api.historial(this.tipo(), f.id);
    this.historial.set(r.ok && r.data ? r.data.items : []);
    this.cargandoHistorial.set(false);
  }

  // ───────── Orden ─────────

  /** Pone `e` en la posición de `destino` entre sus hermanos y guarda el orden completo. */
  async ordenarEntre(e: ElementoDeCatalogo, destino: ElementoDeCatalogo): Promise<void> {
    if (this.hayFiltros() || e.id === destino.id || e.padreId !== destino.padreId) { return; }
    const hermanos = this.elementos().filter(x => x.padreId === e.padreId).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
    const sin = hermanos.filter(x => x.id !== e.id);
    sin.splice(sin.findIndex(x => x.id === destino.id) + (hermanos.indexOf(e) < hermanos.indexOf(destino) ? 1 : 0), 0, e);
    await this.guardarOrden(e.padreId, sin);
  }

  async mover(e: ElementoDeCatalogo, sentido: -1 | 1): Promise<void> {
    if (this.hayFiltros()) { return; }
    const hermanos = this.elementos().filter(x => x.padreId === e.padreId).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
    const i = hermanos.findIndex(x => x.id === e.id);
    const j = i + sentido;
    if (j < 0 || j >= hermanos.length) { return; }
    [hermanos[i], hermanos[j]] = [hermanos[j], hermanos[i]];
    await this.guardarOrden(e.padreId, hermanos);
  }

  private async guardarOrden(padreId: number | null, hermanosEnOrden: ElementoDeCatalogo[]): Promise<void> {
    const todos = this.elementos();
    const porOrden = (a: ElementoDeCatalogo, b: ElementoDeCatalogo): number => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es');
    // El orden completo: las raíces con sus hijas detrás. Solo cambia el grupo de hermanos que se movió.
    const raices = padreId === null ? hermanosEnOrden : todos.filter(x => x.padreId === null).sort(porOrden);
    const ids: number[] = [];
    for (const r of raices) {
      ids.push(r.id);
      const hijas = padreId === r.id ? hermanosEnOrden : todos.filter(x => x.padreId === r.id).sort(porOrden);
      ids.push(...hijas.map(h => h.id));
    }
    // Lo que no encaja en dos niveles (por si algún dato antiguo lo tuviera) se conserva al final.
    ids.push(...todos.filter(x => !ids.includes(x.id)).sort(porOrden).map(x => x.id));
    this.guardando.set(true);
    this.error.set(null);
    const r = await this.api.ordenar(this.tipo(), ids);
    this.guardando.set(false);
    if (!r.ok || !r.data) { this.error.set(r.error ?? 'No fue posible guardar el orden.'); return; }
    this.reemplazarLista(this.tipo(), r.data.items);
  }

  empezarArrastre(e: ElementoDeCatalogo, evento: DragEvent): void {
    if (this.hayFiltros()) { evento.preventDefault(); return; }
    this.arrastrando.set(e.id);
    evento.dataTransfer?.setData('text/plain', String(e.id));
    if (evento.dataTransfer) { evento.dataTransfer.effectAllowed = 'move'; }
  }

  sobreFila(evento: DragEvent): void {
    if (this.arrastrando() !== null) { evento.preventDefault(); }
  }

  soltarSobre(destino: ElementoDeCatalogo, evento: DragEvent): void {
    evento.preventDefault();
    const origen = this.elementos().find(x => x.id === this.arrastrando());
    this.arrastrando.set(null);
    if (origen) { void this.ordenarEntre(origen, destino); }
  }

  // ───────── Imagen ─────────

  async abrirBanco(): Promise<void> {
    this.selectorDeBanco.set(true);
    this.cargandoBanco.set(true);
    this.errorDelBanco.set('');
    const r = await this.banco.listar('institucional', { tamano: 60 });
    if (r.ok && r.data) { this.archivosDelBanco.set(r.data.items.filter(a => a.tipo.startsWith('image/'))); }
    else { this.errorDelBanco.set(r.error ?? 'No fue posible consultar el Banco de archivos.'); }
    this.cargandoBanco.set(false);
  }

  elegirDelBanco(a: ArchivoEnElBanco): void {
    this.campo('imagenArchivoId', a.id);
    if (!(this.formulario()?.textoAlternativoRecurso ?? '').trim() && a.alt) { this.campo('textoAlternativoRecurso', a.alt); }
    this.selectorDeBanco.set(false);
  }

  alSubirImagen(url: string): void {
    const id = Number(ID_DE_ARCHIVO.exec(url)?.[1]);
    if (id) { this.campo('imagenArchivoId', id); }
  }

  quitarImagen(): void { this.campo('imagenArchivoId', null); this.campo('textoAlternativoRecurso', ''); }

  urlDeLaImagen(id: number | null): string | null {
    return id === null ? null : `/api/v1/publico/archivos/${id}`;
  }

  // ───────── Hoja de cálculo ─────────

  exportar(): void {
    const tipo = this.tipo();
    const csv = aCsv(tipo, this.elementos());
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.aviso.set(`Se descargó la hoja de ${this.rotulo().plural}. Complétala en Excel y vuelve a importarla.`);
  }

  async alElegirArchivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) { return; }
    this.aviso.set(null); this.error.set(null);
    if (archivo.size > 2_000_000) { this.error.set('La hoja pesa más de 2 MB. Divídela en partes.'); return; }
    const filas = leerCsv(await archivo.text());
    if (filas.length === 0) { this.error.set('La hoja no trae filas. Revisa que la primera línea tenga los títulos de las columnas.'); return; }
    this.importando.set(true);
    const r = await this.api.importar(this.tipo(), filas, false);
    this.importando.set(false);
    if (!r.ok || !r.data) { this.error.set(r.error ?? 'No fue posible revisar la hoja.'); return; }
    this.importacion.set({ nombreDelArchivo: archivo.name, filas, resultado: r.data });
  }

  async aplicarImportacion(): Promise<void> {
    const i = this.importacion();
    if (!i || i.resultado.conErrores > 0) { return; }
    this.importando.set(true);
    const r = await this.api.importar(this.tipo(), i.filas, true);
    this.importando.set(false);
    if (!r.ok || !r.data) { this.error.set(r.error ?? 'No fue posible aplicar la hoja.'); return; }
    if (!r.data.aplicada) { this.importacion.set({ ...i, resultado: r.data }); return; }
    this.importacion.set(null);
    await this.cargar();
    this.aviso.set(`Se aplicó la hoja: ${r.data.crea} nuevos y ${r.data.actualiza} actualizados.`);
  }

  cerrarImportacion(): void { this.importacion.set(null); }

  cuenta(texto: string | null, max: number): string { return `${(texto ?? '').length} de ${max}`; }
}
