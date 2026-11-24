import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArrowDown, LucideArrowUp, LucidePencil, LucidePlus, LucideTrash2 } from '@lucide/angular';
import {
  LARGO_DESCRIPCION_DE_PORTAFOLIO,
  LARGO_TITULO_DE_PORTAFOLIO,
  TIPOS_DE_PORTAFOLIO,
  anioDeTexto,
  erroresDeItemDePortafolio,
  resumenDeItem,
} from '../../../core/formularios/portafolio-del-perfil';
import { normalizarUrl } from '../../../core/formularios/url';
import { ItemDePortafolio, MAXIMO_DE_PORTAFOLIO, TipoDePortafolio } from '../../../core/services/perfil-publico.service';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { ErrorDeCampoComponent } from '../../../shared/components/ui/error-de-campo/error-de-campo.component';

/**
 * El portafolio del perfil público: SOLO ENLACES, con mejor gestión (perfil público).
 *
 * Cada elemento lleva título, clase (audio, video, texto, imagen u otro), enlace https, y —opcionales— una
 * descripción breve y el año. La lista se ordena con «Subir» y «Bajar», se edita con «Editar» y se quita con
 * «Quitar»; un solo editor, abajo, sirve para añadir y para editar. Los cambios se aplican al pulsar «Guardar perfil».
 * Los elementos que ya estaban guardados se conservan: la descripción y el año son nuevos y quedan vacíos.
 */
@Component({
  selector: 'app-portafolio-del-perfil',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BotonNativoDirective, ErrorDeCampoComponent, LucideArrowDown, LucideArrowUp, LucidePencil, LucidePlus, LucideTrash2],
  template: `
    <fieldset data-portafolio>
      <legend class="text-sm font-semibold text-slate-800">Portafolio (hasta {{ maximo }})</legend>
      <p class="text-sm text-slate-600">Obras, grabaciones, videos o textos que ya están en la web: se guarda su enlace, no el archivo.</p>

      @if (portafolio().length) {
        <ol class="mt-3 space-y-2" data-portafolio-lista>
          @for (item of portafolio(); track $index; let i = $index) {
            <li class="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 p-3" [attr.data-portafolio-item]="i">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-slate-900" data-item-titulo>{{ item.titulo }}</p>
                <p class="text-xs text-slate-600" data-item-resumen>{{ resumen(item) }}</p>
                @if (item.descripcion) { <p class="mt-1 text-sm text-slate-700">{{ item.descripcion }}</p> }
                <p class="mt-1 break-all text-xs text-slate-500">{{ item.url }}</p>
              </div>
              <div class="flex shrink-0 items-center gap-1" role="group" [attr.aria-label]="'Acciones de ' + item.titulo">
                <button type="button" appBoton="terciaria" (click)="mover(i, -1)" [disabled]="i === 0" [attr.aria-label]="'Subir «' + item.titulo + '»'"><svg lucideArrowUp size="16" aria-hidden="true"></svg></button>
                <button type="button" appBoton="terciaria" (click)="mover(i, 1)" [disabled]="i === portafolio().length - 1" [attr.aria-label]="'Bajar «' + item.titulo + '»'"><svg lucideArrowDown size="16" aria-hidden="true"></svg></button>
                <button type="button" appBoton="secundaria" (click)="editar(i)" [attr.aria-label]="'Editar «' + item.titulo + '»'"><svg lucidePencil size="16" aria-hidden="true"></svg> Editar</button>
                <button type="button" appBoton="secundaria" (click)="quitar(i)" [attr.aria-label]="'Quitar «' + item.titulo + '»'"><svg lucideTrash2 size="16" aria-hidden="true"></svg> Quitar</button>
              </div>
            </li>
          }
        </ol>
      } @else if (editando() === null) {
        <p class="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600" data-portafolio-vacio>Todavía no hay elementos en tu portafolio.</p>
      }

      @if (editando() !== null) {
        <div class="mt-3 rounded-xl border border-morado p-4" role="group" aria-labelledby="portafolio-editor-titulo" data-portafolio-editor>
          <h3 id="portafolio-editor-titulo" class="text-slate-800">{{ editando() === 'nuevo' ? 'Nuevo elemento' : 'Editar elemento' }}</h3>
          <div class="mt-3">
            <label for="perfil-portafolio-titulo" class="block text-sm font-semibold text-slate-800">Título</label>
            <input id="perfil-portafolio-titulo" name="portafolioTitulo" type="text" [attr.maxlength]="largoTitulo" [(ngModel)]="borrador.titulo"
              [attr.aria-invalid]="erroresDelBorrador()['titulo'] ? 'true' : null" aria-describedby="perfil-portafolio-titulo-error"
              class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado" />
            <app-error-de-campo identificador="perfil-portafolio-titulo-error" [mensaje]="erroresDelBorrador()['titulo']" />
          </div>
          <fieldset class="mt-3">
            <legend class="text-sm font-semibold text-slate-800">Clase</legend>
            <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              @for (clase of clases; track clase.valor) {
                <label class="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-800">
                  <input type="radio" name="portafolioTipo" [value]="clase.valor" [(ngModel)]="borrador.tipo" class="h-4 w-4" />
                  {{ clase.rotulo }}
                </label>
              }
            </div>
          </fieldset>
          <div class="mt-3">
            <label for="perfil-portafolio-url" class="block text-sm font-semibold text-slate-800">Enlace</label>
            <input id="perfil-portafolio-url" name="portafolioUrl" type="text" inputmode="url" placeholder="https://www.mi-sitio.org/mi-grabacion" maxlength="400" [(ngModel)]="borrador.url"
              [attr.aria-invalid]="erroresDelBorrador()['url'] ? 'true' : null" aria-describedby="perfil-portafolio-url-error"
              class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado" />
            <app-error-de-campo identificador="perfil-portafolio-url-error" [mensaje]="erroresDelBorrador()['url']" />
          </div>
          <div class="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div>
              <label for="perfil-portafolio-descripcion" class="block text-sm font-semibold text-slate-800">Descripción (opcional)</label>
              <textarea id="perfil-portafolio-descripcion" name="portafolioDescripcion" rows="2" [attr.maxlength]="largoDescripcion" [(ngModel)]="borrador.descripcion"
                class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"></textarea>
              <p class="mt-1 text-xs text-slate-500">{{ borrador.descripcion.length }} de {{ largoDescripcion }}</p>
            </div>
            <div>
              <label for="perfil-portafolio-anio" class="block text-sm font-semibold text-slate-800">Año (opcional)</label>
              <input id="perfil-portafolio-anio" name="portafolioAnio" type="text" inputmode="numeric" maxlength="4" [(ngModel)]="borrador.anio"
                [attr.aria-invalid]="erroresDelBorrador()['anio'] ? 'true' : null" aria-describedby="perfil-portafolio-anio-error"
                class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado" />
              <app-error-de-campo identificador="perfil-portafolio-anio-error" [mensaje]="erroresDelBorrador()['anio']" />
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" appBoton="principal" (click)="confirmar()" data-confirmar-elemento>{{ editando() === 'nuevo' ? 'Añadir al portafolio' : 'Guardar el elemento' }}</button>
            <button type="button" appBoton="secundaria" (click)="cancelar()">Cancelar</button>
          </div>
        </div>
      } @else if (portafolio().length < maximo) {
        <button type="button" appBoton="secundaria" class="mt-3" (click)="nuevo()" data-anadir-al-portafolio>
          <svg lucidePlus size="16" aria-hidden="true"></svg> Añadir un elemento
        </button>
      }
      <app-error-de-campo identificador="perfil-portafolio-error" [mensaje]="errorGeneral()" />
    </fieldset>
  `,
})
export class PortafolioDelPerfilComponent {
  readonly portafolio = model<ItemDePortafolio[]>([]);
  readonly errorGeneral = input<string | null>(null);

  protected readonly maximo = MAXIMO_DE_PORTAFOLIO;
  protected readonly clases = TIPOS_DE_PORTAFOLIO;
  protected readonly largoTitulo = LARGO_TITULO_DE_PORTAFOLIO;
  protected readonly largoDescripcion = LARGO_DESCRIPCION_DE_PORTAFOLIO;
  /** `null`: no se edita nada; `'nuevo'`: se añade; un número: se edita ese elemento. */
  protected readonly editando = signal<number | 'nuevo' | null>(null);
  protected readonly erroresDelBorrador = signal<Record<string, string>>({});
  protected borrador = { tipo: 'audio' as TipoDePortafolio, titulo: '', url: '', descripcion: '', anio: '' };

  protected resumen(item: ItemDePortafolio): string {
    return resumenDeItem(item);
  }

  protected nuevo(): void {
    this.borrador = { tipo: 'audio', titulo: '', url: '', descripcion: '', anio: '' };
    this.erroresDelBorrador.set({});
    this.editando.set('nuevo');
    setTimeout(() => document.getElementById('perfil-portafolio-titulo')?.focus());
  }

  protected editar(indice: number): void {
    const item = this.portafolio()[indice];
    this.borrador = { tipo: item.tipo, titulo: item.titulo, url: item.url, descripcion: item.descripcion ?? '', anio: item.anio ? `${item.anio}` : '' };
    this.erroresDelBorrador.set({});
    this.editando.set(indice);
    setTimeout(() => document.getElementById('perfil-portafolio-titulo')?.focus());
  }

  protected cancelar(): void {
    this.editando.set(null);
    this.erroresDelBorrador.set({});
  }

  protected confirmar(): void {
    const errores = erroresDeItemDePortafolio(this.borrador);
    this.erroresDelBorrador.set(errores);
    if (Object.keys(errores).length) {
      const primero = errores['titulo'] ? 'titulo' : errores['url'] ? 'url' : 'anio';
      document.getElementById(`perfil-portafolio-${primero}`)?.focus();
      return;
    }
    const anio = anioDeTexto(this.borrador.anio);
    const item: ItemDePortafolio = {
      tipo: this.borrador.tipo,
      titulo: this.borrador.titulo.trim(),
      url: normalizarUrl(this.borrador.url),
      descripcion: this.borrador.descripcion.trim() || null,
      anio,
    };
    const actual = this.editando();
    this.portafolio.update(lista => actual === 'nuevo' || actual === null ? [...lista, item] : lista.map((existente, i) => (i === actual ? item : existente)));
    this.editando.set(null);
  }

  protected mover(indice: number, desplazamiento: -1 | 1): void {
    const destino = indice + desplazamiento;
    const lista = [...this.portafolio()];
    if (destino < 0 || destino >= lista.length) return;
    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    this.portafolio.set(lista);
  }

  protected quitar(indice: number): void {
    this.portafolio.update(lista => lista.filter((_, i) => i !== indice));
    if (this.editando() !== null) this.editando.set(null);
  }
}
