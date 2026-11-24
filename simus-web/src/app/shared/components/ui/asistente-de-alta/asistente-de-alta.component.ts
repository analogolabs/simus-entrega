import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, model, output, signal } from '@angular/core';

import { DialogoDirective } from '../../../directives/dialogo.directive';
import { BotonComponent } from '../boton/boton.component';
import { EstadosDeLosPasos, IndicadorDePasosComponent, PasoDelIndicador } from '../indicador-de-pasos/indicador-de-pasos.component';
import { EnumerarPipe } from '../../../texto/enumerar';

/**
 * El armazón de un alta por pasos.
 *
 * <b>POR QUE EXISTE.</b> El alta de un Festival era un asistente de cinco pasos y la de un Mercado,
 * trece campos de una vez en un solo desplazamiento. Dos formas de registrar dos procesos que el
 * proyecto trata igual, y la dirección de producto ya lo había pedido dos veces: «la navegación,
 * edición, publicación, etc. de un mercado debe ser igual en cuanto sea posible a la de un
 * festival». Esto es lo común de las dos —velo, hoja, cabecera, indicador, error, pie— en un solo
 * sitio, para que la tercera no vuelva a escribirse distinta.
 *
 * <b>LOS CAMPOS NO ENTRAN AQUI.</b> Cada alta proyecta su paso con su propio `&#64;if (paso() === n)`:
 * son sus campos, sus catálogos y sus validaciones. Lo que se comparte es el recorrido, no el
 * contenido.
 *
 * <b>EL PASO ES UN MODELO DE DOS VIAS</b> porque el indicador deja volver a un paso ya recorrido y
 * la pantalla necesita saber en cuál está para pintar el suyo.
 */
@Component({
  selector: 'app-asistente-de-alta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EnumerarPipe, DialogoDirective, BotonComponent, IndicadorDePasosComponent],
  template: `
    <div class="dialogo-velo dialogo-velo--con-desplazamiento" role="dialog" aria-modal="true"
      [attr.aria-labelledby]="idDelTitulo" appDialogo (cerrar)="cancelar.emit()">
      <div class="dialogo dialogo--hoja asistente">
        <div class="asistente__cabecera">
          <div>
            @if (antetitulo()) { <p class="dialogo__contexto">{{ antetitulo() }}</p> }
            <h3 [id]="idDelTitulo" class="dialogo__titulo">{{ titulo() }}</h3>
            @if (proposito()) { <p class="asistente__proposito">{{ proposito() }}</p> }
          </div>
          <app-boton importancia="terciaria" tamano="menudo" etiqueta="Cerrar sin registrar"
            (accion)="cancelar.emit()">Cerrar</app-boton>
        </div>

        <app-indicador-de-pasos class="asistente__pasos" [pasos]="pasos()" [pasoActivo]="paso()" [estados]="estados()"
          [etiqueta]="'Pasos de ' + titulo().toLowerCase()" (irAlPaso)="irA($event)" />

        @if (error()) { <p class="asistente__error" role="alert">{{ error() }}</p> }

        <div class="asistente__cuerpo">
          <ng-content />
        </div>

        <!--
          LO QUE FALTA SE DICE EN EL PASO DE REVISION, no al pulsar el botón. Enterarse de que falta
          un campo cuando ya se creía terminado es lo que convierte un alta en una sucesión de
          intentos; y el botón apagado sin decir por qué es la otra mitad del mismo defecto.
        -->
        @if (enElUltimoPaso() && loQueFalta().length > 0) {
          <div class="asistente__falta" role="status" data-testid="asistente-falta">
            @if (faltasPorPaso().length) {
              <p class="asistente__falta-titulo">Falta antes de registrar:</p>
              <ul>
                @for (grupo of faltasPorPaso(); track grupo.paso) {
                  <li>{{ grupo.titulo }}: {{ grupo.faltas | enumerar }}. <button type="button" class="asistente__ir" (click)="irA(grupo.paso)">Ir a este paso</button></li>
                }
              </ul>
            } @else {
              <p>Falta {{ loQueFalta() | enumerar }}.</p>
            }
          </div>
        } @else if (!enElUltimoPaso() && avisados().has(paso()) && faltasDelPasoActual().length > 0) {
          <!-- LO QUE FALTA EN ESTE PASO, al intentar seguir: no bloquea, pero tampoco finge que está completo. -->
          <p class="asistente__falta" role="status" data-testid="asistente-falta-del-paso">En este paso falta {{ faltasDelPasoActual() | enumerar }}. Puedes seguir y completarlo antes de registrar.</p>
        }

        <div class="dialogo__acciones">
          <app-boton importancia="secundaria" (accion)="cancelar.emit()">Cancelar</app-boton>
          @if (paso() > 1) {
            <app-boton importancia="secundaria" (accion)="irA(paso() - 1)">Atrás</app-boton>
          }
          @if (!enElUltimoPaso()) {
            <app-boton importancia="principal" (accion)="siguiente()">Siguiente</app-boton>
          } @else {
            <app-boton importancia="principal" [ocupado]="guardando()" [deshabilitado]="loQueFalta().length > 0"
              [identificador]="identificador()" (accion)="registrar.emit()">{{ verbo() }}</app-boton>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .asistente { max-width: 44rem; }
    .asistente__cabecera { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .asistente__proposito { margin: .5rem 0 0; max-width: 34rem; color: var(--color-prosa); font-size: var(--text-dato); line-height: 1.55; }
    .asistente__pasos { display: block; margin-top: 1.25rem; }
    .asistente__error { margin: 1.25rem 0 0; border: 1px solid #fcd9a4; border-radius: .75rem; background: #fff8ec; padding: .75rem 1rem; color: #8a5300; font-size: var(--text-dato); }
    .asistente__cuerpo { display: grid; gap: 1rem; margin-top: 1.25rem; }
    .asistente__falta ul { margin: .35rem 0 0; padding-left: 1.1rem; }
    .asistente__falta-titulo { margin: 0; font-weight: 700; }
    .asistente__ir { border: 0; background: none; padding: 0; color: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
    .asistente__falta { margin: 1rem 0 0; border: 1px solid #fcd9a4; border-radius: .75rem; background: #fff8ec; padding: .75rem 1rem; color: #8a5300; font-size: var(--text-dato); }
  `],
})
export class AsistenteDeAltaComponent {
  /** La familia a la que pertenece lo que se registra: «Ecosistema musical». */
  readonly antetitulo = input('');

  /** El verbo y el registro: «Registrar Festival». */
  readonly titulo = input.required<string>();

  /** Para qué sirve este alta y qué la distingue de la del espacio externo. */
  readonly proposito = input('');

  readonly pasos = input.required<readonly PasoDelIndicador[]>();
  readonly paso = model(1);

  /** Lo que contestó el servidor al negarse. */
  readonly error = input<string | null>(null);

  /** Lo que todavía falta para poder registrar, nombrado campo a campo. */
  readonly loQueFalta = input<readonly string[]>([]);

  /**
   * Lo que falta, agrupado por el paso donde se pregunta. Con esto el indicador
   * distingue «visitado» de «completo», cada paso dice lo suyo al intentar seguir y la revisión
   * enlaza a cada paso con algo pendiente. Sin él, el armazón se comporta como antes.
   */
  readonly loQueFaltaPorPaso = input<Readonly<Record<number, readonly string[]>>>({});

  readonly guardando = input(false, { transform: booleanAttribute });

  /** El verbo del botón que crea: «Registrar Festival», «Registrar mercado». */
  readonly verbo = input('Registrar');

  /** El `data-testid` del botón que crea. */
  readonly identificador = input<string | null>(null);

  readonly cancelar = output<void>();
  readonly registrar = output<void>();

  /**
   * IDENTIFICADOR UNICO POR INSTANCIA: el alta de una organización se abre DESDE el alta de un
   * Festival, así que hay dos asistentes vivos a la vez y `aria-labelledby` apuntaría al de fuera.
   */
  private static contador = 0;
  readonly idDelTitulo = `asistente-titulo-${++AsistenteDeAltaComponent.contador}`;

  readonly enElUltimoPaso = computed(() => this.paso() >= this.pasos().length);

  /** Los pasos por los que ya se pasó. «Visitado» no basta para pintarlo completo. */
  private readonly visitados = signal<ReadonlySet<number>>(new Set([1]));
  /** Los pasos en los que se intentó seguir: ahí se dice lo que falta. */
  readonly avisados = signal<ReadonlySet<number>>(new Set());

  /** El estado de cada paso para el indicador; `null` si el alta no informa lo que falta por paso. */
  readonly estados = computed<EstadosDeLosPasos | null>(() => {
    const porPaso = this.loQueFaltaPorPaso();
    if (Object.keys(porPaso).length === 0) return null;
    const estados: Record<number, 'completo' | 'incompleto'> = {};
    for (const id of this.visitados()) {
      if (id === this.paso() || id >= this.pasos().length) continue;
      estados[id] = (porPaso[id]?.length ?? 0) > 0 ? 'incompleto' : 'completo';
    }
    return estados;
  });

  readonly faltasDelPasoActual = computed(() => this.loQueFaltaPorPaso()[this.paso()] ?? []);

  readonly faltasPorPaso = computed(() => {
    const porPaso = this.loQueFaltaPorPaso();
    return this.pasos()
      .filter(paso => (porPaso[paso.id]?.length ?? 0) > 0)
      .map(paso => ({ paso: paso.id, titulo: paso.titulo, faltas: porPaso[paso.id] }));
  });

  irA(destino: number): void {
    if (destino < 1 || destino > this.pasos().length) return;
    this.paso.set(destino);
    this.visitados.update(vistos => new Set([...vistos, destino]));
  }

  siguiente(): void {
    if (this.faltasDelPasoActual().length > 0) this.avisados.update(vistos => new Set([...vistos, this.paso()]));
    this.irA(this.paso() + 1);
  }
}
