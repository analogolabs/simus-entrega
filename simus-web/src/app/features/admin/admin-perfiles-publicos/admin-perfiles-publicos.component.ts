import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PerfilEnModeracion, PerfilPublicoService } from '../../../core/services/perfil-publico.service';
import { BuscadorDeListaComponent } from '../../../shared/components/ui/buscador/buscador-de-lista.component';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';

import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { EsqueletoComponent } from '../../../shared/components/ui/esqueleto/esqueleto.component';
/**
 * Moderación de perfiles públicos de personas, dentro de «Organizaciones» en la consola.
 *
 * <b>OCULTA, NO EDITA.</b> La consola puede ocultar un perfil con un motivo —que la persona ve en
 * su cuenta— y restablecerlo; no cambia nada de lo que la persona escribió. Cada acción queda en
 * la bitácora.
 */
@Component({
  selector: 'app-admin-perfiles-publicos',
  standalone: true,
  imports: [EsqueletoComponent, BotonNativoDirective, BuscadorDeListaComponent, FechaPipe, FormsModule],
  templateUrl: './admin-perfiles-publicos.component.html',
})
export class AdminPerfilesPublicosComponent implements OnInit {
  private readonly servicio = inject(PerfilPublicoService);

  readonly perfiles = signal<PerfilEnModeracion[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  /** La clave del perfil que se está ocultando, para abrir su campo de motivo. */
  readonly ocultando = signal<string | null>(null);
  readonly errorMotivo = signal('');
  busqueda = '';
  motivo = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarEnConsola(this.busqueda).subscribe({
      next: lista => { this.cargando.set(false); this.perfiles.set(lista ?? []); },
      error: fallo => { this.cargando.set(false); this.error.set(fallo?.message || 'No fue posible cargar los perfiles públicos.'); },
    });
  }

  abrirOcultar(clave: string): void {
    this.ocultando.set(clave);
    this.motivo = '';
    this.errorMotivo.set('');
    setTimeout(() => document.getElementById(`motivo-${clave}`)?.focus());
  }

  cancelar(): void {
    this.ocultando.set(null);
  }

  confirmarOcultar(clave: string): void {
    if (!this.motivo.trim()) {
      this.errorMotivo.set('Escribe el motivo: la persona lo verá en su cuenta.');
      document.getElementById(`motivo-${clave}`)?.focus();
      return;
    }
    this.servicio.ocultarPorModeracion(clave, this.motivo.trim()).subscribe({
      next: () => { this.ocultando.set(null); this.aviso.set('Perfil ocultado. Quedó registrado en la bitácora.'); this.cargar(); },
      error: fallo => this.errorMotivo.set(fallo?.message || 'No fue posible ocultar el perfil.'),
    });
  }

  restablecer(clave: string): void {
    this.servicio.restablecer(clave).subscribe({
      next: () => { this.aviso.set('Perfil restablecido. Se verá de nuevo si su titular mantiene la autorización.'); this.cargar(); },
      error: fallo => this.error.set(fallo?.message || 'No fue posible restablecer el perfil.'),
    });
  }
}
