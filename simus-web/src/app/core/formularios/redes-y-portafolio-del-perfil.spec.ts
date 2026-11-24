import { detectarRed, enlacesDesdeDirecciones, erroresDeEnlaces, mensajeDeEnlaceDeRed } from './redes-del-perfil';
import { anioDeTexto, erroresDeItemDePortafolio, etiquetaDeTipoDePortafolio } from './portafolio-del-perfil';

describe('Enlaces del perfil: las redes y su formato', () => {
  it('reconoce la red por el anfitrión, con o sin www y con subdominios', () => {
    expect(detectarRed('https://www.instagram.com/lucia')).toBe('instagram');
    expect(detectarRed('youtu.be/abc')).toBe('youtube');
    expect(detectarRed('https://artista.bandcamp.com')).toBe('bandcamp');
    expect(detectarRed('https://open.spotify.com/artist/1')).toBe('spotify');
    expect(detectarRed('https://twitter.com/yo')).toBe('x');
    expect(detectarRed('https://www.mi-sitio.org')).toBe('otro');
  });

  it('una dirección de otra red no sirve para esta, y exige https completo', () => {
    expect(mensajeDeEnlaceDeRed('instagram', 'https://www.instagram.com/lucia')).toBeNull();
    expect(mensajeDeEnlaceDeRed('instagram', 'https://www.facebook.com/lucia')).toContain('no es de Instagram');
    expect(mensajeDeEnlaceDeRed('linkedin', '@lucia')).toContain('https');
    expect(mensajeDeEnlaceDeRed('otro', 'www.mi-sitio.org')).toBeNull();
    expect(mensajeDeEnlaceDeRed('tiktok', '')).toContain('Escribe la dirección');
  });

  it('evita duplicados: una red conocida una sola vez y ninguna dirección repetida', () => {
    const errores = erroresDeEnlaces([
      { red: 'instagram', url: 'https://instagram.com/a' },
      { red: 'instagram', url: 'https://instagram.com/b' },
      { red: 'otro', url: 'https://mi-sitio.org' },
      { red: 'otro', url: 'https://MI-SITIO.org/' },
    ]);
    expect(errores[0]).toBeNull();
    expect(errores[1]).toContain('Ya añadiste');
    expect(errores[2]).toBeNull();
    expect(errores[3]).toContain('ya está en tu lista');
  });

  it('un enlace «otro» lleva su rótulo, de hasta 60 caracteres; los de antes no lo tienen', () => {
    expect(enlacesDesdeDirecciones(['https://mi-sitio.org'], ['Mi sitio'])[0].etiqueta).toBe('Mi sitio');
    expect(enlacesDesdeDirecciones(['https://mi-sitio.org'])[0].etiqueta).toBeNull();
    expect(erroresDeEnlaces([{ red: 'otro', url: 'https://mi-sitio.org', etiqueta: 'x'.repeat(61) }])[0]).toContain('60');
  });

  it('los enlaces guardados antes se leen con su red', () => {
    expect(enlacesDesdeDirecciones(['https://www.youtube.com/@a', 'https://mi-sitio.org', ''])).toEqual([
      { red: 'youtube', url: 'https://www.youtube.com/@a', etiqueta: null }, { red: 'otro', url: 'https://mi-sitio.org', etiqueta: null },
    ]);
  });
});

describe('Portafolio del perfil: solo enlaces', () => {
  it('pide título y un enlace https; el año y la descripción son opcionales', () => {
    expect(erroresDeItemDePortafolio({ titulo: '', url: '', anio: '' })).toEqual({ titulo: jasmine.any(String), url: jasmine.any(String) });
    expect(erroresDeItemDePortafolio({ titulo: 'Disco', url: 'http://x.org/a', anio: '' })['url']).toBeUndefined();
    expect(erroresDeItemDePortafolio({ titulo: 'Disco', url: 'no es una dirección', anio: '' })['url']).toContain('https');
    expect(erroresDeItemDePortafolio({ titulo: 'Disco', url: 'https://x.org/a', anio: '2024' })).toEqual({});
  });

  it('el año va entre 1900 y el próximo', () => {
    expect(erroresDeItemDePortafolio({ titulo: 'D', url: 'https://x.org/a', anio: '1850' }, 2026)['anio']).toContain('1900');
    expect(erroresDeItemDePortafolio({ titulo: 'D', url: 'https://x.org/a', anio: '2028' }, 2026)['anio']).toContain('2027');
    expect(erroresDeItemDePortafolio({ titulo: 'D', url: 'https://x.org/a', anio: 'abc' }, 2026)['anio']).toBeDefined();
    expect(anioDeTexto(' 2020 ')).toBe(2020);
    expect(anioDeTexto('')).toBeNull();
  });

  it('las clases son audio, video, texto, imagen y otro; lo guardado como «enlace» se lee «Otro»', () => {
    expect(['audio', 'video', 'texto', 'imagen', 'enlace'].map(etiquetaDeTipoDePortafolio)).toEqual(['Audio', 'Video', 'Texto', 'Imagen', 'Otro']);
  });
});
