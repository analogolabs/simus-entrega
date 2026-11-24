import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SobreElPnmcPageComponent } from './sobre-el-pnmc-page.component';

describe('SobreElPnmcPageComponent visual hierarchy', () => {
  let fixture: ComponentFixture<SobreElPnmcPageComponent>;

  beforeEach(async () => {
    localStorage.removeItem('pnmc_web_texts');
    localStorage.removeItem('pnmc_web_team_members');

    await TestBed.configureTestingModule({
      imports: [SobreElPnmcPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SobreElPnmcPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('pnmc_web_texts');
    localStorage.removeItem('pnmc_web_team_members');
  });

  // P-3: el objetivo de cada eje vive DENTRO del eje; ya no hay tarjetas de objetivo separadas.
  it('cada eje muestra su objetivo y sus componentes numerados con su nombre, y no hay sección de objetivos aparte', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('#pnmc-objetivos')).toBeNull();
    const ejes = raiz.querySelectorAll('#ejes article');
    expect(ejes.length).toBe(3);
    ejes.forEach((eje, i) => {
      expect(eje.textContent).toContain(fixture.componentInstance.objetivoDeEje(i).titulo);
      const items = eje.querySelectorAll('[data-testid="componentes-del-eje"] li');
      expect(items.length).toBeGreaterThan(0);
      items.forEach((li, j) => {
        expect(li.textContent).toContain(`0${i + 1}.${j + 1}`);
        expect(li.textContent?.replace(/\s+/g, ' ').trim().length).toBeGreaterThan(8);
      });
    });
  });

  // P-4: «Celebra la música» tiene ruta; «Territorios sonoros» se anuncia «Próximamente» y no es un enlace.
  it('Celebra la música enlaza a su micrositio y Territorios sonoros dice «Próximamente» sin ruta', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const celebra = raiz.querySelector('#celebra-la-musica')!;
    expect(celebra.querySelector('a')?.getAttribute('href')).toBe('/pnmc/estrategias/celebra-la-musica');
    const territorios = raiz.querySelector('#territorios-sonoros')!;
    expect(territorios.querySelector('a')).toBeNull();
    expect(territorios.textContent).toContain('Próximamente');
  });

  it('la tarjeta de Celebra la música es el enlace entero: sin botón «Conocer la estrategia», un solo enlace con el nombre', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const celebra = raiz.querySelector('#celebra-la-musica')!;
    expect(celebra.textContent).not.toContain('Conocer la estrategia');
    const enlaces = celebra.querySelectorAll('a');
    expect(enlaces.length).toBe(1);
    expect(enlaces[0].textContent?.trim().length).toBeGreaterThan(0);
    // El `::after` del enlace cubre toda la tarjeta: la clase que lo logra debe seguir ahí.
    expect(enlaces[0].className).toContain('after:absolute');
    expect(enlaces[0].className).toContain('after:inset-0');
  });

  // Y ESTA FIJABA LA MARCA DE AGUA: un icono de 168 px al 80 % asomando por la esquina de cada
  // tarjeta de enfoque, y el fondo de la banda con sus cuatro capas. Las dos cosas se retiraron por
  // el mismo motivo y en el mismo corte, así que la prueba vigila ahora lo que sí debe haber.
  it('cada enfoque abre con su icono sobre el título, y la banda va sobre fondo plano', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const iconos = raiz.querySelectorAll<SVGElement>('[data-testid="approach-icon"]');
    const banda = raiz.querySelector<HTMLElement>('[data-testid="approaches-banner"] section');
    const titulo = raiz.querySelector<HTMLElement>('[data-testid="approaches-title"]');

    expect(iconos.length).toBe(3);
    iconos.forEach(icono => {
      expect(icono.getAttribute('width')).toBe('32');
      expect(icono.classList.contains('absolute')).toBeFalse();
      expect(icono.className.baseVal).toContain('text-verde-claro');
    });
    expect(raiz.querySelectorAll('[data-testid="approach-watermark"]').length).toBe(0);
    expect(banda?.className).toContain('bg-morado');
    expect(banda?.className).not.toContain('background-image');
    expect(titulo?.className).toContain('font-alternate');
  });
});
