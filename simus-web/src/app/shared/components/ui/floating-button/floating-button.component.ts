import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService, PAGE_IDS } from '../../../../core/services/navigation.service';
import { IconoFijoComponent } from '../icono-fijo/icono-fijo.component';

@Component({
  selector: 'app-floating-button',
  standalone: true,
  imports: [CommonModule, IconoFijoComponent],
  templateUrl: './floating-button.component.html',
  styleUrls: ['./floating-button.component.css']
})
export class FloatingButtonComponent {
  private navigationService = inject(NavigationService);
  activePage = this.navigationService.activePage;

  shouldShow = computed(() => {
    const page = this.activePage();
    // No mostrar en El Plan (donde vive la estrategia), administración o mapa. `colaboradores` estaba en esta lista
    // y se retiró con la ruta.
    return page !== PAGE_IDS.pnmc &&
           page !== PAGE_IDS.admin &&
           // El panel de la organizacion externa es una pantalla de trabajo: un boton flotante de
           // promocion se queda encima de su esquina inferior derecha. Mismo criterio que /admin.
           page !== PAGE_IDS.miPanel &&
           page !== PAGE_IDS.mapa;
  });

  navigateToStrategy() {
    this.navigationService.navigate(PAGE_IDS.estrategiaCirculacion);
  }
}
