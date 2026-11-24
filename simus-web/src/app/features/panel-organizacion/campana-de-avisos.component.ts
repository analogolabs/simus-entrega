import { Component, DestroyRef, ElementRef, HostListener, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { destinoExternoDe, NotificacionesEnVivoService, organizacionDelAviso } from '../../core/services/notificaciones-en-vivo.service';
import { NotificacionDelPanel, PanelOrganizacionApi } from './panel-organizacion.api';
import { FechaPipe } from '../../shared/utils/fecha.pipe';

/**
 * La campana de avisos de la cuenta, en el panel de una organización y en el espacio personal.
 *
 * <b>SE SEPARÓ DEL ARMAZÓN DEL PANEL EN L2</b> porque la persona sin organización también
 * recibe avisos —el de confirmar el correo, el primero— y su espacio ya no es el panel.
 *
 * <b>Son dos cosas distintas, la campana y Solicitudes.</b> Solicitudes es lo que la organización
 * envió y en qué punto está; los avisos son lo que el circuito de revisión fue escribiendo.
 *
 * <b>UNA CAMPANA PARA TODAS LAS ORGANIZACIONES.</b> Los avisos son de la cuenta. Con varias
 * organizaciones, cada aviso que sabe de cuál es lo dice, y su enlace abre ESA organización.
 */
@Component({
  selector: 'app-campana-de-avisos',
  standalone: true,
  imports: [FechaPipe, RouterLink],
  template: `
    <div class="relative" data-panel-avisos>
      <button type="button" data-testid="campana-avisos" (click)="alternar()" [attr.aria-expanded]="abierta()" aria-haspopup="menu" [attr.aria-label]="sinLeer() === 0 ? 'Notificaciones: no tienes avisos sin leer' : (sinLeer() === 1 ? 'Notificaciones: 1 aviso sin leer' : 'Notificaciones: ' + sinLeer() + ' avisos sin leer')" class="relative grid place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2" [class]="tono() === 'oscuro' ? 'h-9 w-9 text-white/80 hover:bg-white/15 hover:text-white focus-visible:ring-white/70' : 'h-10 w-10 text-slate-600 hover:bg-white hover:text-morado focus-visible:ring-morado'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" class="h-5 w-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        @if (sinLeer()) { <span data-testid="campana-contador" class="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-verde-texto px-1 text-dato font-bold text-white">{{ sinLeer() }}</span> }
      </button>
      @if (abierta()) {
        <div role="menu" data-testid="panel-avisos" class="absolute right-0 top-full z-[70] mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><p class="text-dato font-bold text-morado">Avisos</p><p class="mt-0.5 text-xs text-slate-500">{{ sinLeer() ? sinLeer() + ' pendientes de lectura' : 'Estás al día' }}</p></div><div class="flex shrink-0 items-center gap-3">@if (leidos()) { <button type="button" data-testid="limpiar-avisos-leidos" (click)="limpiarLeidos()" class="text-xs font-bold text-slate-600 hover:text-morado hover:underline">Limpiar leídos</button> } @if (sinLeer()) { <button type="button" (click)="marcarTodas()" class="text-xs font-bold text-verde-texto hover:underline">Marcar todos</button> }</div></div>
          @if (!notificaciones().length) { <p class="p-5 text-sm text-slate-500">No tienes avisos por revisar.</p> }
          @else {
            <ul class="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
              @for (aviso of notificaciones(); track aviso.id) {
                <li class="px-4 py-3" [class.bg-emerald-50/50]="!aviso.readAt"><div class="flex gap-3"><span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" [class.bg-verde-texto]="!aviso.readAt" [class.bg-slate-300]="aviso.readAt"></span><div class="min-w-0 flex-1">
                  @if (organizacionDe(aviso); as organizacion) { <p data-testid="aviso-organizacion" class="mb-0.5 text-dato font-bold text-slate-500">{{ organizacion }}</p> }
                  @if (ruta(aviso); as destino) { <a [routerLink]="destino" [queryParams]="parametros(aviso)" (click)="abrir(aviso)" class="group block rounded-md no-underline outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2"><p class="text-sm font-bold text-slate-900 group-hover:text-morado">{{ aviso.title }}</p><p class="mt-0.5 text-xs text-slate-600">{{ aviso.body }}</p><span class="mt-2 inline-block text-xs font-bold text-verde-texto group-hover:underline">{{ accion(aviso) }}</span></a> }
                  @else { <p class="text-sm font-bold text-slate-900">{{ aviso.title }}</p><p class="mt-0.5 text-xs text-slate-600">{{ aviso.body }}</p> }
                  <div class="mt-2 flex items-center justify-between gap-2 text-dato text-slate-400"><span>{{ aviso.createdAt | fecha:'fecha-hora' }}</span>@if (!aviso.readAt) { <button type="button" (click)="marcarLeida(aviso)" class="font-bold text-verde-texto hover:underline">Marcar como leída</button> }</div>
                </div></div></li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
})
export class CampanaDeAvisosComponent implements OnInit {
  private readonly api = inject(PanelOrganizacionApi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificacionesEnVivo = inject(NotificacionesEnVivoService);
  private readonly sesionExterna = inject(ExternalSessionService);

  /** La organización abierta: los avisos que no dicen la suya se abren en ella. */
  readonly organizacionId = input('');

  /** `oscuro` sobre la cabecera morada del panel (UI-E); `claro` sobre fondo claro, como en Mi espacio. */
  readonly tono = input<'claro' | 'oscuro'>('claro');

  readonly notificaciones = signal<NotificacionDelPanel[]>([]);
  readonly abierta = signal(false);
  readonly sinLeer = computed(() => this.notificaciones().filter(aviso => !aviso.readAt).length);
  readonly leidos = computed(() => this.notificaciones().filter(aviso => !!aviso.readAt).length);

  ngOnInit(): void {
    this.notificacionesEnVivo.observar('externo', 50).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: pagina => this.notificaciones.set(pagina?.items ?? []),
    });
  }

  alternar(): void {
    this.abierta.update(abierta => !abierta);
  }

  /** Cierra el panel al hacer clic fuera. Mismo mecanismo que el menú de cuenta de la barra. */
  @HostListener('document:pointerdown', ['$event'])
  alHacerClicFuera(evento: PointerEvent): void {
    if (!this.abierta()) return;
    const objetivo = evento.target as Node | null;
    if (!objetivo || !this.host.nativeElement.querySelector('[data-panel-avisos]')?.contains(objetivo)) {
      this.abierta.set(false);
    }
  }

  /** El nombre de la organización del aviso, solo si la cuenta tiene varias y el aviso la dice. */
  organizacionDe(aviso: NotificacionDelPanel): string | null {
    const organizaciones = this.sesionExterna.organizaciones();
    if (organizaciones.length < 2) return null;
    const id = organizacionDelAviso(aviso);
    return id ? organizaciones.find(organizacion => organizacion.id === id)?.name ?? null : null;
  }

  /**
   * Solo los avisos que representan una acción pendiente tienen destino. Los avisos puramente
   * informativos conservan su función de registro y no simulan ser enlaces.
   */
  ruta(aviso: NotificacionDelPanel): string[] | null {
    return destinoExternoDe(aviso, this.organizacionId())?.ruta.map(segmento => String(segmento)) ?? null;
  }

  parametros(aviso: NotificacionDelPanel): Record<string, string> | null {
    return destinoExternoDe(aviso, this.organizacionId())?.parametros ?? null;
  }

  accion(aviso: NotificacionDelPanel): string {
    return destinoExternoDe(aviso, this.organizacionId())?.accion ?? '';
  }

  abrir(aviso: NotificacionDelPanel): void {
    this.abierta.set(false);
    if (!aviso.readAt) this.marcarLeida(aviso);
  }

  marcarLeida(aviso: NotificacionDelPanel): void {
    this.api.marcarNotificacionLeida(aviso.id).subscribe({
      next: actualizada => this.notificaciones.update(lista => lista.map(item => (item.id === actualizada.id ? actualizada : item))),
      error: () => undefined,
    });
  }

  marcarTodas(): void {
    const pendientes = this.notificaciones().filter(aviso => !aviso.readAt);
    if (!pendientes.length) return;
    forkJoin(pendientes.map(aviso => this.api.marcarNotificacionLeida(aviso.id))).subscribe({
      next: actualizadas => this.notificaciones.update(lista => lista.map(item => actualizadas.find(actualizada => actualizada.id === item.id) ?? item)),
      error: () => undefined,
    });
  }

  limpiarLeidos(): void {
    if (!this.leidos()) return;
    this.api.ocultarNotificacionesLeidas().subscribe({
      next: () => this.notificaciones.update(lista => lista.filter(aviso => !aviso.readAt)),
      error: () => undefined,
    });
  }
}
