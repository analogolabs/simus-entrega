import { Subscription, TimeoutError, timeout } from 'rxjs';
import { Component, ElementRef, Injector, OnDestroy, OnInit, afterNextRender, computed, inject, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { PreguntaPublicaService } from '../../../core/services/pregunta-publica.service';
import { LucideArrowUpRight, LucideChevronUp, LucideLock, LucideSend } from '@lucide/angular';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../ui/filtro-desplegable/filtro-desplegable.component';
import { BotonNativoDirective } from '../ui/boton/boton.component';
import { EsqueletoComponent } from '../ui/esqueleto/esqueleto.component';
import { buscarPreguntas } from './buscar-preguntas';
import { MESES, reconocerParametros } from './reconocer-parametros';
import { ComoEntendiAbiertaComponent } from './como-entendi-abierta.component';
import { formatearFecha } from '../../utils/formatos-de-fecha';
import {
  ConsultaGuiadaService,
  CatalogosDeConsultaPublica,
  ConsultaEstructurada,
  EstadoDeConsultaAbierta,
  RespuestaDeConsultaAbierta,
  EstadoDeConsultaGuiadaPublica,
  ParametroDePregunta,
  PreguntaPublica,
  RespuestaDeConsultaGuiada,
  TablaDeConsulta,
} from './consulta-guiada.service';

/** Una pregunta elegida y lo que respondió el servidor (o por qué no pudo). */
interface PreguntaPendiente {
  pregunta: PreguntaPublica;
  valores: Record<string, string>;
  /** Lo que se entendió del texto escrito («Departamento: Nariño»), para que se vea qué falta. */
  entendido: string[];
  aviso: string;
}

interface TurnoPublico {
  pregunta: string;
  respuesta: RespuestaDeConsultaGuiada | null;
  error: string;
  /** Si la respondió la consulta abierta: lo que el modelo entendió, para mostrarlo y corregirlo. */
  abierta?: RespuestaDeConsultaAbierta;
  /** Preguntas verificadas cercanas cuando la consulta abierta no pudo responder. */
  sugerencias?: string[];
  /** Vuelve a hacer la misma consulta (solo cuando falló por algo transitorio: tiempo, red). */
  reintento?: () => void;
}

/** Cuánto espera la web una interpretación del modelo antes de rendirse: algo más que el límite del servidor (45 s). */
const ESPERA_MAXIMA_MS = 60_000;
/** A partir de cuánto se explica que el modelo se está preparando (el arranque en frío puede tardar). */
const ESPERA_LARGA_MS = 8_000;

/**
 * EL ASISTENTE del portal público, como un chat: el historial arriba y el campo de escribir abajo, fijo; las preguntas frecuentes
 * (las plantillas) son sugerencias.
 *
 * <b>QUÉ HACE EL CAMPO.</b> Primero reconoce en lo escrito departamentos, municipios, tipos de proceso y meses contra las preguntas
 * frecuentes (sin modelo, al instante). Si no es una de ellas y el modelo del proyecto está disponible, el modelo la interpreta; si
 * no lo está, se dice y se sugieren las preguntas más cercanas, que siguen respondiendo. Las cifras salen siempre de los datos
 * publicados, nunca del modelo: cada respuesta enseña su fuente, su alcance, la tabla de la que sale la cifra y, en cada fila, el
 * enlace a su ficha. No hay rótulos de «guiada», «asistida» o «abierta»: para la persona es una sola herramienta.
 */
@Component({
  selector: 'app-consulta-guiada-publica',
  standalone: true,
  imports: [BotonNativoDirective, ComoEntendiAbiertaComponent, EsqueletoComponent, FiltroDesplegableComponent, LucideArrowUpRight, LucideChevronUp, LucideLock, LucideSend, NgTemplateOutlet, RouterLink],
  templateUrl: './consulta-guiada-publica.component.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class ConsultaGuiadaPublicaComponent implements OnInit, OnDestroy {
  private readonly servicio = inject(ConsultaGuiadaService);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly preguntas = inject(PreguntaPublicaService);

  readonly estado = signal<EstadoDeConsultaGuiadaPublica | null>(null);
  readonly cargandoEstado = signal(true);
  readonly errorEstado = signal('');
  readonly turnos = signal<TurnoPublico[]>([]);
  readonly consultando = signal(false);
  /** La pregunta que se está respondiendo: se enseña enseguida como mensaje de la persona, antes de que llegue la respuesta. */
  readonly enCurso = signal('');
  readonly texto = signal('');
  /** La pregunta con parámetros que espera sus selectores. */
  readonly pendiente = signal<PreguntaPendiente | null>(null);
  /** El departamento que acota la lista de municipios cuando la pregunta no pide departamento. */
  readonly departamentoAuxiliar = signal('');
  /** Lo escrito se envió y no se entendió: se dice y se sugieren las más cercanas. */
  readonly noEntendido = signal(false);
  /** La consulta abierta (modelo local del proyecto): solo se ofrece si el servidor dice que está disponible. */
  readonly abierto = signal<EstadoDeConsultaAbierta | null>(null);
  /** ¿Ya se supo si el modelo está o no? Hasta entonces no se promete ni se descarta nada. */
  readonly sabeDelModelo = signal(false);
  /** La petición en curso, para poder cancelarla (cortar la espera cancela la petición HTTP). */
  private peticion: Subscription | null = null;
  /** La espera pasó de ESPERA_LARGA_MS: se explica que el modelo se está preparando. */
  readonly esperaLarga = signal(false);
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  /** Cuántas preguntas se ven sin buscar; el resto, tras «Ver todas». */
  readonly verTodas = signal(false);
  readonly visibles = 8;
  readonly meses = MESES.map((nombre, i) => ({ id: String(i + 1), nombre: nombre[0].toUpperCase() + nombre.slice(1) }));
  readonly anios = (() => { const a = new Date().getFullYear(); return [a - 2, a - 1, a, a + 1, a + 2].map(String); })();
  /** Se emite al seguir un enlace de una fila: el cajón se cierra para que se vea la ficha. */
  readonly navego = output<void>();
  private readonly router = inject(Router);

  readonly catalogos = computed<CatalogosDeConsultaPublica>(() => this.estado()?.catalogos
    ?? { departamentos: [], municipios: [], tipos: [], practicas: [], territorios: [], organizaciones: [] });
  readonly busqueda = computed(() => {
    const preguntas = this.estado()?.preguntas ?? [];
    return buscarPreguntas(preguntas, this.texto());
  });
  readonly listaVisible = computed(() => {
    const b = this.busqueda();
    const lista = b.coincidencias.length > 0 ? b.coincidencias : b.cercanas;
    return this.hayTexto() || this.verTodas() ? lista : lista.slice(0, this.visibles);
  });
  /** Los municipios que se pueden elegir: los del departamento elegido, o ninguno hasta elegirlo. */
  readonly municipiosOfrecidos = computed(() => {
    const p = this.pendiente();
    const dep = (p?.pregunta.parametros.some(x => x.nombre === 'departamento') ? p?.valores['departamento'] : '') || this.departamentoAuxiliar();
    return dep ? this.catalogos().municipios.filter(m => m[0].startsWith(dep)) : [];
  });
  readonly hayTexto = computed(() => this.texto().trim().length > 0);

  /** Convierte la ruta con filtros («/ecosistema/festivales?departamento=Meta») en algo que `routerLink` entienda. */
  destinoDe(tabla: TablaDeConsulta, indice: number): UrlTree | null {
    const ruta = tabla.destinos?.[indice];
    return ruta && ruta.startsWith('/') && !ruta.startsWith('//') ? this.router.parseUrl(ruta) : null;
  }

  ngOnInit(): void {
    this.cargarEstado();
    // Si falla o el modelo está apagado, el panel sigue como siempre, con sus preguntas frecuentes.
    this.servicio.estadoAbierto().subscribe({
      next: abierto => { this.abierto.set(abierto.modeloDisponible ? abierto : null); this.sabeDelModelo.set(true); this.responderLaSemilla(); },
      error: () => { this.abierto.set(null); this.sabeDelModelo.set(true); this.responderLaSemilla(); },
    });
    // El foco entra al campo de escribir porque es el primer control tras «Cerrar» (que `appDialogo` salta por su `aria-label`).
  }

  /** Se pulsó Enter antes de saber qué se puede responder (preguntas y modelo aún cargando): se responde en cuanto se sepa. */
  private enviarAlTenerEstado = false;

  /**
   * Una pregunta que llega de la portada («Festivales en Nariño») o escrita antes de que cargara el estado: se responde en cuanto se
   * sabe qué se puede responder (las preguntas frecuentes y si el modelo está), para no decidir «no entendí» con la mitad de los datos.
   */
  private responderLaSemilla(): void {
    if (!this.estado() || !this.sabeDelModelo()) return;
    const semilla = this.preguntas.semilla();
    if (semilla) {
      this.preguntas.semilla.set('');
      this.texto.set(semilla);
      this.enviarTexto();
    } else if (this.enviarAlTenerEstado) {
      this.enviarAlTenerEstado = false;
      this.enviarTexto();
    }
  }

  readonly maximoDePregunta = computed(() => this.abierto()?.maximoDePregunta ?? 120);

  cargarEstado(): void {
    this.cargandoEstado.set(true);
    this.errorEstado.set('');
    this.servicio.estadoPublico().subscribe({
      next: estado => {
        this.estado.set(estado);
        this.cargandoEstado.set(false);
        this.responderLaSemilla();
      },
      error: error => {
        this.errorEstado.set(this.mensajeDeError(error, 'No fue posible cargar las preguntas.'));
        this.cargandoEstado.set(false);
      },
    });
  }

  /** Un clic en una pregunta: si pide parámetros, se piden con selectores; si no, se ejecuta. */
  elegir(pregunta: PreguntaPublica): void {
    this.noEntendido.set(false);
    if ((pregunta.parametros ?? []).length === 0) { this.pendiente.set(null); this.preguntar(pregunta); return; }
    this.departamentoAuxiliar.set('');
    this.pendiente.set({ pregunta, valores: {}, entendido: [], aviso: '' });
  }

  /** Enter o «Preguntar» en el campo: reconoce los parámetros en lo escrito contra los catálogos. */
  enviarTexto(): void {
    const texto = this.texto().trim();
    if (!texto || this.consultando()) return;
    if (!this.estado() || !this.sabeDelModelo()) { this.enviarAlTenerEstado = !this.errorEstado(); return; }
    const r = reconocerParametros(texto, this.estado()?.preguntas ?? [], this.estado()?.catalogos);
    this.noEntendido.set(r.estado === 'ninguno');
    if (r.estado === 'ninguno' && this.abierto()) { this.pendiente.set(null); this.noEntendido.set(false); this.texto.set(''); this.preguntarAbierta({ pregunta: texto }, texto); return; }
    if (r.estado === 'ninguno' || !r.pregunta) { this.pendiente.set(null); return; }
    if (r.estado === 'ejecutar') { this.pendiente.set(null); this.texto.set(''); this.preguntar(r.pregunta, r.parametros); return; }
    this.departamentoAuxiliar.set('');
    this.pendiente.set({
      pregunta: r.pregunta, valores: r.parametros, entendido: r.entendido,
      aviso: r.ambiguo ? `Hay varios municipios llamados «${r.ambiguo}»: elige departamento y municipio.` : 'Falta un dato para responder: elígelo aquí.',
    });
  }

  opcionesConVacio(valores: readonly { id: string; nombre: string }[], vacio: string): OpcionDeFiltro[] {
    return [{ id: '', etiqueta: vacio }, ...valores.map(v => ({ id: v.id, etiqueta: v.nombre }))];
  }

  opcionesDe(parametro: ParametroDePregunta): OpcionDeFiltro[] {
    const c = this.catalogos();
    const vacio = parametro.obligatorio ? 'Elige una opción' : 'Cualquiera';
    switch (parametro.nombre) {
      case 'departamento': return this.opcionesConVacio(c.departamentos, vacio);
      case 'municipio': return this.opcionesConVacio(this.municipiosOfrecidos().map(([id, nombre]) => ({ id, nombre })), vacio);
      case 'tipo': return this.opcionesConVacio(c.tipos.map(t => ({ id: t.id, nombre: t.plural[0].toUpperCase() + t.plural.slice(1) })), vacio);
      case 'practica': return this.opcionesConVacio(c.practicas, vacio);
      case 'territorio': return this.opcionesConVacio(c.territorios, vacio);
      case 'organizacion': return this.opcionesConVacio(c.organizaciones, vacio);
      case 'mes': return this.opcionesConVacio(this.meses, vacio);
      default: return this.opcionesConVacio(this.anios.map(a => ({ id: a, nombre: a })), vacio);
    }
  }

  pideMunicipioSinDepartamento(p: PreguntaPendiente): boolean {
    return p.pregunta.parametros.some(x => x.nombre === 'municipio') && !p.pregunta.parametros.some(x => x.nombre === 'departamento');
  }

  poner(nombre: string, valor: string): void {
    this.pendiente.update(p => {
      if (!p) return p;
      const valores = { ...p.valores };
      if (valor) valores[nombre] = valor; else delete valores[nombre];
      // Cambiar de departamento invalida un municipio de otro.
      if (nombre === 'departamento' && valores['municipio'] && !valores['municipio'].startsWith(valor)) delete valores['municipio'];
      return { ...p, valores };
    });
  }

  ponerDepartamentoAuxiliar(valor: string): void {
    this.departamentoAuxiliar.set(valor);
    this.pendiente.update(p => {
      if (!p || !p.valores['municipio'] || p.valores['municipio'].startsWith(valor)) return p;
      const valores = { ...p.valores };
      delete valores['municipio'];
      return { ...p, valores };
    });
  }

  completa(p: PreguntaPendiente): boolean {
    return p.pregunta.parametros.every(x => !x.obligatorio || !!p.valores[x.nombre]);
  }

  confirmar(): void {
    const p = this.pendiente();
    if (!p || !this.completa(p) || this.consultando()) return;
    this.pendiente.set(null);
    this.preguntar(p.pregunta, p.valores);
  }

  /** «¿Qué festivales hay en un departamento?» + «Nariño» → lo que se muestra como pregunta del turno. */
  private rotuloDelTurno(pregunta: PreguntaPublica, valores?: Record<string, string>): string {
    const partes = (pregunta.parametros ?? [])
      .filter(p => valores?.[p.nombre])
      .map(p => p.nombre === 'municipio'
        ? this.catalogos().municipios.find(m => m[0] === valores![p.nombre])?.[1]
        : this.opcionesDe(p).find(o => o.id === valores![p.nombre])?.etiqueta);
    return partes.length > 0 ? `${pregunta.rotulo} (${partes.filter(Boolean).join(', ')})` : pregunta.rotulo;
  }

  preguntar(pregunta: PreguntaPublica, parametros?: Record<string, string>): void {
    if (this.consultando()) return;
    const rotulo = this.rotuloDelTurno(pregunta, parametros);
    this.empezarEspera(rotulo);
    this.peticion = this.servicio.consultarPublica(pregunta.id, parametros && Object.keys(parametros).length > 0 ? parametros : undefined).subscribe({
      next: respuesta => {
        this.turnos.update(turnos => [...turnos, { pregunta: rotulo, respuesta, error: '' }]);
        this.terminarEspera();
        this.mostrarLaUltima();
      },
      error: error => {
        this.turnos.update(turnos => [...turnos, { pregunta: rotulo, respuesta: null, error: this.mensajeDeError(error, 'La consulta no pudo responder.'), reintento: () => this.preguntar(pregunta, parametros) }]);
        this.terminarEspera();
        this.mostrarLaUltima();
      },
    });
  }

  /** Consulta abierta: el modelo interpreta, el servidor valida y ejecuta. `cuerpo.consulta` es una consulta ya corregida. */
  preguntarAbierta(cuerpo: { pregunta?: string; consulta?: ConsultaEstructurada }, rotulo: string): void {
    if (this.consultando()) return;
    this.empezarEspera(rotulo);
    this.peticion = this.servicio.consultarAbierta(cuerpo).pipe(timeout(ESPERA_MAXIMA_MS)).subscribe({
      next: a => {
        const turno: TurnoPublico = a.estado === 'ok' && a.tabla
          ? {
            pregunta: rotulo, error: '', abierta: a,
            respuesta: { respuesta: a.resumen ?? a.mensaje, consultaElegida: 'consulta_abierta', resueltoPor: 'banco_publico', generadoEn: new Date().toISOString(), consulta: a.tabla, contexto: 'Lo publicado en el portal' },
          }
          : { pregunta: rotulo, respuesta: null, error: a.mensaje, sugerencias: a.sugerencias, reintento: a.estado === 'ocupado' || a.estado === 'sin_modelo' ? () => this.preguntarAbierta(cuerpo, rotulo) : undefined };
        this.turnos.update(turnos => [...turnos, turno]);
        this.terminarEspera();
        this.mostrarLaUltima();
      },
      error: error => {
        const demasiado = error instanceof TimeoutError;
        this.turnos.update(turnos => [...turnos, {
          pregunta: rotulo, respuesta: null,
          error: demasiado ? 'La respuesta tardó más de lo esperado. Puedes reintentar o elegir una de las preguntas frecuentes.' : this.mensajeDeError(error, 'La consulta no pudo responder.'),
          reintento: () => this.preguntarAbierta(cuerpo, rotulo),
        }]);
        this.terminarEspera();
        this.mostrarLaUltima();
      },
    });
  }

  /** Quitar un chip: la consulta corregida se pide de nuevo sin volver a llamar al modelo. */
  corregir(consulta: ConsultaEstructurada, preguntaOriginal: string): void {
    this.preguntarAbierta({ consulta }, `${preguntaOriginal} (corregida)`);
  }

  /** Corta la espera: cancelar la suscripción cancela la petición HTTP. */
  cancelar(): void {
    this.peticion?.unsubscribe();
    this.peticion = null;
    this.terminarEspera();
  }

  private empezarEspera(rotulo: string): void {
    this.consultando.set(true);
    this.enCurso.set(rotulo);
    afterNextRender(() => { const h = this.raiz.nativeElement.querySelector('[data-historial]'); if (h) h.scrollTop = h.scrollHeight; }, { injector: this.injector });
    this.esperaLarga.set(false);
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.esperaLarga.set(true), ESPERA_LARGA_MS);
  }

  private terminarEspera(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.esperaLarga.set(false);
    this.consultando.set(false);
    this.enCurso.set('');
  }

  /** Una sugerencia es una pregunta verificada: se ejecuta como si se hubiera escrito. */
  usarSugerencia(rotulo: string): void {
    this.texto.set(rotulo);
    this.enviarTexto();
  }

  /** La respuesta queda debajo de la lista de preguntas: se lleva a la vista para que no pase desapercibida. */
  private mostrarLaUltima(): void {
    // Después de que Angular pinte el turno nuevo: antes, la respuesta todavía no existe en el DOM.
    afterNextRender(() => {
      const respuestas = this.raiz.nativeElement.querySelectorAll('[data-respuesta-publica]');
      respuestas[respuestas.length - 1]?.scrollIntoView?.({ block: 'start' });
    }, { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.cancelar();
  }

  fecha(valor: string): string {
    return formatearFecha(valor, 'fecha-hora');
  }

  private mensajeDeError(error: unknown, respaldo: string): string {
    const e = error as { status?: number | null; message?: unknown };
    if (e?.status === 429) return 'Hiciste muchas consultas seguidas. Espera un minuto y vuelve a intentarlo.';
    return typeof e?.message === 'string' && e.message.trim().length > 0 ? e.message : respaldo;
  }
}
