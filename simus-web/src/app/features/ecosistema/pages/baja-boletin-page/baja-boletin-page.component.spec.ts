import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { BajaBoletinPageComponent } from './baja-boletin-page.component';
import { BoletinService } from '../../../../core/services/boletin.service';

/** La página del enlace «Darme de baja»: abrirla no da de baja, la da el botón; cuatro estados con rótulo propio. */
describe('la página de baja del boletín', () => {
  let consultas: string[];
  let bajas: string[];

  async function montar(opciones: { testigo?: string | null; vista?: 'activa' | 'baja' | 400 | 503; baja?: 'ok' | 400 | 503 } = {}) {
    consultas = [];
    bajas = [];
    const testigo = opciones.testigo === undefined ? '7.abc' : opciones.testigo;
    const vista = opciones.vista ?? 'activa';
    const servicio = {
      consultarBaja: (t: string) => {
        consultas.push(t);
        return typeof vista === 'number'
          ? throwError(() => ({ status: vista }))
          : of({ estado: vista, correo: 'a***@d***.co' });
      },
      darseDeBaja: (t: string) => {
        bajas.push(t);
        return (opciones.baja ?? 'ok') === 'ok' ? of({ message: 'ok' }) : throwError(() => ({ status: opciones.baja }));
      },
    };
    await TestBed.configureTestingModule({
      imports: [BajaBoletinPageComponent],
      providers: [
        provideRouter([]),
        { provide: BoletinService, useValue: servicio },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(testigo ? { testigo } : {}) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(BajaBoletinPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const cual = (raiz: HTMLElement, id: string) => raiz.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  it('abrir el enlace solo consulta: no da de baja, y pide confirmar con el correo enmascarado', async () => {
    const fixture = await montar();
    expect(consultas).toEqual(['7.abc']);
    expect(bajas.length).toBe(0);
    expect(cual(fixture.nativeElement, 'baja-boletin-confirmar')).not.toBeNull();
    expect(cual(fixture.nativeElement, 'baja-boletin-correo')?.textContent).toContain('a***@d***.co');
  });

  it('el botón da de baja y muestra «baja realizada» con la opción de volver a suscribirte', async () => {
    const fixture = await montar();
    cual(fixture.nativeElement, 'baja-boletin-boton')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(bajas).toEqual(['7.abc']);
    const hecha = cual(fixture.nativeElement, 'baja-boletin-hecha')!;
    expect(hecha.textContent).toContain('te diste de baja');
    expect(cual(fixture.nativeElement, 'baja-boletin-resuscribir')?.getAttribute('href')).toBe('/');
  });

  it('si ya estaba de baja lo dice, sin pedir confirmar otra vez', async () => {
    const fixture = await montar({ vista: 'baja' });
    expect(cual(fixture.nativeElement, 'baja-boletin-boton')).toBeNull();
    expect(cual(fixture.nativeElement, 'baja-boletin-hecha')?.textContent).toContain('Ya estabas dado de baja');
  });

  it('un enlace que el servidor no reconoce dice «Enlace inválido»', async () => {
    const fixture = await montar({ vista: 400 });
    const invalido = cual(fixture.nativeElement, 'baja-boletin-invalido')!;
    expect(invalido.textContent).toContain('Enlace inválido');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('sin testigo no consulta nada y dice «Enlace inválido»', async () => {
    const fixture = await montar({ testigo: null });
    expect(consultas.length).toBe(0);
    expect(cual(fixture.nativeElement, 'baja-boletin-invalido')).not.toBeNull();
    expect(cual(fixture.nativeElement, 'baja-boletin-boton')).toBeNull();
  });

  it('un fallo de red no se confunde con un enlace inválido: dice el motivo y deja reintentar', async () => {
    const fixture = await montar({ vista: 503 });
    expect(cual(fixture.nativeElement, 'baja-boletin-fallo')).not.toBeNull();
    expect(cual(fixture.nativeElement, 'baja-boletin-error')?.textContent).toContain('no cambió');
    expect(cual(fixture.nativeElement, 'baja-boletin-reintentar')).not.toBeNull();
  });

  it('si la baja falla por red conserva el botón para reintentar', async () => {
    const fixture = await montar({ baja: 503 });
    cual(fixture.nativeElement, 'baja-boletin-boton')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(cual(fixture.nativeElement, 'baja-boletin-fallo')).not.toBeNull();
  });

  it('lleva la identidad del SIMUS, reserva el alto de la barra fija y habla del SIMUS, no del PNMC', async () => {
    const fixture = await montar();
    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelector('img[alt="SIMUS"]')).not.toBeNull();
    expect(raiz.querySelector('main')?.className).toContain('--alto-barra-superior');
    expect(raiz.textContent).toContain('Sistema de Información de la Música');
    expect(raiz.textContent).not.toContain('PNMC');
    expect(raiz.querySelector('h1')).not.toBeNull();
  });
});
