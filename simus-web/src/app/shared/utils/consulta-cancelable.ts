import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, of, switchMap, tap } from 'rxjs';

export interface ConsultaCancelable<T, R> {
  /** Lanza una consulta; si había otra en vuelo, la cancela. */
  readonly buscar: (parametro: T) => void;
  /** El resultado de la última consulta pedida (las canceladas no lo tocan). */
  readonly resultado: Signal<R>;
  /** Hay una consulta en vuelo: para el `[cargando]` del buscador. */
  readonly cargando: Signal<boolean>;
  /** La última consulta falló (el resultado anterior se conserva). */
  readonly fallo: Signal<boolean>;
}

/**
 * Una búsqueda que consulta al servidor sin dejar peticiones viejas en vuelo (B-1). Se crea en un contexto de inyección
 * (campo de un componente o servicio) y se limpia sola al destruirse.
 *
 * El buscador común (`app-buscador-de-lista`) ya espera la pausa y no repite textos; esto cierra el otro lado: cuando
 * entra un parámetro nuevo, la petición anterior se CANCELA (`switchMap` la desuscribe y el cliente HTTP la aborta), de
 * modo que la respuesta de «festiv» nunca llega después de la de «festival» ni la pisa.
 *
 * @example
 *   protected readonly busqueda = consultaCancelable((q: string) => this.api.buscar(q), []);
 *   // plantilla: <app-buscador-de-lista [cargando]="busqueda.cargando()" (cambiar)="busqueda.buscar($event)" … />
 */
export function consultaCancelable<T, R>(consulta: (parametro: T) => Observable<R>, inicial: R): ConsultaCancelable<T, R> {
  const entrada$ = new Subject<T>();
  const resultado = signal<R>(inicial);
  const cargando = signal(false);
  const fallo = signal(false);
  entrada$.pipe(
    tap(() => { cargando.set(true); fallo.set(false); }),
    switchMap(p => consulta(p).pipe(
      tap(r => { resultado.set(r); cargando.set(false); }),
      catchError(() => { fallo.set(true); cargando.set(false); return of(null); }),
    )),
    takeUntilDestroyed(inject(DestroyRef)),
  ).subscribe();
  return { buscar: p => entrada$.next(p), resultado: resultado.asReadonly(), cargando: cargando.asReadonly(), fallo: fallo.asReadonly() };
}
