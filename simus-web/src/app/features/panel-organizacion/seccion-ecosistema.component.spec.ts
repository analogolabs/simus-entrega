import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PanelOrganizacionApi } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { SeccionEcosistemaComponent } from './seccion-ecosistema.component';
import { ReclamacionesDeProcesosService } from './reclamaciones-de-procesos.service';

describe('SeccionEcosistemaComponent', () => {
  let fixture: ComponentFixture<SeccionEcosistemaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeccionEcosistemaComponent],
      providers: [
        { provide: PanelOrganizacionApi, useValue: { obtenerFestivales: () => of([]) } },
        { provide: PanelOrganizacionStore, useValue: { organizacionId: () => 'organizacion-1', esAdministradora: () => true } },
        { provide: ReclamacionesDeProcesosService, useValue: { historicos: () => of({ codigoDepartamento: '05', nombreDepartamento: 'Antioquia', festivales: [] }) } },
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SeccionEcosistemaComponent);
    fixture.detectChanges();
  });

  it('muestra solo la gestión de Festivales, con un solo título y sin mensajes repetidos', () => {
    const contenido = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(contenido).toContain('Festivales');
    expect(contenido).not.toContain('Consulta los procesos disponibles');
    expect(contenido).not.toContain('Festivales de la organización');
    expect(Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('h1')).map(h => h.textContent?.trim())).toEqual(['Festivales']);
    expect(contenido).not.toContain('Otros tipos de registro');
  });

  it('NO ofrece los Festivales históricos debajo de la lista: son una herramienta aparte (decisión 74)', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent ?? '').not.toContain('¿Tu Festival ya está en SIMUS?');
    expect(raiz.querySelector('app-procesos-historicos-reclamables')).toBeNull();
    expect(raiz.querySelector('#historicos')).toBeNull();
  });
});
