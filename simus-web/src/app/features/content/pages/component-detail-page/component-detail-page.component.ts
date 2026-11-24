import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideBookOpen, LucideCalendar, LucideMapPin } from '@lucide/angular';
import { resolveEjes } from '../../../../core/cms/resolve-ejes';
import { ejesDataGlobal, EjeComponent } from '../../../../core/services/ejes-data.config';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { NavigationService, PAGE_IDS } from '../../../../core/services/navigation.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { CatalogoEditorialService } from '../../../../core/services/catalogo-editorial.service';
import { STRATEGIES_DATA } from '../../../../core/services/strategies-data.config';
import { RecursoNoEncontradoComponent } from '../../../../shared/components/ui/recurso-no-encontrado/recurso-no-encontrado.component';
import { TagComponent } from '../../../../shared/components/ui/tag/tag.component';
import { PnmcHeroComponent } from '../../../pnmc/components/pnmc-hero.component';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';

import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';
@Component({
  selector: 'app-component-detail-page',
  standalone: true,
  imports: [BotonNativoDirective, NombrePropioPipe, CommonModule, RouterLink, RecursoNoEncontradoComponent, TagComponent, PnmcHeroComponent, LucideBookOpen, LucideCalendar, LucideMapPin],
  templateUrl: './component-detail-page.component.html',
})
export class ComponentDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly catalogoEditorial = inject(CatalogoEditorialService);
  private readonly webTexts = inject(TextosWebService);
  readonly navigation = inject(NavigationService);
  readonly pageId = PAGE_IDS.ejes;

  /** Textos editables de la ficha. Ver el grupo `component_detail` del registro. */
  texto(clave: string): string {
    return this.webTexts.getWebText(clave);
  }

  // Reactivo a los parámetros de ruta: al navegar entre componentes (misma ruta,
  // distinto parámetro) Angular reutiliza la instancia, por lo que leer el snapshot
  // una sola vez dejaba la vista congelada. Con un signal se actualiza en cada cambio.
  private readonly paramMap = toSignal(this.route.paramMap);
  readonly componentSlug = computed(() => this.paramMap()?.get('componentSlug') ?? '');

  // Catálogo editorial para vincular productos relacionados con el componente.
  readonly editorialResources = signal<any[]>([]);
  readonly editorialLoading = signal<boolean>(true);
  readonly editorialError = signal<boolean>(false);

  // Agenda para vincular eventos relacionados con el componente.
  readonly agendaEvents = signal<any[]>([]);
  readonly agendaLoading = signal<boolean>(true);
  readonly agendaError = signal<boolean>(false);

  readonly match = computed(() => {
    // Se busca sobre los ejes YA resueltos contra el CMS: si se buscara sobre
    // los compilados, la ficha mostraría el texto de fábrica aunque el panel
    // hubiera publicado otro.
    for (const eje of resolveEjes(ejesDataGlobal, (clave) => this.webTexts.getWebText(clave))) {
      const component = eje.components.find((item) => item.slug === this.componentSlug());
      if (component) return { eje, component };
    }
    return null;
  });

  /** El componente anterior y el siguiente dentro del mismo eje. */
  readonly hermanos = computed(() => {
    const actual = this.match();
    if (!actual) return null;
    const lista = actual.eje.components;
    const i = lista.findIndex((c) => c.slug === actual.component.slug);
    const anterior = i > 0 ? lista[i - 1] : null;
    const siguiente = i >= 0 && i < lista.length - 1 ? lista[i + 1] : null;
    return anterior || siguiente ? { anterior, siguiente } : null;
  });

  // Productos del acervo editorial cuya etiqueta/categoría coincide con el componente.
  readonly relatedResources = computed(() => {
    const current = this.match();
    if (!current) return [];
    const tokens = this.matchTokens(current.component);
    if (!tokens.length) return [];

    return this.editorialResources()
      .filter((resource) => {
        const tagText = this.normalize(
          [
            ...(resource.keywords || []),
            resource.section,
            resource.sectionPath,
            resource.category,
            resource.subcategory,
            resource.practice,
          ]
            .filter(Boolean)
            .join(' '),
        );
        return tokens.some((token) => tagText.includes(token));
      })
      .slice(0, 6);
  });

  // Eventos de agenda cuya etiqueta/categoría coincide con el componente.
  readonly relatedAgenda = computed(() => {
    const current = this.match();
    if (!current) return [];
    const tokens = this.matchTokens(current.component);
    if (!tokens.length) return [];

    return this.agendaEvents()
      .filter((event) => {
        const tagText = this.normalize(
          [...(event.tags || []), event.category].filter(Boolean).join(' '),
        );
        return tokens.some((token) => tagText.includes(token));
      })
      .slice(0, 5);
  });

  // Estrategias del PNMC vinculadas a este componente (mismo estilo que el home).
  readonly relatedStrategies = computed(() => {
    const target = `comp-${this.match()?.component.id ?? ''}`;
    return STRATEGIES_DATA.filter((strategy) => strategy.componentId === target);
  });

  onStrategyNavigate(navigatePath: string): void {
    if (navigatePath.startsWith('comp-')) {
      this.navigation.navigateComponent(navigatePath.substring(5));
    } else {
      this.navigation.navigate(navigatePath);
    }
  }

  ngOnInit(): void {
    this.catalogoEditorial.listarParaElPortal().subscribe({
      next: (res) => {
        this.editorialResources.set(Array.isArray(res?.items) ? res.items : []);
        this.editorialLoading.set(false);
      },
      error: () => {
        this.editorialError.set(true);
        this.editorialLoading.set(false);
      },
    });

    this.catalog.fetchAgendaEvents().subscribe({
      next: (res) => {
        this.agendaEvents.set(Array.isArray(res?.items) ? res.items : []);
        this.agendaLoading.set(false);
      },
      error: () => {
        this.agendaError.set(true);
        this.agendaLoading.set(false);
      },
    });
  }

  openAgendaEvent(event: any): void {
    if (event?.slug) {
      this.navigation.navigateToAgendaEvent(event.slug);
    } else {
      this.navigation.navigate('agenda');
    }
  }

  goToAgenda(): void {
    this.navigation.navigate('agenda');
  }

  openEditorialResource(resource: any): void {
    if (resource?.id) {
      this.navigation.navigateToEditorialResource(resource.id);
    } else {
      this.navigation.navigate('editorial');
    }
  }

  goToEditorial(): void {
    this.navigation.navigate('editorial');
  }

  // Palabras/etiquetas con las que se busca el vínculo editorial.
  private readonly genericTokens = new Set([
    'musica', 'musicas', 'musical', 'musicales', 'musicos', 'cultura', 'cultural',
    'culturales', 'plan', 'nacional', 'convivencia', 'sonora', 'sonoro', 'derechos',
  ]);

  private matchTokens(component: EjeComponent): string[] {
    const tags = component.relatedTags ?? [];
    if (tags.length) {
      return tags.map((tag) => this.normalize(tag)).filter(Boolean);
    }
    return this.normalize(component.name)
      .split(' ')
      .filter((word) => word.length >= 6 && !this.genericTokens.has(word));
  }

  private normalize(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
