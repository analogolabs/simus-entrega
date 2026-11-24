import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecursoNoEncontradoComponent } from '../../../../shared/components/ui/recurso-no-encontrado/recurso-no-encontrado.component';
import { CompactHeroComponent } from '../../../../shared/components/ui/compact-hero/compact-hero.component';
import { OrganizacionPublica, PerfilPublicoService } from '../../../../core/services/perfil-publico.service';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * La ficha pública mínima de una organización activa, en /ecosistema/organizaciones/:id.
 *
 * Existe para enlazar los perfiles públicos de quienes participan en ella. Solo muestra lo que la
 * organización ya declara como público —nombre, descripción, foto y municipio— y nunca su correo,
 * teléfono, dirección ni documento.
 */
@Component({
  selector: 'app-organizacion-publica-page',
  standalone: true,
  imports: [TextoWebPipe, EsqueletoComponent, RouterLink, CompactHeroComponent, RecursoNoEncontradoComponent],
  templateUrl: './organizacion-publica-page.component.html',
})
export class OrganizacionPublicaPageComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(PerfilPublicoService);

  readonly organizacion = signal<OrganizacionPublica | null>(null);
  readonly estado = signal<'cargando' | 'listo' | 'no-disponible'>('cargando');

  ngOnInit(): void {
    this.servicio.consultarOrganizacion(this.ruta.snapshot.paramMap.get('id') ?? '').subscribe({
      next: organizacion => { this.organizacion.set(organizacion); this.estado.set('listo'); },
      error: () => this.estado.set('no-disponible'),
    });
  }

  iniciales(nombre: string): string {
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join('').toUpperCase();
  }

  volver(): void {
    this.router.navigateByUrl('/ecosistema');
  }
}
