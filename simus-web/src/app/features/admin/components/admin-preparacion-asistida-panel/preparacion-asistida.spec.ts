import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminPreparacionAsistidaPanelComponent, partirEnNegritas } from './admin-preparacion-asistida-panel.component';
import { ImportacionesService } from './importaciones.service';
import { of } from 'rxjs';

describe('Preparación asistida de archivos', () => {
  let fixture: ComponentFixture<AdminPreparacionAsistidaPanelComponent>;
  let servicio: jasmine.SpyObj<ImportacionesService>;

  beforeEach(() => {
    servicio = jasmine.createSpyObj<ImportacionesService>(
      'ImportacionesService',
      ['listar', 'consultar', 'previsualizar', 'confirmar', 'dominiosImportables'],
    );
    // LA PANTALLA PREGUNTA AL SERVIDOR QUE SE PUEDE IMPORTAR desde, en
    // vez de llevar la lista escrita. El fijador responde lo mismo que el contrato del API.
    servicio.dominiosImportables.and.returnValue(of({
      dominios: [{
        dominio: 'festivales',
        etiqueta: 'Festivales',
        estadoAlImportar: 'borrador',
        porQueEseEstado: 'Publicarlo sigue exigiendo revisión.',
        campos: [
          { nombre: 'nombre', etiqueta: 'Nombre del Festival', obligatorio: true },
          { nombre: 'departamento', etiqueta: 'Departamento', obligatorio: false },
        ],
      }],
    }));
    servicio.listar.and.returnValue(of({
      items: [{
        id: 17,
        nombreArchivo: 'festivales-revisados.xlsx',
        formato: 'xlsx',
        estado: 'previsualizado',
        fechaPrevisualizacion: '2026-09-11T10:00:00Z',
        fechaAplicacion: null,
        fechaExpiracion: '2026-10-11T10:00:00Z',
        fechaDepuracion: null,
        estadoRetencion: 'detalle_temporal',
        esPropio: true,
        puedeConfirmar: true,
        totalFilas: 12,
        filasImportables: 10,
        filasRechazadas: 2,
        filasAplicadas: 0,
        filasExcluidas: 0,
      }],
      pagina: 1,
      tamano: 10,
      total: 1,
      totalPaginas: 1,
      diasRetencionPrevisualizacion: 30,
      politicaRetencion: 'Las previsualizaciones conservan detalle durante 30 días.',
    }));
    TestBed.configureTestingModule({
      imports: [AdminPreparacionAsistidaPanelComponent],
      providers: [{
        provide: ImportacionesService,
        useValue: servicio,
      }],
    });
    fixture = TestBed.createComponent(AdminPreparacionAsistidaPanelComponent);
    fixture.componentRef.setInput('idModulo', 'festivals');
    fixture.detectChanges();
  });

  it('explica la separación entre previsualizar, confirmar y publicar', () => {
    const texto = fixture.nativeElement.textContent as string;

    // EL TITULO Y LAS INSTRUCCIONES NOMBRAN EL DESTINO ELEGIDO desde.
    // Antes decían «Festivales» siempre, en una pantalla que sirve a cinco destinos: quien
    // preparaba organizaciones leía que «solo una confirmación crea Festivales».
    expect(texto).toContain('Importación asistida de Festivales');
    expect(texto).toContain('La previsualización en la API no crea registros');
    expect(texto).toContain('crea registros de Festivales en estado «borrador»');
    expect(texto).toContain('nunca publica ni modifica existentes');
    expect(texto).not.toContain('Inteligencia Artificial');
    expect(texto).not.toContain('Importación IA');
  });

  it('con el módulo ya decidido no pide «seleccionar el módulo destino» y numera desde 1', () => {
    const texto = fixture.nativeElement.textContent as string;

    expect(texto).not.toContain('Selecciona el módulo destino');
    expect(texto).toContain('1. Cargar tu base de datos externa');
    expect(texto).not.toContain('2. Cargar tu base de datos externa');
  });

  it('sin archivo no pinta el chat de consultas, y la plantilla se descarga con el mismo nombre que en la lista', () => {
    const texto = fixture.nativeElement.textContent as string;

    expect(texto).not.toContain('Consultas del archivo');
    expect(texto).not.toContain('Puedes consultarme');
    expect(texto).toContain('Descargar la plantilla');
    expect(texto).not.toContain('Ver Plantilla Oficial');
  });

  it('ofrece exactamente los dominios que el servidor dice saber recibir', () => {
    // ANTES LA LISTA ESTABA ESCRITA EN EL NAVEGADOR, y por eso esta pantalla llegó a anunciar ocho
    // módulos de los que siete no tenían circuito. Ahora el servidor manda: si mañana declara uno
    // nuevo, aparece sin tocar el navegador; y si deja de declararlo, desaparece.
    expect(fixture.componentInstance.modulosAdministrativos().map(modulo => modulo.dominio)).toEqual(['festivales']);
  });

  it('dice antes de subir nada que lo importado no se publica solo', () => {
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('[data-promesa-del-dominio]');

    // ENTERARSE AL VER LA LISTA DE RESULTADOS LLEGA TARDE para quien creía que estaba publicando un
    // directorio entero. El estado lo declara el servidor; la pantalla solo lo repite.
    expect(aviso?.textContent).toContain('borrador');
    expect(aviso?.textContent).toContain('nada se publica');
  });

  it('si el servidor declara que nacen publicados, lo dice en vez de prometer que nada se publica (#147)', () => {
    servicio.dominiosImportables.and.returnValue(of({
      dominios: [{
        dominio: 'festivales', etiqueta: 'Festivales', estadoAlImportar: 'publicado',
        porQueEseEstado: 'Es un registro histórico sin organización.', campos: [{ nombre: 'nombre', etiqueta: 'Nombre del Festival', obligatorio: true }],
      }],
    }));
    const otra = TestBed.createComponent(AdminPreparacionAsistidaPanelComponent);
    otra.componentRef.setInput('idModulo', 'festivals');
    otra.detectChanges();

    const aviso = (otra.nativeElement as HTMLElement).querySelector('[data-promesa-del-dominio]');
    expect(aviso?.textContent).toContain('registro histórico');
    expect(aviso?.textContent).not.toContain('nada se publica');
    expect(otra.nativeElement.textContent).not.toContain('nunca publica');
  });

  it('si el servidor no contesta, no inventa destinos', () => {
    servicio.dominiosImportables.and.returnValue(of({ dominios: [] }));
    const otra = TestBed.createComponent(AdminPreparacionAsistidaPanelComponent);
    otra.componentRef.setInput('idModulo', 'festivals');
    otra.detectChanges();

    // OFRECER UN DESTINO QUE NO EXISTE es peor que no ofrecer ninguno: el trabajo de preparar el
    // archivo se pierde entero al final.
    expect(otra.componentInstance.modulosAdministrativos()).toEqual([]);
  });

  it('presenta el historial con estado y política de conservación', async () => {
    await fixture.componentInstance.alternarHistorial();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;

    // EL DOMINIO VIAJA EN CADA LLAMADA desde. Antes la ruta llevaba
    // «festivales» escrito dentro: la consola ofrecía varios destinos y todas las llamadas iban al
    // mismo, así que elegir «Organizaciones» habría previsualizado contra las reglas de Festival.
    expect(servicio.listar).toHaveBeenCalledWith(
      jasmine.any(String), { pagina: 1, tamano: 10, estado: '', archivo: '' });
    expect(texto).toContain('Historial de importaciones');
    expect(texto).toContain('festivales-revisados.xlsx');
    expect(texto).toContain('Pendiente de confirmación');
    expect(texto).toContain('Detalle temporal');
    expect(texto).toContain('30 días');
  });

  it('cada llamada lleva el destino elegido, no uno escrito en la ruta', async () => {
    // EL DEFECTO QUE ESTO CIERRA. El Bloque 5b convirtió la importación en genérica —núcleo,
    // contrato, pantalla y registro de dominios— y renombró el servicio, pero dejó la ruta con
    // «festivales» escrito dentro. La consola ofrecía varios destinos y TODAS las llamadas iban al
    // mismo: elegir «Organizaciones» habría previsualizado organizaciones contra las reglas de
    // Festival. Lo señalaba la auditoría de rutas, enterrado entre sus propios falsos positivos.
    const componente = fixture.componentInstance;
    componente.idModuloSeleccionado.set('organizaciones');

    await componente.alternarHistorial();

    // MUTANTE QUE MATA: volver a una constante fija. El primer argumento dejaría de ser el destino
    // elegido y esta comprobación caería.
    expect(servicio.listar).toHaveBeenCalledWith('organizaciones', jasmine.anything());
  });
  it('las respuestas del asistente del archivo pintan la negrita sin dejar los asteriscos a la vista (D5-04)', () => {
    // EL DEFECTO: «Archivo externo "x.csv" cargado con **6 registros** y **9 columnas**» se leía
    // con los asteriscos. Se parte el texto en tramos y solo los de las marcas van en negrita.
    expect(partirEnNegritas('cargado con **6 registros** y **9 columnas**.')).toEqual([
      { texto: 'cargado con ', negrita: false },
      { texto: '6 registros', negrita: true },
      { texto: ' y ', negrita: false },
      { texto: '9 columnas', negrita: true },
      { texto: '.', negrita: false },
    ]);
    expect(partirEnNegritas('sin marcas')).toEqual([{ texto: 'sin marcas', negrita: false }]);

    const componente = fixture.componentInstance;
    componente.agregarMensajeDelSistema('Hay **3 filas** para revisar.');
    fixture.detectChanges();
    const caja = fixture.nativeElement as HTMLElement;
    // El bloque de consultas solo existe con un archivo cargado; el texto no debe traer «**» y, si
    // el bloque está, la negrita es un elemento y no un par de asteriscos.
    expect(caja.textContent).not.toContain('**');
    if (caja.textContent?.includes('3 filas')) {
      expect(Array.from(caja.querySelectorAll('strong')).some(el => el.textContent === '3 filas')).toBeTrue();
    }
  });
  it('una columna del archivo sirve a un solo campo: no se repite en «Detalle de la periodicidad» (D5-07)', () => {
    // EL DEFECTO: cada campo buscaba su mejor columna sin mirar a los demás. «periodicidad» era
    // la coincidencia exacta de «Periodicidad» y, a la vez, una sugerencia del 60 % para «Detalle de
    // la periodicidad» (el nombre del segundo contiene el del primero): al importar, el mismo valor
    // se escribía en los dos campos. Visto en el recorrido de la consola con un CSV de Festivales.
    servicio.dominiosImportables.and.returnValue(of({
      dominios: [{
        dominio: 'festivales',
        etiqueta: 'Festivales',
        estadoAlImportar: 'publicado',
        porQueEseEstado: 'Nace publicado para poder reclamarse.',
        campos: [
          { nombre: 'periodicidad', etiqueta: 'Periodicidad', obligatorio: false },
          { nombre: 'periodicidadDetalle', etiqueta: 'Detalle de la periodicidad', obligatorio: false },
        ],
      }],
    }));
    const otra = TestBed.createComponent(AdminPreparacionAsistidaPanelComponent);
    otra.componentRef.setInput('idModulo', 'festivales');
    otra.detectChanges();
    const componente = otra.componentInstance;

    componente.proponerCorrespondencias(['periodicidad']);
    expect(componente.correspondencias()['periodicidad']).toBe(0);
    expect(componente.correspondencias()['periodicidadDetalle']).toBe(-1);

    componente.proponerCorrespondencias(['periodicidad', 'Detalle de la periodicidad']);
    expect(componente.correspondencias()['periodicidad']).toBe(0);
    expect(componente.correspondencias()['periodicidadDetalle']).toBe(1);
  });
  it('Mercados: cada columna de su plantilla se empareja con su campo, y «Alcance» no se confunde con «Nivel de cobertura» (CON-01)', () => {
    const campos = [
      { nombre: 'nombre', etiqueta: 'Nombre del mercado', obligatorio: true },
      { nombre: 'alcance', etiqueta: 'Alcance', obligatorio: false },
      { nombre: 'modalidad', etiqueta: 'Modalidad', obligatorio: false },
      { nombre: 'nivelCobertura', etiqueta: 'Nivel de cobertura', obligatorio: true },
      { nombre: 'departamento', etiqueta: 'Departamento', obligatorio: false },
      { nombre: 'municipio', etiqueta: 'Municipio', obligatorio: false },
      { nombre: 'lugarEspecifico', etiqueta: 'Lugar específico', obligatorio: false },
      { nombre: 'organizacion', etiqueta: 'Organización responsable', obligatorio: false },
      { nombre: 'festival', etiqueta: 'Festival en cuyo marco se realiza', obligatorio: false },
      { nombre: 'correoContacto', etiqueta: 'Correo de contacto', obligatorio: false },
    ];
    servicio.dominiosImportables.and.returnValue(of({
      dominios: [{
        dominio: 'mercados', etiqueta: 'Mercados', estadoAlImportar: 'borrador',
        porQueEseEstado: 'Un Mercado se publica cuando alguien del PNMC lo revisa.', campos,
      }],
    }));
    const otra = TestBed.createComponent(AdminPreparacionAsistidaPanelComponent);
    otra.componentRef.setInput('idModulo', 'mercados');
    otra.detectChanges();
    const componente = otra.componentInstance;

    // Con las columnas exactamente como las pone la plantilla, cada una va a su campo y ninguna se repite.
    componente.proponerCorrespondencias(campos.map(campo => campo.etiqueta));
    campos.forEach((campo, indice) => expect(componente.correspondencias()[campo.nombre]).withContext(campo.nombre).toBe(indice));
    // Y con un archivo sin la columna del festival, «Nombre del mercado» no la roba.
    componente.proponerCorrespondencias(['Nombre del mercado', 'Organización responsable']);
    expect(componente.correspondencias()['nombre']).toBe(0);
    expect(componente.correspondencias()['organizacion']).toBe(1);
    expect(componente.correspondencias()['festival']).toBe(-1);
  });
  it('«Previsualizar importación» llama al servidor con el dominio elegido (D5-01)', async () => {
    // EL DEFECTO: la acción volvía en silencio si el dominio no era «festivals», que es el
    // identificador del módulo de la consola; el dominio de la API es «festivales», así que jamás
    // llamaba al servidor. La pantalla entera de importación estaba muerta en su paso final y
    // ninguna prueba pulsaba el botón.
    servicio.previsualizar.and.returnValue(of({
      id: 31, dominio: 'festivales', nombreArchivo: 'festivales.csv', formato: 'csv',
      huellaArchivo: 'a'.repeat(64), huellaPlan: 'b'.repeat(64), versionContrato: 1, estado: 'previsualizado',
      fechaPrevisualizacion: '2026-11-10T10:00:00Z', fechaAplicacion: null, fechaExpiracion: null,
      fechaDepuracion: null, estadoRetencion: 'detalle_temporal', esPropio: true, puedeConfirmar: true,
      totalFilas: 1, filasImportables: 1, filasRechazadas: 0, filasAplicadas: 0, filasExcluidas: 0,
      filas: [], aviso: '',
    }) as never);
    const componente = fixture.componentInstance;
    componente.archivoFuente.set(new File(['nombre\nFestival A'], 'festivales.csv', { type: 'text/csv' }));
    componente.filasProcesadas.set([{ nombre: 'Festival A', departamento: 'Huila' }]);

    await componente.previsualizarImportacion();

    expect(servicio.previsualizar).toHaveBeenCalledTimes(1);
    expect(servicio.previsualizar).toHaveBeenCalledWith('festivales', jasmine.objectContaining({
      nombreArchivo: 'festivales.csv',
      formato: 'csv',
      versionContrato: 1,
      filas: [{ numeroFila: 2, valores: { nombre: 'Festival A', departamento: 'Huila' } }],
    }));
    expect(componente.previsualizacionImportacion()?.id).toBe(31);
  });

  it('dice el estado con que nace lo importado como lo dice una persona, sin guiones bajos (D5b)', () => {
    const componente = fixture.componentInstance;

    expect(componente.estadoLegible('pendiente_de_confirmacion')).toBe('pendiente de confirmación');
    expect(componente.estadoLegible('borrador')).toBe('borrador');
    expect(componente.estadoLegible('publicado')).toBe('publicado');
    // Un código que no conoce se lee sin guiones bajos, no tal cual.
    expect(componente.estadoLegible('en_custodia')).toBe('en custodia');
  });

  it('la misma pregunta dos veces pinta dos mensajes: el chat no se identifica por su texto', () => {
    // Angular no falla ante claves repetidas: AVISA (NG0955) y pinta igual. Por eso se vigila el aviso.
    const avisos = spyOn(console, 'warn');
    // Con un archivo cargado aparece el chat. Se simula el archivo y se pregunta lo mismo dos veces.
    const componente = fixture.componentInstance;
    componente.archivoFuente.set(new File(['x'], 'festivales.csv', { type: 'text/csv' }));
    componente.filasFuente.set([{ nombre: 'Festival A' }] as never);
    fixture.detectChanges();

    for (let i = 0; i < 2; i++) {
      componente.consulta.set('cuántos registros');
      componente.enviarConsulta();
      fixture.detectChanges();
    }

    const delUsuario = (fixture.nativeElement as HTMLElement).querySelectorAll('.bg-morado.text-white.self-end');
    expect(delUsuario.length).toBe(2);
    // Cada respuesta del sistema también es un mensaje propio, aunque el texto de las dos sea idéntico.
    expect(componente.mensajesDeConsulta().filter(m => m.emisor === 'usuario').length).toBe(2);
    expect(componente.mensajesDeConsulta().filter(m => m.emisor === 'sistema').length).toBeGreaterThanOrEqual(3);
    expect(avisos.calls.allArgs().flat().filter(x => String(x).includes('NG0955'))).toEqual([]);
  });
});
