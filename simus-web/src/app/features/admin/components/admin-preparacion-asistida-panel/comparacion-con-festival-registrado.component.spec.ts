import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiClientService } from '../../../../core/http/api-client.service';
import { ComparacionConFestivalRegistradoComponent } from './comparacion-con-festival-registrado.component';

const FICHA = {
  id: '12',
  nombre: 'Festival de Chirimía de Arauca',
  estado: 'publicado',
  nivelCobertura: 'departamental',
  departamento: 'Arauca',
  municipio: null,
  periodicidad: 'anual',
  correoContacto: 'info@chirimia.test',
  sitioWeb: null,
  organizacionResponsableId: null,
  organizacionResponsableNombre: null,
  esRegistroHistorico: true,
};

describe('Comparación con el Festival ya registrado (D5b)', () => {
  let fixture: ComponentFixture<ComparacionConFestivalRegistradoComponent>;
  let api: jasmine.SpyObj<ApiClientService>;

  const montar = async (): Promise<void> => {
    fixture = TestBed.createComponent(ComparacionConFestivalRegistradoComponent);
    fixture.componentRef.setInput('festivalId', '12');
    fixture.componentRef.setInput('datos', {
      nombre: 'Festival Chirimía Arauca',
      nivelCobertura: 'departamental',
      departamento: 'arauca',
      municipio: null,
      periodicidad: 'anual',
      correoContacto: null,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiClientService>('ApiClientService', ['get']);
    TestBed.configureTestingModule({
      imports: [ComparacionConFestivalRegistradoComponent],
      providers: [provideRouter([]), { provide: ApiClientService, useValue: api }],
    });
  });

  it('trae la ficha del Festival comparado al abrirse', async () => {
    api.get.and.returnValue(of(FICHA));

    await montar();

    expect(api.get).toHaveBeenCalledOnceWith('/api/v1/admin/festivales/12', {});
    expect(texto()).toContain('Festival de Chirimía de Arauca');
  });

  it('pone los dos lados y marca solo lo que de verdad es distinto', async () => {
    api.get.and.returnValue(of(FICHA));

    await montar();

    const filas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'));
    const fila = (campo: string) => filas.find(f => f.textContent?.includes(campo))?.textContent ?? '';

    // El nombre difiere; el departamento solo cambia de mayúsculas y tildes, así que no es «Distinto».
    expect(fila('Nombre')).toContain('Distinto');
    expect(fila('Departamento')).not.toContain('Distinto');
    expect(fila('Correo de contacto')).toContain('Distinto');
    expect(fila('Estado')).toContain('Publicado');
    expect(texto()).toContain('Abrir su ficha en la consola');
  });

  it('dice que el registrado es histórico, sin organización', async () => {
    api.get.and.returnValue(of(FICHA));

    await montar();

    expect(texto()).toContain('Ninguna: registro histórico');
  });

  it('si no puede traer el Festival lo dice, sin romper la revisión', async () => {
    api.get.and.returnValue(throwError(() => new Error('403')));

    await montar();

    expect(texto()).toContain('No pude traer ese Festival');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('avisa que se cierra para que quien la abrió decida qué hacer', async () => {
    api.get.and.returnValue(of(FICHA));
    await montar();
    let cerrada = false;
    fixture.componentInstance.cerrar.subscribe(() => { cerrada = true; });

    const boton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find(b => b.textContent?.includes('Cerrar la comparación'));
    boton?.click();

    expect(cerrada).toBeTrue();
  });

  it('si cambia el Festival comparado, trae el nuevo y no se queda con el anterior', async () => {
    api.get.and.returnValue(of(FICHA));
    await montar();

    api.get.and.returnValue(of({ ...FICHA, id: '99', nombre: 'Otro Festival' }));
    fixture.componentRef.setInput('festivalId', '99');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.get).toHaveBeenCalledWith('/api/v1/admin/festivales/99', {});
    expect(texto()).toContain('Otro Festival');
    expect(texto()).not.toContain('Festival de Chirimía de Arauca');
  });
});
