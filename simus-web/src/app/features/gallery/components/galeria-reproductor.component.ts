import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideArrowLeft, LucideExternalLink, LucideLink, LucidePlay } from '@lucide/angular';
import { ID_DE_VIDEO, VideoDeGaleria, duracionCorta, duracionLarga, fechaLarga, mesYAnio } from '../domain/galeria-modelo';

/**
 * EL REPRODUCTOR DE VIDEOS DE LA GALERÍA (maqueta aprobada, bloque «Videos»): el video elegido con su ficha a la izquierda y la lista a la derecha.
 *
 * PRIVACIDAD. La portada de cada video es una imagen PROPIA del Banco de archivos (miniatura sembrada una sola vez): el navegador no pide nada a YouTube
 * hasta que la persona pulsa «Reproducir»; entonces se monta la incrustación sin cookies (`youtube-nocookie.com`) con el identificador ya validado.
 */
@Component({
  selector: 'app-galeria-reproductor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideArrowLeft, LucideExternalLink, LucideLink, LucidePlay],
  styleUrl: './galeria-reproductor.component.css',
  templateUrl: './galeria-reproductor.component.html',
})
export class GaleriaReproductorComponent {
  private readonly saneador = inject(DomSanitizer);

  readonly videos = input.required<readonly VideoDeGaleria[]>();
  /** El identificador de YouTube del video elegido (el primero si no hay o no existe). */
  readonly elegidoId = input<string | null>(null);
  /** Rotula la lista («3 videos del álbum»). */
  readonly rotuloDeLista = input('Videos');
  /** Si se indica, ofrece «Volver a …» junto al video (dentro de un álbum, regresa a la vista de origen). */
  readonly rotuloDeVuelta = input<string | null>(null);
  readonly volver = output<void>();
  readonly elegir = output<string>();
  readonly copiar = output<string>();

  /** El video que se está reproduciendo: hasta entonces no se ha pedido nada a YouTube. */
  protected readonly reproduciendo = signal<string | null>(null);

  protected readonly actual = computed<VideoDeGaleria | null>(() => this.videos().find(v => v.videoId === this.elegidoId()) ?? this.videos()[0] ?? null);
  protected readonly incrustacion = computed<SafeResourceUrl | null>(() => {
    const v = this.actual();
    if (!v || this.reproduciendo() !== v.videoId || !ID_DE_VIDEO.test(v.videoId)) return null;
    // SOLO entra el identificador de once caracteres validado: ninguna dirección escrita por quien cataloga llega al `src`.
    return this.saneador.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&rel=0`);
  });

  protected readonly fechaLarga = fechaLarga;
  protected readonly mesYAnio = mesYAnio;
  protected readonly duracion = duracionCorta;
  protected readonly duracionLarga = duracionLarga;

  protected reproducir(v: VideoDeGaleria): void {
    if (ID_DE_VIDEO.test(v.videoId)) this.reproduciendo.set(v.videoId);
  }

  protected alElegir(v: VideoDeGaleria): void {
    this.reproduciendo.set(null);
    this.elegir.emit(v.videoId);
  }
}
