import { TIPOS_DE_MATERIAL, soporteEnLlano, tipoDeMaterial } from './tipo-de-material';

/** Una ficha con la tipología que el acervo real declara: los códigos DCMI y RDA, sin etiquetas. */
const ficha = (publicationType: string | null, ...codigos: string[]) => ({
  publicationType,
  typology: codigos.map(codigo => ({
    eje: ['text', 'sound', 'movingimage', 'interactiveresource'].includes(codigo) ? 'recurso' : 'contenido',
    codigo,
  })),
});

describe('El tipo de material del Catálogo', () => {
  it('ofrece siete tipos en lenguaje de uso común, sin términos de la norma', () => {
    expect(TIPOS_DE_MATERIAL.map(t => t.etiqueta)).toEqual([
      'Libro', 'Guía o manual', 'Partitura', 'Audio', 'Video', 'Recurso digital', 'Material mixto',
    ]);
    for (const tipo of TIPOS_DE_MATERIAL) {
      expect(tipo.etiqueta).not.toMatch(/bidimensional|RDA|mediaci[oó]n/i);
    }
  });

  it('un libro es un libro, aunque la fuente lo escriba de varias maneras', () => {
    for (const origen of ['Libro', 'Libro impreso', 'Libro impreso y PDF Interactivo']) {
      expect(tipoDeMaterial(ficha(origen, 'text')).id).toBe('libro');
    }
  });

  it('las guías, manuales y cuadernos de ejercicios van aparte', () => {
    for (const origen of ['Libro, Guía', 'Libro Cuaderno de ejercicios', 'Manual', 'Guía impresa']) {
      expect(tipoDeMaterial(ficha(origen, 'text')).id).toBe('guia');
    }
  });

  it('la música notada es una partitura, también cuando viene con un CD', () => {
    expect(tipoDeMaterial(ficha('Partituras', 'text', 'musica-notada')).id).toBe('partitura');
    expect(tipoDeMaterial(ficha('Libro partituras', 'text')).id).toBe('partitura');
    expect(tipoDeMaterial(ficha('Cancionero', 'text')).id).toBe('partitura');
    expect(tipoDeMaterial(ficha('Libro + CD', 'text', 'sound', 'musica-notada')).id).toBe('partitura');
  });

  it('un CD es audio y un DVD o un videoclip es video', () => {
    expect(tipoDeMaterial(ficha('CD', 'sound')).id).toBe('audio');
    expect(tipoDeMaterial(ficha('CD doble', 'sound')).id).toBe('audio');
    expect(tipoDeMaterial(ficha('DVD', 'movingimage')).id).toBe('video');
    expect(tipoDeMaterial(ficha('Videoclip', 'movingimage')).id).toBe('video');
  });

  it('un libro con CD, o con CD y DVD, es material mixto', () => {
    expect(tipoDeMaterial(ficha('Libro y CD', 'text', 'sound')).id).toBe('mixto');
    expect(tipoDeMaterial(ficha('Libro con CD y DVD con PDF interactivo', 'text', 'sound', 'movingimage')).id).toBe('mixto');
  });

  it('una app, un curso virtual o un recurso interactivo es un recurso digital', () => {
    expect(tipoDeMaterial(ficha('APP', 'interactiveresource')).id).toBe('digital');
    expect(tipoDeMaterial(ficha('Curso virtual', 'text')).id).toBe('digital');
    expect(tipoDeMaterial(ficha('CD- Rom', 'interactiveresource')).id).toBe('digital');
  });

  it('una ficha sin tipología se deduce del texto de origen', () => {
    expect(tipoDeMaterial({ publicationType: '2CDs', typology: [] }).id).toBe('audio');
    expect(tipoDeMaterial({ publicationType: 'Video grabación VHS', typology: [] }).id).toBe('video');
    expect(tipoDeMaterial({ publicationType: null, typology: [] }).id).toBe('libro');
  });

  it('el soporte se dice en la palabra de uso común y lo desconocido conserva su texto', () => {
    expect(soporteEnLlano('volumen', 'volumen')).toBe('Impreso');
    expect(soporteEnLlano('videodisco', 'videodisco')).toBe('DVD');
    expect(soporteEnLlano('disco-de-computador', 'disco de computador')).toBe('CD-ROM');
    expect(soporteEnLlano('otro', 'cinta')).toBe('cinta');
  });
});
