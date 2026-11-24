import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FichaEnConsolaComponent } from './ficha-en-consola.component';
import { AnotacionEditorial, CatalogoEditorialService, GuardarDerechosEditoriales, GuardarFuenteEditorial, PublicacionEditorial } from '../../../../core/services/catalogo-editorial.service';

/**
 * La ficha del Catálogo Editorial en la consola.
 *
 * <b>QUE FIJAN ESTAS PRUEBAS.</b> Que la versión de trabajo enseña lo que la pública NO —el estado,
 * la confianza, quién verificó los derechos, la procedencia y el hilo de revisiones—, y que dice
 * qué le falta a una ficha para verse en el portal ANTES de que alguien pulse publicar y se lo
 * rechacen. Y que las decisiones y las anotaciones se leen en un mismo hilo.
 */
class ApiDoble {
  historialDevuelto: AnotacionEditorial[] = [];
  anotado: { id: number; comentario: string }[] = [];
  historial = (id: number) => { void id; return Promise.resolve({ ok: true, data: this.historialDevuelto }); };
  anotar = (id: number, comentario: string) => {
    this.anotado.push({ id, comentario });
    return Promise.resolve({ ok: true, data: undefined });
  };
  fuentesGuardadas: { id: number; fuenteId: number | null; solicitud: GuardarFuenteEditorial }[] = [];
  respuestaFuente: { ok: boolean; data?: PublicacionEditorial; error?: string } | null = null;
  registrarFuente = (id: number, solicitud: GuardarFuenteEditorial) => {
    this.fuentesGuardadas.push({ id, fuenteId: null, solicitud });
    return Promise.resolve(this.respuestaFuente ?? { ok: true, data: publicacion({ version: 2 }) });
  };
  corregirFuente = (id: number, fuenteId: number, solicitud: GuardarFuenteEditorial) => {
    this.fuentesGuardadas.push({ id, fuenteId, solicitud });
    return Promise.resolve(this.respuestaFuente ?? { ok: true, data: publicacion({ version: 2 }) });
  };
  derechosGuardados: { id: number; solicitud: GuardarDerechosEditoriales }[] = [];
  respuestaDerechos: { ok: boolean; data?: PublicacionEditorial; error?: string } | null = null;
  guardarDerechos = (id: number, solicitud: GuardarDerechosEditoriales) => {
    this.derechosGuardados.push({ id, solicitud });
    return Promise.resolve(this.respuestaDerechos ?? { ok: true, data: publicacion({ version: 2 }) });
  };
}

function publicacion(cambios: Partial<PublicacionEditorial> = {}): PublicacionEditorial {
  return {
    id: 4, codigo: 'PNMC-ED-004', titulo: 'Música Coral Colombiana', subtitulo: null,
    designacionVolumen: null, serieOColeccion: null, resumen: null, fechaEdtf: null,
    anioInicio: 2001, anioFin: null, notaFecha: null, idiomas: [{ codigo: 'spa', nombre: 'Español' }], tipoPublicacion: 'Libro',
    categoriaId: null, categoria: null, ambito: 'Nacional', ambitoTexto: null, formato: 'Físico',
    categoriaSecundaria: null, palabrasClave: [], miniaturaRuta: null,
    seccionPrincipal: 'Repertorio', rutaSeccion: null, practicaMusical: 'Coro',
    subcategoria: null, tamanoFormato: null, paginas: null, duracion: null,
    camposAdicionales: null, textoPortada: null, tipologia: [], confianza: 'Alta',
    revisarClasificacion: false, revisarCreditos: true, notasCatalogacion: null,
    diapositivaOrigen: '9', estadoCatalogacion: 'validada', estadoPublicacion: 'publicado',
    version: 1,
    derechos: { estado: 'verificado', permitePublicarFicha: true, permitePublicarArchivo: false,
      licenciaONota: null, fuenteId: 1, fechaVerificacion: null, verificadoPor: 'Webmaster SIMUS' },
    fuentes: [{ id: 1, nombre: 'Catálogo del Proyecto Editorial del PNMC', referencia: null,
      url: null, fechaFuente: null, fechaConsulta: '2026-09-13T00:00:00Z', verificadaPor: 'Webmaster SIMUS' }],
    creditos: [], identificadores: [], accesos: [], programas: [],
    practicasMusicales: [], territoriosSonoros: [], procedencia: null,
    fechaActualizacion: '2026-09-13T00:00:00Z',
    ...cambios,
  } as PublicacionEditorial;
}


describe('FichaEnConsolaComponent', () => {
  let fixture: ComponentFixture<FichaEnConsolaComponent>;
  let api: ApiDoble;

  const montar = (ficha: PublicacionEditorial) => {
    fixture = TestBed.createComponent(FichaEnConsolaComponent);
    fixture.componentRef.setInput('publicacion', ficha);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    api = new ApiDoble();
    await TestBed.configureTestingModule({
      imports: [FichaEnConsolaComponent],
      providers: [{ provide: CatalogoEditorialService, useValue: api }],
    }).compileComponents();
  });

  it('enseña el trabajo de catalogación, que el portal no recibe', () => {
    const raiz = montar(publicacion());
    const texto = raiz.textContent!.replace(/\s+/g, ' ');

    expect(texto).toContain('Confianza de la ficha');
    expect(texto).toContain('Alta');
    expect(texto).toContain('Revisar créditos');
    expect(texto).toContain('Lámina del catálogo original');
    // Y QUIEN VERIFICO LOS DERECHOS, que es lo que el criterio de biblioteca deja fuera del portal.
    expect(texto).toContain('Webmaster SIMUS');
  });

  it('dice qué le falta a la ficha para verse, antes de que nadie pulse publicar', () => {
    const raiz = montar(publicacion({
      estadoCatalogacion: 'pendiente_revision',
      estadoPublicacion: 'borrador',
      fuentes: [],
      derechos: { estado: 'pendiente', permitePublicarFicha: false, permitePublicarArchivo: false,
        licenciaONota: null, fuenteId: null, fechaVerificacion: null, verificadoPor: null },
    }));
    const texto = raiz.textContent!.replace(/\s+/g, ' ');

    // LAS TRES QUE FALTAN, ENUMERADAS: es lo que convierte «no se puede publicar» en una lista de
    // tareas en vez de en un rechazo del servidor.
    expect(texto).toContain('Todavía no se puede ver en el portal');
    expect(texto).toContain('La ficha todavía no está validada.');
    expect(texto).toContain('No cita ninguna fuente.');
    expect(texto).toContain('Los derechos no permiten publicar la ficha.');
  });

  it('cuando cumple las cuatro condiciones lo dice, y no inventa un aviso', () => {
    const raiz = montar(publicacion());
    expect(raiz.textContent).toContain('Esta ficha se está viendo en el portal.');
  });

  it('lee las decisiones y las anotaciones en un mismo hilo, con su verbo en letra', async () => {
    api.historialDevuelto = [
      { id: 2, accion: 'Anotacion', estadoAnterior: 'validada', estadoNuevo: 'validada',
        comentario: 'Falta el arreglista.', usuarioId: 1, usuarioNombre: 'Webmaster SIMUS', fecha: '2026-09-13T10:00:00Z' },
      { id: 1, accion: 'CatalogacionCambiada', estadoAnterior: 'pendiente_revision', estadoNuevo: 'validada',
        comentario: 'Contrastada con el ejemplar.', usuarioId: 1, usuarioNombre: 'Webmaster SIMUS', fecha: '2026-09-13T09:00:00Z' },
    ];
    const raiz = montar(publicacion());
    // EL HILO SE PIDE AL ABRIR Y LLEGA DESPUES: sin esperar, la pantalla sigue en «Consultando…».
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = raiz.textContent!.replace(/\s+/g, ' ');

    expect(texto).toContain('Anotación');
    // EL VERBO EN LETRA Y NO EN CLAVE: «CatalogacionCambiada» no se lo dice a nadie.
    expect(texto).toContain('Catalogación · Validada');
    expect(texto).toContain('Falta el arreglista.');
    expect(texto).toContain('Contrastada con el ejemplar.');
  });

  it('registra los derechos de la ficha y de cada acceso, citando la versión (#134)', async () => {
    montar(publicacion({
      version: 5,
      accesos: [{ id: 30, tipo: 'enlace', archivoId: null, url: 'https://x.test/guia.pdf', ubicacionFisica: null,
        etiqueta: 'Guía en PDF', nota: null, orden: 0,
        derechos: { estado: 'pendiente', permitePublicarFicha: false, permitePublicarArchivo: false,
          licenciaONota: null, fuenteId: null, fechaVerificacion: null, verificadoPor: null } }],
    }));
    const componente = fixture.componentInstance;

    componente.editarDerechos();
    expect(componente.derechosEnEdicion()!.map(d => d.nombre)).toEqual(['La ficha', 'Guía en PDF']);

    componente.cambiarDerecho(1, 'estado', 'verificado');
    componente.cambiarDerecho(1, 'permitePublicarArchivo', true);
    componente.cambiarDerecho(1, 'licenciaONota', '  CC BY 4.0  ');
    await componente.guardarDerechos();

    const { id, solicitud } = api.derechosGuardados[0];
    expect(id).toBe(4);
    expect(solicitud.version).toBe(5);
    expect(solicitud.ficha).toEqual(jasmine.objectContaining({ estado: 'verificado', permitePublicarFicha: true }));
    expect(solicitud.accesos).toEqual([jasmine.objectContaining({
      accesoId: 30, estado: 'verificado', permitePublicarArchivo: true, licenciaONota: 'CC BY 4.0',
    })]);
    expect(componente.derechosEnEdicion()).toBeNull();
    expect(componente.ficha()!.version).toBe(2);
  });

  it('con los derechos pendientes apaga los permisos en vez de dejar que el servidor lo rechace', () => {
    montar(publicacion());
    const componente = fixture.componentInstance;
    componente.editarDerechos();

    componente.cambiarDerecho(0, 'estado', 'pendiente');

    expect(componente.derechosEnEdicion()![0].permitePublicarFicha).toBeFalse();
    expect(componente.derechosEnEdicion()![0].permitePublicarArchivo).toBeFalse();
  });

  it('si guardar los derechos falla, conserva lo escrito y enseña el motivo', async () => {
    api.respuestaDerechos = { ok: false, error: 'La ficha cambió desde que se abrió.' };
    montar(publicacion());
    const componente = fixture.componentInstance;
    componente.editarDerechos();

    await componente.guardarDerechos();

    expect(componente.error()).toContain('La ficha cambió');
    expect(componente.derechosEnEdicion()).not.toBeNull();
  });

  it('nombra en letra las entradas nuevas del hilo (#134)', () => {
    montar(publicacion());
    const entrada = (accion: string) => ({ id: 1, accion, estadoAnterior: null, estadoNuevo: 'validada',
      comentario: null, usuarioId: null, usuarioNombre: null, fecha: '2026-11-05T00:00:00Z' });
    expect(fixture.componentInstance.tituloDeLaEntrada(entrada('DerechosCambiados'))).toBe('Derechos');
    expect(fixture.componentInstance.tituloDeLaEntrada(entrada('ErrataCorregida'))).toBe('Errata corregida');
  });

  it('no guarda una anotación en blanco', async () => {
    montar(publicacion());
    fixture.componentInstance.anotacion.set('   ');

    await fixture.componentInstance.guardarAnotacion();

    // UNA ENTRADA VACIA NO LE DICE NADA A QUIEN LA LEA DESPUES.
    expect(api.anotado.length).toBe(0);
  });

  it('guarda la anotación y limpia el campo, para que no se envíe dos veces', async () => {
    montar(publicacion());
    fixture.componentInstance.anotacion.set('  Revisar los créditos.  ');

    await fixture.componentInstance.guardarAnotacion();

    expect(api.anotado).toEqual([{ id: 4, comentario: 'Revisar los créditos.' }]);
    expect(fixture.componentInstance.anotacion()).toBe('');
  });

  describe('fuentes', () => {
    const escribir = (raiz: HTMLElement, nombre: string, valor: string) => {
      const campo = raiz.querySelector<HTMLInputElement>(`[name="${nombre}"]`)!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    };

    it('una ficha sin fuentes lo dice y ofrece «Agregar fuente»', () => {
      const raiz = montar(publicacion({ fuentes: [], estadoPublicacion: 'borrador', estadoCatalogacion: 'pendiente_revision' }));

      expect(raiz.querySelector('[data-testid="fuentes-de-la-ficha"]')?.textContent).toContain('Ninguna');
      expect(raiz.querySelector('[data-agregar-fuente]')).not.toBeNull();
    });

    it('registra una fuente nueva con la versión de la ficha y la deja citada', async () => {
      const raiz = montar(publicacion({ fuentes: [], version: 1 }));
      raiz.querySelector<HTMLButtonElement>('[data-agregar-fuente]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();

      escribir(raiz, 'fuente-nombre', '  Archivo Histórico  ');
      escribir(raiz, 'fuente-url', 'https://archivo.example.org/caja-12');
      escribir(raiz, 'fuente-fecha', '2024-03-05');
      await fixture.componentInstance.guardarFuente();
      fixture.detectChanges();

      expect(api.fuentesGuardadas).toEqual([{
        id: 4, fuenteId: null,
        solicitud: { version: 1, nombre: 'Archivo Histórico', referencia: null, url: 'https://archivo.example.org/caja-12', fechaFuente: '2024-03-05' },
      }]);
      expect(raiz.querySelector('[data-testid="fuente-en-edicion"]')).toBeNull();
      expect(fixture.componentInstance.aviso()).toContain('quedó registrada');
    });

    it('sin nombre, o sin enlace ni referencia, no envía nada y dice qué falta', async () => {
      const raiz = montar(publicacion({ fuentes: [] }));
      fixture.componentInstance.agregarFuente();
      await fixture.componentInstance.guardarFuente();
      expect(fixture.componentInstance.errorDeLaFuente()).toContain('cómo se llama');

      fixture.componentInstance.cambiarFuente('nombre', 'Algo');
      await fixture.componentInstance.guardarFuente();
      expect(fixture.componentInstance.errorDeLaFuente()).toContain('enlace o la referencia');
      expect(api.fuentesGuardadas.length).toBe(0);
      void raiz;
    });

    it('corrige una fuente que la ficha ya cita', async () => {
      montar(publicacion());
      const fuente = fixture.componentInstance.ficha()!.fuentes[0];
      fixture.componentInstance.editarFuente(fuente);
      fixture.componentInstance.cambiarFuente('referencia', 'Caja 12, folio 5');
      await fixture.componentInstance.guardarFuente();

      expect(api.fuentesGuardadas[0].fuenteId).toBe(1);
      expect(api.fuentesGuardadas[0].solicitud.referencia).toBe('Caja 12, folio 5');
      expect(fixture.componentInstance.aviso()).toContain('quedó corregida');
    });

    it('si el servidor la rechaza, muestra su motivo sin cerrar lo escrito', async () => {
      montar(publicacion({ fuentes: [] }));
      api.respuestaFuente = { ok: false, error: 'La ficha cambió desde que se abrió.' };
      fixture.componentInstance.agregarFuente();
      fixture.componentInstance.cambiarFuente('nombre', 'Algo');
      fixture.componentInstance.cambiarFuente('referencia', 'R');
      await fixture.componentInstance.guardarFuente();
      fixture.detectChanges();

      expect(fixture.componentInstance.errorDeLaFuente()).toBe('La ficha cambió desde que se abrió.');
      expect(fixture.componentInstance.fuenteEnEdicion()?.nombre).toBe('Algo');
    });
  });
});
