import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideMapPin } from '@lucide/angular';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { imagenDeNoticia, respaldosDeNoticias } from '../../../../shared/utils/imagen-de-noticia';
import { EncabezadoDeSeccionComponent } from '../encabezado-de-seccion/encabezado-de-seccion.component';
import { AgendaService } from '../../../../core/services/agenda.service';
import { NoticiasService } from '../../../../core/services/noticias.service';
import { EventoDeDiseno, NoticiaDeDiseno, aEventoDeDiseno, aNoticiaDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { EmptyStateComponent, ErrorStateComponent } from '../../../../shared/components/ui/remote-state/remote-state.component';

/**
 * La portada informativa de Inicio: Noticias a la izquierda, Agenda a la derecha.
 *
 * <b>ESTABA DESCONECTADA, Y ESE ERA EL DEFECTO.</b> Hasta este bloque
 * pintaba dos recuadros fijos —«Noticias en preparación», «Aún no hay actividades publicadas»— con
 * un enlace a cada sección. El comentario del componente lo justificaba: «ambas secciones parten
 * vacías hasta contar con sus flujos institucionales de publicación». Esos flujos ya existen: hay
 * panel de Noticias, panel de Agenda y dos rutas públicas, `/publico/noticias` y `/publico/agenda`,
 * que el propio sitio consume en sus páginas. Así que el texto de espera no describía el estado del
 * sistema, solo el de este bloque. El criterio es este: «conecta con noticias y agenda,
 * esa es una previsualización de ambas cosas».
 *
 * <b>LA FORMA ES LA DE EL DISEÑO APROBADO DEL PORTAL</b> —la noticia destacada a lo ancho con su imagen a media caja,
 * dos secundarias debajo, y la agenda como una columna desplazable con el pie que lleva al
 * calendario—, porque es el diseño aprobado del sitio. Lo que NO se copia es su manera de
 * pedir los datos: allí eran dos peticiones anidadas a un `BackendDataService` heredado con
 * campos en inglés. Aquí se usan los servicios del proyecto y los adaptadores que ya traducen
 * `Noticia` y `EventoAgenda` a la forma que el diseño espera —los mismos que usan las páginas de
 * Noticias y de Agenda—, así que la portada y la sección completa no pueden discrepar.
 *
 * <b>SIN ROTACION AUTOMATICA.</b> el diseño aprobado del portal cambiaba el trío destacado cada treinta segundos con un
 * `setInterval`. Se deja fuera: mueve la página bajo el cursor de quien está leyendo, y no hay
 * forma de volver a la noticia que acaba de desaparecer.
 *
 * <b>REDISEÑO DE OCTUBRE DE 2026.</b> La portada baja la intensidad de la actualidad: una noticia
 * principal con imagen, dos secundarias y la agenda como lista de fechas, sin tarjetas pesadas.
 *
 * <b>H-3 (NOVIEMBRE DE 2026).</b> Con dos secundarias, Noticias quedaba ~180 px más corta que Próximamente y dejaba un
 * hueco a la izquierda. Ahora lleva la principal y CUATRO secundarias (`NOTICIAS_EN_INICIO`), las más recientes con el
 * orden de la lista pública; a 1280 px la diferencia con la agenda baja a ~36 px. Se compararon tres variantes
 * (más noticias, descripción de las dos actuales, tarjeta principal alta) y se eligió esta por equilibrio de alto,
 * jerarquía y legibilidad; las otras dos están en el comparador y en `docs/desarrollo/14-sistema-de-diseno.md`.
 */
import { NOTICIAS_EN_INICIO } from '../../../news/destacadas-de-noticias';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';

@Component({
  selector: 'app-noticias-agenda-preview',
  standalone: true,
  imports: [TextoWebPipe, 
    EsqueletoComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    LucideMapPin,
    RouterLink,
    EncabezadoDeSeccionComponent,
  ],
  templateUrl: './noticias-agenda-preview.component.html',
})
export class NoticiasAgendaPreviewComponent implements OnInit {
  private readonly textosWebDeNoticias = inject(TextosWebService);
  private readonly noticias = inject(NoticiasService);
  private readonly agenda = inject(AgendaService);

  readonly cargando = signal(true);
  readonly error = signal('');

  readonly destacadas = signal<NoticiaDeDiseno[]>([]);
  readonly eventos = signal<EventoDeDiseno[]>([]);

  /** Cuántos eventos de la agenda se muestran: los cinco más próximos (se piden seis y sobra uno). */
  readonly eventosVisibles = 5;

  readonly noticiaPrincipal = computed(() => this.destacadas()[0] ?? null);
  readonly noticiasSecundarias = computed(() => this.destacadas().slice(1, NOTICIAS_EN_INICIO));

  ngOnInit(): void {
    void this.cargar();
  }

  /**
   * Las dos listas se piden A LA VEZ y no una dentro de la otra.
   *
   * el diseño aprobado del portal encadenaba la agenda dentro del `next` de las noticias, así que la portada tardaba la
   * suma de las dos y un fallo en la primera dejaba la segunda sin pedir siquiera.
   */
  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');

    const [noticias, agenda] = await Promise.all([
      this.noticias.listarPublicas({ tamano: NOTICIAS_EN_INICIO, pagina: 1 }),
      this.agenda.listarPublicos({ cuando: 'proximos', tamano: 6, pagina: 1 }),
    ]);

    // `ResultadoNoticia`/`ResultadoAgenda` llevan `ok` y `data` opcional: se comprueban los dos
    // para que el compilador estreche el tipo y no quede un `data!` escondiendo un fallo real.
    if (!noticias.ok || !noticias.data || !agenda.ok || !agenda.data) {
      this.error.set(noticias.error || agenda.error || 'No fue posible cargar la portada informativa.');
      this.cargando.set(false);
      return;
    }

    this.destacadas.set(noticias.data.items.map(aNoticiaDeDiseno));
    this.eventos.set(agenda.data.items.map(aEventoDeDiseno));
    this.cargando.set(false);
  }

  /**
   * La imagen de una noticia en la portada y en la lista: la suya o, si no trae portada, la misma
   * foto de respaldo en las dos pantallas. Ver `imagenDeNoticia`.
   */
  imagenDe(noticia: NoticiaDeDiseno): string {
    return imagenDeNoticia(noticia, respaldosDeNoticias((clave) => this.textosWebDeNoticias.getWebImage(clave)));
  }
}
