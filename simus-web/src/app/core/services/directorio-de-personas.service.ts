import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiClientService } from '../http/api-client.service';

/** Un valor de la taxonomía de perfiles, con su correspondencia con Soy Cultura (docs/desarrollo/19-cuentas-y-organizaciones.md §19.13). */
export interface ValorDeTaxonomia {
  codigo: string;
  nombre: string;
  grupoSoyCultura: string | null;
  fuente: string | null;
  /** Falso: ya no se ofrece, pero los perfiles que lo tienen lo conservan (decisión 133). */
  activo?: boolean;
  /** Solo roles: el código de su categoría. Nulo o ausente: es una categoría (decisión 135). */
  padre?: string | null;
}

/** Una categoría de roles con sus subcategorías (lectura jerárquica, decisión 135). */
export interface CategoriaDeRoles {
  codigo: string;
  nombre: string;
  grupoSoyCultura: string | null;
  fuente: string | null;
  activo: boolean;
  subcategorias: ValorDeTaxonomia[];
}

export interface TaxonomiaDePerfiles {
  roles: ValorDeTaxonomia[];
  /** Los mismos roles en árbol. Una categoría sin subcategorías se elige a sí misma. */
  rolesPorCategoria?: CategoriaDeRoles[];
  servicios: ValorDeTaxonomia[];
  instrumentos: ValorDeTaxonomia[];
  maximoDeRoles: number;
  maximoDeServicios: number;
  maximoDeInstrumentos: number;
  maximoDeTerritorios: number;
}

/** Una persona del directorio: solo lo que su perfil público ya muestra. */
export interface PersonaDelDirectorio {
  clave: string;
  nombreVisible: string;
  fotoUrl: string | null;
  biografiaCorta: string | null;
  municipio: string | null;
  departamento: string | null;
  roles: string[];
  servicios: string[];
  instrumentos: string[];
  practicas: string[];
  territorios: string[];
  /** Falso si todavía no eligió ni roles ni servicios: «pendiente de completar». */
  completo: boolean;
}

/** Un rol que se puede elegir, con el nombre de su categoría para agrupar (nulo si es una categoría sin subcategorías). */
export interface RolElegible extends ValorDeTaxonomia {
  categoria: string | null;
}

/**
 * Los roles que se ofrecen, en orden de árbol (decisión 135): subcategorías agrupadas bajo su categoría y categorías sin
 * hijas sueltas. Se ofrece lo activo (una subcategoría solo si su categoría también lo está) y lo que la persona ya tenía.
 */
export function rolesElegibles(t: TaxonomiaDePerfiles, elegidos: string[]): RolElegible[] {
  const quedan = (v: ValorDeTaxonomia) => v.activo !== false || elegidos.includes(v.codigo);
  if (!t.rolesPorCategoria) return t.roles.filter(quedan).map(v => ({ ...v, categoria: null }));
  return t.rolesPorCategoria.flatMap((c): RolElegible[] => {
    if (c.subcategorias.length === 0) {
      const propia: RolElegible = { codigo: c.codigo, nombre: c.nombre, grupoSoyCultura: c.grupoSoyCultura, fuente: c.fuente, activo: c.activo, padre: null, categoria: null };
      return quedan(propia) ? [propia] : [];
    }
    return c.subcategorias.filter(h => quedan(h) && (c.activo || elegidos.includes(h.codigo))).map(h => ({ ...h, categoria: c.nombre }));
  });
}

/** La categoría de cada rol: la de su padre; una categoría sin hijas (o un rol sin padre) es su propia categoría. */
export function categoriaDeRol(t: TaxonomiaDePerfiles | null, codigo: string): string {
  return t?.roles.find(r => r.codigo === codigo)?.padre ?? codigo;
}

/** Una opción de filtro con cuántas personas la tienen en la consulta actual. */
export interface FacetaDelDirectorio {
  valor: string;
  nombre: string;
  total: number;
}

export interface FacetasDelDirectorio {
  categorias: FacetaDelDirectorio[];
  roles: FacetaDelDirectorio[];
  servicios: FacetaDelDirectorio[];
  instrumentos: FacetaDelDirectorio[];
  practicas: FacetaDelDirectorio[];
  territorios: FacetaDelDirectorio[];
  departamentos: FacetaDelDirectorio[];
  municipios: FacetaDelDirectorio[];
}

/** Una página del directorio de agentes y actores de la música (solo perfiles consentidos). */
export interface PaginaDelDirectorioDePersonas {
  items: PersonaDelDirectorio[];
  total: number;
  totalPublicadas: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
  facetas: FacetasDelDirectorio;
}

/** Lo que se pide al directorio: las listas viajan separadas por comas. */
export interface ConsultaDelDirectorio {
  q: string;
  categoria: string[];
  rol: string[];
  servicio: string[];
  instrumento: string[];
  practica: string[];
  departamento: string;
  municipio: string;
  actua: string;
  orden: 'nombre' | 'territorio';
  pagina: number;
  porPagina: number;
}

export interface PersonaSimilar {
  persona: PersonaDelDirectorio;
  coincidencias: string[];
}

export interface PerfilesSimilares {
  persona: PersonaDelDirectorio;
  criterio: string;
  similares: PersonaSimilar[];
}

export interface MiClasificacion {
  existe: boolean;
  roles: string[];
  servicios: string[];
  instrumentos: string[];
  codigosDeDepartamento: string[];
  pendiente: boolean;
}

export type CambiosDeClasificacion = Pick<MiClasificacion, 'roles' | 'servicios' | 'instrumentos' | 'codigosDeDepartamento'>;

const CLAVE_DE_CONSULTA = 'simus-directorio-de-personas-consulta';

/** Guarda la consulta del directorio (la parte `?…` de su URL) para volver a ella desde cualquier ficha, sin importar cuántas personas se hayan recorrido. */
export function recordarConsultaDelDirectorio(consulta: string): void {
  try { sessionStorage.setItem(CLAVE_DE_CONSULTA, consulta); } catch { /* sin almacenamiento: se vuelve al directorio sin filtros */ }
}

export function consultaRecordadaDelDirectorio(): string {
  try { return sessionStorage.getItem(CLAVE_DE_CONSULTA) ?? ''; } catch { return ''; }
}

@Injectable({ providedIn: 'root' })
export class DirectorioDePersonasService {
  private readonly api = inject(ApiClientService);

  taxonomia(): Observable<TaxonomiaDePerfiles> {
    return this.api.get<TaxonomiaDePerfiles>('/api/v1/publico/taxonomia-de-perfiles', { errorFallback: 'No fue posible cargar las categorías.' });
  }

  listar(): Observable<PersonaDelDirectorio[]> {
    return this.api.get<PersonaDelDirectorio[]>('/api/v1/publico/personas', { errorFallback: 'No fue posible consultar el directorio de personas.' });
  }

  /** El directorio paginado: filtra, ordena y cuenta las opciones en el servidor. */
  pagina(c: ConsultaDelDirectorio): Observable<PaginaDelDirectorioDePersonas> {
    const parametros: Record<string, string> = {
      q: c.q.trim(), categoria: c.categoria.join(','), rol: c.rol.join(','), servicio: c.servicio.join(','),
      instrumento: c.instrumento.join(','), practica: c.practica.join(','), departamento: c.departamento,
      municipio: c.municipio, actua: c.actua, orden: c.orden, pagina: String(c.pagina), porPagina: String(c.porPagina),
    };
    const consulta = new URLSearchParams(Object.entries(parametros).filter(([, v]) => v)).toString();
    return this.api.get<PaginaDelDirectorioDePersonas>(`/api/v1/publico/directorio-de-personas?${consulta}`,
      { errorFallback: 'No fue posible consultar el directorio de agentes y actores.' });
  }

  similares(clave: string): Observable<PerfilesSimilares> {
    return this.api.get<PerfilesSimilares>(`/api/v1/publico/personas/${encodeURIComponent(clave)}/similares`, { errorFallback: 'No fue posible cargar los perfiles similares.' });
  }

  mia(): Observable<MiClasificacion> {
    return this.api.get<MiClasificacion>('/api/v1/externo/cuenta/perfil-publico/clasificacion', { errorFallback: 'No fue posible cargar tus categorías.' });
  }

  guardar(cambios: CambiosDeClasificacion): Observable<MiClasificacion> {
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', { errorFallback: 'No fue posible preparar la solicitud' }).pipe(
      switchMap(token => this.api.put<MiClasificacion>('/api/v1/externo/cuenta/perfil-publico/clasificacion', cambios, {
        headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible guardar tus categorías',
      })));
  }
}
