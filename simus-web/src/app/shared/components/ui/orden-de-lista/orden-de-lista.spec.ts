import { TestBed } from '@angular/core/testing';
import { OrdenDeListaComponent } from './orden-de-lista.component';
import { ColumnaOrdenable, EstadoDeOrden, alternarOrden, etiquetaDeDireccion, ordenarFilas } from './orden-de-lista';

interface Fila { nombre: string; fecha: string | null; urgencia: number }

const COLUMNAS: readonly ColumnaOrdenable<Fila>[] = [
  { id: 'nombre', etiqueta: 'Nombre', tipo: 'texto', valor: f => f.nombre },
  { id: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', valor: f => f.fecha },
  { id: 'estado', etiqueta: 'Estado', tipo: 'rank', valor: f => f.urgencia },
];
const FILAS: Fila[] = [
  { nombre: 'Ñandú', fecha: '2026-11-02', urgencia: 2 },
  { nombre: 'álamo', fecha: null, urgencia: 0 },
  { nombre: 'Zorro', fecha: '2026-12-01', urgencia: 1 },
];

describe('orden de lista (P3): funciones', () => {
  it('las palabras de la dirección dependen de la clase de valor', () => {
    expect(etiquetaDeDireccion('texto', 'asc')).toBe('A–Z');
    expect(etiquetaDeDireccion('texto', 'desc')).toBe('Z–A');
    expect(etiquetaDeDireccion('fecha', 'desc')).toBe('Más reciente primero');
    expect(etiquetaDeDireccion('cerca', 'asc')).toBe('Más cercana primero');
    expect(etiquetaDeDireccion('rank', 'asc')).toBe('Más urgente primero');
    expect(etiquetaDeDireccion('num', 'desc')).toBe('Mayor primero');
  });

  it('alternar: la misma columna invierte; otra columna empieza en ascendente', () => {
    const base: EstadoDeOrden = { columna: 'fecha', direccion: 'asc' };
    expect(alternarOrden(base, 'fecha')).toEqual({ columna: 'fecha', direccion: 'desc' });
    expect(alternarOrden({ columna: 'fecha', direccion: 'desc' }, 'fecha')).toEqual({ columna: 'fecha', direccion: 'asc' });
    expect(alternarOrden({ columna: 'fecha', direccion: 'desc' }, 'nombre')).toEqual({ columna: 'nombre', direccion: 'asc' });
  });

  it('ordena sin distinguir tildes ni mayúsculas, y los vacíos van siempre al final', () => {
    expect(ordenarFilas(FILAS, COLUMNAS, { columna: 'nombre', direccion: 'asc' }).map(f => f.nombre)).toEqual(['álamo', 'Ñandú', 'Zorro']);
    expect(ordenarFilas(FILAS, COLUMNAS, { columna: 'fecha', direccion: 'asc' }).map(f => f.fecha)).toEqual(['2026-11-02', '2026-12-01', null]);
    expect(ordenarFilas(FILAS, COLUMNAS, { columna: 'fecha', direccion: 'desc' }).map(f => f.fecha)).toEqual(['2026-12-01', '2026-11-02', null]);
    expect(ordenarFilas(FILAS, COLUMNAS, { columna: 'estado', direccion: 'asc' }).map(f => f.urgencia)).toEqual([0, 1, 2]);
  });

  it('una columna desconocida deja la lista como llegó, sin mutar la original', () => {
    const copia = [...FILAS];
    expect(ordenarFilas(FILAS, COLUMNAS, { columna: 'nada', direccion: 'asc' })).toEqual(FILAS);
    expect(FILAS).toEqual(copia);
  });
});

describe('OrdenDeListaComponent (P3)', () => {
  function montar(orden: EstadoDeOrden) {
    const fixture = TestBed.createComponent(OrdenDeListaComponent);
    fixture.componentRef.setInput('columnas', COLUMNAS);
    fixture.componentRef.setInput('orden', orden);
    fixture.detectChanges();
    return fixture;
  }

  it('el botón escribe la dirección con palabras y su nombre accesible la dice', () => {
    const f = montar({ columna: 'fecha', direccion: 'desc' });
    const boton = f.nativeElement.querySelector('[data-orden-direccion]') as HTMLButtonElement;
    expect(boton.textContent).toContain('Más reciente primero');
    expect(boton.getAttribute('aria-label')).toBe('Dirección del orden: Más reciente primero. Cambiar');
  });

  it('pulsar la dirección invierte el orden de la misma columna', () => {
    const f = montar({ columna: 'nombre', direccion: 'asc' });
    let emitido: EstadoDeOrden | null = null;
    f.componentInstance.cambiar.subscribe(v => (emitido = v));
    (f.nativeElement.querySelector('[data-orden-direccion]') as HTMLButtonElement).click();
    expect(emitido as EstadoDeOrden | null).toEqual({ columna: 'nombre', direccion: 'desc' });
  });

  it('elegir otra columna reinicia a ascendente; elegir la misma no emite', () => {
    const f = montar({ columna: 'fecha', direccion: 'desc' });
    const emitidos: EstadoDeOrden[] = [];
    f.componentInstance.cambiar.subscribe(v => emitidos.push(v));
    (f.componentInstance as unknown as { elegirColumna(id: string): void }).elegirColumna('fecha');
    expect(emitidos.length).toBe(0);
    (f.componentInstance as unknown as { elegirColumna(id: string): void }).elegirColumna('nombre');
    expect(emitidos).toEqual([{ columna: 'nombre', direccion: 'asc' }]);
  });

  it('ofrece «Ordenar por» con el desplegable común', () => {
    const f = montar({ columna: 'fecha', direccion: 'asc' });
    expect(f.nativeElement.querySelector('app-filtro-desplegable')?.textContent).toContain('Ordenar por');
    expect(f.nativeElement.querySelector('app-filtro-desplegable')?.textContent).toContain('Fecha');
  });
});
