import { ElementoDeCatalogo } from '../../../core/services/catalogos-admin.service';
import { aCsv, columnasDeLaHoja, leerCsv } from './catalogos-csv';

function elemento(parcial: Partial<ElementoDeCatalogo>): ElementoDeCatalogo {
  return {
    id: 1, nombre: 'Joropo', slug: 'joropo', orden: 1, activo: true, padreId: null, padreNombre: null, sinonimos: null, observaciones: null,
    definicionBreve: null, definicionAmpliada: null, caracteristicas: null, relacionTerritorial: null, contextos: null, ejemplos: null,
    fuentes: null, esPreliminar: false, imagenArchivoId: null, imagenUrl: null, textoAlternativoRecurso: null, fechaActualizacion: null,
    totalDeUsos: 0, usos: [], subelementos: 0, estadoDeFicha: 'pendiente', ...parcial,
  };
}

describe('hoja de cálculo de catálogos', () => {
  it('las prácticas llevan «Principal» y los territorios «Relación territorial»', () => {
    expect(columnasDeLaHoja('practicas-musicales').map(c => c.rotulo)).toContain('Principal');
    expect(columnasDeLaHoja('practicas-musicales').map(c => c.rotulo)).not.toContain('Relación territorial');
    expect(columnasDeLaHoja('territorios-sonoros').map(c => c.rotulo)).toContain('Relación territorial');
  });

  it('exporta con marca UTF-8 y ";" y vuelve a leerse igual, con comillas, saltos de línea y tildes', () => {
    const e = elemento({ nombre: 'Música «de» "cámara"; sola', definicionAmpliada: 'Primer párrafo.\n\nSegundo, con coma.', esPreliminar: true });
    const csv = aCsv('practicas-musicales', [e]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    const [fila] = leerCsv(csv);
    expect(fila['Nombre']).toBe(e.nombre);
    expect(fila['Ficha ampliada']).toBe(e.definicionAmpliada ?? '');
    expect(fila['Definición preliminar']).toBe('Sí');
    expect(fila['Id']).toBe('1');
  });

  it('protege las fórmulas al exportar y las restituye al importar', () => {
    const csv = aCsv('territorios-sonoros', [elemento({ nombre: '=SUMA(1;2)', fuentes: '@usuario' })]);
    expect(csv).toContain("'=SUMA");
    const [fila] = leerCsv(csv);
    expect(fila['Nombre']).toBe('=SUMA(1;2)');
    expect(fila['Fuente']).toBe('@usuario');
  });

  it('acepta coma y tabulación como separador y salta líneas vacías', () => {
    expect(leerCsv('Nombre,Orden\nA,1\n\nB,2\n')).toEqual([{ Nombre: 'A', Orden: '1' }, { Nombre: 'B', Orden: '2' }]);
    expect(leerCsv('Nombre\tOrden\r\nA\t1\r\n')).toEqual([{ Nombre: 'A', Orden: '1' }]);
    expect(leerCsv('')).toEqual([]);
  });
});
