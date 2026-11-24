import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { Red, RedesService, DecisionSobreRed, etiquetaDeEstadoDeRed, etiquetaDeTipoDeNodo } from '../../../core/services/redes.service';
import { HistorialDeRegistroComponent } from '../../../shared/components/ui/historial-de-registro/historial-de-registro.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { PanelLateralComponent } from '../../../shared/components/ui/panel-lateral/panel-lateral.component';
import { NombrePropioPipe } from '../../../shared/texto/nombre-propio.pipe';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';

import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
/**
 * La ficha de una red o centro de documentación en la consola (`/administracion/redes/{id}`).
 *
 * <b>AQUÍ SE DECIDE.</b> Lo que se puede hacer depende del estado y solo se ofrece lo que aplica:
 * en revisión se publica, se piden ajustes o se rechaza; publicado se retira del ecosistema. Pedir
 * ajustes, rechazar y retirar exigen un motivo, y el motivo viaja a quien responde por la red:
 * se pide en el mismo diálogo de confirmación común, no en un segundo aviso.
 */
@Component({
  selector: 'app-admin-ficha-red',
  standalone: true,
  imports: [BotonNativoDirective, RouterLink, FechaPipe, NombrePropioPipe, PanelLateralComponent, IndicadorDeEstadoComponent, HistorialDeRegistroComponent],
  template: `
    <app-panel-lateral [titulo]="red()?.nombre ?? 'Red o centro de documentación'" contexto="Red o centro de documentación"
      idDelTitulo="ficha-red-titulo" (cerrar)="cerrar.emit()">
      @if (cargando()) {
        <p role="status" class="text-sm text-slate-500">Abriendo la red…</p>
      } @else if (red(); as t) {
        <div class="space-y-6">
          <div class="flex flex-wrap items-center gap-3">
            <app-indicador-de-estado [etiqueta]="etiquetaDeEstado(t.estadoRegistro)" [tono]="tonoDelEstado(t.estadoRegistro)" [matiz]="matizDelEstado(t.estadoRegistro)" [conTexto]="true"></app-indicador-de-estado>
            @if (t.fechaEnvioARevision && t.estadoRegistro === 'en_revision') { <span class="text-xs text-slate-500">Enviado {{ t.fechaEnvioARevision | fecha }}</span> }
          </div>

          @if (error()) { <p role="alert" class="border border-red-300 bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
          @if (aviso()) { <p role="status" data-testid="aviso-de-decision" class="border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{{ aviso() }}</p> }
          @if (t.motivoDeLaDecision && t.estadoRegistro !== 'publicado') {
            <p class="border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><span class="font-bold">Último motivo:</span> {{ t.motivoDeLaDecision }}</p>
          }

          <section aria-label="Acciones de la revisión" class="flex flex-wrap items-center gap-3">
            @if (t.estadoRegistro === 'en_revision') {
              <button type="button" data-testid="publicar-red" (click)="decidir('publicar')" [disabled]="ocupado()"
                      appBoton="confirmar">Publicar</button>
              <button type="button" data-testid="pedir-ajustes-red" (click)="decidir('ajustes')" [disabled]="ocupado()"
                      appBoton="secundaria">Pedir ajustes</button>
            }
            @if (t.estadoRegistro === 'en_revision' || t.estadoRegistro === 'ajustes_solicitados') {
              <button type="button" data-testid="rechazar-red" (click)="decidir('rechazar')" [disabled]="ocupado()"
                      class="text-sm font-bold text-red-700 underline-offset-2 hover:underline disabled:opacity-60">Rechazar</button>
            }
            @if (t.estadoRegistro === 'publicado') {
              <a [routerLink]="['/ecosistema/redes', t.id]" target="_blank" class="text-sm font-bold text-verde-texto no-underline hover:underline">Ver en el portal</a>
              <button type="button" data-testid="retirar-red-consola" (click)="retirar()" [disabled]="ocupado()"
                      class="text-sm font-bold text-red-700 underline-offset-2 hover:underline disabled:opacity-60">Retirar del ecosistema</button>
            }
            @if (t.estadoRegistro === 'borrador') { <p class="text-sm text-slate-500">Está en borrador: lo completa quien lo registró.</p> }
            @if (t.estadoRegistro === 'ajustes_solicitados') { <p class="text-sm text-slate-500">Esperando que su responsable atienda los ajustes pedidos.</p> }
          </section>

          @if (t.fotoUrl) {
            <img [src]="t.fotoUrl" [alt]="t.fotoAlt || 'Foto del registro'" width="320" height="224" class="mb-4 max-h-56 w-auto rounded-lg border border-slate-200 object-cover" data-foto-del-proceso />
          }
          <dl class="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div><dt class="text-xs font-bold text-slate-500">Responsable</dt>
              <dd class="mt-0.5">@if (t.organizacionNombre) { {{ t.organizacionNombre }} } @else { {{ t.responsableNombre || 'Una persona' }} (persona responsable) }</dd></div>
            <div><dt class="text-xs font-bold text-slate-500">Tipo de nodo</dt><dd class="mt-0.5">{{ tipoDeNodo(t) }}{{ t.accesoAbierto ? ' · acceso abierto' : '' }}</dd></div>
            <div><dt class="text-xs font-bold text-slate-500">Territorio</dt><dd class="mt-0.5">{{ territorio(t) | nombrePropio }}{{ t.lugarEspecifico ? ' · ' + t.lugarEspecifico : '' }}</dd></div>
            <div><dt class="text-xs font-bold text-slate-500">Contacto</dt>
              <dd class="mt-0.5">{{ contacto(t) || 'Sin datos de contacto' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Descripción</dt>
              <dd class="mt-0.5 whitespace-pre-line">{{ t.descripcion || 'Sin descripción.' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Formas de acceso</dt>
              <dd class="mt-0.5">{{ nombres(t.formasDeAcceso) || 'Ninguno elegido' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Formatos de documentación</dt>
              <dd class="mt-0.5">{{ nombres(t.formatos) || 'Ninguna elegida' }}</dd></div>
            @if (t.practicasMusicales.length) {
              <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Prácticas musicales</dt>
                <dd class="mt-0.5">{{ nombres(t.practicasMusicales) }}</dd></div>
            }
            @if (t.acervosYColecciones) {
              <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Acervos y colecciones</dt>
                <dd class="mt-0.5 whitespace-pre-line">{{ t.acervosYColecciones }}</dd></div>
            }
          </dl>

          <button type="button" data-testid="abrir-historial-red" (click)="historialAbierto.set(true)"
                  appBoton="secundaria">Ver historial</button>
          @if (historialAbierto()) {
            <app-historial-de-registro
              [titulo]="t.nombre"
              [registro]="{ tabla: 'Redes', id: t.id }"
              [cambiosDe]="{ moduloId: 'redes', registroId: t.id }"
              (cerrar)="historialAbierto.set(false)"></app-historial-de-registro>
          }
        </div>
      } @else {
        <p role="alert" class="border border-red-300 bg-red-50 p-3 text-sm text-red-800">{{ error() || 'No encontramos esa red.' }}</p>
      }
    </app-panel-lateral>
  `,
})
export class AdminFichaRedComponent implements OnInit {
  private readonly servicio = inject(RedesService);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  readonly redId = input.required<string>();
  readonly cerrar = output<void>();
  /** Se decidió: la lista debe recargarse. */
  readonly decidido = output<void>();

  readonly red = signal<Red | null>(null);
  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly historialAbierto = signal(false);

  readonly etiquetaDeEstado = etiquetaDeEstadoDeRed;
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  readonly esPublicado = computed(() => this.red()?.estadoRegistro === 'publicado');

  ngOnInit(): void {
    this.servicio.obtenerEnLaConsola(this.redId()).subscribe({
      next: t => { this.red.set(t); this.cargando.set(false); },
      error: fallo => {
        this.cargando.set(false);
        this.error.set((fallo as { message?: string })?.message ?? 'No fue posible consultar la red.');
      },
    });
  }

  tipoDeNodo(t: Red): string {
    return etiquetaDeTipoDeNodo(t.tipoDeNodo);
  }

  territorio(t: Red): string {
    if (t.nivelCobertura === 'nacional') return 'Todo el país';
    return [t.nombreMunicipio, t.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }

  nombres(lista: { nombre: string }[]): string {
    return lista.map(x => x.nombre).join(', ');
  }

  contacto(t: Red): string {
    return [t.correoRed, t.telefonoRed, t.sitioWebRed, t.instagramRed, t.facebookRed, t.otroEnlaceRed]
      .filter(Boolean).join(' · ');
  }

  async decidir(decision: DecisionSobreRed): Promise<void> {
    const t = this.red();
    if (!t || this.ocupado()) return;
    this.error.set('');
    this.aviso.set('');

    const textos = {
      publicar: {
        titulo: 'Publicar la red',
        detalle: 'La red se verá en el directorio, en el mapa y en la ficha pública, y se avisará a quien lo registró.',
        accion: 'Publicar',
        tono: 'principal' as const,
        pideMotivo: false,
      },
      ajustes: {
        titulo: 'Pedir ajustes',
        detalle: 'La red vuelve a su responsable con lo que escribas aquí. Podrá corregirlo y reenviarlo.',
        accion: 'Pedir ajustes',
        tono: 'confirmar' as const,
        pideMotivo: true,
      },
      rechazar: {
        titulo: 'Rechazar la red',
        detalle: 'La red no se publicará y su responsable ya no podrá editarlo. Se le avisará con el motivo.',
        accion: 'Rechazar',
        tono: 'destructiva' as const,
        pideMotivo: true,
      },
    }[decision];

    const respuesta = await this.confirmaciones.pedir({
      titulo: textos.titulo,
      detalle: textos.detalle,
      accion: textos.accion,
      tono: textos.tono,
      pideMotivo: textos.pideMotivo,
      rotuloDelMotivo: decision === 'ajustes' ? 'Qué hay que corregir' : 'Motivo',
      motivoObligatorio: textos.pideMotivo,
    });
    if (!respuesta) return;

    this.ocupado.set(true);
    try {
      const actualizado = await this.servicio.decidir(t.id, decision, respuesta.motivo || null);
      this.red.set(actualizado);
      this.aviso.set(decision === 'publicar' ? 'La red quedó publicada.'
        : decision === 'ajustes' ? 'Se pidieron ajustes: la red volvió a su responsable.'
        : 'La red quedó rechazado.');
      this.decidido.emit();
    } catch (fallo) {
      this.error.set((fallo as { message?: string })?.message ?? 'No fue posible registrar la decisión.');
    } finally {
      this.ocupado.set(false);
    }
  }

  async retirar(): Promise<void> {
    const t = this.red();
    if (!t || this.ocupado()) return;
    this.error.set('');
    this.aviso.set('');

    const respuesta = await this.confirmaciones.pedir({
      titulo: 'Retirar del ecosistema',
      detalle: 'La red dejará de verse en el portal y en el mapa. Se avisará a su responsable con el motivo.',
      accion: 'Retirar',
      eventosDelProceso: { tipo: 'red', id: t.id, ambito: 'institucional' },
      tono: 'destructiva',
      pideMotivo: true,
      rotuloDelMotivo: 'Motivo del retiro',
      motivoObligatorio: true,
    });
    if (!respuesta) return;

    this.ocupado.set(true);
    try {
      this.red.set(await this.servicio.archivar(t.id, respuesta.motivo));
      this.aviso.set('La red se retiró del ecosistema.');
      this.decidido.emit();
    } catch (fallo) {
      this.error.set((fallo as { message?: string })?.message ?? 'No fue posible retirar la red.');
    } finally {
      this.ocupado.set(false);
    }
  }
}
