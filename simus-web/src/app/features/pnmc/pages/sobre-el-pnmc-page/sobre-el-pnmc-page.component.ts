import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {     
  LucideGlobe, 
  LucideUsers2, 
  LucideMap,   
  LucideUserCircle2,  
} from '@lucide/angular';
import { NavigationService } from '../../../../core/services/navigation.service';
import { resolveEjes } from '../../../../core/cms/resolve-ejes';
import { ESTRATEGIAS_COMPILADAS, resolveStrategy } from '../../../../core/cms/resolve-strategy';
import { ejesDataGlobal } from '../../../../core/services/ejes-data.config';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { RevelarDirective } from '../../../../shared/directives/revelar.directive';
import { PnmcHeroComponent } from '../../components/pnmc-hero.component';
import { PestanasDeSeccionComponent } from '../../../../shared/components/ui/pestanas-de-seccion/pestanas-de-seccion.component';
import { SectionHeaderComponent } from '../../../../shared/components/ui/section-header/section-header.component';
import { TagComponent } from '../../../../shared/components/ui/tag/tag.component';
import { ContentWrapperComponent } from '../../../../shared/components/ui/content-wrapper/content-wrapper.component';

@Component({
  selector: 'app-sobre-el-pnmc-page',
  standalone: true,
  imports: [TextoWebPipe, 
    CommonModule,
    RouterLink,
    RevelarDirective,
    PnmcHeroComponent,
    PestanasDeSeccionComponent,
    SectionHeaderComponent,
    TagComponent,
    ContentWrapperComponent,    
    LucideGlobe, 
    LucideUsers2, 
    LucideMap,   
    LucideUserCircle2, 
  ],
  templateUrl: './sobre-el-pnmc-page.component.html'
})
export class SobreElPnmcPageComponent {
  private navigationService = inject(NavigationService);
  private webTexts = inject(TextosWebService);

  /**
   * La foto de una cabecera SOLO si es propia. Las ranuras del panel traen por defecto fotos de
   * stock (Unsplash) que no se deben mostrar; si nadie subió una foto propia, la tarjeta va con el
   * fondo violeta del Plan.
   */
  fotoPropia(url: string | null | undefined): string {
    return url && !/unsplash\.com/i.test(url) ? url : '';
  }

  /** Las fotos de las dos estrategias: del proyecto (banner de la versión 1), no de stock. */
  fotoDeEstrategia(i: number): string {
    return this.webTexts.getWebImage(i === 0 ? 'estrategia_celebra_media' : 'estrategia_territorios_media');
  }

  /** El color de la barrita de cada componente: rota por la paleta (magenta, cian, verde y violeta vivo) para que la lista no sea homogénea. */
  colorDeComponente(j: number): string {
    return ['var(--color-magenta)', 'var(--color-cian)', 'var(--color-verde)', 'var(--color-morado-vivo)'][j % 4];
  }

  /** El PDF del documento del Plan (publicado por el Ministerio en mayo de 2025), servido desde el proyecto. */
  readonly urlDocumento = '/assets/pnmc/documento-pnmc-2025-2035.pdf';

  /** Portada de la pagina, administrable. Ver `registro-de-imagenes-web.ts`. */
  imagen(clave: string): string {
    return this.webTexts.getWebImage(clave);
  }

  imagenAlt(clave: string): string {
    return this.webTexts.getWebImageAlt(clave);
  }

  /**
   * EL PLAN EN UNA SOLA PAGINA, CON LAS FICHAS DE COMPONENTE COMO SUBPAGINAS.
   *
   * SIMUS es el sistema completo y El Plan —el PNMC— es una sección del portal de segundo nivel.
   * Antes ocupaba catorce páginas: «Sobre el PNMC», «Ejes», diez fichas de componente y dos
   * estrategias. Ahora todo vive aquí, con navegación interna por anclas, y solo las fichas de
   * componente conservan dirección propia (`/pnmc/ejes/:componente`). Las direcciones viejas
   * redirigen a su ancla: ver `app.routes.ts`.
   */
  readonly secciones = computed(() => [
    { id: 'pnmc-presentacion', rotulo: this.webTexts.getWebText('about_nav_presentacion') },
    { id: 'pnmc-enfoques', rotulo: this.webTexts.getWebText('about_nav_enfoques') },
    { id: 'ejes', rotulo: this.webTexts.getWebText('about_nav_ejes') },
    { id: 'pnmc-documento', rotulo: this.webTexts.getWebText('about_nav_documento') },
    { id: 'estrategias', rotulo: this.webTexts.getWebText('about_nav_estrategias') },
    { id: 'pnmc-actores', rotulo: this.webTexts.getWebText('about_nav_actores') },
    { id: 'pnmc-hitos', rotulo: this.webTexts.getWebText('about_nav_hitos') },
    { id: 'pnmc-marco', rotulo: this.webTexts.getWebText('about_nav_marco') },
    { id: 'pnmc-equipo', rotulo: this.webTexts.getWebText('about_nav_equipo') },
  ]);

  /** Los tres ejes con los textos publicados en el panel. Mismo resolvedor que las fichas. */
  readonly ejes = computed(() =>
    resolveEjes(
      ejesDataGlobal,
      (clave) => this.webTexts.getWebText(clave),
    ),
  );

  /** Ancla de cada eje: las mismas que tenía `/ejes`, para que los enlaces guardados sigan valiendo. */
  readonly anclasDeEje = ['musica-para-la-vida', 'oficios-y-practicas', 'gobernanza'];

  /** Las dos estrategias del Plan, con sus anclas. Antes eran dos páginas sueltas. */
  readonly estrategias = computed(() => [
    // Solo las estrategias con micrositio llevan `ruta`; el resto se anuncia como «Próximamente».
    { ancla: 'celebra-la-musica', ruta: ['/pnmc', 'estrategias', 'celebra-la-musica'] as string[] | null, ...this.estrategia('circulacion') },
    { ancla: 'territorios-sonoros', ruta: null as string[] | null, ...this.estrategia('investigacion') },
  ]);

  private estrategia(tipo: 'circulacion' | 'investigacion') {
    return resolveStrategy(
      ESTRATEGIAS_COMPILADAS[tipo],
      (clave) => this.webTexts.getWebText(clave),
      (clave) => this.webTexts.getWebImage(clave),
    );
  }

  activeStage = signal<number>(4);
  activeNormativeStage = signal<number>(4);

  /*
    TODO LO QUE LEE EL CMS VA EN `computed`, Y NO ES ESTILO.

    Estos ocho campos eran campos llanos, resueltos UNA VEZ al construir el componente. Con eso
    el sitio publico funcionaba de casualidad —el arranque espera al servidor antes de pintar—,
    pero la previsualizacion del panel no: el borrador viaja por `postMessage` DESPUES de que la
    pagina esta montada, y un campo llano ya no vuelve a mirar. Editar un hito o la lista de
    actores no movia nada en el marco, y se leia como que el panel no funciona.

    Es el mismo defecto que tenia `home.component.ts` con la portada, encontrado el 30 de agosto
    de 2026 y corregido el mismo dia. Aqui son ocho.
  */
  readonly workTeam = computed(() => this.webTexts.getWebTeamMembers());
  readonly coordinationTeam = computed(() => this.workTeam().filter(member => member.group === 'coordination'));
  readonly leadershipTeam = computed(() => this.workTeam().filter(member => member.group === 'leadership'));

  /** La coordinación del grupo de música va aparte; el apoyo a la coordinación se suma al equipo. */
  readonly coordinador = computed(() => this.coordinationTeam().filter(m => !/apoyo/i.test(m.role)));
  readonly equipo = computed(() => {
    const apoyo = this.coordinationTeam().filter(m => /apoyo/i.test(m.role));
    return [
      ...apoyo.map(m => ({ ...m, componente: '' })),
      ...this.leadershipTeam().map(m => ({ ...m, componente: m.role.replace('Líder Componente: ', '') })),
    ];
  });

  /** Ruta del componente de un líder («Formación», «Información»…), por coincidencia con el slug del componente. */
  rutaDeComponente(nombre: string): string[] | null {
    const clave = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!clave) return null;
    const hallado = this.ejes().flatMap(e => e.components).find(c => c.slug.includes(clave));
    if (hallado) return ['/pnmc', 'ejes', hallado.slug];
    // «Gobernanza» es el eje 3 y no un componente: enlaza a su sección en esta misma página.
    return clave === 'gobernanza' ? ['/pnmc'] : null;
  }

  /*
    LAS ONCE FOTOS DE ESTA PAGINA SON RANURAS DEL PANEL desde.

    Antes salian de `IMAGENES_DE_GALERIA` con el indice escrito a mano —[11..15] para los hitos
    y [16, 17, 18, 0, 1, 3] para las normas—. Eran decisiones editoriales de portada elegidas a
    dedo dentro de un fichero de TypeScript: la misma figura que las dieciocho de la portada, que
    entraron al panel el mismo dia.

    La clave se arma con la POSICION de la tarjeta, igual que las Rutas del Home. Un indice
    corrido pinta la foto de otro hito —una imagen valida en el sitio equivocado— y eso no lo ve
    nadie mirando la pagina: lo fija `sobre-pnmc-editable.spec.ts`.
  */
  readonly timelineEvents = computed(() => [0, 1, 2, 3, 4].map((index) => {
    const number = index + 1;
    return {
      id: index,
      year: this.getWebText(`about_timeline_${number}_year`),
      title: this.getWebText(`about_timeline_${number}_title`),
      desc: this.getWebText(`about_timeline_${number}_desc`),
      img: this.imagen(`about_hito_${number}`),
    };
  }));

  readonly normativeStages = computed(() => [0, 1, 2, 3, 4, 5].map((index) => {
    const number = index + 1;
    return {
      id: index,
      year: this.getWebText(`about_normative_${number}_year`),
      title: this.getWebText(`about_normative_${number}_title`),
      desc: this.getWebText(`about_normative_${number}_desc`),
      img: this.imagen(`about_norma_${number}`),
    };
  }));

  readonly sectorActors = computed(() => this.getWebTextLines('about_actors_sector_items'));
  readonly institutionalActors = computed(() => this.getWebTextLines('about_actors_institutional_items'));
  readonly civilActors = computed(() => this.getWebTextLines('about_actors_civil_items'));

  getWebText(key: string): string {
    return this.webTexts.getWebText(key);
  }

  getWebTextLines(key: string): string[] {
    return this.getWebText(key)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  onBackToHome() {
    this.navigationService.navigate('home');
  }

  /** El objetivo de cada eje (título y descripción del panel, grupo «Objetivos»), que se muestra dentro del propio eje. */
  objetivoDeEje(i: number): { titulo: string; descripcion: string } {
    return {
      titulo: this.getWebText(`about_objective_${i + 1}_title`),
      descripcion: this.getWebText(`about_objective_${i + 1}_desc`),
    };
  }
}
