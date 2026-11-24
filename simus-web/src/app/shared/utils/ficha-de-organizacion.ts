/**
 * La ruta de la ficha pública de una organización, o nada si no la tiene.
 *
 * El API solo manda `organizacionPublicaId` cuando la organización está activa, que es cuando
 * /ecosistema/organizaciones/:id responde; sin él, las fichas la nombran sin enlazarla.
 */
export function fichaDeOrganizacion(id: number | null | undefined): string | undefined {
  return id ? `/ecosistema/organizaciones/${id}` : undefined;
}
