import { ChangeDetectionStrategy, Component, ElementRef, Injector, ViewEncapsulation, OnDestroy, OnInit, afterNextRender, effect, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Los dibujos de la navegación lateral: uno por cosa que se hace en la herramienta. */
export type IconoDeSeccion = 'resumen' | 'personas' | 'programacion' | 'calendario' | 'horarios' | 'citas' | 'ajustes' | 'portafolio' | 'agenda';

/** Una sección de la aplicación: lleva su marca de trabajo pendiente si la tiene. */
export interface SeccionDeHerramienta {
  id: string;
  rotulo: string;
  icono: IconoDeSeccion;
  /** Cuántas cosas esperan a quien trabaja en esta sección (0 u omitido: nada). */
  pendientes?: number;
}

/**
 * El ARMAZÓN DE UNA APLICACIÓN a pantalla completa (docs/referencia/26-agenda-de-citas-y-mercados.md §26.15): cabecera morada con el nombre del mercado y su edición, el estado y las acciones
 * principales; navegación lateral de secciones con su marca de trabajo pendiente (en el móvil, una barra inferior); y un lienzo con fondo propio
 * donde las superficies flotan, para que se sienta una aplicación y no una página blanca con cosas.
 *
 * <b>POR QUÉ NO ES UNA SECCIÓN MÁS DEL PANEL.</b> Una agenda se arma mirando un calendario, y un calendario necesita ancho y alto: la herramienta
 * cubre el espacio de gestión mientras se usa y devuelve a la ficha del Mercado (o a Mi espacio) con «Salir de la herramienta».
 *
 * <b>LO QUE QUEDA DETRÁS NO SE PUEDE ALCANZAR.</b> Mientras la herramienta está abierta, todo lo que la rodea (cabecera y barra lateral del espacio)
 * se marca `inert`: no entra en el orden de tabulación ni lo lee un lector de pantalla. Al salir se restituye tal cual estaba. No es un diálogo: no
 * atrapa el foco, solo aparta lo que no es suyo. La barra principal del portal queda detrás: nunca tapa la cabecera de la herramienta.
 *
 * <b>CONTENIDO:</b> `[estado]` (junto al nombre), `[acciones]` (a la derecha de la cabecera) y el contenido por omisión (el lienzo).
 * Sin `secciones` no hay navegación lateral.
 */
@Component({
  selector: 'app-herramienta-a-pantalla-completa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Sin encapsulación: la regla del diálogo común de abajo tiene que llegar al diálogo, que vive fuera de este componente.
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink],
  styles: [`
    /* El diálogo de confirmación común SIEMPRE por encima de la herramienta a pantalla completa. */
    app-confirmacion-global .dialogo-velo { z-index: var(--z-aviso-de-confirmacion); }
    app-herramienta-a-pantalla-completa { position: fixed; inset: 0; z-index: var(--z-aviso); display: flex; flex-direction: column; background: var(--color-morado-50); }
    .app__cabecera { flex: none; background: linear-gradient(115deg, var(--color-morado-vivo) 0%, var(--color-morado) 70%); color: #fff; box-shadow: 0 2px 14px rgb(46 25 51 / .35); position: relative; z-index: 2; }
    .app__cabecera-interior { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem 1.25rem; padding: .75rem 1.25rem; }
    .app__titulo { min-width: 0; flex: 1 1 14rem; }
    .app__procedencia { font-size: var(--text-dato); line-height: 1.0625rem; opacity: .82; }
    .app__cabecera .app__titulo h1 { margin: 0; color: #fff !important; font-family: var(--font-alternate); font-size: 1.75rem; line-height: 2.125rem; font-weight: 600; }
    .app__estado { order: 2; display: inline-flex; align-items: center; gap: .5rem; }
    .app__estado:empty { display: none; }
    .app__acciones { order: 3; display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
    .app__salir { order: 4; display: inline-flex; align-items: center; gap: .5rem; min-height: 2.25rem; padding: 0 .85rem; border: 1px solid rgb(255 255 255 / .45); border-radius: var(--radius-control); color: #fff; font-weight: 700; font-size: var(--text-cuerpo); text-decoration: none; transition: background var(--dur-rapida); }
    .app__salir:hover { background: rgb(255 255 255 / .16); text-decoration: none; }
    .app__salir:focus-visible, .app__item:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-verde); outline-offset: 2px; }
    .app__salir svg { width: 1.1rem; height: 1.1rem; flex: none; }
    /* Botones de la cabecera (sobre el morado): el principal es amarillo, el resto va con filete blanco. */
    .app__boton { display: inline-flex; align-items: center; justify-content: center; gap: .4rem; min-height: 2.25rem; padding: 0 .85rem; border: 1px solid rgb(255 255 255 / .45); border-radius: var(--radius-control); background: transparent; color: #fff; font: inherit; font-size: var(--text-cuerpo); font-weight: 700; text-decoration: none; cursor: pointer; transition: background var(--dur-rapida); }
    .app__boton:hover:not(:disabled) { background: rgb(255 255 255 / .16); text-decoration: none; }
    .app__boton:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-verde); outline-offset: 2px; }
    .app__boton:disabled { opacity: .55; cursor: not-allowed; }
    .app__boton--principal { background: var(--color-verde); border-color: var(--color-verde); color: var(--color-tinta); }
    .app__boton--principal:hover:not(:disabled) { background: var(--color-verde-claro); }
    .app__estado-texto { display: inline-flex; align-items: center; gap: .5rem; font-size: var(--text-cuerpo); font-weight: 700; }
    .app__punto { width: .6rem; height: .6rem; border-radius: 50%; background: var(--color-morado-100); flex: none; }
    .app__punto--abierta { background: var(--color-verde); animation: app-latido 2s ease-in-out infinite; }
    .app__punto--en_curso { background: var(--color-avance); animation: app-latido 2s ease-in-out infinite; }
    .app__punto--cerrada { background: var(--color-gris-sin-clasificar); }
    @keyframes app-latido { 50% { box-shadow: 0 0 0 5px rgb(255 255 255 / .18); } }
    @media (prefers-reduced-motion: reduce) { .app__punto--abierta, .app__punto--en_curso { animation: none; } .app__boton { transition: none; } }
    /* La superficie de la aplicación: blanca, con sombra y sin borde; el fondo del lienzo la separa. Nunca dentro de otra superficie. */
    .app-superficie { background: #fff; border-radius: .9rem; box-shadow: 0 1px 2px rgb(46 25 51 / .1), 0 6px 18px rgb(46 25 51 / .06); padding: 1rem; min-width: 0; }
    .app-superficie--lectura { padding: 1.25rem; }
    .app__cuerpo { flex: 1 1 auto; display: flex; min-height: 0; }
    .app__riel { flex: none; width: 13.5rem; display: flex; flex-direction: column; gap: .15rem; padding: .85rem .6rem; background: #fff; border-right: 1px solid var(--color-filete); overflow-y: auto; }
    .app__item { position: relative; display: flex; align-items: center; gap: .65rem; min-height: 2.75rem; padding: 0 .75rem; border: 0; border-radius: .6rem; background: transparent; color: var(--color-prosa); font: inherit; font-size: var(--text-cuerpo); font-weight: 700; text-align: left; cursor: pointer; transition: background var(--dur-rapida), color var(--dur-rapida); }
    .app__item:hover { background: var(--color-morado-50); color: var(--color-morado); }
    .app__item[aria-current='page'] { background: var(--color-morado-100); color: var(--color-morado); }
    .app__item svg { width: 1.2rem; height: 1.2rem; flex: none; }
    .app__marca { margin-left: auto; min-width: 1.25rem; padding: 0 .35rem; border-radius: .35rem; background: var(--color-verde); color: var(--color-tinta); font-size: var(--text-dato); font-weight: 800; line-height: 1.25rem; text-align: center; }
    .app__lienzo { flex: 1 1 auto; min-width: 0; overflow: auto; padding: 1.25rem; scroll-padding-top: 1rem; }
    .app__contenido { margin: 0 auto; max-width: 96rem; animation: app-entra var(--dur-media) var(--ease-soft); }
    @keyframes app-entra { from { opacity: 0; transform: translateY(.5rem); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .app__contenido { animation: none; } .app__item { transition: none; } }
    /* Móvil: la navegación pasa a una barra inferior con las mismas secciones y el lienzo gana todo el ancho. */
    @media (max-width: 47.99rem) {
      .app__cuerpo { flex-direction: column-reverse; }
      .app__riel { flex-direction: row; width: auto; padding: .25rem; gap: .1rem; border-right: 0; border-top: 1px solid var(--color-filete); overflow-x: auto; justify-content: flex-start; }
      .app__item { flex: 1 0 auto; flex-direction: column; justify-content: center; gap: .1rem; min-height: 3.25rem; padding: 0 .6rem; font-size: var(--text-dato); }
      .app__marca { position: absolute; top: .15rem; right: .15rem; margin: 0; min-width: 1.1rem; line-height: 1.1rem; font-size: .6875rem; }
      .app__lienzo { padding: .85rem; }
      .app__titulo h1 { font-size: 1.5rem; line-height: 1.85rem; }
      .app__cabecera-interior { padding: .6rem .85rem; gap: .4rem .75rem; }
      .app__salir { order: 1; padding: 0 .6rem; }
      .app__salir span { display: none; }
      .app__titulo { flex: 1 1 calc(100% - 3.5rem); }
      .app__estado { order: 2; flex: none; }
      /* Las acciones pasan a la línea siguiente y se parten si hace falta: antes iban en una sola fila que se desplazaba de lado y
         «Exportar» desaparecía en el teléfono. El menú de «Exportar» se abre a todo el ancho de la cabecera, no recortado por la fila. */
      .app__acciones { order: 2; flex: 1 1 100%; min-width: 0; flex-wrap: wrap; }
      .app__acciones details { position: static; }
      .app__acciones details > div { left: .85rem; right: .85rem; width: auto; }
      .app__acciones .app__boton, .app__salir { min-height: 2.75rem; }
    }
    /* Tableta: la navegación lateral más angosta deja ancho a la parrilla y al calendario. */
    @media (min-width: 48rem) and (max-width: 63.99rem) { .app__riel { width: 11.5rem; } }
    /* Teléfono apaisado u ordenador con la ventana baja: la cabecera se compacta (sin la línea de procedencia) para que el lienzo tenga alto. */
    @media (max-height: 31rem) {
      .app__cabecera-interior { padding: .4rem .85rem; gap: .25rem .75rem; }
      .app__procedencia { display: none; }
      .app__cabecera .app__titulo h1 { font-size: 1.25rem; line-height: 1.5rem; }
    }
    @media print { app-herramienta-a-pantalla-completa { position: static; } .app__cabecera, .app__riel { display: none; } }
  `],
  template: `
    <header class="app__cabecera" data-testid="cabecera-de-la-herramienta">
      <div class="app__cabecera-interior">
        <div class="app__titulo">
          <p class="app__procedencia">{{ procedencia() }}</p>
          <h1 class="break-words">{{ titulo() }}</h1>
        </div>
        <div class="app__estado"><ng-content select="[estado]" /></div>
        <div class="app__acciones"><ng-content select="[acciones]" /></div>
        <a [routerLink]="volverA()" class="app__salir" data-testid="volver-de-la-herramienta" [attr.aria-label]="volverRotulo()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
          <span>{{ volverRotulo() }}</span>
        </a>
      </div>
    </header>
    <div class="app__cuerpo">
      @if (secciones().length) {
        <nav class="app__riel" [attr.aria-label]="'Secciones de ' + titulo()" data-testid="navegacion-de-la-herramienta">
          @for (s of secciones(); track s.id) {
            <button type="button" class="app__item" [attr.data-pestana]="s.id" [attr.aria-current]="s.id === seccionActiva() ? 'page' : null"
                    [attr.aria-controls]="controla()" (click)="elegir.emit(s.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                @switch (s.icono) {
                  @case ('resumen') { <rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/> }
                  @case ('personas') { <circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c1.8.8 3 2.6 3 5.6"/> }
                  @case ('programacion') { <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 10v10"/> }
                  @case ('calendario') { <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/> }
                  @case ('horarios') { <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/> }
                  @case ('citas') { <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/> }
                  @case ('ajustes') { <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/> }
                  @case ('portafolio') { <rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/> }
                  @default { <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/> }
                }
              </svg>
              <span>{{ s.rotulo }}</span>
              @if (s.pendientes) { <span class="app__marca" [attr.aria-label]="s.pendientes + ' pendientes'">{{ s.pendientes }}</span> }
            </button>
          }
        </nav>
      }
      <div class="app__lienzo" id="herramienta-contenido" role="region" [attr.aria-label]="titulo()">
        <div class="app__contenido"><ng-content /></div>
      </div>
    </div>
  `,
})
export class HerramientaAPantallaCompletaComponent implements OnInit, OnDestroy {
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private apartados: { el: Element; inertAntes: boolean }[] = [];
  private desbordeAntes = '';

  /** El nombre de la agenda: por omisión, el del Mercado. */
  readonly titulo = input.required<string>();
  /** El subtítulo de la cabecera: la edición y de dónde cuelga («Corporación Sonora Andina · Edición 2027»). */
  readonly procedencia = input.required<string>();
  readonly volverA = input.required<readonly (string | number)[] | string>();
  readonly volverRotulo = input('Salir de la herramienta');
  readonly secciones = input<readonly SeccionDeHerramienta[]>([]);
  readonly seccionActiva = input('');
  /** El `id` del panel que gobierna la navegación (accesibilidad). */
  readonly controla = input<string | null>(null);
  readonly elegir = output<string>();

  private readonly inyector = inject(Injector);
  /** En el teléfono la navegación es una barra inferior que se desplaza de lado: la sección activa se trae a la vista (también al llegar por la dirección). */
  private readonly traerLaActiva = effect(() => {
    this.seccionActiva();
    afterNextRender(() => this.anfitrion.nativeElement.querySelector<HTMLElement>('.app__item[aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }), { injector: this.inyector });
  });

  ngOnInit(): void {
    const yo = this.anfitrion.nativeElement;
    // Todo hermano de cada ancestro, hasta el cuerpo: es lo que la herramienta cubre.
    for (let nodo: HTMLElement | null = yo; nodo && nodo !== document.body; nodo = nodo.parentElement) {
      for (const hermano of Array.from(nodo.parentElement?.children ?? [])) {
        if (hermano === nodo || hermano.tagName === 'SCRIPT' || hermano.tagName === 'STYLE'
          // El diálogo de confirmación común y la región que anuncia el cambio de ruta siguen vivos.
          || hermano.tagName === 'APP-CONFIRMACION-GLOBAL' || hermano.hasAttribute('aria-live')) continue;
        this.apartados.push({ el: hermano, inertAntes: hermano.hasAttribute('inert') });
        hermano.setAttribute('inert', '');
      }
    }
    this.desbordeAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    for (const a of this.apartados) { if (!a.inertAntes) a.el.removeAttribute('inert'); }
    this.apartados = [];
    document.body.style.overflow = this.desbordeAntes;
  }
}
