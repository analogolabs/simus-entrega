/*
  SIMUS · Las notas de revisión y las propuestas en vuelo de un Festival dejan de depender del perfil público
  (retiro de PerfilesPublicosFestival, PR-5b, docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.11)

  QUE ES. El backfill de datos que acompaña a PR-5a (las propuestas de cambio de Festival se escriben sobre la cabecera
  dbo.Festivales). Deja los datos «vivos» que aún apuntaban a una VERSION del perfil apuntando a la cabecera:

    A) NOTAS DE REVISION de un Festival (dbo.RevisionesDeRegistroObservaciones con ModuloId='festivales' en su revisión):
       las que cuelgan de un perfil (Ambito='subregistro', SubregistroId = id del perfil, CampoId 'perfilPublico.<campo>')
       pasan a la ficha del Festival: Ambito='principal', SubregistroId NULL, CampoId 'festival.<campo>' (el mismo
       identificador que escribe hoy la pantalla). Una nota de subregistro con otro prefijo conserva su CampoId.
       COLISIONES (misma revisión y mismo campo ya escrito en la ficha): gana la nota que ya estaba en la ficha; entre varias
       notas de perfil sobre el mismo campo gana la del perfil más reciente. Las demás se descartan, y quedan respaldadas.

    B) CAMPOS DE PROPUESTA con CampoId 'perfilPublico.<campo>' (dbo.PropuestasDeCambioCampos): pierden el prefijo (la
       cabecera usa el identificador a secas, igual que Mercados). Si la propuesta ya tiene ese campo sin prefijo, se descarta
       el prefijado (respaldado).

    C) PROPUESTAS EN VUELO de Festival (borrador, en_revision, ajustes_solicitados) con SubregistroId (el perfil de origen):
       - A cada campo propuesto con ValorAnterior vacío se le vuelca el valor que tenía el perfil de origen (escalares y las
         dos listas, como «3,5,9»): el «antes» de la propuesta deja de leerse del perfil. PR-5a valida «sigue vigente» por
         concurrencia optimista comparando ese «antes» con la cabecera; un NULL se leería como «estaba vacío» y daría un 409
         falso en una propuesta cuyo perfil de origen sí tenía dato.
       - SubregistroId pasa a NULL (la propuesta ya no nace de una versión del perfil).
       SubregistroResultanteId NO se toca: es la marca con la que PR-3 y la lectura legada (interruptor de PR-4) descartan
       el perfil-borrador que creó esa propuesta; anularla lo dejaría pasar por «publicado». Se limpia en PR-6/PR-8 junto
       con el perfil. Las propuestas cerradas (aplicada, rechazada) conservan su SubregistroId: es historia.

  RESPALDO. Antes de modificar, en el esquema `respaldo` y con el sufijo del guion: respaldo.RevisionesObservaciones_V20261119_30
  (notas reescritas o descartadas, con la acción), respaldo.PropuestasDeCambioCampos_V20261119_30 (campos reescritos,
  descartados o con «antes» rellenado) y respaldo.PropuestasDeCambio_V20261119_30 (propuestas en vuelo con su SubregistroId).
  Va además del guion manual simus-database/scripts/respaldo_perfiles_publicos_festival.sql.

  COMPARACION. Vacío y NULL son lo mismo y se recorta, como en el resto del circuito.

  IDEMPOTENTE. Tras la primera ejecución no queda nota 'perfilPublico.%' ni propuesta en vuelo con SubregistroId, así que la
  segunda no escribe nada. Una sola transacción: si algo falla no queda nada a medias.

  REVERSA: simus-database/scripts/reversa_notas_y_propuestas_en_vuelo.sql (fuera de schema/): restaura desde las tres tablas
  de respaldo, fila a fila.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.RevisionesDeRegistroObservaciones', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.PropuestasDeCambio', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.PropuestasDeCambioCampos', N'U') IS NOT NULL
   AND (EXISTS (SELECT 1 FROM dbo.RevisionesDeRegistroObservaciones o
                JOIN dbo.RevisionesDeRegistro r ON r.IdRevision = o.IdRevision
                WHERE r.ModuloId = N'festivales' AND (o.Ambito = N'subregistro' OR o.CampoId LIKE N'perfilPublico.%'))
        OR EXISTS (SELECT 1 FROM dbo.PropuestasDeCambioCampos WHERE CampoId LIKE N'perfilPublico.%')
        OR EXISTS (SELECT 1 FROM dbo.PropuestasDeCambio
                   WHERE ModuloId = N'festivales' AND SubregistroId IS NOT NULL
                     AND Estado IN (N'borrador', N'en_revision', N'ajustes_solicitados')))
BEGIN
    BEGIN TRANSACTION;

    DECLARE @ahora datetime2(0) = SYSUTCDATETIME();
    DECLARE @perfiles bit = CASE WHEN OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U') IS NULL THEN 0 ELSE 1 END;

    /* A) NOTAS. Candidatas a pasar a la ficha, con el campo ya reescrito. */
    SELECT o.IdObservacion, o.IdRevision,
           CASE WHEN o.CampoId LIKE N'perfilPublico.%' THEN N'festival.' + SUBSTRING(o.CampoId, LEN(N'perfilPublico.') + 1, 200)
                ELSE o.CampoId END AS CampoNuevo,
           TRY_CONVERT(int, o.SubregistroId) AS PerfilId
    INTO #Candidatas
    FROM dbo.RevisionesDeRegistroObservaciones o
    JOIN dbo.RevisionesDeRegistro r ON r.IdRevision = o.IdRevision AND r.ModuloId = N'festivales'
    WHERE o.Ambito = N'subregistro' OR o.CampoId LIKE N'perfilPublico.%';

    /* Entre las candidatas y las notas que ya estaban en la ficha, una sola por (revisión, campo). */
    SELECT c.IdObservacion,
           CASE WHEN EXISTS (SELECT 1 FROM dbo.RevisionesDeRegistroObservaciones p
                             WHERE p.IdRevision = c.IdRevision AND p.Ambito = N'principal' AND p.CampoId = c.CampoNuevo
                               AND p.IdObservacion <> c.IdObservacion)
                THEN 0
                ELSE CASE ROW_NUMBER() OVER (PARTITION BY c.IdRevision, c.CampoNuevo
                                             ORDER BY ISNULL(c.PerfilId, 0) DESC, c.IdObservacion DESC) WHEN 1 THEN 1 ELSE 0 END
           END AS Se_Conserva
    INTO #Destino
    FROM #Candidatas c;

    /* B) CAMPOS de propuesta con prefijo. */
    SELECT k.IdCampoPropuesto, k.IdPropuesta,
           SUBSTRING(k.CampoId, LEN(N'perfilPublico.') + 1, 120) AS CampoNuevo,
           CASE WHEN EXISTS (SELECT 1 FROM dbo.PropuestasDeCambioCampos s
                             WHERE s.IdPropuesta = k.IdPropuesta AND s.CampoId = SUBSTRING(k.CampoId, LEN(N'perfilPublico.') + 1, 120))
                THEN 0 ELSE 1 END AS Se_Conserva
    INTO #CamposConPrefijo
    FROM dbo.PropuestasDeCambioCampos k
    WHERE k.CampoId LIKE N'perfilPublico.%';

    /* C) PROPUESTAS EN VUELO con perfil de origen. */
    SELECT pc.IdPropuesta, TRY_CONVERT(int, pc.SubregistroId) AS PerfilId
    INTO #Vuelo
    FROM dbo.PropuestasDeCambio pc
    WHERE pc.ModuloId = N'festivales' AND pc.SubregistroId IS NOT NULL
      AND pc.Estado IN (N'borrador', N'en_revision', N'ajustes_solicitados');

    /* Los campos a los que se les rellena el «antes»: vacío y con perfil de origen que sí tuvo dato. Se calcula UNA vez. */
    CREATE TABLE #Antes (IdCampoPropuesto bigint NOT NULL PRIMARY KEY, Valor nvarchar(max) NULL);
    IF @perfiles = 1
    BEGIN
        EXEC (N'
        INSERT INTO #Antes (IdCampoPropuesto, Valor)
        SELECT k.IdCampoPropuesto, v.Valor
        FROM dbo.PropuestasDeCambioCampos k
        JOIN #Vuelo x ON x.IdPropuesta = k.IdPropuesta
        JOIN dbo.PerfilesPublicosFestival p ON p.IdPerfilPublicoFestival = x.PerfilId
        CROSS APPLY (SELECT CASE REPLACE(k.CampoId, N''perfilPublico.'', N'''')
            WHEN N''nombre'' THEN CONVERT(nvarchar(max), p.Nombre)
            WHEN N''descripcion'' THEN CONVERT(nvarchar(max), p.Descripcion)
            WHEN N''nivelCobertura'' THEN CONVERT(nvarchar(max), p.NivelCobertura)
            WHEN N''codigoDepartamento'' THEN CONVERT(nvarchar(max), p.CodigoDepartamento)
            WHEN N''codigoMunicipio'' THEN CONVERT(nvarchar(max), p.CodigoMunicipio)
            WHEN N''periodicidad'' THEN CONVERT(nvarchar(max), p.Periodicidad)
            WHEN N''periodicidadDetalle'' THEN CONVERT(nvarchar(max), p.PeriodicidadDetalle)
            WHEN N''correoContacto'' THEN CONVERT(nvarchar(max), p.CorreoContacto)
            WHEN N''telefonoContacto'' THEN CONVERT(nvarchar(max), p.TelefonoContacto)
            WHEN N''instagram'' THEN CONVERT(nvarchar(max), p.Instagram)
            WHEN N''facebook'' THEN CONVERT(nvarchar(max), p.Facebook)
            WHEN N''sitioWeb'' THEN CONVERT(nvarchar(max), p.SitioWeb)
            WHEN N''otroEnlace'' THEN CONVERT(nvarchar(max), p.OtroEnlace)
            WHEN N''observacionesContacto'' THEN CONVERT(nvarchar(max), p.ObservacionesContacto)
            WHEN N''director'' THEN CONVERT(nvarchar(max), p.Director)
            WHEN N''tipoOrganizadorId'' THEN CONVERT(nvarchar(max), p.TipoOrganizadorId)
            WHEN N''practicasMusicales'' THEN CONVERT(nvarchar(max), (
                SELECT STRING_AGG(CONVERT(nvarchar(20), h.IdPracticaMusical), N'','') WITHIN GROUP (ORDER BY h.IdPracticaMusical)
                FROM dbo.PracticasMusicalesDeRegistro h
                WHERE h.ModuloId = N''perfiles-publicos-festival'' AND h.RegistroId = CONVERT(nvarchar(64), p.IdPerfilPublicoFestival)))
            WHEN N''territoriosSonoros'' THEN CONVERT(nvarchar(max), (
                SELECT STRING_AGG(CONVERT(nvarchar(20), h.IdTerritorioSonoro), N'','') WITHIN GROUP (ORDER BY h.IdTerritorioSonoro)
                FROM dbo.TerritoriosSonorosDeRegistro h
                WHERE h.ModuloId = N''perfiles-publicos-festival'' AND h.RegistroId = CONVERT(nvarchar(64), p.IdPerfilPublicoFestival)))
            ELSE NULL END AS Valor) v
        WHERE NULLIF(LTRIM(RTRIM(k.ValorAnterior)), N'''') IS NULL
          AND NULLIF(LTRIM(RTRIM(v.Valor)), N'''') IS NOT NULL;');
    END;

    /* RESPALDO de lo que se va a tocar (antes de cualquier cambio). */
    IF SCHEMA_ID(N'respaldo') IS NULL EXEC (N'CREATE SCHEMA respaldo');

    -- (la UNION ALL hace que la copia no herede la propiedad IDENTITY del id)
    IF OBJECT_ID(N'respaldo.RevisionesObservaciones_V20261119_30', N'U') IS NULL
        SELECT CAST(NULL AS datetime2(0)) AS FechaRespaldo, CAST(NULL AS nvarchar(20)) AS Accion, u.*
        INTO respaldo.RevisionesObservaciones_V20261119_30
        FROM (SELECT * FROM dbo.RevisionesDeRegistroObservaciones UNION ALL SELECT * FROM dbo.RevisionesDeRegistroObservaciones) u WHERE 1 = 0;
    IF OBJECT_ID(N'respaldo.PropuestasDeCambioCampos_V20261119_30', N'U') IS NULL
        SELECT CAST(NULL AS datetime2(0)) AS FechaRespaldo, CAST(NULL AS nvarchar(20)) AS Accion, u.*
        INTO respaldo.PropuestasDeCambioCampos_V20261119_30
        FROM (SELECT * FROM dbo.PropuestasDeCambioCampos UNION ALL SELECT * FROM dbo.PropuestasDeCambioCampos) u WHERE 1 = 0;
    IF OBJECT_ID(N'respaldo.PropuestasDeCambio_V20261119_30', N'U') IS NULL
        SELECT CAST(NULL AS datetime2(0)) AS FechaRespaldo, u.*
        INTO respaldo.PropuestasDeCambio_V20261119_30
        FROM (SELECT * FROM dbo.PropuestasDeCambio UNION ALL SELECT * FROM dbo.PropuestasDeCambio) u WHERE 1 = 0;

    INSERT INTO respaldo.RevisionesObservaciones_V20261119_30
    SELECT @ahora, CASE d.Se_Conserva WHEN 1 THEN N'reescrita' ELSE N'descartada' END, o.*
    FROM dbo.RevisionesDeRegistroObservaciones o
    JOIN #Destino d ON d.IdObservacion = o.IdObservacion;

    INSERT INTO respaldo.PropuestasDeCambioCampos_V20261119_30
    SELECT @ahora, CASE c.Se_Conserva WHEN 1 THEN N'reescrito' ELSE N'descartado' END, k.*
    FROM dbo.PropuestasDeCambioCampos k
    JOIN #CamposConPrefijo c ON c.IdCampoPropuesto = k.IdCampoPropuesto;

    INSERT INTO respaldo.PropuestasDeCambioCampos_V20261119_30
    SELECT @ahora, N'antes rellenado', k.*
    FROM dbo.PropuestasDeCambioCampos k
    JOIN #Antes a ON a.IdCampoPropuesto = k.IdCampoPropuesto
    WHERE NOT EXISTS (SELECT 1 FROM #CamposConPrefijo c WHERE c.IdCampoPropuesto = k.IdCampoPropuesto);

    INSERT INTO respaldo.PropuestasDeCambio_V20261119_30
    SELECT @ahora, pc.*
    FROM dbo.PropuestasDeCambio pc
    JOIN #Vuelo x ON x.IdPropuesta = pc.IdPropuesta;

    /* A) Escritura de las notas: primero se borran las que sobran (la unicidad lo exige), luego se reescriben. */
    DELETE o
    FROM dbo.RevisionesDeRegistroObservaciones o
    JOIN #Destino d ON d.IdObservacion = o.IdObservacion
    WHERE d.Se_Conserva = 0;

    UPDATE o
    SET o.Ambito = N'principal',
        o.SubregistroId = NULL,
        o.CampoId = c.CampoNuevo
    FROM dbo.RevisionesDeRegistroObservaciones o
    JOIN #Destino d ON d.IdObservacion = o.IdObservacion AND d.Se_Conserva = 1
    JOIN #Candidatas c ON c.IdObservacion = o.IdObservacion;

    /* B) Campos de propuesta. */
    DELETE k
    FROM dbo.PropuestasDeCambioCampos k
    JOIN #CamposConPrefijo c ON c.IdCampoPropuesto = k.IdCampoPropuesto
    WHERE c.Se_Conserva = 0;

    UPDATE k
    SET k.CampoId = c.CampoNuevo
    FROM dbo.PropuestasDeCambioCampos k
    JOIN #CamposConPrefijo c ON c.IdCampoPropuesto = k.IdCampoPropuesto AND c.Se_Conserva = 1;

    /* C) El «antes» de lo que estaba vacío, y fuera el perfil de origen. */
    UPDATE k
    SET k.ValorAnterior = a.Valor
    FROM dbo.PropuestasDeCambioCampos k
    JOIN #Antes a ON a.IdCampoPropuesto = k.IdCampoPropuesto;

    UPDATE pc
    SET pc.SubregistroId = NULL
    FROM dbo.PropuestasDeCambio pc
    JOIN #Vuelo x ON x.IdPropuesta = pc.IdPropuesta;

    DECLARE @notasReescritas int = (SELECT COUNT(*) FROM #Destino WHERE Se_Conserva = 1);
    DECLARE @notasDescartadas int = (SELECT COUNT(*) FROM #Destino WHERE Se_Conserva = 0);
    DECLARE @camposReescritos int = (SELECT COUNT(*) FROM #CamposConPrefijo WHERE Se_Conserva = 1);
    DECLARE @anteriores int = (SELECT COUNT(*) FROM #Antes);
    DECLARE @enVuelo int = (SELECT COUNT(*) FROM #Vuelo);
    PRINT CONCAT('[V20261119_30] Notas reescritas: ', @notasReescritas, '; descartadas por colisión: ', @notasDescartadas,
                 '; campos de propuesta reescritos: ', @camposReescritos, '; «antes» rellenados: ', @anteriores,
                 '; propuestas en vuelo sin perfil de origen: ', @enVuelo);

    DROP TABLE #Candidatas;
    DROP TABLE #Destino;
    DROP TABLE #CamposConPrefijo;
    DROP TABLE #Vuelo;
    DROP TABLE #Antes;

    COMMIT TRANSACTION;
END
ELSE
BEGIN
    PRINT '[V20261119_30] Sin notas ni propuestas en vuelo que dependan del perfil: no se cambia nada.';
END;
GO
