import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService } from '../../core/services/navigation.service';
import { TextosWebService } from '../../core/services/textos-web.service';
import { PortadaEncabezadoComponent } from './components/portada-encabezado/portada-encabezado.component';
import { FooterComponent } from '../../shared/components/layout/footer/footer.component';

import { PNMCPreviewSectionComponent } from './components/pnmc-preview-section/pnmc-preview-section.component';
import { HomeStrategiesSectionComponent } from './components/home-strategies-section/home-strategies-section.component';
import { PortadaTerritorioComponent } from './components/portada-territorio/portada-territorio.component';
import { NoticiasAgendaPreviewComponent } from './components/noticias-agenda-preview/noticias-agenda-preview.component';
import { redesConDireccionDelCms } from '../../core/config/redes-institucionales';
import { IconoDeRedComponent } from '../../shared/components/ui/icono-de-red/icono-de-red.component';
import { PreguntaDestacadaComponent } from './components/pregunta-destacada/pregunta-destacada.component';
import { BoletinFormComponent } from './components/boletin-form/boletin-form.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    PortadaEncabezadoComponent,
    FooterComponent,
    PNMCPreviewSectionComponent,
    HomeStrategiesSectionComponent,
    PortadaTerritorioComponent,
    NoticiasAgendaPreviewComponent,
    BoletinFormComponent,
    PreguntaDestacadaComponent,
    IconoDeRedComponent,
  ],
  templateUrl: './home.component.html',
  styles: []
})
export class HomeComponent {
  navigationService = inject(NavigationService);
  webTexts = inject(TextosWebService);

  /** Las redes institucionales: una sola fuente, compartida con el pie. */
  readonly redes = computed(() => redesConDireccionDelCms(clave => this.webTexts.getWebText(clave)));

  scrollTargetElement: HTMLElement | null = null;

  getWebText(key: string): string {
    return this.webTexts.getWebText(key);
  }

  navigateTo(pageId: string) {
    this.navigationService.navigate(pageId);
  }

  navigateToMapLayer(layerName: string) {
    this.navigationService.navigateToMapLayer(layerName);
  }

  registerScrollTarget(element: HTMLElement) {
    this.scrollTargetElement = element;
  }
}
