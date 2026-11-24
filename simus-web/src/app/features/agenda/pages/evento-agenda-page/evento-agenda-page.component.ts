import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { LucideCalendar, LucideClock, LucideExternalLink } from '@lucide/angular';
import { AgendaService, EventoAgenda, ETIQUETAS_MODALIDAD, ETIQUETAS_SITUACION } from '../../../../core/services/agenda.service';
import { EventoDeDiseno, aEventoDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { OrigenDelEventoComponent } from '../../../../shared/components/ui/origen-del-evento/origen-del-evento.component';
import { RecursoNoEncontradoComponent } from '../../../../shared/components/ui/recurso-no-encontrado/recurso-no-encontrado.component';
import { EtiquetasDeContenidoComponent } from '../../../../shared/components/ui/etiquetas-de-contenido/etiquetas-de-contenido.component';
import { comoEtiquetas } from '../../../../shared/utils/etiquetas';
import { formatearRango } from '../../../../shared/utils/formatos-de-fecha';
import { EnlaceDeRegresoComponent } from '../../../../shared/components/ui/enlace-de-regreso/enlace-de-regreso.component';
import { AnadirAlCalendarioComponent } from '../../components/anadir-al-calendario/anadir-al-calendario.component';
import { CLAVE_DE_FILTROS_RECORDADOS } from '../../domain/filtros-recordados';

/**
 * Un evento de la Agenda, en `/agenda/:slug`.
 *
 * <b>POR QUÉ ES UNA PÁGINA Y NO UN ACORDEÓN.</b> El evento es la unidad más compartible del portal
 * y el detalle vivía dentro de la lista, sin dirección: no se podía enviar, ni enlazar desde la
 * portada o el mapa, ni recargar sin perderlo. La dirección es el `slug` del servidor
 * (`/publico/agenda/{slug}`), que se calcula del título al crear y después no cambia.
 *
 * <b>UN EVENTO SIN PUBLICAR ES UN 404, NO UN «NO TIENES PERMISO»</b>: el servidor contesta igual
 * para el que no existe y para el que está en preparación, y aquí se dice con el mismo componente
 * que el resto del portal.
 *
 * <b>«MÁS INFORMACIÓN» SOLO SI HAY A DÓNDE IR.</b> El enlace externo es del evento y se enseña como
 * tal; sin él, el botón no existe en lugar de existir sin hacer nada.
 */
@Component({
  selector: 'app-evento-agenda-page',
  standalone: true,
  imports: [TextoWebPipe, RouterLink, RecursoNoEncontradoComponent, OrigenDelEventoComponent, EnlaceDeRegresoComponent, AnadirAlCalendarioComponent, LucideCalendar, LucideClock, LucideExternalLink, EtiquetasDeContenidoComponent],
  templateUrl: './evento-agenda-page.component.html',
})
export class EventoAgendaPageComponent {
  private readonly api = inject(AgendaService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly titulo = inject(Title);

  readonly evento = signal<EventoAgenda | null>(null);
  readonly diseno = signal<EventoDeDiseno | null>(null);
  /** Las etiquetas del evento (sus proyectos transversales): enlaces a la agenda filtrada. */
  readonly etiquetas = computed(() => comoEtiquetas(this.evento()?.proyectosTransversales));
  readonly cargando = signal(true);
  readonly noEncontrado = signal(false);
  readonly enlaceCopiado = signal(false);
  /** Los filtros con que estaba la lista cuando se abrió este evento (A-7), para volver a ella tal como se dejó. Vacío si se llegó por un enlace. */
  readonly filtrosDeLaLista = signal<Params | null>(null);

  readonly etiquetasDeSituacion = ETIQUETAS_SITUACION;
  readonly etiquetasDeModalidad = ETIQUETAS_MODALIDAD;

  constructor() {
    // `paramMap` y no `snapshot`: navegar de un evento a otro reutiliza el componente.
    this.filtrosDeLaLista.set(this.leerFiltrosRecordados());
    this.ruta.paramMap.subscribe(parametros => { void this.cargar(parametros.get('slug') ?? ''); });
  }

  private async cargar(slug: string): Promise<void> {
    this.cargando.set(true);
    this.noEncontrado.set(false);
    this.enlaceCopiado.set(false);

    const resultado = await this.api.obtenerPublico(slug);
    if (resultado.ok && resultado.data) {
      this.evento.set(resultado.data);
      this.diseno.set(aEventoDeDiseno(resultado.data));
      this.titulo.setTitle(`${resultado.data.titulo} · Agenda · SIMUS`);
    } else {
      this.evento.set(null);
      this.diseno.set(null);
      // El servidor contesta 404 igual para el que no existe y para el que no está publicado.
      this.noEncontrado.set(true);
    }
    this.cargando.set(false);
  }

  /** «5 nov 2026 al 7 nov 2026», o una sola fecha. */
  cuando(evento: EventoAgenda): string {
    return formatearRango(evento.fechaInicio, evento.fechaFin, 'fecha-larga');
  }

  /** Municipio y departamento, sin repetir el nombre cuando coinciden. */
  territorio(evento: EventoAgenda): string {
    return [...new Set([evento.nombreMunicipio, evento.nombreDepartamento].filter(Boolean))].join(', ');
  }

  /** De «?q=marimba&mes=11» a `{ q: 'marimba', mes: '11' }`; nulo si no hay nada guardado. */
  private leerFiltrosRecordados(): Params | null {
    try {
      const guardado = sessionStorage.getItem(CLAVE_DE_FILTROS_RECORDADOS);
      if (!guardado) { return null; }
      const parametros: Params = {};
      new URLSearchParams(guardado).forEach((valor, clave) => { parametros[clave] = valor; });
      return Object.keys(parametros).length > 0 ? parametros : null;
    } catch {
      return null;
    }
  }

  async copiarEnlace(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.enlaceCopiado.set(true);
    } catch {
      this.enlaceCopiado.set(false);
    }
  }
}
