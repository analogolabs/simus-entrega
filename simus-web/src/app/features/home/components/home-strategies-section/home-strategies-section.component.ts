import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { EncabezadoDeSeccionComponent } from '../encabezado-de-seccion/encabezado-de-seccion.component';
import { esClicDeNavegacion } from '../../../../core/navegacion/clic-de-navegacion';
import { NavigationService } from '../../../../core/services/navigation.service';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { RevelarDirective } from '../../../../shared/directives/revelar.directive';

/**
 * EXPLORA SIMUS: LAS PUERTAS DE ENTRADA.
 *
 * Cinco maneras de usar el sistema, no cinco categorías de la base: el Ecosistema musical como
 * puerta principal (allí viven festivales, mercados, escuelas, escenarios, redes… y las que
 * vengan), Conocimiento, Historias, Agenda y el PNMC. Si el Ecosistema pasa de seis a veinticinco
 * tipos de registro, esta cuadrícula no cambia.
 *
 * `clave` es el prefijo de sus textos en el panel (`strat_${clave}_tag`, `_title`, `_desc`); la de
 * Agenda conserva la clave de la antigua tarjeta («mercados») aunque el nombre no la describa.
 * La foto sale de `home_ruta_${posición}`. `celda: 'grande'` es la del Ecosistema, con el título
 * más grande. `ancho` es su parte de las doce columnas: dos filas
 * de anchos distintos (8 + 4 y 5 + 3 + 4), para que la cuadrícula no sea simétrica.
 */
export const TARJETAS_DE_SIMUS = [
  { id: 'ecosistema', clave: 'ecosistema', navigatePath: 'ecosistema', celda: 'grande', ancho: 'lg:col-span-8' },
  { id: 'conocimiento', clave: 'conocimiento', navigatePath: 'editorial', celda: 'puerta', ancho: 'lg:col-span-4' },
  { id: 'historias', clave: 'historias', navigatePath: 'noticias', celda: 'puerta', ancho: 'lg:col-span-5' },
  { id: 'agenda', clave: 'mercados', navigatePath: 'agenda', celda: 'puerta', ancho: 'lg:col-span-3' },
  { id: 'pnmc', clave: 'pnmc', navigatePath: 'pnmc', celda: 'puerta', ancho: 'lg:col-span-4' },
] as const satisfies readonly { id: string; clave: string; navigatePath: string; celda: string; ancho: string }[];

@Component({
  selector: 'app-home-strategies-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RevelarDirective, EncabezadoDeSeccionComponent],
  templateUrl: './home-strategies-section.component.html',
})
export class HomeStrategiesSectionComponent {
  private readonly navigationService = inject(NavigationService);
  private readonly webTexts = inject(TextosWebService);

  readonly tarjetas = computed(() =>
    TARJETAS_DE_SIMUS.map((tarjeta, indice) => ({
      ...tarjeta,
      img: this.webTexts.getWebImage(`home_ruta_${indice + 1}`),
      alt: this.webTexts.getWebImageAlt(`home_ruta_${indice + 1}`),
      tag: this.webTexts.getWebText(`strat_${tarjeta.clave}_tag`),
      title: this.webTexts.getWebText(`strat_${tarjeta.clave}_title`),
      desc: this.webTexts.getWebText(`strat_${tarjeta.clave}_desc`),
    })),
  );

  getWebText(key: string): string {
    return this.webTexts.getWebText(key);
  }

  abrir(evento: MouseEvent, ruta: string): void {
    if (!esClicDeNavegacion(evento)) return;
    evento.preventDefault();
    this.navigationService.routerNavigate(ruta);
  }
}
