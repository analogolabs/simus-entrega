import { enlacesParaCompartir } from './enlaces-para-compartir';

describe('enlacesParaCompartir', () => {
  const enlaces = enlacesParaCompartir('https://simus.example/noticias/a?x=1&y=2', 'Música & más #1');
  const de = (red: string) => enlaces.find(e => e.red === red)!.href;

  it('ofrece WhatsApp, Facebook, X, LinkedIn y correo', () => {
    expect(enlaces.map(e => e.nombre)).toEqual(['WhatsApp', 'Facebook', 'X', 'LinkedIn', 'Correo']);
  });

  it('codifica la dirección y el título para que no rompan el enlace ni cuelen parámetros', () => {
    expect(de('facebook')).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fsimus.example%2Fnoticias%2Fa%3Fx%3D1%26y%3D2');
    expect(de('x')).toContain('&text=M%C3%BAsica%20%26%20m%C3%A1s%20%231');
    expect(de('whatsapp')).toContain('text=M%C3%BAsica%20%26%20m%C3%A1s%20%231%20https%3A');
    expect(de('correo').startsWith('mailto:?subject=')).toBeTrue();
    expect(de('linkedin')).not.toContain('&y=2');
  });
});
