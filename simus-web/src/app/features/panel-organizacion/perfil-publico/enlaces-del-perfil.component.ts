import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePlus, LucideTrash2 } from '@lucide/angular';
import {
  ClaveDeRed,
  EnlaceDelPerfil,
  LARGO_DE_ETIQUETA_DE_ENLACE,
  MAXIMO_DE_ENLACES_DEL_PERFIL,
  REDES_DE_ENLACE,
  erroresDeEnlaces,
  redDe,
} from '../../../core/formularios/redes-del-perfil';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { ErrorDeCampoComponent } from '../../../shared/components/ui/error-de-campo/error-de-campo.component';
import { IconoDeEnlaceComponent, TipoDeEnlace } from '../../../shared/components/ui/icono-de-enlace/icono-de-enlace.component';

/**
 * Los enlaces del perfil público: «Añadir enlace» ofrece las redes y plataformas habituales con su icono y su
 * formato, y «Otro» para una página web u otra dirección (perfil público). Ver `redes-del-perfil.ts`.
 *
 * Cada fila tiene la red fija (se eligió al añadirla), su dirección https y su error junto al campo. Una red
 * conocida no se repite y ninguna dirección se repite.
 */
@Component({
  selector: 'app-enlaces-del-perfil',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BotonNativoDirective, ErrorDeCampoComponent, IconoDeEnlaceComponent, LucidePlus, LucideTrash2],
  template: `
    <fieldset data-enlaces>
      <legend class="text-sm font-semibold text-slate-800">Enlaces (hasta {{ maximo }})</legend>
      <p class="text-sm text-slate-600">Tus redes y plataformas, con la dirección completa. Solo direcciones https.</p>
      @for (enlace of enlaces(); track $index; let i = $index) {
        <div class="mt-3" data-enlace-fila [attr.data-red]="enlace.red">
          <div class="fila-de-campos fila-de-campos--rotulada">
            <span class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-800" data-enlace-red>
              <app-icono-de-enlace [tipo]="icono(enlace.red)" [tamano]="18" />
              {{ rotulo(enlace.red) }}
            </span>
            <label [for]="'perfil-enlace-' + i" class="sr-only">Dirección de {{ rotulo(enlace.red) }}</label>
            <input [id]="'perfil-enlace-' + i" [name]="'enlace' + i" type="text" inputmode="url" [placeholder]="ejemplo(enlace.red)" maxlength="400"
              [ngModel]="enlace.url" (ngModelChange)="cambiar(i, $event)" (blur)="tocar(i)"
              [attr.aria-invalid]="mostrarError(i) ? 'true' : null" [attr.aria-describedby]="mostrarError(i) ? 'perfil-enlace-error-' + i : null"
              class="block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado" />
            <button type="button" (click)="quitar(i)" appBoton="secundaria" class="fila-de-campos__acciones" [attr.aria-label]="'Quitar el enlace de ' + rotulo(enlace.red)">
              <svg lucideTrash2 size="16" aria-hidden="true"></svg>
            </button>
          </div>
          @if (enlace.red === 'otro') {
            <div class="fila-de-campos fila-de-campos--rotulada mt-1">
              <span class="hidden sm:block" aria-hidden="true"></span>
              <label [for]="'perfil-enlace-etiqueta-' + i" class="sr-only">Rótulo del enlace {{ i + 1 }} (opcional)</label>
              <input [id]="'perfil-enlace-etiqueta-' + i" [name]="'enlaceEtiqueta' + i" type="text" placeholder="Rótulo (opcional), por ejemplo Mi sitio" [attr.maxlength]="largoDeEtiqueta"
                [ngModel]="enlace.etiqueta ?? ''" (ngModelChange)="rotular(i, $event)"
                class="block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado" />
            </div>
          }
          <app-error-de-campo [identificador]="'perfil-enlace-error-' + i" [mensaje]="mostrarError(i) ? errores()[i] : null" />
        </div>
      }
      @if (enlaces().length < maximo) {
        <div class="mt-3">
          @if (!eligiendo()) {
            <button type="button" (click)="eligiendo.set(true)" appBoton="secundaria" data-anadir-enlace>
              <svg lucidePlus size="16" aria-hidden="true"></svg> Añadir enlace
            </button>
          } @else {
            <div class="rounded-xl border border-slate-200 p-3" data-elegir-red>
              <p id="perfil-elegir-red" class="text-sm font-semibold text-slate-800">¿De dónde es el enlace?</p>
              <ul class="mt-2 grid gap-2 sm:grid-cols-2" aria-labelledby="perfil-elegir-red">
                @for (red of redes; track red.clave) {
                  <li>
                    <button type="button" appBoton="secundaria" class="w-full !justify-start" (click)="anadir(red.clave)" [disabled]="yaEsta(red.clave)"
                      [attr.data-red-opcion]="red.clave">
                      <app-icono-de-enlace [tipo]="icono(red.clave)" [tamano]="18" />
                      {{ red.rotulo }}
                      @if (yaEsta(red.clave)) { <span class="text-xs font-normal text-slate-500">(ya añadido)</span> }
                    </button>
                  </li>
                }
              </ul>
              <button type="button" appBoton="terciaria" class="mt-2" (click)="eligiendo.set(false)">Cancelar</button>
            </div>
          }
        </div>
      }
      <app-error-de-campo identificador="perfil-enlaces-error" [mensaje]="errorGeneral()" />
    </fieldset>
  `,
})
export class EnlacesDelPerfilComponent {
  readonly enlaces = model<EnlaceDelPerfil[]>([]);
  /** Un error del servidor sobre los enlaces en conjunto. */
  readonly errorGeneral = input<string | null>(null);
  /** Se llega a mostrar el error de todas las filas (al guardar) aunque no se hayan tocado. */
  readonly mostrarTodos = input(false);

  protected readonly maximo = MAXIMO_DE_ENLACES_DEL_PERFIL;
  protected readonly largoDeEtiqueta = LARGO_DE_ETIQUETA_DE_ENLACE;
  protected readonly redes = REDES_DE_ENLACE;
  protected readonly eligiendo = signal(false);
  private readonly tocados = signal<ReadonlySet<number>>(new Set());
  protected readonly errores = computed(() => erroresDeEnlaces(this.enlaces()));

  protected rotulo(clave: ClaveDeRed): string {
    return clave === 'otro' ? 'Otro enlace' : redDe(clave).rotulo;
  }

  protected ejemplo(clave: ClaveDeRed): string {
    return redDe(clave).ejemplo;
  }

  protected icono(clave: ClaveDeRed): TipoDeEnlace {
    return clave === 'otro' ? 'sitioWeb' : clave;
  }

  protected yaEsta(clave: ClaveDeRed): boolean {
    return clave !== 'otro' && this.enlaces().some(enlace => enlace.red === clave);
  }

  protected mostrarError(indice: number): boolean {
    return !!this.errores()[indice] && (this.mostrarTodos() || (this.tocados().has(indice) && !!this.enlaces()[indice]?.url.trim()));
  }

  protected tocar(indice: number): void {
    this.tocados.update(actual => new Set(actual).add(indice));
  }

  protected cambiar(indice: number, url: string): void {
    this.enlaces.update(lista => lista.map((enlace, i) => (i === indice ? { ...enlace, url } : enlace)));
  }

  protected rotular(indice: number, etiqueta: string): void {
    this.enlaces.update(lista => lista.map((enlace, i) => (i === indice ? { ...enlace, etiqueta } : enlace)));
  }

  protected anadir(red: ClaveDeRed): void {
    if (this.enlaces().length >= this.maximo || this.yaEsta(red)) return;
    this.enlaces.update(lista => [...lista, { red, url: '', etiqueta: null }]);
    this.eligiendo.set(false);
    const indice = this.enlaces().length - 1;
    setTimeout(() => document.getElementById(`perfil-enlace-${indice}`)?.focus());
  }

  protected quitar(indice: number): void {
    this.enlaces.update(lista => lista.filter((_, i) => i !== indice));
    this.tocados.set(new Set());
  }
}
