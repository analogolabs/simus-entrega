import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ExternalSessionService, OrganizacionDeSesion } from './external-session.service';
import { organizacionDeLaUrl } from '../navegacion/rutas-de-gestion';

/** Dónde se recuerda la última organización abierta, por cuenta. */
const CLAVE_ULTIMA_ORGANIZACION = 'simus.gestion.ultimaOrganizacion';

/** Dónde se recuerda cómo entró la persona la última vez (su espacio o una organización), por cuenta. */
const CLAVE_ULTIMO_MODO = 'simus.gestion.ultimoModo';

/** El valor de «Mi espacio» en la memoria del último modo. */
export const MODO_PERSONAL = 'persona';

/**
 * La organización activa, leída de la URL, para lo que vive FUERA del panel: la cabecera del
 * portal y las redirecciones de `/gestion`.
 *
 * <b>NO ES OTRA FUENTE DE VERDAD.</b> Solo lee la dirección (`/gestion/o/{id}/…`) cada vez que
 * termina una navegación. Dentro del panel manda `PanelOrganizacionStore`, que se alimenta del
 * mismo parámetro de ruta; la cabecera ya no lee «la primera organización de la sesión», que era
 * la causa de que título, selector y botón de cuenta mostraran tres organizaciones distintas.
 *
 * <b>LA ÚLTIMA ORGANIZACIÓN SE RECUERDA SOLO PARA ELEGIR DESTINO</b> cuando una dirección no la
 * dice (`/gestion`, una dirección antigua, el botón «Gestión»). Se guarda por cuenta y se valida
 * contra la sesión: si la cuenta dejó esa organización, se toma la primera.
 */
@Injectable({ providedIn: 'root' })
export class ContextoDeOrganizacionService {
  private readonly router = inject(Router);
  private readonly sesionExterna = inject(ExternalSessionService);

  /** El id de la organización en la URL actual, o `''` fuera del panel. */
  readonly organizacionId = signal(organizacionDeLaUrl(this.router.url) ?? '');

  /** La organización de la URL, si la cuenta es miembro. */
  readonly organizacionActiva = computed<OrganizacionDeSesion | null>(() => {
    const id = this.organizacionId();
    return id ? this.sesionExterna.organizaciones().find(organizacion => organizacion.id === id) ?? null : null;
  });

  constructor() {
    this.router.events.pipe(filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd))
      .subscribe(evento => this.organizacionId.set(organizacionDeLaUrl(evento.urlAfterRedirects) ?? ''));
  }

  /** Anota la organización que la persona acaba de abrir, para volver a ella. */
  recordar(organizacionId: string): void {
    const cuenta = this.sesionExterna.actual()?.userId;
    if (!cuenta || !organizacionId) return;
    try {
      localStorage.setItem(`${CLAVE_ULTIMA_ORGANIZACION}.${cuenta}`, organizacionId);
      localStorage.setItem(`${CLAVE_ULTIMO_MODO}.${cuenta}`, organizacionId);
    } catch { /* sin almacenamiento */ }
  }

  /**
   * Anota que la persona entró en su espacio personal («Mi espacio»), para preseleccionar esa
   * tarjeta la próxima vez que vea la pantalla de entrada (ACC2). No cambia la organización por
   * omisión: «Gestión» sigue llevando a la última organización abierta.
   */
  /**
   * Borra la «última organización» y el «último modo» guardados si apuntan a `organizacionId`: la
   * cuenta ya no es miembro (la dejó, la quitaron, el enlace era ajeno). Sin esto, cada entrada a
   * `/gestion` volvería a intentar abrir una organización que el servidor responde 404.
   */
  olvidar(organizacionId: string): void {
    const cuenta = this.sesionExterna.actual()?.userId;
    if (!cuenta || !organizacionId) return;
    try {
      for (const clave of [CLAVE_ULTIMA_ORGANIZACION, CLAVE_ULTIMO_MODO]) {
        if (localStorage.getItem(`${clave}.${cuenta}`) === organizacionId) localStorage.removeItem(`${clave}.${cuenta}`);
      }
    } catch { /* sin almacenamiento */ }
  }

  recordarModoPersonal(): void {
    const cuenta = this.sesionExterna.actual()?.userId;
    if (!cuenta) return;
    try { localStorage.setItem(`${CLAVE_ULTIMO_MODO}.${cuenta}`, MODO_PERSONAL); } catch { /* sin almacenamiento */ }
  }

  /**
   * Cómo entró la persona la última vez: `'persona'` (su espacio) o el id de una organización que
   * sigue siendo suya. `null` si no hay registro. Solo sirve para preseleccionar una tarjeta: la
   * pantalla de entrada se muestra siempre en un inicio de sesión nuevo.
   */
  modoRecordado(): string | null {
    const cuenta = this.sesionExterna.actual()?.userId;
    if (!cuenta) return null;
    let modo: string | null = null;
    try { modo = localStorage.getItem(`${CLAVE_ULTIMO_MODO}.${cuenta}`); } catch { return null; }
    if (modo === MODO_PERSONAL) return MODO_PERSONAL;
    return this.sesionExterna.organizaciones().some(organizacion => organizacion.id === modo) ? modo : null;
  }

  /**
   * La organización a la que se va cuando la dirección no dice cuál: la última abierta si sigue
   * siendo de la cuenta, o la primera. `null` si la cuenta no responde por ninguna.
   */
  porDefecto(): OrganizacionDeSesion | null {
    const organizaciones = this.sesionExterna.organizaciones();
    if (!organizaciones.length) return null;
    const cuenta = this.sesionExterna.actual()?.userId;
    let recordada: string | null = null;
    try { recordada = cuenta ? localStorage.getItem(`${CLAVE_ULTIMA_ORGANIZACION}.${cuenta}`) : null; } catch { /* sin almacenamiento */ }
    const valida = organizaciones.find(organizacion => organizacion.id === recordada);
    // Una guardada que ya no es válida se limpia al descubrirlo, no se arrastra para siempre.
    if (!valida && recordada) this.olvidar(recordada);
    return valida ?? organizaciones[0];
  }
}
