import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../../../core/services/navigation.service';
import { CatalogosDeTaller, TallerPublico, TalleresService, etiquetaDeModalidad } from '../../../../core/services/talleres.service';
import { DirectorioEcosistemaComponent, FiltroDeDirectorio, textosDeDirectorio } from '../../../../shared/components/ui/directorio-ecosistema/directorio-ecosistema.component';
import { DirectorioPublicoBase } from '../../../../shared/components/ui/directorio-ecosistema/directorio-publico-base';
import { DatoDeRegistro, RegistroDeDirectorioComponent } from '../../../../shared/components/ui/directorio-ecosistema/registro-de-directorio.component';
import { EnlaceDeRegistro, enlacesDeRegistro } from '../../../../shared/utils/enlaces-de-registro';
import { MetricaEcosistema } from '../../../../shared/components/ui/franja-metricas-ecosistema/franja-metricas-ecosistema.component';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';

/**
 * El directorio público de talleres de lutería, en /ecosistema/luteria.
 *
 * <b>ES EL DIRECTORIO ESTÁNDAR</b> (`app-directorio-ecosistema`), el mismo de Mercados y Festivales:
 * columna de búsqueda y filtros, franja de cifras con conmutador de vista, listado o cuadrícula,
 * orden y paginación. Aquí queda lo propio de Lutería: filtrar por servicio y por familia de
 * instrumentos, y cómo se dice cada taller.
 *
 * <b>SOLO LO PUBLICADO LLEGA AQUÍ.</b> El servidor no entrega por esta ruta un borrador ni algo en
 * revisión, y por eso la pantalla no filtra por estado. Los filtros salen de lo que hay: un
 * departamento sin talleres no se ofrece, porque casi cada elección devolvería una lista vacía.
 */
@Component({
  selector: 'app-talleres-publicos-page',
  standalone: true,
  imports: [DirectorioEcosistemaComponent, RegistroDeDirectorioComponent],
  template: `
    <app-directorio-ecosistema
      clave="talleres"
      claveCms="dir_luteria"
      titulo="Lutería"
      encabezadoDeLista="Talleres de lutería publicados en el Ecosistema"
      subtitulo="Talleres donde se construyen, reparan y enseñan a hacer instrumentos"
      etiquetaBusqueda="Buscar un taller"
      placeholderBusqueda="Nombre, descripción o lugar"
      tituloFiltros="Filtros"
      etiquetaMapa="Ver talleres en el mapa"
      ayuda="Los filtros muestran únicamente lo que tienen los talleres publicados."
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
        @let taller = $any(registro);
        <app-registro-de-directorio modo="listado" data-testid="tarjeta-de-taller"
          [nombre]="taller.nombre" [enlace]="['/ecosistema/luteria', taller.id]"
          [contexto]="modalidad(taller)" [descripcion]="taller.descripcion"
          [etiquetas]="serviciosDe(taller)" [datos]="datosDe(taller)"
          [enlaces]="enlacesDe(taller)" [practicas]="taller.practicasMusicales" [practicaActiva]="practica()" (practicaElegida)="alternarPractica($event)" />
      </ng-template>

      <ng-template #tarjeta let-registro>
        @let taller = $any(registro);
        <app-registro-de-directorio modo="tarjeta" data-testid="tarjeta-de-taller"
          [nombre]="taller.nombre" [enlace]="['/ecosistema/luteria', taller.id]"
          [contexto]="modalidad(taller)" [descripcion]="taller.descripcion"
          [datos]="datosDe(taller)"
          [enlaces]="enlacesDe(taller)" [practicas]="taller.practicasMusicales" [practicaActiva]="practica()" (practicaElegida)="alternarPractica($event)" />
      </ng-template>
    </app-directorio-ecosistema>
  `,
})
export class TalleresPublicosPageComponent extends DirectorioPublicoBase<TallerPublico> implements OnInit {
  private readonly talleres = inject(TalleresService);
  private readonly navegacion = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly catalogos = signal<CatalogosDeTaller>({ servicios: [], familias: [], practicasMusicales: [] });
  readonly servicio = signal('');
  readonly familia = signal('');

  readonly textos = textosDeDirectorio('taller', 'talleres');

  readonly familiasPrincipales = computed(() => this.catalogos().familias.filter(f => f.padreId === null));

  protected textoDeBusqueda(t: TallerPublico): string {
    return [t.nombre, t.descripcion, t.organizacionNombre, t.nombreMunicipio, t.nombreDepartamento].filter(Boolean).join(' ');
  }

  protected filtrosPropios(): FiltroDeDirectorio[] {
    return [
      {
        id: 'servicio', etiqueta: 'Servicio', textoTodos: 'Todos los servicios', valor: this.servicio(),
        opciones: this.catalogos().servicios.map(s => ({ valor: s.nombre, etiqueta: s.nombre })),
      },
      {
        id: 'familia', etiqueta: 'Familia de instrumentos', textoTodos: 'Todas las familias', valor: this.familia(),
        opciones: this.familiasPrincipales().map(f => ({ valor: f.nombre, etiqueta: f.nombre })),
      },
    ];
  }

  protected cumpleFiltrosPropios(t: TallerPublico): boolean {
    const servicio = this.servicio();
    const familia = this.familia();
    return (!servicio || t.servicios.some(s => s.nombre === servicio))
      // «Cordófonos» incluye a los de su subnivel «Cordófonos frotados».
      && (!familia || t.familias.some(f => f.nombre === familia || this.catalogos().familias.find(x => x.id === f.padreId)?.nombre === familia));
  }

  protected propiosActivos(): number {
    return [this.servicio(), this.familia()].filter(Boolean).length;
  }

  protected limpiarPropios(): void {
    this.servicio.set('');
    this.familia.set('');
  }

  protected fijarPropio(id: string, valor: string): boolean {
    if (id === 'servicio') { this.servicio.set(valor); return true; }
    if (id === 'familia') { this.familia.set(valor); return true; }
    return false;
  }

  protected metricaPropia(lista: readonly TallerPublico[]): MetricaEcosistema {
    const servicios = new Set(lista.flatMap(t => t.servicios.map(s => s.nombre))).size;
    return { label: 'Servicios', value: servicios, detail: 'que ofrecen los talleres' };
  }

  ngOnInit(): void {
    // LOS FILTROS VIAJAN EN LA URL: un enlace desde una ficha o desde el mapa llega con el filtro puesto.
    const parametros = this.ruta.snapshot?.queryParamMap;
    this.departamento.set(parametros?.get('departamento') ?? '');
    this.municipio.set(parametros?.get('municipio') ?? '');
    this.servicio.set(parametros?.get('servicio') ?? '');
    this.familia.set(parametros?.get('familia') ?? '');

    this.talleres.catalogosPublicos().subscribe({ next: c => this.catalogos.set(c), error: () => undefined });
    this.talleres.consultarPublicos().subscribe({
      next: pagina => { this.lista.set(pagina?.items ?? []); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.error.set('No fue posible consultar los talleres de lutería.'); },
    });
  }

  volver(): void {
    void this.router.navigateByUrl('/ecosistema');
  }

  /** El paso al mapa, con la capa de Lutería activa. Es el mismo gesto que ofrecen Festivales y Mercados. */
  abrirMapa(): void {
    this.navegacion.navigateToMapLayer('Lutieres', { targetView: 'map' });
  }

  modalidad(taller: TallerPublico): string {
    return etiquetaDeModalidad(taller.modalidad);
  }

  serviciosDe(taller: TallerPublico): string[] {
    return taller.servicios.map(s => s.nombre);
  }

  /** Sitio web y redes, como iconos bajo la organización. */
  enlacesDe(taller: TallerPublico): EnlaceDeRegistro[] {
    return enlacesDeRegistro({ sitioWeb: taller.sitioWebTaller, instagram: taller.instagramTaller, facebook: taller.facebookTaller, otroEnlace: taller.otroEnlaceTaller });
  }

  datosDe(taller: TallerPublico): DatoDeRegistro[] {
    const territorio = new NombrePropioPipe().transform(this.donde(taller));
    return [
      { etiqueta: 'Territorio', valor: territorio },
      { etiqueta: 'Aprendices', valor: taller.recibeAprendices ? 'Recibe aprendices' : 'No recibe aprendices' },
    ];
  }
}
