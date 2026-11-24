import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminAltaOrganizacionComponent, PASOS_DE_LA_ORGANIZACION } from './admin-alta-organizacion.component';
import { AltaAdministrativaService, CoincidenciaDeAlta, OrganizacionNueva, ResultadoDeAlta } from '../../../core/services/alta-administrativa.service';
import { CatalogService } from '../../../core/services/catalog.service';

/**
 * Registrar una organización desde la consola.
 *
 * <b>POR QUE EXISTEN AHORA.</b> Este asistente tampoco tenía ninguna prueba, y en el corte v173 se
 * le cambió el armazón por `app-asistente-de-alta`.
 *
 * <b>Y SUS PASOS SON SUYOS, A PROPOSITO:</b> Identidad · Sede · Responsable · Revisión. Una
 * organización no es un proceso del Ecosistema —no se le pregunta «cada cuánto ocurre» ni «dónde se
 * realiza»—: es el actor que responde por ellos. Por eso el armazón recibe los pasos como entrada en
 * vez de imponerlos, y esta prueba fija que aquí no son los cinco del vocabulario común.
 */
describe('el alta de una organización desde la consola', () => {
  let fixture: ComponentFixture<AdminAltaOrganizacionComponent>;
  let componente: AdminAltaOrganizacionComponent;
  let enviado: OrganizacionNueva | null;
  let respuesta: ResultadoDeAlta;
  let coincidencias: CoincidenciaDeAlta[];

  const raiz = () => fixture.nativeElement as HTMLElement;
  const texto = () => raiz().textContent ?? '';

  beforeEach(async () => {
    enviado = null;
    respuesta = { ok: true, id: '3200', nombre: 'Fundación Nueva' };
    coincidencias = [];

    const alta: Partial<AltaAdministrativaService> = {
      crearOrganizacion: async (datos: OrganizacionNueva) => { enviado = datos; return respuesta; },
      coincidenciasDeOrganizacion: async () => coincidencias,
    };
    const catalogo: Partial<CatalogService> = { fetchDivipolaConCodigos: () => of([]) };

    await TestBed.configureTestingModule({
      imports: [AdminAltaOrganizacionComponent],
      providers: [
        { provide: AltaAdministrativaService, useValue: alta },
        { provide: CatalogService, useValue: catalogo },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAltaOrganizacionComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('tiene sus propios cuatro pasos, no los cinco de un proceso del Ecosistema', () => {
    expect(PASOS_DE_LA_ORGANIZACION.map(p => p.titulo))
      .toEqual(['Identidad', 'Sede', 'Responsable', 'Revisión']);
  });

  it('cada paso pregunta lo suyo', () => {
    expect(texto()).toContain('Nombre de la organización');

    componente.paso.set(2);
    fixture.detectChanges();
    expect(texto()).toContain('Departamento de la sede');

    componente.paso.set(3);
    fixture.detectChanges();
    expect(texto()).toContain('Quién responde por la organización');
  });

  it('la revisión declara la procedencia institucional', () => {
    componente.campo('nombre', 'Fundación Nueva');
    componente.paso.set(4);
    fixture.detectChanges();

    // LA PROCEDENCIA ES DEL PROGRAMA porque la incorpora la consola. Que el PNMC la registre no la
    // convierte en su responsable: son dimensiones distintas y esta pantalla las separa.
    expect(texto()).toContain('Plan Nacional de Música para la Convivencia');
    expect(texto()).toContain('Fundación Nueva');
  });

  it('no se pide contraseña: la organización todavía no tiene cuenta', () => {
    // MUTANTE QUE MATA: colar aquí una contraseña inicial. Una organización no nace con cuenta; su
    // administración llega cuando ella misma la reclama.
    expect(raiz().querySelector('input[type="password"]')).toBeNull();
    expect(texto()).toContain('No se pide contraseña');
  });

  it('lo que falta se nombra campo a campo', () => {
    expect(componente.loQueFalta()).toEqual([
      'el nombre', 'el correo de contacto', 'el departamento de la sede',
      'el municipio de la sede', 'quién responde por ella',
    ]);

    componente.campo('nombre', 'Fundación Nueva');
    componente.campo('correoContacto', 'contacto@fundacion.test');
    componente.cambiarDepartamento('41');
    componente.campo('codigoMunicipioSede', '41001');
    componente.campo('responsableNombre', 'Rocío Salazar');

    expect(componente.loQueFalta()).toEqual([]);
  });

  it('cambiar de departamento borra el municipio elegido, que ya no le pertenece', () => {
    componente.cambiarDepartamento('41');
    componente.campo('codigoMunicipioSede', '41001');

    componente.cambiarDepartamento('05');

    expect(componente.formulario().codigoMunicipioSede).toBe('');
  });

  it('registrar manda lo escrito recortado y deja el formulario limpio', async () => {
    componente.campo('nombre', '  Fundación Nueva  ');
    componente.campo('correoContacto', 'contacto@fundacion.test');
    componente.campo('responsableNombre', ' Rocío Salazar ');
    componente.paso.set(4);

    await componente.registrar();

    expect(enviado!.nombre).toBe('Fundación Nueva');
    expect(enviado!.responsableNombre).toBe('Rocío Salazar');
    // LO VACIO VIAJA COMO NULO: una identificación en blanco no es una identificación vacía.
    expect(enviado!.identificacion).toBeNull();

    expect(componente.formulario().nombre).toBe('');
    expect(componente.paso()).toBe(1);
  });

  it('si el servidor devuelve un error del responsable, vuelve AL PASO del responsable', async () => {
    respuesta = { ok: false, errores: { responsableCorreo: ['El correo no es válido.'] }, error: 'Revisa los campos marcados.' };
    componente.campo('nombre', 'Fundación Nueva');
    componente.paso.set(4);

    await componente.registrar();

    // MUTANTE QUE MATA: volver al paso 1. Quien registra tiene que ver el campo que falló, no
    // empezar de nuevo y buscarlo.
    expect(componente.paso()).toBe(3);
    expect(componente.erroresDe('responsableCorreo')).toEqual(['El correo no es válido.']);
  });

  it('avisa de las organizaciones que ya se llaman parecido, sin bloquear', fakeAsync(() => {
    coincidencias = [{ id: '1', nombre: 'Fundación Nueva', territorio: 'Huila', estado: 'activa', organizacionResponsable: null }];

    componente.campo('nombre', 'Fundación Nueva');
    tick(600);

    expect(componente.coincidencias().length).toBe(1);
    expect(componente.loQueFalta()).not.toContain('el nombre');
  }));

  // ───────────── L4 · una sola lista de documentos y lo que falta por paso ─────────────

  it('el tipo de documento del responsable usa la lista única de diez, en minúscula, sin «NIT»', () => {
    expect(componente.tiposDeDocumento.map(tipo => tipo.codigo))
      .toEqual(['cc', 'ce', 'ti', 'rc', 'nuip', 'pa', 'pep', 'ppt', 'die', 'cd']);
    expect(componente.formulario().responsableTipoDocumento).toBe('cc');
  });

  it('lo que falta se dice POR PASO, y avanzar con el paso vacío no lo pinta completo', () => {
    expect(componente.loQueFaltaPorPaso()[1]).toEqual(['el nombre', 'el correo de contacto']);
    expect(componente.loQueFaltaPorPaso()[2]).toEqual(['el departamento de la sede', 'el municipio de la sede']);
    expect(componente.loQueFaltaPorPaso()[3]).toEqual(['quién responde por ella']);

    (raiz().querySelector('[data-testid="siguiente"], button') as HTMLElement | null)?.click();
    const siguiente = Array.from(raiz().querySelectorAll('button')).find(b => b.textContent?.trim() === 'Siguiente')!;
    siguiente.click();
    siguiente.click();
    fixture.detectChanges();

    // El paso 1 se visitó con el nombre vacío: incompleto («!»), no «completado».
    expect(raiz().querySelectorAll('app-indicador-de-pasos li button')[0].textContent).toContain('!');
  });

  it('la revisión muestra la sede (antes se omitía) y lista lo que falta con enlace a cada paso', () => {
    componente.paso.set(4);
    fixture.detectChanges();

    expect(texto()).toContain('Sede');
    expect(raiz().querySelector('[data-testid="asistente-falta"]')?.textContent).toContain('el departamento de la sede');
  });

  it('un correo de contacto mal escrito cuenta como pendiente del paso 1', () => {
    componente.campo('nombre', 'Fundación Nueva');
    componente.campo('correoContacto', 'juan@alcaldia');

    expect(componente.loQueFaltaPorPaso()[1]).toEqual(['un correo de contacto válido']);
  });
});
