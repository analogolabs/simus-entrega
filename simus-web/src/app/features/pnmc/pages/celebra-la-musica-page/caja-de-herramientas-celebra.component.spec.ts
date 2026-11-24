import { TestBed } from '@angular/core/testing';
import { RecursoDeCelebra } from '../../../../core/services/celebra-la-musica.service';
import { CajaDeHerramientasCelebraComponent } from './caja-de-herramientas-celebra.component';

const R = (id: number, titulo: string, archivoId: number | null, url: string | null): RecursoDeCelebra =>
  ({ id, grupo: 'Piezas', titulo, descripcion: null, archivoId, url, orden: id });

function montar(recursos: RecursoDeCelebra[]) {
  const f = TestBed.createComponent(CajaDeHerramientasCelebraComponent);
  f.componentRef.setInput('recursos', recursos);
  f.detectChanges();
  return f;
}

describe('CajaDeHerramientasCelebraComponent: vista previa por tipo', () => {
  const caja = () => TestBed.createComponent(CajaDeHerramientasCelebraComponent).componentInstance;

  it('clasifica cada tipo de archivo y deja el resto como ficha', () => {
    const c = caja();
    expect(c.vistaDe(R(1, 'Afiche.png', 1, '/api/v1/publico/archivos/1'))).toBe('imagen');
    expect(c.vistaDe(R(2, 'Cuña.mp3', 2, '/api/v1/publico/archivos/2'))).toBe('audio');
    expect(c.vistaDe(R(3, 'Spot.mp4', 3, '/api/v1/publico/archivos/3'))).toBe('video');
    expect(c.vistaDe(R(4, 'Guía.pdf', 4, '/api/v1/publico/archivos/4'))).toBe('pdf');
    expect(c.vistaDe(R(5, 'Plantilla.xlsx', 5, '/api/v1/publico/archivos/5'))).toBe('oficina');
    expect(c.vistaDe(R(6, 'Todo.zip', 6, '/api/v1/publico/archivos/6'))).toBe('comprimido');
    expect(c.vistaDe(R(7, 'Logo', 7, 'https://celebra.example/logo.png'))).toBe('enlace');
    expect(c.vistaDe(R(8, 'Sin enlace', null, null))).toBe('otro');
  });

  it('una imagen se muestra con vista previa y, si no carga, cae a la ficha con respaldo', () => {
    const f = montar([R(1, 'Afiche.png', 1, '/api/v1/publico/archivos/1')]);
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('img.caja__imagen')).not.toBeNull();
    el.querySelector('img.caja__imagen')!.dispatchEvent(new Event('error'));
    f.detectChanges();
    expect(el.querySelector('img.caja__imagen')).toBeNull();
    expect(el.querySelector('[data-testid="caja-respaldo"]')?.textContent).toContain('No se pudo mostrar la vista previa');
    expect(el.querySelector('[data-testid="caja-descarga"]')).not.toBeNull();
  });

  it('un PDF o un documento de oficina muestran ficha con su tipo y el botón de descarga, sin errores', () => {
    const f = montar([R(1, 'Guía.pdf', 4, '/api/v1/publico/archivos/4'), R(2, 'Plantilla.xlsx', 5, '/api/v1/publico/archivos/5')]);
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('[data-testid="caja-respaldo"]')?.textContent).toContain('Documento PDF');
    expect(el.querySelector('[data-testid="caja-descarga"]')?.textContent).toContain('Descargar');
    (el.querySelectorAll('.caja__fila')[1] as HTMLElement).click();
    f.detectChanges();
    expect(el.querySelector('[data-testid="caja-respaldo"]')?.textContent).toContain('Documento de oficina');
  });

  it('el audio y el video usan su reproductor nativo', () => {
    const f = montar([R(1, 'Cuña.mp3', 2, '/api/v1/publico/archivos/2'), R(2, 'Spot.mp4', 3, '/api/v1/publico/archivos/3')]);
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('audio[controls]')).not.toBeNull();
    (el.querySelectorAll('.caja__fila')[1] as HTMLElement).click();
    f.detectChanges();
    expect(el.querySelector('video[controls]')).not.toBeNull();
  });
});
