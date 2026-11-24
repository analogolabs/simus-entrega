-- =============================================
-- Nombre del script: V20261110_12__historia_de_versiones_de_festival_en_cambios.sql
-- Descripcion: Pasa a la capa comun (dbo.CambiosDeRegistro) lo que la historia de versiones del
--              perfil publico de un Festival ya contaba: que campo cambio entre una version y la
-- siguiente (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10).
-- Autor: Edder Jiménez
-- Fecha: 2026-11-10
-- Version: 20261110.12 (linea interna de desarrollo)
--
-- NO SE INVENTA NADA. Cada fila sale de comparar dos versiones consecutivas que YA estan guardadas,
-- campo por campo. La primera version de cada Festival no tiene anterior y no genera filas. Lo que la
-- version no guardaba tampoco se rellena: no se sabe quien edito cada campo (ActorId queda nulo) y
-- las listas hijas (practicas, territorios, modalidades, localizaciones...) no se comparan aqui.
-- Origen = 'migracion' lo dice a quien lea el historial.
--
-- IDEMPOTENTE. Una fila por (version, campo): volver a ejecutarlo no duplica.
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.CambiosDeRegistro', N'U') IS NULL
    THROW 51112, 'Falta la tabla dbo.CambiosDeRegistro (V20261110_10).', 1;

IF OBJECT_ID(N'dbo.VersionesFestival', N'U') IS NOT NULL
BEGIN
    -- Cada version con la anterior de su Festival al lado.
    SELECT
        v.IdVersionFestival,
        v.FestivalOrigenId,
        v.NumeroVersion,
        v.FechaPublicacion,
        LAG(v.NumeroVersion) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS NumeroPrevio,
        v.Nombre, LAG(v.Nombre) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS NombrePrevio,
        v.Descripcion, LAG(v.Descripcion) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS DescripcionPrevia,
        v.NivelCobertura, LAG(v.NivelCobertura) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS NivelCoberturaPrevio,
        v.CodigoDepartamento, LAG(v.CodigoDepartamento) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS CodigoDepartamentoPrevio,
        v.CodigoMunicipio, LAG(v.CodigoMunicipio) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS CodigoMunicipioPrevio,
        v.Periodicidad, LAG(v.Periodicidad) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS PeriodicidadPrevia,
        v.PeriodicidadDetalle, LAG(v.PeriodicidadDetalle) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS PeriodicidadDetallePrevio,
        v.CorreoContacto, LAG(v.CorreoContacto) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS CorreoContactoPrevio,
        v.TelefonoContacto, LAG(v.TelefonoContacto) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS TelefonoContactoPrevio,
        v.Instagram, LAG(v.Instagram) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS InstagramPrevio,
        v.Facebook, LAG(v.Facebook) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS FacebookPrevio,
        v.SitioWeb, LAG(v.SitioWeb) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS SitioWebPrevio,
        v.OtroEnlace, LAG(v.OtroEnlace) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS OtroEnlacePrevio,
        v.Director, LAG(v.Director) OVER (PARTITION BY v.FestivalOrigenId ORDER BY v.NumeroVersion) AS DirectorPrevio
    INTO #Pares
    FROM dbo.VersionesFestival v;

    -- Un identificador de guardado por version, para que sus campos se lean juntos.
    SELECT p.IdVersionFestival, NEWID() AS IdGrupo
    INTO #Grupos
    FROM #Pares p
    WHERE p.NumeroPrevio IS NOT NULL;

    INSERT INTO dbo.CambiosDeRegistro
        (ModuloId, RegistroId, OrganizacionId, IdGrupo, CampoId, CampoEtiqueta, ClaseDato,
         ValorAnterior, ValorNuevo, Origen, VersionFestivalId, Motivo, Fecha)
    SELECT
        N'festivales',
        CONVERT(nvarchar(64), p.FestivalOrigenId),
        f.OrganizacionPrincipalId,
        g.IdGrupo,
        c.CampoId, c.Etiqueta, c.Clase,
        c.Anterior, c.Nuevo,
        N'migracion',
        p.IdVersionFestival,
        CONCAT(N'Reconstruido de la versión publicada N.º ', p.NumeroVersion, N' frente a la N.º ', p.NumeroPrevio),
        p.FechaPublicacion
    FROM #Pares p
    JOIN #Grupos g ON g.IdVersionFestival = p.IdVersionFestival
    LEFT JOIN dbo.Festivales f ON f.IdFestival = p.FestivalOrigenId
    CROSS APPLY (VALUES
        (N'nombre',              N'Nombre',                     N'publico',  CONVERT(nvarchar(max), p.NombrePrevio),              CONVERT(nvarchar(max), p.Nombre)),
        (N'descripcion',         N'Descripción',                N'publico',  CONVERT(nvarchar(max), p.DescripcionPrevia),         CONVERT(nvarchar(max), p.Descripcion)),
        (N'nivelCobertura',      N'Nivel de cobertura',         N'publico',  CONVERT(nvarchar(max), p.NivelCoberturaPrevio),      CONVERT(nvarchar(max), p.NivelCobertura)),
        (N'codigoDepartamento',  N'Departamento',               N'publico',  CONVERT(nvarchar(max), p.CodigoDepartamentoPrevio),  CONVERT(nvarchar(max), p.CodigoDepartamento)),
        (N'codigoMunicipio',     N'Municipio',                  N'publico',  CONVERT(nvarchar(max), p.CodigoMunicipioPrevio),     CONVERT(nvarchar(max), p.CodigoMunicipio)),
        (N'periodicidad',        N'Periodicidad',               N'publico',  CONVERT(nvarchar(max), p.PeriodicidadPrevia),        CONVERT(nvarchar(max), p.Periodicidad)),
        (N'periodicidadDetalle', N'Detalle de la periodicidad', N'publico',  CONVERT(nvarchar(max), p.PeriodicidadDetallePrevio), CONVERT(nvarchar(max), p.PeriodicidadDetalle)),
        (N'correoContacto',      N'Correo de contacto',         N'contacto', CONVERT(nvarchar(max), p.CorreoContactoPrevio),      CONVERT(nvarchar(max), p.CorreoContacto)),
        (N'telefonoContacto',    N'Teléfono de contacto',       N'contacto', CONVERT(nvarchar(max), p.TelefonoContactoPrevio),    CONVERT(nvarchar(max), p.TelefonoContacto)),
        (N'instagram',           N'Instagram',                  N'publico',  CONVERT(nvarchar(max), p.InstagramPrevio),           CONVERT(nvarchar(max), p.Instagram)),
        (N'facebook',            N'Facebook',                   N'publico',  CONVERT(nvarchar(max), p.FacebookPrevio),            CONVERT(nvarchar(max), p.Facebook)),
        (N'sitioWeb',            N'Sitio web',                  N'publico',  CONVERT(nvarchar(max), p.SitioWebPrevio),            CONVERT(nvarchar(max), p.SitioWeb)),
        (N'otroEnlace',          N'Otro enlace',                N'publico',  CONVERT(nvarchar(max), p.OtroEnlacePrevio),          CONVERT(nvarchar(max), p.OtroEnlace)),
        (N'director',            N'Director o directora',       N'publico',  CONVERT(nvarchar(max), p.DirectorPrevio),            CONVERT(nvarchar(max), p.Director))
    ) AS c (CampoId, Etiqueta, Clase, Anterior, Nuevo)
    -- Nulo y vacio son lo mismo para quien lee; solo cuenta lo que de verdad cambio.
    WHERE ISNULL(NULLIF(LTRIM(RTRIM(c.Anterior)), N''), N'') <> ISNULL(NULLIF(LTRIM(RTRIM(c.Nuevo)), N''), N'')
      AND NOT EXISTS (
          SELECT 1 FROM dbo.CambiosDeRegistro x
          WHERE x.Origen = N'migracion' AND x.VersionFestivalId = p.IdVersionFestival AND x.CampoId = c.CampoId);

    DROP TABLE #Grupos;
    DROP TABLE #Pares;
END;

COMMIT TRANSACTION;
