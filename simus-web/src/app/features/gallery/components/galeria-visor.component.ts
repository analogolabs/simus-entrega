import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideChevronLeft, LucideChevronRight, LucideDownload, LucideLink, LucideX } from '@lucide/angular';
import { FotoDeGaleria, fechaLarga, nombreDeDescarga } from '../domain/galeria-modelo';

/**
 * EL VISOR DE FOTOS (maqueta aprobada): la foto a la izquierda con anterior/siguiente y su contador, y a la DERECHA el panel con su información
 * (pie, crédito, fecha, lugar, álbum y texto alternativo). En pantalla angosta el panel pasa debajo de la foto.
 *
 * `<dialog>` nativo: foco atrapado, Esc cierra y el fondo queda inerte. Flechas del teclado y deslizamiento cambian de foto; al cerrar, el foco vuelve
 * a quien lo abrió. El estado vive en la dirección (`?foto=`): quien lo usa pasa `indice` y escucha `ir` y `cerrar`.
 */
@Component({
  selector: 'app-galeria-visor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideArrowLeft, LucideChevronLeft, LucideChevronRight, LucideDownload, LucideLink, LucideX],
  styleUrl: './galeria-visor.component.css',
  templateUrl: './galeria-visor.component.html',
  host: { '(document:keydown)': 'alTeclear($event)' },
})
export class GaleriaVisorComponent {
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  readonly fotos = input.required<readonly FotoDeGaleria[]>();
  /** La foto abierta (lugar en `fotos`) o `null` si el visor está cerrado. */
  readonly indice = input<number | null>(null);
  readonly ir = output<number>();
  readonly cerrar = output<void>();
  readonly copiar = output<FotoDeGaleria>();
  /** A dónde regresa «Volver» (p. ej. «el álbum» o «Fotos»): el visor se cierra y queda la vista de origen. */
  readonly rotuloDeVuelta = input('la Galería');
  /** Avisos de la descarga («Descarga iniciada.» o el motivo del fallo) para que la página los anuncie. */
  readonly aviso = output<string>();
  protected readonly descargando = signal(false);

  protected readonly foto = computed(() => {
    const i = this.indice();
    return i === null ? null : this.fotos()[i] ?? null;
  });
  protected readonly fechaLarga = fechaLarga;
  private activador: HTMLElement | null = null;
  private x0: number | null = null;
  private y0 = 0;

  constructor() {
    effect(() => {
      const abierta = this.foto() !== null;
      const d = this.dialogo()?.nativeElement;
      if (!d) return;
      if (abierta && !d.open) {
        this.activador = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        d.showModal();
      } else if (!abierta && d.open) {
        d.close();
      }
    });
  }

  /**
   * Descarga la foto con un nombre legible. Reutiliza el servicio público de archivos (`/api/v1/publico/archivos/{id}`, el mismo que pinta la foto), así que
   * solo se obtiene lo ya publicado. Se pide como archivo para conocer su tipo y poner la extensión correcta; si eso falla, se cae al enlace directo con `download`.
   */
  protected async descargar(f: FotoDeGaleria): Promise<void> {
    if (this.descargando()) return;
    this.descargando.set(true);
    let enlace: string = f.url;
    let nombre = nombreDeDescarga(f);
    let temporal: string | null = null;
    try {
      const r = await fetch(f.url, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      nombre = nombreDeDescarga(f, blob.type);
      temporal = URL.createObjectURL(blob);
      enlace = temporal;
    } catch {
      // Sin la copia local, el navegador baja el archivo desde su dirección pública (mismo origen).
    }
    const a = document.createElement('a');
    a.href = enlace;
    a.download = nombre;
    a.rel = 'noopener';
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (temporal) setTimeout(() => URL.revokeObjectURL(temporal!), 10_000);
    this.descargando.set(false);
    this.aviso.emit(`Descarga iniciada: ${nombre}.`);
  }

  protected alCerrarElDialogo(): void {
    // Esc o cierre nativo: se avisa solo si la dirección aún dice que está abierto.
    if (this.foto() !== null) this.cerrar.emit();
    this.activador?.focus();
  }

  protected mover(paso: number): void {
    const i = this.indice();
    if (i === null) return;
    const n = i + paso;
    if (n >= 0 && n < this.fotos().length) this.ir.emit(n);
  }

  protected alTeclear(e: KeyboardEvent): void {
    if (this.foto() === null) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.mover(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.mover(1); }
  }

  protected alPulsar(e: PointerEvent): void { this.x0 = e.clientX; this.y0 = e.clientY; }

  protected alSoltar(e: PointerEvent): void {
    if (this.x0 === null) return;
    const dx = e.clientX - this.x0;
    const dy = e.clientY - this.y0;
    this.x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) this.mover(dx < 0 ? 1 : -1);
  }
}
