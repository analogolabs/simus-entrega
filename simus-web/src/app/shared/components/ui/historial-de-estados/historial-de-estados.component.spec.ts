import { TestBed } from '@angular/core/testing';
import { appConfig } from '../../../../app.config';
import { EntradaDeHistorialDeEstados, HistorialDeEstadosComponent, etiquetaDeEstado } from './historial-de-estados.component';

/**: el historial de estados se lee con estado, fecha, actor y motivo, y no confunde «falló» con «vacío». */
describe('HistorialDeEstadosComponent', () => {
  // `formatDate` necesita los datos de es-CO, y los registra `appConfig`.
  beforeAll(() => expect(appConfig.providers.length).toBeGreaterThan(0));

  const DEVOLUCION: EntradaDeHistorialDeEstados = {
    id: '2', accion: 'EventoDevuelto', accionEtiqueta: 'Devuelto para corregir',
    estadoAnterior: 'en_revision', estadoNuevo: 'borrador', motivo: 'Falta la hora.',
    actor: 'Equipo del PNMC', fecha: '2026-11-05T15:00:00Z',
  };
  const ENVIO: EntradaDeHistorialDeEstados = {
    id: '1', accion: 'EventoEnviadoARevision', accionEtiqueta: 'Enviado a revisión',
    estadoAnterior: 'borrador', estadoNuevo: 'en_revision', motivo: null,
    actor: 'Ana Pérez', fecha: '2026-11-04T15:00:00Z',
  };

  function pintar(entradas: EntradaDeHistorialDeEstados[] | null | undefined, cargando = false): HTMLElement {
    TestBed.configureTestingModule({ imports: [HistorialDeEstadosComponent] });
    const fixture = TestBed.createComponent(HistorialDeEstadosComponent);
    fixture.componentRef.setInput('entradas', entradas);
    fixture.componentRef.setInput('cargando', cargando);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('cada fila dice qué pasó, de qué estado a cuál, quién, cuándo y por qué', () => {
    const raiz = pintar([DEVOLUCION, ENVIO]);
    const filas = raiz.querySelectorAll('[data-testid="historial-de-estados"] li');

    expect(filas.length).toBe(2);
    const texto = filas[0].textContent!.replace(/\s+/g, ' ');
    expect(texto).toContain('Devuelto para corregir');
    expect(texto).toContain('En revisión → Borrador');
    expect(texto).toContain('Equipo del PNMC');
    expect(texto).toContain('2026');
    expect(filas[0].querySelector('[data-motivo]')?.textContent).toContain('Falta la hora.');
    expect(filas[1].querySelector('[data-motivo]')).toBeNull();
    expect(filas[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-11-05T15:00:00Z');
  });

  it('si la consulta falló lo dice, y no lo hace pasar por un historial vacío', () => {
    const raiz = pintar(null);
    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('No fue posible consultar el historial');
    expect(raiz.textContent).not.toContain('Todavía no hay cambios');
  });

  it('sin filas lo dice, y mientras carga lo anuncia', () => {
    expect(pintar([]).textContent).toContain('Todavía no hay cambios de estado registrados.');
    TestBed.resetTestingModule();
    expect(pintar(undefined, true).querySelector('[role="status"]')?.textContent).toContain('Consultando');
  });

  it('traduce los códigos de estado y vuelve legibles los que no conoce (nunca enseña el código)', () => {
    expect(etiquetaDeEstado('en_revision')).toBe('En revisión');
    expect(etiquetaDeEstado('otro')).toBe('Otro');
    expect(etiquetaDeEstado('enviado_a_revision')).toBe('Enviado a revisión');
    expect(etiquetaDeEstado(null)).toBe('');
  });

  it('lee también los estados de los dos ejes del Catálogo Editorial (#52)', () => {
    expect(etiquetaDeEstado('pendiente_revision')).toBe('Pendiente de revisión');
    expect(etiquetaDeEstado('validada')).toBe('Validada');
    expect(etiquetaDeEstado('observada')).toBe('Observada');
    expect(etiquetaDeEstado('retirado')).toBe('Retirado');
  });
});
