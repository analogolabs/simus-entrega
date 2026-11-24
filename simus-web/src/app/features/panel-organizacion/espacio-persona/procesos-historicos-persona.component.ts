import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExternalSessionService } from '../../../core/services/external-session.service';
import { RUTAS_DE_LA_CUENTA, rutaDelPanel } from '../../../core/navegacion/rutas-de-gestion';

/**
 * Procesos históricos, para quien todavía no tiene organización (o la quiere elegir).
 *
 * <b>POR QUÉ EXISTE.</b> Pedir la administración de un proceso histórico es de una ORGANIZACIÓN: la
 * solicitud la firma ella y el proceso pasa a ella. Una persona sin organización que llega desde la
 * ficha pública de un Festival («Pedir su administración») no tiene a dónde ir; antes aterrizaba en
 * «Mi espacio» sin ninguna explicación (D3-10). Aquí se le dice qué falta y se le ofrecen los dos
 * caminos: registrar su organización o unirse a una por invitación. Si ya administra alguna, elige
 * con cuál pedirlo y sigue a la herramienta de esa organización, con el proceso ya buscado.
 */
@Component({
  selector: 'app-procesos-historicos-persona',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-3xl space-y-6 pb-8">
      <header>
        <p class="text-sm text-slate-600">Herramientas / Procesos históricos</p>
        <h1 class="mt-2 text-morado">Procesos históricos</h1>
        <p class="mt-2 text-cuerpo leading-relaxed text-prosa">
          Algunos procesos —Festivales y Mercados musicales— ya estaban en SIMUS sin organización: se cargaron como registros
          históricos. Si uno es tuyo, la administración se pide con una organización, que es quien lo gestiona después.
        </p>
      </header>

      @if (festival) {
        <p data-testid="historicos-persona-festival" class="border border-emerald-200 rounded-lg bg-emerald-50/60 px-4 py-3 text-sm text-slate-800">
          Para pedir la administración de <span class="font-bold">«{{ festival }}»</span> necesitas una organización.
        </p>
      }

      @if (organizaciones().length > 0) {
        <section aria-labelledby="historicos-con-cual" data-testid="historicos-persona-con-organizacion">
          <h3 id="historicos-con-cual">¿Con cuál de tus organizaciones lo pides?</h3>
          <!-- DECISIÓN 90: nunca se elige por ti. La solicitud se hace a nombre de la organización que escojas. -->
          <p class="mt-1 text-sm text-slate-600">La solicitud se hace a nombre de la organización que elijas; no escogemos una por ti.</p>
          <ul class="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            @for (organizacion of organizaciones(); track organizacion.id) {
              <li class="flex items-center justify-between gap-3 py-3">
                <span class="text-sm font-bold text-slate-900">{{ organizacion.name }}</span>
                <a [routerLink]="rutaDeLaHerramienta(organizacion.id)" [queryParams]="parametros" class="text-sm font-bold text-verde-texto hover:underline">Continuar con esta organización</a>
              </li>
            }
          </ul>
        </section>
      } @else {
        <section aria-labelledby="historicos-sin-organizacion" data-testid="historicos-persona-sin-organizacion">
          <h3 id="historicos-sin-organizacion">Aún no tienes una organización</h3>
          <ul class="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
            <li>Si tu proyecto tiene una organización, <a [routerLink]="rutas.registrarOrganizacion" class="font-bold text-verde-texto hover:underline">regístrala</a> y vuelve aquí.</li>
            <li>Si ya hay una organización registrada, pide a quien la administra que te invite desde su equipo: la invitación llega a tu correo.</li>
          </ul>
          <p class="mt-4 text-sm text-slate-600">
            Mientras tanto puedes <a [routerLink]="rutas.miEspacio" class="font-bold text-verde-texto hover:underline">volver a Mi espacio</a>.
          </p>
        </section>
      }
    </div>
  `,
})
export class ProcesosHistoricosPersonaComponent {
  private readonly sesion = inject(ExternalSessionService);
  private readonly ruta = inject(ActivatedRoute);

  readonly rutas = RUTAS_DE_LA_CUENTA;
  readonly organizaciones = this.sesion.organizaciones;
  /** El proceso que llega pedido desde su ficha pública, si lo trae. */
  readonly festival = this.ruta.snapshot.queryParamMap.get('buscar');
  /** Se conserva el proceso pedido al seguir con una organización. */
  readonly parametros: Record<string, string> = (() => {
    const q = this.ruta.snapshot.queryParamMap;
    const salida: Record<string, string> = {};
    for (const clave of ['reclamar', 'buscar', 'tipo']) { const valor = q.get(clave); if (valor) salida[clave] = valor; }
    return salida;
  })();

  rutaDeLaHerramienta(organizacionId: string): string[] {
    return rutaDelPanel(organizacionId, 'herramientas', 'procesos-historicos');
  }
}
