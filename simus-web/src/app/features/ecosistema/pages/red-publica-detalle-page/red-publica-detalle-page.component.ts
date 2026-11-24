import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { EtiquetasDeClasificacionComponent } from '../../../../shared/components/ui/etiquetas-de-clasificacion/etiquetas-de-clasificacion.component';
import { AvisoDeRegistroHistoricoComponent } from '../../../../shared/components/ui/aviso-de-registro-historico/aviso-de-registro-historico.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompactHeroComponent } from '../../../../shared/components/ui/compact-hero/compact-hero.component';
import { RecursoNoEncontradoComponent } from '../../../../shared/components/ui/recurso-no-encontrado/recurso-no-encontrado.component';
import { RedPublica, RedesService, etiquetaDeTipoDeNodo } from '../../../../core/services/redes.service';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';
import { enlaceExterno } from '../../../../shared/utils/enlace-externo';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * La ficha pública de una red o centro de documentación, en /ecosistema/redes/:redId.
 *
 * <b>ES LA LISTA EXPRESA DE LO QUE EL PORTAL PUEDE ENSEÑAR</b> (`RedPublicaDto`). Si la red es de
 * una persona responsable, no se enseña su nombre: se publica la red, con el contacto que escribió
 * para él. Si es de una organización, se nombra y, solo si tiene ficha pública, se enlaza.
 */
@Component({
  selector: 'app-red-publica-detalle-page',
  standalone: true,
  imports: [TextoWebPipe, AvisoDeRegistroHistoricoComponent, EtiquetasDeClasificacionComponent, EsqueletoComponent, RouterLink, NombrePropioPipe, CompactHeroComponent, RecursoNoEncontradoComponent],
  template: `
    <section class="min-h-screen bg-hueso pb-24 font-nunito text-titulo">
      @if (cargando()) {
        <div class="mx-auto max-w-7xl px-6 pt-28"><app-esqueleto variante="ficha" [etiqueta]="'red_ficha_cargando' | textoWeb" /></div>
      } @else if (!red()) {
        <app-recurso-no-encontrado
          idBase="red"
          [titulo]="'ficha_no_disponible' | textoWeb"
          causa="Puede que la dirección esté mal escrita o que la red no esté publicado para consulta pública."
          etiquetaDeLista="Ver las redes y documentación"
          rutaDeLista="/ecosistema/redes" />
      } @else if (red(); as ficha) {
        <app-compact-hero [backLabel]="'red_ficha_miga' | textoWeb" [current]="ficha.nombre" [title]="ficha.nombre" [subtitle]="territorio(ficha)" (regresoSolicitado)="volver()"></app-compact-hero>

        <div class="mx-auto max-w-[86rem] px-6 pt-8 lg:px-8">
          <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div class="space-y-6">
              <article class="rounded-xl border border-filete bg-white p-6">
                @if (ficha.fotoUrl) {
                  <img [src]="ficha.fotoUrl" [alt]="ficha.fotoAlt || 'Foto de la red ' + ficha.nombre" width="800" height="320" class="mb-4 max-h-80 w-full rounded-lg object-cover" data-foto-del-proceso />
                }
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'red_ficha_sobre' | textoWeb }}</h2>
                <p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{{ ficha.descripcion || 'Esta red aún no tiene una descripción.' }}</p>
                @if (ficha.acervosYColecciones) {
                  <h3 class="mt-6 font-alternate text-xs font-bold text-tinta-media">{{ 'red_ficha_acervos' | textoWeb }}</h3>
                  <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{{ ficha.acervosYColecciones }}</p>
                }
              </article>

              <article class="rounded-xl border border-filete bg-white p-6">
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'red_ficha_consulta' | textoWeb }}</h2>
                <ul class="mt-4 flex flex-wrap gap-2" aria-label="Formas de acceso">
                  @for (s of ficha.formasDeAcceso; track s.id) { <li class="rounded-full border border-filete px-3 py-1 text-sm">{{ s.nombre }}</li> }
                </ul>
                <h3 class="mt-6 font-alternate text-xs font-bold text-tinta-media">{{ 'red_ficha_formatos' | textoWeb }}</h3>
                <ul class="mt-2 flex flex-wrap gap-2" aria-label="Formatos de documentación">
                  @for (f of ficha.formatos; track f.id) { <li class="rounded-full border border-filete px-3 py-1 text-sm">{{ f.nombre }}</li> }
                </ul>
                @if (ficha.practicasMusicales.length) {
                  <h3 class="mt-6 font-alternate text-xs font-bold text-tinta-media">{{ 'ficha_practicas' | textoWeb }}</h3>
                  <div class="mt-2 flex flex-wrap gap-2" aria-label="Prácticas musicales"><app-etiquetas-de-clasificacion modo="enlazar" ruta="/ecosistema/redes" [practicas]="ficha.practicasMusicales" /></div>
                }
              </article>
            </div>

            <aside class="space-y-6">
              @if (ficha.esRegistroHistorico) {
                <app-aviso-de-registro-historico tipo="esta red" modulo="redes" [id]="'' + ficha.id" [nombre]="ficha.nombre" />
              }
              <article class="rounded-xl border border-filete bg-white p-6">
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'red_ficha_datos' | textoWeb }}</h2>
                <dl class="mt-4 space-y-3 text-sm">
                  <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'red_ficha_tipo' | textoWeb }}</dt><dd class="mt-0.5">{{ tipoDeNodo(ficha) }}</dd></div>
                  <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'ficha_donde' | textoWeb }}</dt><dd class="mt-0.5">{{ territorio(ficha) | nombrePropio }}@if (ficha.lugarEspecifico) { · {{ ficha.lugarEspecifico }} }</dd></div>
                  <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'red_ficha_acceso' | textoWeb }}</dt><dd class="mt-0.5">{{ ficha.accesoAbierto ? 'Acceso abierto' : 'Con gestión previa' }}</dd></div>
                  <div>
                    <dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'ficha_responsable' | textoWeb }}</dt>
                    <dd class="mt-0.5">
                      @if (ficha.esIndependiente) { Persona responsable }
                      @else if (ficha.organizacionPublicaId) { <a [routerLink]="['/ecosistema/organizaciones', ficha.organizacionPublicaId]" class="text-morado hover:underline">{{ ficha.organizacionNombre }}</a> }
                      @else { {{ ficha.organizacionNombre }} }
                    </dd>
                  </div>
                </dl>
              </article>

              <article class="rounded-xl border border-filete bg-white p-6">
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'ficha_contacto' | textoWeb }}</h2>
                <ul class="mt-4 space-y-2 text-sm" aria-label="Formas de contacto">
                  @if (ficha.correoRed) { <li><a [href]="'mailto:' + ficha.correoRed" class="text-morado hover:underline">{{ ficha.correoRed }}</a></li> }
                  @if (ficha.telefonoRed) { <li>{{ ficha.telefonoRed }}</li> }
                  @for (enlace of enlaces(); track enlace.etiqueta) {
                    <li><a [href]="enlace.url" target="_blank" rel="noopener noreferrer" class="text-morado hover:underline">{{ enlace.etiqueta }}</a></li>
                  }
                  @if (!ficha.correoRed && !ficha.telefonoRed && !enlaces().length) { <li class="text-slate-500">{{ 'red_ficha_sin_contacto' | textoWeb }}</li> }
                </ul>
              </article>
            </aside>
          </div>
        </div>
      }
    </section>
  `,
})
export class RedPublicaDetallePageComponent implements OnInit {
  private readonly redes = inject(RedesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly red = signal<RedPublica | null>(null);
  readonly cargando = signal(true);

  /** Los enlaces con su rótulo, ya normalizados. */
  readonly enlaces = computed(() => {
    const t = this.red();
    if (!t) return [];
    return [
      { etiqueta: 'Sitio web', url: enlaceExterno(t.sitioWebRed) },
      { etiqueta: 'Instagram', url: enlaceExterno(t.instagramRed) },
      { etiqueta: 'Facebook', url: enlaceExterno(t.facebookRed) },
      { etiqueta: 'Otro enlace', url: enlaceExterno(t.otroEnlaceRed) },
    ].filter(e => e.url);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('redId');
    if (!id) { this.cargando.set(false); return; }
    this.redes.consultarPublico(id).subscribe({
      next: red => { this.red.set(red); this.cargando.set(false); },
      error: () => { this.red.set(null); this.cargando.set(false); },
    });
  }

  volver(): void {
    void this.router.navigateByUrl('/ecosistema/redes');
  }

  tipoDeNodo(red: RedPublica): string {
    return etiquetaDeTipoDeNodo(red.tipoDeNodo);
  }

  territorio(red: RedPublica): string {
    if (red.nivelCobertura === 'nacional') return 'Todo el país';
    return [red.nombreMunicipio, red.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }
}
