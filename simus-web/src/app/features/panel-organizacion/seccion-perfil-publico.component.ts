import { EncabezadoDePantallaComponent } from '../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { PracticaMusicalConceptual, PracticasMusicalesService } from '../../core/services/practicas-musicales.service';
import {
  CambioDePerfilPublico,
  ItemDePortafolio,
  LARGO_BIOGRAFIA_CORTA,
  LARGO_BIOGRAFIA_LARGA,
  MAXIMO_DE_OFICIOS,
  MiPerfilPublico,
  PerfilPublicoService,
  PoliticaDePerfilPublico,
} from '../../core/services/perfil-publico.service';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { ClasificacionDeMiPerfilComponent } from './clasificacion-de-mi-perfil.component';
import { UbicacionDivipola } from '../../core/territorio/ubicacion-divipola';
import { ConCambiosSinGuardar } from '../../core/navegacion/cambio-de-organizacion';
import { ErrorDeCampoComponent } from '../../shared/components/ui/error-de-campo/error-de-campo.component';
import { enfocarCampo } from '../../core/formularios/foco';
import { normalizarUrl } from '../../core/formularios/url';
import { EnlaceDelPerfil, enlacesDesdeDirecciones, erroresDeEnlaces, redDe } from '../../core/formularios/redes-del-perfil';
import { etiquetaDeTipoDePortafolio } from '../../core/formularios/portafolio-del-perfil';
import { IconoDeEnlaceComponent } from '../../shared/components/ui/icono-de-enlace/icono-de-enlace.component';
import { SelectorSegmentadoComponent } from '../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { EnlacesDelPerfilComponent } from './perfil-publico/enlaces-del-perfil.component';
import { FotoDelPerfilComponent } from './perfil-publico/foto-del-perfil.component';
import { PortafolioDelPerfilComponent } from './perfil-publico/portafolio-del-perfil.component';
import { traducirErrorDelServidor } from '../../core/formularios/traductor-de-errores';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { FiltroDesplegableComponent } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';
/**
 * «Perfil público», en /gestion/perfil-publico (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4-§19.5).
 *
 * <b>NACE OCULTO.</b> Guardar no publica: el perfil se ve solo cuando la persona acepta el texto de
 * la finalidad `perfil_publico`, que el servidor sirve y copia en la autorización. Ocultarlo es
 * retirar esa autorización, lo mismo que hacerlo desde «Mis autorizaciones».
 *
 * <b>ES DE LA CUENTA, NO DE LA ORGANIZACIÓN.</b> Por eso se abre también para una cuenta sin
 * organizaciones, como «Cuenta y seguridad».
 */
@Component({
  selector: 'app-seccion-perfil-publico',
  standalone: true,
  imports: [EncabezadoDePantallaComponent, ClasificacionDeMiPerfilComponent, EsqueletoComponent, OpcionesDesdePipe, FiltroDesplegableComponent, BotonNativoDirective, FormsModule, RouterLink, ErrorDeCampoComponent, FechaPipe,
    EnlacesDelPerfilComponent, FotoDelPerfilComponent, PortafolioDelPerfilComponent, IconoDeEnlaceComponent, SelectorSegmentadoComponent],
  templateUrl: './seccion-perfil-publico.component.html',
})
export class SeccionPerfilPublicoComponent implements OnInit, OnDestroy, ConCambiosSinGuardar {
  private readonly servicio = inject(PerfilPublicoService);
  private readonly practicasServicio = inject(PracticasMusicalesService);
  private readonly adminService = inject(AdminService);

  readonly maximoDeOficios = MAXIMO_DE_OFICIOS;
  /**
   * EDITAR Y VER LA FICHA, A LA VEZ EN PANTALLA ANCHA Y POR PESTAÑAS EN LA ESTRECHA. En pantalla ancha el formulario y la
   * vista previa tienen cada uno su desplazamiento (se ve la ficha mientras se escribe); en móvil se alterna con
   * «Editar» y «Vista previa».
   */
  readonly vista = signal<'editar' | 'vista'>('editar');
  protected readonly opcionesDeVista = [{ id: 'editar', etiqueta: 'Editar' }, { id: 'vista', etiqueta: 'Vista previa' }];
  /** Se pulsó «Guardar perfil» con errores: desde ahí se muestran los de todas las filas de enlaces. */
  readonly intentoDeGuardar = signal(false);
  readonly largoBiografiaCorta = LARGO_BIOGRAFIA_CORTA;
  readonly largoBiografiaLarga = LARGO_BIOGRAFIA_LARGA;
  readonly perfil = signal<MiPerfilPublico | null>(null);
  readonly politica = signal<PoliticaDePerfilPublico | null>(null);
  readonly practicas = signal<PracticaMusicalConceptual[]>([]);
  readonly ubicaciones = signal<UbicacionDivipola[]>([]);
  readonly errores = signal<Record<string, string>>({});
  /**
   * Los mensajes van JUNTO al botón que los produjo: el de éxito aparecía arriba de la
   * pantalla, fuera de la vista de quien acababa de pulsar «Guardar» al fondo del formulario.
   */
  readonly avisoDeGuardado = signal('');
  readonly avisoDePublicacion = signal('');
  readonly error = signal('');
  readonly ocupado = signal(false);
  /** El historial de cambios del perfil; `null` mientras no se pide. */
  readonly historial = signal<CambioDePerfilPublico[] | null>(null);
  readonly errorDeHistorial = signal('');
  /** El rol u oficio que se está escribiendo. */
  nuevoOficio = '';
  /**
   * QUIÉN VE EL PERFIL, como lo elige la persona: cualquiera, solo quien tiene cuenta en SIMUS, u oculto (que es retirar la
   * autorización). Mientras no esté autorizado se conserva lo que eligió; al cargar un perfil autorizado manda el servidor.
   */
  visibilidadElegida: 'publico' | 'solo_simus' | 'oculto' = 'publico';
  private cargadoUnaVez = false;

  formulario = {
    nombreVisible: '',
    idsPracticas: [] as number[],
    codigoDepartamento: '',
    codigoMunicipio: '',
    archivoFotoId: null as number | null,
    fotoUrl: null as string | null,
    enlaces: [] as EnlaceDelPerfil[],
    nombreCivilVisible: false,
    biografiaCorta: '',
    biografiaLarga: '',
    oficios: [] as string[],
    portafolio: [] as ItemDePortafolio[],
    idsOrganizaciones: [] as number[],
  };
  acepta = false;
  fotoAlt = '';
  /**
   * LA FOTO ELEGIDA ESPERA AL GUARDADO. Antes «Subir foto» la mandaba al banco al instante y
   * hacía falta «Guardar perfil» para conservarla: quien publicaba sin guardar perdía la foto, y
   * quien salía dejaba un archivo huérfano. Ahora se elige, se ve su vista previa y se sube junto con
   * el resto al pulsar «Guardar perfil» (o «Publicar», que guarda antes).
   */
  private fotoArchivo: File | null = null;
  /** Hay una foto elegida que se está subiendo (el guardado la sube primero). */
  haySubidaDeFoto(): boolean {
    return this.ocupado() && this.fotoArchivo !== null;
  }
  /** La vista previa de la foto elegida; se libera al reemplazarla o al salir. */
  readonly vistaPreviaDeFoto = signal<string | null>(null);
  /** Cómo estaba el formulario al cargarlo o guardarlo: lo que separa «hay cambios» de «no los hay». */
  private baseDelFormulario = '';

  ngOnInit(): void {
    this.servicio.mio().subscribe({
      next: perfil => this.cargar(perfil),
      error: fallo => this.error.set(traducirErrorDelServidor(fallo, { alternativa: 'No fue posible cargar tu perfil público.' }).general),
    });
    this.servicio.politica().subscribe({ next: politica => this.politica.set(politica), error: () => this.politica.set(null) });
    this.practicasServicio.listar().subscribe({ next: lista => this.practicas.set(lista ?? []), error: () => this.practicas.set([]) });
    this.adminService.cargarDivipolaPublica().subscribe({ next: filas => { this.ubicaciones.set(filas ?? []); this.sincronizarDepartamento(); }, error: () => undefined });
  }

  /** Lo que identifica el estado del formulario, para saber si hay cambios sin guardar. */
  private huellaDelFormulario(): string {
    const f = this.formulario;
    return JSON.stringify([f.nombreVisible.trim(), [...f.idsPracticas].sort(), f.codigoMunicipio, f.archivoFotoId,
      f.enlaces.map(item => [item.url.trim(), (item.etiqueta ?? '').trim()]).filter(par => par[0]),
      f.nombreCivilVisible, f.biografiaCorta.trim(), f.biografiaLarga.trim(), f.oficios,
      f.portafolio.map(item => [item.tipo, item.titulo.trim(), item.url.trim(), item.descripcion ?? '', item.anio ?? null]), [...f.idsOrganizaciones].sort(),
      this.visibilidadElegida]);
  }

  /** Hay algo escrito, elegido o quitado que todavía no está guardado. */
  hayCambios(): boolean {
    return this.perfil() !== null && (this.fotoArchivo !== null || this.huellaDelFormulario() !== this.baseDelFormulario);
  }

  avisoAlSalir(): string | null {
    return this.hayCambios() && !this.ocupado()
      ? 'Tienes cambios en tu perfil público que no guardaste. Si sales ahora se perderán.'
      : null;
  }

  @HostListener('window:beforeunload', ['$event'])
  avisarAlCerrarLaPestana(evento: BeforeUnloadEvent): void {
    if (this.avisoAlSalir()) evento.preventDefault();
  }

  ngOnDestroy(): void {
    this.soltarVistaPrevia();
  }

  private soltarVistaPrevia(): void {
    const actual = this.vistaPreviaDeFoto();
    if (actual) URL.revokeObjectURL(actual);
    this.vistaPreviaDeFoto.set(null);
  }

  private cargar(perfil: MiPerfilPublico): void {
    this.perfil.set(perfil);
    this.formulario = {
      nombreVisible: perfil.nombreVisible,
      idsPracticas: [...perfil.idsPracticas],
      codigoDepartamento: '',
      codigoMunicipio: perfil.codigoMunicipio ?? '',
      archivoFotoId: perfil.archivoFotoId,
      fotoUrl: perfil.fotoUrl,
      enlaces: enlacesDesdeDirecciones(perfil.enlaces, perfil.etiquetasDeEnlaces ?? []),
      nombreCivilVisible: perfil.nombreCivilVisible ?? false,
      biografiaCorta: perfil.biografiaCorta ?? '',
      biografiaLarga: perfil.biografiaLarga ?? '',
      oficios: [...(perfil.oficios ?? [])],
      portafolio: (perfil.portafolio ?? []).map(item => ({ ...item })),
      idsOrganizaciones: [...(perfil.idsOrganizacionesVisibles ?? [])],
    };
    if (!this.cargadoUnaVez || perfil.autorizacionVigente) {
      this.visibilidadElegida = perfil.autorizacionVigente ? (perfil.visibilidad ?? 'publico') : 'oculto';
    }
    this.cargadoUnaVez = true;
    this.fotoArchivo = null;
    this.soltarVistaPrevia();
    this.sincronizarDepartamento();
    this.baseDelFormulario = this.huellaDelFormulario();
  }

  private sincronizarDepartamento(): void {
    const codigo = this.formulario.codigoMunicipio;
    if (!codigo) return;
    const fila = this.ubicaciones().find(item => item.municipalityCode === codigo);
    if (fila) this.formulario.codigoDepartamento = fila.departmentCode;
  }

  departamentos(): { codigo: string; nombre: string }[] {
    const vistos = new Map<string, string>();
    for (const fila of this.ubicaciones()) vistos.set(fila.departmentCode, fila.departmentName);
    return [...vistos].map(([codigo, nombre]) => ({ codigo, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  municipios(): UbicacionDivipola[] {
    const departamento = this.formulario.codigoDepartamento;
    return departamento ? this.ubicaciones().filter(fila => fila.departmentCode === departamento) : [];
  }

  alCambiarDepartamento(): void {
    this.formulario.codigoMunicipio = '';
  }

  tienePractica(id: number): boolean {
    return this.formulario.idsPracticas.includes(id);
  }

  alternarPractica(id: number, marcada: boolean): void {
    const sin = this.formulario.idsPracticas.filter(item => item !== id);
    this.formulario.idsPracticas = marcada ? [...sin, id] : sin;
  }

  // ── Roles y oficios ───────────────────────────────────────────────────────────────────────
  anadirOficio(evento?: Event): void {
    evento?.preventDefault();
    const oficio = this.nuevoOficio.trim();
    if (!oficio) return;
    const repetido = this.formulario.oficios.some(item => item.toLowerCase() === oficio.toLowerCase());
    if (!repetido && this.formulario.oficios.length < this.maximoDeOficios) this.formulario.oficios = [...this.formulario.oficios, oficio];
    this.nuevoOficio = '';
  }

  quitarOficio(oficio: string): void {
    this.formulario.oficios = this.formulario.oficios.filter(item => item !== oficio);
  }

  // ── Organizaciones que decide mostrar ─────────────────────────────────────────────────────
  muestraOrganizacion(id: number): boolean {
    return this.formulario.idsOrganizaciones.includes(id);
  }

  alternarOrganizacion(id: number, marcada: boolean): void {
    const sin = this.formulario.idsOrganizaciones.filter(item => item !== id);
    this.formulario.idsOrganizaciones = marcada ? [...sin, id] : sin;
  }

  // ── Vista previa: lo mismo que verá la ficha pública, con lo que hay escrito ──────────────
  inicialesDeLaVistaPrevia(): string {
    const partes = this.formulario.nombreVisible.trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    return (partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[1][0]).toUpperCase();
  }

  lugarDeLaVistaPrevia(): string {
    const fila = this.ubicaciones().find(item => item.municipalityCode === this.formulario.codigoMunicipio);
    return fila ? `${fila.municipalityName}, ${fila.departmentName}` : '';
  }

  practicasDeLaVistaPrevia(): string[] {
    return this.practicas().filter(practica => this.formulario.idsPracticas.includes(practica.id)).map(practica => practica.nombre);
  }

  organizacionesDeLaVistaPrevia(): string[] {
    const p = this.perfil();
    return (p?.organizaciones ?? []).filter(organizacion => this.formulario.idsOrganizaciones.includes(organizacion.id)).map(organizacion => organizacion.nombre);
  }

  portafolioDeLaVistaPrevia(): ItemDePortafolio[] {
    return this.formulario.portafolio.filter(item => item.titulo.trim() && item.url.trim());
  }

  etiquetaDeClase(tipo: string): string {
    return etiquetaDeTipoDePortafolio(tipo);
  }

  rotuloDeEnlace(enlace: EnlaceDelPerfil): string {
    return enlace.red === 'otro' ? (enlace.etiqueta?.trim() || this.dominio(enlace.url)) : redDe(enlace.red).rotulo;
  }

  iconoDeEnlace(enlace: EnlaceDelPerfil): 'sitioWeb' | Exclude<EnlaceDelPerfil['red'], 'otro'> {
    return enlace.red === 'otro' ? 'sitioWeb' : enlace.red;
  }

  /** Los enlaces de la vista previa: solo los que ya tienen una dirección. */
  enlacesDeLaVistaPrevia(): EnlaceDelPerfil[] {
    return this.formulario.enlaces.filter(enlace => enlace.url.trim());
  }

  private dominio(url: string): string {
    return normalizarUrl(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || 'Enlace';
  }

  // ── Historial ─────────────────────────────────────────────────────────────────────────────
  cargarHistorial(): void {
    this.errorDeHistorial.set('');
    this.servicio.historial().subscribe({
      next: cambios => this.historial.set(cambios ?? []),
      error: fallo => this.errorDeHistorial.set(traducirErrorDelServidor(fallo, { alternativa: 'No fue posible cargar el historial.' }).general),
    });
  }

  /** Un valor del historial, legible: las listas guardadas como JSON se leen como texto corrido. */
  resumenDeCambio(valor: string | null): string {
    if (valor === null || valor === '') return 'vacío';
    if (valor.startsWith('[')) {
      try {
        const lista = JSON.parse(valor) as unknown[];
        if (!lista.length) return 'vacío';
        return lista.map(item => (typeof item === 'object' && item !== null ? (item as { titulo?: string }).titulo ?? '' : String(item))).filter(Boolean).join(', ') || `${lista.length} elementos`;
      } catch { return valor; }
    }
    return valor.length > 80 ? `${valor.slice(0, 77)}…` : valor;
  }

  trackIndice(indice: number): number {
    return indice;
  }

  elegirFoto(archivo: File): void {
    this.fotoArchivo = archivo;
    this.soltarVistaPrevia();
    this.vistaPreviaDeFoto.set(URL.createObjectURL(archivo));
    this.errores.update(actual => { const { foto, fotoAlt, archivoFotoId, ...resto } = actual; void foto; void fotoAlt; void archivoFotoId; return resto; });
  }

  quitarFoto(): void {
    this.fotoArchivo = null;
    this.soltarVistaPrevia();
    this.formulario.archivoFotoId = null;
    this.formulario.fotoUrl = null;
  }

  /**
   * UN SOLO GUARDADO QUE INCLUYE LA FOTO: valida, sube la foto elegida (si hay) y guarda el
   * perfil. `alTerminar` lo usa «Publicar» para encadenar la publicación después de guardar.
   */
  guardar(alTerminar?: () => void): void {
    this.avisoDeGuardado.set('');
    this.avisoDePublicacion.set('');
    this.error.set('');
    const errores: Record<string, string> = {};
    if (!this.formulario.nombreVisible.trim()) errores['nombreVisible'] = 'Escribe el nombre con el que quieres aparecer.';
    this.intentoDeGuardar.set(true);
    const enlaces = this.formulario.enlaces.map(item => item.url.trim()).filter(Boolean);
    const indiceMalo = erroresDeEnlaces(this.formulario.enlaces).findIndex(mensaje => mensaje !== null);
    if (indiceMalo >= 0) errores['enlaces'] = 'Corrige los enlaces señalados antes de guardar.';
    if (this.fotoArchivo && !this.fotoAlt.trim()) errores['fotoAlt'] = 'Describe la imagen para quien no puede verla.';
    // El portafolio ya viene validado elemento por elemento desde su editor.
    const portafolio = this.formulario.portafolio.map(item => ({ ...item, titulo: item.titulo.trim(), url: item.url.trim() }));
    this.errores.set(errores);
    if (Object.keys(errores).length) {
      this.enfocar(errores['nombreVisible'] ? 'perfil-nombre-visible' : errores['fotoAlt'] ? 'perfil-foto-alt' : `perfil-enlace-${Math.max(indiceMalo, 0)}`);
      return;
    }

    this.ocupado.set(true);
    const guardarPerfil = () => this.servicio.guardar({
      nombreVisible: this.formulario.nombreVisible.trim(),
      idsPracticas: this.formulario.idsPracticas,
      codigoMunicipio: this.formulario.codigoMunicipio || null,
      archivoFotoId: this.formulario.archivoFotoId,
      enlaces: enlaces.map(normalizarUrl),
      etiquetasDeEnlaces: this.formulario.enlaces.filter(item => item.url.trim()).map(item => (item.red === 'otro' ? item.etiqueta?.trim() || null : null)),
      nombreCivilVisible: this.formulario.nombreCivilVisible,
      biografiaCorta: this.formulario.biografiaCorta.trim() || null,
      biografiaLarga: this.formulario.biografiaLarga.trim() || null,
      oficios: this.formulario.oficios,
      portafolio: portafolio.map(item => ({ ...item, url: normalizarUrl(item.url), descripcion: item.descripcion?.trim() || null, anio: item.anio ?? null })),
      idsOrganizaciones: this.formulario.idsOrganizaciones,
      // «Oculto» no es un valor del servidor: se guarda con la visibilidad que ya tenía y se retira la autorización.
      visibilidad: this.visibilidadElegida === 'oculto' ? (this.perfil()?.visibilidad ?? 'publico') : this.visibilidadElegida,
    }).subscribe({
      next: perfil => {
        const queriaOcultar = this.visibilidadElegida === 'oculto' && perfil.autorizacionVigente;
        this.ocupado.set(false);
        this.cargar(perfil);
        this.avisoDeGuardado.set('Tu perfil quedó guardado.');
        this.historial.set(null);
        if (queriaOcultar) { this.ocultar(); return; }
        alTerminar?.();
      },
      error: fallo => {
        this.ocupado.set(false);
        const traducido = traducirErrorDelServidor(fallo, {
          camposConLugar: ['nombreVisible', 'idsPracticas', 'codigoMunicipio', 'archivoFotoId', 'enlaces', 'biografiaCorta', 'biografiaLarga', 'oficios', 'portafolio', 'idsOrganizaciones', 'visibilidad'],
          alternativa: 'No fue posible guardar tu perfil.',
        });
        this.errores.set(traducido.campos);
        this.error.set(traducido.general);
      },
    });

    if (!this.fotoArchivo) { guardarPerfil(); return; }
    this.servicio.subirFoto(this.fotoArchivo, this.fotoAlt.trim()).subscribe({
      next: archivo => {
        this.formulario.archivoFotoId = archivo.id;
        this.formulario.fotoUrl = archivo.url;
        this.fotoArchivo = null;
        this.fotoAlt = '';
        guardarPerfil();
      },
      error: fallo => {
        this.ocupado.set(false);
        this.errores.set({ foto: traducirErrorDelServidor(fallo, { alternativa: 'No fue posible subir la foto.' }).general });
      },
    });
  }

  /**
   * «Publicar» NO PUBLICA UN PERFIL DISTINTO DEL QUE SE VE: si hay cambios sin guardar —la
   * foto elegida, un enlace—, los guarda primero y publica después. Antes se publicaba lo último
   * guardado y la foto se perdía en silencio.
   */
  publicar(): void {
    const politica = this.politica();
    if (!politica) return;
    this.avisoDeGuardado.set('');
    this.avisoDePublicacion.set('');
    if (!this.acepta) { this.errores.set({ acepta: 'Marca la casilla para autorizar la publicación.' }); this.enfocar('perfil-acepta'); return; }
    // Autorizar es elegir que se vea: si estaba en «oculto», se publica para cualquier persona.
    if (this.visibilidadElegida === 'oculto') this.visibilidadElegida = 'publico';
    if (this.hayCambios()) { this.guardar(() => this.publicarYa(politica.version)); return; }
    this.publicarYa(politica.version);
  }

  private publicarYa(version: string): void {
    this.ocupado.set(true);
    this.servicio.publicar(version).subscribe({
      next: perfil => { this.ocupado.set(false); this.acepta = false; this.perfil.set(perfil); this.visibilidadElegida = perfil.visibilidad ?? 'publico'; this.avisoDePublicacion.set('Tu perfil ya es público.'); },
      error: fallo => { this.ocupado.set(false); this.error.set(traducirErrorDelServidor(fallo, { alternativa: 'No fue posible publicar tu perfil.' }).general); },
    });
  }

  ocultar(): void {
    this.ocupado.set(true);
    this.servicio.ocultar().subscribe({
      next: perfil => { this.ocupado.set(false); this.perfil.set(perfil); this.avisoDePublicacion.set('Tu perfil dejó de ser público y retiramos la autorización.'); },
      error: fallo => { this.ocupado.set(false); this.error.set(traducirErrorDelServidor(fallo, { alternativa: 'No fue posible ocultar tu perfil.' }).general); },
    });
  }

  private enfocar(id: string): void {
    enfocarCampo(id);
  }
}
