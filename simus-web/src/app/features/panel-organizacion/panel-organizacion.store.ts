import { Injectable, computed, inject, signal } from '@angular/core';
import { ExternalSessionService, OrganizacionDeSesion } from '../../core/services/external-session.service';

/**
 * Qué organización está abierta en el panel, compartido por todas sus secciones.
 *
 * <b>SOLO ESTO, NO UN «GOD STORE» CON TODO EL ESTADO DEL PANEL.</b> Rediseño del 1 de septiembre de
 * 2026: `/gestion` pasó de una sola página con pestañas por query-param a un armazón con
 * rutas hijas de verdad (Resumen, Organización, Responsable, Ecosistema, Solicitudes, Cuenta y
 * seguridad). El patrón ya establecido en `SeccionOrganizacionComponent` -que nunca recibió
 * `responsable` por `@Input`, siempre lo pidió él mismo con `PanelOrganizacionApi`- es que cada
 * sección se alimenta sola; lo único que de verdad cruza las seis secciones es CUÁL organización
 * está abierta. `perfil`, `festivales`, `notificaciones` los pide cada sección que los necesita,
 * cuando los necesita.
 *
 * <b>Las organizaciones administradas no se piden aquí.</b> `ExternalSessionService.organizaciones`
 * ya las trae en la respuesta de la sesión -no hay una llamada aparte que repetir-. Cuál está
 * activa lo dice la URL: el armazón copia aquí el parámetro de su ruta.
 *
 * Provisto en `providers` de la ruta padre `gestion` (`app.routes.ts`): una sola instancia para
 * el armazón y las seis rutas hijas, que muere al salir de Gestión.
 */
/** El rol que responde por la organización (`RolesDeEntidad.Administrador` en el API). */
export const ROL_ADMINISTRADOR = 'administrador';

/**
 * La explicación breve que acompaña a una acción reservada a la administración.
 *
 * Un solo texto para todo el panel: la persona editora lee lo mismo en cada sección y sabe a quién
 * acudir.
 */
export const SOLO_ADMINISTRACION = 'Tu rol en esta organización es editor: puedes preparar y corregir borradores. '
  + 'Enviar a revisión, retirar, borrar, publicar y cambiar los datos de la organización lo hace quien la administra.';

@Injectable()
export class PanelOrganizacionStore {
  private readonly sesionExterna = inject(ExternalSessionService);

  readonly organizaciones = this.sesionExterna.organizaciones;

  /** Con una sola organización, un desplegable de una opción es un adorno que pide un clic de más. */
  readonly hayVariasOrganizaciones = computed(() => this.organizaciones().length > 1);

  /**
   * La organización abierta: la de la URL (`/gestion/o/{id}/…`), y solo si la cuenta es miembro.
   *
   * <b>LA ESCRIBE ÚNICAMENTE EL ARMAZÓN DEL PANEL</b> (`PanelOrganizacionPageComponent`), con el
   * parámetro de su ruta. Hasta este store elegía la primera organización
   * al entrar y el selector la cambiaba en memoria: recargar volvía a la primera y el asistente
   * abierto guardaba en la organización equivocada. Ninguna sección la cambia: para ir a otra
   * organización se navega a su dirección.
   */
  readonly organizacionId = signal('');

  /**
   * Un aviso para la próxima pantalla del panel, cuando una ficha abrió OTRA organización de la
   * cuenta porque el registro pedido era de ella («Cambiamos a …»). El armazón lo enseña y lo
   * vacía; vive aquí porque el armazón se reconstruye al cambiar de organización.
   */
  readonly avisoDeCambio = signal('');

  /**
   * El rol de la cuenta en la organización abierta, tal como lo trae la sesión.
   *
   * <b>UNA SOLA FUENTE PARA TODO EL PANEL.</b> El servidor responde 403 al editor en enviar,
   * retirar, borrar, publicar, proponer cambios, reclamar la administración, editar la
   * organización, ver o editar a la persona responsable y en todo lo de eventos salvo listarlos
   * (`AdministracionDeOrganizacion.PuedeAdministrarAsync`). Cada sección consulta
   * {@link esAdministradora} en vez de comparar el texto del rol por su cuenta.
   */
  readonly rol = computed<string>(() => this.organizacionElegida()?.role ?? '');

  /**
   * Si la cuenta administra la organización abierta.
   *
   * <b>NO ES UNA AUTORIZACIÓN.</b> Solo decide qué botones se ofrecen; quien decide de verdad es el
   * servidor en cada petición. Un rol desconocido o ausente se trata como editor: ofrecer un botón
   * que acaba en 403 es justo el defecto que se corrige.
   */
  readonly esAdministradora = computed(() => this.rol() === ROL_ADMINISTRADOR);

  organizacionElegida(): OrganizacionDeSesion | null {
    return this.organizaciones().find(item => item.id === this.organizacionId()) ?? null;
  }

  /** Si la cuenta es miembro de esa organización, según la sesión. */
  esMiembroDe(id: string): boolean {
    return !!id && this.organizaciones().some(organizacion => organizacion.id === id);
  }
}
