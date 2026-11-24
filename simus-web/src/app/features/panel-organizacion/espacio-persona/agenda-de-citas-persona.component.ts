import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { RUTAS_DE_LA_CUENTA } from '../../../core/navegacion/rutas-de-gestion';
import {
  AgendaDisponible, AgendamientoDeCitasService, AnfitrionConDisponibilidad, Cita, Franja, MiAgenda, Participante,
  etiquetaDeEstadoDeAgenda, etiquetaDeEstadoDeCita, etiquetaDeEstadoDeParticipante, etiquetaDeModo,
  etiquetaDeTipoDeComprador, vocabularioDeModo, agruparPorJornada, claveDeDia, horaDeLaFranja, rotuloDeJornada, tonoDeEstadoDeAgenda, tonoDeEstadoDeCita, tonoDeEstadoDeParticipante,
} from '../../../core/services/agendamiento-de-citas.service';
import { FotoDelParticipanteComponent } from '../../../shared/components/agenda-de-citas/foto-del-participante.component';
import { CamposDeEnlacesComponent, enlacesDeTexto } from '../../../shared/components/agenda-de-citas/campos-de-enlaces.component';
import { MiPerfilPublico, PerfilPublicoService } from '../../../core/services/perfil-publico.service';
import { AvatarDePersonaComponent } from '../../../shared/components/agenda-de-citas/avatar-de-persona.component';
import { IlustracionDeAgendaComponent } from '../../../shared/components/agenda-de-citas/ilustracion-de-agenda.component';
import { CalendarioDeAgendaComponent, CeldaDeFranja, EstadoDeFranja } from '../../../shared/components/agenda-de-citas/calendario-de-agenda.component';
import { HerramientaAPantallaCompletaComponent, SeccionDeHerramienta } from '../../../shared/components/agenda-de-citas/herramienta-a-pantalla-completa.component';
import { FichaDePersonaComponent, enlacesDePortafolio } from '../../../shared/components/agenda-de-citas/ficha-de-persona.component';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { CampoDeTextoComponent } from '../../../shared/components/ui/campo-de-texto/campo-de-texto.component';
import { EsqueletoComponent } from '../../../shared/components/ui/esqueleto/esqueleto.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { FiltroDesplegableComponent } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { FalloDelServidor } from '../panel-organizacion.api';

export const RUTA_DE_LAS_AGENDAS_DE_CITAS = `${RUTAS_DE_LA_CUENTA.miEspacio}/agenda-de-citas`;

/**
 * Mis agendas de citas (`/gestion/cuenta/agenda-de-citas`): las agendas abiertas a las que puedo
 * inscribirme y aquellas en las que ya participo, como artista, representante o comprador invitado.
 */
@Component({
  selector: 'app-mis-agendas-de-citas',
  standalone: true,
  imports: [RouterLink, FechaPipe, EsqueletoComponent, EstadoDeListaComponent, IndicadorDeEstadoComponent],
  template: `
    <div class="space-y-8 pb-8">
      <section aria-labelledby="mis-agendas-titulo" class="border-b border-slate-200 pb-6">
        <h2 id="mis-agendas-titulo" class="text-morado">Mi agenda de citas</h2>
        <p class="mt-2 max-w-2xl text-cuerpo leading-relaxed text-prosa">
          Las citas entre artistas y compradores de los Mercados. Inscribirte no garantiza una cita: depende de quien confirme.
          Cada agenda se abre a pantalla completa, con su calendario.
        </p>
      </section>

      @if (error()) { <p role="alert" class="bg-red-50 p-3 text-cuerpo text-red-800">{{ error() }}</p> }

      @if (cargando()) {
        <app-esqueleto variante="fila" [cantidad]="3" etiqueta="Consultando las agendas…" />
      } @else if (!agendas().length) {
        <app-estado-de-lista data-testid="sin-agendas" titulo="No hay agendas de citas abiertas por ahora"
          detalle="Cuando un Mercado abra la inscripción de su agenda, la verás aquí. También las encuentras en la Agenda de citas del Ecosistema.">
          <a routerLink="/ecosistema/agenda-de-citas" class="font-semibold text-morado underline">Ver las agendas del Ecosistema</a>
        </app-estado-de-lista>
      } @else {
        <div class="divide-y divide-slate-200 border-y border-slate-200">
          @for (a of agendas(); track a.agendaId) {
            <a [routerLink]="[a.agendaId]" data-testid="fila-de-agenda"
               class="grid gap-3 px-3 py-4 no-underline hover:bg-white sm:grid-cols-[2fr_1fr_1fr] sm:items-center">
              <div class="min-w-0">
                <p class="truncate text-cuerpo font-semibold text-valor">{{ a.mercadoNombre }}</p>
                <p class="mt-1 text-dato text-prosa">Edición {{ a.anio }}@if (a.fechaInicio) { · {{ a.fechaInicio | fecha }} }</p>
              </div>
              <p class="inline-flex items-center gap-2 text-cuerpo font-semibold text-valor">
                <app-indicador-de-estado [etiqueta]="estado(a.estado)" [tono]="tonoDeAgenda(a.estado)" [conTexto]="true" /></p>
              <p class="text-cuerpo text-prosa" data-testid="mi-situacion">
                @if (a.miRol) { {{ a.miRol === 'comprador' ? 'Comprador invitado' : 'Artista' }} · {{ participante(a.miEstado) }} }
                @else { {{ a.inscripcionAbierta ? 'Puedes inscribirte' : 'Sin inscripción abierta' }} }
              </p>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class MisAgendasDeCitasComponent implements OnInit {
  private readonly servicio = inject(AgendamientoDeCitasService);

  readonly agendas = signal<AgendaDisponible[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  estado(valor: string): string { return etiquetaDeEstadoDeAgenda(valor); }
  tonoDeAgenda(valor: string) { return tonoDeEstadoDeAgenda(valor); }
  participante(valor: string | null): string { return etiquetaDeEstadoDeParticipante(valor); }

  ngOnInit(): void {
    this.cargando.set(true);
    this.servicio.misAgendas().subscribe({
      next: agendas => { this.cargando.set(false); this.agendas.set(agendas); },
      error: (fallo: FalloDelServidor) => {
        this.cargando.set(false);
        this.error.set(fallo?.message ?? 'No fue posible consultar tus agendas.');
      },
    });
  }
}

/**
 * Una agenda vista por quien participa (`/gestion/cuenta/agenda-de-citas/:agendaId`): su inscripción,
 * a quién puede pedirle cita, sus citas con el contacto de la otra parte cuando están confirmadas, y su
 * calendario.
 *
 * <b>EL CONTACTO SE VE CON LA CITA CONFIRMADA</b>, no antes: el directorio de una agenda no es una
 * lista de contactos.
 */
@Component({
  selector: 'app-mi-agenda-de-citas',
  standalone: true,
  imports: [
    FormsModule, FechaPipe, BotonNativoDirective, CalendarioDeAgendaComponent, CampoDeTextoComponent, EsqueletoComponent,
    EstadoDeListaComponent, FiltroDesplegableComponent, HerramientaAPantallaCompletaComponent, IndicadorDeEstadoComponent,
    AvatarDePersonaComponent, IlustracionDeAgendaComponent, FotoDelParticipanteComponent, FichaDePersonaComponent, CamposDeEnlacesComponent,
  ],
  styles: [`
    .tarjeta-persona { display: flex; flex-direction: column; gap: .6rem; padding: 1rem; border: 2px solid var(--color-filete); border-radius: .9rem; background: #fff; font: inherit; cursor: pointer; }
    .tarjeta-persona:hover:not(:disabled) { border-color: var(--color-morado); background: #f6f3fb; }
    .tarjeta-persona:disabled { cursor: not-allowed; opacity: .6; }
    .tarjeta-persona:focus-visible, .hora-libre:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: 2px; }
    .hora-libre { min-width: 5rem; min-height: 2.75rem; padding: 0 1rem; border: 1px solid #8fd1b0; border-radius: .6rem; background: #ecfaf3; font: inherit; font-size: var(--text-lectura); font-weight: 700; color: #0f5132; cursor: pointer; font-variant-numeric: tabular-nums; }
    .cap::first-letter { text-transform: uppercase; }
    .hora-libre:hover:not(:disabled) { background: #dff3e8; }
  `],
  template: `
    <app-herramienta-a-pantalla-completa [titulo]="tituloDeLaAgenda()" [procedencia]="procedencia()" [volverA]="rutaDeLaLista"
      [secciones]="secciones()" [seccionActiva]="pestana()" controla="panel-de-mi-agenda" (elegir)="pestana.set($any($event))">
      <span estado>
        @if (vista(); as v) {
          <span class="app__estado-texto" data-testid="estado-de-la-agenda">
            <span class="app__punto" [class]="'app__punto app__punto--' + v.agenda.estado" aria-hidden="true"></span>{{ estadoAgenda(v.agenda.estado) }}
          </span>
        }
      </span>
      <div acciones class="flex flex-wrap items-center gap-2">
        @if (vista(); as v) {
          @if (v.citas.length) {
            <a data-testid="agregar-al-calendario" [href]="urlDelCalendario(v.agenda.agendaId)" download class="app__boton">Mis citas a mi calendario (.ics)</a>
            <button type="button" class="app__boton" data-testid="imprimir-mi-agenda" (click)="imprimir()">Imprimir</button>
          }
        }
      </div>
    <div class="space-y-5 pb-10">
      @if (error()) { <p role="alert" data-testid="error" class="rounded-lg bg-red-50 p-3 text-cuerpo text-red-800">{{ error() }}</p> }
      @if (aviso()) { <p role="status" data-testid="aviso" class="rounded-lg bg-emerald-50 p-3 text-cuerpo text-emerald-900">{{ aviso() }}</p> }

      @if (cargando() && !vista()) {
        <app-esqueleto variante="encabezado" etiqueta="Consultando la agenda…" />
        <app-esqueleto variante="fila" [cantidad]="3" etiqueta="Consultando la agenda…" />
      } @else if (vista(); as v) {
        <!-- Qué hago ahora: una frase, según mi situación. -->
        <section aria-labelledby="ahora-titulo" class="app-superficie app-superficie--lectura" data-testid="siguiente-paso">
          <h2 id="ahora-titulo" class="text-valor">{{ siguiente().titulo }}</h2>
          <p class="mt-1 max-w-3xl text-cuerpo leading-relaxed text-prosa">{{ siguiente().detalle }}</p>
          @if (accionDelPaso(); as accion) { <button type="button" appBoton="principal" class="mt-3" data-testid="accion-del-paso" (click)="pestana.set(accion.pestana)">{{ accion.texto }}</button> }
        </section>

        <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div class="min-w-0">
        <div id="panel-de-mi-agenda" class="space-y-5" role="region" aria-label="Contenido de mi agenda">
        <!-- Mi día: mis citas por hora, a quién visito o quién me visita, y qué hago ahora. -->
        <section [hidden]="pestana() !== 'dia'" aria-labelledby="mi-dia-titulo" class="space-y-4" data-testid="mi-dia">
          <h2 id="mi-dia-titulo" class="text-valor">Mi día</h2>
          @if (!diasDeMisCitas().length) {
            <div class="app-superficie flex flex-col items-center gap-3 p-8 text-center" data-testid="mi-dia-vacio">
              <app-ilustracion-de-agenda dibujo="cita" [ancho]="9" />
              <p class="text-lectura font-semibold text-valor">Todavía no tienes citas</p>
              <p class="max-w-md text-cuerpo text-prosa">{{ v.rotoYPidoCitas && v.puedoPedirCitas ? 'Elige a quién quieres ver y la hora que te sirva.' : 'Cuando te pidan una cita, la verás aquí con su hora y podrás confirmarla.' }}</p>
              @if (v.rotoYPidoCitas && v.puedoPedirCitas) { <button type="button" appBoton="principal" (click)="pestana.set('pedir')">Pedir una cita</button> }
            </div>
          }
          @for (dia of diasDeMisCitas(); track dia.clave) {
            <div class="app-superficie app-superficie--lectura">
              <h3 class="cap text-morado">{{ dia.rotulo }}</h3>
              <ol class="mt-3 space-y-3">
                @for (cita of dia.citas; track cita.id) {
                  <li class="grid grid-cols-[4rem_minmax(0,1fr)] gap-3" data-testid="cita-del-dia">
                    <p class="font-alternate text-titulo font-semibold text-morado">{{ cita.inicioUtc | fecha:'hora' }}</p>
                    <div class="rounded-xl bg-morado-50 p-3">
                      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                        <div class="flex min-w-0 items-center gap-3">
                          <app-avatar-de-persona [nombre]="conQuien(v, cita)" [fotoUrl]="cita.otraParte?.fotoUrl ?? null" [medida]="3" />
                          <div class="min-w-0">
                            <p class="break-words text-lectura font-bold text-valor">{{ conQuien(v, cita) }}</p>
                            @if (cita.otraParte?.entidad) { <p class="break-words text-cuerpo text-prosa">{{ cita.otraParte?.entidad }}</p> }
                            <p class="text-valor">{{ dondeEs(cita) }}</p>
                          </div>
                        </div>
                        <span class="inline-flex items-center gap-2 text-cuerpo text-valor">
                          <app-indicador-de-estado [etiqueta]="estadoCita(cita.estado)" [tono]="tonoCita(cita.estado)" [conTexto]="true" /></span>
                      </div>
                      @if (portafolioDe(cita.otraParte?.enlaces).length) {
                        <p class="mt-2 flex flex-wrap gap-1" data-testid="portafolio-en-mi-dia">
                          @for (e of portafolioDe(cita.otraParte?.enlaces); track e.url) {
                            <a class="rounded bg-white px-2 text-dato font-bold leading-5 text-morado no-underline hover:bg-morado-100" [href]="e.url" target="_blank" rel="noopener noreferrer">{{ e.rotulo }}</a>
                          }
                        </p>
                      }
                      <div class="mt-2 flex flex-wrap gap-2 empty:hidden">
                        @if (cita.estado === 'solicitada' && soyAnfitrion(v, cita)) {
                          <button type="button" appBoton="confirmar" tamano="menudo" [disabled]="guardando()" (click)="confirmar(cita)">Confirmar</button>
                          <button type="button" appBoton="destructiva" tamano="menudo" [disabled]="guardando()" (click)="rechazar(cita)">Rechazar</button>
                        } @else if ((cita.estado === 'solicitada' || cita.estado === 'confirmada') && !cerrada()) {
                          <button type="button" appBoton="destructiva" tamano="menudo" [disabled]="guardando()" (click)="cancelar(cita)">{{ cita.estado === 'solicitada' ? 'Retirar la solicitud' : 'Cancelar' }}</button>
                        } @else if (cerrada()) {
                          <p class="text-dato text-prosa" data-testid="agenda-cerrada-sin-cancelar">La agenda está cerrada: esta cita ya no se puede cancelar.</p>
                        }
                      </div>
                    </div>
                  </li>
                }
              </ol>
            </div>
          }
        </section>

        <!-- Calendario -->
        <section [hidden]="pestana() !== 'calendario'" aria-labelledby="calendario-titulo" class="space-y-4" data-testid="vista-calendario">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <h3 id="calendario-titulo" class="text-valor">Calendario</h3>
            @if (v.rotoYPidoCitas && v.anfitriones.length) {
              <app-filtro-desplegable [etiqueta]="v.miParticipacion?.rol === 'comprador' ? 'Ver franjas libres de' : 'Ver franjas libres de'" rotulo="Persona"
                identificador="filtro-del-anfitrion" [opciones]="opcionesDeAnfitrion()" [elegida]="anfitrionElegido()"
                (cambiar)="anfitrionElegido.set($event); franjaElegida.set(null)" />
            }
          </div>
          @if (!v.franjas.length) {
            <app-estado-de-lista titulo="Todavía no hay franjas" detalle="La organización aún no define los horarios de esta agenda." [denso]="true" />
          } @else {
            <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <app-calendario-de-agenda [franjas]="v.franjas" [celdas]="celdas()" [seleccionada]="franjaElegida()" (elegir)="franjaElegida.set($event)" />
              <!-- Los detalles y las acciones, a la derecha del calendario, donde está la mirada -->
              <aside aria-labelledby="detalle-titulo" class="app-superficie space-y-3 lg:sticky lg:top-0 lg:self-start" data-testid="detalle-de-la-franja">
                @if (franjaElegida() === null) {
                  <h4 id="detalle-titulo" class="text-valor">Elige un hueco del calendario</h4>
                  <p class="text-cuerpo text-prosa">@if (v.rotoYPidoCitas) { Pulsa un horario libre para ver con quién puedes agendar. } @else { Pulsa un horario para ver sus citas. }</p>
                } @else {
                  <h4 id="detalle-titulo" class="text-valor">{{ rotuloDeLaFranja() }}</h4>
                  @for (cita of citasDeLaFranja(); track cita.id) {
                    <div class="space-y-2 text-cuerpo text-valor">
                      <p>Con <strong>{{ conQuien(v, cita) }}</strong> · {{ estadoCita(cita.estado) }}</p>
                      @if (cita.otraParte; as otra) {
                        <div class="space-y-1 border-l-0 bg-slate-50 p-3" data-testid="portafolio-de-la-otra-parte">
                          <p class="text-dato font-bold text-valor">Portafolio de {{ otra.nombre }}@if (otra.entidad) { · {{ otra.entidad }} }</p>
                          @if (otra.presentacion) { <p class="text-cuerpo text-prosa">{{ otra.presentacion }}</p> }
                          @for (enlace of enlacesDe(otra.enlaces); track enlace) {
                            <p class="truncate text-cuerpo"><a [href]="enlace" target="_blank" rel="noopener noreferrer" class="font-bold text-verde-texto hover:underline">{{ enlace }}</a></p>
                          }
                        </div>
                      }
                      @if (cita.estado === 'solicitada' && soyAnfitrion(v, cita)) {
                        <div class="flex flex-wrap gap-2">
                          <button type="button" appBoton="confirmar" tamano="menudo" [disabled]="guardando()" (click)="confirmar(cita)">Confirmar</button>
                          <button type="button" appBoton="destructiva" tamano="menudo" [disabled]="guardando()" (click)="rechazar(cita)">Rechazar</button>
                        </div>
                      } @else if ((cita.estado === 'solicitada' || cita.estado === 'confirmada') && !cerrada()) {
                        <button type="button" appBoton="destructiva" tamano="menudo" [disabled]="guardando()" (click)="cancelar(cita)">
                          {{ cita.estado === 'solicitada' ? 'Retirar la solicitud' : 'Cancelar' }}</button>
                      }
                    </div>
                  }
                  @if (!citasDeLaFranja().length) {
                    @if (v.rotoYPidoCitas) {
                      @if (!v.puedoPedirCitas) {
                        <p class="text-cuerpo text-prosa" data-testid="sin-cupo">{{ motivoSinCupo(v) }}</p>
                      } @else if (!libresEnLaFranja().length) {
                        <p class="text-cuerpo text-prosa">Nadie está libre en este horario. Prueba con otro.</p>
                      } @else {
                        <p class="text-cuerpo text-prosa">¿Con quién quieres agendar?</p>
                        <ul class="divide-y divide-slate-200 border-y border-slate-200" data-testid="libres-en-la-franja">
                          @for (q of libresEnLaFranja(); track q.anfitrion.id) {
                            <li class="flex flex-wrap items-center justify-between gap-2 py-2">
                              <span class="text-cuerpo text-valor">{{ q.anfitrion.nombre }}@if (q.anfitrion.entidad) { <span class="text-prosa"> · {{ q.anfitrion.entidad }}</span> }</span>
                              <button type="button" appBoton="principal" tamano="menudo" [disabled]="guardando()" (click)="pedirDesdeElCalendario(q)">Pedir cita</button>
                            </li>
                          }
                        </ul>
                      }
                    } @else {
                      <p class="text-cuerpo text-prosa">No tienes citas en este horario.</p>
                    }
                  }
                }
              </aside>
            </div>
          }
        </section>

        <!-- Pedir citas: un recorrido de tres pasos -->
        @if (v.rotoYPidoCitas) {
          <section [hidden]="pestana() !== 'pedir'" aria-labelledby="pedir-titulo" class="space-y-5" data-testid="recorrido-de-pedir">
            <h3 id="pedir-titulo" class="text-valor">Pide una cita en tres pasos</h3>
            <ol class="flex flex-wrap items-center gap-3" aria-label="Pasos para pedir una cita">
              @for (p of pasosDePedir; track p.id) {
                <li class="flex items-center gap-2" [attr.aria-current]="pasoDePedir() === p.id ? 'step' : null">
                  <span class="text-cuerpo font-bold tabular-nums" [class.text-morado]="pasoDePedir() === p.id" [class.text-emerald-800]="pasoDePedir() > p.id">
                    {{ pasoDePedir() > p.id ? '✓' : p.id + '.' }}</span>
                  <span class="text-cuerpo" [class.font-bold]="pasoDePedir() === p.id" [class.text-morado]="pasoDePedir() === p.id">{{ v.miParticipacion?.rol === 'comprador' ? p.paraComprador : p.paraArtista }}</span>
                </li>
              }
            </ol>
            <p class="text-cuerpo text-prosa" data-testid="contador-de-pendientes">
              Tienes {{ v.solicitudesPendientes }} de {{ v.topeSolicitudesPendientes }} solicitudes pendientes. Una solicitud sin respuesta
              vence a las {{ v.vencimientoSolicitudHoras }} horas y libera la franja.
            </p>

            @if (!v.anfitriones.length) {
              <div class="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-8 text-center">
                <app-ilustracion-de-agenda dibujo="personas" [ancho]="9" />
                <p class="text-lectura font-semibold text-valor">Todavía no hay a quién pedirle cita</p>
                <p class="max-w-md text-cuerpo text-prosa">Cuando la organización apruebe a más participantes, aparecerán aquí.</p>
              </div>
            } @else if (pasoDePedir() === 1) {
              <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="lista-de-anfitriones">
                @for (item of v.anfitriones; track item.anfitrion.id) {
                  <button type="button" class="tarjeta-persona" data-testid="anfitrion" [disabled]="!franjasLibres(v, item).length || !v.puedoPedirCitas"
                          (click)="elegirAnfitrion(item)">
                    <span class="flex items-center gap-3">
                      <app-avatar-de-persona [nombre]="item.anfitrion.nombre" [fotoUrl]="item.anfitrion.fotoUrl ?? null" [medida]="3.25" />
                      <span class="min-w-0 text-left">
                        <span class="block break-words text-lectura font-semibold text-valor">{{ item.anfitrion.nombre }}</span>
                        @if (item.anfitrion.entidad) { <span class="block break-words text-cuerpo text-prosa">{{ item.anfitrion.entidad }}</span> }
                      </span>
                    </span>
                    <span class="block text-left text-cuerpo text-prosa">
                      @if (item.anfitrion.tipoDeComprador) { {{ tipoDeComprador(item.anfitrion.tipoDeComprador) }} · }
                      @if (item.anfitrion.espacio) { Mesa o sala: {{ item.anfitrion.espacio }} · }
                      {{ item.anfitrion.presentacion }}
                    </span>
                    <span class="block text-left text-cuerpo font-semibold" [class.text-emerald-800]="franjasLibres(v, item).length" [class.text-slate-600]="!franjasLibres(v, item).length">
                      {{ franjasLibres(v, item).length ? franjasLibres(v, item).length + ' franjas libres' : 'Sin franjas libres' }}</span>
                  </button>
                }
              </div>
            } @else if (pasoDePedir() === 2 && anfitrionPedido(); as item) {
              <div class="space-y-4" data-testid="paso-de-franja">
                <div class="flex flex-wrap items-center gap-3">
                  <app-avatar-de-persona [nombre]="item.anfitrion.nombre" [fotoUrl]="item.anfitrion.fotoUrl ?? null" />
                  <p class="text-lectura font-semibold text-valor">{{ item.anfitrion.nombre }}</p>
                  <button type="button" appBoton="terciaria" tamano="menudo" (click)="volverAlPaso(1)">Cambiar de persona</button>
                </div>
                @for (j of jornadasLibres(v, item); track j.clave) {
                  <div>
                    <p class="cap text-cuerpo font-semibold text-valor">{{ j.rotulo }}</p>
                    <div class="mt-2 flex flex-wrap gap-2">
                      @for (franja of j.franjas; track franja.id) {
                        <button type="button" data-testid="pedir-franja" class="hora-libre" [disabled]="guardando()" (click)="elegirFranja(franja)">{{ franja.inicioUtc | fecha:'hora' }}
                          <span class="sr-only">, {{ franja.inicioUtc | fecha:'fecha-hora' }}</span></button>
                      }
                    </div>
                  </div>
                } @empty { <p class="text-cuerpo text-prosa">Sin franjas libres.</p> }
              </div>
            } @else if (pasoDePedir() === 3 && anfitrionPedido(); as item) {
              <div class="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5" data-testid="paso-de-confirmar">
                <div class="flex items-center gap-3">
                  <app-avatar-de-persona [nombre]="item.anfitrion.nombre" [fotoUrl]="item.anfitrion.fotoUrl ?? null" [medida]="3.25" />
                  <div><p class="text-lectura font-semibold text-valor">{{ item.anfitrion.nombre }}</p>
                    <p class="text-cuerpo text-prosa">{{ franjaPedida()?.inicioUtc | fecha:'fecha-hora' }} · {{ v.agenda.duracionMinutos }} minutos@if (item.anfitrion.espacio) { · Mesa o sala: {{ item.anfitrion.espacio }} }</p></div>
                </div>
                <app-campo-de-texto etiqueta="Mensaje (opcional)" identificador="mensaje-del-pedido" [multilinea]="true" [filas]="2" [maximo]="500"
                  ayuda="Cuéntale en una línea por qué quieres reunirte." [ngModel]="mensajeDelPedido()" (ngModelChange)="mensajeDelPedido.set($event)" />
                <p class="text-cuerpo text-prosa">La franja queda reservada para ti mientras esperas la respuesta. Si no responden a tiempo, se libera sola.</p>
                <div class="flex flex-wrap gap-3">
                  <button type="button" appBoton="principal" data-testid="confirmar-pedido" [disabled]="guardando()" (click)="enviarPedido()">Pedir la cita</button>
                  <button type="button" appBoton="secundaria" (click)="volverAlPaso(2)">Cambiar la hora</button>
                </div>
              </div>
            }
          </section>
        }

        <!-- Mis citas -->
        <section [hidden]="pestana() !== 'citas'" aria-labelledby="mis-citas-titulo" class="app-superficie app-superficie--lectura space-y-3">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <h3 id="mis-citas-titulo" class="text-valor">Mis citas</h3>
            @if (v.citas.length) {
              <app-filtro-desplegable etiqueta="Estado de la cita" rotulo="Estado" identificador="filtro-de-mis-citas"
                [opciones]="opcionesDeEstado()" [elegida]="filtroDeEstado()" (cambiar)="filtroDeEstado.set($event)" />
            }
          </div>
          @if (!v.citas.length) {
            <app-estado-de-lista data-testid="sin-citas" titulo="Todavía no tienes citas" detalle="Cuando pidas una cita o te la pidan, la verás aquí con su estado." [denso]="true" />
          } @else {
            <div class="divide-y divide-slate-200 border-y border-slate-200" data-testid="mis-citas">
              @for (cita of citasVisibles(); track cita.id) {
                <div class="grid gap-2 py-3 sm:grid-cols-[1fr_2fr_1.2fr_auto] sm:items-center" data-testid="cita">
                  <p class="text-valor">{{ cita.inicioUtc | fecha:'fecha-hora' }}</p>
                  <div class="text-cuerpo text-prosa">
                    <p>Con <strong class="text-valor">{{ conQuien(v, cita) }}</strong>@if (cita.espacio ?? cita.anfitrionEspacio; as lugar) { · Mesa o sala: {{ lugar }} }</p>
                    @if (cita.mensajeInicial) { <p>«{{ cita.mensajeInicial }}»</p> }
                    @if (cita.estado === 'confirmada' && (cita.contactoCorreo || cita.contactoTelefono)) {
                      <p class="mt-1 text-valor" data-testid="contacto">Contacto: {{ cita.contactoCorreo }}@if (cita.contactoTelefono) { · {{ cita.contactoTelefono }} }</p>
                    }
                  </div>
                  <p class="text-cuerpo text-valor" data-testid="estado-de-la-cita">
                    <span class="inline-flex items-center gap-2">
                      <app-indicador-de-estado [etiqueta]="estadoCita(cita.estado)" [tono]="tonoCita(cita.estado)" [conTexto]="true" /></span>@if (cita.motivoDeLaDecision) { · {{ cita.motivoDeLaDecision }} }
                    @if (cita.estado === 'solicitada' && cita.venceUtc) { <span class="block text-dato text-prosa">Vence {{ cita.venceUtc | fecha:'fecha-hora' }}</span> }
                  </p>
                  <div class="flex flex-wrap gap-2">
                    @if (cita.estado === 'solicitada' && soyAnfitrion(v, cita)) {
                      <button type="button" data-testid="confirmar-cita" appBoton="confirmar" tamano="menudo" [disabled]="guardando()" (click)="confirmar(cita)">Confirmar</button>
                      <button type="button" data-testid="rechazar-cita" appBoton="destructiva" tamano="menudo" [disabled]="guardando()" (click)="rechazar(cita)">Rechazar</button>
                    } @else if ((cita.estado === 'solicitada' || cita.estado === 'confirmada') && !cerrada()) {
                      <button type="button" data-testid="cancelar-cita" appBoton="destructiva" tamano="menudo" [disabled]="guardando()" (click)="cancelar(cita)">
                        {{ cita.estado === 'solicitada' ? 'Retirar la solicitud' : 'Cancelar' }}
                      </button>
                    } @else if (cerrada() && (cita.estado === 'solicitada' || cita.estado === 'confirmada')) {
                      <p class="text-dato text-prosa" data-testid="agenda-cerrada-sin-cancelar">La agenda está cerrada: esta cita ya no se puede cancelar.</p>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Mi inscripción -->
        <section [hidden]="pestana() !== 'inscripcion'" aria-labelledby="mi-situacion-titulo" class="app-superficie app-superficie--lectura space-y-4">
          <h3 id="mi-situacion-titulo" class="text-valor">Mi participación</h3>
          @if (v.miParticipacion || v.puedoInscribirme) {
            <app-foto-del-participante [nombre]="v.miParticipacion?.nombre || iNombre() || 'Tú'" [fotoActual]="v.miParticipacion?.fotoUrl ?? null"
              [vistaPrevia]="fotoPendienteUrl()" [subiendo]="subiendoFoto()" [error]="errorDeFoto()"
              (elegida)="elegirFoto($event)" (quitada)="quitarFoto()" />
          }
          @if (v.miParticipacion; as mi) {
            <p data-testid="mi-participacion" class="text-cuerpo text-valor">
              {{ mi.rol === 'comprador' ? 'Estás invitado como comprador o booker.' : 'Estás inscrito como artista.' }}
              <strong>{{ estadoParticipante(mi.estado) }}</strong>@if (v.posicionEnLaLista) { · lugar {{ v.posicionEnLaLista }} en la lista de espera }
            </p>
            @if (mi.estado === 'pendiente') {
              <p data-testid="inscripcion-pendiente" class="text-cuerpo text-prosa">
                La organización de {{ v.agenda.mercadoNombre }} revisa cada inscripción. Te avisaremos cuando la apruebe o la rechace;
                mientras tanto no puedes pedir citas.
              </p>
            }
            @if (mi.estado === 'lista_de_espera') {
              <p class="text-cuerpo text-prosa">El cupo está lleno. Entrarás por orden de ingreso si se libera un lugar, y te avisaremos.</p>
            }
            @if (mi.estado === 'rechazado' && mi.motivoDeLaDecision) {
              <p class="text-cuerpo text-prosa" data-testid="motivo-de-rechazo">Motivo de la organización: {{ mi.motivoDeLaDecision }}</p>
            }
            <!-- MI PORTAFOLIO: lo que recibe la otra parte con cada cita. Copia propia de esta agenda; el perfil público no cambia. -->
            @if (mi.estado !== 'rechazado' && mi.estado !== 'retirado') {
              <section aria-labelledby="portafolio-titulo" class="space-y-3 border-t border-slate-200 pt-4" data-testid="mi-portafolio">
                <h4 id="portafolio-titulo" class="text-valor">Mi portafolio para esta agenda</h4>
                <p class="max-w-3xl text-cuerpo text-prosa">Es lo que recibe {{ mi.rol === 'comprador' ? 'cada artista' : 'cada comprador o booker' }} cuando pides o confirmas una cita:
                  tu presentación y tus enlaces. Parte de tu perfil público, como copia propia de esta agenda: puedes quitar, cambiar o ajustar lo que quieras; cambiarlo aquí no modifica tu perfil público.</p>
                <div class="simus-form-grid">
                  <app-campo-de-texto etiqueta="Agrupación o empresa (opcional)" identificador="por-entidad" [ngModel]="pEntidad()" (ngModelChange)="pEntidad.set($event)" />
                  <app-campo-de-texto etiqueta="A quién representas (opcional)" identificador="por-representa" [ngModel]="pRepresenta()" (ngModelChange)="pRepresenta.set($event)" />
                  <div class="sm:col-span-2"><app-campo-de-texto etiqueta="Presentación" identificador="por-presentacion" [multilinea]="true" [filas]="4" [maximo]="1200"
                    [ngModel]="pPresentacion()" (ngModelChange)="pPresentacion.set($event)" /></div>
                  <div class="sm:col-span-2"><app-campos-de-enlaces etiqueta="Enlaces de escucha (audio, video, sitio)" prefijo="por-enlace" [valor]="pEnlaces()" (valorChange)="pEnlaces.set($event)" />
                    @if (errorDePortafolio()) { <p class="mt-1 text-dato text-peligro" role="alert">{{ errorDePortafolio() }}</p> }</div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" appBoton="principal" data-testid="guardar-portafolio" [disabled]="guardando()" (click)="guardarPortafolio(mi)">Guardar mi portafolio</button>
                  @if (perfilPublico()) { <button type="button" appBoton="secundaria" data-testid="restaurar-desde-el-perfil" [disabled]="guardando()" (click)="restaurarDesdeElPerfil()">Restaurar desde mi perfil público</button> }
                </div>
              </section>
            }
            @if (v.agenda.estado !== 'cerrada') {
              <button type="button" data-testid="salir-de-la-agenda" appBoton="destructiva" (click)="retirarme()">Salir de la agenda</button>
            }
          } @else if (v.puedoInscribirme) {
            <p class="max-w-3xl text-cuerpo leading-relaxed text-prosa">
              Presenta tu proyecto en pocas líneas: es lo que verán quienes pueden citarte. Si representas a un artista, dilo abajo.
              Inscribirte no garantiza una cita.
              @if (v.agenda.aprobacionDeArtistas === 'aceptacion') { La organización aprueba cada inscripción: quedarás pendiente hasta su decisión. }
              @if (v.agenda.cupoArtistas) { Artistas admitidos: {{ v.agenda.artistasAprobados }} de {{ v.agenda.cupoArtistas }} lugares ocupados; los demás entran por orden de ingreso a una lista de espera. }
            </p>
            <div class="simus-form-grid">
              <app-campo-de-texto etiqueta="Tu nombre o el de la agrupación" identificador="ins-nombre" [ngModel]="iNombre()" (ngModelChange)="iNombre.set($event)" />
              <app-campo-de-texto etiqueta="Agrupación o proyecto (opcional)" identificador="ins-entidad" [ngModel]="iEntidad()" (ngModelChange)="iEntidad.set($event)" />
              <div class="sm:col-span-2"><app-campo-de-texto etiqueta="Presenta tu proyecto" identificador="ins-presentacion" [multilinea]="true" [filas]="3" [maximo]="1200"
                [ngModel]="iPresentacion()" (ngModelChange)="iPresentacion.set($event)" /></div>
              <div class="sm:col-span-2"><app-campos-de-enlaces etiqueta="Enlaces de escucha (audio, video, sitio)" prefijo="ins-enlace" [valor]="iEnlaces()" (valorChange)="iEnlaces.set($event)" /></div>
              <app-campo-de-texto etiqueta="Si representas a un artista, a quién" identificador="ins-representa" [ngModel]="iRepresenta()" (ngModelChange)="iRepresenta.set($event)" />
              <app-campo-de-texto etiqueta="Teléfono para las citas confirmadas (opcional)" identificador="ins-telefono" tipo="tel" [ngModel]="iTelefono()" (ngModelChange)="iTelefono.set($event)" />
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-testid="inscribirme" appBoton="principal" [disabled]="guardando()" (click)="inscribirme()">Inscribirme</button>
              @if (perfilPublico()) { <button type="button" appBoton="secundaria" data-testid="restaurar-desde-el-perfil" [disabled]="guardando()" (click)="restaurarDesdeElPerfil()">Restaurar desde mi perfil público</button> }
            </div>
          } @else {
            <p class="text-cuerpo text-prosa" data-testid="sin-inscripcion">La inscripción a esta agenda no está abierta.</p>
          }
        </section>
        </div>
        </div>
        <aside class="min-w-0 space-y-5" aria-label="Cómo funciona esta agenda y mi lugar">
        <!-- Cómo funciona ESTA agenda: la modalidad, quién rota y las reglas, antes que cualquier calendario. -->
        <section aria-labelledby="como-funciona-titulo" class="app-superficie app-superficie--lectura space-y-3" data-testid="como-funciona">
          <app-ilustracion-de-agenda [dibujo]="v.agenda.modo === 'compradores_fijos' ? 'fijos' : 'rotan'" [ancho]="14" />
          <div class="space-y-2">
            <h2 id="como-funciona-titulo" class="text-valor">Cómo funciona esta agenda</h2>
            <p class="text-valor" data-testid="modalidad">{{ modo(v.agenda.modo) }}</p>
            <p class="text-cuerpo text-prosa" data-testid="tu-lugar">{{ tuLugar(v) }}</p>
            <ul class="list-disc space-y-1 pl-5 text-cuerpo text-valor" data-testid="reglas-de-la-agenda">
              <li>Citas de {{ v.agenda.duracionMinutos }} minutos. Para pedir una, elige un hueco del calendario y la persona con quien agendar.</li>
              <li>No puedes tener dos citas en el mismo horario: la franja ocupada se bloquea sola.</li>
              @if (v.agenda.citasMaximasPorVisitante) { <li>Máximo {{ v.agenda.citasMaximasPorVisitante }} citas por persona que rota: {{ cupoDeCitasTexto(v.agenda.modo) }}.</li> }
              <li>{{ v.agenda.aprobacionDeArtistas === 'aceptacion' ? 'La organización aprueba cada inscripción de artistas; después, quien recibe la solicitud la acepta o la rechaza.' : 'Los artistas entran por orden de inscripción; quien recibe la solicitud la acepta o la rechaza.' }}</li>
              <li>«Mis citas» reúne las que pediste y las que te pidieron, con su estado.</li>
            </ul>
          </div>
        </section>

        @if (miSitio(); as sitio) {
          <section aria-labelledby="sitio-titulo" class="app-superficie app-superficie--lectura" data-testid="mi-sitio">
            <h2 id="sitio-titulo" class="text-valor">{{ tituloDelSitio(sitio) }}</h2>
            @if (!sitio.espacio) { <p class="text-cuerpo text-prosa">La organización aún no te asigna {{ sitio.tipo === 'stand' ? 'un stand' : 'una mesa' }}; te avisará cuando lo haga.</p> }
            @if (sitio.citas.length) {
              <p class="mt-1 text-cuerpo text-valor">En tu horario se registraron:</p>
              <ul class="mt-1 list-disc pl-5 text-cuerpo text-valor" data-testid="citas-en-mi-horario">
                @for (c of sitio.citas; track c.id) { <li>{{ horaDe(c) }} · {{ conQuien(v, c) }} ({{ estadoCita(c.estado).toLowerCase() }})</li> }
              </ul>
            } @else {
              <p class="mt-1 text-cuerpo text-prosa">Todavía no hay citas en tu horario. Cuando te pidan una, la verás aquí y podrás confirmarla.</p>
            }
          </section>
        }

        </aside>
        </div>
      }
    </div>
    </app-herramienta-a-pantalla-completa>
  `,
})
export class MiAgendaDeCitasComponent implements OnInit {
  private readonly servicio = inject(AgendamientoDeCitasService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  readonly rutaDeLaLista = RUTA_DE_LAS_AGENDAS_DE_CITAS;
  readonly vista = signal<MiAgenda | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  private agendaId = 0;

  readonly iNombre = signal('');
  readonly iEntidad = signal('');
  readonly iPresentacion = signal('');
  readonly iEnlaces = signal('');
  // Mi portafolio en esta agenda (se llena con lo que ya hay al abrir la agenda)
  readonly pEntidad = signal('');
  readonly pRepresenta = signal('');
  readonly pPresentacion = signal('');
  readonly pEnlaces = signal('');
  readonly errorDePortafolio = signal('');
  readonly iRepresenta = signal('');
  readonly iTelefono = signal('');

  readonly pestana = signal<'dia' | 'calendario' | 'pedir' | 'citas' | 'inscripcion'>('calendario');
  readonly anfitrionElegido = signal('ninguno');
  protected readonly pasosDePedir = [
    { id: 1, paraComprador: 'Elige a un artista', paraArtista: 'Elige a un comprador' },
    { id: 2, paraComprador: 'Elige una franja', paraArtista: 'Elige una franja' },
    { id: 3, paraComprador: 'Confirma', paraArtista: 'Confirma' },
  ];
  readonly pasoDePedir = signal(1);
  // «Tu foto»: antes de inscribirse queda esperando; ya inscrita, se sube y se vincula al elegirla.
  readonly fotoPendiente = signal<File | null>(null);
  readonly fotoPendienteUrl = signal<string | null>(null);
  readonly subiendoFoto = signal(false);
  readonly errorDeFoto = signal('');
  private readonly perfiles = inject(PerfilPublicoService);
  readonly anfitrionPedido = signal<AnfitrionConDisponibilidad | null>(null);
  readonly franjaPedida = signal<Franja | null>(null);
  readonly mensajeDelPedido = signal('');
  readonly franjaElegida = signal<number | null>(null);
  readonly filtroDeEstado = signal('todas');
  private pestanaDefinida = false;

  readonly procedencia = computed(() => { const a = this.vista()?.agenda; return a ? `${a.mercadoNombre} · Edición ${a.anio}` : 'Agenda de citas'; });

  /** Mi nombre en la cabecera es el de la agenda: por omisión, el del Mercado. */
  readonly tituloDeLaAgenda = computed(() => { const a = this.vista()?.agenda; return a ? (a.agendaNombre || a.mercadoNombre) : 'Mi agenda de citas'; });

  readonly secciones = computed<SeccionDeHerramienta[]>(() => {
    const v = this.vista();
    const lista: SeccionDeHerramienta[] = [];
    if (v?.miParticipacion) lista.push({ id: 'dia', rotulo: 'Mi día', icono: 'agenda', pendientes: this.porResponder() });
    lista.push({ id: 'calendario', rotulo: 'Calendario', icono: 'calendario' });
    if (v?.rotoYPidoCitas) lista.push({ id: 'pedir', rotulo: 'Pedir citas', icono: 'personas' });
    lista.push({ id: 'citas', rotulo: 'Mis citas', icono: 'citas', pendientes: this.porResponder() }, { id: 'inscripcion', rotulo: 'Mi portafolio', icono: 'portafolio' });
    return lista;
  });

  /** Mis citas vivas (pedidas o confirmadas) por día y por hora: lo que tengo que hacer y a dónde ir. */
  readonly diasDeMisCitas = computed(() => {
    const v = this.vista();
    if (!v) return [];
    const dias = new Map<string, { clave: string; rotulo: string; citas: Cita[] }>();
    for (const c of [...v.citas].filter(x => x.estado === 'solicitada' || x.estado === 'confirmada').sort((a, b) => a.inicioUtc.localeCompare(b.inicioUtc))) {
      const clave = claveDeDia(c.inicioUtc);
      if (!dias.has(clave)) dias.set(clave, { clave, rotulo: rotuloDeJornada(c.inicioUtc), citas: [] });
      dias.get(clave)!.citas.push(c);
    }
    return [...dias.values()];
  });

  /** Las solicitudes que me piden y espero responder: lo más urgente de la agenda. */
  readonly porResponder = computed(() => {
    const v = this.vista();
    return v ? v.citas.filter(c => c.estado === 'solicitada' && c.anfitrionId === this.miId()).length : 0;
  });

  readonly siguiente = computed(() => {
    const v = this.vista();
    if (!v) return { titulo: '', detalle: '' };
    const mi = v.miParticipacion;
    if (!mi) {
      return v.puedoInscribirme
        ? { titulo: 'Para participar, inscríbete', detalle: 'Presenta tu proyecto en la pestaña Mi inscripción. Inscribirte no garantiza una cita: depende de quien confirme.' }
        : { titulo: 'La inscripción no está abierta', detalle: 'Cuando la organización la abra, podrás inscribirte desde aquí.' };
    }
    if (mi.estado === 'pendiente') return { titulo: 'Tu inscripción espera la decisión de la organización', detalle: 'Te avisaremos cuando la apruebe o la rechace. Mientras tanto no puedes pedir citas.' };
    if (mi.estado === 'lista_de_espera') return { titulo: `Estás en la lista de espera${v.posicionEnLaLista ? ` (lugar ${v.posicionEnLaLista})` : ''}`, detalle: 'Entrarás por orden de ingreso si se libera un lugar, y te avisaremos.' };
    if (mi.estado === 'rechazado' || mi.estado === 'retirado') return { titulo: mi.estado === 'rechazado' ? 'La organización no aceptó tu inscripción' : 'Ya no participas en esta agenda', detalle: mi.motivoDeLaDecision ?? 'Si crees que es un error, escribe a la organización del Mercado.' };
    if (this.porResponder()) return { titulo: `Tienes ${this.porResponder()} solicitud${this.porResponder() === 1 ? '' : 'es'} por responder`, detalle: 'Confírmalas o recházalas en Mis citas. Si no respondes a tiempo, vencen y la franja se libera.' };
    if (v.rotoYPidoCitas && v.puedoPedirCitas) return { titulo: 'Pide tus citas', detalle: `Elige a una persona en el Calendario o en Pedir citas. Puedes tener ${v.topeSolicitudesPendientes} solicitudes sin respuesta a la vez.` };
    if (v.agenda.estado === 'cerrada') {
      return v.citas.length
        ? { titulo: 'La agenda está cerrada', detalle: `Tuviste ${v.citas.length} ${v.citas.length === 1 ? 'cita' : 'citas'} en esta agenda. Las ves en Mis citas; ya no se pueden pedir ni cancelar.` }
        : { titulo: 'La agenda está cerrada', detalle: 'No tuviste citas en esta agenda.' };
    }
    if (v.citas.length) return { titulo: 'Tu participación está lista', detalle: `Tienes ${v.citas.length} ${v.citas.length === 1 ? 'cita' : 'citas'}: revisa su estado en Mi día y en Mis citas.` };
    return { titulo: 'Tu participación está lista', detalle: 'Aquí verás tus citas y su estado cuando haya.' };
  });

  /** El botón del paso siguiente: lleva a la sección donde se hace lo que toca. */
  readonly accionDelPaso = computed<{ texto: string; pestana: 'dia' | 'calendario' | 'pedir' | 'citas' | 'inscripcion' } | null>(() => {
    const v = this.vista();
    if (!v) return null;
    const mi = v.miParticipacion;
    if (!mi) return v.puedoInscribirme ? { texto: 'Inscribirme', pestana: 'inscripcion' } : null;
    if (mi.estado !== 'aprobado') return null;
    if (this.porResponder()) return { texto: 'Responder mis solicitudes', pestana: 'citas' };
    if (v.rotoYPidoCitas && v.puedoPedirCitas) return { texto: 'Pedir una cita', pestana: 'pedir' };
    return null;
  });

  readonly opcionesDeEstado = computed(() => {
    const citas = this.vista()?.citas ?? [];
    return [{ id: 'todas', etiqueta: 'Todas', conteo: citas.length },
      ...(['solicitada', 'confirmada', 'rechazada', 'cancelada', 'vencida'] as const)
        .filter(e => citas.some(c => c.estado === e)).map(e => ({ id: e, etiqueta: etiquetaDeEstadoDeCita(e), conteo: citas.filter(c => c.estado === e).length }))];
  });
  readonly citasVisibles = computed(() => (this.vista()?.citas ?? []).filter(c => this.filtroDeEstado() === 'todas' || c.estado === this.filtroDeEstado()));

  readonly opcionesDeAnfitrion = computed(() => [{ id: 'ninguno', etiqueta: 'Nadie: solo mis citas' },
    ...(this.vista()?.anfitriones ?? []).map(a => ({ id: String(a.anfitrion.id), etiqueta: a.anfitrion.nombre }))]);

  readonly anfitrionDeLaFranja = computed(() => {
    const v = this.vista(), f = this.franjaElegida();
    if (!v || f === null || this.anfitrionElegido() === 'ninguno') return null;
    return v.anfitriones.find(a => String(a.anfitrion.id) === this.anfitrionElegido() && a.franjasLibres.includes(f)) ?? null;
  });

  /** Quién está libre en la franja elegida: a quién puede pedirle cita quien rota. */
  readonly libresEnLaFranja = computed(() => {
    const v = this.vista(), f = this.franjaElegida();
    if (!v || f === null) return [];
    return v.anfitriones.filter(a => a.franjasLibres.includes(f));
  });

  /** Dónde está cada quien en esta modalidad: quién rota, quién tiene stand o mesa fija. */
  tuLugar(v: MiAgenda): string {
    const rol = v.miParticipacion?.rol;
    const rota = v.agenda.modo === 'compradores_rotan' ? 'comprador' : 'artista';
    if (!rol) return rota === 'comprador' ? 'Si te inscribes como artista, tendrás stand fijo y los compradores o bookers pasarán a verte.' : 'Si te inscribes como artista, pasarás a presentarte a la mesa de cada comprador o booker.';
    if (rol === rota) return rol === 'comprador' ? 'Eres comprador o booker: rotas por los stands de los artistas y pides las citas.' : 'Eres artista: rotas por las mesas de los compradores o bookers y pides las citas.';
    return rol === 'artista' ? 'Eres artista: tienes stand fijo; los compradores o bookers pasan a verte y tú confirmas sus solicitudes.' : 'Eres comprador o booker: tienes mesa fija; los artistas pasan a presentarse y tú confirmas sus solicitudes.';
  }

  portafolioDe(texto: string | null | undefined) { return enlacesDePortafolio(texto); }
  /** Dónde es la cita: la mesa o el stand de quien recibe. */
  dondeEs(c: Cita): string {
    const lugar = c.espacio ?? c.anfitrionEspacio;
    if (!lugar) return 'Lugar por confirmar';
    return /^(mesa|stand|sala)/i.test(lugar) ? lugar : `${vocabularioDeModo(this.vista()?.agenda.modo).sitioFijo === 'stand' ? 'Stand' : 'Mesa o sala'}: ${lugar}`;
  }
  /** Los enlaces de un portafolio (uno por línea): solo http o https, nunca otro esquema. */
  enlacesDe(texto: string | null | undefined): string[] {
    return (texto ?? '').split(/\r?\n/).map(x => x.trim()).filter(x => /^https?:\/\//i.test(x));
  }

  horaDe(c: Cita): string { return `${rotuloDeJornada(c.inicioUtc)}, ${horaDeLaFranja(c.inicioUtc)}`; }

  cupoDeCitasTexto(modo: string): string { return vocabularioDeModo(modo).ayudaDelCupo.replace(/\.$/, '').toLowerCase(); }

  motivoSinCupo(v: MiAgenda): string {
    if (v.agenda.citasMaximasPorVisitante && (v.misCitasVivas ?? 0) >= v.agenda.citasMaximasPorVisitante) {
      return `Ya tienes ${v.misCitasVivas} citas, el máximo de esta agenda. Cancela una para pedir otra.`;
    }
    if (v.solicitudesPendientes >= v.topeSolicitudesPendientes) return `Ya tienes ${v.solicitudesPendientes} solicitudes por responder, el máximo a la vez. Espera una respuesta o retira una.`;
    return 'Por ahora no puedes pedir citas en esta agenda.';
  }

  /** Para quien tiene stand o mesa fija: el sitio asignado y lo registrado en su horario, con quién y cuándo. */
  readonly cerrada = computed(() => this.vista()?.agenda.estado === 'cerrada');

  /** «Se te asignó la mesa 3» o, si el nombre ya empieza por el tipo («Mesa 1»), «Se te asignó: Mesa 1» (sin repetir «mesa»). */
  tituloDelSitio(sitio: { espacio?: string | null; tipo: string }): string {
    if (!sitio.espacio) return `Tu ${sitio.tipo} fijo`;
    const articulo = sitio.tipo === 'stand' ? 'el stand' : 'la mesa';
    return new RegExp(`^\\s*(${sitio.tipo}|mesa|stand)\\b`, 'i').test(sitio.espacio) ? `Se te asignó: ${sitio.espacio}` : `Se te asignó ${articulo} ${sitio.espacio}`;
  }

  readonly miSitio = computed(() => {
    const v = this.vista();
    if (!v?.miParticipacion || v.rotoYPidoCitas || v.miParticipacion.estado !== 'aprobado') return null;
    const vivas = v.citas.filter(c => c.estado === 'solicitada' || c.estado === 'confirmada');
    return { espacio: v.miParticipacion.espacio, tipo: vocabularioDeModo(v.agenda.modo).sitioFijo, citas: vivas };
  });

  readonly citasDeLaFranja = computed(() => (this.vista()?.citas ?? []).filter(c => c.franjaId === this.franjaElegida() && (c.estado === 'solicitada' || c.estado === 'confirmada')));
  readonly rotuloDeLaFranja = computed(() => {
    const f = this.vista()?.franjas.find(x => x.id === this.franjaElegida());
    return f ? `${rotuloDeJornada(f.inicioUtc)}, ${horaDeLaFranja(f.inicioUtc)}` : '';
  });

  /** Qué dice cada franja: mi cita (con quién y en qué estado) o, si miro a alguien, que está libre para pedirle. */
  readonly celdas = computed<CeldaDeFranja[]>(() => {
    const v = this.vista();
    if (!v) return [];
    const libres = new Set(v.anfitriones.find(a => String(a.anfitrion.id) === this.anfitrionElegido())?.franjasLibres ?? []);
    return v.franjas.map(f => {
      const mia = v.citas.filter(c => c.franjaId === f.id).sort((x, y) => Number(y.estado === 'confirmada') - Number(x.estado === 'confirmada'))[0];
      const sitio = `${rotuloDeJornada(f.inicioUtc)}, ${horaDeLaFranja(f.inicioUtc)}`;
      let estado: EstadoDeFranja = 'libre';
      let lineas: string[] = [];
      if (mia && (mia.estado === 'solicitada' || mia.estado === 'confirmada')) {
        estado = mia.estado;
        lineas = [this.conQuien(v, mia), mia.estado === 'solicitada' && this.soyAnfitrion(v, mia) ? 'Responde tú' : ''].filter(Boolean);
      } else if (libres.has(f.id)) {
        estado = 'disponible';
        lineas = ['Pedir cita'];
      } else if (mia) {
        estado = mia.estado; lineas = [this.conQuien(v, mia)];
      }
      return { franjaId: f.id, estado, lineas, accionable: true,
        etiqueta: `${sitio}. ${lineas.length ? lineas.join(', ') + '. ' : ''}${estado === 'libre' ? 'Libre' : estado === 'disponible' ? 'Disponible para pedir' : etiquetaDeEstadoDeCita(estado)}` };
    });
  });

  tonoAgenda(valor: string) { return tonoDeEstadoDeAgenda(valor); }
  tonoCita(valor: string) { return tonoDeEstadoDeCita(valor); }
  tonoParticipante(valor: string) { return tonoDeEstadoDeParticipante(valor); }
  imprimir(): void { window.print(); }
  pedirDesdeElCalendario(item: AnfitrionConDisponibilidad): void {
    const franja = this.vista()?.franjas.find(f => f.id === this.franjaElegida());
    if (franja) void this.pedir(item, franja);
  }

  readonly miId = computed(() => this.vista()?.miParticipacion?.id ?? 0);

  estadoAgenda(valor: string): string { return etiquetaDeEstadoDeAgenda(valor); }
  estadoCita(valor: string): string { return etiquetaDeEstadoDeCita(valor); }
  estadoParticipante(valor: string): string { return etiquetaDeEstadoDeParticipante(valor); }
  modo(valor: string): string { return etiquetaDeModo(valor); }
  tipoDeComprador(valor: string): string { return etiquetaDeTipoDeComprador(valor); }
  texto(evento: Event): string { return (evento.target as HTMLInputElement).value; }
  urlDelCalendario(agendaId: number): string { return this.servicio.urlDelCalendario(agendaId); }

  soyAnfitrion(_vista: MiAgenda, cita: Cita): boolean { return cita.anfitrionId === this.miId(); }
  conQuien(vista: MiAgenda, cita: Cita): string { return this.soyAnfitrion(vista, cita) ? cita.visitanteNombre : cita.anfitrionNombre; }

  /** Las franjas libres de un anfitrión, en orden, con su horario. */
  franjasLibres(vista: MiAgenda, item: AnfitrionConDisponibilidad): Franja[] {
    const libres = new Set(item.franjasLibres);
    return vista.franjas.filter(f => libres.has(f.id));
  }

  ngOnInit(): void {
    this.agendaId = Number(this.route.snapshot.paramMap.get('agendaId'));
    this.cargar();
    // Lo que ya tiene en su perfil público precarga su portafolio (una copia editable por Mercado).
    this.perfiles.mio().subscribe({
      next: perfil => { this.perfilPublico.set(perfil); this.precargarDesdeElPerfil(); },
      error: () => { /* sin perfil público no hay nada que precargar */ },
    });
  }

  readonly perfilPublico = signal<MiPerfilPublico | null>(null);

  /** Lo que el perfil público aporta al portafolio: presentación, agrupación (la primera organización) y hasta cinco enlaces. */
  private datosDelPerfil(): { nombre: string; entidad: string; presentacion: string; enlaces: string } | null {
    const p = this.perfilPublico();
    if (!p?.existe) return null;
    return {
      nombre: p.nombreVisible ?? '', entidad: p.organizaciones?.[0]?.nombre ?? '',
      presentacion: (p.biografiaLarga || p.biografiaCorta || '').trim(), enlaces: enlacesDeTexto((p.enlaces ?? []).join('\n')).join('\n'),
    };
  }

  /** Precarga SOLO lo que está vacío: nunca pisa lo que la persona ya escribió o guardó. */
  private precargarDesdeElPerfil(): void {
    const datos = this.datosDelPerfil(), v = this.vista();
    if (!datos || !v) return;
    const mi = v.miParticipacion;
    if (!mi) {
      if (!this.iNombre()) this.iNombre.set(datos.nombre);
      if (!this.iEntidad()) this.iEntidad.set(datos.entidad);
      if (!this.iPresentacion()) this.iPresentacion.set(datos.presentacion);
      if (!this.iEnlaces()) this.iEnlaces.set(datos.enlaces);
    } else if (mi.rol === 'artista') {
      if (!this.pEntidad() && !mi.entidad) this.pEntidad.set(datos.entidad);
      if (!this.pPresentacion()) this.pPresentacion.set(datos.presentacion);
      if (!this.pEnlaces()) this.pEnlaces.set(datos.enlaces);
    }
  }

  /** «Restaurar desde mi perfil público»: vuelve a copiar el perfil en el formulario (sin guardar, y sin tocar el perfil). */
  restaurarDesdeElPerfil(): void {
    const datos = this.datosDelPerfil();
    if (!datos) return;
    if (this.vista()?.miParticipacion) {
      this.pEntidad.set(datos.entidad); this.pPresentacion.set(datos.presentacion); this.pEnlaces.set(datos.enlaces);
      this.aviso.set('Copiamos tu perfil público aquí. Pulsa «Guardar mi portafolio» para conservarlo en esta agenda.');
    } else {
      this.iNombre.set(datos.nombre); this.iEntidad.set(datos.entidad); this.iPresentacion.set(datos.presentacion); this.iEnlaces.set(datos.enlaces);
      this.aviso.set('Copiamos tu perfil público aquí. Ajusta lo que quieras antes de inscribirte.');
    }
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.miAgenda(this.agendaId).subscribe({
      next: vista => { this.cargando.set(false); this.vista.set(vista); this.cargarPortafolio(vista); this.precargarDesdeElPerfil(); this.elegirPestanaInicial(vista); },
      error: (fallo: FalloDelServidor) => {
        this.cargando.set(false);
        this.error.set(fallo?.message ?? 'No fue posible consultar la agenda.');
      },
    });
  }

  /** La primera vez: sin participación, la inscripción; con solicitudes por responder, mis citas; si no, el calendario. */
  private elegirPestanaInicial(v: MiAgenda): void {
    if (this.pestanaDefinida) return;
    this.pestanaDefinida = true;
    if (!v.miParticipacion) this.pestana.set('inscripcion');
    else if (v.rotoYPidoCitas && v.puedoPedirCitas && !v.citas.length) this.pestana.set('pedir');
    else if (v.citas.some(c => c.estado === 'solicitada' && c.anfitrionId === v.miParticipacion!.id)) this.pestana.set('citas');
    else if (v.citas.some(c => c.estado === 'solicitada' || c.estado === 'confirmada')) this.pestana.set('dia');
  }

  private resolver(vista: MiAgenda | null, mensaje: string): void {
    this.guardando.set(false);
    this.error.set('');
    this.aviso.set(mensaje);
    if (vista) this.vista.set(vista); else this.cargar();
  }

  private fallar(fallo: FalloDelServidor, porOmision: string): void {
    this.guardando.set(false);
    this.aviso.set('');
    this.error.set(fallo?.message ?? porOmision);
    // La agenda pudo cambiar mientras tanto (una franja que se tomó): se vuelve a leer.
    this.cargar();
  }

  inscribirme(): void {
    this.guardando.set(true);
    this.servicio.inscribirme(this.agendaId, {
      nombre: this.iNombre() || null,
      entidad: this.iEntidad() || null,
      presentacion: this.iPresentacion() || null,
      enlaces: this.iEnlaces() || null,
      representaA: this.iRepresenta() || null,
      contactoCorreo: null,
      contactoTelefono: this.iTelefono() || null,
    }).subscribe({
      next: vista => { const pendiente = this.fotoPendiente(); this.pestana.set(vista.miParticipacion?.estado === 'aprobado' ? 'calendario' : 'inscripcion'); if (pendiente) { this.vista.set(vista); this.subirFoto(pendiente); } this.resolver(vista, vista.miParticipacion?.estado === 'lista_de_espera'
        ? 'Quedaste en la lista de espera. Te avisaremos si se libera un lugar.'
        : vista.miParticipacion?.estado === 'pendiente' ? 'Quedaste pendiente: la organización revisa tu inscripción y te avisará.' : 'Quedaste inscrito. Ya puedes pedir citas.'); },
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible inscribirte.'),
    });
  }

  async retirarme(): Promise<void> {
    const respuesta = await this.confirmaciones.pedir({
      titulo: 'Salir de la agenda de citas',
      detalle: 'Tus citas se cancelan y las personas con quienes las tenías reciben un aviso. Tu lugar pasa a la siguiente persona de la lista de espera.',
      accion: 'Salir de la agenda',
      tono: 'destructiva',
      pideMotivo: true,
      rotuloDelMotivo: 'Motivo (opcional)',
    });
    if (!respuesta) return;
    this.guardando.set(true);
    this.servicio.retirarme(this.agendaId, respuesta.motivo || null).subscribe({
      next: () => this.resolver(null, 'Saliste de la agenda.'),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible salir de la agenda.'),
    });
  }

  elegirFoto(archivo: File): void {
    if (!this.vista()?.miParticipacion) {
      // Todavía no participa: se ve y se sube cuando se inscriba.
      this.fotoPendiente.set(archivo);
      this.fotoPendienteUrl.set(URL.createObjectURL(archivo));
      return;
    }
    this.subirFoto(archivo);
  }

  guardarPortafolio(mi: Participante): void {
    this.errorDePortafolio.set('');
    this.guardando.set(true);
    this.servicio.guardarMiPortafolio(this.agendaId, {
      presentacion: this.pPresentacion().trim() || null, enlaces: this.pEnlaces().trim() || null,
      entidad: this.pEntidad().trim() || null, representaA: this.pRepresenta().trim() || null,
    }).subscribe({
      next: vista => { this.guardando.set(false); this.vista.set(vista); this.cargarPortafolio(vista); this.aviso.set(mi.rol === 'comprador' ? 'Guardamos tu perfil para esta agenda.' : 'Guardamos tu portafolio.'); },
      error: (fallo: FalloDelServidor) => { this.guardando.set(false); this.errorDePortafolio.set(fallo?.message ?? 'No fue posible guardar tu portafolio.'); },
    });
  }

  private cargarPortafolio(vista: MiAgenda): void {
    const mi = vista.miParticipacion;
    if (!mi) return;
    this.pEntidad.set(mi.entidad ?? ''); this.pRepresenta.set(mi.representaA ?? '');
    this.pPresentacion.set(mi.presentacion ?? ''); this.pEnlaces.set(mi.enlaces ?? '');
  }

  quitarFoto(): void {
    this.fotoPendiente.set(null);
    this.fotoPendienteUrl.set(null);
    if (!this.vista()?.miParticipacion) return;
    this.subiendoFoto.set(true);
    this.servicio.guardarMiFoto(this.agendaId, null).subscribe({
      next: vista => { this.subiendoFoto.set(false); this.vista.set(vista); },
      error: (fallo: FalloDelServidor) => { this.subiendoFoto.set(false); this.errorDeFoto.set(fallo?.message ?? 'No fue posible quitar tu foto.'); },
    });
  }

  private subirFoto(archivo: File): void {
    this.errorDeFoto.set('');
    this.subiendoFoto.set(true);
    const nombre = this.vista()?.miParticipacion?.nombre ?? this.iNombre() ?? 'participante';
    this.perfiles.subirFoto(archivo, `Foto de ${nombre}`).subscribe({
      next: subida => this.servicio.guardarMiFoto(this.agendaId, subida.id).subscribe({
        next: vista => { this.subiendoFoto.set(false); this.fotoPendiente.set(null); this.fotoPendienteUrl.set(null); this.vista.set(vista); this.aviso.set('Guardamos tu foto.'); },
        error: (fallo: FalloDelServidor) => { this.subiendoFoto.set(false); this.errorDeFoto.set(fallo?.message ?? 'No fue posible guardar tu foto.'); },
      }),
      error: (fallo: FalloDelServidor) => { this.subiendoFoto.set(false); this.errorDeFoto.set(fallo?.message ?? 'No fue posible subir la foto.'); },
    });
  }

  elegirAnfitrion(item: AnfitrionConDisponibilidad): void { this.anfitrionPedido.set(item); this.pasoDePedir.set(2); }
  elegirFranja(franja: Franja): void { this.franjaPedida.set(franja); this.pasoDePedir.set(3); }
  volverAlPaso(paso: number): void { this.pasoDePedir.set(paso); if (paso === 1) { this.anfitrionPedido.set(null); this.franjaPedida.set(null); } }

  /** Las franjas libres de la persona elegida, agrupadas por día, para pulsar la hora. */
  jornadasLibres(vista: MiAgenda, item: AnfitrionConDisponibilidad) {
    return agruparPorJornada(this.franjasLibres(vista, item));
  }

  enviarPedido(): void {
    const item = this.anfitrionPedido(), franja = this.franjaPedida();
    if (!item || !franja) return;
    this.guardando.set(true);
    this.servicio.pedirCita(this.agendaId, item.anfitrion.id, franja.id, this.mensajeDelPedido().trim() || null).subscribe({
      next: vista => {
        this.mensajeDelPedido.set(''); this.volverAlPaso(1);
        this.pestana.set('citas');
        this.resolver(vista, 'Pedimos la cita. Te avisaremos cuando respondan.');
      },
      error: (fallo: FalloDelServidor) => { this.volverAlPaso(2); this.fallar(fallo, 'No fue posible pedir la cita.'); },
    });
  }

  async pedir(item: AnfitrionConDisponibilidad, franja: Franja): Promise<void> {
    const respuesta = await this.confirmaciones.pedir({
      titulo: `Pedir cita a ${item.anfitrion.nombre}`,
      detalle: 'La franja queda reservada para ti mientras esperas la respuesta. Si no responden a tiempo, se libera sola.',
      accion: 'Pedir la cita',
      tono: 'confirmar',
      pideMotivo: true,
      rotuloDelMotivo: 'Mensaje (opcional)',
      ayudaDelMotivo: 'Cuéntale en una línea por qué quieres reunirte.',
    });
    if (!respuesta) return;
    this.guardando.set(true);
    this.servicio.pedirCita(this.agendaId, item.anfitrion.id, franja.id, respuesta.motivo || null).subscribe({
      next: vista => this.resolver(vista, 'Pedimos la cita. Te avisaremos cuando respondan.'),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible pedir la cita.'),
    });
  }

  confirmar(cita: Cita): void {
    this.guardando.set(true);
    this.servicio.confirmarCita(this.agendaId, cita.id).subscribe({
      next: vista => this.resolver(vista, 'Confirmaste la cita. Ya puedes ver el contacto de la otra persona.'),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible confirmar la cita.'),
    });
  }

  async rechazar(cita: Cita): Promise<void> {
    const respuesta = await this.confirmaciones.pedir({
      titulo: 'Rechazar la solicitud de cita',
      detalle: 'La otra persona recibe un aviso con tu motivo y la franja queda libre.',
      accion: 'Rechazar',
      tono: 'destructiva',
      pideMotivo: true,
      motivoObligatorio: true,
      rotuloDelMotivo: 'Motivo',
    });
    if (!respuesta) return;
    this.guardando.set(true);
    this.servicio.rechazarCita(this.agendaId, cita.id, respuesta.motivo).subscribe({
      next: vista => this.resolver(vista, 'Rechazaste la solicitud.'),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible rechazar la solicitud.'),
    });
  }

  async cancelar(cita: Cita): Promise<void> {
    const pendiente = cita.estado === 'solicitada';
    const respuesta = await this.confirmaciones.pedir({
      titulo: pendiente ? 'Retirar la solicitud' : 'Cancelar la cita',
      detalle: 'La franja queda libre y la otra persona recibe un aviso.',
      accion: pendiente ? 'Retirar la solicitud' : 'Cancelar la cita',
      tono: 'destructiva',
      pideMotivo: true,
      motivoObligatorio: !pendiente,
      rotuloDelMotivo: pendiente ? 'Motivo (opcional)' : 'Motivo',
    });
    if (!respuesta) return;
    this.guardando.set(true);
    this.servicio.cancelarCita(this.agendaId, cita.id, respuesta.motivo || null).subscribe({
      next: vista => this.resolver(vista, pendiente ? 'Retiraste la solicitud.' : 'Cancelaste la cita.'),
      error: (fallo: FalloDelServidor) => this.fallar(fallo, 'No fue posible cancelar la cita.'),
    });
  }
}
