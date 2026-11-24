import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideBuilding2, LucideCalendar, LucideGuitar, LucideHammer, LucideIdCard, LucideNetwork, LucideUser } from '@lucide/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map } from 'rxjs/operators';
import { Observable, OperatorFunction, of } from 'rxjs';
import { ExternalSessionService } from '../../../core/services/external-session.service';
import { PerfilPublicoService, MiPerfilPublico } from '../../../core/services/perfil-publico.service';
import { RUTAS_DE_LA_CUENTA, rutaDelPanel } from '../../../core/navegacion/rutas-de-gestion';
import { CuentaExternaApi, InvitacionesDeLaCuenta, PerfilDeCuenta } from '../cuenta-externa.api';
import { ROL_ADMINISTRADOR } from '../panel-organizacion.store';
import { SolicitudDeLaCuenta, SolicitudesDeLaCuentaService } from '../solicitudes/solicitudes-de-la-cuenta.service';
import { EncabezadoDePantallaComponent } from '../../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { AccesoRapidoComponent } from '../../../shared/components/ui/acceso-rapido/acceso-rapido.component';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { motivoDeLaFalla } from '../solicitudes/mi-actividad.component';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';

/** El estado de un paso del resumen: hecho, por hacer, o aún sin saber (cargando o con error). */
type EstadoDelPaso = 'hecho' | 'pendiente' | 'desconocido';

interface PasoDelResumen {
  id: 'correo' | 'datos' | 'perfil';
  titulo: string;
  estado: EstadoDelPaso;
  detalle: string;
  enlace: string;
  accion: string;
  opcional: boolean;
}

/**
 * «Resumen» del espacio personal, la portada de `/gestion/cuenta` (ME).
 *
 * <b>DICE EN QUÉ ESTÁ LA CUENTA.</b> Un panel de estado con tres pasos —correo confirmado, datos
 * personales completos y perfil público— y un avance, en lugar de un texto de bienvenida fijo. El
 * perfil público es opcional (la persona decide si se muestra), y por eso no cuenta para decir que
 * la cuenta está «lista»; sí se ve su estado.
 *
 * <b>LA RELACIÓN CON LAS ORGANIZACIONES ES LO SEGUNDO QUE SE VE.</b> Cada organización que
 * administra o edita tiene su acceso rápido, con su rol, y lo que registra a título propio —
 * talleres, espacios, redes— tiene el suyo. Son dos modos distintos y el resumen no los mezcla.
 *
 * <b>NO PROMETE LO QUE NO EXISTE.</b> Los datos del resumen salen de las mismas pantallas a las que
 * enlaza; si alguna no se puede leer, el paso queda «sin saber» y no se inventa un estado.
 */
@Component({
  selector: 'app-mi-espacio',
  standalone: true,
  imports: [RouterLink, EncabezadoDePantallaComponent, BotonNativoDirective, BotonComponent, EstadoDeListaComponent, FechaPipe, AccesoRapidoComponent, LucideBuilding2, LucideCalendar, LucideGuitar, LucideHammer, LucideIdCard, LucideNetwork, LucideUser],
  template: `
    <section class="pb-8" aria-labelledby="inicio-titulo">
      <app-encabezado-de-pantalla idDelTitulo="inicio-titulo" titulo="Inicio" [descripcion]="descripcion()" />

      <!-- UNA CAÍDA DEL SERVIDOR NO SE LEE COMO «NO TIENES NADA»: se dice qué falló, con su motivo, y se puede reintentar. -->
      @if (falla()) {
        <app-estado-de-lista tipo="error" titulo="No pudimos leer todo tu espacio" [detalle]="falla()" data-testid="mi-espacio-error">
          <app-boton importancia="secundaria" tamano="menudo" (accion)="cargar()">Reintentar</app-boton>
        </app-estado-de-lista>
      }

      @if (bienvenida()) {
        <p data-testid="bienvenida-cuenta" role="status" class="t-texto mb-4 border-y border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
          <strong>Tu cuenta está lista.</strong> Desde aquí completas tus datos, decides si publicas tu perfil y gestionas las organizaciones en las que participas.
        </p>
      }

      <!--
        EL ESTADO DE LA CUENTA SOLO APARECE CUANDO FALTA ALGO (PANEL, decisión 126). Con el correo confirmado y los datos
        completos no se pinta nada: una lista de «Hecho» al inicio da la sensación de que hay algo pendiente.
      -->
      @if (hayPendientes()) {
        <section aria-labelledby="estado-titulo" data-testid="estado-de-la-cuenta" class="mb-8">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="estado-titulo">Falta completar tu cuenta</h2>
            <p data-testid="avance-de-la-cuenta" class="t-ayuda">{{ avance().hechos }} de {{ avance().total }} pasos de la cuenta</p>
          </div>
          <ul class="mt-2 divide-y divide-slate-200 border-y border-slate-200">
            @for (paso of pasosAMostrar(); track paso.id) {
              <li [attr.data-testid]="'paso-' + paso.id" class="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div class="min-w-0">
                  <p class="t-rotulo" [class.text-emerald-800]="paso.estado === 'hecho'">{{ etiquetaDelEstado(paso) }}</p>
                  <h3>{{ paso.titulo }}</h3>
                  <p class="t-texto">{{ paso.detalle }}</p>
                </div>
                <a [routerLink]="paso.enlace" appBoton="secundaria" tamano="menudo" class="shrink-0">{{ paso.accion }}</a>
              </li>
            }
          </ul>
        </section>
      }

      <div class="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div class="min-w-0 space-y-8 [&>section:not(:first-child)]:border-t [&>section:not(:first-child)]:border-slate-200 [&>section:not(:first-child)]:pt-8">
          @if (porAtender().length) {
            <section aria-labelledby="accion-titulo">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="accion-titulo">Requiere tu acción</h2>
                <a [routerLink]="rutas.solicitudes" class="text-sm font-bold text-verde-texto hover:underline">Ver mi actividad y solicitudes ({{ porAtender().length }})</a>
              </div>
              <ul class="mt-2 divide-y divide-slate-200 border-y border-slate-200" data-testid="resumen-acciones">
                @for (fila of accionesVisibles(); track fila.clave) {
                  <li class="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div class="min-w-0">
                      <p class="t-rotulo text-morado">{{ fila.tipoEtiqueta }}@if (fila.organizacionNombre) { <span class="font-normal"> · {{ fila.organizacionNombre }}</span> }</p>
                      <h3 class="truncate">{{ fila.titulo }}</h3>
                      <p class="t-ayuda">{{ fila.estadoEtiqueta }}@if (fila.detalle) { · {{ fila.detalle }} }</p>
                    </div>
                    <a [routerLink]="rutaDeLaSolicitud(fila)" [queryParams]="consultaDeLaSolicitud(fila)" appBoton="secundaria" tamano="menudo" class="shrink-0">Atender<span class="sr-only"> {{ fila.titulo }}</span></a>
                  </li>
                }
              </ul>
            </section>
          }

          <section aria-labelledby="organizaciones-titulo" data-testid="resumen-de-organizaciones">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="organizaciones-titulo">Mis organizaciones</h2>
              <a [routerLink]="rutas.organizaciones" class="text-sm font-bold text-verde-texto hover:underline">Ver todas</a>
            </div>
            @if (organizaciones().length) {
              <p class="t-texto mt-1">{{ resumenOrganizaciones() }} Cada una tiene su propio panel.</p>
              <ul class="mt-2 divide-y divide-slate-200 border-y border-slate-200">
                @for (organizacion of organizaciones(); track organizacion.id) {
                  <li>
                    <a [routerLink]="panelDe(organizacion.id)" class="flex min-h-14 items-center justify-between gap-3 py-2.5 no-underline hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-morado">
                      <span class="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-morado text-sm font-bold text-white">{{ iniciales(organizacion.name) }}</span>
                        <span class="min-w-0">
                          <span class="block break-words font-bold text-valor">{{ organizacion.name }}</span>
                          <span class="t-ayuda block">{{ etiquetaDelRol(organizacion.role) }}</span>
                        </span>
                      </span>
                      <span class="shrink-0 text-sm font-bold text-slate-600">Abrir panel <span aria-hidden="true">→</span></span>
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <p data-testid="sin-organizaciones" class="t-texto mt-2">Todavía no participas en ninguna organización. Los Festivales, Mercados y eventos se registran a nombre de una organización: registra la tuya o pide a quien administra una que te invite.</p>
              <p class="t-texto mt-2">¿Tu Festival o Mercado ya estaba en SIMUS? <a [routerLink]="rutas.procesosHistoricos" data-testid="mi-espacio-procesos-historicos" class="font-bold text-verde-texto hover:underline">Mira los procesos históricos</a>.</p>
              <p class="t-texto mt-2">¿Quieres gestionar una organización? <a [routerLink]="rutas.registrarOrganizacion" data-testid="registrar-organizacion-resumen" class="font-bold text-verde-texto underline underline-offset-2">Regístrala desde Mis organizaciones</a>.</p>
            }
            @if (invitacionesPendientes() > 0) {
              <p data-testid="invitaciones-del-resumen" class="t-texto mt-3 border-y border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                Tienes {{ invitacionesPendientes() === 1 ? '1 invitación pendiente' : invitacionesPendientes() + ' invitaciones pendientes' }}.
                <a [routerLink]="rutas.organizaciones" class="font-bold underline underline-offset-2">Revísalas</a>.
              </p>
            }
          </section>

          @if (actividad().length) {
            <section aria-labelledby="actividad-titulo">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="actividad-titulo">Actividad reciente</h2>
                <a [routerLink]="rutas.solicitudes" class="text-sm font-bold text-verde-texto hover:underline">Ver el historial</a>
              </div>
              <ul class="mt-2 divide-y divide-slate-200 border-y border-slate-200">
                @for (fila of actividad(); track fila.clave) {
                  <li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                    <p class="t-texto min-w-0 break-words"><span class="font-bold text-slate-800">{{ fila.titulo }}</span> · {{ fila.tipoEtiqueta }}</p>
                    <p class="t-ayuda shrink-0">{{ fila.estadoEtiqueta }} · {{ fila.fecha | fecha }}</p>
                  </li>
                }
              </ul>
            </section>
          }
        </div>

        <div class="min-w-0 space-y-8 [&>section:not(:first-child)]:border-t [&>section:not(:first-child)]:border-slate-200 [&>section:not(:first-child)]:pt-8 border-t border-slate-200 pt-8 xl:border-l xl:border-t-0 xl:pt-0 xl:pl-10">
          <section aria-labelledby="accesos-titulo">
            <h2 id="accesos-titulo">Accesos rápidos</h2>
            <div class="mt-3 grid grid-cols-3 gap-2" data-testid="resumen-accesos">
              <a [routerLink]="rutas.perfilPublico" app-acceso-rapido><svg icono lucideUser [size]="22" aria-hidden="true"></svg>{{ perfilPublicado() ? 'Editar mi perfil público' : 'Crear mi perfil público' }}</a>
              <a [routerLink]="rutas.datos" app-acceso-rapido><svg icono lucideIdCard [size]="22" aria-hidden="true"></svg>Mis datos personales</a>
              <a [routerLink]="rutas.eventos" app-acceso-rapido><svg icono lucideCalendar [size]="22" aria-hidden="true"></svg>Mis eventos</a>
            </div>
          </section>

          <section aria-labelledby="procesos-titulo" data-testid="resumen-de-procesos">
            <h2 id="procesos-titulo">Lo que registras con tu cuenta</h2>
            <p class="t-texto mt-1">Sin necesidad de una organización, puedes registrar a título propio estos procesos del Ecosistema.</p>
            <ul class="mt-2 divide-y divide-slate-200 border-y border-slate-200">
              @for (proceso of procesos; track proceso.ruta) {
                <li>
                  <a [routerLink]="proceso.ruta" class="flex items-center gap-3 py-3 no-underline hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-morado">
                    <span aria-hidden="true" class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-morado/10 text-morado">
                      @switch (proceso.icono) {
                        @case ('taller') { <svg lucideHammer [size]="20"></svg> }
                        @case ('espacio') { <svg lucideGuitar [size]="20"></svg> }
                        @default { <svg lucideNetwork [size]="20"></svg> }
                      }
                    </span>
                    <span class="min-w-0">
                      <span class="block font-bold text-valor">{{ proceso.titulo }}</span>
                      <span class="t-ayuda mt-0.5 block">{{ proceso.descripcion }}</span>
                    </span>
                  </a>
                </li>
              }
            </ul>
          </section>

        </div>
      </div>
    </section>
  `,
})
export class MiEspacioComponent implements OnInit {
  private readonly sesionExterna = inject(ExternalSessionService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly cuentaApi = inject(CuentaExternaApi);
  private readonly perfilPublico = inject(PerfilPublicoService);
  private readonly solicitudesApi = inject(SolicitudesDeLaCuentaService);

  readonly rutas = RUTAS_DE_LA_CUENTA;
  readonly organizaciones = this.sesionExterna.organizaciones;
  readonly bienvenida = toSignal(this.ruta.queryParamMap.pipe(map(parametros => parametros.get('bienvenida') === '1')), { initialValue: false });

  /** Lo que se sabe de la cuenta; `undefined` es «todavía no sé» (cargando o no se pudo leer). */
  private readonly datos = signal<PerfilDeCuenta | null | undefined>(undefined);
  private readonly perfil = signal<MiPerfilPublico | null | undefined>(undefined);
  private readonly invitaciones = signal<InvitacionesDeLaCuenta | null | undefined>(undefined);

  /** Lo que una persona registra con su cuenta, sin organización. */
  readonly procesos = [
    { icono: 'taller', ruta: RUTAS_DE_LA_CUENTA.talleres, titulo: 'Taller de lutería', descripcion: 'Tu taller, con sus servicios y las familias de instrumentos que trabajas.' },
    { icono: 'espacio', ruta: RUTAS_DE_LA_CUENTA.espacios, titulo: 'Espacio para música en vivo', descripcion: 'Un bar, una sala o un escenario del que eres responsable.' },
    { icono: 'red', ruta: RUTAS_DE_LA_CUENTA.redes, titulo: 'Red o centro de documentación', descripcion: 'Un archivo, una fonoteca o una red de la que haces parte.' },
  ];

  readonly pasos = computed<PasoDelResumen[]>(() => {
    const invitaciones = this.invitaciones();
    const datos = this.datos();
    const perfil = this.perfil();
    const correo: EstadoDelPaso = invitaciones === undefined || invitaciones === null ? 'desconocido' : (invitaciones.correoSinConfirmar ? 'pendiente' : 'hecho');
    const datosCompletos = datos
      ? !!(datos.primerNombre?.trim() && datos.primerApellido?.trim() && datos.tipoDocumento?.trim() && datos.numeroDocumento?.trim())
      : null;
    const estadoDatos: EstadoDelPaso = datosCompletos === null ? 'desconocido' : (datosCompletos ? 'hecho' : 'pendiente');
    const estadoPerfil: EstadoDelPaso = perfil === undefined || perfil === null ? 'desconocido' : (perfil.existe && perfil.visible ? 'hecho' : 'pendiente');
    const detallePerfil = perfil === undefined || perfil === null
      ? 'Lo que el ecosistema puede ver de ti, si lo publicas.'
      : perfil.ocultoPorModeracion ? 'La consola lo ocultó. Revisa el motivo en tu perfil.'
      : perfil.visible ? 'Tu perfil está publicado.'
      : perfil.existe ? 'Lo guardaste, pero no lo has publicado.'
      : 'Todavía no lo creas. Nace oculto: tú decides cuándo publicarlo.';
    return [
      { id: 'correo', titulo: 'Correo confirmado', estado: correo, opcional: false,
        detalle: correo === 'hecho' ? 'Tu correo de acceso está confirmado.' : correo === 'pendiente' ? 'Confirma tu correo para recibir invitaciones y avisos.' : 'Comprobando tu correo…',
        enlace: RUTAS_DE_LA_CUENTA.seguridad, accion: 'Ir a seguridad' },
      { id: 'datos', titulo: 'Datos personales', estado: estadoDatos, opcional: false,
        detalle: estadoDatos === 'hecho' ? 'Tus datos están completos. Son privados.' : estadoDatos === 'pendiente' ? 'Faltan datos obligatorios: nombres, apellido y documento.' : 'Comprobando tus datos…',
        enlace: RUTAS_DE_LA_CUENTA.datos, accion: 'Revisar mis datos' },
      { id: 'perfil', titulo: 'Perfil público', estado: estadoPerfil, opcional: true,
        detalle: detallePerfil, enlace: RUTAS_DE_LA_CUENTA.perfilPublico, accion: 'Ir a mi perfil público' },
    ];
  });

  /** El avance cuenta solo lo que la cuenta necesita: correo y datos. El perfil público es opcional. */
  readonly avance = computed(() => {
    const necesarios = this.pasos().filter(paso => !paso.opcional);
    const hechos = necesarios.filter(paso => paso.estado === 'hecho').length;
    return { hechos, total: necesarios.length, porcentaje: Math.round((hechos / necesarios.length) * 100) };
  });

  /** Los pasos que se enseñan: los que faltan (y, ya que la lista aparece, el perfil si aún no está publicado). */
  readonly pasosAMostrar = computed(() => this.pasos().filter(p => p.estado !== 'hecho' && p.estado !== 'desconocido'));
  /** ¿Falta algo que la cuenta necesita? Mientras se comprueba o si todo está hecho, no se pinta nada. */
  readonly hayPendientes = computed(() => this.pasos().some(p => !p.opcional && p.estado === 'pendiente'));
  readonly perfilPublicado = computed(() => { const p = this.perfil(); return !!p && p.existe && p.visible; });

  private readonly solicitudes = signal<SolicitudDeLaCuenta[]>([]);
  readonly porAtender = computed(() => this.solicitudes().filter(s => s.espera === 'tu_accion'));
  readonly accionesVisibles = computed(() => this.porAtender().slice(0, 6));
  readonly actividad = computed(() => [...this.solicitudes()].filter(s => s.espera !== 'tu_accion').sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5));
  readonly descripcion = computed(() => {
    const n = this.porAtender().length;
    return n === 0 ? 'Tu cuenta, tus organizaciones y lo que registras a título propio.'
      : n === 1 ? 'Tienes una cosa que atender, y debajo tus organizaciones y lo que registras a título propio.'
      : `Tienes ${n} cosas que atender, y debajo tus organizaciones y lo que registras a título propio.`;
  });

  rutaDeLaSolicitud(fila: SolicitudDeLaCuenta): string { return fila.ruta.split('?')[0]; }
  consultaDeLaSolicitud(fila: SolicitudDeLaCuenta): Record<string, string> | null {
    const [, texto] = fila.ruta.split('?');
    return texto ? Object.fromEntries(new URLSearchParams(texto)) : null;
  }

  readonly invitacionesPendientes = computed(() => this.invitaciones()?.pendientes.length ?? 0);

  readonly resumenOrganizaciones = computed(() => {
    const cuantas = this.organizaciones().length;
    return cuantas === 1 ? 'Participas en 1 organización.' : `Participas en ${cuantas} organizaciones.`;
  });

  /** El motivo de la última lectura que falló, o vacío si todo se leyó. Las cifras no se inventan: quedan «sin saber». */
  readonly falla = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  /** Lee las cuatro fuentes; también es lo que hace «Reintentar». */
  cargar(): void {
    this.falla.set('');
    const alFallar = <S, T>(vacio: T): OperatorFunction<S, S | T> => catchError((fallo: unknown): Observable<T> => {
      const motivo = motivoDeLaFalla(fallo);
      this.falla.set([motivo.mensaje, motivo.detalle].filter(Boolean).join(' '));
      return of(vacio);
    });
    this.cuentaApi.obtenerPerfil().pipe(alFallar(null)).subscribe(datos => this.datos.set(datos));
    this.perfilPublico.mio().pipe(alFallar(null)).subscribe(perfil => this.perfil.set(perfil));
    this.solicitudesApi.deLaCuenta().pipe(alFallar([] as SolicitudDeLaCuenta[])).subscribe(filas => this.solicitudes.set(filas ?? []));
    this.cuentaApi.invitacionesPendientes().pipe(alFallar(null)).subscribe(invitaciones => this.invitaciones.set(invitaciones));
  }

  etiquetaDelEstado(paso: PasoDelResumen): string {
    if (paso.estado === 'hecho') return 'Hecho';
    if (paso.estado === 'desconocido') return 'Comprobando';
    return paso.opcional ? 'Opcional' : 'Por hacer';
  }

  /** Las iniciales de un nombre (hasta dos), para el círculo de cada organización. */
  iniciales(nombre: string): string {
    const palabras = (nombre ?? '').split(/\s+/).filter(p => p.length > 2);
    return palabras.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || '·';
  }

  etiquetaDelRol(rol: string): string {
    return rol === ROL_ADMINISTRADOR ? 'Administrador' : 'Editor';
  }

  panelDe(organizacionId: string): string[] {
    return rutaDelPanel(organizacionId, 'resumen');
  }
}
