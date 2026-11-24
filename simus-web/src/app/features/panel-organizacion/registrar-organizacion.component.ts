import { traducirErrorDelServidor } from '../../core/formularios/traductor-de-errores';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AdminService } from '../../core/services/admin.service';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { BotonComponent } from '../../shared/components/ui/boton/boton.component';
import { RUTAS_DE_LA_CUENTA, rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { nombrePropio } from '../../shared/texto/nombre-propio';

import { FiltroDesplegableComponent } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
interface UbicacionDeSede { departmentCode: string; departmentName: string; municipalityCode: string; municipalityName: string; }

/**
 * «Registrar una organización», en /gestion/cuenta/organizaciones/registrar.
 *
 * Una cuenta puede administrar varias organizaciones (docs/desarrollo/19-cuentas-y-organizaciones.md). La cuenta ya existe y ya tiene
 * persona responsable, así que aquí solo se piden los datos de la organización y su sede: los
 * mismos del paso 2 de `/registro`. Quien la crea queda como administradora.
 *
 * Al guardar, la sesión se vuelve a pedir —es la que trae la lista de organizaciones— y se abre el
 * panel de la organización nueva, en su propia dirección, con la confirmación de que ahora la
 * administra y los siguientes pasos (`?registrada=1`). Vive en el espacio de la persona y no bajo la
 * cabecera de otra organización, que hacía parecer el formulario parte de ella.
 *
 * <b>EL CORREO DE CONTACTO NACE VACÍO.</b> Se proponía el correo personal de la cuenta y, si
 * ya lo usaba otra organización, el servidor lo rechazaba: el error era evitable.
 */
import { CampoDeNitComponent } from '../../shared/components/ui/campo-de-nit/campo-de-nit.component';
import { mensajeDeNit } from '../../core/formularios/nit';

@Component({
  selector: 'app-registrar-organizacion',
  standalone: true,
  imports: [OpcionesDesdePipe, FiltroDesplegableComponent, FormsModule, RouterLink, BotonComponent, CampoDeNitComponent],
  templateUrl: './registrar-organizacion.component.html',
})
export class RegistrarOrganizacionComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly sesionExterna = inject(ExternalSessionService);
  private readonly router = inject(Router);

  readonly ubicaciones = signal<UbicacionDeSede[]>([]);
  readonly errores = signal<Record<string, string>>({});
  readonly error = signal('');
  readonly guardando = signal(false);
  readonly departamento = signal('');
  /** Sin organizaciones todavía, «Cancelar» no tiene panel al que volver. */
  readonly tieneOrganizaciones = computed(() => this.sesionExterna.organizaciones().length > 0);
  readonly rutas = RUTAS_DE_LA_CUENTA;

  readonly departamentos = computed(() => Array.from(
    new Map(this.ubicaciones().map(item => [item.departmentCode, item.departmentName])).entries(),
  ).map(([codigo, nombre]) => ({ codigo, nombre: nombrePropio(nombre) })));
  readonly municipios = computed(() => this.ubicaciones().filter(item => item.departmentCode === this.departamento()));

  formulario = { name: '', identificationNumber: '', contactEmail: '', headquartersMunicipalityCode: '' };

  ngOnInit(): void {
    this.adminService.cargarDivipolaPublica().subscribe({
      next: filas => this.ubicaciones.set(filas as unknown as UbicacionDeSede[]),
      error: () => this.error.set('No fue posible cargar los departamentos y municipios. Recarga la página.'),
    });
  }

  elegirDepartamento(codigo: string): void {
    this.departamento.set(codigo);
    this.formulario.headquartersMunicipalityCode = '';
    this.limpiar('headquartersDepartmentCode');
  }

  limpiar(campo: string): void {
    this.errores.update(actuales => { const siguiente = { ...actuales }; delete siguiente[campo]; return siguiente; });
  }

  registrar(): void {
    this.error.set('');
    const errores: Record<string, string> = {};
    if (!this.formulario.name.trim()) errores['name'] = 'Escribe el nombre de la organización.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formulario.contactEmail.trim())) errores['contactEmail'] = 'Ingresa un correo de contacto válido.';
    const nit = mensajeDeNit(this.formulario.identificationNumber);
    if (nit) errores['identificationNumber'] = nit;
    if (!this.departamento()) errores['headquartersDepartmentCode'] = 'Elige el departamento de la sede.';
    if (!this.formulario.headquartersMunicipalityCode) errores['headquartersMunicipalityCode'] = 'Elige el municipio de la sede.';
    this.errores.set(errores);
    if (Object.keys(errores).length) {
      document.getElementById(`nueva-org-${Object.keys(errores)[0]}`)?.focus();
      return;
    }

    this.guardando.set(true);
    this.adminService.crearOrganizacionExterna({
      name: this.formulario.name.trim(),
      identificationNumber: this.formulario.identificationNumber.trim() || null,
      contactEmail: this.formulario.contactEmail.trim(),
      headquartersDepartmentCode: this.departamento(),
      headquartersMunicipalityCode: this.formulario.headquartersMunicipalityCode,
    }).pipe(
      switchMap((creada: { id: string }) => this.sesionExterna.refrescar().pipe(map(() => creada))),
    ).subscribe({
      next: creada => {
        this.guardando.set(false);
        void this.router.navigate(rutaDelPanel(String(creada.id), 'resumen'), { queryParams: { registrada: '1' } });
      },
      error: fallo => this.fallar(fallo),
    });
  }

  private fallar(fallo: unknown): void {
    this.guardando.set(false);
    // EL ERROR DE CAMPO VA JUNTO AL CAMPO, con el traductor único: arriba se leía
    // «contactEmail: Ya existe…», con el nombre técnico del dato. Lo que no tiene campo en pantalla
    // se dice con su rótulo.
    const traducido = traducirErrorDelServidor(fallo, {
      camposConLugar: ['name', 'identificationNumber', 'contactEmail', 'headquartersDepartmentCode', 'headquartersMunicipalityCode'],
      alternativa: 'No fue posible registrar la organización. Inténtalo de nuevo.',
    });
    this.errores.set(traducido.campos);
    this.error.set(traducido.general);
  }
}
