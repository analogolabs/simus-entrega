/** Equivalencias territoriales necesarias para comparar nombres de departamentos. */
const ALIAS_DEPARTAMENTOS: Record<string, string> = {
  'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA': 'SAN ANDRES Y PROVIDENCIA',
  'SAN ANDRES PROVIDENCIA Y SANTA CATALINA': 'SAN ANDRES Y PROVIDENCIA',
  'SAN ANDRES Y PROVIDENCIA Y SANTA CATALINA': 'SAN ANDRES Y PROVIDENCIA',
  'SANTAFE DE BOGOTA': 'BOGOTA',
  'BOGOTA D C': 'BOGOTA',
  'BOGOTA D.C': 'BOGOTA',
  'BOGOTA, D.C.': 'BOGOTA',
  'DISTRITO CAPITAL DE BOGOTA': 'BOGOTA',
  'CUNDINAMRCA': 'CUNDINAMARCA',
};

/** Normaliza un nombre departamental sin perder las equivalencias territoriales conocidas. */
export const normalizarNombreDeDepartamento = (valor: string): string => {
  const normalizado = valor?.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+D\s+C\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '';
  return ALIAS_DEPARTAMENTOS[normalizado] || normalizado;
};
