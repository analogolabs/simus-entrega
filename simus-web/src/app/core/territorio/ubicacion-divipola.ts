/**
 * Fila territorial publicada por `GET /api/v1/publico/divipola`.
 *
 * Los cuatro códigos y nombres identifican una relación departamento-municipio.
 * Las coordenadas y el tipo de ubicación son complementos disponibles para las
 * superficies que los necesiten; no son requisito para formularios que solo
 * guardan los códigos.
 */
export interface UbicacionDivipola {
  departmentCode: string;
  departmentName: string;
  municipalityCode: string;
  municipalityName: string;
  locationType?: string;
  latitude?: number | null;
  longitude?: number | null;
}
