import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, Routes, UrlMatchResult, UrlSegment, UrlTree } from '@angular/router';
import { sesionExternaGuard } from './core/guards/sesion-externa.guard';
import { emparejaSeccionSinOrganizacion, haciaLaOrganizacionPorDefecto } from './core/guards/organizacion-por-defecto.guard';
import { organizacionPropiaGuard } from './core/guards/organizacion-propia.guard';
import { historicosHaciaLaHerramienta } from './core/guards/historicos-hacia-la-herramienta.guard';
import { listaPorTipoHaciaLaListaUnica } from './core/guards/lista-por-tipo-hacia-la-lista-unica.guard';
import { confirmarSalida } from './core/navegacion/cambio-de-organizacion';
import { RECREAR_AL_CAMBIAR_PARAMETROS } from './core/navegacion/reutilizacion-de-rutas';
import { PanelOrganizacionApi } from './features/panel-organizacion/panel-organizacion.api';
import { PanelOrganizacionService } from './features/panel-organizacion/panel-organizacion.service';
import { PanelOrganizacionStore } from './features/panel-organizacion/panel-organizacion.store';
import { PortalLayoutComponent } from './shared/components/layout/portal-layout/portal-layout.component';
import { environment } from '../environments/environment';
import { marcarSinPrecarga } from './core/precarga-de-rutas';

/**
 * Empareja `/administracion`, `/administracion/<seccion>`, `/administracion/<seccion>/<id>` y
 * `/administracion/<seccion>/<id>/<vista>` con una unica entrada de ruta.
 *
 * Devuelve `seccion`, `id` y `vista` como parametros; la seccion se llama igual que cuando la ruta
 * era `administracion/:seccion`, para que nada de lo que lee `paramMap` tenga que cambiar. LA FICHA
 * TIENE DIRECCION PROPIA: `/administracion/festivales/173` o
 * `/administracion/solicitudes/review-festivals-173/ficha`. Mas de cuatro segmentos no existen.
 */
export function emparejaLaConsolaAdministrativa(segmentos: UrlSegment[]): UrlMatchResult | null {
  if (segmentos.length === 0 || segmentos[0].path !== 'administracion') { return null; }
  if (segmentos.length > 4) { return null; }
  if (segmentos.length === 1) { return { consumed: segmentos }; }
  const posParams: Record<string, UrlSegment> = { seccion: segmentos[1] };
  if (segmentos.length >= 3) { posParams['id'] = segmentos[2]; }
  if (segmentos.length === 4) { posParams['vista'] = segmentos[3]; }
  return { consumed: segmentos, posParams };
}

/**
 * ALIAS CORTOS DE LA CONSOLA: `/admin`, `/admin/<seccion>/…` y `/administrador/…` llevan a
 * `/administracion/…` conservando el resto de la dirección y los parámetros. Es una redirección de ruta, no una
 * segunda puerta: la dirección que queda en la barra es siempre la canónica.
 */
export const ALIAS_DE_LA_CONSOLA = ['admin', 'administrador'];

export function emparejaAliasDeLaConsola(segmentos: UrlSegment[]): UrlMatchResult | null {
  if (segmentos.length === 0 || !ALIAS_DE_LA_CONSOLA.includes(segmentos[0].path)) { return null; }
  return { consumed: segmentos };
}

export function haciaLaConsolaCanonica(): UrlTree {
  const router = inject(Router);
  const url = router.getCurrentNavigation()?.extractedUrl ?? router.parseUrl(router.url);
  const grupo = url.root.children['primary'];
  const resto = (grupo?.segments ?? []).slice(1).map(s => s.path);
  return router.createUrlTree(['/administracion', ...resto], { queryParams: url.queryParams, fragment: url.fragment ?? undefined });
}

/**
 * LAS TRES LISTAS PROPIAS DE MI ESPACIO (talleres, espacios, redes) YA NO EXISTEN COMO LISTAS: son la pestaña de su tipo en
 * `/gestion/cuenta/procesos`. Las direcciones de antes llevan allí (marcadores, enlaces guardados, avisos); las fichas
 * (`nuevo`, `:id`) conservan la suya.
 */
function haciaLaListaDeProcesosDeLaPersona(tipo: string): () => UrlTree {
  return () => inject(Router).createUrlTree(['/gestion/cuenta/procesos'], { queryParams: { tipo } });
}

/**
 * LAS PANTALLAS DEL PORTAL PÚBLICO. Viven bajo `PortalLayoutComponent`, que pone el único
 * `<main id="contenido-principal">` de la pantalla: la cabecera y el pie del portal quedan FUERA de él.
 */
export const rutasDelPortal: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
  },
  // EL PLAN: UNA PAGINA Y SUS FICHAS DE COMPONENTE. SIMUS es el sistema completo y el PNMC es una
  // sección del portal de segundo nivel. «Sobre el PNMC», «Ejes» y las dos estrategias se reunieron
  // en `/pnmc`; solo las fichas de componente conservan dirección propia.
  {
    path: 'pnmc',
    loadComponent: () => import('./features/pnmc/pages/sobre-el-pnmc-page/sobre-el-pnmc-page.component').then(m => m.SobreElPnmcPageComponent),
  },
  // Micrositio «Celebra la música» (P-4, L7): una edición por año; sin año abre la vigente. «Territorios sonoros» no tiene ruta.
  {
    path: 'pnmc/estrategias/celebra-la-musica',
    loadComponent: () => import('./features/pnmc/pages/celebra-la-musica-page/celebra-la-musica-page.component').then(m => m.CelebraLaMusicaPageComponent),
  },
  {
    path: 'pnmc/estrategias/celebra-la-musica/:anio',
    loadComponent: () => import('./features/pnmc/pages/celebra-la-musica-page/celebra-la-musica-page.component').then(m => m.CelebraLaMusicaPageComponent),
  },
  {
    path: 'pnmc/ejes/:componentSlug',
    loadComponent: () => import('./features/content/pages/component-detail-page/component-detail-page.component').then(m => m.ComponentDetailPageComponent),
  },
  // Las direcciones anteriores se publicaron y pueden estar guardadas: redirigen a su ancla.
  { path: 'ejes', pathMatch: 'full', redirectTo: () => inject(Router).parseUrl('/pnmc#ejes') },
  { path: 'ejes/:componentSlug', redirectTo: 'pnmc/ejes/:componentSlug' },
  { path: 'estrategia/circulacion', pathMatch: 'full', redirectTo: () => inject(Router).parseUrl('/pnmc#celebra-la-musica') },
  { path: 'estrategia/investigacion', pathMatch: 'full', redirectTo: () => inject(Router).parseUrl('/pnmc#territorios-sonoros') },
  {
    path: 'noticias',
    loadComponent: () => import('./features/news/pages/noticias-page/noticias-page.component').then(m => m.NoticiasPageComponent),
  },
  {
    // LA DIRECCION Y NO EL IDENTIFICADOR: la calcula el servidor del título al crear la noticia y
    // después no cambia, así que un enlace compartido sigue funcionando aunque se corrija una tilde.
    path: 'noticias/:slug',
    loadComponent: () => import('./features/news/pages/noticia-detalle-page/noticia-detalle-page.component').then(m => m.NoticiaDetallePageComponent),
  },
  {
    path: 'agenda',
    loadComponent: () => import('./features/agenda/pages/agenda-page/agenda-page.component').then(m => m.AgendaPageComponent),
  },
  {
    // CADA EVENTO TIENE SU DIRECCION: la del servidor, `/publico/agenda/{slug}`. El slug se
    // calcula del título al crear y no cambia, así que un enlace compartido sobrevive a una tilde corregida.
    path: 'agenda/:slug',
    loadComponent: () => import('./features/agenda/pages/evento-agenda-page/evento-agenda-page.component').then(m => m.EventoAgendaPageComponent),
  },
  {
    path: 'editorial',
    loadComponent: () => import('./features/editorial/pages/editorial-page/editorial-page.component').then(m => m.EditorialPageComponent),
    /*
      LA FICHA ES UNA RUTA HIJA, Y ESO NO ES UN DETALLE DE ESTILO.
      ==========================================================
      CADA OBRA TIENE SU DIRECCION: la signatura es como se cita una publicación, así que citarla
      tiene que llevar a su ficha, `/editorial/PNMC-ED-019`.

      PERO DECLARARLA COMO UNA SEGUNDA RUTA HERMANA LA CONVERTIA EN OTRA PANTALLA. Angular reutiliza
      el componente cuando se navega DENTRO de la misma definición de ruta, y lo DESTRUYE Y VUELVE A
      CREAR cuando se pasa de una a otra. Medido con el catálogo real:
      abrir una ficha volvía a pedir el acervo entero al API y a descargar VEINTIUNA portadas, y lo
      mismo al abrir la siguiente. En pantalla eso se ve como está descrito así: «cada vez que abro algún elemento se queda como sincronizando archivos y se recarga
      completamente».

      COMO HIJA SIN COMPONENTE, la página no se desmonta: solo cambia el parámetro. La dirección es
      la misma y el catálogo se queda donde estaba, con su desplazamiento y sus filtros.
    */
    children: [
      { path: ':codigo', children: [] },
    ],
  },

  {
    path: 'galeria',
    loadComponent: () => import('./features/gallery/pages/galeria-page/galeria-page.component').then(m => m.GaleriaPageComponent),
    // La pestaña (`fotos`, `videos`, `sin-album`) y el álbum abierto (`album/<slug>`) viajan en la dirección; la página los lee de ella.
    children: [
      { path: 'album/:slug', children: [] },
      { path: ':vista', children: [] },
    ],
  },
  {
    // LA SUBPAGINA VA ANTES QUE LA DEL MAPA: Angular resuelve por orden y `mapa-ecosistemico`
    // coincidiría primero si estuviera arriba, dejando esta ruta inalcanzable.
    path: 'mapa-ecosistemico/sobre-el-mapa',
    loadComponent: () => import('./features/map/pages/sobre-el-mapa-page/sobre-el-mapa-page.component').then(m => m.SobreElMapaPageComponent),
  },
  {
    path: 'mapa-ecosistemico',
    loadComponent: () => import('./features/map/pages/mapa-ecosistemico-page/mapa-ecosistemico-page.component').then(m => m.MapaEcosistemicoPageComponent),
  },
  {
    path: 'ecosistema/festivales/:festivalId',
    loadComponent: () => import('./features/ecosistema/pages/festival-publico-detalle-page/festival-publico-detalle-page.component').then(m => m.FestivalPublicoDetallePageComponent),
  },
  {
    path: 'ecosistema/festivales',
    loadComponent: () => import('./features/ecosistema/pages/festivales-publicos-page/festivales-publicos-page.component').then(m => m.FestivalesPublicosPageComponent),
  },
  // MERCADOS MUSICALES, al mismo nivel que Festivales: son dos procesos del Ecosistema y la ruta
  // lo dice. `ecosistema/mercados-musicales` y `ecosistema/festivales` son hermanas.
  // EL PROCESO SE LLAMA «MERCADOS MUSICALES» Y LA RUTA TAMBIEN.
  //
  // Se registró como `ecosistema/mercados` y el resto del proyecto ya
  // había fijado el nombre completo: el menú del portal enlazaba `ecosistema/mercados-musicales`
  // —que no existía, así que caía en «no encontrado»— y el propio catálogo de categorías lo
  // declaraba así en su comentario, junto a `practicas-musicales` y `territorios-sonoros`, que son
  // sus hermanas. Lo reportó la dirección de producto entrando por esa dirección.
  //
  // La forma corta se conserva como REDIRECCION porque se publicó: los enlaces de la ficha de un
  // festival y los que alguien haya copiado siguen llegando.
  {
    path: 'ecosistema/mercados-musicales/:mercadoId',
    loadComponent: () => import('./features/ecosistema/pages/mercado-publico-detalle-page/mercado-publico-detalle-page.component').then(m => m.MercadoPublicoDetallePageComponent),
  },
  { path: 'ecosistema/mercados-musicales', loadComponent: () => import('./features/ecosistema/pages/mercados-publicos-page/mercados-publicos-page.component').then(m => m.MercadosPublicosPageComponent) },
  { path: 'ecosistema/mercados/:mercadoId', redirectTo: 'ecosistema/mercados-musicales/:mercadoId' },
  { path: 'ecosistema/mercados', pathMatch: 'full', redirectTo: 'ecosistema/mercados-musicales' },
  // LUTERÍA: el directorio de talleres y su ficha. Se publican solo los talleres aprobados por el Programa.
  {
    path: 'ecosistema/luteria/:tallerId',
    loadComponent: () => import('./features/ecosistema/pages/taller-publico-detalle-page/taller-publico-detalle-page.component').then(m => m.TallerPublicoDetallePageComponent),
  },
  { path: 'ecosistema/luteria', loadComponent: () => import('./features/ecosistema/pages/talleres-publicos-page/talleres-publicos-page.component').then(m => m.TalleresPublicosPageComponent) },
  // AGENDA DE CITAS DE LOS MERCADOS (docs/referencia/26-agenda-de-citas-y-mercados.md): qué Mercados la tienen abierta y cómo inscribirse. No enseña a ninguna persona.
  {
    path: 'ecosistema/agenda-de-citas',
    loadComponent: () => import('./features/ecosistema/pages/agendas-de-citas-publicas-page/agendas-de-citas-publicas-page.component').then(m => m.AgendasDeCitasPublicasPageComponent),
    title: 'Agenda de citas · SIMUS',
  },
  // ESPACIOS PARA MÚSICA EN VIVO: el directorio y su ficha. Se publican solo los espacios aprobados por el Programa.
  {
    path: 'ecosistema/espacios/:espacioId',
    loadComponent: () => import('./features/ecosistema/pages/espacio-publico-detalle-page/espacio-publico-detalle-page.component').then(m => m.EspacioPublicoDetallePageComponent),
  },
  { path: 'ecosistema/espacios', loadComponent: () => import('./features/ecosistema/pages/espacios-publicos-page/espacios-publicos-page.component').then(m => m.EspaciosPublicosPageComponent) },
  // REDES Y DOCUMENTACIÓN: el directorio de redes y centros de documentación y su ficha. Se publican solo las aprobadas por el Programa.
  {
    path: 'ecosistema/redes/:redId',
    loadComponent: () => import('./features/ecosistema/pages/red-publica-detalle-page/red-publica-detalle-page.component').then(m => m.RedPublicaDetallePageComponent),
  },
  { path: 'ecosistema/redes', loadComponent: () => import('./features/ecosistema/pages/redes-publicas-page/redes-publicas-page.component').then(m => m.RedesPublicasPageComponent) },
  { path: 'ecosistema/territorios-sonoros', loadComponent: () => import('./features/ecosistema/pages/territorios-sonoros-page/territorios-sonoros-page.component').then(m => m.TerritoriosSonorosPageComponent) },
  { path: 'ecosistema/territorios-sonoros/:slug', loadComponent: () => import('./features/ecosistema/pages/territorio-sonoro-detalle-page/territorio-sonoro-detalle-page.component').then(m => m.TerritorioSonoroDetallePageComponent) },
  { path: 'ecosistema/practicas-musicales', loadComponent: () => import('./features/ecosistema/pages/practicas-musicales-page/practicas-musicales-page.component').then(m => m.PracticasMusicalesPageComponent) },
  { path: 'ecosistema/practicas-musicales/:slug', loadComponent: () => import('./features/ecosistema/pages/practica-musical-detalle-page/practica-musical-detalle-page.component').then(m => m.PracticaMusicalDetallePageComponent) },
  {
    // ANONIMA PORQUE LA LEY LO OBLIGA. El art. 12 de la Ley 1581 de 2012 exige informar al titular
    // de las finalidades y de sus derechos ANTES de pedirle la autorización, y quien va a
    // registrarse todavía no tiene cuenta.
    path: 'politicas/:clave',
    loadComponent: () => import('./features/politicas/politica-page.component').then(m => m.PoliticaPageComponent),
    title: 'Políticas de datos · SIMUS',
  },
  {
    path: 'ecosistema',
    loadComponent: () => import('./features/ecosistema/pages/ecosistema-home-page/ecosistema-home-page.component').then(m => m.EcosistemaHomePageComponent),
  },
  {
    // EL DIRECTORIO DE AGENTES Y ACTORES DE LA MÚSICA (EC-3, EC-4; antes «Personas»): va antes de la ficha, que lleva la clave.
    path: 'ecosistema/personas',
    loadComponent: () => import('./features/ecosistema/pages/directorio-de-personas-page/directorio-de-personas-page.component').then(m => m.DirectorioDePersonasPageComponent),
    title: 'Directorio de agentes y actores · SIMUS',
  },
  {
    // ANONIMAS: el perfil publico de una persona y la ficha minima de una organizacion activa.
    path: 'ecosistema/personas/:clave',
    loadComponent: () => import('./features/ecosistema/pages/perfil-publico-page/perfil-publico-page.component').then(m => m.PerfilPublicoPageComponent),
    title: 'Perfil público · SIMUS',
  },
  {
    path: 'ecosistema/organizaciones/:id',
    loadComponent: () => import('./features/ecosistema/pages/organizacion-publica-page/organizacion-publica-page.component').then(m => m.OrganizacionPublicaPageComponent),
    title: 'Organización · SIMUS',
  },
  {
    // ANÓNIMA, como la confirmación de correo: quien abre una invitación puede no tener cuenta.
    path: 'ecosistema/invitacion',
    loadComponent: () => import('./features/ecosistema/pages/aceptar-invitacion-page/aceptar-invitacion-page.component').then(m => m.AceptarInvitacionPageComponent),
    title: 'Invitación · SIMUS',
  },
  {
    // ANÓNIMA, como la invitación a una organización: un comprador invitado puede no tener cuenta (docs/referencia/26-agenda-de-citas-y-mercados.md).
    path: 'ecosistema/invitacion-agenda',
    loadComponent: () => import('./features/ecosistema/pages/aceptar-invitacion-de-agenda-page/aceptar-invitacion-de-agenda-page.component').then(m => m.AceptarInvitacionDeAgendaPageComponent),
    title: 'Invitación a la agenda de citas · SIMUS',
  },
  {
    // ANONIMA A PROPOSITO: el enlace se abre desde el buzón, donde por definición no hay sesión.
    path: 'ecosistema/confirmar-correo',
    loadComponent: () => import('./features/ecosistema/pages/confirmar-correo-page/confirmar-correo-page.component').then(m => m.ConfirmarCorreoPageComponent),
  },
  {
    // ANONIMA A PROPOSITO (S-10, decisión 158): el enlace de la doble confirmación del boletín se abre desde el buzón.
    path: 'ecosistema/confirmar-boletin',
    loadComponent: () => import('./features/ecosistema/pages/confirmar-boletin-page/confirmar-boletin-page.component').then(m => m.ConfirmarBoletinPageComponent),
    title: 'Confirmar suscripción al boletín · SIMUS',
  },
  {
    // ANONIMA A PROPOSITO: el enlace «Darme de baja» de cada correo del boletín se abre desde el buzón, sin sesión. El testigo firmado es la credencial.
    path: 'ecosistema/baja-boletin',
    loadComponent: () => import('./features/ecosistema/pages/baja-boletin-page/baja-boletin-page.component').then(m => m.BajaBoletinPageComponent),
    title: 'Darme de baja del boletín · SIMUS',
  },
  {
    // ANONIMA A PROPOSITO: el enlace de «¿Olvidaste tu contraseña?» se abre desde el buzón,
    // donde por definición no hay sesión. El testigo del enlace es la credencial.
    path: 'ecosistema/restablecer-contrasena',
    loadComponent: () => import('./features/ecosistema/pages/restablecer-contrasena-page/restablecer-contrasena-page.component').then(m => m.RestablecerContrasenaPageComponent),
    title: 'Restablecer contraseña · SIMUS',
  },
  // `/colaboradores` SE RETIRO. Cargaba el MISMO armazon que
  // `/admin` en modo externo, es decir: era una segunda puerta de entrada para gente de
  // fuera, en paralelo a `/ecosistema/ingresar`. Dos puertas al mismo sitio se separan sin
  // que nadie lo note, y el error de acceso que sigue se lee como «mi contrasena no sirve».
  // SOLO DESARROLLO (UI-B): el catálogo de las primitivas de diseño —campo, selector, botón,
  // pestañas, chips y diálogo— con todos sus estados, para verlas juntas y medirlas. En producción
  // el entorno se sustituye (`environment.production`) y esta ruta NO EXISTE: `/desarrollo/…` cae en
  // «no encontrado» como cualquier dirección desconocida.
  ...(environment.production ? [] : [{
    path: 'desarrollo/componentes',
    loadComponent: () => import('./features/desarrollo/catalogo-de-componentes.page').then(m => m.CatalogoDeComponentesPage),
  }]),
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found-page.component').then(m => m.NotFoundPageComponent),
  },
];

/**
 * LAS PANTALLAS CON ARMAZÓN PROPIO (acceso, Mi espacio y panel de una organización, consola): traen
 * su cabecera y su navegación, y cada una declara su propio `<main id="contenido-principal">`.
 */
export const rutasConArmazonPropio: Routes = [
  // PANTALLA DE MANTENIMIENTO: a pantalla completa, sin cabecera ni pie (el portal puede no tener API que lo alimente).
  {
    path: 'mantenimiento',
    loadComponent: () => import('./features/mantenimiento/mantenimiento-page.component').then(m => m.MantenimientoPageComponent),
  },
  {
    path: 'registro',
    loadComponent: () => import('./features/external-access/external-access-page.component').then(m => m.ExternalAccessPageComponent),
    // Ruta pública propia para crear el acceso de una organización.
    data: { modoAcceso: 'registro' },
  },
  {
    path: 'ingresar',
    loadComponent: () => import('./features/external-access/external-access-page.component').then(m => m.ExternalAccessPageComponent),
    data: { modoAcceso: 'ingresar' },
  },
  // GESTIÓN: EL ESPACIO PRIVADO DE LA CUENTA Y DE SUS ORGANIZACIONES.
  //
  //   /gestion                      → la organización por omisión (o el espacio personal)
  //   /gestion/entrada              → «¿Cómo quieres entrar?», tras iniciar sesión (ACC2)
  //   /gestion/cuenta/…             → la persona: Mi espacio, organizaciones, perfil público, datos
  //   /gestion/o/{organizacionId}/… → el panel de UNA organización; la URL es la única fuente de
  //                                   verdad de cuál es la activa
  //   /gestion/<seccion>/…          → direcciones de antes: llevan a la misma sección de la
  //                                   organización por omisión
  {
    path: 'gestion',
    canActivate: [sesionExternaGuard],
    // EL PANEL SE CONSTRUYO CONTRA UNA CLASE ABSTRACTA para poder probarse sin red, y sin
    // este `provide` la ruta revienta con NullInjectorError. Es tambien lo que faltaba el
    // 27 de agosto: el componente estaba escrito y la ruta seguia cargando la pantalla
    // vieja, asi que en pantalla no cambiaba nada y nada fallaba.
    providers: [
      { provide: PanelOrganizacionApi, useExisting: PanelOrganizacionService },
      PanelOrganizacionStore,
    ],
    children: [
      { path: '', pathMatch: 'full', canActivate: [haciaLaOrganizacionPorDefecto], children: [] },
      {
        // «¿CÓMO QUIERES ENTRAR?» (ACC2): adónde se va tras iniciar sesión sin un destino pedido. Una cuenta
        // con organizaciones elige entre Mi espacio y cada una; una sin organización pasa a su espacio.
        path: 'entrada',
        loadComponent: () => import('./features/panel-organizacion/entrada-a-gestion-page.component').then(m => m.EntradaAGestionPageComponent),
      },
      {
        // EL ESPACIO «PERSONA»: lo de la cuenta, sin pestañas de organización.
        path: 'cuenta',
        loadComponent: () => import('./features/panel-organizacion/espacio-persona/espacio-persona-page.component').then(m => m.EspacioPersonaPageComponent),
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./features/panel-organizacion/espacio-persona/mi-espacio.component').then(m => m.MiEspacioComponent),
          },
          {
            // «MI ACTIVIDAD Y SOLICITUDES» (SOL): una sola lista para todos los tipos de proceso.
            path: 'solicitudes',
            loadComponent: () => import('./features/panel-organizacion/solicitudes/mi-actividad.component').then(m => m.MiActividadComponent),
          },
          {
            path: 'organizaciones',
            loadComponent: () => import('./features/panel-organizacion/espacio-persona/mis-organizaciones.component').then(m => m.MisOrganizacionesComponent),
          },
          {
            // Una cuenta puede administrar varias organizaciones (docs/desarrollo/19-cuentas-y-organizaciones.md). Se registra desde
            // la persona y no bajo la cabecera de otra organización.
            path: 'organizaciones/registrar',
            loadComponent: () => import('./features/panel-organizacion/registrar-organizacion.component').then(m => m.RegistrarOrganizacionComponent),
          },
          {
            // UNA SOLA LISTA DE PROCESOS PROPIOS (PANEL, decisión 126): Lutería, Espacios y Redes que la persona registra con su
            // cuenta, con pestañas por tipo; es el mismo componente que la lista del panel de una organización.
            path: 'procesos',
            data: { responsable: 'persona' },
            loadComponent: () => import('./features/panel-organizacion/procesos-gestion-page.component').then(m => m.ProcesosGestionPageComponent),
          },
          {
            // PERFIL PUBLICO: de la cuenta, no de la organizacion; nace oculto.
            path: 'perfil-publico',
            canDeactivate: [confirmarSalida],
            loadComponent: () => import('./features/panel-organizacion/seccion-perfil-publico.component').then(m => m.SeccionPerfilPublicoComponent),
          },
          {
            // DATOS PERSONALES Y SEGURIDAD, en dos pantallas (ME): lo privado de la persona, y su
            // contraseña y sus autorizaciones. Mismo componente; la vista sale de `data`.
            path: 'datos',
            data: { vista: 'datos' },
            loadComponent: () => import('./features/panel-organizacion/panel-cuenta-seguridad.component').then(m => m.PanelCuentaSeguridadComponent),
          },
          {
            // MIS AUTORIZACIONES, EN SU PROPIA PANTALLA: la contraseña y la seguridad son una cosa; retirar lo que se
            // autorizó sobre los datos propios es otra. Es la misma pieza que antes vivía dentro de «seguridad».
            path: 'autorizaciones',
            loadComponent: () => import('./features/panel-organizacion/mis-autorizaciones.component').then(m => m.MisAutorizacionesComponent),
          },
          { path: 'mis-autorizaciones', redirectTo: 'autorizaciones' },
          {
            path: 'seguridad',
            data: { vista: 'seguridad' },
            loadComponent: () => import('./features/panel-organizacion/panel-cuenta-seguridad.component').then(m => m.PanelCuentaSeguridadComponent),
          },
          {
            // MI AGENDA DE CITAS (docs/referencia/26-agenda-de-citas-y-mercados.md): las agendas de los Mercados en las que participo como
            // artista, representante o comprador invitado.
            path: 'agenda-de-citas',
            children: [
              { path: '', loadComponent: () => import('./features/panel-organizacion/espacio-persona/agenda-de-citas-persona.component').then(m => m.MisAgendasDeCitasComponent) },
              { path: ':agendaId', loadComponent: () => import('./features/panel-organizacion/espacio-persona/agenda-de-citas-persona.component').then(m => m.MiAgendaDeCitasComponent) },
            ],
          },
          // LA RUTA DE ANTES («Festivales históricos») SIGUE ABRIENDO: va a la de ahora con sus parámetros (decisión 129).
          { path: 'herramientas/festivales-historicos', pathMatch: 'full', redirectTo: 'herramientas/procesos-historicos' },
          {
            // PROCESOS HISTÓRICOS PARA QUIEN AÚN NO TIENE ORGANIZACIÓN: explica qué falta y ofrece los
            // dos caminos (D3-10). Con organizaciones, elige con cuál pedirlo.
            path: 'herramientas/procesos-historicos',
            loadComponent: () => import('./features/panel-organizacion/espacio-persona/procesos-historicos-persona.component').then(m => m.ProcesosHistoricosPersonaComponent),
          },
          {
            // EL ESPACIO DE UN RESPONSABLE INDEPENDIENTE: lo registra la persona con su cuenta, sin organización.
            path: 'espacios',
            children: [
              { path: '', canActivate: [haciaLaListaDeProcesosDeLaPersona('espacios')], children: [] },
              { path: 'nuevo', data: { responsable: 'persona' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-espacio-page.component').then(m => m.FichaDeEspacioPageComponent) },
              { path: ':id', data: { responsable: 'persona' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-espacio-page.component').then(m => m.FichaDeEspacioPageComponent) },
            ],
          },
          {
            // EL TALLER DE UN LUTIER INDEPENDIENTE: lo registra la persona con su cuenta, sin organización.
            path: 'talleres',
            children: [
              { path: '', canActivate: [haciaLaListaDeProcesosDeLaPersona('luteria')], children: [] },
              { path: 'nuevo', data: { responsable: 'persona' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-taller-page.component').then(m => m.FichaDeTallerPageComponent) },
              { path: ':id', data: { responsable: 'persona' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-taller-page.component').then(m => m.FichaDeTallerPageComponent) },
            ],
          },
          {
            // LOS EVENTOS DE SUS PROCESOS (LUT-01): lo que una persona sin organización anuncia sobre su
            // taller, su espacio o su red. La misma pantalla que la de una organización, con su alcance.
            path: 'eventos',
            data: { responsable: 'persona' },
            loadComponent: () => import('./features/panel-organizacion/panel-eventos.component').then(m => m.PanelEventosComponent),
          },
          {
            // LA RED DE UNA PERSONA: la registra con su cuenta, sin organización.
            path: 'redes',
            children: [
              { path: '', canActivate: [haciaLaListaDeProcesosDeLaPersona('redes')], children: [] },
              { path: 'nuevo', data: { responsable: 'persona' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-red-page.component').then(m => m.FichaDeRedPageComponent) },
              { path: ':id', data: { responsable: 'persona' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-red-page.component').then(m => m.FichaDeRedPageComponent) },
            ],
          },
        ],
      },
      {
        path: 'o/:organizacionId',
        canActivate: [organizacionPropiaGuard],
        loadComponent: () => import('./features/panel-organizacion/panel-organizacion-page.component').then(m => m.PanelOrganizacionPageComponent),
        // OTRA ORGANIZACIÓN, OTRO ARMAZÓN: nada de lo abierto en una pasa a la otra.
        data: { [RECREAR_AL_CAMBIAR_PARAMETROS]: true },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'resumen' },
          {
            path: 'resumen',
            loadComponent: () => import('./features/panel-organizacion/panel-resumen.component').then(m => m.PanelResumenComponent),
          },
          {
            path: 'organizacion',
            canDeactivate: [confirmarSalida],
            loadComponent: () => import('./features/panel-organizacion/seccion-organizacion.component').then(m => m.SeccionOrganizacionComponent),
          },
          {
            // /responsable REPETÍA el bloque «Persona responsable» de Datos de la organización y
            // ninguna pestaña quedaba activa: lleva a ese bloque.
            path: 'responsable',
            canActivate: [(ruta: ActivatedRouteSnapshot) => inject(Router).createUrlTree(
              ['/gestion/o', ruta.parent?.paramMap.get('organizacionId') ?? '', 'organizacion'], { fragment: 'responsable' })],
            children: [],
          },
          {
            // MIS ARCHIVOS. El mensaje de cuota pedía «retira material que ya no uses» y no había
            // ninguna forma de retirarlo ni de ver qué ocupaba el espacio.
            path: 'archivos',
            loadComponent: () => import('./features/panel-organizacion/seccion-archivos/seccion-archivos.component').then(m => m.SeccionArchivosComponent),
          },
          {
            // HERRAMIENTAS: lo que SIMUS ofrece a la organización aparte de sus procesos. La primera
            // es «Procesos históricos» (reclamar un proceso —Festival o Mercado— que ya estaba en SIMUS sin organización);
            // la agenda de citas de las ediciones de Mercado cuelga de aquí también (docs/referencia/26-agenda-de-citas-y-mercados.md).
            path: 'herramientas',
            children: [
              { path: '', loadComponent: () => import('./features/panel-organizacion/herramientas/seccion-herramientas.component').then(m => m.SeccionHerramientasComponent) },
              // LA RUTA DE ANTES («Festivales históricos») SIGUE ABRIENDO (decisión 129).
              { path: 'festivales-historicos', pathMatch: 'full', redirectTo: 'procesos-historicos' },
              { path: 'procesos-historicos', loadComponent: () => import('./features/panel-organizacion/herramientas/procesos-historicos-page.component').then(m => m.ProcesosHistoricosPageComponent) },
              { path: 'agenda-de-citas', pathMatch: 'full', loadComponent: () => import('./features/panel-organizacion/herramientas/agenda-de-citas-herramienta.component').then(m => m.AgendaDeCitasHerramientaComponent) },
              { path: 'agenda-de-citas/nueva/:edicionId', loadComponent: () => import('./features/panel-organizacion/herramientas/agenda-de-citas-organizacion.component').then(m => m.AgendaDeCitasOrganizacionComponent) },
              { path: 'agenda-de-citas/:agendaId', loadComponent: () => import('./features/panel-organizacion/herramientas/agenda-de-citas-organizacion.component').then(m => m.AgendaDeCitasOrganizacionComponent) },
            ],
          },
          {
            path: 'procesos/festivales',
            children: [
              // LOS ENLACES DE ANTES A «RECLAMAR» (`?reclamar=` y `#historicos`) LLEVAN A LA HERRAMIENTA.
              { path: '', canActivate: [historicosHaciaLaHerramienta], loadComponent: () => import('./features/panel-organizacion/seccion-ecosistema.component').then(m => m.SeccionEcosistemaComponent) },
              {
                // EL ASISTENTE QUEDA LIGADO A LA ORGANIZACIÓN DE SU URL: cambiarla con algo escrito
                // pregunta antes y lo escrito se queda como borrador de esta.
                path: 'nuevo',
                canDeactivate: [confirmarSalida],
                loadComponent: () => import('./features/panel-organizacion/asistente-de-festival.component').then(m => m.AsistenteDeFestivalComponent),
              },
              { path: ':id', loadComponent: () => import('./features/panel-organizacion/ficha-de-festival-page.component').then(m => m.FichaDeFestivalPageComponent) },
            ],
          },
          {
            // MERCADOS CUELGA DE `procesos`, COMO FESTIVALES. Son dos procesos del Ecosistema al mismo
            // nivel, y la ruta lo dice: `procesos/mercados` y `procesos/festivales` son hermanas.
            path: 'procesos/mercados',
            children: [
              // LA LISTA VA PRIMERO Y FALTABA. `procesos/festivales` tiene su ruta vacía desde el
              // principio; mercados no la tenía, así que la dirección del proceso —y la miga que
              // vuelve a ella desde la ficha— no llevaban a ningún sitio.
              { path: '', loadComponent: () => import('./features/panel-organizacion/seccion-mercados.component').then(m => m.SeccionMercadosComponent) },
              {
                path: 'nuevo',
                canDeactivate: [confirmarSalida],
                loadComponent: () => import('./features/panel-organizacion/asistente-de-mercado.component').then(m => m.AsistenteDeMercadoComponent),
              },
              {
                // LA AGENDA DE CITAS ES UNA HERRAMIENTA DEL MERCADO (docs/referencia/26-agenda-de-citas-y-mercados.md §26.15): cuelga de su ficha y se abre
                // a pantalla completa. `herramientas/agenda-de-citas/:agendaId` redirige aquí.
                path: ':id/agenda-de-citas/nueva/:edicionId',
                loadComponent: () => import('./features/panel-organizacion/herramientas/agenda-de-citas-organizacion.component').then(m => m.AgendaDeCitasOrganizacionComponent),
              },
              {
                path: ':id/agenda-de-citas/:agendaId',
                loadComponent: () => import('./features/panel-organizacion/herramientas/agenda-de-citas-organizacion.component').then(m => m.AgendaDeCitasOrganizacionComponent),
              },
              { path: ':id', loadComponent: () => import('./features/panel-organizacion/ficha-de-mercado-page.component').then(m => m.FichaDeMercadoPageComponent) },
            ],
          },
          {
            // LOS ESPACIOS PARA MÚSICA EN VIVO CUELGAN DE `procesos`, como Festivales, Mercados y Lutería. El mismo
            // formulario sirve al responsable independiente desde `/gestion/cuenta/espacios`.
            path: 'procesos/espacios',
            children: [
              // LA LISTA POR TIPO YA NO EXISTE: la lista única de procesos la cubre con el tipo como filtro.
              { path: '', pathMatch: 'full', data: { tipo: 'espacios' }, canActivate: [listaPorTipoHaciaLaListaUnica], children: [] },
              { path: 'nuevo', data: { responsable: 'organizacion' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-espacio-page.component').then(m => m.FichaDeEspacioPageComponent) },
              { path: ':id', data: { responsable: 'organizacion' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-espacio-page.component').then(m => m.FichaDeEspacioPageComponent) },
            ],
          },
          {
            // LOS TALLERES DE LUTERIA CUELGAN DE `procesos`, como Festivales y Mercados. El mismo
            // formulario sirve al lutier independiente desde `/gestion/cuenta/talleres`.
            path: 'procesos/luteria',
            children: [
              // LA LISTA POR TIPO YA NO EXISTE: la lista única de procesos la cubre con el tipo como filtro.
              { path: '', pathMatch: 'full', data: { tipo: 'luteria' }, canActivate: [listaPorTipoHaciaLaListaUnica], children: [] },
              { path: 'nuevo', data: { responsable: 'organizacion' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-taller-page.component').then(m => m.FichaDeTallerPageComponent) },
              { path: ':id', data: { responsable: 'organizacion' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-taller-page.component').then(m => m.FichaDeTallerPageComponent) },
            ],
          },
          {
            // LAS REDES Y CENTROS DE DOCUMENTACIÓN CUELGAN DE `procesos`, como Festivales, Mercados y Lutería. El mismo
            // formulario sirve a la persona responsable desde `/gestion/cuenta/redes`.
            path: 'procesos/redes',
            children: [
              // LA LISTA POR TIPO YA NO EXISTE: la lista única de procesos la cubre con el tipo como filtro.
              { path: '', pathMatch: 'full', data: { tipo: 'redes' }, canActivate: [listaPorTipoHaciaLaListaUnica], children: [] },
              { path: 'nuevo', data: { responsable: 'organizacion' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-red-page.component').then(m => m.FichaDeRedPageComponent) },
              { path: ':id', data: { responsable: 'organizacion' }, loadComponent: () => import('./features/panel-organizacion/ficha-de-red-page.component').then(m => m.FichaDeRedPageComponent) },
            ],
          },
          {
            path: 'procesos',
            loadComponent: () => import('./features/panel-organizacion/procesos-gestion-page.component').then(m => m.ProcesosGestionPageComponent),
          },
          {
            // EVENTOS DE LOS PROCESOS. Una organización no publica eventos sueltos en la agenda del
            // Programa: publica eventos de sus procesos, y si no tiene ninguno publicado, la pantalla
            // no ofrece el formulario y lo explica.
            path: 'eventos',
            loadComponent: () => import('./features/panel-organizacion/panel-eventos.component').then(m => m.PanelEventosComponent),
          },
          {
            path: 'solicitudes',
            loadComponent: () => import('./features/panel-organizacion/seccion-solicitudes.component').then(m => m.SeccionSolicitudesComponent),
          },
          {
            path: 'equipo',
            loadComponent: () => import('./features/panel-organizacion/seccion-equipo.component').then(m => m.SeccionEquipoComponent),
          },
        ],
      },
      // DIRECCIONES DE ANTES DE L2. Siguen funcionando: las de la persona van a su espacio y las de
      // la organización, a la misma sección de la organización por omisión.
      { path: 'cuenta-seguridad', redirectTo: 'cuenta/seguridad' },
      { path: 'mis-autorizaciones', redirectTo: 'cuenta/autorizaciones' },
      { path: 'perfil-publico', redirectTo: 'cuenta/perfil-publico' },
      { path: 'registrar-organizacion', redirectTo: 'cuenta/organizaciones/registrar' },
      { matcher: emparejaSeccionSinOrganizacion, canActivate: [haciaLaOrganizacionPorDefecto], children: [] },
    ],
  },
  { matcher: emparejaAliasDeLaConsola, canActivate: [haciaLaConsolaCanonica], children: [] },
  {
    // UNA SOLA ENTRADA DE RUTA PARA LA CONSOLA, Y ESO ES LO QUE ARREGLA. Antes habia dos
    // —`administracion` y `administracion/:seccion`— apuntando al mismo componente, y el
    // enrutador de Angular reutiliza la pantalla solo cuando la entrada de ruta es LA MISMA
    // (`shouldReuseRoute` compara `routeConfig` por identidad). Al entrar, `handleLogin` navega de
    // la primera a la segunda: el armazon se destruia y se volvia a construir con la sesion recien
    // abierta, lo que cancelaba la consulta de notificaciones en vuelo y recargaba la consola
    // entera. Comprobado: `ngOnDestroy` y `constructor` en el mismo
    // milisegundo, y un `net::ERR_ABORTED` sobre `/api/v1/notificaciones`.
    //
    // Se resuelve con un emparejador y no con una redireccion de `administracion` a
    // `administracion/resumen`, porque esa redireccion dejaria el formulario de acceso pintado
    // bajo una direccion que anuncia una seccion —el mismo defecto que se corrigio en el panel
    // externo, documentado en `sesion-externa.guard.spec.ts`—.
    matcher: emparejaLaConsolaAdministrativa,
    loadComponent: () => import('./features/admin/admin-shell-page/admin-shell-page.component').then(m => m.AdminShellPageComponent),
  },
];

// LA CONSOLA Y EL PANEL NO SE PRECARGAN (optimización, 20 nov 2026): el enrutador baja en segundo plano todo lo perezoso,
// también lo que cuelga de `gestion` y la consola de administración (1,1 MB), para cualquier visitante anónimo. Se marcan
// aquí, al final, para no tocar cada ruta ni sus hijas. El mapa se excluye por ruta en `PrecargaDeRutasPublicas`.
marcarSinPrecarga(rutasConArmazonPropio.filter(r => r.path === 'gestion' || r.matcher === emparejaLaConsolaAdministrativa || r.matcher === emparejaAliasDeLaConsola));

export const routes: Routes = [
  ...rutasConArmazonPropio,
  { path: '', component: PortalLayoutComponent, children: rutasDelPortal },
];

/** Todas las rutas sin el nivel del armazón: para las pruebas que buscan una dirección por su `path`. */
export const rutasPlanas: Routes = [...rutasConArmazonPropio, ...rutasDelPortal];
