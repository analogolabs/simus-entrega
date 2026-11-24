import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { EtiquetasDeClasificacionComponent } from '../../../../shared/components/ui/etiquetas-de-clasificacion/etiquetas-de-clasificacion.component';
import { AvisoDeRegistroHistoricoComponent } from '../../../../shared/components/ui/aviso-de-registro-historico/aviso-de-registro-historico.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompactHeroComponent } from '../../../../shared/components/ui/compact-hero/compact-hero.component';
import { RecursoNoEncontradoComponent } from '../../../../shared/components/ui/recurso-no-encontrado/recurso-no-encontrado.component';
import { EspacioPublico, EspaciosService, etiquetaDeAmbiente } from '../../../../core/services/espacios.service';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';
import { enlaceExterno } from '../../../../shared/utils/enlace-externo';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * La ficha pública de un espacio para música en vivo, en /ecosistema/espacios/:espacioId.
 *
 * <b>ES LA LISTA EXPRESA DE LO QUE EL PORTAL PUEDE ENSEÑAR</b> (`EspacioPublicoDto`). Si el espacio es de
 * un responsable independiente, no se enseña su nombre: se publica el espacio, con el contacto que escribió
 * para él. Si es de una organización, se nombra y, solo si tiene ficha pública, se enlaza.
 */
@Component({
  selector: 'app-espacio-publico-detalle-page',
  standalone: true,
  imports: [TextoWebPipe, AvisoDeRegistroHistoricoComponent, EtiquetasDeClasificacionComponent, RouterLink, NombrePropioPipe, CompactHeroComponent, RecursoNoEncontradoComponent, EsqueletoComponent],
  template: `
    <section class="min-h-screen bg-hueso pb-24 font-nunito text-titulo">
      @if (cargando()) {
        <div class="mx-auto max-w-7xl px-6 pt-28"><app-esqueleto variante="ficha" [etiqueta]="'esp_ficha_cargando' | textoWeb" /></div>
      } @else if (!espacio()) {
        <app-recurso-no-encontrado
          idBase="espacio"
          [titulo]="'ficha_no_disponible' | textoWeb"
          causa="Puede que la dirección esté mal escrita o que el espacio no esté publicado para consulta pública."
          etiquetaDeLista="Ver los espacios para música en vivo"
          rutaDeLista="/ecosistema/espacios" />
      } @else if (espacio(); as ficha) {
        <app-compact-hero [backLabel]="'esp_ficha_miga' | textoWeb" [current]="ficha.nombre" [title]="ficha.nombre" [subtitle]="territorio(ficha)" (regresoSolicitado)="volver()"></app-compact-hero>

        <div class="mx-auto max-w-[86rem] px-6 pt-8 lg:px-8">
          <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div class="space-y-6">
              <article class="rounded-xl border border-filete bg-white p-6">
                @if (ficha.fotoUrl) {
                  <img [src]="ficha.fotoUrl" [alt]="ficha.fotoAlt || 'Foto de l espacio ' + ficha.nombre" width="800" height="320" class="mb-4 max-h-80 w-full rounded-lg object-cover" data-foto-del-proceso />
                }
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'esp_ficha_sobre' | textoWeb }}</h2>
                <p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{{ ficha.descripcion || 'Este espacio aún no tiene una descripción.' }}</p>
                @if (ficha.horarioYProgramacion) {
                  <h3 class="mt-6 font-alternate text-xs font-bold text-tinta-media">{{ 'esp_ficha_horario' | textoWeb }}</h3>
                  <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{{ ficha.horarioYProgramacion }}</p>
                }
              </article>

              <article class="rounded-xl border border-filete bg-white p-6">
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'esp_ficha_lugar' | textoWeb }}</h2>
                <ul class="mt-4 flex flex-wrap gap-2" aria-label="Tipos de espacio">
                  @for (f of ficha.tipos; track f.id) { <li class="rounded-full border border-filete px-3 py-1 text-sm">{{ f.nombre }}</li> }
                </ul>
                @if (ficha.equipamiento.length) {
                  <h3 class="mt-6 font-alternate text-xs font-bold text-tinta-media">{{ 'esp_ficha_equipamiento' | textoWeb }}</h3>
                  <ul class="mt-2 flex flex-wrap gap-2" aria-label="Equipamiento del espacio">
                    @for (s of ficha.equipamiento; track s.id) { <li class="rounded-full border border-filete px-3 py-1 text-sm">{{ s.nombre }}</li> }
                  </ul>
                }
                @if (ficha.practicasMusicales.length) {
                  <h3 class="mt-6 font-alternate text-xs font-bold text-tinta-media">{{ 'ficha_practicas' | textoWeb }}</h3>
                  <div class="mt-2 flex flex-wrap gap-2" aria-label="Prácticas musicales"><app-etiquetas-de-clasificacion modo="enlazar" ruta="/ecosistema/espacios" [practicas]="ficha.practicasMusicales" /></div>
                }
              </article>
            </div>

            <aside class="space-y-6">
              @if (ficha.esRegistroHistorico) {
                <app-aviso-de-registro-historico tipo="este espacio" modulo="espacios" [id]="'' + ficha.id" [nombre]="ficha.nombre" />
              }
              <article class="rounded-xl border border-filete bg-white p-6">
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'esp_ficha_datos' | textoWeb }}</h2>
                <dl class="mt-4 space-y-3 text-sm">
                  <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'esp_ficha_ambiente' | textoWeb }}</dt><dd class="mt-0.5">{{ ambiente(ficha) }}</dd></div>
                  <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'ficha_donde' | textoWeb }}</dt><dd class="mt-0.5">{{ territorio(ficha) | nombrePropio }}@if (ficha.lugarEspecifico) { · {{ ficha.lugarEspecifico }} }</dd></div>
                  @if (ficha.aforoMaximo) { <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'esp_ficha_aforo' | textoWeb }}</dt><dd class="mt-0.5">{{ ficha.aforoMaximo }} personas</dd></div> }
                  <div><dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'esp_ficha_accesibilidad' | textoWeb }}</dt><dd class="mt-0.5">{{ ficha.esAccesible === null ? 'No indica accesibilidad' : ficha.esAccesible ? 'Accesible para personas con movilidad reducida' : 'No es accesible para personas con movilidad reducida' }}</dd></div>
                  <div>
                    <dt class="font-alternate text-xs font-bold text-tinta-media">{{ 'ficha_responsable' | textoWeb }}</dt>
                    <dd class="mt-0.5">
                      @if (ficha.esIndependiente) { Responsable independiente }
                      @else if (ficha.organizacionPublicaId) { <a [routerLink]="['/ecosistema/organizaciones', ficha.organizacionPublicaId]" class="text-morado hover:underline">{{ ficha.organizacionNombre }}</a> }
                      @else { {{ ficha.organizacionNombre }} }
                    </dd>
                  </div>
                </dl>
              </article>

              <article class="rounded-xl border border-filete bg-white p-6">
                <h2 class="font-alternate text-sm font-bold text-titulo">{{ 'ficha_contacto' | textoWeb }}</h2>
                <ul class="mt-4 space-y-2 text-sm" aria-label="Formas de contacto">
                  @if (ficha.correoEspacio) { <li><a [href]="'mailto:' + ficha.correoEspacio" class="text-morado hover:underline">{{ ficha.correoEspacio }}</a></li> }
                  @if (ficha.telefonoEspacio) { <li>{{ ficha.telefonoEspacio }}</li> }
                  @for (enlace of enlaces(); track enlace.etiqueta) {
                    <li><a [href]="enlace.url" target="_blank" rel="noopener noreferrer" class="text-morado hover:underline">{{ enlace.etiqueta }}</a></li>
                  }
                  @if (!ficha.correoEspacio && !ficha.telefonoEspacio && !enlaces().length) { <li class="text-slate-500">{{ 'esp_ficha_sin_contacto' | textoWeb }}</li> }
                </ul>
              </article>
            </aside>
          </div>
        </div>
      }
    </section>
  `,
})
export class EspacioPublicoDetallePageComponent implements OnInit {
  private readonly espacios = inject(EspaciosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly espacio = signal<EspacioPublico | null>(null);
  readonly cargando = signal(true);

  /** Los enlaces con su rótulo, ya normalizados. */
  readonly enlaces = computed(() => {
    const t = this.espacio();
    if (!t) return [];
    return [
      { etiqueta: 'Sitio web', url: enlaceExterno(t.sitioWebEspacio) },
      { etiqueta: 'Instagram', url: enlaceExterno(t.instagramEspacio) },
      { etiqueta: 'Facebook', url: enlaceExterno(t.facebookEspacio) },
      { etiqueta: 'Otro enlace', url: enlaceExterno(t.otroEnlaceEspacio) },
    ].filter(e => e.url);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('espacioId');
    if (!id) { this.cargando.set(false); return; }
    this.espacios.consultarPublico(id).subscribe({
      next: espacio => { this.espacio.set(espacio); this.cargando.set(false); },
      error: () => { this.espacio.set(null); this.cargando.set(false); },
    });
  }

  volver(): void {
    void this.router.navigateByUrl('/ecosistema/espacios');
  }

  ambiente(espacio: EspacioPublico): string {
    return etiquetaDeAmbiente(espacio.ambiente);
  }

  territorio(espacio: EspacioPublico): string {
    if (espacio.nivelCobertura === 'nacional') return 'Todo el país';
    return [espacio.nombreMunicipio, espacio.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }
}
