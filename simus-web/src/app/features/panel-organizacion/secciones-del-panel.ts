/**
 * Las secciones del panel de una organización, agrupadas como la barra lateral de la consola (UI-E).
 *
 * <b>UNA SOLA LISTA PARA TRES USOS</b>: la barra lateral, el buscador de la cabecera y las rutas de las
 * pruebas. Antes eran pestañas horizontales como segundo menú (docs/desarrollo/30-consola-y-acceso.md §30.13, decisión 5); ahora son los
 * destinos de una barra lateral con grupos plegables, igual que la consola.
 *
 * SON ENLACES DE VERDAD desde el 1 de septiembre de 2026: cada uno tiene su dirección, se puede enlazar y
 * «atrás» funciona. Las rutas son relativas a `/gestion/o/{organizacionId}`.
 *
 * <b>LAS ETIQUETAS NO CAMBIAN</b> respecto de las pestañas: los recorridos, los avisos y la ayuda las citan.
 * Cambia el orden de lectura, que ahora es por tarea:
 * <ul>
 *   <li><b>Trabajo</b>: Resumen y Solicitudes, lo que espera una decisión o una respuesta.</li>
 *   <li><b>Procesos y herramientas</b>: Procesos, Eventos y Herramientas. Eventos va después de Procesos
 *     porque depende de ellos: un evento se anuncia siempre dentro de un proceso.</li>
 *   <li><b>La organización</b>: Datos, Archivos y Equipo. «Archivos de la organización» y no «Mis archivos»
 *: el banco es de la organización, no de quien lo mira.</li>
 * </ul>
 * Perfil público y Cuenta y seguridad no están aquí desde L2: son de la persona y viven en su
 * espacio (`/gestion/cuenta`).
 */

import { IconoDeGestion } from '../../core/navegacion/grupos-de-gestion';

export type IconoDelPanel = IconoDeGestion;

/** Un enlace de la navegación del panel. */
export interface EnlacePanel {
  ruta: string;
  etiqueta: string;
  /** Nombre del icono de la barra lateral (se pinta con `@switch`, igual que en la consola). */
  icono: IconoDelPanel;
  /** Sinónimos por tarea que el buscador de la cabecera también reconoce. */
  palabrasClave: readonly string[];
}

export interface GrupoDelPanel {
  id: string;
  etiqueta: string;
  enlaces: readonly EnlacePanel[];
}

export const GRUPOS_DEL_PANEL: readonly GrupoDelPanel[] = [
  {
    id: 'trabajo',
    etiqueta: 'Trabajo',
    enlaces: [
      { ruta: 'resumen', etiqueta: 'Inicio', icono: 'inicio', palabrasClave: ['resumen', 'prioridades', 'siguiente acción', 'pendientes'] },
      { ruta: 'solicitudes', etiqueta: 'Solicitudes', icono: 'solicitudes', palabrasClave: ['ajustes', 'revisión', 'trámites', 'respuestas'] },
    ],
  },
  {
    id: 'procesos',
    etiqueta: 'Mis procesos',
    enlaces: [
      { ruta: 'procesos', etiqueta: 'Procesos', icono: 'procesos', palabrasClave: ['festivales', 'mercados', 'espacios', 'redes', 'talleres', 'registrar', 'borradores', 'publicar'] },
      // EVENTOS VA DESPUÉS DE PROCESOS Y NO ANTES, porque depende de ellos: un evento se anuncia
      // siempre dentro de un proceso, y sin ninguno publicado esta sección no ofrece el formulario.
      { ruta: 'eventos', etiqueta: 'Eventos', icono: 'eventos', palabrasClave: ['agenda', 'anunciar', 'conciertos', 'fechas'] },
      // HERRAMIENTAS: lo que la organización puede usar aparte de sus procesos (docs/referencia/26-agenda-de-citas-y-mercados.md). Hoy: procesos históricos
      // (reclamar un Festival o Mercado que ya estaba en SIMUS) y, con las ediciones de Mercado, la agenda de citas.
      { ruta: 'herramientas', etiqueta: 'Herramientas', icono: 'herramientas', palabrasClave: ['procesos históricos', 'festivales históricos', 'mercados históricos', 'reclamar', 'citas', 'agendamiento'] },
    ],
  },
  {
    id: 'organizacion',
    etiqueta: 'Mi organización',
    enlaces: [
      { ruta: 'organizacion', etiqueta: 'Datos de la organización', icono: 'organizacion', palabrasClave: ['ficha', 'responsable', 'contacto', 'sede', 'descripción'] },
      // MIS ARCHIVOS VA DESPUÉS DE LOS DATOS: es material de la organización, no una preferencia de la
      // cuenta. Aquí se ve lo que ocupa el espacio y se retira lo que ya no usa ninguna ficha.
      { ruta: 'archivos', etiqueta: 'Archivos de la organización', icono: 'archivos', palabrasClave: ['imágenes', 'fotos', 'espacio', 'cuota', 'retirar'] },
      // EQUIPO: quién forma parte de la organización, con qué rol, e invitaciones.
      { ruta: 'equipo', etiqueta: 'Equipo', icono: 'equipo', palabrasClave: ['personas', 'invitar', 'invitaciones', 'roles', 'editor', 'administrador'] },
    ],
  },
];

/** Todos los enlaces en el orden en que se leen de arriba abajo. */
export const ENLACES_DEL_PANEL: readonly EnlacePanel[] = GRUPOS_DEL_PANEL.flatMap(grupo => grupo.enlaces);

/** Los grupos que quedan plegados por omisión: ninguno, caben todos (son ocho enlaces). */
export const GRUPOS_DEL_PANEL_PLEGADOS_POR_OMISION: readonly string[] = [];

/** La clave del almacén donde se recuerda qué grupos plegó la persona (la de la consola es otra). */
export const CLAVE_GRUPOS_PLEGADOS_DEL_PANEL = 'simus.panel.grupos-plegados';

/** Lo mínimo que pide la búsqueda a un grupo: sirve a los grupos del panel y a los del armazón de gestión. */
export interface GrupoBuscable {
  etiqueta: string;
  enlaces: readonly { ruta: string; etiqueta: string; palabrasClave: readonly string[] }[];
}

export interface SeccionEncontrada {
  ruta: string;
  etiqueta: string;
  grupo: string;
}

function normalizar(valor: string): string {
  return (valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/**
 * Qué secciones encuentra una búsqueda, por nombre, por grupo y por tarea.
 *
 * Cada palabra escrita tiene que aparecer en algún sitio del destino —su título, su grupo o uno de sus
 * sinónimos—, de modo que «invitar» encuentra Equipo aunque ninguna sección se llame así. Sin tildes y sin
 * distinguir mayúsculas. Los destinos cuyo TÍTULO coincide van primero. Es lo mismo que hace el buscador de
 * la consola, sobre las secciones del panel.
 */
export function buscarSeccionesDelPanel(termino: string, grupos: readonly GrupoBuscable[] = GRUPOS_DEL_PANEL, maximo = 6): SeccionEncontrada[] {
  const buscado = normalizar(termino);
  if (buscado.length < 2) return [];
  const palabras = buscado.split(/\s+/).filter(Boolean);
  return grupos
    .flatMap(grupo => grupo.enlaces.map(enlace => ({ enlace, grupo })))
    .map(({ enlace, grupo }) => {
      const titulo = normalizar(enlace.etiqueta);
      const texto = [titulo, normalizar(grupo.etiqueta), ...enlace.palabrasClave.map(normalizar)].join(' | ');
      return { enlace, grupo, porTitulo: palabras.every(p => titulo.includes(p)), coincide: palabras.every(p => texto.includes(p)) };
    })
    .filter(fila => fila.coincide)
    .sort((a, b) => Number(b.porTitulo) - Number(a.porTitulo))
    .slice(0, maximo)
    .map(fila => ({ ruta: fila.enlace.ruta, etiqueta: fila.enlace.etiqueta, grupo: fila.grupo.etiqueta }));
}
