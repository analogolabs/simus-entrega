import { GRUPOS_DE_GESTION_ADMINISTRATIVA } from './navegacion-administrativa';

/**
 * Los módulos que se pueden habilitar o deshabilitar a un Gestor, con el nombre y la descripción que lee quien
 * administra (apartado «Módulos del gestor» de «Usuarios y roles»).
 *
 * <b>SALE DE LA BARRA Y NO SE ESCRIBE OTRA VEZ.</b> El nombre y la descripción son los de
 * `navegacion-administrativa.ts`: si en la barra pone «Agenda y eventos», eso es lo que se activa. La única
 * diferencia es «Lutería, espacios y redes»: es UNA entrada de la barra pero tres módulos de permiso reales
 * (`talleres`, `espacios`, `redes`), y la ficha antigua no ofrecía ninguno de los tres porque ninguna sección
 * se llama así. Aquí se expanden en tres, con el mismo identificador que usa el servidor.
 */
export interface ModuloDelGestor {
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly grupoId: string;
  readonly grupoTitulo: string;
  /** Lo tiene toda cuenta de consola y no se puede quitar. */
  readonly fijo: boolean;
  /** Solo lo abre el rol webmaster: no se ofrece a un Gestor. */
  readonly soloWebmaster: boolean;
}

/** Los dos que van siempre (espejo de `ModulosDeLaConsola.SiempreActivados`; el servidor es la autoridad). */
const SIEMPRE = ['monitor', 'solicitudes'] as const;

const PROCESOS: readonly { codigo: string; nombre: string; descripcion: string }[] = [
  { codigo: 'talleres', nombre: 'Lutería', descripcion: 'Talleres de lutería: revisión, publicación, importación y retiro.' },
  { codigo: 'espacios', nombre: 'Espacios para música en vivo', descripcion: 'Salas, bares, teatros y casas de cultura: revisión, publicación, importación y retiro.' },
  { codigo: 'redes', nombre: 'Redes y centros de documentación', descripcion: 'Redes, fonotecas y acervos: revisión, publicación, importación y retiro.' },
];

function construir(): readonly ModuloDelGestor[] {
  const lista: ModuloDelGestor[] = [];
  for (const grupo of GRUPOS_DE_GESTION_ADMINISTRATIVA) {
    for (const seccion of grupo.secciones) {
      // «Catálogos» se concede con el módulo «categorias» y «Galería» con «banco-de-archivos» (ya listados): no son módulos de permiso propios.
      if (seccion.id === 'catalogos' || seccion.id === 'galeria') { continue; }
      const solo = !!seccion.rolesPermitidos && !seccion.rolesPermitidos.includes('gestor_interno');
      const base = { grupoId: grupo.id, grupoTitulo: grupo.titulo, soloWebmaster: solo };
      if (seccion.id === 'procesos') {
        for (const p of PROCESOS) { lista.push({ ...base, ...p, fijo: false }); }
      } else {
        lista.push({
          ...base,
          codigo: seccion.id,
          nombre: seccion.titulo,
          descripcion: seccion.descripcion,
          fijo: (SIEMPRE as readonly string[]).includes(seccion.id),
        });
      }
    }
  }
  return lista;
}

/** Todos, en el orden de la barra. */
export const MODULOS_DEL_GESTOR: readonly ModuloDelGestor[] = construir();

/** Los que se pueden dar o quitar a un Gestor: ni los fijos ni los exclusivos del webmaster. */
export const MODULOS_CONCEDIBLES: readonly ModuloDelGestor[] = MODULOS_DEL_GESTOR.filter(m => !m.fijo && !m.soloWebmaster);

export function moduloDelGestor(codigo: string): ModuloDelGestor | undefined {
  return MODULOS_DEL_GESTOR.find(m => m.codigo === codigo);
}

/** Un conjunto de módulos con nombre, para dar a un Gestor de una vez. */
export interface PerfilDeModulos {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly modulos: readonly string[];
}

/**
 * Perfiles reutilizables. NO son un rol ni se guardan en el servidor: aplicar uno solo marca esos módulos, y lo que
 * queda guardado es la lista de módulos de la cuenta, que se puede ajustar después uno a uno. Así un perfil nunca
 * deja a una cuenta con un permiso que no se ve en su lista.
 */
export const PERFILES_DE_MODULOS: readonly PerfilDeModulos[] = [
  {
    id: 'contenidos',
    nombre: 'Gestor de contenidos',
    descripcion: 'Publica y mantiene lo que se lee en el portal: catálogo editorial, agenda, noticias, categorías, archivos, textos y boletín.',
    modulos: ['catalogo-editorial', 'agenda', 'noticias', 'categorias', 'banco-de-archivos', 'gestion-sitio', 'boletin'],
  },
  {
    id: 'revision',
    nombre: 'Gestor de revisión',
    descripcion: 'Revisa y publica los procesos del ecosistema y sus organizaciones: festivales, mercados, lutería, espacios y redes.',
    modulos: ['ecosistema', 'mercados', 'talleres', 'espacios', 'redes', 'organizaciones'],
  },
  {
    id: 'seguimiento',
    nombre: 'Gestor de seguimiento',
    descripcion: 'Consulta cifras y la trazabilidad de las actuaciones, sin modificar el ecosistema ni el portal.',
    modulos: ['analisis', 'auditoria'],
  },
];

/** Cómo se llama lo que tiene la cuenta: el perfil que coincide exactamente, «Solo lo esencial» o «Personalizado». */
export function nombreDelPerfil(modulosConcedidos: readonly string[]): string {
  const propios = new Set(modulosConcedidos.filter(m => MODULOS_CONCEDIBLES.some(c => c.codigo === m)));
  if (propios.size === 0) { return 'Solo lo esencial'; }
  const exacto = PERFILES_DE_MODULOS.find(p => p.modulos.length === propios.size && p.modulos.every(m => propios.has(m)));
  if (exacto) { return exacto.nombre; }
  return propios.size === MODULOS_CONCEDIBLES.length ? 'Todos los módulos' : 'Personalizado';
}

/** Qué módulos se pierden y cuáles se ganan al pasar de un conjunto a otro (solo los concedibles). */
export function diferenciaDeModulos(antes: readonly string[], despues: readonly string[]): { quita: string[]; da: string[] } {
  const concedibles = new Set(MODULOS_CONCEDIBLES.map(m => m.codigo));
  const a = new Set(antes.filter(m => concedibles.has(m)));
  const d = new Set(despues.filter(m => concedibles.has(m)));
  return { quita: [...a].filter(m => !d.has(m)), da: [...d].filter(m => !a.has(m)) };
}
