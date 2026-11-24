/*
  Validación de SOLO LECTURA del retiro de dbo.PerfilesPublicosFestival (PR-1): conteos, huérfanos y estado de las
  columnas del organizador en dbo.Festivales. No modifica nada. Ejecutar sobre una base propia o con autorización.
  Cada resultado trae `Validacion` y `Valor`; los «Hallazgos» deben dar 0 para poder avanzar de fase.
*/
SET NOCOUNT ON;

-- Volumen y forma
SELECT N'perfiles: filas' AS Validacion, COUNT(*) AS Valor FROM dbo.PerfilesPublicosFestival
UNION ALL SELECT N'perfiles: vigentes', COUNT(*) FROM dbo.PerfilesPublicosFestival WHERE EsVigente = 1
UNION ALL SELECT N'perfiles: festivales distintos', COUNT(DISTINCT FestivalOrigenId) FROM dbo.PerfilesPublicosFestival
UNION ALL SELECT N'perfiles: número máximo de publicación', ISNULL(MAX(NumeroPublicacion), 0) FROM dbo.PerfilesPublicosFestival
UNION ALL SELECT N'festivales publicados SIN perfil vigente (leen la cabecera)', COUNT(*) FROM dbo.Festivales f
    WHERE f.EstadoRegistro IN (N'publicado', N'Publicado')
      AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE p.FestivalOrigenId = f.IdFestival AND p.EsVigente = 1)
UNION ALL SELECT N'perfiles vigentes repudiados (propuesta no aplicada)', COUNT(*) FROM dbo.PerfilesPublicosFestival p
    WHERE p.EsVigente = 1 AND EXISTS (SELECT 1 FROM dbo.PropuestasDeCambio pc WHERE pc.ModuloId = N'festivales'
          AND pc.SubregistroResultanteId = CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) AND pc.Estado <> N'aplicada');

-- Huérfanos (no hay FK entrantes: la base no avisa, por eso se cuentan). Todos deben dar 0.
SELECT N'Hallazgos: perfiles cuyo Festival no existe' AS Validacion, COUNT(*) AS Valor FROM dbo.PerfilesPublicosFestival p
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Festivales f WHERE f.IdFestival = p.FestivalOrigenId)
UNION ALL SELECT N'Hallazgos: Festivales con más de un perfil vigente', COUNT(*) FROM (
    SELECT FestivalOrigenId FROM dbo.PerfilesPublicosFestival WHERE EsVigente = 1 GROUP BY FestivalOrigenId HAVING COUNT(*) > 1) x
UNION ALL SELECT N'Hallazgos: filas hijas de un perfil que no existe (8 tablas)',
    (SELECT COUNT(*) FROM dbo.PracticasMusicalesDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = CONVERT(nvarchar(120), h.RegistroId)))
  + (SELECT COUNT(*) FROM dbo.TerritoriosSonorosDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = CONVERT(nvarchar(120), h.RegistroId)))
  + (SELECT COUNT(*) FROM dbo.ExpresionesArtisticasDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = CONVERT(nvarchar(120), h.RegistroId)))
  + (SELECT COUNT(*) FROM dbo.ModalidadesParticipacionDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = CONVERT(nvarchar(120), h.RegistroId)))
  + (SELECT COUNT(*) FROM dbo.TiposIngresoDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = CONVERT(nvarchar(120), h.RegistroId)))
  + (SELECT COUNT(*) FROM dbo.LocalizacionesDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = CONVERT(nvarchar(120), h.RegistroId)))
  + (SELECT COUNT(*) FROM dbo.EntidadesAliadasDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = CONVERT(nvarchar(120), h.RegistroId)))
  + (SELECT COUNT(*) FROM dbo.ArchivosDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = CONVERT(nvarchar(120), h.RegistroId)))
UNION ALL SELECT N'Hallazgos: propuestas con SubregistroId/SubregistroResultanteId que apuntan a un perfil inexistente', COUNT(*)
    FROM dbo.PropuestasDeCambio pc WHERE pc.ModuloId = N'festivales'
     AND ((pc.SubregistroId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = pc.SubregistroId))
       OR (pc.SubregistroResultanteId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) = pc.SubregistroResultanteId)))
UNION ALL SELECT N'Hallazgos: CambiosDeRegistro con PerfilPublicoFestivalId inexistente', COUNT(*)
    FROM dbo.CambiosDeRegistro c WHERE c.PerfilPublicoFestivalId IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p WHERE p.IdPerfilPublicoFestival = c.PerfilPublicoFestivalId);

-- Hijas por tipo
SELECT N'hijas: prácticas' AS Validacion, COUNT(*) AS Valor FROM dbo.PracticasMusicalesDeRegistro WHERE ModuloId = N'perfiles-publicos-festival'
UNION ALL SELECT N'hijas: territorios', COUNT(*) FROM dbo.TerritoriosSonorosDeRegistro WHERE ModuloId = N'perfiles-publicos-festival'
UNION ALL SELECT N'hijas: expresiones', COUNT(*) FROM dbo.ExpresionesArtisticasDeRegistro WHERE ModuloId = N'perfiles-publicos-festival'
UNION ALL SELECT N'hijas: modalidades', COUNT(*) FROM dbo.ModalidadesParticipacionDeRegistro WHERE ModuloId = N'perfiles-publicos-festival'
UNION ALL SELECT N'hijas: ingresos', COUNT(*) FROM dbo.TiposIngresoDeRegistro WHERE ModuloId = N'perfiles-publicos-festival'
UNION ALL SELECT N'hijas: localizaciones', COUNT(*) FROM dbo.LocalizacionesDeRegistro WHERE ModuloId = N'perfiles-publicos-festival'
UNION ALL SELECT N'hijas: aliadas', COUNT(*) FROM dbo.EntidadesAliadasDeRegistro WHERE ModuloId = N'perfiles-publicos-festival'
UNION ALL SELECT N'hijas: archivos', COUNT(*) FROM dbo.ArchivosDeRegistro WHERE ModuloId = N'perfiles-publicos-festival';

-- Referencias en propuestas, notas e historial (se reescribirán en fases posteriores)
SELECT N'propuestas de Festival con subregistro' AS Validacion, COUNT(*) AS Valor FROM dbo.PropuestasDeCambio WHERE ModuloId = N'festivales' AND (SubregistroId IS NOT NULL OR SubregistroResultanteId IS NOT NULL)
UNION ALL SELECT N'notas de revisión perfilPublico.*', COUNT(*) FROM dbo.RevisionesDeRegistroObservaciones WHERE CampoId LIKE N'perfilPublico.%'
UNION ALL SELECT N'campos de propuesta perfilPublico.*', COUNT(*) FROM dbo.PropuestasDeCambioCampos WHERE CampoId LIKE N'perfilPublico.%'
UNION ALL SELECT N'CambiosDeRegistro con PerfilPublicoFestivalId', COUNT(*) FROM dbo.CambiosDeRegistro WHERE PerfilPublicoFestivalId IS NOT NULL;

-- Columnas del organizador: perfil vigente frente a cabecera (PR-1 las rellenó; deben coincidir salvo repudiados)
SELECT N'organizador: Festivales con algún dato en la cabecera' AS Validacion, COUNT(*) AS Valor FROM dbo.Festivales
    WHERE Director IS NOT NULL OR TipoOrganizadorId IS NOT NULL OR OtroTipoOrganizador IS NOT NULL
       OR PerteneceAOrganizacionColectiva IS NOT NULL OR NombreOrganizacionColectiva IS NOT NULL
UNION ALL SELECT N'organizador: perfiles vigentes con algún dato', COUNT(*) FROM dbo.PerfilesPublicosFestival
    WHERE EsVigente = 1 AND (Director IS NOT NULL OR TipoOrganizadorId IS NOT NULL OR OtroTipoOrganizador IS NOT NULL
       OR PerteneceAOrganizacionColectiva IS NOT NULL OR NombreOrganizacionColectiva IS NOT NULL)
UNION ALL SELECT N'Hallazgos: perfil vigente aprobado con datos del organizador y cabecera distinta', COUNT(*)
    FROM dbo.PerfilesPublicosFestival p JOIN dbo.Festivales f ON f.IdFestival = p.FestivalOrigenId
    WHERE p.EsVigente = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.PropuestasDeCambio pc WHERE pc.ModuloId = N'festivales'
            AND pc.SubregistroResultanteId = CONVERT(nvarchar(120), p.IdPerfilPublicoFestival) AND pc.Estado <> N'aplicada')
      AND (ISNULL(p.Director, N'') <> ISNULL(f.Director, N'')
        OR ISNULL(p.TipoOrganizadorId, -1) <> ISNULL(f.TipoOrganizadorId, -1)
        OR ISNULL(p.OtroTipoOrganizador, N'') <> ISNULL(f.OtroTipoOrganizador, N'')
        OR ISNULL(CONVERT(int, p.PerteneceAOrganizacionColectiva), -1) <> ISNULL(CONVERT(int, f.PerteneceAOrganizacionColectiva), -1)
        OR ISNULL(p.NombreOrganizacionColectiva, N'') <> ISNULL(f.NombreOrganizacionColectiva, N''));
