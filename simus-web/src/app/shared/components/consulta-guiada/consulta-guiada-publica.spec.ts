import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { ConsultaGuiadaPublicaComponent } from './consulta-guiada-publica.component';
import { ConsultaGuiadaService, RespuestaDeConsultaAbierta } from './consulta-guiada.service';
import { PreguntaPublicaService } from '../../../core/services/pregunta-publica.service';

/**
 * La Consulta Guiada del portal público: banco cerrado, sin caja de texto, siempre «consulta verificada».
 */
const ABIERTA: RespuestaDeConsultaAbierta = {
  estado: 'ok', mensaje: 'm', via: 'modelo', resumen: '2 grupos por departamento; el primero es «Nariño» con 3.',
  consultaEntendida: { entidad: 'festivales', filtros: [{ campo: 'practica', operador: 'eq', valor: 'Chirimía' }], agrupar: ['departamento'], metrica: { funcion: 'count' }, orden: { campo: 'metrica', direccion: 'desc' }, limite: 20 },
  comoEntendi: ['Buscando: festivales', 'Práctica musical: Chirimía', 'Agrupado por departamento', 'Cálculo: festivales', 'Hasta 20 filas'],
  tabla: { titulo: 'Festivales publicados', fuente: 'Festivales publicados', alcance: 'Solo lo publicado · 2 de 2 filas', columnas: ['Departamento', 'Festivales'], filas: [['Nariño', '3'], ['Cauca', '1']], destinos: ['/ecosistema/festivales?departamento=Nari%C3%B1o', null], columnaDeEnlace: 0, filtrosAplicados: ['Solo registros publicados', 'Práctica musical: Chirimía'] },
  grafico: 'barras', sugerencias: [], latenciaMs: 4200,
};

describe('ConsultaGuiadaPublicaComponent', () => {
  let fixture: ComponentFixture<ConsultaGuiadaPublicaComponent>;
  let consultas: string[];
  let fallo: unknown;
  let modeloDisponible: boolean;
  let abiertas: unknown[];
  let respuestaAbierta: () => unknown;

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    consultas = [];
    fallo = null;
    modeloDisponible = false;
    abiertas = [];
    respuestaAbierta = () => of(ABIERTA);
    await TestBed.configureTestingModule({
      imports: [ConsultaGuiadaPublicaComponent],
      providers: [provideRouter([]), {
        provide: ConsultaGuiadaService,
        useValue: {
          estadoPublico: () => of({
            disponible: true, modo: 'banco_publico' as const, mensaje: 'Elige una pregunta.',
            preguntas: [
              { id: 'publica_procesos_por_tipo', rotulo: '¿Cuántos procesos hay publicados?', descripcion: 'd', parametros: [] },
              { id: 'publica_noticias_recientes', rotulo: '¿Cuáles son las noticias más recientes?', descripcion: 'd', parametros: [] },
              { id: 'publica_festivales_en_departamento', rotulo: '¿Qué festivales hay en un departamento?', descripcion: 'd', parametros: [{ nombre: 'departamento', rotulo: 'Departamento', obligatorio: true }] },
              { id: 'publica_mercados_en_departamento', rotulo: '¿Qué mercados musicales hay en un departamento?', descripcion: 'd', parametros: [{ nombre: 'departamento', rotulo: 'Departamento', obligatorio: true }] },
            ],
            catalogos: {
              departamentos: [{ id: '52', nombre: 'Nariño' }, { id: '05', nombre: 'Antioquia' }], municipios: [['52001', 'Pasto']],
              tipos: [
                { id: 'festivales', singular: 'festival', plural: 'festivales', pistas: ['festival'] },
                { id: 'mercados', singular: 'mercado musical', plural: 'mercados musicales', pistas: ['mercado'] },
              ],
              practicas: [], territorios: [], organizaciones: [],
            },
          }),
          estadoAbierto: () => of({ disponible: true, modeloDisponible, mensaje: 'm', maximoDePregunta: 200, ejemplos: [] }),
          consultarAbierta: (cuerpo: unknown) => { abiertas.push(cuerpo); return respuestaAbierta(); },
          consultarPublica: (id: string, parametros?: Record<string, string>) => {
            consultas.push(parametros ? `${id}?${JSON.stringify(parametros)}` : id);
            return fallo ? throwError(() => fallo) : of({
              respuesta: 'El portal muestra hoy 3 procesos publicados.', consultaElegida: id, resueltoPor: 'banco_publico' as const,
              generadoEn: '2026-11-20T10:00:00Z', contexto: 'Lo publicado en el portal',
              consulta: { titulo: 'Procesos', fuente: 'Procesos publicados', alcance: 'Todo el país', columnas: ['Tipo', 'Publicados'], filas: [['Festivales', '3'], ['Agenda', '1']], destinos: ['/ecosistema/festivales?departamento=Meta', null], columnaDeEnlace: 0 },
            });
          },
        },
      }],
    }).compileComponents();
    fixture = TestBed.createComponent(ConsultaGuiadaPublicaComponent);
    fixture.detectChanges();
  });

  it('ofrece las preguntas frecuentes y un campo que solo busca entre ellas', () => {
    expect(raiz().querySelectorAll('[data-pregunta-publica]').length).toBe(4);
    expect(raiz().querySelector('h3')?.textContent).toContain('Preguntas frecuentes');
    expect(raiz().querySelector('textarea')).toBeNull();
    const campo = raiz().querySelector('[data-buscar-pregunta]') as HTMLInputElement;
    campo.value = 'noticias';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const ids = Array.from(raiz().querySelectorAll('[data-pregunta-publica]')).map(b => b.getAttribute('data-id'));
    expect(ids).toEqual(['publica_noticias_recientes']);
  });

  it('sin coincidencias lo dice y sugiere las preguntas más cercanas, sin responder nada', () => {
    const campo = raiz().querySelector('[data-buscar-pregunta]') as HTMLInputElement;
    campo.value = 'presupuesto';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(raiz().querySelector('[data-sin-coincidencia]')).not.toBeNull();
    expect(raiz().querySelectorAll('[data-pregunta-publica]').length).toBeGreaterThan(0);
    expect(consultas).toEqual([]);
  });

  it('cada fila con destino es un enlace real (<a href>) a su ficha; la que no tiene queda como texto', () => {
    (raiz().querySelector('[data-id="publica_procesos_por_tipo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const enlaces = raiz().querySelectorAll('a[data-enlace-de-fila]');
    expect(enlaces.length).toBe(1);
    expect(enlaces[0].getAttribute('href')).toBe('/ecosistema/festivales?departamento=Meta');
    expect(raiz().textContent).toContain('Agenda');
  });

  it('al elegir una pregunta muestra la respuesta con fuente, alcance y tabla, como consulta verificada', () => {
    (raiz().querySelector('[data-id="publica_procesos_por_tipo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const texto = raiz().textContent ?? '';
    expect(consultas).toEqual(['publica_procesos_por_tipo']);
    expect(texto).toContain('El portal muestra hoy 3 procesos publicados.');
    expect(texto).toContain('Fuente:');
    expect(texto).toContain('Alcance:');
    expect(raiz().querySelector('table tbody td')?.textContent).toContain('Festivales');
    expect(texto).not.toMatch(/inteligencia artificial|\bIA\b/);
  });

  it('si el servidor corta por exceso de consultas lo dice con palabras', () => {
    fallo = { status: 429, message: 'Demasiadas solicitudes' };
    (raiz().querySelector('[data-id="publica_noticias_recientes"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('Espera un minuto');
  });

  const escribir = (texto: string): void => {
    const campo = raiz().querySelector('[data-buscar-pregunta]') as HTMLInputElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
  };

  it('escribir «festivales en Nariño» y pulsar Enter ejecuta la plantilla con el departamento reconocido', () => {
    escribir('festivales en Nariño');
    expect(consultas).toEqual(['publica_festivales_en_departamento?{"departamento":"52"}']);
    expect(raiz().textContent).toContain('Nariño');
  });

  it('si falta el parámetro lo pide con un selector y ejecuta al elegirlo', () => {
    escribir('festivales');
    expect(consultas).toEqual([]);
    expect(raiz().querySelector('app-filtro-desplegable[identificador="parametro-departamento"], app-filtro-desplegable')).not.toBeNull();
    expect((raiz().querySelector('[data-consultar-parametros]') as HTMLButtonElement).disabled).toBeTrue();
    fixture.componentInstance.poner('departamento', '05');
    fixture.detectChanges();
    (raiz().querySelector('[data-consultar-parametros]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(consultas).toEqual(['publica_festivales_en_departamento?{"departamento":"05"}']);
  });

  it('elegir una pregunta con parámetros pide los selectores antes de ejecutar', () => {
    (raiz().querySelector('[data-id="publica_mercados_en_departamento"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(consultas).toEqual([]);
    expect(raiz().querySelector('[data-pedir-parametros]')).not.toBeNull();
  });

  it('si no entiende lo escrito lo dice y no ejecuta nada', () => {
    escribir('presupuesto del ministerio');
    expect(raiz().querySelector('[data-no-entendi]')).not.toBeNull();
    expect(consultas).toEqual([]);
  });

  it('muestra los filtros aplicados de la respuesta', () => {
    (raiz().querySelector('[data-id="publica_procesos_por_tipo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(raiz().querySelector('[data-filtros-aplicados]')).toBeNull();
  });

  describe('consulta abierta', () => {
    const escribir = (texto: string): void => {
      const campo = raiz().querySelector('[data-buscar-pregunta]') as HTMLInputElement;
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
    };
    const conModelo = async (): Promise<void> => {
      modeloDisponible = true;
      fixture = TestBed.createComponent(ConsultaGuiadaPublicaComponent);
      fixture.detectChanges();
    };

    it('sin modelo no ofrece la consulta abierta: lo no reconocido se dice como siempre', () => {
      escribir('gaita altura terreno');
      expect(abiertas).toEqual([]);
      expect(raiz().querySelector('[data-no-entendi]')).not.toBeNull();
    });

    it('sin modelo lo dice con palabras y las preguntas frecuentes siguen ahí; con modelo no hay aviso', async () => {
      expect(raiz().querySelector('[data-sin-modelo]')?.textContent).toContain('preguntas frecuentes');
      expect(raiz().querySelectorAll('[data-pregunta-publica]').length).toBe(4);
      await conModelo();
      expect(raiz().querySelector('[data-sin-modelo]')).toBeNull();
    });

    it('nunca muestra los rótulos «guiada», «asistida» ni «abierta» en la interfaz', async () => {
      await conModelo();
      escribir('festivales con chirimía por departamento');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(raiz().textContent).not.toMatch(/guiada|asistida|abierta/i);
    });

    it('es un chat: el campo de escribir va abajo, tras el historial y las sugerencias', () => {
      const campo = raiz().querySelector('[data-buscar-pregunta]')!;
      const lista = raiz().querySelector('[data-pregunta-publica]')!;
      expect(raiz().querySelector('[data-bienvenida]')).not.toBeNull();
      expect(lista.compareDocumentPosition(campo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('con historial las preguntas frecuentes pasan a un desplegable sobre el campo y «Enviar» pregunta', () => {
      (raiz().querySelector('[data-id="publica_procesos_por_tipo"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(raiz().querySelector('[data-bienvenida]')).toBeNull();
      expect(raiz().querySelector('[data-frecuentes-desplegable] [data-pregunta-publica]')).not.toBeNull();
      const campo = raiz().querySelector('[data-buscar-pregunta]') as HTMLInputElement;
      const enviar = raiz().querySelector('[data-enviar-pregunta]') as HTMLButtonElement;
      expect(enviar.disabled).toBeTrue();
      campo.value = 'festivales en Nariño';
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(enviar.disabled).toBeFalse();
      enviar.click();
      fixture.detectChanges();
      expect(consultas.some(c => c.startsWith('publica_festivales_en_departamento'))).toBeTrue();
    });

    it('una pregunta que llega de la portada se escribe y se responde sola', () => {
      const servicio = TestBed.inject(PreguntaPublicaService);
      servicio.semilla.set('festivales en Nariño');
      fixture = TestBed.createComponent(ConsultaGuiadaPublicaComponent);
      fixture.detectChanges();
      expect(consultas.some(c => c.startsWith('publica_festivales_en_departamento'))).toBeTrue();
      expect(servicio.semilla()).toBe('');
    });

    it('si la consulta tarda demasiado explica que el modelo se prepara y ofrece reintentar al fallar', async () => {
      jasmine.clock().install();
      try {
        await conModelo();
        respuestaAbierta = () => NEVER;
        escribir('algo que tarda');
        jasmine.clock().tick(8_100);
        fixture.detectChanges();
        expect(raiz().querySelector('[data-pensando]')?.textContent).toContain('se está preparando');
      } finally { jasmine.clock().uninstall(); }
    });

    it('un fallo transitorio ofrece «Reintentar» y reintentar vuelve a consultar', async () => {
      await conModelo();
      respuestaAbierta = () => of({ ...ABIERTA, estado: 'ocupado', mensaje: 'Hay muchas consultas.', tabla: null, resumen: null, consultaEntendida: null });
      escribir('algo muy raro que no existe');
      await fixture.whenStable();
      fixture.detectChanges();
      (raiz().querySelector('[data-reintentar]') as HTMLButtonElement).click();
      expect(abiertas.length).toBe(2);
    });

    it('con modelo, lo que ninguna plantilla reconoce va a la consulta abierta y enseña cómo lo entendió', async () => {
      await conModelo();
      escribir('festivales con chirimía por departamento');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(abiertas).toEqual([{ pregunta: 'festivales con chirimía por departamento' }]);
      expect(raiz().querySelector('[data-no-entendi]')).toBeNull();
      expect(raiz().textContent).toContain('2 grupos por departamento');
      expect(raiz().querySelector('[data-como-entendi]')?.textContent).toContain('Cómo entendí tu pregunta');
      expect(raiz().querySelectorAll('[data-quitar-chip]').length).toBe(2);
      expect(raiz().querySelector('[data-grafico]')).not.toBeNull();
      expect(raiz().querySelector('a[data-enlace-de-fila]')?.getAttribute('href')).toContain('/ecosistema/festivales');
    });

    it('quitar un chip pide la consulta corregida, sin el filtro, sin pasar otra vez por el modelo', async () => {
      await conModelo();
      escribir('festivales con chirimía por departamento');
      await fixture.whenStable();
      fixture.detectChanges();
      (raiz().querySelector('[data-quitar-chip]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      const corregida = abiertas[1] as { consulta: { filtros: unknown[]; agrupar: string[] }; pregunta?: string };
      expect(corregida.pregunta).toBeUndefined();
      expect(corregida.consulta.filtros).toEqual([]);
      expect(corregida.consulta.agrupar).toEqual(['departamento']);
    });

    it('si el modelo no responde, lo dice y sugiere preguntas verificadas que se pueden usar', async () => {
      await conModelo();
      respuestaAbierta = () => of({ ...ABIERTA, estado: 'sin_modelo', mensaje: 'El modelo no respondió.', tabla: null, resumen: null, consultaEntendida: null, sugerencias: ['¿Cuántos procesos hay publicados?'] });
      escribir('algo muy raro que no existe');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(raiz().querySelector('[role="alert"]')?.textContent).toContain('El modelo no respondió.');
      (raiz().querySelector('[data-sugerencia]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(consultas).toEqual(['publica_procesos_por_tipo']);
    });

    it('muestra «pensando» con un botón para cancelar, y cancelar libera el campo', async () => {
      await conModelo();
      respuestaAbierta = () => NEVER;
      escribir('algo que tarda');
      expect(raiz().querySelector('[data-pensando]')).not.toBeNull();
      (raiz().querySelector('[data-cancelar-consulta]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(raiz().querySelector('[data-pensando]')).toBeNull();
    });
  });
});
