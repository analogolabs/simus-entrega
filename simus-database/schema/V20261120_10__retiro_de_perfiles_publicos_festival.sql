/*
  SIMUS · Retiro de dbo.PerfilesPublicosFestival (PR-8, última fase del retiro del perfil público del Festival, #266 / 

  QUÉ ES. LA MIGRACIÓN DESTRUCTIVA. Desde el PR-4 la lectura pública sale de la cabecera dbo.Festivales; desde el PR-5 las
  propuestas, las notas de revisión y las propuestas en vuelo se apoyan en ella; desde el PR-6 nada escribe el perfil; el PR-7
  sacó el concepto de las siembras, los contratos y la web. Esta migración borra lo que queda: la tabla, sus filas hijas, sus
  restricciones, índices y claves, y el módulo `perfiles-publicos-festival` de las restricciones CHECK de las ocho tablas de
  relación del registro.

  NO SE APLICA SIN RESPALDO. Antes de tocar nada, y dentro de la misma transacción, exige (THROW si falla; con XACT_ABORT no
  queda nada a medias):
    1. RESPALDO: existe, en el esquema `respaldo`, la copia hecha con simus-database/scripts/respaldo_perfiles_publicos_festival.sql
       (PerfilesPublicosFestival_AAAAMMDD y las ocho hijas del mismo día), cada copia tiene el MISMO conteo que su origen y cada
       Id de perfil de la tabla está en la copia. Si la tabla y sus hijas están vacías (base nueva) no hay nada que respaldar.
    2. SIN DIVERGENCIAS: 0 Festivales con el perfil vigente aprobado distinto de la cabecera, campo por campo y en las dos listas
       (el mismo cálculo de simus-database/scripts/diagnostico_perfil_vs_cabecera_festivales.sql). Si la cabecera difiere, el
       perfil tenía datos que se perderían.
    3. SIN PROPUESTAS VIVAS que apunten a un perfil: 0 propuestas de Festival en borrador, en_revision o ajustes_solicitados con
       SubregistroId numérico.
    4. SIN NOTAS POR REESCRIBIR: 0 notas de revisión con CampoId `perfilPublico.%` o de ámbito `subregistro` de un Festival, y 0
       campos de propuesta con CampoId `perfilPublico.%`.
    5. ARCHIVOS CON DESTINO: todo archivo ligado a un perfil (ArchivosDeRegistro con ModuloId = perfiles-publicos-festival) tiene
       un perfil que existe y un Festival al que reapuntarse.

  QUÉ HACE, en este orden:
    a) Reapunta los archivos de los perfiles al Festival (ModuloId = festivales, RegistroId = el Festival de origen; el orden
       de visualización continúa tras los que el Festival ya tenga, para respetar UQ_ArchivosDeRegistro). Así el Banco de archivos
       los sigue contando como en uso y la purga no los borra.
    b) Borra las filas hijas con ModuloId = perfiles-publicos-festival (prácticas, territorios, expresiones, modalidades, tipos
       de ingreso, localizaciones, entidades aliadas; los archivos ya se reapuntaron). Quedan en el respaldo.
    c) Reescribe los CHECK de ModuloId de las ocho tablas sin el módulo retirado (se leen de la base, no se adivinan).
    d) Suelta las claves foráneas de la tabla y la elimina (con sus índices, UQ, PK, CK y DEFAULT).
    e) Comprueba que no quedó la tabla ni una fila con el módulo.

  LO QUE SE CONSERVA, A PROPÓSITO, SIN CLAVE FORÁNEA: son referencias LÓGICAS de historia, ya sin objeto al que apuntar.
    · dbo.CambiosDeRegistro.PerfilPublicoFestivalId (la versión del perfil que originó cada cambio histórico).
    · dbo.PropuestasDeCambio.SubregistroId y SubregistroResultanteId (en las propuestas cerradas, historia; en las vivas,
      SubregistroResultanteId es la marca del perfil-borrador que PR-6 ya dejó de crear).
    Ninguna consulta de la API las resuelve contra la tabla; con el respaldo se puede reconstruir el vínculo.

  IDEMPOTENTE: si la tabla ya no existe, no hace nada. UNA SOLA TRANSACCIÓN.

  REVERSA: simus-database/scripts/reversa_retiro_perfiles_publicos_festival.sql (fuera de schema/): recrea la tabla con su DDL
  final, restablece los CHECK y repuebla la tabla y sus hijas desde el respaldo.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U') IS NOT NULL
BEGIN
    BEGIN TRANSACTION;

    DECLARE @modulo nvarchar(60) = N'perfiles-publicos-festival';
    DECLARE @sql nvarchar(max), @tabla sysname, @aviso nvarchar(2000);

    -- Las ocho tablas hijas genéricas del registro.
    DECLARE @hijas TABLE (Tabla sysname PRIMARY KEY);
    INSERT INTO @hijas (Tabla) VALUES
        (N'PracticasMusicalesDeRegistro'), (N'TerritoriosSonorosDeRegistro'), (N'ExpresionesArtisticasDeRegistro'),
        (N'ModalidadesParticipacionDeRegistro'), (N'TiposIngresoDeRegistro'), (N'LocalizacionesDeRegistro'),
        (N'EntidadesAliadasDeRegistro'), (N'ArchivosDeRegistro');

    -- ---------------------------------------------------------------------------------------------
    -- Qué se perdería si no se respalda.
    -- ---------------------------------------------------------------------------------------------
    DECLARE @filasPerfil bigint = (SELECT COUNT_BIG(*) FROM dbo.PerfilesPublicosFestival);
    DECLARE @filasHijas bigint = 0, @n bigint;
    DECLARE hijas CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla FROM @hijas;
    OPEN hijas;
    FETCH NEXT FROM hijas INTO @tabla;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'SELECT @n = COUNT_BIG(*) FROM dbo.' + QUOTENAME(@tabla) + N' WHERE ModuloId = @m;';
        EXEC sys.sp_executesql @sql, N'@m nvarchar(60), @n bigint OUTPUT', @m = @modulo, @n = @n OUTPUT;
        SET @filasHijas += @n;
        FETCH NEXT FROM hijas INTO @tabla;
    END;
    CLOSE hijas;
    DEALLOCATE hijas;

    -- ---------------------------------------------------------------------------------------------
    -- 1. RESPALDO: la copia más reciente que tenga la tabla y sus ocho hijas, con el mismo conteo.
    -- ---------------------------------------------------------------------------------------------
    IF @filasPerfil > 0 OR @filasHijas > 0
    BEGIN
        DECLARE @sufijo nchar(8) = (
            SELECT TOP (1) RIGHT(t.name, 8)
              FROM sys.tables t
             WHERE t.schema_id = SCHEMA_ID(N'respaldo')
               AND t.name LIKE N'PerfilesPublicosFestival[_][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
               AND (SELECT COUNT(*) FROM @hijas h
                     WHERE OBJECT_ID(N'respaldo.' + QUOTENAME(h.Tabla + N'_' + RIGHT(t.name, 8)), N'U') IS NOT NULL) = 8
             ORDER BY RIGHT(t.name, 8) DESC);

        IF @sufijo IS NULL
            THROW 50081, N'PR-8 abortado: no hay respaldo. Ejecute simus-database/scripts/respaldo_perfiles_publicos_festival.sql (respaldo.PerfilesPublicosFestival_AAAAMMDD y sus ocho hijas) antes de aplicar esta migración.', 1;

        DECLARE @copia nvarchar(300) = N'respaldo.' + QUOTENAME(N'PerfilesPublicosFestival_' + @sufijo);
        DECLARE @enCopia bigint, @sinCopiar bigint;
        SET @sql = N'SELECT @a = COUNT_BIG(*), @b = (SELECT COUNT_BIG(*) FROM dbo.PerfilesPublicosFestival p WHERE NOT EXISTS (SELECT 1 FROM '
                 + @copia + N' c WHERE c.IdPerfilPublicoFestival = p.IdPerfilPublicoFestival)) FROM ' + @copia + N';';
        EXEC sys.sp_executesql @sql, N'@a bigint OUTPUT, @b bigint OUTPUT', @a = @enCopia OUTPUT, @b = @sinCopiar OUTPUT;
        IF @enCopia <> @filasPerfil OR @sinCopiar <> 0
        BEGIN
            SET @aviso = CONCAT(N'PR-8 abortado: el respaldo ', @copia, N' tiene ', @enCopia, N' filas y la tabla ', @filasPerfil,
                                N' (sin copiar: ', @sinCopiar, N'). Repita el respaldo.');
            THROW 50082, @aviso, 1;
        END;

        DECLARE hijas CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla FROM @hijas;
        OPEN hijas;
        FETCH NEXT FROM hijas INTO @tabla;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @enHija bigint, @enCopiaHija bigint;
            SET @sql = N'SELECT @a = (SELECT COUNT_BIG(*) FROM dbo.' + QUOTENAME(@tabla) + N' WHERE ModuloId = @m), @b = (SELECT COUNT_BIG(*) FROM respaldo.'
                     + QUOTENAME(@tabla + N'_' + @sufijo) + N');';
            EXEC sys.sp_executesql @sql, N'@m nvarchar(60), @a bigint OUTPUT, @b bigint OUTPUT', @m = @modulo, @a = @enHija OUTPUT, @b = @enCopiaHija OUTPUT;
            IF @enHija <> @enCopiaHija
            BEGIN
                SET @aviso = CONCAT(N'PR-8 abortado: el respaldo de ', @tabla, N' tiene ', @enCopiaHija, N' filas y hay ', @enHija, N' en la base. Repita el respaldo.');
                THROW 50083, @aviso, 1;
            END;
            FETCH NEXT FROM hijas INTO @tabla;
        END;
        CLOSE hijas;
        DEALLOCATE hijas;
    END;

    -- ---------------------------------------------------------------------------------------------
    -- 2. SIN DIVERGENCIAS perfil vs. cabecera (mismo cálculo que scripts/diagnostico_perfil_vs_cabecera_festivales.sql).
    -- ---------------------------------------------------------------------------------------------
    IF @filasPerfil > 0
    BEGIN
        IF OBJECT_ID(N'tempdb..#Par') IS NOT NULL DROP TABLE #Par;
        IF OBJECT_ID(N'tempdb..#Resumen') IS NOT NULL DROP TABLE #Resumen;
        CREATE TABLE #Resumen (Campo nvarchar(80) NOT NULL, Festivales int NOT NULL);

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


        INSERT INTO #Resumen (Campo, Festivales)
            SELECT N'festivales con perfil aprobado', COUNT(*) FROM #Par
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

        DECLARE @divergencias int = (SELECT ISNULL(SUM(Festivales), 0) FROM #Resumen WHERE Campo <> N'festivales con perfil aprobado');
        IF @divergencias > 0
        BEGIN
            SET @aviso = CONCAT(N'PR-8 abortado: ', @divergencias, N' divergencia(s) entre el perfil vigente aprobado y la cabecera (',
                (SELECT STRING_AGG(CONCAT(Campo, N'=', Festivales), N', ') FROM #Resumen WHERE Campo <> N'festivales con perfil aprobado' AND Festivales > 0),
                N'). Corrija la cabecera o apruebe el cambio antes de retirar la tabla.');
            THROW 50084, @aviso, 1;
        END;
        DROP TABLE #Par;
        DROP TABLE #Resumen;
    END;

    -- ---------------------------------------------------------------------------------------------
    -- 3 y 4. SIN PROPUESTAS VIVAS NI NOTAS apoyadas en un perfil.
    -- ---------------------------------------------------------------------------------------------
    IF OBJECT_ID(N'dbo.PropuestasDeCambio', N'U') IS NOT NULL
       AND EXISTS (SELECT 1 FROM dbo.PropuestasDeCambio
                    WHERE ModuloId = N'festivales' AND TRY_CONVERT(int, SubregistroId) IS NOT NULL
                      AND Estado IN (N'borrador', N'en_revision', N'ajustes_solicitados'))
        THROW 50085, N'PR-8 abortado: hay propuestas de Festival en vuelo (borrador, en_revision o ajustes_solicitados) con SubregistroId numerico. Aplique V20261119_30 antes.', 1;

    IF (OBJECT_ID(N'dbo.RevisionesDeRegistroObservaciones', N'U') IS NOT NULL
        AND OBJECT_ID(N'dbo.RevisionesDeRegistro', N'U') IS NOT NULL
        AND EXISTS (SELECT 1 FROM dbo.RevisionesDeRegistroObservaciones o
                    JOIN dbo.RevisionesDeRegistro r ON r.IdRevision = o.IdRevision
                    WHERE o.CampoId LIKE N'perfilPublico.%' OR (r.ModuloId = N'festivales' AND o.Ambito = N'subregistro')))
       OR (OBJECT_ID(N'dbo.PropuestasDeCambioCampos', N'U') IS NOT NULL
           AND EXISTS (SELECT 1 FROM dbo.PropuestasDeCambioCampos WHERE CampoId LIKE N'perfilPublico.%'))
        THROW 50086, N'PR-8 abortado: quedan notas de revision o campos de propuesta con CampoId perfilPublico.% o de ambito subregistro. Aplique V20261119_30 antes.', 1;

    -- ---------------------------------------------------------------------------------------------
    -- 5. ARCHIVOS CON DESTINO: cada archivo de un perfil tiene perfil y Festival.
    -- ---------------------------------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM dbo.ArchivosDeRegistro a
                WHERE a.ModuloId = @modulo
                  AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosFestival p
                                   JOIN dbo.Festivales f ON f.IdFestival = p.FestivalOrigenId
                                  WHERE CONVERT(nvarchar(64), p.IdPerfilPublicoFestival) = a.RegistroId))
        THROW 50087, N'PR-8 abortado: hay archivos ligados a un perfil que no existe o cuyo Festival no existe; no tienen a donde reapuntarse.', 1;

    -- =============================================================================================
    -- A PARTIR DE AQUÍ SE MODIFICA. Todas las precondiciones pasaron.
    -- =============================================================================================

    -- a) Reapuntar los archivos de los perfiles al Festival.
    ;WITH Mover AS (
        SELECT a.IdArchivoDeRegistro,
               CONVERT(nvarchar(64), p.FestivalOrigenId) AS NuevoRegistro,
               ROW_NUMBER() OVER (PARTITION BY p.FestivalOrigenId, a.RolArchivo ORDER BY p.NumeroPublicacion, a.OrdenVisualizacion, a.IdArchivoDeRegistro) AS Posicion
          FROM dbo.ArchivosDeRegistro a
          JOIN dbo.PerfilesPublicosFestival p ON CONVERT(nvarchar(64), p.IdPerfilPublicoFestival) = a.RegistroId
         WHERE a.ModuloId = @modulo)
    UPDATE a
       SET a.ModuloId = N'festivales',
           a.RegistroId = m.NuevoRegistro,
           a.OrdenVisualizacion = m.Posicion + ISNULL((SELECT MAX(x.OrdenVisualizacion) FROM dbo.ArchivosDeRegistro x
                                                        WHERE x.ModuloId = N'festivales' AND x.RegistroId = m.NuevoRegistro AND x.RolArchivo = a.RolArchivo), 0)
      FROM dbo.ArchivosDeRegistro a
      JOIN Mover m ON m.IdArchivoDeRegistro = a.IdArchivoDeRegistro;

    -- b) Borrar las filas hijas que quedan con el módulo retirado.
    DECLARE hijas CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla FROM @hijas;
    OPEN hijas;
    FETCH NEXT FROM hijas INTO @tabla;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'DELETE FROM dbo.' + QUOTENAME(@tabla) + N' WHERE ModuloId = @m;';
        EXEC sys.sp_executesql @sql, N'@m nvarchar(60)', @m = @modulo;
        FETCH NEXT FROM hijas INTO @tabla;
    END;
    CLOSE hijas;
    DEALLOCATE hijas;

    -- c) Reescribir los CHECK de ModuloId sin el módulo retirado. Se leen de la base.
    DECLARE @restriccion sysname, @definicion nvarchar(max), @nueva nvarchar(max);
    IF OBJECT_ID(N'tempdb..#Checks') IS NOT NULL DROP TABLE #Checks;
    SELECT QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) AS Tabla, cc.name AS Restriccion, cc.definition AS Definicion
      INTO #Checks
      FROM sys.check_constraints cc
      JOIN sys.tables t ON t.object_id = cc.parent_object_id
     WHERE cc.definition LIKE N'%' + @modulo + N'%';

    DECLARE cks CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla, Restriccion, Definicion FROM #Checks;
    OPEN cks;
    FETCH NEXT FROM cks INTO @tabla, @restriccion, @definicion;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @nueva = REPLACE(REPLACE(@definicion,
            N'[ModuloId]=N''' + @modulo + N''' OR ', N''),
            N' OR [ModuloId]=N''' + @modulo + N'''', N'');
        IF @nueva LIKE N'%' + @modulo + N'%'
        BEGIN
            SET @aviso = CONCAT(N'PR-8 abortado: no se pudo reescribir ', @restriccion, N' sin el módulo retirado: ', @definicion);
            THROW 50088, @aviso, 1;
        END;
        SET @sql = N'ALTER TABLE ' + @tabla + N' DROP CONSTRAINT ' + QUOTENAME(@restriccion) + N';'
                 + N' ALTER TABLE ' + @tabla + N' WITH CHECK ADD CONSTRAINT ' + QUOTENAME(@restriccion) + N' CHECK ' + @nueva + N';';
        EXEC sys.sp_executesql @sql;
        FETCH NEXT FROM cks INTO @tabla, @restriccion, @definicion;
    END;
    CLOSE cks;
    DEALLOCATE cks;
    DROP TABLE #Checks;

    -- d) Soltar las claves foráneas que nombran a la tabla (en cualquier sentido) y eliminarla.
    DECLARE @claves nvarchar(max) = (
        SELECT STRING_AGG(CAST(N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(o.schema_id)) + N'.' + QUOTENAME(o.name)
                               + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) AS nvarchar(max)), N';')
          FROM sys.foreign_keys fk
          JOIN sys.objects o ON o.object_id = fk.parent_object_id
         WHERE fk.parent_object_id = OBJECT_ID(N'dbo.PerfilesPublicosFestival')
            OR fk.referenced_object_id = OBJECT_ID(N'dbo.PerfilesPublicosFestival'));
    IF @claves IS NOT NULL EXEC sys.sp_executesql @claves;
    DROP TABLE dbo.PerfilesPublicosFestival;

    -- e) Comprobación final.
    IF OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U') IS NOT NULL
        THROW 50089, N'PR-8: la tabla sigue existiendo tras el retiro.', 1;
    DECLARE hijas CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla FROM @hijas;
    OPEN hijas;
    FETCH NEXT FROM hijas INTO @tabla;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @sql = N'SELECT @n = COUNT_BIG(*) FROM dbo.' + QUOTENAME(@tabla) + N' WHERE ModuloId = @m;';
        EXEC sys.sp_executesql @sql, N'@m nvarchar(60), @n bigint OUTPUT', @m = @modulo, @n = @n OUTPUT;
        IF @n <> 0
        BEGIN
            SET @aviso = CONCAT(N'PR-8: quedan ', @n, N' filas con el módulo retirado en ', @tabla, N'.');
            THROW 50090, @aviso, 1;
        END;
        FETCH NEXT FROM hijas INTO @tabla;
    END;
    CLOSE hijas;
    DEALLOCATE hijas;

    COMMIT TRANSACTION;
END;
