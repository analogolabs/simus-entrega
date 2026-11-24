import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MapDataService } from '../../../../core/services/map-data.service';
import { NavigationService } from '../../../../core/services/navigation.service';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import * as MapDomain from '../../../map/domain/map-domain';
import { DepartamentoDibujado, dibujarColombia } from './dibujo-de-colombia';
import { ContadorComponent } from '../../../../shared/components/ui/contador/contador.component';
import { EncabezadoDeSeccionComponent } from '../encabezado-de-seccion/encabezado-de-seccion.component';
import { RevelarDirective } from '../../../../shared/directives/revelar.directive';

interface Cifra { valor: number; rotulo: string; }

/**
 * Cuántos municipios distintos tienen al menos un proceso o un evento publicado. Festivales y
 * eventos traen el territorio en `fields` (`departamento`, `municipio`); los mercados, plano
 * (`department`, `municipality`). Se cuenta la pareja departamento + municipio normalizada, porque
 * hay municipios con el mismo nombre en departamentos distintos.
 */
interface RegistroConCampos { fields?: Record<string, unknown>; }

function contarMunicipios(datos: { festivalRecords?: unknown[]; agendaRecords?: unknown[]; marketRecords?: unknown[] }): number {
  const vistos = new Set<string>();
  const anotar = (departamento: unknown, municipio: unknown) => {
    const m = MapDomain.normalizeMunicipalityName(String(municipio ?? ''));
    if (!m) return;
    vistos.add(`${MapDomain.normalizeDepartmentName(String(departamento ?? ''))}|${m}`);
  };
  for (const r of [...(datos.festivalRecords ?? []), ...(datos.agendaRecords ?? [])] as RegistroConCampos[]) {
    anotar(r.fields?.['departamento'], r.fields?.['municipio']);
  }
  for (const r of (datos.marketRecords ?? []) as { department?: unknown; municipality?: unknown }[]) {
    anotar(r.department, r.municipality);
  }
  return vistos.size;
}

/**
 * «LA MÚSICA EN EL TERRITORIO»: EL MAPA Y LAS CIFRAS, EL MOMENTO EN QUE SIMUS SE VE COMO PLATAFORMA.
 *
 * Sustituye a dos bloques: el banner deslizante de tres diapositivas y la rejilla de los seis
 * procesos con foto. A un lado, el mensaje y las cifras grandes (número enorme, rótulo pequeño); al
 * otro, Colombia dibujada con los registros publicados por departamento. Todo sale de los mismos
 * datos que el geovisor (`fetchMapCountsBundle`): no hay cifras escritas a mano.
 *
 * Las cifras: procesos registrados (festivales y mercados publicados), eventos en agenda, y los
 * departamentos y municipios con algún registro. Escuelas, escenarios, redes y lutería entran en
 * «procesos» cuando tengan registros públicos: no se muestra un «0» o un «XX» que diga algo falso.
 */
@Component({
  selector: 'app-portada-territorio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContadorComponent, RevelarDirective, EncabezadoDeSeccionComponent],
  templateUrl: './portada-territorio.component.html',
})
export class PortadaTerritorioComponent implements OnInit {
  private readonly mapData = inject(MapDataService);
  private readonly navigation = inject(NavigationService);
  private readonly webTexts = inject(TextosWebService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cargando = signal(true);
  readonly departamentos = signal<DepartamentoDibujado[]>([]);
  readonly alto = signal(1200);
  readonly porDepartamento = signal<Record<string, number>>({});
  readonly cifras = signal<Cifra[]>([]);

  /** El máximo, para repartir el color. Nunca cero, para no dividir por cero. */
  private readonly maximo = computed(() => Math.max(1, ...Object.values(this.porDepartamento())));

  ngOnInit(): void {
    this.mapData.fetchMapCountsBundle().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (datos) => {
        const rasgos = datos.geoJson?.features ?? [];
        const dibujo = dibujarColombia(rasgos, MapDomain.getFeatureDepartmentCode, MapDomain.getFeatureDepartmentName);
        this.departamentos.set(dibujo.departamentos);
        this.alto.set(dibujo.alto);

        const suma: Record<string, number> = {};
        for (const recuento of [datos.festivalCounts, datos.marketCounts, datos.agendaCounts]) {
          for (const [nombre, n] of Object.entries((recuento ?? {}) as Record<string, number>)) {
            suma[nombre] = (suma[nombre] ?? 0) + (n || 0);
          }
        }
        const porCodigo: Record<string, number> = {};
        for (const rasgo of rasgos) {
          porCodigo[MapDomain.getFeatureDepartmentCode(rasgo)] = suma[MapDomain.getFeatureDepartmentNormalizedName(rasgo)] ?? 0;
        }
        this.porDepartamento.set(porCodigo);

        this.cifras.set([
          { valor: (datos.festivalRecords?.length ?? 0) + (datos.marketRecords?.length ?? 0), rotulo: 'Procesos registrados' },
          { valor: datos.agendaRecords?.length ?? 0, rotulo: 'Eventos en agenda' },
          { valor: Object.values(porCodigo).filter((n) => n > 0).length, rotulo: 'Departamentos con registros' },
          { valor: contarMunicipios(datos), rotulo: 'Municipios con registros' },
        ]);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  registros(codigo: string): number {
    return this.porDepartamento()[codigo] ?? 0;
  }

  /**
   * Cinco tonos escalonados de la escala del morado de la marca, sobre fondo blanco: del lila
   * pálido (pocos registros) al morado de SIMUS (el departamento con más). Sin registros, un gris
   * lila casi blanco. Sin leyenda: el mapa se lee como «más oscuro, más registros».
   */
  readonly escala = ['#E2D7E6', '#C2A9CB', '#9C7BA6', '#6E4F77', '#4C2C54'];

  relleno(codigo: string): string {
    const n = this.registros(codigo);
    if (!n) return '#F3F0F4';
    const t = Math.sqrt(n / this.maximo());
    return this.escala[Math.min(this.escala.length - 1, Math.floor(t * this.escala.length))];
  }

  texto(clave: string): string {
    return this.webTexts.getWebText(clave);
  }

  formato(valor: number): string {
    return valor.toLocaleString('es-CO');
  }

  explorarMapa(): void {
    this.navigation.routerNavigate('mapa-ecosistemico');
  }
}
