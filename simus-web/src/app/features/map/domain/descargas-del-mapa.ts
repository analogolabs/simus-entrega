import { crearLibroExcel } from '../../../shared/utils/crear-libro-excel';
import { Celda, CabeceraDeExportacion, lineasDeCabecera } from './exportar-consulta';

/** Descarga un blob con el nombre dado. */
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function descargarTexto(texto: string, tipo: string, nombre: string): void {
  descargarBlob(new Blob([texto], { type: `${tipo};charset=utf-8` }), nombre);
}

/** Dibuja un SVG autónomo en un lienzo (al doble de resolución) y devuelve el PNG. */
export function svgAPng(svg: string, ancho: number, alto: number): Promise<Blob> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const imagen = new Image();
    imagen.onload = () => {
      const escala = 2;
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho * escala;
      lienzo.height = alto * escala;
      const contexto = lienzo.getContext('2d');
      if (!contexto) { URL.revokeObjectURL(url); rechazar(new Error('Sin lienzo')); return; }
      contexto.fillStyle = '#ffffff';
      contexto.fillRect(0, 0, lienzo.width, lienzo.height);
      contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      lienzo.toBlob((png) => (png ? resolver(png) : rechazar(new Error('Sin PNG'))), 'image/png');
    };
    imagen.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo dibujar el SVG')); };
    imagen.src = url;
  });
}

/** El libro de Excel: la cabecera de fuente, una fila en blanco y la tabla. */
export async function aLibroExcel(cabecera: CabeceraDeExportacion, columnas: readonly string[], filas: readonly (readonly Celda[])[]): Promise<Blob> {
  const libro = await crearLibroExcel();
  libro.creator = 'SIMUS';
  libro.created = cabecera.fecha;
  const hoja = libro.addWorksheet('Datos');
  lineasDeCabecera(cabecera).forEach((linea, indice) => {
    const fila = hoja.addRow([linea]);
    fila.font = { bold: indice === 0 };
  });
  hoja.addRow([]);
  const encabezado = hoja.addRow([...columnas]);
  encabezado.font = { bold: true };
  for (const fila of filas) hoja.addRow([...fila]);
  columnas.forEach((_, indice) => { hoja.getColumn(indice + 1).width = indice === 0 ? 42 : 24; });
  const bytes = await libro.xlsx.writeBuffer();
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
