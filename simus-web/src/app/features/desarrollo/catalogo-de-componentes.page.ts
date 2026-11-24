import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { BotonComponent } from '../../shared/components/ui/boton/boton.component';
import { BuscadorDeListaComponent } from '../../shared/components/ui/buscador/buscador-de-lista.component';
import { CampoDeTextoComponent } from '../../shared/components/ui/campo-de-texto/campo-de-texto.component';
import { CampoDeSeleccionComponent, OpcionDeSeleccion } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { EnlaceDeRegresoComponent } from '../../shared/components/ui/enlace-de-regreso/enlace-de-regreso.component';
import { BarraDeHerramientasComponent } from '../../shared/components/ui/barra-de-herramientas/barra-de-herramientas.component';
import { opcionesDeTipoDeProceso } from '../../shared/components/ui/barra-de-tipo/opciones-de-tipo';
import { ColumnaOrdenable, EstadoDeOrden, alternarOrden, ordenarFilas } from '../../shared/components/ui/orden-de-lista/orden-de-lista';
import { OrdenDeListaComponent } from '../../shared/components/ui/orden-de-lista/orden-de-lista.component';
import { CeldaDeTablaDirective, ColumnaDeGestion, TablaDeGestionComponent } from '../../shared/components/ui/tabla-de-gestion/tabla-de-gestion.component';
import { AccionDeFila } from '../../shared/components/ui/tabla-de-gestion/acciones-de-fila.component';
import { PanelDeSeccionComponent } from '../../shared/components/ui/panel-de-seccion/panel-de-seccion.component';
import { FiltroActivo, FiltrosActivosComponent } from '../../shared/components/ui/filtros-activos/filtros-activos.component';
import { ChipDeFiltroComponent } from '../../shared/components/ui/chip-de-filtro/chip-de-filtro.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { OpcionDePestana, PestanasComponent } from '../../shared/components/ui/pestanas/pestanas.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../shared/components/ui/selector-segmentado/selector-segmentado.component';

/**
 * EL CATÁLOGO DE PRIMITIVAS DE DISEÑO (UI-B). SOLO DESARROLLO: la ruta `/desarrollo/componentes` no
 * existe en producción (ver `app.routes.ts`).
 *
 * Existe para VER JUNTAS y MEDIR las piezas que antes se escribían cada vez a mano: campo de texto,
 * buscador, desplegable, botón, pestañas, selector segmentado, chip e indicador de estado, con sus
 * estados (normal, foco, error, deshabilitado) y sus dos alturas (36 y 44 px). El guion
 * `e2e-audit/catalogo-de-componentes.spec.ts` lo recorre y deja las capturas.
 *
 * A PROPÓSITO NO USA TARJETAS: cada bloque es un título, una línea fina y el contenido, que es lo
 * que pide `docs/desarrollo/30-consola-y-acceso.md` §30.12. Un catálogo de componentes hecho de cajas dentro de cajas enseñaría
 * justo el anti-patrón que este lote quiere evitar.
 */
@Component({
  selector: 'app-catalogo-de-componentes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CampoDeSeleccionComponent,
    EnlaceDeRegresoComponent, FiltrosActivosComponent, PanelDeSeccionComponent,
    BarraDeHerramientasComponent, OrdenDeListaComponent, TablaDeGestionComponent, CeldaDeTablaDirective,
    BotonComponent, BuscadorDeListaComponent, CampoDeTextoComponent, ChipDeFiltroComponent,
    FiltroDesplegableComponent, IndicadorDeEstadoComponent, PestanasComponent, SelectorSegmentadoComponent,
  ],
  styles: [`
    :host { display: block; background: #fff; color: var(--color-valor); }
    .catalogo { max-width: 72rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
    .catalogo h1 { margin: 0 0 .25rem; font-size: var(--text-titulo); font-weight: 700; }
    .catalogo__intro { margin: 0 0 2rem; max-width: 46rem; color: var(--color-prosa); font-size: var(--text-cuerpo); }
    .bloque { margin-top: 2.25rem; padding-top: 1.25rem; border-top: 1px solid var(--color-filete); }
    .bloque h2 { margin: 0 0 .25rem; font-size: var(--text-destacado); font-weight: 700; }
    .bloque__nota { margin: 0 0 1rem; max-width: 46rem; color: var(--color-rotulo); font-size: var(--text-dato); }
    .fila { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem 1.25rem; }
    .columna { display: grid; gap: 1rem; max-width: 28rem; }
    .dos-columnas { display: grid; gap: 1.5rem 2.5rem; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }
    .rotulo-de-fila { margin: 0 0 .35rem; color: var(--color-rotulo); font-size: var(--text-dato); font-weight: 700; }
    .filtros { display: grid; gap: .75rem 1rem; align-items: end; grid-template-columns: minmax(16rem, 1.6fr) repeat(3, minmax(9rem, 1fr)) auto; }
    .muestras { display: flex; flex-wrap: wrap; gap: .75rem 1.5rem; }
    .muestra { display: flex; align-items: center; gap: .6rem; font-size: var(--text-dato); }
    .muestra__color { width: 2.25rem; height: 1.5rem; border: 1px solid var(--color-filete); border-radius: var(--radius-control); }
    .lateral-con-scroll { width: 18rem; height: 11rem; overflow-y: auto; padding: 1rem; border: 1px solid var(--color-filete); background: #f7f8fb; }
    .titulo-con-vista { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: .75rem 1.5rem; padding-bottom: .5rem; border-bottom: 1px solid var(--color-filete); }
    .titulo-con-vista__titulo { margin: 0; min-width: 0; font-size: var(--text-titulo); font-weight: 700; }
    .titulo-con-vista app-selector-segmentado { margin-left: auto; }
    table { border-collapse: collapse; font-size: var(--text-dato); }
    th, td { padding: .35rem 1.25rem .35rem 0; text-align: left; }
    th { color: var(--color-rotulo); font-weight: 700; }
  `],
  template: `
    <div class="catalogo" id="catalogo">
      <h1>Primitivas de diseño</h1>
      <p class="catalogo__intro">
        Los componentes compartidos con sus estados y sus dos alturas: 36 px en las áreas de trabajo y
        44 px en formularios, ingreso y directorios públicos. Solo existe en desarrollo.
      </p>

      <section class="bloque" aria-labelledby="t-tokens" data-bloque="tokens">
        <h2 id="t-tokens">Tokens</h2>
        <p class="bloque__nota">Radio único de 8 px; borde de campo de 3,14:1 sobre blanco; un solo anillo de foco.</p>
        <div class="muestras">
          <span class="muestra"><span class="muestra__color" style="background: var(--color-borde-campo)"></span>Borde de campo</span>
          <span class="muestra"><span class="muestra__color" style="background: var(--color-foco)"></span>Foco y acción</span>
          <span class="muestra"><span class="muestra__color" style="background: var(--color-peligro)"></span>Peligro y error</span>
          <span class="muestra"><span class="muestra__color" style="background: var(--color-rotulo)"></span>Texto de apoyo</span>
        </div>
        <table style="margin-top:1rem">
          <thead><tr><th>Tamaño</th><th>Alto</th><th>Dónde</th></tr></thead>
          <tbody>
            <tr><td>Menudo</td><td>24 px</td><td>Celdas de tabla y controles en línea</td></tr>
            <tr><td>Normal</td><td>36 px</td><td>Consola, panel y filtros de lista</td></tr>
            <tr><td>Cómodo</td><td>44 px</td><td>Formularios, ingreso y directorios públicos</td></tr>
          </tbody>
        </table>
      </section>

      <section class="bloque" aria-labelledby="t-campos" data-bloque="campos">
        <h2 id="t-campos">Campo de texto</h2>
        <p class="bloque__nota">Etiqueta superior enlazada, ayuda y error bajo el campo, borde y foco de los tokens.</p>
        <div class="dos-columnas">
          <div class="columna">
            <p class="rotulo-de-fila">Normal, 36 px</p>
            <app-campo-de-texto etiqueta="Nombre del Festival" identificador="cat-nombre" ayuda="Como aparece en el cartel." marcador="Festival de música" />
            <app-campo-de-texto etiqueta="Correo de contacto" identificador="cat-correo" tipo="email" [obligatorio]="true" error="Escribe un correo con el formato nombre@dominio." />
            <app-campo-de-texto etiqueta="Territorio" identificador="cat-territorio" [deshabilitado]="true" ayuda="Se toma de la organización." />
            <app-campo-de-seleccion etiqueta="Tipo de documento" identificador="cat-documento" textoVacio="Elige una" [opciones]="documentos" ayuda="Lista corta: un selector nativo." />
          </div>
          <div class="columna">
            <p class="rotulo-de-fila">Cómodo, 44 px</p>
            <app-campo-de-texto etiqueta="Nombre del Festival" identificador="cat-nombre-c" tamano="comodo" ayuda="Como aparece en el cartel." />
            <app-campo-de-texto etiqueta="Buscar un Festival" identificador="cat-busqueda-c" tamano="comodo" [conBusqueda]="true" marcador="Buscar por nombre, municipio…" />
            <app-campo-de-texto etiqueta="Descripción" identificador="cat-descripcion" tamano="comodo" [multilinea]="true" [filas]="3" ayuda="Hasta 600 caracteres." />
            <app-campo-de-seleccion etiqueta="Tipo de documento" identificador="cat-documento-c" tamano="comodo" textoVacio="Elige una" error="Elige un tipo de documento." [opciones]="documentos" />
          </div>
        </div>
      </section>

      <section class="bloque" aria-labelledby="t-filtros" data-bloque="filtros">
        <h2 id="t-filtros">Fila de filtros estándar</h2>
        <p class="bloque__nota">Búsqueda, hasta tres desplegables y «Limpiar filtros», alineados por la base; la acción principal a la derecha.</p>
        <p class="bloque__nota" data-avisos-del-buscador>El buscador espera 300 ms de pausa y no repite textos: avisos recibidos hasta ahora, {{ avisosDelBuscador() }}.</p>
        <div class="filtros">
          <div>
            <p class="rotulo-de-fila">Buscar</p>
            <app-buscador-de-lista [valor]="busqueda()" etiqueta="Buscar solicitudes" identificador="cat-buscador" marcador="Buscar por nombre, municipio…" ancho [cargando]="buscando()" (cambiar)="alBuscar($event)" />
          </div>
          <div>
            <p class="rotulo-de-fila">Tipo de asunto</p>
            <app-filtro-desplegable [opciones]="tipos" [elegida]="tipo()" etiqueta="Tipo de asunto" identificador="cat-tipo" [completo]="true" (cambiar)="tipo.set($event)" />
          </div>
          <div>
            <p class="rotulo-de-fila">Territorio</p>
            <app-filtro-desplegable [opciones]="territorios" [elegida]="territorio()" etiqueta="Territorio" identificador="cat-territorio-filtro" [completo]="true" (cambiar)="territorio.set($event)" />
          </div>
          <div>
            <p class="rotulo-de-fila">Orden</p>
            <app-filtro-desplegable [opciones]="ordenes" [elegida]="orden()" etiqueta="Orden" identificador="cat-orden" [completo]="true" (cambiar)="orden.set($event)" />
          </div>
        </div>
        <!-- A-1: los filtros aplicados, con su «X» y «Limpiar filtros» junto a los filtros, no al pie de la página. -->
        <div style="margin-top:.75rem" data-bloque-chips>
          <app-filtros-activos [filtros]="filtrosActivos()" (quitar)="quitarFiltro($event)" (limpiar)="limpiar()" />
          @if (filtrosActivos().length === 0) { <p class="bloque__nota" style="margin:0">Sin filtros aplicados: no se pinta nada. Elige un tipo o un territorio.</p> }
        </div>
        <p class="rotulo-de-fila" style="margin-top:1.25rem">Cómodo, 44 px (directorio público)</p>
        <div class="filtros">
          <app-buscador-de-lista [valor]="busqueda()" etiqueta="Buscar espacios" identificador="cat-buscador-c" tamano="comodo" marcador="Buscar por nombre o municipio…" [espera]="0" ancho (cambiar)="busqueda.set($event)" />
          <app-filtro-desplegable [opciones]="territorios" [elegida]="territorio()" etiqueta="Territorio" identificador="cat-territorio-c" tamano="comodo" [completo]="true" (cambiar)="territorio.set($event)" />
        </div>
      </section>


      <section class="bloque" aria-labelledby="t-titulo-vista" data-bloque="vista-en-el-titulo">
        <h2 id="t-titulo-vista">Selector de vista en la línea del título (A-4, M-2)</h2>
        <p class="bloque__nota">El selector va a la derecha, en la misma fila que el título del apartado; en pantallas angostas baja bajo el título y se queda a la derecha. Es el patrón de Agenda («Programa» / «Eventos»), Noticias, Editorial y el mapa.</p>
        <div class="titulo-con-vista">
          <h3 class="titulo-con-vista__titulo">Programa</h3>
          <app-selector-segmentado [soloIconos]="true" [opciones]="vistasConIcono" [elegida]="vista()" etiquetaDelGrupo="Vista del programa" (elegir)="vista.set($event)" />
        </div>
      </section>

      <section class="bloque" aria-labelledby="t-regreso" data-bloque="enlace-de-regreso">
        <h2 id="t-regreso">Enlace de regreso (A-7)</h2>
        <p class="bloque__nota">La forma única de volver a la lista desde un detalle: flecha de iconos, «Volver a …», conserva los filtros. Sustituye a «← Agenda» y a los otros dos estilos.</p>
        <app-enlace-de-regreso destino="a la agenda" [enlace]="['/desarrollo/componentes']" [queryParams]="{ q: 'jazz' }" identificador="cat-regreso" />
        <app-enlace-de-regreso destino="a Festivales" [enlace]="['/desarrollo/componentes']" [comodo]="true" identificador="cat-regreso-c" />
      </section>

      <section class="bloque" aria-labelledby="t-panel" data-bloque="panel-de-seccion">
        <h2 id="t-panel">Panel de sección (PANEL3)</h2>
        <p class="bloque__nota">El apartado de una pantalla de gestión: título, contador, acción a la derecha y contenido, sobre fondo blanco con borde fino. Reemplaza los filetes entre bloques; no se anida ni lleva sombra.</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <app-panel-de-seccion titulo="Próximos eventos" idDelTitulo="cat-panel-1" [contador]="3">
            <a accion href="/desarrollo/componentes">Ver eventos</a>
            <p class="t-texto">Contenido del panel: filas agrupadas con espacio, no con filetes.</p>
          </app-panel-de-seccion>
          <app-panel-de-seccion titulo="Requiere tu acción" idDelTitulo="cat-panel-2" tono="atencion" [contador]="1">
            <p class="t-texto">El tono de atención tiñe el panel de ámbar.</p>
          </app-panel-de-seccion>
        </div>
      </section>

      <section class="bloque" aria-labelledby="t-listas" data-bloque="listas-de-gestion">
        <h2 id="t-listas">Listas de gestión (P3)</h2>
        <p class="bloque__nota">Barra de tipo (segmentada si cabe, desplegable si no), barra de herramientas con «Ordenar por», cuenta y «Quitar filtros», y tabla ordenable con columna «Acciones». Filas de muestra: solo existen en este catálogo.</p>
        <app-barra-de-herramientas etiqueta="Filtrar y ordenar la lista de muestra" [tipos]="tiposDeLista" [tipo]="tipoDeLista()" (elegirTipo)="tipoDeLista.set($event)"
          [mostradas]="filasDeLista().length" [total]="filasDeMuestra.length" [hayFiltros]="tipoDeLista() !== 'todos'" (quitarFiltros)="tipoDeLista.set('todos')">
          <app-buscador-de-lista identificador="cat-lista-buscar" etiqueta="Buscar en la lista de muestra" marcador="Nombre o territorio" valor="" />
          <app-orden-de-lista etiquetaDeLaLista="la lista de muestra" identificador="cat-lista-orden" [columnas]="criteriosDeLista" [orden]="ordenDeLista()" (cambiar)="ordenDeLista.set($event)" />
        </app-barra-de-herramientas>
        <app-tabla-de-gestion etiqueta="Lista de muestra" [columnas]="columnasDeLista" [filas]="filasDeLista()" [clave]="claveDeMuestra"
          [orden]="ordenDeLista()" (ordenar)="ordenDeLista.set(alternarOrden(ordenDeLista(), $event))"
          [acciones]="accionesDeMuestra" [descripcionDeFila]="nombreDeMuestra">
          <ng-template appCelda="nombre" let-f><b class="tg-titulo">{{ f.nombre }}</b><p class="tg-detalle">{{ f.tipoEtiqueta }} · {{ f.territorio }}</p></ng-template>
          <ng-template appCelda="estado" let-f>{{ f.estado }}</ng-template>
          <ng-template appCelda="fecha" let-f>{{ f.fecha }}</ng-template>
        </app-tabla-de-gestion>
      </section>

      <section class="bloque" aria-labelledby="t-lateral" data-bloque="lateral-con-scroll">
        <h2 id="t-lateral">Filtro dentro de un panel con desplazamiento (A-3)</h2>
        <p class="bloque__nota">Reproduce la barra lateral de Agenda: un contenedor con altura limitada y scroll propio. El desplegable de departamentos debe quedar entero a la vista y navegable.</p>
        <aside class="lateral-con-scroll" data-prueba="lateral">
          <p class="rotulo-de-fila">Departamento</p>
          <app-filtro-desplegable [opciones]="departamentos" [elegida]="departamento()" etiqueta="Departamento" identificador="cat-departamento" [completo]="true" (cambiar)="departamento.set($event)" />
          <p class="rotulo-de-fila" style="margin-top:6rem">Contenido que sigue debajo</p>
          <p class="bloque__nota">El panel se calcula contra la ventana, no contra este recuadro.</p>
        </aside>
      </section>

      <section class="bloque" aria-labelledby="t-botones" data-bloque="botones">
        <h2 id="t-botones">Botones</h2>
        <p class="bloque__nota">Una sola acción principal por pantalla. El botón apagado dice por qué, justo debajo.</p>
        <div class="fila">
          <app-boton importancia="principal">Guardar</app-boton>
          <app-boton importancia="secundaria">Cancelar</app-boton>
          <app-boton importancia="terciaria">Ver detalle</app-boton>
          <app-boton importancia="confirmar">Publicar</app-boton>
          <app-boton importancia="destructiva">Retirar</app-boton>
          <app-boton importancia="principal" [ocupado]="true">Enviando</app-boton>
          <app-boton importancia="principal" [deshabilitado]="true" motivo="Falta el motivo del rechazo">Rechazar</app-boton>
        </div>
        <div class="fila" style="margin-top:1rem">
          <app-boton importancia="secundaria" tamano="menudo">Menudo, 24 px</app-boton>
          <app-boton importancia="secundaria" tamano="normal">Normal, 36 px</app-boton>
          <app-boton importancia="secundaria" tamano="comodo">Cómodo, 44 px</app-boton>
        </div>
      </section>

      <section class="bloque" aria-labelledby="t-pestanas" data-bloque="pestanas">
        <h2 id="t-pestanas">Pestañas, vistas y estados</h2>
        <p class="bloque__nota">Pestañas: el estado o la vista de una misma lista. Selector segmentado: dos o tres posiciones de un mismo control. Nunca dos filas de pestañas en la misma página.</p>
        <app-pestanas [opciones]="estados" [elegida]="estado()" etiquetaDelGrupo="Estado de las solicitudes" controla="cat-lista" (elegir)="estado.set($event)" />
        <div style="margin-top:1.25rem">
          <app-selector-segmentado [opciones]="vistas" [elegida]="vista()" etiquetaDelGrupo="Vista de los resultados" (elegir)="vista.set($event)" />
        </div>
        <p class="rotulo-de-fila" style="margin-top:1.25rem">Solo iconos, para los conmutadores de vista</p>
        <div class="fila">
          <app-selector-segmentado [soloIconos]="true" [opciones]="vistasConIcono" [elegida]="vista()" etiquetaDelGrupo="Vista de los resultados" (elegir)="vista.set($event)" />
          <app-selector-segmentado [soloIconos]="true" [comodo]="true" [opciones]="modosDelMapa" [elegida]="modo()" etiquetaDelGrupo="Modo de visualización" (elegir)="modo.set($event)" />
        </div>
        <div class="fila" style="margin-top:1.25rem">
          <app-indicador-de-estado etiqueta="Publicado" tono="logrado" [conTexto]="true" />
          <app-indicador-de-estado etiqueta="En revisión" tono="en_curso" [conTexto]="true" />
          <app-indicador-de-estado etiqueta="Ajustes solicitados" tono="requiere_accion" [conTexto]="true" />
          <app-indicador-de-estado etiqueta="Borrador" tono="preliminar" [conTexto]="true" />
          <app-indicador-de-estado etiqueta="Rechazado" tono="adverso" [conTexto]="true" />
        </div>
      </section>
    </div>
  `,
})
export class CatalogoDeComponentesPage {
  protected readonly busqueda = signal('');
  protected readonly tipo = signal('todos');
  protected readonly territorio = signal('todos');
  protected readonly orden = signal('recientes');
  protected readonly estado = signal('pendientes');
  protected readonly vista = signal('lista');
  protected readonly departamento = signal('');
  // MUESTRA DE LAS LISTAS DE GESTIÓN (P3): datos inventados solo para ver las piezas; el catálogo no existe en producción.
  protected readonly filasDeMuestra = [
    { id: 1, nombre: 'Festival de Cuerdas y Bandolas', tipo: 'festivales', tipoEtiqueta: 'Festival', territorio: 'Silvia, Cauca', estado: 'Ajustes solicitados', urgencia: 0, fecha: '16 nov 2026', ts: 3 },
    { id: 2, nombre: 'Mercado de Músicas del Suroccidente', tipo: 'mercados', tipoEtiqueta: 'Mercado musical', territorio: 'Popayán, Cauca', estado: 'Publicado', urgencia: 3, fecha: '5 abr 2024', ts: 1 },
    { id: 3, nombre: 'Taller de Lutería Los Cedros', tipo: 'luteria', tipoEtiqueta: 'Taller de lutería', territorio: 'Popayán, Cauca', estado: 'Borrador', urgencia: 2, fecha: '28 jul 2026', ts: 2 },
  ];
  protected readonly tipoDeLista = signal('todos');
  protected readonly ordenDeLista = signal<EstadoDeOrden>({ columna: 'estado', direccion: 'asc' });
  protected readonly tiposDeLista = opcionesDeTipoDeProceso({ conteos: { festivales: 1, mercados: 1, luteria: 1 } });
  protected readonly columnasDeLista: readonly ColumnaDeGestion[] = [
    { id: 'nombre', etiqueta: 'Nombre' }, { id: 'estado', etiqueta: 'Estado', ancho: 'estado' }, { id: 'fecha', etiqueta: 'Actualizado', ancho: 'fecha' },
  ];
  protected readonly criteriosDeLista: readonly ColumnaOrdenable<(typeof this.filasDeMuestra)[number]>[] = [
    { id: 'nombre', etiqueta: 'Nombre', tipo: 'texto', valor: f => f.nombre },
    { id: 'estado', etiqueta: 'Estado', tipo: 'rank', valor: f => f.urgencia },
    { id: 'fecha', etiqueta: 'Actualizado', tipo: 'fecha', valor: f => f.ts },
  ];
  protected readonly filasDeLista = computed(() => ordenarFilas(
    this.filasDeMuestra.filter(f => this.tipoDeLista() === 'todos' || f.tipo === this.tipoDeLista()), this.criteriosDeLista, this.ordenDeLista()));
  protected readonly alternarOrden = alternarOrden;
  protected readonly claveDeMuestra = (f: { id: number }): number => f.id;
  protected readonly nombreDeMuestra = (f: { nombre: string }): string => f.nombre;
  protected readonly accionesDeMuestra = (): readonly AccionDeFila[] => [
    { id: 'abrir', etiqueta: 'Abrir', tono: 'principal' }, { id: 'historial', etiqueta: 'Ver historial' },
    { id: 'retirar', etiqueta: 'Retirar', tono: 'peligro' },
  ];
  protected readonly modo = signal('mapa');
  /** Solo para la muestra: simula que la consulta tarda, para ver el estado de carga del buscador (no hay datos reales aquí). */
  protected readonly buscando = signal(false);
  protected readonly avisosDelBuscador = signal(0);
  protected readonly filtrosActivos = computed<readonly FiltroActivo[]>(() => {
    const filtros: FiltroActivo[] = [];
    if (this.tipo() !== 'todos') { filtros.push({ clave: 'tipo', rotulo: 'Tipo de asunto', valor: this.tipos.find(t => t.id === this.tipo())?.etiqueta ?? this.tipo() }); }
    if (this.territorio() !== 'todos') { filtros.push({ clave: 'territorio', rotulo: 'Territorio', valor: this.territorios.find(t => t.id === this.territorio())?.etiqueta ?? this.territorio() }); }
    if (this.busqueda()) { filtros.push({ clave: 'busqueda', rotulo: 'Búsqueda', valor: this.busqueda() }); }
    return filtros;
  });

  protected readonly documentos: readonly OpcionDeSeleccion[] = [
    { valor: 'cc', etiqueta: 'Cédula de ciudadanía' },
    { valor: 'ce', etiqueta: 'Cédula de extranjería' },
    { valor: 'pa', etiqueta: 'Pasaporte' },
  ];
  protected readonly tipos: readonly OpcionDeFiltro[] = [
    { id: 'todos', etiqueta: 'Todos', conteo: 42 },
    { id: 'festivales', etiqueta: 'Festivales', conteo: 18 },
    { id: 'eventos', etiqueta: 'Eventos', conteo: 24 },
  ];
  protected readonly territorios: readonly OpcionDeFiltro[] = [
    { id: 'todos', etiqueta: 'Todo el país' },
    { id: 'casanare', etiqueta: 'Casanare' },
    { id: 'valle', etiqueta: 'Valle del Cauca' },
  ];
  protected readonly departamentos: readonly OpcionDeFiltro[] = [{ id: '', etiqueta: 'Todos los departamentos' }, ...[
    'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá, D. C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar',
    'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
    'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
  ].map(n => ({ id: n.toLowerCase(), etiqueta: n }))];
  protected readonly ordenes: readonly OpcionDeFiltro[] = [
    { id: 'recientes', etiqueta: 'Más recientes' },
    { id: 'antiguos', etiqueta: 'Más antiguos' },
  ];
  protected readonly estados: readonly OpcionDePestana[] = [
    { id: 'pendientes', etiqueta: 'Pendientes', conteo: 12 },
    { id: 'resueltas', etiqueta: 'Resueltas', conteo: 30 },
  ];
  protected readonly vistas: readonly OpcionSegmentada[] = [
    { id: 'lista', etiqueta: 'Lista' },
    { id: 'mapa', etiqueta: 'Mapa' },
  ];

  protected readonly vistasConIcono: readonly OpcionSegmentada[] = [
    { id: 'lista', etiqueta: 'Vista de lista', icono: 'lista' },
    { id: 'mosaico', etiqueta: 'Vista de mosaico', icono: 'mosaico' },
  ];
  protected readonly modosDelMapa: readonly OpcionSegmentada[] = [
    { id: 'mapa', etiqueta: 'Mapa', icono: 'mapa' },
    { id: 'grafico', etiqueta: 'Gráfico', icono: 'grafico' },
    { id: 'tabla', etiqueta: 'Tabla', icono: 'tabla' },
  ];

  protected alBuscar(texto: string): void {
    this.busqueda.set(texto);
    this.avisosDelBuscador.update(n => n + 1);
    this.buscando.set(texto.length > 0);
    if (texto) { setTimeout(() => this.buscando.set(false), 1200); }
  }

  protected quitarFiltro(clave: string): void {
    if (clave === 'tipo') { this.tipo.set('todos'); }
    if (clave === 'territorio') { this.territorio.set('todos'); }
    if (clave === 'busqueda') { this.busqueda.set(''); }
  }

  protected limpiar(): void {
    this.busqueda.set('');
    this.tipo.set('todos');
    this.territorio.set('todos');
    this.orden.set('recientes');
  }
}

