import { ElementoDeCatalogo, TipoDeCatalogo } from '../../../core/services/catalogos-admin.service';

/**
 * La hoja de cálculo de un catálogo: se exporta, el área misional la completa en Excel y se vuelve a importar.
 *
 * <b>UTF-8 CON MARCA Y «;» COMO SEPARADOR</b>: es lo que abre Excel en español sin romper las tildes ni partir los
 * textos con comas. Al leer se acepta también «,» y tabulación, y comillas dobles con saltos de línea dentro.
 * <b>FÓRMULAS NO.</b> Una celda que empiece con = + - @ se exporta con una comilla delante (como pide la guía de
 * seguridad de hojas de cálculo) y esa comilla se retira al importar.
 */
export interface ColumnaDeHoja {
  readonly rotulo: string;
  readonly leer: (e: ElementoDeCatalogo) => string;
}

const si = (v: boolean): string => (v ? 'Sí' : 'No');

const COMUNES_ANTES: readonly ColumnaDeHoja[] = [
  { rotulo: 'Id', leer: e => String(e.id) },
  { rotulo: 'Nombre', leer: e => e.nombre },
  { rotulo: 'Orden', leer: e => String(e.orden) },
  { rotulo: 'Activo', leer: e => si(e.activo) },
];

const PRINCIPAL: ColumnaDeHoja = { rotulo: 'Principal', leer: e => e.padreNombre ?? '' };

const FICHA: readonly ColumnaDeHoja[] = [
  { rotulo: 'Sinónimos', leer: e => e.sinonimos ?? '' },
  { rotulo: 'Definición breve', leer: e => e.definicionBreve ?? '' },
  { rotulo: 'Ficha ampliada', leer: e => e.definicionAmpliada ?? '' },
  { rotulo: 'Características', leer: e => e.caracteristicas ?? '' },
];

const RELACION: ColumnaDeHoja = { rotulo: 'Relación territorial', leer: e => e.relacionTerritorial ?? '' };

const FICHA_FINAL: readonly ColumnaDeHoja[] = [
  { rotulo: 'Contextos', leer: e => e.contextos ?? '' },
  { rotulo: 'Ejemplos', leer: e => e.ejemplos ?? '' },
  { rotulo: 'Fuente', leer: e => e.fuentes ?? '' },
  { rotulo: 'Definición preliminar', leer: e => si(e.esPreliminar) },
  { rotulo: 'Observaciones', leer: e => e.observaciones ?? '' },
];

export function columnasDeLaHoja(tipo: TipoDeCatalogo): readonly ColumnaDeHoja[] {
  return tipo === 'practicas-musicales'
    ? [...COMUNES_ANTES, PRINCIPAL, ...FICHA, ...FICHA_FINAL]
    : [...COMUNES_ANTES, ...FICHA, RELACION, ...FICHA_FINAL];
}

const PELIGROSO = /^[=+\-@\t\r]/;

function celda(valor: string, separador: string): string {
  const seguro = PELIGROSO.test(valor) ? `'${valor}` : valor;
  return seguro.includes(separador) || /["\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** El CSV de un catálogo, con la marca de orden de bytes para que Excel lo abra en UTF-8. */
export function aCsv(tipo: TipoDeCatalogo, elementos: readonly ElementoDeCatalogo[], separador = ';'): string {
  const columnas = columnasDeLaHoja(tipo);
  const filas = [
    columnas.map(c => celda(c.rotulo, separador)).join(separador),
    ...elementos.map(e => columnas.map(c => celda(c.leer(e), separador)).join(separador)),
  ];
  return String.fromCharCode(0xFEFF) + filas.join('\r\n') + '\r\n';
}

/** Lee un CSV (separador «;», «,» o tabulación) a filas con las llaves de su primera línea. */
export function leerCsv(texto: string): Record<string, string>[] {
  const limpio = texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto;
  const primera = limpio.split(/\r?\n/, 1)[0] ?? '';
  const candidatos = [';', ',', '\t'];
  const separador = candidatos.reduce((mejor, s) => (primera.split(s).length > primera.split(mejor).length ? s : mejor), ';');

  const registros: string[][] = [];
  let campo = '';
  let fila: string[] = [];
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; } else { entreComillas = false; }
      } else { campo += c; }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      fila.push(campo); campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') { i++; }
      fila.push(campo); campo = '';
      registros.push(fila); fila = [];
    } else { campo += c; }
  }
  if (campo.length > 0 || fila.length > 0) { fila.push(campo); registros.push(fila); }

  const [cabecera, ...cuerpo] = registros.filter(r => r.some(v => v.trim().length > 0));
  if (!cabecera) { return []; }
  const rotulos = cabecera.map(r => r.trim());
  return cuerpo.map(r => {
    const salida: Record<string, string> = {};
    rotulos.forEach((rotulo, i) => {
      if (rotulo) { salida[rotulo] = (r[i] ?? '').replace(/^'(?=[=+\-@])/, ''); }
    });
    return salida;
  });
}
