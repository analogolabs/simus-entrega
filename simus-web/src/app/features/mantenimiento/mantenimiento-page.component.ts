import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, OnInit, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { REDES_INSTITUCIONALES } from '../../core/config/redes-institucionales';
import { DESTINO_NUEVA_PESTANA } from '../../core/config/enlaces-externos';
import { EstadoDelServicioService } from '../../core/http/estado-del-servicio.service';
import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';

/** Cada cuánto vuelve a mirar sola la pantalla, mientras está abierta. */
export const PERIODO_DE_REINTENTO_MS = 60_000;

/**
 * Pantalla de mantenimiento (`/mantenimiento`), a pantalla completa y con su propio `<main>`.
 *
 * Dice una de tres cosas: el sitio está en mantenimiento (con el mensaje y la hora estimada si la API los
 * dio), no hay conexión con el servicio, o el servicio ya funciona (quien llega directo a la dirección).
 * Sus textos están escritos aquí y NO vienen del CMS: el CMS depende de la API, y esta pantalla existe
 * justo para cuando la API no está.
 */
@Component({
  selector: 'app-mantenimiento-page',
  standalone: true,
  imports: [BotonNativoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @media (prefers-reduced-motion: no-preference) {
      .mantenimiento__marca { animation: mantenimiento-latido 2.4s ease-in-out infinite; }
    }
    @keyframes mantenimiento-latido { 50% { opacity: .55; } }
  `],
  template: `
    <main id="contenido-principal" class="flex min-h-screen flex-col items-center justify-center bg-morado px-6 py-16 text-center text-white">
      <img src="/assets/branding/logo-simus-blanco.svg" alt="SIMUS" width="160" height="48" class="mantenimiento__marca mb-10 h-12 w-auto" />

      <p class="tipo-etiqueta text-verde">{{ etiqueta() }}</p>
      <h1 #encabezadoRef tabindex="-1" class="mt-3 max-w-2xl tipo-seccion focus-visible:outline-none">{{ titulo() }}</h1>
      <p class="mt-5 max-w-xl tipo-subtitulo text-white/85" role="status" aria-live="polite">{{ descripcion() }}</p>

      @if (estado() === 'mantenimiento' && horaEstimada()) {
        <p class="mt-4 tipo-cuerpo text-white">Volvemos aproximadamente el <time [attr.datetime]="datos().hastaAprox">{{ horaEstimada() }}</time></p>
      }

      <div class="mt-9 flex flex-col items-center gap-4 sm:flex-row">
        @if (estado() === 'normal' && !comprobando()) {
          <a href="/" appBoton="principal" tamano="comodo" class="!bg-verde !text-morado hover:!bg-verde-claro focus-visible:!ring-white">Ir al inicio</a>
        } @else {
          <button type="button" appBoton="principal" tamano="comodo" class="!bg-verde !text-morado hover:!bg-verde-claro focus-visible:!ring-white disabled:!opacity-70" [disabled]="comprobando()" (click)="reintentar()">
            {{ comprobando() ? 'Comprobando…' : 'Reintentar' }}
          </button>
        }
      </div>

      @if (resultado()) {
        <p class="mt-4 tipo-pequeno text-white/85" role="status">{{ resultado() }}</p>
      }

      <nav aria-label="Redes oficiales del Ministerio" class="mt-14">
        <p class="tipo-pequeno text-white/85">Mientras tanto, síguenos en las redes oficiales del Ministerio de las Culturas, las Artes y los Saberes.</p>
        <ul class="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2">
          @for (red of redes; track red.id) {
            <li>
              <a [href]="red.href" [attr.target]="nuevaPestana.target" [attr.rel]="nuevaPestana.rel"
                 class="tipo-enlace text-white underline underline-offset-4 hover:text-verde focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-morado">
                {{ red.nombre }}<span class="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            </li>
          }
        </ul>
      </nav>
    </main>
  `,
})
export class MantenimientoPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly servicio = inject(EstadoDelServicioService);
  private readonly destruir = inject(DestroyRef);
  private readonly zona = inject(NgZone);

  protected readonly redes = REDES_INSTITUCIONALES;
  protected readonly nuevaPestana = DESTINO_NUEVA_PESTANA;
  protected readonly estado = this.servicio.estado;
  protected readonly datos = this.servicio.datos;
  private readonly encabezado = viewChild<ElementRef<HTMLElement>>('encabezadoRef');
  protected readonly comprobando = signal(false);
  protected readonly resultado = signal('');

  protected readonly etiqueta = computed(() => ({
    mantenimiento: 'Mantenimiento programado',
    'sin-conexion': 'Sin conexión con el servicio',
    normal: 'Estado del servicio',
  })[this.estado()]);

  protected readonly titulo = computed(() => ({
    mantenimiento: 'Estamos mejorando SIMUS',
    'sin-conexion': 'No logramos conectar con SIMUS',
    normal: 'SIMUS funciona con normalidad',
  })[this.estado()]);

  protected readonly descripcion = computed(() => {
    switch (this.estado()) {
      case 'mantenimiento':
        return this.datos().mensaje?.trim()
          || 'Estamos haciendo tareas de mantenimiento. Tu información está a salvo; vuelve en unos minutos.';
      case 'sin-conexion':
        return 'El servicio no responde en este momento. Revisa tu conexión y vuelve a intentarlo; si el problema sigue, el equipo ya puede estar atendiéndolo.';
      default:
        return 'No hay ningún mantenimiento en curso. Puedes volver al inicio.';
    }
  });

  protected readonly horaEstimada = computed(() => {
    const iso = this.datos().hastaAprox;
    const fecha = iso ? new Date(iso) : null;
    if (!fecha || Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(fecha);
  });

  constructor() {
    // El foco al título: quien usa lector de pantalla oye de qué se trata nada más llegar.
    afterNextRender(() => this.encabezado()?.nativeElement.focus());
  }

  ngOnInit(): void {
    // Quien llega directo a la dirección no viene de un 503: se mira cómo está el servicio.
    if (this.estado() === 'normal') void this.reintentar();
    // Fuera de la zona: un temporizador perpetuo dentro de ella impediría que la aplicación se declare estable.
    const reloj = this.zona.runOutsideAngular(() => setInterval(
      () => this.zona.run(() => { if (this.estado() !== 'normal') void this.reintentar(true); }),
      PERIODO_DE_REINTENTO_MS));
    this.destruir.onDestroy(() => clearInterval(reloj));
  }

  /** Pide algo del API que la API bloquea en mantenimiento. Si contesta bien, todo volvió. */
  async reintentar(enSilencio = false): Promise<void> {
    if (this.comprobando()) return;
    this.comprobando.set(true);
    if (!enSilencio) this.resultado.set('');
    try {
      await new Promise<void>((ok, fallo) => this.http.get('/api/v1/contenido-web').subscribe({ next: () => ok(), error: fallo }));
      const destino = this.servicio.rutaDeRetorno();
      const venia = this.servicio.estado() !== 'normal';
      this.servicio.restablecer();
      if (venia) this.irA(destino && !destino.startsWith('/mantenimiento') ? destino : '/');
    } catch (error) {
      // Una respuesta que no es de «caído» (p. ej. un 500 de otra cosa) prueba que el servicio contesta.
      const contesta = error instanceof HttpErrorResponse && ![0, 502, 503, 504].includes(error.status);
      if (contesta) {
        this.servicio.restablecer();
        return;
      }
      // El interceptor ya actualizó el estado (mantenimiento o sin conexión); aquí solo se avisa.
      if (!enSilencio) this.resultado.set('Todavía no está disponible. Vuelve a intentarlo en unos minutos.');
      if (this.estado() === 'normal') this.servicio.marcarSinConexion();
    } finally {
      this.comprobando.set(false);
    }
  }

  /** Recarga completa: lo que falló al cargar se vuelve a pedir limpio. Separado para poder probarlo. */
  protected irA(ruta: string): void {
    location.assign(ruta);
  }
}
