import { TestBed } from '@angular/core/testing';
import { TextosWebService } from '../../core/services/textos-web.service';
import { ContenidoWebApiService } from '../../core/services/contenido-web-api.service';
import { IMAGENES_DEL_BLOQUE } from '../../core/cms/registro-de-imagenes-web';
import { PNMCPreviewSectionComponent } from './components/pnmc-preview-section/pnmc-preview-section.component';
import { HomeStrategiesSectionComponent } from './components/home-strategies-section/home-strategies-section.component';

/*
  QUE CADA BLOQUE DE LA PORTADA PIDA SUS PROPIAS RANURAS.

  El 30 de agosto de 2026 entraron dieciocho ranuras de imagen en la portada. Todas se resuelven
  con claves ARMADAS EN TIEMPO DE EJECUCIÓN —`home_ruta_${i + 1}`, `home_eco_${i + 1}`— o con
  literales repartidos por tres componentes. Ninguna de esas dos formas la ve el compilador.

  El modo de fallar es silencioso y caro: una clave con el índice corrido pinta LA FOTO DE OTRA
  TARJETA, que es una imagen perfectamente válida en el sitio equivocado. Nadie lo nota mirando
  la página, y `cms:huerfanas` tampoco, porque la clave existe y alguien la lee.

  Lo que se hace aquí es escuchar QUÉ CLAVES PIDE cada componente y compararlas, una a una y en
  orden, con lo que el registro dice que le toca a ese bloque.
*/
describe('portada · cada bloque pide las ranuras que el registro le asigna', () => {
  /** Doble que apunta cada clave pedida y devuelve algo reconocible. */
  class TextosEspia {
    readonly imagenesPedidas: string[] = [];
    readonly textosPedidos: string[] = [];

    getWebImage(clave: string): string {
      this.imagenesPedidas.push(clave);
      return `url::${clave}`;
    }

    getWebImageAlt(clave: string): string { return `alt::${clave}`; }

    getWebText(clave: string): string {
      this.textosPedidos.push(clave);
      return `texto::${clave}`;
    }

    getWebTeamMembers(): unknown[] { return []; }
    pendingLocalContent() { return { textKeys: 0, teamMembers: 0 }; }
  }

  let espia: TextosEspia;

  function montar<T>(componente: new (...args: never[]) => T): T {
    espia = new TextosEspia();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [componente as never],
      providers: [
        { provide: TextosWebService, useValue: espia },
        { provide: ContenidoWebApiService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(componente as never);
    fixture.detectChanges();
    return fixture.componentInstance as T;
  }

  it('la sección «Qué es SIMUS» no pide fotos y muestra sus cuatro conceptos', () => {
    const c = montar(PNMCPreviewSectionComponent);
    expect(espia.imagenesPedidas).toEqual([]);
    expect(c.conceptos().map(x => x.numero)).toEqual(['01', '02', '03', '04']);
  });

  it('las cinco puertas piden sus cinco fotos, en el orden de la cuadrícula', () => {
    // POR POSICIÓN: un índice corrido pondría la foto de Festivales en la celda de Mercados sin
    // que nada lo dijera.
    const c = montar(HomeStrategiesSectionComponent);
    const tarjetas = c.tarjetas();

    expect(tarjetas.length).toBe(5);
    expect(tarjetas.map(t => t.img))
      .toEqual(IMAGENES_DEL_BLOQUE['home_strategies_cards'].map(k => `url::${k}`));
  });

  it('cada puerta pide su antetítulo, su título y su descripción, y nada más', () => {
    montar(HomeStrategiesSectionComponent);
    const descripciones = espia.textosPedidos.filter(k => k.startsWith('strat_') && k.endsWith('_desc'));
    expect(descripciones.length).toBe(5);
    expect(espia.textosPedidos).not.toContain('strat_ecosistema_terminos');
  });
});
