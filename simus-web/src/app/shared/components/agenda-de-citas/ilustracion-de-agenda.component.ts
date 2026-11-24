import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type DibujoDeAgenda =
  | 'calendario' | 'rotan' | 'fijos' | 'abierta' | 'aprobacion' | 'personas' | 'reloj' | 'franjas' | 'cita' | 'inscripcion';

/**
 * Dibujos simples y propios (SVG, sin librerías) para las decisiones y los vacíos de la agenda de citas. Usan los
 * colores de la marca por token; son decorativos (`aria-hidden`): el texto de al lado dice lo mismo.
 */
@Component({
  selector: 'app-ilustracion-de-agenda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline-block; line-height: 0; } svg { width: 100%; height: auto; }
    .f-fondo { fill: #f4effb; } .f-morado { fill: var(--color-morado); } .f-lila { fill: #c9b6e4; } .f-verde { fill: #2e9d6a; }
    .f-ambar { fill: #f2b84b; } .f-trazo { fill: #9a82bd; } .f-blanco { fill: #fff; }
    /* Un poco de vida, y solo si la persona no pidió menos movimiento: quien rota visita cada sitio fijo y vuelve. */
    .mov-ronda { animation: ronda 7s ease-in-out infinite; }
    @keyframes ronda { 0%, 12% { transform: translateX(0); } 28%, 45% { transform: translateX(35px); } 62%, 80% { transform: translateX(70px); } 100% { transform: translateX(0); } }
    @media (prefers-reduced-motion: reduce) { .mov-ronda { animation: none; transform: translateX(35px); } }
    .s-morado { stroke: var(--color-morado); } .s-lila { stroke: #c9b6e4; } .s-verde { stroke: #2e9d6a; } .s-trazo { stroke: #9a82bd; } .s-blanco { stroke: #fff; }
  `],
  template: `
    <svg viewBox="0 0 120 80" aria-hidden="true" focusable="false" [style.width.rem]="ancho()">
      <rect class="f-fondo" x="2" y="2" width="116" height="76" rx="12"/>
      @switch (dibujo()) {
        @case ('calendario') {
          <rect class="f-blanco s-morado" x="22" y="16" width="76" height="52" rx="6" stroke-width="2"/>
          <rect class="f-morado" x="22" y="16" width="76" height="14" rx="6"/>
          <g class="f-lila"><rect x="30" y="38" width="12" height="8" rx="2"/><rect x="54" y="38" width="12" height="8" rx="2"/><rect x="78" y="38" width="12" height="8" rx="2"/><rect x="30" y="52" width="12" height="8" rx="2"/></g>
          <rect class="f-verde" x="54" y="52" width="12" height="8" rx="2"/><rect class="f-ambar" x="78" y="52" width="12" height="8" rx="2"/>
        }
        @case ('rotan') {
          <!-- Los artistas tienen stand fijo (verde, con su artista); la persona compradora (morado) pasa de uno a otro. -->
          <g class="f-verde"><rect x="12" y="38" width="26" height="24" rx="4"/><rect x="47" y="38" width="26" height="24" rx="4"/><rect x="82" y="38" width="26" height="24" rx="4"/></g>
          <g class="f-blanco"><rect x="12" y="38" width="26" height="6" rx="3"/><rect x="47" y="38" width="26" height="6" rx="3"/><rect x="82" y="38" width="26" height="6" rx="3"/></g>
          <g class="f-ambar"><circle cx="25" cy="53" r="4"/><circle cx="60" cy="53" r="4"/><circle cx="95" cy="53" r="4"/></g>
          <path class="s-trazo" d="M18 24 H102" stroke-width="2" stroke-dasharray="3 4" fill="none"/>
          <g class="mov-ronda"><circle class="f-morado" cx="25" cy="22" r="8"/><circle class="f-blanco" cx="25" cy="20" r="2.4"/><path class="s-blanco" d="M20 25 q5 4 10 0" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>
        }
        @case ('fijos') {
          <!-- Los compradores o bookers tienen mesa fija (morado); la persona artista (verde) pasa de una mesa a otra. -->
          <g class="f-morado"><rect x="12" y="38" width="26" height="24" rx="4"/><rect x="47" y="38" width="26" height="24" rx="4"/><rect x="82" y="38" width="26" height="24" rx="4"/></g>
          <g class="f-lila"><rect x="12" y="38" width="26" height="6" rx="3"/><rect x="47" y="38" width="26" height="6" rx="3"/><rect x="82" y="38" width="26" height="6" rx="3"/></g>
          <g class="f-blanco"><circle cx="25" cy="53" r="4"/><circle cx="60" cy="53" r="4"/><circle cx="95" cy="53" r="4"/></g>
          <path class="s-trazo" d="M18 24 H102" stroke-width="2" stroke-dasharray="3 4" fill="none"/>
          <g class="mov-ronda"><circle class="f-verde" cx="25" cy="22" r="8"/><circle class="f-blanco" cx="25" cy="20" r="2.4"/><path class="s-blanco" d="M20 25 q5 4 10 0" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>
        }
        @case ('abierta') {
          <rect class="f-blanco s-morado" x="34" y="14" width="46" height="54" rx="4" stroke-width="2"/>
          <path class="f-lila s-morado" d="M34 14 L58 22 V76 L34 68 Z" stroke-width="2"/>
          <circle class="f-morado" cx="52" cy="44" r="2.5"/><g class="f-verde"><circle cx="96" cy="34" r="6"/><rect x="88" y="42" width="16" height="14" rx="6"/></g>
        }
        @case ('aprobacion') {
          <rect class="f-blanco s-morado" x="30" y="14" width="60" height="52" rx="6" stroke-width="2"/>
          <g class="s-lila" stroke-width="3" stroke-linecap="round"><path d="M40 28 h40"/><path d="M40 38 h28"/></g>
          <circle class="f-verde" cx="82" cy="58" r="13"/><path class="s-blanco" d="M75 58 l5 5 9 -10" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        }
        @case ('personas') {
          <g class="f-morado"><circle cx="42" cy="28" r="8"/><rect x="28" y="40" width="28" height="22" rx="10"/></g>
          <g class="f-verde"><circle cx="80" cy="28" r="8"/><rect x="66" y="40" width="28" height="22" rx="10"/></g>
        }
        @case ('reloj') {
          <circle class="f-blanco s-morado" cx="60" cy="40" r="26" stroke-width="2.5"/>
          <path class="s-morado" d="M60 24 V40 L72 48" stroke-width="3" fill="none" stroke-linecap="round"/>
        }
        @case ('franjas') {
          <g class="f-lila"><rect x="16" y="14" width="88" height="10" rx="4"/><rect x="16" y="30" width="88" height="10" rx="4"/><rect x="16" y="46" width="88" height="10" rx="4"/></g>
          <rect class="f-verde" x="16" y="30" width="44" height="10" rx="4"/><rect class="f-ambar" x="60" y="46" width="30" height="10" rx="4"/>
        }
        @case ('cita') {
          <rect class="f-blanco s-morado" x="18" y="18" width="84" height="44" rx="8" stroke-width="2"/>
          <g class="f-morado"><circle cx="40" cy="40" r="8"/></g><g class="f-verde"><circle cx="80" cy="40" r="8"/></g>
          <path class="s-trazo" d="M50 40 h20" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 4"/>
        }
        @default {
          <rect class="f-blanco s-morado" x="26" y="14" width="68" height="52" rx="6" stroke-width="2"/>
          <g class="f-lila"><rect x="36" y="26" width="48" height="6" rx="3"/><rect x="36" y="40" width="36" height="6" rx="3"/></g>
          <circle class="f-morado" cx="86" cy="58" r="11"/><path class="s-blanco" d="M86 52 v12 M80 58 h12" stroke-width="3" stroke-linecap="round"/>
        }
      }
    </svg>
  `,
})
export class IlustracionDeAgendaComponent {
  readonly dibujo = input.required<DibujoDeAgenda>();
  readonly ancho = input(7);
}
