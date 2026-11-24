import { TestBed } from '@angular/core/testing';
import { SelectorSegmentadoComponent } from './selector-segmentado.component';

describe('SelectorSegmentadoComponent · forma segmentada', () => {
  const montar = () => {
    const fixture = TestBed.createComponent(SelectorSegmentadoComponent);
    fixture.componentInstance.forma = 'segmentado';
    fixture.componentInstance.etiquetaDelGrupo = 'Cómo se mira';
    fixture.componentInstance.opciones = [{ id: 'a', etiqueta: 'Día' }, { id: 'b', etiqueta: 'Mes' }, { id: 'c', etiqueta: 'Rango' }];
    fixture.componentInstance.elegida = 'a';
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('ocupa todo el ancho del bloque y reparte segmentos de igual ancho con el texto centrado (decisión 130)', () => {
    const raiz = montar();
    const grupo = raiz.querySelector('[role="group"]') as HTMLElement;
    expect(grupo.className).toContain('w-full');
    const botones = Array.from(raiz.querySelectorAll('button'));
    expect(botones.length).toBe(3);
    for (const boton of botones) {
      expect(boton.className).toContain('flex-1');
      expect(boton.className).toContain('justify-center');
    }
    expect(botones[0].getAttribute('aria-pressed')).toBe('true');
  });
});

describe('SelectorSegmentadoComponent · solo iconos (A-4, M-2)', () => {
  const montar = () => {
    const fixture = TestBed.createComponent(SelectorSegmentadoComponent);
    fixture.componentInstance.soloIconos = true;
    fixture.componentInstance.etiquetaDelGrupo = 'Vista de los resultados';
    fixture.componentInstance.opciones = [
      { id: 'lista', etiqueta: 'Vista de lista', icono: 'lista' },
      { id: 'mosaico', etiqueta: 'Vista de mosaico', icono: 'mosaico' },
    ];
    fixture.componentInstance.elegida = 'lista';
    fixture.detectChanges();
    return fixture;
  };

  it('cada posición es un botón con icono, nombre accesible y tooltip, sin texto visible', () => {
    const raiz = montar().nativeElement as HTMLElement;
    const botones = Array.from(raiz.querySelectorAll('button'));
    expect(botones.length).toBe(2);
    for (const b of botones) {
      expect(b.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(b.getAttribute('aria-label')).toBe(b.getAttribute('title'));
      expect(b.textContent?.trim()).toBe('');
    }
    expect(botones[0].getAttribute('aria-label')).toBe('Vista de lista');
    expect(raiz.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Vista de los resultados');
  });

  it('marca la elegida con aria-pressed y emite la nueva al pulsar', () => {
    const f = montar();
    const emitidas: string[] = [];
    f.componentInstance.elegir.subscribe((v: string) => emitidas.push(v));
    const botones = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button'));
    expect(botones[0].getAttribute('aria-pressed')).toBe('true');
    expect(botones[1].getAttribute('aria-pressed')).toBe('false');
    botones[1].click();
    expect(emitidas).toEqual(['mosaico']);
  });

  it('el objetivo táctil mide al menos 36 px (44 con comodo)', () => {
    const f = montar();
    const b = (f.nativeElement as HTMLElement).querySelector('button') as HTMLElement;
    expect(b.getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
  });
});
