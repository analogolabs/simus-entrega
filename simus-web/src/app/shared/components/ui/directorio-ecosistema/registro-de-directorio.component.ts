import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EnlaceDeRegistro } from '../../../utils/enlaces-de-registro';
import { ElementoClasificado, EtiquetasDeClasificacionComponent } from '../etiquetas-de-clasificacion/etiquetas-de-clasificacion.component';
import { IconoDeEnlaceComponent } from '../icono-de-enlace/icono-de-enlace.component';

/** Un dato corto de la columna derecha del listado: «Territorio», «Aforo»… */
export interface DatoDeRegistro {
  etiqueta: string;
  valor: string;
}

/**
 * Un registro de un directorio del Ecosistema, en listado o en tarjeta: la forma estándar.
 *
 * <b>LA USAN LOS PROCESOS NUEVOS</b> (Lutería, Espacios, Redes y documentación) para que se vean
 * como Mercados y Festivales sin repetir su marcado: nombre que enlaza a la ficha, una línea de
 * contexto, la descripción en tres renglones, las etiquetas del proceso y, en el listado, una
 * columna con los datos clave y el botón «Ver ficha».
 *
 * <b>EL DISEÑO MANDA Y EL DATO SE ADAPTA:</b> los cuerpos de texto llevan altura explícita, así que un
 * registro con descripción larga y otro sin ninguna ocupan lo mismo. Lo que no cabe se recorta.
 * Sin mayúsculas sostenidas (docs/usuario/23-guia-de-estilo-de-textos.md).
 */
@Component({
  selector: 'app-registro-de-directorio',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, EtiquetasDeClasificacionComponent, IconoDeEnlaceComponent],
  template: `
    @if (modo === 'listado') {
      <article class="grid gap-4 py-7 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10" [attr.data-registro]="nombre">
        <div class="min-w-0">
          <a [routerLink]="enlace" class="text-xl font-bold leading-tight text-morado no-underline transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde">{{ nombre }}</a>
          @if (contexto) { <p class="mt-1 text-sm text-tinta-media">{{ contexto }}</p> }
          <ng-container *ngTemplateOutlet="iconos"></ng-container>
          <p class="mt-3 line-clamp-3 text-sm leading-relaxed text-tinta-media">{{ descripcion || 'Sin descripción registrada.' }}</p>
          @if (etiquetas.length || practicas.length || territorios.length) {
            <div class="mt-4 flex flex-wrap items-center gap-2">
              @for (etiqueta of etiquetas; track etiqueta) {
                <span class="rounded-full bg-verde/10 px-3 py-1 text-xs text-morado">{{ etiqueta }}</span>
              }
              <ng-container *ngTemplateOutlet="clasificacion"></ng-container>
            </div>
          }
        </div>
        <div class="min-w-0 lg:text-right">
          @for (dato of datos; track dato.etiqueta; let primero = $first) {
            <p class="text-xs font-bold text-tinta-media" [class.mt-3]="!primero">{{ dato.etiqueta }}</p>
            <p class="mt-1 text-sm text-titulo">{{ dato.valor }}</p>
          }
          <!-- UNA ACCIÓN SE DIBUJA COMO UN CONTROL, no como un texto con una flecha. -->
          <a [routerLink]="enlace" data-abrir-registro
            class="mt-4 inline-flex min-h-11 items-center rounded-xl border border-filete bg-white px-4 py-2.5 text-sm font-bold text-morado no-underline transition hover:border-verde-medio focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde">Ver ficha</a>
        </div>
      </article>
    } @else {
      <article class="flex h-full flex-col border border-filete p-6 transition hover:border-verde-medio" [attr.data-registro]="nombre">
        <a [routerLink]="enlace" class="text-base font-bold leading-tight text-morado no-underline transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde">{{ nombre }}</a>
        @if (contexto) { <p class="mt-1 truncate text-[0.78rem] text-tinta-media">{{ contexto }}</p> }
        <ng-container *ngTemplateOutlet="iconos"></ng-container>
        <p class="mt-3 line-clamp-3 min-h-16 text-sm leading-relaxed text-tinta-media">{{ descripcion || 'Sin descripción registrada.' }}</p>
        @if (practicas.length || territorios.length) {
          <div class="mt-3 flex flex-wrap gap-1.5"><ng-container *ngTemplateOutlet="clasificacion"></ng-container></div>
        }
        @for (dato of datos; track dato.etiqueta; let primero = $first) {
          <p class="text-[0.78rem] text-tinta-media" [class.mt-auto]="primero" [class.pt-4]="primero">{{ dato.valor }}</p>
        }
      </article>
    }

    <!-- Las redes y enlaces, como iconos bajo el nombre de la organización (mapa 20). -->
    <ng-template #iconos>
      @if (enlaces.length) {
        <span class="mt-2 flex items-center gap-2 text-tinta-media" data-enlaces-del-registro>
          @for (enlace of enlaces; track enlace.clave) {
            <a [href]="enlace.href" [title]="enlace.etiqueta" target="_blank" rel="noopener noreferrer"
               class="inline-flex size-6 pointer-coarse:size-11 items-center justify-center rounded-sm text-tinta-media no-underline transition hover:text-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde">
              <app-icono-de-enlace [tipo]="enlace.clave" [tamano]="14" />
              <span class="sr-only">{{ enlace.etiqueta }} de {{ nombre }}</span>
            </a>
          }
        </span>
      }
    </ng-template>
    <ng-template #clasificacion>
      <app-etiquetas-de-clasificacion modo="filtrar" [practicas]="practicas" [territorios]="territorios"
        [practicaActiva]="practicaActiva" [territorioActivo]="territorioActivo"
        (practicaElegida)="practicaElegida.emit($event)" (territorioElegido)="territorioElegido.emit($event)" />
    </ng-template>
  `,
})
export class RegistroDeDirectorioComponent {
  @Input({ required: true }) nombre = '';
  @Input({ required: true }) enlace: readonly (string | number)[] = [];
  @Input() modo: 'listado' | 'tarjeta' = 'listado';
  /** La línea bajo el nombre: la modalidad, el tipo de nodo, quién responde. */
  @Input() contexto = '';
  @Input() descripcion: string | null = null;
  @Input() etiquetas: readonly string[] = [];
  @Input() datos: readonly DatoDeRegistro[] = [];
  /** Sitio web y redes del registro, como iconos bajo la organización. */
  @Input() enlaces: readonly EnlaceDeRegistro[] = [];
  /** Prácticas musicales y territorios sonoros: etiquetas que SIEMPRE filtran el listado. */
  @Input() practicas: readonly ElementoClasificado[] = [];
  @Input() territorios: readonly ElementoClasificado[] = [];
  @Input() practicaActiva = '';
  @Input() territorioActivo = '';
  @Output() practicaElegida = new EventEmitter<string>();
  @Output() territorioElegido = new EventEmitter<string>();
}
