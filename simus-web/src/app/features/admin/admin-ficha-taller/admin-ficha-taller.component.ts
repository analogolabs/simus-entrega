import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { Taller, TalleresService, DecisionSobreTaller, etiquetaDeEstadoDeTaller, etiquetaDeModalidad } from '../../../core/services/talleres.service';
import { HistorialDeRegistroComponent } from '../../../shared/components/ui/historial-de-registro/historial-de-registro.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { PanelLateralComponent } from '../../../shared/components/ui/panel-lateral/panel-lateral.component';
import { NombrePropioPipe } from '../../../shared/texto/nombre-propio.pipe';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';

import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
/**
 * La ficha de un taller de lutería en la consola (`/administracion/talleres/{id}`).
 *
 * <b>AQUÍ SE DECIDE.</b> Lo que se puede hacer depende del estado y solo se ofrece lo que aplica:
 * en revisión se publica, se piden ajustes o se rechaza; publicado se retira del ecosistema. Pedir
 * ajustes, rechazar y retirar exigen un motivo, y el motivo viaja a quien responde por el taller:
 * se pide en el mismo diálogo de confirmación común, no en un segundo aviso.
 */
@Component({
  selector: 'app-admin-ficha-taller',
  standalone: true,
  imports: [BotonNativoDirective, RouterLink, FechaPipe, NombrePropioPipe, PanelLateralComponent, IndicadorDeEstadoComponent, HistorialDeRegistroComponent],
  template: `
    <app-panel-lateral [titulo]="taller()?.nombre ?? 'Taller de lutería'" contexto="Taller de lutería"
      idDelTitulo="ficha-taller-titulo" (cerrar)="cerrar.emit()">
      @if (cargando()) {
        <p role="status" class="text-sm text-slate-500">Abriendo el taller…</p>
      } @else if (taller(); as t) {
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
              <button type="button" data-testid="publicar-taller" (click)="decidir('publicar')" [disabled]="ocupado()"
                      appBoton="confirmar">Publicar</button>
              <button type="button" data-testid="pedir-ajustes-taller" (click)="decidir('ajustes')" [disabled]="ocupado()"
                      appBoton="secundaria">Pedir ajustes</button>
            }
            @if (t.estadoRegistro === 'en_revision' || t.estadoRegistro === 'ajustes_solicitados') {
              <button type="button" data-testid="rechazar-taller" (click)="decidir('rechazar')" [disabled]="ocupado()"
                      class="text-sm font-bold text-red-700 underline-offset-2 hover:underline disabled:opacity-60">Rechazar</button>
            }
            @if (t.estadoRegistro === 'publicado') {
              <a [routerLink]="['/ecosistema/luteria', t.id]" target="_blank" class="text-sm font-bold text-verde-texto no-underline hover:underline">Ver en el portal</a>
              <button type="button" data-testid="retirar-taller-consola" (click)="retirar()" [disabled]="ocupado()"
                      class="text-sm font-bold text-red-700 underline-offset-2 hover:underline disabled:opacity-60">Retirar del ecosistema</button>
            }
            @if (t.estadoRegistro === 'borrador') { <p class="text-sm text-slate-500">Está en borrador: lo completa quien lo registró.</p> }
            @if (t.estadoRegistro === 'ajustes_solicitados') { <p class="text-sm text-slate-500">Esperando que su responsable atienda los ajustes pedidos.</p> }
          </section>

          @if (t.fotoUrl) {
            <img [src]="t.fotoUrl" [alt]="t.fotoAlt || 'Foto del taller'" width="320" height="224" class="mb-4 max-h-56 w-auto rounded-lg border border-slate-200 object-cover" data-foto-del-taller />
          }
          <dl class="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div><dt class="text-xs font-bold text-slate-500">Responsable</dt>
              <dd class="mt-0.5">@if (t.organizacionNombre) { {{ t.organizacionNombre }} } @else { {{ t.responsableNombre || 'Una persona' }} (lutier independiente) }</dd></div>
            <div><dt class="text-xs font-bold text-slate-500">Modalidad</dt><dd class="mt-0.5">{{ modalidad(t) }}{{ t.recibeAprendices ? ' · recibe aprendices' : '' }}</dd></div>
            <div><dt class="text-xs font-bold text-slate-500">Territorio</dt><dd class="mt-0.5">{{ territorio(t) | nombrePropio }}{{ t.lugarEspecifico ? ' · ' + t.lugarEspecifico : '' }}</dd></div>
            <div><dt class="text-xs font-bold text-slate-500">Contacto</dt>
              <dd class="mt-0.5">{{ contacto(t) || 'Sin datos de contacto' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Descripción</dt>
              <dd class="mt-0.5 whitespace-pre-line">{{ t.descripcion || 'Sin descripción.' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Servicios</dt>
              <dd class="mt-0.5">{{ nombres(t.servicios) || 'Ninguno elegido' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Familias de instrumentos</dt>
              <dd class="mt-0.5">{{ nombres(t.familias) || 'Ninguna elegida' }}</dd></div>
            @if (t.practicasMusicales.length) {
              <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Prácticas musicales</dt>
                <dd class="mt-0.5">{{ nombres(t.practicasMusicales) }}</dd></div>
            }
            @if (t.saberesYTecnicas) {
              <div class="sm:col-span-2"><dt class="text-xs font-bold text-slate-500">Saberes y técnicas</dt>
                <dd class="mt-0.5 whitespace-pre-line">{{ t.saberesYTecnicas }}</dd></div>
            }
          </dl>

          <button type="button" data-testid="abrir-historial-taller" (click)="historialAbierto.set(true)"
                  appBoton="secundaria">Ver historial</button>
          @if (historialAbierto()) {
            <app-historial-de-registro
              [titulo]="t.nombre"
              [registro]="{ tabla: 'Talleres', id: t.id }"
              [cambiosDe]="{ moduloId: 'talleres', registroId: t.id }"
              (cerrar)="historialAbierto.set(false)"></app-historial-de-registro>
          }
        </div>
      } @else {
        <p role="alert" class="border border-red-300 bg-red-50 p-3 text-sm text-red-800">{{ error() || 'No encontramos ese taller.' }}</p>
      }
    </app-panel-lateral>
  `,
})
export class AdminFichaTallerComponent implements OnInit {
  private readonly servicio = inject(TalleresService);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  readonly tallerId = input.required<string>();
  readonly cerrar = output<void>();
  /** Se decidió: la lista debe recargarse. */
  readonly decidido = output<void>();

  readonly taller = signal<Taller | null>(null);
  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly historialAbierto = signal(false);

  readonly etiquetaDeEstado = etiquetaDeEstadoDeTaller;
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  readonly esPublicado = computed(() => this.taller()?.estadoRegistro === 'publicado');

  ngOnInit(): void {
    this.servicio.obtenerEnLaConsola(this.tallerId()).subscribe({
      next: t => { this.taller.set(t); this.cargando.set(false); },
      error: fallo => {
        this.cargando.set(false);
        this.error.set((fallo as { message?: string })?.message ?? 'No fue posible consultar el taller.');
      },
    });
  }

  modalidad(t: Taller): string {
    return etiquetaDeModalidad(t.modalidad);
  }

  territorio(t: Taller): string {
    if (t.nivelCobertura === 'nacional') return 'Todo el país';
    return [t.nombreMunicipio, t.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }

  nombres(lista: { nombre: string }[]): string {
    return lista.map(x => x.nombre).join(', ');
  }

  contacto(t: Taller): string {
    return [t.correoTaller, t.telefonoTaller, t.sitioWebTaller, t.instagramTaller, t.facebookTaller, t.otroEnlaceTaller]
      .filter(Boolean).join(' · ');
  }

  async decidir(decision: DecisionSobreTaller): Promise<void> {
    const t = this.taller();
    if (!t || this.ocupado()) return;
    this.error.set('');
    this.aviso.set('');

    const textos = {
      publicar: {
        titulo: 'Publicar el taller',
        detalle: 'El taller se verá en el directorio, en el mapa y en la ficha pública, y se avisará a quien lo registró.',
        accion: 'Publicar',
        tono: 'principal' as const,
        pideMotivo: false,
      },
      ajustes: {
        titulo: 'Pedir ajustes',
        detalle: 'El taller vuelve a su responsable con lo que escribas aquí. Podrá corregirlo y reenviarlo.',
        accion: 'Pedir ajustes',
        tono: 'confirmar' as const,
        pideMotivo: true,
      },
      rechazar: {
        titulo: 'Rechazar el taller',
        detalle: 'El taller no se publicará y su responsable ya no podrá editarlo. Se le avisará con el motivo.',
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
      this.taller.set(actualizado);
      this.aviso.set(decision === 'publicar' ? 'El taller quedó publicado.'
        : decision === 'ajustes' ? 'Se pidieron ajustes: el taller volvió a su responsable.'
        : 'El taller quedó rechazado.');
      this.decidido.emit();
    } catch (fallo) {
      this.error.set((fallo as { message?: string })?.message ?? 'No fue posible registrar la decisión.');
    } finally {
      this.ocupado.set(false);
    }
  }

  async retirar(): Promise<void> {
    const t = this.taller();
    if (!t || this.ocupado()) return;
    this.error.set('');
    this.aviso.set('');

    const respuesta = await this.confirmaciones.pedir({
      titulo: 'Retirar del ecosistema',
      detalle: 'El taller dejará de verse en el portal y en el mapa. Se avisará a su responsable con el motivo.',
      accion: 'Retirar',
      eventosDelProceso: { tipo: 'taller', id: t.id, ambito: 'institucional' },
      tono: 'destructiva',
      pideMotivo: true,
      rotuloDelMotivo: 'Motivo del retiro',
      motivoObligatorio: true,
    });
    if (!respuesta) return;

    this.ocupado.set(true);
    try {
      this.taller.set(await this.servicio.archivar(t.id, respuesta.motivo));
      this.aviso.set('El taller se retiró del ecosistema.');
      this.decidido.emit();
    } catch (fallo) {
      this.error.set((fallo as { message?: string })?.message ?? 'No fue posible retirar el taller.');
    } finally {
      this.ocupado.set(false);
    }
  }
}
