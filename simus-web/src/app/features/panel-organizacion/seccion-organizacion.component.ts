import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { PanelDeSeccionComponent } from '../../shared/components/ui/panel-de-seccion/panel-de-seccion.component';
import { Component, ElementRef, HostListener, OnDestroy, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucidePencilLine } from '@lucide/angular';
import { BotonComponent } from '../../shared/components/ui/boton/boton.component';
import { DatoConIconoComponent } from '../../shared/components/ui/dato-con-icono/dato-con-icono.component';
import { NombrePropioPipe } from '../../shared/texto/nombre-propio.pipe';
import { nombrePropio } from '../../shared/texto/nombre-propio';
import { AdminService } from '../../core/services/admin.service';
import {
  FalloDelServidor,
  PanelOrganizacionApi,
  PerfilOrganizacion,
  PerfilOrganizacionSolicitud,
  UbicacionDivipola,
} from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { SeccionResponsableComponent } from './seccion-responsable.component';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { BancoDeArchivosService } from '../../core/services/banco-de-archivos.service';
import { matizDelEstado, tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { AvisoSoloAdministracionComponent } from './aviso-solo-administracion.component';
import { ConfirmacionDeCorreoService } from '../../core/services/confirmacion-de-correo.service';
import { ConCambiosSinGuardar } from '../../core/navegacion/cambio-de-organizacion';
import { ErrorDeCampoComponent } from '../../shared/components/ui/error-de-campo/error-de-campo.component';
import { esCorreoValido, MENSAJE_DE_CORREO, mensajeDeTelefono } from '../../core/formularios/telefono';
import { mensajeDeRedSocial, mensajeDeUrl, normalizarRedSocial, normalizarUrl } from '../../core/formularios/url';
import { traducirErrorDelServidor } from '../../core/formularios/traductor-de-errores';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
/*
 * EL CONTRATO DEL PANEL SE MUDO A `panel-organizacion.api.ts`.
 * Vivia aqui, es decir dentro de UNA de las secciones, y en cuanto la pestana de Ecosistema y
 * la de Solicitudes necesitaron las mismas llamadas, dos secciones habrian dependido de una
 * tercera para hablar con el servidor. Los tipos y la clase abstracta se importan arriba.
 */

/*
 * `NIVELES_DE_COBERTURA` SE MUDÓ A `panel-organizacion.api.ts`, cuando la
 * ficha desplegable de `seccion-festivales` necesitó los mismos cuatro rótulos. Se re-exporta desde
 * aquí para no obligar a nadie a cambiar de importación, y porque este componente sigue siendo el
 * que la usa más.
 */

/** El formulario del perfil, en objeto plano porque `[(ngModel)]` escribe sobre propiedades. */
interface FormularioPerfil {
  nombre: string;
  nombreLegal: string;
  numeroIdentificacion: string;
  descripcion: string;
  correoContacto: string;
  telefonoContacto: string;
  sitioWeb: string;
  facebook: string;
  instagram: string;
  otroEnlace: string;
  direccion: string;
  codigoDepartamentoSede: string;
  codigoMunicipioSede: string;
  /** La dirección de la foto, para pintarla. La que viaja al servidor es el identificador. */
  fotoUrl: string | null;
  archivoFotoId: number | null;
}

function vacioANulo(valor: string): string | null {
  const limpio = (valor ?? '').trim();
  return limpio.length === 0 ? null : limpio;
}

/**
 * La ruta «Datos de la organización», en /gestion/organizacion.
 *
 * <b>YA NO RECIBE `organizacionId` NI `perfil` POR `@Input`.</b> Hasta los
 * recibía del armazón, que los pedía una sola vez para repartirlos entre la columna izquierda y
 * esta pestaña. Con rutas hijas de verdad esta pantalla es su propio destino —se puede enlazar,
 * recargar, compartir— y tiene que poder alimentarse sola: pide `organizacionId` a
 * {@link PanelOrganizacionStore} (compartido con el resto del panel) y su propio perfil a
 * {@link PanelOrganizacionApi}, exactamente como ya hacía este mismo componente con la persona
 * responsable antes de que se separara en `SeccionResponsableComponent`.
 *
 * <b>Por omisión se lee; el formulario se abre con «Editar».</b> Es un requisito del proyecto el 28 de agosto
 * de 2026: «el default es sin edición los datos que actualmente tiene». El formulario y su
 * validación son los mismos de siempre.
 */
import { CampoDeNitComponent } from '../../shared/components/ui/campo-de-nit/campo-de-nit.component';
import { mensajeDeNit } from '../../core/formularios/nit';

@Component({
  selector: 'app-seccion-organizacion',
  standalone: true,
  imports: [PanelDeSeccionComponent, FechaPipe, CampoDeSeleccionComponent, CampoDeNitComponent, BotonNativoDirective, AvisoSoloAdministracionComponent, 
    CommonModule, FormsModule, SeccionResponsableComponent, IndicadorDeEstadoComponent,
    BotonComponent, DatoConIconoComponent, LucidePencilLine, NombrePropioPipe, ErrorDeCampoComponent,
  ],
  templateUrl: './seccion-organizacion.component.html',
})
export class SeccionOrganizacionComponent implements OnDestroy, ConCambiosSinGuardar {
  private readonly api = inject(PanelOrganizacionApi);
  private readonly banco = inject(BancoDeArchivosService);
  private readonly adminService = inject(AdminService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly store = inject(PanelOrganizacionStore);
  private readonly confirmacion = inject(ConfirmacionDeCorreoService);

  readonly organizacionId = this.store.organizacionId;
  /** Editar los datos de la organización es de la administración. */
  readonly esAdministradora = this.store.esAdministradora;

  readonly perfil = signal<PerfilOrganizacion | null>(null);
  readonly cargandoPerfil = signal(false);
  readonly errorPerfil = signal('');

  readonly formulario: FormularioPerfil = {
    nombre: '', nombreLegal: '', numeroIdentificacion: '', descripcion: '', correoContacto: '',
    telefonoContacto: '', sitioWeb: '', facebook: '', instagram: '', otroEnlace: '', direccion: '',
    codigoDepartamentoSede: '', codigoMunicipioSede: '',
    fotoUrl: null, archivoFotoId: null,
  };

  readonly subiendoFoto = signal(false);
  readonly errorDeFoto = signal('');

  /**
   * Las iniciales de la organización, que son el respaldo de quien no sube foto.
   *
   * NO ES UN HUECO NI UN MARCADOR DE POSICION: es lo que se ve, y lo que se veía antes de que la
   * foto existiera. Dos letras, porque tres ya no se leen a ese tamaño.
   */
  iniciales(): string {
    return this.inicialesDe(this.formulario.nombre);
  }

  /** Las iniciales de un nombre (dos letras), para la foto de respaldo de la lectura y del formulario. */
  inicialesDe(nombreCompleto: string | null | undefined): string {
    const nombre = (nombreCompleto || '').trim();
    if (!nombre) return '—';
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2)
      .map(palabra => palabra[0]!.toLocaleUpperCase('es-CO')).join('');
  }

  /** La sede en una línea: «Popayán, Cauca». Sin dato, se dice. */
  sedeDe(perfil: PerfilOrganizacion): string {
    const partes = [perfil.nombreMunicipioSede, perfil.nombreDepartamentoSede]
      .filter((parte): parte is string => !!parte)
      .map(parte => nombrePropio(parte));
    return partes.length ? partes.join(', ') : 'Sede sin registrar';
  }


  /**
   * Elige la foto de perfil. NO LA SUBE: la guarda en memoria con su vista previa y se sube al
   * pulsar «Guardar».
   *
   * <b>ANTES SE SUBÍA AL ELEGIRLA.</b> El formulario mostraba «Cambiar foto / Quitar» como si
   * estuviera aplicada y, si se salía sin guardar, el archivo quedaba en «Mis archivos» como «Sin
   * usar · Privado»: un huérfano que ocupa cuota. Ahora no hay nada en el banco hasta que se guarda.
   * El texto alternativo se compone con el nombre —«Foto de perfil de Fundación X»— en vez de
   * pedirlo aparte: pedir que alguien describa su propio logotipo es pedir un dato que el sistema
   * tiene.
   */
  elegirFoto(entrada: HTMLInputElement): void {
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;

    this.errorDeFoto.set('');
    this.fotoPendiente = archivo;
    this.soltarVistaPrevia();
    this.vistaPreviaDeFoto.set(URL.createObjectURL(archivo));
  }

  /** Quita la foto y devuelve las iniciales. El archivo del banco no se toca; solo se desvincula. */
  quitarFoto(): void {
    this.fotoPendiente = null;
    this.soltarVistaPrevia();
    this.formulario.fotoUrl = null;
    this.formulario.archivoFotoId = null;
    this.errorDeFoto.set('');
  }

  /** La foto elegida que espera al guardado, y su vista previa. */
  private fotoPendiente: File | null = null;
  readonly vistaPreviaDeFoto = signal<string | null>(null);

  private soltarVistaPrevia(): void {
    const actual = this.vistaPreviaDeFoto();
    if (actual) URL.revokeObjectURL(actual);
    this.vistaPreviaDeFoto.set(null);
  }

  ngOnDestroy(): void {
    this.soltarVistaPrevia();
  }

  /** Hay algo editado sin guardar: el formulario está abierto y difiere del perfil recibido, o hay foto elegida. */
  hayCambios(): boolean {
    const perfil = this.perfil();
    if (!this.editandoPerfil() || !perfil) return false;
    const f = this.formulario;
    const igual = (a: string, b: string | null | undefined) => a.trim() === (b ?? '').trim();
    return this.fotoPendiente !== null
      || f.archivoFotoId !== (perfil.archivoFotoId ?? null)
      || !igual(f.nombre, perfil.nombre) || !igual(f.nombreLegal, perfil.nombreLegal)
      || !igual(f.numeroIdentificacion, perfil.numeroIdentificacion) || !igual(f.descripcion, perfil.descripcion)
      || !igual(f.correoContacto, perfil.correoContacto) || !igual(f.telefonoContacto, perfil.telefonoContacto)
      || !igual(f.sitioWeb, perfil.sitioWeb) || !igual(f.facebook, perfil.facebook)
      || !igual(f.instagram, perfil.instagram) || !igual(f.otroEnlace, perfil.otroEnlace)
      || !igual(f.direccion, perfil.direccion)
      || !igual(f.codigoDepartamentoSede, perfil.codigoDepartamentoSede)
      || !igual(f.codigoMunicipioSede, perfil.codigoMunicipioSede);
  }

  avisoAlSalir(): string | null {
    return this.hayCambios() && !this.guardandoPerfil()
      ? 'Tienes cambios en los datos de la organización que no guardaste. Si sales ahora se perderán.'
      : null;
  }

  avisoAlCambiarDeOrganizacion(_actual: string, nueva: string): string | null {
    return this.hayCambios() && !this.guardandoPerfil()
      ? `Tienes cambios en los datos de la organización sin guardar y se perderán. No pasarán a «${nueva}».`
      : null;
  }

  @HostListener('window:beforeunload', ['$event'])
  avisarAlCerrarLaPestana(evento: BeforeUnloadEvent): void {
    if (this.avisoAlSalir()) evento.preventDefault();
  }

  readonly ubicaciones = signal<UbicacionDivipola[]>([]);

  readonly guardandoPerfil = signal(false);
  readonly mensajePerfil = signal('');

  /** Errores por campo, con las claves que devuelve el 422 del API. */
  readonly erroresPerfil = signal<Record<string, string>>({});

  /**
   * Falso es lectura y verdadero es formulario. Arranca en falso.
   */
  readonly editandoPerfil = signal(false);

  constructor() {
    // Cambiar de organización pide su perfil y cierra el formulario: quedarse en edición dejaría en
    // pantalla los campos de la anterior sobre el nombre de la nueva.
    effect(() => {
      const id = this.organizacionId();
      if (id) {
        this.editandoPerfil.set(false);
        this.mensajePerfil.set('');
        this.erroresPerfil.set({});
        this.cargarPerfil(id);
      }
    });

    this.adminService.cargarDivipolaPublica().subscribe({
      next: filas => this.ubicaciones.set((filas ?? []) as UbicacionDivipola[]),
      error: () => this.ubicaciones.set([]),
    });
  }

  private cargarPerfil(organizacionId: string): void {
    this.perfil.set(null);
    this.errorPerfil.set('');
    this.cargandoPerfil.set(true);
    this.api.obtenerPerfil(organizacionId).subscribe({
      next: perfil => {
        this.cargandoPerfil.set(false);
        this.perfil.set(perfil);
        this.sembrarFormulario(perfil);
      },
      error: (fallo: FalloDelServidor) => {
        this.cargandoPerfil.set(false);
        this.errorPerfil.set(fallo?.message ?? 'No fue posible consultar los datos de la organización');
      },
    });
  }

  private sembrarFormulario(perfil: PerfilOrganizacion): void {
    this.formulario.nombre = perfil.nombre ?? '';
    this.formulario.nombreLegal = perfil.nombreLegal ?? '';
    this.formulario.numeroIdentificacion = perfil.numeroIdentificacion ?? '';
    this.formulario.descripcion = perfil.descripcion ?? '';
    this.formulario.correoContacto = perfil.correoContacto ?? '';
    this.formulario.telefonoContacto = perfil.telefonoContacto ?? '';
    this.formulario.sitioWeb = perfil.sitioWeb ?? '';
    this.formulario.facebook = perfil.facebook ?? '';
    this.formulario.instagram = perfil.instagram ?? '';
    this.formulario.otroEnlace = perfil.otroEnlace ?? '';
    this.formulario.direccion = perfil.direccion ?? '';
    this.formulario.codigoDepartamentoSede = perfil.codigoDepartamentoSede ?? '';
    this.formulario.codigoMunicipioSede = perfil.codigoMunicipioSede ?? '';
    this.formulario.fotoUrl = perfil.fotoUrl ?? null;
    this.formulario.archivoFotoId = perfil.archivoFotoId ?? null;
  }

  /** Los departamentos, sin repetir, tal como los da DIVIPOLA. */
  departamentos(): { code: string; name: string }[] {
    const unicos = new Map(this.ubicaciones().map(fila => [fila.departmentCode, fila.departmentName]));
    return Array.from(unicos.entries()).map(([code, name]) => ({ code, name }));
  }

  /**
   * Los municipios del departamento elegido.
   *
   * ES UN MÉTODO Y NO UN `computed()`. Lee `this.formulario.codigoDepartamentoSede`, que es una
   * propiedad de un objeto plano que `[(ngModel)]` escribe sin avisar a nadie: un `computed` se
   * calcularía una vez, con el departamento vacío, y se quedaría vacío para siempre.
   */
  municipios(): UbicacionDivipola[] {
    const departamento = this.formulario.codigoDepartamentoSede;
    if (!departamento) return [];
    return this.ubicaciones().filter(fila => fila.departmentCode === departamento);
  }

  /**
   * Al cambiar de departamento, el municipio anterior deja de pertenecerle.
   */
  alCambiarDepartamento(): void {
    this.formulario.codigoMunicipioSede = '';
  }

  /**
   * Qué significa el estado en el que está la organización, en una frase.
   *
   * LOS CUATRO SON DE UN ACTOR Y NO DE UN CONTENIDO. Hasta la columna
   * guardaba los ocho códigos del circuito editorial —«Publicado», «Aprobado»— sobre algo que no se
   * publica ni se aprueba. Se estrecharon a los cuatro que dicen algo, y esta pantalla es donde la
   * organización los lee.
   */
  explicacionDelEstado(): string {
    switch (this.perfil()?.estadoRegistro) {
      case 'pendiente_de_confirmacion':
        // UN SOLO AVISO, EL DEL MODO REAL. Esta frase decía siempre «no podrás
        // enviarlo a revisión ni publicar», y en modo demo el servidor dispensa la confirmación:
        // en la misma sesión se enviaban procesos y se publicaban ediciones, y el Resumen decía lo
        // contrario. Lo que manda es `confirmacionCorreoObligatoria` de la sesión, el mismo dato
        // que leen el Resumen y el aviso con «Enviarme otro enlace». Sin saberlo todavía, se
        // conserva la versión estricta, igual que `ConfirmacionDeCorreoService.falta()`.
        if (this.confirmacion.estado()?.confirmacionCorreoObligatoria === false) {
          return 'Falta confirmar el correo de tu cuenta. En este entorno puedes enviar a revisión y '
            + 'publicar mientras tanto.';
        }
        return 'Falta confirmar el correo de tu cuenta. Puedes preparar tu registro mientras tanto, '
          + 'pero no podrás enviarlo a revisión ni publicar una edición hasta confirmarlo.';
      case 'activa':
        return 'Tu organización opera con normalidad.';
      case 'inactiva':
        return 'Tu organización está suspendida. Conserva su ficha y sus procesos. Escríbele al equipo del PNMC si esto no es correcto.';
      case 'eliminada':
        return 'Tu organización quedó fuera del ecosistema. Escríbele al equipo del PNMC si esto no es correcto.';
      default:
        return '';
    }
  }

  /** El tono y el matiz del indicador, desde el criterio único del proyecto. */
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  /**
   * Abre el formulario de la organización con lo que hay guardado.
   */
  editarPerfil(): void {
    const perfil = this.perfil();
    if (!perfil) return;
    this.fotoPendiente = null;
    this.soltarVistaPrevia();
    this.sembrarFormulario(perfil);
    this.mensajePerfil.set('');
    this.errorPerfil.set('');
    this.erroresPerfil.set({});
    this.editandoPerfil.set(true);
    this.enfocar('#perfil-nombre');
  }

  /** Descarta lo tecleado, devuelve el formulario al último perfil recibido y vuelve a lectura. */
  cancelarPerfil(): void {
    this.fotoPendiente = null;
    this.soltarVistaPrevia();
    const perfil = this.perfil();
    if (perfil) this.sembrarFormulario(perfil);
    this.mensajePerfil.set('');
    this.errorPerfil.set('');
    this.erroresPerfil.set({});
    this.editandoPerfil.set(false);
    this.enfocar('[data-testid="perfil-editar"]');
  }

  /** El id del campo de cada error, en el orden en que aparecen en el formulario: el primero recibe el foco. */
  private readonly IDS_DE_ERROR: Readonly<Record<string, string>> = {
    name: 'perfil-nombre', identificationNumber: 'perfil-nit', contactEmail: 'perfil-correo',
    telefonoContacto: 'perfil-telefono', direccion: 'perfil-direccion', descripcion: 'perfil-descripcion',
    headquartersDepartmentCode: 'perfil-departamento', headquartersMunicipalityCode: 'perfil-municipio',
    sitioWeb: 'perfil-sitio', facebook: 'perfil-facebook', instagram: 'perfil-instagram', otroEnlace: 'perfil-otro-enlace',
  };

  /**
   * UN SOLO GUARDADO QUE INCLUYE LA FOTO: valida, sube la foto elegida (si hay) y guarda los
   * datos. Los errores —del navegador y del servidor— vuelven junto a su campo, con el nombre que
   * ve la persona, y el foco va al primero.
   */
  guardarPerfil(): void {
    if (this.guardandoPerfil()) return;
    this.mensajePerfil.set('');
    this.errorPerfil.set('');

    const errores: Record<string, string> = {};
    if (!this.formulario.nombre.trim()) errores['name'] = 'El nombre de la organización es obligatorio.';
    if (!this.formulario.correoContacto.trim()) errores['contactEmail'] = 'El correo de contacto es obligatorio.';
    else if (!esCorreoValido(this.formulario.correoContacto)) errores['contactEmail'] = MENSAJE_DE_CORREO;
    // SOLO SI CAMBIÓ: un valor guardado antes de la regla del NIT se conserva hasta que alguien lo toque.
    const nit = mensajeDeNit(this.formulario.numeroIdentificacion);
    if (nit && this.formulario.numeroIdentificacion.trim() !== (this.perfil()?.numeroIdentificacion ?? '').trim()) errores['identificationNumber'] = nit;
    const telefono = mensajeDeTelefono(this.formulario.telefonoContacto);
    if (telefono) errores['telefonoContacto'] = telefono;
    for (const [clave, valor] of [['sitioWeb', this.formulario.sitioWeb], ['otroEnlace', this.formulario.otroEnlace]] as const) {
      const mensaje = mensajeDeUrl(valor);
      if (mensaje) errores[clave] = mensaje;
    }
    for (const [clave, valor] of [['facebook', this.formulario.facebook], ['instagram', this.formulario.instagram]] as const) {
      const mensaje = mensajeDeRedSocial(valor);
      if (mensaje) errores[clave] = mensaje;
    }
    if (!this.formulario.codigoDepartamentoSede) errores['headquartersDepartmentCode'] = 'Elige un departamento.';
    if (!this.formulario.codigoMunicipioSede) errores['headquartersMunicipalityCode'] = 'Elige un municipio.';
    if (this.formulario.codigoMunicipioSede
      && !this.municipios().some(fila => fila.municipalityCode === this.formulario.codigoMunicipioSede)) {
      errores['headquartersMunicipalityCode'] = 'Elige un municipio del departamento seleccionado.';
      this.formulario.codigoMunicipioSede = '';
    }

    this.erroresPerfil.set(errores);
    if (Object.keys(errores).length > 0) {
      this.errorPerfil.set('Revisa los campos marcados.');
      this.enfocarPrimerError(errores);
      return;
    }

    this.guardandoPerfil.set(true);
    if (!this.fotoPendiente) { this.enviarPerfil(); return; }

    const alternativa = `Foto de perfil de ${(this.formulario.nombre || 'la organización').trim()}`;
    void this.banco.subirImagen(this.fotoPendiente, alternativa, { canal: 'externo' }).then(resultado => {
      if (!resultado.ok || !resultado.archivo) {
        this.guardandoPerfil.set(false);
        this.errorDeFoto.set(resultado.error ?? 'No fue posible subir la foto.');
        return;
      }
      this.formulario.fotoUrl = resultado.archivo.url;
      this.formulario.archivoFotoId = resultado.archivo.id;
      this.fotoPendiente = null;
      this.soltarVistaPrevia();
      this.enviarPerfil();
    });
  }

  private enviarPerfil(): void {
    const solicitud: PerfilOrganizacionSolicitud = {
      nombre: this.formulario.nombre.trim(),
      nombreLegal: vacioANulo(this.formulario.nombreLegal),
      numeroIdentificacion: vacioANulo(this.formulario.numeroIdentificacion),
      descripcion: vacioANulo(this.formulario.descripcion),
      correoContacto: this.formulario.correoContacto.trim(),
      telefonoContacto: vacioANulo(this.formulario.telefonoContacto),
      // LA REGLA ÚNICA DE DIRECCIÓN: se aceptan sin esquema y se guardan con https://.
      sitioWeb: vacioANulo(normalizarUrl(this.formulario.sitioWeb)),
      facebook: vacioANulo(normalizarRedSocial(this.formulario.facebook)),
      instagram: vacioANulo(normalizarRedSocial(this.formulario.instagram)),
      otroEnlace: vacioANulo(normalizarUrl(this.formulario.otroEnlace)),
      direccion: vacioANulo(this.formulario.direccion),
      codigoDepartamentoSede: this.formulario.codigoDepartamentoSede,
      codigoMunicipioSede: this.formulario.codigoMunicipioSede,
      // VIAJA EL IDENTIFICADOR Y NO LA DIRECCION: el servidor comprueba que ese archivo existe en
      // el banco antes de guardarlo, y `null` es como se quita la foto.
      archivoFotoId: this.formulario.archivoFotoId,
    };

    this.api.guardarPerfil(this.organizacionId(), solicitud).subscribe({
      next: actualizado => {
        this.guardandoPerfil.set(false);
        this.editandoPerfil.set(false);
        this.perfil.set(actualizado);
        this.mensajePerfil.set('Los datos de la organización quedaron guardados.');
        this.enfocar('[data-testid="perfil-editar"]');
      },
      error: (fallo: FalloDelServidor) => {
        this.guardandoPerfil.set(false);
        const traducido = traducirErrorDelServidor(fallo, {
          camposConLugar: Object.keys(this.IDS_DE_ERROR),
          alternativa: 'No fue posible guardar los datos de la organización.',
        });
        this.erroresPerfil.set(traducido.campos);
        this.errorPerfil.set(traducido.general);
        this.enfocarPrimerError(traducido.campos);
      },
    });
  }

  private enfocarPrimerError(errores: Record<string, string>): void {
    const clave = Object.keys(this.IDS_DE_ERROR).find(candidata => errores[candidata]);
    if (clave) this.enfocar(`#${this.IDS_DE_ERROR[clave]}`);
  }

  /**
   * Lleva el foco a donde acaba de aparecer la pantalla nueva. Ver el mismo ayudante en
   * `seccion-responsable.component.ts`, con el mismo motivo.
   */
  private enfocar(selector: string): void {
    setTimeout(() => {
      const destino = this.host.nativeElement.querySelector<HTMLElement>(selector);
      if (!destino) return;
      destino.focus();
      destino.scrollIntoView?.({ block: 'nearest' });
    });
  }
}
