import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { CatalogService } from './catalog.service';
import { EspaciosParaElMapaService } from './espacios-para-el-mapa.service';
import { EventosParaElMapaService } from './eventos-para-el-mapa.service';
import { FestivalesParaElMapaService } from './festivales-para-el-mapa.service';
import { MapDataService } from './map-data.service';
import { MercadosParaElMapaService } from './mercados-para-el-mapa.service';
import { RedesParaElMapaService } from './redes-para-el-mapa.service';
import { TalleresParaElMapaService } from './talleres-para-el-mapa.service';

/**
 * El mapa no esconde una caída: la fuente que falla se anota en `fallas`, con su motivo, y el resto se pinta.
 */
describe('MapDataService (errores visibles)', () => {
  const vacio = { consultar: () => of({ records: [] }) };
  const geo = { fetchColombiaGeoJson: () => of({ type: 'FeatureCollection', features: [], municipalities: { type: 'FeatureCollection', features: [] } }) };

  function montar(mercados: unknown) {
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogService, useValue: geo },
        { provide: FestivalesParaElMapaService, useValue: vacio },
        { provide: EventosParaElMapaService, useValue: vacio },
        { provide: MercadosParaElMapaService, useValue: mercados },
        { provide: TalleresParaElMapaService, useValue: vacio },
        { provide: EspaciosParaElMapaService, useValue: vacio },
        { provide: RedesParaElMapaService, useValue: vacio },
      ],
    });
    return TestBed.inject(MapDataService);
  }

  it('sin fallas, la lista de fallas va vacía', async () => {
    const paquete = await firstValueFrom(montar(vacio).fetchMapCountsBundle());
    expect(paquete.fallas).toEqual([]);
  });

  it('una fuente caída se anota con su motivo y el resto del mapa se pinta', async () => {
    const paquete = await firstValueFrom(montar({
      consultar: () => throwError(() => ({ status: 503, message: 'Servicio no disponible' })),
    }).fetchMapCountsBundle());

    expect(paquete.fallas.length).toBe(1);
    expect(paquete.fallas[0].fuente).toBe('los mercados');
    expect(paquete.fallas[0].motivo).toContain('503');
    expect(paquete.marketRecords).toEqual([]);
    expect(paquete.festivalRecords).toEqual([]);
  });
});
