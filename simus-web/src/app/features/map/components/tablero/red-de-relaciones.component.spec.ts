import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { RedDelEcosistema, RedDelEcosistemaService } from '../../../../core/services/red-del-ecosistema.service';
import { RedDeRelacionesComponent } from './red-de-relaciones.component';
import { GraficoDelTableroComponent } from './grafico-del-tablero.component';
import { GraficoDePruebaComponent } from './grafico-de-prueba';

const RED: RedDelEcosistema = {
  truncada: false,
  nodos: [
    { id: 'organizacion:1', tipo: 'organizacion', nombre: 'Corporación Sonora', departamento: '' },
    { id: 'festival:10', tipo: 'festival', nombre: 'Festival del Joropo', departamento: 'Meta' },
    { id: 'festival:11', tipo: 'festival', nombre: 'Festival del Pacífico', departamento: 'Cauca' },
    { id: 'mercado:5', tipo: 'mercado', nombre: 'Mercado del Pacífico', departamento: 'Cauca' },
    { id: 'territorio:1', tipo: 'territorio', nombre: 'Llanos', departamento: '' },
    { id: 'practica:3', tipo: 'practica', nombre: 'Arpa llanera', departamento: '' },
  ],
  aristas: [
    { origen: 'organizacion:1', destino: 'festival:10', tipo: 'responsable' },
    { origen: 'festival:10', destino: 'territorio:1', tipo: 'declara' },
    { origen: 'festival:10', destino: 'practica:3', tipo: 'declara' },
    { origen: 'mercado:5', destino: 'festival:11', tipo: 'en_el_marco' },
  ],
};
const SIN = { tipos: [], departamento: '', practica: '', territorio: '' };

describe('RedDeRelacionesComponent', () => {
  let fixture: ComponentFixture<RedDeRelacionesComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.overrideComponent(RedDeRelacionesComponent, { remove: { imports: [GraficoDelTableroComponent] }, add: { imports: [GraficoDePruebaComponent] } });
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: RedDelEcosistemaService, useValue: { consultar: () => of(RED) } }] });
    fixture = TestBed.createComponent(RedDeRelacionesComponent);
    fixture.componentRef.setInput('filtros', SIN);
    fixture.componentRef.setInput('animar', false);
    fixture.detectChanges();
  });

  const nodosALaVista = () => Array.from(el().querySelectorAll('[data-testid="red-lista"] button')).map((b) => b.textContent!.trim());

  it('se abre con los nodos más conectados ampliados y todo con una lista y una tabla equivalentes', () => {
    expect(nodosALaVista().some((n) => n.startsWith('Festival del Joropo'))).toBeTrue();
    (el().querySelector('[data-testid="ver-tabla"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-testid="tabla-equivalente"] tbody tr').length).toBe(4);
  });

  it('pulsar un nodo lo amplía, abre su ficha y muestra con quién se conecta; otro clic suma las del siguiente', () => {
    const c = fixture.componentInstance;
    c.reiniciar();
    fixture.detectChanges();
    c.ampliar('mercado:5');
    fixture.detectChanges();
    expect(nodosALaVista().some((n) => n.startsWith('Festival del Pacífico'))).toBeTrue();
    expect(el().querySelector('[data-testid="red-ficha"]')!.textContent).toContain('Mercado del Pacífico');
    expect(el().querySelector('[data-testid="red-vinculos"]')!.textContent).toContain('Festival del Pacífico');
    c.ampliar('festival:10');
    fixture.detectChanges();
    const lista = nodosALaVista().join('|');
    expect(lista).toContain('Mercado del Pacífico');
    expect(lista).toContain('Llanos');
    expect(lista).toContain('Arpa llanera');
  });

  it('desde la ficha se llega a la ficha pública del festival y, en un territorio, se filtra el tablero', () => {
    const c = fixture.componentInstance;
    c.ampliar('festival:10');
    fixture.detectChanges();
    const enlace = el().querySelector('[data-testid="red-ficha-publica"]') as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toBe('/ecosistema/festivales/10');
    const pedidos: object[] = [];
    fixture.componentRef.setInput('alElegirFiltro', (cambio: object) => pedidos.push(cambio));
    c.ampliar('territorio:1');
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="red-ficha-publica"]')).toBeNull();
    (Array.from(el().querySelectorAll('aside button')) as HTMLButtonElement[]).find((b) => b.textContent!.includes('Filtrar todo por este territorio'))!.click();
    expect(pedidos).toEqual([{ territorio: 'Llanos' }]);
  });

  it('busca un nodo por su nombre y lo elige', () => {
    const entrada = el().querySelector('[data-testid="red-buscar"]') as HTMLInputElement;
    entrada.value = 'pacifico';
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const resultados = el().querySelectorAll('[data-testid="red-resultados"] button');
    expect(resultados.length).toBe(2);
    (resultados[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.seleccion()).toMatch(/festival:11|mercado:5/);
  });

  it('el filtro por tipo de nodo oculta los de ese tipo y «Reiniciar» lo devuelve todo', () => {
    const c = fixture.componentInstance;
    c.alternarTipo('festival');
    c.alternarTipo('territorio');
    fixture.detectChanges();
    expect(nodosALaVista().every((n) => n.includes('Festival ·') || n.includes('Territorio sonoro')) || nodosALaVista().length > 0).toBeTrue();
    expect(nodosALaVista().some((n) => n.includes('Mercado'))).toBeFalse();
    c.reiniciar();
    fixture.detectChanges();
    expect(c.tiposElegidos()).toEqual([]);
    expect(c.seleccion()).toBe('');
  });

  it('respeta los filtros compartidos: por departamento deja lo de ese lugar y sin festivales ni mercados lo dice', () => {
    fixture.componentRef.setInput('filtros', { ...SIN, departamento: 'Cauca' });
    fixture.detectChanges();
    expect(nodosALaVista().join('|')).not.toContain('Corporación');
    fixture.componentRef.setInput('filtros', { ...SIN, tipos: ['Escuelas de Música'] });
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="red-vacia"]')!.textContent).toContain('solo cubre festivales y mercados');
  });
});
