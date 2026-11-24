import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProcesosHistoricosReclamablesComponent } from '../procesos-historicos-reclamables.component';
import { PanelOrganizacionStore } from '../panel-organizacion.store';
import { RECLAMACION_ABIERTA, ReclamacionDeFestival, ReclamacionesDeProcesosService, etiquetaDeReclamacion } from '../reclamaciones-de-procesos.service';
import { RUTAS_DE_LA_CUENTA, rutaDelPanel } from '../../../core/navegacion/rutas-de-gestion';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { tonoDelEstado } from '../../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { EsqueletoComponent } from '../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * Procesos históricos: una HERRAMIENTA de SIMUS, no una parte de la lista de Festivales.
 *
 * <b>POR QUÉ ES UNA PÁGINA APARTE.</b> Se cargaron procesos históricos que todavía no tienen
 * organización. Reclamarlos es una posibilidad que ofrece SIMUS —se pide una vez, con soportes, y
 * el PNMC decide—, no algo propio de la gestión diaria de la organización, así que no vive
 * debajo de la lista de Festivales (decisión 74, docs/referencia/20-decisiones-y-flujos-por-modulo.md). Se llega desde Herramientas, desde el
 * resumen cuando hay históricos cerca, desde la ficha pública de un Festival («Pedir su
 * administración») y desde el asistente de alta, cuando la organización está registrando uno nuevo.
 */
@Component({
  selector: 'app-procesos-historicos-page',
  standalone: true,
  imports: [EsqueletoComponent, RouterLink, ProcesosHistoricosReclamablesComponent, IndicadorDeEstadoComponent],
  template: `
    <div class="space-y-8 pb-8">
      <header class="border-b border-slate-200 pb-6">
        <p class="text-sm text-slate-600">
          <a [routerLink]="enPanel('herramientas')" class="font-bold text-verde-texto hover:underline">Herramientas</a>
          <span aria-hidden="true"> / </span>Procesos históricos
        </p>
        <h1 id="historicos-herramienta-titulo" class="mt-2 text-morado">Procesos históricos</h1>
        <p class="mt-2 max-w-3xl text-cuerpo leading-relaxed text-prosa">
          Los registros históricos provienen de los levantamientos, la identificación y la caracterización que realizó el
          Plan Nacional de Música para la Convivencia (Ministerio de las Culturas, las Artes y los Saberes) como Sistema de
          Información de la Música. Pueden ser Festivales, Mercados musicales, Redes y documentación, Lutería o Espacios para
          música en vivo, y pueden tener organización o no. Si uno es de tu organización, puedes pedir su administración: se
          revisa tu solicitud y, si se aprueba, el proceso pasa a tu organización con su historia.
        </p>
        <p class="mt-2 max-w-3xl text-sm text-slate-600">
          ¿Vas a registrar un Festival nuevo? <a [routerLink]="enPanel('procesos/festivales/nuevo')" class="font-bold text-verde-texto hover:underline">El asistente de alta</a>
          también te avisa si ya existe uno parecido.
        </p>
      </header>

      @if (pideUnProceso && organizacion(); as organizacionElegida) {
        <p data-testid="historicos-organizacion-elegida" class="border border-emerald-200 rounded-lg bg-emerald-50/60 px-4 py-3 text-sm text-slate-800">
          Vas a pedir la administración{{ proceso ? ' de «' + proceso + '»' : '' }} con
          <span class="font-bold">«{{ organizacionElegida.name }}»</span>.
          @if (hayVariasOrganizaciones()) {
            <a [routerLink]="rutaParaElegir" [queryParams]="parametros" data-testid="historicos-cambiar-organizacion" class="ml-1 font-bold text-verde-texto hover:underline">Cambiar de organización</a>
          }
        </p>
      }

      <section aria-labelledby="mis-solicitudes-historicos" data-testid="historicos-mis-solicitudes">
        <h2 id="mis-solicitudes-historicos">Mis solicitudes de administración</h2>
        @if (cargando()) {
          <app-esqueleto variante="fila" [cantidad]="2" etiqueta="Consultando tus solicitudes…" />
        } @else if (solicitudes().length === 0) {
          <p class="py-4 text-sm text-slate-600">Todavía no has pedido la administración de ningún proceso histórico.</p>
        } @else {
          <ul class="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            @for (solicitud of solicitudes(); track solicitud.id) {
              <li class="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between" [attr.data-testid]="'historicos-solicitud-' + solicitud.id">
                <div class="min-w-0">
                  <p class="text-sm font-bold text-slate-900">{{ solicitud.registroNombre || 'Proceso histórico' }}</p>
                  <p class="text-xs text-slate-600">Pedida el {{ fecha(solicitud.fechaCreacion) }}</p>
                  @if (solicitud.estado === 'rechazada' && solicitud.motivoDecision) {
                    <p class="mt-1 text-sm text-slate-700">Motivo: {{ solicitud.motivoDecision }}</p>
                  }
                </div>
                <div class="flex flex-wrap items-center gap-3">
                  <app-indicador-de-estado [etiqueta]="etiqueta(solicitud.estado)" [tono]="tonoDelEstado(solicitud.estado)" [conTexto]="true" />
                  @if (esAbierta(solicitud.estado)) {
                    <a [routerLink]="enPanel('solicitudes')" class="text-sm font-bold text-verde-texto hover:underline">Ver en Solicitudes</a>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <app-procesos-historicos-reclamables class="block" (solicitudEnviada)="cargarSolicitudes()" />
    </div>
  `,
})
export class ProcesosHistoricosPageComponent {
  private readonly store = inject(PanelOrganizacionStore);
  private readonly servicio = inject(ReclamacionesDeProcesosService);
  private readonly destruccion = inject(DestroyRef);

  readonly solicitudes = signal<ReclamacionDeFestival[]>([]);
  readonly cargando = signal(true);
  readonly etiqueta = etiquetaDeReclamacion;
  readonly tonoDelEstado = tonoDelEstado;

  private readonly ruta = inject(ActivatedRoute);
  /** El proceso que llega pedido desde su ficha pública, si lo trae (decisión 90: se dice con qué organización se pide). */
  readonly proceso = this.ruta.snapshot.queryParamMap.get('buscar');
  readonly pideUnProceso = this.ruta.snapshot.queryParamMap.get('reclamar') !== null;
  readonly parametros: Record<string, string> = (() => {
    const q = this.ruta.snapshot.queryParamMap;
    const salida: Record<string, string> = {};
    for (const clave of ['reclamar', 'buscar', 'tipo']) { const valor = q.get(clave); if (valor) salida[clave] = valor; }
    return salida;
  })();
  readonly rutaParaElegir = RUTAS_DE_LA_CUENTA.procesosHistoricos;
  readonly organizacion = computed(() => { this.store.organizacionId(); return this.store.organizacionElegida(); });
  readonly hayVariasOrganizaciones = this.store.hayVariasOrganizaciones;

  constructor() {
    effect(() => {
      if (this.store.organizacionId()) untracked(() => this.cargarSolicitudes());
    });
  }

  /**
   * Pide «Mis solicitudes de administración». Se llama al entrar y cada vez que se envía una nueva
   * (D-03): sin esto la sección seguía diciendo «Todavía no has pedido…» junto al aviso de envío.
   * En el refresco no se vuelve al esqueleto: la lista que ya se ve no parpadea.
   */
  cargarSolicitudes(): void {
    const id = this.store.organizacionId();
    if (!id) return;
    if (this.solicitudes().length === 0) this.cargando.set(true);
    this.servicio.reclamaciones(id).pipe(takeUntilDestroyed(this.destruccion)).subscribe({
      next: lista => { this.solicitudes.set((lista ?? []).filter(r => !r.dominio || /festival|mercado|taller|espacio|redes/i.test(r.dominio))); this.cargando.set(false); },
      error: () => { this.solicitudes.set([]); this.cargando.set(false); },
    });
  }

  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }

  esAbierta(estado: string): boolean { return RECLAMACION_ABIERTA.includes(estado); }

  fecha(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
  }
}
