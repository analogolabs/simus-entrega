import { Injectable, computed, inject, signal } from '@angular/core';
import { BancoDeArchivosService, InformeDeAlmacenamiento } from './banco-de-archivos.service';
import { SessionService } from './session.service';

/** Cuánto se calla el aviso de almacenamiento tras descartarlo: siete días. */
export const DIAS_DEL_DESCARTE = 7;

const CLAVE = 'simus.almacenamiento.descartado';

/**
 * El aviso de almacenamiento de la consola (`docs/operacion/29-gestion-de-archivos.md` §29.24).
 *
 * <b>DISCRETO A PROPÓSITO.</b> Por debajo del 80 % del tope solo hay cifra; en «atención» y «alarma» hay un aviso en la gestión
 * del Banco, y en «alarma» además un punto en el inicio. Quien lo descarta no lo vuelve a ver en siete días. El descarte se recuerda
 * en el navegador, por cuenta, como ya se recuerdan las secciones plegadas de la barra: no hay tabla nueva ni correo, y
 * si el almacenamiento del navegador no está disponible, el aviso vuelve en cada visita (falla hacia avisar).
 *
 * <b>SOLO PARA QUIEN LO PUEDE VER.</b> El servidor responde 403 a la cuenta sin el módulo Auditoría y entonces no hay informe:
 * nada se pinta. Las organizaciones y el público no llaman a esta pieza.
 */
@Injectable({ providedIn: 'root' })
export class AvisoDeAlmacenamientoService {
  private readonly banco = inject(BancoDeArchivosService);
  private readonly sesion = inject(SessionService);

  readonly informe = signal<InformeDeAlmacenamiento | null>(null);
  private readonly descartadoHasta = signal(0);

  /** Si hay algo que decir (atención, alarma o proyección próxima) y no está descartado. */
  readonly hayAviso = computed(() => {
    const i = this.informe();
    return !!i && this.tieneAviso(i) && !this.descartado();
  });

  /** El punto del inicio: solo en alarma y sin descartar. */
  readonly hayAlarma = computed(() => this.informe()?.tope.nivel === 'alarma' && !this.descartado());

  /** Pide el informe; sin permiso o con un fallo no hay informe y nada se pinta. */
  async cargar(): Promise<void> {
    const resultado = await this.banco.informeDeAlmacenamiento();
    this.informe.set(resultado.ok ? resultado.data ?? null : null);
    this.descartadoHasta.set(this.leerElDescarte());
  }

  /** Oculta el aviso siete días. */
  descartar(): void {
    const hasta = Date.now() + DIAS_DEL_DESCARTE * 24 * 60 * 60 * 1000;
    try { localStorage.setItem(this.clave(), String(hasta)); } catch { /* sin almacenamiento: vuelve en la próxima visita */ }
    this.descartadoHasta.set(hasta);
  }

  /** Atención o alarma, o una proyección que llega al umbral de alarma en menos de seis meses. */
  tieneAviso(i: InformeDeAlmacenamiento): boolean {
    return i.tope.nivel === 'atencion' || i.tope.nivel === 'alarma' || i.proyeccion?.avisaDeLlegadaPronta === true;
  }

  private descartado(): boolean { return this.descartadoHasta() > Date.now(); }

  private clave(): string { return `${CLAVE}.${this.sesion.currentUser()?.id ?? 'cuenta'}`; }

  private leerElDescarte(): number {
    try { return Number(localStorage.getItem(this.clave())) || 0; } catch { return 0; }
  }
}
