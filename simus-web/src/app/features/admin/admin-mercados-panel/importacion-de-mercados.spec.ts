import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminMercadosPanelComponent } from './admin-mercados-panel.component';

/**
 * CON-01: la lista de Mercados ofrece la importación asistida junto a la plantilla, y es el
 * armazón de la consola —no la lista— quien abre la preparación del archivo.
 */
describe('importar mercados desde un archivo', () => {
  function crear() {
    TestBed.configureTestingModule({
      imports: [AdminMercadosPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.createComponent(AdminMercadosPanelComponent).componentInstance;
  }

  it('«Más acciones» ofrece importar y descargar la plantilla, en ese orden', () => {
    const componente = crear();
    expect(componente.ACCIONES_DE_LA_LISTA.map(accion => accion.etiqueta)).toEqual(['Importar mercados', 'Descargar la plantilla']);
  });

  it('elegir «importar» lo pide al armazón y no descarga nada', () => {
    const componente = crear();
    let pedidas = 0;
    componente.importar.subscribe(() => pedidas++);
    const descarga = spyOn(componente, 'descargarPlantilla');

    componente.elegirAccionDeLaLista('importar');

    expect(pedidas).toBe(1);
    expect(descarga).not.toHaveBeenCalled();
  });

  it('elegir la plantilla la descarga y no abre la importación', () => {
    const componente = crear();
    let pedidas = 0;
    componente.importar.subscribe(() => pedidas++);
    const descarga = spyOn(componente, 'descargarPlantilla').and.resolveTo();

    componente.elegirAccionDeLaLista('plantilla');

    expect(descarga).toHaveBeenCalledTimes(1);
    expect(pedidas).toBe(0);
  });
});
