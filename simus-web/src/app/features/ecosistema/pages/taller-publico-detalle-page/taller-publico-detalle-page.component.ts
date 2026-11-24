import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { EtiquetasDeClasificacionComponent } from '../../../../shared/components/ui/etiquetas-de-clasificacion/etiquetas-de-clasificacion.component';
import { AvisoDeRegistroHistoricoComponent } from '../../../../shared/components/ui/aviso-de-registro-historico/aviso-de-registro-historico.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompactHeroComponent } from '../../../../shared/components/ui/compact-hero/compact-hero.component';
import { RecursoNoEncontradoComponent } from '../../../../shared/components/ui/recurso-no-encontrado/recurso-no-encontrado.component';
import { TallerPublico, TalleresService, etiquetaDeModalidad } from '../../../../core/services/talleres.service';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';
import { enlaceExterno } from '../../../../shared/utils/enlace-externo';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * La ficha pública de un taller de lutería, en /ecosistema/luteria/:tallerId.
 *
 * <b>ES LA LISTA EXPRESA DE LO QUE EL PORTAL PUEDE ENSEÑAR</b> (`TallerPublicoDto`). Si el taller es de
 * un lutier independiente, no se enseña su nombre: se publica el taller, con el contacto que escribió
 * para él. Si es de una organización, se nombra y, solo si tiene ficha pública, se enlaza.
 */
@Component({
  selector: 'app-taller-publico-detalle-page',
  standalone: true,
  imports: [TextoWebPipe, AvisoDeRegistroHistoricoComponent, EtiquetasDeClasificacionComponent, RouterLink, NombrePropioPipe, CompactHeroComponent, RecursoNoEncontradoComponent, EsqueletoComponent],
  template: `
    <section class="min-h-screen bg-hueso pb-24 font-nunito text-titulo">
      @if (cargando()) {
        <div class="mx-auto max-w-7xl px-6 pt-28"><app-esqueleto variante="ficha" [etiqueta]="'lut_ficha_cargando' | textoWeb" /></div>
      } @else if (!taller()) {
        <app-recurso-no-encontrado
          idBase="taller"
          [titulo]="'ficha_no_disponible' | textoWeb"
          causa="Puede que la dirección esté mal escrita o que el taller no esté publicado para consulta pública."
          etiquetaDeLista="Ver los talleres de lutería"
          rutaDeLista="/ecosistema/luteria" />
      } @else if (taller(); as ficha) {
        <app-compact-hero [backLabel]="'lut_ficha_miga' | textoWeb" [current]="ficha.nombre" [title]="ficha.nombre" [subtitle]="territorio(ficha)" (regresoSolicitado)="volver()"></app-compact-hero>

        <div class="mx-auto max-w-[86rem] px-6 pt-8 lg:px-8">
          <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div class="space-y-6">
              <article class="rounded-xl border border-filete bg-white p-6">
                @if (ficha.fotoUrl) {
                  <img [src]="ficha.fotoUrl" [alt]="ficha.fotoAlt || 'Foto del taller ' + ficha.nombre" width="800" height="320" class="mb-4 max-h-80 w-full rounded-lg object-cover" data-foto-del-taller />
                }
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'lut_ficha_sobre' | textoWeb }}</h2>
                <p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{{ ficha.descripcion || 'Este taller aún no tiene una descripción.' }}</p>
                @if (ficha.saberesYTecnicas) {
                  <h3 class="mt-6 font-alternate text-xs font-bold text-tinta-media">{{ 'lut_ficha_saberes' | textoWeb }}</h3>
                  <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{{ ficha.saberesYTecnicas }}</p>
                }
              </article>

              <article class="rounded-xl border border-filete bg-white p-6">
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'lut_ficha_ofrece' | textoWeb }}</h2>
                <ul class="mt-4 flex flex-wrap gap-2" aria-label="Servicios del taller">
                  @for (s of ficha.servicios; track s.id) { <li class="rounded-full border border-filete px-3 py-1 text-sm">{{ s.nombre }}</li> }
                </ul>
                <h3 class="mt-6 font-alternate text-xs font-bold text-tinta-media">{{ 'lut_ficha_familias' | textoWeb }}</h3>
                <ul class="mt-2 flex flex-wrap gap-2" aria-label="Familias de instrumentos">
                  @for (f of ficha.familias; track f.id) { <li class="rounded-full border border-filete px-3 py-1 text-sm">{{ f.nombre }}</li> }
                </ul>
                @if (ficha.practicasMusicales.length) {
                  <h3 class="mt-6 font-alternate text-xs font-bold text-tinta-media">{{ 'ficha_practicas' | textoWeb }}</h3>
                  <div class="mt-2 flex flex-wrap gap-2" aria-label="Prácticas musicales"><app-etiquetas-de-clasificacion modo="enlazar" ruta="/ecosistema/luteria" [practicas]="ficha.practicasMusicales" /></div>
                }
              </article>
            </div>

            <aside class="space-y-6">
              @if (ficha.esRegistroHistorico) {
                <app-aviso-de-registro-historico tipo="este taller" modulo="talleres" [id]="'' + ficha.id" [nombre]="ficha.nombre" />
              }
              <article class="rounded-xl border border-filete bg-white p-6">
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'lut_ficha_datos' | textoWeb }}</h2>
                <dl class="mt-4 space-y-3 text-sm">
                  <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'lut_ficha_modalidad' | textoWeb }}</dt><dd class="mt-0.5">{{ modalidad(ficha) }}</dd></div>
                  <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'ficha_donde' | textoWeb }}</dt><dd class="mt-0.5">{{ territorio(ficha) | nombrePropio }}@if (ficha.lugarEspecifico) { · {{ ficha.lugarEspecifico }} }</dd></div>
                  <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'lut_ficha_aprendices' | textoWeb }}</dt><dd class="mt-0.5">{{ ficha.recibeAprendices ? 'Recibe aprendices' : 'No indica que reciba aprendices' }}</dd></div>
                  <div>
                    <dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'ficha_responsable' | textoWeb }}</dt>
                    <dd class="mt-0.5">
                      @if (ficha.esIndependiente) { Lutier independiente }
                      @else if (ficha.organizacionPublicaId) { <a [routerLink]="['/ecosistema/organizaciones', ficha.organizacionPublicaId]" class="text-morado hover:underline">{{ ficha.organizacionNombre }}</a> }
                      @else { {{ ficha.organizacionNombre }} }
                    </dd>
                  </div>
                </dl>
              </article>

              <article class="rounded-xl border border-filete bg-white p-6">
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'ficha_contacto' | textoWeb }}</h2>
                <ul class="mt-4 space-y-2 text-sm" aria-label="Formas de contacto">
                  @if (ficha.correoTaller) { <li><a [href]="'mailto:' + ficha.correoTaller" class="text-morado hover:underline">{{ ficha.correoTaller }}</a></li> }
                  @if (ficha.telefonoTaller) { <li>{{ ficha.telefonoTaller }}</li> }
                  @for (enlace of enlaces(); track enlace.etiqueta) {
                    <li><a [href]="enlace.url" target="_blank" rel="noopener noreferrer" class="text-morado hover:underline">{{ enlace.etiqueta }}</a></li>
                  }
                  @if (!ficha.correoTaller && !ficha.telefonoTaller && !enlaces().length) { <li class="text-slate-500">{{ 'lut_ficha_sin_contacto' | textoWeb }}</li> }
                </ul>
              </article>
            </aside>
          </div>
        </div>
      }
    </section>
  `,
})
export class TallerPublicoDetallePageComponent implements OnInit {
  private readonly talleres = inject(TalleresService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly taller = signal<TallerPublico | null>(null);
  readonly cargando = signal(true);

  /** Los enlaces con su rótulo, ya normalizados. */
  readonly enlaces = computed(() => {
    const t = this.taller();
    if (!t) return [];
    return [
      { etiqueta: 'Sitio web', url: enlaceExterno(t.sitioWebTaller) },
      { etiqueta: 'Instagram', url: enlaceExterno(t.instagramTaller) },
      { etiqueta: 'Facebook', url: enlaceExterno(t.facebookTaller) },
      { etiqueta: 'Otro enlace', url: enlaceExterno(t.otroEnlaceTaller) },
    ].filter(e => e.url);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('tallerId');
    if (!id) { this.cargando.set(false); return; }
    this.talleres.consultarPublico(id).subscribe({
      next: taller => { this.taller.set(taller); this.cargando.set(false); },
      error: () => { this.taller.set(null); this.cargando.set(false); },
    });
  }

  volver(): void {
    void this.router.navigateByUrl('/ecosistema/luteria');
  }

  modalidad(taller: TallerPublico): string {
    return etiquetaDeModalidad(taller.modalidad);
  }

  territorio(taller: TallerPublico): string {
    if (taller.nivelCobertura === 'nacional') return 'Todo el país';
    return [taller.nombreMunicipio, taller.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }
}
