import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideBookOpen, LucideGuitar, LucideLandmark, LucideLibrary, LucideMap, LucideMapPin, LucideMusic2 } from '@lucide/angular';
import { esClicDeNavegacion } from '../../../../core/navegacion/clic-de-navegacion';
import { CATEGORIAS_ECOSISTEMA, CategoriaEcosistema, procesosActivos } from '../../../../core/services/categorias-ecosistema.config';
import { MapDataService } from '../../../../core/services/map-data.service';
import { NavigationService } from '../../../../core/services/navigation.service';
import { PageHeroComponent } from '../../../../shared/components/ui/page-hero/page-hero.component';
import { TextosWebService } from '../../../../core/services/textos-web.service';

import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';
@Component({
  selector: 'app-ecosistema-home-page',
  standalone: true,
  imports: [TextoWebPipe, BotonNativoDirective, CommonModule, RouterLink, PageHeroComponent, LucideBookOpen, LucideGuitar, LucideLandmark, LucideLibrary, LucideMap, LucideMapPin, LucideMusic2],
  templateUrl: './ecosistema-home-page.component.html',
})
export class EcosistemaHomePageComponent implements OnInit {
  private readonly navigation = inject(NavigationService);
  private readonly mapData = inject(MapDataService);
  private readonly webTexts = inject(TextosWebService);

  /** Texto editable de la portada del ecosistema. Ver el grupo `ecosistema_*` del registro. */
  texto(clave: string): string {
    return this.webTexts.getWebText(clave);
  }

  /**
   * Imagen editable. Devuelve la publicada en el CMS o, si no hay ninguna, la
   * compilada del registro: nunca cadena vacia. Ver `registro-de-imagenes-web.ts`.
   */
  imagen(clave: string): string {
    return this.webTexts.getWebImage(clave);
  }

  readonly accessPaths = computed(() => [
    { title: this.texto('ecosistema_explore_map_title'), description: this.texto('ecosistema_explore_map_desc'), icon: 'map', action: () => this.navigation.navigate('mapa') },
    { title: this.texto('ecosistema_explore_editorial_title'), description: this.texto('ecosistema_explore_editorial_desc'), icon: 'editorial', action: () => this.navigation.navigate('editorial') },
    { title: this.texto('ecosistema_explore_news_title'), description: this.texto('ecosistema_explore_news_desc'), icon: 'news', action: () => this.navigation.navigate('noticias') },
  ]);

  readonly recordsByType = signal<Record<string, number>>({});
  readonly isLoadingEcosystem = signal(true);

  readonly ecosystemCategories: CategoriaEcosistema[] = CATEGORIAS_ECOSISTEMA;

  readonly primaryCategories = computed(() => procesosActivos(this.ecosystemCategories));

  ngOnInit(): void {
    this.mapData.fetchMapCountsBundle().subscribe({
      next: data => {
        this.recordsByType.set({
          festivals: data.festivalRecords?.length || 0,
          markets: data.marketRecords?.length || 0,
          networks: data.redesRecords?.length || 0,
          lutiers: data.luthierRecords?.length || 0,
          spaces: data.spaceRecords?.length || 0,
        });
        this.isLoadingEcosystem.set(false);
      },
      error: () => this.isLoadingEcosystem.set(false),
    });
  }

  count(category: CategoriaEcosistema): number { return category.countKey ? this.recordsByType()[category.countKey] || 0 : 0; }
  openCategory(evento: MouseEvent, category: CategoriaEcosistema): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    // DOS CONDICIONES, NO UNA, Y LA SEGUNDA LA IMPONE EL TIPO. Antes bastaba con el estado, y
    // las cinco categorías sin pantalla declaraban igualmente una ruta inexistente. Ahora solo
    // tiene ruta la que tiene a dónde ir: marcar una como disponible sin darle pantalla ya no
    // compila, en vez de llevar al comodín de «página no encontrada».
    if (category.status !== 'Disponible' || !category.route) return;
    this.navigation.routerNavigate(category.route);
  }
  openMapLayer(layer = 'General'): void { this.navigation.navigateToMapLayer(layer, { targetView: 'map' }); }
  openContact(): void {
    this.navigation.routerNavigate('pnmc');
    setTimeout(() => document.getElementById('pnmc-equipo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
  }
  go(path: string): void { this.navigation.routerNavigate(path); }
}
