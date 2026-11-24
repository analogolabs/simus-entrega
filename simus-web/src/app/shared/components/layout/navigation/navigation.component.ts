import { TextoWebPipe } from '../../../texto/texto-web.pipe';
import { Component, ElementRef, Input, inject, computed, signal, HostListener } from '@angular/core';
import { CATEGORIAS_ECOSISTEMA } from '../../../../core/services/categorias-ecosistema.config';
import { CommonModule } from '@angular/common';
import { esClicDeNavegacion } from '../../../../core/navegacion/clic-de-navegacion';
import { etiquetaDelRolEnOrganizacion } from '../../../../core/navegacion/rol-en-organizacion';
import { NavigationService, PAGE_IDS, PAGE_PATHS } from '../../../../core/services/navigation.service';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { ExternalSessionService } from '../../../../core/services/external-session.service';
import { ContextoDeOrganizacionService } from '../../../../core/services/contexto-de-organizacion.service';
import { ejesDataGlobal } from '../../../../core/services/ejes-data.config';
import { IconoFijoComponent } from '../../ui/icono-fijo/icono-fijo.component';

import { BotonNativoDirective } from '../../ui/boton/boton.component';
/** Una entrada del desplegable del Ecosistema: el proceso, su línea y a dónde lleva si lleva. */
interface EntradaDelMenuDelEcosistema {
  label: string;
  /** Todas las entradas llevan a un directorio que existe: lo que no existe se nombra aparte. */
  page: string;
  detail: string;
}

/**
 * El rótulo de una línea con que el menú anuncia cada proceso.
 *
 * SON MAS CORTOS QUE LA DESCRIPCION DEL CATALOGO a propósito: en el catálogo la descripción explica
 * el proceso, y aquí solo tiene que caber bajo el nombre sin partirse en tres líneas. Un proceso sin
 * entrada aquí cae a la descripción del catálogo, que siempre existe.
 */
const DETALLES_DEL_MENU: Record<string, string> = {
  'Espacios para música en vivo': 'Salas, teatros y lugares de música en vivo.',
  'Festivales': 'Circulación y celebración territorial.',
  'Mercados musicales': 'Nodos de intercambio y circulación.',
  'Redes y documentación': 'Memoria, investigación y archivos.',
  'Lutería': 'Saberes, oficios e instrumentos.',
};

/**
 * TERRITORIOS SONOROS Y PRÁCTICAS MUSICALES NO ESTÁN EN ESTE MENÚ, a propósito (decisión del usuario,
 * 12 nov 2026). Son catálogos transversales que se cruzan con los procesos, no procesos con registro
 * propio como Festivales o Mercados: su lugar es el cuerpo de la página `/ecosistema`, donde ya están.
 * Este menú solo ofrece procesos.
 */

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [TextoWebPipe, BotonNativoDirective, 
    CommonModule,
    IconoFijoComponent,
  ],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css']
})
export class NavigationComponent {

  public navigationService = inject(NavigationService);

  /**
   * La barra es morada siempre, con el texto en blanco. (Del 6 de octubre se probó blanca sobre los
   * encabezados morados y morada al bajar; se descartó.) Sus colores siguen siendo variables CSS
   * (`--nav-*`) para poder cambiarlos en un solo sitio.
   */
  readonly claro = signal(false);

  readonly variablesDeColor = computed(() => ({ '--nav-fondo': 'var(--color-morado)', '--nav-texto': '#FFFFFF', '--nav-texto-suave': 'rgba(255,255,255,0.75)', '--nav-filete': 'rgba(255,255,255,0.25)', '--nav-hover': 'rgba(255,255,255,0.10)' }));
  private webTexts = inject(TextosWebService);

  /**
   * EL BOTON DE ENTRAR Y EL PANEL SON EL MISMO SITIO, y solo uno se pinta.
   *
   * Quien ya entro no necesita una puerta: necesita saber con que organizacion esta dentro y como
   * salir. Mostrar «Iniciar sesion» a alguien que acaba de iniciarla es decirle que no lo consiguio.
   */
  readonly sesionExterna = inject(ExternalSessionService);

  /**
   * LA ORGANIZACIÓN ACTIVA SALE DE LA URL, NO DE LA SESIÓN. Antes el botón de cuenta
   * enseñaba siempre la primera organización de la sesión, y tras cambiar de organización en el
   * panel la cabecera seguía diciendo la otra.
   */
  readonly contexto = inject(ContextoDeOrganizacionService);

  /**
   * El chip dice QUIÉN eres —la persona— y, aparte, en nombre de quién trabajas. Antes
   * mostraba el nombre de la organización: con varias personas responsables, no decía quién entró.
   */
  readonly nombreDeLaPersona = computed(() => this.sesionExterna.actual()?.fullName ?? '');
  readonly inicialesDeLaPersona = computed(() => {
    const partes = this.nombreDeLaPersona().trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    return (partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[1][0]).toUpperCase();
  });

  @Input() scrolled = false;
  @Input() forceSolid = false;

  // Reactivo: Observamos signals del servicio
  activePage = this.navigationService.activePage;
  mobileMenuOpen = this.navigationService.mobileMenuOpen;
  activeNavDropdown = this.navigationService.activeNavDropdown;
  activeEjeMenuId = this.navigationService.activeEjeMenuId;

  // Enlaces de navegación traducidos dinámicamente.
  //
  // Aquí había un `map` que le devolvía al enlace del mapa el nombre fijo
  // «Ecosistema», pisando lo que dijera el panel. Era un parche contra la
  // deriva del catálogo, que sembraba `nav_mapa` como «Mapa Ecosistémico»
  // mientras el sitio compilaba «Ecosistema»: sin el parche, sembrar una base
  // nueva cambiaba el menú de todo el portal. La deriva se corrigió en el
  // origen —el registro ya dice «Ecosistema» y un paso de CI vigila que el
  // catálogo no se separe—, así que el parche sobraba y dejaba la clave muda:
  // la editora la cambiaba, publicaba, y el menú seguía igual.
  resolvedNavigationLinks = computed(() => this.navigationService.getResolvedNavigationLinks());

  primaryNavigationLinks = computed(() => {
    return this.resolvedNavigationLinks().filter(
      (link) => ![PAGE_IDS.ecosistema, PAGE_IDS.mapa].includes(link.id)
    );
  });

  featuredNavigationLinks = computed(() => {
    return this.resolvedNavigationLinks().filter(
      (link) => [PAGE_IDS.ecosistema, PAGE_IDS.mapa].includes(link.id)
    );
  });

  isDropdownLink(linkId: string): boolean {
    return [PAGE_IDS.pnmc, PAGE_IDS.ecosistema].includes(linkId);
  }

  // Sección expandida dentro del menú móvil (acordeón de submenús)
  mobileExpandedSection = signal<string | null>(null);

  toggleMobileSection(linkId: string): void {
    this.mobileExpandedSection.update((current) => (current === linkId ? null : linkId));
  }

  /**
   * Sub-elementos del acordeón móvil. HOY SOLO LOS EJES, dentro de El Plan.
   *
   * Tuvo también una rama para el Ecosistema, y era código muerto: la plantilla móvil recorre
   * `ecosystemMenuItems` por su cuenta desde que la lista dejó de estar agrupada, así que esa rama
   * —y la copia plana `ecosystemDropdownItems` que la alimentaba— no las llamaba nadie. Se fueron
   * con el mismo corte que dejó el menú colgando del catálogo: dos copias menos que mantener.
   */
  mobileSubItems(linkId: string): { label: string; href: string; pageId: string; sectionId: string }[] {
    if (linkId === PAGE_IDS.pnmc) {
      return this.ejeNavigationGroups().map((group) => ({
        label: group.name,
        href: `${PAGE_PATHS[PAGE_IDS.pnmc]}#${group.sectionId}`,
        pageId: PAGE_IDS.pnmc,
        sectionId: group.sectionId,
      }));
    }
    return [];
  }

  // Apertura del mega-menú por foco de teclado (mouse sigue usando hover)
  onDropdownFocusIn(linkId: string): void {
    if (this.isDropdownLink(linkId)) {
      this.setActiveNavDropdown(linkId);
    }
  }

  onDropdownFocusOut(linkId: string, event: FocusEvent): void {
    if (!this.isDropdownLink(linkId)) return;
    const next = event.relatedTarget as Node | null;
    const current = event.currentTarget as HTMLElement | null;
    // Solo cerrar si el foco abandona por completo el contenedor del dropdown
    if (!next || !current || !current.contains(next)) {
      if (this.activeNavDropdown() === linkId) {
        this.setActiveNavDropdown(null);
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.activeNavDropdown()) {
      this.setActiveNavDropdown(null);
    }
    if (this.mobileMenuOpen()) {
      this.navigationService.setMobileMenuOpen(false);
    }
  }

  private readonly hostElement = inject(ElementRef);

  /**
   * CIERRA TAMBIEN AL HACER CLIC FUERA, no solo con Escape o al salir el foco con el teclado.
   *
   * `alSalirElFocoDelMenuDeCuenta` (mas abajo) cubre el tabulador, pero un clic del raton sobre
   * una zona sin foco propio -el fondo de la pagina, un parrafo- no mueve `document.activeElement`
   * a ningun sitio: el `focusout` nunca llega y el menu se queda abierto. Este listener es el
   * complemento para el raton, no un reemplazo: los dos coexisten porque cierran por dos rutas
   * distintas.
   */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.activeNavDropdown()) return;
    const objetivo = event.target as Node | null;
    if (!objetivo || !this.hostElement.nativeElement.contains(objetivo)) {
      this.setActiveNavDropdown(null);
    }
  }

  /**
   * Los procesos del Ecosistema en el menú, CON EL DESTINO QUE DICE EL CATALOGO.
   *
   * ESCUELAS DE MÚSICA NO FIGURA (decisión del 10 nov 2026: queda fuera por ahora). Agrupaciones y Agentes salieron del menú porque no tienen tabla ni
   * endpoint: su entrada llevaba a una pantalla de «próximamente». La razón está escrita en
   * `categorias-ecosistema.config.ts`, que marca con `proceso` los que sí son procesos del
   * Ecosistema, y es la misma lista que muestra la rejilla de la portada.
   *
   * ANTES ESTO ERAN TRES GRUPOS CON TÍTULO, Y EL TÍTULO NO SE PINTABA EN NINGÚN SITIO. Existían
   * para partir el panel en tres columnas y servían de clave de `track`, nada más: quien leyera
   * «Personas y procesos» en el código buscaría en vano ese rótulo en la pantalla. Ahora la
   * lista es plana y las columnas las hace la rejilla, que es de quien son.
   *
   * <b>Y ANTES TAMBIEN DECLARABA SUS PROPIAS DIRECCIONES.</b> Ninguna de las cinco que no son
   * Festivales existía en el enrutador: `ecosistema/mercados-musicales`, `escuelas`, `escenarios`,
   * `redes-documentacion` y `luteria` caían en «no encontrado». se detectó
   * entrando por la de mercados, que además SÍ tiene directorio desde
   * —el enrutador la había registrado con el nombre corto, `ecosistema/mercados`—. Un menú con su
   * propia lista de destinos es una segunda copia que diverge en cuanto una ruta cambia de nombre.
   *
   * <b>AHORA EL DESTINO SALE DE `CATEGORIAS_ECOSISTEMA`</b>, la lista única de las tres superficies
   * que ofrecen el Ecosistema. Un proceso sin directorio público no tiene `route`: aquí eso
   * significa que la entrada se ve —saber que el proceso existe es información que la portada del
   * Ecosistema también da— pero no se dibuja como un control, porque no lleva a ningún sitio.
   *
   * El rótulo de una línea se queda aquí porque es copia de esta pantalla: el catálogo describe el
   * proceso, el menú lo anuncia en una línea.
   */
  readonly ecosystemMenuItems: EntradaDelMenuDelEcosistema[] = [
    ...CATEGORIAS_ECOSISTEMA
      .filter(categoria => categoria.proceso && categoria.route)
      .map(categoria => ({
        label: categoria.title,
        page: categoria.route as string,
        detail: DETALLES_DEL_MENU[categoria.title] ?? categoria.description,
      })),
  ];

  /**
   * LOS PROCESOS QUE TODAVÍA NO TIENEN DIRECTORIO, en un solo renglón y sin control (
   * decisión clave 7). Antes eran cuatro entradas desactivadas con «Próximamente» a 7,7 px y 2,4:1:
   * la mitad del menú eran promesas. Se nombran para que se sepa que el sistema los contempla.
   */
  readonly ecosystemEnPreparacion: string[] = CATEGORIAS_ECOSISTEMA
    .filter(categoria => categoria.proceso && !categoria.route)
    .map(categoria => categoria.title);

  // Mapeo dinámico de ejes para la barra de navegación con traducción del CMS
  ejeNavigationGroups = computed(() => {
    return ejesDataGlobal.map((group, idx) => {
      const name = this.webTexts.getWebText(`eje0${idx + 1}_title`);

      return {
        id: group.id,
        name,
        sectionId: idx === 0 ? 'musica-para-la-vida' : idx === 1 ? 'oficios-y-practicas' : 'gobernanza',
        components: group.components.map((comp, cIdx) => ({
          id: comp.id,
          slug: comp.slug,
          name: this.webTexts.getWebText(`eje0${idx + 1}_c${cIdx + 1}_title`)
        }))
      };
    });
  });

  // Eje sobre el que está el cursor en el menú (null = ninguno, no se muestran componentes)
  // Sin eje señalado, el primero: la columna de componentes no queda vacía hasta pasar el cursor
  // y se alcanza igual con el teclado.
  hoveredEjeGroup = computed(() => {
    const grupos = this.ejeNavigationGroups();
    const hoveredId = this.activeEjeMenuId();
    return grupos.find((g) => g.id === hoveredId) ?? grupos[0] ?? null;
  });

  clearEjeMenuHover(): void {
    this.setActiveEjeMenuId(null);
  }

  isEjesRelatedPage = computed(() => {
    const page = this.activePage();
    return page === PAGE_IDS.pnmc || page.startsWith('comp-');
  });

  isActiveLink(linkId: string): boolean {
    if (linkId === PAGE_IDS.pnmc) {
      return this.isEjesRelatedPage();
    }
    return this.activePage() === linkId;
  }

  getNavClass(): string {
    // Morada siempre (ver `variablesDeColor`). La separa del contenido la franja de colores.
    return 'py-3 bg-(--nav-fondo) shadow-[0_4px_18px_rgba(43,37,89,0.18)] transition-colors duration-200';
  }

  getPrimaryLinkClass(linkId: string): string {
    // La página actual va en blanco pleno y lleva un punto debajo (ver la plantilla); el
    // desplegable abierto también se aclara.
    if (this.isActiveLink(linkId)) return 'text-(--nav-texto)';
    if (this.activeNavDropdown() === linkId) return 'text-(--nav-texto)';
    return 'text-(--nav-texto-suave) hover:text-(--nav-texto)';
  }

  /**
   * «Ecosistema» es la acción principal de la barra: el botón sólido en el color contrario al de la
   * barra (blanco sobre la barra morada, morado sobre la blanca). «Ver Mapa» es un acceso
   * secundario con borde.
   */
  getFeaturedLinkClass(linkId: string): string {
    const active = this.isActiveLink(linkId);
    const claro = this.claro();
    if (linkId === PAGE_IDS.ecosistema) {
      if (claro) {
        return active
          ? 'rounded-xl px-5 py-2.5 bg-morado-vivo text-white focus-visible:ring-morado'
          : 'rounded-xl px-5 py-2.5 bg-morado text-white hover:bg-morado-vivo focus-visible:ring-morado';
      }
      return active
        ? 'rounded-xl px-5 py-2.5 bg-lila-agua text-morado-vivo focus-visible:ring-white'
        : 'rounded-xl px-5 py-2.5 bg-white text-morado hover:bg-lila-agua focus-visible:ring-white';
    }
    if (claro) {
      return active
        ? 'rounded-xl px-5 py-2.5 border border-morado bg-morado-100 text-morado focus-visible:ring-morado'
        : 'rounded-xl px-5 py-2.5 border border-filete bg-transparent text-titulo hover:border-morado focus-visible:ring-morado';
    }
    return active
      ? 'rounded-xl px-5 py-2.5 border border-white bg-white/15 text-white focus-visible:ring-white'
      : 'rounded-xl px-5 py-2.5 border border-white/35 bg-transparent text-white hover:border-white focus-visible:ring-white';
  }

  getEjeGroupClass(groupId: string): string {
    const isHovered = this.hoveredEjeGroup()?.id === groupId;
    // SOLO LA LÍNEA DE LA IZQUIERDA (`border-l-*`), nunca `border-morado`: esa clase pinta el color de
    // los cuatro lados, y como la columna llevaba `divide-y` los ejes 1 y 2 enseñaban además un borde
    // inferior morado («cuadrado recortado») y el 3, que es el último, solo la línea. Ahora los tres
    // se ven igual: línea a la izquierda y un fondo suave.
    return isHovered
      ? 'border-l-morado bg-slate-50/70'
      : 'border-l-transparent hover:bg-slate-50/40';
  }

  getMobileLinkClass(linkId: string): string {
    return this.isActiveLink(linkId) 
      ? 'text-morado'
      : 'text-[#6B6680] hover:text-[#231F45]';
  }

  getWebText(key: string): string {
    return this.webTexts.getWebText(key);
  }
  /**
   * Imagen editable. Devuelve la publicada en el CMS o, si no hay ninguna, la
   * compilada del registro: nunca cadena vacia, porque un `src` vacio hace que
   * el navegador vuelva a pedir la pagina. Ver `registro-de-imagenes-web.ts`.
   */
  imagen(clave: string): string {
    return this.webTexts.getWebImage(clave);
  }

  /** Texto alternativo de esa misma ranura. */
  imagenAlt(clave: string): string {
    return this.webTexts.getWebImageAlt(clave);
  }

  onPageChange(pageId: string): void {
    this.navigationService.navigate(pageId);
  }

  /**
   * NAVEGAR ES UN ENLACE. Cada destino de la barra tiene su `href`, de modo que se puede
   * abrir en otra pestaña, copiar la dirección y ver adónde lleva; el clic normal sigue
   * resolviéndose dentro de la aplicación, con el cierre de menús de siempre.
   */
  hrefDePagina(pageId: string): string {
    return PAGE_PATHS[pageId] ?? '/';
  }

  seguirEnlace(evento: MouseEvent, pageId: string): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.onPageChange(pageId);
  }

  seguirRuta(evento: MouseEvent, ruta: string | null): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.onNavigateToPath(ruta);
  }

  seguirSeccion(evento: MouseEvent, pageId: string, sectionId: string): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.onNavigateToPageSection(pageId, sectionId);
  }

  seguirComponente(evento: MouseEvent, componentId: string): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.onNavigateToComponentFromMenu(componentId);
  }

  /**
   * «ECOSISTEMA» ES UN ENLACE, NO SOLO UN DESPLEGABLE.
   *
   * Pulsarlo abría y cerraba el panel y no llevaba a ninguna parte: para entrar a la portada de la
   * sección había que abrir el menú y bajar hasta una tarjeta final llamada «Ver el ecosistema
   * completo». El criterio es este: «debe ser cliqueable para optimizar la
   * navegación y limpiar el menú adyacente». Son la misma frase: el botón se lleva el destino y esa
   * tarjeta sobra.
   *
   * EL DESPLEGABLE NO SE PIERDE. Sigue abriéndose al pasar el ratón y, para quien navega con
   * teclado, al recibir el foco —`onDropdownFocusIn`—, que es como se abría antes de que el clic
   * hiciera nada. Lo que cambia es qué hace el clic, no cómo se ven los seis procesos.
   */
  onFeaturedLinkClick(linkId: string): void {
    this.onPageChange(linkId);
  }

  /**
   * EL MENU DE LA CUENTA EXTERNA.
   *
   * Se apoya en `activeNavDropdown`, el mismo mecanismo que los desplegables de «Ejes» y
   * «Ecosistema», y no en una señal propia. Motivo: con dos mecanismos, abrir este menu dejaria
   * el otro desplegable abierto detras, y `@HostListener('document:keydown.escape')` solo cerraria
   * uno de los dos. Compartiendo señal, abrir uno cierra el otro sin escribir una linea para ello.
   */
  readonly MENU_DE_CUENTA = 'menu-de-cuenta';

  readonly menuDeCuentaAbierto = computed(() => this.activeNavDropdown() === this.MENU_DE_CUENTA);

  alternarMenuDeCuenta(): void {
    this.setActiveNavDropdown(this.menuDeCuentaAbierto() ? null : this.MENU_DE_CUENTA);
  }

  /**
   * EL MENU DE ACCESO, PARA QUIEN NO TIENE SESION.
   *
   * EL BOTON ABRIA UNA SOLA PUERTA. Llevaba directo a la pantalla de acceso, que abre en la
   * pestaña de ingresar: quien venia a registrar su organizacion aterrizaba en un formulario de
   * correo y contraseña que todavia no tiene, y tenia que encontrar la otra pestaña. El usuario lo
   * pidio: «el boton de inicio de sesion solo tiene una funcion, se sugiere
   * ampliarlo hacia ambas posibilidades».
   *
   * COMPARTE SEÑAL con el menu de cuenta y con los desplegables de la barra, por el mismo motivo
   * que aquel: abrir uno cierra los demas, y `Escape` los cierra todos sin una linea mas.
   */
  readonly MENU_DE_ACCESO = 'menu-de-acceso';

  readonly menuDeAccesoAbierto = computed(() => this.activeNavDropdown() === this.MENU_DE_ACCESO);

  alternarMenuDeAcceso(): void {
    this.setActiveNavDropdown(this.menuDeAccesoAbierto() ? null : this.MENU_DE_ACCESO);
  }

  /**
   * Las dos puertas del acceso externo.
   *
   * Son dos rutas públicas explícitas: una para acceso y otra para registro. No se usan
   * parámetros de modo, que escondían dos estados distintos detrás de una misma dirección.
   */
  seguirIngresar(evento: MouseEvent): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.irAIngresar();
  }

  seguirRegistro(evento: MouseEvent): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.irARegistrarse();
  }

  seguirMiPanel(evento: MouseEvent): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.irAMiPanel();
  }

  seguirOrganizacion(evento: MouseEvent, organizacionId: string): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.abrirOrganizacion(organizacionId);
  }

  irAIngresar(): void {
    this.setActiveNavDropdown(null);
    this.onNavigateToPath('ingresar');
  }

  irARegistrarse(): void {
    this.setActiveNavDropdown(null);
    this.navigationService.routerNavigate('registro');
  }

  /**
   * Cierra al salir el foco del menu, no al salir el raton: un menu que se cierra con el raton
   * pero no con el tabulador deja al teclado dentro de algo que ya no se ve.
   */
  alSalirElFocoDelMenuDeCuenta(event: FocusEvent): void {
    const siguiente = event.relatedTarget as Node | null;
    const contenedor = event.currentTarget as HTMLElement | null;
    if (!siguiente || !contenedor || !contenedor.contains(siguiente)) {
      this.setActiveNavDropdown(null);
    }
  }

  /**
   * Al panel de la organizacion, que tiene direccion propia desde.
   *
   * ANTES LLEVABA A `ecosistema/ingresar`, la pantalla de acceso, que con sesion abierta cambiaba
   * su vista interna y se quedaba en esa direccion. Es decir: «Mi panel» llevaba a una URL que
   * dice «ingresar» a alguien que ya entro.
   */
  irAMiPanel(): void {
    this.onNavigateToPath('gestion');
  }

  /** Abre el panel de una organización de la cuenta, en su propia dirección. */
  abrirOrganizacion(organizacionId: string): void {
    this.onNavigateToPath(`gestion/o/${organizacionId}/resumen`);
  }

  /** «Administrador» o «Editor»: el rol, sin «Actuando como» (ACC2). */
  etiquetaDelRol(rol: string): string {
    return etiquetaDelRolEnOrganizacion(rol);
  }

  /**
   * Cierra la sesion y devuelve al inicio.
   *
   * SE VUELVE AL INICIO A PROPOSITO: si se cierra sesion estando en una pantalla que exige sesion
   * —el panel de la organizacion, el formulario del Festival—, quedarse alli deja a la vista un
   * formulario que ya no puede enviarse.
   */
  cerrarSesionExterna(): void {
    this.setActiveNavDropdown(null);
    this.sesionExterna.salir().subscribe(() => {
      this.navigationService.setMobileMenuOpen(false);
      this.navigationService.routerNavigate('');
    });
  }

  /**
   * ACEPTA `null` PORQUE EL MENU DEL ECOSISTEMA TIENE ENTRADAS SIN DESTINO: los procesos que
   * todavía no tienen directorio público. El botón ya viene desactivado, así que esto no debería
   * llegar a ejecutarse; la guarda está para que un destino que falte no acabe navegando a la
   * cadena vacía —que el enrutador resuelve como la portada— y parezca que el enlace «funciona».
   */
  onNavigateToPath(path: string | null): void {
    if (!path) return;
    this.navigationService.setActiveNavDropdown(null);
    this.navigationService.setMobileMenuOpen(false);
    this.navigationService.routerNavigate(path);
  }

  onNavigateToPageSection(pageId: string, sectionId: string): void {
    this.navigationService.setActiveNavDropdown(null);
    this.navigationService.setMobileMenuOpen(false);
    this.navigationService.navigate(pageId);
    
    // Simular scroll demorado hacia la sección en la página destino
    setTimeout(() => {
      const targetElement = document.getElementById(sectionId);
      if (targetElement) {
        const offset = 112; // NAVBAR_SCROLL_OFFSET
        const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: elementPosition - offset,
          behavior: 'smooth'
        });
      }
    }, 220);
  }

  onNavigateToComponentFromMenu(componentId: string): void {
    this.navigationService.navigateComponent(componentId);
  }

  toggleMobileMenu(): void {
    this.navigationService.setMobileMenuOpen(!this.mobileMenuOpen());
  }

  setActiveNavDropdown(dropdown: string | null): void {
    this.navigationService.setActiveNavDropdown(dropdown);
  }

  setActiveEjeMenuId(ejeId: string | null): void {
    this.navigationService.setActiveEjeMenuId(ejeId);
  }
}
