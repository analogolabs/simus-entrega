import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { esClicDeNavegacion } from '../../../../core/navegacion/clic-de-navegacion';
import { OrbitaComponent } from '../../../../shared/components/ui/orbita/orbita.component';
import { NavigationService } from '../../../../core/services/navigation.service';
import { TextosWebService } from '../../../../core/services/textos-web.service';

/**
 * ENCABEZADO DE LA PORTADA: UN ELEMENTO GRANDE, UN MENSAJE, UNA ACCIÓN.
 *
 * El logotipo oficial de SIMUS, el lema, una descripción de dos líneas y una sola acción
 * principal (explorar el ecosistema, en blanco sobre morado: el amarillo se reserva); el PNMC va
 * como enlace secundario. El único recurso gráfico es la Órbita SIMUS en grande. Ocupa la
 * pantalla completa y una flecha invita a bajar a la sección siguiente. No hay foto ni carrusel.
 */
@Component({
  selector: 'app-portada-encabezado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextoWebPipe, LucideChevronDown, OrbitaComponent],
  templateUrl: './portada-encabezado.component.html',
})
export class PortadaEncabezadoComponent {
  private readonly webTexts = inject(TextosWebService);
  private readonly navigation = inject(NavigationService);

  imagen(clave: string): string {
    return this.webTexts.getWebImage(clave);
  }

  texto(clave: string): string {
    return this.webTexts.getWebText(clave);
  }

  /** Lleva a la sección siguiente, descontando la barra de navegación fija. */
  bajar(): void {
    const destino = document.getElementById('portada-que-es');
    if (!destino) return;
    const barra = document.querySelector('nav[aria-label="Navegación principal"]')?.getBoundingClientRect().height ?? 0;
    window.scrollTo({ top: destino.getBoundingClientRect().top + window.scrollY - barra, behavior: 'smooth' });
  }

  ir(evento: MouseEvent, ruta: string): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.navigation.routerNavigate(ruta);
  }
}
