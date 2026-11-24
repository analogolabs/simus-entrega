import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { Noticia, NoticiasService } from '../../../../core/services/noticias.service';
import { thumbnailFor } from '../../../../shared/utils/media';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { imagenDeNoticia, respaldosDeNoticias } from '../../../../shared/utils/imagen-de-noticia';
import { FechaPipe } from '../../../../shared/utils/fecha.pipe';
import { RecursoNoEncontradoComponent } from '../../../../shared/components/ui/recurso-no-encontrado/recurso-no-encontrado.component';
import { EtiquetasDeContenidoComponent } from '../../../../shared/components/ui/etiquetas-de-contenido/etiquetas-de-contenido.component';
import { CompartirEnRedesComponent } from '../../../../shared/components/ui/compartir-en-redes/compartir-en-redes.component';
import { comoEtiquetas } from '../../../../shared/utils/etiquetas';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * Una noticia del portal, con el lector del diseño aprobado.
 *
 * <b>DE DONDE VIENE ESTE DISEÑO.</b> Del desarrollo el diseño aprobado del portal. Se conservan sus piezas: la barra
 * de progreso de lectura, la letra capitular, la línea de datos —categoría, fecha, minutos— y la
 * columna de noticias relacionadas.
 *
 * <b>LO QUE NO SE PORTO, Y ES DELIBERADO.</b> Aquel lector traía, para cuando no hubiera cuerpo,
 * cuatro párrafos y una cita escritos a mano sobre «vientos, cuerdas y percusiones». Es contenido
 * inventado que se enseñaría como si fuera del Ministerio. Aquí una noticia sin cuerpo enseña su
 * resumen y nada más.
 *
 * <b>EL CUERPO SE PINTA COMO TEXTO, NO COMO MARCADO.</b> El original lo inyectaba con
 * `bypassSecurityTrustHtml`; lo escribe una persona desde la consola, así que interpretarlo como
 * HTML convertiría ese campo en una vía para meter etiquetas en el portal.
 *
 * <b>SE BUSCA POR DIRECCION Y NO POR IDENTIFICADOR.</b> La dirección se calcula del título al
 * crear y no cambia, así que un enlace compartido sigue funcionando.
 */
@Component({
  selector: 'app-noticia-detalle-page',
  standalone: true,
  imports: [TextoWebPipe, FechaPipe, CommonModule, RouterLink, RecursoNoEncontradoComponent, EsqueletoComponent, EtiquetasDeContenidoComponent, CompartirEnRedesComponent],
  templateUrl: './noticia-detalle-page.component.html',
})
export class NoticiaDetallePageComponent {
  private readonly textosWebDeNoticias = inject(TextosWebService);
  private readonly api = inject(NoticiasService);
  // `ActivatedRoute` y no `input()` de ruta: la aplicación no declara `withComponentInputBinding`.
  private readonly ruta = inject(ActivatedRoute);
  private readonly titulo = inject(Title);

  readonly miniatura = thumbnailFor;

  /** La miniatura de una relacionada: la suya o la foto de respaldo que usan la portada y la lista. */
  miniaturaDe(noticia: Noticia): string {
    return noticia.imagenRuta
      ? this.miniatura(noticia.imagenRuta)
      : imagenDeNoticia({ id: noticia.id, slug: noticia.slug }, respaldosDeNoticias((clave) => this.textosWebDeNoticias.getWebImage(clave)));
  }

  readonly noticia = signal<Noticia | null>(null);
  readonly relacionadas = signal<Noticia[]>([]);
  readonly cargando = signal(true);
  readonly noEncontrada = signal(false);
  readonly progresoDeLectura = signal(0);
  /** Las etiquetas de la noticia (sus proyectos transversales): enlaces a las noticias con la misma etiqueta. */
  readonly etiquetas = computed(() => comoEtiquetas(this.noticia()?.proyectosTransversales));

  constructor() {
    // `paramMap` y no `snapshot`: navegar de una relacionada a otra reutiliza el componente.
    this.ruta.paramMap.subscribe(parametros => {
      void this.cargar(parametros.get('slug') ?? '');
    });
  }

  /**
   * Cuánto se ha leído.
   *
   * SE MIDE SOBRE EL DOCUMENTO ENTERO y no sobre el artículo: es lo que hace el diseño de
   * referencia y lo que coincide con la sensación de quien desplaza la página.
   */
  @HostListener('window:scroll')
  alDesplazar(): void {
    const alto = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    if (alto <= 0) { this.progresoDeLectura.set(0); return; }
    this.progresoDeLectura.set(Math.min(100, (window.scrollY / alto) * 100));
  }

  /** Cada navegación toma un número: una respuesta que llega tarde de la noticia anterior no pisa a la actual. */
  private solicitud = 0;

  /**
   * LISTA → FICHA SIN ESPERA (decisión 117). Si la noticia está en la copia de la lista que Noticias
   * guardó hace menos de un minuto —el mismo objeto, con su cuerpo—, se pinta de inmediato y la
   * petición a la API corre igual, en segundo plano, como REVALIDACIÓN: si la noticia cambió o se
   * retiró, la ficha se corrige o pasa a «no está publicada». Las relacionadas se piden EN PARALELO
   * y ya no retienen la ficha: antes la noticia esperaba dos peticiones en cascada.
   */
  private async cargar(slug: string): Promise<void> {
    const mia = ++this.solicitud;
    const vigente = () => mia === this.solicitud;
    const guardada = this.api.ultimaListaPublica;
    const previa = guardada && Date.now() - guardada.momento < 60_000
      ? guardada.items.find(n => n.slug === slug) : undefined;

    this.noEncontrada.set(false);
    this.progresoDeLectura.set(0);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });

    if (previa) {
      this.noticia.set(previa);
      this.titulo.setTitle(`${previa.titulo} · Noticias · SIMUS`);
      this.cargando.set(false);
      void this.cargarRelacionadas(previa);
    } else {
      this.cargando.set(true);
    }

    const resultado = await this.api.obtenerPublica(slug);
    if (!vigente()) return;

    if (resultado.ok && resultado.data) {
      const cambio = !previa || previa.version !== resultado.data.version || previa.fechaActualizacion !== resultado.data.fechaActualizacion;
      if (cambio) this.noticia.set(resultado.data);
      // La pestaña dice qué noticia es, no «Noticias · SIMUS».
      this.titulo.setTitle(`${resultado.data.titulo} · Noticias · SIMUS`);
      this.cargando.set(false);
      if (!previa) void this.cargarRelacionadas(resultado.data);
    } else {
      this.noticia.set(null);
      this.relacionadas.set([]);
      this.noEncontrada.set(true);
      this.cargando.set(false);
    }
  }

  /**
   * Otras noticias para seguir leyendo.
   *
   * SE PIDEN DE LA MISMA CATEGORIA cuando la hay, y las más recientes cuando no. Y la que se está
   * leyendo se excluye: ofrecerle a alguien el artículo que tiene abierto es el detalle que delata
   * que la columna no mira lo que hay en pantalla.
   */
  private async cargarRelacionadas(actual: Noticia): Promise<void> {
    const mia = this.solicitud;
    const deLaCategoria = await this.pedirOtras(actual, actual.categoria ?? undefined);

    // SI SU CATEGORIA NO DA PARA MAS, SE OFRECEN LAS RECIENTES. Una categoría con un solo
    // artículo dejaría la columna vacía justo en las noticias más específicas, que son las que
    // más ganas dan de seguir leyendo.
    const otras = deLaCategoria.length > 0 ? deLaCategoria : await this.pedirOtras(actual, undefined);

    if (mia === this.solicitud) this.relacionadas.set(otras);
  }

  private async pedirOtras(actual: Noticia, categoria: string | undefined): Promise<Noticia[]> {
    const resultado = await this.api.listarPublicas({ categoria, tamano: 5 });
    return (resultado.ok && resultado.data ? resultado.data.items : [])
      .filter(n => n.id !== actual.id)
      .slice(0, 4);
  }

  /**
   * El cuerpo partido en párrafos.
   *
   * Se parte por líneas en blanco y se pinta como texto. La letra capitular la pone el CSS sobre
   * el primer párrafo, no una marca en el contenido.
   */
  parrafos(cuerpo: string | null): string[] {
    return (cuerpo ?? '')
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  minutosDeLectura(noticia: Noticia): number {
    const palabras = `${noticia.resumen} ${noticia.cuerpo ?? ''}`.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(palabras / 200));
  }
}
