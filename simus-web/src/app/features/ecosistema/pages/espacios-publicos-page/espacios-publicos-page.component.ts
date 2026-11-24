import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { CatalogosDeEspacio, EspacioPublico, EspaciosService, etiquetaDeAmbiente } from '../../../../core/services/espacios.service';
import { NavigationService } from '../../../../core/services/navigation.service';
import { DirectorioEcosistemaComponent, FiltroDeDirectorio, textosDeDirectorio } from '../../../../shared/components/ui/directorio-ecosistema/directorio-ecosistema.component';
import { DirectorioPublicoBase } from '../../../../shared/components/ui/directorio-ecosistema/directorio-publico-base';
import { DatoDeRegistro, RegistroDeDirectorioComponent } from '../../../../shared/components/ui/directorio-ecosistema/registro-de-directorio.component';
import { EnlaceDeRegistro, enlacesDeRegistro } from '../../../../shared/utils/enlaces-de-registro';
import { MetricaEcosistema } from '../../../../shared/components/ui/franja-metricas-ecosistema/franja-metricas-ecosistema.component';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';

/**
 * El directorio público de espacios para música en vivo, en /ecosistema/espacios.
 *
 * <b>ES EL DIRECTORIO ESTÁNDAR</b> (`app-directorio-ecosistema`), el mismo de Mercados y Festivales.
 * Aquí queda lo propio de los espacios: filtrar por tipo de espacio, equipamiento y accesibilidad, y
 * cómo se dice cada uno.
 *
 * <b>SOLO LO PUBLICADO LLEGA AQUÍ.</b> El servidor no entrega por esta ruta un borrador ni algo en
 * revisión. Los filtros salen de lo que hay: un departamento sin espacios no se ofrece.
 */
@Component({
  selector: 'app-espacios-publicos-page',
  standalone: true,
  imports: [DirectorioEcosistemaComponent, RegistroDeDirectorioComponent],
  template: `
    <app-directorio-ecosistema
      clave="espacios"
      claveCms="dir_espacios"
      titulo="Espacios para música en vivo"
      encabezadoDeLista="Espacios para música en vivo publicados en el Ecosistema"
      subtitulo="Salas, teatros, bares, casas de cultura y escenarios donde la música suena en vivo"
      etiquetaBusqueda="Buscar un espacio"
      placeholderBusqueda="Nombre, descripción o lugar"
      tituloFiltros="Filtros"
      etiquetaMapa="Ver espacios en el mapa"
      ayuda="Los filtros muestran únicamente lo que tienen los espacios publicados."
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
        @let espacio = $any(registro);
        <app-registro-de-directorio modo="listado" data-testid="tarjeta-de-espacio"
          [nombre]="espacio.nombre" [enlace]="['/ecosistema/espacios', espacio.id]"
          [contexto]="ambiente(espacio)" [descripcion]="espacio.descripcion"
          [etiquetas]="equipamientoDe(espacio)" [datos]="datosDe(espacio)"
          [enlaces]="enlacesDe(espacio)" [practicas]="espacio.practicasMusicales" [practicaActiva]="practica()" (practicaElegida)="alternarPractica($event)" />
      </ng-template>

      <ng-template #tarjeta let-registro>
        @let espacio = $any(registro);
        <app-registro-de-directorio modo="tarjeta" data-testid="tarjeta-de-espacio"
          [nombre]="espacio.nombre" [enlace]="['/ecosistema/espacios', espacio.id]"
          [contexto]="ambiente(espacio)" [descripcion]="espacio.descripcion"
          [datos]="datosDe(espacio)"
          [enlaces]="enlacesDe(espacio)" [practicas]="espacio.practicasMusicales" [practicaActiva]="practica()" (practicaElegida)="alternarPractica($event)" />
      </ng-template>
    </app-directorio-ecosistema>
  `,
})
export class EspaciosPublicosPageComponent extends DirectorioPublicoBase<EspacioPublico> implements OnInit {
  private readonly espacios = inject(EspaciosService);
  private readonly navegacion = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly catalogos = signal<CatalogosDeEspacio>({ equipamiento: [], tipos: [], practicasMusicales: [] });
  readonly tipo = signal('');
  readonly equipamiento = signal('');
  /** `si` o `no`; vacío no filtra. Un espacio sin dato de accesibilidad no entra en ninguno de los dos. */
  readonly accesibilidad = signal('');

  readonly textos = textosDeDirectorio('espacio', 'espacios');

  protected textoDeBusqueda(e: EspacioPublico): string {
    return [e.nombre, e.descripcion, e.organizacionNombre, e.nombreMunicipio, e.nombreDepartamento].filter(Boolean).join(' ');
  }

  protected filtrosPropios(): FiltroDeDirectorio[] {
    return [
      {
        id: 'tipo', etiqueta: 'Tipo de espacio', textoTodos: 'Todos los tipos', valor: this.tipo(),
        opciones: this.catalogos().tipos.map(t => ({ valor: t.nombre, etiqueta: t.nombre })),
      },
      {
        id: 'equipamiento', etiqueta: 'Equipamiento', textoTodos: 'Todo el equipamiento', valor: this.equipamiento(),
        opciones: this.catalogos().equipamiento.map(e => ({ valor: e.nombre, etiqueta: e.nombre })),
      },
      {
        id: 'accesibilidad', etiqueta: 'Accesibilidad', textoTodos: 'Con o sin accesibilidad', valor: this.accesibilidad(),
        opciones: [{ valor: 'si', etiqueta: 'Accesible' }, { valor: 'no', etiqueta: 'No accesible' }],
      },
    ];
  }

  protected cumpleFiltrosPropios(e: EspacioPublico): boolean {
    const accesibilidad = this.accesibilidad();
    return (!this.tipo() || e.tipos.some(t => t.nombre === this.tipo()))
      && (!this.equipamiento() || e.equipamiento.some(q => q.nombre === this.equipamiento()))
      && (!accesibilidad || (accesibilidad === 'si' ? e.esAccesible === true : e.esAccesible === false));
  }

  protected propiosActivos(): number {
    return [this.tipo(), this.equipamiento(), this.accesibilidad()].filter(Boolean).length;
  }

  protected limpiarPropios(): void {
    this.tipo.set('');
    this.equipamiento.set('');
    this.accesibilidad.set('');
  }

  protected fijarPropio(id: string, valor: string): boolean {
    if (id === 'tipo') { this.tipo.set(valor); return true; }
    if (id === 'equipamiento') { this.equipamiento.set(valor); return true; }
    if (id === 'accesibilidad') { this.accesibilidad.set(valor); return true; }
    return false;
  }

  protected metricaPropia(lista: readonly EspacioPublico[]): MetricaEcosistema {
    const tipos = new Set(lista.flatMap(e => e.tipos.map(t => t.nombre))).size;
    return { label: 'Tipos de espacio', value: tipos, detail: 'en esta consulta' };
  }

  ngOnInit(): void {
    // LOS FILTROS VIAJAN EN LA URL: un enlace desde una ficha o desde el mapa llega con el filtro puesto.
    const parametros = this.ruta.snapshot?.queryParamMap;
    this.departamento.set(parametros?.get('departamento') ?? '');
    this.municipio.set(parametros?.get('municipio') ?? '');
    this.tipo.set(parametros?.get('tipo') ?? '');
    this.equipamiento.set(parametros?.get('equipamiento') ?? '');

    this.espacios.catalogosPublicos().subscribe({ next: c => this.catalogos.set(c), error: () => undefined });
    this.espacios.consultarPublicos().subscribe({
      next: pagina => { this.lista.set(pagina?.items ?? []); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.error.set('No fue posible consultar los espacios para música en vivo.'); },
    });
  }

  volver(): void {
    void this.router.navigateByUrl('/ecosistema');
  }

  /** El paso al mapa, con la capa de Espacios activa. Es el mismo gesto que ofrecen Festivales y Mercados. */
  abrirMapa(): void {
    this.navegacion.navigateToMapLayer('Espacios', { targetView: 'map' });
  }

  /** La línea bajo el nombre: el tipo de espacio y su ambiente («Café · Cerrado»). */
  ambiente(espacio: EspacioPublico): string {
    return [espacio.tipos.map(t => t.nombre).join(', '), etiquetaDeAmbiente(espacio.ambiente)].filter(Boolean).join(' · ');
  }

  equipamientoDe(espacio: EspacioPublico): string[] {
    return espacio.equipamiento.map(e => e.nombre);
  }

  /** Sitio web y redes, como iconos bajo la organización. */
  enlacesDe(espacio: EspacioPublico): EnlaceDeRegistro[] {
    return enlacesDeRegistro({ sitioWeb: espacio.sitioWebEspacio, instagram: espacio.instagramEspacio, facebook: espacio.facebookEspacio, otroEnlace: espacio.otroEnlaceEspacio });
  }

  datosDe(espacio: EspacioPublico): DatoDeRegistro[] {
    const territorio = new NombrePropioPipe().transform(this.donde(espacio));
    const accesibilidad = espacio.esAccesible === true ? 'Accesible' : espacio.esAccesible === false ? 'No accesible' : 'Accesibilidad sin dato';
    const aforo = espacio.aforoMaximo ? `Aforo de ${espacio.aforoMaximo} personas` : 'Aforo sin dato';
    return [
      { etiqueta: 'Territorio', valor: territorio },
      { etiqueta: 'Aforo', valor: aforo },
      { etiqueta: 'Accesibilidad', valor: accesibilidad },
    ];
  }
}
