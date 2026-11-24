import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PnmcHeroComponent } from './pnmc-hero.component';

@Component({
  standalone: true,
  imports: [PnmcHeroComponent],
  template: `
    <app-pnmc-hero eyebrow="El Plan" title="Plan Nacional" accent="de Música"></app-pnmc-hero>
  `,
})
class Anfitrion {
}

describe('Cabecera del Plan', () => {
  it('la cabecera lleva el tema PNMC y muestra antetítulo, título con acento y descripción, sin ruta de migas', () => {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    const hero: HTMLElement = f.nativeElement.querySelector('app-pnmc-hero');
    expect(hero.className).toContain('tema-pnmc');
    expect(hero.querySelector('h1')?.textContent).toContain('Plan Nacional');
    expect(hero.querySelector('h1 span')?.textContent).toContain('de Música');
    expect(hero.textContent).toContain('El Plan');
    expect(hero.querySelector('nav')).toBeNull();
  });
});
