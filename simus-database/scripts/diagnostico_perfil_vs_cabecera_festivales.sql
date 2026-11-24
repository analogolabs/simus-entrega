/*
  Diagnóstico de SOLO LECTURA del retiro de dbo.PerfilesPublicosFestival (PR-2). Equivale a
  GET /api/v1/institucional/festivales/diagnostico-perfil-vs-cabecera: por campo, cuántos Festivales tienen el perfil
  vigente APROBADO distinto de la cabecera dbo.Festivales. No modifica nada. Meta de salida de la Fase A: todas las
  filas en 0 tras el backfill de la cabecera (PR-3); a partir de ahí lo mantiene el espejo de escritura.

  «Aprobado» = el vigente si no nació de una propuesta que dejó de estar `aplicada`; si sí, el último no repudiado
  (misma regla que LecturaFestivalesPublicados y que V20261119_10). Vacío y NULL se tratan como lo mismo.
*/
SET NOCOUNT ON;

IF OBJECT_ID(N'tempdb..#Par') IS NOT NULL DROP TABLE #Par;

;WITH Elegido AS (
    SELECT p.*, ROW_NUMBER() OVER (PARTITION BY p.FestivalOrigenId
                                   ORDER BY p.EsVigente DESC, p.NumeroPublicacion DESC, p.IdPerfilPublicoFestival DESC) AS Orden
    FROM dbo.PerfilesPublicosFestival p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.PropuestasDeCambio pc
        WHERE pc.ModuloId = N'festivales'
          AND pc.SubregistroResultanteId = CONVERT(nvarchar(120), p.IdPerfilPublicoFestival)
          AND pc.Estado <> N'aplicada')
)
SELECT p.IdPerfilPublicoFestival AS PerfilId, f.IdFestival AS FestivalId, f.NombreFestival AS NombreCabecera,
       p.Nombre AS p_Nombre, f.NombreFestival AS f_Nombre,
       p.Descripcion AS p_Descripcion, f.Descripcion AS f_Descripcion,
       p.NivelCobertura AS p_NivelCobertura, f.NivelCobertura AS f_NivelCobertura,
       p.CodigoDepartamento AS p_CodigoDepartamento, f.CodigoDepartamento AS f_CodigoDepartamento,
       p.CodigoMunicipio AS p_CodigoMunicipio, f.CodigoMunicipio AS f_CodigoMunicipio,
       p.Periodicidad AS p_Periodicidad, f.Periodicidad AS f_Periodicidad,
       p.PeriodicidadDetalle AS p_PeriodicidadDetalle, f.PeriodicidadDetalle AS f_PeriodicidadDetalle,
       p.CorreoContacto AS p_Correo, f.CorreoFestival AS f_Correo,
       p.TelefonoContacto AS p_Telefono, f.TelefonoFestival AS f_Telefono,
       p.Instagram AS p_Instagram, f.InstagramFestival AS f_Instagram,
       p.Facebook AS p_Facebook, f.FacebookFestival AS f_Facebook,
       p.SitioWeb AS p_SitioWeb, f.SitioWebFestival AS f_SitioWeb,
       p.OtroEnlace AS p_OtroEnlace, f.OtroEnlaceFestival AS f_OtroEnlace,
       p.ObservacionesContacto AS p_Observaciones, f.ObservacionesContacto AS f_Observaciones,
       p.Director AS p_Director, f.Director AS f_Director,
       p.TipoOrganizadorId AS p_TipoOrganizadorId, f.TipoOrganizadorId AS f_TipoOrganizadorId,
       p.OtroTipoOrganizador AS p_OtroTipo, f.OtroTipoOrganizador AS f_OtroTipo,
       p.PerteneceAOrganizacionColectiva AS p_Pertenece, f.PerteneceAOrganizacionColectiva AS f_Pertenece,
       p.NombreOrganizacionColectiva AS p_NombreColectiva, f.NombreOrganizacionColectiva AS f_NombreColectiva
INTO #Par
FROM Elegido p
JOIN dbo.Festivales f ON f.IdFestival = p.FestivalOrigenId
WHERE p.Orden = 1;

-- Cada comparación usa EXCEPT, que trata NULL = NULL; el texto se recorta y el vacío vale NULL.
SELECT N'festivales con perfil aprobado' AS Campo, COUNT(*) AS Festivales FROM #Par
UNION ALL SELECT N'nombre', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_Nombre)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_Nombre)), N''))
UNION ALL SELECT N'descripcion', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_Descripcion)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_Descripcion)), N''))
UNION ALL SELECT N'nivelCobertura', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_NivelCobertura)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_NivelCobertura)), N''))
UNION ALL SELECT N'codigoDepartamento', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_CodigoDepartamento)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_CodigoDepartamento)), N''))
UNION ALL SELECT N'codigoMunicipio', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_CodigoMunicipio)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_CodigoMunicipio)), N''))
UNION ALL SELECT N'periodicidad', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_Periodicidad)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_Periodicidad)), N''))
UNION ALL SELECT N'periodicidadDetalle', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_PeriodicidadDetalle)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_PeriodicidadDetalle)), N''))
UNION ALL SELECT N'correoContacto', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_Correo)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_Correo)), N''))
UNION ALL SELECT N'telefonoContacto', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_Telefono)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_Telefono)), N''))
UNION ALL SELECT N'instagram', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_Instagram)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_Instagram)), N''))
UNION ALL SELECT N'facebook', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_Facebook)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_Facebook)), N''))
UNION ALL SELECT N'sitioWeb', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_SitioWeb)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_SitioWeb)), N''))
UNION ALL SELECT N'otroEnlace', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_OtroEnlace)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_OtroEnlace)), N''))
UNION ALL SELECT N'observacionesContacto', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_Observaciones)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_Observaciones)), N''))
UNION ALL SELECT N'director', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_Director)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_Director)), N''))
UNION ALL SELECT N'tipoOrganizadorId', COUNT(*) FROM #Par WHERE EXISTS (SELECT p_TipoOrganizadorId EXCEPT SELECT f_TipoOrganizadorId)
UNION ALL SELECT N'otroTipoOrganizador', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_OtroTipo)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_OtroTipo)), N''))
UNION ALL SELECT N'perteneceAOrganizacionColectiva', COUNT(*) FROM #Par WHERE EXISTS (SELECT p_Pertenece EXCEPT SELECT f_Pertenece)
UNION ALL SELECT N'nombreOrganizacionColectiva', COUNT(*) FROM #Par WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(p_NombreColectiva)), N'') EXCEPT SELECT NULLIF(LTRIM(RTRIM(f_NombreColectiva)), N''))
UNION ALL SELECT N'practicasMusicales', COUNT(*) FROM #Par x WHERE
       EXISTS (SELECT h.IdPracticaMusical FROM dbo.PracticasMusicalesDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId)
               EXCEPT SELECT c.IdPracticaMusical FROM dbo.PracticasMusicalesDeRegistro c WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId))
    OR EXISTS (SELECT c.IdPracticaMusical FROM dbo.PracticasMusicalesDeRegistro c WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId)
               EXCEPT SELECT h.IdPracticaMusical FROM dbo.PracticasMusicalesDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId))
UNION ALL SELECT N'territoriosSonoros', COUNT(*) FROM #Par x WHERE
       EXISTS (SELECT h.IdTerritorioSonoro FROM dbo.TerritoriosSonorosDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId)
               EXCEPT SELECT c.IdTerritorioSonoro FROM dbo.TerritoriosSonorosDeRegistro c WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId))
    OR EXISTS (SELECT c.IdTerritorioSonoro FROM dbo.TerritoriosSonorosDeRegistro c WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId)
               EXCEPT SELECT h.IdTerritorioSonoro FROM dbo.TerritoriosSonorosDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId));

DROP TABLE #Par;
