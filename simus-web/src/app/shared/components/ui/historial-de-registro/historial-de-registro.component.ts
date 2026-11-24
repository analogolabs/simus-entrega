import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelLateralComponent } from '../panel-lateral/panel-lateral.component';
import { EntradaDeHistorialDeEstados, HistorialDeEstadosComponent } from '../historial-de-estados/historial-de-estados.component';
import { HistorialDeRegistroService, LineaDeHistorial } from '../../../../core/services/historial-de-registro.service';
import { HistorialDeCambiosService, ResultadoDeCambios } from '../../../../core/services/historial-de-cambios.service';
import { CambiosDeDatosComponent } from '../cambios-de-datos/cambios-de-datos.component';
import { ProcedenciaDeRegistro } from '../../../../core/services/procedencia';
import { FechaPipe } from '../../../utils/fecha.pipe';

/**
 * Quién ha tocado este registro, desde que nació.
 *
 * <b>ABRE LA PROCEDENCIA Y EL HISTORIAL JUNTOS PORQUE SON LA MISMA PREGUNTA.</b> Quien abre esto
 * quiere saber de dónde salió la ficha y qué le ha pasado desde entonces; enseñar el nacimiento en
 * un sitio y las actuaciones en otro obliga a cruzarlos a mano.
 *
 * <b>SE PIDE AL ABRIR, NO AL PINTAR LA TABLA.</b> Una consulta de auditoría por fila convertiría
 * un listado de veinte en veinte viajes a la base para un dato que casi nadie mira.
 */
@Component({
  selector: 'app-historial-de-registro',
  standalone: true,
  imports: [FechaPipe, CommonModule, PanelLateralComponent, HistorialDeEstadosComponent, CambiosDeDatosComponent],
  template: `
    <!--
      EL CAJON DE TODA LA CONSOLA, y no uno compuesto a mano. Este era un cajón propio con su velo y
      su botón, y NO CERRABA CON ESCAPE —medido al verificar Mercados,
      mientras la previsualización, a su lado, sí cerraba—. Dos ventanas hermanas con dos
      comportamientos. Con la pieza compartida hereda el cierre, el foco y el fondo quieto.
    -->
    <app-panel-lateral [titulo]="titulo" [contexto]="procedencia === undefined ? 'Historial' : 'Historial y procedencia'"
      idDelTitulo="historial-de-registro-titulo" (cerrar)="cerrar.emit()">

        <!--
          TRES ESTADOS, NO DOS. Que quien abre el panel no pase la procedencia NO significa que el
          registro no la tenga: significa que esta pantalla no la tiene a mano. Afirmar «no consta
          quién lo incorporó» en ese caso es decir algo falso sobre el registro —y se notaba, porque
          el mismo Festival decía una cosa abierto desde su ficha y otra desde la tabla—. Por eso
          «undefined» (no se preguntó) y «null» (se preguntó y no hay) se tratan distinto.
        -->
        @if (procedencia !== undefined) {
        <section>
          <h4 class="titulo-de-apartado">De dónde vino</h4>
          @if (procedencia; as p) {
            <dl class="mt-3 grid gap-2 text-xs">
              <div class="flex gap-2">
                <dt class="w-28 shrink-0 text-rotulo">Procedencia</dt>
                <dd class="flex-1 text-valor">{{ p.organizacionProcedenciaNombre || p.contextoEtiqueta }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="w-28 shrink-0 text-rotulo">Contexto</dt>
                <dd class="flex-1 text-valor">{{ p.contextoEtiqueta }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="w-28 shrink-0 text-rotulo">Creado por</dt>
                <dd class="flex-1 text-valor">{{ p.usuarioCreadorNombre || 'No consta' }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="w-28 shrink-0 text-rotulo">Fecha</dt>
                <dd class="flex-1 tabular-nums text-valor">{{ p.fechaRegistro | fecha: 'fecha-hora' }}</dd>
              </div>
            </dl>
          } @else {
            <!-- DECIRLO ES MÁS HONESTO QUE DEJAR EL HUECO: los registros anteriores a la tabla de
                 procedencia no la tienen, y eso no es un fallo de carga. -->
            <p class="mt-2 text-xs text-rotulo">
              Este registro es anterior al seguimiento de procedencia, así que no consta quién lo
              incorporó. Su historial de actuaciones sí está completo.
            </p>
          }
        </section>
        }

        <!--
          QUÉ CAMBIÓ, que no es lo mismo que qué ha pasado. «Qué ha pasado» son actuaciones —quién pulsó
          qué y cuándo—; esto son los CAMBIOS DE DATOS campo por campo: qué valía, qué vale, quién lo cambió
          y por qué. Es el único sistema de historia de datos (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md): sustituye a la lista de «versiones»
          del Festival, que enseñaba fotografías enteras sin decir qué las diferenciaba.

          ES OPCIONAL: solo lo pinta la pantalla cuyo módulo escribe en el registro de cambios.
        -->
        @if (pideCambios()) {
        <section class="mt-5" aria-labelledby="historial-cambios-titulo">
          <h4 id="historial-cambios-titulo" class="titulo-de-apartado">Qué cambió</h4>
          <app-cambios-de-datos [resultado]="cambios()" />
        </section>
        }

        <!--
          LOS ESTADOS Y SUS MOTIVOS (#124). La bitácora de abajo dice quién tocó qué; esto dice de qué
          estado a cuál pasó el registro y por qué, que es lo que se pregunta al devolver o rechazar.
          Opcional: solo lo pintan las pantallas cuyo módulo escribe este historial.
        -->
        @if (estados !== undefined) {
        <section class="mt-5" aria-labelledby="historial-estados-titulo">
          <h4 id="historial-estados-titulo" class="titulo-de-apartado">Estados y motivos</h4>
          <div class="mt-3"><app-historial-de-estados [entradas]="estados" [cargando]="cargandoEstados" /></div>
        </section>
        }

        <section class="mt-5">
          <h4 class="titulo-de-apartado">Qué ha pasado</h4>
          @if (cargando()) {
            <p class="mt-3 text-xs text-rotulo">Consultando el historial…</p>
          } @else if (fallo()) {
            <!-- NO SE PUDO LEER NO ES LO MISMO QUE NO HAY NADA. Decir «sin actuaciones» cuando la
                 consulta falló es afirmar algo falso sobre el registro. -->
            <p role="alert" class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              No fue posible consultar el historial ahora mismo. Esto no significa que el registro
              no tenga actuaciones: vuelve a abrirlo en un momento.
            </p>
          } @else if (lineas().length === 0) {
            <p class="mt-3 text-xs text-rotulo">No hay actuaciones registradas todavía.</p>
          } @else {
            <ol class="mt-3 space-y-3">
              @for (linea of lineas(); track linea.id) {
                <li class="border-t border-filete pt-2">
                  <p class="text-xs font-bold text-valor">{{ linea.accionEtiqueta || linea.accion }}</p>
                  <p class="text-dato text-rotulo">
                    {{ linea.autor?.nombre || 'Sin autor registrado' }} ·
                    <span class="tabular-nums">{{ linea.fecha | fecha: 'fecha-hora' }}</span>
                  </p>
                </li>
              }
            </ol>
          }
        </section>
    </app-panel-lateral>
  `,
})
export class HistorialDeRegistroComponent {
  private readonly api = inject(HistorialDeRegistroService);

  @Input({ required: true }) titulo = '';
  /**
   * De dónde vino el registro, si quien abre el panel lo tiene a mano.
   *
   * <b>`undefined` Y `null` NO SON LO MISMO.</b> `null` es «se consultó y este registro no tiene
   * procedencia» —pasa con los anteriores al seguimiento— y se dice en pantalla. Sin pasar nada,
   * el apartado no se pinta: la pantalla que abre el panel no tenía el dato, y eso no es un
   * hecho sobre el registro.
   */
  @Input() procedencia: ProcedenciaDeRegistro | null | undefined = undefined;

  /**
   * Los cambios de datos de este registro, si el módulo los escribe: el módulo (de <c>Modulos</c>) y
   * el registro juntos, por la misma razón que <c>registro</c>. Sin él no se pinta el apartado «Qué
   * cambió». Se lee con la cuenta de la consola: los datos personales solo llegan con el módulo de
   * Auditoría, y leerlos queda registrado.
   */
  @Input() set cambiosDe(valor: { moduloId: string; registroId: string | number } | undefined) {
    this.cambios.set(undefined);
    this.pideCambios.set(valor !== undefined);
    if (valor !== undefined) void this.leerCambios(valor.moduloId, valor.registroId);
  }
  /**
   * El historial de estados, si la pantalla lo pide. `undefined` no pinta el apartado;
   * `null` es que la consulta falló.
   */
  @Input() estados: EntradaDeHistorialDeEstados[] | null | undefined = undefined;
  @Input() cargandoEstados = false;
  @Output() cerrar = new EventEmitter<void>();

  private readonly apiCambios = inject(HistorialDeCambiosService);

  /** Si la pantalla pide el apartado «Qué cambió». */
  readonly pideCambios = signal(false);

  /** `undefined` mientras se consulta; el resultado dice si la consulta falló. */
  readonly cambios = signal<ResultadoDeCambios | undefined>(undefined);

  readonly lineas = signal<LineaDeHistorial[]>([]);
  readonly cargando = signal(true);
  /** Si la última lectura no llegó a responder. Se dice en pantalla en vez de fingir que no hay. */
  readonly fallo = signal(false);

  /** La tabla y el registro se reciben juntos: por separado, el historial cruzaría módulos. */
  @Input({ required: true }) set registro(valor: { tabla: string; id: string | number }) {
    void this.cargar(valor.tabla, valor.id);
  }

  private async leerCambios(moduloId: string, registroId: string | number): Promise<void> {
    this.cambios.set(await this.apiCambios.leerDeLaConsola(moduloId, registroId));
  }

  private async cargar(tabla: string, id: string | number): Promise<void> {
    this.cargando.set(true);
    const resultado = await this.api.leer(tabla, id);
    this.lineas.set(resultado.lineas);
    this.fallo.set(resultado.fallo);
    this.cargando.set(false);
  }
}
