import { TIPOS_DE_DOCUMENTO } from '../../../core/formularios/tipos-de-documento';
import { esCorreoValido, mensajeDeTelefono } from '../../../core/formularios/telefono';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { CatalogService, TerritorioConCodigo } from '../../../core/services/catalog.service';
import {
  AltaAdministrativaService,
  CoincidenciaDeAlta,
} from '../../../core/services/alta-administrativa.service';
import { PasoDelIndicador } from '../../../shared/components/ui/indicador-de-pasos/indicador-de-pasos.component';
import { AsistenteDeAltaComponent } from '../../../shared/components/ui/asistente-de-alta/asistente-de-alta.component';
import { etiquetaDeEstado } from '../domain/admin-config';

import { CampoDeSeleccionComponent } from '../../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
/**
 * Registrar una organización desde el Panel de Gestión Administrativa.
 *
 * <b>QUÉ FALTABA.</b> Una organización solo podía entrar registrándose a sí misma. Eso deja fuera
 * todo lo que el Programa conoce y nadie ha reclamado, y obligaba a esperar a que alguien
 * apareciera para poder escribirlo.
 *
 * <b>NO PIDE CONTRASEÑA Y ES A PROPÓSITO.</b> El alta externa crea la organización y la cuenta de
 * quien la administrará, porque quien registra es esa persona. Aquí se registra una organización
 * que todavía <b>no tiene cuenta</b>: se deja su ficha y quién responde por ella, y la
 * administración llega cuando la organización la reclame por el circuito que ya existe.
 *
 * <b>LAS COINCIDENCIAS SE OFRECEN, NO BLOQUEAN.</b> Dos fundaciones pueden llamarse parecido, y
 * bloquear por nombre produciría organizaciones imposibles de registrar.
 */

interface FormularioDeOrganizacion {
  nombre: string;
  identificacion: string;
  correoContacto: string;
  codigoDepartamentoSede: string;
  codigoMunicipioSede: string;
  responsableNombre: string;
  responsableTipoDocumento: string;
  responsableNumeroDocumento: string;
  responsableCorreo: string;
  responsableTelefono: string;
  responsableAutorizacionDatos: boolean;
}

export const PASOS_DE_LA_ORGANIZACION: readonly PasoDelIndicador[] = [
  { id: 1, titulo: 'Identidad' },
  { id: 2, titulo: 'Sede' },
  { id: 3, titulo: 'Responsable' },
  { id: 4, titulo: 'Revisión' },
];

const VACIO: FormularioDeOrganizacion = {
  nombre: '', identificacion: '', correoContacto: '',
  codigoDepartamentoSede: '', codigoMunicipioSede: '',
  responsableNombre: '', responsableTipoDocumento: 'cc', responsableNumeroDocumento: '',
  responsableCorreo: '', responsableTelefono: '', responsableAutorizacionDatos: false,
};
import { CampoDeNitComponent } from '../../../shared/components/ui/campo-de-nit/campo-de-nit.component';
import { mensajeDeNit } from '../../../core/formularios/nit';

@Component({
  selector: 'app-admin-alta-organizacion',
  standalone: true,
  imports: [OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, CommonModule, FormsModule, AsistenteDeAltaComponent, CampoDeNitComponent],
  templateUrl: './admin-alta-organizacion.component.html',
})
export class AdminAltaOrganizacionComponent {
  /** El estado con su nombre, nunca con su código. Ver `etiquetaDeEstado`. */
  readonly etiquetaDeEstado = etiquetaDeEstado;

  private readonly api = inject(AltaAdministrativaService);
  private readonly catalogo = inject(CatalogService);

  /** Se avisa con el identificador para que quien abrió esto pueda continuar con él. */
  @Output() registrada = new EventEmitter<{ id: string; nombre: string }>();
  @Output() cancelado = new EventEmitter<void>();

  readonly pasos = PASOS_DE_LA_ORGANIZACION;
  readonly paso = signal(1);
  readonly formulario = signal<FormularioDeOrganizacion>({ ...VACIO });
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errores = signal<Record<string, string[]>>({});
  readonly coincidencias = signal<CoincidenciaDeAlta[]>([]);
  readonly territorios = signal<TerritorioConCodigo[]>([]);

  /**
   * Los tipos de documento: LA MISMA LISTA que el registro, «Cuenta y seguridad» y el servidor
   *. Esta pantalla tenía la suya, con un «NIT» que el servidor rechaza como documento
   * de una persona y sin las siete restantes.
   */
  readonly tiposDeDocumento = TIPOS_DE_DOCUMENTO.map(tipo => ({ codigo: tipo.codigo, etiqueta: tipo.nombre }));

  readonly municipiosDeLaSede = computed(() => {
    const codigo = this.formulario().codigoDepartamentoSede;
    if (!codigo) { return []; }
    return this.territorios().find(t => t.codigo === codigo)?.municipios ?? [];
  });

  /** Lo que falta para poder registrar, de todos los pasos. */
  readonly loQueFalta = computed(() => Object.values(this.loQueFaltaPorPaso()).flat());

  /**
   * Lo que falta POR PASO: el armazón pinta «incompleto» el paso visitado con algo pendiente
   * y enlaza desde la revisión. El correo y el teléfono se comprueban con las reglas únicas.
   */
  readonly loQueFaltaPorPaso = computed<Record<number, readonly string[]>>(() => {
    const f = this.formulario();
    const paso1: string[] = [];
    if (!f.nombre.trim()) paso1.push('el nombre');
    if (!f.correoContacto.trim()) paso1.push('el correo de contacto');
    else if (!esCorreoValido(f.correoContacto)) paso1.push('un correo de contacto válido');
    if (mensajeDeNit(f.identificacion)) paso1.push('un NIT válido, o dejarlo vacío si no tiene personería jurídica');
    const paso2: string[] = [];
    if (!f.codigoDepartamentoSede) paso2.push('el departamento de la sede');
    if (!f.codigoMunicipioSede) paso2.push('el municipio de la sede');
    const paso3: string[] = [];
    if (!f.responsableNombre.trim()) paso3.push('quién responde por ella');
    if (f.responsableCorreo.trim() && !esCorreoValido(f.responsableCorreo)) paso3.push('un correo válido de quien responde');
    if (mensajeDeTelefono(f.responsableTelefono)) paso3.push('un teléfono válido de quien responde');
    return { 1: paso1, 2: paso2, 3: paso3 };
  });

  /** El departamento y el municipio de la sede, con su nombre, para la revisión (antes se omitía la sede). */
  readonly sedeParaLaRevision = computed(() => {
    const f = this.formulario();
    const departamento = this.territorios().find(t => t.codigo === f.codigoDepartamentoSede);
    const municipio = departamento?.municipios.find(m => m.codigo === f.codigoMunicipioSede);
    return [municipio?.nombre, departamento?.nombre].filter(Boolean).join(', ');
  });

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.catalogo.fetchDivipolaConCodigos().subscribe({
      next: territorios => this.territorios.set(territorios),
      error: () => this.territorios.set([]),
    });
  }

  campo<K extends keyof FormularioDeOrganizacion>(clave: K, valor: FormularioDeOrganizacion[K]): void {
    const siguiente = { ...this.formulario(), [clave]: valor };
    this.formulario.set(siguiente);
    if (clave === 'nombre' || clave === 'identificacion') { this.buscarCoincidencias(); }
  }

  cambiarDepartamento(codigo: string): void {
    // DEJAR EL MUNICIPIO PUESTO guardaría un par que no existe, y la foránea a Divipola lo
    // rechazaría con un error que no dice cuál de los dos campos falla.
    this.formulario.set({ ...this.formulario(), codigoDepartamentoSede: codigo, codigoMunicipioSede: '' });
  }


  erroresDe(campo: string): string[] { return this.errores()[campo] ?? []; }

  /** Busca parecidos cuando se deja de escribir, no en cada letra. */
  private buscarCoincidencias(): void {
    if (this.temporizador) { clearTimeout(this.temporizador); }
    this.temporizador = setTimeout(async () => {
      const f = this.formulario();
      if (f.nombre.trim().length < 3 && !f.identificacion.trim()) {
        this.coincidencias.set([]);
        return;
      }
      this.coincidencias.set(await this.api.coincidenciasDeOrganizacion(f.nombre.trim(), f.identificacion.trim() || undefined));
    }, 600);
  }

  async registrar(): Promise<void> {
    const f = this.formulario();
    this.guardando.set(true);
    this.error.set(null);
    this.errores.set({});

    try {
      const resultado = await this.api.crearOrganizacion({
        nombre: f.nombre.trim(),
        identificacion: f.identificacion.trim() || null,
        correoContacto: f.correoContacto.trim() || null,
        codigoDepartamentoSede: f.codigoDepartamentoSede || null,
        codigoMunicipioSede: f.codigoMunicipioSede || null,
        responsableNombre: f.responsableNombre.trim(),
        responsableTipoDocumento: f.responsableTipoDocumento || null,
        responsableNumeroDocumento: f.responsableNumeroDocumento.trim() || null,
        responsableCorreo: f.responsableCorreo.trim() || null,
        responsableTelefono: f.responsableTelefono.trim() || null,
        responsableAutorizacionDatos: f.responsableAutorizacionDatos,
      });

      if (resultado.ok && resultado.id) {
        this.registrada.emit({ id: resultado.id, nombre: resultado.nombre ?? f.nombre.trim() });
        this.formulario.set({ ...VACIO });
        this.paso.set(1);
      } else {
        this.errores.set(resultado.errores ?? {});
        this.error.set(resultado.error ?? 'Revisa los campos marcados.');
        // SE VUELVE AL PRIMER PASO CON ERROR, no al primero a secas: quien registra tiene que ver
        // el campo que falló, no volver a empezar.
        this.paso.set(this.primerPasoConError());
      }
    } finally {
      this.guardando.set(false);
    }
  }

  private primerPasoConError(): number {
    const campos = Object.keys(this.errores());
    if (campos.some(c => c.startsWith('headquarters'))) { return 2; }
    if (campos.some(c => c.startsWith('responsable'))) { return 3; }
    return campos.length > 0 ? 1 : this.paso();
  }
}
