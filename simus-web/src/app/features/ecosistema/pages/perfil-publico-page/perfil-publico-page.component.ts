import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecursoNoEncontradoComponent } from '../../../../shared/components/ui/recurso-no-encontrado/recurso-no-encontrado.component';
import { CompactHeroComponent } from '../../../../shared/components/ui/compact-hero/compact-hero.component';
import { PerfilPublico, PerfilPublicoService } from '../../../../core/services/perfil-publico.service';
import { IconoDeEnlaceComponent } from '../../../../shared/components/ui/icono-de-enlace/icono-de-enlace.component';
import { detectarRed, redDe } from '../../../../core/formularios/redes-del-perfil';
import { etiquetaDeTipoDePortafolio } from '../../../../core/formularios/portafolio-del-perfil';
import { consultaRecordadaDelDirectorio } from '../../../../core/services/directorio-de-personas.service';
import { PerfilesSimilaresComponent } from '../../components/perfiles-similares.component';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * El perfil público de una persona, en /ecosistema/personas/:clave.
 *
 * <b>OCULTO E INEXISTENTE SE VEN IGUAL.</b> El servidor responde 404 en los dos casos y esta página
 * dice lo mismo en los dos: no confirma que haya una cuenta detrás de la dirección.
 */
@Component({
  selector: 'app-perfil-publico-page',
  standalone: true,
  imports: [TextoWebPipe, PerfilesSimilaresComponent, EsqueletoComponent, IconoDeEnlaceComponent, RouterLink, CompactHeroComponent, RecursoNoEncontradoComponent],
  templateUrl: './perfil-publico-page.component.html',
})
export class PerfilPublicoPageComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(PerfilPublicoService);
  private readonly titulo = inject(Title);
  private readonly destruccion = inject(DestroyRef);

  readonly perfil = signal<PerfilPublico | null>(null);
  readonly estado = signal<'cargando' | 'listo' | 'no-disponible'>('cargando');

  /**
   * LA FICHA REACCIONA A LA CLAVE, no la lee una vez. Angular reutiliza el componente cuando solo cambia el parámetro de
   * la ruta (de una persona a otra, por «Perfiles similares»): leer `snapshot` en `ngOnInit` dejaba en pantalla a la
   * persona anterior aunque la dirección ya fuera otra. Cada cambio vuelve a «cargando», cancela la consulta en vuelo
   * (`switchMap`), actualiza el título de la pestaña y sube al inicio de la ficha.
   */
  ngOnInit(): void {
    this.ruta.paramMap.pipe(
      map(parametros => parametros.get('clave') ?? ''),
      tap(() => { this.estado.set('cargando'); this.perfil.set(null); }),
      switchMap(clave => this.servicio.consultar(clave).pipe(
        map(perfil => ({ perfil })),
        catchError(() => of({ perfil: null })))),
      takeUntilDestroyed(this.destruccion),
    ).subscribe(({ perfil }) => {
      this.perfil.set(perfil);
      this.estado.set(perfil ? 'listo' : 'no-disponible');
      this.titulo.setTitle(perfil ? `${perfil.nombreVisible} · Directorio de agentes y actores · SIMUS` : 'Perfil no disponible · SIMUS');
      if (perfil && typeof window !== 'undefined') window.scrollTo({ top: 0 });
    });
  }

  iniciales(nombre: string): string {
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase();
  }

  lugar(municipio: string, departamento: string | null): string {
    return departamento && departamento !== municipio ? `${municipio}, ${departamento}` : municipio;
  }

  /** El nombre de la red del enlace, o su dominio si es una página cualquiera. */
  rotuloDeRed(enlace: string, etiqueta?: string | null): string {
    const red = detectarRed(enlace);
    return red === 'otro' ? (etiqueta?.trim() || this.dominio(enlace)) : redDe(red).rotulo;
  }

  iconoDeRed(enlace: string): 'sitioWeb' | 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'x' | 'tiktok' | 'spotify' | 'soundcloud' | 'bandcamp' {
    const red = detectarRed(enlace);
    return red === 'otro' ? 'sitioWeb' : red;
  }

  etiquetaDeClase(tipo: string): string {
    return etiquetaDeTipoDePortafolio(tipo);
  }

  /** El texto del enlace: el dominio, sin protocolo, que es lo que una persona reconoce. */
  dominio(enlace: string): string {
    try { return new URL(enlace).host.replace(/^www\./, ''); } catch { return enlace; }
  }

  /**
   * Vuelve al directorio de agentes y actores CON la consulta que traía (filtros, página y vista). La consulta se guarda
   * al cambiar y no se deduce del historial: tras recorrer varias personas por «Perfiles similares», un paso atrás
   * llevaría a la persona anterior y no al directorio.
   */
  volver(): void {
    const consulta = consultaRecordadaDelDirectorio();
    void this.router.navigateByUrl('/ecosistema/personas' + (consulta ? `?${consulta}` : ''));
  }
}
