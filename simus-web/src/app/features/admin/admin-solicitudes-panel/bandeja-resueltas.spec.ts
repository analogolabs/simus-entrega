import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminSolicitudesPanelComponent } from './admin-solicitudes-panel.component';

/**
 * «RESUELTAS (30 DÍAS)». Decidir un trámite lo sacaba de la bandeja y no quedaba vista alguna
 * de lo hecho. La lista llega ya filtrada por los módulos de la cuenta: aquí se comprueba que la
 * pantalla la pide solo al abrir la vista, la pinta y dice con claridad cuando no hay nada.
 */
describe('AdminSolicitudesPanelComponent · Resueltas', () => {
  let fixture: ComponentFixture<AdminSolicitudesPanelComponent>;
  let componente: AdminSolicitudesPanelComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminSolicitudesPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(AdminSolicitudesPanelComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  const resueltas = () => http.match(peticion => peticion.url.includes('/admin/resueltas'));

  it('no pide lo resuelto hasta que se abre esa vista', () => {
    expect(resueltas().length).toBe(0);
  });

  it('al abrir «Resueltas» lo pide y lo pinta, con quién decidió y sobre qué', () => {
    componente.cambiarVistaDeLaBandeja('resueltas');
    const [peticion] = resueltas();
    peticion.flush({
      dias: 30,
      items: [{
        id: '1', fecha: '2026-11-05T15:00:00Z', accion: 'publicar', accionEtiqueta: 'Publicó',
        grupo: 'noticias', grupoEtiqueta: 'Noticias', tabla: 'Noticias', registroId: '9',
        nombreRegistro: 'Una noticia decidida', autor: { id: '2', nombre: 'Gestora Uno', correo: 'g@pnmc.local' },
      }],
    });
    fixture.detectChanges();

    const fila = fixture.nativeElement.querySelector('[data-resuelta]') as HTMLElement;
    expect(fila.textContent).toContain('Una noticia decidida');
    expect(fila.textContent).toContain('Publicó · Noticias · Gestora Uno');
    // La cola de pendientes no se pinta debajo.
    expect(fixture.nativeElement.querySelector('.revision-barra')).toBeNull();
  });

  it('sin decisiones lo dice, y volver a «Pendientes» recupera la bandeja', () => {
    componente.cambiarVistaDeLaBandeja('resueltas');
    resueltas()[0].flush({ dias: 30, items: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-resueltas-vacio]')?.textContent).toContain('30 días');

    componente.cambiarVistaDeLaBandeja('pendientes');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-resueltas]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.revision-barra')).not.toBeNull();
  });

  it('si falla la consulta lo dice en vez de quedarse vacío', () => {
    componente.cambiarVistaDeLaBandeja('resueltas');
    resueltas()[0].flush('error', { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('No fue posible consultar lo resuelto');
  });
});
