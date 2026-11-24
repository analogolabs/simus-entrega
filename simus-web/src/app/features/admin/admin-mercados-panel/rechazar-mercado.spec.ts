import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminMercadosPanelComponent } from './admin-mercados-panel.component';
import { ETIQUETAS_ESTADO_MERCADO, Mercado } from '../../../core/services/mercados.service';

/**
 *: Mercados adopta «rechazado», igual que Festivales, para lo que se rechaza sin haberse
 * publicado. Se ofrece en revisión y con ajustes solicitados, y lleva motivo.
 */
describe('rechazar un mercado', () => {
  function mercado(estadoRegistro: string): Mercado {
    return { id: 7, nombre: 'Mercado de prueba', estadoRegistro } as Mercado;
  }

  function crear() {
    TestBed.configureTestingModule({
      imports: [AdminMercadosPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const componente = TestBed.createComponent(AdminMercadosPanelComponent).componentInstance;
    return { componente, http: TestBed.inject(HttpTestingController) };
  }

  it('el estado tiene nombre y filtro', () => {
    const { componente } = crear();
    expect(ETIQUETAS_ESTADO_MERCADO['rechazado']).toBe('Rechazado');
    expect(componente.FILTRO_DE_ESTADO.some(o => o.id === 'rechazado')).toBeTrue();
  });

  it('se ofrece en revisión y con ajustes, y no sobre lo publicado ni el borrador', () => {
    const { componente } = crear();
    const ofrece = (estado: string) => componente.accionesDe(mercado(estado)).some(a => a.id === 'rechazar');
    expect(ofrece('en_revision')).toBeTrue();
    expect(ofrece('ajustes_solicitados')).toBeTrue();
    expect(ofrece('publicado')).toBeFalse();
    expect(ofrece('borrador')).toBeFalse();
    expect(ofrece('rechazado')).toBeFalse();
  });

  it('manda la decisión «rechazar» con el motivo, y sin motivo no manda nada', () => {
    const { componente, http } = crear();
    componente.pedirElRechazo(mercado('ajustes_solicitados'));

    componente.rechazar('   ');
    http.expectNone(r => r.url.includes('/decision'));

    componente.rechazar('No es un mercado musical.');
    const peticion = http.expectOne(r => r.url.endsWith('/institucional/mercados/7/decision'));
    expect(peticion.request.body).toEqual({ decision: 'rechazar', motivo: 'No es un mercado musical.' });
  });
});
