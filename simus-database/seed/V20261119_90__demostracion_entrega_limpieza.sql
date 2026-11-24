/*
    SIMUS · Demostración, capa de ENTREGA: la siembra limpia que se recorre y se captura.

    Va AL FINAL de `./scripts/demo/sembrar-demo.sh` (sin argumentos, o `./scripts/demo/sembrar-demo.sh entrega`): pule lo que dejaron las
    demás semillas sin tocar sus guiones, para que cada pantalla se lea como un registro de verdad:

      1. SIN ROTULOS DE PRUEBA. Quita los sufijos «(demostración)», los párrafos «Datos de demostración» y «Texto de
         demostración», la etiqueta «demostración» de noticias y eventos, y el «de demostración» de los registros históricos.
      2. LOS FESTIVALES Y ORGANIZACIONES GENERADOS PARA EL MAPA YA NO REPITEN EL PATRON. Cada Festival generado recibe un nombre
         con una de seis formas, un organizador de una de siete, y contactos propios de su municipio (en vez de
         `contactoNNN@corporacion.test`). Sus fechas se reparten a partir de HOY (no del año calendario) y sus eventos de
         agenda se mueven con ellos, con títulos que siguen el nuevo nombre. Las treinta organizaciones del mapa alternan
         cuatro formas de nombre.
      3. LA AGENDA DE CITAS DEL MERCADO MUSICAL DEL VALLE, REDUCIDA Y VARIADA. Cada artista conserva pocas citas (Valentina
         Ocampo: una por responder, dos confirmadas y una rechazada con su motivo), con mensajes y horas distintos.

    NO CAMBIA LA ESTRUCTURA NI LA IDENTIDAD DE NADA: no borra registros salvo las citas sobrantes y las etiquetas de rótulo,
    y reconoce lo suyo por la procedencia `siembra` y por el patrón de contacto de la semilla del mapa. ES IDEMPOTENTE.
    Las fechas se calculan con SYSUTCDATETIME(), de modo que «Próximos eventos» no queda vacío el día de la captura.
    TODO ES FICTICIO. No se ejecuta en producción: `migrar` no aplica `simus-database/seed/`.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Ahora datetime2(0) = SYSUTCDATETIME();
DECLARE @Hoy date = CAST(@Ahora AS date);

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1. SIN ROTULOS DE PRUEBA
-- Se buscan las columnas de texto que aún dicen «demostración» y se limpian con reemplazos exactos, del patrón más largo al
-- más corto. Un registro sin esos rótulos queda igual que antes.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE #Columnas (Tabla sysname, Columna sysname);
DECLARE @Busca nvarchar(max) = N'';
SELECT @Busca += N'INSERT INTO #Columnas SELECT N''' + t.name + N''', N''' + c.name + N''' WHERE EXISTS (SELECT 1 FROM dbo.[' + t.name
              + N'] WHERE [' + c.name + N'] LIKE N''%demostraci%''); '
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id AND SCHEMA_NAME(t.schema_id) = N'dbo'
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE ty.name IN (N'nvarchar', N'varchar') AND (c.max_length >= 20 OR c.max_length = -1)
  AND t.name NOT IN (N'CambiosDeRegistro', N'BitacoraAuditoria', N'EnviosDeRevision')
  AND t.name NOT LIKE N'#%';
EXEC (@Busca);

DECLARE @Patrones TABLE (Orden int IDENTITY(1,1) PRIMARY KEY, Texto nvarchar(300), Cambio nvarchar(300));
INSERT INTO @Patrones (Texto, Cambio) VALUES
 (NCHAR(10) + NCHAR(10) + N'Datos de demostración: no corresponde a un Festival real.', N''),
 (NCHAR(10) + NCHAR(10) + N'Datos de demostración: no corresponden a un Festival real.', N''),
 (NCHAR(10) + NCHAR(10) + N'Datos de demostración: no corresponde a una organización real.', N''),
 (NCHAR(10) + NCHAR(10) + N'Datos de demostración.', N''),
 (NCHAR(10) + NCHAR(10) + N'Texto de demostración: no corresponde a una convocatoria real.', N''),
 (NCHAR(10) + NCHAR(10) + N'Texto de demostración: no describe un evento real.', N''),
 (NCHAR(10) + NCHAR(10) + N'Texto de demostración: no describe un archivo real.', N''),
 (NCHAR(10) + NCHAR(10) + N'Texto de demostración: no corresponde a una beca real.', N''),
 (NCHAR(10) + NCHAR(10) + N'Texto de demostración.', N''),
 (NCHAR(10) + NCHAR(10) + N'Evento de demostración.', N''),
 (N' Texto de demostración: no corresponde a una convocatoria real.', N''),
 (N' Texto de demostración: no describe un evento real.', N''),
 (N' Texto de demostración: no describe un archivo real.', N''),
 (N' Texto de demostración: no corresponde a una beca real.', N''),
 (N'Texto de demostración en estado borrador.', N'Texto en preparación.'),
 (N'Texto de demostración en revisión.', N'Texto en revisión editorial.'),
 (N'Ficha completa de demostración:', N'Ficha completa:'),
 (N' Datos de demostración: no corresponde a una organización real.', N''),
 (N' Datos de demostración.', N''),
 (N' Texto de demostración.', N''),
 (N'Datos de demostración: no corresponde a un Festival real.', N''),
 (N'Datos de demostración: no corresponden a un Festival real.', N''),
 (N'Datos de demostración.', N''),
 (N'Texto de demostración.', N''),
 (N' (demostración)', N''),
 (N'histórico de demostración', N'histórico'),
 (N'Ilustración generada para la demostración de SIMUS', N'Ilustración generada para SIMUS');

DECLARE @T sysname, @C sysname, @P nvarchar(300), @R nvarchar(300), @Sql nvarchar(max);
DECLARE col CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla, Columna FROM #Columnas;
OPEN col;
FETCH NEXT FROM col INTO @T, @C;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE pat CURSOR LOCAL FAST_FORWARD FOR SELECT Texto, Cambio FROM @Patrones ORDER BY Orden;
    OPEN pat;
    FETCH NEXT FROM pat INTO @P, @R;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @Sql = N'UPDATE dbo.[' + @T + N'] SET [' + @C + N'] = RTRIM(REPLACE([' + @C + N'], @p, @r)) WHERE [' + @C + N'] LIKE N''%'' + @p + N''%'';';
        EXEC sp_executesql @Sql, N'@p nvarchar(300), @r nvarchar(300)', @p = @P, @r = @R;
        FETCH NEXT FROM pat INTO @P, @R;
    END;
    CLOSE pat; DEALLOCATE pat;
    FETCH NEXT FROM col INTO @T, @C;
END;
CLOSE col; DEALLOCATE col;

-- Lo que quedó vacío por la limpieza no es una cadena vacía: es un dato que no existe.
UPDATE dbo.Festivales SET ObservacionesContacto = NULL WHERE LTRIM(RTRIM(ObservacionesContacto)) = N'';

-- La etiqueta «demostración» de noticias y eventos de agenda no es una etiqueta de contenido.
DELETE FROM dbo.EtiquetasNoticia WHERE Termino = N'demostración';
DELETE FROM dbo.EtiquetasEventoAgenda WHERE Termino = N'demostración';

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 2. FESTIVALES Y ORGANIZACIONES DEL MAPA: NOMBRES, ORGANIZADORES Y CONTACTOS PROPIOS
-- Se reconocen por la procedencia `siembra` y por el patrón de contacto de la semilla del mapa (`contactoNNN@corporacion.test`);
-- una vez renombrados dejan de coincidir, y una segunda pasada no los toca. El territorio sonoro se dice como se lee en una
-- frase («Músicas Insulares»), no como se llama en el catálogo («Insular»).
-- ─────────────────────────────────────────────────────────────────────────────────────────────
SELECT f.IdFestival AS Id, f.NombreFestival AS NombreAnterior, f.Descripcion AS DescripcionAnterior,
       REPLACE(f.Organizador, N'Corporación Cultural ', N'') AS Municipio,
       CAST(NULL AS nvarchar(200)) AS Territorio, CAST(NULL AS nvarchar(200)) AS Nombre, CAST(NULL AS nvarchar(240)) AS Organizador,
       CAST(NULL AS nvarchar(120)) AS Clave, f.FechaInicioEdicionActual AS InicioAnterior
INTO #Generados
FROM dbo.Festivales f
JOIN dbo.ProcedenciasDeRegistro p ON p.ModuloId = N'festivales' AND p.ContextoOrigen = N'siembra' AND TRY_CAST(p.RegistroId AS int) = f.IdFestival
WHERE f.CorreoOrganizador LIKE N'contacto%@corporacion.test'
  AND f.Organizador LIKE N'Corporación Cultural %'
  AND f.NombreFestival LIKE N'Festival de % de ' + REPLACE(f.Organizador, N'Corporación Cultural ', N'');

UPDATE g SET Territorio = CASE
        SUBSTRING(g.NombreAnterior, 12 + 1, LEN(g.NombreAnterior) - 12 - LEN(N' de ' + g.Municipio))
        WHEN N'Amazonas' THEN N'Músicas Amazónicas'
        WHEN N'Insular' THEN N'Músicas Insulares'
        WHEN N'Prácticas de Pueblos Indígenas' THEN N'Músicas de Pueblos Indígenas'
        WHEN N'Músicas Urbanas, Alternativas e Independientes - MUAI' THEN N'Músicas Urbanas y Alternativas'
        WHEN N'Comunidades Académicas' THEN N'Músicas Académicas'
        WHEN N'Rrom' THEN N'Músicas Rrom'
        ELSE SUBSTRING(g.NombreAnterior, 12 + 1, LEN(g.NombreAnterior) - 12 - LEN(N' de ' + g.Municipio)) END,
    Clave = LOWER(TRANSLATE(REPLACE(REPLACE(REPLACE(REPLACE(g.Municipio, N' ', N''), N'-', N''), N'.', N''), N'''', N''),
                            N'áéíóúüñÁÉÍÓÚÜÑ', N'aeiouunAEIOUUN'))
FROM #Generados g;

UPDATE g SET Nombre = CASE g.Id % 6
        WHEN 0 THEN CONCAT(N'Festival de ', g.Territorio, N' de ', g.Municipio)
        WHEN 1 THEN CONCAT(N'Encuentro de ', g.Territorio, N' en ', g.Municipio)
        WHEN 2 THEN CONCAT(g.Municipio, N' Suena · Festival de ', g.Territorio)
        WHEN 3 THEN CONCAT(N'Muestra de ', g.Territorio, N' de ', g.Municipio)
        WHEN 4 THEN CONCAT(N'Semana de ', g.Territorio, N' en ', g.Municipio)
        ELSE CONCAT(N'Festival Regional de ', g.Territorio, N' en ', g.Municipio) END,
    Organizador = CASE g.Id % 7
        WHEN 0 THEN CONCAT(N'Corporación Cultural ', g.Municipio)
        WHEN 1 THEN CONCAT(N'Fundación Música y Territorio de ', g.Municipio)
        WHEN 2 THEN CONCAT(N'Asociación de Músicos de ', g.Municipio)
        WHEN 3 THEN CONCAT(N'Colectivo Sonoro ', g.Municipio)
        WHEN 4 THEN CONCAT(N'Casa de la Música de ', g.Municipio)
        WHEN 5 THEN CONCAT(N'Fundación Cultural ', g.Municipio)
        ELSE CONCAT(N'Corporación Amigos de la Música de ', g.Municipio) END
FROM #Generados g;

-- Dos Festivales del mismo municipio y territorio con la misma forma se distinguirían solo por el nombre: no se repite ninguno.
UPDATE g SET Nombre = CONCAT(g.Nombre, N' (', g.Id % 90 + 10, N'.ª edición)')
FROM #Generados g
WHERE EXISTS (SELECT 1 FROM #Generados o WHERE o.Nombre = g.Nombre AND o.Id < g.Id);

UPDATE f SET
    NombreFestival = g.Nombre,
    Organizador = g.Organizador,
    Descripcion = CONCAT(CHOOSE(g.Id % 3 + 1, N'Encuentro de ', N'Jornadas de ', N'Muestra de '), LOWER(g.Territorio),
                         N' que reúne agrupaciones, luthiers y públicos de ', g.Municipio, N' y su área de influencia.',
                         CASE WHEN CHARINDEX(N' Programación de', g.DescripcionAnterior) > 0
                              THEN SUBSTRING(g.DescripcionAnterior, CHARINDEX(N' Programación de', g.DescripcionAnterior), 4000)
                              ELSE N'' END),
    CorreoOrganizador = CONCAT(CHOOSE(g.Id % 4 + 1, N'info', N'contacto', N'coordinacion', N'produccion'), N'@', g.Clave, N'.test'),
    SitioWebOrganizador = CONCAT(N'https://', g.Clave, N'.test'),
    CorreoFestival = CONCAT(CHOOSE(g.Id % 3 + 1, N'programacion', N'prensa', N'hola'), N'@', g.Clave, N'festival.test'),
    SitioWebFestival = CONCAT(N'https://', g.Clave, N'festival.test'),
    InstagramFestival = CONCAT(N'https://instagram.com/', g.Clave, N'musica'),
    FacebookFestival = CONCAT(N'https://facebook.com/', g.Clave, N'musica'),
    OtroEnlaceFestival = CONCAT(N'https://linktr.ee/', g.Clave, N'musica'),
    ObservacionesContacto = NULL,
    -- Las fechas parten de hoy: la edición cae en los próximos diez meses y la anterior, un año antes.
    FechaInicioEdicionActual = DATEADD(DAY, 5 + (g.Id * 13) % 300, @Hoy),
    FechaFinEdicionActual = DATEADD(DAY, 5 + (g.Id * 13) % 300 + 2 + g.Id % 4, @Hoy),
    FechaUltimaEdicion = DATEADD(YEAR, -1, DATEADD(DAY, 5 + (g.Id * 13) % 300, @Hoy))
FROM dbo.Festivales f JOIN #Generados g ON g.Id = f.IdFestival;

-- Los eventos de agenda de esos Festivales se mueven con ellos y se titulan con el nombre nuevo.
UPDATE e SET
    Titulo = CASE WHEN e.Titulo LIKE N'Apertura de %' THEN CONCAT(N'Apertura · ', g.Nombre)
                  WHEN e.Titulo LIKE N'Taller de %' THEN CONCAT(N'Taller de formación · ', g.Nombre)
                  WHEN e.Titulo LIKE N'Conciertos de %' THEN CONCAT(N'Conciertos centrales · ', g.Nombre)
                  ELSE e.Titulo END,
    Descripcion = REPLACE(e.Descripcion, g.NombreAnterior, g.Nombre),
    Organizador = g.Organizador,
    FechaInicio = DATEADD(DAY, DATEDIFF(DAY, g.InicioAnterior, f.FechaInicioEdicionActual), e.FechaInicio),
    FechaFin = CASE WHEN e.FechaFin IS NULL THEN NULL
                    ELSE DATEADD(DAY, DATEDIFF(DAY, g.InicioAnterior, f.FechaInicioEdicionActual), e.FechaFin) END
FROM dbo.EventosAgenda e
JOIN #Generados g ON g.Id = e.FestivalId
JOIN dbo.Festivales f ON f.IdFestival = g.Id
WHERE g.InicioAnterior IS NOT NULL;

-- Las organizaciones del mapa («Corporación Musical de <departamento>»): cuatro formas de nombre y contactos propios.
SELECT e.IdEntidad AS Id, SUBSTRING(e.Nombre, 23 + 1, 200) AS Departamento, CAST(NULL AS nvarchar(120)) AS Clave
INTO #Organizaciones
FROM dbo.Entidades e
JOIN dbo.ProcedenciasDeRegistro p ON p.ModuloId = N'organizaciones' AND p.ContextoOrigen = N'siembra' AND TRY_CAST(p.RegistroId AS int) = e.IdEntidad
WHERE e.Nombre LIKE N'Corporación Musical de %';

UPDATE o SET Clave = LOWER(TRANSLATE(REPLACE(REPLACE(REPLACE(REPLACE(o.Departamento, N' ', N''), N',', N''), N'.', N''), N'-', N''),
                                     N'áéíóúüñÁÉÍÓÚÜÑ', N'aeiouunAEIOUUN'))
FROM #Organizaciones o;

UPDATE e SET
    Nombre = CASE o.Id % 4 WHEN 0 THEN CONCAT(N'Corporación Musical de ', o.Departamento)
                           WHEN 1 THEN CONCAT(N'Asociación de Músicos de ', o.Departamento)
                           WHEN 2 THEN CONCAT(N'Fundación Cultural de ', o.Departamento)
                           ELSE CONCAT(N'Casa de la Música de ', o.Departamento) END,
    CorreoContacto = CONCAT(CHOOSE(o.Id % 3 + 1, N'info', N'contacto', N'secretaria'), N'@', o.Clave, N'musica.test'),
    SitioWeb = CONCAT(N'https://', o.Clave, N'musica.test'),
    Facebook = CONCAT(N'https://facebook.com/', o.Clave, N'musica'),
    Instagram = CONCAT(N'https://instagram.com/', o.Clave, N'musica'),
    OtroEnlace = CONCAT(N'https://linktr.ee/', o.Clave, N'musica')
FROM dbo.Entidades e JOIN #Organizaciones o ON o.Id = e.IdEntidad;
UPDATE e SET NombreLegal = e.Nombre FROM dbo.Entidades e JOIN #Organizaciones o ON o.Id = e.IdEntidad;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 3. AGENDA DE CITAS DEL MERCADO MUSICAL DEL VALLE: POCAS CITAS POR ARTISTA, VARIADAS
-- Cada artista conserva una por responder, dos confirmadas y, si la tiene, una rechazada o una cancelada; Valentina Ocampo, además,
-- una rechazada con su motivo (la tercera confirmada pasa a rechazada). Las demás citas se retiran: sus franjas quedan libres.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @Agenda int = (
    SELECT TOP (1) a.IdAgenda
    FROM dbo.AgendasDeCitas a
    JOIN dbo.EdicionesMercado ed ON ed.IdEdicionMercado = a.EdicionMercadoId
    JOIN dbo.Mercados m ON m.IdMercado = ed.MercadoId
    WHERE m.NombreMercado = N'Mercado Musical del Valle');
DECLARE @Valentina int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'valentina.ocampo@correo.test');

IF @Agenda IS NOT NULL
BEGIN
    DECLARE @ValentinaP int = (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId = @Agenda AND UsuarioId = @Valentina AND Rol = N'artista');

    SELECT c.IdCita,
           ROW_NUMBER() OVER (PARTITION BY c.AnfitrionId, c.Estado ORDER BY c.FranjaId) AS Orden,
           c.AnfitrionId, c.Estado
    INTO #Citas
    FROM dbo.CitasDeAgenda c WHERE c.AgendaId = @Agenda;

    DELETE c FROM dbo.CitasDeAgenda c JOIN #Citas k ON k.IdCita = c.IdCita
    WHERE NOT ((k.Estado = N'solicitada' AND k.Orden <= 1)
            OR (k.Estado = N'confirmada' AND k.Orden <= CASE WHEN k.AnfitrionId = @ValentinaP THEN 3 ELSE 2 END)
            OR (k.Estado IN (N'rechazada', N'cancelada') AND k.Orden <= 1 AND k.AnfitrionId <> @ValentinaP));

    -- Valentina: la tercera confirmada pasa a rechazada, con su motivo.
    UPDATE c SET Estado = N'rechazada', FechaDecision = DATEADD(HOUR, -20, @Ahora),
                 MotivoDeLaDecision = N'Ese día tengo un ensayo con el cuarteto; propongo escucharnos por video antes del Mercado.'
    FROM dbo.CitasDeAgenda c JOIN #Citas k ON k.IdCita = c.IdCita
    WHERE k.AnfitrionId = @ValentinaP AND k.Estado = N'confirmada' AND k.Orden = 3;

    -- Mensajes y horas distintos en cada cita; las que esperan respuesta vencen dentro de 72 horas desde su solicitud.
    UPDATE c SET
        MensajeInicial = CHOOSE(c.IdCita % 8 + 1,
            N'Me interesa su propuesta para uno de nuestros escenarios.',
            N'Escuché su repertorio y quisiera conversar sobre una fecha.',
            N'¿Podemos hablar de una gira conjunta el próximo año?',
            N'Buscamos una agrupación con repertorio propio para nuestra temporada.',
            N'Me recomendaron su trabajo; me gustaría conocerlo mejor.',
            N'Quisiera escuchar el formato de cámara para una serie de conciertos.',
            N'Tenemos una ventana en la programación de noviembre y creo que encajan.',
            N'Nos gustaría invitarlos a un ciclo de música tradicional.'),
        FechaSolicitud = DATEADD(HOUR, -CASE WHEN c.Estado = N'solicitada' THEN 3 + (c.IdCita * 7) % 26 ELSE 30 + (c.IdCita * 11) % 90 END, @Ahora)
    FROM dbo.CitasDeAgenda c
    WHERE c.AgendaId = @Agenda;

    UPDATE c SET
        VenceUtc = DATEADD(HOUR, 72, c.FechaSolicitud),
        FechaDecision = CASE WHEN c.Estado = N'solicitada' THEN NULL ELSE DATEADD(HOUR, 4 + (c.IdCita * 3) % 20, c.FechaSolicitud) END
    FROM dbo.CitasDeAgenda c
    WHERE c.AgendaId = @Agenda AND c.Estado IN (N'solicitada', N'confirmada', N'rechazada', N'cancelada');
END;

COMMIT TRANSACTION;

SELECT N'Festivales renombrados' AS Concepto, COUNT(*) AS Cifra FROM #Generados
UNION ALL SELECT N'Organizaciones renombradas', COUNT(*) FROM #Organizaciones
UNION ALL SELECT N'Citas de la agenda', COUNT(*) FROM dbo.CitasDeAgenda WHERE AgendaId = @Agenda;
