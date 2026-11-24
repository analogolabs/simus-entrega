/*
    SIMUS · Demostración del directorio de personas (DIR, docs/desarrollo/19-cuentas-y-organizaciones.md §19.13). Va DESPUÉS de
    `V20261106_11__demostracion_completa.sql`, `V20261112_41__demostracion_perfil_enriquecido.sql` y
    `V20261117_60__clasificacion_del_perfil_publico.sql`.

    1. Clasifica a las cuatro personas con perfil público de la demostración.
    2. Añade seis personas de demostración (cuentas @directorio.test, SIN datos reales) con perfil publicado, para que la
       búsqueda por servicio y por zona tenga con qué responder.
    IDEMPOTENTE: retira primero lo suyo (correos @directorio.test) y vuelve a sembrar. No es una migración: vive en seed/ y
    solo la aplica ./scripts/demo/sembrar-demo.sh directorio.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- 0. Retiro de lo propio ----------------------------------------------------------------------
DECLARE @Propias TABLE (Id int PRIMARY KEY);
INSERT INTO @Propias (Id) SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico LIKE N'%@directorio.test';
DELETE FROM dbo.PerfilesPublicosClasificaciones WHERE IdUsuario IN (SELECT Id FROM @Propias);
DELETE FROM dbo.PerfilesPublicosPracticas WHERE IdUsuario IN (SELECT Id FROM @Propias);
DELETE FROM dbo.PerfilesPublicosEnlaces WHERE IdUsuario IN (SELECT Id FROM @Propias);
DELETE FROM dbo.PerfilesPublicos WHERE IdUsuario IN (SELECT Id FROM @Propias);
DELETE FROM dbo.AutorizacionesDatos WHERE IdUsuario IN (SELECT Id FROM @Propias);
DELETE FROM dbo.UsuariosRoles WHERE IdUsuario IN (SELECT Id FROM @Propias);
DELETE FROM dbo.Usuarios WHERE IdUsuario IN (SELECT Id FROM @Propias);

DECLARE @Hash nvarchar(500) = (SELECT HashContrasena FROM dbo.Usuarios WHERE CorreoElectronico = N'externo@simus.test');
DECLARE @RolExterno int = (SELECT IdRol FROM dbo.Roles WHERE NombreRol = N'externo');
IF @Hash IS NULL OR @RolExterno IS NULL
BEGIN
    RAISERROR(N'Faltan las cuentas de arranque: inicia la API en local antes de sembrar.', 16, 1);
    RETURN;
END;
DECLARE @Ahora datetime2(0) = SYSUTCDATETIME();
DECLARE @PmTradicionales int = (SELECT TOP (1) IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas populares tradicionales%');
DECLARE @PmVocales int = (SELECT TOP (1) IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas vocales%');
DECLARE @PmComunitarias int = (SELECT TOP (1) IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas comunitarias%');

-- 1. Las personas nuevas ------------------------------------------------------------------------
DECLARE @N TABLE (Clave nvarchar(20) PRIMARY KEY, Correo nvarchar(180), Nombre nvarchar(120), Municipio nvarchar(10), Corta nvarchar(280),
                  Roles nvarchar(400), Servicios nvarchar(400), Instrumentos nvarchar(400), Territorios nvarchar(100), Id int NULL);
INSERT INTO @N (Clave, Correo, Nombre, Municipio, Corta, Roles, Servicios, Instrumentos, Territorios) VALUES
 (N'sofia',  N'sofia.benitez@directorio.test',  N'Sofía Benítez',  N'76001', N'Docente de violín y guitarra, con experiencia en procesos de formación comunitaria.', N'docente,interprete', N'clases,presentaciones', N'cordofonos', N'76,19'),
 (N'tomas',  N'tomas.guerrero@directorio.test', N'Tomás Guerrero', N'05001', N'Lutier de cuerdas pulsadas: construcción, reparación y restauración.',               N'luthier',           N'luteria,clases',      N'cordofonos', N'05'),
 (N'ines',   N'ines.cuesta@directorio.test',    N'Inés Cuesta',    N'76109', N'Cantadora y productora de música del Pacífico.',                                         N'cantante,productor', N'presentaciones,grabacion', N'voz,idiofonos', N'76,52'),
 (N'raul',   N'raul.mendez@directorio.test',    N'Raúl Méndez',    N'11001', N'Sonidista e ingeniero de grabación con estudio propio.',                                 N'sonidista,productor', N'grabacion,sonido',     N'electrofonos', N'11'),
 (N'dora',   N'dora.pineda@directorio.test',    N'Dora Pineda',    N'08001', N'Gestora cultural: festivales, circulación y proyectos con comunidades.',                 N'gestor',            N'gestion,asesoria',    N'', N'08,47'),
 (N'martin', N'martin.salas@directorio.test',   N'Martín Salas',   N'19001', N'Investigador de músicas tradicionales del Cauca y docente universitario.',               N'investigador,docente', N'investigacion,clases', N'', N'19');

INSERT INTO dbo.Usuarios (NombreCompleto, CorreoElectronico, HashContrasena, CanalAcceso, TipoPerfil, Activo,
    FechaCreacion, FechaActualizacion, UltimoAcceso, CorreoConfirmado, FechaConfirmacionCorreo,
    PrimerNombre, PrimerApellido, DebeCambiarContrasena, PerfilCompletado)
SELECT Nombre, Correo, @Hash, N'externo', N'individual', 1, DATEADD(DAY, -30, @Ahora), DATEADD(DAY, -30, @Ahora), DATEADD(DAY, -2, @Ahora),
       1, DATEADD(DAY, -30, @Ahora), LEFT(Nombre, CHARINDEX(N' ', Nombre) - 1), SUBSTRING(Nombre, CHARINDEX(N' ', Nombre) + 1, 100), 0, 1
FROM @N;
UPDATE n SET Id = u.IdUsuario FROM @N n JOIN dbo.Usuarios u ON u.CorreoElectronico = n.Correo;
INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol, FechaCreacion) SELECT Id, @RolExterno, DATEADD(DAY, -30, @Ahora) FROM @N;

INSERT INTO dbo.PerfilesPublicos (IdUsuario, NombreVisible, CodigoMunicipio, BiografiaCorta, Visibilidad, FechaCreacion, FechaActualizacion)
SELECT Id, Nombre, Municipio, Corta, N'publico', DATEADD(DAY, -20, @Ahora), DATEADD(DAY, -5, @Ahora) FROM @N;

INSERT INTO dbo.PerfilesPublicosPracticas (IdUsuario, IdPracticaMusical)
SELECT Id, @PmTradicionales FROM @N WHERE Clave IN (N'sofia', N'tomas', N'martin') AND @PmTradicionales IS NOT NULL
UNION ALL SELECT Id, @PmVocales FROM @N WHERE Clave = N'ines' AND @PmVocales IS NOT NULL
UNION ALL SELECT Id, @PmComunitarias FROM @N WHERE Clave IN (N'sofia', N'dora') AND @PmComunitarias IS NOT NULL;

INSERT INTO dbo.AutorizacionesDatos (Finalidad, IdPolitica, Version, TextoAceptado, TextoReconstruido, IdUsuario, CorreoTitular, Origen, ReferenciaId, FechaOtorgada)
SELECT p.Clave, p.IdPolitica, p.Version, p.Texto, 0, n.Id, n.Correo, N'cuenta', NULL, DATEADD(DAY, -20, @Ahora)
FROM @N n JOIN dbo.PoliticasDatos p ON p.Vigente = 1 AND p.Clave IN (N'perfil_publico', N'tratamiento', N'terminos');

-- 2. Clasificación: las nuevas y las cuatro de la demostración ---------------------------------------
INSERT INTO dbo.PerfilesPublicosClasificaciones (IdUsuario, Dimension, Codigo)
SELECT n.Id, N'rol', LTRIM(RTRIM(v.value)) FROM @N n CROSS APPLY STRING_SPLIT(n.Roles, N',') v WHERE LEN(v.value) > 0
UNION SELECT n.Id, N'servicio', LTRIM(RTRIM(v.value)) FROM @N n CROSS APPLY STRING_SPLIT(n.Servicios, N',') v WHERE LEN(v.value) > 0
UNION SELECT n.Id, N'instrumento', LTRIM(RTRIM(v.value)) FROM @N n CROSS APPLY STRING_SPLIT(n.Instrumentos, N',') v WHERE LEN(v.value) > 0
UNION SELECT n.Id, N'territorio', LTRIM(RTRIM(v.value)) FROM @N n CROSS APPLY STRING_SPLIT(n.Territorios, N',') v WHERE LEN(v.value) > 0;

DECLARE @D TABLE (Correo nvarchar(180), Dimension nvarchar(12), Codigo nvarchar(40));
INSERT INTO @D VALUES
 (N'lucia.ramirez@cantaclaro.test', N'rol', N'cantante'), (N'lucia.ramirez@cantaclaro.test', N'rol', N'gestor'),
 (N'lucia.ramirez@cantaclaro.test', N'servicio', N'presentaciones'), (N'lucia.ramirez@cantaclaro.test', N'servicio', N'gestion'),
 (N'lucia.ramirez@cantaclaro.test', N'instrumento', N'voz'), (N'lucia.ramirez@cantaclaro.test', N'territorio', N'19'),
 (N'andres.munoz@cantaclaro.test', N'rol', N'interprete'), (N'andres.munoz@cantaclaro.test', N'rol', N'docente'),
 (N'andres.munoz@cantaclaro.test', N'servicio', N'clases'), (N'andres.munoz@cantaclaro.test', N'servicio', N'presentaciones'),
 (N'andres.munoz@cantaclaro.test', N'instrumento', N'cordofonos'), (N'andres.munoz@cantaclaro.test', N'territorio', N'19'),
 (N'camilo.rojas@llanoadentro.test', N'rol', N'investigador'), (N'camilo.rojas@llanoadentro.test', N'rol', N'cultor'),
 (N'camilo.rojas@llanoadentro.test', N'servicio', N'investigacion'), (N'camilo.rojas@llanoadentro.test', N'territorio', N'85'),
 (N'valentina.ocampo@correo.test', N'rol', N'investigador'), (N'valentina.ocampo@correo.test', N'rol', N'gestor'),
 (N'valentina.ocampo@correo.test', N'servicio', N'investigacion'), (N'valentina.ocampo@correo.test', N'servicio', N'asesoria'),
 (N'valentina.ocampo@correo.test', N'territorio', N'05');
INSERT INTO dbo.PerfilesPublicosClasificaciones (IdUsuario, Dimension, Codigo)
SELECT u.IdUsuario, d.Dimension, d.Codigo
FROM @D d JOIN dbo.Usuarios u ON u.CorreoElectronico = d.Correo
JOIN dbo.PerfilesPublicos pp ON pp.IdUsuario = u.IdUsuario
WHERE NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosClasificaciones c WHERE c.IdUsuario = u.IdUsuario AND c.Dimension = d.Dimension AND c.Codigo = d.Codigo);
