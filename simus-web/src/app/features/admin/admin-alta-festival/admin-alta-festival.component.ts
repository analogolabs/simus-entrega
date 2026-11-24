import { sedeParaEnviar, ubicacionesDesdeTerritorios } from '../../../core/territorio/sede-principal';
import { SedeElegida, SelectorDeSedeComponent } from '../../../shared/components/ui/selector-de-sede/selector-de-sede.component';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { CatalogService, TerritorioConCodigo } from '../../../core/services/catalog.service';
import { AdminService, OrganizacionAdministrativa } from '../../../core/services/admin.service';
import { SessionService } from '../../../core/services/session.service';
import { rolesDeSesion } from '../domain/admin-config';
import {
  AltaAdministrativaService,
  CoincidenciaDeAlta,
} from '../../../core/services/alta-administrativa.service';
import { PasoDelIndicador } from '../../../shared/components/ui/indicador-de-pasos/indicador-de-pasos.component';
import { AsistenteDeAltaComponent } from '../../../shared/components/ui/asistente-de-alta/asistente-de-alta.component';
import { PASOS_DE_UN_ALTA } from '../../../core/vocabularios/pasos-de-un-alta';
import { SelectorDeClasificacionComponent } from '../../../shared/components/ui/selector-de-clasificacion/selector-de-clasificacion.component';
import { AdminAltaOrganizacionComponent } from '../admin-alta-organizacion/admin-alta-organizacion.component';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { PERIODICIDADES, etiquetaDePeriodicidad, pideDetalle } from '../../../core/vocabularios/periodicidad';
import { nombrePropio } from '../../../shared/texto/nombre-propio';
import { etiquetaDeCobertura } from '../../../core/vocabularios/cobertura';
import { EnumerarPipe } from '../../../shared/texto/enumerar';

import { CampoDeSeleccionComponent } from '../../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
/**
 * Registrar un Festival desde el Panel de Gestión Administrativa.
 *
 * <b>TRES COSAS DISTINTAS, Y AQUÍ SE VEN LAS TRES.</b> La procedencia es el Programa —lo incorpora
 * la consola—; el usuario es la cuenta que tiene la sesión; y la organización responsable es la
 * que gestiona el Festival, que puede ser otra o no existir todavía. Que el PNMC lo registre
 * <b>no</b> lo convierte en su organización responsable.
 *
 * <b>SI LA ORGANIZACIÓN NO EXISTE, SE CREA SIN SALIR DE AQUÍ.</b> Obligar a abandonar el registro
 * a medias para ir a otra pantalla es como se pierden los datos que ya se habían escrito.
 *
 * <b>NO ES UNA VARIANTE DEL MODELO.</b> El servidor usa la misma alta que el asistente externo:
 * mismas reglas de territorio, periodicidad y catálogos.
 */

interface FormularioDeFestival {
  nombre: string;
  descripcion: string;
  periodicidad: string;
  periodicidadDetalle: string;
  nivelCobertura: string;
  codigoDepartamento: string;
  codigoMunicipio: string;
  sedeCodigoDepartamento: string;
  sedeCodigoMunicipio: string;
  correoContacto: string;
  telefonoCelular: string;
  instagram: string;
  facebook: string;
  paginaWeb: string;
  otroEnlace: string;
  observacionesContacto: string;
  organizacionResponsableId: number | null;
  practicasMusicalesIds: number[];
  territoriosSonorosIds: number[];
}

/**
 * Los pasos, que ya no son propios.
 *
 * SE CONSERVA EL NOMBRE porque lo importan otras pantallas, pero apunta al vocabulario común: un
 * proceso del Ecosistema se pregunta igual sea cual sea, y tener dos listas de pasos es como
 * empezaron a divergir las de periodicidad.
 */
export const PASOS_DEL_FESTIVAL: readonly PasoDelIndicador[] = PASOS_DE_UN_ALTA;

// EL VOCABULARIO VIVE EN `core/vocabularios/periodicidad`, no aquí. Estaba copiado en tres
// pantallas y las tres habían dejado de decir lo mismo; ver el comentario de ese fichero.

const VACIO: FormularioDeFestival = {
  nombre: '', descripcion: '', periodicidad: '', periodicidadDetalle: '',
  nivelCobertura: 'municipal', codigoDepartamento: '', codigoMunicipio: '',
  sedeCodigoDepartamento: '', sedeCodigoMunicipio: '',
  correoContacto: '', telefonoCelular: '', instagram: '', facebook: '',
  paginaWeb: '', otroEnlace: '', observacionesContacto: '',
  organizacionResponsableId: null, practicasMusicalesIds: [], territoriosSonorosIds: [],
};

@Component({
  selector: 'app-admin-alta-festival',
  standalone: true,
  imports: [SelectorDeSedeComponent, OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, EnumerarPipe,  BotonComponent,
    CommonModule, FormsModule, AsistenteDeAltaComponent,
    SelectorDeClasificacionComponent, AdminAltaOrganizacionComponent,
  ],
  templateUrl: './admin-alta-festival.component.html',
})
export class AdminAltaFestivalComponent {
  /** La cobertura con su palabra, no con el código. */
  readonly etiquetaDeCobertura = etiquetaDeCobertura;
  private readonly api = inject(AltaAdministrativaService);
  private readonly catalogo = inject(CatalogService);
  private readonly admin = inject(AdminService);
  private readonly sesion = inject(SessionService);

  /**
   * Solo el administrador del sistema registra un Festival sin organización (decisión 4 de).
   *
   * Un Festival sin organización es un REGISTRO HISTÓRICO mapeado que una organización reclamará
   * después. El gestor elige siempre la organización responsable; la API lo exige igual.
   */
  readonly esWebmaster = computed(() => rolesDeSesion(this.sesion.currentUser()).includes('webmaster'));

  @Output() registrado = new EventEmitter<{ id: string; nombre: string }>();
  @Output() cancelado = new EventEmitter<void>();

  readonly pasos = PASOS_DEL_FESTIVAL;
  readonly periodicidades = PERIODICIDADES;
  readonly paso = signal(1);
  readonly formulario = signal<FormularioDeFestival>({ ...VACIO });
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errores = signal<Record<string, string[]>>({});
  readonly coincidencias = signal<CoincidenciaDeAlta[]>([]);
  readonly territorios = signal<TerritorioConCodigo[]>([]);
  readonly organizaciones = signal<OrganizacionAdministrativa[]>([]);
  readonly creandoOrganizacion = signal(false);

  readonly municipiosDelDepartamento = computed(() => {
    const codigo = this.formulario().codigoDepartamento;
    if (!codigo) { return []; }
    return this.territorios().find(t => t.codigo === codigo)?.municipios ?? [];
  });

  readonly ubicaciones = computed(() => ubicacionesDesdeTerritorios(this.territorios()));

  readonly organizacionElegida = computed(() => {
    const id = this.formulario().organizacionResponsableId;
    return id === null ? null : this.organizaciones().find(o => Number(o.id) === id) ?? null;
  });

  readonly pideDetalleDePeriodicidad = computed(() =>
    pideDetalle(this.formulario().periodicidad));

  /**
   * La periodicidad tal como se va a guardar, para el resumen.
   *
   * EL RESUMEN NO LA NOMBRABA, y era justo el dato que el formulario aparentaba tener: quien
   * revisaba antes de registrar no podía ver que viajaba vacía.
   */
  readonly periodicidadEnPalabras = computed(() =>
    etiquetaDePeriodicidad(this.formulario().periodicidad) || 'Sin definir');

  /** El territorio que se va a guardar, con los nombres escritos como se escriben. */
  readonly territorioEnPalabras = computed(() => {
    const f = this.formulario();
    if (f.nivelCobertura === 'nacional') { return 'Todo el país'; }
    const departamento = this.territorios().find(t => t.codigo === f.codigoDepartamento);
    if (!departamento) { return 'Sin especificar'; }
    const municipio = f.nivelCobertura === 'municipal'
      ? departamento.municipios.find(m => m.codigo === f.codigoMunicipio)
      : undefined;
    return [municipio?.nombre, departamento.nombre]
      .filter((nombre): nombre is string => !!nombre)
      .map(nombre => nombrePropio(nombre))
      .join(', ');
  });

  readonly loQueFalta = computed(() => {
    const f = this.formulario();
    const faltas: string[] = [];
    if (!this.esWebmaster() && f.organizacionResponsableId === null) { faltas.push('la organización responsable'); }
    if (!f.nombre.trim()) { faltas.push('el nombre'); }
    if (f.nivelCobertura !== 'nacional' && !f.codigoDepartamento) { faltas.push('el departamento'); }
    if (f.nivelCobertura === 'municipal' && !f.codigoMunicipio) { faltas.push('el municipio'); }
    const sede = this.sedeEfectiva();
    if (!sede.sedeCodigoDepartamento) { faltas.push('el departamento de la sede principal'); }
    else if (!sede.sedeCodigoMunicipio) { faltas.push('el municipio de la sede principal'); }
    if (this.pideDetalleDePeriodicidad() && !f.periodicidadDetalle.trim()) { faltas.push('la explicación de la periodicidad'); }
    return faltas;
  });

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.catalogo.fetchDivipolaConCodigos().subscribe({
      next: territorios => this.territorios.set(territorios),
      error: () => this.territorios.set([]),
    });
    void this.cargarOrganizaciones();
  }

  private async cargarOrganizaciones(): Promise<void> {
    // SE PIDE UNA PAGINA GRANDE PORQUE ES UN DESPLEGABLE, no una tabla: quien registra necesita
    // encontrar su organización, y paginarla aquí obligaría a buscar a ciegas.
    try {
      const respuesta = await firstValueFrom(this.admin.cargarOrganizaciones({ tamano: 200 }));
      this.organizaciones.set(respuesta?.items ?? []);
    } catch {
      // SIN LISTA NO SE PUEDE ELEGIR, PERO SI REGISTRAR: un Festival puede quedarse sin
      // organización responsable, y esperar a que cargue la lista no debe impedir escribirlo.
      this.organizaciones.set([]);
    }
  }

  campo<K extends keyof FormularioDeFestival>(clave: K, valor: FormularioDeFestival[K]): void {
    const siguiente = { ...this.formulario(), [clave]: valor };
    this.formulario.set(siguiente);
    if (clave === 'nombre') { this.buscarCoincidencias(); }
  }

  /** La sede que se guarda: la elegida o, con cobertura municipal, el municipio de la cobertura. */
  sedeEfectiva() {
    const f = this.formulario();
    return sedeParaEnviar(f, f.nivelCobertura, f.codigoDepartamento, f.codigoMunicipio);
  }

  /** La sede principal, aparte de la cobertura: la elige el selector común. */
  elegirSede(sede: SedeElegida): void {
    this.formulario.set({ ...this.formulario(), sedeCodigoDepartamento: sede.departamento, sedeCodigoMunicipio: sede.municipio });
  }

  cambiarDepartamento(codigo: string): void {
    this.formulario.set({ ...this.formulario(), codigoDepartamento: codigo, codigoMunicipio: '' });
  }

  /**
   * Cambia el nivel de cobertura y limpia lo que ese nivel no admite.
   *
   * EL SERVIDOR LO LIMPIARIA IGUAL, pero dejarlo en pantalla hace creer que se guardó: alguien
   * elige municipal, pone su municipio, cambia a nacional y sigue viéndolo escrito.
   */
  cambiarNivel(nivel: string): void {
    const actual = this.formulario();
    this.formulario.set({
      ...actual,
      nivelCobertura: nivel,
      codigoDepartamento: nivel === 'nacional' ? '' : actual.codigoDepartamento,
      codigoMunicipio: nivel === 'municipal' ? actual.codigoMunicipio : '',
    });
  }

  erroresDe(campo: string): string[] { return this.errores()[campo] ?? []; }

  abrirAltaDeOrganizacion(): void { this.creandoOrganizacion.set(true); }

  cerrarAltaDeOrganizacion(): void { this.creandoOrganizacion.set(false); }

  /** La organización recién creada queda elegida: es para lo que se abrió el formulario. */
  async organizacionCreada(organizacion: { id: string; nombre: string }): Promise<void> {
    this.creandoOrganizacion.set(false);
    await this.cargarOrganizaciones();
    this.campo('organizacionResponsableId', Number(organizacion.id));
  }

  private buscarCoincidencias(): void {
    if (this.temporizador) { clearTimeout(this.temporizador); }
    this.temporizador = setTimeout(async () => {
      const nombre = this.formulario().nombre.trim();
      this.coincidencias.set(nombre.length < 3 ? [] : await this.api.coincidenciasDeFestival(nombre));
    }, 600);
  }

  async registrar(): Promise<void> {
    const f = this.formulario();
    this.guardando.set(true);
    this.error.set(null);
    this.errores.set({});

    try {
      const resultado = await this.api.crearFestival({
        festival: {
          nombre: f.nombre.trim(),
          descripcion: f.descripcion.trim() || null,
          periodicidad: f.periodicidad || null,
          periodicidadDetalle: f.periodicidadDetalle.trim() || null,
          correoContacto: f.correoContacto.trim() || null,
          nivelCobertura: f.nivelCobertura,
          codigoDepartamento: f.codigoDepartamento || null,
          codigoMunicipio: f.codigoMunicipio || null,
          ...this.sedeEfectiva(),
          practicasMusicalesIds: f.practicasMusicalesIds,
          territoriosSonorosIds: f.territoriosSonorosIds,
          instagram: f.instagram.trim() || null,
          facebook: f.facebook.trim() || null,
          paginaWeb: f.paginaWeb.trim() || null,
          otroEnlace: f.otroEnlace.trim() || null,
          telefonoCelular: f.telefonoCelular.trim() || null,
          observacionesContacto: f.observacionesContacto.trim() || null,
        },
        organizacionResponsableId: f.organizacionResponsableId,
      });

      if (resultado.ok && resultado.id) {
        this.registrado.emit({ id: resultado.id, nombre: resultado.nombre ?? f.nombre.trim() });
        this.formulario.set({ ...VACIO });
        this.paso.set(1);
      } else {
        this.errores.set(resultado.errores ?? {});
        this.error.set(resultado.error ?? 'Revisa los campos marcados.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
