import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExternalSessionService } from '../../../core/services/external-session.service';
import { RUTAS_DE_LA_CUENTA, rutaDelPanel } from '../../../core/navegacion/rutas-de-gestion';
import { CuentaExternaApi, InvitacionPendienteDeLaCuenta } from '../cuenta-externa.api';
import { ROL_ADMINISTRADOR } from '../panel-organizacion.store';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { EncabezadoDePantallaComponent } from '../../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { HerramientasDeListaComponent } from '../../../shared/components/ui/herramientas-de-lista/herramientas-de-lista.component';
import { BuscadorDeListaComponent } from '../../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { EsqueletoComponent } from '../../../shared/components/ui/esqueleto/esqueleto.component';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';

function sinTildes(texto: string): string { return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

/**
 * «Mis organizaciones», en `/gestion/cuenta/organizaciones`.
 *
 * Las organizaciones de la cuenta con su rol, el camino para registrar otra y las invitaciones que
 * esperan a este correo. Cada organización se abre en su propia dirección (`/gestion/o/{id}`): es
 * la manera de cambiar de organización fuera del selector del panel.
 *
 * <b>LAS INVITACIONES SE LISTAN, NO SE ACEPTAN DESDE AQUÍ.</b> El enlace de la invitación es lo único
 * que demuestra que se recibió (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4); la lista dice que existe y cómo seguir.
 */
@Component({
  selector: 'app-mis-organizaciones',
  standalone: true,
  imports: [FechaPipe, RouterLink, EncabezadoDePantallaComponent, HerramientasDeListaComponent, BuscadorDeListaComponent, FiltroDesplegableComponent, EstadoDeListaComponent, EsqueletoComponent, BotonNativoDirective],
  template: `
    <div class="space-y-8">
      <section aria-labelledby="mis-organizaciones-titulo">
        <app-encabezado-de-pantalla idDelTitulo="mis-organizaciones-titulo" titulo="Mis organizaciones"
          descripcion="Cada organización tiene su propio panel. Lo que registras en una no aparece en las demás."
          [contador]="organizaciones().length ? organizaciones().length + (organizaciones().length === 1 ? ' organización' : ' organizaciones') : null">
          <a [routerLink]="rutas.registrarOrganizacion" data-testid="registrar-organizacion" appBoton="principal">Registrar una organización</a>
        </app-encabezado-de-pantalla>
        @if (organizaciones().length) {
          <app-herramientas-de-lista>
            <app-buscador-de-lista identificador="organizaciones-buscar" etiqueta="Buscar organizaciones"
              marcador="Nombre de la organización" [valor]="busqueda()" [espera]="0" (cambiar)="busqueda.set($event)" />
            <app-filtro-desplegable rotulo="Rol" etiqueta="Filtrar las organizaciones por tu rol" identificador="organizaciones-rol"
              [opciones]="opcionesDeRol()" [elegida]="rolFiltro()" (cambiar)="rolFiltro.set($event)" />
          </app-herramientas-de-lista>
          @if (!organizacionesVisibles().length) {
            <app-estado-de-lista titulo="No hay organizaciones que coincidan." detalle="Cambia la búsqueda o el rol elegidos." />
          } @else {
            <ul data-testid="lista-de-organizaciones" class="divide-y divide-slate-200 border-y border-slate-200">
              @for (organizacion of organizacionesVisibles(); track organizacion.id) {
                <li class="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div class="min-w-0">
                    <h2>{{ organizacion.name }}</h2>
                    <p class="t-ayuda mt-1">{{ etiquetaDelRol(organizacion.role) }}</p>
                  </div>
                  <a [routerLink]="panelDe(organizacion.id)" appBoton="secundaria">Abrir su panel</a>
                </li>
              }
            </ul>
          }
        } @else {
          <app-estado-de-lista data-testid="sin-organizaciones" titulo="Todavía no participas en ninguna organización."
            detalle="Los Festivales, Mercados y eventos se registran siempre a nombre de una: registra la tuya y quedarás como su administradora o administrador." />
        }
      </section>

      <section aria-labelledby="invitaciones-titulo">
        <h2 id="invitaciones-titulo">Invitaciones pendientes</h2>
        <p class="mt-1 max-w-2xl text-cuerpo leading-relaxed text-prosa">Si una organización ya existe en SIMUS, quien la administra puede invitarte con el correo de tu cuenta, <strong>{{ correo() }}</strong>. Para aceptar, abre el enlace de la invitación que te compartió.</p>
        @if (cargando()) { <app-esqueleto variante="fila" [cantidad]="1" etiqueta="Consultando tus invitaciones…" /> }
        @else if (error()) { <app-estado-de-lista tipo="error" [titulo]="error()" /> }
        @else if (correoSinConfirmar()) { <p class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Confirma tu correo para ver aquí las invitaciones que te esperan.</p> }
        @else if (invitaciones().length) {
          <ul data-testid="invitaciones-pendientes" class="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            @for (invitacion of invitaciones(); track invitacion.id) {
              <li class="px-4 py-4">
                <p class="text-sm font-bold text-slate-900">{{ invitacion.organizacion }}</p>
                <p class="mt-0.5 text-xs text-slate-500">Te invitan como {{ invitacion.rol === rolAdministrador ? 'administradora o administrador' : 'editora o editor' }} · vence el {{ invitacion.fechaExpiracion | fecha }}</p>
              </li>
            }
          </ul>
        } @else { <p class="mt-4 text-sm text-slate-500">No tienes invitaciones pendientes.</p> }
      </section>
    </div>
  `,
})
export class MisOrganizacionesComponent implements OnInit {
  private readonly sesionExterna = inject(ExternalSessionService);
  private readonly cuenta = inject(CuentaExternaApi);

  readonly rutas = RUTAS_DE_LA_CUENTA;
  readonly rolAdministrador = ROL_ADMINISTRADOR;
  readonly organizaciones = this.sesionExterna.organizaciones;
  readonly busqueda = signal('');
  readonly rolFiltro = signal('todos');
  private readonly coincidentes = computed(() => {
    const q = sinTildes(this.busqueda());
    return q ? this.organizaciones().filter(o => sinTildes(o.name).includes(q)) : this.organizaciones();
  });
  readonly organizacionesVisibles = computed(() => {
    const rol = this.rolFiltro();
    return rol === 'todos' ? this.coincidentes() : this.coincidentes().filter(o => (o.role === ROL_ADMINISTRADOR ? 'administra' : 'edita') === rol);
  });
  readonly opcionesDeRol = computed<readonly OpcionDeFiltro[]>(() => {
    const todas = this.coincidentes();
    const administra = todas.filter(o => o.role === ROL_ADMINISTRADOR).length;
    return [
      { id: 'todos', etiqueta: 'Todos', conteo: todas.length },
      { id: 'administra', etiqueta: 'Administro', conteo: administra },
      { id: 'edita', etiqueta: 'Edito', conteo: todas.length - administra },
    ];
  });
  readonly invitaciones = signal<InvitacionPendienteDeLaCuenta[]>([]);
  readonly correoSinConfirmar = signal(false);
  readonly cargando = signal(true);
  readonly error = signal('');

  correo(): string {
    return this.sesionExterna.actual()?.email ?? '';
  }

  ngOnInit(): void {
    this.cuenta.invitacionesPendientes().subscribe({
      next: respuesta => {
        this.cargando.set(false);
        this.correoSinConfirmar.set(respuesta?.correoSinConfirmar === true);
        this.invitaciones.set(respuesta?.pendientes ?? []);
      },
      error: (fallo: { message?: string }) => {
        this.cargando.set(false);
        this.error.set(fallo?.message ?? 'No fue posible consultar tus invitaciones.');
      },
    });
  }

  etiquetaDelRol(rol: string): string {
    return rol === ROL_ADMINISTRADOR ? 'Administras esta organización' : 'Editas en esta organización';
  }

  panelDe(organizacionId: string): string[] {
    return rutaDelPanel(organizacionId, 'resumen');
  }
}
