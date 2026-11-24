import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RUTAS_DE_LA_CUENTA } from '../../../../core/navegacion/rutas-de-gestion';
import { AgendaPublica, AgendamientoDeCitasService } from '../../../../core/services/agendamiento-de-citas.service';
import { FechaPipe } from '../../../../shared/utils/fecha.pipe';
import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';
import { EstadoDeListaComponent } from '../../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * Agenda de citas de los Mercados (`/ecosistema/agenda-de-citas`): dice qué Mercados tienen abierta su
 * agenda de citas entre artistas y compradores, y lleva a inscribirse.
 *
 * <b>NO ENSEÑA A NINGUNA PERSONA.</b> Solo el Mercado, su edición, las fechas y el cupo. Los artistas y
 * los compradores de una agenda solo los ven quienes participan en ella, y el contacto, solo con la cita
 * confirmada. Para inscribirse hay que entrar con la cuenta: el enlace lleva a la agenda y, si no hay
 * sesión, a ingresar y volver.
 */
@Component({
  selector: 'app-agendas-de-citas-publicas-page',
  standalone: true,
  imports: [TextoWebPipe, BotonNativoDirective, EsqueletoComponent, EstadoDeListaComponent, RouterLink, FechaPipe],
  template: `
    <div class="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <header class="border-b border-slate-200 pb-6">
        <p class="text-dato font-bold text-verde-texto">{{ 'citas_miga' | textoWeb }}</p>
        <h1 class="mt-2 font-alternate text-3xl font-bold text-morado">{{ 'citas_titulo' | textoWeb }}</h1>
        <p class="mt-3 max-w-2xl text-cuerpo leading-relaxed text-prosa">
          {{ 'citas_intro' | textoWeb }}
        </p>
      </header>

      @if (error()) { <p role="alert" class="bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }

      @if (cargando()) {
        <app-esqueleto variante="fila" [cantidad]="2" [etiqueta]="'citas_cargando' | textoWeb" />
      } @else if (!agendas().length) {
        <app-estado-de-lista data-testid="sin-agendas-publicas" [titulo]="'citas_vacio_titulo' | textoWeb" [detalle]="'citas_vacio_texto' | textoWeb" />
      } @else {
        <ul class="divide-y divide-slate-200 border-y border-slate-200" data-testid="agendas-publicas">
          @for (a of agendas(); track a.agendaId) {
            <li class="grid gap-3 py-4 sm:grid-cols-[2fr_1fr_auto] sm:items-center">
              <div class="min-w-0">
                <h2 class="truncate text-base font-bold text-slate-900">{{ a.mercadoNombre }}</h2>
                <p class="mt-1 text-sm text-slate-600">
                  Edición {{ a.anio }}@if (a.fechaInicio) { · {{ a.fechaInicio | fecha }}@if (a.fechaFin) { al {{ a.fechaFin | fecha }} } }
                </p>
              </div>
              <p class="text-cuerpo text-prosa">
                {{ a.inscripcionAbierta ? 'Inscripción abierta' : 'Inscripción cerrada' }}@if (a.cupoArtistas) { · {{ a.artistasAprobados }} de {{ a.cupoArtistas }} lugares }
              </p>
              <a [routerLink]="[rutaDeLaAgenda, a.agendaId]" data-testid="entrar-a-la-agenda"
                 appBoton="principal" tamano="menudo">
                {{ a.inscripcionAbierta ? 'Inscribirme' : 'Ver mi agenda' }}
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class AgendasDeCitasPublicasPageComponent implements OnInit {
  private readonly servicio = inject(AgendamientoDeCitasService);

  readonly rutaDeLaAgenda = RUTAS_DE_LA_CUENTA.agendaDeCitas;
  readonly agendas = signal<AgendaPublica[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.cargando.set(true);
    this.servicio.agendasPublicas().subscribe({
      next: agendas => { this.cargando.set(false); this.agendas.set(agendas); },
      error: () => {
        this.cargando.set(false);
        this.error.set('No fue posible consultar las agendas de citas.');
      },
    });
  }
}
