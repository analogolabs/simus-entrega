import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';
import { FestivalesPublicosService } from './festivales-publicos.service';
import { CategoriaEcosistema } from './categorias-ecosistema.config';

/** La clave con que cada proceso declara de dónde sale su cifra (`countKey` de la configuración). */
export type ClaveDeConteo = NonNullable<CategoriaEcosistema['countKey']>;

/**
 * Cuántos registros publicados tiene cada directorio del Ecosistema, para el menú superior
 *: el menú dice lo que hay, y una entrada con cifra dice cuánto.
 *
 * <b>CUESTA UNA PETICIÓN DE UNA FILA POR DIRECTORIO CON CIFRA</b> (hoy cuatro: Festivales, Mercados, Lutería y Espacios). Cada listado público ya devuelve `total`, así que se
 * pide la página más pequeña y se lee ese número, igual que hace `contarPublicados()` de
 * Festivales para el Inicio. No se descarga la cartografía ni los registros, que es lo que hacía
 * `fetchMapCountsBundle()` (más de 500 KB) y lo que un menú que está en todas las pantallas no
 * puede permitirse.
 *
 * <b>UNA CIFRA QUE NO SE PUDO LEER NO SE PINTA.</b> Si un listado falla, esa entrada queda sin
 * número: un «0» inventado diría que el directorio está vacío, y no se sabe. Solo se repite el
 * intento si fallaron todas (sin red, por ejemplo); una sola carga por sesión de página.
 */
@Injectable({ providedIn: 'root' })
export class ConteosDelEcosistemaService {
  private readonly api = inject(ApiClientService);
  private readonly festivales = inject(FestivalesPublicosService);

  private readonly _conteos = signal<Partial<Record<ClaveDeConteo, number>>>({});
  /** Lo leído hasta ahora; una clave ausente significa «no se sabe», no «cero». */
  readonly conteos = this._conteos.asReadonly();

  private cargando = false;
  private cargado = false;

  /** Pide las cifras una vez. Es seguro llamarlo desde cada componente que las necesite. */
  cargar(): void {
    if (this.cargado || this.cargando) return;
    this.cargando = true;

    forkJoin({
      festivals: this.festivales.contarPublicados().pipe(catchError(() => of(null))),
      markets: this.contarDe('/api/v1/publico/mercados'),
      lutiers: this.contarDe('/api/v1/publico/talleres'),
      spaces: this.contarDe('/api/v1/publico/espacios'),
    }).subscribe(resultado => {
      this.cargando = false;
      const leidos: Partial<Record<ClaveDeConteo, number>> = {};
      for (const [clave, valor] of Object.entries(resultado)) {
        if (typeof valor === 'number') leidos[clave as ClaveDeConteo] = valor;
      }
      this._conteos.set(leidos);
      // Si no se leyó ninguna, la próxima llamada vuelve a intentarlo.
      this.cargado = Object.keys(leidos).length > 0;
    });
  }

  /** La cifra de un proceso, o `null` si no se conoce. */
  de(clave: ClaveDeConteo | undefined): number | null {
    if (!clave) return null;
    const valor = this._conteos()[clave];
    return typeof valor === 'number' ? valor : null;
  }

  private contarDe(ruta: string): Observable<number | null> {
    return this.api
      .get<{ total?: number }>(ruta, {
        params: { limit: 1, offset: 0 },
        errorFallback: 'No fue posible consultar cuántos registros hay publicados.',
      })
      .pipe(
        map(pagina => {
          const total = Number(pagina?.total);
          return Number.isFinite(total) ? total : null;
        }),
        catchError(() => of(null)),
      );
  }
}
