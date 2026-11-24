/**
 * La forma de la navegación lateral del espacio externo (PANEL, decisión 126).
 *
 * <b>UN SOLO ARMAZÓN PARA LAS DOS ÁREAS.</b> El panel de una organización (`/gestion/o/{id}`) y Mi espacio
 * (`/gestion/cuenta`) se pintan con el mismo `app-armazon-de-gestion`; cada uno solo declara sus grupos con
 * esta forma. Así pasar de uno a otro cambia el contenido y no el sistema.
 */

/** Los iconos que sabe pintar la barra lateral (se resuelven con `@switch` en el armazón). */
export type IconoDeGestion =
  | 'inicio' | 'solicitudes' | 'procesos' | 'eventos' | 'herramientas' | 'organizacion' | 'archivos' | 'equipo'
  | 'perfil' | 'datos' | 'seguridad' | 'organizaciones' | 'agenda' | 'taller' | 'espacio' | 'red';

export interface EnlaceDeGestion {
  /** Identificador estable del destino; es el `data-seccion` de la barra y la clave del buscador. */
  ruta: string;
  /** Los comandos de enrutador completos. */
  comandos: readonly string[];
  etiqueta: string;
  /** Un nombre más corto para la barra inferior del móvil (cinco columnas en 390 px); sin él, se usa `etiqueta`. */
  etiquetaCorta?: string;
  icono: IconoDeGestion;
  /** Un destino «exacto» solo está activo con su dirección y no con las que cuelgan de ella (el inicio). */
  exacta?: boolean;
  /** Otras direcciones que también activan este destino (las fichas que cuelgan de una lista que se movió). */
  activoEn?: readonly (readonly string[])[];
  /** Sinónimos por tarea que el buscador de la cabecera también reconoce. */
  palabrasClave: readonly string[];
  /** Cuántas cosas esperan en ese destino (la insignia de Solicitudes). Sin número, no se pinta. */
  insignia?: number;
  /** Lo que lee un lector de pantalla junto a la insignia («3 solicitudes esperan tu acción»). */
  textoDeLaInsignia?: string;
}

export interface GrupoDeGestion {
  id: string;
  etiqueta: string;
  enlaces: readonly EnlaceDeGestion[];
}
