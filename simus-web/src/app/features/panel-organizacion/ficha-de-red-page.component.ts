import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { CampoDeLaPropuesta } from '../../core/services/propuestas-de-proceso.service';

import { PropuestaDelProcesoComponent } from '../../shared/components/ui/propuesta-del-proceso/propuesta-del-proceso.component';
import { FotoDelProcesoComponent } from '../../shared/components/ui/foto-del-proceso/foto-del-proceso.component';
import { FichaDeProcesoBase, FormularioConTerritorioYFoto, TextosDeLaFicha } from './ficha-de-proceso.base';
import {
  CatalogosDeRed,
  GuardarRedSolicitud,
  TIPOS_DE_NODO,
  OpcionDeRed,
  Red,
  RedesService,
  etiquetaDeEstadoDeRed,
} from '../../core/services/redes.service';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { SelectorMultipleComponent } from '../../shared/components/ui/selector-multiple/selector-multiple.component';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { sedeDelFormulario, sedeParaEnviar } from '../../core/territorio/sede-principal';
import { SedeElegida, SelectorDeSedeComponent } from '../../shared/components/ui/selector-de-sede/selector-de-sede.component';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
interface FormularioDeRed extends FormularioConTerritorioYFoto {
  nombre: string;
  descripcion: string;
  tipoDeNodo: GuardarRedSolicitud['tipoDeNodo'];
  accesoAbierto: boolean;
  acervosYColecciones: string;
  correoRed: string;
  telefonoRed: string;
  sitioWebRed: string;
  instagramRed: string;
  facebookRed: string;
  otroEnlaceRed: string;
  nivelCobertura: string;
  codigoDepartamento: string;
  codigoMunicipio: string;
  sedeCodigoDepartamento: string;
  sedeCodigoMunicipio: string;
  lugarEspecifico: string;
  formasDeAccesoIds: number[];
  formatosIds: number[];
  practicasMusicalesIds: number[];
  archivoFotoId: number | null;
  fotoUrl: string | null;
  fotoAlt: string | null;
}

const FORMULARIO_VACIO: FormularioDeRed = {
  nombre: '',
  descripcion: '',
  tipoDeNodo: 'red',
  accesoAbierto: false,
  acervosYColecciones: '',
  correoRed: '',
  telefonoRed: '',
  sitioWebRed: '',
  instagramRed: '',
  facebookRed: '',
  otroEnlaceRed: '',
  nivelCobertura: 'municipal',
  codigoDepartamento: '',
  codigoMunicipio: '',
  sedeCodigoDepartamento: '',
  sedeCodigoMunicipio: '',
  lugarEspecifico: '',
  formasDeAccesoIds: [],
  formatosIds: [],
  practicasMusicalesIds: [],
  archivoFotoId: null,
  fotoUrl: null,
  fotoAlt: null,
};

/**
 * La ficha de una red o centro de documentación en el panel: alta y edición en la misma pantalla.
 *
 * <b>UNA SOLA PANTALLA PARA DOS RESPONSABLES.</b> La red de una organización cuelga de
 * `/gestion/o/{id}/procesos/redes`; el de una persona responsable, de `/gestion/cuenta/redes`.
 * Lo que cambia es solo a qué ruta del servidor se manda y a dónde se vuelve: el formulario y el
 * circuito son los mismos. La ruta lo declara con `data.responsable`.
 *
 * <b>LO QUE SE PUEDE HACER DEPENDE DEL ESTADO</b> y la pantalla solo ofrece lo que aplica, con el
 * diálogo de confirmación común. En borrador o con ajustes se edita y se envía; en revisión no se
 * toca (está en manos del PNMC); publicado se corrige al instante lo que es errata y un cambio
 * de fondo —nombre, territorio, tipo de nodo, formas de acceso, formatos— lo devuelve a revisión, y la
 * pantalla lo dice ANTES de guardar.
 */
@Component({
  selector: 'app-ficha-de-red-page',
  standalone: true,
  imports: [PropuestaDelProcesoComponent, FotoDelProcesoComponent, OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, BotonNativoDirective, CommonModule, FormsModule, RouterLink, FechaPipe, IndicadorDeEstadoComponent, SelectorMultipleComponent, SelectorDeSedeComponent],
  templateUrl: './ficha-de-red-page.component.html',
})
export class FichaDeRedPageComponent extends FichaDeProcesoBase<Red, GuardarRedSolicitud, FormularioDeRed> implements OnInit {
  protected readonly servicio = inject(RedesService);

  readonly tiposDeNodo = TIPOS_DE_NODO;
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;
  readonly etiquetaDeEstado = etiquetaDeEstadoDeRed;

  readonly red = this.proceso;
  readonly catalogos = signal<CatalogosDeRed>({ formasDeAcceso: [], formatos: [], practicasMusicales: [] });

  /** Las formatos de primer nivel y, debajo de cada una, su subnivel. */
  readonly formatosPrincipales = computed(() => this.catalogos().formatos.filter(f => f.padreId === null));
  subniveles(padre: OpcionDeRed): OpcionDeRed[] {
    return this.catalogos().formatos.filter(f => f.padreId === padre.id);
  }

  constructor() {
    super();
    this.formulario.set({ ...FORMULARIO_VACIO });
  }

  protected readonly tramoDeLaRuta = 'redes';
  protected readonly rutaDePropuestas = 'redes' as const;
  protected readonly tipoDeProceso = 'red';
  protected readonly tramoPersonal = 'redes';
  protected readonly formularioVacio = FORMULARIO_VACIO;
  protected readonly textos: TextosDeLaFicha = {
    noSePudoConsultar: 'No fue posible consultar la red.',
    detalleDeProponerElFondo: 'Cambiaste el nombre, el territorio, el tipo de nodo, las formas de acceso o los formatos de una red publicada. '
      + 'Eso es un cambio de fondo: se guarda como una propuesta que el PNMC revisa, y la red sigue publicada como está hasta que decida. '
      + 'Lo demás que cambiaste se guarda ahora.',
    guardadoConCambioDeFondo: 'Guardado. El cambio de fondo quedó como propuesta: envíala al PNMC cuando esté lista.',
    detalleDeEnviar: 'El PNMC revisará la red y decidirá si se publica. Mientras tanto no podrás editarla.',
    enviado: 'La red quedó en revisión. Te avisaremos cuando el PNMC decida.',
    detalleDeRetirarDeRevision: 'La red vuelve a borrador y conserva todo lo escrito. Podrás editarla y enviarla de nuevo.',
    volvioABorrador: 'La red volvió a borrador.',
    detalleDeRetirarPublicado: 'La red dejará de verse en el portal y en el mapa. Podrás registrarla de nuevo si lo necesitas.',
    retiradoDelEcosistema: 'La red se retiró del ecosistema.',
  };

  ngOnInit(): void {
    this.cargar(this.servicio.catalogos().pipe(catchError(() => of(this.catalogos()))), catalogos => this.catalogos.set(catalogos));
  }

  protected adoptarDeLaApi(red: Red): void {
    this.formulario.set({
      nombre: red.nombre,
      descripcion: red.descripcion ?? '',
      tipoDeNodo: red.tipoDeNodo,
      accesoAbierto: red.accesoAbierto,
      acervosYColecciones: red.acervosYColecciones ?? '',
      correoRed: red.correoRed ?? '',
      telefonoRed: red.telefonoRed ?? '',
      sitioWebRed: red.sitioWebRed ?? '',
      instagramRed: red.instagramRed ?? '',
      facebookRed: red.facebookRed ?? '',
      otroEnlaceRed: red.otroEnlaceRed ?? '',
      nivelCobertura: red.nivelCobertura,
      codigoDepartamento: red.codigoDepartamento ?? '',
      codigoMunicipio: red.codigoMunicipio ?? '',
      ...sedeDelFormulario(red.sede),
      lugarEspecifico: red.lugarEspecifico ?? '',
      formasDeAccesoIds: red.formasDeAcceso.map(s => s.id),
      formatosIds: red.formatos.map(f => f.id),
      practicasMusicalesIds: red.practicasMusicales.map(p => p.id),
      archivoFotoId: red.archivoFotoId ?? null,
      fotoUrl: red.fotoUrl ?? null,
      fotoAlt: red.fotoAlt ?? null,
    });
  }

  alternar(campo: 'formasDeAccesoIds' | 'formatosIds' | 'practicasMusicalesIds', id: number): void {
    this.formulario.update(f => {
      const actuales = f[campo];
      return { ...f, [campo]: actuales.includes(id) ? actuales.filter(x => x !== id) : [...actuales, id] };
    });
  }

  /** Lo que de fondo cambia frente a la red publicada: es lo que se propone y no se guarda en caliente. */
  readonly diferenciaDeFondo = (): CampoDeLaPropuesta[] => {
    const r = this.red();
    if (!r) return [];
    const s = this.solicitud();
    return this.diferenciasEntre([
      ['nombre', this.comoTexto(r.nombre), this.comoTexto(s.nombre)],
      ['tipoDeNodo', this.comoTexto(r.tipoDeNodo), this.comoTexto(s.tipoDeNodo)],
      ['nivelCobertura', this.comoTexto(r.nivelCobertura), this.comoTexto(s.nivelCobertura)],
      ['codigoDepartamento', this.comoTexto(r.codigoDepartamento), this.comoTexto(s.codigoDepartamento)],
      ['codigoMunicipio', this.comoTexto(r.codigoMunicipio), this.comoTexto(s.codigoMunicipio)],
      ['formasDeAcceso', this.comoLista(r.formasDeAcceso.map(x => x.id)), this.comoLista(s.formasDeAccesoIds)],
      ['formatos', this.comoLista(r.formatos.map(x => x.id)), this.comoLista(s.formatosIds)],
    ]);
  };

  protected solicitudSinFondo(): GuardarRedSolicitud {
    const r = this.red()!;
    return {
      ...this.solicitud(),
      nombre: r.nombre,
      tipoDeNodo: r.tipoDeNodo,
      nivelCobertura: r.nivelCobertura,
      codigoDepartamento: r.codigoDepartamento,
      codigoMunicipio: r.codigoMunicipio,
      formasDeAccesoIds: r.formasDeAcceso.map(x => x.id),
      formatosIds: r.formatos.map(x => x.id),
    };
  }

  /** La sede principal, aparte de la cobertura: la elige el selector común. */
  elegirSede(sede: SedeElegida): void {
    this.formulario.update(f => ({ ...f, sedeCodigoDepartamento: sede.departamento, sedeCodigoMunicipio: sede.municipio }));
  }

  protected aplicarPropuestaAlFormulario(campos: CampoDeLaPropuesta[]): void {
    for (const { campoId, valorPropuesto: v } of campos) {
      this.formulario.update(f => {
        switch (campoId) {
          case 'nombre': return { ...f, nombre: v ?? '' };
          case 'tipoDeNodo': return { ...f, tipoDeNodo: (v ?? 'red') as FormularioDeRed['tipoDeNodo'] };
          case 'nivelCobertura': return { ...f, nivelCobertura: v ?? '' };
          case 'codigoDepartamento': return { ...f, codigoDepartamento: v ?? '' };
          case 'codigoMunicipio': return { ...f, codigoMunicipio: v ?? '' };
          case 'formasDeAcceso': return { ...f, formasDeAccesoIds: this.deLista(v) };
          case 'formatos': return { ...f, formatosIds: this.deLista(v) };
          default: return f;
        }
      });
    }
  }

  protected solicitud(): GuardarRedSolicitud {
    const f = this.formulario();
    const o = (v: string) => (v.trim() ? v.trim() : null);
    const nacional = f.nivelCobertura === 'nacional';
    const departamental = f.nivelCobertura === 'departamental';
    return {
      nombre: f.nombre.trim(),
      descripcion: o(f.descripcion),
      tipoDeNodo: f.tipoDeNodo,
      accesoAbierto: f.accesoAbierto,
      acervosYColecciones: o(f.acervosYColecciones),
      correoRed: o(f.correoRed),
      telefonoRed: o(f.telefonoRed),
      sitioWebRed: o(f.sitioWebRed),
      instagramRed: o(f.instagramRed),
      facebookRed: o(f.facebookRed),
      otroEnlaceRed: o(f.otroEnlaceRed),
      nivelCobertura: f.nivelCobertura,
      codigoDepartamento: nacional ? null : o(f.codigoDepartamento),
      codigoMunicipio: nacional || departamental ? null : o(f.codigoMunicipio),
      ...sedeParaEnviar(f, f.nivelCobertura, f.codigoDepartamento, f.codigoMunicipio),
      lugarEspecifico: o(f.lugarEspecifico),
      formasDeAccesoIds: f.formasDeAccesoIds,
      formatosIds: f.formatosIds,
      practicasMusicalesIds: f.practicasMusicalesIds,
      archivoFotoId: f.archivoFotoId,
    };
  }
}
