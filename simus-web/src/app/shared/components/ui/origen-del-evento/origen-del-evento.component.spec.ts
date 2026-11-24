import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProcesoDelEvento } from '../../../../core/services/agenda.service';
import { OrigenDelEventoComponent } from './origen-del-evento.component';

describe('OrigenDelEventoComponent', () => {
  const montar = (entradas: { proceso?: ProcesoDelEvento | null; organizador?: string; lugar?: string }) => {
    TestBed.configureTestingModule({ imports: [OrigenDelEventoComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(OrigenDelEventoComponent);
    for (const [clave, valor] of Object.entries(entradas)) fixture.componentRef.setInput(clave, valor);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('pone el proceso DEBAJO de la organización, con enlace a su ficha', () => {
    const raiz = montar({
      lugar: 'Teatro Municipal',
      proceso: { tipo: 'taller', id: 4, nombre: 'Taller Barnizado', organizacionId: 9, organizacionNombre: 'Corporación Tambó' },
    });
    const textos = Array.from(raiz.querySelectorAll('dt')).map((dt) => dt.textContent?.trim());
    expect(textos).toEqual(['Dónde', 'Organiza']);
    const organiza = raiz.querySelector('[data-testid="evento-organiza"]')!;
    const proceso = organiza.querySelector('[data-testid="evento-proceso"]')!;
    expect(proceso.textContent).toContain('Taller de lutería');
    expect(proceso.querySelector('a')?.getAttribute('href')).toBe('/ecosistema/luteria/4');
    expect(organiza.querySelector('dd a')?.getAttribute('href')).toBe('/ecosistema/organizaciones/9');
    // el orden en el documento: lugar, organización, proceso
    const orden = Array.from(raiz.querySelectorAll('[data-testid]')).map((e) => e.getAttribute('data-testid'));
    expect(orden.indexOf('evento-lugar')).toBeLessThan(orden.indexOf('evento-organiza'));
    expect(orden.indexOf('evento-organiza')).toBeLessThan(orden.indexOf('evento-proceso'));
  });

  it('cada tipo de proceso enlaza a su propio directorio', () => {
    const rutas: Record<string, string> = { festival: 'festivales', mercado: 'mercados-musicales', espacio: 'espacios', red: 'redes' };
    for (const [tipo, ruta] of Object.entries(rutas)) {
      TestBed.resetTestingModule();
      const raiz = montar({ proceso: { tipo, id: 2, nombre: 'X', organizacionId: null, organizacionNombre: 'Colectivo' } });
      expect(raiz.querySelector('[data-testid="evento-proceso-enlace"]')?.getAttribute('href')).toBe(`/ecosistema/${ruta}/2`);
    }
  });

  it('sin organización, el proceso se lee solo; sin proceso, solo el organizador escrito', () => {
    expect(montar({ proceso: { tipo: 'festival', id: 1, nombre: 'Festival', organizacionId: null, organizacionNombre: null } })
      .querySelector('[data-testid="evento-proceso"] dt')?.textContent?.trim()).toBe('Festival');
    TestBed.resetTestingModule();
    const raiz = montar({ organizador: 'Fundación Cauce' });
    expect(raiz.querySelector('[data-testid="evento-organiza"]')?.textContent).toContain('Fundación Cauce');
    expect(raiz.querySelector('[data-testid="evento-proceso"]')).toBeNull();
  });
});
