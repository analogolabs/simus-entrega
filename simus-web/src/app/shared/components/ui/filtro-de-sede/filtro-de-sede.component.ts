import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CatalogService } from '../../../../core/services/catalog.service';
import { UbicacionDivipola } from '../../../../core/territorio/ubicacion-divipola';
import { departamentosDe, municipiosDe, ubicacionesDesdeTerritorios } from '../../../../core/territorio/sede-principal';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../filtro-desplegable/filtro-desplegable.component';

/** La sede por la que se filtra una lista o un tablero de la consola. */
export interface FiltroDeSede {
  /** Código de departamento, o vacío si no se acota. */
  readonly departamento: string;
  /** Código de municipio, o vacío. Solo tiene sentido con departamento. */
  readonly municipio: string;
  /** Solo los procesos con la sede pendiente de completar. */
  readonly pendiente: boolean;
}

export const SIN_FILTRO_DE_SEDE: FiltroDeSede = { departamento: '', municipio: '', pendiente: false };

/** El identificador de la opción «pendiente» dentro del desplegable de departamentos. */
const PENDIENTE = '__pendiente__';

/**
 * EL FILTRO POR SEDE PRINCIPAL DE LA CONSOLA, UNO SOLO PARA LAS LISTAS Y TABLEROS DE LOS CINCO
 * TIPOS DE PROCESO (decisión 124).
 *
 * Son dos filtros estándar de la barra de lista (`app-filtro-desplegable`): el departamento de la
 * sede y el municipio de la sede. El municipio queda deshabilitado hasta elegir departamento, igual
 * que en `app-selector-de-sede`, y se vacía al cambiar de departamento. La primera lista ofrece,
 * además de los departamentos, «Pendiente de completar» para ver los procesos sin sede.
 *
 * Carga DIVIPOLA por su cuenta (catálogo público, una consulta) o recibe las filas ya cargadas.
 * Se pone dentro de `app-barra-de-lista`: la barra lo proyecta con el hueco de los filtros.
 */
@Component({
  selector: 'app-filtro-de-sede',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FiltroDesplegableComponent],
  styles: [':host { display: contents; }'],
  template: `
    <app-filtro-desplegable rotulo="Departamento de la sede" etiqueta="Filtrar por el departamento de la sede"
      [identificador]="idBase() + '-sede-departamento'" [tamano]="tamano()"
      [opciones]="opcionesDeDepartamento()" [elegida]="pendiente() ? '${PENDIENTE}' : departamento()"
      (cambiar)="elegirDepartamento($event)" />
    <app-filtro-desplegable rotulo="Municipio de la sede" etiqueta="Filtrar por el municipio de la sede"
      [identificador]="idBase() + '-sede-municipio'" [tamano]="tamano()"
      [deshabilitado]="!departamento()"
      [opciones]="opcionesDeMunicipio()" [elegida]="municipio()"
      (cambiar)="elegirMunicipio($event)" />
  `,
})
export class FiltroDeSedeComponent implements OnInit {
  private readonly catalogo = inject(CatalogService);
  private readonly destruccion = inject(DestroyRef);

  /** Las filas de DIVIPOLA, si quien lo usa ya las tiene; si no, se piden. */
  readonly ubicaciones = input<readonly UbicacionDivipola[] | null>(null);
  readonly departamento = input<string>('');
  readonly municipio = input<string>('');
  readonly pendiente = input<boolean>(false);
  /** Para que los `id` de dos filtros de sede en una misma página no se repitan. */
  readonly idBase = input<string>('lista');
  /** Si se ofrece «Pendiente de completar» entre los departamentos (los tableros no lo usan). */
  readonly conPendientes = input<boolean>(true);
  /**
   * La altura de los dos filtros: la MISMA que la del buscador y las demás listas de su fila. Antes no
   * se pasaba y quedaban en 36 px junto a un buscador y un «Tipo» de 44.
   */
  readonly tamano = input<'normal' | 'comodo'>('normal');

  readonly cambiar = output<FiltroDeSede>();

  private readonly propias = signal<readonly UbicacionDivipola[]>([]);
  private readonly filas = computed(() => this.ubicaciones() ?? this.propias());

  ngOnInit(): void {
    if (this.ubicaciones() !== null) return;
    this.catalogo.fetchDivipolaConCodigos().pipe(takeUntilDestroyed(this.destruccion)).subscribe({
      next: territorios => this.propias.set(ubicacionesDesdeTerritorios(territorios)),
      error: () => this.propias.set([]),
    });
  }

  readonly opcionesDeDepartamento = computed<readonly OpcionDeFiltro[]>(() => [
    { id: '', etiqueta: 'Todos los departamentos' },
    ...(this.conPendientes() ? [{ id: PENDIENTE, etiqueta: 'Pendiente de completar' }] : []),
    ...departamentosDe(this.filas()).map(d => ({ id: d.codigo, etiqueta: d.nombre })),
  ]);

  readonly opcionesDeMunicipio = computed<readonly OpcionDeFiltro[]>(() => [
    { id: '', etiqueta: this.departamento() ? 'Todos los municipios' : 'Elige un departamento primero' },
    ...municipiosDe(this.filas(), this.departamento()).map(m => ({ id: m.municipalityCode, etiqueta: m.municipalityName })),
  ]);

  elegirDepartamento(codigo: string): void {
    if (codigo === PENDIENTE) {
      this.cambiar.emit({ departamento: '', municipio: '', pendiente: true });
      return;
    }
    if ((codigo ?? '') === this.departamento() && !this.pendiente()) return;
    this.cambiar.emit({ departamento: codigo ?? '', municipio: '', pendiente: false });
  }

  elegirMunicipio(codigo: string): void {
    this.cambiar.emit({ departamento: this.departamento(), municipio: codigo ?? '', pendiente: false });
  }
}
