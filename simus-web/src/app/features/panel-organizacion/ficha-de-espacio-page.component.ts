import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { CampoDeLaPropuesta } from '../../core/services/propuestas-de-proceso.service';

import { PropuestaDelProcesoComponent } from '../../shared/components/ui/propuesta-del-proceso/propuesta-del-proceso.component';
import { FotoDelProcesoComponent } from '../../shared/components/ui/foto-del-proceso/foto-del-proceso.component';
import { FichaDeProcesoBase, FormularioConTerritorioYFoto, TextosDeLaFicha } from './ficha-de-proceso.base';
import {
  CatalogosDeEspacio,
  GuardarEspacioSolicitud,
  AMBIENTES_DE_ESPACIO,
  Espacio,
  EspaciosService,
  etiquetaDeEstadoDeEspacio,
} from '../../core/services/espacios.service';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { SelectorMultipleComponent } from '../../shared/components/ui/selector-multiple/selector-multiple.component';
import { FechaPipe } from '../../shared/utils/fecha.pipe';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
interface FormularioDeEspacio extends FormularioConTerritorioYFoto {
  nombre: string;
  descripcion: string;
  ambiente: GuardarEspacioSolicitud['ambiente'];
  /** Texto del campo: vacío si no se sabe. */
  aforoMaximo: string;
  /** «si», «no» o vacío cuando no consta. */
  esAccesible: '' | 'si' | 'no';
  horarioYProgramacion: string;
  correoEspacio: string;
  telefonoEspacio: string;
  sitioWebEspacio: string;
  instagramEspacio: string;
  facebookEspacio: string;
  otroEnlaceEspacio: string;
  nivelCobertura: string;
  codigoDepartamento: string;
  codigoMunicipio: string;
  lugarEspecifico: string;
  equipamientoIds: number[];
  tiposIds: number[];
  practicasMusicalesIds: number[];
  archivoFotoId: number | null;
  fotoUrl: string | null;
  fotoAlt: string | null;
}

const FORMULARIO_VACIO: FormularioDeEspacio = {
  nombre: '',
  descripcion: '',
  ambiente: 'cerrado',
  aforoMaximo: '',
  esAccesible: '',
  horarioYProgramacion: '',
  correoEspacio: '',
  telefonoEspacio: '',
  sitioWebEspacio: '',
  instagramEspacio: '',
  facebookEspacio: '',
  otroEnlaceEspacio: '',
  nivelCobertura: 'municipal',
  codigoDepartamento: '',
  codigoMunicipio: '',
  lugarEspecifico: '',
  equipamientoIds: [],
  tiposIds: [],
  practicasMusicalesIds: [],
  archivoFotoId: null,
  fotoUrl: null,
  fotoAlt: null,
};

/**
 * La ficha de un espacio para música en vivo en el panel: alta y edición en la misma pantalla.
 *
 * <b>UNA SOLA PANTALLA PARA DOS RESPONSABLES.</b> El espacio de una organización cuelga de
 * `/gestion/o/{id}/procesos/espacios`; el de un responsable independiente, de `/gestion/cuenta/espacios`.
 * Lo que cambia es solo a qué ruta del servidor se manda y a dónde se vuelve: el formulario y el
 * circuito son los mismos. La ruta lo declara con `data.responsable`.
 *
 * <b>LO QUE SE PUEDE HACER DEPENDE DEL ESTADO</b> y la pantalla solo ofrece lo que aplica, con el
 * diálogo de confirmación común. En borrador o con ajustes se edita y se envía; en revisión no se
 * toca (está en manos del PNMC); publicado se corrige al instante lo que es errata y un cambio
 * de fondo —nombre, ambiente, municipio, dirección, tipos— lo devuelve a revisión, y la
 * pantalla lo dice ANTES de guardar.
 */
@Component({
  selector: 'app-ficha-de-espacio-page',
  standalone: true,
  imports: [PropuestaDelProcesoComponent, FotoDelProcesoComponent, OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, BotonNativoDirective, CommonModule, FormsModule, RouterLink, FechaPipe, IndicadorDeEstadoComponent, SelectorMultipleComponent],
  templateUrl: './ficha-de-espacio-page.component.html',
})
export class FichaDeEspacioPageComponent extends FichaDeProcesoBase<Espacio, GuardarEspacioSolicitud, FormularioDeEspacio> implements OnInit {
  protected readonly servicio = inject(EspaciosService);

  readonly ambientes = AMBIENTES_DE_ESPACIO;
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;
  readonly etiquetaDeEstado = etiquetaDeEstadoDeEspacio;

  readonly espacio = this.proceso;
  readonly catalogos = signal<CatalogosDeEspacio>({ equipamiento: [], tipos: [], practicasMusicales: [] });

  constructor() {
    super();
    this.formulario.set({ ...FORMULARIO_VACIO });
  }

  protected readonly tramoDeLaRuta = 'espacios';
  protected readonly rutaDePropuestas = 'espacios' as const;
  protected readonly tipoDeProceso = 'espacio';
  protected readonly tramoPersonal = 'espacios';
  protected readonly formularioVacio = FORMULARIO_VACIO;
  protected readonly textos: TextosDeLaFicha = {
    noSePudoConsultar: 'No fue posible consultar el espacio.',
    detalleDeProponerElFondo: 'Cambiaste el nombre, el territorio, el ambiente o los tipos de un espacio publicado. '
      + 'Eso es un cambio de fondo: se guarda como una propuesta que el PNMC revisa, y el espacio sigue publicado como está hasta que decida. '
      + 'Lo demás que cambiaste se guarda ahora.',
    guardadoConCambioDeFondo: 'Guardado. El cambio de fondo quedó como propuesta: envíala al PNMC cuando esté lista.',
    detalleDeEnviar: 'El PNMC revisará el espacio y decidirá si se publica. Mientras tanto no podrás editarlo.',
    enviado: 'El espacio quedó en revisión. Te avisaremos cuando el PNMC decida.',
    detalleDeRetirarDeRevision: 'El espacio vuelve a borrador y conserva todo lo escrito. Podrás editarlo y enviarlo de nuevo.',
    volvioABorrador: 'El espacio volvió a borrador.',
    detalleDeRetirarPublicado: 'El espacio dejará de verse en el portal y en el mapa. Podrás registrarlo de nuevo si lo necesitas.',
    retiradoDelEcosistema: 'El espacio se retiró del ecosistema.',
  };

  ngOnInit(): void {
    this.cargar(this.servicio.catalogos().pipe(catchError(() => of(this.catalogos()))), catalogos => this.catalogos.set(catalogos));
  }

  protected adoptarDeLaApi(espacio: Espacio): void {
    this.formulario.set({
      nombre: espacio.nombre,
      descripcion: espacio.descripcion ?? '',
      ambiente: espacio.ambiente,
      aforoMaximo: espacio.aforoMaximo?.toString() ?? '',
      esAccesible: espacio.esAccesible === null ? '' : espacio.esAccesible ? 'si' : 'no',
      horarioYProgramacion: espacio.horarioYProgramacion ?? '',
      correoEspacio: espacio.correoEspacio ?? '',
      telefonoEspacio: espacio.telefonoEspacio ?? '',
      sitioWebEspacio: espacio.sitioWebEspacio ?? '',
      instagramEspacio: espacio.instagramEspacio ?? '',
      facebookEspacio: espacio.facebookEspacio ?? '',
      otroEnlaceEspacio: espacio.otroEnlaceEspacio ?? '',
      nivelCobertura: espacio.nivelCobertura,
      codigoDepartamento: espacio.codigoDepartamento ?? '',
      codigoMunicipio: espacio.codigoMunicipio ?? '',
      lugarEspecifico: espacio.lugarEspecifico ?? '',
      equipamientoIds: espacio.equipamiento.map(s => s.id),
      tiposIds: espacio.tipos.map(f => f.id),
      practicasMusicalesIds: espacio.practicasMusicales.map(p => p.id),
      archivoFotoId: espacio.archivoFotoId ?? null,
      fotoUrl: espacio.fotoUrl ?? null,
      fotoAlt: espacio.fotoAlt ?? null,
    });
  }

  alternar(campo: 'equipamientoIds' | 'tiposIds' | 'practicasMusicalesIds', id: number): void {
    this.formulario.update(f => {
      const actuales = f[campo];
      return { ...f, [campo]: actuales.includes(id) ? actuales.filter(x => x !== id) : [...actuales, id] };
    });
  }

  /** Lo que de fondo cambia frente al espacio publicado: es lo que se propone y no se guarda en caliente. */
  readonly diferenciaDeFondo = (): CampoDeLaPropuesta[] => {
    const e = this.espacio();
    if (!e) return [];
    const s = this.solicitud();
    return this.diferenciasEntre([
      ['nombre', this.comoTexto(e.nombre), this.comoTexto(s.nombre)],
      ['ambiente', this.comoTexto(e.ambiente), this.comoTexto(s.ambiente)],
      ['codigoDepartamento', this.comoTexto(e.codigoDepartamento), this.comoTexto(s.codigoDepartamento)],
      ['codigoMunicipio', this.comoTexto(e.codigoMunicipio), this.comoTexto(s.codigoMunicipio)],
      ['lugarEspecifico', this.comoTexto(e.lugarEspecifico), this.comoTexto(s.lugarEspecifico)],
      ['tipos', this.comoLista(e.tipos.map(x => x.id)), this.comoLista(s.tiposIds)],
    ]);
  };

  protected solicitudSinFondo(): GuardarEspacioSolicitud {
    const e = this.espacio()!;
    return {
      ...this.solicitud(),
      nombre: e.nombre,
      ambiente: e.ambiente,
      codigoDepartamento: e.codigoDepartamento,
      codigoMunicipio: e.codigoMunicipio,
      lugarEspecifico: e.lugarEspecifico,
      tiposIds: e.tipos.map(x => x.id),
    };
  }

  protected aplicarPropuestaAlFormulario(campos: CampoDeLaPropuesta[]): void {
    for (const { campoId, valorPropuesto: v } of campos) {
      this.formulario.update(f => {
        switch (campoId) {
          case 'nombre': return { ...f, nombre: v ?? '' };
          case 'ambiente': return { ...f, ambiente: (v ?? 'cerrado') as FormularioDeEspacio['ambiente'] };
          case 'codigoDepartamento': return { ...f, codigoDepartamento: v ?? '' };
          case 'codigoMunicipio': return { ...f, codigoMunicipio: v ?? '' };
          case 'lugarEspecifico': return { ...f, lugarEspecifico: v ?? '' };
          case 'tipos': return { ...f, tiposIds: this.deLista(v) };
          default: return f;
        }
      });
    }
  }

  protected solicitud(): GuardarEspacioSolicitud {
    const f = this.formulario();
    const o = (v: string) => (v.trim() ? v.trim() : null);
    const aforo = Number.parseInt(f.aforoMaximo.trim(), 10);
    return {
      nombre: f.nombre.trim(),
      descripcion: o(f.descripcion),
      ambiente: f.ambiente,
      aforoMaximo: Number.isFinite(aforo) ? aforo : null,
      esAccesible: f.esAccesible === '' ? null : f.esAccesible === 'si',
      horarioYProgramacion: o(f.horarioYProgramacion),
      correoEspacio: o(f.correoEspacio),
      telefonoEspacio: o(f.telefonoEspacio),
      sitioWebEspacio: o(f.sitioWebEspacio),
      instagramEspacio: o(f.instagramEspacio),
      facebookEspacio: o(f.facebookEspacio),
      otroEnlaceEspacio: o(f.otroEnlaceEspacio),
      // UN ESPACIO ESTA SIEMPRE EN UN MUNICIPIO: el servidor exige el nivel municipal.
      nivelCobertura: 'municipal',
      codigoDepartamento: o(f.codigoDepartamento),
      codigoMunicipio: o(f.codigoMunicipio),
      lugarEspecifico: o(f.lugarEspecifico),
      equipamientoIds: f.equipamientoIds,
      tiposIds: f.tiposIds,
      practicasMusicalesIds: f.practicasMusicalesIds,
      archivoFotoId: f.archivoFotoId,
    };
  }
}
