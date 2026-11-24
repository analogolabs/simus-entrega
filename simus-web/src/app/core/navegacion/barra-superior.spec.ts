import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BARRA_SUPERIOR_PROPIA, laPantallaReservaSuBarra } from './barra-superior';

@Component({ template: '' })
class PantallaVacia {}

/**
 * La barra superior fija nunca tapa contenido (punto 31 del mapa de comentarios): por omisión el armazón del portal
 * reserva su alto; se libran solo las pantallas que ya lo ponen (lista, `data` o la 404).
 */
describe('Reserva del alto de la barra superior', () => {
  function montar(): Router {
    TestBed.configureTestingModule({
      providers: [provideRouter([
        { path: 'ecosistema/agenda-de-citas', component: PantallaVacia },
        { path: 'ecosistema/confirmar-correo', component: PantallaVacia },
        { path: 'ecosistema/festivales', component: PantallaVacia },
        { path: 'noticias', component: PantallaVacia },
        { path: 'nueva-pantalla', component: PantallaVacia },
        { path: 'con-encabezado-propio', component: PantallaVacia, data: BARRA_SUPERIOR_PROPIA },
        { path: '**', component: PantallaVacia },
      ])],
    });
    return TestBed.inject(Router);
  }

  async function ir(router: Router, url: string): Promise<boolean> {
    await router.navigateByUrl(url);
    return laPantallaReservaSuBarra(router);
  }

  it('una pantalla nueva o que se quedaba bajo la barra la reserva el armazón', async () => {
    expect(await ir(montar(), '/nueva-pantalla')).toBeFalse();
  });

  it('«Agenda de citas» y la confirmación del correo quedan cubiertas por la regla', async () => {
    const router = montar();
    expect(await ir(router, '/ecosistema/agenda-de-citas')).toBeFalse();
    expect(await ir(router, '/ecosistema/confirmar-correo')).toBeFalse();
  });

  it('las que ya dejaban sitio por su cuenta no lo duplican', async () => {
    const router = montar();
    expect(await ir(router, '/noticias?tema=x')).toBeTrue();
    expect(await ir(router, '/ecosistema/festivales')).toBeTrue();
  });

  it('una ruta puede declarar que trae su propio encabezado', async () => {
    expect(await ir(montar(), '/con-encabezado-propio')).toBeTrue();
  });

  it('la 404 trae su propio margen', async () => {
    expect(await ir(montar(), '/no-existe')).toBeTrue();
  });
});
