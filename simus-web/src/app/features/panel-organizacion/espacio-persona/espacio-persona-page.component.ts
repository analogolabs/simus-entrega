import { Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ExternalSessionService } from '../../../core/services/external-session.service';
import { ContextoDeOrganizacionService } from '../../../core/services/contexto-de-organizacion.service';
import { ConfirmacionDeCorreoService } from '../../../core/services/confirmacion-de-correo.service';
import { RUTAS_DE_LA_CUENTA } from '../../../core/navegacion/rutas-de-gestion';
import { GrupoDeGestion } from '../../../core/navegacion/grupos-de-gestion';
import { ArmazonDeGestionComponent } from '../../../shared/components/layout/armazon-de-gestion/armazon-de-gestion.component';
import { CajonDeConsultaGuiadaComponent } from '../../../shared/components/consulta-guiada/cajon-de-consulta-guiada.component';
import { rutaSinAsistente } from '../../../core/navegacion/asistente-en-gestion';
import { DialogoDeCambioPendienteComponent } from '../../../shared/components/ui/dialogo-de-cambio-pendiente/dialogo-de-cambio-pendiente.component';

/**
 * La navegación del espacio «Persona», por grupos y con la MISMA forma que la del panel de la organización
 * (PANEL, decisión 126): primero el trabajo (inicio y solicitudes), luego los procesos y, al final, lo propio de la
 * cuenta. Las etiquetas de cada destino son las de siempre; cambian los grupos, que ahora se parecen a los del panel.
 */
export const GRUPOS_DE_LA_CUENTA: readonly GrupoDeGestion[] = [
  {
    id: 'trabajo', etiqueta: 'Trabajo',
    enlaces: [
      { ruta: 'inicio', comandos: [RUTAS_DE_LA_CUENTA.miEspacio], etiqueta: 'Inicio', icono: 'inicio', exacta: true, palabrasClave: ['resumen', 'estado de la cuenta', 'pendientes'] },
      { ruta: 'solicitudes', comandos: [RUTAS_DE_LA_CUENTA.solicitudes], etiqueta: 'Mi actividad y solicitudes', etiquetaCorta: 'Actividad', icono: 'solicitudes', palabrasClave: ['ajustes', 'revisión', 'trámites', 'respuestas', 'invitaciones'] },
    ],
  },
  {
    id: 'procesos', etiqueta: 'Mis procesos',
    enlaces: [
      // UNA SOLA LISTA con pestañas por tipo (talleres, espacios y redes), la misma que la del panel; las fichas cuelgan de ella.
      { ruta: 'procesos', comandos: [RUTAS_DE_LA_CUENTA.procesos], etiqueta: 'Procesos', icono: 'procesos',
        activoEn: [[RUTAS_DE_LA_CUENTA.talleres], [RUTAS_DE_LA_CUENTA.espacios], [RUTAS_DE_LA_CUENTA.redes]],
        palabrasClave: ['talleres', 'lutería', 'lutier', 'instrumentos', 'espacios', 'música en vivo', 'bar', 'sala', 'redes', 'documentación', 'archivo', 'fonoteca', 'registrar'] },
      { ruta: 'eventos', comandos: [RUTAS_DE_LA_CUENTA.eventos], etiqueta: 'Mis eventos', etiquetaCorta: 'Eventos', icono: 'eventos', palabrasClave: ['agenda', 'anunciar', 'conciertos', 'fechas'] },
    ],
  },
  {
    id: 'cuenta', etiqueta: 'Mi cuenta',
    enlaces: [
      { ruta: 'perfil-publico', comandos: [RUTAS_DE_LA_CUENTA.perfilPublico], etiqueta: 'Perfil público', icono: 'perfil', exacta: true, palabrasClave: ['biografía', 'oficios', 'publicar'] },
      { ruta: 'datos', comandos: [RUTAS_DE_LA_CUENTA.datos], etiqueta: 'Datos personales', icono: 'datos', exacta: true, palabrasClave: ['documento', 'teléfono', 'nombres'] },
      { ruta: 'seguridad', comandos: [RUTAS_DE_LA_CUENTA.seguridad], etiqueta: 'Contraseña y seguridad', icono: 'seguridad', exacta: true, palabrasClave: ['contraseña', 'cerrar sesión'] },
      { ruta: 'autorizaciones', comandos: [RUTAS_DE_LA_CUENTA.autorizaciones], etiqueta: 'Mis autorizaciones', icono: 'seguridad', exacta: true, palabrasClave: ['autorizaciones', 'datos', 'boletín', 'tratamiento'] },
      { ruta: 'organizaciones', comandos: [RUTAS_DE_LA_CUENTA.organizaciones], etiqueta: 'Mis organizaciones', icono: 'organizaciones', palabrasClave: ['registrar', 'invitaciones', 'panel'] },
      { ruta: 'agenda-de-citas', comandos: [RUTAS_DE_LA_CUENTA.agendaDeCitas], etiqueta: 'Agenda de citas', icono: 'agenda', palabrasClave: ['mercado', 'citas', 'agendamiento'] },
    ],
  },
];

/**
 * El espacio personal de la cuenta, en `/gestion/cuenta` (ME).
 *
 * <b>PANEL (decisión 126): EL MISMO ARMAZÓN QUE EL PANEL DE LA ORGANIZACIÓN.</b> Antes llevaba la barra pública, un
 * encabezado de persona con avatar y una caja de navegación al lado; ahora usa `app-armazon-de-gestion`:
 * cabecera con búsqueda y menú de cuenta, barra lateral con la identidad arriba («Mi espacio», el nombre y el correo),
 * grupos plegables y el contenido a todo el ancho. Pasar de Mi espacio a una organización cambia el contenido, no el sistema.
 *
 * <b>La campana también está aquí</b>: el primer aviso de una cuenta nueva —confirmar el correo— no
 * puede depender de tener organización.
 */
@Component({
  selector: 'app-espacio-persona-page',
  standalone: true,
  imports: [RouterOutlet, ArmazonDeGestionComponent, CajonDeConsultaGuiadaComponent, DialogoDeCambioPendienteComponent],
  template: `
    @if (sesion(); as cuenta) {
      <app-armazon-de-gestion
        pruebaId="espacio-de-la-persona" pruebaIdDeLaBarra="navegacion-de-la-cuenta" idDeLaBarra="navegacion-de-la-cuenta-lateral" prefijo="cuenta-"
        etiquetaDeLaBarra="Navegación de tu espacio" etiquetaDeLaNavegacion="Secciones de tu cuenta"
        [grupos]="grupos" clavePlegados="simus.cuenta.grupos-plegados"
        [organizacionId]="organizacionPorOmision()" [marcaA]="inicio" tituloDeLaMarca="Ir al inicio de Mi espacio" [sinOrganizacionActiva]="true" [nombreDeLaIdentidad]="cuenta.fullName">
        <div identidad class="identidad-de-gestion">
          <p class="identidad-de-gestion__rol">Mi espacio</p>
          <p class="identidad-de-gestion__nombre" data-testid="nombre-de-la-persona" [attr.title]="cuenta.fullName">{{ cuenta.fullName }}</p>
          <p class="identidad-de-gestion__dato" [attr.title]="cuenta.email">{{ cuenta.email }}</p>
        </div>
        <router-outlet></router-outlet>
        <div aparte>
          <!--
            EL ASISTENTE EN MI ESPACIO. La persona no tiene un motor de consultas propio (sus datos viven en cada pantalla), así que el
            Asistente responde con lo PÚBLICO —el mismo banco de preguntas anónimo del portal— y nada interno.
          -->
          <app-cajon-de-consulta-guiada [publica]="true" [ocultarLanzador]="sinAsistente()" />
        </div>
      </app-armazon-de-gestion>
    } @else { <main id="contenido-principal" tabindex="-1"><p role="status" class="py-16 text-center text-sm text-slate-500">Necesitas iniciar sesión para ver tu cuenta.</p></main> }
    <app-dialogo-de-cambio-pendiente />
  `,
})
export class EspacioPersonaPageComponent implements OnInit {
  private readonly sesionExterna = inject(ExternalSessionService);
  private readonly contexto = inject(ContextoDeOrganizacionService);
  private readonly confirmacion = inject(ConfirmacionDeCorreoService);
  private readonly router = inject(Router);
  readonly sinAsistente = rutaSinAsistente();

  readonly grupos = GRUPOS_DE_LA_CUENTA;
  readonly inicio = [RUTAS_DE_LA_CUENTA.miEspacio];
  readonly sesion = this.sesionExterna.actual;

  /** Los avisos de un proceso se abren en su organización; si no la dicen, en la habitual. */
  readonly organizacionPorOmision = computed(() => {
    this.sesionExterna.organizaciones();
    return this.contexto.porDefecto()?.id ?? '';
  });


  ngOnInit(): void {
    // Entrar a Mi espacio por cualquier puerta lo deja como el último modo (ACC2): la pantalla de entrada
    // preselecciona esa tarjeta la próxima vez. No cambia la organización por omisión.
    this.contexto.recordarModoPersonal();
    void this.confirmacion.asegurar();
    if (!this.sesionExterna.dentro()) {
      this.sesionExterna.refrescar().subscribe(sesion => { if (!sesion) void this.router.navigate(['/ingresar']); });
    }
  }
}
