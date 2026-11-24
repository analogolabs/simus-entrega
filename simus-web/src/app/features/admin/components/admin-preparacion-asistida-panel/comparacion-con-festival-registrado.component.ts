import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../../../../core/http/api-client.service';
import { etiquetaDeEstadoEditorial } from '../../../../core/vocabularios/estados';
import type { FichaFestivalAdministrativa } from '../../admin-ficha-festival/admin-ficha-festival.component';

interface FilaDeComparacion {
  campo: string;
  archivo: string;
  registrado: string;
  /** Si difieren; el resaltado no depende solo del color: la fila dice «Distinto». */
  distinto: boolean;
}

/**
 * Pone al lado de una fila del archivo el Festival que ya existe y se le parece (D5-10, D5b).
 *
 * <b>POR QUÉ UNA COMPARACIÓN Y NO SOLO UN AVISO.</b> «Se parece a X (identificador 12)» obliga a
 * abrir otra pestaña para decidir si es el mismo Festival. Con los campos clave en dos columnas,
 * quien prepara el archivo decide en el sitio si excluye la fila o la deja entrar. No bloquea nada:
 * la decisión sigue siendo de la persona.
 *
 * <b>VIVE FUERA DE LA TABLA.</b> La tabla de la revisión tiene su propio desplazamiento y una
 * cabecera fija: dentro de una celda la comparación quedaba recortada y tapada por la cabecera. La
 * fila solo lleva el botón; esto se abre debajo, a todo el ancho.
 *
 * <b>SE TRAE AL ABRIR.</b> Cada fila con parecido pediría su ficha al pintar la tabla; con
 * quinientas filas serían quinientas lecturas que casi nadie mira.
 */
@Component({
  selector: 'app-comparacion-con-festival-registrado',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mt-4 rounded-xl border border-slate-200 bg-white p-4" role="region" aria-label="Comparación con el Festival ya registrado">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <h4 class="text-xs font-black text-slate-700">Comparación con el Festival ya registrado</h4>
        <button type="button" class="text-xs font-black text-purple-900 underline underline-offset-2 hover:text-purple-700" (click)="cerrar.emit()">
          Cerrar la comparación
        </button>
      </div>
      @if (cargando()) {
        <p class="mt-3 text-xs text-slate-500" role="status">Trayendo el Festival…</p>
      } @else if (error()) {
        <p class="mt-3 text-xs font-semibold text-amber-800" role="alert">{{ error() }}</p>
      } @else if (filas().length > 0) {
        <table class="mt-3 w-full text-left text-xs">
          <thead>
            <tr class="text-slate-500">
              <th scope="col" class="p-1.5">Dato</th>
              <th scope="col" class="p-1.5">En el archivo</th>
              <th scope="col" class="p-1.5">Ya registrado</th>
            </tr>
          </thead>
          <tbody>
            @for (fila of filas(); track fila.campo) {
              <tr class="border-t border-slate-100 align-top" [class.bg-amber-50]="fila.distinto">
                <th scope="row" class="p-1.5 font-bold text-slate-600">
                  {{ fila.campo }}
                  @if (fila.distinto) { <span class="ml-1 font-black text-amber-800">· Distinto</span> }
                </th>
                <td class="p-1.5 text-slate-800">{{ fila.archivo }}</td>
                <td class="p-1.5 text-slate-800">{{ fila.registrado }}</td>
              </tr>
            }
          </tbody>
        </table>
        <p class="mt-3 text-xs text-slate-600">
          Si es el mismo Festival, excluye la fila. La organización podrá reclamar el que ya existe.
          <a class="font-black text-purple-900 underline underline-offset-2"
            [routerLink]="['/administracion', 'festivales', festivalId()]" target="_blank" rel="noopener">Abrir su ficha en la consola</a>
        </p>
      }
    </section>
  `,
})
export class ComparacionConFestivalRegistradoComponent {
  private readonly api = inject(ApiClientService);

  /** Lo que el archivo trae para esta fila, ya normalizado (campo → valor). */
  readonly datos = input.required<Readonly<Record<string, string | null | undefined>>>();
  /** El Festival que ya existe y se le parece. */
  readonly festivalId = input.required<string>();
  /** La persona cierra la comparación; quien la abrió decide qué hacer con la fila. */
  readonly cerrar = output<void>();

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  private readonly ficha = signal<FichaFestivalAdministrativa | null>(null);

  constructor() {
    // SE TRAE AL ABRIR Y CADA VEZ QUE CAMBIA EL FESTIVAL COMPARADO: si la persona pasa de una fila a
    // otra con el bloque abierto, no se queda enseñando el Festival de la anterior.
    effect(() => {
      const id = this.festivalId();
      untracked(() => void this.traer(id));
    });
  }

  readonly filas = computed<FilaDeComparacion[]>(() => {
    const ficha = this.ficha();
    if (!ficha) return [];
    const archivo = this.datos();
    const par = (campo: string, delArchivo: string | null | undefined, delRegistro: string | null | undefined): FilaDeComparacion => {
      const a = (delArchivo ?? '').trim();
      const r = (delRegistro ?? '').trim();
      return { campo, archivo: a || 'Sin dato', registrado: r || 'Sin dato', distinto: normalizar(a) !== normalizar(r) };
    };
    return [
      par('Nombre', archivo['nombre'], ficha.nombre),
      par('Nivel de cobertura', archivo['nivelCobertura'], ficha.nivelCobertura),
      par('Departamento', archivo['departamento'], ficha.departamento),
      par('Municipio', archivo['municipio'], ficha.municipio),
      par('Periodicidad', archivo['periodicidad'], ficha.periodicidad),
      par('Correo de contacto', archivo['correoContacto'], ficha.correoContacto),
      par('Sitio web', archivo['sitioWeb'], ficha.sitioWeb),
      // Lo que solo existe del lado del registro no se compara: el archivo no lo trae.
      { campo: 'Estado', archivo: 'Se crearía publicado', registrado: etiquetaDeEstadoEditorial(ficha.estado), distinto: false },
      {
        campo: 'Organización responsable',
        archivo: 'Ninguna: registro histórico',
        registrado: ficha.esRegistroHistorico
          ? 'Ninguna: registro histórico'
          : (ficha.organizacionResponsableNombre ?? 'Sin dato'),
        distinto: !ficha.esRegistroHistorico,
      },
    ];
  });

  private async traer(id: string): Promise<void> {
    this.ficha.set(null);
    this.cargando.set(true);
    this.error.set(null);
    try {
      const ficha = await firstValueFrom(
        this.api.get<FichaFestivalAdministrativa>(`/api/v1/admin/festivales/${id}`, {}));
      // Si la persona ya pasó a otra fila mientras llegaba la respuesta, esta no vale.
      if (id === this.festivalId()) this.ficha.set(ficha);
    } catch {
      if (id === this.festivalId()) {
        this.error.set('No pude traer ese Festival. Ábrelo desde su ficha en la consola para compararlo.');
      }
    } finally {
      if (id === this.festivalId()) this.cargando.set(false);
    }
  }
}

/** Sin tildes, mayúsculas ni espacios de más: «Medellín» y «medellin» son el mismo dato. */
function normalizar(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
