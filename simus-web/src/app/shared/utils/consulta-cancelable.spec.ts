import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, throwError } from 'rxjs';
import { consultaCancelable } from './consulta-cancelable';

describe('consultaCancelable', () => {
  function crear(consulta: (p: string) => Observable<string>) {
    return runInInjectionContext(TestBed.inject(Injector), () => consultaCancelable<string, string>(consulta, ''));
  }

  /** Una petición simulada que avisa cuando se cancela (se desuscribe sin haber terminado). */
  function peticion(canceladas: string[], clave: string) {
    const origen = new Subject<string>();
    const obs = new Observable<string>(sub => {
      const s = origen.subscribe(sub);
      return () => { if (!sub.closed || !origen.closed) { canceladas.push(clave); } s.unsubscribe(); };
    });
    return { origen, obs };
  }

  it('cancela la petición anterior: una respuesta tardía de la vieja no pisa a la nueva', () => {
    const canceladas: string[] = [];
    const p: Record<string, ReturnType<typeof peticion>> = { a: peticion(canceladas, 'a'), ab: peticion(canceladas, 'ab') };
    const c = crear(t => p[t].obs);

    c.buscar('a');
    expect(c.cargando()).toBeTrue();
    c.buscar('ab');
    expect(canceladas).toEqual(['a']);

    p['a'].origen.next('resultado de a, tarde');
    expect(c.resultado()).toBe('');
    p['ab'].origen.next('resultado de ab');
    expect(c.resultado()).toBe('resultado de ab');
    expect(c.cargando()).toBeFalse();
  });

  it('un fallo no rompe el flujo: marca el fallo, conserva lo anterior y la siguiente consulta funciona', () => {
    const c = crear(t => (t === 'mal' ? throwError(() => new Error('x')) : new Observable<string>(s => { s.next(`ok ${t}`); s.complete(); })));
    c.buscar('uno');
    expect(c.resultado()).toBe('ok uno');
    c.buscar('mal');
    expect(c.fallo()).toBeTrue();
    expect(c.cargando()).toBeFalse();
    expect(c.resultado()).toBe('ok uno');
    c.buscar('dos');
    expect(c.fallo()).toBeFalse();
    expect(c.resultado()).toBe('ok dos');
  });
});
