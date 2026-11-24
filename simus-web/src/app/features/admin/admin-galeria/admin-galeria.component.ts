import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowDown, LucideArrowUp, LucidePlay, LucideStar } from '@lucide/angular';
import { AlbumDeLaConsola, GaleriaAdminService, ItemDeLaConsola } from '../../../core/services/galeria-admin.service';
import { ROTULO_DE_TIPO, TipoDeAlbum } from '../../../core/services/galeria.service';
import { BarraDeListaComponent } from '../../../shared/components/ui/barra-de-lista/barra-de-lista.component';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { BuscadorDeListaComponent } from '../../../shared/components/ui/buscador/buscador-de-lista.component';
import { CampoDeSeleccionComponent } from '../../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { DialogoDeFormularioComponent } from '../../../shared/components/ui/dialogo-de-formulario/dialogo-de-formulario.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { AccionDeRegistro, MenuDeAccionesComponent } from '../../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';
import { PaginacionDeListaComponent } from '../../../shared/components/ui/paginacion-de-lista/paginacion-de-lista.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { conteoRotulado, fechaLarga } from '../../gallery/domain/galeria-modelo';
import {
  AlbumEditable, ItemEditable, LARGOS, albumDesdeServidor, albumNuevo, albumParaGuardar, enlaceDeVideo, esSlugValido, itemDesdeServidor, itemParaGuardar,
  problemasDeAlbum, problemasDeItems, slugDeTitulo,
} from '../domain/galeria-edicion';
import { AdminGaleriaItemsComponent } from './admin-galeria-items.component';

type Pestana = 'albumes' | 'sin-album';

const sinTildes = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * LA SECCIÓN «GALERÍA» DE LA CONSOLA: álbumes de fotos, de videos y mixtos, sus ítems y los ítems «sin álbum».
 *
 * <b>POR QUÉ EXISTE.</b> La Galería pública tenía API institucional pero ninguna pantalla: los álbumes solo se tocaban con una
 * siembra. Aquí se crean, editan, ordenan, publican, destacan y retiran; cada álbum se edita completo (datos, portada, ítems) y se guarda
 * de una vez, y la vista previa dice cómo se verá en el portal antes de publicar.
 *
 * <b>SE ABRE CON EL MÓDULO «BANCO DE ARCHIVOS»</b> (el mismo que ya exige la API): las fotos salen del Banco, y así no hay un permiso nuevo
 * que conceder ni cuentas que cambien. Quien administra los usuarios la activa o la quita por cuenta con el mecanismo de módulos de siempre.
 *
 * <b>EL ORDEN SOLO SE CAMBIA SIN FILTROS</b>: reordenar una lista filtrada movería álbumes que no se ven. <b>DESTACADOS</b> alimenta el
 * carrusel «Destacados» del portal; sin ningún álbum publicado y marcado, el portal muestra los tres más recientes.
 */
@Component({
  selector: 'app-admin-galeria',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, LucideArrowDown, LucideArrowUp, LucidePlay, LucideStar, AdminGaleriaItemsComponent, BarraDeListaComponent, BotonComponent,
    BuscadorDeListaComponent, CampoDeSeleccionComponent, DialogoDeFormularioComponent, EstadoDeListaComponent, FiltroDesplegableComponent,
    IndicadorDeEstadoComponent, MenuDeAccionesComponent, PaginacionDeListaComponent, SelectorSegmentadoComponent,
  ],
  templateUrl: './admin-galeria.component.html',
})
export class AdminGaleriaComponent {
  private readonly api = inject(GaleriaAdminService);

  readonly enabled = input(true);

  readonly LARGOS = LARGOS;
  readonly ROTULO_DE_TIPO = ROTULO_DE_TIPO;
  readonly cantidades = [10, 25, 50] as const;

  readonly FILTRO_TIPO: readonly OpcionDeFiltro[] = [
    { id: 'todos', etiqueta: 'Todos los tipos' },
    { id: 'fotos', etiqueta: 'Fotos' },
    { id: 'videos', etiqueta: 'Videos' },
    { id: 'mixto', etiqueta: 'Fotos y videos' },
  ];
  readonly FILTRO_ESTADO: readonly OpcionDeFiltro[] = [
    { id: 'todos', etiqueta: 'Todos los estados' },
    { id: 'publicados', etiqueta: 'Publicados' },
    { id: 'borradores', etiqueta: 'Borradores' },
    { id: 'destacados', etiqueta: 'Destacados' },
  ];
  readonly OPCIONES_DE_TIPO = [
    { valor: 'fotos', etiqueta: 'Fotos' },
    { valor: 'videos', etiqueta: 'Videos' },
    { valor: 'mixto', etiqueta: 'Fotos y videos (mixto)' },
  ];

  // ───────── Lista de álbumes ─────────
  readonly pestana = signal<Pestana>('albumes');
  readonly cargando = signal(true);
  readonly cargado = signal(false);
  readonly errorDeLista = signal('');
  readonly albumes = signal<AlbumDeLaConsola[]>([]);
  readonly busqueda = signal('');
  readonly filtroTipo = signal('todos');
  readonly filtroEstado = signal('todos');
  readonly pagina = signal(1);
  readonly porPagina = signal<number>(10);
  readonly trabajando = signal(false);
  readonly aviso = signal('');
  readonly error = signal('');
  readonly eliminando = signal<AlbumDeLaConsola | null>(null);
  readonly errorAlEliminar = signal('');

  readonly pestanas = computed<OpcionSegmentada[]>(() => [
    { id: 'albumes', etiqueta: 'Álbumes', conteo: this.albumes().length },
    { id: 'sin-album', etiqueta: 'Sin álbum', ...(this.sueltosCargados() ? { conteo: this.sueltos().length } : {}) },
  ]);

  readonly hayFiltros = computed(() => this.busqueda().trim() !== '' || this.filtroTipo() !== 'todos' || this.filtroEstado() !== 'todos');

  readonly filtrados = computed(() => {
    const q = sinTildes(this.busqueda().trim());
    const tipo = this.filtroTipo();
    const estado = this.filtroEstado();
    return this.albumes().filter(a =>
      (!q || sinTildes(`${a.titulo} ${a.slug} ${a.lugar ?? ''} ${a.descripcion ?? ''}`).includes(q))
      && (tipo === 'todos' || a.tipo === tipo)
      && (estado === 'todos' || (estado === 'publicados' && a.publicado) || (estado === 'borradores' && !a.publicado) || (estado === 'destacados' && a.destacado)));
  });

  readonly totalDePaginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.porPagina())));

  readonly filas = computed(() => {
    const todos = this.albumes();
    const desde = (Math.min(this.pagina(), this.totalDePaginas()) - 1) * this.porPagina();
    return this.filtrados().slice(desde, desde + this.porPagina()).map(a => {
      const posicion = todos.findIndex(x => x.slug === a.slug);
      return { a, primero: posicion === 0, ultimo: posicion === todos.length - 1 };
    });
  });

  readonly resumen = computed(() => {
    const t = this.albumes();
    return { total: t.length, publicados: t.filter(a => a.publicado).length, destacados: t.filter(a => a.publicado && a.destacado).length };
  });

  // ───────── Editor de un álbum ─────────
  readonly modelo = signal<AlbumEditable | null>(null);
  readonly cargandoAlbum = signal(false);
  readonly guardando = signal(false);
  readonly sinGuardar = signal(false);
  readonly errorDelEditor = signal('');
  readonly avisoDelEditor = signal('');
  private slugEscritoAMano = false;

  readonly problemas = computed(() => { const m = this.modelo(); return m ? problemasDeAlbum(m) : []; });

  /** La imagen que representa al álbum: la portada elegida, la primera foto o la miniatura del primer video. */
  readonly portadaDeLaVista = computed(() => {
    const m = this.modelo();
    if (!m) { return null; }
    if (m.portadaArchivoId !== null && m.portadaUrl) { return m.portadaUrl; }
    return m.items.find(i => i.tipoItem === 'foto' && i.imagenUrl)?.imagenUrl ?? m.items.find(i => i.imagenUrl)?.imagenUrl ?? null;
  });

  readonly muestrasDeLaVista = computed(() => (this.modelo()?.items ?? []).slice(0, 8));

  readonly conteoDeLaVista = computed(() => {
    const items = this.modelo()?.items ?? [];
    return conteoRotulado(items.filter(i => i.tipoItem === 'foto').length, items.filter(i => i.tipoItem === 'video').length);
  });

  readonly subtituloDeLaVista = computed(() => {
    const m = this.modelo();
    return m ? [m.lugar.trim(), fechaLarga(m.fechaReferencia)].filter(Boolean).join(' · ') : '';
  });

  // ───────── Ítems sin álbum ─────────
  readonly sueltos = signal<ItemEditable[]>([]);
  readonly sueltosCargados = signal(false);
  readonly cargandoSueltos = signal(false);
  readonly errorDeSueltos = signal('');
  readonly sueltosSinGuardar = signal(false);
  readonly guardandoSueltos = signal(false);
  readonly problemasDeSueltos = computed(() => problemasDeItems(this.sueltos(), null));

  constructor() {
    effect(() => {
      if (!this.enabled()) { return; }
      untracked(() => { void this.cargar(); });
    });
  }

  // ───────── Carga ─────────
  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorDeLista.set('');
    const r = await this.api.albumes();
    if (r.ok) { this.albumes.set(r.data ?? []); this.cargado.set(true); } else { this.errorDeLista.set(r.error ?? ''); }
    this.cargando.set(false);
  }

  elegirPestana(id: string): void {
    this.pestana.set(id as Pestana);
    this.aviso.set('');
    this.error.set('');
    if (id === 'sin-album' && !this.sueltosCargados()) { void this.cargarSueltos(); }
  }

  async cargarSueltos(): Promise<void> {
    this.cargandoSueltos.set(true);
    this.errorDeSueltos.set('');
    const r = await this.api.sueltos();
    if (r.ok) { this.sueltos.set((r.data ?? []).map(itemDesdeServidor)); this.sueltosCargados.set(true); this.sueltosSinGuardar.set(false); }
    else { this.errorDeSueltos.set(r.error ?? ''); }
    this.cargandoSueltos.set(false);
  }

  // ───────── Presentación de la lista ─────────
  tonoDeEstado(a: AlbumDeLaConsola): 'logrado' | 'preliminar' { return a.publicado ? 'logrado' : 'preliminar'; }
  conteo(a: AlbumDeLaConsola): string { return conteoRotulado(a.totalFotos, a.totalVideos) || 'Sin ítems'; }
  anio(a: AlbumDeLaConsola): string { return a.fechaReferencia ? a.fechaReferencia.slice(0, 4) : ''; }
  rutaDelPortal(slug: string): string { return `/galeria/album/${slug}`; }

  accionesDe(a: AlbumDeLaConsola): AccionDeRegistro[] {
    const ocupado = this.trabajando();
    const incompleto = a.totalFotos + a.totalVideos === 0;
    return [
      { id: 'editar', etiqueta: 'Editar el álbum', tono: 'principal', deshabilitada: ocupado },
      a.publicado
        ? { id: 'despublicar', etiqueta: 'Despublicar', deshabilitada: ocupado }
        : { id: 'publicar', etiqueta: 'Publicar', deshabilitada: ocupado || incompleto, motivo: 'Un álbum sin ítems no se publica: ábrelo y añade fotos o videos.' },
      a.destacado
        ? { id: 'quitar-destacado', etiqueta: 'Quitar de «Destacados»', deshabilitada: ocupado }
        : { id: 'destacar', etiqueta: 'Destacar en el portal', deshabilitada: ocupado },
      a.publicado
        ? { id: 'ver', etiqueta: 'Ver en el portal', enlace: this.rutaDelPortal(a.slug), nuevaPestana: true }
        : { id: 'ver', etiqueta: 'Ver en el portal', deshabilitada: true, motivo: 'Es un borrador: publícalo para verlo en el portal. La vista previa está en el editor.' },
      { id: 'eliminar', etiqueta: 'Eliminar', tono: 'peligro', deshabilitada: ocupado },
    ];
  }

  ejecutarAccion(a: AlbumDeLaConsola, accion: string): void {
    switch (accion) {
      case 'editar': void this.abrir(a.slug); break;
      case 'publicar': void this.cambiarEstado(a, { publicado: true }, `«${a.titulo}» quedó publicado.`); break;
      case 'despublicar': void this.cambiarEstado(a, { publicado: false }, `«${a.titulo}» dejó de estar publicado.`); break;
      case 'destacar': void this.cambiarEstado(a, { destacado: true }, `«${a.titulo}» entra al carrusel «Destacados»${a.publicado ? '' : ' cuando lo publiques'}.`); break;
      case 'quitar-destacado': void this.cambiarEstado(a, { destacado: false }, `«${a.titulo}» salió de «Destacados».`); break;
      case 'eliminar': this.errorAlEliminar.set(''); this.eliminando.set(a); break;
    }
  }

  cambiarFiltro(clave: 'tipo' | 'estado', valor: string): void {
    (clave === 'tipo' ? this.filtroTipo : this.filtroEstado).set(valor);
    this.pagina.set(1);
  }

  buscar(texto: string): void { this.busqueda.set(texto); this.pagina.set(1); }

  limpiarFiltros(): void { this.busqueda.set(''); this.filtroTipo.set('todos'); this.filtroEstado.set('todos'); this.pagina.set(1); }

  cambiarPorPagina(n: number): void { this.porPagina.set(n); this.pagina.set(1); }

  // ───────── Acciones de la lista ─────────
  private reemplazar(a: AlbumDeLaConsola): void { this.albumes.update(l => l.map(x => (x.slug === a.slug ? a : x))); }

  async cambiarEstado(a: AlbumDeLaConsola, cambio: { publicado?: boolean; destacado?: boolean }, mensaje: string): Promise<void> {
    this.trabajando.set(true);
    this.aviso.set('');
    this.error.set('');
    const r = await this.api.cambiarEstado(a.slug, cambio);
    this.trabajando.set(false);
    if (!r.ok || !r.data) { this.error.set(r.error ?? 'No fue posible cambiar el estado del álbum.'); return; }
    this.reemplazar(r.data);
    this.aviso.set(mensaje);
  }

  async mover(a: AlbumDeLaConsola, sentido: -1 | 1): Promise<void> {
    const lista = [...this.albumes()];
    const i = lista.findIndex(x => x.slug === a.slug);
    const j = i + sentido;
    if (i < 0 || j < 0 || j >= lista.length || this.trabajando()) { return; }
    [lista[i], lista[j]] = [lista[j], lista[i]];
    const antes = this.albumes();
    this.albumes.set(lista);
    this.trabajando.set(true);
    this.aviso.set('');
    this.error.set('');
    const r = await this.api.ordenar(lista.map(x => x.slug));
    this.trabajando.set(false);
    if (!r.ok || !r.data) { this.albumes.set(antes); this.error.set(r.error ?? 'No fue posible guardar el orden.'); return; }
    this.albumes.set(r.data);
    this.aviso.set(`«${a.titulo}» ahora está en la posición ${j + 1}.`);
  }

  async confirmarEliminar(): Promise<void> {
    const a = this.eliminando();
    if (!a) { return; }
    this.trabajando.set(true);
    this.errorAlEliminar.set('');
    const r = await this.api.eliminar(a.slug);
    this.trabajando.set(false);
    if (!r.ok) { this.errorAlEliminar.set(r.error ?? 'No fue posible eliminar el álbum.'); return; }
    this.albumes.update(l => l.filter(x => x.slug !== a.slug));
    this.eliminando.set(null);
    this.aviso.set(`Se eliminó «${a.titulo}». Sus fotos siguen en el Banco de archivos.`);
  }

  // ───────── Editor ─────────
  nuevo(): void {
    this.slugEscritoAMano = false;
    this.errorDelEditor.set('');
    this.avisoDelEditor.set('');
    this.sinGuardar.set(true);
    this.modelo.set(albumNuevo(this.albumes().length + 1));
  }

  async abrir(slug: string): Promise<void> {
    this.cargandoAlbum.set(true);
    this.errorDelEditor.set('');
    this.avisoDelEditor.set('');
    this.aviso.set('');
    this.error.set('');
    const r = await this.api.album(slug);
    this.cargandoAlbum.set(false);
    if (!r.ok || !r.data) { this.error.set(r.error ?? 'No encontramos ese álbum.'); return; }
    this.slugEscritoAMano = true;
    this.modelo.set(albumDesdeServidor(r.data));
    this.sinGuardar.set(false);
  }

  volver(): void {
    if (this.sinGuardar() && !globalThis.confirm('Hay cambios sin guardar. ¿Salir sin guardarlos?')) { return; }
    this.modelo.set(null);
    this.sinGuardar.set(false);
    void this.cargar();
  }

  campo<K extends keyof AlbumEditable>(clave: K, valor: AlbumEditable[K]): void {
    this.modelo.update(m => {
      if (!m) { return m; }
      const siguiente = { ...m, [clave]: valor };
      if (clave === 'titulo' && m.esNuevo && !this.slugEscritoAMano) { siguiente.slug = slugDeTitulo(String(valor)); }
      return siguiente;
    });
    this.sinGuardar.set(true);
  }

  escribirDireccion(valor: string): void { this.slugEscritoAMano = true; this.campo('slug', valor.toLowerCase().replace(/\s+/g, '-')); }

  cambiarItems(items: ItemEditable[]): void { this.campo('items', items); }

  cambiarPortada(p: { archivoId: number; url: string } | null): void {
    this.modelo.update(m => (m ? { ...m, portadaArchivoId: p?.archivoId ?? null, portadaUrl: p?.url ?? null } : m));
    this.sinGuardar.set(true);
  }

  listaDetectada(url: string): void {
    const m = this.modelo();
    if (m && !m.listaOrigenUrl.trim()) { this.campo('listaOrigenUrl', url); this.avisoDelEditor.set('La lista de reproducción de origen quedó como «Ver la lista en YouTube» del álbum.'); }
  }

  direccionValida(m: AlbumEditable): boolean { return !m.esNuevo || esSlugValido(m.slug); }

  async guardar(cambios: { publicado?: boolean } = {}): Promise<void> {
    const actual = this.modelo();
    if (!actual || this.guardando()) { return; }
    const m = { ...actual, ...cambios };
    const problemas = problemasDeAlbum(m);
    if (problemas.length > 0) { this.errorDelEditor.set('Corrige lo señalado antes de guardar.'); return; }
    this.guardando.set(true);
    this.errorDelEditor.set('');
    this.avisoDelEditor.set('');
    const r = await this.api.guardar(m.slug, albumParaGuardar(m));
    this.guardando.set(false);
    if (!r.ok || !r.data) { this.errorDelEditor.set(r.error ?? 'No fue posible guardar el álbum.'); return; }
    this.modelo.set(albumDesdeServidor(r.data));
    this.sinGuardar.set(false);
    this.avisoDelEditor.set(cambios.publicado === true ? 'El álbum quedó publicado.' : cambios.publicado === false ? 'El álbum dejó de estar publicado.' : actual.esNuevo ? 'El álbum se creó como borrador.' : 'Cambios guardados.');
  }

  publicar(): Promise<void> { return this.guardar({ publicado: true }); }
  despublicar(): Promise<void> { return this.guardar({ publicado: false }); }

  portadaElegida(): boolean { const m = this.modelo(); return !!m && m.portadaArchivoId !== null; }

  enlaceDeLista(m: AlbumEditable): string { return m.listaOrigenUrl.trim(); }

  cuenta(texto: string, maximo: number): string { return `${texto.length} de ${maximo}`; }

  enlaceDelVideo = enlaceDeVideo;
  tipoRotulado(t: TipoDeAlbum): string { return ROTULO_DE_TIPO[t]; }

  // ───────── Sin álbum ─────────
  cambiarSueltos(items: ItemEditable[]): void { this.sueltos.set(items); this.sueltosSinGuardar.set(true); }

  async guardarSueltos(): Promise<void> {
    if (this.guardandoSueltos() || this.problemasDeSueltos().length > 0) { return; }
    this.guardandoSueltos.set(true);
    this.aviso.set('');
    this.error.set('');
    const r = await this.api.guardarSueltos(this.sueltos().map(itemParaGuardar));
    this.guardandoSueltos.set(false);
    if (!r.ok || !r.data) { this.error.set(r.error ?? 'No fue posible guardar los ítems.'); return; }
    this.sueltos.set(r.data.map((i: ItemDeLaConsola) => itemDesdeServidor(i)));
    this.sueltosSinGuardar.set(false);
    this.aviso.set('Los ítems sin álbum se guardaron.');
  }
}
