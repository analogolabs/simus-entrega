/*
    SIMUS · Demostración de espacios para música en vivo (docs/referencia/25-modulos-restantes.md), paso 2 de 2: cinco espacios en distintos estados.

    Va DESPUÉS de `V20261106_11__demostracion_completa.sql`, de cuyo universo cuelga (las
    organizaciones y las cuentas de dominio .test). Cada fila imita lo que habría escrito la API en
    ese paso: literales de estado, procedencia `externo` y el historial de estados con su motivo.

      Sala Cantaclaro (Cantaclaro, Popayán) ............................ publicado; sala cerrada con aforo y accesible.
      Casa Llanera de Música en Yopal (Llano Adentro, Yopal) ........... publicado; escenario mixto.
      Café Marimba del Pacífico (responsable independiente Valentina
          Ocampo, Buenaventura) ........................................ publicado SIN organización.
      Auditorio Tayrona de la Sierra (Sonora del Caribe, Santa Marta) .. en revisión.
      Salón de Bandas del Oriente (Bandas del Oriente, Rionegro) ....... ajustes solicitados, con su motivo.

    TODO ES FICTICIO Y VEROSÍMIL. Los tipos y el equipamiento salen de los vocabularios propuestos
    de V20261110_81. Se retira con `V20261110_82__demostracion_espacios_retiro.sql` y se aplica con
    ./scripts/demo/sembrar-demo.sh completa.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Ahora datetime2 = SYSUTCDATETIME();
DECLARE @Gestor int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'gestor@simus.test');
DECLARE @Lucia int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'lucia.ramirez@cantaclaro.test');
DECLARE @Camilo int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'camilo.rojas@llanoadentro.test');
DECLARE @Mariana int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'mariana.palacios@sonoracaribe.test');
DECLARE @Diana int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'diana.zapata@bandasoriente.test');
DECLARE @Valentina int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'valentina.ocampo@correo.test');

DECLARE @Cantaclaro int = (SELECT IdEntidad FROM dbo.Entidades WHERE Nombre = N'Corporación Cultural Cantaclaro');
DECLARE @Llano int = (SELECT IdEntidad FROM dbo.Entidades WHERE Nombre = N'Colectivo Llano Adentro');
DECLARE @Sonora int = (SELECT IdEntidad FROM dbo.Entidades WHERE Nombre = N'Fundación Sonora del Caribe');
DECLARE @Bandas int = (SELECT IdEntidad FROM dbo.Entidades WHERE Nombre = N'Asociación de Bandas del Oriente Antioqueño');

IF @Lucia IS NULL OR @Camilo IS NULL OR @Mariana IS NULL OR @Diana IS NULL OR @Valentina IS NULL
   OR @Cantaclaro IS NULL OR @Llano IS NULL OR @Sonora IS NULL OR @Bandas IS NULL
BEGIN
    RAISERROR(N'Falta el universo de la siembra completa. Ejecuta antes ./scripts/demo/sembrar-demo.sh completa.', 16, 1);
    RETURN;
END;

DECLARE @T TABLE (Clave nvarchar(20) PRIMARY KEY, Id int NULL, Nombre nvarchar(240), Descripcion nvarchar(max),
    Ambiente nvarchar(20), Aforo int NULL, Accesible bit NULL, Horario nvarchar(2000), Correo nvarchar(180), Telefono nvarchar(80),
    Web nvarchar(500), Instagram nvarchar(500), Facebook nvarchar(500), Otro nvarchar(500),
    Nivel nvarchar(40), Dep char(2), Mun char(5), Lugar nvarchar(300),
    Org int NULL, Persona int NULL, Estado nvarchar(80), Motivo nvarchar(1200), Creador int,
    Alta datetime2, Envio datetime2 NULL, Publicacion datetime2 NULL);

INSERT INTO @T VALUES
 (N'sala', NULL, N'Sala Cantaclaro',
  N'Sala de conciertos de la Corporación Cultural Cantaclaro en el centro de Popayán. Programa música de cámara, músicas campesinas y ciclos de música tradicional caucana, con tarima fija, sonido y camerinos para las agrupaciones invitadas.',
  N'cerrado', 120, 1, N'Funciones de jueves a sábado a las 7:00 p. m. Entrada por la carrera 6; rampa de acceso y baño adaptado en el primer piso.',
  N'sala@cantaclaro.test', N'+57 310 000 0171', N'https://sala.cantaclaro.test', N'https://instagram.com/salacantaclaro.test', NULL, NULL,
  N'municipal', '19', '19001', N'Carrera 6 # 5-22, centro histórico',
  @Cantaclaro, NULL, N'publicado', NULL, @Lucia, DATEADD(DAY, -120, @Ahora), DATEADD(DAY, -118, @Ahora), DATEADD(DAY, -115, @Ahora)),
 (N'casa', NULL, N'Casa Llanera de Música en Yopal',
  N'Patio y salón con escenario techado donde se presentan arpistas, cuatristas y cantadores de joropo. Abre con ciclos de música llanera y con noches abiertas para músicos que están empezando.',
  N'mixto', 300, 0, N'Viernes y sábados desde las 6:00 p. m.; domingos, tarde de joropo en familia.',
  N'casa@llanoadentro.test', N'+57 310 000 0172', NULL, N'https://instagram.com/casallanera.test', NULL, NULL,
  N'municipal', '85', '85001', N'Calle 30 # 21-15, barrio El Remanso',
  @Llano, NULL, N'publicado', NULL, @Camilo, DATEADD(DAY, -90, @Ahora), DATEADD(DAY, -88, @Ahora), DATEADD(DAY, -85, @Ahora)),
 (N'cafe', NULL, N'Café Marimba del Pacífico',
  N'Café en Buenaventura, a cargo de una responsable independiente, con presentaciones de marimba de chonta, cununos y bombos los fines de semana. Es un espacio pequeño y cercano, pensado para agrupaciones locales.',
  N'cerrado', 60, 0, N'Sábados y domingos desde las 5:00 p. m.; otras fechas por reserva.',
  N'cafemarimba@correo.test', N'+57 310 000 0173', NULL, NULL, NULL, N'https://cafemarimba.test/programacion',
  N'municipal', '76', '76109', N'Barrio Pueblo Nuevo, frente al parque',
  NULL, @Valentina, N'publicado', NULL, @Valentina, DATEADD(DAY, -60, @Ahora), DATEADD(DAY, -58, @Ahora), DATEADD(DAY, -55, @Ahora)),
 (N'auditorio', NULL, N'Auditorio Tayrona de la Sierra',
  N'Auditorio de la Fundación Sonora del Caribe en Santa Marta para presentar gaitas, tambores y bullerengue. Cuenta con tarima, sonido y camerinos; se usa también para ensayos abiertos y encuentros de cantadoras y tamboreros mayores.',
  N'cerrado', 200, 1, N'Programación de jueves a domingo; ensayos abiertos los miércoles por la tarde.',
  N'auditorio@sonoracaribe.test', N'+57 310 000 0174', NULL, NULL, NULL, NULL,
  N'municipal', '47', '47001', N'Calle 17 # 4-40, barrio Pescaíto',
  @Sonora, NULL, N'en_revision', NULL, @Mariana, DATEADD(DAY, -6, @Ahora), DATEADD(DAY, -5, @Ahora), NULL),
 (N'salon', NULL, N'Salón de Bandas del Oriente',
  N'Salón comunitario en Rionegro donde ensayan y se presentan las bandas de viento del Oriente antioqueño, y donde se hacen los conciertos previos a los encuentros regionales.',
  N'cerrado', NULL, NULL, NULL,
  N'salon@bandasoriente.test', NULL, NULL, NULL, NULL, NULL,
  N'municipal', '05', '05615', NULL,
  @Bandas, NULL, N'ajustes_solicitados', N'Falta la dirección o una referencia del lugar, y cuántas personas caben en el salón.', @Diana, DATEADD(DAY, -4, @Ahora), DATEADD(DAY, -3, @Ahora), NULL);

-- Los ajustes se dijeron al día siguiente del envío: el motivo nace con la decisión.
INSERT INTO dbo.Espacios (NombreEspacio, Descripcion, Ambiente, AforoMaximo, EsAccesible, HorarioYProgramacion, CorreoEspacio, TelefonoEspacio, SitioWebEspacio,
    InstagramEspacio, FacebookEspacio, OtroEnlaceEspacio, NivelCobertura, CodigoDepartamento, CodigoMunicipio, LugarEspecifico,
    OrganizacionPrincipalId, UsuarioResponsableId, EstadoRegistro, MotivoDeLaDecision, Activo, IdUsuarioCreador, FechaCreacion,
    FechaActualizacion, FechaEnvioARevision, FechaPublicacion)
SELECT Nombre, Descripcion, Ambiente, Aforo, Accesible, Horario, Correo, Telefono, Web, Instagram, Facebook, Otro, Nivel, Dep, Mun, Lugar,
       Org, Persona, Estado, Motivo, 1, Creador, Alta, COALESCE(Publicacion, Envio, Alta), Envio, Publicacion
FROM @T;

UPDATE t SET Id = x.IdEspacio FROM @T t JOIN dbo.Espacios x ON x.NombreEspacio = t.Nombre;

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'espacios', CAST(Id AS nvarchar(120)), N'externo', Org, Creador, Alta FROM @T;

-- Equipamiento, tipos y música que programa, con los vocabularios propuestos.
INSERT INTO dbo.EspaciosEquipamiento (EspacioId, EquipamientoEspacioId, FechaCreacion)
SELECT t.Id, s.IdEquipamientoEspacio, t.Alta FROM @T t
JOIN (VALUES (N'sala', N'sonido'), (N'sala', N'iluminacion'), (N'sala', N'tarima'), (N'sala', N'camerinos'),
             (N'casa', N'sonido'), (N'casa', N'tarima'),
             (N'cafe', N'sonido'),
             (N'auditorio', N'sonido'), (N'auditorio', N'tarima'), (N'auditorio', N'camerinos'), (N'auditorio', N'grabacion-transmision')) v(Clave, Slug) ON v.Clave = t.Clave
JOIN dbo.EquipamientoDeEspacio s ON s.Slug = v.Slug;

INSERT INTO dbo.EspaciosTipos (EspacioId, TipoEspacioId, FechaCreacion)
SELECT t.Id, f.IdTipoEspacio, t.Alta FROM @T t
JOIN (VALUES (N'sala', N'sala-de-conciertos'), (N'sala', N'casa-de-cultura'),
             (N'casa', N'escenario-al-aire-libre'), (N'casa', N'casa-de-cultura'),
             (N'cafe', N'restaurante-cafe'),
             (N'auditorio', N'auditorio'),
             (N'salon', N'otro')) v(Clave, Slug) ON v.Clave = t.Clave
JOIN dbo.TiposDeEspacio f ON f.Slug = v.Slug;

DECLARE @PmCampesinas int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas campesinas%');
DECLARE @PmTradicionales int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas populares tradicionales%');
DECLARE @PmAfro int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas de comunidades negras%');
DECLARE @PmBandas int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas sinfónicas%');

INSERT INTO dbo.EspaciosPracticasMusicales (EspacioId, PracticaMusicalId, FechaCreacion)
SELECT t.Id, v.Id, t.Alta FROM @T t
JOIN (VALUES (N'sala', @PmCampesinas), (N'sala', @PmTradicionales),
             (N'casa', @PmTradicionales), (N'cafe', @PmAfro), (N'auditorio', @PmAfro), (N'salon', @PmBandas)) v(Clave, Id) ON v.Clave = t.Clave
WHERE v.Id IS NOT NULL;

-- El historial de estados, como lo habría escrito la API.
INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, IdUsuario, OrganizacionId, Fecha)
SELECT N'espacios', CAST(Id AS nvarchar(120)), N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, Creador, Org, Envio
FROM @T WHERE Envio IS NOT NULL;

INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, IdUsuario, OrganizacionId, Fecha)
SELECT N'espacios', CAST(Id AS nvarchar(120)), N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Gestor, Org, Publicacion
FROM @T WHERE Publicacion IS NOT NULL;

INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, IdUsuario, OrganizacionId, Fecha)
SELECT N'espacios', CAST(Id AS nvarchar(120)), N'en_revision', N'ajustes_solicitados', N'DevueltoParaCorregir', Motivo, Motivo, @Gestor, Org, DATEADD(DAY, 1, Envio)
FROM @T WHERE Estado = N'ajustes_solicitados';
