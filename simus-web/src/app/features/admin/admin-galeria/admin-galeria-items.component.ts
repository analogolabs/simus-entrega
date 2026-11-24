import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowDown, LucideArrowUp, LucideImage, LucidePlay, LucideTrash2 } from '@lucide/angular';
import { ArchivoEnElBanco, BancoDeArchivosService } from '../../../core/services/banco-de-archivos.service';
import type { TipoDeAlbum } from '../../../core/services/galeria.service';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { DialogoDeFormularioComponent } from '../../../shared/components/ui/dialogo-de-formulario/dialogo-de-formulario.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { PaginacionDeListaComponent } from '../../../shared/components/ui/paginacion-de-lista/paginacion-de-lista.component';
import {
  ItemEditable, LARGOS, enlaceDeVideo, itemNuevo, leerEnlaceDeVideo, mover, problemaDeImagen, problemasDeItems,
} from '../domain/galeria-edicion';

type Dialogo = null | 'fotos' | 'video' | 'varios' | 'miniatura';

const POR_PAGINA = [12, 24, 48] as const;

/**
 * LOS ÍTEMS DE UN ÁLBUM (o los «sin álbum»): fotos y videos, con su orden, sus textos y su portada.
 *
 * <b>NO GUARDA NADA.</b> Edita la lista que le pasa quien lo usa y avisa de cada cambio con `itemsChange`; el álbum (o los ítems
 * sueltos) se guardan completos desde la pantalla de arriba, como en «Celebra la música».
 *
 * <b>UNA FOTO NO SE PUBLICA SIN SU TEXTO ALTERNATIVO.</b> Al elegir del Banco se hereda el que ya tenga; si no tiene, la fila queda
 * señalada y el guardado se detiene con el motivo. Subir una imagen pide el texto alternativo ANTES (el Banco lo exige igual).
 *
 * <b>LOS VIDEOS SON ENLACES DE YOUTUBE.</b> Se pega la dirección y se lee el identificador; Vimeo y otros proveedores se rechazan con su
 * motivo. Pegar varios enlaces de una vez arma la lista de un álbum como «Voces y Saberes»; un enlace de lista de reproducción se ofrece
 * como «Ver la lista en YouTube» del álbum.
 */
@Component({
  selector: 'app-admin-galeria-items',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, LucideArrowDown, LucideArrowUp, LucideImage, LucidePlay, LucideTrash2,
    BotonComponent, DialogoDeFormularioComponent, EstadoDeListaComponent, PaginacionDeListaComponent,
  ],
  templateUrl: './admin-galeria-items.component.html',
})
export class AdminGaleriaItemsComponent {
  private readonly banco = inject(BancoDeArchivosService);

  readonly items = input.required<readonly ItemEditable[]>();
  /** El tipo del álbum; nulo para los ítems sin álbum (aceptan fotos y videos, cada uno con su «publicado»). */
  readonly tipoDeAlbum = input<TipoDeAlbum | null>(null);
  readonly portadaArchivoId = input<number | null>(null);
  readonly conPublicado = input(false);
  /** Prefijo de los `data-testid` para que dos usos en la misma pantalla no choquen. */
  readonly prefijo = input('galeria-items');

  readonly itemsChange = output<ItemEditable[]>();
  readonly portadaChange = output<{ archivoId: number; url: string } | null>();
  readonly listaDetectada = output<string>();
  readonly aviso = output<string>();

  readonly LARGOS = LARGOS;
  readonly cantidades = POR_PAGINA;
  readonly pagina = signal(1);
  readonly porPagina = signal<number>(POR_PAGINA[0]);
  readonly dialogo = signal<Dialogo>(null);
  readonly errorDelDialogo = signal('');

  // — Banco de archivos —
  readonly archivosDelBanco = signal<ArchivoEnElBanco[]>([]);
  readonly cargandoBanco = signal(false);
  readonly errorDelBanco = signal('');
  readonly elegidas = signal<ReadonlySet<number>>(new Set());
  readonly subiendo = signal(false);
  readonly archivoParaSubir = signal<File | null>(null);
  readonly altParaSubir = signal('');
  readonly creditoParaSubir = signal('');
  /** Para qué se abre el selector del Banco cuando es de miniatura: la clave del video. */
  readonly videoDeMiniatura = signal<number | null>(null);

  // — Video —
  readonly enlaceNuevo = signal('');
  readonly tituloNuevo = signal('');
  readonly textoDeVarios = signal('');

  readonly lectura = computed(() => (this.enlaceNuevo().trim() ? leerEnlaceDeVideo(this.enlaceNuevo()) : null));

  readonly admiteFotos = computed(() => this.tipoDeAlbum() !== 'videos');
  readonly admiteVideos = computed(() => this.tipoDeAlbum() !== 'fotos');

  readonly totalDePaginas = computed(() => Math.max(1, Math.ceil(this.items().length / this.porPagina())));
  readonly visibles = computed(() => {
    const desde = (Math.min(this.pagina(), this.totalDePaginas()) - 1) * this.porPagina();
    return this.items().slice(desde, desde + this.porPagina()).map((item, i) => ({ item, indice: desde + i }));
  });

  /** Los problemas de cada ítem por su clave, para señalar la fila (no solo listarlos arriba). */
  readonly problemasPorClave = computed(() => {
    const mapa = new Map<number, string[]>();
    const lista = this.items();
    lista.forEach((it, n) => {
      const p = problemasDeItems([it], this.tipoDeAlbum()).map(t => t.replace(/^(La foto|El video) 1/, `$1 ${n + 1}`));
      if (p.length) { mapa.set(it.clave, p); }
    });
    return mapa;
  });

  readonly cuentaDeFotos = computed(() => this.items().filter(i => i.tipoItem === 'foto').length);
  readonly cuentaDeVideos = computed(() => this.items().filter(i => i.tipoItem === 'video').length);

  enlaceYoutube = enlaceDeVideo;

  private emitir(lista: ItemEditable[]): void { this.itemsChange.emit(lista); }

  // ───────── Edición de una fila ─────────
  editar(clave: number, parte: Partial<ItemEditable>): void {
    this.emitir(this.items().map(i => (i.clave === clave ? { ...i, ...parte } : i)));
  }

  alCambiarEnlace(clave: number, texto: string): void {
    const l = leerEnlaceDeVideo(texto);
    if (l.tipo === 'video') { this.editar(clave, { videoId: l.videoId }); if (l.listaUrl) { this.listaDetectada.emit(l.listaUrl); } }
  }

  moverItem(indice: number, sentido: -1 | 1): void { this.emitir(mover(this.items(), indice, sentido)); }

  quitar(clave: number): void {
    const q = this.items().find(i => i.clave === clave);
    this.emitir(this.items().filter(i => i.clave !== clave));
    if (q && q.tipoItem === 'foto' && q.archivoId !== null && q.archivoId === this.portadaArchivoId()) { this.portadaChange.emit(null); }
    const restantes = Math.max(1, Math.ceil((this.items().length - 1) / this.porPagina()));
    if (this.pagina() > restantes) { this.pagina.set(restantes); }
  }

  comoPortada(i: ItemEditable): void {
    if (i.archivoId !== null && i.imagenUrl) { this.portadaChange.emit({ archivoId: i.archivoId, url: i.imagenUrl }); }
  }

  esPortada(i: ItemEditable): boolean { return i.tipoItem === 'foto' && i.archivoId !== null && i.archivoId === this.portadaArchivoId(); }

  cambiarPorPagina(n: number): void { this.porPagina.set(n); this.pagina.set(1); }

  // ───────── Diálogos ─────────
  abrir(d: Exclude<Dialogo, null>): void {
    this.errorDelDialogo.set('');
    this.dialogo.set(d);
    if (d === 'fotos' || d === 'miniatura') { void this.cargarBanco(); }
    if (d === 'video') { this.enlaceNuevo.set(''); this.tituloNuevo.set(''); }
    if (d === 'varios') { this.textoDeVarios.set(''); }
    if (d === 'fotos') { this.elegidas.set(new Set()); this.archivoParaSubir.set(null); this.altParaSubir.set(''); this.creditoParaSubir.set(''); }
  }

  cerrar(): void { this.dialogo.set(null); this.errorDelDialogo.set(''); this.videoDeMiniatura.set(null); }

  async cargarBanco(): Promise<void> {
    this.cargandoBanco.set(true);
    this.errorDelBanco.set('');
    const r = await this.banco.listar('institucional', { tamano: 60 });
    if (r.ok && r.data) { this.archivosDelBanco.set(r.data.items.filter(a => a.tipo.startsWith('image/'))); }
    else { this.errorDelBanco.set(r.error ?? 'No fue posible consultar el Banco de archivos.'); }
    this.cargandoBanco.set(false);
  }

  yaEstaEnLaLista(id: number): boolean { return this.items().some(i => i.tipoItem === 'foto' && i.archivoId === id); }

  alternarElegida(a: ArchivoEnElBanco): void {
    if (this.dialogo() === 'miniatura') { this.elegirMiniatura(a); return; }
    if (this.yaEstaEnLaLista(a.id)) { return; }
    this.elegidas.update(s => { const n = new Set(s); if (n.has(a.id)) { n.delete(a.id); } else { n.add(a.id); } return n; });
  }

  private fotoDelBanco(a: ArchivoEnElBanco): ItemEditable {
    return itemNuevo({ tipoItem: 'foto', archivoId: a.id, imagenUrl: a.url, textoAlternativo: a.alt ?? '', credito: a.credito ?? '', titulo: '' });
  }

  anadirElegidas(): void {
    const nuevas = this.archivosDelBanco().filter(a => this.elegidas().has(a.id) && !this.yaEstaEnLaLista(a.id)).map(a => this.fotoDelBanco(a));
    if (nuevas.length === 0) { this.errorDelDialogo.set('Pulsa una o más imágenes del Banco para elegirlas.'); return; }
    this.emitir([...this.items(), ...nuevas]);
    this.aviso.emit(nuevas.length === 1 ? 'Se añadió 1 foto: revisa su texto alternativo y guarda el álbum.' : `Se añadieron ${nuevas.length} fotos: revisa sus textos alternativos y guarda el álbum.`);
    this.pagina.set(this.totalDePaginas());
    this.cerrar();
  }

  alElegirArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0] ?? null;
    this.errorDelDialogo.set('');
    if (archivo) {
      const problema = problemaDeImagen(archivo);
      if (problema) { this.errorDelDialogo.set(problema); entrada.value = ''; this.archivoParaSubir.set(null); return; }
    }
    this.archivoParaSubir.set(archivo);
  }

  async subirYAnadir(): Promise<void> {
    const archivo = this.archivoParaSubir();
    if (!archivo) { this.errorDelDialogo.set('Elige primero la imagen que vas a subir.'); return; }
    const alt = this.altParaSubir().trim();
    if (!alt) { this.errorDelDialogo.set('Escribe primero el texto alternativo: describe la imagen para quien no puede verla.'); return; }
    this.subiendo.set(true);
    this.errorDelDialogo.set('');
    const r = await this.banco.subirImagen(archivo, alt, { credito: this.creditoParaSubir().trim() || undefined });
    this.subiendo.set(false);
    if (!r.ok || !r.archivo) { this.errorDelDialogo.set(r.error ?? 'No fue posible subir la imagen.'); return; }
    if (this.yaEstaEnLaLista(r.archivo.id)) { this.errorDelDialogo.set('Esa imagen ya está en la lista (el Banco la reconoció como repetida).'); return; }
    this.emitir([...this.items(), itemNuevo({
      tipoItem: 'foto', archivoId: r.archivo.id, imagenUrl: r.archivo.url, textoAlternativo: alt, credito: this.creditoParaSubir().trim(),
    })]);
    this.aviso.emit('La imagen se subió al Banco de archivos y se añadió: guarda el álbum para publicarla.');
    this.pagina.set(this.totalDePaginas());
    this.cerrar();
  }

  anadirVideo(): void {
    const l = leerEnlaceDeVideo(this.enlaceNuevo());
    if (l.tipo === 'error') { this.errorDelDialogo.set(l.motivo); return; }
    if (l.tipo === 'lista') { this.errorDelDialogo.set('Ese es el enlace de una lista de reproducción. Pega el de un video, o usa «Pegar varios enlaces» para armar el álbum con los videos de la lista.'); return; }
    if (!this.tituloNuevo().trim()) { this.errorDelDialogo.set('Escribe el título del video.'); return; }
    if (this.items().some(i => i.tipoItem === 'video' && i.videoId === l.videoId)) { this.errorDelDialogo.set('Ese video ya está en la lista.'); return; }
    this.emitir([...this.items(), itemNuevo({ tipoItem: 'video', videoId: l.videoId, titulo: this.tituloNuevo().trim() })]);
    if (l.listaUrl) { this.listaDetectada.emit(l.listaUrl); }
    this.pagina.set(this.totalDePaginas());
    this.aviso.emit('Se añadió el video: en su fila puedes completar la descripción, la duración y su miniatura.');
    this.cerrar();
  }

  /** Una línea por enlace. Cada uno que se lee se añade con título vacío (a completar en la fila); el resto se enumera con su motivo. */
  anadirVarios(): void {
    const lineas = this.textoDeVarios().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lineas.length === 0) { this.errorDelDialogo.set('Pega al menos un enlace, uno por línea.'); return; }
    const existentes = new Set(this.items().filter(i => i.tipoItem === 'video').map(i => i.videoId));
    const nuevos: ItemEditable[] = [];
    const rechazos: string[] = [];
    let lista: string | null = null;
    lineas.forEach((linea, n) => {
      const l = leerEnlaceDeVideo(linea);
      if (l.tipo === 'lista') { lista ??= l.listaUrl; return; }
      if (l.tipo === 'error') { rechazos.push(`Línea ${n + 1}: ${l.motivo}`); return; }
      if (l.listaUrl) { lista ??= l.listaUrl; }
      if (existentes.has(l.videoId)) { rechazos.push(`Línea ${n + 1}: ese video ya está en la lista.`); return; }
      existentes.add(l.videoId);
      nuevos.push(itemNuevo({ tipoItem: 'video', videoId: l.videoId }));
    });
    if (rechazos.length > 0) { this.errorDelDialogo.set(rechazos.slice(0, 4).join(' ') + (rechazos.length > 4 ? ` (y ${rechazos.length - 4} más)` : '')); return; }
    if (nuevos.length > 0) { this.emitir([...this.items(), ...nuevos]); this.pagina.set(this.totalDePaginas()); }
    if (lista) { this.listaDetectada.emit(lista); }
    this.aviso.emit(nuevos.length > 0
      ? `Se añadieron ${nuevos.length} videos: falta escribir el título de cada uno.${lista ? ' La lista de reproducción quedó como «Ver la lista en YouTube».' : ''}`
      : 'La lista de reproducción quedó como «Ver la lista en YouTube» del álbum.');
    this.cerrar();
  }

  abrirMiniatura(clave: number): void { this.videoDeMiniatura.set(clave); this.abrir('miniatura'); }

  private elegirMiniatura(a: ArchivoEnElBanco): void {
    const clave = this.videoDeMiniatura();
    if (clave === null) { return; }
    this.editar(clave, { miniaturaArchivoId: a.id, imagenUrl: a.url });
    this.cerrar();
  }

  quitarMiniatura(clave: number): void { this.editar(clave, { miniaturaArchivoId: null, imagenUrl: null }); }

  cuenta(texto: string, maximo: number): string { return `${texto.length} de ${maximo}`; }
}
