import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompartirEnRedesComponent } from './compartir-en-redes.component';

@Component({
  standalone: true,
  imports: [CompartirEnRedesComponent],
  template: `<app-compartir-en-redes titulo="Celebra la Música 2026" nombre="la noticia" url="https://simus.example/noticias/celebra" />`,
})
class Anfitrion {}

describe('CompartirEnRedesComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  const raiz = () => fixture.nativeElement as HTMLElement;
  const enlace = (red: string) => raiz().querySelector<HTMLAnchorElement>(`a[data-compartir="${red}"]`)!;
  const nav = navigator as unknown as Record<string, unknown>;

  async function montar(compartir?: jasmine.Spy) {
    if (compartir) Object.defineProperty(navigator, 'share', { value: compartir, configurable: true });
    else Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  }

  afterEach(() => { delete nav['share']; });

  it('ofrece WhatsApp, Facebook, X, LinkedIn y correo como enlaces por dirección, sin scripts de terceros', async () => {
    await montar();
    for (const red of ['whatsapp', 'facebook', 'x', 'linkedin', 'correo']) expect(enlace(red)).not.toBeNull();
    expect(enlace('facebook').href).toContain('facebook.com/sharer');
    expect(enlace('linkedin').href).toContain(encodeURIComponent('https://simus.example/noticias/celebra'));
    expect(raiz().querySelector('script, iframe')).toBeNull();
  });

  it('los enlaces externos abren en otra pestaña con rel seguro y lo dicen en su nombre accesible; el correo no', async () => {
    await montar();
    expect(enlace('whatsapp').target).toBe('_blank');
    expect(enlace('whatsapp').rel).toContain('noopener');
    expect(enlace('whatsapp').getAttribute('aria-label')).toBe('Compartir en WhatsApp (se abre en otra pestaña)');
    expect(enlace('correo').getAttribute('target')).toBeNull();
    expect(raiz().querySelector('section')?.getAttribute('aria-label')).toBe('Compartir la noticia');
  });

  it('sin Web Share API no hay botón nativo', async () => {
    await montar();
    expect(raiz().querySelector('[data-compartir="nativo"]')).toBeNull();
  });

  it('con Web Share API aparece el botón nativo y comparte título y dirección', async () => {
    const compartir = jasmine.createSpy('share').and.resolveTo();
    await montar(compartir);
    raiz().querySelector<HTMLButtonElement>('[data-compartir="nativo"]')!.click();
    expect(compartir).toHaveBeenCalledWith({ title: 'Celebra la Música 2026', url: 'https://simus.example/noticias/celebra' });
  });

  it('copiar el enlace lo anuncia', async () => {
    await montar();
    const escribir = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText: escribir } as unknown as Clipboard);
    raiz().querySelector<HTMLButtonElement>('[data-compartir="copiar"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(escribir).toHaveBeenCalledWith('https://simus.example/noticias/celebra');
    expect(raiz().querySelector('[role="status"]')?.textContent).toContain('Enlace copiado');
  });
});
