import { AccionDeRegistro } from '../components/ui/menu-de-acciones/menu-de-acciones.component';

/**
 * Las acciones de importación de la lista de un proceso de la consola (Talleres, Espacios, Redes), UNA
 * sola vez (decisión 123): «Importar …» y «Descargar la plantilla», en ese orden. El armazón abre la
 * preparación del archivo; la plantilla la descarga la propia lista con las columnas del dominio.
 */
export function accionesDeImportacion(rotuloDeImportar: string, generandoPlantilla: boolean): AccionDeRegistro[] {
  return [
    { id: 'importar', etiqueta: rotuloDeImportar },
    { id: 'plantilla', etiqueta: 'Descargar la plantilla', deshabilitada: generandoPlantilla, motivo: 'Se está generando' },
  ];
}
