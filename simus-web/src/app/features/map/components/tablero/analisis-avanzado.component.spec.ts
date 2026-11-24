import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { RedDelEcosistemaService } from '../../../../core/services/red-del-ecosistema.service';
import { AnalisisAvanzadoComponent, FuentesDelAnalisis } from './analisis-avanzado.component';
import { GraficoDelTableroComponent } from './grafico-del-tablero.component';
import { GraficoDePruebaComponent } from './grafico-de-prueba';
import { RedDeRelacionesComponent } from './red-de-relaciones.component';

const FUENTES: FuentesDelAnalisis = [
  ['Festivales', {
    cauca: [
      { department: 'Cauca', practices: 'Marimba\u001FGaita', linkedSonorousTerritories: 'Pacífico' },
      { department: 'Cauca', practices: 'Marimba', linkedSonorousTerritories: 'Pacífico' },
    ],
    meta: [{ department: 'Meta', practices: '', linkedSonorousTerritories: '' }],
  }],
  ['Mercados Musicales', { meta: [{ department: 'Meta', practices: 'Gaita', linkedSonorousTerritories: 'Llanos' }] }],
];

describe('AnalisisAvanzadoComponent (pestañas de análisis)', () => {
  let fixture: ComponentFixture<AnalisisAvanzadoComponent>;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const pestana = (id: 'flujos' | 'redes' | 'coincidencias' | 'barras' | 'jerarquias') => {
    fixture.componentRef.setInput('vista', id);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.overrideComponent(RedDeRelacionesComponent, { remove: { imports: [GraficoDelTableroComponent] }, add: { imports: [GraficoDePruebaComponent] } });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: RedDelEcosistemaService, useValue: { consultar: () => of({ nodos: [], aristas: [], truncada: false }) } }],
    });
    fixture = TestBed.createComponent(AnalisisAvanzadoComponent);
    fixture.componentRef.setInput('fuentes', FUENTES);
    fixture.componentRef.setInput('colores', { Festivales: '#7a2f97', 'Mercados Musicales': '#c88011' });
    fixture.componentRef.setInput('animar', false);
    fixture.componentRef.setInput('vista', 'flujos');
    fixture.detectChanges();
  });

  it('ofrece el filtro por tipo de proceso con la cuenta de cada uno y lo aplica a todo', () => {
    expect(texto()).toContain('Todos (4)');
    const botones = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    botones.find((b) => b.textContent!.includes('Festivales (3)'))!.click();
    fixture.detectChanges();
    expect(texto()).toContain('3 de 4 registros publicados');
    expect(fixture.componentInstance.filtros().tipos).toEqual(['Festivales']);
  });

  it('cada pestaña muestra UNA visualización, dice qué responde y no lleva el conmutador «ver aquí / ver tabla»', () => {
    for (const [id, nombre] of [['flujos', 'Flujos'], ['coincidencias', 'Coincidencias'], ['barras', 'Barras'], ['jerarquias', 'Jerarquías']] as const) {
      pestana(id);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('app-panel-de-grafico').length).withContext(id).toBe(1);
      expect(el.querySelector('[data-testid="pestana-responde"]')!.textContent).toContain(nombre);
      expect(el.querySelector('[aria-label="Visualización del análisis avanzado"]')).toBeNull();
    }
  });

  it('cada pestaña lleva su ficha de indicador y el botón «Ver tabla» muestra de verdad la tabla equivalente', () => {
    for (const id of ['flujos', 'coincidencias', 'barras', 'jerarquias'] as const) {
      pestana(id);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid^="ficha-"]')).withContext(id).not.toBeNull();
      expect(el.querySelector('[data-testid="tabla-equivalente"]')).withContext(id).toBeNull();
      (el.querySelector('[data-testid="ver-tabla"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      const tabla = el.querySelector('[data-testid="tabla-equivalente"] table')!;
      expect(tabla).withContext(id).not.toBeNull();
      expect(tabla.querySelectorAll('tbody tr').length).withContext(id).toBeGreaterThan(0);
    }
  });

  it('las barras se agrupan por departamento, práctica o territorio y pulsar una fila filtra', () => {
    pestana('barras');
    fixture.componentInstance.ejeDeBarras.set('practicas');
    fixture.detectChanges();
    expect(texto()).toContain('Registros por práctica y tipo de proceso');
    expect(texto()).toContain('suman más que los registros');
    fixture.componentInstance.alternarEnBarras('Marimba');
    expect(fixture.componentInstance.filtros().practica).toBe('Marimba');
  });

  it('un filtro sin resultados dice que no hay registros y se puede quitar', () => {
    fixture.componentInstance.poner({ departamento: 'Chocó' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="avanzado-vacio"]')).not.toBeNull();
    fixture.componentInstance.quitar('departamento');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="avanzado-vacio"]')).toBeNull();
  });

  it('cambiar de pestaña conserva los filtros (vistas coordinadas)', () => {
    fixture.componentInstance.alternarDepartamento('Cauca');
    pestana('coincidencias');
    pestana('barras');
    expect(fixture.componentInstance.filtros().departamento).toBe('Cauca');
    expect(texto()).toContain('2 de 4 registros publicados');
  });

  it('con los filtros que guarda la página, un cambio se le pide a la página y no se guarda aquí', () => {
    const pedidos: object[] = [];
    fixture.componentRef.setInput('alCambiarFiltros', (cambio: object) => pedidos.push(cambio));
    fixture.componentRef.setInput('filtrosDeLaPagina', { tipos: [], departamento: 'Meta', practica: '', territorio: '' });
    fixture.detectChanges();
    expect(texto()).toContain('2 de 4 registros publicados');
    fixture.componentInstance.alternarTipo('Festivales');
    expect(pedidos).toEqual([{ tipos: ['Festivales'] }]);
    expect(fixture.componentInstance.filtros().departamento).toBe('Meta');
  });

  it('la pestaña Redes monta la red y no el panel de registros', () => {
    pestana('redes');
    expect(fixture.nativeElement.querySelector('app-red-de-relaciones')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-pestana="redes"]')).not.toBeNull();
  });
});
