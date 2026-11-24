import { Component, OnInit, inject, signal } from '@angular/core';
import { SolicitudDeLaCuenta, SolicitudesDeLaCuentaService } from './solicitudes-de-la-cuenta.service';
import { ListaDeSolicitudesComponent } from './lista-de-solicitudes.component';
import { ApiError } from '../../../core/http/api-client.service';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { EncabezadoDePantallaComponent } from '../../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { EsqueletoComponent } from '../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * «Mi actividad y solicitudes» de Mi espacio (`/gestion/cuenta/solicitudes`, SOL).
 *
 * <b>UNA SOLA LISTA PARA TODO LO DE LA PERSONA</b>: lo de cada organización en la que participa, lo que registra
 * a título propio, sus citas y sus invitaciones, con los mismos estados y la misma fila para cada tipo. Lo lee del
 * servidor ya unificado; no hay una pantalla por tipo de proceso.
 */
@Component({
  selector: 'app-mi-actividad',
  standalone: true,
  imports: [EsqueletoComponent, ListaDeSolicitudesComponent, BotonNativoDirective, EncabezadoDePantallaComponent],
  template: `
    <section aria-labelledby="mi-actividad-titulo" class="space-y-5">
      <app-encabezado-de-pantalla idDelTitulo="mi-actividad-titulo" titulo="Mi actividad y solicitudes"
        descripcion="Lo que espera tu acción o una respuesta, de tus organizaciones y de lo que registras con tu cuenta. Cada fila lleva a donde se atiende." />
      @if (error()) {
        <div role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" data-error-de-solicitudes>
          <p>{{ error() }}</p>
          @if (detalle()) { <p class="mt-1 text-xs text-red-700" data-detalle-del-error>{{ detalle() }}</p> }
          <button type="button" appBoton="secundaria" class="mt-3" (click)="cargar()" data-reintentar>Reintentar</button>
        </div>
      }
      @if (cargando()) { <app-esqueleto variante="fila" [cantidad]="2" etiqueta="Consultando tus solicitudes…" /> }
      @else { <app-lista-de-solicitudes [solicitudes]="solicitudes()" /> }
    </section>
  `,
})
export class MiActividadComponent implements OnInit {
  private readonly servicio = inject(SolicitudesDeLaCuentaService);
  readonly solicitudes = signal<SolicitudDeLaCuenta[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  /** El detalle técnico que ayuda a quien soporta: código HTTP y referencia de la petición. */
  readonly detalle = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  /** Consulta la lista; también es lo que hace «Reintentar». */
  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.detalle.set('');
    this.servicio.deLaCuenta().subscribe({
      next: filas => { this.solicitudes.set(filas ?? []); this.cargando.set(false); },
      error: fallo => {
        const motivo = motivoDeLaFalla(fallo);
        this.error.set(motivo.mensaje);
        this.detalle.set(motivo.detalle);
        this.cargando.set(false);
      },
    });
  }
}

/**
 * EL MOTIVO REAL DE LA FALLA, sin ocultarlo detrás de un mensaje único: sin conexión, servicio no disponible, sesión vencida
 * o un error del servidor. El detalle (código y referencia) acompaña siempre que se conozca.
 */
export function motivoDeLaFalla(fallo: unknown): { mensaje: string; detalle: string } {
  const e = fallo as Partial<ApiError> | null;
  const estado = e?.status ?? null;
  const partes = [estado ? `Código ${estado}` : '', e?.code && e.code !== 'API_ERROR' ? e.code : '', e?.requestId ? `referencia ${e.requestId}` : ''].filter(Boolean);
  const detalle = partes.join(' · ');
  if (e?.code === 'NETWORK' || estado === 0) return { mensaje: 'No hay conexión con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.', detalle };
  if (e?.code === 'TIMEOUT') return { mensaje: 'El servidor tardó demasiado en responder. Inténtalo de nuevo en un momento.', detalle };
  if (estado === 401) return { mensaje: 'Tu sesión venció. Vuelve a iniciar sesión para ver tus solicitudes.', detalle };
  if (estado === 404 || estado === 405 || estado === 502 || estado === 503 || estado === 504) return { mensaje: 'La consulta de solicitudes no está disponible por ahora. Inténtalo de nuevo más tarde.', detalle };
  return { mensaje: 'No fue posible consultar tus solicitudes: el servidor respondió con un error.', detalle };
}
