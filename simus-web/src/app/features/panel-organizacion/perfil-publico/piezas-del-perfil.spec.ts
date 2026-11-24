import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EnlaceDelPerfil } from '../../../core/formularios/redes-del-perfil';
import { ItemDePortafolio } from '../../../core/services/perfil-publico.service';
import { EnlacesDelPerfilComponent } from './enlaces-del-perfil.component';
import { FotoDelPerfilComponent } from './foto-del-perfil.component';
import { PortafolioDelPerfilComponent } from './portafolio-del-perfil.component';

@Component({
  standalone: true,
  imports: [EnlacesDelPerfilComponent],
  template: `<app-enlaces-del-perfil [(enlaces)]="enlaces" [mostrarTodos]="todos()" />`,
})
class AnfitrionDeEnlaces {
  enlaces: EnlaceDelPerfil[] = [];
  readonly todos = signal(false);
}

describe('EnlacesDelPerfilComponent', () => {
  it('«Añadir enlace» ofrece las redes básicas y «Otro», y añade la fila elegida', () => {
    const fixture = TestBed.createComponent(AnfitrionDeEnlaces);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    (raiz.querySelector('[data-anadir-enlace]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const claves = Array.from(raiz.querySelectorAll('[data-red-opcion]')).map(b => b.getAttribute('data-red-opcion'));
    expect(claves).toEqual(['instagram', 'facebook', 'youtube', 'spotify', 'soundcloud', 'bandcamp', 'tiktok', 'x', 'linkedin', 'otro']);

    (raiz.querySelector('[data-red-opcion="youtube"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.enlaces).toEqual([{ red: 'youtube', url: '', etiqueta: null }]);
    expect(raiz.querySelector('[data-enlace-fila] input[id^="perfil-enlace-etiqueta"]')).toBeNull();
    expect(raiz.querySelector('[data-enlace-fila] app-icono-de-enlace')).not.toBeNull();
  });

  it('«Otro» pide un rótulo opcional y lo guarda en la fila', () => {
    const fixture = TestBed.createComponent(AnfitrionDeEnlaces);
    fixture.componentInstance.enlaces = [{ red: 'otro', url: 'https://mi-sitio.org', etiqueta: null }];
    fixture.detectChanges();
    const campo = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#perfil-enlace-etiqueta-0')!;
    campo.value = 'Mi sitio';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.enlaces[0].etiqueta).toBe('Mi sitio');
  });

  it('una red que ya está no se ofrece otra vez, pero «Otro» sí', () => {
    const fixture = TestBed.createComponent(AnfitrionDeEnlaces);
    fixture.componentInstance.enlaces = [{ red: 'instagram', url: 'https://instagram.com/a' }, { red: 'otro', url: 'https://mi-sitio.org' }];
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    (raiz.querySelector('[data-anadir-enlace]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((raiz.querySelector('[data-red-opcion="instagram"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((raiz.querySelector('[data-red-opcion="otro"]') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('señala la dirección que no es de la red, con su ejemplo, solo al tocarla o al guardar', () => {
    const fixture = TestBed.createComponent(AnfitrionDeEnlaces);
    fixture.componentInstance.enlaces = [{ red: 'instagram', url: 'https://www.facebook.com/a' }];
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-error-de-campo]')).toBeNull();
    fixture.componentInstance.todos.set(true);
    fixture.detectChanges();
    expect(raiz.querySelector('[data-error-de-campo]')?.textContent).toContain('no es de Instagram');
  });

  it('no se pasa de cinco enlaces', () => {
    const fixture = TestBed.createComponent(AnfitrionDeEnlaces);
    fixture.componentInstance.enlaces = ['a', 'b', 'c', 'd', 'e'].map(x => ({ red: 'otro' as const, url: `https://${x}.org` }));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-anadir-enlace]')).toBeNull();
  });
});

@Component({
  standalone: true,
  imports: [PortafolioDelPerfilComponent],
  template: `<app-portafolio-del-perfil [(portafolio)]="items" />`,
})
class AnfitrionDePortafolio {
  items: ItemDePortafolio[] = [];
}

describe('PortafolioDelPerfilComponent', () => {
  function escribir(raiz: HTMLElement, selector: string, valor: string): void {
    const campo = raiz.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  it('añade un elemento con título, clase, enlace, descripción y año, y normaliza el enlace a https', async () => {
    const fixture = TestBed.createComponent(AnfitrionDePortafolio);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    (raiz.querySelector('[data-anadir-al-portafolio]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    escribir(raiz, '#perfil-portafolio-titulo', 'Currulao');
    escribir(raiz, '#perfil-portafolio-url', 'musica.example.org/c');
    escribir(raiz, '#perfil-portafolio-descripcion', 'Grabación de campo');
    escribir(raiz, '#perfil-portafolio-anio', '2024');
    (Array.from(raiz.querySelectorAll<HTMLInputElement>('input[name="portafolioTipo"]'))[1]).click();
    (raiz.querySelector('[data-confirmar-elemento]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.items).toEqual([{ tipo: 'video', titulo: 'Currulao', url: 'https://musica.example.org/c', descripcion: 'Grabación de campo', anio: 2024 }]);
    expect(raiz.querySelector('[data-item-resumen]')?.textContent).toContain('Video · 2024');
    expect(raiz.querySelector('[data-portafolio-editor]')).toBeNull();
  });

  it('un elemento sin título o con enlace que no sirve no se añade y dice por qué', async () => {
    const fixture = TestBed.createComponent(AnfitrionDePortafolio);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    (raiz.querySelector('[data-anadir-al-portafolio]') as HTMLButtonElement).click();
    fixture.detectChanges();
    escribir(raiz, '#perfil-portafolio-url', 'nada');
    (raiz.querySelector('[data-confirmar-elemento]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.items).toEqual([]);
    expect(raiz.querySelector('#perfil-portafolio-titulo-error')?.textContent).toContain('título');
    expect(raiz.querySelector('#perfil-portafolio-url-error')?.textContent).toContain('https');
  });

  it('se edita, se ordena y se quita; los elementos de antes (sin descripción ni año) se conservan', async () => {
    const fixture = TestBed.createComponent(AnfitrionDePortafolio);
    fixture.componentInstance.items = [
      { tipo: 'audio', titulo: 'Uno', url: 'https://a.org/1' },
      { tipo: 'enlace', titulo: 'Dos', url: 'https://a.org/2' },
    ];
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const botones = (i: number) => Array.from(raiz.querySelectorAll(`[data-portafolio-item="${i}"] button`)) as HTMLButtonElement[];

    // Bajar «Uno».
    botones(0)[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.items.map(x => x.titulo)).toEqual(['Dos', 'Uno']);

    // Editar «Dos» (ahora el primero): el editor abre con sus datos.
    botones(0)[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect((raiz.querySelector('#perfil-portafolio-titulo') as HTMLInputElement).value).toBe('Dos');
    (Array.from(raiz.querySelectorAll('[data-portafolio-editor] button')).find(b => b.textContent?.includes('Cancelar')) as HTMLButtonElement).click();
    fixture.detectChanges();

    // Quitar «Uno».
    botones(1)[3].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.items.map(x => x.titulo)).toEqual(['Dos']);
    expect(fixture.componentInstance.items[0].descripcion).toBeUndefined();
  });
});

@Component({
  standalone: true,
  imports: [FotoDelPerfilComponent],
  template: `<app-foto-del-perfil [vistaPrevia]="null" (elegida)="elegida = $event" [(descripcion)]="descripcion" />`,
})
class AnfitrionDeFoto {
  elegida: File | null = null;
  descripcion = '';
}

describe('FotoDelPerfilComponent', () => {
  function elegir(fixture: { nativeElement: HTMLElement; detectChanges(): void }, archivo: File): void {
    const entrada = fixture.nativeElement.querySelector<HTMLInputElement>('#perfil-foto')!;
    Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('ofrece «Subir foto» con los formatos y el tamaño a la vista', () => {
    const fixture = TestBed.createComponent(AnfitrionDeFoto);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-subir-foto]')?.textContent).toContain('Subir foto');
    expect(raiz.querySelector('[data-foto-formatos]')?.textContent).toContain('WebP, PNG o JPEG, de hasta 2 MB');
  });

  it('acepta una imagen válida y avisa al anfitrión', () => {
    const fixture = TestBed.createComponent(AnfitrionDeFoto);
    fixture.detectChanges();
    const archivo = new File(['x'], 'retrato.png', { type: 'image/png' });
    elegir(fixture, archivo);
    expect(fixture.componentInstance.elegida).toBe(archivo);
  });

  it('rechaza un formato que no es y un peso que se pasa, con un mensaje que se entiende', () => {
    const fixture = TestBed.createComponent(AnfitrionDeFoto);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    elegir(fixture, new File(['x'], 'cv.pdf', { type: 'application/pdf' }));
    expect(fixture.componentInstance.elegida).toBeNull();
    expect(raiz.querySelector('#perfil-foto-error')?.textContent).toContain('no es una imagen WebP, PNG o JPEG');

    const grande = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' });
    elegir(fixture, grande);
    expect(fixture.componentInstance.elegida).toBeNull();
    expect(raiz.querySelector('#perfil-foto-error')?.textContent).toContain('el máximo es 2,0 MB');
  });
});
