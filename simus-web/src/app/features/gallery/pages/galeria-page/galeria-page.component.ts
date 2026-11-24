import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideArrowRight, LucideImage, LucideLink, LucidePause, LucidePlay, LucideVideo } from '@lucide/angular';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import { PestanasComponent, OpcionDePestana } from '../../../../shared/components/ui/pestanas/pestanas.component';
import {
  AlbumDeGaleria, AlbumDeGaleriaResumen, ClaseDeItem, GaleriaService, ItemPublicoDeGaleria,
} from '../../../../core/services/galeria.service';
import { GaleriaMuroComponent } from '../../components/galeria-muro.component';
import { GaleriaReproductorComponent } from '../../components/galeria-reproductor.component';
import { GaleriaVisorComponent } from '../../components/galeria-visor.component';
import {
  FotoDeGaleria, GrupoDeFotos, ROTULO_DE_VISTA, VideoDeGaleria, agruparPorAlbum, conteoRotulado, duracionCorta, fechaLarga, fotoDeItem, fotoDePublico, mesYAnio,
  videoDeItem, videoDePublico,
} from '../../domain/galeria-modelo';

/** Las vistas de la Galería: las cuatro pestañas y el álbum abierto desde su tarjeta. */
export type VistaDeGaleria = 'albumes' | 'fotos' | 'videos' | 'sin-album' | 'album';

const VISTAS: readonly VistaDeGaleria[] = ['albumes', 'fotos', 'videos', 'sin-album'];
const POR_PAGINA = 36;
/** Cada cuánto cambia el destacado del encabezado cuando rota solo. */
const MS_POR_DESTACADO = 6000;
/** Cuántas filas del mosaico justificado se previsualizan de cada álbum en la pestaña «Fotos». */
const FILAS_DE_PREVISUALIZACION = 3;
const CUANTOS_DESTACADOS = 3;

type VistaDeOrigen = Exclude<VistaDeGaleria, 'album'>;
/** De dónde se llegó a un álbum: la vista y el desplazamiento en ese momento. */
interface OrigenDeAlbum { vista: VistaDeOrigen; scroll: number }
/** Una imagen del mosaico del encabezado: foto (abre el visor) o miniatura de un video concreto (abre el álbum en ese video). */
interface ImagenDeDestacado { id: number | null; url: string; alt: string; videoId: string | null }

interface ListaDeItems {
  items: ItemPublicoDeGaleria[];
  total: number;
  cargando: boolean;
  cargada: boolean;
  error: string | null;
}
const VACIA: ListaDeItems = { items: [], total: 0, cargando: false, cargada: false, error: null };

/** Una tarjeta del mosaico de álbumes: el álbum y cómo se pinta (grande, ancha, estándar). */
interface TarjetaDeAlbum {
  album: AlbumDeGaleriaResumen;
  forma: 'grande' | 'media' | 'ancha' | 'normal';
}

/**
 * LA GALERÍA PÚBLICA, FIEL A LA MAQUETA APROBADA (opción D; parte).
 *
 * <b>Composición.</b> Portada con el álbum más reciente (título grande, mosaico de sus imágenes) y, debajo, las pestañas
 * «Álbumes», «Fotos», «Videos» y «Sin álbum» (la única diferencia con la maqueta). «Álbumes» = mosaico de todos los álbumes; «Fotos» = todas las fotos
 * en un mosaico justificado agrupado por álbum; «Videos» = reproductor con la lista; «Sin álbum» = archivos sueltos. Un álbum se abre desde su tarjeta
 * (`/galeria/album/<slug>`); la pestaña, el álbum, la foto abierta (`?foto=`) y el video elegido (`?video=`) viajan en la dirección.
 *
 * <b>Sin selector de álbumes ni botones de tipo</b> (cambiaban de tamaño): cada tarjeta rotula lo que contiene.
 *
 * <b>Privacidad del video.</b> Cada video tiene una miniatura propia (Banco de archivos, sembrada una sola vez): no se pide nada a YouTube hasta «Reproducir».
 */
@Component({
  selector: 'app-galeria-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextoWebPipe, NgTemplateOutlet, EsqueletoComponent, RouterLink, PestanasComponent, GaleriaMuroComponent, GaleriaReproductorComponent, GaleriaVisorComponent, LucideArrowLeft, LucideArrowRight, LucidePause, LucideImage, LucideLink, LucidePlay, LucideVideo],
  templateUrl: './galeria-page.component.html',
  styleUrl: './galeria-page.component.css',
})
export class GaleriaPageComponent implements OnInit {
  private readonly servicio = inject(GaleriaService);
  private readonly router = inject(Router);
  private readonly destruccion = inject(DestroyRef);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly albumes = signal<AlbumDeGaleriaResumen[]>([]);
  protected readonly totales = signal({ albumes: 0, fotos: 0, videos: 0, sueltos: 0 });
  /** Los álbumes destacados (los más recientes) en detalle: sus imágenes arman el mosaico de cada diapositiva del encabezado. */
  private readonly destacados = signal<Record<string, AlbumDeGaleria>>({});
  protected readonly diapositiva = signal(0);
  protected readonly pausaManual = signal(false);
  private readonly pausaPorPuntero = signal(false);
  private readonly pausaPorFoco = signal(false);
  private readonly reducirMovimiento = signal(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  /**
   * Los álbumes que rotan arriba. Si la consola marcó alguno como «Destacado» son esos (los más recientes entre ellos, hasta el tope); si ninguno
   * está marcado, son los tres más recientes, como antes de que existiera la marca.
   */
  protected readonly recientes = computed(() => {
    const porFecha = (a: AlbumDeGaleriaResumen, b: AlbumDeGaleriaResumen) => (b.fechaReferencia ?? '').localeCompare(a.fechaReferencia ?? '');
    const marcados = this.albumes().filter(a => a.destacado);
    return [...(marcados.length > 0 ? marcados : this.albumes())].sort(porFecha).slice(0, CUANTOS_DESTACADOS);
  });
  protected readonly destacadoActual = computed(() => this.recientes()[Math.min(this.diapositiva(), Math.max(0, this.recientes().length - 1))] ?? null);
  /** Rota sola solo si nadie la detuvo, nadie la está usando y la persona no pidió menos movimiento. */
  protected readonly rotando = computed(() => this.vista() === 'albumes' && this.recientes().length > 1 && !this.reducirMovimiento() && !this.pausaManual() && !this.pausaPorPuntero() && !this.pausaPorFoco() && this.fotoId() === null);
  protected readonly puedeRotar = computed(() => this.recientes().length > 1 && !this.reducirMovimiento());
  /** De dónde vino quien abrió un álbum (para «Volver» y las migas); por omisión, «Álbumes». */
  protected readonly origen = signal<OrigenDeAlbum | null>(null);
  protected readonly vistaDeOrigen = computed<VistaDeOrigen>(() => this.origen()?.vista ?? 'albumes');
  protected readonly rotuloDeVista = computed(() => { const v = this.vista(); return v === 'album' ? 'el álbum' : ROTULO_DE_VISTA[v]; });
  protected readonly rotuloDeOrigen = computed(() => ROTULO_DE_VISTA[this.vistaDeOrigen()]);
  private scrollAntes = 0;

  protected readonly vista = signal<VistaDeGaleria>('albumes');
  protected readonly slug = signal<string | null>(null);
  protected readonly fotoId = signal<number | null>(null);
  protected readonly videoId = signal<string | null>(null);

  protected readonly album = signal<AlbumDeGaleria | null>(null);
  protected readonly cargandoAlbum = signal(false);
  protected readonly albumNoEncontrado = signal(false);
  private readonly listas = signal<Record<ClaseDeItem, ListaDeItems>>({ fotos: VACIA, videos: VACIA, sueltos: VACIA });
  protected readonly aviso = signal('');

  protected readonly pestanas = computed<readonly OpcionDePestana[]>(() => [
    { id: 'albumes', etiqueta: 'Álbumes', conteo: this.totales().albumes },
    { id: 'fotos', etiqueta: 'Fotos', conteo: this.totales().fotos },
    { id: 'videos', etiqueta: 'Videos', conteo: this.totales().videos },
    { id: 'sin-album', etiqueta: 'Sin álbum', conteo: this.totales().sueltos },
  ]);
  protected readonly pestanaElegida = computed(() => (this.vista() === 'album' ? 'albumes' : this.vista()));

  protected readonly hayAlbumes = computed(() => this.albumes().length > 0 || this.totales().sueltos > 0);
  protected readonly masReciente = computed(() => this.recientes()[0] ?? null);
  /** El mosaico de álbumes: todos menos el de la portada; el primero va grande y los sobrantes llenan la última fila. */
  protected readonly tarjetas = computed<TarjetaDeAlbum[]>(() => {
    const destacado = this.masReciente();
    const l = this.albumes().filter(a => a.slug !== destacado?.slug);
    const out: TarjetaDeAlbum[] = [];
    const conGrande = l.length >= 3;
    if (conGrande) out.push({ album: l[0], forma: 'grande' }, { album: l[1], forma: 'normal' }, { album: l[2], forma: 'normal' });
    const resto = conGrande ? l.slice(3) : l;
    const r = resto.length % 3;
    resto.forEach((a, i) => out.push({ album: a, forma: i >= resto.length - r && r > 0 ? (r === 1 ? 'ancha' : 'media') : 'normal' }));
    return out;
  });

  protected readonly lista = (c: ClaseDeItem) => this.listas()[c];
  protected readonly fotosDeLista = computed<FotoDeGaleria[]>(() => this.listas().fotos.items.filter(i => i.tipoItem === 'foto').map(fotoDePublico));
  protected readonly gruposDeFotos = computed<GrupoDeFotos[]>(() => agruparPorAlbum(this.fotosDeLista()));
  protected readonly videosDeLista = computed<VideoDeGaleria[]>(() => this.listas().videos.items.map(videoDePublico));
  protected readonly sueltos = computed(() => this.listas().sueltos.items);
  protected readonly fotosSueltas = computed<FotoDeGaleria[]>(() => this.sueltos().filter(i => i.tipoItem === 'foto').map(fotoDePublico));
  protected readonly fotosDelAlbum = computed<FotoDeGaleria[]>(() => {
    const a = this.album();
    return a ? a.items.filter(i => i.tipoItem === 'foto').map(i => fotoDeItem(i, a)) : [];
  });
  protected readonly videosDelAlbum = computed<VideoDeGaleria[]>(() => {
    const a = this.album();
    return a ? a.items.filter(i => i.tipoItem === 'video').map(i => videoDeItem(i, a)) : [];
  });
  /** Las fotos que recorre el visor según lo que se está viendo. */
  protected readonly fotosDelVisor = computed<FotoDeGaleria[]>(() => {
    switch (this.vista()) {
      case 'album': return this.fotosDelAlbum();
      case 'fotos': return this.fotosDeLista();
      case 'sin-album': return this.fotosSueltas();
      default: return this.portadaFotos();
    }
  });
  protected readonly indiceDelVisor = computed(() => {
    const id = this.fotoId();
    if (id === null) return null;
    const i = this.fotosDelVisor().findIndex(f => f.id === id);
    return i >= 0 ? i : null;
  });
  /** Las imágenes del mosaico del destacado que se muestra: hasta tres del álbum (fotos o, si es de videos, las miniaturas de videos concretos). */
  protected readonly portadaImagenes = computed<ImagenDeDestacado[]>(() => {
    const r = this.destacadoActual();
    const d = r ? this.destacados()[r.slug] : undefined;
    if (!d) return [];
    const fotos = d.items.filter(i => i.tipoItem === 'foto' && i.url);
    const base: ImagenDeDestacado[] = fotos.length >= 3 ? fotos.map(i => ({ id: i.id as number | null, url: i.url!, alt: i.textoAlternativo ?? '', videoId: null }))
      : d.items.filter(i => i.miniaturaUrl).map(i => ({ id: null, url: i.miniaturaUrl!, alt: `Ver el video «${i.titulo ?? ''}»`, videoId: i.videoId }));
    const lista = [...base];
    if (d.portadaUrl) {
      const i = lista.findIndex(x => x.url === d.portadaUrl);
      if (i > 0) lista.unshift(...lista.splice(i, 1));
    }
    return lista.slice(0, 3);
  });
  private readonly portadaFotos = computed<FotoDeGaleria[]>(() => {
    const r = this.destacadoActual();
    const d = r ? this.destacados()[r.slug] : undefined;
    return d ? d.items.filter(i => i.tipoItem === 'foto').map(i => fotoDeItem(i, d)) : [];
  });
  /** Cuántas fotos tiene cada álbum en total (para «Ver álbum completo» en la pestaña «Fotos»). */
  private readonly totalDeFotosPorAlbum = computed(() => new Map(this.albumes().map(a => [a.slug, a.totalFotos])));
  protected readonly filasDePrevisualizacion = FILAS_DE_PREVISUALIZACION;

  protected readonly conteo = conteoRotulado;
  protected readonly fechaLarga = fechaLarga;
  protected readonly mesYAnio = mesYAnio;
  protected readonly duracion = duracionCorta;

  constructor() {
    // La rotación automática del encabezado: se arma y se desarma sola según `rotando` y se reinicia al cambiar de diapositiva (así el tiempo de lectura es completo).
    effect(onCleanup => {
      if (!this.rotando()) return;
      this.diapositiva();
      const t = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        this.diapositiva.update(i => (i + 1) % Math.max(1, this.recientes().length));
      }, MS_POR_DESTACADO);
      onCleanup(() => clearInterval(t));
    });
  }

  ngOnInit(): void {
    this.router.events.pipe(takeUntilDestroyed(this.destruccion)).subscribe(e => {
      if (e instanceof NavigationStart) this.scrollAntes = window.scrollY;
      else if (e instanceof NavigationEnd) void this.alCambiarLaDireccion();
    });
    void this.iniciar();
  }

  protected async iniciar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    const r = await this.servicio.albumes();
    this.cargando.set(false);
    if (!r.ok || !r.data) {
      this.error.set(r.error ?? 'No fue posible consultar la Galería.');
      return;
    }
    this.albumes.set(r.data.items);
    this.totales.set(r.data.totales);
    await this.alCambiarLaDireccion();
  }

  // ---------------------------------------------------------------- dirección

  private leerDireccion(): { vista: VistaDeGaleria; slug: string | null; foto: number | null; video: string | null } {
    const arbol = this.router.parseUrl(this.router.url);
    const partes = (arbol.root.children['primary']?.segments ?? []).map(s => s.path).slice(1);
    const foto = Number(arbol.queryParams['foto']);
    const video = String(arbol.queryParams['video'] ?? '');
    let vista: VistaDeGaleria = 'albumes';
    let slug: string | null = null;
    if (partes[0] === 'album' && partes[1]) { vista = 'album'; slug = partes[1]; }
    else if ((VISTAS as readonly string[]).includes(partes[0] ?? '')) vista = partes[0] as VistaDeGaleria;
    return { vista, slug, foto: Number.isInteger(foto) && foto > 0 ? foto : null, video: /^[A-Za-z0-9_-]{11}$/.test(video) ? video : null };
  }

  private async alCambiarLaDireccion(): Promise<void> {
    if (this.cargando() || this.error()) return;
    const d = this.leerDireccion();
    const cambioVista = d.vista !== this.vista() || d.slug !== this.slug();
    if (d.vista === 'album' && this.vista() !== 'album') {
      // Se llegó a un álbum desde otra vista: se recuerda cuál y dónde iba el desplazamiento para «Volver»; el álbum abre arriba.
      this.origen.set({ vista: this.vista() as VistaDeOrigen, scroll: this.scrollAntes });
      window.scrollTo(0, 0);
    } else if (d.vista !== 'album' && this.origen()) {
      this.origen.set(null);
    }
    if (d.vista !== 'album' && this.vista() !== d.vista && this.vista() !== 'album') this.fijarPestanas();
    this.vista.set(d.vista);
    this.slug.set(d.slug);
    this.fotoId.set(d.foto);
    this.videoId.set(d.video);
    if (cambioVista) this.aviso.set('');
    await this.cargarLoQueFalta();
  }

  private async cargarLoQueFalta(): Promise<void> {
    switch (this.vista()) {
      case 'albumes': await this.cargarDestacado(); break;
      case 'fotos': await this.cargarClase('fotos'); break;
      case 'videos': await this.cargarClase('videos'); break;
      case 'sin-album': await this.cargarClase('sueltos'); break;
      case 'album': await this.cargarAlbum(this.slug()!); break;
    }
  }

  protected irA(id: string): void {
    void this.router.navigate(id === 'albumes' ? ['/galeria'] : ['/galeria', id]);
  }

  /** Regresa a la vista de la que se vino y a su posición de desplazamiento. */
  protected volver(): void {
    const o = this.origen() ?? { vista: 'albumes' as VistaDeOrigen, scroll: 0 };
    void this.router.navigate(o.vista === 'albumes' ? ['/galeria'] : ['/galeria', o.vista]).then(() => this.restaurarDesplazamiento(o.scroll));
  }

  /** Cuando se cambia de pestaña, la barra de pestañas queda siempre a la vista bajo la barra principal (sin quedar el lector en medio de una página que ya no existe). */
  private fijarPestanas(): void {
    requestAnimationFrame(() => {
      const barra = document.querySelector<HTMLElement>('[data-testid="galeria-pestanas"]');
      if (!barra) return;
      const tope = barra.getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alto-barra-superior') || '0');
      if (tope < 0) window.scrollBy({ top: tope, behavior: 'instant' });
    });
  }

  private restaurarDesplazamiento(y: number, intentos = 20): void {
    if (y <= 0) { window.scrollTo(0, 0); return; }
    window.scrollTo(0, y);
    if (intentos > 0 && Math.abs(window.scrollY - y) > 2) setTimeout(() => this.restaurarDesplazamiento(y, intentos - 1), 60);
  }

  // ---------------------------------------------------------------- destacados (encabezado)

  protected elegirDiapositiva(i: number): void {
    // Elegir una a mano detiene la rotación: quien la eligió decide cuánto leerla y el lector de pantalla la anuncia una sola vez.
    this.pausaManual.set(true);
    this.diapositiva.set(i);
  }
  protected alternarPausa(): void { this.pausaManual.update(v => !v); }
  protected alPuntero(dentro: boolean): void { this.pausaPorPuntero.set(dentro); }
  protected alFoco(dentro: boolean): void { this.pausaPorFoco.set(dentro); }

  protected abrirFoto(f: FotoDeGaleria): void {
    void this.router.navigate([], { queryParams: { foto: f.id }, queryParamsHandling: 'merge' });
  }

  protected irAFoto(indice: number): void {
    const f = this.fotosDelVisor()[indice];
    if (f) void this.router.navigate([], { queryParams: { foto: f.id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected cerrarVisor(): void {
    void this.router.navigate([], { queryParams: { foto: null }, queryParamsHandling: 'merge' });
  }

  protected elegirVideo(videoId: string): void {
    void this.router.navigate([], { queryParams: { video: videoId }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // ---------------------------------------------------------------- datos

  private async cargarDestacado(): Promise<void> {
    // El primero se pide ya; los demás, en paralelo, y cada diapositiva aparece completa cuando llega su detalle.
    await Promise.all(this.recientes().map(async m => {
      if (this.destacados()[m.slug]) return;
      const r = await this.servicio.album(m.slug);
      if (r.ok && r.data) this.destacados.update(d => ({ ...d, [m.slug]: r.data! }));
    }));
  }

  private async cargarClase(clase: ClaseDeItem, mas = false): Promise<void> {
    const actual = this.listas()[clase];
    if (actual.cargando || (actual.cargada && !mas)) return;
    this.poner(clase, { ...actual, cargando: true, error: null });
    const r = await this.servicio.items(clase, mas ? actual.items.length : 0, clase === 'videos' ? 200 : POR_PAGINA);
    if (!r.ok || !r.data) {
      this.poner(clase, { ...actual, cargando: false, error: r.error ?? 'No fue posible consultar la Galería.' });
      return;
    }
    this.poner(clase, { items: mas ? [...actual.items, ...r.data.items] : r.data.items, total: r.data.total, cargando: false, cargada: true, error: null });
  }

  private poner(clase: ClaseDeItem, v: ListaDeItems): void {
    this.listas.update(l => ({ ...l, [clase]: v }));
  }

  protected reintentar(clase: ClaseDeItem | null): void {
    if (clase) { this.poner(clase, VACIA); void this.cargarClase(clase); }
    else void this.iniciar();
  }

  protected masFotos(clase: ClaseDeItem): void {
    void this.cargarClase(clase, true);
  }

  private async cargarAlbum(slug: string): Promise<void> {
    if (this.album()?.slug === slug) return;
    this.album.set(null);
    this.albumNoEncontrado.set(false);
    this.cargandoAlbum.set(true);
    const r = await this.servicio.album(slug);
    this.cargandoAlbum.set(false);
    if (!r.ok) { this.error.set(r.error ?? 'No fue posible consultar el álbum.'); return; }
    if (!r.data) { this.albumNoEncontrado.set(true); return; }
    this.album.set(r.data);
  }

  // ---------------------------------------------------------------- ayudas de la vista

  protected urlDe(...partes: string[]): string {
    return `${location.origin}/galeria${partes.length ? '/' + partes.join('/') : ''}`;
  }

  protected async copiar(enlace: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(enlace);
      this.aviso.set('Enlace copiado.');
    } catch {
      this.aviso.set('No se pudo copiar el enlace; cópielo desde la barra de direcciones.');
    }
  }

  protected copiarFoto(f: FotoDeGaleria): void {
    void this.copiar(f.albumSlug ? `${this.urlDe('album', f.albumSlug)}?foto=${f.id}` : `${this.urlDe('sin-album')}?foto=${f.id}`);
  }

  protected copiarVideo(videoId: string): void {
    const base = this.vista() === 'album' && this.slug() ? this.urlDe('album', this.slug()!) : this.urlDe('videos');
    void this.copiar(`${base}?video=${videoId}`);
  }

  /** El estilo flexible de una foto del mosaico justificado: crece en proporción a su forma, sin saltos ni recortes. */
  protected estiloDeFoto(f: FotoDeGaleria, alto: number): Record<string, string> {
    return { flex: `${(f.razon * 100).toFixed(2)} 1 ${(f.razon * alto).toFixed(0)}px`, 'aspect-ratio': String(f.razon) };
  }

  /** El total de fotos de un álbum (para «Ver álbum completo») o `null` si se ignora. */
  protected totalDeFotos(slug: string | null): number | null {
    return slug ? this.totalDeFotosPorAlbum().get(slug) ?? null : null;
  }

  protected rotuloDelAlbum(a: AlbumDeGaleriaResumen): string {
    return conteoRotulado(a.totalFotos, a.totalVideos);
  }
}
