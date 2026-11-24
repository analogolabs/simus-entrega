import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { LucideArrowLeft, LucideArrowRight, LucideMapPin } from '@lucide/angular';
import { AgendaService } from '../../../../core/services/agenda.service';
import { EventoDeDiseno, NoticiaDeDiseno, aEventoDeDiseno, aNoticiaDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import {
  CelebraLaMusicaService,
  EdicionDeCelebra,
  EdicionDeCelebraResumen,
} from '../../../../core/services/celebra-la-musica.service';
import { NoticiasService } from '../../../../core/services/noticias.service';
import { textoLegibleSobre } from '../../../../shared/utils/contraste-de-color';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { imagenDeNoticia, respaldosDeNoticias } from '../../../../shared/utils/imagen-de-noticia';
import { PestanasDeSeccionComponent } from '../../../../shared/components/ui/pestanas-de-seccion/pestanas-de-seccion.component';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import { EstadoDeListaComponent } from '../../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { CajaDeHerramientasCelebraComponent } from './caja-de-herramientas-celebra.component';
import { GaleriaCelebraComponent } from './galeria-celebra.component';

/** Cuántos eventos y noticias se muestran en el micrositio; el resto vive en la Agenda y en Noticias. */
const EVENTOS_VISIBLES = 8;
const NOTICIAS_VISIBLES = 6;

export interface Aliado { nombre: string; logoUrl: string | null; }

/** Minúsculas y sin tildes, para comparar nombres. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/**
 * Separa el texto de aliados («A, B y C» o «A, B y 15 organizaciones aliadas») en nombres y, si el final es un número
 * de organizaciones, en un complemento que no es un nombre («15 organizaciones aliadas»).
 */
export function nombresDeAliados(texto: string | null): { nombres: string[]; complemento: string } {
  if (!texto?.trim()) { return { nombres: [], complemento: '' }; }
  const partes = texto.split(',').map((p) => p.trim()).filter(Boolean);
  const ultima = partes.pop() ?? '';
  const corte = ultima.lastIndexOf(' y ');
  const finales = corte > 0 ? [ultima.slice(0, corte).trim(), ultima.slice(corte + 3).trim()] : [ultima];
  partes.push(...finales);
  const complemento = /^\d/.test(partes[partes.length - 1] ?? '') ? partes.pop()! : '';
  return { nombres: partes.filter(Boolean), complemento };
}

/**
 * EL MICROSITIO DE «CELEBRA LA MÚSICA», CON EDICIONES HISTÓRICAS (P-4, L7).
 *
 * <b>UNA EDICIÓN POR AÑO, CADA UNA CON SU ESTÉTICA.</b> Las ediciones publicadas se recorren desde el apartado «Todas las ediciones», cerca del final;
 * los colores, la portada, la presentación, las categorías, la caja de herramientas, las preguntas frecuentes y la
 * galería salen de la API (editables desde la consola), no del frontend.
 *
 * <b>LA PROGRAMACIÓN Y LAS NOTICIAS NO SON PROPIAS.</b> Son la agenda y las noticias generales del portal con el
 * filtro `proyecto=<código de la edición>` (el proyecto transversal de la edición). Aquí solo se muestran las más
 * recientes y se enlaza a las páginas completas, que son de una etapa posterior.
 */
@Component({
  selector: 'app-celebra-la-musica-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextoWebPipe, 
    RouterLink, LucideArrowLeft, LucideArrowRight, LucideMapPin,
    EsqueletoComponent, EstadoDeListaComponent, PestanasDeSeccionComponent, CajaDeHerramientasCelebraComponent, GaleriaCelebraComponent,
  ],
  templateUrl: './celebra-la-musica-page.component.html',
  styleUrl: './celebra-la-musica-page.component.css',
})
export class CelebraLaMusicaPageComponent {
  private readonly textosWebDeNoticias = inject(TextosWebService);
  private readonly servicio = inject(CelebraLaMusicaService);
  private readonly agenda = inject(AgendaService);
  private readonly noticias = inject(NoticiasService);

  /** El año de la dirección (`/:anio`); sin él se abre la edición vigente, o la más reciente. */
  private readonly ruta = inject(ActivatedRoute);
  /** `?vistaPrevia=1` lee por la consola (con sesión) y deja ver una edición en borrador antes de publicarla. */
  readonly vistaPrevia = toSignal(this.ruta.queryParamMap.pipe(map((p) => p.get('vistaPrevia') === '1')), { initialValue: this.ruta.snapshot.queryParamMap.get('vistaPrevia') === '1' });
  readonly anio = toSignal(this.ruta.paramMap.pipe(map((p) => p.get('anio') ?? undefined)), { initialValue: this.ruta.snapshot.paramMap.get('anio') ?? undefined });

  readonly cargandoEdiciones = signal(true);
  readonly errorEdiciones = signal('');
  readonly ediciones = signal<EdicionDeCelebraResumen[]>([]);

  readonly cargandoEdicion = signal(true);
  readonly errorEdicion = signal('');
  readonly edicion = signal<EdicionDeCelebra | null>(null);
  readonly noExiste = signal(false);

  readonly cargandoEventos = signal(true);
  readonly errorEventos = signal('');
  readonly eventos = signal<EventoDeDiseno[]>([]);
  readonly totalEventos = signal(0);

  readonly cargandoNoticias = signal(true);
  readonly errorNoticias = signal('');
  readonly noticiasDeLaEdicion = signal<NoticiaDeDiseno[]>([]);
  readonly totalNoticias = signal(0);

  /** Las secciones de la navegación interna; «Ediciones» solo existe si hay más de una edición publicada. */
  readonly seccionesDeNav = computed(() => [
    { id: 'celebracion', rotulo: 'La celebración' },
    { id: 'programacion', rotulo: 'Eventos destacados' },
    { id: 'caja-de-herramientas', rotulo: 'Caja de herramientas' },
    { id: 'preguntas-frecuentes', rotulo: 'Preguntas frecuentes' },
    { id: 'noticias', rotulo: 'Noticias' },
    { id: 'galeria', rotulo: 'Galería' },
    ...(this.ediciones().length > 1 ? [{ id: 'ediciones', rotulo: 'Ediciones' }] : []),
    { id: 'aliados', rotulo: 'Aliados' },
  ]);

  /** Los colores de la edición, como variables CSS locales (no tocan los tokens globales). */
  readonly estilo = computed(() => {
    const e = this.edicion();
    if (!e) { return ''; }
    return `--cl-principal:${e.colorPrincipal};--cl-secundario:${e.colorSecundario};--cl-sobre-principal:${textoLegibleSobre(e.colorPrincipal)};--cl-sobre-secundario:${textoLegibleSobre(e.colorSecundario)}`;
  });

  /** El color oscuro de la edición (secundario si lo es; si no, el principal): los logos de los aliados son blancos y necesitan fondo oscuro. */
  readonly fondoDeAliados = computed(() => {
    const e = this.edicion();
    if (!e) { return ''; }
    const blanco = textoLegibleSobre('#000000');
    return textoLegibleSobre(e.colorSecundario) === blanco ? e.colorSecundario : e.colorPrincipal;
  });

  readonly cifras = computed(() => {
    const e = this.edicion();
    if (!e) { return []; }
    return [
      { valor: e.actividades, rotulo: 'actividades', prefijo: 'Más de' },
      { valor: e.municipios, rotulo: 'municipios', prefijo: '' },
      { valor: e.departamentos, rotulo: 'departamentos', prefijo: '' },
      { valor: e.organizaciones, rotulo: 'organizaciones', prefijo: '' },
      { valor: e.musicos, rotulo: 'músicos', prefijo: 'Más de' },
    ].filter((c) => c.valor !== null && c.valor !== undefined) as { valor: number; rotulo: string; prefijo: string }[];
  });

  /** Los recursos con los que se ve el logo de un aliado: el grupo «Aliados» de la caja de la edición (Banco de archivos). */
  private static readonly GRUPOS_DE_ALIADOS = ['aliados', 'logos de aliados', 'logos de los aliados'];
  private static esGrupoDeAliados(grupo: string): boolean {
    return CelebraLaMusicaPageComponent.GRUPOS_DE_ALIADOS.includes(normalizar(grupo));
  }

  /** La caja de herramientas: todo lo que no es un logo de aliado. */
  readonly recursosDeCaja = computed(() =>
    (this.edicion()?.recursos ?? []).filter((r) => !CelebraLaMusicaPageComponent.esGrupoDeAliados(r.grupo)));

  /**
   * Los aliados de la edición: sus nombres salen del texto de la edición; el logo, del recurso del grupo «Aliados» con el
   * mismo nombre (archivo del Banco de archivos). Quien no tiene logo se muestra con su nombre en texto.
   */
  readonly aliados = computed<Aliado[]>(() => {
    const e = this.edicion();
    if (!e) { return []; }
    const logos = e.recursos.filter((r) => CelebraLaMusicaPageComponent.esGrupoDeAliados(r.grupo) && !!r.url);
    const lista: Aliado[] = nombresDeAliados(e.aliados).nombres.map((nombre) => {
      const logo = logos.find((l) => normalizar(l.titulo) === normalizar(nombre));
      return { nombre, logoUrl: logo?.url ?? null };
    });
    for (const l of logos) {
      if (!lista.some((a) => normalizar(a.nombre) === normalizar(l.titulo))) { lista.push({ nombre: l.titulo, logoUrl: l.url }); }
    }
    return lista;
  });
  readonly aliadosComplemento = computed(() => nombresDeAliados(this.edicion()?.aliados ?? null).complemento);

  readonly presentacionEnParrafos = computed(() =>
    (this.edicion()?.presentacion ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean));

  readonly fechas = computed(() => {
    const e = this.edicion();
    if (!e?.fechaInicio) { return ''; }
    const formato = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const ini = formato.format(new Date(e.fechaInicio + 'T00:00:00Z'));
    return e.fechaFin && e.fechaFin !== e.fechaInicio ? `Del ${ini} al ${formato.format(new Date(e.fechaFin + 'T00:00:00Z'))}` : ini;
  });

  constructor() {
    void this.cargarEdiciones();
    effect(() => {
      // Cada cambio de dirección carga su edición (también el primero, cuando ya llegó la lista).
      const pedida = this.anio();
      const lista = this.ediciones();
      if (this.cargandoEdiciones()) { return; }
      const destino = pedida
        ? lista.find((e) => String(e.anio) === pedida)
        : lista.find((e) => e.actual) ?? lista[0];
      if (!destino) {
        this.edicion.set(null);
        this.noExiste.set(!!pedida || lista.length === 0);
        this.cargandoEdicion.set(false);
        this.cargandoEventos.set(false);
        this.cargandoNoticias.set(false);
        return;
      }
      void this.cargarEdicion(destino);
    });
  }

  async cargarEdiciones(): Promise<void> {
    this.cargandoEdiciones.set(true);
    this.errorEdiciones.set('');
    const r = await this.servicio.ediciones(this.vistaPrevia());
    if (r.ok) { this.ediciones.set(r.data ?? []); } else { this.errorEdiciones.set(r.error ?? ''); }
    this.cargandoEdiciones.set(false);
  }

  async cargarEdicion(resumen: EdicionDeCelebraResumen): Promise<void> {
    this.noExiste.set(false);
    this.cargandoEdicion.set(true);
    this.errorEdicion.set('');
    const r = await this.servicio.edicion(resumen.anio, this.vistaPrevia());
    if (!r.ok) {
      this.errorEdicion.set(r.error ?? '');
      this.cargandoEdicion.set(false);
      return;
    }
    this.edicion.set(r.data ?? null);
    this.noExiste.set(!r.data);
    this.cargandoEdicion.set(false);
    if (r.data) { void Promise.all([this.cargarEventos(r.data.proyectoCodigo), this.cargarNoticias(r.data.proyectoCodigo)]); }
  }

  async cargarEventos(proyecto = this.edicion()?.proyectoCodigo ?? ''): Promise<void> {
    this.cargandoEventos.set(true);
    this.errorEventos.set('');
    const r = await this.agenda.listarPublicos({ proyecto, cuando: 'todos', tamano: 50, pagina: 1 });
    if (r.ok && r.data) {
      const ordenados = [...r.data.items].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
      this.eventos.set(ordenados.slice(0, EVENTOS_VISIBLES).map(aEventoDeDiseno));
      this.totalEventos.set(r.data.total);
    } else {
      this.errorEventos.set(r.error ?? 'No fue posible consultar la programación.');
    }
    this.cargandoEventos.set(false);
  }

  async cargarNoticias(proyecto = this.edicion()?.proyectoCodigo ?? ''): Promise<void> {
    this.cargandoNoticias.set(true);
    this.errorNoticias.set('');
    const r = await this.noticias.listarPublicas({ proyecto, tamano: NOTICIAS_VISIBLES, pagina: 1 });
    if (r.ok && r.data) {
      this.noticiasDeLaEdicion.set(r.data.items.map(aNoticiaDeDiseno));
      this.totalNoticias.set(r.data.total);
    } else {
      this.errorNoticias.set(r.error ?? 'No fue posible consultar las noticias.');
    }
    this.cargandoNoticias.set(false);
  }

  textoSobre(color: string): string {
    return textoLegibleSobre(color);
  }

  imagenDe(noticia: NoticiaDeDiseno): string {
    return imagenDeNoticia(noticia, respaldosDeNoticias((clave) => this.textosWebDeNoticias.getWebImage(clave)));
  }

  formatear(valor: number): string {
    return valor.toLocaleString('es-CO');
  }

}
