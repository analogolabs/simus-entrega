import { Component, HostListener, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideChevronDown, LucideLogOut } from '@lucide/angular';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { ContextoDeOrganizacionService } from '../../core/services/contexto-de-organizacion.service';
import { RUTAS_DE_LA_CUENTA, RUTA_DE_ENTRADA, rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { etiquetaDelRolEnOrganizacion } from '../../core/navegacion/rol-en-organizacion';
import { DialogoDirective } from '../../shared/directives/dialogo.directive';
import { BuscadorDeListaComponent } from '../../shared/components/ui/buscador/buscador-de-lista.component';
import { CampanaDeAvisosComponent } from './campana-de-avisos.component';
import { SeccionEncontrada, buscarSeccionesDelPanel } from './secciones-del-panel';
import { GrupoDeGestion } from '../../core/navegacion/grupos-de-gestion';

/**
 * La cabecera del panel de una organización: la misma de la consola (UI-E).
 *
 * <b>QUÉ TIENE Y QUÉ NO.</b> Marca a la izquierda, el buscador de secciones junto a ella y, a la derecha, los
 * avisos y el menú de la cuenta. Nada más: ni «Actuando como» (la persona se ve en el menú y la organización,
 * arriba de la barra lateral), ni enlaces del portal (el portal es un destino y vive al pie de la barra
 * lateral, como en la consola).
 *
 * <b>REUTILIZA LA HOJA DE LA CABECERA DE LA CONSOLA</b> (`shared/components/layout/espacio-de-trabajo/cabecera.css`):
 * una sola definición de alturas, foco, buscador oscuro y menú de cuenta para las dos áreas.
 *
 * <b>EL BUSCADOR ES UN `combobox`</b> con su listado de secciones: la pieza `app-buscador-de-lista` en tono
 * oscuro lleva los atributos de ARIA, y las flechas, Enter y Escape se escuchan aquí porque el listado lo
 * pinta esta pantalla. Busca SECCIONES, no registros, y el campo lo dice.
 *
 * <b>EL MENÚ DE LA CUENTA</b> conserva los atributos de prueba del que tenía la barra pública
 * (`data-menu-de-cuenta`, `data-menu-mi-espacio`, `data-menu-organizacion`, `data-menu-cerrar-sesion`): lo de
 * la persona (Mi espacio, Perfil público, Contraseña y seguridad, Mis autorizaciones), sus organizaciones y la salida.
 */
@Component({
  selector: 'app-cabecera-del-panel',
  standalone: true,
  imports: [RouterLink, DialogoDirective, BuscadorDeListaComponent, CampanaDeAvisosComponent, LucideChevronDown, LucideLogOut],
  styleUrls: ['../../shared/components/layout/espacio-de-trabajo/cabecera.css', './cabecera-del-panel.component.css'],
  template: `
    <header class="foundation-header" data-testid="cabecera-del-panel">
      <a class="foundation-brand" data-testid="enlace-logotipo" [routerLink]="rutaDeLaMarca()" [attr.title]="tituloDeLaMarca()">
        <span class="marca" aria-hidden="true"><span class="marca__si">si</span><span class="marca__mus">mus</span></span>
        <span class="sr-only">SIMUS, </span>
        <span class="marca__nombre"><small>Espacio de gestión</small></span>
      </a>

      <div class="header-search">
        <app-buscador-de-lista
          identificador="buscador-de-seccion"
          etiqueta="Buscar una sección del panel por su nombre o por lo que se hace en ella"
          marcador="Buscar una sección o tarea…"
          tono="oscuro"
          [espera]="0"
          [valor]="busqueda()"
          [combobox]="{ controla: 'secciones-encontradas', activo: encontradas().length > 0 ? 'seccion-encontrada-' + resultadoActivo() : null, expandido: encontradas().length > 0 }"
          (cambiar)="escribir($event)"
          (keydown)="alPulsarTecla($any($event))" />
        @if (busqueda().trim().length >= 2) {
          <div class="header-search__results" id="secciones-encontradas" role="listbox" aria-label="Secciones encontradas">
            @for (seccion of encontradas(); track seccion.ruta; let i = $index) {
              <button type="button" role="option" [id]="'seccion-encontrada-' + i"
                [attr.aria-selected]="i === resultadoActivo()" [class.es-activo]="i === resultadoActivo()"
                (mouseenter)="resultadoActivo.set(i)" (click)="ir(seccion)">
                <b>{{ seccion.etiqueta }}</b><small>{{ seccion.grupo }}</small>
              </button>
            } @empty {
              <p>Nada coincide. Prueba con el nombre de una sección o con lo que quieres hacer: «invitar», «archivos», «solicitudes».</p>
            }
          </div>
        }
      </div>

      <div class="header-user">
        <div class="header-utiles avisos">
          <app-campana-de-avisos [organizacionId]="organizacionId()" tono="oscuro" />
        </div>

        <div class="header-cuenta" data-panel-sesion-externa>
          <button type="button" class="header-cuenta__disparador" data-menu-de-cuenta
            (click)="alternarMenu()"
            [attr.aria-expanded]="menuAbierto()"
            aria-haspopup="menu">
            <span class="user-initials" aria-hidden="true">{{ iniciales() }}</span>
            <span class="header-identidad__quien">
              <span class="sr-only">Cuenta de </span><b data-testid="chip-nombre-cuenta">{{ nombre() }}</b>
            </span>
            <svg lucideChevronDown [size]="15" aria-hidden="true"></svg>
          </button>

          @if (menuAbierto()) {
            <div class="header-cuenta__velo" (click)="cerrarMenu()" aria-hidden="true"></div>
            <div class="header-cuenta__menu" role="menu" data-menu-de-cuenta-panel appDialogo [dialogoBloqueaElFondo]="false" (cerrar)="cerrarMenu()">
              <p class="header-cuenta__quien">
                <b>{{ nombre() }}</b>
                <small>{{ sesion.actual()?.email }}</small>
              </p>
              <div role="group" aria-label="Persona" class="grupo">
                <a role="menuitem" data-menu-mi-espacio [routerLink]="cuenta.miEspacio" (click)="cerrarMenu()">Mi espacio</a>
                <a role="menuitem" data-menu-perfil-publico [routerLink]="cuenta.perfilPublico" (click)="cerrarMenu()">Perfil público</a>
                <a role="menuitem" data-menu-cuenta-seguridad [routerLink]="cuenta.seguridad" (click)="cerrarMenu()">Contraseña y seguridad</a>
                <a role="menuitem" data-menu-cuenta-autorizaciones [routerLink]="cuenta.autorizaciones" (click)="cerrarMenu()">Mis autorizaciones</a>
              </div>
              @if (sesion.organizaciones().length > 0) {
                <div role="group" aria-label="Mis organizaciones" class="grupo grupo--organizaciones" data-testid="menu-lista-de-organizaciones">
                  <p class="grupo__titulo">Mis organizaciones</p>
                  @for (organizacion of sesion.organizaciones(); track organizacion.id) {
                    <a role="menuitem" [attr.data-menu-organizacion]="organizacion.id"
                      [attr.aria-current]="esLaActiva(organizacion.id) ? 'true' : null"
                      [routerLink]="rutaDelPanel('resumen', organizacion.id)" (click)="cerrarMenu()" class="con-detalle">
                      <span><b [class.activa]="esLaActiva(organizacion.id)">{{ organizacion.name }}</b><small>{{ rol(organizacion.role) }}</small></span>
                    </a>
                  }
                </div>
              }
              <button type="button" role="menuitem" class="es-salida" data-menu-cerrar-sesion (click)="cerrarSesion()">
                <svg lucideLogOut [size]="16" aria-hidden="true"></svg>
                <span>Cerrar sesión</span>
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
})
export class CabeceraDelPanelComponent {
  protected readonly sesion = inject(ExternalSessionService);
  private readonly contexto = inject(ContextoDeOrganizacionService);
  private readonly router = inject(Router);

  /** La organización abierta (la de la URL): los avisos y las secciones encontradas se abren en ella. */
  readonly organizacionId = input('');

  /** Las secciones que busca el buscador de la cabecera: las del armazón que la contiene. Sin ellas, las del panel. */
  readonly grupos = input<readonly GrupoDeGestion[] | null>(null);
  /** Adónde lleva la marca y cómo lo dice; sin ellos, al inicio de la organización abierta. */
  readonly marcaA = input<readonly string[] | null>(null);
  readonly tituloDeLaMarca = input('Ir al inicio de la organización');
  /** En Mi espacio ninguna organización es «la activa» aunque se pase una para los avisos. */
  readonly sinOrganizacionActiva = input(false);

  protected readonly cuenta = RUTAS_DE_LA_CUENTA;
  protected readonly busqueda = signal('');
  protected readonly resultadoActivo = signal(0);
  protected readonly menuAbierto = signal(false);

  protected readonly encontradas = computed<SeccionEncontrada[]>(() => buscarSeccionesDelPanel(this.busqueda(), this.grupos() ?? undefined));
  protected readonly nombre = computed(() => this.sesion.actual()?.fullName ?? '');
  protected readonly iniciales = computed(() => {
    const partes = this.nombre().trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    return (partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[1][0]).toUpperCase();
  });

  /** Los comandos de una sección de la organización abierta (o de otra, si se pide). */
  protected rutaDelPanel(seccion: string, organizacionId: string = this.organizacionId() || (this.contexto.organizacionId() ?? '')): string[] {
    return rutaDelPanel(organizacionId, seccion);
  }

  /** La marca lleva al Resumen de la organización abierta; sin organización (enlace ajeno), a la pantalla de entrada. */
  protected rutaDeLaMarca(): string[] {
    const propia = this.marcaA();
    if (propia) return [...propia];
    const id = this.organizacionId();
    return id ? rutaDelPanel(id, 'resumen') : [RUTA_DE_ENTRADA];
  }

  /** En Mi espacio ninguna organización es «la activa». */
  protected esLaActiva(id: string): boolean { return !this.sinOrganizacionActiva() && this.organizacionId() === id; }

  protected rol(rol: string): string {
    return etiquetaDelRolEnOrganizacion(rol);
  }

  protected escribir(texto: string): void {
    this.busqueda.set(texto);
    this.resultadoActivo.set(0);
  }

  protected ir(seccion: SeccionEncontrada): void {
    this.escribir('');
    const enlace = this.grupos()?.flatMap(g => g.enlaces).find(e => e.ruta === seccion.ruta);
    void this.router.navigate(enlace ? [...enlace.comandos] : this.rutaDelPanel(seccion.ruta));
  }

  /** Enter abre el resultado resaltado (el primero si no se tocó nada) y las flechas recorren la lista. */
  protected alPulsarTecla(evento: KeyboardEvent): void {
    const lista = this.encontradas();
    if (evento.key === 'Escape') { this.escribir(''); return; }
    if (lista.length === 0) return;
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      this.resultadoActivo.update(actual => (actual + 1) % lista.length);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.resultadoActivo.update(actual => (actual - 1 + lista.length) % lista.length);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      this.ir(lista[Math.min(this.resultadoActivo(), lista.length - 1)]);
    }
  }

  protected alternarMenu(): void {
    this.menuAbierto.update(abierto => !abierto);
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  /** Cierra la sesión y vuelve al inicio: quedarse en una pantalla que exige sesión deja un panel que ya no responde. */
  protected cerrarSesion(): void {
    this.cerrarMenu();
    this.sesion.salir().subscribe(() => { void this.router.navigate(['/']); });
  }

  /** Un clic fuera del menú lo cierra (el velo cubre lo demás, pero Tab también puede sacar el foco). */
  @HostListener('document:keydown.escape')
  protected alPulsarEscape(): void {
    if (this.menuAbierto()) this.cerrarMenu();
  }
}
