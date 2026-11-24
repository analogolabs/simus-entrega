import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ServicioDeConfirmacion } from '../../../../core/confirmacion/servicio-de-confirmacion';
import { EstadoDeOrden, alternarOrden } from '../orden-de-lista/orden-de-lista';
import { AccionDeFila, AccionElegida } from './acciones-de-fila.component';
import { CeldaDeTablaDirective, ColumnaDeGestion, DetalleDeFilaDirective, TablaDeGestionComponent } from './tabla-de-gestion.component';

interface Fila { id: number; nombre: string; estado: string; fecha: string }

@Component({
  standalone: true,
  imports: [TablaDeGestionComponent, CeldaDeTablaDirective, DetalleDeFilaDirective],
  template: `
    <app-tabla-de-gestion etiqueta="Cosas" [tarjetasBajo]="umbral()" [columnas]="columnas" [filas]="filas" [clave]="clave" [orden]="orden()"
      (ordenar)="orden.set(alternar(orden(), $event))"
      [acciones]="acciones" [descripcionDeFila]="nombre" (accion)="elegidas.push($event)"
      [atributosDeFila]="atributos" [filaAbre]="abre()" (abrir)="abiertas.push($event.id)" [detalleAbierto]="detalle()">
      <ng-template appCelda="nombre" let-f><a class="tg-titulo" href="#fila" (click)="$event.preventDefault()">{{ f.nombre }}</a></ng-template>
      <ng-template appCelda="estado" let-f>{{ f.estado }}</ng-template>
      <ng-template appCelda="fecha" let-f>{{ f.fecha }}</ng-template>
      <ng-template appDetalleDeFila let-f><p class="detalle-de-prueba">Detalle de {{ f.nombre }}</p></ng-template>
    </app-tabla-de-gestion>`,
})
class Anfitrion {
  readonly columnas: ColumnaDeGestion[] = [
    { id: 'nombre', etiqueta: 'Nombre' },
    { id: 'estado', etiqueta: 'Estado', ancho: 'estado' },
    { id: 'fecha', etiqueta: 'Fecha', ancho: 'fecha', ordenable: false },
  ];
  filas: Fila[] = [{ id: 1, nombre: 'Uno', estado: 'Borrador', fecha: '1 nov' }, { id: 2, nombre: 'Dos', estado: 'Publicado', fecha: '2 nov' }];
  readonly orden = signal<EstadoDeOrden>({ columna: 'nombre', direccion: 'asc' });
  readonly abre = signal(true);
  readonly umbral = signal<'normal' | 'estrecho'>('normal');
  readonly detalle = signal<number | null>(null);
  readonly elegidas: { fila: Fila; accion: AccionElegida }[] = [];
  readonly abiertas: number[] = [];
  readonly alternar = alternarOrden;
  readonly clave = (f: Fila) => f.id;
  readonly nombre = (f: Fila) => f.nombre;
  readonly atributos = (f: Fila) => ({ 'data-testid': 'fila-de-prueba', 'data-estado': f.estado });
  readonly acciones = (f: Fila): AccionDeFila[] => [
    { id: 'abrir', etiqueta: 'Abrir', tono: 'principal' },
    ...(f.id === 2 ? [{ id: 'quitar', etiqueta: 'Quitar', tono: 'peligro' as const }] : []),
  ];
}

describe('TablaDeGestionComponent (P3)', () => {
  function montar() { const f = TestBed.createComponent(Anfitrion); f.detectChanges(); return f; }
  const raiz = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

  it('pinta una tabla con título accesible, cabeceras de columna y la columna «Acciones» al final', () => {
    const r = raiz(montar());
    expect(r.querySelector('caption')?.textContent).toBe('Cosas');
    const ths = Array.from(r.querySelectorAll('th[scope="col"]')).map(t => t.textContent?.replace(/[▲▼]/g, '').trim());
    expect(ths).toEqual(['Nombre', 'Estado', 'Fecha', 'Acciones']);
    expect(r.querySelectorAll('tbody tr[data-fila]').length).toBe(2);
    expect(r.querySelector('tbody tr td a.tg-titulo')?.textContent).toBe('Uno');
  });

  it('por omisión pasa a tarjetas por debajo de 40 rem; con «estrecho», solo por debajo de 28 rem (columnas angostas)', () => {
    const f = montar();
    expect(raiz(f).querySelector('table.tg')?.classList.contains('tg--estrecha')).toBeFalse();
    f.componentInstance.umbral.set('estrecho');
    f.detectChanges();
    expect(raiz(f).querySelector('table.tg')?.classList.contains('tg--estrecha')).toBeTrue();
  });

  it('los encabezados ordenables llevan aria-sort y la flecha de la columna vigente; los que no ordenan, ni botón', () => {
    const f = montar();
    const r = raiz(f);
    const th = (id: string) => r.querySelector(`[data-ordenar="${id}"]`)?.closest('th');
    expect(th('nombre')?.getAttribute('aria-sort')).toBe('ascending');
    expect(th('nombre')?.textContent).toContain('▲');
    expect(th('estado')?.getAttribute('aria-sort')).toBe('none');
    const fecha = Array.from(r.querySelectorAll('th')).find(t => t.textContent?.includes('Fecha'))!;
    expect(fecha.querySelector('button')).toBeNull();
    expect(fecha.hasAttribute('aria-sort')).toBeFalse();
    const acciones = Array.from(r.querySelectorAll('th')).find(t => t.textContent?.includes('Acciones'))!;
    expect(acciones.querySelector('button')).toBeNull();
  });

  it('pulsar el encabezado ordena: el primer clic invierte la columna vigente y otro clic elige otra en ascendente', () => {
    const f = montar();
    const r = raiz(f);
    (r.querySelector('[data-ordenar="nombre"]') as HTMLElement).click();
    f.detectChanges();
    expect(r.querySelector('[data-ordenar="nombre"]')?.closest('th')?.getAttribute('aria-sort')).toBe('descending');
    expect(r.querySelector('[data-ordenar="nombre"]')?.textContent).toContain('▼');
    (r.querySelector('[data-ordenar="estado"]') as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.orden()).toEqual({ columna: 'estado', direccion: 'asc' });
    expect(r.querySelector('[data-ordenar="estado"]')?.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('copia a la fila los atributos que pide la pantalla', () => {
    const filas = Array.from(raiz(montar()).querySelectorAll('tr[data-testid="fila-de-prueba"]'));
    expect(filas.map(t => t.getAttribute('data-estado'))).toEqual(['Borrador', 'Publicado']);
  });

  it('la fila abre el detalle con un clic, salvo si se pulsa un enlace, un botón o el menú', () => {
    const f = montar();
    const r = raiz(f);
    const celda = r.querySelector('tbody tr td:nth-child(2)') as HTMLElement;
    celda.click();
    expect(f.componentInstance.abiertas).toEqual([1]);
    (r.querySelector('tbody tr a.tg-titulo') as HTMLElement).click();
    (r.querySelector('[data-disparador-acciones]') as HTMLElement).click();
    expect(f.componentInstance.abiertas).toEqual([1]);
    f.componentInstance.abre.set(false);
    f.detectChanges();
    celda.click();
    expect(f.componentInstance.abiertas).toEqual([1]);
  });

  it('el detalle se despliega en una fila extra solo bajo la fila elegida', () => {
    const f = montar();
    const r = raiz(f);
    expect(r.querySelector('.detalle-de-prueba')).toBeNull();
    f.componentInstance.detalle.set(2);
    f.detectChanges();
    const textos = Array.from(r.querySelectorAll('.detalle-de-prueba')).map(p => p.textContent);
    expect(textos).toEqual(['Detalle de Dos']);
    expect(r.querySelector('.tg__detalle td')?.getAttribute('colspan')).toBe('4');
  });

  it('cada fila tiene UN solo control de acciones, con el nombre de la fila en su nombre accesible', () => {
    const r = raiz(montar());
    const disparadores = Array.from(r.querySelectorAll('[data-disparador-acciones]'));
    expect(disparadores.length).toBe(2);
    expect(disparadores.map(d => d.getAttribute('aria-label'))).toEqual(['Acciones de Uno', 'Acciones de Dos']);
  });

  it('una acción sin confirmación se emite al elegirla; una destructiva pide confirmar antes y se emite con su motivo', async () => {
    const f = montar();
    const r = raiz(f);
    const pedir = spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo({ motivo: 'porque sí' });

    (r.querySelectorAll('[data-disparador-acciones]')[0] as HTMLElement).click();
    f.detectChanges();
    (r.querySelector('[data-opcion-accion]') as HTMLElement).click();
    await f.whenStable();
    expect(pedir).not.toHaveBeenCalled();
    expect(f.componentInstance.elegidas.map(e => e.accion)).toEqual([{ id: 'abrir', motivo: '' }]);

    (r.querySelectorAll('[data-disparador-acciones]')[1] as HTMLElement).click();
    f.detectChanges();
    const quitar = Array.from(r.querySelectorAll<HTMLElement>('[data-opcion-accion]')).find(o => o.textContent?.includes('Quitar'))!;
    quitar.click();
    await f.whenStable();
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(pedir.calls.mostRecent().args[0].tono).toBe('destructiva');
    expect(f.componentInstance.elegidas.map(e => e.accion)).toEqual([{ id: 'abrir', motivo: '' }, { id: 'quitar', motivo: 'porque sí' }]);
  });

  it('si la persona cancela la confirmación, la acción destructiva no se emite', async () => {
    const f = montar();
    const r = raiz(f);
    spyOn(TestBed.inject(ServicioDeConfirmacion), 'pedir').and.resolveTo(null);
    (r.querySelectorAll('[data-disparador-acciones]')[1] as HTMLElement).click();
    f.detectChanges();
    Array.from(r.querySelectorAll<HTMLElement>('[data-opcion-accion]')).find(o => o.textContent?.includes('Quitar'))!.click();
    await f.whenStable();
    expect(f.componentInstance.elegidas.length).toBe(0);
  });
});
