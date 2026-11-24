import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CompactHeroComponent } from '../../../../shared/components/ui/compact-hero/compact-hero.component';
import { TerritorioSonoroConceptual, TerritoriosSonorosService } from '../../../../core/services/territorios-sonoros.service';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';

@Component({ selector: 'app-territorios-sonoros-page', standalone: true, imports: [TextoWebPipe, NombrePropioPipe, RouterLink, CompactHeroComponent, EsqueletoComponent], templateUrl: './territorios-sonoros-page.component.html' })
export class TerritoriosSonorosPageComponent implements OnInit {
  private readonly servicio = inject(TerritoriosSonorosService); private readonly router = inject(Router);
  readonly territorios = signal<TerritorioSonoroConceptual[]>([]); readonly error = signal('');
  /** En `true` desde el valor inicial: el esqueleto ocupa el lugar de las tarjetas hasta que llegue la lista. */
  readonly cargando = signal(true);
  ngOnInit(): void { this.servicio.listar().subscribe({ next: datos => { this.territorios.set(datos); this.cargando.set(false); }, error: e => { this.error.set(e.message); this.cargando.set(false); } }); }
  volver(): void { this.router.navigateByUrl('/ecosistema'); }
}
