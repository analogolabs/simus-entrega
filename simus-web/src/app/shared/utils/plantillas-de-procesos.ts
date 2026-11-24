import { descargarPlantillaDeImportacion } from './plantilla-de-importacion';

/** Los tres procesos que se importan desde la consola (el módulo de cada uno). */
export type ModuloImportable = 'talleres' | 'espacios' | 'redes';

interface Nombrado { nombre: string }

/**
 * LA PLANTILLA DE IMPORTACIÓN DE TALLERES, ESPACIOS Y REDES, UNA SOLA VEZ (retiro de las listas por tipo).
 * Las columnas son las que declara el servidor para cada dominio (`DominioDeTalleres`, `DominioDeEspacios`,
 * `DominioDeRedes`); los catálogos llegan de su servicio.
 *
 * LA ORGANIZACIÓN VA VACÍA EN EL EJEMPLO: sin organización queda bajo el Programa, y un nombre que no exista
 * rechaza la fila (nunca se crea una organización desde un proceso).
 */
export async function descargarPlantillaDeProceso(modulo: ModuloImportable, catalogos: unknown): Promise<void> {
  const c = catalogos as Record<string, Nombrado[]>;
  const nombres = (lista: string) => (c[lista] ?? []).map(o => o.nombre);
  const contacto = [
    { name: 'organizacion', label: 'Organización responsable' },
    { name: 'correoContacto', label: 'Correo de contacto', type: 'Correo' },
    { name: 'telefonoContacto', label: 'Teléfono de contacto' },
    { name: 'sitioWeb', label: 'Sitio web', type: 'Enlace' },
    { name: 'instagram', label: 'Instagram' },
    { name: 'facebook', label: 'Facebook' },
    { name: 'otroEnlace', label: 'Otro enlace', type: 'Enlace' },
  ];
  const nivel = ['Nacional', 'Departamental', 'Municipal'];
  if (modulo === 'talleres') {
    await descargarPlantillaDeImportacion({
      nombreDelArchivo: 'plantilla_talleres',
      campos: [
        { name: 'nombre', label: 'Nombre del taller', required: true },
        { name: 'descripcion', label: 'Descripción' },
        { name: 'modalidad', label: 'Modalidad' },
        { name: 'recibeAprendices', label: 'Recibe aprendices' },
        { name: 'saberesYTecnicas', label: 'Saberes y técnicas' },
        { name: 'servicios', label: 'Servicios' },
        { name: 'familias', label: 'Familias de instrumentos' },
        { name: 'nivelCobertura', label: 'Nivel de cobertura', required: true },
        { name: 'departamento', label: 'Departamento' },
        { name: 'municipio', label: 'Municipio' },
        { name: 'lugarEspecifico', label: 'Lugar específico' },
        ...contacto,
      ],
      filaDeEjemplo: [
        'Taller de lutería Los Cedros', 'Construcción y reparación de guitarras y tiples.', 'Fijo', 'Sí',
        'Encolado en caliente y barnizado a muñequilla.', 'Construcción de instrumentos; Reparación',
        'Cordófonos pulsados', 'Municipal', 'Antioquia', 'Medellín', 'Calle 10 # 5-20',
        '', 'contacto@ejemplo.com', '3000000000', 'https://ejemplo.com', '', '', '',
      ],
      opcionesDe: campo => ({
        modalidad: ['Fijo', 'Itinerante', 'Colectivo'],
        recibeAprendices: ['Sí', 'No'],
        nivelCobertura: nivel,
        servicios: nombres('servicios'),
        familias: nombres('familias'),
      } as Record<string, readonly string[]>)[campo.name] ?? [],
    });
  } else if (modulo === 'espacios') {
    await descargarPlantillaDeImportacion({
      nombreDelArchivo: 'plantilla_espacios',
      campos: [
        { name: 'nombre', label: 'Nombre del espacio', required: true },
        { name: 'descripcion', label: 'Descripción' },
        { name: 'ambiente', label: 'Ambiente' },
        { name: 'aforoMaximo', label: 'Aforo máximo' },
        { name: 'esAccesible', label: 'Es accesible' },
        { name: 'horarioYProgramacion', label: 'Horario y programación' },
        { name: 'tipos', label: 'Tipos de espacio' },
        { name: 'equipamiento', label: 'Equipamiento' },
        { name: 'departamento', label: 'Departamento', required: true },
        { name: 'municipio', label: 'Municipio', required: true },
        { name: 'lugarEspecifico', label: 'Lugar específico' },
        ...contacto,
      ],
      filaDeEjemplo: [
        'Sala de conciertos La Cueva', 'Sala para música en vivo con tarima.', 'Cerrado', '250', 'Sí',
        'Jueves a sábado, 7 p. m.', 'Bar o club; Teatro', 'Sonido propio', 'Antioquia', 'Medellín', 'Calle 10 # 5-20',
        '', 'contacto@ejemplo.com', '3000000000', 'https://ejemplo.com', '', '', '',
      ],
      opcionesDe: campo => ({
        ambiente: ['Cerrado', 'Abierto', 'Mixto'],
        esAccesible: ['Sí', 'No'],
        tipos: nombres('tipos'),
        equipamiento: nombres('equipamiento'),
      } as Record<string, readonly string[]>)[campo.name] ?? [],
    });
  } else {
    await descargarPlantillaDeImportacion({
      nombreDelArchivo: 'plantilla_redes',
      campos: [
        { name: 'nombre', label: 'Nombre de la red', required: true },
        { name: 'descripcion', label: 'Descripción' },
        { name: 'tipoDeNodo', label: 'Tipo de nodo' },
        { name: 'accesoAbierto', label: 'Acceso abierto' },
        { name: 'acervosYColecciones', label: 'Acervos y colecciones' },
        { name: 'formasDeAcceso', label: 'Formas de acceso' },
        { name: 'formatos', label: 'Formatos de documentación' },
        { name: 'nivelCobertura', label: 'Nivel de cobertura', required: true },
        { name: 'departamento', label: 'Departamento' },
        { name: 'municipio', label: 'Municipio' },
        { name: 'lugarEspecifico', label: 'Lugar específico' },
        ...contacto,
      ],
      filaDeEjemplo: [
        'Centro de documentación Aires', 'Archivo sonoro de música de la región.', 'Centro de documentación', 'Sí',
        'Grabaciones de campo, partituras.', 'Presencial; En línea', 'Audio; Texto', 'Municipal', 'Antioquia', 'Medellín',
        'Carrera 40 # 20-10', '', 'contacto@ejemplo.com', '3000000000', 'https://ejemplo.com', '', '', '',
      ],
      opcionesDe: campo => ({
        tipoDeNodo: ['Red', 'Centro de documentación', 'Archivo', 'Colección', 'Grupo de investigación'],
        accesoAbierto: ['Sí', 'No'],
        formasDeAcceso: nombres('formasDeAcceso'),
        formatos: nombres('formatos'),
        nivelCobertura: nivel,
      } as Record<string, readonly string[]>)[campo.name] ?? [],
    });
  }
}
