import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AprobacionDeArtistas, ModoDeAgenda, vocabularioDeModo } from '../../../core/services/agendamiento-de-citas.service';
import { IlustracionDeAgendaComponent } from '../../../shared/components/agenda-de-citas/ilustracion-de-agenda.component';
import { VistaPreviaDeAgendaComponent } from '../../../shared/components/agenda-de-citas/vista-previa-de-agenda.component';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { CampoDeTextoComponent } from '../../../shared/components/ui/campo-de-texto/campo-de-texto.component';
import { SelectorNumericoComponent } from '../../../shared/components/ui/selector-numerico/selector-numerico.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../../shared/components/ui/selector-segmentado/selector-segmentado.component';

const PASOS = [
  { id: 1, titulo: 'La rueda de negocios', pregunta: '¿Cómo es la rueda de negocios?' },
  { id: 2, titulo: 'Participación', pregunta: '¿Cómo se confirma la participación?' },
  { id: 3, titulo: 'Cómo se piden las citas', pregunta: '¿Cómo se piden las citas?' },
  { id: 4, titulo: 'Nombre e inscripción', pregunta: '¿Cómo se llama y cuándo se inscriben?' },
] as const;

const aOpciones = (valores: readonly number[], rotulo: (n: number) => string): OpcionSegmentada[] =>
  valores.map(n => ({ id: String(n), etiqueta: rotulo(n) }));

/**
 * El asistente de configuración de la agenda de citas (docs/referencia/26-agenda-de-citas-y-mercados.md §26.15): cuatro pasos, cada decisión con su dibujo y sus
 * opciones a la vista, y a la derecha la VISTA PREVIA EN VIVO de lo que verá quien quiera inscribirse.
 *
 * <b>SIN CÁPSULAS</b> (punto 54 del mapa de comentarios): los pasos son pestañas con subrayado, las duraciones y topes son
 * el selector segmentado común y los cupos, el selector numérico común. Las dos decisiones grandes (la modalidad y cómo se
 * confirma la participación) siguen siendo tarjetas con su dibujo, de borde recto como los demás controles.
 *
 * <b>VOCABULARIO DEL SECTOR.</b> La modalidad se dice como en los mercados de música: quien rota (comprador o booker, o
 * artista) frente a quien tiene stand o mesa fija; el rótulo del cupo de citas cambia con la modalidad
 * (`vocabularioDeModo`). El plazo de respuesta de una solicitud se condiciona a cómo se confirma la participación: con
 * aprobación de la organización queda recogido bajo «Ajustar el plazo»; por orden de inscripción es una decisión a la vista.
 *
 * Los valores son `model()`: quien lo usa los enlaza con sus señales (`[(duracion)]="cfgDuracion"`) y guarda.
 */
@Component({
  selector: 'app-configuracion-de-agenda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BotonNativoDirective, CampoDeTextoComponent, IlustracionDeAgendaComponent, SelectorNumericoComponent, SelectorSegmentadoComponent, VistaPreviaDeAgendaComponent],
  styles: [`
    :host { display: block; }
    .pestanas { display: flex; flex-wrap: wrap; gap: 0 1.5rem; border-bottom: 1px solid var(--color-filete); }
    .etiqueta-frecuencia { align-self: flex-start; padding: .1rem .55rem; border-radius: 9999px; background: var(--color-morado-50); color: var(--color-morado); font-size: var(--text-dato); font-weight: 700; }
    .pestana { display: inline-flex; align-items: baseline; gap: .5rem; min-height: var(--spacing-control-comodo); padding: 0 .1rem; background: none; border: 0; border-bottom: 3px solid transparent; margin-bottom: -1px; font: inherit; font-size: var(--text-cuerpo); color: var(--color-rotulo); cursor: pointer; }
    .pestana:hover { color: var(--color-morado); }
    .pestana[aria-current='step'] { color: var(--color-morado); font-weight: 700; border-bottom-color: var(--color-morado); }
    .pestana__numero { font-variant-numeric: tabular-nums; font-weight: 700; }
    .pestana.hecho .pestana__numero::after { content: ' ✓'; color: #2e9d6a; }
    .pestana:focus-visible, .opcion:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: 2px; }
    .opcion { display: flex; flex-direction: column; align-items: center; gap: .6rem; text-align: center; padding: 1rem; border: 2px solid var(--color-filete); border-radius: var(--radius-control); background: #fff; font: inherit; cursor: pointer; }
    .opcion:hover:not(:disabled) { border-color: var(--color-morado); }
    .opcion[aria-checked='true'] { border-color: var(--color-morado); background: #f6f3fb; }
    .opcion:disabled { cursor: not-allowed; opacity: .6; }
    .campo-nativo { box-sizing: border-box; height: var(--spacing-control); width: 100%; border: 1px solid var(--color-borde-campo); border-radius: var(--radius-control); background: #fff; padding: 0 .75rem; font: inherit; font-size: var(--text-cuerpo); color: var(--color-valor); }
    .campo-nativo:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); }
    .bloque { display: block; width: 100%; }
    summary { cursor: pointer; color: var(--color-morado); font-weight: 700; }
  `],
  template: `
    <div class="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]" data-testid="asistente-de-configuracion">
      <div class="space-y-6">
        <nav aria-label="Pasos de la configuración" class="pestanas" data-testid="pasos-de-la-configuracion">
          @for (p of pasos; track p.id) {
            <button type="button" class="pestana" [class.hecho]="p.id < paso()" [attr.aria-current]="p.id === paso() ? 'step' : null"
                    [attr.data-paso-boton]="p.id" (click)="paso.set(p.id)">
              <span class="pestana__numero">{{ p.id }}</span><span>{{ p.titulo }}</span>
            </button>
          }
        </nav>

        <h3 class="text-morado" aria-live="polite">{{ pasoActual().pregunta }}</h3>

        <!-- 1 · La rueda de negocios -->
        <fieldset [hidden]="paso() !== 1" [disabled]="bloqueada()" class="space-y-6" data-paso="1">
          <legend class="sr-only">Cómo es la rueda de negocios</legend>
          <div role="radiogroup" aria-label="Modalidad de la agenda" class="grid gap-4 sm:grid-cols-2">
            <button type="button" role="radio" class="opcion" [attr.aria-checked]="modo() === 'compradores_fijos'" data-testid="modo-compradores_fijos" (click)="modo.set('compradores_fijos')">
              <span class="etiqueta-frecuencia" data-testid="frecuencia">La más común</span>
              <app-ilustracion-de-agenda dibujo="fijos" [ancho]="13" />
              <span class="text-lectura font-semibold text-valor">Los artistas rotan; los compradores tienen mesa fija</span>
              <span class="text-cuerpo text-prosa">Cada comprador o booker atiende en su mesa y los artistas pasan a presentarse. Cada artista va en su horario. El artista pide la cita y el comprador la confirma.</span>
            </button>
            <button type="button" role="radio" class="opcion" [attr.aria-checked]="modo() === 'compradores_rotan'" data-testid="modo-compradores_rotan" (click)="modo.set('compradores_rotan')">
              <span class="etiqueta-frecuencia" data-testid="frecuencia">Menos frecuente</span>
              <app-ilustracion-de-agenda dibujo="rotan" [ancho]="13" />
              <span class="text-lectura font-semibold text-valor">Los compradores rotan; los artistas tienen stand fijo</span>
              <span class="text-cuerpo text-prosa">Cada artista recibe en su stand y los compradores o bookers pasan a verlos. El comprador pide la cita y el artista la confirma.</span>
            </button>
          </div>
          <div [class.opacity-60]="bloqueada() || hayFranjas()" [class.pointer-events-none]="bloqueada() || hayFranjas()" [attr.aria-disabled]="bloqueada() || hayFranjas() ? true : null">
            <p class="mb-1 text-dato font-bold text-valor">Duración de cada cita</p>
            <app-selector-segmentado etiquetaDelGrupo="Duración de cada cita" [opciones]="opcionesDeDuracion" [elegida]="'' + duracion()" (elegir)="cambiarDuracion(+$event)" data-testid="duracion" />
          </div>
          <div [class.opacity-60]="bloqueada() || hayFranjas()" [class.pointer-events-none]="bloqueada() || hayFranjas()" [attr.aria-disabled]="bloqueada() || hayFranjas() ? true : null">
            <p class="mb-1 text-dato font-bold text-valor">Pausa entre citas</p>
            <app-selector-segmentado etiquetaDelGrupo="Pausa entre citas" [opciones]="opcionesDePausa" [elegida]="'' + pausa()" (elegir)="cambiarPausa(+$event)" data-testid="pausa" />
          </div>
          @if (hayFranjas()) { <p class="text-cuerpo text-prosa">La duración y la pausa ya no se pueden cambiar: hay franjas generadas con ellas.</p> }
        </fieldset>

        <!-- 2 · Cómo se confirma la participación -->
        <fieldset [hidden]="paso() !== 2" [disabled]="bloqueada()" class="space-y-6" data-paso="2">
          <legend class="sr-only">Cómo se confirma la participación</legend>
          <div role="radiogroup" aria-label="Cómo se confirma la participación" class="grid gap-4 sm:grid-cols-2">
            <button type="button" role="radio" class="opcion" [attr.aria-checked]="aprobacion() === 'automatica'" data-testid="aprobacion-automatica" (click)="aprobacion.set('automatica')">
              <app-ilustracion-de-agenda dibujo="abierta" [ancho]="9" />
              <span class="text-lectura font-semibold text-valor">Por orden de inscripción</span>
              <span class="text-cuerpo text-prosa">Cada artista entra al inscribirse, hasta completar el cupo. Los siguientes quedan en la lista de espera.</span>
            </button>
            <button type="button" role="radio" class="opcion" [attr.aria-checked]="aprobacion() === 'aceptacion'" data-testid="aprobacion-aceptacion" (click)="aprobacion.set('aceptacion')">
              <app-ilustracion-de-agenda dibujo="aprobacion" [ancho]="9" />
              <span class="text-lectura font-semibold text-valor">Con aprobación de la organización</span>
              <span class="text-cuerpo text-prosa">Cada inscripción queda pendiente hasta que la organización la apruebe o la rechace. Al aprobar se aplica el cupo.</span>
            </button>
          </div>
          <app-selector-numerico etiqueta="Máximo de artistas admitidos" [(valor)]="cupo" [permiteVacio]="true" [maximo]="10000" [deshabilitado]="bloqueada()" data-testid="cupo-de-artistas"
            ayuda="Cuántos artistas pueden quedar admitidos en esta agenda; los demás esperan en la lista de espera. Vacío es sin límite." />
        </fieldset>

        <!-- 3 · Cómo se piden las citas -->
        <fieldset [hidden]="paso() !== 3" [disabled]="bloqueada()" class="space-y-6" data-paso="3">
          <legend class="sr-only">Cómo se piden las citas</legend>
          <p class="max-w-3xl text-cuerpo text-prosa" data-testid="quien-pide">
            @if (modo() === 'compradores_fijos') {
              Los artistas piden la cita al comprador o booker que les interesa y este la confirma o la rechaza.
            } @else {
              Los compradores o bookers piden la cita al artista que les interesa y este la confirma o la rechaza.
            }
            Nadie puede tener dos citas en el mismo horario: la franja ocupada se bloquea sola.
          </p>
          <app-selector-numerico [etiqueta]="voc().cupoDeCitas" [(valor)]="cupoDeCitas" [permiteVacio]="true" [maximo]="200" [deshabilitado]="bloqueada()" data-testid="cupo-de-citas"
            [ayuda]="voc().ayudaDelCupo + ' Vacío es sin límite.'" />
          <div>
            <p class="text-dato font-bold text-valor">Solicitudes por responder que puede tener cada persona a la vez</p>
            <p class="mb-2 text-cuerpo text-prosa">Evita que una persona reserve todas las franjas sin que la otra responda.</p>
            <app-selector-segmentado etiquetaDelGrupo="Solicitudes por responder a la vez" [opciones]="opcionesDeTope" [elegida]="'' + tope()" (elegir)="tope.set(+$event)" data-testid="tope" />
          </div>
          @if (aprobacion() === 'automatica') {
            <div data-testid="plazo-de-respuesta">
              <p class="text-dato font-bold text-valor">Plazo para responder una solicitud</p>
              <p class="mb-2 text-cuerpo text-prosa">Como nadie filtra a los participantes, una solicitud sin respuesta se libera pasado este plazo para que no bloquee la franja.</p>
              <app-selector-segmentado etiquetaDelGrupo="Plazo para responder" [opciones]="opcionesDePlazo" [elegida]="'' + vence()" (elegir)="vence.set(+$event)" data-testid="plazo" />
            </div>
          } @else {
            <details data-testid="plazo-de-respuesta">
              <summary>Ajustar el plazo de respuesta ({{ vence() }} horas)</summary>
              <p class="my-2 text-cuerpo text-prosa">La organización ya aprueba a los participantes, así que basta el plazo por omisión. Si lo cambias: una solicitud sin respuesta libera la franja pasado este plazo.</p>
              <app-selector-segmentado etiquetaDelGrupo="Plazo para responder" [opciones]="opcionesDePlazo" [elegida]="'' + vence()" (elegir)="vence.set(+$event)" data-testid="plazo" />
            </details>
          }
        </fieldset>

        <!-- 4 · Nombre e inscripción -->
        <fieldset [hidden]="paso() !== 4" [disabled]="bloqueada()" class="space-y-6" data-paso="4">
          <legend class="sr-only">Nombre e inscripción</legend>
          <div class="simus-form-grid">
            <app-campo-de-texto etiqueta="Nombre de la agenda" identificador="cfg-nombre" tamano="comodo" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)" [maximo]="120"
              [ayuda]="'Por omisión, el nombre del Mercado: «' + mercado() + '».'" [marcador]="mercado()" />
            <app-campo-de-texto etiqueta="Subtítulo" identificador="cfg-subtitulo" tamano="comodo" [ngModel]="subtitulo()" (ngModelChange)="subtitulo.set($event)" [maximo]="120"
              ayuda="La edición o el nombre específico: «Edición 2026», «Ronda de bookers», «Sala de cámara»." marcador="Edición 2026" />
          </div>
          <div class="simus-form-grid">
            <label class="bloque text-cuerpo"><span class="mb-1 block font-semibold text-valor">Abre la inscripción</span>
              <input id="cfg-apertura" type="datetime-local" class="campo-nativo" [value]="apertura()" (input)="apertura.set(texto($event))" /></label>
            <label class="bloque text-cuerpo"><span class="mb-1 block font-semibold text-valor">Cierra la inscripción</span>
              <input id="cfg-cierre" type="datetime-local" class="campo-nativo" [value]="cierre()" (input)="cierre.set(texto($event))" /></label>
          </div>
          @if (fechasInvertidas()) { <p role="alert" class="text-cuerpo text-red-800" data-testid="error-de-fechas">El cierre de la inscripción debe ser posterior a su apertura.</p> }
          <p class="text-cuerpo text-prosa">Sin fechas, la inscripción se abre y se cierra a mano desde la agenda.</p>
        </fieldset>

        <div class="flex flex-wrap items-center gap-3">
          <button type="button" appBoton="secundaria" data-testid="paso-anterior" [disabled]="paso() === 1" (click)="paso.set(paso() - 1)">Anterior</button>
          @if (paso() < 4) { <button type="button" appBoton="principal" data-testid="paso-siguiente" (click)="paso.set(paso() + 1)">Siguiente</button> }
          @if (paso() === 4 || permiteGuardarYa()) {
            <button type="button" data-testid="guardar-configuracion" [appBoton]="paso() === 4 ? 'principal' : 'secundaria'"
                    [disabled]="guardando() || bloqueada() || fechasInvertidas()" (click)="guardar.emit()">{{ textoDelBoton() }}</button>
          }
        </div>
      </div>

      <aside aria-labelledby="previa-titulo" class="lg:sticky lg:top-4 lg:self-start" data-testid="vista-previa">
        <h4 id="previa-titulo" class="mb-2 text-cuerpo font-semibold text-valor">Así lo verán los artistas</h4>
        <app-vista-previa-de-agenda [mercado]="mercado()" [nombre]="nombre()" [subtitulo]="subtitulo()" [modo]="modo()" [aprobacion]="aprobacion()"
          [duracion]="duracion()" [pausa]="pausa()" [tope]="tope()" [vence]="vence()" [cupoDeCitas]="cupoDeCitas()" [cupoDeArtistas]="cupo()" />
      </aside>
    </div>
  `,
})
export class ConfiguracionDeAgendaComponent {
  protected readonly pasos = PASOS;
  protected readonly opcionesDeDuracion = aOpciones([10, 15, 20, 30, 45, 60], n => `${n} min`);
  protected readonly opcionesDePausa = aOpciones([0, 5, 10, 15], n => n === 0 ? 'Sin pausa' : `${n} min`);
  protected readonly opcionesDeTope = aOpciones([3, 5, 10, 20], n => String(n));
  protected readonly opcionesDePlazo: OpcionSegmentada[] = [
    { id: '24', etiqueta: '24 horas' }, { id: '48', etiqueta: '48 horas' }, { id: '72', etiqueta: '72 horas' }, { id: '168', etiqueta: '7 días' },
  ];

  readonly mercado = input('Mercado');
  readonly bloqueada = input(false);
  readonly hayFranjas = input(false);
  readonly guardando = input(false);
  readonly existe = input(false);

  readonly paso = model(1);
  readonly nombre = model('');
  readonly subtitulo = model('');
  readonly modo = model<ModoDeAgenda>('compradores_fijos');
  readonly aprobacion = model<AprobacionDeArtistas>('automatica');
  readonly duracion = model(20);
  readonly pausa = model(5);
  /** Máximo de artistas admitidos (la lista de espera recibe a los demás); `null` es sin límite. */
  readonly cupo = model<number | null>(null);
  /** Citas que puede tener quien rota: artistas que visita cada comprador, o compradores que visita cada artista; `null` es sin límite. */
  readonly cupoDeCitas = model<number | null>(null);
  readonly tope = model(5);
  readonly vence = model(72);
  readonly apertura = model('');
  readonly cierre = model('');
  readonly guardar = output<void>();

  protected readonly pasoActual = computed(() => PASOS[this.paso() - 1]);
  protected readonly voc = computed(() => vocabularioDeModo(this.modo()));
  protected readonly permiteGuardarYa = computed(() => this.existe());
  protected readonly fechasInvertidas = computed(() => !!this.apertura() && !!this.cierre() && this.cierre() <= this.apertura());
  protected readonly textoDelBoton = computed(() => this.existe() ? 'Guardar la configuración' : 'Habilitar la agenda');
  protected cambiarDuracion(minutos: number): void { if (!this.bloqueada() && !this.hayFranjas()) this.duracion.set(minutos); }
  protected cambiarPausa(minutos: number): void { if (!this.bloqueada() && !this.hayFranjas()) this.pausa.set(minutos); }
  protected texto(e: Event): string { return (e.target as HTMLInputElement).value; }
}
