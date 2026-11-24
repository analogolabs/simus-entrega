import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { CommonModule } from '@angular/common';
import { Component, Input, effect, inject, input, signal, untracked, computed } from '@angular/core';
import {
  ContenidoWebApiService,
  ResumenDeGrupoDelSitio,
  ResumenDeGestionDelSitio,
} from '../../../core/services/contenido-web-api.service';
import { AdminWebTextsPanelComponent } from '../admin-web-texts-panel/admin-web-texts-panel.component';
import { AdminRespaldosSitioComponent } from './admin-respaldos-sitio.component';

/** Las cuatro áreas del CMS. «pendientes» es «Cambios y respaldos»: el antiguo Resumen se retiró por redundante. */
export type VistaGestionSitio = 'textos' | 'imagenes' | 'equipo' | 'pendientes';

@Component({
  selector: 'app-admin-gestion-sitio-panel',
  standalone: true,
  imports: [BotonComponent, EstadoDeListaComponent, SelectorSegmentadoComponent,
    CommonModule,
    AdminWebTextsPanelComponent,
    AdminRespaldosSitioComponent,
  ],
  templateUrl: './admin-gestion-sitio-panel.component.html',
})
export class AdminGestionSitioPanelComponent {
  private readonly api = inject(ContenidoWebApiService);

  @Input() session: { fullName?: string } | null = null;
  readonly enabled = input(true);
  readonly puedePublicar = input(false);

  readonly vista = signal<VistaGestionSitio>('textos');
  readonly resumen = signal<ResumenDeGestionDelSitio | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly opciones: readonly { id: VistaGestionSitio; etiqueta: string; descripcion: string }[] = [
    { id: 'textos', etiqueta: 'Textos y páginas', descripcion: 'Edición con vista previa' },
    { id: 'imagenes', etiqueta: 'Imágenes del sitio', descripcion: 'Imágenes por página, con vista previa' },
    { id: 'equipo', etiqueta: 'Equipo', descripcion: 'Personas y datos públicos' },
    { id: 'pendientes', etiqueta: 'Cambios y respaldos', descripcion: 'Borradores sin publicar y copias del contenido' },
  ];


  /**
   * Las seis áreas como posiciones de un selector, con los cambios pendientes en la suya.
   *
   * ERAN SEIS TARJETAS con borde y sombra, y la elegida rellena de morado. La descripción de cada
   * una —«Edición con vista previa», «Archivos y recortes»— cabía en la tarjeta pero no en una
   * posición de selector, y tampoco hacía falta: el rótulo ya dice a dónde lleva, y lo que había
   * que saber de verdad —cuántos cambios esperan— no se veía en ninguna de las seis.
   */
  /**
   * Una sola frase de cobertura para «Cambios y respaldos»: cuánto contenido administra el CMS y cuánto de él
   * está publicado. Reemplaza a la franja de cuatro cifras del antiguo «Resumen», que repetía lo que cada área
   * ya dice y lo que «Cambios pendientes» cuenta aparte.
   */
  readonly coberturaDelSitio = computed(() => {
    const estado = this.resumen();
    if (!estado) { return ''; }
    return `El CMS administra ${estado.texts.total} textos (${estado.texts.published} publicados) y ${estado.images.total} imágenes (${estado.images.published} publicadas).`;
  });

  readonly areasDelSitio = computed<readonly OpcionSegmentada[]>(() => {
    const pendientes = this.resumen()?.pendingTotal ?? 0;
    return this.opciones.map(opcion => (
      opcion.id === 'pendientes' && pendientes > 0
        ? { id: opcion.id, etiqueta: opcion.etiqueta, conteo: pendientes }
        : { id: opcion.id, etiqueta: opcion.etiqueta }
    ));
  });

  constructor() {
    // `untracked` NO ES DECORATIVO AQUÍ, y esto costó un bucle infinito de peticiones.
    //
    // `cargarResumen()` empieza SÍNCRONAMENTE: antes de su primer `await` lee `cargando()`
    // —el cerrojo de reentrada— y lo escribe. Llamarla desde el cuerpo del efecto hacía que
    // el efecto se suscribiera a `cargando`, es decir, a una señal que él mismo cambia. El
    // resultado era un ciclo cerrado: el efecto pedía el resumen, `cargando` cambiaba, el
    // cambio volvía a disparar el efecto, y el panel se quedaba para siempre en «Cargando
    // el estado del sitio…» mientras golpeaba el API sin parar.
    //
    // Con `untracked` el efecto depende SOLO de `enabled()`, que es lo único a lo que debe
    // reaccionar: que el área se encienda.
    effect(() => {
      if (!this.enabled()) { return; }
      untracked(() => { void this.cargarResumen(); });
    });
  }

  /**
   * El grupo que se abrió desde «Cambios pendientes». Se pasa al editor para que «Abrir» lleve al
   * bloque que tiene el pendiente y no al primero de la sección. Cualquier otra forma de cambiar
   * de área lo limpia: volver a «Textos y páginas» por la pestaña no debe saltar a un grupo viejo.
   */
  readonly grupoAbierto = signal<string | null>(null);

  async seleccionar(vista: VistaGestionSitio, grupo: string | null = null): Promise<void> {
    this.grupoAbierto.set(grupo);
    this.vista.set(vista);
    if (vista === 'pendientes') {
      await this.cargarResumen();
    }
  }

  async cargarResumen(): Promise<void> {
    if (this.cargando()) { return; }
    this.cargando.set(true);
    this.error.set(null);
    const resultado = await this.api.getSiteManagementSummary();
    this.cargando.set(false);

    if (!resultado.ok || !resultado.data) {
      this.error.set(resultado.error ?? 'No fue posible leer el estado de Gestión del sitio.');
      return;
    }
    this.resumen.set(resultado.data);
  }

  gruposPendientes(grupos: readonly ResumenDeGrupoDelSitio[]): ResumenDeGrupoDelSitio[] {
    return grupos.filter(grupo => grupo.pending > 0);
  }
}
