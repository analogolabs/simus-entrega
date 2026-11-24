import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ContextoDeOrganizacionService } from '../../../../core/services/contexto-de-organizacion.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PAGE_IDS } from '../../../../core/services/navigation.service';
import { CATEGORIAS_ECOSISTEMA } from '../../../../core/services/categorias-ecosistema.config';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { DEFAULT_TEXTS } from '../../../../core/cms/registro-de-textos-web';
import { NavigationComponent } from './navigation.component';
import { ExternalSessionService } from '../../../../core/services/external-session.service';

/**
 * LOS DOS BOTONES DE ACCESO NO SE LOCALIZAN IGUAL.
 *
 * El de escritorio es un icono sin texto visible y solo tiene `aria-label`; el
 * del menú móvil sigue siendo un botón rotulado. Buscarlos por `textContent`
 * —como hacían estas pruebas— encontraría hoy uno solo, y la prueba que cuenta
 * dos habría pasado a verificar la mitad sin decirlo.
 *
 * Se busca por NOMBRE ACCESIBLE, que es lo que los dos comparten y lo que un
 * lector de pantalla anuncia. Si mañana el icono pierde su `aria-label`, esta
 * función deja de encontrarlo y las pruebas caen: que es exactamente lo que debe
 * pasar, porque un botón sin nombre accesible no es alcanzable.
 */
/**
 * Los mandos de acceso que hay pintados: el icono de escritorio y los dos botones del menú móvil.
 *
 * SE BUSCAN POR `data-testid` Y NO POR EL ROTULO «Iniciar sesión», que es como se buscaban hasta el
 * 31 de agosto de 2026. Ese día el icono pasó a abrir un menú con dos entradas —«Ingresar» y «Crear
 * cuenta o registrar organización»— y el rótulo dejó de ser una identidad: ahora hay tres mandos y
 * ninguno se llama así.
 */
function botonesDeAcceso(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(
    '[data-testid="iniciar-sesion"], [data-testid="movil-ingresar"], [data-testid="movil-registrarse"]',
  ));
}

describe('NavigationComponent ecosystem navigation', () => {
  let fixture: ComponentFixture<NavigationComponent>;
  let component: NavigationComponent;

  beforeEach(async () => {
    localStorage.removeItem('pnmc_web_texts');

    await TestBed.configureTestingModule({
      imports: [NavigationComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.removeItem('pnmc_web_texts'));

  it('la barra ya no trae el botón «Pregunta lo que quieras»: el Asistente es una burbuja flotante', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-abrir-pregunta]')).toBeNull();
    expect(raiz.textContent).not.toContain('Pregunta lo que quieras');
  });

  it('opens the ecosystem list from the Ecosistema text control', () => {
    expect(component.isDropdownLink(PAGE_IDS.ecosistema)).toBeTrue();
    expect(component.isDropdownLink(PAGE_IDS.mapa)).toBeFalse();
    expect(component.resolvedNavigationLinks().find(link => link.id === PAGE_IDS.ecosistema)?.name).toBe('Ecosistema');

    // EL CLIC YA NO ABRE EL PANEL: NAVEGA. Desde «Ecosistema» es un
    // enlace, y el desplegable se abre al pasar el ratón o al recibir el foco, que es por donde
    // llega quien navega con teclado. Se abre aquí por esa misma puerta.
    component.setActiveNavDropdown(PAGE_IDS.ecosistema);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const content = root.textContent ?? '';
    expect(component.activeNavDropdown()).toBe(PAGE_IDS.ecosistema);
    expect(content).toContain('Ecosistema');
    expect(content).toContain('Espacios para música en vivo');
    expect(content).not.toContain('Escuelas de música');
    expect(content).not.toContain('Personas y procesos');
    expect(content).not.toContain('Circulación y espacios');
    expect(content).not.toContain('Conocimiento y oficios');
    expect(root.querySelector('[data-testid="ecosystem-tool-grid"]')?.className).toContain('grid-cols-2');
    expect(root.querySelectorAll('[data-testid="ecosystem-tool-item"]').length).toBe(5);
    // Los recuadros grises que envolvian cada columna se fueron con los grupos.
    expect(root.querySelectorAll('[data-testid="ecosystem-tool-group"]').length).toBe(0);
    // La tarjeta «Herramienta principal» que llevaba al mapa salió del desplegable: el mapa
    // tiene botón propio en la barra, dos posiciones a la izquierda. Se comprueba por el
    // `data-testid` Y por el rótulo, porque borrar solo el atributo dejaría la tarjeta en
    // pantalla con la prueba en verde.
    expect(root.querySelector('[data-testid="ecosystem-map-tool"]')).toBeNull();
    expect(content).not.toContain('Herramienta principal');
    expect(content).not.toContain('Mapa ecosistémico');
    expect(content).not.toContain('Acerca de SIMUS');
    expect(content).not.toContain('Ayuda y tutoriales');
    // «Ingresar» solo está en el acceso de la cabecera, no dentro del desplegable del ecosistema.
    expect(root.querySelector('[data-testid="ecosystem-tool-grid"]')?.textContent).not.toContain('Ingresar');
    expect(content).not.toContain('Ser parte del SIMUS');
  });

  it('el rótulo del menú lo manda el panel, no el código', async () => {
    // El componente tenía un `map` que le devolvía a este enlace el nombre fijo
    // «Ecosistema» después de haberlo resuelto contra el CMS: la editora lo
    // cambiaba, publicaba, y el menú seguía igual. Aquí se comprueba lo
    // contrario —que ahora manda lo publicado— y también el rótulo del panel
    // de componentes, que antes no lo leía nadie.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NavigationComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const textos = TestBed.inject(TextosWebService);
    spyOn(textos, 'getWebText').and.callFake((clave: string) =>
      clave === 'nav_ecosistema' ? 'Mapa Ecosistémico'
        : clave === 'nav_components_title' ? 'Piezas del eje'
          : DEFAULT_TEXTS[clave] ?? '');

    const conCms = TestBed.createComponent(NavigationComponent);
    conCms.detectChanges();

    expect(conCms.componentInstance.resolvedNavigationLinks()
      .find(link => link.id === PAGE_IDS.ecosistema)?.name).toBe('Mapa Ecosistémico');

    const idDelPrimerEje = conCms.componentInstance.ejeNavigationGroups()[0].id;
    conCms.componentInstance.setActiveNavDropdown(PAGE_IDS.pnmc);
    conCms.componentInstance.setActiveEjeMenuId(idDelPrimerEje);
    conCms.detectChanges();

    expect((conCms.nativeElement as HTMLElement).textContent).toContain('Piezas del eje');
  });

  it('el botón «Mapa» va al mapa y no abre nada fuera del portal', () => {
    // Este botón ocupa el sitio que tenía SIMUS, que sí salía del portal con
    // `window.open`. El espía sigue puesto para que un regreso de aquel
    // comportamiento —abrir una pestaña nueva desde la barra— ponga la prueba en
    // rojo, no solo el destino equivocado.
    const open = spyOn(window, 'open');
    const navegar = spyOn(component.navigationService, 'navigate');

    component.onFeaturedLinkClick(PAGE_IDS.mapa);

    expect(navegar).toHaveBeenCalledOnceWith(PAGE_IDS.mapa);
    expect(open).not.toHaveBeenCalled();
  });

  it('«Ver Mapa» va antes que «Ecosistema» en la barra', () => {
    // El orden en pantalla es el orden de `navigationLinks`: `featuredNavigationLinks`
    // filtra sin reordenar. Se comprueba sobre el DOM y no sobre el array porque un
    // `flex-row-reverse` en el contenedor invertiría lo que ve el visitante sin tocar
    // el array, y esta prueba seguiría verde.
    const rotulos = Array.from(
      (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLElement>('[data-testid="enlace-destacado"] > a'),
    ).map(boton => (boton.textContent ?? '').trim());

    expect(rotulos).toEqual(['Ver Mapa', 'Ecosistema']);
  });

  it('el menú sigue el orden acordado: Inicio, Noticias, Agenda, Editorial, Galería y PNMC', () => {
    expect(component.primaryNavigationLinks().map(enlace => enlace.id)).toEqual([
      PAGE_IDS.home, PAGE_IDS.noticias, PAGE_IDS.agenda, PAGE_IDS.editorial, PAGE_IDS.galeria, PAGE_IDS.pnmc,
    ]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Galería');
  });

  it('la navegación son enlaces con dirección real, no botones', () => {
    // El defecto: cada ítem de la cabecera era un `<button>` sin `href`; no se podía abrir en otra
    // pestaña, ni copiar la dirección, y un lector de pantalla anunciaba «botón».
    const raiz = fixture.nativeElement as HTMLElement;
    const hrefs = (selector: string) => Array.from(raiz.querySelectorAll<HTMLAnchorElement>(selector)).map(a => a.getAttribute('href'));

    expect(hrefs('[data-testid="enlace-principal"]')).toEqual(['/', '/noticias', '/agenda', '/editorial', '/galeria', '/pnmc']);
    expect(hrefs('[data-testid="enlace-destacado-vinculo"]')).toEqual(['/mapa-ecosistemico', '/ecosistema']);
    expect(raiz.querySelector('[data-testid="enlace-logotipo"]')?.getAttribute('href')).toBe('/');
    expect(raiz.querySelectorAll('button[data-testid="enlace-principal"]').length).toBe(0);
  });

  it('un clic normal navega dentro de la aplicación y uno con Ctrl o el central lo deja al navegador', () => {
    const navegar = spyOn(component.navigationService, 'navigate');
    const raiz = fixture.nativeElement as HTMLElement;
    const noticias = raiz.querySelector<HTMLAnchorElement>('[data-testid="enlace-principal"][href="/noticias"]')!;

    // Un clic sintético sobre un `<a href>` navega de verdad (y sacaría la prueba de su página):
    // se anota si el enlace lo interceptó y se frena después, ya en la raíz.
    const visto: boolean[] = [];
    raiz.addEventListener('click', evento => { visto.push(evento.defaultPrevented); evento.preventDefault(); });

    // Con Ctrl (o Cmd, o el botón central) no se intercepta: se abre en otra pestaña.
    noticias.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    noticias.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 }));
    expect(visto).withContext('Ctrl+clic y clic central deben dejarse al navegador').toEqual([false, false]);
    expect(navegar).not.toHaveBeenCalled();

    // El clic normal sí: navega por el enrutador y no recarga la página.
    noticias.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(visto[2]).toBeTrue();
    expect(navegar).toHaveBeenCalledOnceWith(PAGE_IDS.noticias);
  });

  it('el desplegable del PNMC cabe en la ventana, enseña el primer eje sin pasar el cursor y enlaza cada componente', () => {
    component.setActiveNavDropdown(PAGE_IDS.pnmc);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const ejes = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('[data-testid="enlace-eje"]'));
    expect(ejes.length).toBe(3);
    ejes.forEach(eje => expect(eje.getAttribute('href')).toMatch(/^\/pnmc#/));
    // Los componentes del primer eje están a la vista sin hover (la columna quedaba vacía).
    const componentes = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('[data-testid="enlace-componente"]'));
    expect(componentes.length).toBeGreaterThan(0);
    componentes.forEach(c => expect(c.getAttribute('href')).toMatch(/^\/pnmc\/ejes\/./));
    // El panel se centra bajo el rótulo y se limita al ancho de la ventana: no se sale por la derecha.
    const panel = raiz.querySelector('[data-testid="panel-pnmc"]')!;
    expect(panel.className).toContain('left-1/2');
    expect(panel.className).toContain('100vw');
    // El número va en su propia columna y no encima del título.
    expect(ejes[0].querySelector('[aria-hidden="true"]')?.className).not.toContain('absolute');
  });

  it('los tres ejes del menú PNMC se marcan igual: solo la línea de la izquierda, sin borde inferior ni anillo recortado (G7)', () => {
    // EL DEFECTO QUE FIJA (12 nov 2026). El eje activo llevaba `border-morado`, que pinta el color de los
    // cuatro lados, y la columna llevaba `divide-y`: los ejes 1 y 2 enseñaban además un borde inferior
    // morado («un cuadrado recortado») y el 3, que es el último, solo la línea. Y el anillo de foco con
    // `ring-offset-2` lo recortaba el contenedor con `overflow-x-hidden`.
    component.setActiveNavDropdown(PAGE_IDS.pnmc);
    fixture.detectChanges();
    const grupos = component.ejeNavigationGroups();
    expect(grupos.length).toBe(3);

    component.setActiveEjeMenuId(grupos[1].id);
    fixture.detectChanges();
    grupos.forEach((g, i) => {
      const clases = component.getEjeGroupClass(g.id);
      expect(clases).withContext(`eje ${i + 1}: nunca el color en los cuatro lados`).not.toContain('border-morado');
      expect(clases).toContain(i === 1 ? 'border-l-morado' : 'border-l-transparent');
    });

    const raiz = fixture.nativeElement as HTMLElement;
    const ejes = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('[data-testid="enlace-eje"]'));
    expect(ejes[0].parentElement!.className).withContext('la columna ya no dibuja divisores').not.toContain('divide-y');
    ejes.forEach(eje => {
      expect(eje.className).toContain('border-l-2');
      expect(eje.className).withContext('el anillo de foco va por dentro: el contenedor no lo recorta').toContain('focus-visible:ring-inset');
      expect(eje.className).not.toContain('ring-offset');
    });
  });

  it('«Ecosistema» es el único botón sólido de la barra, en blanco sobre el violeta', () => {
    // Lo que distingue a este enlace del resto de la barra es que es un botón sólido: la llamada a
    // la acción principal. Sobre la barra violeta es blanco con el texto en violeta.
    const clasesDelEcosistema = component.getFeaturedLinkClass(PAGE_IDS.ecosistema);

    expect(clasesDelEcosistema).toContain('bg-white');
    expect(clasesDelEcosistema).toContain('text-morado');
    // Y el de al lado NO lo es: «Ver Mapa» es un botón secundario, transparente y con borde.
    const clasesDelMapa = component.getFeaturedLinkClass(PAGE_IDS.mapa);
    expect(clasesDelMapa).toContain('border');
    expect(clasesDelMapa).toContain('bg-transparent');
    expect(clasesDelMapa).not.toContain('bg-white');
  });

  it('el último enlace conserva su rótulo aunque no tenga clave en el catálogo', () => {
    // El defecto que esto impide, y que ocurrió de verdad el 22 ago 2026 con el
    // enlace que ocupaba este sitio: `getResolvedNavigationLinks()` arma
    // `nav_${link.id}` para cada enlace, y **`nav_simus` nunca existió** en el
    // registro. Mientras hubo un texto de reserva, el `||` lo tapaba; al
    // quitarlo, `getWebText` devolvió cadena vacía y **«SIMUS» desapareció del
    // menú en todas las páginas**. Las otras pruebas que lo tocaban lo
    // localizaban por `window.open` o por `href`: **seguían verdes con el rótulo
    // en blanco**. Esta es la que no.
    //
    // El riesgo es el mismo hoy: `nav_mapa` tampoco existe —se renombró a
    // `nav_ecosistema` (`registro-de-textos-web.ts`)—, así que este enlace vive
    // igual de `rotuloFijo`.
    const mapa = component.resolvedNavigationLinks().find(link => link.id === PAGE_IDS.mapa);

    expect(mapa).withContext('el enlace al mapa desapareció del menú').toBeTruthy();
    expect(mapa!.name).toBe('Ver Mapa');
  });

  it('los rótulos que SÍ vienen del catálogo no llegan nunca vacíos', () => {
    // La otra mitad del mismo riesgo: un enlace cuya clave se renombre a medias
    // —como pasó con `nav_mapa` → `nav_ecosistema`— dejaría su rótulo en blanco
    // sin que nada fallara. El menú es lo primero que ve un visitante.
    const vacios = component.resolvedNavigationLinks()
      .filter(link => !link.name || !link.name.trim())
      .map(link => link.id);

    expect(vacios).toEqual([]);
  });

  it('el menú móvil ya no saca al visitante a SIMUS', () => {
    // El menú móvil tenía una rama propia para SIMUS: un `<a>` con `target`
    // `_blank`. Al quedarse sin rama, el enlace cae en el `@else` común y
    // navega por dentro como los demás. Se comprueba lo uno y lo otro porque
    // borrar la rama sin dejar rótulo dejaría el menú móvil con un hueco.
    component.navigationService.setMobileMenuOpen(true);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('a[href="https://simus.mincultura.gov.co/"]')).toBeNull();
    expect(root.querySelector('a[target="_blank"]')).toBeNull();

    // El rótulo se busca por igualdad exacta y no con `toContain` sobre el texto
    // de la página: el acordeón del ecosistema tiene dentro «Mapa ecosistémico»,
    // y un `toContain('Mapa')` seguiría verde aunque este botón desapareciera.
    const navegar = spyOn(component.navigationService, 'navigate');
    const botonDelMapa = Array.from(root.querySelectorAll('a'))
      .find(enlace => (enlace.textContent ?? '').trim() === 'Ver Mapa' && enlace.closest('.xl\\:hidden') !== null);

    expect(botonDelMapa).withContext('el menú móvil se quedó sin el botón «Mapa»').toBeTruthy();
    botonDelMapa!.click();
    expect(navegar).toHaveBeenCalledOnceWith(PAGE_IDS.mapa);
  });

  it('la puerta a la portada del ecosistema es el propio botón, y ya no una tarjeta del menú', () => {
    // POR QUÉ EXISTIÓ ESTA PRUEBA. Al convertir SIMUS en enlace saliente, `/ecosistema` se quedó
    // sin ningún enlace que llevara a ella: era la página que abría aquel botón. La puerta se puso
    // entonces al final del desplegable, en una tarjeta llamada «Ver el ecosistema completo».
    //
    // POR QUÉ CAMBIA DE FORMA. Se define que «Ecosistema» fuera
    // cliqueable «para optimizar la navegación y limpiar el menú adyacente». Con el botón llevando
    // a la portada, aquella tarjeta era un segundo camino al mismo sitio dentro del mismo menú.
    // La regla que se protege es la misma —que la portada tenga puerta—; lo que cambia es cuál.
    const navegar = spyOn(component.navigationService, 'navigate');

    component.onFeaturedLinkClick(PAGE_IDS.ecosistema);

    expect(navegar).toHaveBeenCalledOnceWith(PAGE_IDS.ecosistema);

    component.setActiveNavDropdown(PAGE_IDS.ecosistema);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="ecosystem-overview-link"]'))
      .withContext('la tarjeta duplicaba el destino del botón').toBeNull();
    expect(raiz.textContent ?? '')
      .not.toContain('Ver el ecosistema completo');
  });

  it('el menú ofrece los directorios que existen y nombra aparte los que están en preparación', () => {
    // POR NOMBRE Y EN ORDEN, no por cantidad. (decisión clave 7: dejar de anunciar lo que no
    // existe): la mitad de sus entradas eran «Próximamente» a 7,7 px. TERRITORIOS SONOROS Y PRÁCTICAS
    // MUSICALES NO VAN EN EL MENÚ (12 nov 2026): son catálogos transversales, no procesos; viven en
    // el cuerpo de `/ecosistema`.
    expect(component.ecosystemMenuItems.map(item => item.label)).toEqual([
      // ORDEN FIJO DEL CATÁLOGO (decisión 118): Festivales, Mercados, Redes, Lutería y Espacios.
      'Festivales',
      'Mercados musicales',
      // REDES Y DOCUMENTACIÓN Y LUTERÍA PASARON A «DISPONIBLE»: tienen directorio público y dejan
      // de anunciarse como próximas.
      'Redes y documentación',
      'Lutería',
      'Espacios para música en vivo',
    ]);
    expect(component.ecosystemMenuItems.map(item => item.label)).not.toContain('Territorios sonoros');
    expect(component.ecosystemMenuItems.map(item => item.label)).not.toContain('Prácticas musicales');
    // NO QUEDA NINGÚN PROCESO «EN PREPARACIÓN»: Espacios y Redes y documentación ya tienen directorio.
    expect(component.ecosystemEnPreparacion).toEqual([]);

    const destinos = component.ecosystemMenuItems.map(item => item.page);
    expect(destinos).not.toContain('ecosistema/agrupaciones');
    expect(destinos).not.toContain('ecosistema/agentes');
  });

  it('el destino de cada proceso lo pone el catálogo, no el menú', () => {
    // EL DEFECTO QUE FIJA. El menú llevaba su propia lista de direcciones y ninguna de las cinco
    // que no eran Festivales existía en el enrutador. Comparar contra `CATEGORIAS_ECOSISTEMA` es lo
    // que impide que vuelvan a separarse.
    const delCatalogo = CATEGORIAS_ECOSISTEMA
      .filter(categoria => categoria.proceso && categoria.route)
      .map(categoria => categoria.route as string);

    expect(component.ecosystemMenuItems.map(item => item.page).slice(0, delCatalogo.length)).toEqual(delCatalogo);
  });

  it('todas las entradas del menú son enlaces con su dirección, y lo que está en preparación no es un control', () => {
    component.setActiveNavDropdown(PAGE_IDS.ecosistema);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const enlaces = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('[data-testid="ecosystem-tool-item"]'));

    expect(enlaces.map(a => a.tagName)).toEqual(['A', 'A', 'A', 'A', 'A']);
    expect(enlaces.map(a => a.getAttribute('href'))).toEqual([
      '/ecosistema/festivales',
      '/ecosistema/mercados-musicales',
      '/ecosistema/redes',
      '/ecosistema/luteria',
      '/ecosistema/espacios',
    ]);
    // Ningún proceso queda en preparación: el aviso no se pinta.
    expect(raiz.querySelector('[data-testid="ecosistema-en-preparacion"]')).toBeNull();
    // Y el aviso «Próximamente» a 7,7 px ya no existe.
    expect(raiz.textContent).not.toContain('Próximamente');
  });

  it('el desplegable del Ecosistema trae, abajo a la derecha, el directorio de agentes y actores con fondo propio', () => {
    component.setActiveNavDropdown(PAGE_IDS.ecosistema);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const agentes = raiz.querySelector<HTMLAnchorElement>('[data-testid="ecosystem-agentes-item"]')!;
    expect(agentes.getAttribute('href')).toBe('/ecosistema/personas');
    expect(agentes.className).toContain('bg-morado/10');
    // Es el último de la rejilla: queda tras «Espacios para música en vivo».
    const rejilla = Array.from(raiz.querySelector('[data-testid="ecosystem-tool-grid"]')!.children);
    expect(rejilla[rejilla.length - 1]).toBe(agentes);
  });

  it('el menú del móvil pinta los mismos directorios y la misma línea de «en preparación»', () => {
    // SON DOS PLANTILLAS DISTINTAS con la misma lista, y ese es justo el modo de que se
    // separen. Se abre y se leen los rótulos PINTADOS, no la propiedad del componente.
    component.navigationService.setMobileMenuOpen(true);
    component.toggleMobileSection(PAGE_IDS.ecosistema);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const rotulos = Array.from(raiz.querySelectorAll<HTMLElement>('[data-testid="ecosystem-mobile-item"]'))
      .map(enlace => enlace.textContent?.trim());

    expect(rotulos).toEqual(component.ecosystemMenuItems.map(item => item.label));
    expect(raiz.querySelector('[data-testid="ecosistema-en-preparacion-movil"]')).toBeNull();
  });

  it('el menú no lleva cifras de registros: nombra el proceso y su línea, y no pide conteos al cargar (decisión 65)', () => {
    // LAS CIFRAS SALIERON DEL MENÚ (decisión de la dirección, 12 nov 2026): no hacen falta para elegir
    // un directorio y costaban cuatro peticiones al cargar cada página. La portada del Ecosistema sí las
    // conserva. TERRITORIOS SONOROS Y PRÁCTICAS MUSICALES tampoco están en el menú (decisión 60).
    const http = TestBed.inject(HttpTestingController);
    http.expectNone(r => r.url.includes('/api/v1/publico/') && r.params.get('limit') === '1');

    component.setActiveNavDropdown(PAGE_IDS.ecosistema);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('[data-testid="ecosystem-tool-count"]').length).toBe(0);
    expect(raiz.querySelectorAll('[data-testid="ecosystem-mobile-count"]').length).toBe(0);
    expect(raiz.textContent ?? '').not.toContain('publicados');
    const entradas = Array.from(raiz.querySelectorAll('[data-testid="ecosystem-tool-item"]')).map(el => el.textContent ?? '');
    expect(entradas.some(texto => texto.includes('Territorios sonoros'))).toBeFalse();
    expect(entradas.some(texto => texto.includes('Prácticas musicales'))).toBeFalse();
  });

  it('el menú móvil tampoco lleva cifras de registros (decisión 65)', () => {
    component.navigationService.setMobileMenuOpen(true);
    component.toggleMobileSection(PAGE_IDS.ecosistema);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('[data-testid="ecosystem-mobile-count"]').length).toBe(0);
    expect(raiz.textContent ?? '').not.toContain('publicados');
  });

  it('ningún destino del menú apunta ya a /simus', () => {
    // `/simus/*` sobrevive como redirección para no romper marcadores, pero un
    // menú que sigue apuntando ahí manda a cada visitante por un salto de más
    // y deja la URL vieja copiándose y compartiéndose indefinidamente.
    const destinos = component.ecosystemMenuItems.map(item => item.page);

    expect(destinos.filter(page => page.startsWith('simus'))).toEqual([]);
    expect(destinos).toContain('ecosistema/festivales');
  });

  it('en móvil la portada del ecosistema tiene su propia puerta, porque el rótulo despliega', () => {
    // EN ESCRITORIO LA PUERTA ES EL ROTULO, que desde navega al pulsarlo.
    // En móvil ese mismo rótulo abre el acordeón, así que ahí hace falta una entrada propia. Va la
    // PRIMERA y no la última, igual que «Ver todos los ejes» en el acordeón de al lado; la que se
    // retiró era una tarjeta al final que duplicaba el destino del rótulo de escritorio.
    // El menú móvil lo abre el servicio, no el componente: `mobileMenuOpen` es una señal de solo
    // lectura que el componente reexpone.
    const navegar = spyOn(component.navigationService, 'navigate');
    component.toggleMobileMenu();
    component.toggleMobileSection(PAGE_IDS.ecosistema);
    fixture.detectChanges();

    const puerta = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('[data-testid="ecosystem-mobile-portada"]');

    expect(puerta).withContext('el menú móvil se quedó sin enlace a la portada').not.toBeNull();
    puerta?.click();
    expect(navegar).toHaveBeenCalledOnceWith(PAGE_IDS.ecosistema);
  });

  it('el menú móvil cabe bajo la barra, se desplaza dentro y cada fila es de 44 px o más (revisión responsive)', () => {
    // Alto: `dvh` y no `vh` (en un teléfono `100vh` cuenta la barra de direcciones y el final queda fuera) y menos el alto REAL de
    // la barra (`--alto-barra-superior`), no un 3,5 rem que se quedó corto. Con `overscroll-contain` el gesto no arrastra la página.
    component.navigationService.setMobileMenuOpen(true);
    component.toggleMobileSection(PAGE_IDS.ecosistema);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    const panel = raiz.querySelector<HTMLElement>('nav > div.absolute.overflow-y-auto');
    expect(panel).withContext('no hay panel del menú móvil').not.toBeNull();
    expect(panel?.className).toContain('100dvh-var(--alto-barra-superior)');
    expect(panel?.className).toContain('overscroll-contain');
    expect(panel?.className).not.toContain('100vh');

    const filas = Array.from(panel!.querySelectorAll<HTMLElement>('[data-testid="ecosystem-mobile-item"], [data-testid="ecosystem-mobile-portada"], button[aria-expanded]'));
    expect(filas.length).toBeGreaterThan(3);
    for (const fila of filas) expect(fila.className).withContext(fila.textContent?.trim() ?? '').toMatch(/min-h-11|h-11/);
  });

  it('el rótulo «Sistema de información de la música» de la barra no baja de 12 px', () => {
    const rotulo = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('span'))
      .find(e => e.textContent?.includes('Sistema de'));
    expect(rotulo).withContext('no se encontró el rótulo').toBeDefined();
    expect(rotulo!.className).toContain('text-[0.75rem]');
  });

  // La version anterior de esta prueba fijaba el destino `admin` y se llamaba «takes the
  // login button to the existing admin login». Cumplia su trabajo: cuando el destino cambio,
  // se puso en rojo y obligo a mirar. Lo que cambio es la decision, no la prueba.
  //
  // POR QUE SE COMPRUEBAN LOS DOS BOTONES Y NO EL PRIMERO. Hay dos «Iniciar sesion» —el de
  // escritorio y el del menu de movil— con el mismo texto y el mismo destino escrito aparte.
  // `find` devolvia solo el primero, de modo que el de movil podia quedarse apuntando a la
  // consola sin que ninguna prueba se enterara.
  it('los mandos de acceso llevan a la entrada del ecosistema, y el de registro por su pestaña', () => {
    // El segundo boton vive dentro del menu de movil, que cuelga de `@if (mobileMenuOpen())`.
    // Sin abrirlo, el fixture solo pinta uno y la prueba examinaria la mitad del asunto —que
    // es exactamente lo que hacia la version anterior sin decirlo.
    component.navigationService.setMobileMenuOpen(true);
    fixture.detectChanges();

    const navigate = spyOn(component.navigationService, 'routerNavigate');
    const raiz = fixture.nativeElement as HTMLElement;

    // TRES MANDOS Y NO DOS desde: el icono de escritorio y, en el menú
    // móvil, «Ingresar» y «Crear cuenta». El icono ABRE UN MENÚ, así que no navega al pulsarlo:
    // navegan las dos entradas de dentro.
    expect(botonesDeAcceso(raiz).length).toBe(3);

    raiz.querySelector<HTMLElement>('[data-testid="movil-ingresar"]')!.click();
    raiz.querySelector<HTMLElement>('[data-testid="movil-registrarse"]')!.click();

    component.irAIngresar();
    component.irARegistrarse();

    expect(navigate.calls.allArgs()).toEqual([
      ['ingresar'],
      ['registro'],
      ['ingresar'],
      ['registro'],
    ]);
  });

  // La guarda de verdad. La prueba de arriba dice a donde VA el boton que hoy existe; esta
  // dice que NINGUN mando del sitio publico lleva a la consola, incluido el que alguien
  // añada mañana. Sin ella, un tercer enlace a `admin` entraria sin ponerse nada en rojo.
  it('ningun mando de la navegacion publica lleva a la consola institucional', () => {
    component.navigationService.setMobileMenuOpen(true);
    fixture.detectChanges();

    const navigate = spyOn(component.navigationService, 'routerNavigate');
    const raiz = fixture.nativeElement as HTMLElement;
    // Un enlace sin manejador navegaría de verdad y sacaría la prueba de su página: se frena aquí,
    // DESPUÉS de que el enlace haya tenido ocasión de manejar su propio clic.
    raiz.addEventListener('click', evento => evento.preventDefault());
    const mandos = Array.from(raiz.querySelectorAll<HTMLElement>('button, a[href]'));
    // Y se comprueba antes que NINGÚN enlace lleva a la consola, ni siquiera por su `href`.
    expect(mandos.map(mando => mando.getAttribute('href') ?? '').filter(href => /^\/admin/.test(href))).toEqual([]);

    for (const mando of mandos) {
      mando.click();
    }

    const destinos = navigate.calls.allArgs().map(args => String(args[0]));
    expect(destinos.filter(destino => destino === 'admin' || destino.startsWith('admin/'))).toEqual([]);
  });
});

/**
 * El panel de la organización en la barra pública.
 *
 * EL DEFECTO QUE ESTO FIJA: la sesión existía en la cookie y en el servidor, pero la barra no la
 * miraba. Una organización entraba, volvía al inicio y se encontraba otra vez el botón «Iniciar
 * sesión»; el único sitio del portal que sabía que había alguien dentro era /registro.
 *
 * SE MIRA EL DOM, NO EL COMPONENTE. Que `dentro()` devuelva true no es que el panel se pinte: los
 * dos bloques —escritorio y móvil— tienen que cambiar los dos, y el móvil vive detrás de un @if.
 */
describe('NavigationComponent · panel de sesión externa', () => {
  let fixture: ComponentFixture<NavigationComponent>;
  let sesion: ExternalSessionService;

  const SESION = {
    userId: '13',
    fullName: 'Camila Prueba Responsable',
    email: 'creacionorgprueba@pnmc.test',
    accountStatus: 'activo',
    organizations: [{ id: '117', name: 'CreacionOrgPrueba', role: 'administrador' }],
  };

  beforeEach(async () => {
    localStorage.removeItem('pnmc_web_texts');
    await TestBed.configureTestingModule({
      imports: [NavigationComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationComponent);
    sesion = TestBed.inject(ExternalSessionService);
    fixture.detectChanges();
  });

  afterEach(() => {
    sesion.establecer(null);
    localStorage.removeItem('pnmc_web_texts');
  });

  it('sin sesión ofrece la puerta, no un panel', () => {
    const raiz = fixture.nativeElement as HTMLElement;

    // El menú móvil está cerrado, así que el único mando pintado es el icono de escritorio.
    expect(botonesDeAcceso(raiz).length).toBe(1);
    expect(raiz.querySelectorAll('[data-panel-sesion-externa]').length).toBe(0);
    // Y el menú de acceso nace cerrado: el icono lo abre, no lo trae abierto.
    expect(raiz.querySelector('[data-testid="menu-de-acceso"]')).toBeNull();
  });

  it('el acceso de escritorio lleva el texto «Ingresar» junto al icono, sin círculo ni botón verde', () => {
    // No es verde porque «Ecosistema» lo es: dos botones sólidos verdes en la
    // misma barra se leían como el mismo tipo de acción. Y no lleva círculo ni
    // borde. Desde (L7) el icono lleva el rótulo «Ingresar» al lado: la única puerta a la cuenta
    // era un icono sin texto, difícil de descubrir. El texto visible es su nombre accesible.
    const acceso = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="iniciar-sesion"]');

    expect(acceso).withContext('desapareció el acceso a la sesión').toBeTruthy();
    expect(acceso!.getAttribute('aria-label')).withContext('el texto visible ya nombra el botón').toBeNull();
    expect(acceso!.getAttribute('aria-haspopup')).toBe('menu');
    expect(acceso!.textContent?.trim()).toBe('Ingresar');
    expect(acceso!.className).not.toContain('bg-verde');
    expect(acceso!.className).not.toContain('rounded-full');
    expect(acceso!.className).not.toContain('border-white');
    expect(acceso!.querySelector('svg')).withContext('el icono no se pintó').toBeTruthy();
  });

  /**
   * UN CLIC FUERA TAMBIEN LO CIERRA, no solo Escape o el tabulador.
   *
   * El criterio es este: el menú de «Ingresar / Crear cuenta» quedaba
   * abierto al hacer clic en cualquier zona sin foco propio -el fondo de la página, un párrafo-
   * porque `alSalirElFocoDelMenuDeCuenta` solo escucha `focusout`, y un clic ahí no mueve
   * `document.activeElement`. `onDocumentPointerDown` es el complemento para el ratón.
   */
  it('un clic fuera del menú de acceso lo cierra', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const boton = raiz.querySelector<HTMLButtonElement>('[data-testid="iniciar-sesion"]')!;

    boton.click();
    fixture.detectChanges();
    expect(raiz.querySelector('[data-testid="menu-de-acceso"]')).withContext('el menú no se abrió').toBeTruthy();

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(raiz.querySelector('[data-testid="menu-de-acceso"]')).withContext('el menú siguió abierto tras el clic fuera').toBeNull();
  });

  it('un clic dentro del menú de acceso no lo cierra', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const boton = raiz.querySelector<HTMLButtonElement>('[data-testid="iniciar-sesion"]')!;

    boton.click();
    fixture.detectChanges();
    const panel = raiz.querySelector<HTMLElement>('[data-testid="menu-de-acceso"]')!;

    panel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(raiz.querySelector('[data-testid="menu-de-acceso"]')).withContext('el clic dentro cerró el menú').toBeTruthy();
  });

  it('con sesión el botón de entrar deja su sitio al panel de la organización', () => {
    sesion.establecer(SESION);
    fixture.componentInstance.toggleMobileMenu();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const paneles = raiz.querySelectorAll('[data-panel-sesion-externa]');

    // Dos: el de escritorio y el del menú móvil. Si solo cambiara uno, la mitad del portal
    // seguiría pidiendo entrar a quien ya entró.
    expect(paneles.length).toBe(2);
    // EL CHIP DICE QUIÉN ERES: la persona, no la primera organización de la sesión.
    expect(raiz.textContent).toContain('Camila Prueba Responsable');
    expect(raiz.textContent).toContain('Gestión');
    expect(raiz.textContent).toContain('Mi espacio');
    // Por nombre accesible: el de escritorio ya no tiene texto, así que un
    // `not.toContain` sobre `textContent` seguiría verde aunque el icono se quedara
    // pintado encima del panel de la organización.
    expect(botonesDeAcceso(raiz).length).toBe(0);
  });

  it('«Gestión» lleva a la dirección propia del panel, no a la pantalla de acceso', () => {
    sesion.establecer(SESION);
    fixture.detectChanges();

    const componente = fixture.componentInstance;
    spyOn(componente, 'onNavigateToPath');
    componente.irAMiPanel();

    // ANTES LLEVABA A `ecosistema/ingresar`. Con sesión abierta esa pantalla cambiaba su vista
    // interna y se quedaba en esa dirección: «Mi panel» llevaba a una URL que dice «ingresar» a
    // quien ya entró, no se podía guardar en marcadores y volver atrás devolvía al formulario.
    expect(componente.onNavigateToPath).toHaveBeenCalledWith('gestion');
  });

  // ---------------------------------------------------------------------------------------------
  // El menú de la cuenta
  //
  // El chip de la barra pasó de ser un enlace a ser el disparador de un menú. Antes había DOS
  // botones sueltos compitiendo por sitio en la barra —«Mi panel» y «Salir»—, y cada destino nuevo
  // de la cuenta habría añadido otro.
  // ---------------------------------------------------------------------------------------------

  const raizDe = () => fixture.nativeElement as HTMLElement;
  const disparador = () => raizDe().querySelector<HTMLButtonElement>('[data-menu-de-cuenta]')!;
  const panelDelMenu = () => raizDe().querySelector('[data-menu-de-cuenta-panel]');

  it('el menú nace cerrado y el disparador lo dice', () => {
    sesion.establecer(SESION);
    fixture.detectChanges();

    expect(panelDelMenu()).withContext('el menú no debería estar abierto de entrada').toBeNull();
    expect(disparador().getAttribute('aria-expanded')).toBe('false');
    expect(disparador().getAttribute('aria-haspopup')).toBe('menu');
  });

  it('al pulsar el chip se abre el menú con sus entradas', () => {
    sesion.establecer(SESION);
    fixture.detectChanges();

    disparador().click();
    fixture.detectChanges();

    const panel = panelDelMenu()!;
    expect(panel).withContext('el menú no se abrió').toBeTruthy();
    expect(panel.getAttribute('role')).toBe('menu');
    expect(disparador().getAttribute('aria-expanded')).toBe('true');

    // Quién está dentro, y luego los dos bloques de la propuesta de la auditoría: la
    // persona y sus organizaciones, con su rol.
    expect(panel.textContent).toContain('Camila Prueba Responsable');
    expect(panel.textContent).toContain('creacionorgprueba@pnmc.test');

    const grupos = Array.from(panel.querySelectorAll('[role="group"]'));
    expect(grupos.map(grupo => grupo.querySelector('p')?.textContent?.trim())).toEqual(['Persona', 'Mis organizaciones']);
    const entradas = (grupo: Element) => Array.from(grupo.querySelectorAll('[role="menuitem"]'))
      .map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(entradas(grupos[0])).toEqual(['Mi espacio', 'Perfil público', 'Contraseña y seguridad', 'Mis autorizaciones']);
    const organizaciones = entradas(grupos[1]);
    // SIN «REGISTRAR UNA ORGANIZACIÓN» (ACC2): esa acción vive en Mi espacio → Mis organizaciones.
    expect(organizaciones.length).toBe(1);
    expect(organizaciones[0]).toContain('CreacionOrgPrueba');
    expect(organizaciones[0]).toContain('Administrador');
    expect(panel.querySelector('[data-menu-registrar-organizacion]')).toBeNull();
    expect(panel.textContent).not.toContain('Registrar una organización');
    // «Datos de la organización» YA NO ESTÁ: llevaba a una pantalla vacía a la cuenta individual.
    expect(panel.textContent).not.toContain('Datos de la organización');
    expect(panel.querySelector('[data-menu-cerrar-sesion]')?.textContent?.trim()).toBe('Cerrar sesión');
  });

  it('las entradas de destino del menú son enlaces y solo «Cerrar sesión» es un botón', () => {
    sesion.establecer(SESION);
    fixture.detectChanges();
    disparador().click();
    fixture.detectChanges();

    const entradas = Array.from(panelDelMenu()!.querySelectorAll('[role="menuitem"]'));
    // Mi espacio, Perfil público, Contraseña y seguridad, Mis autorizaciones, la organización y Cerrar sesión: «Registrar una organización» salió (ACC2).
    expect(entradas.length).toBe(6);
    for (const entrada of entradas) {
      const esperado = entrada.hasAttribute('data-menu-cerrar-sesion') ? 'BUTTON' : 'A';
      expect(entrada.tagName).withContext(`«${entrada.textContent?.trim()}»`).toBe(esperado);
    }
    expect(panelDelMenu()!.querySelector('[data-menu-mi-espacio]')?.getAttribute('href')).toBe('/gestion/cuenta');
    expect(panelDelMenu()!.querySelector('[data-menu-organizacion="117"]')?.getAttribute('href')).toBe('/gestion/o/117/resumen');
  });

  it('cada entrada lleva a su dirección: la persona a su espacio y cada organización a su panel', () => {
    sesion.establecer(SESION);
    fixture.detectChanges();

    const componente = fixture.componentInstance;
    // SIN `.and.callThrough()`: la implementación real también cierra el menú
    // (`setActiveNavDropdown(null)`), así que espiarla sin dejarla correr mantiene el panel abierto
    // para pulsar las dos entradas en el mismo ciclo, sin tener que reabrirlo entre una y otra.
    spyOn(componente, 'onNavigateToPath');

    disparador().click();
    fixture.detectChanges();

    (panelDelMenu()!.querySelector('[data-menu-mi-espacio]') as HTMLButtonElement).click();
    expect(componente.onNavigateToPath).toHaveBeenCalledWith('gestion/cuenta');

    (panelDelMenu()!.querySelector('[data-menu-perfil-publico]') as HTMLButtonElement).click();
    expect(componente.onNavigateToPath).toHaveBeenCalledWith('gestion/cuenta/perfil-publico');

    (panelDelMenu()!.querySelector('[data-menu-cuenta-seguridad]') as HTMLButtonElement).click();
    expect(componente.onNavigateToPath).toHaveBeenCalledWith('gestion/cuenta/seguridad');

    (panelDelMenu()!.querySelector('[data-menu-cuenta-autorizaciones]') as HTMLButtonElement).click();
    expect(componente.onNavigateToPath).toHaveBeenCalledWith('gestion/cuenta/autorizaciones');

    (panelDelMenu()!.querySelector('[data-menu-organizacion="117"]') as HTMLButtonElement).click();
    expect(componente.onNavigateToPath).toHaveBeenCalledWith('gestion/o/117/resumen');
  });

  it('la organización activa la dice la URL: el chip la nombra y el menú la marca', () => {
    sesion.establecer({ ...SESION, organizations: [...SESION.organizations, { id: '1117', name: 'Corporación Tambó', role: 'editor' }] });
    TestBed.inject(ContextoDeOrganizacionService).organizacionId.set('1117');
    fixture.detectChanges();

    expect(raizDe().querySelector('[data-testid="chip-nombre-cuenta"]')?.textContent?.trim()).toBe('Camila Prueba Responsable');
    // SOLO EL NOMBRE de la organización activa, sin «Actuando como» (ACC2).
    expect(raizDe().querySelector('[data-testid="chip-organizacion-activa"]')?.textContent?.trim()).toBe('Corporación Tambó');

    disparador().click();
    fixture.detectChanges();
    expect(panelDelMenu()!.querySelector('[data-menu-organizacion="1117"]')?.getAttribute('aria-current')).toBe('true');
    expect(panelDelMenu()!.querySelector('[data-menu-organizacion="117"]')?.getAttribute('aria-current')).toBeNull();
    expect(panelDelMenu()!.querySelector('[data-menu-organizacion="1117"]')?.textContent).toContain('Editor');
  });

  it('fuera del panel de una organización no hay chip de organización (y ya nunca dice «Actuando como»)', () => {
    sesion.establecer(SESION);
    TestBed.inject(ContextoDeOrganizacionService).organizacionId.set('');
    fixture.detectChanges();

    expect(raizDe().querySelector('[data-testid="chip-organizacion-activa"]')).toBeNull();
  });

  it('Escape cierra el menú', () => {
    sesion.establecer(SESION);
    fixture.detectChanges();
    disparador().click();
    fixture.detectChanges();
    expect(panelDelMenu()).toBeTruthy();

    fixture.componentInstance.onEscape();
    fixture.detectChanges();

    expect(panelDelMenu()).withContext('Escape no cerró el menú').toBeNull();
  });

  it('el segundo clic en el chip vuelve a cerrarlo', () => {
    sesion.establecer(SESION);
    fixture.detectChanges();

    disparador().click();
    fixture.detectChanges();
    expect(panelDelMenu()).toBeTruthy();

    disparador().click();
    fixture.detectChanges();
    expect(panelDelMenu()).toBeNull();
  });

  it('sin sesión no hay menú de cuenta que abrir', () => {
    fixture.detectChanges();

    expect(raizDe().querySelector('[data-menu-de-cuenta]')).toBeNull();
  });
});
