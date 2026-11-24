import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { AmbitoDeCuenta, CuentaDeDemostracion } from './acceso-rapido-demo.config';

/** Campos de cada pantalla de ingreso, por su identificador en el documento. */
const CAMPOS: Record<AmbitoDeCuenta, { correo: string; clave: string }> = {
  externo: { correo: 'acceso-correo', clave: 'acceso-contrasena' },
  administrativo: { correo: 'admin-email', clave: 'admin-password' },
};

/**
 * Escribe un valor en un campo y avisa como lo haría el teclado: sin el evento `input`, `ngModel` no se
 * entera y la validación en vivo y el envío usarían el valor viejo.
 */
export function escribirEnCampo(campo: HTMLInputElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Elemento flotante TEMPORAL con las cuentas de demostración. Solo se dibuja si hay cuentas del ámbito de la
 * pantalla de ingreso que está a la vista (se detecta por sus campos); en cualquier otra pantalla no existe.
 */
@Component({
  selector: 'app-acceso-rapido-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './acceso-rapido-demo.component.css',
  template: `
    @if (ambito(); as a) {
      <aside class="ard" role="complementary" aria-label="Acceso rápido de demostración">
        <button type="button" class="ard-boton" [attr.aria-expanded]="abierto()" aria-controls="ard-lista" (click)="abierto.set(!abierto())">
          Cuentas de demostración
        </button>
        @if (abierto()) {
          <div id="ard-lista" class="ard-panel">
            <ul class="ard-lista">
              @for (c of cuentasDelAmbito(); track c.correo) {
                <li><button type="button" class="ard-cuenta" (click)="elegir(c)"><span>{{ c.rotulo }}</span><small>{{ c.correo }}</small></button></li>
              }
            </ul>
            <label class="ard-opcion"><input type="checkbox" [checked]="ingresarAlElegir()" (change)="ingresarAlElegir.set(!ingresarAlElegir())"> Ingresar al elegir</label>
            <p class="ard-estado" role="status" aria-live="polite">{{ aviso() }}</p>
          </div>
        }
      </aside>
    }
  `,
})
export class AccesoRapidoDemoComponent implements OnInit, OnDestroy {
  readonly cuentas = input.required<CuentaDeDemostracion[]>();

  private readonly anfitrion = inject(ElementRef<HTMLElement>);
  private observador: MutationObserver | null = null;
  private pendiente = 0;

  readonly ambito = signal<AmbitoDeCuenta | null>(null);
  readonly abierto = signal(false);
  readonly ingresarAlElegir = signal(false);
  readonly aviso = signal('');
  readonly cuentasDelAmbito = computed(() => this.cuentas().filter((c) => c.ambito === this.ambito()));

  ngOnInit(): void {
    this.detectar();
    this.observador = new MutationObserver(() => {
      if (this.pendiente) { return; }
      this.pendiente = window.setTimeout(() => { this.pendiente = 0; this.detectar(); }, 150);
    });
    this.observador.observe(document.body, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    if (this.pendiente) { window.clearTimeout(this.pendiente); }
  }

  /** Qué pantalla de ingreso hay a la vista: la que tiene su campo de correo y su campo de clave. */
  detectar(): void {
    let encontrado: AmbitoDeCuenta | null = null;
    for (const ambito of Object.keys(CAMPOS) as AmbitoDeCuenta[]) {
      if (document.getElementById(CAMPOS[ambito].correo) && document.getElementById(CAMPOS[ambito].clave)) { encontrado = ambito; break; }
    }
    const visible = encontrado && this.cuentas().some((c) => c.ambito === encontrado) ? encontrado : null;
    if (visible !== this.ambito()) { this.ambito.set(visible); if (!visible) { this.abierto.set(false); } }
  }

  @HostListener('document:keydown.escape')
  cerrar(): void { this.abierto.set(false); }

  elegir(cuenta: CuentaDeDemostracion): void {
    const campos = CAMPOS[cuenta.ambito];
    const correo = document.getElementById(campos.correo) as HTMLInputElement | null;
    const clave = document.getElementById(campos.clave) as HTMLInputElement | null;
    if (!correo || !clave) { this.aviso.set('No encontré el formulario.'); return; }
    escribirEnCampo(correo, cuenta.correo);
    escribirEnCampo(clave, cuenta.clave);
    this.aviso.set(`Rellenado con ${cuenta.rotulo}.`);
    if (this.ingresarAlElegir()) {
      // Después de que `ngModel` procese los eventos de entrada.
      window.setTimeout(() => correo.form?.requestSubmit(), 0);
    } else {
      clave.focus();
    }
  }
}
