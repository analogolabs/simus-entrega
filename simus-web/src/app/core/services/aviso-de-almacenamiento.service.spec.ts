import { TestBed } from '@angular/core/testing';
import { AvisoDeAlmacenamientoService } from './aviso-de-almacenamiento.service';
import { BancoDeArchivosService, InformeDeAlmacenamiento } from './banco-de-archivos.service';

function informe(nivel: InformeDeAlmacenamiento['tope']['nivel'], pronta = false): InformeDeAlmacenamiento {
  return {
    generadoEn: '2026-11-17T10:00:00Z', total: { archivos: 1, bytes: 1 },
    tope: { bytes: 100, fraccionUsada: 0.5, umbralDeAtencion: 0.8, umbralDeAlarma: 0.9, nivel, soloMideElBanco: true },
    proyeccion: { bytesPorMes: 1, mesesHastaElUmbral: 2, avisaDeLlegadaPronta: pronta },
    porProcedencia: [], porTipo: [], porAntiguedad: [], sinUsar: { archivos: 0, bytes: 0 },
    repetidos: { copiasSobrantes: 0, bytes: 0 }, organizacionesQueMasPesan: [], crecimientoMensual: [],
  };
}

describe('AvisoDeAlmacenamientoService', () => {
  function crear(respuesta: { ok: boolean; data?: InformeDeAlmacenamiento }) {
    TestBed.configureTestingModule({
      providers: [{ provide: BancoDeArchivosService, useValue: { informeDeAlmacenamiento: () => Promise.resolve(respuesta) } }],
    });
    return TestBed.inject(AvisoDeAlmacenamientoService);
  }
  beforeEach(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });

  it('por debajo del 80 % no hay aviso ni punto', async () => {
    const s = crear({ ok: true, data: informe('normal') });
    await s.cargar();
    expect(s.hayAviso()).toBeFalse();
    expect(s.hayAlarma()).toBeFalse();
  });

  it('en atención hay aviso pero no punto; en alarma, las dos cosas', async () => {
    const a = crear({ ok: true, data: informe('atencion') });
    await a.cargar();
    expect(a.hayAviso()).toBeTrue();
    expect(a.hayAlarma()).toBeFalse();

    TestBed.resetTestingModule();
    const b = crear({ ok: true, data: informe('alarma') });
    await b.cargar();
    expect(b.hayAviso()).toBeTrue();
    expect(b.hayAlarma()).toBeTrue();
  });

  it('una proyección próxima avisa aunque el nivel sea normal, y sin tope no hay aviso', async () => {
    const a = crear({ ok: true, data: informe('normal', true) });
    await a.cargar();
    expect(a.hayAviso()).toBeTrue();

    TestBed.resetTestingModule();
    const b = crear({ ok: true, data: informe('sinTope') });
    await b.cargar();
    expect(b.hayAviso()).toBeFalse();
  });

  it('sin permiso (403) no hay informe y nada se pinta', async () => {
    const s = crear({ ok: false });
    await s.cargar();
    expect(s.informe()).toBeNull();
    expect(s.hayAviso()).toBeFalse();
    expect(s.hayAlarma()).toBeFalse();
  });

  it('descartar oculta siete días y se recuerda al volver a cargar', async () => {
    const s = crear({ ok: true, data: informe('alarma') });
    await s.cargar();
    s.descartar();
    expect(s.hayAlarma()).toBeFalse();

    await s.cargar();
    expect(s.hayAlarma()).toBeFalse();

    // Pasados los siete días (la marca ya venció) vuelve.
    const clave = Object.keys(localStorage).find(k => k.startsWith('simus.almacenamiento.descartado'))!;
    localStorage.setItem(clave, String(Date.now() - 1000));
    await s.cargar();
    expect(s.hayAlarma()).toBeTrue();
  });
});
