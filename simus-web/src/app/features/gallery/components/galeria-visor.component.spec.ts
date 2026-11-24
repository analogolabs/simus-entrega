import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GaleriaVisorComponent } from './galeria-visor.component';
import { FotoDeGaleria } from '../domain/galeria-modelo';

const FOTO: FotoDeGaleria = { id: 12, url: '/api/v1/publico/archivos/12', alt: 'Foto', titulo: 'Gran Concierto', credito: null, fecha: null, lugar: null, albumSlug: 'rock', albumTitulo: 'Rock', razon: 1.5 };

@Component({
  standalone: true, imports: [GaleriaVisorComponent],
  template: `<app-galeria-visor [fotos]="[f]" [indice]="0" rotuloDeVuelta="Fotos" (cerrar)="cerrado = true" (aviso)="avisos.push($event)" />`,
})
class Anfitrion { f = FOTO; cerrado = false; avisos: string[] = []; }

describe('GaleriaVisorComponent: descarga y regreso', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('«Descargar» baja el archivo publicado con un nombre legible y lo avisa', async () => {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    spyOn(window, 'fetch').and.resolveTo(new Response(new Blob(['x'], { type: 'image/png' })));
    const descargas: { href: string; nombre: string }[] = [];
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) { descargas.push({ href: this.href, nombre: this.download }); });
    const boton = f.nativeElement.querySelector('[data-testid="galeria-visor-descargar"]') as HTMLButtonElement;
    expect(boton.getAttribute('aria-label')).toContain('Gran Concierto');
    boton.click();
    await new Promise(r => setTimeout(r, 30));
    expect(window.fetch).toHaveBeenCalledWith('/api/v1/publico/archivos/12', jasmine.anything());
    expect(descargas.length).toBe(1);
    expect(descargas[0].nombre).toBe('gran-concierto-foto-12.png');
    expect(f.componentInstance.avisos[0]).toContain('gran-concierto-foto-12.png');
  });

  it('si no se puede leer el archivo, cae al enlace directo y sigue con nombre legible', async () => {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    spyOn(window, 'fetch').and.rejectWith(new Error('sin red'));
    const descargas: { href: string; nombre: string }[] = [];
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) { descargas.push({ href: this.getAttribute('href') ?? '', nombre: this.download }); });
    (f.nativeElement.querySelector('[data-testid="galeria-visor-descargar"]') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r, 30));
    expect(descargas[0]).toEqual({ href: '/api/v1/publico/archivos/12', nombre: 'gran-concierto-foto-12.jpg' });
  });

  it('«Volver a Fotos» cierra el visor', () => {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    const v = f.nativeElement.querySelector('[data-testid="galeria-visor-volver"]') as HTMLButtonElement;
    expect(v.textContent).toContain('Volver a Fotos');
    v.click();
    expect(f.componentInstance.cerrado).toBeTrue();
  });
});
