import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../../../core/services/navigation.service';
import { CatalogosDeRed, RedPublica, RedesService, etiquetaDeTipoDeNodo } from '../../../../core/services/redes.service';
import { DirectorioEcosistemaComponent, FiltroDeDirectorio, textosDeDirectorio } from '../../../../shared/components/ui/directorio-ecosistema/directorio-ecosistema.component';
import { DirectorioPublicoBase } from '../../../../shared/components/ui/directorio-ecosistema/directorio-publico-base';
import { DatoDeRegistro, RegistroDeDirectorioComponent } from '../../../../shared/components/ui/directorio-ecosistema/registro-de-directorio.component';
import { EnlaceDeRegistro, enlacesDeRegistro } from '../../../../shared/utils/enlaces-de-registro';
import { MetricaEcosistema } from '../../../../shared/components/ui/franja-metricas-ecosistema/franja-metricas-ecosistema.component';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';

/**
 * El directorio público de redes y documentación, en /ecosistema/redes.
 *
 * <b>ES EL DIRECTORIO ESTÁNDAR</b> (`app-directorio-ecosistema`), el mismo de Mercados y Festivales.
 * Aquí queda lo propio de las redes: filtrar por forma de acceso y por formato de documentación, y
 * cómo se dice cada una.
 *
 * <b>SOLO LO PUBLICADO LLEGA AQUÍ.</b> El servidor no entrega por esta ruta un borrador ni algo en
 * revisión. Los filtros salen de lo que hay: un departamento sin redes no se ofrece.
 */
@Component({
  selector: 'app-redes-publicas-page',
  standalone: true,
  imports: [DirectorioEcosistemaComponent, RegistroDeDirectorioComponent],
  template: `
    <app-directorio-ecosistema
      clave="redes"
      claveCms="dir_redes"
      titulo="Redes y documentación"
      encabezadoDeLista="Redes y centros de documentación publicados en el Ecosistema"
      subtitulo="Redes, archivos y centros de documentación musical: qué acervos tienen y cómo se consultan"
      etiquetaBusqueda="Buscar una red"
      placeholderBusqueda="Nombre, descripción o lugar"
      tituloFiltros="Filtros"
      etiquetaMapa="Ver redes en el mapa"
      ayuda="Los filtros muestran únicamente lo que tienen las redes publicadas."
      [filtros]="filtros()"
      [busqueda]="busqueda()"
      [ordenes]="ordenes"
      [orden]="orden()"
      [metricas]="metricas()"
      [vista]="vista()"
      [textos]="textos"
      [visibles]="visibles()"
      [total]="filtrados().length"
      [totalPublicados]="lista().length"
      [desde]="desdeMostrado()"
      [hasta]="hastaMostrado()"
      [pagina]="pagina()"
      [totalPaginas]="totalPaginas()"
      [porPagina]="porPagina()" [cantidades]="cantidadesPorPagina"
      [filtrosActivos]="filtrosActivos()"
      [hayFiltros]="hayFiltros()"
      [cargando]="cargando()"
      [error]="error()"
      (busquedaCambiada)="actualizarBusqueda($event)"
      (filtroCambiado)="cambiarFiltro($event)"
      (ordenCambiado)="actualizarOrden($event)"
      (vistaCambiada)="cambiarVista($event)"
      (paginaCambiada)="irAPagina($event)"
      (porPaginaCambiado)="cambiarPorPagina($event)"
      (filtrosLimpiados)="limpiarFiltros()"
      (mapaSolicitado)="abrirMapa()"
      (regresoSolicitado)="volver()">

      <ng-template #listado let-registro>
        @let red = $any(registro);
        <app-registro-de-directorio modo="listado" data-testid="tarjeta-de-red"
          [nombre]="red.nombre" [enlace]="['/ecosistema/redes', red.id]"
          [contexto]="tipoDeNodo(red)" [descripcion]="red.descripcion"
          [etiquetas]="formasDeAccesoDe(red)" [datos]="datosDe(red)"
          [enlaces]="enlacesDe(red)" [practicas]="red.practicasMusicales" [practicaActiva]="practica()" (practicaElegida)="alternarPractica($event)" />
      </ng-template>

      <ng-template #tarjeta let-registro>
        @let red = $any(registro);
        <app-registro-de-directorio modo="tarjeta" data-testid="tarjeta-de-red"
          [nombre]="red.nombre" [enlace]="['/ecosistema/redes', red.id]"
          [contexto]="tipoDeNodo(red)" [descripcion]="red.descripcion"
          [datos]="datosDe(red)"
          [enlaces]="enlacesDe(red)" [practicas]="red.practicasMusicales" [practicaActiva]="practica()" (practicaElegida)="alternarPractica($event)" />
      </ng-template>
    </app-directorio-ecosistema>
  `,
})
export class RedesPublicasPageComponent extends DirectorioPublicoBase<RedPublica> implements OnInit {
  private readonly redes = inject(RedesService);
  private readonly navegacion = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly catalogos = signal<CatalogosDeRed>({ formasDeAcceso: [], formatos: [], practicasMusicales: [] });
  readonly formaDeAcceso = signal('');
  readonly formato = signal('');

  readonly textos = textosDeDirectorio('red', 'redes', true);

  readonly formatosPrincipales = computed(() => this.catalogos().formatos.filter(f => f.padreId === null));

  protected textoDeBusqueda(r: RedPublica): string {
    return [r.nombre, r.descripcion, r.organizacionNombre, r.nombreMunicipio, r.nombreDepartamento].filter(Boolean).join(' ');
  }

  protected filtrosPropios(): FiltroDeDirectorio[] {
    return [
      {
        id: 'forma-de-acceso', etiqueta: 'Forma de acceso', textoTodos: 'Todas las formas de acceso', valor: this.formaDeAcceso(),
        opciones: this.catalogos().formasDeAcceso.map(f => ({ valor: f.nombre, etiqueta: f.nombre })),
      },
      {
        id: 'formato', etiqueta: 'Formato de documentación', textoTodos: 'Todos los formatos', valor: this.formato(),
        opciones: this.formatosPrincipales().map(f => ({ valor: f.nombre, etiqueta: f.nombre })),
      },
    ];
  }

  protected cumpleFiltrosPropios(r: RedPublica): boolean {
    const forma = this.formaDeAcceso();
    const formato = this.formato();
    return (!forma || r.formasDeAcceso.some(s => s.nombre === forma))
      // «Impreso» incluye a los de sus subniveles «Partituras» y «Libros y publicaciones periódicas».
      && (!formato || r.formatos.some(f => f.nombre === formato || this.catalogos().formatos.find(x => x.id === f.padreId)?.nombre === formato));
  }

  protected propiosActivos(): number {
    return [this.formaDeAcceso(), this.formato()].filter(Boolean).length;
  }

  protected limpiarPropios(): void {
    this.formaDeAcceso.set('');
    this.formato.set('');
  }

  protected fijarPropio(id: string, valor: string): boolean {
    if (id === 'forma-de-acceso') { this.formaDeAcceso.set(valor); return true; }
    if (id === 'formato') { this.formato.set(valor); return true; }
    return false;
  }

  protected metricaPropia(lista: readonly RedPublica[]): MetricaEcosistema {
    const formatos = new Set(lista.flatMap(r => r.formatos.map(f => f.nombre))).size;
    return { label: 'Formatos', value: formatos, detail: 'de documentación en esta consulta' };
  }

  ngOnInit(): void {
    // LOS FILTROS VIAJAN EN LA URL: un enlace desde una ficha o desde el mapa llega con el filtro puesto.
    const parametros = this.ruta.snapshot?.queryParamMap;
    this.departamento.set(parametros?.get('departamento') ?? '');
    this.municipio.set(parametros?.get('municipio') ?? '');
    this.formaDeAcceso.set(parametros?.get('formaDeAcceso') ?? '');
    this.formato.set(parametros?.get('formato') ?? '');

    this.redes.catalogosPublicos().subscribe({ next: c => this.catalogos.set(c), error: () => undefined });
    this.redes.consultarPublicos().subscribe({
      next: pagina => { this.lista.set(pagina?.items ?? []); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.error.set('No fue posible consultar las redes y documentación.'); },
    });
  }

  volver(): void {
    void this.router.navigateByUrl('/ecosistema');
  }

  /** El paso al mapa, con la capa de Redes activa. Es el mismo gesto que ofrecen Festivales y Mercados. */
  abrirMapa(): void {
    this.navegacion.navigateToMapLayer('Redes de Documentación', { targetView: 'map' });
  }

  tipoDeNodo(red: RedPublica): string {
    return etiquetaDeTipoDeNodo(red.tipoDeNodo);
  }

  formasDeAccesoDe(red: RedPublica): string[] {
    return red.formasDeAcceso.map(f => f.nombre);
  }

  /** Sitio web y redes, como iconos bajo la organización. */
  enlacesDe(red: RedPublica): EnlaceDeRegistro[] {
    return enlacesDeRegistro({ sitioWeb: red.sitioWebRed, instagram: red.instagramRed, facebook: red.facebookRed, otroEnlace: red.otroEnlaceRed });
  }

  datosDe(red: RedPublica): DatoDeRegistro[] {
    const territorio = new NombrePropioPipe().transform(this.donde(red));
    return [
      { etiqueta: 'Territorio', valor: territorio },
      { etiqueta: 'Consulta', valor: red.accesoAbierto ? 'Acceso abierto' : 'Acceso con condiciones' },
    ];
  }
}
