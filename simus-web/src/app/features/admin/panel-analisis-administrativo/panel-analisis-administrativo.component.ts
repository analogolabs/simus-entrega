import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { FiltroDeSede, FiltroDeSedeComponent, SIN_FILTRO_DE_SEDE } from '../../../shared/components/ui/filtro-de-sede/filtro-de-sede.component';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideRefreshCw } from '@lucide/angular';
import { CifraDeTablero, FranjaDeCifrasComponent } from '../../../shared/components/ui/franja-de-cifras/franja-de-cifras.component';
import { ConsultaGuiadaComponent } from '../../../shared/components/consulta-guiada/consulta-guiada.component';
import { NombrePropioPipe } from '../../../shared/texto/nombre-propio.pipe';
import {
  AnalisisAdministrativoService,
  TableroAnalisisAdministrativo,
} from './analisis-administrativo.service';
import { formatearFecha } from '../../../shared/utils/formatos-de-fecha';

/**
 * «Análisis y consultas»: el panorama administrativo, con la Consulta Guiada al lado.
 *
 * <b>ESTE COMPONENTE YA SOLO SE OCUPA DEL TABLERO.</b> El asistente era la mitad de este fichero y
 * de su plantilla; desde vive en `shared/components/consulta-guiada`
 * porque es una capacidad transversal —la misma pregunta se hace desde el espacio de una
 * organización— y una capacidad que solo existe dentro de una pantalla no lo es.
 */
@Component({
  selector: 'app-panel-analisis-administrativo',
  standalone: true,
  imports: [FiltroDeSedeComponent, NombrePropioPipe, CommonModule, ConsultaGuiadaComponent, BotonComponent, EstadoDeListaComponent, FranjaDeCifrasComponent, LucideRefreshCw],
  templateUrl: './panel-analisis-administrativo.component.html',
})
export class PanelAnalisisAdministrativoComponent implements OnInit {
  private readonly analisis = inject(AnalisisAdministrativoService);

  readonly tablero = signal<TableroAnalisisAdministrativo | null>(null);
  readonly cargandoTablero = signal(true);
  readonly errorTablero = signal('');
  /** La sede por la que se acota el tablero (decisión 124). Sin «pendiente»: eso se cuenta aparte, siempre. */
  readonly filtroSede = signal<FiltroDeSede>(SIN_FILTRO_DE_SEDE);
  /** Con un departamento elegido el reparto de abajo baja a municipios. */
  readonly tituloDelReparto = computed(() => this.filtroSede().departamento
    ? 'Municipios con más Festivales publicados'
    : 'Departamentos con más Festivales publicados');

  /** Los indicadores como cifras de la franja: la cifra, lo que cuenta y su alcance. */
  readonly cifras = computed<CifraDeTablero[]>(() =>
    (this.tablero()?.indicadores ?? []).map(indicador => ({
      id: indicador.id, cifra: indicador.total, rotulo: indicador.rotulo, detalle: indicador.alcance,
    })));

  ngOnInit(): void {
    this.cargarTablero();
  }

  cargarTablero(): void {
    this.cargandoTablero.set(true);
    this.errorTablero.set('');
    this.analisis.tablero(this.filtroSede()).subscribe({
      next: tablero => {
        this.tablero.set(tablero);
        this.cargandoTablero.set(false);
      },
      error: error => {
        this.errorTablero.set(this.mensajeDeError(error, 'No fue posible construir el tablero administrativo.'));
        this.cargandoTablero.set(false);
      },
    });
  }

  filtrarPorSede(sede: FiltroDeSede): void {
    this.filtroSede.set({ ...sede, pendiente: false });
    this.cargarTablero();
  }

  fecha(valor: string | null): string {
    return formatearFecha(valor, 'fecha-hora');
  }

  private mensajeDeError(error: unknown, respaldo: string): string {
    const mensaje = (error as { message?: unknown })?.message;
    return typeof mensaje === 'string' && mensaje.trim().length > 0 ? mensaje : respaldo;
  }
}
