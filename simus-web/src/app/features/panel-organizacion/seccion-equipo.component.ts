import { Component, computed, effect, inject, signal } from '@angular/core';
import { PanelDeSeccionComponent } from '../../shared/components/ui/panel-de-seccion/panel-de-seccion.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { ApiClientService } from '../../core/http/api-client.service';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { PeticionDeConfirmacion, ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { enfocarCampo } from '../../core/formularios/foco';
import { motivoDeLaAccion } from '../../core/formularios/traductor-de-errores';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { BarraDeHerramientasComponent } from '../../shared/components/ui/barra-de-herramientas/barra-de-herramientas.component';
import { BuscadorDeListaComponent } from '../../shared/components/ui/buscador/buscador-de-lista.component';
import { EstadoDeListaComponent } from '../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { OrdenDeListaComponent } from '../../shared/components/ui/orden-de-lista/orden-de-lista.component';
import { ColumnaOrdenable, EstadoDeOrden, alternarOrden, ordenarFilas } from '../../shared/components/ui/orden-de-lista/orden-de-lista';
import { CeldaDeTablaDirective, ColumnaDeGestion, TablaDeGestionComponent } from '../../shared/components/ui/tabla-de-gestion/tabla-de-gestion.component';
import { AccionDeFila, AccionElegida } from '../../shared/components/ui/tabla-de-gestion/acciones-de-fila.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';
export interface MiembroDeOrganizacion {
  usuarioId: string;
  nombre: string;
  correo: string;
  rol: string;
  desde: string;
  esUsted: boolean;
  cuentaActiva: boolean;
}

export interface InvitacionDeOrganizacion {
  id: string;
  correo: string;
  rol: string;
  estado: string;
  fechaEmision: string;
  fechaExpiracion: string;
  enlace?: string | null;
}

export interface EquipoDeOrganizacion {
  organizacionId: string;
  puedeAdministrar: boolean;
  miembros: MiembroDeOrganizacion[];
  invitaciones: InvitacionDeOrganizacion[];
}

function sinTildes(texto: string): string { return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

/**
 * «Equipo»: quién forma parte de la organización y con qué rol (docs/desarrollo/19-cuentas-y-organizaciones.md §19.3–§19.4).
 *
 * La pantalla no decide permisos: pinta lo que el servidor dice (`puedeAdministrar`) y muestra sus
 * mensajes cuando rechaza algo, como la regla del último administrador (409).
 *
 * <b>LAS PIEZAS DE P3 (prototipo B4).</b> Miembros e invitaciones se leen como tablas de gestión con la misma
 * columna «Acciones» que las demás listas: un solo menú por fila con «Cambiar rol», «Quitar del equipo» o «Salir de la
 * organización» (lo irreversible al final y en rojo, con su confirmación) y, en las invitaciones, «Generar enlace nuevo»
 * y «Revocar». Los miembros llevan buscador (nombre, correo o rol) y «Ordenar por»; no hay selector de rol suelto en la
 * fila. Las reglas no cambian: el último administrador no puede cambiar de rol ni salir, y se dice por qué.
 */
@Component({
  selector: 'app-seccion-equipo',
  standalone: true,
  imports: [PanelDeSeccionComponent, EsqueletoComponent, CampoDeSeleccionComponent, BotonNativoDirective, FechaPipe, CommonModule, FormsModule,
    BarraDeHerramientasComponent, BuscadorDeListaComponent, EstadoDeListaComponent, OrdenDeListaComponent, TablaDeGestionComponent, CeldaDeTablaDirective],
  templateUrl: './seccion-equipo.component.html',
})
export class SeccionEquipoComponent {
  /**
   * Qué puede hacer cada rol, dicho una sola vez y como lo comprueba el servidor (docs/desarrollo/19-cuentas-y-organizaciones.md §19.3).
   *
   * <b>SE ESCRIBE AQUI Y NO EN CADA PANTALLA.</b> Cada pantalla tenía su propia frase sobre
   * el rol y no coincidían entre sí. Las pantallas no ofrecen lo que el rol no puede hacer; esta
   * tabla es la explicación de conjunto.
   */
  readonly PERMISOS_POR_ROL: readonly { que: string; administracion: string; edicion: string }[] = [
    { que: 'Ver la organización, sus procesos y sus eventos', administracion: 'Sí', edicion: 'Sí' },
    { que: 'Crear y corregir borradores de Festivales, Mercados y ediciones; atender ajustes', administracion: 'Sí', edicion: 'Sí' },
    { que: 'Enviar a revisión, retirar o proponer cambios sobre lo publicado', administracion: 'Sí', edicion: 'No' },
    { que: 'Anunciar y editar eventos (se entregan al PNMC al crearlos)', administracion: 'Sí', edicion: 'No' },
    { que: 'Cambiar los datos de la organización y de su responsable', administracion: 'Sí', edicion: 'No' },
    { que: 'Invitar, cambiar roles y quitar miembros', administracion: 'Sí', edicion: 'No' },
    { que: 'Salir de la organización', administracion: 'Sí, salvo la última persona que administra', edicion: 'Sí' },
  ];

  private readonly http = inject(ApiClientService);
  private readonly store = inject(PanelOrganizacionStore);
  private readonly sesionExterna = inject(ExternalSessionService);
  private readonly router = inject(Router);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  readonly organizacionId = this.store.organizacionId;
  readonly equipo = signal<EquipoDeOrganizacion | null>(null);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly ocupado = signal(false);
  readonly correo = signal('');
  readonly rol = signal<'administrador' | 'editor'>('editor');
  readonly enlaceCreado = signal<string | null>(null);
  readonly copiado = signal(false);

  /** BUSCADOR Y ORDEN DE LOS MIEMBROS. Por omisión, por nombre de la A a la Z. */
  readonly busqueda = signal('');
  readonly orden = signal<EstadoDeOrden>({ columna: 'nombre', direccion: 'asc' });
  readonly alternarOrden = alternarOrden;

  readonly columnasDeMiembros: readonly ColumnaDeGestion[] = [
    { id: 'nombre', etiqueta: 'Nombre' },
    { id: 'rol', etiqueta: 'Rol', ancho: 'estado' },
  ];
  readonly columnasDeInvitaciones: readonly ColumnaDeGestion[] = [
    { id: 'correo', etiqueta: 'Correo y estado', ordenable: false },
    { id: 'rol', etiqueta: 'Rol', ancho: 'estado', ordenable: false },
  ];
  /** Lo que ofrece «Ordenar por» en Miembros (el nombre y el rol; la dirección se escribe con palabras). */
  readonly criteriosDeOrden: readonly ColumnaOrdenable<MiembroDeOrganizacion>[] = [
    { id: 'nombre', etiqueta: 'Nombre', tipo: 'texto', valor: m => m.nombre },
    { id: 'rol', etiqueta: 'Rol', tipo: 'texto', valor: m => this.etiquetaDeRol(m.rol) },
  ];

  /** Los miembros que coinciden con el buscador (nombre, correo o rol), en el orden elegido. */
  readonly miembrosVisibles = computed(() => {
    const q = sinTildes(this.busqueda());
    const todos = this.equipo()?.miembros ?? [];
    const coincidentes = q ? todos.filter(m => sinTildes(`${m.nombre} ${m.correo} ${this.etiquetaDeRol(m.rol)}`).includes(q)) : todos;
    return ordenarFilas(coincidentes, this.criteriosDeOrden, this.orden());
  });
  readonly claveDeMiembro = (m: MiembroDeOrganizacion): string => m.usuarioId;
  readonly claveDeInvitacion = (i: InvitacionDeOrganizacion): string => i.id;
  readonly nombreDeMiembro = (m: MiembroDeOrganizacion): string => m.nombre;
  readonly correoDeInvitacion = (i: InvitacionDeOrganizacion): string => i.correo;
  readonly atributosDeMiembro = (m: MiembroDeOrganizacion): Record<string, string | null> => ({ 'data-testid': 'fila-de-miembro', 'data-usuario': m.usuarioId });
  readonly atributosDeInvitacion = (i: InvitacionDeOrganizacion): Record<string, string | null> => ({ 'data-testid': 'fila-de-invitacion', 'data-invitacion': i.id });

  /**
   * LO QUE SE PUEDE HACER CON UN MIEMBRO, en su menú. Quien administra cambia el rol y quita a los demás; cada quien
   * puede salir. Un editor solo ve «Salir» en su propia fila: en las demás no hay menú. La única persona que administra
   * conserva «Cambiar a editor» y «Salir» APAGADOS con el motivo escrito: el servidor lo rechazaría con 409.
   */
  readonly accionesDeMiembro = (miembro: MiembroDeOrganizacion): readonly AccionDeFila[] => {
    const acciones: AccionDeFila[] = [];
    const ultima = this.esLaUltimaAdministradora(miembro);
    if (this.puedeAdministrar()) {
      const aEditor = miembro.rol === 'administrador';
      acciones.push({
        id: 'rol',
        etiqueta: aEditor ? 'Cambiar a editor' : 'Cambiar a administrador',
        deshabilitada: aEditor && ultima,
        motivo: aEditor && ultima ? this.MOTIVO_CORTO_DE_ULTIMA_ADMINISTRACION : undefined,
      });
    }
    if (miembro.esUsted) {
      acciones.push({ id: 'salir', etiqueta: 'Salir de la organización', tono: 'peligro', deshabilitada: ultima, motivo: ultima ? this.MOTIVO_CORTO_DE_ULTIMA_ADMINISTRACION : undefined, confirmacion: this.peticionDeSalir() });
    } else if (this.puedeAdministrar()) {
      acciones.push({ id: 'quitar', etiqueta: 'Quitar del equipo', tono: 'peligro', confirmacion: this.peticionDeQuitar(miembro) });
    }
    return acciones;
  };

  /** Lo que se puede hacer con una invitación pendiente: un enlace nuevo, o revocarla (irreversible: confirma). */
  readonly accionesDeInvitacion = (invitacion: InvitacionDeOrganizacion): readonly AccionDeFila[] => [
    { id: 'enlace', etiqueta: 'Generar enlace nuevo', tono: 'principal' },
    {
      id: 'revocar', etiqueta: 'Revocar la invitación', tono: 'peligro',
      confirmacion: {
        titulo: `Revocar la invitación a ${invitacion.correo}`,
        detalle: `El enlace que se le compartió deja de servir. Puedes crear otra invitación cuando quieras.`,
        accion: 'Revocar la invitación',
        tono: 'destructiva',
      },
    },
  ];

  alElegirAccionDeMiembro(miembro: MiembroDeOrganizacion, accion: AccionElegida): void {
    if (accion.id === 'rol') this.cambiarRol(miembro, miembro.rol === 'administrador' ? 'editor' : 'administrador');
    else if (accion.id === 'quitar') this.quitarConfirmado(miembro);
    else if (accion.id === 'salir') this.salirConfirmado();
  }

  alElegirAccionDeInvitacion(invitacion: InvitacionDeOrganizacion, accion: AccionElegida): void {
    if (accion.id === 'enlace') this.generarEnlaceNuevo(invitacion);
    else if (accion.id === 'revocar') this.revocar(invitacion);
  }

  /** El texto de la segunda línea de una invitación: «Pendiente · enviada el 18 nov · vence el 25 nov 2026». */
  estadoDeLaInvitacion(invitacion: InvitacionDeOrganizacion): string {
    return invitacion.estado === 'vencida' ? 'Vencida' : 'Pendiente';
  }

  readonly puedeAdministrar = computed(() => this.equipo()?.puedeAdministrar ?? false);

  /**
   * LA ÚNICA PERSONA QUE ADMINISTRA. El servidor rechaza con 409 que se quede la
   * organización sin administración; la pantalla lo anticipa: «Editor» y «Salir» se ofrecen apagados
   * con la explicación, en vez de dejar elegir lo imposible y fallar después.
   */
  esLaUltimaAdministradora(miembro: MiembroDeOrganizacion): boolean {
    const miembros = this.equipo()?.miembros ?? [];
    return miembro.rol === 'administrador'
      && miembros.filter(m => m.rol === 'administrador' && m.cuentaActiva).length <= 1;
  }

  readonly MOTIVO_ULTIMA_ADMINISTRACION =
    'Es la única persona que administra la organización. Nombra a otra antes de cambiar el rol o salir.';

  /** La misma razón, en una línea, para el motivo de una opción apagada del menú (la frase larga ya se lee bajo el nombre). */
  readonly MOTIVO_CORTO_DE_ULTIMA_ADMINISTRACION = 'Eres la única persona que administra. Nombra a otra primero.';

  private nombreDeLaOrganizacion(): string {
    return this.store.organizacionElegida()?.name ?? 'la organización';
  }

  constructor() {
    effect(() => {
      const id = this.organizacionId();
      if (id) this.cargar(id);
    });
  }

  etiquetaDeRol(rol: string): string {
    return rol === 'administrador' ? 'Administrador' : rol === 'editor' ? 'Editor' : rol;
  }

  cargar(id = this.organizacionId()): void {
    this.cargando.set(true);
    this.error.set('');
    this.http.get<EquipoDeOrganizacion>(`/api/v1/externo/organizaciones/${id}/equipo`, { errorFallback: 'No fue posible consultar el equipo.' }).subscribe({
      next: equipo => { this.equipo.set(equipo); this.cargando.set(false); },
      error: (e: unknown) => { this.error.set(this.mensaje(e, 'No fue posible consultar el equipo.')); this.cargando.set(false); },
    });
  }

  invitar(): void {
    const correo = this.correo().trim();
    if (!correo) { this.error.set('Escribe el correo de la persona que quieres invitar.'); return; }
    this.enviar<InvitacionDeOrganizacion>('post', `/equipo/invitaciones`, { correo, rol: this.rol() }, invitacion => {
      this.enlaceCreado.set(this.enlaceAbsoluto(invitacion.enlace ?? ''));
      this.copiado.set(false);
      this.correo.set('');
      this.aviso.set(`Invitación creada para ${invitacion.correo}. Copia el enlace y compártelo; vence en 7 días. Si lo pierdes, en «Invitaciones pendientes» puedes generar uno nuevo.`);
    });
  }

  /**
   * «Generar un enlace nuevo». De la invitación solo se guarda una huella, así que el
   * enlace de una pendiente no se puede volver a mostrar: se emite otro (el anterior deja de servir)
   * y se enseña ahora, con el foco en él para copiarlo.
   */
  generarEnlaceNuevo(invitacion: InvitacionDeOrganizacion): void {
    this.enviar<InvitacionDeOrganizacion>('post', `/equipo/invitaciones/${invitacion.id}/enlace-nuevo`, {}, nueva => {
      this.enlaceCreado.set(this.enlaceAbsoluto(nueva.enlace ?? ''));
      this.copiado.set(false);
      this.aviso.set(`Enlace nuevo para ${invitacion.correo}: el anterior ya no sirve y este vence en 7 días.`);
      enfocarCampo('enlace-invitacion');
    });
  }

  revocar(invitacion: InvitacionDeOrganizacion): void {
    this.enviar('delete', `/equipo/invitaciones/${invitacion.id}`, null, () => this.aviso.set(`Invitación a ${invitacion.correo} revocada.`));
  }

  cambiarRol(miembro: MiembroDeOrganizacion, rol: string): void {
    if (rol === miembro.rol) return;
    if (rol !== 'administrador' && this.esLaUltimaAdministradora(miembro)) {
      this.error.set(this.MOTIVO_ULTIMA_ADMINISTRACION);
      return;
    }
    this.enviar('put', `/equipo/miembros/${miembro.usuarioId}`, { rol }, () => {
      this.aviso.set(`${miembro.nombre} ahora es ${this.etiquetaDeRol(rol).toLowerCase()}.`);
      if (miembro.esUsted) this.sesionExterna.refrescar().subscribe();
    });
  }

  /** El diálogo de «Quitar del equipo»: dice a quién, de qué organización y qué pierde. */
  peticionDeQuitar(miembro: MiembroDeOrganizacion): PeticionDeConfirmacion {
    return {
      titulo: `Quitar a ${miembro.nombre} del equipo`,
      detalle: `${miembro.nombre} dejará de ver los procesos de ${this.nombreDeLaOrganizacion()} y no podrá actuar sobre ellos. ` +
        'Puedes volver a invitarla cuando quieras.',
      accion: 'Quitar del equipo',
      tono: 'destructiva',
    };
  }

  /** El diálogo de «Salir de la organización», con su nombre y la consecuencia. */
  peticionDeSalir(): PeticionDeConfirmacion {
    const organizacion = this.nombreDeLaOrganizacion();
    return {
      titulo: `Salir de ${organizacion}`,
      detalle: `Dejarás de ver los procesos, eventos y avisos de ${organizacion}. ` +
        'Para volver a entrar tendrá que invitarte quien la administra.',
      accion: 'Salir de la organización',
      tono: 'destructiva',
    };
  }

  /** Quitar del equipo pidiendo la confirmación aquí (el menú de la tabla la pide por su cuenta y llama a `quitarConfirmado`). */
  async quitar(miembro: MiembroDeOrganizacion): Promise<void> {
    if (!(await this.confirmaciones.pedir(this.peticionDeQuitar(miembro)))) return;
    this.quitarConfirmado(miembro);
  }

  quitarConfirmado(miembro: MiembroDeOrganizacion): void {
    this.enviar('delete', `/equipo/miembros/${miembro.usuarioId}`, null, () => this.aviso.set(`${miembro.nombre} ya no forma parte del equipo.`));
  }

  /** Salir de la organización, en el diálogo común. */
  async salir(): Promise<void> {
    const yo = this.equipo()?.miembros.find(m => m.esUsted);
    if (!yo) return;
    if (this.esLaUltimaAdministradora(yo)) { this.error.set(this.MOTIVO_ULTIMA_ADMINISTRACION); return; }
    if (!(await this.confirmaciones.pedir(this.peticionDeSalir()))) return;
    this.salirConfirmado();
  }

  salirConfirmado(): void {
    const yo = this.equipo()?.miembros.find(m => m.esUsted);
    if (!yo) return;
    if (this.esLaUltimaAdministradora(yo)) { this.error.set(this.MOTIVO_ULTIMA_ADMINISTRACION); return; }
    const organizacion = this.nombreDeLaOrganizacion();
    this.enviar('delete', `/equipo/miembros/${yo.usuarioId}`, null, () => {
      // EL MENSAJE POSTERIOR: sin él se llegaba a «Tu cuenta todavía no responde…» sin saber por qué.
      this.store.avisoDeCambio.set(`Saliste de «${organizacion}».`);
      this.sesionExterna.refrescar().subscribe(() => this.router.navigate(['/gestion']));
    }, false);
  }

  copiar(): void {
    const enlace = this.enlaceCreado();
    if (!enlace) return;
    navigator.clipboard?.writeText(enlace).then(() => this.copiado.set(true), () => this.copiado.set(false));
  }

  private enlaceAbsoluto(ruta: string): string {
    return ruta.startsWith('/') && typeof window !== 'undefined' ? `${window.location.origin}${ruta}` : ruta;
  }

  private enviar<T>(metodo: 'post' | 'put' | 'delete', ruta: string, cuerpo: unknown, alTerminar: (respuesta: T) => void, recargar = true, alFallar?: () => void): void {
    const id = this.organizacionId();
    if (!id || this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.aviso.set('');
    const url = `/api/v1/externo/organizaciones/${id}${ruta}`;
    this.http.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', { errorFallback: 'No fue posible preparar la solicitud.' }).pipe(
      switchMap(token => {
        const opciones = { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible guardar el cambio.' };
        return metodo === 'post' ? this.http.post<T>(url, cuerpo, opciones)
          : metodo === 'put' ? this.http.put<T>(url, cuerpo, opciones)
          : this.http.delete<T>(url, opciones);
      }),
    ).subscribe({
      next: respuesta => { this.ocupado.set(false); alTerminar(respuesta as T); if (recargar) this.cargar(id); },
      error: (e: unknown) => { this.ocupado.set(false); this.error.set(this.mensaje(e, 'No fue posible guardar el cambio.')); alFallar?.(); },
    });
  }

  private mensaje(e: unknown, alternativa: string): string {
    const cuerpo = (e as { payload?: { queFalta?: string; queHacer?: string } | null })?.payload;
    if (cuerpo?.queFalta) return `${cuerpo.queFalta} ${cuerpo.queHacer ?? ''}`.trim();
    return motivoDeLaAccion(e, alternativa);
  }
}
