/*
    SIMUS · Demostración de la agenda de citas (docs/referencia/26-agenda-de-citas-y-mercados.md), paso 2 de 2.

    Va DESPUÉS de `V20261106_11__demostracion_completa.sql`, de cuyo universo cuelga (la organización
    y las cuentas de dominio .test). Cada fila imita lo que habría escrito la API en ese paso.

      Mercado Musical del Valle ............ de la Corporación Cultural Cantaclaro,
                                                             publicado, con una edición programada.
      Su agenda de citas ................................... abierta, los compradores rotan, citas de
                                                             20 minutos, cupo de 4 artistas, 7 franjas.

      ARTISTAS (cuentas de la demostración)
        Valentina Ocampo, Andrés Muñoz, José Caicedo, Camilo Rojas ..... inscritos (cupo lleno)
        Mariana Palacios ................................................ en lista de espera (lugar 1)

      COMPRADORES O BOOKERS (los carga el Mercado con su correo)
        Diana Zapata, de la Asociación de Bandas del Oriente (festival) .. con cuenta, ya enlazada
        Programación del Festival de la Costa (festival) ................. invitado, aún sin cuenta
        Booking de la Sala del Mar (sala) ................................ invitado, aún sin cuenta

      CITAS: una confirmada, una esperando respuesta y una rechazada con su motivo.

    TODO ES FICTICIO Y VEROSÍMIL. Se retira con `V20261115_71__demostracion_agenda_de_citas_retiro.sql`
    y se aplica con ./scripts/demo/sembrar-demo.sh completa.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Ahora datetime2(0) = SYSUTCDATETIME();
DECLARE @Lucia int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'lucia.ramirez@cantaclaro.test');
DECLARE @Valentina int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'valentina.ocampo@correo.test');
DECLARE @Andres int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'andres.munoz@cantaclaro.test');
DECLARE @Jose int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'jose.caicedo@sonoracaribe.test');
DECLARE @Camilo int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'camilo.rojas@llanoadentro.test');
DECLARE @Mariana int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'mariana.palacios@sonoracaribe.test');
DECLARE @Diana int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'diana.zapata@bandasoriente.test');
DECLARE @Cantaclaro int = (SELECT IdEntidad FROM dbo.Entidades WHERE Nombre = N'Corporación Cultural Cantaclaro');

IF @Lucia IS NULL OR @Valentina IS NULL OR @Andres IS NULL OR @Jose IS NULL OR @Camilo IS NULL
   OR @Mariana IS NULL OR @Diana IS NULL OR @Cantaclaro IS NULL
BEGIN
    RAISERROR(N'Falta el universo de la siembra completa. Ejecuta antes ./scripts/demo/sembrar-demo.sh completa.', 16, 1);
    RETURN;
END;

IF EXISTS (SELECT 1 FROM dbo.Mercados WHERE NombreMercado = N'Mercado Musical del Valle') RETURN;

BEGIN TRANSACTION;

-- ── El Mercado y su edición ──────────────────────────────────────────────────────────────────────
DECLARE @InicioEdicion date = DATEADD(DAY, 30, CAST(@Ahora AS date));

INSERT INTO dbo.Mercados (NombreMercado, Descripcion, NivelCobertura, CodigoDepartamento, OrganizacionPrincipalId,
    EstadoRegistro, Activo, IdUsuarioCreador, FechaCreacion, FechaPublicacion, CorreoMercado)
VALUES (N'Mercado Musical del Valle',
    N'Encuentro de artistas, agrupaciones, bookers y programadores del suroccidente colombiano, con ruedas de citas cortas, showcases y conversatorios.',
    N'departamental', '76', @Cantaclaro, N'publicado', 1, @Lucia, DATEADD(DAY, -40, @Ahora), DATEADD(DAY, -35, @Ahora),
    N'mercado@cantaclaro.test');
DECLARE @Mercado int = SCOPE_IDENTITY();

INSERT INTO dbo.EdicionesMercado (MercadoId, Anio, Nombre, FechaInicio, FechaFin, CodigoDepartamento, CodigoMunicipio,
    LugarEspecifico, Estado, EstadoVisibilidad, IdUsuarioCreador, FechaCreacion, FechaPublicacion)
VALUES (@Mercado, YEAR(@InicioEdicion), CONCAT(N'Edición ', YEAR(@InicioEdicion)), @InicioEdicion, DATEADD(DAY, 2, @InicioEdicion),
    '76', '76001', N'Teatro Municipal de Cali', N'programada', N'publicado', @Lucia, DATEADD(DAY, -35, @Ahora), DATEADD(DAY, -35, @Ahora));
DECLARE @Edicion int = SCOPE_IDENTITY();

-- ── La agenda: abierta, los compradores rotan, cupo de 4 artistas ───────────────────────────────
INSERT INTO dbo.AgendasDeCitas (EdicionMercadoId, Estado, Modo, DuracionMinutos, PausaMinutos, TopeSolicitudesPendientes,
    VencimientoSolicitudHoras, CupoArtistas, IdUsuarioCreador, FechaCreacion)
VALUES (@Edicion, N'abierta', N'compradores_rotan', 20, 5, 5, 72, 4, @Lucia, DATEADD(DAY, -20, @Ahora));
DECLARE @Agenda int = SCOPE_IDENTITY();

-- Catorce franjas por día durante los dos primeros días de la edición, desde las 09:00 en hora de Bogotá
-- (UTC−5), cada 25 minutos: la parrilla tiene con qué verse llena (AGE2).
DECLARE @d int = 1;
WHILE @d <= 2
BEGIN
    DECLARE @Franja datetime2(0) = DATEADD(HOUR, 14, CAST(DATEADD(DAY, @d, @InicioEdicion) AS datetime2(0)));   -- 09:00 Bogotá = 14:00 UTC
    DECLARE @k int = 0;
    WHILE @k < 14
    BEGIN
        INSERT INTO dbo.FranjasDeCitas (AgendaId, InicioUtc, FinUtc) VALUES (@Agenda, @Franja, DATEADD(MINUTE, 20, @Franja));
        SET @Franja = DATEADD(MINUTE, 25, @Franja);
        SET @k += 1;
    END;
    SET @d += 1;
END;

-- ── Artistas: cuatro entran y la quinta espera ───────────────────────────────────────────────────
DECLARE @A TABLE (Clave nvarchar(20) PRIMARY KEY, Id int NULL, Usuario int, Nombre nvarchar(240), Entidad nvarchar(240),
    Presentacion nvarchar(1200), Enlaces nvarchar(1500), Representa nvarchar(240), Correo nvarchar(180), Telefono nvarchar(80),
    Estado nvarchar(20), Minutos int);
INSERT INTO @A VALUES
 (N'valentina', NULL, @Valentina, N'Valentina Ocampo', N'Marimba y Cununo del Pacífico',
  N'Cuarteto de marimba de chonta, cununos y voces del Pacífico sur. Repertorio de currulao y bunde, con tres álbumes grabados en Buenaventura.',
  N'https://marimbapacifico.test/escucha', NULL, N'valentina.ocampo@correo.test', N'+57 310 000 0201', N'aprobado', 600),
 (N'andres', NULL, @Andres, N'Andrés Muñoz', N'Trío Cuerdas del Cauca',
  N'Trío de guitarra, tiple y bandola que reinterpreta bambucos y pasillos caucanos en formato de cámara.',
  N'https://cuerdasdelcauca.test/video', NULL, N'andres.munoz@cantaclaro.test', N'+57 310 000 0202', N'aprobado', 540),
 (N'jose', NULL, @Jose, N'José Caicedo', N'Agrupación Pregones del Caribe',
  N'Banda de ocho músicos de gaita larga, tambores y coro. Cumbia y porro tradicionales con arreglos propios.',
  N'https://pregonesdelcaribe.test/en-vivo', N'Representa a la agrupación Pregones del Caribe', N'jose.caicedo@sonoracaribe.test', N'+57 310 000 0203', N'aprobado', 480),
 (N'camilo', NULL, @Camilo, N'Camilo Rojas', N'Arpas del Llano',
  N'Arpa, cuatro y maracas: joropo llanero tradicional y composiciones nuevas. Giras por Casanare y Arauca.',
  N'https://arpasdelllano.test/videos', NULL, N'camilo.rojas@llanoadentro.test', N'+57 310 000 0204', N'aprobado', 420),
 (N'mariana', NULL, @Mariana, N'Mariana Palacios', N'Sonora Mar y Cumbia',
  N'Orquesta de cumbia sabanera con vientos y percusión. Dos giras por Europa y un disco nominado a premios regionales.',
  N'https://sonoramaryycumbia.test/audio', NULL, N'mariana.palacios@sonoracaribe.test', N'+57 310 000 0205', N'lista_de_espera', 360);

INSERT INTO dbo.ParticipantesDeCitas (AgendaId, Rol, UsuarioId, Nombre, Entidad, Presentacion, Enlaces, RepresentaA,
    ContactoCorreo, ContactoTelefono, Estado, FechaInscripcion, IdUsuarioCreador)
SELECT @Agenda, N'artista', Usuario, Nombre, Entidad, Presentacion, Enlaces, Representa, Correo, Telefono, Estado,
       DATEADD(MINUTE, -Minutos, @Ahora), Usuario
FROM @A;

-- ── Compradores o bookers que el Mercado invita ─────────────────────────────────────────────────
-- La mesa o la sala de cada comprador la asigna la organización (Lucía), no quien participa.
INSERT INTO dbo.ParticipantesDeCitas (AgendaId, Rol, UsuarioId, Nombre, Entidad, TipoDeComprador, CorreoInvitacion, Presentacion,
    Espacio, Estado, FechaInscripcion, IdUsuarioCreador)
VALUES
 (@Agenda, N'comprador', @Diana, N'Diana Zapata', N'Asociación de Bandas del Oriente Antioqueño', N'festival',
  N'diana.zapata@bandasoriente.test', N'Programo las bandas del Festival de Bandas del Oriente. Busco formatos de cámara y música tradicional.',
  N'Mesa 1', N'aprobado', DATEADD(DAY, -18, @Ahora), @Lucia),
 (@Agenda, N'comprador', NULL, N'Programación del Festival de la Costa', N'Festival de la Costa', N'festival',
  N'programacion@festivalcosta.test', N'Curamos tres escenarios de música del Caribe y el Pacífico. Buscamos agrupaciones con repertorio propio.',
  N'Mesa 2', N'aprobado', DATEADD(DAY, -18, @Ahora), @Lucia),
 (@Agenda, N'comprador', NULL, N'Booking de la Sala del Mar', N'Sala del Mar', N'sala',
  N'booking@salamar.test', N'Sala de 300 personas en Santa Marta. Programamos música en vivo de jueves a sábado.',
  N'Sala del Mar', N'aprobado', DATEADD(DAY, -18, @Ahora), @Lucia);

-- ── Citas: confirmada, esperando respuesta y rechazada con motivo ───────────────────────────────
DECLARE @Diana_P int = (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId = @Agenda AND CorreoInvitacion = N'diana.zapata@bandasoriente.test');
DECLARE @Valentina_P int = (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId = @Agenda AND UsuarioId = @Valentina AND Rol = N'artista');
DECLARE @Jose_P int = (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId = @Agenda AND UsuarioId = @Jose AND Rol = N'artista');
DECLARE @Andres_P int = (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId = @Agenda AND UsuarioId = @Andres AND Rol = N'artista');
DECLARE @F1 int = (SELECT TOP (1) IdFranja FROM dbo.FranjasDeCitas WHERE AgendaId = @Agenda ORDER BY InicioUtc);
DECLARE @F2 int = (SELECT IdFranja FROM dbo.FranjasDeCitas WHERE AgendaId = @Agenda ORDER BY InicioUtc OFFSET 1 ROWS FETCH NEXT 1 ROWS ONLY);
DECLARE @F3 int = (SELECT IdFranja FROM dbo.FranjasDeCitas WHERE AgendaId = @Agenda ORDER BY InicioUtc OFFSET 2 ROWS FETCH NEXT 1 ROWS ONLY);

INSERT INTO dbo.CitasDeAgenda (AgendaId, FranjaId, AnfitrionId, VisitanteId, Estado, MensajeInicial, MotivoDeLaDecision,
    VenceUtc, FechaSolicitud, FechaDecision)
VALUES
 (@Agenda, @F1, @Valentina_P, @Diana_P, N'confirmada', N'Me interesa su marimba para nuestro festival.', NULL,
  DATEADD(HOUR, 72, DATEADD(DAY, -2, @Ahora)), DATEADD(DAY, -2, @Ahora), DATEADD(DAY, -1, @Ahora)),
 (@Agenda, @F2, @Jose_P, @Diana_P, N'solicitada', N'¿Podemos conversar sobre su gira del próximo año?', NULL,
  DATEADD(HOUR, 72, @Ahora), @Ahora, NULL),
 (@Agenda, @F3, @Andres_P, @Diana_P, N'rechazada', N'Quisiera escuchar su repertorio de cámara.',
  N'Ese horario lo tengo ocupado con un ensayo general.', DATEADD(HOUR, 72, DATEADD(DAY, -3, @Ahora)),
  DATEADD(DAY, -3, @Ahora), DATEADD(DAY, -2, @Ahora));

-- ── La parrilla llena (AGE2) ─────────────────────────────────────────────────────────────────────
-- Tres compradores y cuatro artistas, 28 franjas. El Festival de la Costa queda COMPLETO (todas sus franjas
-- ocupadas, algunas aún esperando respuesta); Diana Zapata tiene la mayoría; la Sala del Mar, pocas, y hay citas rechazadas,
-- canceladas y vencidas que ya liberaron su franja. Los desfases de artista (0, 3 y 2) garantizan que ningún artista
-- tenga dos citas vivas en la misma franja.
DECLARE @Costa_P int = (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId = @Agenda AND CorreoInvitacion = N'programacion@festivalcosta.test');
DECLARE @Sala_P int = (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId = @Agenda AND CorreoInvitacion = N'booking@salamar.test');
DECLARE @Camilo_P int = (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId = @Agenda AND UsuarioId = @Camilo AND Rol = N'artista');
DECLARE @Art TABLE (N int PRIMARY KEY, Id int);
INSERT INTO @Art VALUES (0, @Valentina_P), (1, @Andres_P), (2, @Jose_P), (3, @Camilo_P);
DECLARE @Fr TABLE (N int NOT NULL PRIMARY KEY, Id int NOT NULL);
INSERT INTO @Fr (N, Id) SELECT ROW_NUMBER() OVER (ORDER BY InicioUtc) - 1, IdFranja FROM dbo.FranjasDeCitas WHERE AgendaId = @Agenda;

-- Festival de la Costa: una cita en cada franja.
INSERT INTO dbo.CitasDeAgenda (AgendaId, FranjaId, AnfitrionId, VisitanteId, Estado, MensajeInicial, VenceUtc, FechaSolicitud, FechaDecision)
SELECT @Agenda, f.Id, a.Id, @Costa_P,
       CASE WHEN f.N % 6 = 5 THEN N'solicitada' ELSE N'confirmada' END,
       N'Nos interesa su repertorio para uno de nuestros escenarios.',
       CASE WHEN f.N % 6 = 5 THEN DATEADD(HOUR, 72, @Ahora) ELSE DATEADD(HOUR, 72, DATEADD(DAY, -2, @Ahora)) END,
       DATEADD(DAY, -2, @Ahora),
       CASE WHEN f.N % 6 = 5 THEN NULL ELSE DATEADD(DAY, -1, @Ahora) END
FROM @Fr f JOIN @Art a ON a.N = (f.N + 3) % 4;

-- Diana Zapata: la mayoría de las franjas que le quedan (las tres primeras ya tienen su cita de arriba).
INSERT INTO dbo.CitasDeAgenda (AgendaId, FranjaId, AnfitrionId, VisitanteId, Estado, MensajeInicial, VenceUtc, FechaSolicitud, FechaDecision)
SELECT @Agenda, f.Id, a.Id, @Diana_P,
       CASE WHEN f.N % 4 = 0 THEN N'solicitada' ELSE N'confirmada' END,
       N'Quisiera conversar sobre una fecha en nuestro festival.',
       CASE WHEN f.N % 4 = 0 THEN DATEADD(HOUR, 72, @Ahora) ELSE DATEADD(HOUR, 72, DATEADD(DAY, -2, @Ahora)) END,
       DATEADD(DAY, -2, @Ahora),
       CASE WHEN f.N % 4 = 0 THEN NULL ELSE DATEADD(DAY, -1, @Ahora) END
FROM @Fr f JOIN @Art a ON a.N = f.N % 4
WHERE f.N >= 3 AND f.N % 5 < 3;

-- Sala del Mar: pocas citas vivas.
INSERT INTO dbo.CitasDeAgenda (AgendaId, FranjaId, AnfitrionId, VisitanteId, Estado, MensajeInicial, VenceUtc, FechaSolicitud, FechaDecision)
SELECT @Agenda, f.Id, a.Id, @Sala_P, N'confirmada', N'Buscamos una banda para un jueves de la temporada.',
       DATEADD(HOUR, 72, DATEADD(DAY, -2, @Ahora)), DATEADD(DAY, -2, @Ahora), DATEADD(DAY, -1, @Ahora)
FROM @Fr f JOIN @Art a ON a.N = (f.N + 2) % 4
WHERE f.N % 4 = 1;

-- Las que ya liberaron su franja: rechazadas (con motivo), canceladas y vencidas, de la Sala del Mar.
INSERT INTO dbo.CitasDeAgenda (AgendaId, FranjaId, AnfitrionId, VisitanteId, Estado, MensajeInicial, MotivoDeLaDecision, CanceladaPorId,
    VenceUtc, FechaSolicitud, FechaDecision)
SELECT @Agenda, f.Id, a.Id, @Sala_P,
       CASE WHEN f.N IN (6, 12, 18) THEN N'rechazada' WHEN f.N IN (7, 19) THEN N'cancelada' ELSE N'vencida' END,
       N'Nos gustaría escucharlos en vivo.',
       CASE WHEN f.N IN (6, 12, 18) THEN N'Ese día estamos de gira en otra ciudad.' WHEN f.N IN (7, 19) THEN N'Se cruzó un compromiso y no podemos asistir.' ELSE NULL END,
       CASE WHEN f.N IN (7, 19) THEN a.Id ELSE NULL END,
       DATEADD(HOUR, 72, DATEADD(DAY, -6, @Ahora)), DATEADD(DAY, -6, @Ahora), DATEADD(DAY, -3, @Ahora)
FROM @Fr f JOIN @Art a ON a.N = (f.N + 1) % 4
WHERE f.N IN (6, 12, 18, 7, 19, 10, 22);

-- ── Las fotos de todos los participantes (AGE2): retratos y emblemas ilustrados del Banco de la demostración ──────────
-- (los carga `sembrar-demo.sh completa` antes de esta semilla; ninguna es de una persona real).
UPDATE p SET FotoArchivoId = a.IdArchivo
FROM dbo.ParticipantesDeCitas p
JOIN (VALUES
    (N'Valentina Ocampo', N'demo-completa-persona-valentina.jpg'),
    (N'Andrés Muñoz', N'demo-completa-persona-andres.jpg'),
    (N'José Caicedo', N'demo-completa-persona-jose.jpg'),
    (N'Camilo Rojas', N'demo-completa-persona-camilo.jpg'),
    (N'Mariana Palacios', N'demo-completa-persona-mariana.jpg'),
    (N'Diana Zapata', N'demo-completa-persona-diana.jpg'),
    (N'Programación del Festival de la Costa', N'demo-completa-org-festival-costa.jpg'),
    (N'Booking de la Sala del Mar', N'demo-completa-org-sala-del-mar.jpg')
) m (Nombre, Archivo) ON p.Nombre = m.Nombre
JOIN dbo.Archivos a ON a.NombreOriginal = m.Archivo
WHERE p.AgendaId = @Agenda;

COMMIT TRANSACTION;
