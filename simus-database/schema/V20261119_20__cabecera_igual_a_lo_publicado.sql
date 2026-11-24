/*
  SIMUS · La cabecera del Festival pasa a valer lo que el público ve (retiro de PerfilesPublicosFestival, PR-3, docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.11)

  QUE ES. El backfill de datos de la Fase A del retiro de dbo.PerfilesPublicosFestival. Hasta ahora lo publicado de un
  Festival vive en su perfil vigente aprobado y la cabecera dbo.Festivales puede ir por detrás (el espejo de escritura de
  PR-2 solo cubre lo que se publique de aquí en adelante). Este guion deja la cabecera IGUAL a lo publicado, de modo que el
  diagnóstico de PR-2 (GET /institucional/festivales/diagnostico-perfil-vs-cabecera y diagnostico_perfil_vs_cabecera_festivales.sql)
  dé 0 divergencias y las lecturas puedan conmutar después (PR-4) sin que la ficha retroceda.

  QUE HACE, para cada Festival con perfil vigente APROBADO (el vigente; si nació de una propuesta que no acabó `aplicada`,
  el último no repudiado; misma regla que LecturaFestivalesPublicados.VersionesRepudiadasAsync y V20261119_10):
    1. Copia a la cabecera lo que difiere: nombre, descripción, cobertura (nivel+departamento+municipio, juntos para
       respetar CK_Festivales_NivelCobertura), periodicidad y su detalle, contacto, redes, observaciones y el organizador.
    2. REEMPLAZA las prácticas musicales y los territorios sonoros de la cabecera (ModuloId='festivales') por los del perfil.
    3. Deja una fila de dbo.CambiosDeRegistro (Origen='migracion') por cada campo o lista cuyo valor cambió en la cabecera.
    4. Campos de EDICION del perfil (fechas, tipología, fuentes, estampilla, prácticas en texto, «Otra…») y las listas de
       expresiones, modalidades y tipos de ingreso: se copian a dbo.EdicionesFestival SOLO si existe la edición equivalente
       (la del año de FechaInicio del perfil; sin fecha, la única edición del Festival) y SOLO a campos o listas vacíos
       (decisión 6.2). Un dato de edición ya escrito nunca se pisa, y un texto que no cabe en la columna de la edición
       (las «Otra…» del perfil admiten 200 y las de la edición 120) no se trunca: queda solo en el respaldo.

  LO QUE LA LECTURA PUBLICA YA DECIDE, Y ESTE GUION RESPETA PARA NO CAMBIAR NINGUN JSON PUBLICO:
    · Descripcion, Periodicidad, PeriodicidadDetalle y CorreoContacto se leen como `perfil ?? cabecera`: un NULL en el perfil
      muestra el dato de la cabecera. Ahí el valor publicado es el de la cabecera, así que NO se pisa con NULL: se le da al
      perfil ese mismo valor para que ambos digan lo mismo (el perfil queda respaldado antes de tocarlo).
    · Teléfono, redes y enlace se leen del perfil tal cual (un vacío retirado a propósito sigue vacío): se copian tal cual.
    · Nombre, nivel, departamento y municipio se copian en bloque (el perfil no los trae nulos).
    · Observaciones de contacto y el organizador no los lee ninguna ruta pública: se copian tal cual.
  No cambia FechaActualizacion de la cabecera ni código alguno.

  RESPALDO. Antes de modificar, en el esquema `respaldo` (se crea si falta) y con el sufijo del guion, se guarda lo que se
  sobrescribe: respaldo.Festivales_V20261119_20 (cabecera antes), respaldo.PerfilesPublicosFestival_V20261119_20 (perfil
  antes, solo los que se alinean), respaldo.ListasDeRegistro_V20261119_20 (filas de prácticas y territorios de la cabecera
  que se reemplazan) y respaldo.EdicionesFestival_V20261119_20 (ediciones a las que se rellena algo). Va además del guion
  manual simus-database/scripts/respaldo_perfiles_publicos_festival.sql, que se toma ANTES en la base destino.

  COMPARACION. Vacío y NULL son lo mismo, se recorta, y la comparación distingue mayúsculas (BIN2) como el diagnóstico de
  PR-2 (.NET, ordinal). Un cambio solo de mayúsculas se corrige en la cabecera pero no deja fila de historial
  (CK_CambiosDeRegistro_Distinto compara con la colación de la base).

  IDEMPOTENTE. Tras la primera ejecución no queda divergencia, así que la segunda no escribe nada. Una sola transacción:
  si algo falla no queda nada a medias.

  REVERSA (manual): restaurar desde respaldo.Festivales_V20261119_20 las columnas de la cabecera por IdFestival; desde
  respaldo.ListasDeRegistro_V20261119_20 las filas de listas (borrando antes las de la cabecera de esos Festivales); desde
  respaldo.PerfilesPublicosFestival_V20261119_20 las columnas alineadas del perfil; y borrar las filas de CambiosDeRegistro
  con Origen='migracion' y Motivo «Cabecera igual a lo publicado (V20261119_20)».
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Festivales', N'Director') IS NOT NULL
BEGIN
  -- Sin perfiles (base nueva) no hay nada que migrar y tampoco se crea el esquema de respaldo.
  IF EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival)
  BEGIN
    BEGIN TRANSACTION;

    DECLARE @ahora datetime2(0) = SYSUTCDATETIME();

    /* 1) El perfil aprobado de cada Festival, con la cabecera al lado. e_* es el valor PUBLICADO de los cuatro campos que
          la lectura pública resuelve con `perfil ?? cabecera`. */
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
    SELECT p.IdPerfilPublicoFestival AS PerfilId, f.IdFestival AS FestivalId, f.OrganizacionPrincipalId,
           p.Nombre AS p_Nombre, f.NombreFestival AS f_Nombre,
           p.Descripcion AS p_Descripcion, f.Descripcion AS f_Descripcion,
           CASE WHEN p.Descripcion IS NULL THEN f.Descripcion ELSE p.Descripcion END AS e_Descripcion,
           p.NivelCobertura AS p_NivelCobertura, f.NivelCobertura AS f_NivelCobertura,
           p.CodigoDepartamento AS p_CodigoDepartamento, f.CodigoDepartamento AS f_CodigoDepartamento,
           p.CodigoMunicipio AS p_CodigoMunicipio, f.CodigoMunicipio AS f_CodigoMunicipio,
           p.Periodicidad AS p_Periodicidad, f.Periodicidad AS f_Periodicidad,
           CASE WHEN p.Periodicidad IS NULL THEN f.Periodicidad ELSE p.Periodicidad END AS e_Periodicidad,
           p.PeriodicidadDetalle AS p_PeriodicidadDetalle, f.PeriodicidadDetalle AS f_PeriodicidadDetalle,
           CASE WHEN p.PeriodicidadDetalle IS NULL THEN f.PeriodicidadDetalle ELSE p.PeriodicidadDetalle END AS e_PeriodicidadDetalle,
           p.CorreoContacto AS p_Correo, f.CorreoFestival AS f_Correo,
           CASE WHEN p.CorreoContacto IS NULL THEN f.CorreoFestival ELSE p.CorreoContacto END AS e_Correo,
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

    /* 2) Campos escalares que cambian en la cabecera (valor publicado frente a valor de la cabecera). */
    SELECT x.FestivalId, x.PerfilId, x.OrganizacionPrincipalId, c.CampoId, c.Etiqueta, c.Clase, c.Anterior, c.Nuevo
    INTO #Cambios
    FROM #Par x
    CROSS APPLY (VALUES
        (N'nombre',              N'Nombre',                               N'publico',  CONVERT(nvarchar(max), x.f_Nombre),              CONVERT(nvarchar(max), x.p_Nombre)),
        (N'descripcion',         N'Descripción',                          N'publico',  CONVERT(nvarchar(max), x.f_Descripcion),         CONVERT(nvarchar(max), x.e_Descripcion)),
        (N'nivelCobertura',      N'Nivel de cobertura',                   N'publico',  CONVERT(nvarchar(max), x.f_NivelCobertura),      CONVERT(nvarchar(max), x.p_NivelCobertura)),
        (N'codigoDepartamento',  N'Departamento',                         N'publico',  CONVERT(nvarchar(max), x.f_CodigoDepartamento),  CONVERT(nvarchar(max), x.p_CodigoDepartamento)),
        (N'codigoMunicipio',     N'Municipio',                            N'publico',  CONVERT(nvarchar(max), x.f_CodigoMunicipio),     CONVERT(nvarchar(max), x.p_CodigoMunicipio)),
        (N'periodicidad',        N'Periodicidad',                         N'publico',  CONVERT(nvarchar(max), x.f_Periodicidad),        CONVERT(nvarchar(max), x.e_Periodicidad)),
        (N'periodicidadDetalle', N'Detalle de la periodicidad',           N'publico',  CONVERT(nvarchar(max), x.f_PeriodicidadDetalle), CONVERT(nvarchar(max), x.e_PeriodicidadDetalle)),
        (N'correoContacto',      N'Correo de contacto',                   N'contacto', CONVERT(nvarchar(max), x.f_Correo),              CONVERT(nvarchar(max), x.e_Correo)),
        (N'telefonoContacto',    N'Teléfono de contacto',                 N'contacto', CONVERT(nvarchar(max), x.f_Telefono),            CONVERT(nvarchar(max), x.p_Telefono)),
        (N'instagram',           N'Instagram',                            N'publico',  CONVERT(nvarchar(max), x.f_Instagram),           CONVERT(nvarchar(max), x.p_Instagram)),
        (N'facebook',            N'Facebook',                             N'publico',  CONVERT(nvarchar(max), x.f_Facebook),            CONVERT(nvarchar(max), x.p_Facebook)),
        (N'sitioWeb',            N'Sitio web',                            N'publico',  CONVERT(nvarchar(max), x.f_SitioWeb),            CONVERT(nvarchar(max), x.p_SitioWeb)),
        (N'otroEnlace',          N'Otro enlace',                          N'publico',  CONVERT(nvarchar(max), x.f_OtroEnlace),          CONVERT(nvarchar(max), x.p_OtroEnlace)),
        (N'observacionesContacto', N'Observaciones de contacto',          N'publico',  CONVERT(nvarchar(max), x.f_Observaciones),       CONVERT(nvarchar(max), x.p_Observaciones)),
        (N'director',            N'Director o directora',                 N'publico',  CONVERT(nvarchar(max), x.f_Director),            CONVERT(nvarchar(max), x.p_Director)),
        (N'tipoOrganizadorId',   N'Tipo de organización',                 N'publico',  CONVERT(nvarchar(max), x.f_TipoOrganizadorId),   CONVERT(nvarchar(max), x.p_TipoOrganizadorId)),
        (N'otroTipoOrganizador', N'Otro tipo de organización',            N'publico',  CONVERT(nvarchar(max), x.f_OtroTipo),            CONVERT(nvarchar(max), x.p_OtroTipo)),
        (N'perteneceAOrganizacionColectiva', N'Pertenece a una organización colectiva', N'publico', CONVERT(nvarchar(max), x.f_Pertenece), CONVERT(nvarchar(max), x.p_Pertenece)),
        (N'nombreOrganizacionColectiva', N'Nombre de la organización colectiva', N'publico', CONVERT(nvarchar(max), x.f_NombreColectiva), CONVERT(nvarchar(max), x.p_NombreColectiva))
    ) AS c (CampoId, Etiqueta, Clase, Anterior, Nuevo)
    WHERE EXISTS (SELECT NULLIF(LTRIM(RTRIM(c.Nuevo)), N'') COLLATE Latin1_General_BIN2
                  EXCEPT SELECT NULLIF(LTRIM(RTRIM(c.Anterior)), N'') COLLATE Latin1_General_BIN2)
       OR EXISTS (SELECT NULLIF(LTRIM(RTRIM(c.Anterior)), N'') COLLATE Latin1_General_BIN2
                  EXCEPT SELECT NULLIF(LTRIM(RTRIM(c.Nuevo)), N'') COLLATE Latin1_General_BIN2);

    /* 3) Listas: prácticas y territorios del perfil frente a los de la cabecera. */
    SELECT x.FestivalId, x.PerfilId, N'practicasMusicales' AS CampoId, N'Prácticas musicales' AS Etiqueta,
           CONVERT(nvarchar(max), (SELECT STRING_AGG(CONVERT(nvarchar(20), c.IdPracticaMusical), N', ') WITHIN GROUP (ORDER BY c.IdPracticaMusical)
                                   FROM dbo.PracticasMusicalesDeRegistro c
                                   WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId))) AS Anterior,
           CONVERT(nvarchar(max), (SELECT STRING_AGG(CONVERT(nvarchar(20), h.IdPracticaMusical), N', ') WITHIN GROUP (ORDER BY h.IdPracticaMusical)
                                   FROM dbo.PracticasMusicalesDeRegistro h
                                   WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId))) AS Nuevo
    INTO #ListasCambian
    FROM #Par x
    WHERE EXISTS (SELECT h.IdPracticaMusical FROM dbo.PracticasMusicalesDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId)
                  EXCEPT SELECT c.IdPracticaMusical FROM dbo.PracticasMusicalesDeRegistro c WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId))
       OR EXISTS (SELECT c.IdPracticaMusical FROM dbo.PracticasMusicalesDeRegistro c WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId)
                  EXCEPT SELECT h.IdPracticaMusical FROM dbo.PracticasMusicalesDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId));

    INSERT INTO #ListasCambian (FestivalId, PerfilId, CampoId, Etiqueta, Anterior, Nuevo)
    SELECT x.FestivalId, x.PerfilId, N'territoriosSonoros', N'Territorios sonoros',
           CONVERT(nvarchar(max), (SELECT STRING_AGG(CONVERT(nvarchar(20), c.IdTerritorioSonoro), N', ') WITHIN GROUP (ORDER BY c.IdTerritorioSonoro)
                                   FROM dbo.TerritoriosSonorosDeRegistro c
                                   WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId))),
           CONVERT(nvarchar(max), (SELECT STRING_AGG(CONVERT(nvarchar(20), h.IdTerritorioSonoro), N', ') WITHIN GROUP (ORDER BY h.IdTerritorioSonoro)
                                   FROM dbo.TerritoriosSonorosDeRegistro h
                                   WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId)))
    FROM #Par x
    WHERE EXISTS (SELECT h.IdTerritorioSonoro FROM dbo.TerritoriosSonorosDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId)
                  EXCEPT SELECT c.IdTerritorioSonoro FROM dbo.TerritoriosSonorosDeRegistro c WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId))
       OR EXISTS (SELECT c.IdTerritorioSonoro FROM dbo.TerritoriosSonorosDeRegistro c WHERE c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), x.FestivalId)
                  EXCEPT SELECT h.IdTerritorioSonoro FROM dbo.TerritoriosSonorosDeRegistro h WHERE h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), x.PerfilId));

    /* 4) Edición equivalente de cada perfil: la del año de su FechaInicio; sin fecha, la única edición del Festival.
          Solo cuenta si es inequívoca (una sola). */
    SELECT x.FestivalId, x.PerfilId, e.IdEdicionFestival AS EdicionId
    INTO #Edicion
    FROM #Par x
    JOIN dbo.PerfilesPublicosFestival p ON p.IdPerfilPublicoFestival = x.PerfilId
    CROSS APPLY (
        SELECT MIN(ed.IdEdicionFestival) AS IdEdicionFestival, COUNT(*) AS Cuantas
        FROM dbo.EdicionesFestival ed
        WHERE ed.FestivalId = x.FestivalId
          AND ((p.FechaInicio IS NOT NULL AND ed.Anio = YEAR(p.FechaInicio))
               OR (p.FechaInicio IS NULL AND (SELECT COUNT(*) FROM dbo.EdicionesFestival t WHERE t.FestivalId = x.FestivalId) = 1))
    ) e
    WHERE e.Cuantas = 1;

    /* 5) RESPALDO de lo que se va a sobrescribir (antes de cualquier cambio). */
    IF SCHEMA_ID(N'respaldo') IS NULL EXEC (N'CREATE SCHEMA respaldo');

    IF OBJECT_ID(N'respaldo.Festivales_V20261119_20', N'U') IS NULL
        SELECT CAST(NULL AS datetime2(0)) AS FechaRespaldo, CAST(f.IdFestival AS int) AS IdFestival, f.NombreFestival, f.Descripcion, f.NivelCobertura,
               f.CodigoDepartamento, f.CodigoMunicipio, f.Periodicidad, f.PeriodicidadDetalle, f.CorreoFestival, f.TelefonoFestival,
               f.InstagramFestival, f.FacebookFestival, f.SitioWebFestival, f.OtroEnlaceFestival, f.ObservacionesContacto,
               f.Director, f.TipoOrganizadorId, f.OtroTipoOrganizador, f.PerteneceAOrganizacionColectiva,
               f.NombreOrganizacionColectiva, f.FechaActualizacion
        INTO respaldo.Festivales_V20261119_20 FROM dbo.Festivales f WHERE 1 = 0;
    IF OBJECT_ID(N'respaldo.PerfilesPublicosFestival_V20261119_20', N'U') IS NULL
        -- (la UNION ALL hace que la copia no herede la propiedad IDENTITY del id)
        SELECT CAST(NULL AS datetime2(0)) AS FechaRespaldo, u.* INTO respaldo.PerfilesPublicosFestival_V20261119_20
        FROM (SELECT * FROM dbo.PerfilesPublicosFestival UNION ALL SELECT * FROM dbo.PerfilesPublicosFestival) u WHERE 1 = 0;
    IF OBJECT_ID(N'respaldo.ListasDeRegistro_V20261119_20', N'U') IS NULL
        CREATE TABLE respaldo.ListasDeRegistro_V20261119_20
            (FechaRespaldo datetime2(0) NOT NULL, Lista nvarchar(40) NOT NULL, ModuloId nvarchar(40) NOT NULL,
             RegistroId nvarchar(64) NOT NULL, ValorId int NOT NULL, FechaCreacion datetime2(7) NULL);
    IF OBJECT_ID(N'respaldo.EdicionesFestival_V20261119_20', N'U') IS NULL
        SELECT CAST(NULL AS datetime2(0)) AS FechaRespaldo, u.* INTO respaldo.EdicionesFestival_V20261119_20
        FROM (SELECT * FROM dbo.EdicionesFestival UNION ALL SELECT * FROM dbo.EdicionesFestival) u WHERE 1 = 0;

    INSERT INTO respaldo.Festivales_V20261119_20
    SELECT @ahora, f.IdFestival, f.NombreFestival, f.Descripcion, f.NivelCobertura, f.CodigoDepartamento, f.CodigoMunicipio,
           f.Periodicidad, f.PeriodicidadDetalle, f.CorreoFestival, f.TelefonoFestival, f.InstagramFestival, f.FacebookFestival,
           f.SitioWebFestival, f.OtroEnlaceFestival, f.ObservacionesContacto, f.Director, f.TipoOrganizadorId,
           f.OtroTipoOrganizador, f.PerteneceAOrganizacionColectiva, f.NombreOrganizacionColectiva, f.FechaActualizacion
    FROM dbo.Festivales f
    WHERE f.IdFestival IN (SELECT FestivalId FROM #Cambios);

    -- Perfiles que se alinean con la cabecera (el publicado era el de la cabecera porque el del perfil era NULL).
    INSERT INTO respaldo.PerfilesPublicosFestival_V20261119_20
    SELECT @ahora, p.*
    FROM dbo.PerfilesPublicosFestival p
    JOIN #Par x ON x.PerfilId = p.IdPerfilPublicoFestival
    WHERE (p.Descripcion IS NULL AND x.f_Descripcion IS NOT NULL)
       OR (p.Periodicidad IS NULL AND x.f_Periodicidad IS NOT NULL)
       OR (p.PeriodicidadDetalle IS NULL AND x.f_PeriodicidadDetalle IS NOT NULL)
       OR (p.CorreoContacto IS NULL AND x.f_Correo IS NOT NULL);

    INSERT INTO respaldo.ListasDeRegistro_V20261119_20 (FechaRespaldo, Lista, ModuloId, RegistroId, ValorId, FechaCreacion)
    SELECT @ahora, N'practicasMusicales', c.ModuloId, c.RegistroId, c.IdPracticaMusical, c.FechaCreacion
    FROM dbo.PracticasMusicalesDeRegistro c
    JOIN #ListasCambian l ON l.CampoId = N'practicasMusicales' AND c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), l.FestivalId);
    INSERT INTO respaldo.ListasDeRegistro_V20261119_20 (FechaRespaldo, Lista, ModuloId, RegistroId, ValorId, FechaCreacion)
    SELECT @ahora, N'territoriosSonoros', c.ModuloId, c.RegistroId, c.IdTerritorioSonoro, c.FechaCreacion
    FROM dbo.TerritoriosSonorosDeRegistro c
    JOIN #ListasCambian l ON l.CampoId = N'territoriosSonoros' AND c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), l.FestivalId);

    INSERT INTO respaldo.EdicionesFestival_V20261119_20
    SELECT @ahora, e.* FROM dbo.EdicionesFestival e WHERE e.IdEdicionFestival IN (SELECT EdicionId FROM #Edicion);

    /* 6) Un guardado (IdGrupo) por Festival, para que sus filas de historial se lean juntas. */
    SELECT FestivalId, NEWID() AS IdGrupo
    INTO #Grupos
    FROM (SELECT FestivalId FROM #Cambios UNION SELECT FestivalId FROM #ListasCambian) u;

    /* 7) Escritura de la cabecera: cada columna cambia solo si su campo está en #Cambios. */
    UPDATE f
    SET f.NombreFestival = CASE WHEN k.nombre = 1 THEN x.p_Nombre ELSE f.NombreFestival END,
        f.Descripcion = CASE WHEN k.descripcion = 1 THEN x.e_Descripcion ELSE f.Descripcion END,
        f.NivelCobertura = CASE WHEN k.cobertura = 1 THEN x.p_NivelCobertura ELSE f.NivelCobertura END,
        f.CodigoDepartamento = CASE WHEN k.cobertura = 1 THEN x.p_CodigoDepartamento ELSE f.CodigoDepartamento END,
        f.CodigoMunicipio = CASE WHEN k.cobertura = 1 THEN x.p_CodigoMunicipio ELSE f.CodigoMunicipio END,
        f.Periodicidad = CASE WHEN k.periodicidad = 1 THEN x.e_Periodicidad ELSE f.Periodicidad END,
        f.PeriodicidadDetalle = CASE WHEN k.periodicidadDetalle = 1 THEN x.e_PeriodicidadDetalle ELSE f.PeriodicidadDetalle END,
        f.CorreoFestival = CASE WHEN k.correoContacto = 1 THEN x.e_Correo ELSE f.CorreoFestival END,
        f.TelefonoFestival = CASE WHEN k.telefonoContacto = 1 THEN x.p_Telefono ELSE f.TelefonoFestival END,
        f.InstagramFestival = CASE WHEN k.instagram = 1 THEN x.p_Instagram ELSE f.InstagramFestival END,
        f.FacebookFestival = CASE WHEN k.facebook = 1 THEN x.p_Facebook ELSE f.FacebookFestival END,
        f.SitioWebFestival = CASE WHEN k.sitioWeb = 1 THEN x.p_SitioWeb ELSE f.SitioWebFestival END,
        f.OtroEnlaceFestival = CASE WHEN k.otroEnlace = 1 THEN x.p_OtroEnlace ELSE f.OtroEnlaceFestival END,
        f.ObservacionesContacto = CASE WHEN k.observacionesContacto = 1 THEN x.p_Observaciones ELSE f.ObservacionesContacto END,
        f.Director = CASE WHEN k.director = 1 THEN x.p_Director ELSE f.Director END,
        f.TipoOrganizadorId = CASE WHEN k.tipoOrganizadorId = 1 THEN x.p_TipoOrganizadorId ELSE f.TipoOrganizadorId END,
        f.OtroTipoOrganizador = CASE WHEN k.otroTipoOrganizador = 1 THEN x.p_OtroTipo ELSE f.OtroTipoOrganizador END,
        f.PerteneceAOrganizacionColectiva = CASE WHEN k.perteneceAOrganizacionColectiva = 1 THEN x.p_Pertenece ELSE f.PerteneceAOrganizacionColectiva END,
        f.NombreOrganizacionColectiva = CASE WHEN k.nombreOrganizacionColectiva = 1 THEN x.p_NombreColectiva ELSE f.NombreOrganizacionColectiva END
    FROM dbo.Festivales f
    JOIN #Par x ON x.FestivalId = f.IdFestival
    CROSS APPLY (
        SELECT MAX(CASE WHEN c.CampoId = N'nombre' THEN 1 ELSE 0 END) AS nombre,
               MAX(CASE WHEN c.CampoId = N'descripcion' THEN 1 ELSE 0 END) AS descripcion,
               MAX(CASE WHEN c.CampoId IN (N'nivelCobertura', N'codigoDepartamento', N'codigoMunicipio') THEN 1 ELSE 0 END) AS cobertura,
               MAX(CASE WHEN c.CampoId = N'periodicidad' THEN 1 ELSE 0 END) AS periodicidad,
               MAX(CASE WHEN c.CampoId = N'periodicidadDetalle' THEN 1 ELSE 0 END) AS periodicidadDetalle,
               MAX(CASE WHEN c.CampoId = N'correoContacto' THEN 1 ELSE 0 END) AS correoContacto,
               MAX(CASE WHEN c.CampoId = N'telefonoContacto' THEN 1 ELSE 0 END) AS telefonoContacto,
               MAX(CASE WHEN c.CampoId = N'instagram' THEN 1 ELSE 0 END) AS instagram,
               MAX(CASE WHEN c.CampoId = N'facebook' THEN 1 ELSE 0 END) AS facebook,
               MAX(CASE WHEN c.CampoId = N'sitioWeb' THEN 1 ELSE 0 END) AS sitioWeb,
               MAX(CASE WHEN c.CampoId = N'otroEnlace' THEN 1 ELSE 0 END) AS otroEnlace,
               MAX(CASE WHEN c.CampoId = N'observacionesContacto' THEN 1 ELSE 0 END) AS observacionesContacto,
               MAX(CASE WHEN c.CampoId = N'director' THEN 1 ELSE 0 END) AS director,
               MAX(CASE WHEN c.CampoId = N'tipoOrganizadorId' THEN 1 ELSE 0 END) AS tipoOrganizadorId,
               MAX(CASE WHEN c.CampoId = N'otroTipoOrganizador' THEN 1 ELSE 0 END) AS otroTipoOrganizador,
               MAX(CASE WHEN c.CampoId = N'perteneceAOrganizacionColectiva' THEN 1 ELSE 0 END) AS perteneceAOrganizacionColectiva,
               MAX(CASE WHEN c.CampoId = N'nombreOrganizacionColectiva' THEN 1 ELSE 0 END) AS nombreOrganizacionColectiva
        FROM #Cambios c WHERE c.FestivalId = f.IdFestival
    ) k
    WHERE f.IdFestival IN (SELECT FestivalId FROM #Cambios);

    -- Alineación del perfil: donde lo publicado era el dato de la cabecera (perfil NULL), el perfil pasa a decir lo mismo.
    UPDATE p
    SET p.Descripcion = CASE WHEN p.Descripcion IS NULL THEN x.f_Descripcion ELSE p.Descripcion END,
        p.Periodicidad = CASE WHEN p.Periodicidad IS NULL THEN x.f_Periodicidad ELSE p.Periodicidad END,
        p.PeriodicidadDetalle = CASE WHEN p.PeriodicidadDetalle IS NULL THEN x.f_PeriodicidadDetalle ELSE p.PeriodicidadDetalle END,
        p.CorreoContacto = CASE WHEN p.CorreoContacto IS NULL THEN x.f_Correo ELSE p.CorreoContacto END
    FROM dbo.PerfilesPublicosFestival p
    JOIN #Par x ON x.PerfilId = p.IdPerfilPublicoFestival
    WHERE (p.Descripcion IS NULL AND x.f_Descripcion IS NOT NULL)
       OR (p.Periodicidad IS NULL AND x.f_Periodicidad IS NOT NULL)
       OR (p.PeriodicidadDetalle IS NULL AND x.f_PeriodicidadDetalle IS NOT NULL)
       OR (p.CorreoContacto IS NULL AND x.f_Correo IS NOT NULL);

    /* 8) Listas: la cabecera queda con las del perfil aprobado. */
    DELETE c FROM dbo.PracticasMusicalesDeRegistro c
    JOIN #ListasCambian l ON l.CampoId = N'practicasMusicales' AND c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), l.FestivalId);
    INSERT INTO dbo.PracticasMusicalesDeRegistro (ModuloId, RegistroId, IdPracticaMusical, FechaCreacion)
    SELECT N'festivales', CONVERT(nvarchar(64), l.FestivalId), h.IdPracticaMusical, @ahora
    FROM #ListasCambian l
    JOIN dbo.PracticasMusicalesDeRegistro h ON h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), l.PerfilId)
    WHERE l.CampoId = N'practicasMusicales';

    DELETE c FROM dbo.TerritoriosSonorosDeRegistro c
    JOIN #ListasCambian l ON l.CampoId = N'territoriosSonoros' AND c.ModuloId = N'festivales' AND c.RegistroId = CONVERT(nvarchar(64), l.FestivalId);
    INSERT INTO dbo.TerritoriosSonorosDeRegistro (ModuloId, RegistroId, IdTerritorioSonoro, FechaCreacion)
    SELECT N'festivales', CONVERT(nvarchar(64), l.FestivalId), h.IdTerritorioSonoro, @ahora
    FROM #ListasCambian l
    JOIN dbo.TerritoriosSonorosDeRegistro h ON h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), l.PerfilId)
    WHERE l.CampoId = N'territoriosSonoros';

    /* 9) Historia de lo que cambió en la cabecera. */
    INSERT INTO dbo.CambiosDeRegistro
        (ModuloId, RegistroId, OrganizacionId, IdGrupo, CampoId, CampoEtiqueta, ClaseDato,
         ValorAnterior, ValorNuevo, Origen, PerfilPublicoFestivalId, Motivo, Fecha)
    SELECT N'festivales', CONVERT(nvarchar(64), k.FestivalId), k.OrganizacionPrincipalId, g.IdGrupo, k.CampoId, k.Etiqueta, k.Clase,
           NULLIF(k.Anterior, N''), NULLIF(k.Nuevo, N''), N'migracion', k.PerfilId,
           N'Cabecera igual a lo publicado (V20261119_20)', @ahora
    FROM #Cambios k
    JOIN #Grupos g ON g.FestivalId = k.FestivalId
    -- CK_CambiosDeRegistro_Distinto: una fila no puede traer el mismo valor en los dos lados (colación de la base).
    WHERE NULLIF(k.Anterior, N'') IS NULL OR NULLIF(k.Nuevo, N'') IS NULL OR k.Anterior <> k.Nuevo
    UNION ALL
    SELECT N'festivales', CONVERT(nvarchar(64), l.FestivalId), f.OrganizacionPrincipalId, g.IdGrupo, l.CampoId, l.Etiqueta, N'publico',
           l.Anterior, l.Nuevo, N'migracion', l.PerfilId, N'Cabecera igual a lo publicado (V20261119_20)', @ahora
    FROM #ListasCambian l
    JOIN #Grupos g ON g.FestivalId = l.FestivalId
    JOIN dbo.Festivales f ON f.IdFestival = l.FestivalId;

    /* 10) Datos de edición: SOLO a la edición equivalente y SOLO a lo que está vacío. */
    UPDATE e
    SET e.FechaInicio = CASE WHEN fe.Ok = 1 THEN fe.Inicio ELSE e.FechaInicio END,
        e.FechaFin = CASE WHEN fe.Ok = 1 THEN fe.Fin ELSE e.FechaFin END,
        e.TipologiaFestivalId = ISNULL(e.TipologiaFestivalId, p.TipologiaFestivalId),
        e.OtraTipologia = CASE WHEN NULLIF(LTRIM(RTRIM(e.OtraTipologia)), N'') IS NULL AND LEN(p.OtraTipologia) <= 120 THEN p.OtraTipologia ELSE e.OtraTipologia END,
        e.FuenteFinanciacionPrimariaId = ISNULL(e.FuenteFinanciacionPrimariaId, p.FuenteFinanciacionPrimariaId),
        e.OtraFuenteFinanciacionPrimaria = CASE WHEN NULLIF(LTRIM(RTRIM(e.OtraFuenteFinanciacionPrimaria)), N'') IS NULL AND LEN(p.OtraFuenteFinanciacionPrimaria) <= 120 THEN p.OtraFuenteFinanciacionPrimaria ELSE e.OtraFuenteFinanciacionPrimaria END,
        e.FuenteFinanciacionSecundariaId = ISNULL(e.FuenteFinanciacionSecundariaId, p.FuenteFinanciacionSecundariaId),
        e.OtraFuenteFinanciacionSecundaria = CASE WHEN NULLIF(LTRIM(RTRIM(e.OtraFuenteFinanciacionSecundaria)), N'') IS NULL AND LEN(p.OtraFuenteFinanciacionSecundaria) <= 120 THEN p.OtraFuenteFinanciacionSecundaria ELSE e.OtraFuenteFinanciacionSecundaria END,
        e.UsaEstampillaProcultura = ISNULL(e.UsaEstampillaProcultura, p.UsaEstampillaProcultura),
        e.PracticasMusicalesQueCongrega = CASE WHEN NULLIF(LTRIM(RTRIM(e.PracticasMusicalesQueCongrega)), N'') IS NULL AND LEN(p.PracticasMusicalesQueCongrega) <= 500 THEN p.PracticasMusicalesQueCongrega ELSE e.PracticasMusicalesQueCongrega END,
        e.OtraModalidadParticipacion = CASE WHEN NULLIF(LTRIM(RTRIM(e.OtraModalidadParticipacion)), N'') IS NULL AND LEN(p.OtraModalidadParticipacion) <= 120 THEN p.OtraModalidadParticipacion ELSE e.OtraModalidadParticipacion END,
        e.OtraExpresionArtistica = CASE WHEN NULLIF(LTRIM(RTRIM(e.OtraExpresionArtistica)), N'') IS NULL AND LEN(p.OtraExpresionArtistica) <= 120 THEN p.OtraExpresionArtistica ELSE e.OtraExpresionArtistica END
    FROM dbo.EdicionesFestival e
    JOIN #Edicion d ON d.EdicionId = e.IdEdicionFestival
    JOIN dbo.PerfilesPublicosFestival p ON p.IdPerfilPublicoFestival = d.PerfilId
    CROSS APPLY (
        -- Las fechas se rellenan solo si el par resultante respeta CK_EdicionesFestival_Fechas.
        SELECT ISNULL(e.FechaInicio, p.FechaInicio) AS Inicio, ISNULL(e.FechaFin, p.FechaFin) AS Fin,
               CASE WHEN ISNULL(e.FechaInicio, p.FechaInicio) IS NULL OR ISNULL(e.FechaFin, p.FechaFin) IS NULL
                      OR ISNULL(e.FechaFin, p.FechaFin) >= ISNULL(e.FechaInicio, p.FechaInicio) THEN 1 ELSE 0 END AS Ok
    ) fe;

    -- Listas de la edición: solo si la edición no tiene ninguna de ese tipo (nunca se mezcla con lo que ya eligió).
    INSERT INTO dbo.ExpresionesArtisticasDeRegistro (ModuloId, RegistroId, IdExpresionArtistica, FechaCreacion)
    SELECT N'ediciones-festival', CONVERT(nvarchar(64), d.EdicionId), h.IdExpresionArtistica, @ahora
    FROM #Edicion d
    JOIN dbo.ExpresionesArtisticasDeRegistro h ON h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), d.PerfilId)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ExpresionesArtisticasDeRegistro y WHERE y.ModuloId = N'ediciones-festival' AND y.RegistroId = CONVERT(nvarchar(64), d.EdicionId));
    INSERT INTO dbo.ModalidadesParticipacionDeRegistro (ModuloId, RegistroId, IdModalidadParticipacion, FechaCreacion)
    SELECT N'ediciones-festival', CONVERT(nvarchar(64), d.EdicionId), h.IdModalidadParticipacion, @ahora
    FROM #Edicion d
    JOIN dbo.ModalidadesParticipacionDeRegistro h ON h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), d.PerfilId)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ModalidadesParticipacionDeRegistro y WHERE y.ModuloId = N'ediciones-festival' AND y.RegistroId = CONVERT(nvarchar(64), d.EdicionId));
    INSERT INTO dbo.TiposIngresoDeRegistro (ModuloId, RegistroId, IdTipoIngreso, FechaCreacion)
    SELECT N'ediciones-festival', CONVERT(nvarchar(64), d.EdicionId), h.IdTipoIngreso, @ahora
    FROM #Edicion d
    JOIN dbo.TiposIngresoDeRegistro h ON h.ModuloId = N'perfiles-publicos-festival' AND h.RegistroId = CONVERT(nvarchar(64), d.PerfilId)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.TiposIngresoDeRegistro y WHERE y.ModuloId = N'ediciones-festival' AND y.RegistroId = CONVERT(nvarchar(64), d.EdicionId));

    DROP TABLE #Edicion;
    DROP TABLE #ListasCambian;
    DROP TABLE #Grupos;
    DROP TABLE #Cambios;
    DROP TABLE #Par;

    COMMIT TRANSACTION;
  END;
END;
