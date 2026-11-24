/**
 * EL TRADUCTOR ÚNICO DE ERRORES DEL SERVIDOR A MENSAJES EN ESPAÑOL.
 *
 * <b>POR QUÉ EXISTE.</b> Cada pantalla leía a su manera el cuerpo de un error: unas mostraban el
 * nombre técnico del campo («paginaWeb: Ingresa una URL válida», «contactEmail:», «sitioWeb:»),
 * otras aplanaban `errors` con su propia copia de la función, y casi todas ocultaban el motivo
 * exacto detrás de un «No fue posible…». Aquí se decide una vez:
 *
 *  - un error de campo vuelve como `campos[nombreDelCampo]`, con el mensaje que mandó el servidor
 *    (que ya viene en español) para ponerlo JUNTO al campo;
 *  - lo que no tiene campo en pantalla se dice con el rótulo del campo («Página web: …»), nunca con
 *    su nombre interno;
 *  - lo que no trae motivo se traduce por el código HTTP, sin jerga.
 */

/** Lo mínimo que se lee de un error: el que lanza `ApiClientService` o cualquier `{ status, payload }`. */
export interface FalloLeible {
  message?: string;
  status?: number | null;
  payload?: unknown;
}

export interface ErroresTraducidos {
  /** Mensaje por campo, con la clave en camelCase (`paginaWeb`), lista para `errores()[clave]`. */
  campos: Record<string, string>;
  /** Lo que se dice en el aviso general. Nunca vacío. */
  general: string;
  /** Hay al menos un error ligado a un campo que sí está en pantalla. */
  hayCampos: boolean;
}

/** Cómo se llama cada campo ante una persona. Las claves van en minúscula para no depender del caso. */
const ROTULOS: Record<string, string> = {
  paginaweb: 'Página web', sitioweb: 'Página web', sitiowebmercado: 'Página web', websiteurl: 'Página web',
  instagram: 'Instagram', instagrammercado: 'Instagram', instagramurl: 'Instagram',
  facebook: 'Facebook', facebookmercado: 'Facebook', facebookurl: 'Facebook',
  otroenlace: 'Otro enlace', otroenlacemercado: 'Otro enlace', enlaces: 'Enlaces', enlace: 'Enlace',
  contactemail: 'Correo de contacto', correocontacto: 'Correo de contacto', correomercado: 'Correo de contacto',
  contactphone: 'Teléfono de contacto', telefonocelular: 'Teléfono', telefonomercado: 'Teléfono',
  telefonocontacto: 'Teléfono de contacto', telefono: 'Teléfono', phone: 'Teléfono',
  email: 'Correo electrónico', correo: 'Correo electrónico', password: 'Contraseña', contrasena: 'Contraseña',
  confirmpassword: 'Confirmación de la contraseña', actual: 'Contraseña actual', nueva: 'Contraseña nueva',
  confirmacion: 'Confirmación de la contraseña',
  name: 'Nombre', nombre: 'Nombre', nombrelegal: 'Nombre legal', nombrevisible: 'Nombre visible',
  descripcion: 'Descripción', observacionescontacto: 'Observaciones de contacto',
  firstname: 'Primer nombre', secondname: 'Segundo nombre', firstsurname: 'Primer apellido',
  secondsurname: 'Segundo apellido', primernombre: 'Primer nombre', primerapellido: 'Primer apellido',
  fullname: 'Nombre completo', responsablenombre: 'Nombre de la persona responsable',
  documenttype: 'Tipo de documento', documentnumber: 'Número de documento', tipodocumento: 'Tipo de documento',
  numerodocumento: 'Número de documento', responsabletipodocumento: 'Tipo de documento',
  responsablenumerodocumento: 'Número de documento', responsabletelefono: 'Teléfono de la persona responsable',
  responsablecorreo: 'Correo de la persona responsable',
  organizationname: 'Nombre de la organización', organizationidentificationnumber: 'NIT de la organización',
  numeroidentificacion: 'NIT de la organización', direccion: 'Dirección',
  headquartersdepartmentcode: 'Departamento de la sede', headquartersmunicipalitycode: 'Municipio de la sede',
  codigodepartamentosede: 'Departamento de la sede', codigomunicipiosede: 'Municipio de la sede',
  codigodepartamento: 'Departamento', codigomunicipio: 'Municipio', nivelcobertura: 'Nivel de cobertura',
  periodicidad: 'Periodicidad', periodicidaddetalle: 'Detalle de la periodicidad',
  lugarespecifico: 'Lugar específico', festivalid: 'Festival', alcanceid: 'Alcance', modalidadid: 'Modalidad',
  practicasmusicalesids: 'Prácticas musicales', territoriossonorosids: 'Territorios sonoros',
  archivofotoid: 'Foto', foto: 'Foto', fotoalt: 'Descripción de la imagen', idspracticas: 'Prácticas musicales',
  politicasaceptadas: 'Autorizaciones', justificacion: 'Justificación', reason: 'Motivo', motivo: 'Motivo',
  datosjson: 'Borrador', estado: 'Estado', version: 'Versión',
  // Noticias, Agenda y Catálogo editorial (FOR-01): los campos que ahora se dicen con su
  // rótulo y no con su nombre interno.
  titulo: 'Título', subtitulo: 'Subtítulo', resumen: 'Resumen', cuerpo: 'Cuerpo',
  fechapublicacion: 'Fecha de aparición', fechainicio: 'Fecha de inicio', fechafin: 'Fecha de cierre',
  horainicio: 'Hora de inicio', horafin: 'Hora de cierre', lugar: 'Lugar', url: 'Enlace',
  imagenruta: 'Imagen', imagenalternativa: 'Descripción de la imagen', imagenalt: 'Descripción de la imagen',
  autorianombre: 'Autoría', categoriaid: 'Categoría', etiquetas: 'Etiquetas', slug: 'Dirección',
  codigo: 'Código', anioinicio: 'Año de inicio', aniofin: 'Año de cierre', fuentes: 'Fuentes',
  modalidad: 'Modalidad', tipo: 'Tipo', territorio: 'Territorio', organizador: 'Organizador',
  ano: 'Año', anio: 'Año', edicion: 'Edición', ediciones: 'Ediciones',
};

/** El rótulo de un campo, o `null` si no se conoce (entonces no se muestra nombre alguno). */
export function rotuloDeCampo(clave: string): string | null {
  return ROTULOS[clave.replace(/\[.*$/, '').replace(/^.*\./, '').toLowerCase()] ?? null;
}

function enMinusculaInicial(clave: string): string {
  return clave.charAt(0).toLowerCase() + clave.slice(1);
}

const esRegistro = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/**
 * Los mensajes automáticos de ASP.NET llegan en inglés cuando el cuerpo no se puede leer
 * («The request field is required», «The JSON value could not be converted…»): se dicen en español.
 */
export function mensajeEnEspanol(mensaje: string): string {
  const texto = mensaje.trim();
  if (/is required|field is required|required property/i.test(texto) && /^[A-Za-z$.\s'"[\]]/.test(texto)) return 'Este dato es obligatorio.';
  if (/could not be converted|is not valid|invalid/i.test(texto) && /^(The|\$|One or more)/.test(texto)) return 'El valor escrito no es válido.';
  if (/must be a string with a maximum length|maximum length/i.test(texto)) return 'El texto es demasiado largo.';
  if (/^One or more validation errors occurred/i.test(texto)) return 'Revisa los campos marcados.';
  return texto;
}

function mensajesDe(valor: unknown): string[] {
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(mensajeEnEspanol);
}

/** Qué decir cuando el servidor no explicó nada, según el código HTTP. */
function mensajeDelEstado(estado: number | null | undefined, alternativa: string): string {
  if (estado === null || estado === undefined || estado === 0) {
    return 'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }
  if (estado === 401) return 'Tu sesión terminó. Vuelve a ingresar para continuar.';
  if (estado === 403) return 'No tienes permiso para hacer esto con esta cuenta.';
  if (estado === 404) return 'No encontramos lo que buscabas; puede haber cambiado o haberse retirado.';
  if (estado === 409) return 'Alguien más cambió esto mientras lo editabas. Recarga la página e inténtalo de nuevo.';
  if (estado === 413) return 'El archivo es demasiado grande.';
  if (estado === 429) return 'Hiciste demasiados intentos seguidos. Espera un momento e inténtalo de nuevo.';
  if (estado >= 500) return 'Algo falló de nuestro lado. Inténtalo de nuevo en un momento; si sigue ocurriendo, escribe al equipo del PNMC.';
  return alternativa;
}

export interface OpcionesDelTraductor {
  /** Los campos que sí tienen sitio en esta pantalla (claves en camelCase). Los demás van al aviso. */
  camposConLugar?: readonly string[];
  /** Equivalencias del nombre del servidor al del formulario: `{ contactEmail: 'correoContacto' }`. */
  equivalencias?: Readonly<Record<string, string>>;
  /** Lo que se dice si no hay nada más preciso. */
  alternativa?: string;
  /**
   * Claves cuyo mensaje se dice SIN su rótulo: el servidor ya lo escribe como frase completa
   * («No se puede publicar: no tiene cuerpo»), y «Estado: No se puede publicar…» sobra.
   */
  sinRotulo?: readonly string[];
}

/**
 * Convierte un error de `ApiClientService` (o cualquier `{ status, payload }`) en mensajes para la
 * persona. Ver el comentario del archivo.
 */
export function traducirErrorDelServidor(fallo: unknown, opciones: OpcionesDelTraductor = {}): ErroresTraducidos {
  const alternativa = opciones.alternativa ?? 'No fue posible completar la acción. Inténtalo de nuevo.';
  const registro = esRegistro(fallo) ? fallo as FalloLeible : {};
  const payload = esRegistro(registro.payload) ? registro.payload : null;
  const campos: Record<string, string> = {};
  const sinLugar: string[] = [];
  const conLugar = opciones.camposConLugar ? new Set(opciones.camposConLugar.map(c => c.toLowerCase())) : null;

  // `errors` es lo habitual (ValidationProblem), pero los endpoints escritos a mano devuelven el
  // mapa `campo: [mensajes]` sin envoltorio.
  const crudos = payload && esRegistro(payload['errors']) ? payload['errors'] : null;
  const bare = payload && !crudos
    ? Object.fromEntries(Object.entries(payload).filter(([, valor]) => Array.isArray(valor)))
    : null;
  for (const [claveCruda, valor] of Object.entries(crudos ?? bare ?? {})) {
    const mensajes = mensajesDe(valor);
    if (!mensajes.length) continue;
    const bruta = enMinusculaInicial(claveCruda);
    const clave = opciones.equivalencias?.[bruta] ?? bruta;
    const texto = mensajes.join(' ');
    if (!conLugar || conLugar.has(clave.toLowerCase())) {
      campos[clave] = texto;
    } else {
      const sinRotulo = opciones.sinRotulo?.some(k => k.toLowerCase() === clave.toLowerCase()) ?? false;
      const rotulo = sinRotulo ? null : rotuloDeCampo(claveCruda);
      sinLugar.push(rotulo ? `${rotulo}: ${texto}` : texto);
    }
  }

  const hayCampos = Object.keys(campos).length > 0;
  if (sinLugar.length) return { campos, general: sinLugar.join(' '), hayCampos };
  if (hayCampos) return { campos, general: 'Revisa los campos marcados.', hayCampos };

  // Sin errores de campo: el motivo que mandó el servidor, si es una frase, o el del código HTTP.
  const estado = registro.status ?? null;
  const detalle = payload
    ? [payload['detail'], payload['message'], payload['title']]
      .find((candidato): candidato is string => typeof candidato === 'string' && candidato.trim().length > 0)
    : undefined;
  if (detalle && (estado === null || estado < 500)) return { campos, general: mensajeEnEspanol(detalle), hayCampos };
  if (estado !== null && estado !== undefined) {
    // CON EL CONTEXTO DE LA ACCIÓN: «No fue posible registrar el Festival. Algo falló de nuestro lado…».
    const causa = mensajeDelEstado(estado, alternativa);
    const contexto = opciones.alternativa ? opciones.alternativa.replace(/[.!?]+$/, '') + '. ' : '';
    return { campos, general: causa === alternativa ? causa : contexto + causa, hayCampos };
  }
  return { campos, general: registro.message?.trim() ? registro.message : alternativa, hayCampos };
}

/**
 * EL MOTIVO DE UNA ACCIÓN QUE FALLÓ, PARA EL AVISO DE LA PANTALLA (FOR-01).
 *
 * Noticias, Agenda y Catálogo editorial tenían cada uno su copia de «leer el primer mensaje que
 * encuentre»: lo que fallara en un segundo campo no se decía, y los tres leían distinto. Aquí es
 * lo mismo que en los formularios del panel: TODOS los motivos, cada uno con el rótulo de su campo
 * (no su nombre interno) y, sin cuerpo, el que corresponde al código HTTP.
 *
 * Sin respuesta ni cuerpo (un fallo que no llegó al servidor sin código) gana `respaldo`, que sabe
 * qué se estaba intentando.
 */
export function motivoDeLaAccion(fallo: unknown, respaldo: string): string {
  const leido = (esRegistro(fallo) ? fallo : {}) as FalloLeible;
  if ((leido.status === null || leido.status === undefined) && !leido.payload) { return respaldo; }
  return traducirErrorDelServidor(fallo, {
    camposConLugar: [],
    alternativa: respaldo,
    sinRotulo: ['estado', 'version', 'motivo', 'general'],
  }).general;
}
