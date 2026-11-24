import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, signal, viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  LucideBuilding2, LucideCalendar, LucideCalendarClock, LucideChevronDown, LucideChevronRight, LucideExternalLink, LucideFiles,
  LucideGuitar, LucideHammer, LucideHouse, LucideInbox, LucideLayoutDashboard, LucideLock, LucideMenu, LucideMusic, LucideNetwork,
  LucideUser, LucideUsers, LucideWrench, LucideX, LucideIdCard, LucidePanelLeftClose, LucidePanelLeftOpen,
} from '@lucide/angular';
import { ExternalSessionService } from '../../../../core/services/external-session.service';
import { EnlaceDeGestion, GrupoDeGestion } from '../../../../core/navegacion/grupos-de-gestion';
import { CabeceraDelPanelComponent } from '../../../../features/panel-organizacion/cabecera-del-panel.component';
import { IndicaMasDirective } from '../../../directives/indica-mas.directive';
import {
  EleccionDePlegado, alternarPlegado, grupoPlegado, guardarEleccionDePlegado, leerEleccionDePlegado,
} from '../../../../features/admin/domain/grupos-plegables-de-la-barra';
import {
  EleccionDelMenu, estaEnRiel, guardarEleccionDelMenu, inicialesDe, leerEleccionDelMenu, modoPorAncho,
} from './menu-lateral';

/**
 * EL ARMAZÓN DEL ESPACIO EXTERNO (PANEL, decisión 126, docs/desarrollo/30-consola-y-acceso.md §30.18): cabecera, barra lateral y contenido.
 *
 * <b>UNO SOLO PARA EL PANEL DE LA ORGANIZACIÓN Y PARA MI ESPACIO.</b> Antes eran dos estructuras: el panel
 * con la forma de la consola (UI-E) y Mi espacio con la barra pública, un encabezado de persona y una caja
 * de navegación. Al pasar de uno a otro parecía que se entraba a otro sistema. Ahora cada área solo aporta:
 * <ul>
 *   <li>`identidad` (contenido proyectado `[identidad]`): el bloque fijo arriba de la barra —el rol, el nombre de la
 *     entidad y la ciudad; en Mi espacio, «Mi espacio», el nombre y el correo—;</li>
 *   <li>`grupos`: los destinos, agrupados por lo que la persona hace;</li>
 *   <li>el contenido (proyección por omisión) y, si lo hay, `[aparte]` (lo que flota: la consulta guiada).</li>
 * </ul>
 * Cabecera, cajón en pantalla estrecha, grupos plegables (con la elección recordada), insignias, ancho útil y pie
 * («Ver el portal público») son los mismos.
 *
 * <b>EL MENÚ SE ADAPTA AL ANCHO (gestión externa, `menu-lateral.ts`):</b> desde 1100 px es columna abierta o riel de iconos
 * (sin elección, riel por debajo de 1280 px; con elección, manda la elección), de 700 a 1099 px es riel con expansión superpuesta y por
 * debajo de 700 px la navegación pasa a una barra inferior con «Más». Un solo control, «Contraer menú» / «Expandir menú», y su elección
 * se recuerda en el navegador. En riel, cada destino lleva su rótulo emergente al pasar el puntero y al enfocar con el teclado.
 *
 * EL <main> ES SUYO (UI-G): el armazón de la aplicación ya no lo declara, y aquí queda un solo `<main id="contenido-principal">`
 * por pantalla, con la cabecera y la barra lateral fuera de él.
 */
@Component({
  selector: 'app-armazon-de-gestion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet, RouterLink, CabeceraDelPanelComponent, IndicaMasDirective, LucidePanelLeftClose, LucidePanelLeftOpen,
    LucideBuilding2, LucideCalendar, LucideCalendarClock, LucideChevronDown, LucideChevronRight, LucideExternalLink, LucideFiles,
    LucideGuitar, LucideHammer, LucideHouse, LucideInbox, LucideLayoutDashboard, LucideLock, LucideMenu, LucideMusic, LucideNetwork,
    LucideUser, LucideUsers, LucideWrench, LucideX, LucideIdCard,
  ],
  styleUrls: ['../espacio-de-trabajo/estructura.css', './armazon-de-gestion.component.css'],
  template: `
    <ng-template #icono let-nombre let-tam="tam">
      @switch (nombre) {
        @case ('inicio') { <svg lucideLayoutDashboard [size]="tam"></svg> }
        @case ('solicitudes') { <svg lucideInbox [size]="tam"></svg> }
        @case ('procesos') { <svg lucideMusic [size]="tam"></svg> }
        @case ('eventos') { <svg lucideCalendar [size]="tam"></svg> }
        @case ('herramientas') { <svg lucideWrench [size]="tam"></svg> }
        @case ('organizacion') { <svg lucideBuilding2 [size]="tam"></svg> }
        @case ('archivos') { <svg lucideFiles [size]="tam"></svg> }
        @case ('equipo') { <svg lucideUsers [size]="tam"></svg> }
        @case ('perfil') { <svg lucideUser [size]="tam"></svg> }
        @case ('datos') { <svg lucideIdCard [size]="tam"></svg> }
        @case ('seguridad') { <svg lucideLock [size]="tam"></svg> }
        @case ('organizaciones') { <svg lucideHouse [size]="tam"></svg> }
        @case ('agenda') { <svg lucideCalendarClock [size]="tam"></svg> }
        @case ('taller') { <svg lucideHammer [size]="tam"></svg> }
        @case ('espacio') { <svg lucideGuitar [size]="tam"></svg> }
        @case ('red') { <svg lucideNetwork [size]="tam"></svg> }
      }
    </ng-template>

    <div class="admin-foundation armazon-de-gestion" [attr.data-testid]="pruebaId()"
      [class.modo-movil]="modo() === 'movil'" [class.con-columna]="modo() !== 'movil'"
      [class.en-riel]="enRiel() && !superpuesto()" [class.menu-superpuesto]="superpuesto()">
      <app-cabecera-del-panel [organizacionId]="organizacionId()" [grupos]="grupos()" [marcaA]="marcaA()" [tituloDeLaMarca]="tituloDeLaMarca()" [sinOrganizacionActiva]="sinOrganizacionActiva()" />

      <div class="foundation-layout">
        <!-- EL MARCO FIJA LA COLUMNA (riel o abierta); en tableta la barra se expande por encima del contenido sin moverlo. -->
        <div class="barra-marco">
        <!-- \`tabindex="-1"\`: Escape se atiende aquí para cerrar la expansión con el foco en cualquier destino. -->
        <aside class="foundation-sidebar" [id]="idDeLaBarra()" tabindex="-1" [attr.data-testid]="pruebaIdDeLaBarra()"
          (keydown.escape)="alPulsarEscape()" (pointerover)="mostrarEtiqueta($event)" (pointerleave)="ocultarEtiqueta()"
          (focusin)="mostrarEtiqueta($event)" (focusout)="ocultarEtiqueta()"
          [attr.aria-label]="etiquetaDeLaBarra()">
          <div class="marco-identidad"><ng-content select="[identidad]" /></div>
          @if (inicialesDeLaIdentidad()) {
            <div class="identidad-riel" aria-hidden="true" [attr.data-etiqueta]="nombreDeLaIdentidad()">{{ inicialesDeLaIdentidad() }}</div>
          }

          <nav class="sidebar-secciones" appIndicaMas [attr.aria-label]="etiquetaDeLaNavegacion()">
            @for (grupo of grupos(); track grupo.id) {
              @let plegado = plegadoElGrupo(grupo.id) && !enRiel();
              @let contieneLaActiva = grupoContieneLaSeccionActiva(grupo.id);
              <section class="sidebar-group" [class.esta-plegado]="plegado">
                <button type="button" class="sidebar-grupo-titulo" [id]="'titulo-grupo-' + prefijo() + grupo.id"
                  [attr.aria-expanded]="!plegado" [attr.aria-controls]="'grupo-' + prefijo() + grupo.id"
                  [disabled]="contieneLaActiva"
                  [attr.title]="contieneLaActiva ? 'Contiene la sección que estás viendo' : null"
                  (click)="alternarGrupo(grupo.id)">
                  <span class="sidebar-grupo-flecha" aria-hidden="true">
                    @if (plegado) { <svg lucideChevronRight [size]="13"></svg> } @else { <svg lucideChevronDown [size]="13"></svg> }
                  </span>
                  <span>{{ grupo.etiqueta }}</span>
                </button>
                <div class="sidebar-grupo-lista" [id]="'grupo-' + prefijo() + grupo.id" role="group"
                  [attr.aria-labelledby]="'titulo-grupo-' + prefijo() + grupo.id" [hidden]="plegado">
                  @for (enlace of grupo.enlaces; track enlace.ruta) {
                    <a class="sidebar-item" [routerLink]="enlace.comandos"
                      [class.is-active]="estaActivoEl(enlace)"
                      [attr.aria-current]="estaActivoEl(enlace) ? 'page' : null"
                      [attr.data-etiqueta]="enlace.etiqueta"
                      [attr.data-seccion]="enlace.ruta">
                      <span class="sidebar-icono" aria-hidden="true"><ng-container *ngTemplateOutlet="icono; context: { $implicit: enlace.icono, tam: 18 }" /></span>
                      <span class="sidebar-rotulo">{{ enlace.etiqueta }}</span>
                      @if (enlace.insignia && enlace.insignia > 0) {
                        <em [attr.data-testid]="'insignia-' + enlace.ruta" aria-hidden="true">{{ enlace.insignia > 99 ? '99+' : enlace.insignia }}</em>
                        <span class="sr-only">, {{ enlace.textoDeLaInsignia }}</span>
                      }
                    </a>
                  }
                </div>
              </section>
            }
          </nav>
          <!-- EL PIE: el control del menú (uno solo) y el portal público como destino, separados del resto. -->
          <div class="sidebar-pie">
            @if (modo() !== 'movil') {
              <button type="button" class="sidebar-control" data-testid="control-del-menu" (click)="alternarMenu()"
                [attr.aria-expanded]="modo() === 'tableta' ? superpuesto() : !enRiel()" [attr.aria-controls]="idDeLaBarra()"
                [attr.data-etiqueta]="rotuloDelControl()">
                <span class="sidebar-icono" aria-hidden="true">
                  @if (menuReducido()) { <svg lucidePanelLeftOpen [size]="18"></svg> } @else { <svg lucidePanelLeftClose [size]="18"></svg> }
                </span>
                <span class="sidebar-rotulo">{{ rotuloDelControl() }}</span>
              </button>
            }
            <a class="sidebar-portal" routerLink="/" target="_blank" rel="noopener" data-etiqueta="Ver el portal público" title="Se abre en una pestaña nueva">
              <span class="sidebar-icono" aria-hidden="true"><svg lucideExternalLink [size]="18"></svg></span>
              <span class="sidebar-rotulo">Ver el portal público<span class="sr-only"> (se abre en una pestaña nueva)</span></span>
            </a>
          </div>
        </aside>
        </div>
        @if (superpuesto()) { <div class="velo-del-menu" aria-hidden="true" (click)="cerrarSuperpuesto()"></div> }

        <main id="contenido-principal" tabindex="-1" class="foundation-main panel-contenido"><ng-content /></main>
      </div>

      <!-- RÓTULO EMERGENTE DEL RIEL: uno solo, fijo y fuera de la barra (que recorta lo que se sale). Decorativo: el nombre accesible ya está en el destino. -->
      @if (etiquetaEmergente(); as e) {
        <div class="etiqueta-emergente" aria-hidden="true" [style.top.px]="e.arriba" [style.left.px]="e.izquierda">{{ e.texto }}</div>
      }

      <!-- EN MÓVIL: LA BARRA INFERIOR. Los cuatro primeros destinos y «Más», que abre el resto agrupado. -->
      @if (modo() === 'movil') {
        <nav class="barra-inferior" aria-label="Secciones principales">
          @for (enlace of principales(); track enlace.ruta) {
            <a class="barra-inferior__destino" [routerLink]="enlace.comandos" [class.is-active]="estaActivoEl(enlace)"
              [attr.aria-current]="estaActivoEl(enlace) ? 'page' : null" [attr.data-barra]="enlace.ruta">
              <span class="barra-inferior__pastilla" aria-hidden="true">
                <ng-container *ngTemplateOutlet="icono; context: { $implicit: enlace.icono, tam: 20 }" />
                @if (enlace.insignia && enlace.insignia > 0) { <em>{{ enlace.insignia > 99 ? '99+' : enlace.insignia }}</em> }
              </span>
              <span class="barra-inferior__rotulo">{{ rotuloCorto(enlace) }}</span>
              @if (enlace.insignia && enlace.insignia > 0) { <span class="sr-only">, {{ enlace.textoDeLaInsignia }}</span> }
            </a>
          }
          <button #botonMas type="button" class="barra-inferior__destino" data-testid="boton-mas" (click)="alternarMas()"
            [class.is-active]="masTieneLaActiva() || masAbierto()" [attr.aria-current]="masTieneLaActiva() ? 'page' : null"
            [attr.aria-expanded]="masAbierto()" aria-haspopup="dialog" [attr.aria-controls]="'mas-' + prefijo()">
            <span class="barra-inferior__pastilla" aria-hidden="true"><svg lucideMenu [size]="20"></svg></span>
            <span class="barra-inferior__rotulo">Más</span>
          </button>
        </nav>
        @if (masAbierto()) {
          <div class="velo-del-menu velo-del-menu--movil" aria-hidden="true" (click)="cerrarMas()"></div>
          <div #hojaMas class="hoja-mas" role="dialog" aria-label="Más secciones" [id]="'mas-' + prefijo()"
            (keydown.escape)="cerrarMas(true)">
            @for (grupo of restantesPorGrupo(); track grupo.id) {
              <p class="hoja-mas__grupo">{{ grupo.etiqueta }}</p>
              @for (enlace of grupo.enlaces; track enlace.ruta) {
                <a class="hoja-mas__destino" [routerLink]="enlace.comandos" [class.is-active]="estaActivoEl(enlace)"
                  [attr.aria-current]="estaActivoEl(enlace) ? 'page' : null" [attr.data-seccion]="enlace.ruta">
                  <span aria-hidden="true"><ng-container *ngTemplateOutlet="icono; context: { $implicit: enlace.icono, tam: 20 }" /></span>
                  <span>{{ enlace.etiqueta }}</span>
                  @if (enlace.insignia && enlace.insignia > 0) {
                    <em aria-hidden="true">{{ enlace.insignia > 99 ? '99+' : enlace.insignia }}</em>
                    <span class="sr-only">, {{ enlace.textoDeLaInsignia }}</span>
                  }
                </a>
              }
            }
            <a class="hoja-mas__destino hoja-mas__destino--portal" routerLink="/" target="_blank" rel="noopener">
              <span aria-hidden="true"><svg lucideExternalLink [size]="20"></svg></span>
              <span>Ver el portal público<span class="sr-only"> (se abre en una pestaña nueva)</span></span>
            </a>
            <button type="button" class="hoja-mas__cerrar" (click)="cerrarMas(true)"><svg lucideX [size]="16" aria-hidden="true"></svg> Cerrar</button>
          </div>
        }
      }
      <ng-content select="[aparte]" />
    </div>
  `,
})
export class ArmazonDeGestionComponent {
  private readonly router = inject(Router);
  private readonly sesion = inject(ExternalSessionService);

  readonly grupos = input.required<readonly GrupoDeGestion[]>();
  /** Con qué clave se recuerdan los grupos plegados de cada cuenta (el panel y Mi espacio tienen la suya). */
  readonly clavePlegados = input.required<string>();
  readonly plegadosPorOmision = input<readonly string[]>([]);
  /** Un prefijo para los `id` de los grupos: dos armazones no coinciden nunca, pero se deja explícito. */
  readonly prefijo = input('g-');
  readonly etiquetaDeLaBarra = input('Navegación');
  readonly etiquetaDeLaNavegacion = input('Secciones');
  readonly idDeLaBarra = input('navegacion-de-gestion');
  readonly pruebaId = input<string | null>(null);
  readonly pruebaIdDeLaBarra = input<string | null>(null);
  /** La organización abierta (para la campana y la marca); vacía en Mi espacio. */
  readonly organizacionId = input('');
  readonly marcaA = input<readonly string[] | null>(null);
  readonly tituloDeLaMarca = input('Ir al inicio de la organización');
  readonly sinOrganizacionActiva = input(false);
  /** El nombre de la identidad (organización o persona): de él salen las iniciales que ocupan su lugar cuando el menú va en riel. */
  readonly nombreDeLaIdentidad = input('');
  readonly inicialesDeLaIdentidad = computed(() => inicialesDe(this.nombreDeLaIdentidad()));

  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destruccion = inject(DestroyRef);
  private readonly botonMas = viewChild<ElementRef<HTMLButtonElement>>('botonMas');
  private readonly hojaMas = viewChild<ElementRef<HTMLElement>>('hojaMas');

  /** El ancho de la ventana (lo que mide el armazón); de él salen el modo y la forma del menú. */
  private readonly ancho = signal(typeof window === 'undefined' ? 1440 : window.innerWidth);
  private readonly eleccionDelMenu = signal<EleccionDelMenu | null>(leerEleccionDelMenu(this.almacen()));
  readonly modo = computed(() => modoPorAncho(this.ancho()));
  readonly enRiel = computed(() => estaEnRiel(this.ancho(), this.eleccionDelMenu()));
  /** En tableta, la expansión pedida: la barra se abre por encima del contenido y se cierra al navegar. */
  private readonly expandidoEnTableta = signal(false);
  readonly superpuesto = computed(() => this.modo() === 'tableta' && this.expandidoEnTableta());
  /** ¿Se ve el menú reducido? (el icono y el texto del control dependen de esto). */
  readonly menuReducido = computed(() => this.modo() === 'tableta' ? !this.superpuesto() : this.enRiel());
  readonly rotuloDelControl = computed(() => this.menuReducido() ? 'Expandir menú' : 'Contraer menú');
  readonly masAbierto = signal(false);
  readonly etiquetaEmergente = signal<{ texto: string; arriba: number; izquierda: number } | null>(null);

  private readonly destinos = computed(() => this.grupos().flatMap(g => g.enlaces));
  /** Los cuatro primeros destinos van en la barra inferior; el resto, en «Más». */
  readonly principales = computed(() => this.destinos().slice(0, 4));
  readonly restantesPorGrupo = computed(() => {
    const fijos = new Set(this.principales().map(e => e.ruta));
    return this.grupos().map(g => ({ id: g.id, etiqueta: g.etiqueta, enlaces: g.enlaces.filter(e => !fijos.has(e.ruta)) })).filter(g => g.enlaces.length > 0);
  });
  readonly masTieneLaActiva = computed(() => this.restantesPorGrupo().some(g => g.enlaces.some(e => this.estaActivoEl(e))));
  private readonly urlActual = signal(this.router.url);
  private readonly eleccion = signal<EleccionDePlegado>({});

  constructor() {
    this.router.events.subscribe(evento => {
      if (evento instanceof NavigationEnd) {
        this.urlActual.set(evento.urlAfterRedirects);
        this.expandidoEnTableta.set(false);
        this.masAbierto.set(false);
        this.etiquetaEmergente.set(null);
      }
    });
    // El ancho se mide en la ventana: el armazón ocupa toda su anchura.
    if (typeof window !== 'undefined') {
      const medir = () => this.ancho.set(window.innerWidth);
      window.addEventListener('resize', medir);
      this.destruccion.onDestroy(() => window.removeEventListener('resize', medir));
    }
    effect(() => {
      // Al pasar a móvil o a escritorio la expansión superpuesta y los rótulos emergentes no tienen sentido.
      if (this.modo() !== 'tableta') this.expandidoEnTableta.set(false);
      if (this.modo() !== 'movil') this.masAbierto.set(false);
      if (!this.enRiel() && !this.superpuesto()) this.etiquetaEmergente.set(null);
    });
    effect(() => {
      const cuenta = this.sesion.actual()?.userId;
      this.eleccion.set(leerEleccionDePlegado(this.almacen(), cuenta == null ? null : String(cuenta), this.clavePlegados()));
    });
  }

  private almacen(): Storage | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
  }

  /** ¿Es este destino el que se está viendo? (la URL manda; las consultas y el fragmento no cuentan). */
  estaActivo(comandos: readonly string[], exacta = false): boolean {
    this.urlActual();
    return this.router.isActive(this.router.createUrlTree([...comandos]), {
      paths: exacta ? 'exact' : 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored',
    });
  }

  /** ¿Está activo este destino, por su dirección o por alguna de las que cuelgan de él? */
  estaActivoEl(enlace: EnlaceDeGestion): boolean {
    return this.estaActivo(enlace.comandos, enlace.exacta) || !!enlace.activoEn?.some(c => this.estaActivo(c));
  }

  grupoContieneLaSeccionActiva(grupo: string): boolean {
    return !!this.grupos().find(g => g.id === grupo)?.enlaces.some(e => this.estaActivoEl(e));
  }

  plegadoElGrupo(grupo: string): boolean {
    return grupoPlegado(grupo, this.eleccion(), this.grupoContieneLaSeccionActiva(grupo), this.plegadosPorOmision());
  }

  alternarGrupo(grupo: string): void {
    if (this.grupoContieneLaSeccionActiva(grupo)) return;
    const siguiente = alternarPlegado(grupo, this.eleccion(), this.plegadoElGrupo(grupo));
    this.eleccion.set(siguiente);
    const cuenta = this.sesion.actual()?.userId;
    guardarEleccionDePlegado(this.almacen(), cuenta == null ? null : String(cuenta), siguiente, this.clavePlegados());
  }

  /** UN SOLO CONTROL. En escritorio contrae o expande y recuerda la elección con el ancho en que se hizo; en tableta abre o cierra la expansión superpuesta. */
  alternarMenu(): void {
    this.etiquetaEmergente.set(null);
    if (this.modo() === 'tableta') { this.expandidoEnTableta.update(v => !v); return; }
    const eleccion: EleccionDelMenu = { forma: this.enRiel() ? 'abierto' : 'riel', ancho: this.ancho() };
    this.eleccionDelMenu.set(eleccion);
    guardarEleccionDelMenu(this.almacen(), eleccion);
  }

  cerrarSuperpuesto(): void { this.expandidoEnTableta.set(false); }

  alPulsarEscape(): void {
    this.etiquetaEmergente.set(null);
    if (this.superpuesto()) this.expandidoEnTableta.set(false);
  }

  /** Los rótulos emergentes del riel: al pasar el puntero o al enfocar con el teclado, junto al destino. Escape los descarta. */
  mostrarEtiqueta(evento: Event): void {
    if (!this.enRiel() || this.superpuesto()) return;
    const destino = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-etiqueta]');
    const texto = destino?.dataset['etiqueta'];
    if (!destino || !texto) { this.etiquetaEmergente.set(null); return; }
    const caja = destino.getBoundingClientRect();
    this.etiquetaEmergente.set({ texto, arriba: caja.top + caja.height / 2, izquierda: caja.right + 10 });
  }

  ocultarEtiqueta(): void { this.etiquetaEmergente.set(null); }

  /** El nombre corto de la barra inferior: cabe en una columna de 390 px dividida entre cinco. */
  rotuloCorto(enlace: EnlaceDeGestion): string {
    return enlace.etiquetaCorta ?? enlace.etiqueta;
  }

  alternarMas(): void { if (this.masAbierto()) { this.cerrarMas(); return; } this.abrirMas(); }

  private abrirMas(): void {
    this.masAbierto.set(true);
    afterNextRender(() => this.hojaMas()?.nativeElement.querySelector<HTMLElement>('a, button')?.focus(), { injector: this.injector });
  }

  /** Cierra «Más»; si fue con el teclado o con «Cerrar», el foco vuelve al botón que lo abrió. */
  cerrarMas(devolverElFoco = false): void {
    this.masAbierto.set(false);
    if (devolverElFoco) afterNextRender(() => this.botonMas()?.nativeElement.focus(), { injector: this.injector });
  }
}
