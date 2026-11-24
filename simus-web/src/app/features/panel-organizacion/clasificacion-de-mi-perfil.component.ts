import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { AdminService } from '../../core/services/admin.service';
import { CambiosDeClasificacion, DirectorioDePersonasService, MiClasificacion } from '../../core/services/directorio-de-personas.service';
import { UbicacionDivipola } from '../../core/territorio/ubicacion-divipola';
import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CATEGORIAS_VACIAS, SelectorDeCategoriasComponent } from '../../shared/components/ui/selector-de-categorias/selector-de-categorias.component';

/**
 * «Cómo te encuentran»: las categorías del perfil público para el directorio de personas (DIR, docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).
 *
 * Usa la misma pieza que el registro (`app-selector-de-categorias`). Se guarda aparte del resto del perfil, con su propio
 * botón, y solo se indexa si el perfil está publicado. Sin categorías, el perfil queda «pendiente de completar».
 */
@Component({
  selector: 'app-clasificacion-de-mi-perfil',
  standalone: true,
  imports: [BotonNativoDirective, SelectorDeCategoriasComponent],
  template: `
    <section class="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="clasificacion-titulo" data-clasificacion-editor>
      <h2 id="clasificacion-titulo" class="text-slate-700">Cómo te encuentran</h2>
      <p class="mt-2 text-sm text-slate-600">Elige lo que haces y los servicios que ofreces: así apareces cuando alguien busca en el directorio de personas. Solo se usan si tu perfil está publicado.</p>
      @if (actual(); as c) {
        @if (c.pendiente) { <p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-pendiente>Pendiente de completar: aún no elegiste roles ni servicios.</p> }
      }
      <div class="mt-4"><app-selector-de-categorias prefijo="clasif" [departamentos]="departamentos()" [(valor)]="elegido" /></div>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" appBoton="principal" (click)="guardar()" [disabled]="guardando() || !actual()?.existe" data-guardar-clasificacion>{{ guardando() ? 'Guardando…' : 'Guardar categorías' }}</button>
        @if (actual() && !actual()!.existe) { <p class="text-sm text-slate-600">Guarda primero tu perfil para poder elegir categorías.</p> }
        @if (aviso()) { <p role="status" class="text-sm text-slate-700" data-aviso-clasificacion>{{ aviso() }}</p> }
      </div>
      @if (error()) { <p role="alert" class="mt-3 text-sm text-red-700">{{ error() }}</p> }
    </section>
  `,
})
export class ClasificacionDeMiPerfilComponent implements OnInit {
  private readonly servicio = inject(DirectorioDePersonasService);
  private readonly admin = inject(AdminService);

  readonly actual = signal<MiClasificacion | null>(null);
  readonly ubicaciones = signal<UbicacionDivipola[]>([]);
  readonly elegido = signal<CambiosDeClasificacion>(CATEGORIAS_VACIAS);
  readonly guardando = signal(false);
  readonly aviso = signal('');
  readonly error = signal('');

  readonly departamentos = computed(() => {
    const vistos = new Map<string, string>();
    for (const f of this.ubicaciones()) vistos.set(f.departmentCode, f.departmentName);
    return [...vistos].map(([codigo, nombre]) => ({ codigo, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  ngOnInit(): void {
    this.admin.cargarDivipolaPublica().subscribe({ next: f => this.ubicaciones.set(f ?? []), error: () => undefined });
    this.servicio.mia().subscribe({ next: c => this.aplicar(c), error: () => undefined });
  }

  private aplicar(c: MiClasificacion): void {
    this.actual.set(c);
    this.elegido.set({ roles: c.roles, servicios: c.servicios, instrumentos: c.instrumentos, codigosDeDepartamento: c.codigosDeDepartamento });
  }

  guardar(): void {
    this.guardando.set(true); this.aviso.set(''); this.error.set('');
    this.servicio.guardar(this.elegido()).subscribe({
      next: c => { this.aplicar(c); this.guardando.set(false); this.aviso.set('Categorías guardadas.'); },
      error: () => { this.guardando.set(false); this.error.set('No fue posible guardar tus categorías.'); },
    });
  }
}
