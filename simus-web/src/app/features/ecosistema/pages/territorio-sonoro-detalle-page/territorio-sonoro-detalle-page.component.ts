import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompactHeroComponent } from '../../../../shared/components/ui/compact-hero/compact-hero.component';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import { TerritorioSonoroConceptual, TerritoriosSonorosService } from '../../../../core/services/territorios-sonoros.service';
@Component({ selector: 'app-territorio-sonoro-detalle-page', standalone: true, imports: [TextoWebPipe, RouterLink, CompactHeroComponent, EsqueletoComponent], templateUrl: './territorio-sonoro-detalle-page.component.html' })
export class TerritorioSonoroDetallePageComponent implements OnInit { private readonly ruta=inject(ActivatedRoute); private readonly servicio=inject(TerritoriosSonorosService); private readonly router=inject(Router); readonly noEncontrada=signal(false); readonly ficha=signal<TerritorioSonoroConceptual|null>(null); ngOnInit():void { this.servicio.consultar(this.ruta.snapshot.paramMap.get('slug') || '').subscribe({next:f=>this.ficha.set(f),error:()=>this.noEncontrada.set(true)}); } volver():void { this.router.navigateByUrl('/ecosistema/territorios-sonoros'); } }
