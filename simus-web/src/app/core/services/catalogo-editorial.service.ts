import { motivoDeLaAccion } from '../formularios/traductor-de-errores';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { RecursoEditorialDeDiseno, aRecursoEditorialDeDiseno } from './adaptadores-del-diseno';
import { PrevisualizacionEnListadoService } from './previsualizacion-en-listado.service';
import { ApiClientService } from '../http/api-client.service';
import {
  TipoDeAgenteEditorial,
  VocabulariosEditoriales,
  DerechosEditoriales,
  FuenteEditorial,
  CreditoEditorial,
  IdentificadorEditorial,
  AccesoEditorial,
  TipologiaEditorial,
  PublicacionEditorial,
  CreditoPublico,
  IdentificadorPublico,
  AccesoPublico,
  PublicacionEditorialPublica,
  PaginaPublicacionesPublicas,
  AnotacionEditorial,
  PaginaPublicaciones,
  ResultadoEditorial,
  GuardarDerechosEditoriales,
  GuardarFuenteEditorial,
  DerechosEditorialesSolicitud,
  ConsultaDelCatalogoPublico,
  FacetasDelCatalogoEditorial,
} from '../contratos/catalogo-editorial';

// Los contratos viven en `core/contratos/catalogo-editorial`. Se reexportan para que quien ya
// importaba de aquí siga funcionando mientras dure la convergencia.
export { ETIQUETAS_CATALOGACION, ETIQUETAS_PUBLICACION, ETIQUETAS_DERECHOS, ACCIONES_DEL_HILO_EDITORIAL } from '../contratos/catalogo-editorial';
export type {
  TipoDeAgenteEditorial,
  VocabulariosEditoriales,
  DerechosEditoriales,
  FuenteEditorial,
  CreditoEditorial,
  IdentificadorEditorial,
  AccesoEditorial,
  TipologiaEditorial,
  PublicacionEditorial,
  CreditoPublico,
  IdentificadorPublico,
  AccesoPublico,
  PublicacionEditorialPublica,
  PaginaPublicacionesPublicas,
  AnotacionEditorial,
  PaginaPublicaciones,
  ResultadoEditorial,
  GuardarDerechosEditoriales,
  GuardarFuenteEditorial,
  DerechosEditorialesSolicitud,
};

/**
 * El Catálogo Editorial contra el API.
 *
 * <b>Dos superficies, dos rutas.</b> La consola lee `/institucional/catalogo-editorial` y ve
 * todo; el portal lee `/publico/catalogo-editorial` y solo ve lo que el servidor considera
 * publicable. El filtro NO está aquí: está en el servidor, en un único sitio, porque una
 * condición de visibilidad que viva en el navegador la salta cualquiera con la consola abierta.
 */

@Injectable({ providedIn: 'root' })
export class CatalogoEditorialService {
  private readonly api = inject(ApiClientService);
  private readonly previsualizacion = inject(PrevisualizacionEnListadoService);

  private async envolver<T>(operacion: () => Promise<T>, respaldo: string): Promise<ResultadoEditorial<T>> {
    try {
      return { ok: true, data: await operacion() };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, respaldo) };
    }
  }

  private static readonly CONSOLA = '/api/v1/institucional/catalogo-editorial';
  private static readonly PUBLICO = '/api/v1/publico/catalogo-editorial';

  /**
   * El catálogo editorial, en la forma que consume el diseño aprobado.
   *
   * <b>VIVE AQUI Y NO EN `CatalogService`, QUE ES DONDE ESTABA.</b> Ese servicio se llama `catalog`
   * —en inglés— y es un cajón de sastre heredado del desarrollo de referencia: junta el catálogo
   * editorial con la agenda, el GeoJSON de Colombia, DIVIPOLA y los puntos municipales. Con eso, el
   * portal del Catálogo Editorial leía por un servicio de mapas mientras la consola leía por
   * `CatalogoEditorialService`: dos puertas al mismo módulo, y la de delante en otro idioma. Ahora
   * el módulo entra y sale por un solo sitio.
   *
   * <b>ESTA RUTA CAMBIO Y CONVIENE QUE QUEDE ESCRITO.</b> Apuntaba a
   * <code>/api/v1/editorial/resources</code>, que era el endpoint heredado sobre una tabla plana y
   * que <b>ya no existe</b>: Una revisión anterior lo retiró con ella. La pantalla llevaba desde entonces
   * pidiendo una dirección muerta. Ahora lee el catálogo real y lo traduce en
   * <code>adaptadores-del-diseno</code>, que es donde vive la correspondencia entre nuestro modelo
   * y los nombres que usa la plantilla aprobada.
   *
   * <b>SE PIDE EL ACERVO ENTERO, PAGINA A PAGINA</b>, porque la pantalla filtra, ordena y pagina en
   * el navegador, que es como está aprobada: sus facetas —secciones, años, palabras clave— se
   * calculan sobre todo el acervo y no sobre una página.
   *
   * <b>ANTES PEDIA «UNA SOLA PAGINA GRANDE» DE 200 Y SE PERDIA 71 OBRAS.</b> El servidor acota
   * `tamano` a 100 —`Math.Clamp(tamano ?? 20, 1, 100)`— y no protesta: devuelve cien y sigue. Con
   * las dos fichas de verificación que hubo hasta nadie lo notó; el día
   * que entró el acervo real, el portal anunciaba «100 resultados» sobre 171 publicadas, y sus
   * filtros de sección y palabra clave se calculaban sobre esas cien. Pedir 300 en vez de 200 solo
   * mueve el punto en el que vuelve a romperse: lo que hace falta es leer hasta el final.
   */
  listarParaElPortal(): Observable<{ items: RecursoEditorialDeDiseno[] }> {
    const porPagina = 100;
    const pagina = (numero: number) => this.api.get<{ items?: PublicacionEditorialPublica[]; totalPaginas?: number }>(
      CatalogoEditorialService.PUBLICO,
      { params: { tamano: porPagina, pagina: numero }, errorFallback: 'No fue posible cargar el catálogo editorial' });

    return pagina(1).pipe(
      switchMap(primera => {
        const total = primera?.totalPaginas ?? 1;
        if (total <= 1) { return of([primera]); }
        // LAS QUE FALTAN, EN PARALELO: son pocas y la pantalla no puede dibujar hasta tenerlas todas.
        const resto = Array.from({ length: total - 1 }, (_, i) => pagina(i + 2));
        return forkJoin(resto).pipe(map(paginas => [primera, ...paginas]));
      }),
      map(paginas => ({ items: paginas.flatMap(p => (Array.isArray(p?.items) ? p.items : [])) })),
    ).pipe(
      map((payload) => (Array.isArray(payload?.items) ? payload.items : []).map(aRecursoEditorialDeDiseno)),
      // LA PREVISUALIZACION ENTRA POR DONDE ENTRAN LOS DATOS, no tocando la pantalla: su diseño está
      // aprobado tal cual, y la tarjeta que se ve tiene que ser la de verdad. Ver
      // `PrevisualizacionEnListadoService`.
      switchMap(items => this.previsualizacion.conListado<PublicacionEditorialPublica, RecursoEditorialDeDiseno>(
        'catalogo-editorial', items, aRecursoEditorialDeDiseno, (a, b) => a.id === b.id)),
      map(items => ({ items })),
    );
  }

  /**
   * Una página del catálogo, explorada EN EL SERVIDOR: búsqueda, filtros, orden y facetas.
   *
   * <b>EL NAVEGADOR YA NO ORDENA NI FILTRA.</b> `listarParaElPortal` bajaba el acervo entero y lo
   * trabajaba en memoria; esta pide solo la página que se ve, con sus filtros y su orden, y trae las
   * facetas (cuántas fichas deja cada opción, los temas agrupados) ya contadas. Los parámetros vacíos
   * no se envían. La previsualización de borradores se mezcla con la página como siempre.
   */
  explorarParaElPortal(consulta: ConsultaDelCatalogoPublico): Observable<{
    items: RecursoEditorialDeDiseno[]; total: number; totalPaginas: number; pagina: number; tamano: number;
    facetas: FacetasDelCatalogoEditorial | null;
  }> {
    const params: Record<string, string | number> = {};
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null && valor !== '') { params[clave] = valor as string | number; }
    }
    return this.api.get<PaginaPublicacionesPublicas>(CatalogoEditorialService.PUBLICO,
      { params, errorFallback: 'No fue posible cargar el catálogo editorial' }).pipe(
      switchMap(pagina => this.previsualizacion.conListado<PublicacionEditorialPublica, RecursoEditorialDeDiseno>(
        'catalogo-editorial', (pagina?.items ?? []).map(aRecursoEditorialDeDiseno), aRecursoEditorialDeDiseno, (a, b) => a.id === b.id).pipe(
        map(items => ({
          items,
          total: pagina?.total ?? items.length,
          totalPaginas: pagina?.totalPaginas ?? 1,
          pagina: pagina?.pagina ?? 1,
          tamano: pagina?.tamano ?? items.length,
          facetas: pagina?.facetas ?? null,
        })))),
    );
  }

  /**
   * Las listas con las que se rellena el formulario.
   *
   * SE PIDEN UNA VEZ Y SE GUARDAN: son el mismo conjunto para toda la sesión de catalogación, y
   * volver a pedirlas en cada paso del formulario haría parpadear los desplegables.
   */
  private vocabulariosEnCache: VocabulariosEditoriales | null = null;

  async vocabularios(): Promise<VocabulariosEditoriales> {
    if (this.vocabulariosEnCache) { return this.vocabulariosEnCache; }
    const listas = await firstValueFrom(this.api.get<VocabulariosEditoriales>(
      `${CatalogoEditorialService.CONSOLA}/vocabularios`,
      { errorFallback: 'No fue posible cargar las listas del formulario' }));
    this.vocabulariosEnCache = listas;
    return listas;
  }

  /**
   * El acervo entero para la consola, página a página.
   *
   * <b>POR QUE ENTERO Y NO PAGINADO.</b> La gestión de este catálogo no es una bandeja de trabajo:
   * son 171 publicaciones independientes que hay que poder recorrer por autoría, por ubicación, por
   * práctica musical o por año, y contar cuántas hay en cada sitio. Un listado paginado de veinte
   * en veinte no puede decir «Banda: 56» sin preguntarle al servidor por cada faceta. Con el acervo
   * en memoria, cada recuento es una línea y cada filtro es instantáneo.
   *
   * <b>Y CABE DE SOBRA.</b> Medido en el portal, que hace lo mismo: las 171 fichas completas pesan
   * 230 KB por el cable en dos peticiones paralelas. El coste de traerlas una vez es menor que el de
   * ir y volver por cada faceta que alguien pulse.
   *
   * SE PIDE HASTA EL FINAL, no «una página grande»: el servidor acota `tamano` a 100 y no protesta.
   * Pedir 200 devuelve cien y se pierden setenta y una sin que nada avise; ya pasó en el portal.
   */
  async listarTodasInternas(): Promise<ResultadoEditorial<PublicacionEditorial[]>> {
    return this.envolver(async () => {
      const porPagina = 100;
      const pedir = (numero: number) => firstValueFrom(this.api.get<PaginaPublicaciones>(
        CatalogoEditorialService.CONSOLA,
        { params: { tamano: porPagina, pagina: numero } }));

      const primera = await pedir(1);
      const paginas = [primera];
      for (let n = 2; n <= (primera.totalPaginas ?? 1); n++) {
        paginas.push(await pedir(n));
      }
      return paginas.flatMap(p => p.items ?? []);
    }, 'No fue posible cargar el Catálogo Editorial');
  }

  listarInternas(filtros: { q?: string; estadoPublicacion?: string; pagina?: number } = {}) {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.estadoPublicacion) params.set('estadoPublicacion', filtros.estadoPublicacion);
    params.set('pagina', String(filtros.pagina ?? 1));
    return this.envolver(
      () => firstValueFrom(this.api.get<PaginaPublicaciones>(`${CatalogoEditorialService.CONSOLA}?${params.toString()}`, {})),
      'No fue posible consultar el Catálogo Editorial.');
  }

  listarPublicas(filtros: { q?: string; palabraClave?: string; categoria?: string; pagina?: number; tamano?: number } = {}) {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.palabraClave) params.set('palabraClave', filtros.palabraClave);
    if (filtros.categoria) params.set('categoria', filtros.categoria);
    if (filtros.tamano) params.set('tamano', String(filtros.tamano));
    params.set('pagina', String(filtros.pagina ?? 1));
    return this.envolver(
      () => firstValueFrom(this.api.get<PaginaPublicacionesPublicas>(`${CatalogoEditorialService.PUBLICO}?${params.toString()}`, {})),
      'No fue posible consultar el catálogo.');
  }

  /** El hilo de trabajo de una ficha: sus decisiones y sus anotaciones. Solo consola. */
  historial(id: number) {
    return this.envolver(
      () => firstValueFrom(this.api.get<AnotacionEditorial[]>(`${CatalogoEditorialService.CONSOLA}/${id}/historial`, {})),
      'No fue posible consultar el historial de la ficha.');
  }

  /** Deja una anotación sobre la ficha, sin mover ningún estado. */
  anotar(id: number, comentario: string) {
    return this.envolver(
      () => firstValueFrom(this.api.post<void>(`${CatalogoEditorialService.CONSOLA}/${id}/anotaciones`, { comentario }, {})),
      'No fue posible guardar la anotación.');
  }

  obtenerPublica(codigo: string) {
    return this.envolver(
      () => firstValueFrom(this.api.get<PublicacionEditorialPublica>(`${CatalogoEditorialService.PUBLICO}/${encodeURIComponent(codigo)}`, {})),
      'No fue posible abrir la publicación.');
  }

  /** Los campos que la consola edita. Los relacionales —créditos, accesos— van aparte. */
  crear(ficha: Partial<PublicacionEditorial> & { palabrasClave?: string[] }) {
    return this.envolver(
      () => firstValueFrom(this.api.post<PublicacionEditorial>(CatalogoEditorialService.CONSOLA, ficha, {})),
      'No fue posible crear la publicación.');
  }

  guardar(id: number, ficha: Partial<PublicacionEditorial> & { palabrasClave?: string[]; version: number; esErrata?: boolean }) {
    return this.envolver(
      () => firstValueFrom(this.api.put<PublicacionEditorial>(`${CatalogoEditorialService.CONSOLA}/${id}`, ficha, {})),
      'No fue posible guardar la publicación.');
  }

  /** Observar exige motivo; validar no. El motivo queda en el historial. */
  cambiarCatalogacion(id: number, estado: string, motivo?: string) {
    return this.envolver(
      () => firstValueFrom(this.api.post<PublicacionEditorial>(`${CatalogoEditorialService.CONSOLA}/${id}/catalogacion`, { estado, motivo: motivo ?? null }, {})),
      'No fue posible cambiar el estado de catalogación.');
  }

  /** Retirar exige motivo; publicar no. El motivo queda en el historial. */
  cambiarPublicacion(id: number, estado: string, motivo?: string) {
    return this.envolver(
      () => firstValueFrom(this.api.post<PublicacionEditorial>(`${CatalogoEditorialService.CONSOLA}/${id}/publicacion`, { estado, motivo: motivo ?? null }, {})),
      'No fue posible cambiar el estado de publicación.');
  }

  /**
   * Registra los derechos de la ficha y de sus accesos.
   *
   * <b>CON TESTIGO.</b> Autorizar la publicación cambia lo que el portal puede enseñar, así que la
   * petición tiene que demostrar que sale de la consola y no de otra pestaña con la sesión abierta.
   */
  /**
   * Registra una fuente nueva y la cita en la ficha. Sin fuente una ficha creada en la
   * consola no podía publicarse nunca. Con testigo, como los derechos.
   */
  registrarFuente(id: number, solicitud: GuardarFuenteEditorial) {
    return this.envolver(
      () => firstValueFrom(this.api.get<{ requestToken: string }>(`${CatalogoEditorialService.CONSOLA}/csrf`, {}).pipe(
        switchMap(testigo => this.api.post<PublicacionEditorial>(`${CatalogoEditorialService.CONSOLA}/${id}/fuentes`, solicitud, {
          headers: { 'X-CSRF-TOKEN': testigo.requestToken },
        })),
      )),
      'No fue posible registrar la fuente.');
  }

  /** Corrige una fuente que la ficha ya cita; queda en el historial de la ficha. */
  corregirFuente(id: number, fuenteId: number, solicitud: GuardarFuenteEditorial) {
    return this.envolver(
      () => firstValueFrom(this.api.get<{ requestToken: string }>(`${CatalogoEditorialService.CONSOLA}/csrf`, {}).pipe(
        switchMap(testigo => this.api.put<PublicacionEditorial>(`${CatalogoEditorialService.CONSOLA}/${id}/fuentes/${fuenteId}`, solicitud, {
          headers: { 'X-CSRF-TOKEN': testigo.requestToken },
        })),
      )),
      'No fue posible corregir la fuente.');
  }

  guardarDerechos(id: number, solicitud: GuardarDerechosEditoriales) {
    return this.envolver(
      () => firstValueFrom(this.api.get<{ requestToken: string }>(`${CatalogoEditorialService.CONSOLA}/csrf`, {}).pipe(
        switchMap(testigo => this.api.put<PublicacionEditorial>(`${CatalogoEditorialService.CONSOLA}/${id}/derechos`, solicitud, {
          headers: { 'X-CSRF-TOKEN': testigo.requestToken },
        })),
      )),
      'No fue posible guardar los derechos.');
  }
}
