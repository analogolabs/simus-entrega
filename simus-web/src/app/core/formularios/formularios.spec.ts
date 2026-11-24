import { esRedSocialValida, esUrlValida, mensajeDeUrl, normalizarRedSocial, normalizarUrl } from './url';
import { esCorreoValido, esTelefonoValido } from './telefono';
import { TIPOS_DE_DOCUMENTO, nombreDelTipoDeDocumento, normalizarTipoDeDocumento } from './tipos-de-documento';
import { mensajeEnEspanol, rotuloDeCampo, traducirErrorDelServidor } from './traductor-de-errores';

/**
 * Las reglas compartidas de formulario. Lo que fijan: una sola regla de
 * dirección web y de teléfono (la misma que aplica el servidor), una sola lista de tipos de
 * documento y un traductor único de errores que nunca enseña nombres internos de campo.
 */
describe('regla única de dirección web', () => {
  it('acepta una dirección sin esquema y la completa con https://', () => {
    expect(esUrlValida('festival-aud-org.ejemplo.org')).toBeTrue();
    expect(normalizarUrl('festival-aud-org.ejemplo.org')).toBe('https://festival-aud-org.ejemplo.org');
    expect(normalizarUrl('  www.miorganizacion.org/inicio ')).toBe('https://www.miorganizacion.org/inicio');
  });

  it('guarda http:// como https://, que es la forma segura de la misma dirección', () => {
    expect(normalizarUrl('http://sitio.example.org')).toBe('https://sitio.example.org');
    expect(esUrlValida('http://sitio.example.org')).toBeTrue();
  });

  it('un valor en blanco es válido: la dirección es opcional', () => {
    expect(esUrlValida('')).toBeTrue();
    expect(esUrlValida('   ')).toBeTrue();
    expect(normalizarUrl(null)).toBe('');
  });

  it('rechaza lo que no es una dirección', () => {
    for (const malo of ['@usuario', 'solo una frase', 'localhost', 'ftp://archivos.example.org', 'javascript:alert(1)', 'https://', 'usuario:clave@sitio.example.org']) {
      expect(esUrlValida(malo)).withContext(malo).toBeFalse();
      expect(mensajeDeUrl(malo)).withContext(malo).toContain('dirección web');
    }
  });
});

describe('redes sociales', () => {
  it('admiten el usuario suelto, como los datos históricos, y la dirección', () => {
    for (const bueno of ['@mifestival', 'mifestival', 'instagram.com/mifestival', 'https://facebook.com/mifestival', '']) {
      expect(esRedSocialValida(bueno)).withContext(bueno).toBeTrue();
    }
    expect(esRedSocialValida('dos palabras')).toBeFalse();
    expect(esRedSocialValida('ftp://x.example.org')).toBeFalse();
  });

  it('el usuario se guarda tal cual y la dirección con https://', () => {
    expect(normalizarRedSocial('@mifestival')).toBe('@mifestival');
    expect(normalizarRedSocial('fb.com/mifestival')).toBe('https://fb.com/mifestival');
  });
});

describe('regla única de teléfono y correo', () => {
  it('«abc» no es un teléfono, aunque la ficha lo aceptara', () => {
    expect(esTelefonoValido('abc')).toBeFalse();
    expect(esTelefonoValido('123')).toBeFalse();
  });

  it('acepta los formatos de siempre y el vacío', () => {
    for (const bueno of ['3001234567', '+57 (300) 123-4567', '601 234 5678', '']) expect(esTelefonoValido(bueno)).withContext(bueno).toBeTrue();
  });

  it('el correo necesita arroba y dominio con punto', () => {
    expect(esCorreoValido('a@b.co')).toBeTrue();
    expect(esCorreoValido('juan@alcaldia')).toBeFalse();
  });
});

describe('lista única de tipos de documento', () => {
  it('son los diez que acepta el servidor, en minúscula', () => {
    expect(TIPOS_DE_DOCUMENTO.map(tipo => tipo.codigo)).toEqual(['cc', 'ce', 'ti', 'rc', 'nuip', 'pa', 'pep', 'ppt', 'die', 'cd']);
  });

  it('un código guardado en mayúscula («CC») encuentra su opción: era el desplegable vacío', () => {
    expect(normalizarTipoDeDocumento('CC')).toBe('cc');
    expect(normalizarTipoDeDocumento(' Ppt ')).toBe('ppt');
    expect(normalizarTipoDeDocumento('NIT')).toBe('');
    expect(nombreDelTipoDeDocumento('CC')).toBe('Cédula de ciudadanía');
  });
});

describe('traductor de errores del servidor', () => {
  const fallo = (status: number | null, payload: unknown) => ({ status, payload, message: 'No fue posible guardar. paginaWeb: Ingresa una URL válida.' });

  it('un error de campo vuelve a su campo, con la clave en camelCase', () => {
    const traducido = traducirErrorDelServidor(fallo(400, { errors: { PaginaWeb: ['Escribe una dirección válida.'] } }), { camposConLugar: ['paginaWeb'] });

    expect(traducido.campos).toEqual({ paginaWeb: 'Escribe una dirección válida.' });
    expect(traducido.hayCampos).toBeTrue();
    expect(traducido.general).toBe('Revisa los campos marcados.');
  });

  it('lo que no tiene campo en pantalla se dice con el rótulo, NUNCA con el nombre interno', () => {
    const traducido = traducirErrorDelServidor(
      fallo(400, { errors: { contactEmail: ['Ya hay otra organización con ese correo.'], sitioWeb: ['Escribe una dirección válida.'] } }),
      { camposConLugar: [] });

    expect(traducido.general).toContain('Correo de contacto: Ya hay otra organización con ese correo.');
    expect(traducido.general).toContain('Página web: Escribe una dirección válida.');
    expect(traducido.general).not.toContain('contactEmail');
    expect(traducido.general).not.toContain('sitioWeb');
  });

  it('un campo sin rótulo conocido va solo con su mensaje', () => {
    const traducido = traducirErrorDelServidor(fallo(400, { errors: { campoInventado: ['Esto no cuadra.'] } }), { camposConLugar: [] });

    expect(traducido.general).toBe('Esto no cuadra.');
  });

  it('las equivalencias llevan el nombre del servidor al del formulario', () => {
    const traducido = traducirErrorDelServidor(fallo(400, { errors: { contactEmail: ['Ya existe.'] } }), {
      camposConLugar: ['correoContacto'], equivalencias: { contactEmail: 'correoContacto' },
    });

    expect(traducido.campos).toEqual({ correoContacto: 'Ya existe.' });
  });

  it('el mapa sin envoltorio de los endpoints escritos a mano también se lee', () => {
    const traducido = traducirErrorDelServidor(fallo(409, { estado: ['No se puede publicar: no tiene cuerpo; no tiene fecha.'] }), { camposConLugar: [] });

    expect(traducido.general).toContain('No se puede publicar: no tiene cuerpo');
  });

  it('el `message` del servidor se muestra y el 500 no culpa a la persona', () => {
    expect(traducirErrorDelServidor(fallo(400, { message: 'La edición ya está publicada.' })).general).toBe('La edición ya está publicada.');
    expect(traducirErrorDelServidor(fallo(500, { title: 'An unhandled exception' })).general).toContain('Algo falló de nuestro lado');
    expect(traducirErrorDelServidor(fallo(0, null)).general).toContain('No hay conexión');
    expect(traducirErrorDelServidor(fallo(403, null)).general).toContain('No tienes permiso');
  });

  it('los mensajes automáticos en inglés se dicen en español', () => {
    expect(mensajeEnEspanol("The Nombre field is required.")).toBe('Este dato es obligatorio.');
    expect(mensajeEnEspanol('Escribe el nombre.')).toBe('Escribe el nombre.');
  });

  it('el rótulo no depende de mayúsculas ni de índices', () => {
    expect(rotuloDeCampo('PaginaWeb')).toBe('Página web');
    expect(rotuloDeCampo('enlaces[2]')).toBe('Enlaces');
    expect(rotuloDeCampo('noExiste')).toBeNull();
  });
});
