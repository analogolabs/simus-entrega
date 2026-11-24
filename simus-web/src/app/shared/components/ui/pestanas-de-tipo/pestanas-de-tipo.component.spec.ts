import { TestBed } from '@angular/core/testing';
import { PestanasDeTipoComponent } from './pestanas-de-tipo.component';

describe('PestanasDeTipoComponent (PANEL)', () => {
  function montar(conteos: Record<string, number>, extra: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(PestanasDeTipoComponent);
    fixture.componentRef.setInput('conteos', conteos);
    fixture.componentRef.setInput('elegida', 'todos');
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture;
  }
  const pestanas = (f: { nativeElement: HTMLElement }) => Array.from(f.nativeElement.querySelectorAll('[role="tab"]')).map(t => t.textContent?.replace(/\s+/g, '').trim());

  it('ofrece Todos y los cinco tipos en el orden del Ecosistema, con su conteo', () => {
    const f = montar({ festivales: 2, luteria: 1 });
    expect(pestanas(f)).toEqual(['Todos3', 'Festivales2', 'Mercados0', 'Redesydocumentación0', 'Lutería1', 'Espaciosparamúsicaenvivo0']);
  });

  it('«Citas e invitaciones» solo aparece cuando se pide o está elegida, y «Todos» puede traer su propio total', () => {
    expect(pestanas(montar({ otras: 1 }, { conOtras: true, total: 4 }))).toContain('Citaseinvitaciones1');
    expect(pestanas(montar({}))).not.toContain('Citaseinvitaciones0');
    expect(pestanas(montar({}, { total: 4 }))[0]).toBe('Todos4');
  });

  it('emite el tipo elegido al pulsar una pestaña', () => {
    const f = montar({ festivales: 1 });
    let elegido = '';
    f.componentInstance.elegir.subscribe(v => (elegido = v));
    (f.nativeElement.querySelector('[data-pestana="mercados"]') as HTMLElement).click();
    expect(elegido).toBe('mercados');
  });
});
