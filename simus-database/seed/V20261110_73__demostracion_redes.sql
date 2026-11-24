/*
    SIMUS · Demostración de redes y documentación (#56), paso 2 de 2: cinco redes en todos los estados.

    Va DESPUÉS de `V20261106_11__demostracion_completa.sql`, de cuyo universo cuelga (las
    organizaciones y las cuentas de dominio .test). Cada fila imita lo que habría escrito la API en
    ese paso: literales de estado, procedencia `externo` y el historial de estados con su motivo.

      Archivo Sonoro del Cauca (Cantaclaro, Popayán) ................ publicado; archivo, con cita previa.
      Centro de Documentación del Joropo Llanero (Llano Adentro,
          Yopal) ..................................................... publicado; acceso abierto.
      Fonoteca del Pacífico (investigadora independiente Valentina
          Ocampo, Buenaventura) ...................................... publicada SIN organización.
      Red de Investigadores de Músicas del Caribe (Sonora del Caribe,
          Santa Marta) ............................................... en revisión.
      Archivo de Bandas del Oriente (Bandas del Oriente, Rionegro) .. ajustes solicitados, con su motivo.

    TODO ES FICTICIO Y VEROSÍMIL. Las formas de acceso y los formatos salen de los vocabularios
    propuestos de V20261110_71. Se retira con `V20261110_72__demostracion_redes_retiro.sql` y se
    aplica con ./scripts/demo/sembrar-demo.sh completa.
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
    Tipo nvarchar(40), Abierto bit, Acervos nvarchar(2000), Correo nvarchar(180), Telefono nvarchar(80),
    Web nvarchar(500), Instagram nvarchar(500), Facebook nvarchar(500), Otro nvarchar(500),
    Nivel nvarchar(40), Dep char(2), Mun char(5), Lugar nvarchar(300),
    Org int NULL, Persona int NULL, Estado nvarchar(80), Motivo nvarchar(1200), Creador int,
    Alta datetime2, Envio datetime2 NULL, Publicacion datetime2 NULL);

INSERT INTO @T VALUES
 (N'cauca', NULL, N'Archivo Sonoro del Cauca',
  N'Archivo de Popayán que conserva y digitaliza grabaciones de campo, programas de radio y registros de fiestas y ensambles de la región. Atiende a investigadores, docentes y a las agrupaciones que quieren recuperar su propia memoria sonora.',
  N'archivo', 0, N'Grabaciones de campo del Macizo colombiano (1978-2005), programas de radio comunitaria, fotografías de fiestas patronales y archivos de agrupaciones locales.',
  N'archivo@cantaclaro.test', N'+57 310 000 0171', N'https://archivo.cantaclaro.test', NULL, NULL, NULL,
  N'municipal', '19', '19001', N'Calle 4 # 5-45, centro histórico',
  @Cantaclaro, NULL, N'publicado', NULL, @Lucia, DATEADD(DAY, -120, @Ahora), DATEADD(DAY, -118, @Ahora), DATEADD(DAY, -115, @Ahora)),
 (N'joropo', NULL, N'Centro de Documentación del Joropo Llanero',
  N'Centro de documentación de Yopal sobre el joropo y las músicas de los Llanos orientales. Reúne partituras, discos, publicaciones y entrevistas con cultores. La consulta en sala es abierta y también hay un repositorio en línea.',
  N'centro_de_documentacion', 1, N'Partituras de joropo, discos de vinilo, revistas y libros sobre música llanera y entrevistas a arpistas, cuatristas y copleros.',
  N'documentacion@llanoadentro.test', N'+57 310 000 0172', N'https://joropo.llanoadentro.test', N'https://instagram.com/joropollanero.test', NULL, NULL,
  N'municipal', '85', '85001', NULL,
  @Llano, NULL, N'publicado', NULL, @Camilo, DATEADD(DAY, -90, @Ahora), DATEADD(DAY, -88, @Ahora), DATEADD(DAY, -85, @Ahora)),
 (N'fonoteca', NULL, N'Fonoteca del Pacífico',
  N'Colección de una investigadora independiente en Buenaventura: grabaciones de cantaoras y marimberos del Pacífico sur y fotografías de fiestas y velorios. Se consulta con cita previa y se comparten copias digitales con las familias.',
  N'coleccion', 0, N'Grabaciones de arrullos, alabaos y currulaos (1998-2020) y fotografías de la fiesta de San Buenaventura.',
  N'fonoteca.valentina@correo.test', N'+57 310 000 0173', NULL, NULL, NULL, N'https://fonotecapacifico.test',
  N'municipal', '76', '76109', N'Barrio Pueblo Nuevo',
  NULL, @Valentina, N'publicado', NULL, @Valentina, DATEADD(DAY, -60, @Ahora), DATEADD(DAY, -58, @Ahora), DATEADD(DAY, -55, @Ahora)),
 (N'caribe', NULL, N'Red de Investigadores de Músicas del Caribe',
  N'Red de docentes, investigadores y cultores de Santa Marta y la región Caribe que intercambia fuentes, organiza seminarios y mantiene un repositorio compartido de bibliografía sobre gaitas, tambores y bullerengue.',
  N'red', 1, N'Bibliografía comentada, tesis y artículos sobre músicas del Caribe colombiano y registros de seminarios.',
  N'red@sonoracaribe.test', N'+57 310 000 0174', NULL, NULL, NULL, NULL,
  N'departamental', '47', NULL, NULL,
  @Sonora, NULL, N'en_revision', NULL, @Mariana, DATEADD(DAY, -6, @Ahora), DATEADD(DAY, -5, @Ahora), NULL),
 (N'bandas', NULL, N'Archivo de Bandas del Oriente',
  N'Archivo de las bandas sinfónicas del Oriente antioqueño: repertorios, partituras de arreglos locales y fotografías de encuentros.',
  N'archivo', 0, NULL,
  N'archivo@bandasoriente.test', NULL, NULL, NULL, NULL, NULL,
  N'municipal', '05', '05615', NULL,
  @Bandas, NULL, N'ajustes_solicitados', N'Falta precisar qué acervos conserva el archivo y cómo se pueden consultar.', @Diana, DATEADD(DAY, -20, @Ahora), DATEADD(DAY, -14, @Ahora), NULL);

-- Los ajustes se dijeron al día siguiente del envío: el motivo nace con la decisión.
INSERT INTO dbo.Redes (NombreRed, Descripcion, TipoDeNodo, AccesoAbierto, AcervosYColecciones, CorreoRed, TelefonoRed, SitioWebRed,
    InstagramRed, FacebookRed, OtroEnlaceRed, NivelCobertura, CodigoDepartamento, CodigoMunicipio, LugarEspecifico,
    OrganizacionPrincipalId, UsuarioResponsableId, EstadoRegistro, MotivoDeLaDecision, Activo, IdUsuarioCreador, FechaCreacion,
    FechaActualizacion, FechaEnvioARevision, FechaPublicacion)
SELECT Nombre, Descripcion, Tipo, Abierto, Acervos, Correo, Telefono, Web, Instagram, Facebook, Otro, Nivel, Dep, Mun, Lugar,
       Org, Persona, Estado, Motivo, 1, Creador, Alta, COALESCE(Publicacion, Envio, Alta), Envio, Publicacion
FROM @T;

UPDATE t SET Id = x.IdRed FROM @T t JOIN dbo.Redes x ON x.NombreRed = t.Nombre;

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'redes', CAST(Id AS nvarchar(120)), N'externo', Org, Creador, Alta FROM @T;

-- Formas de acceso, formatos y prácticas, con los vocabularios propuestos de V20261110_71.
INSERT INTO dbo.RedesFormasDeAcceso (RedId, FormaDeAccesoId, FechaCreacion)
SELECT t.Id, s.IdFormaDeAcceso, t.Alta FROM @T t
JOIN (VALUES (N'cauca', N'consulta-en-sala'), (N'cauca', N'con-cita-previa'), (N'cauca', N'copia-digital'),
             (N'joropo', N'consulta-en-sala'), (N'joropo', N'consulta-en-linea'), (N'joropo', N'visitas-guiadas'),
             (N'fonoteca', N'con-cita-previa'), (N'fonoteca', N'copia-digital'),
             (N'caribe', N'consulta-en-linea'), (N'caribe', N'solo-investigadores'),
             (N'bandas', N'con-cita-previa')) v(Clave, Slug) ON v.Clave = t.Clave
JOIN dbo.FormasDeAccesoDeRed s ON s.Slug = v.Slug;

INSERT INTO dbo.RedesFormatos (RedId, FormatoId, FechaCreacion)
SELECT t.Id, f.IdFormato, t.Alta FROM @T t
JOIN (VALUES (N'cauca', N'sonoro'), (N'cauca', N'fotografico-y-grafico'), (N'cauca', N'digital'),
             (N'joropo', N'partituras'), (N'joropo', N'sonoro'), (N'joropo', N'libros-y-periodicos'),
             (N'fonoteca', N'sonoro'), (N'fonoteca', N'fotografico-y-grafico'),
             (N'caribe', N'libros-y-periodicos'), (N'caribe', N'digital'),
             (N'bandas', N'partituras'), (N'bandas', N'fotografico-y-grafico')) v(Clave, Slug) ON v.Clave = t.Clave
JOIN dbo.FormatosDeDocumentacion f ON f.Slug = v.Slug;

DECLARE @PmCampesinas int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas campesinas%');
DECLARE @PmTradicionales int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas populares tradicionales%');
DECLARE @PmAfro int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas de comunidades negras%');
DECLARE @PmBandas int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas sinfónicas%');

INSERT INTO dbo.RedesPracticasMusicales (RedId, PracticaMusicalId, FechaCreacion)
SELECT t.Id, v.Id, t.Alta FROM @T t
JOIN (VALUES (N'cauca', @PmCampesinas), (N'cauca', @PmTradicionales),
             (N'joropo', @PmTradicionales), (N'fonoteca', @PmAfro), (N'caribe', @PmAfro), (N'bandas', @PmBandas)) v(Clave, Id) ON v.Clave = t.Clave
WHERE v.Id IS NOT NULL;

-- El historial de estados, como lo habría escrito la API.
INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, IdUsuario, OrganizacionId, Fecha)
SELECT N'redes', CAST(Id AS nvarchar(120)), N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, Creador, Org, Envio
FROM @T WHERE Envio IS NOT NULL;

INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, IdUsuario, OrganizacionId, Fecha)
SELECT N'redes', CAST(Id AS nvarchar(120)), N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Gestor, Org, Publicacion
FROM @T WHERE Publicacion IS NOT NULL;

INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, IdUsuario, OrganizacionId, Fecha)
SELECT N'redes', CAST(Id AS nvarchar(120)), N'en_revision', N'ajustes_solicitados', N'DevueltoParaCorregir', Motivo, Motivo, @Gestor, Org, DATEADD(DAY, 1, Envio)
FROM @T WHERE Estado = N'ajustes_solicitados';
