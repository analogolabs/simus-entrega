import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GaleriaMuroComponent } from './galeria-muro.component';
import { FotoDeGaleria } from '../domain/galeria-modelo';

const foto = (id: number): FotoDeGaleria => ({ id, url: `/f/${id}`, alt: `Foto ${id}`, titulo: null, credito: null, fecha: null, lugar: null, albumSlug: 'a', albumTitulo: 'A', razon: 1.5 });

@Component({
  standalone: true, imports: [GaleriaMuroComponent],
  template: `<div [style.width.px]="ancho"><app-galeria-muro #m [fotos]="fotos" [maxFilas]="3" (abrir)="abierta = $event" /></div>`,
})
class Anfitrion { ancho = 900; fotos = Array.from({ length: 30 }, (_, i) => foto(i + 1)); abierta: FotoDeGaleria | null = null; }

describe('GaleriaMuroComponent', () => {
  const esperar = () => new Promise(r => setTimeout(r, 60));

  it('muestra como máximo tres filas reales y las recalcula al cambiar el ancho', async () => {
    const f = TestBed.createComponent(Anfitrion);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await esperar(); f.detectChanges();
    const filasDe = () => new Set(Array.from(f.nativeElement.querySelectorAll('li')).map(li => (li as HTMLElement).offsetTop)).size;
    expect(filasDe()).toBe(3);
    const ancho = f.nativeElement.querySelectorAll('li').length;
    f.componentInstance.ancho = 380; f.detectChanges();
    await esperar(); f.detectChanges();
    expect(filasDe()).toBe(3);
    expect(f.nativeElement.querySelectorAll('li').length).toBeLessThan(ancho);
    (f.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(f.componentInstance.abierta?.id).toBe(1);
    f.nativeElement.remove();
  });
});
