/*
    SIMUS · Demostración de talleres de lutería (#55), paso 2 de 2: cinco talleres en todos los estados.

    Va DESPUÉS de `V20261106_11__demostracion_completa.sql`, de cuyo universo cuelga (las
    organizaciones y las cuentas de dominio .test). Cada fila imita lo que habría escrito la API en
    ese paso: literales de estado, procedencia `externo` y el historial de estados con su motivo.

      Taller de Lutería Los Cedros (Cantaclaro, Popayán) ............ publicado; construcción y reparación
                                                                       de cordófonos frotados y pulsados.
      Lutería Llanera de Arpas y Cuatros (Llano Adentro, Yopal) ..... publicado; itinerante, con aprendices.
      Taller de Marimbas de Chonta del Pacífico (lutier independiente
          Valentina Ocampo, Buenaventura) ........................... publicado SIN organización.
      Taller de Gaitas y Tambores de la Sierra (Sonora del Caribe,
          Santa Marta) ............................................... en revisión.
      Lutería de Bandas del Oriente (Bandas del Oriente, Rionegro) .. ajustes solicitados, con su motivo.

    TODO ES FICTICIO Y VEROSÍMIL. Los instrumentos y las familias salen de los vocabularios propuestos
    de docs/referencia/27-fuentes-de-luteria.md; no se inventan instrumentos regionales como vocabulario. Se retira con
    `V20261110_52__demostracion_talleres_retiro.sql` y se aplica con ./scripts/demo/sembrar-demo.sh completa.
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
    Modalidad nvarchar(20), Aprendices bit, Saberes nvarchar(2000), Correo nvarchar(180), Telefono nvarchar(80),
    Web nvarchar(500), Instagram nvarchar(500), Facebook nvarchar(500), Otro nvarchar(500),
    Nivel nvarchar(40), Dep char(2), Mun char(5), Lugar nvarchar(300),
    Org int NULL, Persona int NULL, Estado nvarchar(80), Motivo nvarchar(1200), Creador int,
    Alta datetime2, Envio datetime2 NULL, Publicacion datetime2 NULL);

INSERT INTO @T VALUES
 (N'cedros', NULL, N'Taller de Lutería Los Cedros',
  N'Taller de Popayán que construye y repara guitarras, tiples y violines. Trabaja por encargo y mantiene un espacio abierto los sábados para que los músicos de la región lleven sus instrumentos a puesta a punto. Desde 2011 forma aprendices en una escuela-taller junto a Cantaclaro.',
  N'fijo', 1, N'Encolado en caliente, barnizado a muñequilla, tapas armónicas de pino y cedro, ajuste de puentes y cejillas.',
  N'loscedros@cantaclaro.test', N'+57 310 000 0161', N'https://loscedros.cantaclaro.test', N'https://instagram.com/loscedros.test', N'https://facebook.com/loscedros.test', NULL,
  N'municipal', '19', '19001', N'Carrera 6 # 5-22, barrio Bolívar',
  @Cantaclaro, NULL, N'publicado', NULL, @Lucia, DATEADD(DAY, -120, @Ahora), DATEADD(DAY, -118, @Ahora), DATEADD(DAY, -115, @Ahora)),
 (N'llanero', NULL, N'Lutería Llanera de Arpas y Cuatros',
  N'Taller itinerante de luthiers de Casanare. Construye y repara arpas llaneras, cuatros y bandolas, y viaja a las veredas de Yopal y Paz de Ariporo con jornadas de reparación y de enseñanza para músicos de joropo.',
  N'itinerante', 1, N'Talla de cajas de arpa en cedro y caoba, encordado en nailon, afinación de cuatros llaneros.',
  N'luteria@llanoadentro.test', N'+57 310 000 0162', NULL, N'https://instagram.com/luteriallanera.test', NULL, NULL,
  N'municipal', '85', '85001', NULL,
  @Llano, NULL, N'publicado', NULL, @Camilo, DATEADD(DAY, -90, @Ahora), DATEADD(DAY, -88, @Ahora), DATEADD(DAY, -85, @Ahora)),
 (N'marimbas', NULL, N'Taller de Marimbas de Chonta del Pacífico',
  N'Taller de una lutier independiente en Buenaventura. Construye marimbas de chonta y cununos, afina teclas y repara instrumentos de agrupaciones del Pacífico. Atiende por encargo y por citas.',
  N'fijo', 0, N'Afinación de teclas de chonta por desgaste, ensamble de resonadores de guadua.',
  N'marimbas.valentina@correo.test', N'+57 310 000 0163', NULL, NULL, NULL, N'https://marimbaspacifico.test/lutieria',
  N'municipal', '76', '76109', N'Barrio Pueblo Nuevo',
  NULL, @Valentina, N'publicado', NULL, @Valentina, DATEADD(DAY, -60, @Ahora), DATEADD(DAY, -58, @Ahora), DATEADD(DAY, -55, @Ahora)),
 (N'gaitas', NULL, N'Taller de Gaitas y Tambores de la Sierra',
  N'Taller de Santa Marta que construye gaitas largas, tamboras y llamadores, y repara tambores de comparsas y de grupos de bullerengue. Trabaja con cantadoras y tamboreros mayores para conservar las medidas y los parches tradicionales.',
  N'colectivo', 1, N'Parches de cuero de cabra curtido, tensado con cuñas, cabezas de gaita en cera de abejas.',
  N'tambores@sonoracaribe.test', N'+57 310 000 0164', NULL, NULL, NULL, NULL,
  N'municipal', '47', '47001', N'Barrio Pescaíto',
  @Sonora, NULL, N'en_revision', NULL, @Mariana, DATEADD(DAY, -6, @Ahora), DATEADD(DAY, -5, @Ahora), NULL),
 (N'bandas', NULL, N'Lutería de Bandas del Oriente',
  N'Taller de mantenimiento de instrumentos de viento de las bandas del Oriente antioqueño: reparación de clarinetes, trompetas y trombones y puesta a punto antes de los encuentros.',
  N'fijo', 0, NULL,
  N'lutieria@bandasoriente.test', NULL, NULL, NULL, NULL, NULL,
  N'municipal', '05', '05615', NULL,
  @Bandas, NULL, N'ajustes_solicitados', N'Falta precisar si el taller construye o solo repara, y a qué familia de instrumentos pertenecen los vientos que atiende.', @Diana, DATEADD(DAY, -20, @Ahora), DATEADD(DAY, -14, @Ahora), NULL);

-- Los ajustes se dijeron al día siguiente del envío: el motivo nace con la decisión.
INSERT INTO dbo.Talleres (NombreTaller, Descripcion, Modalidad, RecibeAprendices, SaberesYTecnicas, CorreoTaller, TelefonoTaller, SitioWebTaller,
    InstagramTaller, FacebookTaller, OtroEnlaceTaller, NivelCobertura, CodigoDepartamento, CodigoMunicipio, LugarEspecifico,
    OrganizacionPrincipalId, UsuarioResponsableId, EstadoRegistro, MotivoDeLaDecision, Activo, IdUsuarioCreador, FechaCreacion,
    FechaActualizacion, FechaEnvioARevision, FechaPublicacion)
SELECT Nombre, Descripcion, Modalidad, Aprendices, Saberes, Correo, Telefono, Web, Instagram, Facebook, Otro, Nivel, Dep, Mun, Lugar,
       Org, Persona, Estado, Motivo, 1, Creador, Alta, COALESCE(Publicacion, Envio, Alta), Envio, Publicacion
FROM @T;

UPDATE t SET Id = x.IdTaller FROM @T t JOIN dbo.Talleres x ON x.NombreTaller = t.Nombre;

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'talleres', CAST(Id AS nvarchar(120)), N'externo', Org, Creador, Alta FROM @T;

-- Servicios, familias y prácticas, con los vocabularios propuestos de docs/referencia/27-fuentes-de-luteria.md.
INSERT INTO dbo.TalleresServicios (TallerId, ServicioTallerId, FechaCreacion)
SELECT t.Id, s.IdServicioTaller, t.Alta FROM @T t
JOIN (VALUES (N'cedros', N'construccion'), (N'cedros', N'reparacion'), (N'cedros', N'ensenanza'),
             (N'llanero', N'construccion'), (N'llanero', N'reparacion'), (N'llanero', N'ensenanza'),
             (N'marimbas', N'construccion'), (N'marimbas', N'afinacion'),
             (N'gaitas', N'construccion'), (N'gaitas', N'reparacion'),
             (N'bandas', N'reparacion'), (N'bandas', N'afinacion')) v(Clave, Slug) ON v.Clave = t.Clave
JOIN dbo.ServiciosDeTaller s ON s.Slug = v.Slug;

INSERT INTO dbo.TalleresFamiliasDeInstrumentos (TallerId, FamiliaInstrumentoId, FechaCreacion)
SELECT t.Id, f.IdFamiliaInstrumento, t.Alta FROM @T t
JOIN (VALUES (N'cedros', N'cordofonos-frotados'), (N'cedros', N'cordofonos-pulsados'),
             (N'llanero', N'cordofonos-pulsados'),
             (N'marimbas', N'idiofonos'), (N'marimbas', N'membranofonos'),
             (N'gaitas', N'aerofonos'), (N'gaitas', N'membranofonos'),
             (N'bandas', N'aerofonos')) v(Clave, Slug) ON v.Clave = t.Clave
JOIN dbo.FamiliasDeInstrumentos f ON f.Slug = v.Slug;

DECLARE @PmCampesinas int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas campesinas%');
DECLARE @PmTradicionales int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas populares tradicionales%');
DECLARE @PmAfro int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas de comunidades negras%');
DECLARE @PmBandas int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas sinfónicas%');

INSERT INTO dbo.TalleresPracticasMusicales (TallerId, PracticaMusicalId, FechaCreacion)
SELECT t.Id, v.Id, t.Alta FROM @T t
JOIN (VALUES (N'cedros', @PmCampesinas), (N'cedros', @PmTradicionales),
             (N'llanero', @PmTradicionales), (N'marimbas', @PmAfro), (N'gaitas', @PmAfro), (N'bandas', @PmBandas)) v(Clave, Id) ON v.Clave = t.Clave
WHERE v.Id IS NOT NULL;

-- El historial de estados, como lo habría escrito la API.
INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, IdUsuario, OrganizacionId, Fecha)
SELECT N'talleres', CAST(Id AS nvarchar(120)), N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, Creador, Org, Envio
FROM @T WHERE Envio IS NOT NULL;

INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, IdUsuario, OrganizacionId, Fecha)
SELECT N'talleres', CAST(Id AS nvarchar(120)), N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Gestor, Org, Publicacion
FROM @T WHERE Publicacion IS NOT NULL;

INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, IdUsuario, OrganizacionId, Fecha)
SELECT N'talleres', CAST(Id AS nvarchar(120)), N'en_revision', N'ajustes_solicitados', N'DevueltoParaCorregir', Motivo, Motivo, @Gestor, Org, DATEADD(DAY, 1, Envio)
FROM @T WHERE Estado = N'ajustes_solicitados';
