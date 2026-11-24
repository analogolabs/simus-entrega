import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { BancoDeArchivosService } from '../../core/services/banco-de-archivos.service';

/** Un soporte ya subido al Banco de archivos, listo para adjuntarse a la solicitud. */
export interface SoporteSubido { id: string; nombre: string }

/** Los formatos que admite un soporte: PDF o imagen, que es lo que el banco sabe reconocer. */
const ACEPTADOS = '.pdf,application/pdf,image/png,image/jpeg,image/webp';

/**
 * Adjuntar soportes a una solicitud de administración.
 *
 * <b>ANTES LA JUSTIFICACIÓN ERA TEXTO LIBRE</b> y el PNMC tenía que creerse «tenemos el acta de
 * 2019». Ahora la organización sube el acta, el afiche o el certificado al Banco de archivos —con
 * su cuota y sus comprobaciones de formato— y la solicitud los cita. La consola los descarga; nadie
 * más los ve, porque no cuelgan de nada público.
 *
 * <b>QUITAR UNO NO LO BORRA DEL BANCO</b>: solo deja de citarse. Retirarlo del banco se hace desde
 * Archivos, y el servidor lo impide mientras una solicitud lo cite.
 */
@Component({
  selector: 'app-soportes-de-solicitud',
  standalone: true,
  template: `
    <div class="mt-3" data-testid="soportes-de-solicitud">
      <label [for]="idDelCampo" class="text-sm font-bold text-slate-800">Soportes <span class="font-normal text-slate-600">(opcional, hasta {{ maximo }})</span></label>
      <p class="mt-1 text-xs text-slate-600">Actas, afiches, certificados o notas de prensa en PDF o imagen. Solo los ve el PNMC.</p>
      @if (soportes().length) {
        <ul class="mt-2 space-y-1" aria-label="Soportes adjuntos">
          @for (soporte of soportes(); track soporte.id) {
            <li class="flex items-center gap-3 text-sm text-slate-800">
              <span class="min-w-0 truncate">{{ soporte.nombre }}</span>
              <button type="button" (click)="quitar(soporte.id)" class="shrink-0 text-xs font-bold text-slate-600 hover:text-red-700 hover:underline" [attr.aria-label]="'Quitar ' + soporte.nombre">Quitar</button>
            </li>
          }
        </ul>
      }
      @if (soportes().length < maximo) {
        <input [id]="idDelCampo" type="file" multiple [accept]="aceptados" [disabled]="subiendo()" (change)="elegir($event)"
          class="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-2 file:text-sm file:font-bold file:text-morado hover:file:bg-violet-200" />
      }
      @if (subiendo()) { <p role="status" class="mt-2 text-xs text-slate-600">Subiendo al Banco de archivos…</p> }
      @if (error()) { <p role="alert" class="mt-2 text-xs font-semibold text-red-700">{{ error() }}</p> }
    </div>
  `,
})
export class SoportesDeSolicitudComponent {
  private readonly banco = inject(BancoDeArchivosService);
  private static siguiente = 0;

  /** Cuántos admite todavía: el servidor suma los que la solicitud ya tiene. */
  @Input() maximo = 5;
  /** Los identificadores de los soportes elegidos, cada vez que cambian. */
  @Output() readonly cambio = new EventEmitter<string[]>();

  readonly aceptados = ACEPTADOS;
  readonly idDelCampo = `soportes-${++SoportesDeSolicitudComponent.siguiente}`;
  readonly soportes = signal<SoporteSubido[]>([]);
  readonly subiendo = signal(false);
  readonly error = signal('');

  async elegir(evento: Event): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    const archivos = Array.from(campo.files ?? []).slice(0, Math.max(0, this.maximo - this.soportes().length));
    campo.value = '';
    if (!archivos.length) return;
    this.subiendo.set(true);
    this.error.set('');
    for (const archivo of archivos) {
      const esPdf = archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf');
      const resultado = esPdf
        ? await this.banco.subirDocumento(archivo, 'externo')
        : await this.banco.subirImagen(archivo, `Soporte de la solicitud: ${archivo.name}`, { canal: 'externo' });
      if (resultado.ok && resultado.archivo) {
        const id = String(resultado.archivo.id);
        if (!this.soportes().some(s => s.id === id)) this.soportes.update(lista => [...lista, { id, nombre: archivo.name }]);
      } else {
        this.error.set(`${archivo.name}: ${resultado.error ?? 'no fue posible subirlo.'}`);
      }
    }
    this.subiendo.set(false);
    this.cambio.emit(this.soportes().map(s => s.id));
  }

  quitar(id: string): void {
    this.soportes.update(lista => lista.filter(s => s.id !== id));
    this.cambio.emit(this.soportes().map(s => s.id));
  }

  /** Vuelve a empezar, tras enviar o cancelar la solicitud. */
  vaciar(): void {
    this.soportes.set([]);
    this.error.set('');
    this.cambio.emit([]);
  }
}
