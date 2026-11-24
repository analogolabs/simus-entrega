import { TextoWebPipe } from '../../texto/texto-web.pipe';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, Injector, Input, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { LucideCircleCheck, LucideMessageCircleQuestion, LucideX } from '@lucide/angular';
import { ConsultaGuiadaComponent } from './consulta-guiada.component';
import { ConsultaGuiadaPublicaComponent } from './consulta-guiada-publica.component';
import { DialogoDirective } from '../../directives/dialogo.directive';
import { ContextoDeConsulta } from './consulta-guiada.service';
import { PreguntaPublicaService } from '../../../core/services/pregunta-publica.service';

import { BotonNativoDirective } from '../ui/boton/boton.component';
/**
 * El Asistente a un clic, desde cualquier pantalla del espacio de trabajo.
 *
 * <b>ES LO QUE LA VUELVE TRANSVERSAL DE VERDAD.</b> Tenerla en una sección la deja donde nadie la
 * busca: quien está revisando organizaciones y se pregunta «¿cuántas hay sin correo confirmado?»
 * no abandona lo que está haciendo para ir a «Análisis y consultas», reformular la pregunta y
 * volver. Con el cajón, pregunta donde está, y el contexto de esa pantalla viaja con la pregunta.
 *
 * <b>NO SE MONTA HASTA QUE SE ABRE.</b> El componente de dentro pide el catálogo al servidor en su
 * arranque; montarlo con la pantalla haría una petición en cada carga de la consola para un panel
 * que casi nadie abre en esa visita.
 *
 * <b>ES UN CAJON Y NO UN MODAL DE PANTALLA COMPLETA</b> a propósito: la respuesta casi siempre se
 * contrasta con lo que hay detrás -«dice 3 pendientes, ¿cuáles son estos?»-, y taparlo obligaría a
 * memorizar la cifra para cerrarla y volver a mirar.
 */
@Component({
  selector: 'app-cajon-de-consulta-guiada',
  standalone: true,
  imports: [TextoWebPipe, BotonNativoDirective, CommonModule, ConsultaGuiadaComponent, ConsultaGuiadaPublicaComponent, DialogoDirective, LucideCircleCheck, LucideMessageCircleQuestion, LucideX],
  templateUrl: './cajon-de-consulta-guiada.component.html',
})
export class CajonDeConsultaGuiadaComponent {

  private readonly preguntas = inject(PreguntaPublicaService);

  /** La ruta base, que decide el ámbito. Ver {@link ConsultaGuiadaComponent}. */
  @Input() base = '';

  /** Desde dónde se pregunta. La pantalla que lo monta lo mantiene al día. */
  @Input() contexto: ContextoDeConsulta | undefined;

  @Input() saludo = 'Puedo consultar cifras agregadas y enseñarte de dónde sale cada una.';
  @Input() limite = 'Solo lectura. El asistente no identifica personas ni puede modificar, aprobar o publicar registros.';

  /**
   * El Asistente con el motor PÚBLICO (portal y Mi espacio de la persona): `base` y `contexto` no se usan (la ruta es la pública y
   * anónima) y el enlace de la portada lo abre mediante `PreguntaPublicaService`. Sin esto, el motor es el de `base` (consola y
   * espacio de una organización), autenticado y acotado por el servidor al rol.
   */
  @Input() publica = false;

  /** La pantalla activa no deja sitio a la burbuja (mapa, agenda de citas). Con el panel abierto se sigue pintando. */
  @Input() ocultarLanzador = false;

  private readonly local = signal(false);
  /** Abierto: en el portal lo manda el servicio compartido; en la consola, el botón propio. */
  readonly abierto = (): boolean => this.publica ? this.preguntas.abierta() : this.local();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  @ViewChild('burbuja') burbuja?: ElementRef<HTMLElement>;
  private readonly injector = inject(Injector);

  abrir(): void {
    if (this.publica) { if (this.abierto()) this.cerrar(); else this.preguntas.abrir(); return; }
    this.local.set(true);
    // EL FOCO LO LLEVA AHORA LA DIRECTIVA, Y POR UN MOTIVO CONCRETO. Aquí había un
    // queueMicrotask(() => this.panel?.nativeElement.focus()) que parecía resolverlo y no lo
    // resolvía: el microtask corre ANTES de que Angular renderice el bloque @if, así que el panel
    // todavía era undefined y el foco se quedaba en el botón de origen. Medido en el navegador el
    // 13 de septiembre de 2026: a los 3.500 ms el elemento activo seguía siendo ese botón. La
    // directiva usa afterNextRender, que es el momento en que el panel ya existe.
  }

  cerrar(): void {
    if (!this.abierto()) return;
    if (this.publica) this.preguntas.cerrar(); else this.local.set(false);
    // La burbuja puede estar oculta mientras el panel está abierto (teléfono): el foco vuelve cuando ya se ve.
    afterNextRender(() => this.burbuja?.nativeElement.focus({ preventScroll: true }), { injector: this.injector });
    // LA VUELTA DEL FOCO Y EL ESCAPE LOS LLEVA LA DIRECTIVA. Se retiraron de aquí el
    // HostListener de 'document:keydown.escape' y el this.disparador?.focus(): escuchar Escape en el
    // documento entero desde un componente compartido hacía que un cajón abierto reaccionara a
    // teclas dirigidas a otro overlay, y tener dos sitios que devuelven el foco es tener dos sitios
    // donde uno de los dos se queda atrás.
  }
}
