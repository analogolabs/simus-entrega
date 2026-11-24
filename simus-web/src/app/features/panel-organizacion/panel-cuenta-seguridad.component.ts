import { EncabezadoDePantallaComponent } from '../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { CambiosDePerfil, CuentaExternaApi } from './cuenta-externa.api';
import { TIPOS_DE_DOCUMENTO, normalizarTipoDeDocumento } from '../../core/formularios/tipos-de-documento';
import { mensajeDeTelefono } from '../../core/formularios/telefono';
import { traducirErrorDelServidor } from '../../core/formularios/traductor-de-errores';

import { AdminService } from '../../core/services/admin.service';
import { UbicacionDivipola } from '../../core/territorio/ubicacion-divipola';
import { SedeElegida, SelectorDeSedeComponent } from '../../shared/components/ui/selector-de-sede/selector-de-sede.component';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';
import { EstadoDeListaComponent } from '../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { BotonComponent, BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
/**
 * «Datos personales y seguridad», en /gestion/cuenta/seguridad: del espacio de la persona.
 *
 * <b>NUEVA EN EL REDISEÑO DEL 1 DE SEPTIEMBRE DE 2026.</b> No existía ninguna pantalla de cuenta
 * para la sesión externa. El correo de acceso ya lo trae la sesión -no hace falta pedirlo-, pero
 * «Cambiar contraseña» no tiene con qué conectar: no hay ningún endpoint de cambio de contraseña
 * autoservicio en toda la API externa. Desde el 5 de noviembre de 2026 sí lo hay: esta
 * pantalla edita los datos personales (`GET/PUT /externo/cuenta/perfil`) y cambia la contraseña
 * (`POST /externo/cuenta/contrasena`), que cierra las demás sesiones de la cuenta.
 *
 * <b>LAS AUTORIZACIONES DE DATOS YA NO VIVEN AQUI.</b> Contraseña y seguridad es una cosa; retirar lo que se autorizó es
 * otra, y tiene su pantalla en `/gestion/cuenta/autorizaciones` («Mis autorizaciones»). Antes decía lo siguiente, y sigue
 * siendo cierto de la pieza, no de su lugar:
 * <b>LAS AUTORIZACIONES DE DATOS son de la cuenta.</b> Lo que una persona
 * autorizó sobre SUS datos personales es de su cuenta, no de la organización que administra: si
 * mañana esa cuenta deja de administrarla, sus autorizaciones siguen siendo suyas. Esta pantalla ya
 * reúne lo que es de la cuenta —su correo, su clave, su sesión— y es donde alguien va a buscarlo.
 */
@Component({
  selector: 'app-panel-cuenta-seguridad',
  standalone: true,
  imports: [EncabezadoDePantallaComponent, CampoDeSeleccionComponent, BotonNativoDirective, BotonComponent, SelectorDeSedeComponent, EsqueletoComponent, EstadoDeListaComponent, CommonModule, FormsModule, RouterLink],
  templateUrl: './panel-cuenta-seguridad.component.html',
})
export class PanelCuentaSeguridadComponent implements OnInit {
  private readonly sesionExterna = inject(ExternalSessionService);
  private readonly router = inject(Router);
  private readonly cuentaApi = inject(CuentaExternaApi);
  private readonly adminService = inject(AdminService);

  /**
   * QUÉ SE VE. `datos` (datos personales) o `seguridad` (contraseña, autorizaciones y cierre de
   * sesión): salen de `data.vista` de la ruta. Sin ese dato —la pantalla de antes, usada en pruebas—
   * se ve todo.
   */
  readonly vista: 'datos' | 'seguridad' | 'todo' = (inject(ActivatedRoute, { optional: true })?.snapshot.data['vista'] as 'datos' | 'seguridad' | undefined) ?? 'todo';

  readonly sesion = this.sesionExterna.actual;
  readonly tiposDeDocumento = TIPOS_DE_DOCUMENTO;

  readonly erroresPerfil = signal<Record<string, string>>({});
  readonly avisoPerfil = signal('');
  readonly errorPerfil = signal('');
  readonly guardandoPerfil = signal(false);
  /** La forma del formulario aparece de inmediato; el vacío y el error solo cuando la carga terminó (decisión 117). */
  readonly cargandoPerfil = signal(true);
  readonly errorDeCarga = signal('');
  /** El catálogo territorial común (DIVIPOLA) para la residencia. Si falla, el resto de los datos sigue funcionando. */
  readonly ubicaciones = signal<UbicacionDivipola[]>([]);
  readonly canalesDeContacto = [{ codigo: 'correo', nombre: 'Correo electrónico' }, { codigo: 'telefono', nombre: 'Teléfono' }];
  perfil: CambiosDePerfil = {
    primerNombre: '', segundoNombre: null, primerApellido: '', segundoApellido: null,
    tipoDocumento: '', numeroDocumento: '', telefono: null,
    residenciaCodigoDepartamento: '', residenciaCodigoMunicipio: '', canalDeContactoPreferido: '',
  };

  readonly erroresClave = signal<Record<string, string>>({});
  readonly avisoClave = signal('');
  readonly guardandoClave = signal(false);
  clave = { actual: '', nueva: '', confirmacion: '' };

  ngOnInit(): void {
    this.cargarPerfil();
    this.adminService.cargarDivipolaPublica().subscribe({ next: filas => this.ubicaciones.set(filas ?? []), error: () => undefined });
  }

  /** Lee los datos de la cuenta; también es lo que hace «Reintentar». */
  cargarPerfil(): void {
    this.cargandoPerfil.set(true);
    this.errorDeCarga.set('');
    this.cuentaApi.obtenerPerfil().subscribe({
      next: perfil => {
        this.perfil = {
          primerNombre: perfil.primerNombre, segundoNombre: perfil.segundoNombre,
          primerApellido: perfil.primerApellido, segundoApellido: perfil.segundoApellido,
          tipoDocumento: normalizarTipoDeDocumento(perfil.tipoDocumento), numeroDocumento: perfil.numeroDocumento, telefono: perfil.telefono,
          residenciaCodigoDepartamento: perfil.residenciaCodigoDepartamento ?? '',
          residenciaCodigoMunicipio: perfil.residenciaCodigoMunicipio ?? '',
          canalDeContactoPreferido: perfil.canalDeContactoPreferido ?? '',
        };
        this.cargandoPerfil.set(false);
      },
      error: fallo => {
        this.errorDeCarga.set(fallo?.message || 'No fue posible cargar tus datos.');
        this.cargandoPerfil.set(false);
      },
    });
  }

  /** La residencia es una sola pareja departamento-municipio del catálogo; al cambiar el departamento se vacía el municipio. */
  elegirResidencia(sede: SedeElegida): void {
    this.perfil.residenciaCodigoDepartamento = sede.departamento;
    this.perfil.residenciaCodigoMunicipio = sede.municipio;
  }

  guardarPerfil(): void {
    this.avisoPerfil.set('');
    this.errorPerfil.set('');
    const errores: Record<string, string> = {};
    if (!this.perfil.primerNombre?.trim()) errores['primerNombre'] = 'Escribe el primer nombre.';
    if (!this.perfil.primerApellido?.trim()) errores['primerApellido'] = 'Escribe el primer apellido.';
    if (!this.perfil.tipoDocumento) errores['tipoDocumento'] = 'Elige el tipo de documento.';
    const digitos = (this.perfil.numeroDocumento ?? '').replace(/\D/g, '');
    if (digitos.length < 6 || digitos.length > 15) errores['numeroDocumento'] = 'Ingresa entre 6 y 15 dígitos.';
    const fallaTelefono = mensajeDeTelefono(this.perfil.telefono);
    if (fallaTelefono) errores['telefono'] = fallaTelefono;
    if (this.perfil.residenciaCodigoMunicipio && !this.perfil.residenciaCodigoDepartamento) errores['residenciaCodigoDepartamento'] = 'Elige el departamento de residencia.';
    if (this.perfil.canalDeContactoPreferido === 'telefono' && !this.perfil.telefono?.trim()) errores['canalDeContactoPreferido'] = 'Para preferir el teléfono, escribe tu número.';
    this.erroresPerfil.set(errores);
    if (Object.keys(errores).length) { this.enfocar(`perfil-${Object.keys(errores)[0]}`); return; }

    this.guardandoPerfil.set(true);
    this.cuentaApi.actualizarPerfil({
      ...this.perfil,
      residenciaCodigoDepartamento: this.perfil.residenciaCodigoDepartamento || null,
      residenciaCodigoMunicipio: this.perfil.residenciaCodigoMunicipio || null,
      canalDeContactoPreferido: this.perfil.canalDeContactoPreferido || null,
    }).subscribe({
      next: () => { this.guardandoPerfil.set(false); this.avisoPerfil.set('Tus datos quedaron guardados.'); },
      error: fallo => {
        this.guardandoPerfil.set(false);
        const traducido = traducirErrorDelServidor(fallo, {
          camposConLugar: ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido', 'tipoDocumento', 'numeroDocumento', 'telefono', 'residenciaCodigoDepartamento', 'residenciaCodigoMunicipio', 'canalDeContactoPreferido'],
          alternativa: 'No fue posible guardar tus datos.',
        });
        this.erroresPerfil.set(traducido.campos);
        this.errorPerfil.set(traducido.general);
        const primero = Object.keys(traducido.campos)[0];
        if (primero) this.enfocar(`perfil-${primero}`);
      },
    });
  }

  cambiarContrasena(): void {
    this.avisoClave.set('');
    const errores: Record<string, string> = {};
    if (!this.clave.actual) errores['actual'] = 'Escribe tu contraseña actual.';
    if (this.clave.nueva.length < 12) errores['nueva'] = 'La contraseña nueva debe tener al menos 12 caracteres.';
    if (this.clave.confirmacion !== this.clave.nueva) errores['confirmacion'] = 'Las contraseñas no coinciden.';
    this.erroresClave.set(errores);
    if (Object.keys(errores).length) { this.enfocar(`clave-${Object.keys(errores)[0]}`); return; }

    this.guardandoClave.set(true);
    this.cuentaApi.cambiarContrasena(this.clave.actual, this.clave.nueva).subscribe({
      next: () => {
        this.guardandoClave.set(false);
        this.clave = { actual: '', nueva: '', confirmacion: '' };
        this.avisoClave.set('Contraseña cambiada. Las demás sesiones abiertas con tu cuenta se cerraron.');
      },
      error: fallo => {
        this.guardandoClave.set(false);
        const traducido = traducirErrorDelServidor(fallo, {
          camposConLugar: ['actual', 'nueva', 'confirmacion'],
          alternativa: 'No fue posible cambiar la contraseña.',
        });
        this.erroresClave.set(traducido.hayCampos ? traducido.campos : { nueva: traducido.general });
      },
    });
  }

  private enfocar(id: string): void {
    setTimeout(() => document.getElementById(id)?.focus());
  }

  iniciales(): string {
    return (this.sesion()?.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(parte => parte[0])
      .join('')
      .toUpperCase() || 'US';
  }

  cerrarSesion(): void {
    this.sesionExterna.salir().subscribe(() => this.router.navigate(['/']));
  }
}
