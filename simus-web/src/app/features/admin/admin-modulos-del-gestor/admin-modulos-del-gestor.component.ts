import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { AdministracionDeCuentasService, CuentaConModulos } from '../../../core/services/administracion-de-cuentas.service';
import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { BarraDeHerramientasComponent } from '../../../shared/components/ui/barra-de-herramientas/barra-de-herramientas.component';
import { BuscadorDeListaComponent } from '../../../shared/components/ui/buscador/buscador-de-lista.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { InterruptorComponent } from '../../../shared/components/ui/interruptor/interruptor.component';
import { PanelLateralComponent } from '../../../shared/components/ui/panel-lateral/panel-lateral.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { AccionElegida, AccionDeFila } from '../../../shared/components/ui/tabla-de-gestion/acciones-de-fila.component';
import { CeldaDeTablaDirective, ColumnaDeGestion, TablaDeGestionComponent } from '../../../shared/components/ui/tabla-de-gestion/tabla-de-gestion.component';
import { alternarOrden, ColumnaOrdenable, EstadoDeOrden, ordenarFilas } from '../../../shared/components/ui/orden-de-lista/orden-de-lista';
import {
  diferenciaDeModulos, ModuloDelGestor, moduloDelGestor, MODULOS_CONCEDIBLES, MODULOS_DEL_GESTOR, nombreDelPerfil,
  PerfilDeModulos, PERFILES_DE_MODULOS,
} from '../domain/modulos-del-gestor';

type Vista = 'modulos' | 'gestores';
type Seleccion = { tipo: 'modulo'; codigo: string } | { tipo: 'gestor'; id: number } | null;

interface FilaDeModulo {
  modulo: ModuloDelGestor;
  conAcceso: number;
  total: number;
}

interface FilaDeGestor {
  cuenta: CuentaConModulos;
  perfil: string;
  concedidos: number;
}

/**
 * EL APARTADO «MÓDULOS DEL GESTOR» de «Usuarios y roles»: dónde el webmaster habilita o deshabilita a cada Gestor
 * los módulos de la consola.
 *
 * <b>DOS LECTURAS DE LA MISMA MATRIZ.</b> «Por módulo» responde «¿quién tiene este módulo?» y «Por gestor» responde
 * «¿qué tiene esta persona?». En las dos se cambia con un interruptor por módulo y gestor; cada cambio se guarda al
 * instante (el servidor lo registra en la auditoría con quién, a quién y el antes y el después) y quitar acceso pide
 * confirmación. La matriz entera no se dibuja como rejilla de casillas: con 17 módulos y N gestores no cabe en móvil.
 *
 * <b>LO QUE SE VE ES LO QUE SE HABILITA.</b> Los nombres y las descripciones son los de la barra de la consola
 * (`domain/modulos-del-gestor.ts`), y «Resumen operativo» y «Solicitudes y revisiones» se muestran como fijos. El
 * servidor decide quién puede cambiar módulos (solo el webmaster) y rechaza lo que no corresponde.
 */
@Component({
  selector: 'app-modulos-del-gestor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BotonComponent, BarraDeHerramientasComponent, BuscadorDeListaComponent, EstadoDeListaComponent, InterruptorComponent,
    PanelLateralComponent, SelectorSegmentadoComponent, TablaDeGestionComponent, CeldaDeTablaDirective,
  ],
  styles: [`
    :host { display: block; }
    .mg { display: flex; flex-direction: column; gap: 1.25rem; }
    .mg__intro { margin: 0; max-width: 46rem; color: var(--color-prosa); font-size: var(--text-cuerpo); line-height: 1.5; }
    .mg__estado { margin: 0; color: var(--color-verde-texto); font-size: var(--text-dato); font-weight: 700; min-height: 1.25rem; }
    .mg__estado.es-error { color: var(--color-aviso); }
    .mg__familia { margin: 1.25rem 0 .25rem; color: var(--color-seccion); font-family: var(--font-alternate); font-size: var(--text-dato); font-weight: 700; letter-spacing: .1em; }
    .mg__lista { margin: 0; padding: 0; list-style: none; }
    .mg__lista > li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .65rem 0; border-top: 1px solid var(--color-filete); }
    .mg__lista > li:first-child { border-top: 0; }
    .mg__texto { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
    .mg__nombre { color: var(--color-valor); font-size: var(--text-cuerpo); font-weight: 600; }
    .mg__detalle { color: var(--color-prosa); font-size: var(--text-dato); line-height: 1.4; }
    .mg__nota { color: var(--color-rotulo); font-size: var(--text-dato); font-weight: 700; }
    .mg__perfiles { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
    .mg__aparte { margin: .25rem 0 0; color: var(--color-rotulo); font-size: var(--text-dato); }
    @media (max-width: 639.98px) { .mg__lista > li { flex-direction: column; align-items: flex-start; } }
  `],
  template: `
    <div class="mg" data-modulos-del-gestor>
      <p class="mg__intro">
        Aquí se habilita o deshabilita, por Gestor, cada módulo de la consola. La consola solo muestra a cada persona los
        módulos que tiene habilitados; si abre la dirección de uno deshabilitado verá «Sin acceso». Resumen operativo y
        Solicitudes y revisiones van siempre. Solo el rol webmaster cambia módulos, y cada cambio queda en la Auditoría.
      </p>

      <app-selector-segmentado [opciones]="vistas()" [elegida]="vista()" etiquetaDelGrupo="Ver los módulos por módulo o por gestor"
        (elegir)="cambiarVista($event)" />

      <p class="mg__estado" [class.es-error]="hayError()" role="status" aria-live="polite" data-estado-de-cambio>{{ aviso() }}</p>

      @if (cargando()) {
        <app-estado-de-lista tipo="cargando" titulo="Consultando los módulos de cada gestor…" />
      } @else if (errorDeCarga()) {
        <app-estado-de-lista tipo="error" titulo="No fue posible leer los módulos de los gestores" [detalle]="errorDeCarga()">
          <app-boton importancia="secundaria" tamano="menudo" (accion)="cargar()">Reintentar</app-boton>
        </app-estado-de-lista>
      } @else if (vista() === 'modulos') {
        <app-tabla-de-gestion etiqueta="Módulos del gestor, por módulo" [columnas]="columnasDeModulo" [filas]="filasDeModulo()" [clave]="claveDeModulo"
          [orden]="ordenDeModulo()" (ordenar)="ordenDeModulo.set(alternar(ordenDeModulo(), $event))"
          [acciones]="accionesDeModulo" [descripcionDeFila]="nombreDeModulo" (accion)="alAccionDeModulo($event)"
          filaAbre (abrir)="abrirModulo($event.modulo.codigo)" [atributosDeFila]="atributosDeModulo">
          <ng-template appCelda="modulo" let-f>
            <p class="tg-rotulo">{{ f.modulo.grupoTitulo }}</p>
            <button type="button" class="tg-titulo" (click)="abrirModulo(f.modulo.codigo)">{{ f.modulo.nombre }}</button>
            <p class="tg-detalle">{{ f.modulo.descripcion }}</p>
          </ng-template>
          <ng-template appCelda="quien" let-f>
            @if (f.modulo.fijo) { <span class="mg__nota">Siempre, para todos</span> }
            @else { <b>{{ f.conAcceso }}</b> de {{ f.total }} {{ f.total === 1 ? 'gestor' : 'gestores' }} }
          </ng-template>
        </app-tabla-de-gestion>
      } @else {
        <app-barra-de-herramientas etiqueta="Buscar gestores" [mostradas]="filasDeGestor().length" [total]="totalDeGestores()"
          [hayFiltros]="busqueda().length > 0" (quitarFiltros)="busqueda.set('')">
          <app-buscador-de-lista identificador="buscar-gestor" etiqueta="Buscar gestor" marcador="Buscar por nombre o correo…"
            [espera]="0" [valor]="busqueda()" (cambiar)="busqueda.set($event)" />
        </app-barra-de-herramientas>
        @if (filasDeGestor().length === 0) {
          <app-estado-de-lista tipo="vacio"
            [titulo]="totalDeGestores() === 0 ? 'Todavía no hay cuentas de Gestor' : 'Ningún gestor coincide con la búsqueda'"
            [detalle]="totalDeGestores() === 0 ? 'Las cuentas de Gestor interno se crean desde «Administrativas» con «Nuevo usuario».' : null" />
        } @else {
          <app-tabla-de-gestion etiqueta="Módulos del gestor, por gestor" [columnas]="columnasDeGestor" [filas]="filasDeGestor()" [clave]="claveDeGestor"
            [orden]="ordenDeGestor()" (ordenar)="ordenDeGestor.set(alternar(ordenDeGestor(), $event))"
            [acciones]="accionesDeGestor" [descripcionDeFila]="nombreDeGestor" (accion)="alAccionDeGestor($event)"
            filaAbre (abrir)="abrirGestor($event.cuenta.id)" [atributosDeFila]="atributosDeGestor">
            <ng-template appCelda="gestor" let-f>
              <button type="button" class="tg-titulo" (click)="abrirGestor(f.cuenta.id)">{{ f.cuenta.nombre || f.cuenta.correo }}</button>
              <p class="tg-detalle">{{ f.cuenta.correo }}@if (!f.cuenta.activa) { · Cuenta desactivada }</p>
            </ng-template>
            <ng-template appCelda="perfil" let-f>{{ f.perfil }}</ng-template>
            <ng-template appCelda="modulos" let-f><b>{{ f.concedidos }}</b> de {{ total }}</ng-template>
          </app-tabla-de-gestion>
        }
      }

      @if (seleccion(); as sel) {
        @if (sel.tipo === 'modulo') {
          @if (moduloAbierto(); as modulo) {
            <app-panel-lateral [titulo]="modulo.nombre" contexto="Quién tiene este módulo" (cerrar)="cerrar()" ancho="ancho">
              <p class="mg__detalle">{{ modulo.descripcion }}</p>
              @if (modulo.fijo) {
                <p class="mg__nota" data-modulo-fijo>Lo tienen todas las cuentas de la consola y no se puede quitar.</p>
              } @else {
                <p class="mg__aparte" data-resumen-del-modulo>
                  <b>{{ cuantosTienenElAbierto() }}</b> de {{ gestoresDe().length }}
                  {{ gestoresDe().length === 1 ? 'gestor lo tiene' : 'gestores lo tienen' }}.
                  @if (webmasters() > 0) { {{ webmasters() }} {{ webmasters() === 1 ? 'webmaster lo tiene' : 'webmasters lo tienen' }} siempre. }
                </p>
                <ul class="mg__lista">
                  @for (g of gestoresDe(); track g.id) {
                    <li>
                      <span class="mg__texto">
                        <span class="mg__nombre">{{ g.nombre || g.correo }}</span>
                        <span class="mg__detalle">{{ g.correo }}@if (!g.activa) { · Cuenta desactivada }</span>
                      </span>
                      <app-interruptor [activo]="g.modulos.includes(modulo.codigo)" [ocupado]="ocupado(g.id, modulo.codigo)"
                        [etiqueta]="modulo.nombre + ' para ' + (g.nombre || g.correo)" [attr.data-cuenta]="g.id"
                        (cambiar)="cambiar(g, modulo, $event)" />
                    </li>
                  } @empty {
                    <li><span class="mg__detalle">Todavía no hay cuentas de Gestor.</span></li>
                  }
                </ul>
              }
            </app-panel-lateral>
          }
        } @else {
          @if (gestorAbierto(); as gestor) {
            <app-panel-lateral [titulo]="gestor.nombre || gestor.correo" contexto="Módulos de este gestor" (cerrar)="cerrar()" ancho="ancho">
              <p class="mg__detalle">{{ gestor.correo }}@if (!gestor.activa) { · Cuenta desactivada }</p>
              <p class="mg__aparte" data-resumen-del-gestor>
                <b>{{ concedidosDe(gestor) }}</b> de {{ total }} módulos habilitados · {{ nombreDelPerfil(gestor.modulos) }}.
              </p>
              <p class="mg__aparte">Aplicar un perfil deja exactamente los módulos del perfil; después se puede ajustar uno a uno.</p>
              <div class="mg__perfiles">
                @for (p of perfiles; track p.id) {
                  <app-boton importancia="secundaria" tamano="menudo" [identificador]="'perfil-' + p.id"
                    [deshabilitado]="guardandoPerfil()" (accion)="aplicarPerfil(gestor, p)">{{ p.nombre }}</app-boton>
                }
                <app-boton importancia="terciaria" tamano="menudo" identificador="perfil-esencial"
                  [deshabilitado]="guardandoPerfil()" (accion)="aplicarPerfil(gestor, null)">Solo lo esencial</app-boton>
              </div>
              @for (grupo of gruposConcedibles; track grupo.id) {
                <p class="mg__familia">{{ grupo.titulo }}</p>
                <ul class="mg__lista">
                  @for (m of grupo.modulos; track m.codigo) {
                    <li>
                      <span class="mg__texto">
                        <span class="mg__nombre">{{ m.nombre }}</span>
                        <span class="mg__detalle">{{ m.descripcion }}</span>
                      </span>
                      <app-interruptor [activo]="gestor.modulos.includes(m.codigo)" [ocupado]="ocupado(gestor.id, m.codigo)"
                        [etiqueta]="m.nombre + ' para ' + (gestor.nombre || gestor.correo)" [attr.data-modulo]="m.codigo"
                        (cambiar)="cambiar(gestor, m, $event)" />
                    </li>
                  }
                </ul>
              }
              <p class="mg__aparte">Resumen operativo y Solicitudes y revisiones van siempre y no se pueden quitar.</p>
              <div class="mg__perfiles">
                <app-boton importancia="terciaria" tamano="menudo" identificador="abrir-ficha" (accion)="abrirFicha.emit(gestor.id)">Abrir la ficha de la cuenta</app-boton>
              </div>
            </app-panel-lateral>
          }
        }
      }
    </div>
  `,
})
export class AdminModulosDelGestorComponent {
  private readonly cuentas = inject(AdministracionDeCuentasService);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  /** Pide a la pantalla de usuarios abrir la ficha completa de la cuenta. */
  readonly abrirFicha = output<number>();

  /** Con los dos que van siempre, como cuenta la lista de cuentas («17 de 17»). */
  private readonly fijos = MODULOS_DEL_GESTOR.filter(m => m.fijo).length;
  readonly total = MODULOS_CONCEDIBLES.length + this.fijos;
  readonly perfiles = PERFILES_DE_MODULOS;
  readonly nombreDelPerfil = nombreDelPerfil;

  /** Los módulos concedibles, agrupados como la barra de la consola. */
  readonly gruposConcedibles = (() => {
    const grupos: { id: string; titulo: string; modulos: ModuloDelGestor[] }[] = [];
    for (const m of MODULOS_CONCEDIBLES) {
      let g = grupos.find(x => x.id === m.grupoId);
      if (!g) { g = { id: m.grupoId, titulo: m.grupoTitulo, modulos: [] }; grupos.push(g); }
      g.modulos.push(m);
    }
    return grupos;
  })();

  readonly vista = signal<Vista>('modulos');
  readonly seleccion = signal<Seleccion>(null);
  readonly busqueda = signal('');
  readonly cargando = signal(true);
  readonly errorDeCarga = signal<string | null>(null);
  readonly aviso = signal('');
  readonly hayError = signal(false);
  readonly guardandoPerfil = signal(false);
  private readonly resumen = signal<CuentaConModulos[]>([]);
  private readonly enCurso = signal<ReadonlySet<string>>(new Set());

  // AL ENTRAR, EN EL ORDEN DE LA BARRA de la consola (ninguna columna lo declara): quien busca un módulo lo busca donde lo ve.
  readonly ordenDeModulo = signal<EstadoDeOrden>({ columna: 'barra', direccion: 'asc' });
  readonly ordenDeGestor = signal<EstadoDeOrden>({ columna: 'gestor', direccion: 'asc' });
  readonly alternar = alternarOrden;

  readonly vistas = computed<readonly OpcionSegmentada[]>(() => [
    { id: 'modulos', etiqueta: 'Por módulo' },
    { id: 'gestores', etiqueta: 'Por gestor', conteo: this.gestores().length },
  ]);

  /** Las cuentas de Gestor (los webmasters los tienen todos y no se cambian). */
  readonly gestores = computed(() => this.resumen().filter(c => !c.esWebmaster));
  readonly webmasters = computed(() => this.resumen().filter(c => c.esWebmaster).length);
  readonly gestoresDe = this.gestores;
  readonly totalDeGestores = computed(() => this.gestores().length);

  readonly columnasDeModulo: readonly ColumnaDeGestion[] = [
    { id: 'modulo', etiqueta: 'Módulo' },
    { id: 'quien', etiqueta: 'Quién lo tiene', ancho: 'media' },
  ];
  readonly columnasDeGestor: readonly ColumnaDeGestion[] = [
    { id: 'gestor', etiqueta: 'Gestor' },
    { id: 'perfil', etiqueta: 'Perfil', ancho: 'media' },
    { id: 'modulos', etiqueta: 'Módulos', ancho: 'corta' },
  ];

  private readonly ordenablesDeModulo: readonly ColumnaOrdenable<FilaDeModulo>[] = [
    { id: 'modulo', etiqueta: 'Módulo', tipo: 'texto', valor: f => f.modulo.nombre },
    { id: 'quien', etiqueta: 'Quién lo tiene', tipo: 'num', valor: f => (f.modulo.fijo ? Number.MAX_SAFE_INTEGER : f.conAcceso) },
  ];
  private readonly ordenablesDeGestor: readonly ColumnaOrdenable<FilaDeGestor>[] = [
    { id: 'gestor', etiqueta: 'Gestor', tipo: 'texto', valor: f => f.cuenta.nombre || f.cuenta.correo },
    { id: 'perfil', etiqueta: 'Perfil', tipo: 'texto', valor: f => f.perfil },
    { id: 'modulos', etiqueta: 'Módulos', tipo: 'num', valor: f => f.concedidos },
  ];

  readonly filasDeModulo = computed<FilaDeModulo[]>(() => {
    const gestores = this.gestores();
    const filas = MODULOS_DEL_GESTOR.filter(m => !m.soloWebmaster).map(modulo => ({
      modulo,
      total: gestores.length,
      conAcceso: modulo.fijo ? gestores.length : gestores.filter(g => g.modulos.includes(modulo.codigo)).length,
    }));
    return ordenarFilas(filas, this.ordenablesDeModulo, this.ordenDeModulo());
  });

  readonly filasDeGestor = computed<FilaDeGestor[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filas = this.gestores()
      .filter(c => !texto || `${c.nombre} ${c.correo}`.toLowerCase().includes(texto))
      .map(cuenta => ({ cuenta, perfil: nombreDelPerfil(cuenta.modulos), concedidos: this.concedidosDe(cuenta) }));
    return ordenarFilas(filas, this.ordenablesDeGestor, this.ordenDeGestor());
  });

  readonly moduloAbierto = computed(() => {
    const s = this.seleccion();
    return s?.tipo === 'modulo' ? moduloDelGestor(s.codigo) : undefined;
  });
  readonly cuantosTienenElAbierto = computed(() => {
    const codigo = this.moduloAbierto()?.codigo;
    return codigo ? this.gestores().filter(g => g.modulos.includes(codigo)).length : 0;
  });
  readonly gestorAbierto = computed(() => {
    const s = this.seleccion();
    return s?.tipo === 'gestor' ? this.resumen().find(c => c.id === s.id) : undefined;
  });

  readonly claveDeModulo = (f: FilaDeModulo) => f.modulo.codigo;
  readonly claveDeGestor = (f: FilaDeGestor) => f.cuenta.id;
  readonly nombreDeModulo = (f: FilaDeModulo) => f.modulo.nombre;
  readonly nombreDeGestor = (f: FilaDeGestor) => f.cuenta.nombre || f.cuenta.correo;
  readonly atributosDeModulo = (f: FilaDeModulo) => ({ 'data-modulo-fila': f.modulo.codigo });
  readonly atributosDeGestor = (f: FilaDeGestor) => ({ 'data-gestor-fila': String(f.cuenta.id) });
  readonly accionesDeModulo = (f: FilaDeModulo): readonly AccionDeFila[] => [{ id: 'ver', etiqueta: f.modulo.fijo ? 'Ver detalle' : 'Ver quién lo tiene' }];
  readonly accionesDeGestor = (_f: FilaDeGestor): readonly AccionDeFila[] => [
    { id: 'ver', etiqueta: 'Ver y cambiar sus módulos' },
    { id: 'ficha', etiqueta: 'Abrir la ficha de la cuenta' },
  ];

  constructor() { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.errorDeCarga.set(null);
    this.cuentas.cargarResumenDeModulos().subscribe({
      next: r => { this.resumen.set(r.cuentas); this.cargando.set(false); },
      error: () => { this.errorDeCarga.set('Intenta de nuevo en unos segundos; no se cambió ningún módulo.'); this.cargando.set(false); },
    });
  }

  cambiarVista(id: string): void {
    if (id === 'modulos' || id === 'gestores') { this.vista.set(id); this.seleccion.set(null); this.aviso.set(''); }
  }

  abrirModulo(codigo: string): void { this.seleccion.set({ tipo: 'modulo', codigo }); }
  abrirGestor(id: number): void { this.seleccion.set({ tipo: 'gestor', id }); }
  cerrar(): void { this.seleccion.set(null); }

  alAccionDeModulo(e: { fila: FilaDeModulo; accion: AccionElegida }): void { this.abrirModulo(e.fila.modulo.codigo); }
  alAccionDeGestor(e: { fila: FilaDeGestor; accion: AccionElegida }): void {
    if (e.accion.id === 'ficha') { this.abrirFicha.emit(e.fila.cuenta.id); } else { this.abrirGestor(e.fila.cuenta.id); }
  }

  concedidosDe(cuenta: CuentaConModulos): number {
    return MODULOS_CONCEDIBLES.filter(m => cuenta.modulos.includes(m.codigo)).length + this.fijos;
  }

  ocupado(id: number, codigo: string): boolean { return this.enCurso().has(`${id}|${codigo}`); }

  /** Habilita o deshabilita UN módulo. Quitar acceso se confirma; dar acceso no. */
  async cambiar(cuenta: CuentaConModulos, modulo: ModuloDelGestor, habilitar: boolean): Promise<void> {
    const quien = cuenta.nombre || cuenta.correo;
    if (!habilitar) {
      const respuesta = await this.confirmaciones.pedir({
        titulo: `Quitar «${modulo.nombre}» a ${quien}`,
        detalle: `${quien} dejará de ver este módulo en su menú y, si abre su dirección, verá «Sin acceso». El cambio queda en la Auditoría y se puede deshacer volviendo a habilitarlo.`,
        accion: 'Quitar acceso',
        tono: 'destructiva',
      });
      if (!respuesta) { return; }
    }
    const llave = `${cuenta.id}|${modulo.codigo}`;
    this.enCurso.update(s => new Set(s).add(llave));
    this.cuentas.cambiarModuloDeCuenta(cuenta.id, modulo.codigo, habilitar).subscribe({
      next: r => {
        this.actualizar(cuenta.id, r.modulos);
        this.liberar(llave);
        this.decir(`${habilitar ? 'Habilitado' : 'Deshabilitado'}: ${modulo.nombre} para ${quien}.`, false);
      },
      error: () => {
        this.liberar(llave);
        this.decir(`No fue posible cambiar «${modulo.nombre}» para ${quien}. Sigue como estaba.`, true);
      },
    });
  }

  /** Aplica un perfil (o «solo lo esencial» con `null`): deja exactamente esos módulos, en un solo guardado. */
  async aplicarPerfil(cuenta: CuentaConModulos, perfil: PerfilDeModulos | null): Promise<void> {
    const quien = cuenta.nombre || cuenta.correo;
    const destino = perfil ? perfil.modulos : [];
    const { quita, da } = diferenciaDeModulos(cuenta.modulos, destino);
    if (quita.length === 0 && da.length === 0) { this.decir(`${quien} ya tiene exactamente ese conjunto.`, false); return; }
    if (quita.length > 0) {
      const respuesta = await this.confirmaciones.pedir({
        titulo: `Aplicar «${perfil?.nombre ?? 'Solo lo esencial'}» a ${quien}`,
        detalle: `Se le quitará el acceso a: ${quita.map(c => moduloDelGestor(c)?.nombre ?? c).join(', ')}. El cambio queda en la Auditoría.`,
        accion: 'Quitar acceso y aplicar',
        tono: 'destructiva',
      });
      if (!respuesta) { return; }
    }
    const siempre = MODULOS_DEL_GESTOR.filter(m => m.fijo).map(m => m.codigo);
    this.guardandoPerfil.set(true);
    this.cuentas.guardarModulosDeCuenta(String(cuenta.id), [...siempre, ...destino]).subscribe({
      next: r => {
        this.actualizar(cuenta.id, r.modulos);
        this.guardandoPerfil.set(false);
        this.decir(`Listo: ${quien} ahora tiene «${perfil?.nombre ?? 'Solo lo esencial'}».`, false);
      },
      error: () => {
        this.guardandoPerfil.set(false);
        this.decir(`No fue posible aplicar el perfil a ${quien}. Sigue como estaba.`, true);
      },
    });
  }

  private actualizar(id: number, modulos: string[]): void {
    this.resumen.update(lista => lista.map(c => (c.id === id ? { ...c, modulos } : c)));
  }

  private liberar(llave: string): void {
    this.enCurso.update(s => { const n = new Set(s); n.delete(llave); return n; });
  }

  private decir(texto: string, error: boolean): void {
    this.hayError.set(error);
    this.aviso.set(texto);
  }
}
