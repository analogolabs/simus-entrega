import { ChangeDetectionStrategy, Component, ElementRef, computed, input, signal, viewChildren } from '@angular/core';
import { LucideDownload, LucideExternalLink, LucideFileArchive, LucideFileSpreadsheet, LucideFileText, LucideGlobe, LucideImage, LucideMusic, LucidePresentation, LucideVideo } from '@lucide/angular';
import { RecursoDeCelebra } from '../../../../core/services/celebra-la-musica.service';

/** Un grupo de la caja de herramientas, en el orden en que se guardó. */
export interface GrupoDeRecursos {
  readonly id: string;
  readonly grupo: string;
  readonly recursos: readonly RecursoDeCelebra[];
}

const EXTENSION_DE_IMAGEN = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const EXTENSION_DE_AUDIO = /\.(mp3|wav|ogg|oga|m4a|aac|flac)$/i;
const EXTENSION_DE_VIDEO = /\.(mp4|webm|ogv|mov|m4v)$/i;

/** Qué se pinta en el visor: lo que el navegador puede mostrar con el contenido propio del portal, o una ficha de respaldo. */
export type TipoDeVista = 'imagen' | 'audio' | 'video' | 'pdf' | 'oficina' | 'comprimido' | 'enlace' | 'otro';

const ROTULO_DEL_TIPO: Record<TipoDeVista, string> = {
  imagen: 'Imagen', audio: 'Audio', video: 'Video', pdf: 'Documento PDF', oficina: 'Documento de oficina',
  comprimido: 'Archivo comprimido', enlace: 'Enlace externo', otro: 'Archivo',
};

/** Agrupa los recursos por su grupo, respetando el orden en que llegan (el de la consola). */
export function agruparRecursos(recursos: readonly RecursoDeCelebra[]): GrupoDeRecursos[] {
  const grupos = new Map<string, RecursoDeCelebra[]>();
  for (const r of recursos) { grupos.set(r.grupo, [...(grupos.get(r.grupo) ?? []), r]); }
  return [...grupos.entries()].map(([grupo, lista], i) => ({ id: `g${i}`, grupo, recursos: lista }));
}

/**
 * LA CAJA DE HERRAMIENTAS DE UNA EDICIÓN, COMO UN SOLO VISOR.
 *
 * Pestañas = los grupos reales que trae la API (guía visual, recursos gráficos, logos, tipografías…). Al elegir una
 * pestaña cambia el contenido en el MISMO espacio: a la izquierda la lista de archivos del grupo; a la derecha la
 * ficha grande del archivo elegido (vista previa si es una imagen del Banco de archivos; si no, su tipo) con el botón
 * para descargarlo o abrirlo. El alto del visor es fijo: cambiar de pestaña no mueve la página.
 *
 * Teclado: flechas izquierda y derecha, Inicio y Fin recorren las pestañas (foco itinerante); la lista de archivos se
 * recorre con Tab y se elige con Enter o Espacio.
 */
@Component({
  selector: 'app-caja-de-herramientas-celebra',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideDownload, LucideExternalLink, LucideFileArchive, LucideFileSpreadsheet, LucideFileText, LucideGlobe, LucideImage, LucideMusic, LucidePresentation, LucideVideo],
  styles: [`
    :host { display: block; }
    .caja { border: 1px solid var(--color-filete, #e5e0ee); border-radius: .75rem; background: #fff; overflow: hidden; }
    .caja__pestanas { display: flex; gap: .25rem; padding: .5rem .5rem 0; overflow-x: auto; border-bottom: 1px solid var(--color-filete, #e5e0ee); scrollbar-width: thin; }
    .caja__pestana {
      flex: none; display: inline-flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: 0 1rem; cursor: pointer;
      border: 1px solid transparent; border-bottom: 0; border-radius: .5rem .5rem 0 0; background: transparent;
      color: var(--cl-tinta); font: inherit; font-weight: 800; font-size: .9375rem; white-space: nowrap; margin-bottom: -1px;
    }
    .caja__pestana:hover { background: #fff8; }
    .caja__pestana[aria-selected='true'] { background: #fff; border-color: var(--color-filete, #e5e0ee); color: var(--color-titulo, #1b1230); }
    .caja__pestana:focus-visible, .caja__fila:focus-visible, .caja__boton:focus-visible { outline: 3px solid var(--color-foco, #5b2a86); outline-offset: -3px; }
    .caja__cuenta { font-weight: 600; font-size: .8125rem; color: var(--color-rotulo, #5d5675); font-variant-numeric: tabular-nums; }
    .caja__pestanas { margin-bottom: 0; }
    /* PISTA DE DESLIZAMIENTO, sin script: cuando las pestañas no caben, una sombra suave en el borde que tiene más pestañas
       al otro lado. Con «local» el degradado del color de fondo tapa la sombra cuando ya se llegó al extremo. */
    .caja__pestanas {
      background:
        linear-gradient(to right, var(--cl-tinte) 30%, transparent) left center / 2rem 100% no-repeat local,
        linear-gradient(to left, var(--cl-tinte) 30%, transparent) right center / 2rem 100% no-repeat local,
        radial-gradient(farthest-side at 0 50%, rgb(27 18 48 / .28), transparent) left center / .75rem 100% no-repeat scroll,
        radial-gradient(farthest-side at 100% 50%, rgb(27 18 48 / .28), transparent) right center / .75rem 100% no-repeat scroll,
        var(--cl-tinte);
    }
    .caja__cuerpo { display: grid; height: 30rem; }
    @media (min-width: 900px) { .caja__cuerpo { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); } }
    @media (max-width: 899.98px) { .caja__cuerpo { height: 38rem; grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); } }
    .caja__lista { margin: 0; padding: 1rem; list-style: none; overflow-y: auto; border-right: 1px solid var(--color-filete, #e5e0ee); overscroll-behavior: contain; }
    @media (max-width: 899.98px) { .caja__lista { border-right: 0; border-bottom: 1px solid var(--color-filete, #e5e0ee); } }
    .caja__lista > li + li { margin-top: .5rem; }
    .caja__fila { display: flex; align-items: center; gap: .75rem; width: 100%; min-height: 3.5rem; padding: .5rem 1rem; text-align: left; background: #fff; border: 1px solid var(--color-filete, #e5e0ee); border-radius: .5rem; cursor: pointer; font: inherit; color: var(--color-titulo, #1b1230); }
    .caja__fila:hover { background: var(--cl-tinte); }
    .caja__fila[aria-current='true'] { background: var(--cl-tinte); border-color: var(--cl-principal); box-shadow: inset 0 0 0 1px var(--cl-principal); }
    .caja__tipo { flex: none; display: grid; place-items: center; min-width: 2.5rem; padding: 0 .4rem; height: 2rem; border-radius: .375rem; background: var(--cl-principal); color: var(--cl-sobre-principal); font-family: 'Oswald', sans-serif; font-weight: 700; font-size: var(--text-dato); }
    .caja__vista { display: grid; grid-template-rows: minmax(0, 1fr) auto; min-height: 0; background: var(--cl-tinte); }
    .caja__previa { position: relative; display: grid; place-items: center; min-height: 0; padding: 1rem; overflow: hidden; }
    .caja__imagen { position: absolute; inset: 1rem; width: calc(100% - 2rem); height: calc(100% - 2rem); object-fit: contain; border-radius: .5rem; background: repeating-conic-gradient(#f1eef6 0% 25%, #fff 0% 50%) 50% / 1rem 1rem; }
    .caja__ficha { display: grid; justify-items: center; gap: .5rem; text-align: center; color: var(--cl-tinta); max-width: 100%; }
    .caja__medio { width: 100%; max-height: 100%; border-radius: .5rem; }
    video.caja__medio { background: #000; }
    .caja__ficha-tipo { display: grid; place-items: center; min-width: 7rem; padding: 0 1rem; height: 7rem; border-radius: .75rem; background: var(--cl-principal); color: var(--cl-sobre-principal); font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 1.75rem; }
    .caja__pie { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem 1rem; padding: 1rem; background: #fff; border-top: 1px solid var(--color-filete, #e5e0ee); }
    .caja__boton { display: inline-flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: .5rem 1.25rem; border-radius: .5rem; background: var(--cl-principal); color: var(--cl-sobre-principal); font-weight: 800; text-decoration: none; border: 2px solid var(--cl-principal); }
    .caja__boton:hover { background: var(--cl-tinta); border-color: var(--cl-tinta); }
    .caja__nombre { overflow-wrap: anywhere; }
  `],
  template: `
    <div class="caja" data-testid="caja-de-herramientas">
      <div class="caja__pestanas" role="tablist" aria-label="Grupos de la caja de herramientas">
        @for (g of grupos(); track g.id) {
          <button #pestana type="button" role="tab" class="caja__pestana" [id]="'caja-pestana-' + g.id"
            [attr.aria-selected]="g.id === grupoElegido().id" [attr.aria-controls]="'caja-panel'"
            [attr.tabindex]="g.id === grupoElegido().id ? 0 : -1" (click)="elegirGrupo(g.id)" (keydown)="alTeclear($event, g.id)">
            {{ g.grupo }}<span class="caja__cuenta">{{ g.recursos.length }}</span>
          </button>
        }
      </div>
      <div id="caja-panel" role="tabpanel" class="caja__cuerpo" [attr.aria-labelledby]="'caja-pestana-' + grupoElegido().id">
        <ul class="caja__lista" [attr.aria-label]="'Archivos de ' + grupoElegido().grupo">
          @for (r of grupoElegido().recursos; track r.id) {
            <li>
              <button type="button" class="caja__fila" [attr.aria-current]="r.id === recursoElegido().id" (click)="elegirRecurso(r.id)">
                <span class="caja__tipo" aria-hidden="true">{{ tipoDe(r) }}</span>
                <span class="min-w-0">
                  <span class="tipo-titulo-lista block caja__nombre">{{ r.titulo }}</span>
                  @if (r.descripcion) { <span class="tipo-pequeno block text-tinta-media">{{ r.descripcion }}</span> }
                </span>
              </button>
            </li>
          }
        </ul>
        <div class="caja__vista" aria-live="polite">
          <div class="caja__previa">
            @let r = recursoElegido();
            @let vista = vistaDe(r);
            @if (vista === 'imagen' && !fallida().has(r.id)) {
              <img class="caja__imagen" width="640" height="480" [src]="r.url" [alt]="'Vista previa de ' + r.titulo" (error)="marcarFallida(r.id)" />
            } @else if (vista === 'audio' && !fallida().has(r.id)) {
              <audio class="caja__medio" controls preload="none" [src]="r.url" [attr.aria-label]="'Audio: ' + r.titulo" (error)="marcarFallida(r.id)"></audio>
            } @else if (vista === 'video' && !fallida().has(r.id)) {
              <video class="caja__medio" controls preload="metadata" [src]="r.url" [attr.aria-label]="'Video: ' + r.titulo" (error)="marcarFallida(r.id)"></video>
            } @else {
              <!-- Respaldo claro cuando el tipo no se puede mostrar aquí (PDF, oficina, enlaces externos…) o el archivo no cargó. -->
              <div class="caja__ficha" data-testid="caja-respaldo">
                <span class="caja__ficha-tipo" aria-hidden="true">{{ tipoDe(r) }}</span>
                @switch (vista) {
                  @case ('imagen') { <svg lucideImage [size]="20" aria-hidden="true"></svg> }
                  @case ('audio') { <svg lucideMusic [size]="20" aria-hidden="true"></svg> }
                  @case ('video') { <svg lucideVideo [size]="20" aria-hidden="true"></svg> }
                  @case ('oficina') { <svg lucidePresentation [size]="20" aria-hidden="true"></svg> }
                  @case ('comprimido') { <svg lucideFileArchive [size]="20" aria-hidden="true"></svg> }
                  @case ('enlace') { <svg lucideGlobe [size]="20" aria-hidden="true"></svg> }
                  @default { <svg lucideFileText [size]="20" aria-hidden="true"></svg> }
                }
                <p class="tipo-etiqueta">{{ rotuloDe(vista) }}</p>
                <p class="tipo-pequeno text-tinta-media">@if (fallida().has(r.id)) { No se pudo mostrar la vista previa. } @else { Sin vista previa en esta página. }@if (r.url) { Usa el botón para @if (r.archivoId) { descargarlo. } @else { abrirlo. } }</p>
              </div>
            }
          </div>
          <div class="caja__pie">
            <div class="min-w-0">
              <p class="tipo-titulo-lista text-titulo caja__nombre">{{ recursoElegido().titulo }}</p>
              @if (recursoElegido().descripcion) { <p class="tipo-pequeno text-tinta-media">{{ recursoElegido().descripcion }}</p> }
            </div>
            @if (recursoElegido().url) {
              <a class="caja__boton foco-simus" [href]="recursoElegido().url" [attr.target]="externo(recursoElegido()) ? '_blank' : null"
                [attr.rel]="externo(recursoElegido()) ? 'noopener noreferrer' : null" data-testid="caja-descarga">
                @if (recursoElegido().archivoId) { <svg lucideDownload [size]="16" aria-hidden="true"></svg>Descargar }
                @else { <svg lucideExternalLink [size]="16" aria-hidden="true"></svg>Abrir }
                <span class="sr-only">{{ recursoElegido().titulo }}@if (externo(recursoElegido())) { (abre en una pestaña nueva) }</span>
              </a>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CajaDeHerramientasCelebraComponent {
  readonly recursos = input.required<readonly RecursoDeCelebra[]>();

  readonly grupos = computed(() => agruparRecursos(this.recursos()));
  private readonly grupoId = signal('');
  private readonly recursoId = signal<number | null>(null);
  readonly fallida = signal<ReadonlySet<number>>(new Set());

  readonly grupoElegido = computed(() => this.grupos().find((g) => g.id === this.grupoId()) ?? this.grupos()[0]);
  readonly recursoElegido = computed(() => {
    const g = this.grupoElegido();
    return g.recursos.find((r) => r.id === this.recursoId()) ?? g.recursos[0];
  });

  private readonly pestanas = viewChildren<ElementRef<HTMLButtonElement>>('pestana');

  elegirGrupo(id: string): void {
    this.grupoId.set(id);
    this.recursoId.set(null);
  }

  elegirRecurso(id: number): void { this.recursoId.set(id); }

  alTeclear(evento: KeyboardEvent, id: string): void {
    const ids = this.grupos().map((g) => g.id);
    const actual = ids.indexOf(id);
    let destino: number;
    switch (evento.key) {
      case 'ArrowRight': destino = (actual + 1) % ids.length; break;
      case 'ArrowLeft': destino = (actual - 1 + ids.length) % ids.length; break;
      case 'Home': destino = 0; break;
      case 'End': destino = ids.length - 1; break;
      default: return;
    }
    evento.preventDefault();
    this.elegirGrupo(ids[destino]);
    this.pestanas()[destino]?.nativeElement.focus();
  }

  marcarFallida(id: number): void { this.fallida.update((s) => new Set(s).add(id)); }

  externo(r: RecursoDeCelebra): boolean { return !!r.url && /^https?:\/\//i.test(r.url); }

  /**
   * Cómo se muestra un recurso. Solo se pinta una vista previa de lo que el portal puede mostrar con contenido propio:
   * imágenes, audio y video del Banco de archivos (o de este mismo origen). Un enlace externo no se carga (la política de
   * contenido del portal solo admite medios propios) y el PDF y los documentos de oficina no se incrustan: todos llevan
   * una ficha con su tipo y el botón de descarga o apertura. Un archivo del Banco sin extensión se intenta como imagen y,
   * si no carga, cae a la ficha.
   */
  vistaDe(r: RecursoDeCelebra): TipoDeVista {
    if (!r.url) { return 'otro'; }
    if (this.externo(r)) { return 'enlace'; }
    const nombre = r.titulo.trim();
    if (EXTENSION_DE_IMAGEN.test(nombre)) { return 'imagen'; }
    if (EXTENSION_DE_AUDIO.test(nombre)) { return 'audio'; }
    if (EXTENSION_DE_VIDEO.test(nombre)) { return 'video'; }
    if (/\.pdf$/i.test(nombre)) { return 'pdf'; }
    if (/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|csv|txt)$/i.test(nombre)) { return 'oficina'; }
    if (/\.(zip|rar|7z|tar|gz)$/i.test(nombre)) { return 'comprimido'; }
    if (r.archivoId && !/\.[a-z0-9]{2,4}$/i.test(nombre)) { return 'imagen'; }
    return 'otro';
  }

  rotuloDe(tipo: TipoDeVista): string { return ROTULO_DEL_TIPO[tipo]; }

  /** La etiqueta corta del tipo de archivo: su extensión, o «WEB» para un enlace. */
  tipoDe(r: RecursoDeCelebra): string {
    const m = /\.([a-z0-9]{2,4})$/i.exec(r.titulo);
    if (m) { return m[1].toUpperCase(); }
    return r.archivoId ? 'ARCHIVO' : 'WEB';
  }
}
