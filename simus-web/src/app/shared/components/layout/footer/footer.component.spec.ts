import { DEFAULT_TEXTS } from '../../../../core/cms/registro-de-textos-web';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  it('muestra solo YouTube, Instagram, Facebook y X, cada uno con su cuenta institucional (F-1, H-1)', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TextosWebService,
          useValue: { getWebText: (k: string) => DEFAULT_TEXTS[k] ?? k, getWebImage: () => '/x.png', getWebImageAlt: () => '' },
        },
      ],
    });
    const fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    const redes = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('a[aria-label^="Abrir "]'));
    expect(redes.map(a => a.textContent?.trim())).toEqual(['YouTube', 'Instagram', 'Facebook', 'X']);
    expect(redes.map(a => a.getAttribute('href'))).toEqual([
      'https://www.youtube.com/@MinCulturasCol',
      'https://www.instagram.com/minculturascol',
      'https://www.facebook.com/MinCulturasCol',
      'https://x.com/MinCulturasCol',
    ]);
    expect(raiz.textContent).not.toMatch(/WhatsApp|TikTok/);
  });

  it('con puntero grueso (táctil) cada enlace del pie mide 44 px; con ratón conserva los 24 (revisión responsive)', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TextosWebService, useValue: { getWebText: (k: string) => DEFAULT_TEXTS[k] ?? k, getWebImage: () => '/x.png', getWebImageAlt: () => '' } },
      ],
    });
    const fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
    const enlaces = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.min-h-6'));
    expect(enlaces.length).toBeGreaterThan(10);
    for (const a of enlaces) expect(a.className).withContext(a.textContent?.trim() ?? '').toContain('pointer-coarse:min-h-11');
  });
});
