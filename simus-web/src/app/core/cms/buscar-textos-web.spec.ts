import { buscarTextosWeb, MINIMO_PARA_BUSCAR, normalizarParaBuscar } from './buscar-textos-web';
import { DEFAULT_TEXTS, WEB_TEXT_GROUPS } from './registro-de-textos-web';

describe('buscarTextosWeb', () => {
  const deFabrica = (clave: string) => DEFAULT_TEXTS[clave] ?? '';

  it('no busca con menos letras que el mínimo: casi todo coincidiría y la lista no ayudaría', () => {
    expect(buscarTextosWeb('a'.repeat(MINIMO_PARA_BUSCAR - 1), deFabrica)).toEqual([]);
    expect(buscarTextosWeb('   ', deFabrica)).toEqual([]);
  });

  it('ignora tildes y mayúsculas, en la consulta y en el texto', () => {
    expect(normalizarParaBuscar('  EDUCACIÓN   Artística ')).toBe('educacion artistica');

    const sinTilde = buscarTextosWeb('educacion', deFabrica, 50);
    const conTilde = buscarTextosWeb('EDUCACIÓN', deFabrica, 50);
    expect(sinTilde.length).toBeGreaterThan(0);
    expect(conTilde.map(r => r.key)).toEqual(sinTilde.map(r => r.key));
  });

  it('encuentra un texto por lo que dice y lo ubica en su bloque y sección', () => {
    const clave = 'home_hero_lema';
    const texto = deFabrica(clave);
    expect(texto).not.toBe('');

    const resultados = buscarTextosWeb(texto.slice(0, 18), deFabrica);
    const encontrado = resultados.find(r => r.key === clave);

    expect(encontrado).toBeDefined();
    const grupo = WEB_TEXT_GROUPS.find(g => g.fields.some(f => f.key === clave))!;
    expect(encontrado!.groupId).toBe(grupo.id);
    expect(encontrado!.section).toBe(grupo.section);
    expect(encontrado!.extracto.length).toBeGreaterThan(0);
  });

  it('busca lo que el visitante lee hoy, no solo el texto de fábrica', () => {
    const publicado = (clave: string) =>
      clave === 'home_hero_lema' ? 'Una frase publicada muy particular' : deFabrica(clave);

    const resultados = buscarTextosWeb('muy particular', publicado);

    expect(resultados.map(r => r.key)).toEqual(['home_hero_lema']);
  });

  it('exige todas las palabras, en cualquier orden', () => {
    const publicado = (clave: string) =>
      clave === 'home_hero_lema' ? 'alfa bravo charlie' : deFabrica(clave);

    expect(buscarTextosWeb('charlie alfa', publicado).map(r => r.key)).toEqual(['home_hero_lema']);
    expect(buscarTextosWeb('alfa zzzzzz', publicado)).toEqual([]);
  });

  it('pone primero lo que coincide por rótulo o bloque y respeta el límite', () => {
    const resultados = buscarTextosWeb('hero', deFabrica, 5);

    expect(resultados.length).toBeLessThanOrEqual(5);
    const primerPorTexto = resultados.findIndex(r => r.coincideEn === 'texto');
    if (primerPorTexto >= 0) {
      expect(resultados.slice(primerPorTexto).every(r => r.coincideEn === 'texto')).toBeTrue();
    }
  });

  it('recorta el extracto alrededor de la coincidencia cuando el texto es largo', () => {
    const largo = `${'relleno '.repeat(40)}aguja en el pajar ${'relleno '.repeat(40)}`;
    const publicado = (clave: string) => (clave === 'home_hero_lema' ? largo : deFabrica(clave));

    const [resultado] = buscarTextosWeb('aguja pajar', publicado);

    expect(resultado.extracto).toContain('aguja en el pajar');
    expect(resultado.extracto.length).toBeLessThan(largo.length);
    expect(resultado.extracto.startsWith('…')).toBeTrue();
  });
});
