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
  CatalogosDeTaller,
  GuardarTallerSolicitud,
  MODALIDADES_DE_TALLER,
  OpcionDeTaller,
  Taller,
  TalleresService,
  etiquetaDeEstadoDeTaller,
} from '../../core/services/talleres.service';
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
interface FormularioDeTaller extends FormularioConTerritorioYFoto {
  nombre: string;
  descripcion: string;
  modalidad: GuardarTallerSolicitud['modalidad'];
  recibeAprendices: boolean;
  saberesYTecnicas: string;
  correoTaller: string;
  telefonoTaller: string;
  sitioWebTaller: string;
  instagramTaller: string;
  facebookTaller: string;
  otroEnlaceTaller: string;
  nivelCobertura: string;
  codigoDepartamento: string;
  codigoMunicipio: string;
  sedeCodigoDepartamento: string;
  sedeCodigoMunicipio: string;
  lugarEspecifico: string;
  serviciosIds: number[];
  familiasIds: number[];
  practicasMusicalesIds: number[];
  archivoFotoId: number | null;
  fotoUrl: string | null;
  fotoAlt: string | null;
}

const FORMULARIO_VACIO: FormularioDeTaller = {
  nombre: '',
  descripcion: '',
  modalidad: 'fijo',
  recibeAprendices: false,
  saberesYTecnicas: '',
  correoTaller: '',
  telefonoTaller: '',
  sitioWebTaller: '',
  instagramTaller: '',
  facebookTaller: '',
  otroEnlaceTaller: '',
  nivelCobertura: 'municipal',
  codigoDepartamento: '',
  codigoMunicipio: '',
  sedeCodigoDepartamento: '',
  sedeCodigoMunicipio: '',
  lugarEspecifico: '',
  serviciosIds: [],
  familiasIds: [],
  practicasMusicalesIds: [],
  archivoFotoId: null,
  fotoUrl: null,
  fotoAlt: null,
};

/**
 * La ficha de un taller de lutería en el panel: alta y edición en la misma pantalla.
 *
 * <b>UNA SOLA PANTALLA PARA DOS RESPONSABLES.</b> El taller de una organización cuelga de
 * `/gestion/o/{id}/procesos/luteria`; el de un lutier independiente, de `/gestion/cuenta/talleres`.
 * Lo que cambia es solo a qué ruta del servidor se manda y a dónde se vuelve: el formulario y el
 * circuito son los mismos. La ruta lo declara con `data.responsable`.
 *
 * <b>LO QUE SE PUEDE HACER DEPENDE DEL ESTADO</b> y la pantalla solo ofrece lo que aplica, con el
 * diálogo de confirmación común. En borrador o con ajustes se edita y se envía; en revisión no se
 * toca (está en manos del PNMC); publicado se corrige al instante lo que es errata y un cambio
 * de fondo —nombre, territorio, modalidad, servicios, familias— lo devuelve a revisión, y la
 * pantalla lo dice ANTES de guardar.
 */
@Component({
  selector: 'app-ficha-de-taller-page',
  standalone: true,
  imports: [PropuestaDelProcesoComponent, FotoDelProcesoComponent, OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, BotonNativoDirective, CommonModule, FormsModule, RouterLink, FechaPipe, IndicadorDeEstadoComponent, SelectorMultipleComponent, SelectorDeSedeComponent],
  templateUrl: './ficha-de-taller-page.component.html',
})
export class FichaDeTallerPageComponent extends FichaDeProcesoBase<Taller, GuardarTallerSolicitud, FormularioDeTaller> implements OnInit {
  protected readonly servicio = inject(TalleresService);

  readonly modalidades = MODALIDADES_DE_TALLER;
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;
  readonly etiquetaDeEstado = etiquetaDeEstadoDeTaller;

  readonly taller = this.proceso;
  readonly catalogos = signal<CatalogosDeTaller>({ servicios: [], familias: [], practicasMusicales: [] });

  /** Las familias de primer nivel y, debajo de cada una, su subnivel. */
  readonly familiasPrincipales = computed(() => this.catalogos().familias.filter(f => f.padreId === null));
  subniveles(padre: OpcionDeTaller): OpcionDeTaller[] {
    return this.catalogos().familias.filter(f => f.padreId === padre.id);
  }

  constructor() {
    super();
    this.formulario.set({ ...FORMULARIO_VACIO });
  }

  protected readonly tramoDeLaRuta = 'luteria';
  protected readonly rutaDePropuestas = 'talleres' as const;
  protected readonly tipoDeProceso = 'taller';
  protected readonly tramoPersonal = 'talleres';
  protected readonly formularioVacio = FORMULARIO_VACIO;
  protected readonly textos: TextosDeLaFicha = {
    noSePudoConsultar: 'No fue posible consultar el taller.',
    detalleDeProponerElFondo: 'Cambiaste el nombre, el territorio, la modalidad, los servicios o las familias de un taller publicado. '
      + 'Eso es un cambio de fondo: se guarda como una propuesta que el PNMC revisa, y el taller sigue publicado como está hasta que decida. '
      + 'Lo demás que cambiaste se guarda ahora.',
    guardadoConCambioDeFondo: 'Guardado. El cambio de fondo quedó como propuesta: envíala al PNMC cuando esté lista.',
    detalleDeEnviar: 'El PNMC revisará el taller y decidirá si se publica. Mientras tanto no podrás editarlo.',
    enviado: 'El taller quedó en revisión. Te avisaremos cuando el PNMC decida.',
    detalleDeRetirarDeRevision: 'El taller vuelve a borrador y conserva todo lo escrito. Podrás editarlo y enviarlo de nuevo.',
    volvioABorrador: 'El taller volvió a borrador.',
    detalleDeRetirarPublicado: 'El taller dejará de verse en el portal y en el mapa. Podrás registrarlo de nuevo si lo necesitas.',
    retiradoDelEcosistema: 'El taller se retiró del ecosistema.',
  };

  ngOnInit(): void {
    this.cargar(this.servicio.catalogos().pipe(catchError(() => of(this.catalogos()))), catalogos => this.catalogos.set(catalogos));
  }

  protected adoptarDeLaApi(taller: Taller): void {
    this.formulario.set({
      nombre: taller.nombre,
      descripcion: taller.descripcion ?? '',
      modalidad: taller.modalidad,
      recibeAprendices: taller.recibeAprendices,
      saberesYTecnicas: taller.saberesYTecnicas ?? '',
      correoTaller: taller.correoTaller ?? '',
      telefonoTaller: taller.telefonoTaller ?? '',
      sitioWebTaller: taller.sitioWebTaller ?? '',
      instagramTaller: taller.instagramTaller ?? '',
      facebookTaller: taller.facebookTaller ?? '',
      otroEnlaceTaller: taller.otroEnlaceTaller ?? '',
      nivelCobertura: taller.nivelCobertura,
      codigoDepartamento: taller.codigoDepartamento ?? '',
      codigoMunicipio: taller.codigoMunicipio ?? '',
      ...sedeDelFormulario(taller.sede),
      lugarEspecifico: taller.lugarEspecifico ?? '',
      serviciosIds: taller.servicios.map(s => s.id),
      familiasIds: taller.familias.map(f => f.id),
      practicasMusicalesIds: taller.practicasMusicales.map(p => p.id),
      archivoFotoId: taller.archivoFotoId ?? null,
      fotoUrl: taller.fotoUrl ?? null,
      fotoAlt: taller.fotoAlt ?? null,
    });
  }

  alternar(campo: 'serviciosIds' | 'familiasIds' | 'practicasMusicalesIds', id: number): void {
    this.formulario.update(f => {
      const actuales = f[campo];
      return { ...f, [campo]: actuales.includes(id) ? actuales.filter(x => x !== id) : [...actuales, id] };
    });
  }

  /** Lo que de fondo cambia frente al taller publicado: es lo que se propone y no se guarda en caliente. */
  readonly diferenciaDeFondo = (): CampoDeLaPropuesta[] => {
    const t = this.taller();
    if (!t) return [];
    const s = this.solicitud();
    return this.diferenciasEntre([
      ['nombre', this.comoTexto(t.nombre), this.comoTexto(s.nombre)],
      ['modalidad', this.comoTexto(t.modalidad), this.comoTexto(s.modalidad)],
      ['nivelCobertura', this.comoTexto(t.nivelCobertura), this.comoTexto(s.nivelCobertura)],
      ['codigoDepartamento', this.comoTexto(t.codigoDepartamento), this.comoTexto(s.codigoDepartamento)],
      ['codigoMunicipio', this.comoTexto(t.codigoMunicipio), this.comoTexto(s.codigoMunicipio)],
      ['servicios', this.comoLista(t.servicios.map(x => x.id)), this.comoLista(s.serviciosIds)],
      ['familias', this.comoLista(t.familias.map(x => x.id)), this.comoLista(s.familiasIds)],
    ]);
  };

  protected solicitudSinFondo(): GuardarTallerSolicitud {
    const t = this.taller()!;
    return {
      ...this.solicitud(),
      nombre: t.nombre,
      modalidad: t.modalidad,
      nivelCobertura: t.nivelCobertura,
      codigoDepartamento: t.codigoDepartamento,
      codigoMunicipio: t.codigoMunicipio,
      serviciosIds: t.servicios.map(x => x.id),
      familiasIds: t.familias.map(x => x.id),
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
          case 'modalidad': return { ...f, modalidad: (v ?? 'fijo') as FormularioDeTaller['modalidad'] };
          case 'nivelCobertura': return { ...f, nivelCobertura: v ?? '' };
          case 'codigoDepartamento': return { ...f, codigoDepartamento: v ?? '' };
          case 'codigoMunicipio': return { ...f, codigoMunicipio: v ?? '' };
          case 'servicios': return { ...f, serviciosIds: this.deLista(v) };
          case 'familias': return { ...f, familiasIds: this.deLista(v) };
          default: return f;
        }
      });
    }
  }

  protected solicitud(): GuardarTallerSolicitud {
    const f = this.formulario();
    const o = (v: string) => (v.trim() ? v.trim() : null);
    const nacional = f.nivelCobertura === 'nacional';
    const departamental = f.nivelCobertura === 'departamental';
    return {
      nombre: f.nombre.trim(),
      descripcion: o(f.descripcion),
      modalidad: f.modalidad,
      recibeAprendices: f.recibeAprendices,
      saberesYTecnicas: o(f.saberesYTecnicas),
      correoTaller: o(f.correoTaller),
      telefonoTaller: o(f.telefonoTaller),
      sitioWebTaller: o(f.sitioWebTaller),
      instagramTaller: o(f.instagramTaller),
      facebookTaller: o(f.facebookTaller),
      otroEnlaceTaller: o(f.otroEnlaceTaller),
      nivelCobertura: f.nivelCobertura,
      codigoDepartamento: nacional ? null : o(f.codigoDepartamento),
      codigoMunicipio: nacional || departamental ? null : o(f.codigoMunicipio),
      ...sedeParaEnviar(f, f.nivelCobertura, f.codigoDepartamento, f.codigoMunicipio),
      lugarEspecifico: o(f.lugarEspecifico),
      serviciosIds: f.serviciosIds,
      familiasIds: f.familiasIds,
      practicasMusicalesIds: f.practicasMusicalesIds,
      archivoFotoId: f.archivoFotoId,
    };
  }
}
