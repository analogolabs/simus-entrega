import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { rutaDelPanel } from '../../../core/navegacion/rutas-de-gestion';
import {
  APROBACIONES_DE_ARTISTAS, Agenda, AgendaDelOrganizador, AgendamientoDeCitasService, AprobacionDeArtistas, Cita,
  ConfiguracionDeAgenda, EstadoDeCita, MODOS_DE_AGENDA, ModoDeAgenda,
  Participante, TIPOS_DE_COMPRADOR, agruparPorJornada, etiquetaDeEstadoDeAgenda, etiquetaDeEstadoDeCita, etiquetaDeEstadoDeParticipante,
  etiquetaDeAprobacion, etiquetaDeModo, vocabularioDeModo, etiquetaDeTipoDeComprador, horaDeLaFranja, rotuloDeJornada, claveDeDia, tonoDeEstadoDeAgenda, tonoDeEstadoDeCita, tonoDeEstadoDeParticipante,
} from '../../../core/services/agendamiento-de-citas.service';
import { AvatarDePersonaComponent } from '../../../shared/components/agenda-de-citas/avatar-de-persona.component';
import { CalendarioDeAgendaComponent, CeldaDeFranja, EstadoDeFranja } from '../../../shared/components/agenda-de-citas/calendario-de-agenda.component';
import { DibujoDeAgenda, IlustracionDeAgendaComponent } from '../../../shared/components/agenda-de-citas/ilustracion-de-agenda.component';
import { CeldaDeParrilla, FilaDeParrilla, ParrillaDeAgendaComponent } from '../../../shared/components/agenda-de-citas/parrilla-de-agenda.component';
import { VistaPreviaDeAgendaComponent } from '../../../shared/components/agenda-de-citas/vista-previa-de-agenda.component';
import { ConfiguracionDeAgendaComponent } from './configuracion-de-agenda.component';
import { HerramientaAPantallaCompletaComponent, SeccionDeHerramienta } from '../../../shared/components/agenda-de-citas/herramienta-a-pantalla-completa.component';
import { FichaDePersonaComponent } from '../../../shared/components/agenda-de-citas/ficha-de-persona.component';
import { IndicadorDeCifraComponent } from '../../../shared/components/agenda-de-citas/indicador-de-cifra.component';
import { LineaDeEtapasComponent } from '../../../shared/components/agenda-de-citas/linea-de-etapas.component';
import { TarjetaDeMesaComponent } from '../../../shared/components/agenda-de-citas/tarjeta-de-mesa.component';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { CampoDeTextoComponent } from '../../../shared/components/ui/campo-de-texto/campo-de-texto.component';
import { SelectorSegmentadoComponent } from '../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { EsqueletoComponent } from '../../../shared/components/ui/esqueleto/esqueleto.component';
import { FiltroDesplegableComponent } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { FalloDelServidor } from '../panel-organizacion.api';
import { PanelOrganizacionStore } from '../panel-organizacion.store';

/** Las vistas de la agenda para la organización: una por cosa que se hace en ella. */
const VISTAS: readonly string[] = ['resumen', 'parrilla', 'calendario', 'participantes', 'citas', 'franjas', 'configuracion'];
export type VistaDeLaAgenda = 'resumen' | 'parrilla' | 'calendario' | 'participantes' | 'citas' | 'franjas' | 'configuracion';

/**
 * La agenda de citas de una edición de Mercado, vista por su organización (docs/referencia/26-agenda-de-citas-y-mercados.md §26.15).
 *
 * <b>ES UNA HERRAMIENTA DEL MERCADO</b>, no una pantalla suelta: vive bajo la ficha del Mercado
 * (`procesos/mercados/:id/agenda-de-citas/:agendaId`) y su miga vuelve a ella. Las direcciones de
 * `herramientas/agenda-de-citas/:agendaId` siguen sirviendo y redirigen aquí.
 *
 * <b>QUÉ SE VE Y EN QUÉ ORDEN.</b> Arriba, siempre: el estado, el SIGUIENTE PASO (con su botón) y las cifras
 * de la agenda (franjas, cupo, lista de espera, por aprobar, citas). Debajo, las pestañas, que son vistas de la
 * misma agenda: Resumen (lo que espera una decisión), Participantes, Citas, Franjas y Configuración. Sin la
 * agenda creada (`nueva/:edicionId`) solo se muestra la configuración.
 *
 * Quien edita prepara; abrir, iniciar y cerrar la agenda, rechazar o retirar a alguien y cancelar una
 * cita son del administrador, y el servidor lo exige aunque aquí se muestren.
 */
@Component({
  selector: 'app-agenda-de-citas-organizacion',
  standalone: true,
  imports: [
    FormsModule, RouterLink, BotonNativoDirective, CampoDeTextoComponent, EsqueletoComponent, FechaPipe, FiltroDesplegableComponent,
    IndicadorDeEstadoComponent, SelectorSegmentadoComponent, FichaDePersonaComponent, IndicadorDeCifraComponent, LineaDeEtapasComponent, TarjetaDeMesaComponent, CalendarioDeAgendaComponent, HerramientaAPantallaCompletaComponent,
    AvatarDePersonaComponent, IlustracionDeAgendaComponent, ParrillaDeAgendaComponent, ConfiguracionDeAgendaComponent, VistaPreviaDeAgendaComponent,
  ],
  styles: [`
    .campo-nativo {
      box-sizing: border-box; height: var(--spacing-control); width: 100%; border: 1px solid var(--color-borde-campo);
      border-radius: var(--radius-control); background: #fff; padding: 0 .75rem; color: var(--color-valor);
      font-family: inherit; font-size: var(--text-cuerpo);
    }
    .campo-nativo:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); border-color: var(--color-foco); }
    .campo-nativo:disabled { background: #f6f7f9; color: var(--color-rotulo); cursor: not-allowed; }
    .hueco { min-height: 2.75rem; border: 1px solid var(--color-borde-campo); background: #fff; padding: 0 .9rem; font: inherit; font-size: var(--text-cuerpo); color: var(--color-valor); cursor: pointer; min-width: 4.5rem; border-radius: .6rem; font-variant-numeric: tabular-nums; }
    .hueco.existe { background: #dff3e8; border-color: #2e9d6a; color: #0f5132; font-weight: 700; }
    .cap::first-letter { text-transform: uppercase; }
    .hueco:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: 2px; }
  `],
  template: `
    <app-herramienta-a-pantalla-completa [titulo]="tituloDeLaAgenda()" [procedencia]="procedencia()" [volverA]="volver()"
      [secciones]="secciones()" [seccionActiva]="vista()" controla="panel-de-la-agenda" (elegir)="elegirVista($any($event))">
      <span estado>
        @if (datos(); as d) {
          <span class="app__estado-texto" data-testid="estado-de-la-agenda">
            <span class="app__punto" [class]="'app__punto app__punto--' + d.agenda.estado" aria-hidden="true"></span>{{ etiquetaAgenda(d.agenda.estado) }}
          </span>
        }
      </span>
      <div acciones class="flex flex-wrap items-center gap-2">
        @if (datos(); as d) {
          @if (d.agenda.estado === 'borrador') {
            <button type="button" data-testid="abrir-agenda" class="app__boton app__boton--principal" [disabled]="guardando() || !d.agenda.franjas" (click)="cambiarEstado('abrir')">Abrir la inscripción</button>
          }
          @if (d.agenda.estado === 'abierta') {
            <button type="button" data-testid="iniciar-agenda" class="app__boton app__boton--principal" [disabled]="guardando()" (click)="cambiarEstado('iniciar')">Cerrar la inscripción e iniciar</button>
          }
          @if (d.agenda.estado !== 'cerrada') {
            <button type="button" data-testid="cerrar-agenda" class="app__boton" [disabled]="guardando()" (click)="cambiarEstado('cerrar')">Cerrar la agenda</button>
          }
          <details class="relative" data-testid="menu-de-salidas">
            <summary class="app__boton list-none">Exportar<span aria-hidden="true">▾</span></summary>
            <div class="absolute right-0 z-10 mt-1 flex w-56 flex-col rounded-lg bg-white p-1 shadow-menu">
              <a data-testid="exportar-csv" [href]="urlDelCsv()" download class="rounded px-3 py-2 text-cuerpo font-semibold text-valor no-underline hover:bg-morado-50">Hoja de cálculo (CSV)</a>
              <a data-testid="exportar-ics" [href]="urlDelIcs()" download class="rounded px-3 py-2 text-cuerpo font-semibold text-valor no-underline hover:bg-morado-50">Calendario (.ics)</a>
              <button type="button" data-testid="imprimir-agenda" class="rounded px-3 py-2 text-left text-cuerpo font-semibold text-valor hover:bg-morado-50" (click)="imprimir()">Imprimir</button>
            </div>
          </details>
        }
      </div>

    <div class="space-y-5 pb-10">
      @if (error()) { <p role="alert" data-testid="error" class="rounded-lg bg-red-50 p-3 text-cuerpo text-red-800">{{ error() }}</p> }
      @if (aviso()) { <p role="status" data-testid="aviso" class="rounded-lg bg-emerald-50 p-3 text-cuerpo text-emerald-900">{{ aviso() }}</p> }

      @if (cargando()) {
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <app-esqueleto variante="encabezado" etiqueta="Consultando la agenda…" />
          <app-esqueleto variante="fila" [cantidad]="3" etiqueta="Consultando la agenda…" />
        </div>
      } @else {
        @if (!datos()) {
          <header class="app-superficie app-superficie--lectura flex flex-wrap items-center gap-5">
            <app-ilustracion-de-agenda dibujo="calendario" [ancho]="8" />
            <div class="min-w-0 max-w-2xl">
              <h2 class="text-morado">Habilita la agenda de citas de {{ edicionNueva()?.mercadoNombre ?? 'este Mercado' }}</h2>
              <p class="mt-1 text-cuerpo leading-relaxed text-prosa">Cuatro pasos cortos y a la derecha ves cómo la verán los artistas. Después generas las franjas, invitas a los compradores y abres la inscripción.</p>
            </div>
          </header>
        }

        <div id="panel-de-la-agenda" class="space-y-5" role="region" aria-label="Contenido de la agenda">
        @if (!datos() || vista() === 'configuracion') {
          <section aria-labelledby="cfg-titulo" class="app-superficie app-superficie--lectura space-y-4">
            <h2 id="cfg-titulo" class="sr-only">Ajustes</h2>
            <app-configuracion-de-agenda [mercado]="datos()?.agenda?.mercadoNombre ?? edicionNueva()?.mercadoNombre ?? 'Mercado'" [bloqueada]="cerrada()" [hayFranjas]="hayFranjas()"
              [guardando]="guardando()" [existe]="!!datos()" [(paso)]="paso" [(nombre)]="cfgNombre" [(modo)]="cfgModo" [(aprobacion)]="cfgAprobacion"
              [(duracion)]="cfgDuracion" [(pausa)]="cfgPausa" [(cupo)]="cfgCupo" [(cupoDeCitas)]="cfgCupoDeCitas" [(subtitulo)]="cfgSubtitulo" [(tope)]="cfgTope" [(vence)]="cfgVence"
              [(apertura)]="cfgApertura" [(cierre)]="cfgCierre" (guardar)="guardarConfiguracion()" />
          </section>
        }

        @if (datos(); as d) {
          @if (vista() === 'resumen') {
            <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
              <div class="min-w-0 space-y-5">
                <!-- Qué sigue: una frase y su botón. Es lo primero que lee la organización. -->
                <section aria-labelledby="siguiente-titulo" class="app-superficie app-superficie--lectura flex flex-wrap items-center gap-5" data-testid="siguiente-paso">
                  <app-ilustracion-de-agenda [dibujo]="dibujoDelPaso()" [ancho]="7" />
                  <div class="min-w-0 flex-1 basis-64">
                    <h2 id="siguiente-titulo" class="text-valor">{{ siguiente().titulo }}</h2>
                    <p class="mt-1 text-cuerpo leading-relaxed text-prosa">{{ siguiente().detalle }}</p>
                    @if (siguiente().accion; as accion) {
                      <button type="button" appBoton="principal" class="mt-3" [attr.data-testid]="'accion-del-paso'" (click)="irA(accion.vista)">{{ accion.texto }}</button>
                    }
                  </div>
                </section>

                <section aria-labelledby="etapas-titulo" class="app-superficie app-superficie--lectura">
                  <h2 id="etapas-titulo" class="mb-4 text-valor">Etapas de la agenda</h2>
                  <app-linea-de-etapas [etapas]="etapas()" />
                </section>

                <!-- Indicadores: cada cifra dice de qué es -->
                <section aria-label="Indicadores de la agenda" class="grid grid-cols-2 gap-4 xl:grid-cols-5" data-testid="indicadores">
                  <app-indicador-de-cifra data-testid="indicador-de-inscritos" etiqueta="Artistas inscritos" [valor]="inscritos()"
                    [pie]="d.agenda.artistasPendientes ? d.agenda.artistasPendientes + ' por aprobar' : 'Ninguno por aprobar'" [atencion]="d.agenda.artistasPendientes > 0" />
                  <app-indicador-de-cifra data-testid="indicador-de-cupo" etiqueta="Artistas admitidos" [valor]="d.agenda.artistasAprobados" [de]="d.agenda.cupoArtistas ?? null"
                    [pie]="(cupoLleno() ? 'Cupo completo · ' : '') + 'Lista de espera: ' + d.agenda.artistasEnEspera" [atencion]="cupoLleno()" />
                  <app-indicador-de-cifra data-testid="indicador-de-citas" etiqueta="Citas pedidas" [valor]="d.citas.length"
                    [pie]="citasConfirmadas() + ' confirmadas · ' + d.agenda.citasSolicitadas + ' esperando'" [atencion]="d.agenda.citasSolicitadas > 0" />
                  <app-indicador-de-cifra data-testid="indicador-de-ocupacion" etiqueta="Ocupación" [valor]="ocupacion()" unidad="%" [de]="100"
                    pie="Franjas con cita viva" />
                  <app-indicador-de-cifra data-testid="indicador-de-franjas" etiqueta="Franjas y mesas" [valor]="d.agenda.franjas"
                    [pie]="'franjas disponibles · ' + d.agenda.compradores + ' compradores o bookers (' + compradoresSinCuenta() + ' sin cuenta)'" />
                </section>

                @if (d.agenda.estado === 'borrador') {
                  <section aria-labelledby="listo-titulo" class="app-superficie app-superficie--lectura grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" data-testid="antes-de-abrir">
                    <div class="space-y-3">
                      <h2 id="listo-titulo" class="text-valor">Antes de abrir la inscripción</h2>
                      <ul class="divide-y divide-slate-200">
                        @for (p of verificacion(); track p.id) {
                          <li class="flex flex-wrap items-center justify-between gap-2 py-3" [attr.data-testid]="'verificacion-' + p.id" [attr.data-listo]="p.listo">
                            <span class="text-cuerpo text-valor"><span aria-hidden="true" [class.text-emerald-700]="p.listo">{{ p.listo ? '✓' : '○' }}</span> {{ p.texto }}
                              <span class="text-prosa">{{ p.detalle }}</span></span>
                            @if (p.accion) { <button type="button" appBoton="terciaria" (click)="irA(p.vista)">{{ p.accion }}</button> }
                          </li>
                        }
                      </ul>
                    </div>
                    <app-vista-previa-de-agenda [mercado]="d.agenda.mercadoNombre" [nombre]="d.agenda.nombre ?? ''" [subtitulo]="d.agenda.subtitulo ?? ''" [modo]="d.agenda.modo"
                      [aprobacion]="d.agenda.aprobacionDeArtistas" [duracion]="d.agenda.duracionMinutos" [pausa]="d.agenda.pausaMinutos" [tope]="d.agenda.topeSolicitudesPendientes"
                      [vence]="d.agenda.vencimientoSolicitudHoras" [cupoDeCitas]="d.agenda.citasMaximasPorVisitante ?? null" [cupoDeArtistas]="d.agenda.cupoArtistas" [admitidos]="d.agenda.artistasAprobados" />
                  </section>
                }

                <section aria-labelledby="atender-titulo" class="app-superficie app-superficie--lectura space-y-4" data-testid="resumen-de-la-agenda">
                  <h2 id="atender-titulo" class="text-valor">Lo que espera tu atención</h2>
                  @if (d.agenda.aprobacionDeArtistas === 'aceptacion') {
                    <div data-testid="cola-de-aprobaciones">
                      <p class="text-valor">Inscripciones por aprobar: {{ pendientes().length }}</p>
                      @if (!pendientes().length) {
                        <p class="mt-1 text-cuerpo text-prosa">No hay inscripciones esperando tu decisión.</p>
                      } @else {
                        <p class="mt-1 text-cuerpo text-prosa">Al aprobar a alguien se aplica el máximo de artistas admitidos: si ya está completo, queda en la lista de espera.</p>
                        <div class="mt-3 grid gap-4 md:grid-cols-2">
                          @for (p of pendientes(); track p.id) {
                            <div class="rounded-xl bg-morado-50 p-3">
                              <app-ficha-de-persona [nombre]="p.nombre" rol="Artista" [entidad]="p.entidad" [fotoUrl]="p.fotoUrl ?? null" estado="Por aprobar" tono="requiere_accion"
                                [detalle]="p.presentacion" [portafolio]="p.enlaces">
                                @if (p.representaA) { <p class="text-dato text-prosa">Representa a {{ p.representaA }}</p> }
                                @if (!cerrada()) {
                                  <span acciones class="contents">
                                    <button type="button" appBoton="confirmar" tamano="menudo" [attr.data-testid]="'aprobar-' + p.id" [disabled]="guardando()" (click)="aprobar(p)">Aprobar</button>
                                    <button type="button" appBoton="destructiva" tamano="menudo" [attr.data-testid]="'rechazar-' + p.id" (click)="decidir(p, 'rechazar')">Rechazar</button>
                                  </span>
                                }
                              </app-ficha-de-persona>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                  <ul class="divide-y divide-slate-200 border-t border-slate-200">
                    <li class="flex flex-wrap items-center justify-between gap-2 py-3">
                      <span class="text-cuerpo text-valor">Citas esperando respuesta: <strong>{{ d.agenda.citasSolicitadas }}</strong></span>
                      <button type="button" appBoton="terciaria" (click)="irA('citas', 'solicitada')">Ver esas citas</button>
                    </li>
                    <li class="flex flex-wrap items-center justify-between gap-2 py-3" data-testid="compradores-sin-cuenta">
                      <span class="text-cuerpo text-valor">Compradores que aún no entran con su cuenta: <strong>{{ compradoresSinCuenta() }}</strong></span>
                      <button type="button" appBoton="terciaria" (click)="irA('participantes')">Ver compradores</button>
                    </li>
                    <li class="flex flex-wrap items-center justify-between gap-2 py-3">
                      <span class="text-cuerpo text-valor">Artistas en lista de espera: <strong>{{ d.agenda.artistasEnEspera }}</strong></span>
                      <button type="button" appBoton="terciaria" (click)="irA('participantes', undefined, 'espera')">Ver la lista de espera</button>
                    </li>
                  </ul>
                  <p class="max-w-3xl text-cuerpo leading-relaxed text-prosa">{{ textoDelEstado(d.agenda) }}</p>
                </section>
              </div>

              <aside class="min-w-0 space-y-5">
                <section class="app-superficie" data-testid="cinta-de-citas" aria-labelledby="cinta-titulo">
                  <h2 id="cinta-titulo" class="text-valor">Citas por estado</h2>
                  <div class="mt-3 flex h-4 overflow-hidden rounded-full bg-slate-200" role="img" [attr.aria-label]="resumenDeCitas()">
                    @for (e of cintaDeCitas(); track e.id) { <span class="h-full" [style.width.%]="e.porcentaje" [style.background]="e.color" [attr.title]="e.texto + ': ' + e.total"></span> }
                  </div>
                  <ul class="mt-3 space-y-1 text-cuerpo text-prosa">
                    @for (e of cintaDeCitas(); track e.id) { <li class="flex items-center justify-between"><span><span class="mr-2 inline-block h-2.5 w-2.5 rounded-sm" [style.background]="e.color"></span>{{ e.texto }}</span><strong class="text-valor">{{ e.total }}</strong></li> }
                  </ul>
                </section>
                <section class="app-superficie space-y-3" data-testid="agendas-de-la-edicion" aria-labelledby="otras-titulo">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="otras-titulo" class="text-valor">Agendas de esta edición</h2>
                    <a [routerLink]="enPanel('procesos/mercados', d.agenda.mercadoId, 'agenda-de-citas/nueva', d.agenda.edicionMercadoId)" appBoton="secundaria" tamano="menudo" data-testid="nueva-agenda">Nueva agenda</a>
                  </div>
                  @if (agendasDeLaEdicion().length > 1) {
                    <app-filtro-desplegable etiqueta="Agenda de la edición" rotulo="Agenda" identificador="selector-de-agenda" data-testid="selector-de-agenda"
                      [opciones]="opcionesDeAgenda()" [elegida]="'' + d.agenda.id" (cambiar)="abrirAgenda($event)" />
                  }
                  <ul class="divide-y divide-slate-200">
                    @for (o of agendasDeLaEdicion(); track o.id) {
                      <li class="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span class="text-cuerpo text-valor">{{ o.nombre }}@if (o.id === d.agenda.id) { <span class="text-prosa"> (esta)</span> }</span>
                        @if (o.id !== d.agenda.id) { <a [routerLink]="enPanel('procesos/mercados', d.agenda.mercadoId, 'agenda-de-citas', o.id)" appBoton="terciaria" tamano="menudo">Abrir</a> }
                      </li>
                    }
                  </ul>
                </section>
              </aside>
            </div>
          }

          @if (vista() === 'parrilla') {
            <section aria-labelledby="parrilla-titulo" class="space-y-4" data-testid="vista-parrilla">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="parrilla-titulo" class="text-valor">Programación</h2>
                  <p class="text-cuerpo text-prosa">{{ mayuscula(voc().fijo.plural) }} con su {{ voc().sitioFijo }} en filas, franjas en columnas. Pulsa un hueco o una cita para ver el detalle.</p>
                </div>
                <div class="flex flex-wrap items-end gap-3">
                  <app-filtro-desplegable etiqueta="Mesa o persona" rotulo="Mostrar" identificador="filtro-de-comprador"
                    [opciones]="opcionesDeComprador()" [elegida]="filtroDeComprador()" (cambiar)="filtroDeComprador.set($event)" />
                  <app-filtro-desplegable etiqueta="Estado de las celdas" rotulo="Resaltar" identificador="filtro-de-estado-de-la-parrilla"
                    [opciones]="opcionesDeEstadoDeParrilla" [elegida]="filtroDeEstadoDeParrilla()" (cambiar)="filtroDeEstadoDeParrilla.set($event)" />
                </div>
              </div>
              @if (!personasDeParrilla().length && !fijos().length) {
                <div class="app-superficie flex flex-col items-center gap-3 p-8 text-center" data-testid="parrilla-vacia">
                  <app-ilustracion-de-agenda dibujo="personas" [ancho]="9" />
                  <p class="text-lectura font-semibold text-valor">La programación se arma con {{ voc().fijo.plural }}</p>
                  <p class="max-w-md text-cuerpo text-prosa">Cuando haya {{ voc().fijo.plural }} admitidos, cada uno aparece aquí con su {{ voc().sitioFijo }} y sus franjas libres.</p>
                  <button type="button" appBoton="principal" (click)="irA('participantes')">Ir a participantes</button>
                </div>
              } @else if (!d.franjas.length) {
                <div class="app-superficie flex flex-col items-center gap-3 p-8 text-center">
                  <app-ilustracion-de-agenda dibujo="franjas" [ancho]="9" />
                  <p class="text-lectura font-semibold text-valor">Todavía no hay franjas</p>
                  <button type="button" appBoton="principal" (click)="irA('franjas')">Crear las franjas</button>
                </div>
              } @else {
                <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
                  <app-parrilla-de-agenda class="min-w-0" [personas]="personasDeParrilla()" [franjas]="d.franjas" [celdas]="celdasDeParrilla()" [resaltar]="estadoResaltado()"
                    [seleccionada]="celdaElegida()" (elegir)="elegirCelda($event)" />
                  <aside id="panel-de-detalle" class="app-superficie space-y-3 lg:sticky lg:top-0 lg:self-start" aria-labelledby="detalle-celda-titulo" data-testid="detalle-de-la-celda">
                    @if (!celdaElegida()) {
                      <div class="flex flex-col items-center gap-2 py-4 text-center">
                        <app-ilustracion-de-agenda dibujo="cita" [ancho]="7" />
                        <h3 id="detalle-celda-titulo" class="text-valor">Elige un hueco o una cita</h3>
                        <p class="text-cuerpo text-prosa">Aquí ves quién es quién y puedes actuar sobre la cita.</p>
                      </div>
                    } @else {
                      <h3 id="detalle-celda-titulo" class="text-valor">{{ detalleDeCelda().titulo }}</h3>
                      @if (detalleDeCelda().fijo; as fijo) {
                        <app-ficha-de-persona [nombre]="fijo.nombre" [rol]="fijo.rol === 'comprador' ? 'Comprador o booker' : 'Artista'" [entidad]="fijo.entidad" [fotoUrl]="fijo.fotoUrl ?? null"
                          [sitio]="fijo.espacio ? 'Mesa o sala: ' + fijo.espacio : null" [portafolio]="fijo.enlaces" />
                      }
                      @if (detalleDeCelda().cita; as cita) {
                        <p class="inline-flex flex-wrap items-center gap-2 text-cuerpo text-valor">
                          <app-indicador-de-estado [etiqueta]="etiquetaCita(cita.estado)" [tono]="tonoCita(cita.estado)" [conTexto]="true" />
                          @if (cita.motivoDeLaDecision) { · {{ cita.motivoDeLaDecision }} }
                        </p>
                        @if (detalleDeCelda().rota; as rota) {
                          <p class="text-dato font-semibold text-prosa">Con</p>
                          <app-ficha-de-persona [nombre]="rota.nombre" [rol]="rota.rol === 'comprador' ? 'Comprador o booker' : 'Artista'" [entidad]="rota.entidad" [fotoUrl]="rota.fotoUrl ?? null"
                            [detalle]="rota.presentacion" [portafolio]="rota.enlaces" />
                        } @else {
                          <p class="text-cuerpo text-valor">{{ cita.visitanteNombre }} con {{ cita.anfitrionNombre }}</p>
                        }
                        @if ((cita.estado === 'solicitada' || cita.estado === 'confirmada') && !cerrada()) {
                          <button type="button" appBoton="destructiva" tamano="menudo" (click)="cancelarCita(cita)">Cancelar la cita</button>
                        }
                      } @else {
                        <p class="text-cuerpo text-prosa">Franja libre: los {{ voc().rota.plural }} pueden pedirla a esta persona. Cuando la pidan, la verás aquí.</p>
                      }
                    }
                  </aside>
                </div>
              }
            </section>
          }

          @if (vista() === 'calendario') {
            <section aria-labelledby="calendario-titulo" class="space-y-4" data-testid="vista-calendario">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <h2 id="calendario-titulo" class="text-valor">Calendario de la agenda</h2>
                <app-filtro-desplegable etiqueta="Ver la agenda de" rotulo="Persona" identificador="filtro-del-calendario"
                  [opciones]="opcionesDelCalendario()" [elegida]="filtroDelCalendario()" (cambiar)="filtroDelCalendario.set($event); franjaElegida.set(null)" />
              </div>
              <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <app-calendario-de-agenda class="min-w-0" [franjas]="d.franjas" [celdas]="celdas()" [seleccionada]="franjaElegida()" (elegir)="elegirFranja($event)" />
                <aside id="panel-de-detalle-franja" class="app-superficie space-y-3 lg:sticky lg:top-0 lg:self-start" aria-labelledby="detalle-franja-titulo" data-testid="detalle-de-la-franja" [hidden]="franjaElegida() === null">
                  <h3 id="detalle-franja-titulo" class="text-valor">{{ rotuloDeLaFranja() }}</h3>
                  @if (!citasDeLaFranja().length) {
                    <p class="text-cuerpo text-prosa">No hay citas en esta franja.</p>
                  } @else {
                    <ul class="divide-y divide-slate-200">
                      @for (c of citasDeLaFranja(); track c.id) {
                        <li class="space-y-2 py-3">
                          <p class="flex items-center gap-2 text-cuerpo font-semibold text-valor">
                            <app-avatar-de-persona [nombre]="c.visitanteNombre" [fotoUrl]="fotoDe(c.visitanteId)" [medida]="2" />{{ c.visitanteNombre }}</p>
                          <p class="flex items-center gap-2 text-cuerpo text-prosa">con
                            <app-avatar-de-persona [nombre]="c.anfitrionNombre" [fotoUrl]="fotoDe(c.anfitrionId)" [medida]="2" />{{ c.anfitrionNombre }}@if (c.anfitrionEspacio) { · {{ c.anfitrionEspacio }} }</p>
                          <span class="inline-flex items-center gap-2 text-cuerpo text-valor">
                            <app-indicador-de-estado [etiqueta]="etiquetaCita(c.estado)" [tono]="tonoCita(c.estado)" [conTexto]="true" /></span>
                          @if ((c.estado === 'solicitada' || c.estado === 'confirmada') && !cerrada()) {
                            <div><button type="button" appBoton="destructiva" tamano="menudo" (click)="cancelarCita(c)">Cancelar</button></div>
                          }
                        </li>
                      }
                    </ul>
                  }
                </aside>
                @if (franjaElegida() === null) {
                  <aside class="app-superficie hidden flex-col items-center gap-2 py-6 text-center lg:flex lg:self-start">
                    <app-ilustracion-de-agenda dibujo="calendario" [ancho]="7" />
                    <h3 class="text-valor">Elige una franja</h3>
                    <p class="text-cuerpo text-prosa">Verás sus citas y podrás cancelarlas desde aquí.</p>
                  </aside>
                }
              </div>
            </section>
          }

          @if (vista() === 'franjas') {
            <section aria-labelledby="franjas-titulo" class="app-superficie app-superficie--lectura space-y-5" data-testid="vista-franjas">
              <div>
                <h2 id="franjas-titulo" class="text-valor">Horarios de la agenda</h2>
                <p class="max-w-3xl text-cuerpo text-prosa">Elige un día y pulsa una hora para crear la franja (verde: ya existe; pulsa para quitarla si no tiene citas). Cada franja dura {{ d.agenda.duracionMinutos }} minutos, con {{ d.agenda.pausaMinutos }} de pausa entre una y otra.</p>
              </div>
              @if (!cerrada()) {
                <app-selector-segmentado class="max-w-2xl" forma="segmentado" [comodo]="true" [conFilete]="false" [opciones]="opcionesDeDiaDelPlaneador()" [elegida]="diaActivoDelPlaneador()"
                  etiquetaDelGrupo="Día de las franjas" (elegir)="diaDelPlaneador.set($event)" />
                <div class="flex flex-wrap gap-2" data-testid="planeador-de-franjas" role="group" [attr.aria-label]="'Horas del ' + diaActivoDelPlaneador()">
                  @for (h of huecosDelDia(); track h.hora) {
                    <button type="button" class="hueco" [class.existe]="h.franja" [attr.aria-pressed]="!!h.franja" [attr.data-hueco]="h.hora" [disabled]="guardando()"
                            (click)="alternarHueco(h)">{{ h.hora }}<span class="sr-only">{{ h.franja ? ', franja creada, quitar' : ', libre, crear franja' }}</span></button>
                  }
                </div>
                <details class="text-cuerpo">
                  <summary class="cursor-pointer font-semibold text-morado">Generar varias de una vez</summary>
                  <div class="mt-3 flex flex-wrap items-end gap-3">
                    <label class="text-cuerpo"><span class="mb-1 block font-semibold text-valor">Día</span>
                      <input id="franja-fecha" data-testid="franja-fecha" type="date" class="campo-nativo" [value]="franjaFecha()" (input)="franjaFecha.set(texto($event))" /></label>
                    <label class="text-cuerpo"><span class="mb-1 block font-semibold text-valor">Desde</span>
                      <input id="franja-desde" data-testid="franja-desde" type="time" class="campo-nativo" [value]="franjaDesde()" (input)="franjaDesde.set(texto($event))" /></label>
                    <label class="text-cuerpo"><span class="mb-1 block font-semibold text-valor">Hasta</span>
                      <input id="franja-hasta" data-testid="franja-hasta" type="time" class="campo-nativo" [value]="franjaHasta()" (input)="franjaHasta.set(texto($event))" /></label>
                    <button type="button" data-testid="generar-franjas" appBoton="principal" [disabled]="guardando()" (click)="generarFranjas()">Generar franjas</button>
                  </div>
                </details>
              }
              @if (!d.franjas.length) {
                <div class="flex flex-col items-center gap-3 rounded-2xl bg-morado-50 p-8 text-center" data-testid="franjas-vacias">
                  <app-ilustracion-de-agenda dibujo="franjas" [ancho]="9" />
                  <p class="text-lectura font-semibold text-valor">Todavía no hay franjas</p>
                  <p class="max-w-md text-cuerpo text-prosa">Pulsa una hora arriba para crear la primera. Sin franjas no se puede abrir la inscripción.</p>
                </div>
              } @else {
                <div class="divide-y divide-slate-200 border-y border-slate-200" data-testid="lista-de-franjas">
                  @for (j of jornadas(); track j.clave) {
                    <div class="grid gap-2 py-3 sm:grid-cols-[14rem_1fr]">
                      <p class="cap text-cuerpo font-semibold text-valor">{{ j.rotulo }} <span class="font-normal text-prosa">({{ j.franjas.length }})</span></p>
                      <p class="text-cuerpo text-prosa">{{ horas(j.franjas) }}</p>
                    </div>
                  }
                </div>
              }
            </section>
          }

          @if (vista() === 'participantes') {
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 class="text-valor">Personas y mesas</h2>
                <p class="text-cuerpo text-prosa">{{ etiquetaModo(d.agenda.modo) }}</p>
              </div>
              <app-filtro-desplegable etiqueta="Mostrar participantes" rotulo="Mostrar" identificador="filtro-de-participantes"
                [opciones]="opcionesDeParticipantes()" [elegida]="filtroDeParticipantes()" (cambiar)="filtroDeParticipantes.set($event)" />
            </div>

            @if (filtroDeParticipantes() === 'todos' && mesas().length) {
              <section aria-labelledby="mesas-titulo" class="space-y-3" data-testid="mesas-de-la-agenda">
                <h3 id="mesas-titulo" class="text-valor">{{ voc().sitioFijo === 'stand' ? 'Stands' : 'Mesas' }} de la agenda</h3>
                <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  @for (m of mesas(); track m.id) {
                    <div class="app-superficie" data-testid="tarjeta-de-mesa">
                      <app-tarjeta-de-mesa [tipo]="voc().sitioFijo" [espacio]="m.espacio" [ocupante]="m.nombre" [entidad]="m.entidad" [fotoUrl]="m.fotoUrl" [ocupadas]="m.ocupadas" [total]="m.total" />
                    </div>
                  }
                </div>
              </section>
            }

            @if (filtroDeParticipantes() !== 'compradores') {
            <section aria-labelledby="artistas-titulo" class="space-y-3">
              <h3 id="artistas-titulo" class="text-valor">Artistas</h3>
              <p class="text-cuerpo text-prosa" data-testid="cifras-de-artistas">
                {{ d.agenda.artistasAprobados }} admitidos{{ d.agenda.cupoArtistas ? ' de ' + d.agenda.cupoArtistas : '' }} ·
                {{ d.agenda.artistasEnEspera }} en lista de espera
                @if (d.agenda.aprobacionDeArtistas === 'aceptacion') { · {{ d.agenda.artistasPendientes }} por aprobar }
              </p>
              @if (!artistas().length) {
                <div class="app-superficie flex flex-col items-center gap-3 p-8 text-center">
                  <app-ilustracion-de-agenda dibujo="inscripcion" [ancho]="8" />
                  <p class="text-lectura font-semibold text-valor">Todavía no se inscribe nadie</p>
                  <p class="max-w-md text-cuerpo text-prosa">Cuando abras la inscripción, los artistas la verán en la Agenda de citas del Ecosistema.</p>
                </div>
              } @else {
                <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid="lista-de-artistas">
                  @for (a of artistas(); track a.id) {
                    <div class="app-superficie">
                      <app-ficha-de-persona [nombre]="a.nombre" rol="Artista" [entidad]="a.entidad" [fotoUrl]="a.fotoUrl ?? null"
                        [estado]="etiquetaParticipante(a.estado) + (a.posicionEnLaLista ? ' · lugar ' + a.posicionEnLaLista : '')" [tono]="tonoParticipante(a.estado)"
                        [sitio]="a.espacio ? (voc().sitioFijo === 'stand' ? 'Stand: ' : 'Mesa: ') + a.espacio : null" [detalle]="a.presentacion" [portafolio]="a.enlaces">
                        @if (esFijo(a) && !cerrada()) {
                          <label class="block text-cuerpo"><span class="sr-only">Mesa o stand de {{ a.nombre }}, lo asigna la organización</span>
                            <input class="campo-nativo" [placeholder]="voc().sitioFijo === 'stand' ? 'Stand que le asignas' : 'Mesa que le asignas'" [value]="a.espacio ?? ''" (change)="asignarEspacio(a, texto($event))" /></label>
                        }
                        @if (!cerrada()) {
                          <button acciones type="button" appBoton="destructiva" tamano="menudo" (click)="decidir(a, 'rechazar')">Rechazar</button>
                        }
                      </app-ficha-de-persona>
                    </div>
                  }
                </div>
              }
            </section>
            }

            @if (filtroDeParticipantes() === 'todos' || filtroDeParticipantes() === 'compradores') {
            <section aria-labelledby="compradores-titulo" class="space-y-4">
              <h3 id="compradores-titulo" class="text-valor">Compradores y bookers invitados</h3>
              <p class="max-w-3xl text-cuerpo leading-relaxed text-prosa" data-testid="aviso-de-invitacion">
                Solo participan quienes tú invitas. Si ya tiene cuenta, la agenda le aparece en «Mi agenda de citas». Si no, recibe un enlace
                <strong>de un solo uso que vence a los 7 días</strong>: lo usa para aceptar con ese mismo correo o para crear la cuenta.
                Si el enlace vence o se pierde, envía otro: el anterior deja de servir. La mesa o la sala la asigna la organización, no quien participa.
              </p>
              @if (!cerrada()) {
                <details class="app-superficie" [open]="!compradores().length">
                  <summary class="cursor-pointer text-cuerpo font-bold text-morado">Invitar a un comprador o booker</summary>
                  <div class="mt-4 space-y-4">
                    <div class="simus-form-grid">
                      <app-campo-de-texto etiqueta="Nombre" identificador="comprador-nombre" [ngModel]="cNombre()" (ngModelChange)="cNombre.set($event)" />
                      <app-campo-de-texto etiqueta="Empresa o entidad" identificador="comprador-entidad" [ngModel]="cEntidad()" (ngModelChange)="cEntidad.set($event)" />
                      <div class="block text-cuerpo"><app-filtro-desplegable [completo]="true" etiqueta="Tipo de comprador" rotulo="Tipo"
                        identificador="comprador-tipo" [opciones]="opcionesDeTipo" [elegida]="cTipo()" (cambiar)="cTipo.set($event)" /></div>
                      <app-campo-de-texto etiqueta="Correo" identificador="comprador-correo" tipo="email" [ngModel]="cCorreo()" (ngModelChange)="cCorreo.set($event)" />
                      <app-campo-de-texto etiqueta="Mesa o sala que le asignas (opcional)" identificador="comprador-espacio" [ngModel]="cEspacio()" (ngModelChange)="cEspacio.set($event)" />
                      <app-campo-de-texto etiqueta="Qué busca o qué programa (opcional)" identificador="comprador-presentacion" [ngModel]="cPresentacion()" (ngModelChange)="cPresentacion.set($event)" />
                    </div>
                    <button type="button" data-testid="invitar-comprador" appBoton="principal" [disabled]="guardando()" (click)="invitarComprador()">Invitar al comprador</button>
                  </div>
                </details>
              }
              @if (!compradores().length) {
                <div class="app-superficie flex flex-col items-center gap-3 p-8 text-center">
                  <app-ilustracion-de-agenda dibujo="personas" [ancho]="8" />
                  <p class="text-lectura font-semibold text-valor">Todavía no has invitado a nadie</p>
                  <p class="max-w-md text-cuerpo text-prosa">Invita a los compradores y bookers con el formulario de arriba: cada uno tendrá su lugar en la programación.</p>
                </div>
              } @else {
                <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-testid="lista-de-compradores">
                  @for (c of compradores(); track c.id) {
                    <div class="app-superficie">
                      <app-ficha-de-persona [nombre]="c.nombre" rol="Comprador o booker" [entidad]="c.entidad" [fotoUrl]="c.fotoUrl ?? null"
                        [estado]="c.tieneCuenta ? 'Ya entró con su cuenta' : c.invitacionPendiente ? 'Invitación enviada: espera su respuesta' : 'Aún sin cuenta ni invitación vigente'"
                        [tono]="c.tieneCuenta ? 'logrado' : 'en_curso'" [detalle]="etiquetaTipo(c.tipoDeComprador) + ' · ' + (c.correoInvitacion ?? '')" [portafolio]="c.enlaces">
                        <span class="sr-only" [attr.data-testid]="'cuenta-de-' + c.id">{{ c.tieneCuenta ? 'Ya entró con su cuenta' : c.invitacionPendiente ? 'Invitación enviada: espera su respuesta' : 'Aún sin cuenta ni invitación vigente' }}</span>
                        <label class="block text-cuerpo"><span class="sr-only">Mesa o sala de {{ c.nombre }}, la asigna la organización</span>
                          <input class="campo-nativo" placeholder="Mesa o sala" [value]="c.espacio ?? ''" [disabled]="cerrada()"
                                 (change)="asignarEspacio(c, texto($event))" /></label>
                        @if (!cerrada()) {
                          <span acciones class="contents">
                            @if (!c.tieneCuenta) {
                              <button type="button" appBoton="secundaria" tamano="menudo" [attr.data-testid]="'reenviar-invitacion-' + c.id"
                                      [disabled]="guardando()" (click)="reenviarInvitacion(c)">
                                {{ c.invitacionPendiente ? 'Enviar otro enlace' : 'Enviar la invitación' }}
                              </button>
                            }
                            <button type="button" appBoton="destructiva" tamano="menudo" (click)="decidir(c, 'retirar')">Retirar</button>
                          </span>
                        }
                      </app-ficha-de-persona>
                    </div>
                  }
                </div>
              }
            </section>
            }
          }

          @if (vista() === 'citas') {
            <section aria-labelledby="citas-titulo" class="space-y-4">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <h2 id="citas-titulo" class="text-valor">Citas</h2>
                <app-filtro-desplegable etiqueta="Estado de la cita" rotulo="Estado" identificador="filtro-de-estado-de-citas"
                  [opciones]="opcionesDeEstadoDeCita()" [elegida]="filtroDeCitas()" (cambiar)="filtroDeCitas.set($event)" />
              </div>
              @if (!d.citas.length) {
                <div class="app-superficie flex flex-col items-center gap-3 p-8 text-center">
                  <app-ilustracion-de-agenda dibujo="cita" [ancho]="9" />
                  <p class="text-lectura font-semibold text-valor">Todavía no hay citas</p>
                  <p class="max-w-md text-cuerpo text-prosa">Aparecen aquí cuando los artistas y los compradores las piden.</p>
                </div>
              } @else if (!citasVisibles().length) {
                <p class="text-cuerpo text-prosa">Ninguna cita en ese estado. Cambia el filtro para ver las demás.</p>
              } @else {
                <div class="app-superficie divide-y divide-slate-200 p-0" data-testid="lista-de-citas">
                  @for (c of citasVisibles(); track c.id) {
                    <div class="grid gap-3 p-4 sm:grid-cols-[9rem_minmax(0,1fr)_14rem_auto] sm:items-center">
                      <p class="text-valor">{{ c.inicioUtc | fecha:'fecha-hora' }}</p>
                      <div class="flex min-w-0 items-center gap-2 text-cuerpo text-prosa">
                        <app-avatar-de-persona [nombre]="c.visitanteNombre" [fotoUrl]="fotoDe(c.visitanteId)" [medida]="2.25" />
                        <span class="min-w-0 break-words"><strong class="text-valor">{{ c.visitanteNombre }}</strong> con <strong class="text-valor">{{ c.anfitrionNombre }}</strong>@if (c.anfitrionEspacio) { · {{ c.anfitrionEspacio }} }</span>
                      </div>
                      <p class="inline-flex flex-wrap items-center gap-2 text-cuerpo text-valor">
                        <app-indicador-de-estado [etiqueta]="etiquetaCita(c.estado)" [tono]="tonoCita(c.estado)" [conTexto]="true" />@if (c.motivoDeLaDecision) { · {{ c.motivoDeLaDecision }} }
                        @if (c.estado === 'solicitada' && c.venceUtc) { <span class="text-dato text-prosa">Vence {{ c.venceUtc | fecha:'fecha-hora' }}</span> }
                      </p>
                      @if ((c.estado === 'solicitada' || c.estado === 'confirmada') && !cerrada()) {
                        <button type="button" appBoton="destructiva" tamano="menudo" (click)="cancelarCita(c)">Cancelar</button>
                      }
                    </div>
                  }
                </div>
              }
            </section>
          }
        }
        </div>
      }
    </div>
    </app-herramienta-a-pantalla-completa>
  `,
})
export class AgendaDeCitasOrganizacionComponent implements OnInit {
  private readonly servicio = inject(AgendamientoDeCitasService);
  private readonly store = inject(PanelOrganizacionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destruccion = inject(DestroyRef);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  readonly modos = MODOS_DE_AGENDA;
  readonly aprobaciones = APROBACIONES_DE_ARTISTAS;
  readonly tipos = TIPOS_DE_COMPRADOR;
  readonly opcionesDeTipo = TIPOS_DE_COMPRADOR.map(t => ({ id: t.valor, etiqueta: t.etiqueta }));

  readonly datos = signal<AgendaDelOrganizador | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  private edicionId: string | null = null;

  // Configuración
  readonly cfgNombre = signal('');
  readonly cfgModo = signal<ModoDeAgenda>('compradores_fijos');
  readonly cfgAprobacion = signal<AprobacionDeArtistas>('automatica');
  readonly cfgDuracion = signal(20);
  readonly cfgPausa = signal(5);
  readonly cfgTope = signal(5);
  readonly cfgVence = signal(72);
  readonly cfgCupo = signal<number | null>(null);
  readonly cfgCupoDeCitas = signal<number | null>(null);
  readonly cfgSubtitulo = signal('');
  /** La edición sobre la que se habilita una agenda nueva: de ahí salen el nombre y el subtítulo por omisión. */
  readonly edicionNueva = signal<{ mercadoNombre: string; anio: number; edicionNombre: string | null } | null>(null);
  readonly cfgApertura = signal('');
  readonly cfgCierre = signal('');

  // Franjas
  readonly franjaFecha = signal('');
  readonly franjaDesde = signal('09:00');
  readonly franjaHasta = signal('12:00');

  // Comprador invitado
  readonly cNombre = signal('');
  readonly cEntidad = signal('');
  readonly cTipo = signal('festival');
  readonly cCorreo = signal('');
  readonly cEspacio = signal('');
  readonly cPresentacion = signal('');

  readonly cerrada = computed(() => this.datos()?.agenda.estado === 'cerrada');
  readonly hayFranjas = computed(() => (this.datos()?.agenda.franjas ?? 0) > 0);
  readonly compradores = computed(() => (this.datos()?.participantes ?? []).filter(p => p.rol === 'comprador' && p.estado === 'aprobado'));
  /** La cola de aprobaciones: lo que espera una decisión de la organización. */
  readonly pendientes = computed(() => (this.datos()?.participantes ?? [])
    .filter(p => p.rol === 'artista' && p.estado === 'pendiente'));
  readonly artistas = computed(() => (this.datos()?.participantes ?? [])
    .filter(p => p.rol === 'artista' && (p.estado === 'aprobado' || p.estado === 'lista_de_espera')
      && (this.filtroDeParticipantes() !== 'espera' || p.estado === 'lista_de_espera')));

  readonly pasosDeConfiguracion = [
    { id: 1, titulo: 'La rueda de negocios' }, { id: 2, titulo: 'Participación' }, { id: 3, titulo: 'Cómo se piden las citas' }, { id: 4, titulo: 'Nombre e inscripción' },
  ];
  readonly paso = signal(1);
  readonly vista = signal<VistaDeLaAgenda>('resumen');
  readonly filtroDeCitas = signal('todas');
  readonly filtroDeParticipantes = signal('todos');
  readonly filtroDelCalendario = signal('todos');
  readonly franjaElegida = signal<number | null>(null);
  private mercadoDeLaRuta: string | null = null;

  readonly mercadoId = computed(() => this.datos()?.agenda.mercadoId ?? (this.mercadoDeLaRuta ? Number(this.mercadoDeLaRuta) : null));
  /** Quién organiza y de qué edición es: el subtítulo de la cabecera. */
  readonly procedencia = computed(() => {
    const a = this.datos()?.agenda;
    const n = this.edicionNueva();
    if (a) {
      const sub = a.subtitulo?.trim();
      const edicion = sub ? (sub.includes(String(a.anio)) ? sub : `${sub} · Edición ${a.anio}`) : `Edición ${a.anio}`;
      return `Agenda de citas · ${edicion}`;
    }
    return n ? `Agenda nueva · Edición ${n.anio}` : 'Agenda de citas';
  });
  /** El nombre de la agenda: por omisión el del Mercado; nunca «Nueva agenda de citas». */
  readonly tituloDeLaAgenda = computed(() => {
    const a = this.datos()?.agenda;
    if (!a) return this.edicionNueva()?.mercadoNombre || 'Agenda de citas';
    return a.nombre || a.mercadoNombre;
  });
  /** Las cuatro etapas de la agenda, con la actual marcada y las anteriores hechas. */
  readonly etapas = computed(() => {
    const orden = ['borrador', 'abierta', 'en_curso', 'cerrada'];
    const actual = orden.indexOf(this.datos()?.agenda.estado ?? 'borrador');
    return [
      { id: 'borrador', texto: 'En preparación' }, { id: 'abierta', texto: 'Inscripción abierta' },
      { id: 'en_curso', texto: 'En curso' }, { id: 'cerrada', texto: 'Terminada' },
    ].map((e, i) => ({ ...e, actual: i === actual, hecha: i < actual }));
  });
  /** Lo que conviene tener listo antes de abrir la inscripción, con la razón de lo que falta. */
  readonly verificacion = computed<{ id: string; listo: boolean; texto: string; detalle: string; accion: string; vista: VistaDeLaAgenda }[]>(() => {
    const a = this.datos()?.agenda;
    if (!a) return [];
    const v = vocabularioDeModo(a.modo);
    return [
      { id: 'configuracion', listo: true, texto: 'Configuración guardada', detalle: `Modalidad: ${etiquetaDeModo(a.modo).toLowerCase()}.`, accion: 'Revisar', vista: 'configuracion' },
      { id: 'franjas', listo: a.franjas > 0, texto: a.franjas ? `${a.franjas} franjas creadas` : 'Crea las franjas de horario',
        detalle: a.franjas ? '' : 'Sin franjas no se puede abrir la inscripción.', accion: a.franjas ? 'Ver franjas' : 'Crear franjas', vista: 'franjas' },
      { id: 'compradores', listo: a.compradores > 0, texto: a.compradores ? `${a.compradores} compradores o bookers invitados` : 'Invita al menos a un comprador o booker',
        detalle: a.compradores ? '' : `Sin ellos los artistas no tendrán con quién agendar (${v.fijo.plural} reciben; ${v.rota.plural} rotan).`, accion: 'Invitar', vista: 'participantes' },
      { id: 'fechas', listo: !!(a.aperturaInscripcionUtc || a.cierreInscripcionUtc), texto: a.aperturaInscripcionUtc || a.cierreInscripcionUtc ? 'Fechas de inscripción definidas' : 'Sin fechas de inscripción',
        detalle: a.aperturaInscripcionUtc || a.cierreInscripcionUtc ? '' : 'No es obligatorio: la inscripción se abre y se cierra a mano.', accion: 'Definir fechas', vista: 'configuracion' },
    ];
  });
  readonly voc = computed(() => vocabularioDeModo(this.datos()?.agenda.modo));
  readonly volver = computed(() => this.mercadoId() ? this.enPanel('procesos/mercados', this.mercadoId()!) : this.enPanel('procesos/mercados'));
  readonly jornadas = computed(() => agruparPorJornada(this.datos()?.franjas ?? []));
  readonly compradoresSinCuenta = computed(() => this.compradores().filter(c => !c.tieneCuenta).length);

  readonly siguiente = computed<{ titulo: string; detalle: string; accion?: { texto: string; vista: VistaDeLaAgenda } }>(() => {
    const a = this.datos()?.agenda;
    if (!a) return { titulo: '', detalle: '' };
    switch (a.estado) {
      case 'borrador':
        return !a.franjas
          ? { titulo: 'Siguiente paso: genera las franjas', detalle: 'Sin franjas no se puede abrir la inscripción. Elige los días y las horas en la vista Horarios.', accion: { texto: 'Crear las franjas', vista: 'franjas' } }
          : { titulo: 'Siguiente paso: invita a los compradores y abre la inscripción', detalle: 'Cuando todo esté listo, abre la inscripción: los artistas la verán en la Agenda de citas del Ecosistema.' };
      case 'abierta':
        return a.artistasPendientes
          ? { titulo: a.artistasPendientes === 1 ? 'Tienes 1 inscripción por aprobar' : `Tienes ${a.artistasPendientes} inscripciones por aprobar`, detalle: 'Decídelas más abajo, en «Lo que espera tu atención». Al terminar el plazo, cierra la inscripción e inicia la agenda.' }
          : { titulo: 'La inscripción está abierta', detalle: 'Cuando termine el plazo, cierra la inscripción e inicia la agenda: desde ahí se gestionan las citas.' };
      case 'en_curso':
        return a.citasSolicitadas
          ? { titulo: `${a.citasSolicitadas} citas esperan respuesta`, detalle: 'Revísalas en Citas. Las que no se respondan a tiempo vencen y liberan la franja.', accion: { texto: 'Ver las citas', vista: 'citas' } }
          : { titulo: 'La agenda está en curso', detalle: 'Sigue las citas en el Calendario. Al cerrar la agenda, lo que esté sin responder se cancela.' };
      default:
        return { titulo: 'La agenda terminó', detalle: 'Quedan las citas confirmadas: expórtalas o imprímelas desde la cabecera.' };
    }
  });

  readonly cupoLleno = computed(() => {
    const a = this.datos()?.agenda;
    return !!a?.cupoArtistas && a.artistasAprobados >= a.cupoArtistas;
  });
  readonly porcentajeDeCupo = computed(() => {
    const a = this.datos()?.agenda;
    if (!a) return 0;
    return a.cupoArtistas ? Math.min(100, Math.round(a.artistasAprobados * 100 / a.cupoArtistas)) : (a.artistasAprobados ? 100 : 0);
  });
  readonly inscritos = computed(() => (this.datos()?.participantes ?? []).filter(p => p.rol === 'artista' && p.estado !== 'rechazado' && p.estado !== 'retirado').length);
  readonly citasConfirmadas = computed(() => (this.datos()?.citas ?? []).filter(c => c.estado === 'confirmada').length);
  /** Qué parte de las franjas de quienes reciben tiene una cita viva (pedida o confirmada). */
  readonly ocupacion = computed(() => {
    const d = this.datos();
    const capacidad = this.fijos().length * (d?.franjas.length ?? 0);
    if (!d || !capacidad) return 0;
    const vivas = d.citas.filter(c => c.estado === 'solicitada' || c.estado === 'confirmada').length;
    return Math.min(100, Math.round(vivas * 100 / capacidad));
  });
  readonly citasPorComprador = computed(() => {
    const d = this.datos();
    if (!d || !d.agenda.compradores) return 0;
    const vivas = d.citas.filter(c => c.estado === 'solicitada' || c.estado === 'confirmada').length;
    return Math.round(vivas * 10 / d.agenda.compradores) / 10;
  });
  private static readonly COLORES_DE_CITA: Record<string, string> = {
    confirmada: '#2e9d6a', solicitada: '#f2b84b', rechazada: '#d9534f', cancelada: '#94a3b8', vencida: '#cbd5e1',
  };
  readonly cintaDeCitas = computed(() => {
    const citas = this.datos()?.citas ?? [];
    const total = citas.length || 1;
    return (['confirmada', 'solicitada', 'rechazada', 'cancelada', 'vencida'] as EstadoDeCita[]).map(e => {
      const n = citas.filter(c => c.estado === e).length;
      return { id: e, texto: etiquetaDeEstadoDeCita(e), total: n, porcentaje: citas.length ? n * 100 / total : 0, color: AgendaDeCitasOrganizacionComponent.COLORES_DE_CITA[e] };
    });
  });
  readonly resumenDeCitas = computed(() => 'Citas por estado: ' + this.cintaDeCitas().map(e => `${e.texto} ${e.total}`).join(', '));
  readonly dibujoDelPaso = computed<DibujoDeAgenda>(() => {
    const a = this.datos()?.agenda;
    if (!a) return 'calendario';
    if (a.estado === 'borrador') return a.franjas ? 'abierta' : 'franjas';
    if (a.estado === 'abierta') return a.artistasPendientes ? 'aprobacion' : 'personas';
    if (a.estado === 'en_curso') return 'cita';
    return 'calendario';
  });
  /** Las agendas de la edición (para saltar de una a otra), tomadas del listado de ediciones. */
  readonly agendasDeLaEdicion = signal<{ id: number; nombre: string; estado: string }[]>([]);

  // Parrilla: compradores en columnas, franjas en filas.
  readonly filtroDeComprador = signal('todos');
  readonly filtroDeEstadoDeParrilla = signal('todos');
  readonly celdaElegida = signal<{ columnaId: number; franjaId: number } | null>(null);
  readonly opcionesDeEstadoDeParrilla = [
    { id: 'todos', etiqueta: 'Todas' }, { id: 'libre', etiqueta: 'Libres' }, { id: 'solicitada', etiqueta: 'Esperando respuesta' },
    { id: 'confirmada', etiqueta: 'Confirmadas' }, { id: 'rechazada', etiqueta: 'Rechazadas' }, { id: 'cancelada', etiqueta: 'Canceladas' }, { id: 'vencida', etiqueta: 'Vencidas' },
  ];
  readonly estadoResaltado = computed<EstadoDeFranja | null>(() => this.filtroDeEstadoDeParrilla() === 'todos' ? null : this.filtroDeEstadoDeParrilla() as EstadoDeFranja);
  /** Quienes tienen su stand o mesa fija y reciben las citas: los artistas o los compradores, según la modalidad. Son las filas de la programación. */
  readonly fijos = computed(() => {
    const rol = this.datos()?.agenda.modo === 'compradores_fijos' ? 'comprador' : 'artista';
    return (this.datos()?.participantes ?? []).filter(p => p.rol === rol && p.estado === 'aprobado');
  });
  /** Primera letra en mayúscula: un subtítulo no empieza en minúscula. */
  mayuscula(texto: string): string { return texto.charAt(0).toUpperCase() + texto.slice(1); }
  /** La foto del participante (la misma de la parrilla), para no caer en iniciales cuando existe. */
  fotoDe(participanteId: number): string | null {
    return this.datos()?.participantes.find(p => p.id === participanteId)?.fotoUrl ?? null;
  }
  esFijo(p: Participante): boolean { return this.fijos().some(f => f.id === p.id); }
  readonly opcionesDeComprador = computed(() => [{ id: 'todos', etiqueta: this.datos()?.agenda.modo === 'compradores_fijos' ? 'Todos los compradores' : 'Todos los artistas' },
    ...this.fijos().map(c => ({ id: String(c.id), etiqueta: c.nombre }))]);
  readonly personasDeParrilla = computed<FilaDeParrilla[]>(() => this.fijos()
    .filter(c => this.filtroDeComprador() === 'todos' || String(c.id) === this.filtroDeComprador())
    .map(c => ({ id: c.id, nombre: c.nombre, entidad: c.entidad, fotoUrl: c.fotoUrl ?? null, espacio: c.espacio })));
  /** Las mesas o stands de la agenda con quién las ocupa y cuánto de su horario está tomado. */
  readonly mesas = computed(() => {
    const d = this.datos();
    if (!d) return [];
    return this.fijos().map(p => ({
      id: p.id, espacio: p.espacio, nombre: p.nombre, entidad: p.entidad, fotoUrl: p.fotoUrl ?? null, total: d.franjas.length,
      ocupadas: d.citas.filter(c => (c.anfitrionId === p.id || c.visitanteId === p.id) && (c.estado === 'solicitada' || c.estado === 'confirmada')).length,
    }));
  });
  readonly celdasDeParrilla = computed(() => {
    const d = this.datos();
    const mapa = new Map<string, CeldaDeParrilla>();
    if (!d) return mapa;
    const fijos = new Set(this.fijos().map(p => p.id));
    const orden: Record<string, number> = { confirmada: 0, solicitada: 1, rechazada: 2, cancelada: 3, vencida: 4 };
    const vivasDeQuienRota = new Map<string, number>();
    for (const c of [...d.citas].sort((x, y) => (orden[y.estado] ?? 9) - (orden[x.estado] ?? 9))) {
      const fijoId = fijos.has(c.anfitrionId) ? c.anfitrionId : c.visitanteId;
      if (!fijos.has(fijoId)) continue;
      const quienRotaId = fijoId === c.anfitrionId ? c.visitanteId : c.anfitrionId;
      const quienRota = fijoId === c.anfitrionId ? c.visitanteNombre : c.anfitrionNombre;
      if (c.estado === 'solicitada' || c.estado === 'confirmada') {
        const k = `${quienRotaId}-${c.franjaId}`;
        vivasDeQuienRota.set(k, (vivasDeQuienRota.get(k) ?? 0) + 1);
      }
      mapa.set(`${fijoId}-${c.franjaId}`, { estado: c.estado, texto: quienRota });
    }
    // Un cruce: quien rota tiene dos citas vivas en la misma franja con personas distintas.
    for (const c of d.citas) {
      if (c.estado !== 'solicitada' && c.estado !== 'confirmada') continue;
      const fijoId = fijos.has(c.anfitrionId) ? c.anfitrionId : c.visitanteId;
      const quienRotaId = fijoId === c.anfitrionId ? c.visitanteId : c.anfitrionId;
      if ((vivasDeQuienRota.get(`${quienRotaId}-${c.franjaId}`) ?? 0) > 1) {
        const celda = mapa.get(`${fijoId}-${c.franjaId}`);
        if (celda) mapa.set(`${fijoId}-${c.franjaId}`, { ...celda, conflicto: true });
      }
    }
    return mapa;
  });
  readonly detalleDeCelda = computed(() => {
    const c = this.celdaElegida(), d = this.datos();
    if (!c || !d) return { titulo: '', cita: null as Cita | null, fijo: null as Participante | null, rota: null as Participante | null };
    const franja = d.franjas.find(f => f.id === c.franjaId);
    const fijo = d.participantes.find(p => p.id === c.columnaId) ?? null;
    const cita = d.citas
      .filter(x => x.franjaId === c.franjaId && (x.anfitrionId === c.columnaId || x.visitanteId === c.columnaId))
      .sort((x, y) => Number(['solicitada', 'confirmada'].includes(y.estado)) - Number(['solicitada', 'confirmada'].includes(x.estado)))[0] ?? null;
    const rotaId = cita ? (cita.anfitrionId === c.columnaId ? cita.visitanteId : cita.anfitrionId) : null;
    const rota = rotaId === null ? null : d.participantes.find(p => p.id === rotaId) ?? null;
    return { titulo: `${franja ? horaDeLaFranja(franja.inicioUtc) + ' · ' + rotuloDeJornada(franja.inicioUtc) : ''}`, cita, fijo, rota };
  });

  /** Elegir un hueco o una cita abre su detalle a la derecha; en pantallas angostas, el detalle queda debajo y se lleva a la vista. */
  elegirCelda(c: { columnaId: number; franjaId: number }): void {
    this.celdaElegida.set(c);
    this.llevarAlDetalle('panel-de-detalle');
  }
  elegirFranja(id: number | null): void {
    this.franjaElegida.set(id);
    this.llevarAlDetalle('panel-de-detalle-franja');
  }
  private llevarAlDetalle(id: string): void {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'nearest' }), 0);
  }

  // Planeador de franjas: pulsar una hora la crea o la quita.
  readonly diaDelPlaneador = signal('');
  readonly diaActivoDelPlaneador = computed(() => this.diaDelPlaneador()
    || this.datos()?.franjas.map(f => claveDeDia(f.inicioUtc)).sort()[0] || this.diasDelPlaneador()[0]?.clave || '');
  readonly opcionesDeDiaDelPlaneador = computed(() => this.diasDelPlaneador().map(d => ({ id: d.clave, etiqueta: d.rotulo })));
  readonly diasDelPlaneador = computed(() => {
    const d = this.datos();
    if (!d) return [];
    const claves = new Set(d.franjas.map(f => claveDeDia(f.inicioUtc)));
    const ini = d.agenda.fechaInicio?.slice(0, 10), fin = d.agenda.fechaFin?.slice(0, 10) ?? ini;
    if (ini && fin) {
      for (let t = Date.parse(`${ini}T12:00:00Z`); t <= Date.parse(`${fin}T12:00:00Z`) && claves.size < 40; t += 86_400_000) claves.add(new Date(t).toISOString().slice(0, 10));
    }
    return [...claves].sort().map(clave => ({ clave, rotulo: rotuloDeJornada(`${clave}T17:00:00Z`).replace(/^./, c => c.toUpperCase()) }));
  });
  readonly huecosDelDia = computed(() => {
    const d = this.datos();
    const dia = this.diaActivoDelPlaneador();
    if (!d || !dia) return [];
    const aMin = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
    const deHoy = d.franjas.filter(f => claveDeDia(f.inicioUtc) === dia);
    const existentes = new Map(deHoy.map(f => [horaDeLaFranja(f.inicioUtc), f]));
    const paso = d.agenda.duracionMinutos + d.agenda.pausaMinutos;
    const base = deHoy.length ? Math.min(...[...existentes.keys()].map(aMin)) % paso : (8 * 60) % paso;
    const horas = new Set<string>(existentes.keys());
    for (let m = 7 * 60 + ((base - (7 * 60)) % paso + paso) % paso; m + d.agenda.duracionMinutos <= 21 * 60; m += paso) {
      horas.add(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    return [...horas].sort().map(hora => ({ hora, franja: existentes.get(hora) ?? null, dia }));
  });

  /** Las secciones de la aplicación, cada una con su marca de trabajo pendiente. Sin agenda creada no hay secciones: solo se configura. */
  readonly secciones = computed<SeccionDeHerramienta[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const a = d.agenda;
    const faltan = a.estado === 'borrador' ? this.verificacion().filter(p => !p.listo && p.id !== 'fechas').length : 0;
    return [
      { id: 'resumen', rotulo: 'Resumen', icono: 'resumen', pendientes: faltan },
      { id: 'participantes', rotulo: 'Personas', icono: 'personas', pendientes: a.artistasPendientes },
      { id: 'parrilla', rotulo: 'Programación', icono: 'programacion' },
      { id: 'calendario', rotulo: 'Calendario', icono: 'calendario' },
      { id: 'franjas', rotulo: 'Horarios', icono: 'horarios', pendientes: a.franjas ? 0 : 1 },
      { id: 'citas', rotulo: 'Citas', icono: 'citas', pendientes: a.citasSolicitadas },
      { id: 'configuracion', rotulo: 'Ajustes', icono: 'ajustes' },
    ];
  });

  readonly opcionesDeEstadoDeCita = computed(() => {
    const citas = this.datos()?.citas ?? [];
    return [{ id: 'todas', etiqueta: 'Todas', conteo: citas.length },
      ...(['solicitada', 'confirmada', 'rechazada', 'cancelada', 'vencida'] as EstadoDeCita[])
        .map(e => ({ id: e, etiqueta: etiquetaDeEstadoDeCita(e), conteo: citas.filter(c => c.estado === e).length }))];
  });
  readonly citasVisibles = computed(() => {
    const f = this.filtroDeCitas();
    return (this.datos()?.citas ?? []).filter(c => f === 'todas' || c.estado === f);
  });

  readonly opcionesDeParticipantes = computed(() => [
    { id: 'todos', etiqueta: 'Todos' }, { id: 'artistas', etiqueta: 'Artistas' }, { id: 'compradores', etiqueta: 'Compradores' },
    { id: 'espera', etiqueta: 'Lista de espera', conteo: this.artistas().filter(a => a.estado === 'lista_de_espera').length },
  ]);

  readonly opcionesDelCalendario = computed(() => [
    { id: 'todos', etiqueta: 'Todas las personas' },
    ...(this.datos()?.participantes ?? []).filter(p => p.estado === 'aprobado')
      .map(p => ({ id: String(p.id), etiqueta: `${p.nombre} (${p.rol === 'comprador' ? 'comprador' : 'artista'})` })),
  ]);

  /** Qué dice cada franja en el calendario, según a quién se mire. */
  readonly celdas = computed<CeldaDeFranja[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const quien = this.filtroDelCalendario();
    return d.franjas.map(f => {
      const citas = d.citas.filter(c => c.franjaId === f.id && (quien === 'todos' || String(c.anfitrionId) === quien || String(c.visitanteId) === quien));
      const vivas = citas.filter(c => c.estado === 'solicitada' || c.estado === 'confirmada');
      const hora = `${rotuloDeJornada(f.inicioUtc)}, ${horaDeLaFranja(f.inicioUtc)}`;
      let estado: EstadoDeFranja = 'libre';
      let lineas: string[] = [];
      if (quien === 'todos') {
        const conf = vivas.filter(c => c.estado === 'confirmada').length, esp = vivas.length - conf;
        estado = conf ? 'confirmada' : esp ? 'solicitada' : 'libre';
        if (conf) lineas.push(`${conf} confirmada${conf === 1 ? '' : 's'}`);
        if (esp) lineas.push(`${esp} esperando`);
      } else if (citas.length) {
        const c = vivas[0] ?? citas[0];
        estado = c.estado;
        lineas = [String(c.anfitrionId) === quien ? c.visitanteNombre : c.anfitrionNombre];
      }
      return { franjaId: f.id, estado, lineas, accionable: true,
        etiqueta: `${hora}. ${lineas.length ? lineas.join(', ') : 'Sin citas'}. ${estado === 'libre' ? 'Libre' : etiquetaDeEstadoDeCita(estado)}` };
    });
  });
  readonly citasDeLaFranja = computed(() => (this.datos()?.citas ?? []).filter(c => c.franjaId === this.franjaElegida()
    && (this.filtroDelCalendario() === 'todos' || String(c.anfitrionId) === this.filtroDelCalendario() || String(c.visitanteId) === this.filtroDelCalendario())));
  readonly rotuloDeLaFranja = computed(() => {
    const f = this.datos()?.franjas.find(x => x.id === this.franjaElegida());
    return f ? `${rotuloDeJornada(f.inicioUtc)}, ${horaDeLaFranja(f.inicioUtc)}` : '';
  });

  horas(franjas: readonly { inicioUtc: string }[]): string { return franjas.map(f => horaDeLaFranja(f.inicioUtc)).join(' · '); }
  tonoAgenda(estado: string) { return tonoDeEstadoDeAgenda(estado); }
  tonoCita(estado: string) { return tonoDeEstadoDeCita(estado); }
  tonoParticipante(estado: string) { return tonoDeEstadoDeParticipante(estado); }
  etiquetaAprobacion(valor: string): string { return etiquetaDeAprobacion(valor); }
  imprimir(): void { window.print(); }
  irA(vista: VistaDeLaAgenda, filtroDeCitas?: string, filtroDeParticipantes?: string): void {
    if (filtroDeCitas) this.filtroDeCitas.set(filtroDeCitas);
    if (filtroDeParticipantes) this.filtroDeParticipantes.set(filtroDeParticipantes);
    this.elegirVista(vista);
  }

  /** La vista vive en la dirección (`?vista=`): recargar o volver atrás conserva dónde estabas. */
  elegirVista(vista: VistaDeLaAgenda): void {
    this.vista.set(vista);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { vista: vista === 'resumen' ? null : vista }, queryParamsHandling: 'merge' });
  }

  readonly opcionesDeAgenda = computed(() => this.agendasDeLaEdicion().map(a => ({ id: String(a.id), etiqueta: a.nombre })));
  /** Cambia de agenda dentro de la misma edición sin salir de la vista en la que estabas. */
  abrirAgenda(id: string): void {
    const d = this.datos();
    if (!d || id === String(d.agenda.id)) return;
    void this.router.navigate(this.enPanel('procesos/mercados', d.agenda.mercadoId, 'agenda-de-citas', id), { queryParamsHandling: 'preserve' });
  }

  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }

  etiquetaAgenda(estado: string): string { return etiquetaDeEstadoDeAgenda(estado); }
  etiquetaModo(modo: string): string { return etiquetaDeModo(modo); }
  etiquetaCita(estado: string): string { return etiquetaDeEstadoDeCita(estado); }
  etiquetaParticipante(estado: string): string { return etiquetaDeEstadoDeParticipante(estado); }
  etiquetaTipo(tipo: string | null): string { return etiquetaDeTipoDeComprador(tipo); }

  numero(evento: Event): number { return Number((evento.target as HTMLInputElement).value); }
  texto(evento: Event): string { return (evento.target as HTMLInputElement).value; }

  urlDelIcs(): string {
    const id = this.datos()?.agenda.id;
    return id ? this.servicio.urlDelCalendarioDeLaOrganizacion(this.store.organizacionId(), id) : '#';
  }

  /** Pulsar una hora la crea (una franja de la duración de la agenda) o, si ya existe, la quita. */
  alternarHueco(hueco: { hora: string; franja: { id: number } | null; dia: string }): void {
    const organizacionId = this.store.organizacionId();
    const agenda = this.datos()?.agenda;
    if (!organizacionId || !agenda) return;
    this.guardando.set(true);
    if (hueco.franja) {
      this.servicio.retirarFranja(organizacionId, agenda.id, hueco.franja.id).subscribe({
        next: () => this.resolver(`Quitamos la franja de las ${hueco.hora}.`),
        error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible quitar la franja.'),
      });
      return;
    }
    const [h, m] = hueco.hora.split(':').map(Number);
    const fin = h * 60 + m + agenda.duracionMinutos;
    this.servicio.generarFranjas(organizacionId, agenda.id, {
      fecha: hueco.dia, desde: hueco.hora, hasta: `${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`,
    }).subscribe({
      next: () => this.resolver(`Creamos la franja de las ${hueco.hora}.`),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible crear la franja.'),
    });
  }

  urlDelCsv(): string {
    const id = this.datos()?.agenda.id;
    return id ? this.servicio.urlDelCsv(this.store.organizacionId(), id) : '#';
  }

  textoDelEstado(agenda: Agenda): string {
    switch (agenda.estado) {
      case 'borrador': return 'En preparación: nadie más la ve todavía. Cuando abras la inscripción, los artistas podrán inscribirse y pedir citas.';
      case 'abierta': return 'Los artistas pueden inscribirse y pedir citas. Al iniciar, se cierra la inscripción y se siguen gestionando las citas.';
      case 'en_curso': return 'La inscripción está cerrada y se gestionan las citas. Al cerrar la agenda, lo que esté sin responder se cancela.';
      default: return 'La agenda terminó. Quedan las citas confirmadas y puedes exportarlas.';
    }
  }

  ngOnInit(): void {
    this.edicionId = this.route.snapshot.paramMap.get('edicionId');
    this.mercadoDeLaRuta = this.route.snapshot.paramMap.get('id');
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destruccion)).subscribe(q => {
      const v = q.get('vista') as VistaDeLaAgenda | null;
      this.vista.set(v && VISTAS.includes(v) ? v : 'resumen');
    });
    // Una agenda nueva parte del nombre del Mercado y de la edición (subtítulo): se pueden cambiar, no hay que escribirlos.
    const edicionDeLaRuta = this.edicionId;
    const organizacion = this.store.organizacionId();
    if (edicionDeLaRuta && !this.route.snapshot.paramMap.get('agendaId') && organizacion) {
      this.servicio.edicionesConAgenda(organizacion).subscribe({
        next: filas => {
          const fila = filas.find(f => String(f.edicionId) === edicionDeLaRuta);
          if (!fila || this.datos()) return;
          this.edicionNueva.set({ mercadoNombre: fila.mercadoNombre, anio: fila.anio, edicionNombre: fila.edicionNombre });
          if (!this.cfgNombre()) this.cfgNombre.set(fila.mercadoNombre);
          if (!this.cfgSubtitulo()) this.cfgSubtitulo.set(fila.edicionNombre?.trim() || `Edición ${fila.anio}`);
        },
        error: () => undefined,
      });
    }
    // Cambiar de agenda reutiliza el componente: se vuelve a cargar al cambiar el parámetro, no solo al abrir.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destruccion)).subscribe(m => {
      const agendaId = m.get('agendaId');
      if (agendaId && agendaId !== String(this.datos()?.agenda.id ?? '')) {
        this.celdaElegida.set(null); this.franjaElegida.set(null);
        this.cargar(agendaId);
      }
    });
  }

  private cargar(agendaId: string | number): void {
    const organizacionId = this.store.organizacionId();
    if (!organizacionId) return;
    this.cargando.set(true);
    this.servicio.agendaDelOrganizador(organizacionId, agendaId).subscribe({
      next: datos => { this.cargando.set(false); this.aplicar(datos); },
      error: (fallo: FalloDelServidor) => {
        this.cargando.set(false);
        this.error.set(fallo?.message ?? 'No fue posible consultar la agenda.');
      },
    });
  }

  private aplicar(datos: AgendaDelOrganizador): void {
    // La dirección de antes (`herramientas/agenda-de-citas/:id`) pasa a la del Mercado: es su herramienta.
    if (!this.mercadoDeLaRuta) {
      this.mercadoDeLaRuta = String(datos.agenda.mercadoId);
      void this.router.navigate(this.enPanel('procesos/mercados', datos.agenda.mercadoId, 'agenda-de-citas', datos.agenda.id), { replaceUrl: true, queryParamsHandling: 'preserve' });
    }
    this.datos.set(datos);
    this.servicio.edicionesConAgenda(this.store.organizacionId()).subscribe({
      next: filas => this.agendasDeLaEdicion.set(filas.find(f => f.edicionId === datos.agenda.edicionMercadoId)?.agendas ?? []),
      error: () => this.agendasDeLaEdicion.set([]),
    });
    const a = datos.agenda;
    this.cfgNombre.set(a.nombre ?? '');
    this.cfgModo.set(a.modo);
    this.cfgAprobacion.set(a.aprobacionDeArtistas ?? 'automatica');
    this.cfgDuracion.set(a.duracionMinutos);
    this.cfgPausa.set(a.pausaMinutos);
    this.cfgTope.set(a.topeSolicitudesPendientes);
    this.cfgVence.set(a.vencimientoSolicitudHoras);
    this.cfgCupo.set(a.cupoArtistas ?? null);
    this.cfgCupoDeCitas.set(a.citasMaximasPorVisitante ?? null);
    this.cfgSubtitulo.set(a.subtitulo ?? '');
    this.cfgApertura.set(this.aLocal(a.aperturaInscripcionUtc));
    this.cfgCierre.set(this.aLocal(a.cierreInscripcionUtc));
  }

  private aLocal(utc: string | null): string {
    if (!utc) return '';
    const d = new Date(utc);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  private deLocal(valor: string): string | null {
    return valor ? new Date(valor).toISOString() : null;
  }

  private recargar(): void {
    const id = this.datos()?.agenda.id;
    if (id) this.cargar(id);
  }

  private fallar(fallo: FalloDelServidor, porOmision: string): void {
    this.guardando.set(false);
    this.aviso.set('');
    this.error.set(fallo?.message ?? porOmision);
  }

  private resolver(mensaje: string): void {
    this.guardando.set(false);
    this.error.set('');
    this.aviso.set(mensaje);
    this.recargar();
  }

  guardarConfiguracion(): void {
    const organizacionId = this.store.organizacionId();
    const edicionId = this.datos()?.agenda.edicionMercadoId ?? this.edicionId;
    if (!organizacionId || !edicionId) return;
    const cuerpo: ConfiguracionDeAgenda = {
      modo: this.cfgModo(),
      aprobacionDeArtistas: this.cfgAprobacion(),
      duracionMinutos: this.cfgDuracion(),
      pausaMinutos: this.cfgPausa(),
      topeSolicitudesPendientes: this.cfgTope(),
      vencimientoSolicitudHoras: this.cfgVence(),
      cupoArtistas: this.cfgCupo(),
      citasMaximasPorVisitante: this.cfgCupoDeCitas(),
      subtitulo: this.cfgSubtitulo().trim() || null,
      aperturaInscripcionUtc: this.deLocal(this.cfgApertura()),
      cierreInscripcionUtc: this.deLocal(this.cfgCierre()),
      nombre: this.cfgNombre().trim() || null,
    };
    this.guardando.set(true);
    const eraNueva = !this.datos();
    const agendaId = this.datos()?.agenda.id;
    (agendaId ? this.servicio.actualizarAgenda(organizacionId, edicionId, agendaId, cuerpo) : this.servicio.crearAgenda(organizacionId, edicionId, cuerpo)).subscribe({
      next: agenda => {
        if (eraNueva) {
          // Con la agenda creada, la pantalla pasa a su propia dirección.
          void this.router.navigate(this.enPanel('procesos/mercados', agenda.mercadoId, 'agenda-de-citas', agenda.id), { replaceUrl: true });
          return;
        }
        this.resolver('Guardamos la configuración de la agenda.');
      },
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible guardar la configuración.'),
    });
  }

  generarFranjas(): void {
    const organizacionId = this.store.organizacionId();
    const agenda = this.datos()?.agenda;
    if (!organizacionId || !agenda) return;
    this.guardando.set(true);
    this.servicio.generarFranjas(organizacionId, agenda.id, {
      fecha: this.franjaFecha(), desde: this.franjaDesde(), hasta: this.franjaHasta(),
    }).subscribe({
      next: r => this.resolver(r.generadas
        ? `Generamos ${r.generadas} franjas${r.yaExistian ? ` (${r.yaExistian} ya existían)` : ''}.`
        : 'Esas franjas ya existían: no se generó ninguna nueva.'),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible generar las franjas.'),
    });
  }

  invitarComprador(): void {
    const organizacionId = this.store.organizacionId();
    const agenda = this.datos()?.agenda;
    if (!organizacionId || !agenda) return;
    this.guardando.set(true);
    this.servicio.agregarComprador(organizacionId, agenda.id, {
      nombre: this.cNombre(),
      entidad: this.cEntidad() || null,
      tipoDeComprador: this.cTipo(),
      correo: this.cCorreo(),
      presentacion: this.cPresentacion() || null,
      enlaces: null,
      espacio: this.cEspacio() || null,
    }).subscribe({
      next: () => {
        this.cNombre.set(''); this.cEntidad.set(''); this.cCorreo.set(''); this.cEspacio.set(''); this.cPresentacion.set('');
        this.resolver('Invitamos al comprador. Si no tiene cuenta, le enviamos un enlace para aceptar con ese correo o crearla.');
      },
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible invitar al comprador.'),
    });
  }

  reenviarInvitacion(persona: Participante): void {
    const organizacionId = this.store.organizacionId();
    const agenda = this.datos()?.agenda;
    if (!organizacionId || !agenda) return;
    this.guardando.set(true);
    this.servicio.emitirInvitacion(organizacionId, agenda.id, persona.id).subscribe({
      next: r => this.resolver(
        `Enviamos la invitación a ${persona.correoInvitacion ?? persona.nombre}. El enlace anterior dejó de servir. `
        + `Si hace falta, puedes compartir este por otro medio: ${window.location.origin}${r.enlace}`),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible enviar la invitación.'),
    });
  }

  asignarEspacio(persona: Participante, espacio: string): void {
    const organizacionId = this.store.organizacionId();
    const agenda = this.datos()?.agenda;
    if (!organizacionId || !agenda) return;
    this.servicio.asignarEspacio(organizacionId, agenda.id, persona.id, espacio.trim() || null).subscribe({
      next: () => this.resolver(`Guardamos la mesa o el espacio de ${persona.nombre}.`),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible guardar la mesa o el espacio.'),
    });
  }

  async cambiarEstado(accion: 'abrir' | 'iniciar' | 'cerrar'): Promise<void> {
    const organizacionId = this.store.organizacionId();
    const agenda = this.datos()?.agenda;
    if (!organizacionId || !agenda) return;

    if (accion !== 'abrir') {
      const respuesta = await this.confirmaciones.pedir(accion === 'iniciar'
        ? { titulo: 'Cerrar la inscripción e iniciar la agenda', detalle: 'Ya no podrá inscribirse nadie más. Las citas se siguen pidiendo y respondiendo.', accion: 'Iniciar la agenda', tono: 'confirmar' }
        : { titulo: 'Cerrar la agenda', detalle: 'Las solicitudes que no hayan sido respondidas se cancelan y ya no se pueden pedir citas. Las confirmadas quedan.', accion: 'Cerrar la agenda', tono: 'destructiva' });
      if (!respuesta) return;
    }

    this.guardando.set(true);
    this.servicio.cambiarEstado(organizacionId, agenda.id, accion).subscribe({
      next: () => this.resolver(accion === 'abrir' ? 'La inscripción está abierta.' : accion === 'iniciar' ? 'La agenda está en curso.' : 'La agenda quedó cerrada.'),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible cambiar el estado de la agenda.'),
    });
  }

  aprobar(persona: Participante): void {
    const organizacionId = this.store.organizacionId();
    const agenda = this.datos()?.agenda;
    if (!organizacionId || !agenda) return;
    this.guardando.set(true);
    this.servicio.decidirSobreParticipante(organizacionId, agenda.id, persona.id, 'aprobar', null).subscribe({
      next: r => this.resolver(r.estado === 'lista_de_espera'
        ? `Aprobamos a ${persona.nombre}, pero el cupo está lleno: quedó en la lista de espera.`
        : `Aprobamos a ${persona.nombre}. Ya puede pedir citas.`),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible aprobar la inscripción.'),
    });
  }

  async decidir(persona: Participante, accion: 'rechazar' | 'retirar'): Promise<void> {
    const organizacionId = this.store.organizacionId();
    const agenda = this.datos()?.agenda;
    if (!organizacionId || !agenda) return;
    const respuesta = await this.confirmaciones.pedir({
      titulo: accion === 'rechazar' ? `Rechazar a ${persona.nombre}` : `Retirar a ${persona.nombre}`,
      detalle: 'Sus citas se cancelan y, si ocupaba un lugar, entra el siguiente de la lista de espera.',
      accion: accion === 'rechazar' ? 'Rechazar' : 'Retirar',
      tono: 'destructiva',
      pideMotivo: true,
      motivoObligatorio: true,
      rotuloDelMotivo: 'Motivo',
      ayudaDelMotivo: 'La persona lo va a leer.',
    });
    if (!respuesta) return;
    this.guardando.set(true);
    this.servicio.decidirSobreParticipante(organizacionId, agenda.id, persona.id, accion, respuesta.motivo).subscribe({
      next: () => this.resolver(accion === 'rechazar' ? `Rechazamos la inscripción de ${persona.nombre}.` : `Retiramos a ${persona.nombre} de la agenda.`),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible completar la acción.'),
    });
  }

  async cancelarCita(cita: Cita): Promise<void> {
    const organizacionId = this.store.organizacionId();
    const agenda = this.datos()?.agenda;
    if (!organizacionId || !agenda) return;
    const respuesta = await this.confirmaciones.pedir({
      titulo: 'Cancelar la cita',
      detalle: `Cancelas la cita de ${cita.visitanteNombre} con ${cita.anfitrionNombre}. Las dos personas reciben un aviso con el motivo.`,
      accion: 'Cancelar la cita',
      tono: 'destructiva',
      pideMotivo: true,
      motivoObligatorio: true,
      rotuloDelMotivo: 'Motivo',
    });
    if (!respuesta) return;
    this.guardando.set(true);
    this.servicio.cancelarComoOrganizacion(organizacionId, agenda.id, cita.id, respuesta.motivo).subscribe({
      next: () => this.resolver('Cancelamos la cita y avisamos a las dos personas.'),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible cancelar la cita.'),
    });
  }
}
