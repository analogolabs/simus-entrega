/*
    SIMUS · Demostración completa (#145), paso 3 de 3: el universo de demostración.

    POR QUE EXISTE. Las otras semillas de demostración llenan el mapa con cientos de registros
    delgados: sirven para juzgar el geovisor, no para ver cómo se ve un registro DILIGENCIADO. La
    dirección pidió (6 nov 2026) registros con todos los campos posibles, en todos los estados del
    ciclo de vida y coherentes entre sí, para recorrer el sistema como lo usaría una organización.

    EL UNIVERSO (ficticio, verosímil; dominios .test):

      Corporación Cultural Cantaclaro (Popayán) ..... revisada. Administradora Lucía Ramírez, editores
                                                      Andrés Muñoz y Camilo Rojas, invitaciones en
                                                      los cuatro estados.
        · Festival de Músicas del Macizo ............ publicado; 5 ediciones (realizada ×2, cancelada,
                                                      programada, en preparación); ajustes pedidos y
                                                      atendidos; cabecera con lo aprobado y su historia;
                                                      una propuesta aplicada y otra en revisión; una
                                                      edición observada por la consola.
        · Encuentro de Chirimías del Cauca .......... en revisión, segundo ciclo (ajustes atendidos).
        · Festival de Cuerdas y Bandolas de Silvia .. ajustes solicitados (2 observaciones pendientes): es lo que hace que
                                                      el inicio de Lucía diga «Tienes una cosa que atender».
      Invitación a Lucía para sumarse a Fundación Sonora del Caribe, por aceptar (solicitudes de su cuenta).
        · Mercado de Músicas del Suroccidente ....... publicado, en el marco del Festival del Macizo,
                                                      3 ediciones, una propuesta aplicada.
        · Eventos: publicados, en revisión, borrador y devuelto con motivo.
      Fundación Sonora del Caribe (Santa Marta) ..... revisada.
        · Festival de Gaitas y Tambores de la Sierra  publicado, con RETIRO SOLICITADO.
        · Festival Bullerengue al Mar ............... ajustes solicitados (3 observaciones pendientes).
        · Muestra de Acordeones del Litoral ......... rechazada con motivo.
        · Mercados en revisión y con ajustes pedidos.
      Colectivo Llano Adentro (Yopal) ............... revisado. Festival en borrador; Mercado
                                                      rechazado y otro en borrador.
      Asociación de Bandas del Oriente (Rionegro) ... SIN REVISAR por la consola: no tiene ficha
                                                      pública. Festival en revisión (primer envío).
      Consola ......................................... noticias (publicada con errata, programada,
                                                      cambio de fondo, borrador, archivada), Agenda
                                                      en los cuatro estados y cuatro fichas del
                                                      Catálogo Editorial con metadatos completos.
      Personas ........................................ cuatro perfiles públicos visibles, uno oculto
                                                      por moderación y uno sin autorizar.

    CÓMO SE ESCRIBE. Cada fila imita lo que habría escrito la API en ese paso (literales de estado,
    acciones del historial, forma de los JSON), con fechas repartidas en el tiempo para que los
    historiales se lean como una historia. Las procedencias son las que el sistema da (`externo`
    para lo que crea una organización, `administrativo` para lo de la consola): la retirada se
    hace por los identificadores propios de la siembra (ver V20261106_10).

    TODAS LAS CUENTAS ENTRAN CON LA CONTRASEÑA `admin`: se copia el resumen de externo@simus.test,
    que crea la API al arrancar en local. Nada de esto existe en producción: `migrar` no aplica
    `pnmc-database/seed/`. Se aplica con ./scripts/demo/sembrar-demo.sh completa.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Webmaster int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'webmaster@simus.test');
DECLARE @Gestor int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'gestor@simus.test');
DECLARE @Hash nvarchar(500) = (SELECT HashContrasena FROM dbo.Usuarios WHERE CorreoElectronico = N'externo@simus.test');
DECLARE @RolExterno int = (SELECT IdRol FROM dbo.Roles WHERE NombreRol = N'externo');
DECLARE @Institucional int = (SELECT TOP 1 IdEntidad FROM dbo.Entidades WHERE EsInstitucional = 1 ORDER BY IdEntidad);

IF @Webmaster IS NULL OR @Gestor IS NULL OR @Hash IS NULL OR @RolExterno IS NULL OR @Institucional IS NULL
BEGIN
    RAISERROR(N'Faltan las cuentas de arranque. Arranca la API una vez en local (./scripts/local/dev-up.sh) o usa ./scripts/demo/reconstruir-demo-local.sh.', 16, 1);
    RETURN;
END;
IF (SELECT COUNT(*) FROM dbo.Archivos WHERE NombreOriginal LIKE N'demo-completa-%') < 27
BEGIN
    RAISERROR(N'Faltan las imágenes de la demostración. Siembra con ./scripts/demo/sembrar-demo.sh completa, que las carga antes.', 16, 1);
    RETURN;
END;
IF EXISTS (SELECT 1 FROM dbo.Usuarios WHERE CorreoElectronico = N'lucia.ramirez@cantaclaro.test')
BEGIN
    RAISERROR(N'La demostración completa ya está sembrada. Retírala antes con V20261106_10 (lo hace ./scripts/demo/sembrar-demo.sh completa).', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 0. EL CALENDARIO
--
-- La edición «programada» empieza dentro de 24 días; las anteriores caen en los años previos. Así
-- la demostración sigue siendo coherente se siembre el día que se siembre.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @Ahora datetime2 = SYSUTCDATETIME();
DECLARE @Hoy date = CAST(@Ahora AS date);
DECLARE @Prog date = DATEADD(DAY, 24, @Hoy);
DECLARE @AP int = YEAR(@Prog);
DECLARE @Y1 int = @AP - 1, @Y2 int = @AP - 2, @Y3 int = @AP - 3;
DECLARE @Reciente datetime2 = DATEADD(DAY, -3, @Ahora);

-- Imágenes del Banco, por nombre.
DECLARE @Img TABLE (Nombre nvarchar(120) PRIMARY KEY, Id int);
INSERT INTO @Img (Nombre, Id)
SELECT REPLACE(REPLACE(NombreOriginal, N'demo-completa-', N''), N'.jpg', N''), IdArchivo
FROM dbo.Archivos WHERE NombreOriginal LIKE N'demo-completa-%';

-- Catálogos, por su slug: los identificadores cambian entre bases.
DECLARE @TipFestival int = (SELECT IdTipologiaFestival FROM dbo.TipologiasFestival WHERE Slug = N'festival-de-musica');
DECLARE @TipEncuentro int = (SELECT IdTipologiaFestival FROM dbo.TipologiasFestival WHERE Slug = N'encuentros');
DECLARE @TipOtra int = (SELECT IdTipologiaFestival FROM dbo.TipologiasFestival WHERE Slug = N'otra');
DECLARE @FinMincultura int = (SELECT IdFuenteFinanciacion FROM dbo.FuentesFinanciacion WHERE Slug = N'mincultura');
DECLARE @FinAlcaldia int = (SELECT IdFuenteFinanciacion FROM dbo.FuentesFinanciacion WHERE Slug = N'alcaldia');
DECLARE @FinGobernacion int = (SELECT IdFuenteFinanciacion FROM dbo.FuentesFinanciacion WHERE Slug = N'gobernacion');
DECLARE @FinOtra int = (SELECT IdFuenteFinanciacion FROM dbo.FuentesFinanciacion WHERE Slug = N'otra');
DECLARE @FinPropios int = (SELECT IdFuenteFinanciacion FROM dbo.FuentesFinanciacion WHERE Slug = N'recursos-propios');
DECLARE @OrgCasaCultural int = (SELECT IdTipoOrganizador FROM dbo.TiposOrganizador WHERE Slug = N'casa-cultural');
DECLARE @OrgFundacion int = (SELECT IdTipoOrganizador FROM dbo.TiposOrganizador WHERE Slug = N'fundacion');
DECLARE @OrgComunitario int = (SELECT IdTipoOrganizador FROM dbo.TiposOrganizador WHERE Slug = N'comunitario');
DECLARE @ZonaCabecera int = (SELECT IdZonaUrbanoRural FROM dbo.ZonasUrbanoRural WHERE Slug = N'cabecera-municipal');
DECLARE @ZonaRural int = (SELECT IdZonaUrbanoRural FROM dbo.ZonasUrbanoRural WHERE Slug = N'rural-disperso');
DECLARE @TitNoAplica int = (SELECT IdTitulacionColectiva FROM dbo.TitulacionesColectivas WHERE Slug = N'no-aplica');
DECLARE @TitResguardo int = (SELECT IdTitulacionColectiva FROM dbo.TitulacionesColectivas WHERE Slug = N'resguardo-indigena');
DECLARE @TitConsejo int = (SELECT IdTitulacionColectiva FROM dbo.TitulacionesColectivas WHERE Slug = N'consejo-comunitario');
DECLARE @NatPublica int = (SELECT IdNaturalezaEntidad FROM dbo.NaturalezasEntidad WHERE Slug = N'publica');
DECLARE @NatPrivada int = (SELECT IdNaturalezaEntidad FROM dbo.NaturalezasEntidad WHERE Slug = N'privada');
DECLARE @AlcRegional int = (SELECT IdAlcanceMercado FROM dbo.AlcancesMercado WHERE Slug = N'regional');
DECLARE @AlcNacional int = (SELECT IdAlcanceMercado FROM dbo.AlcancesMercado WHERE Slug = N'nacional');
DECLARE @AlcLocal int = (SELECT IdAlcanceMercado FROM dbo.AlcancesMercado WHERE Slug = N'local');
DECLARE @ModPresencial int = (SELECT IdModalidadMercado FROM dbo.ModalidadesMercado WHERE Slug = N'presencial');
DECLARE @ModMixta int = (SELECT IdModalidadMercado FROM dbo.ModalidadesMercado WHERE Slug = N'mixta');
DECLARE @ModVirtual int = (SELECT IdModalidadMercado FROM dbo.ModalidadesMercado WHERE Slug = N'virtual');
DECLARE @Proyecto int = (SELECT IdProyectoTransversal FROM dbo.ProyectosTransversales WHERE Codigo = N'celebra-la-musica');

-- Prácticas y territorios por nombre (fragmento estable del nombre del catálogo).
DECLARE @PmCampesinas int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas campesinas%');
DECLARE @PmTradicionales int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas populares tradicionales%');
DECLARE @PmVocales int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas vocales%');
DECLARE @PmComunitarias int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas comunitarias%');
DECLARE @PmAfro int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas de comunidades negras%');
DECLARE @PmBandas int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas sinfónicas%');
DECLARE @PmOriginarios int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Expresiones sonoras de pueblos originarios%');
DECLARE @PmArchivo int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Prácticas sonoras%');
DECLARE @PmPopulares int = (SELECT IdPracticaMusical FROM dbo.PracticasMusicales WHERE NombrePracticaMusical LIKE N'Músicas populares de amplia%');
DECLARE @TsSurenos int = (SELECT IdTerritorioSonoro FROM dbo.TerritoriosSonoros WHERE NombreTerritorioSonoro LIKE N'Flautas, Cuerdas%');
DECLARE @TsRajalena int = (SELECT IdTerritorioSonoro FROM dbo.TerritoriosSonoros WHERE NombreTerritorioSonoro LIKE N'Rajaleña%');
DECLARE @TsChirimia int = (SELECT IdTerritorioSonoro FROM dbo.TerritoriosSonoros WHERE NombreTerritorioSonoro = N'Chirimía');
DECLARE @TsMarimba int = (SELECT IdTerritorioSonoro FROM dbo.TerritoriosSonoros WHERE NombreTerritorioSonoro = N'Marimba');
DECLARE @TsCantos int = (SELECT IdTerritorioSonoro FROM dbo.TerritoriosSonoros WHERE NombreTerritorioSonoro LIKE N'Cantos, Pitos%');
DECLARE @TsJoropo int = (SELECT IdTerritorioSonoro FROM dbo.TerritoriosSonoros WHERE NombreTerritorioSonoro = N'Joropo');
DECLARE @TsTrova int = (SELECT IdTerritorioSonoro FROM dbo.TerritoriosSonoros WHERE NombreTerritorioSonoro LIKE N'Trova%');
DECLARE @TsIndigenas int = (SELECT IdTerritorioSonoro FROM dbo.TerritoriosSonoros WHERE NombreTerritorioSonoro LIKE N'Prácticas de Pueblos%');

-- Registros auxiliares: el historial y la bitácora se acumulan aquí y se escriben al final, con
-- la instantánea (organización, responsable, actor) que la API toma en cada paso.
CREATE TABLE #Hist (
    Orden int IDENTITY(1,1) PRIMARY KEY, ModuloId nvarchar(80), RegistroId nvarchar(120),
    EstadoAnterior nvarchar(80) NULL, EstadoNuevo nvarchar(80), Accion nvarchar(80),
    Comentario nvarchar(1200) NULL, MotivoRechazo nvarchar(1200) NULL, CamposObservados nvarchar(max) NULL,
    IdUsuario int NULL, Fecha datetime2, MetadataJson nvarchar(max) NULL, OrganizacionId int NULL, Instantanea bit);
CREATE TABLE #Bit (
    Orden int IDENTITY(1,1) PRIMARY KEY, IdUsuario int NULL, Tabla nvarchar(160), IdRegistro nvarchar(120),
    Accion nvarchar(40), Antes nvarchar(max) NULL, Despues nvarchar(max) NULL, Fecha datetime2);

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1. LAS CUENTAS
--
-- Las administradoras de organización se registraron «con organización» (TipoPerfil organizacion:
-- su identidad queda en la persona responsable). Los editores y Valentina se registraron como
-- personas (individual: nombres, documento y teléfono en la cuenta). Correo confirmado: la
-- demostración no depende de la dispensa del modo demo.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @Cuentas TABLE (Clave nvarchar(20) PRIMARY KEY, Id int NULL, Correo nvarchar(180), Nombre nvarchar(180),
    Perfil nvarchar(20), N1 nvarchar(80) NULL, N2 nvarchar(80) NULL, A1 nvarchar(80) NULL, A2 nvarchar(80) NULL,
    Documento nvarchar(20) NULL, Telefono nvarchar(40) NULL, Alta datetime2, Boletin bit);
INSERT INTO @Cuentas (Clave, Correo, Nombre, Perfil, N1, N2, A1, A2, Documento, Telefono, Alta, Boletin) VALUES
 (N'lucia',     N'lucia.ramirez@cantaclaro.test',      N'Lucía Fernanda Ramírez Ortiz',   N'organizacion', NULL, NULL, NULL, NULL, NULL, NULL, DATETIME2FROMPARTS(@Y3, 1, 20, 10, 5, 0, 0, 7), 1),
 (N'andres',    N'andres.munoz@cantaclaro.test',       N'Andrés Felipe Muñoz Chilito',    N'individual', N'Andrés', N'Felipe', N'Muñoz', N'Chilito', N'9900010002', N'+57 310 000 0102', DATETIME2FROMPARTS(@Y2, 5, 3, 15, 40, 0, 0, 7), 0),
 (N'mariana',   N'mariana.palacios@sonoracaribe.test', N'Mariana Isabel Palacios Mendoza', N'organizacion', NULL, NULL, NULL, NULL, NULL, NULL, DATETIME2FROMPARTS(@Y2, 2, 11, 9, 0, 0, 0, 7), 1),
 (N'jose',      N'jose.caicedo@sonoracaribe.test',     N'José Manuel Caicedo Rentería',   N'individual', N'José', N'Manuel', N'Caicedo', N'Rentería', N'9900010004', N'+57 310 000 0104', DATETIME2FROMPARTS(@Y2, 3, 1, 11, 20, 0, 0, 7), 0),
 (N'camilo',    N'camilo.rojas@llanoadentro.test',     N'Camilo Andrés Rojas Pérez',      N'organizacion', NULL, NULL, NULL, NULL, NULL, NULL, DATETIME2FROMPARTS(@Y1, 4, 8, 16, 10, 0, 0, 7), 0),
 (N'diana',     N'diana.zapata@bandasoriente.test',    N'Diana Marcela Zapata Gómez',     N'organizacion', NULL, NULL, NULL, NULL, NULL, NULL, DATEADD(DAY, -40, @Ahora), 0),
 (N'valentina', N'valentina.ocampo@correo.test',       N'Valentina Ocampo Restrepo',      N'individual', N'Valentina', NULL, N'Ocampo', N'Restrepo', N'9900010007', N'+57 310 000 0107', DATEADD(DAY, -15, @Ahora), 1);

INSERT INTO dbo.Usuarios (NombreCompleto, CorreoElectronico, HashContrasena, CanalAcceso, TipoPerfil, Activo,
    FechaCreacion, FechaActualizacion, UltimoAcceso, Telefono, Identificacion, CodigoTipoDocumento,
    CorreoConfirmado, FechaConfirmacionCorreo, PrimerNombre, SegundoNombre, PrimerApellido, SegundoApellido,
    DebeCambiarContrasena, PerfilCompletado)
SELECT Nombre, Correo, @Hash, N'externo', Perfil, 1, Alta, Alta, @Reciente, Telefono, Documento,
       CASE WHEN Documento IS NULL THEN NULL ELSE N'cc' END,
       1, DATEADD(MINUTE, 12, Alta), N1, N2, A1, A2, 0, 1
FROM @Cuentas;

UPDATE c SET Id = u.IdUsuario FROM @Cuentas c JOIN dbo.Usuarios u ON u.CorreoElectronico = c.Correo;

DECLARE @Lucia int = (SELECT Id FROM @Cuentas WHERE Clave = N'lucia');
DECLARE @Andres int = (SELECT Id FROM @Cuentas WHERE Clave = N'andres');
DECLARE @Mariana int = (SELECT Id FROM @Cuentas WHERE Clave = N'mariana');
DECLARE @Jose int = (SELECT Id FROM @Cuentas WHERE Clave = N'jose');
DECLARE @Camilo int = (SELECT Id FROM @Cuentas WHERE Clave = N'camilo');
DECLARE @Diana int = (SELECT Id FROM @Cuentas WHERE Clave = N'diana');
DECLARE @Valentina int = (SELECT Id FROM @Cuentas WHERE Clave = N'valentina');

INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol, FechaCreacion)
SELECT Id, @RolExterno, Alta FROM @Cuentas;

-- Autorizaciones del registro: tratamiento y términos siempre; boletín a quien lo aceptó.
INSERT INTO dbo.AutorizacionesDatos (Finalidad, IdPolitica, Version, TextoAceptado, TextoReconstruido, IdUsuario,
    CorreoTitular, Origen, ReferenciaId, FechaOtorgada)
SELECT p.Clave, p.IdPolitica, p.Version, p.Texto, 0, c.Id, c.Correo, N'registro', NULL, c.Alta
FROM @Cuentas c
JOIN dbo.PoliticasDatos p ON p.Vigente = 1 AND (p.Clave IN (N'tratamiento', N'terminos') OR (p.Clave = N'boletin' AND c.Boletin = 1));

INSERT INTO dbo.BoletinSuscripciones (CorreoElectronico, Origen, Estado, FechaAlta, FechaBaja, Confirmada, FechaConfirmacion)
SELECT Correo, N'registro', N'activa', Alta, NULL, 1, Alta FROM @Cuentas WHERE Boletin = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.BoletinSuscripciones b WHERE b.CorreoElectronico = Correo);

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 2. LAS ORGANIZACIONES
--
-- Perfil completo: nombre legal, NIT, descripción, contacto, redes, sede, dirección, emblema y
-- persona responsable. Tres revisadas por la consola (decisión 11 de docs/referencia/20-decisiones-y-flujos-por-modulo.md: solo esas tienen
-- ficha pública) y una sin revisar, que es la que enseña la diferencia.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @Orgs TABLE (Clave nvarchar(20) PRIMARY KEY, Id int NULL, Nombre nvarchar(240), NombreLegal nvarchar(240), Nit nvarchar(40),
    Descripcion nvarchar(max), Correo nvarchar(180), Telefono nvarchar(80), Web nvarchar(300), Facebook nvarchar(300),
    Instagram nvarchar(300), Otro nvarchar(300), Direccion nvarchar(300), Dep char(2), Mun char(5),
    Creador int, Alta datetime2, Revisor int NULL, Revision datetime2 NULL, Foto nvarchar(60),
    RespNombre nvarchar(240), RespN1 nvarchar(80), RespN2 nvarchar(80), RespA1 nvarchar(80), RespA2 nvarchar(80),
    RespDoc nvarchar(40), RespCorreo nvarchar(320), RespTelefono nvarchar(80));
INSERT INTO @Orgs VALUES
 (N'cantaclaro', NULL, N'Corporación Cultural Cantaclaro', N'Corporación Cultural Cantaclaro', N'901900101-1',
  N'Corporación sin ánimo de lucro fundada en Popayán por músicas y músicos del Macizo colombiano. Organiza desde hace más de una década el Festival de Músicas del Macizo, sostiene una escuela de cuerdas y flautas para niñas, niños y jóvenes de cuatro municipios, y documenta el repertorio campesino de la región en cancioneros y grabaciones de campo.' + NCHAR(10) + NCHAR(10) + N'Trabaja con juntas de acción comunal, resguardos y escuelas municipales de música. Datos de demostración: no corresponde a una organización real.',
  N'contacto@cantaclaro.test', N'+57 602 000 1144', N'https://cantaclaro.test', N'https://facebook.com/cantaclaro.test', N'https://instagram.com/cantaclaro.test', N'https://cantaclaro.test/memorias',
  N'Carrera 9 # 4-37, barrio Centro', '19', '19001', NULL, DATETIME2FROMPARTS(@Y3, 1, 20, 10, 20, 0, 0, 7), NULL, DATETIME2FROMPARTS(@Y3, 1, 27, 9, 0, 0, 0, 7), N'org-cantaclaro',
  N'Lucía Fernanda Ramírez Ortiz', N'Lucía', N'Fernanda', N'Ramírez', N'Ortiz', N'9900010001', N'lucia.ramirez@cantaclaro.test', N'+57 310 000 0101'),
 (N'sonora', NULL, N'Fundación Sonora del Caribe', N'Fundación Sonora del Caribe', N'901900202-2',
  N'Fundación de Santa Marta dedicada a la salvaguardia de las músicas de gaita, tambora y bullerengue del Magdalena. Acompaña a cantadoras y tamboreros mayores, organiza festivales en la Sierra y en la ciénaga, y abre espacios de circulación para agrupaciones jóvenes del Caribe.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración: no corresponde a una organización real.',
  N'hola@sonoracaribe.test', N'+57 605 000 2233', N'https://sonoracaribe.test', N'https://facebook.com/sonoracaribe.test', N'https://instagram.com/sonoracaribe.test', N'https://sonoracaribe.test/radio',
  N'Calle 22 # 3-45, Centro Histórico', '47', '47001', NULL, DATETIME2FROMPARTS(@Y2, 2, 11, 9, 10, 0, 0, 7), NULL, DATETIME2FROMPARTS(@Y2, 2, 20, 14, 0, 0, 0, 7), N'org-sonora-caribe',
  N'Mariana Isabel Palacios Mendoza', N'Mariana', N'Isabel', N'Palacios', N'Mendoza', N'9900010003', N'mariana.palacios@sonoracaribe.test', N'+57 310 000 0103'),
 (N'llano', NULL, N'Colectivo Llano Adentro', N'Asociación Colectivo Llano Adentro', N'901900303-3',
  N'Colectivo de músicos, bailadores y luthiers de Casanare que promueve el joropo, el contrapunteo y la copla llanera. Desarrolla talleres de arpa, cuatro y maracas en veredas de Yopal y Paz de Ariporo, y circula a sus agrupaciones por los festivales del piedemonte.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración: no corresponde a una organización real.',
  N'colectivo@llanoadentro.test', N'+57 608 000 3344', N'https://llanoadentro.test', N'https://facebook.com/llanoadentro.test', N'https://instagram.com/llanoadentro.test', N'https://llanoadentro.test/coplas',
  N'Calle 15 # 21-08, barrio El Bicentenario', '85', '85001', NULL, DATETIME2FROMPARTS(@Y1, 4, 8, 16, 20, 0, 0, 7), NULL, DATETIME2FROMPARTS(@Y1, 4, 15, 10, 30, 0, 0, 7), N'org-llano-adentro',
  N'Camilo Andrés Rojas Pérez', N'Camilo', N'Andrés', N'Rojas', N'Pérez', N'9900010005', N'camilo.rojas@llanoadentro.test', N'+57 310 000 0105'),
 (N'bandas', NULL, N'Asociación de Bandas del Oriente Antioqueño', N'Asociación de Bandas Musicales del Oriente Antioqueño', N'901900404-4',
  N'Red de bandas sinfónicas y de vientos de los municipios del Oriente antioqueño. Organiza encuentros anuales, intercambia directores invitados y gestiona la dotación y el mantenimiento de instrumentos.' + NCHAR(10) + NCHAR(10) + N'Organización registrada hace poco: la consola todavía no la ha revisado, por eso no tiene ficha pública. Datos de demostración.',
  N'asociacion@bandasoriente.test', N'+57 604 000 4455', N'https://bandasoriente.test', N'https://facebook.com/bandasoriente.test', N'https://instagram.com/bandasoriente.test', N'https://bandasoriente.test/encuentros',
  N'Carrera 50 # 49-12, Parque Principal', '05', '05615', NULL, DATEADD(DAY, -40, @Ahora), NULL, NULL, N'org-bandas-oriente',
  N'Diana Marcela Zapata Gómez', N'Diana', N'Marcela', N'Zapata', N'Gómez', N'9900010006', N'diana.zapata@bandasoriente.test', N'+57 310 000 0106');

UPDATE @Orgs SET Creador = CASE Clave WHEN N'cantaclaro' THEN @Lucia WHEN N'sonora' THEN @Mariana WHEN N'llano' THEN @Camilo ELSE @Diana END,
                 Revisor = CASE Clave WHEN N'cantaclaro' THEN @Gestor WHEN N'sonora' THEN @Webmaster WHEN N'llano' THEN @Gestor ELSE NULL END;

INSERT INTO dbo.Entidades (TipoEntidad, Nombre, NombreLegal, Descripcion, CorreoContacto, TelefonoContacto, SitioWeb,
    Facebook, Instagram, OtroEnlace, Direccion, EstadoRegistro, Activo, IdUsuarioCreador, IdUsuarioResponsable,
    FechaCreacion, FechaActualizacion, NumeroIdentificacion, TipoIdentificacion, EsInstitucional,
    CodigoDepartamentoSede, CodigoMunicipioSede, FechaRevisionConsola, IdUsuarioRevisionConsola)
SELECT N'organizacion', Nombre, NombreLegal, Descripcion, Correo, Telefono, Web, Facebook, Instagram, Otro, Direccion,
       N'activa', 1, Creador, Creador, Alta, COALESCE(Revision, DATEADD(DAY, 1, Alta)), Nit, N'NIT', 0, Dep, Mun, Revision, Revisor
FROM @Orgs;

UPDATE o SET Id = e.IdEntidad FROM @Orgs o JOIN dbo.Entidades e ON e.CorreoContacto = o.Correo;
DECLARE @Cantaclaro int = (SELECT Id FROM @Orgs WHERE Clave = N'cantaclaro');
DECLARE @Sonora int = (SELECT Id FROM @Orgs WHERE Clave = N'sonora');
DECLARE @Llano int = (SELECT Id FROM @Orgs WHERE Clave = N'llano');
DECLARE @Bandas int = (SELECT Id FROM @Orgs WHERE Clave = N'bandas');

-- La persona responsable: quien registró la organización, con su autorización de tratamiento.
INSERT INTO dbo.EntidadesResponsable (IdEntidad, ResponsableNombre, ResponsableTipoDocumento, ResponsableNumeroDocumento,
    ResponsableCorreo, ResponsableTelefono, ResponsableDesde, ResponsableAutorizacionDatos, FechaCreacion, FechaActualizacion,
    ResponsablePrimerNombre, ResponsableSegundoNombre, ResponsablePrimerApellido, ResponsableSegundoApellido)
SELECT Id, RespNombre, N'CC', RespDoc, RespCorreo, RespTelefono, Alta, 1, Alta, Alta, RespN1, RespN2, RespA1, RespA2 FROM @Orgs;

-- Los archivos que subió cada organización pasan a ser suyos (procedencia y cuota del Banco).
DECLARE @ArchivosDe TABLE (Nombre nvarchar(120), Org int, Usuario int);
INSERT INTO @ArchivosDe VALUES
 (N'org-cantaclaro', @Cantaclaro, @Lucia), (N'org-sonora-caribe', @Sonora, @Mariana), (N'org-llano-adentro', @Llano, @Camilo), (N'org-bandas-oriente', @Bandas, @Diana),
 (N'afiche-macizo-2023', @Cantaclaro, @Lucia), (N'afiche-macizo-2024', @Cantaclaro, @Lucia), (N'afiche-macizo-2025', @Cantaclaro, @Andres), (N'afiche-macizo-2026', @Cantaclaro, @Andres),
 (N'afiche-chirimias-2026', @Cantaclaro, @Andres), (N'afiche-mercado-suroccidente', @Cantaclaro, @Lucia),
 (N'afiche-gaitas-2025', @Sonora, @Mariana), (N'afiche-bullerengue-2026', @Sonora, @Jose);
UPDATE a SET OrganizacionId = d.Org, IdUsuarioCarga = d.Usuario,
       NombreAlmacenado = CONCAT(d.Org, N'-', a.Huella, N'.jpg'),
       RutaAlmacenamiento = CONCAT(N'/api/v1/publico/archivos/', d.Org, N'-', a.Huella, N'.jpg')
FROM dbo.Archivos a JOIN @Img i ON i.Id = a.IdArchivo JOIN @ArchivosDe d ON d.Nombre = i.Nombre;

-- Las fotos de perfil las sube cada persona.
UPDATE a SET IdUsuarioCarga = c.Id,
       NombreAlmacenado = CONCAT(N'persona', c.Id, N'-', a.Huella, N'.jpg'),
       RutaAlmacenamiento = CONCAT(N'/api/v1/publico/archivos/persona', c.Id, N'-', a.Huella, N'.jpg')
FROM dbo.Archivos a JOIN @Img i ON i.Id = a.IdArchivo JOIN @Cuentas c ON i.Nombre = CONCAT(N'persona-', c.Clave);

UPDATE e SET ArchivoFotoId = i.Id FROM dbo.Entidades e JOIN @Orgs o ON o.Id = e.IdEntidad JOIN @Img i ON i.Nombre = o.Foto;

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'organizaciones', CAST(Id AS nvarchar(120)), N'externo', Id, Creador, Alta FROM @Orgs;

-- El equipo: administradoras, editores (por invitación aceptada) y una cuenta con dos organizaciones.
INSERT INTO dbo.UsuariosEntidades (IdUsuario, IdEntidad, RolEntidad, Activo, FechaCreacion) VALUES
 (@Lucia, @Cantaclaro, N'administrador', 1, DATETIME2FROMPARTS(@Y3, 1, 20, 10, 20, 0, 0, 7)),
 (@Andres, @Cantaclaro, N'editor', 1, DATETIME2FROMPARTS(@Y2, 5, 3, 15, 55, 0, 0, 7)),
 (@Camilo, @Cantaclaro, N'editor', 1, DATETIME2FROMPARTS(@Y1, 6, 2, 9, 15, 0, 0, 7)),
 (@Mariana, @Sonora, N'administrador', 1, DATETIME2FROMPARTS(@Y2, 2, 11, 9, 10, 0, 0, 7)),
 (@Jose, @Sonora, N'editor', 1, DATETIME2FROMPARTS(@Y2, 3, 1, 11, 30, 0, 0, 7)),
 (@Camilo, @Llano, N'administrador', 1, DATETIME2FROMPARTS(@Y1, 4, 8, 16, 20, 0, 0, 7)),
 (@Diana, @Bandas, N'administrador', 1, DATEADD(DAY, -40, @Ahora));

-- Invitaciones en sus cuatro estados. El testigo no se conoce (solo su resumen), como en la API:
-- la pendiente se ve en «Equipo» y se puede revocar o volver a emitir desde ahí.
INSERT INTO dbo.InvitacionesDeOrganizacion (IdEntidad, CorreoInvitado, RolEntidad, HashTestigo, Estado, IdUsuarioInvita,
    FechaEmision, FechaExpiracion, IdUsuarioAcepta, FechaCierre) VALUES
 (@Cantaclaro, N'andres.munoz@cantaclaro.test', N'editor', LOWER(CONVERT(char(64), HASHBYTES('SHA2_256', N'demo-completa-invitacion-1'), 2)), N'aceptada', @Lucia,
  DATETIME2FROMPARTS(@Y2, 5, 2, 18, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y2, 5, 9, 18, 0, 0, 0, 7), @Andres, DATETIME2FROMPARTS(@Y2, 5, 3, 15, 55, 0, 0, 7)),
 (@Cantaclaro, N'camilo.rojas@llanoadentro.test', N'editor', LOWER(CONVERT(char(64), HASHBYTES('SHA2_256', N'demo-completa-invitacion-2'), 2)), N'aceptada', @Lucia,
  DATETIME2FROMPARTS(@Y1, 6, 1, 12, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 6, 8, 12, 0, 0, 0, 7), @Camilo, DATETIME2FROMPARTS(@Y1, 6, 2, 9, 15, 0, 0, 7)),
 (@Cantaclaro, N'valentina.ocampo@correo.test', N'editor', LOWER(CONVERT(char(64), HASHBYTES('SHA2_256', N'demo-completa-invitacion-3'), 2)), N'pendiente', @Lucia,
  DATEADD(DAY, -2, @Ahora), DATEADD(DAY, 5, @Ahora), NULL, NULL),
 (@Cantaclaro, N'pedro.lasso@correo.test', N'administrador', LOWER(CONVERT(char(64), HASHBYTES('SHA2_256', N'demo-completa-invitacion-4'), 2)), N'revocada', @Lucia,
  DATETIME2FROMPARTS(@Y1, 2, 10, 8, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 2, 17, 8, 0, 0, 0, 7), NULL, DATETIME2FROMPARTS(@Y1, 2, 11, 9, 0, 0, 0, 7)),
 (@Cantaclaro, N'sofia.mosquera@correo.test', N'editor', LOWER(CONVERT(char(64), HASHBYTES('SHA2_256', N'demo-completa-invitacion-5'), 2)), N'vencida', @Lucia,
  DATETIME2FROMPARTS(@Y1, 3, 1, 8, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 3, 8, 8, 0, 0, 0, 7), NULL, DATETIME2FROMPARTS(@Y1, 3, 8, 8, 0, 0, 0, 7)),
 (@Sonora, N'jose.caicedo@sonoracaribe.test', N'editor', LOWER(CONVERT(char(64), HASHBYTES('SHA2_256', N'demo-completa-invitacion-6'), 2)), N'aceptada', @Mariana,
  DATETIME2FROMPARTS(@Y2, 2, 28, 17, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y2, 3, 7, 17, 0, 0, 0, 7), @Jose, DATETIME2FROMPARTS(@Y2, 3, 1, 11, 30, 0, 0, 7)),
 (@Sonora, N'lucia.ramirez@cantaclaro.test', N'editor', LOWER(CONVERT(char(64), HASHBYTES('SHA2_256', N'demo-completa-invitacion-7'), 2)), N'pendiente', @Mariana,
  DATEADD(DAY, -1, @Ahora), DATEADD(DAY, 6, @Ahora), NULL, NULL);

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha)
SELECT Creador, N'Entidades', CAST(Id AS nvarchar(120)), N'crear_organizacion', NULL, NULL, Alta FROM @Orgs
UNION ALL SELECT Creador, N'Entidades', CAST(Id AS nvarchar(120)), N'asignar_administrador_inicial', NULL, NULL, Alta FROM @Orgs
UNION ALL SELECT Revisor, N'Entidades', CAST(Id AS nvarchar(120)), N'actualizar', N'{"revisada":false,"fechaRevision":null}',
       CONCAT(N'{"evento":"organizacion_revisada_por_la_consola","revisada":true,"fechaRevision":"', CONVERT(nvarchar(30), Revision, 127), N'Z","motivo":null}'), Revision
FROM @Orgs WHERE Revision IS NOT NULL
UNION ALL SELECT i.IdUsuarioInvita, N'InvitacionesDeOrganizacion', CAST(i.IdEntidad AS nvarchar(120)), N'crear', NULL,
       CONCAT(N'{"Evento":"invitacion_creada","OrganizacionId":', i.IdEntidad, N',"Correo":"', i.CorreoInvitado, N'","Rol":"', i.RolEntidad, N'"}'), i.FechaEmision
FROM dbo.InvitacionesDeOrganizacion i WHERE i.IdEntidad IN (@Cantaclaro, @Sonora)
UNION ALL SELECT i.IdUsuarioAcepta, N'UsuariosEntidades', CAST(i.IdEntidad AS nvarchar(120)), N'crear', NULL,
       CONCAT(N'{"Evento":"invitacion_aceptada","OrganizacionId":', i.IdEntidad, N',"Correo":"', i.CorreoInvitado, N'","Rol":"', i.RolEntidad, N'"}'), i.FechaCierre
FROM dbo.InvitacionesDeOrganizacion i WHERE i.IdEntidad IN (@Cantaclaro, @Sonora) AND i.Estado = N'aceptada';

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 3. PERFILES PÚBLICOS DE PERSONAS
--
-- Visibles: Lucía, Andrés, Camilo y Valentina (autorización «perfil_publico» vigente). José lo
-- publicó y la consola lo ocultó por moderación, con motivo. Mariana lo guardó sin publicarlo.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO dbo.PerfilesPublicos (IdUsuario, NombreVisible, CodigoMunicipio, ArchivoFotoId, OcultoPorModeracion,
    MotivoModeracion, FechaModeracion, IdUsuarioModera, FechaCreacion, FechaActualizacion) VALUES
 (@Lucia, N'Lucía Ramírez', N'19001', (SELECT Id FROM @Img WHERE Nombre = N'persona-lucia'), 0, NULL, NULL, NULL, DATETIME2FROMPARTS(@Y1, 1, 15, 10, 0, 0, 0, 7), DATEADD(DAY, -20, @Ahora)),
 (@Andres, N'Andrés Muñoz', N'19807', (SELECT Id FROM @Img WHERE Nombre = N'persona-andres'), 0, NULL, NULL, NULL, DATETIME2FROMPARTS(@Y1, 3, 2, 11, 0, 0, 0, 7), DATEADD(DAY, -60, @Ahora)),
 (@Camilo, N'Camilo Rojas', N'85250', (SELECT Id FROM @Img WHERE Nombre = N'persona-camilo'), 0, NULL, NULL, NULL, DATETIME2FROMPARTS(@Y1, 6, 5, 9, 0, 0, 0, 7), DATEADD(DAY, -30, @Ahora)),
 (@Valentina, N'Valentina Ocampo', N'05001', (SELECT Id FROM @Img WHERE Nombre = N'persona-valentina'), 0, NULL, NULL, NULL, DATEADD(DAY, -14, @Ahora), DATEADD(DAY, -10, @Ahora)),
 (@Jose, N'José Caicedo', N'47189', NULL, 1, N'El perfil enlazaba a una página con publicidad ajena a la actividad musical. Se oculta hasta que la persona corrija los enlaces.', DATEADD(DAY, -8, @Ahora), @Gestor, DATETIME2FROMPARTS(@Y1, 5, 10, 9, 0, 0, 0, 7), DATEADD(DAY, -9, @Ahora)),
 (@Mariana, N'Mariana Palacios', N'47001', NULL, 0, NULL, NULL, NULL, DATEADD(DAY, -25, @Ahora), NULL);

INSERT INTO dbo.PerfilesPublicosPracticas (IdUsuario, IdPracticaMusical) VALUES
 (@Lucia, @PmCampesinas), (@Lucia, @PmVocales), (@Lucia, @PmTradicionales),
 (@Andres, @PmTradicionales), (@Andres, @PmComunitarias),
 (@Camilo, @PmTradicionales), (@Camilo, @PmCampesinas),
 (@Valentina, @PmArchivo), (@Valentina, @PmComunitarias), (@Valentina, @PmVocales),
 (@Jose, @PmAfro), (@Mariana, @PmAfro);

INSERT INTO dbo.PerfilesPublicosEnlaces (IdUsuario, Orden, Url) VALUES
 (@Lucia, 1, N'https://luciaramirez.test'), (@Lucia, 2, N'https://instagram.com/luciaramirez.test'), (@Lucia, 3, N'https://cantaclaro.test/equipo/lucia'),
 (@Andres, 1, N'https://andresmunoz.test'), (@Andres, 2, N'https://youtube.com/@andresmunoz.test'),
 (@Camilo, 1, N'https://instagram.com/camilorojas.test'), (@Camilo, 2, N'https://llanoadentro.test/coplas'),
 (@Valentina, 1, N'https://valentinaocampo.test'), (@Valentina, 2, N'https://soundcloud.com/valentinaocampo.test'), (@Valentina, 3, N'https://instagram.com/valentinaocampo.test'),
 (@Jose, 1, N'https://josecaicedo.test');

INSERT INTO dbo.AutorizacionesDatos (Finalidad, IdPolitica, Version, TextoAceptado, TextoReconstruido, IdUsuario,
    CorreoTitular, Origen, ReferenciaId, FechaOtorgada)
SELECT p.Clave, p.IdPolitica, p.Version, p.Texto, 0, c.Id, c.Correo, N'cuenta', NULL, DATEADD(MINUTE, 5, pp.FechaCreacion)
FROM @Cuentas c JOIN dbo.PerfilesPublicos pp ON pp.IdUsuario = c.Id
JOIN dbo.PoliticasDatos p ON p.Vigente = 1 AND p.Clave = N'perfil_publico'
WHERE c.Clave IN (N'lucia', N'andres', N'camilo', N'valentina', N'jose');

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha)
SELECT pp.IdUsuario, N'PerfilesPublicos', CAST(pp.IdUsuario AS nvarchar(120)), N'crear', NULL,
       CONCAT(N'{"NombreVisible":"', pp.NombreVisible, N'","CodigoMunicipio":"', pp.CodigoMunicipio, N'","ArchivoFotoId":', ISNULL(CAST(pp.ArchivoFotoId AS nvarchar(20)), N'null'), N'}'), pp.FechaCreacion
FROM dbo.PerfilesPublicos pp JOIN @Cuentas c ON c.Id = pp.IdUsuario
UNION ALL SELECT a.IdUsuario, N'PerfilesPublicos', CAST(a.IdUsuario AS nvarchar(120)), N'publicar', NULL,
       CONCAT(N'{"evento":"perfil_publico_autorizado","version":"', a.Version, N'"}'), a.FechaOtorgada
FROM dbo.AutorizacionesDatos a JOIN @Cuentas c ON c.Id = a.IdUsuario WHERE a.Finalidad = N'perfil_publico';

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 4. FESTIVALES
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @Fest TABLE (Clave nvarchar(20) PRIMARY KEY, Id int NULL, Org int, Creador int, Alta datetime2,
    Nombre nvarchar(220), Descripcion nvarchar(max), Correo nvarchar(180), Telefono nvarchar(80), Instagram nvarchar(300),
    Facebook nvarchar(300), Web nvarchar(300), Otro nvarchar(300), Observaciones nvarchar(600), Nivel nvarchar(20),
    Dep char(2) NULL, Mun char(5) NULL, Periodicidad nvarchar(40), Detalle nvarchar(600), Estado nvarchar(40));
INSERT INTO @Fest VALUES
 (N'macizo', NULL, @Cantaclaro, @Lucia, DATETIME2FROMPARTS(@Y3, 2, 10, 9, 30, 0, 0, 7), N'Festival de Músicas del Macizo',
  N'Encuentro anual de las músicas campesinas del Macizo colombiano: chirimías, conjuntos de cuerdas, flautas de caña y cantos de minga. Durante cinco días reúne a agrupaciones de veredas y resguardos del Cauca, Huila y Nariño con conciertos en la plaza de Popayán, talleres para niñas y niños, una muestra de luthería y un conversatorio sobre la memoria sonora del territorio.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración: no corresponde a un Festival real.',
  N'festival@musicasdelmacizo.test', N'+57 314 000 0202', N'https://instagram.com/musicasdelmacizo.test', N'https://facebook.com/musicasdelmacizo.test',
  N'https://musicasdelmacizo.test', N'https://musicasdelmacizo.test/programacion', N'Atención a prensa y agrupaciones de lunes a viernes, de 8:00 a 17:00. Inscripciones de agrupaciones hasta el 30 de abril.',
  N'municipal', '19', '19001', N'anual', N'Se realiza la tercera semana de julio, cuando terminan las cosechas de la región.', N'publicado'),
 (N'chirimias', NULL, @Cantaclaro, @Andres, DATETIME2FROMPARTS(@Y1, 9, 1, 10, 0, 0, 0, 7), N'Encuentro de Chirimías del Cauca',
  N'Primer encuentro departamental de chirimías caucanas: agrupaciones de flauta traversa, tambora, redoblante y platillos de los municipios del centro del Cauca se reúnen para compartir repertorio, intercambiar saberes con los mayores y grabar una muestra sonora de cada agrupación.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración.',
  N'chirimias@cantaclaro.test', N'+57 314 000 0303', N'https://instagram.com/chirimiasdelcauca.test', N'https://facebook.com/chirimiasdelcauca.test',
  N'https://cantaclaro.test/chirimias', N'https://cantaclaro.test/chirimias/inscripciones', N'Las agrupaciones se inscriben por el formulario del sitio web.',
  N'municipal', '19', '19807', N'bienal', N'Se alterna con el Festival del Macizo: años impares.', N'en_revision'),
 (N'gaitas', NULL, @Sonora, @Mariana, DATETIME2FROMPARTS(@Y2, 3, 5, 9, 0, 0, 0, 7), N'Festival de Gaitas y Tambores de la Sierra',
  N'Festival de gaitas hembra y macho, tambores alegre y llamador y maracas, con concurso de agrupaciones tradicionales y juveniles, ruedas de baile y un encuentro de constructores de gaitas de la Sierra Nevada.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración.',
  N'gaitas@sonoracaribe.test', N'+57 315 000 0404', N'https://instagram.com/gaitasdelasierra.test', N'https://facebook.com/gaitasdelasierra.test',
  N'https://gaitasdelasierra.test', N'https://gaitasdelasierra.test/concurso', N'Prensa y acreditaciones por correo.',
  N'municipal', '47', '47001', N'anual', N'Primera semana de octubre.', N'publicado'),
 (N'bullerengue', NULL, @Sonora, @Jose, DATEADD(DAY, -45, @Ahora), N'Festival Bullerengue al Mar',
  N'Festival de bullerengue sentao, fandango de lengua y chalupa en la playa de Ciénaga, con cantadoras mayores, semilleros infantiles y un taller de tambor.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración.',
  N'bullerengue@sonoracaribe.test', N'+57 315 000 0505', N'https://instagram.com/bullerengue.test', N'https://facebook.com/bullerenguealmar.test',
  N'https://sonoracaribe.test/bullerengue', N'https://sonoracaribe.test/bullerengue/cantadoras', N'Contacto con la coordinación artística.',
  N'municipal', '47', '47189', N'anual', N'Puente festivo de noviembre.', N'ajustes_solicitados'),
 (N'acordeones', NULL, @Sonora, @Mariana, DATETIME2FROMPARTS(@Y1, 2, 1, 9, 0, 0, 0, 7), N'Muestra de Acordeones del Litoral',
  N'Muestra itinerante de acordeoneros del litoral del Magdalena.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración.',
  N'acordeones@sonoracaribe.test', N'+57 315 000 0606', N'https://instagram.com/acordeoneslitoral.test', N'https://facebook.com/acordeoneslitoral.test',
  N'https://sonoracaribe.test/acordeones', N'https://sonoracaribe.test/acordeones/ruta', N'Sin observaciones.',
  N'departamental', '47', NULL, N'intermitente', N'Depende de la convocatoria departamental de cada año.', N'rechazado'),
 (N'contrapunteo', NULL, @Llano, @Camilo, DATEADD(DAY, -12, @Ahora), N'Festival Llanero de Contrapunteo',
  N'Festival de contrapunteo y copla llanera en Paz de Ariporo, con categorías infantil, juvenil y mayores, concurso de arpa y una muestra de luthería de cuatros y maracas.' + NCHAR(10) + NCHAR(10) + N'Borrador completo, todavía sin enviar. Datos de demostración.',
  N'contrapunteo@llanoadentro.test', N'+57 316 000 0707', N'https://instagram.com/contrapunteo.test', N'https://facebook.com/contrapunteo.test',
  N'https://llanoadentro.test/contrapunteo', N'https://llanoadentro.test/contrapunteo/bases', N'Inscripciones en la sede del colectivo.',
  N'municipal', '85', '85250', N'anual', N'Fin de semana de la feria ganadera, en diciembre.', N'borrador'),
 (N'bandasoriente', NULL, @Bandas, @Diana, DATEADD(DAY, -30, @Ahora), N'Encuentro de Bandas del Oriente Antioqueño',
  N'Encuentro anual de bandas sinfónicas y de vientos de los municipios del Oriente antioqueño, con concierto de bandas unidas, clínicas de instrumento y retreta en el parque principal.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración.',
  N'encuentro@bandasoriente.test', N'+57 317 000 0808', N'https://instagram.com/bandasoriente.test', N'https://facebook.com/bandasoriente.test',
  N'https://bandasoriente.test/encuentro', N'https://bandasoriente.test/encuentro/bandas', N'Coordinación logística con las alcaldías de la subregión.',
  N'municipal', '05', '05615', N'anual', N'Segundo fin de semana de agosto.', N'en_revision'),
 (N'cuerdas', NULL, @Cantaclaro, @Andres, DATEADD(DAY, -16, @Ahora), N'Festival de Cuerdas y Bandolas de Silvia',
  N'Festival de guitarra, tiple y bandola de las veredas de Silvia y Totoró, con serenatas en la plaza, concurso de duetos y un taller de construcción de bandolas para jóvenes de los resguardos.',
  N'cuerdas@cantaclaro.test', N'+57 314 000 0909', N'https://instagram.com/cuerdasdesilvia.test', N'https://facebook.com/cuerdasdesilvia.test',
  N'https://cantaclaro.test/cuerdas', N'https://cantaclaro.test/cuerdas/duetos', N'Coordinación con la casa de la cultura de Silvia.',
  N'municipal', '19', '19743', N'anual', N'Primer fin de semana de diciembre.', N'ajustes_solicitados');

INSERT INTO dbo.Festivales (NombreFestival, Descripcion, Organizador, CorreoOrganizador, TelefonoOrganizador, SitioWebOrganizador,
    CorreoFestival, InstagramFestival, FacebookFestival, SitioWebFestival, OtroEnlaceFestival, TelefonoFestival, ObservacionesContacto,
    TieneEdicionVigenteAnoActual, NivelCobertura, CodigoDepartamento, CodigoMunicipio, EstadoRegistro, FechaCreacion, FechaActualizacion,
    OrganizacionPrincipalId, Periodicidad, PeriodicidadDetalle)
SELECT f.Nombre, f.Descripcion, o.Nombre, o.Correo, o.Telefono, o.Web, f.Correo, f.Instagram, f.Facebook, f.Web, f.Otro, f.Telefono, f.Observaciones,
       0, f.Nivel, f.Dep, f.Mun, f.Estado, f.Alta, f.Alta, f.Org, f.Periodicidad, f.Detalle
FROM @Fest f JOIN @Orgs o ON o.Id = f.Org;

UPDATE f SET Id = x.IdFestival FROM @Fest f JOIN dbo.Festivales x ON x.NombreFestival = f.Nombre AND x.OrganizacionPrincipalId = f.Org;
DECLARE @FMacizo int = (SELECT Id FROM @Fest WHERE Clave = N'macizo');
DECLARE @FChirimias int = (SELECT Id FROM @Fest WHERE Clave = N'chirimias');
DECLARE @FGaitas int = (SELECT Id FROM @Fest WHERE Clave = N'gaitas');
DECLARE @FBullerengue int = (SELECT Id FROM @Fest WHERE Clave = N'bullerengue');
DECLARE @FAcordeones int = (SELECT Id FROM @Fest WHERE Clave = N'acordeones');
DECLARE @FContrapunteo int = (SELECT Id FROM @Fest WHERE Clave = N'contrapunteo');
DECLARE @FBandas int = (SELECT Id FROM @Fest WHERE Clave = N'bandasoriente');
DECLARE @FCuerdas int = (SELECT Id FROM @Fest WHERE Clave = N'cuerdas');

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'festivales', CAST(Id AS nvarchar(120)), N'externo', Org, Creador, Alta FROM @Fest;

INSERT INTO dbo.PracticasMusicalesDeRegistro (ModuloId, RegistroId, IdPracticaMusical)
SELECT N'festivales', CAST(f.Id AS nvarchar(120)), p.Id FROM @Fest f
JOIN (VALUES (N'macizo', @PmCampesinas), (N'macizo', @PmTradicionales), (N'macizo', @PmVocales),
             (N'chirimias', @PmTradicionales), (N'chirimias', @PmComunitarias),
             (N'gaitas', @PmAfro), (N'gaitas', @PmTradicionales), (N'bullerengue', @PmAfro), (N'bullerengue', @PmVocales),
             (N'acordeones', @PmPopulares), (N'contrapunteo', @PmTradicionales), (N'contrapunteo', @PmCampesinas),
             (N'bandasoriente', @PmBandas), (N'bandasoriente', @PmComunitarias),
             (N'cuerdas', @PmTradicionales), (N'cuerdas', @PmCampesinas)) p(Clave, Id) ON p.Clave = f.Clave;

INSERT INTO dbo.TerritoriosSonorosDeRegistro (ModuloId, RegistroId, IdTerritorioSonoro)
SELECT N'festivales', CAST(f.Id AS nvarchar(120)), t.Id FROM @Fest f
JOIN (VALUES (N'macizo', @TsSurenos), (N'macizo', @TsRajalena), (N'chirimias', @TsChirimia), (N'chirimias', @TsSurenos),
             (N'gaitas', @TsCantos), (N'bullerengue', @TsCantos), (N'acordeones', @TsCantos),
             (N'contrapunteo', @TsJoropo), (N'bandasoriente', @TsTrova), (N'cuerdas', @TsSurenos)) t(Clave, Id) ON t.Clave = f.Clave;

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha)
SELECT Creador, N'Festivales', CAST(Id AS nvarchar(120)), N'crear', NULL,
       CONCAT(N'{"OrganizacionPrincipalId":', Org, N',"Estado":"borrador","Evento":"FestivalCreado"}'), Alta
FROM @Fest;

-- ── 4.1 El ciclo de revisión de cada Festival ────────────────────────────────────────────────
-- Un renglón por paso. `Envio` numera los envíos; `Revision` agrupa las observaciones por campo.
DECLARE @Pasos TABLE (Orden int IDENTITY(1,1) PRIMARY KEY, Festival int, Paso nvarchar(30), Fecha datetime2, Actor int,
    EstadoAnterior nvarchar(40) NULL, Comentario nvarchar(1200) NULL);
INSERT INTO @Pasos (Festival, Paso, Fecha, Actor, EstadoAnterior, Comentario) VALUES
 -- Macizo: envío, ajustes por campo, reenvío corregido y publicación.
 (@FMacizo, N'envio', DATETIME2FROMPARTS(@Y3, 2, 20, 11, 0, 0, 0, 7), @Lucia, N'borrador', NULL),
 (@FMacizo, N'ajustes', DATETIME2FROMPARTS(@Y3, 3, 1, 15, 30, 0, 0, 7), @Gestor, N'en_revision', NULL),
 (@FMacizo, N'envio', DATETIME2FROMPARTS(@Y3, 3, 8, 10, 15, 0, 0, 7), @Lucia, N'ajustes_solicitados', NULL),
 (@FMacizo, N'publicar', DATETIME2FROMPARTS(@Y3, 3, 12, 9, 45, 0, 0, 7), @Gestor, N'en_revision', NULL),
 -- Chirimías: envío, ajustes, reenvío; espera decisión (segundo ciclo).
 (@FChirimias, N'envio', DATEADD(DAY, -20, @Ahora), @Lucia, N'borrador', NULL),
 (@FChirimias, N'ajustes', DATEADD(DAY, -15, @Ahora), @Gestor, N'en_revision', NULL),
 (@FChirimias, N'envio', DATEADD(DAY, -4, @Ahora), @Lucia, N'ajustes_solicitados', NULL),
 -- Gaitas: envío y publicación.
 (@FGaitas, N'envio', DATETIME2FROMPARTS(@Y2, 3, 15, 9, 0, 0, 0, 7), @Mariana, N'borrador', NULL),
 (@FGaitas, N'publicar', DATETIME2FROMPARTS(@Y2, 3, 22, 16, 0, 0, 0, 7), @Webmaster, N'en_revision', NULL),
 -- Bullerengue: envío y ajustes pedidos, sin atender todavía.
 (@FBullerengue, N'envio', DATEADD(DAY, -18, @Ahora), @Mariana, N'borrador', NULL),
 (@FBullerengue, N'ajustes', DATEADD(DAY, -6, @Ahora), @Gestor, N'en_revision', NULL),
 -- Acordeones: envío y rechazo con motivo.
 (@FAcordeones, N'envio', DATETIME2FROMPARTS(@Y1, 2, 10, 9, 0, 0, 0, 7), @Mariana, N'borrador', NULL),
 (@FAcordeones, N'rechazar', DATETIME2FROMPARTS(@Y1, 2, 25, 11, 0, 0, 0, 7), @Gestor, N'en_revision',
  N'La muestra no tiene programación ni fechas propias: es la ruta de conciertos de una convocatoria departamental. Se puede registrar como evento de la Agenda de la Fundación.'),
 -- Bandas del Oriente: primer envío.
 (@FBandas, N'envio', DATEADD(DAY, -2, @Ahora), @Diana, N'borrador', NULL),
 -- Cuerdas de Silvia: envío y ajustes pedidos, sin atender todavía (le piden a Lucía que los atienda).
 (@FCuerdas, N'envio', DATEADD(DAY, -12, @Ahora), @Andres, N'borrador', NULL),
 (@FCuerdas, N'ajustes', DATEADD(DAY, -4, @Ahora), @Gestor, N'en_revision', NULL);

-- Revisiones por campo (las de Macizo y Chirimías ya se cerraron con el reenvío).
DECLARE @Revisiones TABLE (Festival int PRIMARY KEY, Id bigint NULL, Fecha datetime2, Estado nvarchar(20), Cierre datetime2 NULL,
    Destinatario int, General nvarchar(1200));
INSERT INTO @Revisiones (Festival, Fecha, Estado, Cierre, Destinatario, General) VALUES
 (@FMacizo, DATETIME2FROMPARTS(@Y3, 3, 1, 15, 30, 0, 0, 7), N'cerrada', DATETIME2FROMPARTS(@Y3, 3, 8, 10, 15, 0, 0, 7), @Lucia,
  N'La ficha está casi lista. Ajusten la descripción y el teléfono y la publicamos.'),
 (@FChirimias, DATEADD(DAY, -15, @Ahora), N'cerrada', DATEADD(DAY, -4, @Ahora), @Lucia,
  N'Gracias por el registro. Revisen el nombre y los territorios sonoros antes de publicar.'),
 (@FBullerengue, DATEADD(DAY, -6, @Ahora), N'enviada', NULL, @Mariana,
  N'Faltan precisiones para publicar: completen la descripción, revisen el enlace de Instagram y las prácticas musicales.'),
 (@FCuerdas, DATEADD(DAY, -4, @Ahora), N'enviada', NULL, @Lucia,
  N'Casi lista: precisen la fecha de la serenata central y el contacto antes de publicar.');

INSERT INTO dbo.RevisionesDeRegistro (ModuloId, RegistroId, Estado, IdUsuarioRevisor, RevisorNombre, IdUsuarioDestinatario, DestinatarioNombre,
    IdOrganizacion, OrganizacionNombre, ObservacionGeneral, FechaCreacion, FechaActualizacion, FechaEnvio, FechaCierre)
SELECT N'festivales', CAST(r.Festival AS nvarchar(120)), r.Estado, @Gestor, g.NombreCompleto, r.Destinatario, d.NombreCompleto,
       f.OrganizacionPrincipalId, e.Nombre, r.General, DATEADD(MINUTE, -20, r.Fecha), COALESCE(r.Cierre, r.Fecha), r.Fecha, r.Cierre
FROM @Revisiones r
JOIN dbo.Festivales f ON f.IdFestival = r.Festival JOIN dbo.Entidades e ON e.IdEntidad = f.OrganizacionPrincipalId
JOIN dbo.Usuarios g ON g.IdUsuario = @Gestor JOIN dbo.Usuarios d ON d.IdUsuario = r.Destinatario;
UPDATE r SET Id = v.IdRevision FROM @Revisiones r JOIN dbo.RevisionesDeRegistro v ON v.ModuloId = N'festivales' AND v.RegistroId = CAST(r.Festival AS nvarchar(120));

DECLARE @Obs TABLE (Festival int, Seccion nvarchar(80), Campo nvarchar(120), Etiqueta nvarchar(240), Valor nvarchar(max), Nota nvarchar(2400), Atendida bit, Atiende int NULL);
INSERT INTO @Obs VALUES
 (@FMacizo, N'generales', N'festival.descripcion', N'Descripción del festival', N'Festival de músicas del Macizo en Popayán.',
  N'La descripción es muy breve: cuenten qué prácticas reúne, cuántos días dura y qué actividades tiene además de los conciertos.', 1, @Lucia),
 (@FMacizo, N'contacto-festival', N'festival.telefonoCelular', N'Celular', N'3140000202',
  N'Escriban el celular con el indicativo del país (+57) para que se pueda marcar desde el exterior.', 1, @Andres),
 (@FChirimias, N'generales', N'festival.nombre', N'Nombre del festival', N'Encuentro de Chirimias',
  N'Agreguen el territorio al nombre y la tilde: «Encuentro de Chirimías del Cauca».', 1, @Andres),
 (@FChirimias, N'musica-festival', N'festival.territoriosSonoros', N'Territorios sonoros', N'Flautas, Cuerdas y Tambores Sureños',
  N'Las chirimías caucanas también pertenecen al territorio sonoro «Chirimía». Márquenlo.', 1, @Andres),
 (@FBullerengue, N'generales', N'festival.descripcion', N'Descripción del festival', NULL,
  N'Cuenten cuántas cantadoras y agrupaciones participan y si hay semilleros infantiles.', 0, NULL),
 (@FBullerengue, N'contacto-festival', N'festival.instagram', N'Instagram', N'https://instagram.com/bullerengue.test',
  N'El enlace de Instagram lleva a una cuenta personal; usen la cuenta del Festival.', 0, NULL),
 (@FBullerengue, N'musica-festival', N'festival.practicasMusicales', N'Prácticas musicales', N'Músicas de comunidades negras, afrocolombianas, raizales y palenqueras, Músicas vocales, corales y de tradición cantada',
  N'Si hay taller de tambor y fandango, consideren añadir «Músicas populares tradicionales, regionales y patrimoniales».', 0, NULL),
 (@FCuerdas, N'generales', N'festival.periodicidadDetalle', N'Detalle de la periodicidad', N'Primer fin de semana de diciembre.',
  N'Indiquen la fecha de la serenata central y si cambia cada año.', 0, NULL),
 (@FCuerdas, N'contacto-festival', N'festival.telefonoCelular', N'Celular', N'3140000909',
  N'Escriban el celular con el indicativo del país (+57) para que se pueda marcar desde el exterior.', 0, NULL);

-- Lo observado en Bullerengue se lee como estaba al pedir los ajustes: la descripción era corta.
UPDATE @Obs SET Valor = (SELECT Descripcion FROM dbo.Festivales WHERE IdFestival = @FBullerengue) WHERE Festival = @FBullerengue AND Campo = N'festival.descripcion';

INSERT INTO dbo.RevisionesDeRegistroObservaciones (IdRevision, Ambito, SubregistroId, SeccionId, CampoId, CampoEtiqueta, ValorObservado, Nota,
    Estado, FechaCreacion, FechaActualizacion, FechaAtencion, IdUsuarioAtiende)
SELECT r.Id, N'principal', NULL, o.Seccion, o.Campo, o.Etiqueta, o.Valor, o.Nota,
       CASE WHEN o.Atendida = 1 THEN N'atendida' ELSE N'pendiente' END, DATEADD(MINUTE, -15, r.Fecha),
       CASE WHEN o.Atendida = 1 THEN DATEADD(HOUR, -2, r.Cierre) ELSE NULL END,
       CASE WHEN o.Atendida = 1 THEN DATEADD(HOUR, -2, r.Cierre) ELSE NULL END, o.Atiende
FROM @Obs o JOIN @Revisiones r ON r.Festival = o.Festival;

-- Historial de cada paso, con la forma que escribe la API.
INSERT INTO #Hist (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, CamposObservados, IdUsuario, Fecha, MetadataJson, OrganizacionId, Instantanea)
SELECT N'festivales', CAST(p.Festival AS nvarchar(120)), p.EstadoAnterior,
       CASE p.Paso WHEN N'envio' THEN N'en_revision' WHEN N'ajustes' THEN N'ajustes_solicitados' WHEN N'publicar' THEN N'publicado' ELSE N'rechazado' END,
       CASE p.Paso WHEN N'envio' THEN N'FestivalEnviadoARevision' WHEN N'ajustes' THEN N'FestivalCambiosPedidosPorCampo' WHEN N'publicar' THEN N'FestivalPublicado' ELSE N'FestivalRechazado' END,
       CASE WHEN p.Paso = N'ajustes' THEN
            CONCAT(CASE WHEN (SELECT COUNT(*) FROM @Obs o WHERE o.Festival = p.Festival) = 1 THEN N'Se sugiere un ajuste en: '
                        ELSE CONCAT(N'Se sugieren ajustes en ', (SELECT COUNT(*) FROM @Obs o WHERE o.Festival = p.Festival), N' campos: ') END,
                   (SELECT STRING_AGG(o.Etiqueta, N', ') FROM @Obs o WHERE o.Festival = p.Festival), N'. ',
                   (SELECT General FROM @Revisiones r WHERE r.Festival = p.Festival))
            ELSE NULL END,
       CASE WHEN p.Paso = N'rechazar' THEN p.Comentario ELSE NULL END,
       CASE WHEN p.Paso = N'ajustes' THEN
            (SELECT N'principal' AS ambito, CAST(NULL AS nvarchar(20)) AS subregistroId, o.Seccion AS seccionId, o.Campo AS campoId,
                    o.Etiqueta AS campoEtiqueta, o.Valor AS valorObservado, o.Nota AS nota
             FROM @Obs o WHERE o.Festival = p.Festival FOR JSON PATH, INCLUDE_NULL_VALUES)
            ELSE NULL END,
       p.Actor, p.Fecha,
       CASE p.Paso
            WHEN N'ajustes' THEN CONCAT(N'{"revisionId":', (SELECT Id FROM @Revisiones r WHERE r.Festival = p.Festival),
                 N',"cuantosCampos":', (SELECT COUNT(*) FROM @Obs o WHERE o.Festival = p.Festival),
                 N',"destinatarioId":', (SELECT Destinatario FROM @Revisiones r WHERE r.Festival = p.Festival),
                 N',"destinatarioNombre":"', (SELECT u.NombreCompleto FROM @Revisiones r JOIN dbo.Usuarios u ON u.IdUsuario = r.Destinatario WHERE r.Festival = p.Festival),
                 N'","organizacionPrincipalId":', f.OrganizacionPrincipalId, N'}')
            WHEN N'envio' THEN NULL
            ELSE CONCAT(N'{"OrganizacionPrincipalId":', f.OrganizacionPrincipalId, N'}') END,
       f.OrganizacionPrincipalId, 1
FROM @Pasos p JOIN dbo.Festivales f ON f.IdFestival = p.Festival
ORDER BY p.Orden;

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha)
SELECT p.Actor, N'Festivales', CAST(p.Festival AS nvarchar(120)),
       CASE p.Paso WHEN N'publicar' THEN N'publicar' WHEN N'rechazar' THEN N'rechazar' ELSE N'actualizar' END,
       CONCAT(N'{"Estado":"', p.EstadoAnterior, N'"}'),
       CONCAT(N'{"OrganizacionPrincipalId":', f.OrganizacionPrincipalId, N',"Estado":"',
              CASE p.Paso WHEN N'envio' THEN N'en_revision' WHEN N'ajustes' THEN N'ajustes_solicitados' WHEN N'publicar' THEN N'publicado' ELSE N'rechazado' END,
              N'","Evento":"',
              CASE p.Paso WHEN N'envio' THEN N'FestivalEnviadoARevision' WHEN N'ajustes' THEN N'FestivalCambiosPedidosPorCampo' WHEN N'publicar' THEN N'FestivalPublicado' ELSE N'FestivalRechazado' END,
              N'"}'), p.Fecha
FROM @Pasos p JOIN dbo.Festivales f ON f.IdFestival = p.Festival;

-- Envíos de revisión: el número y la instantánea de lo enviado.
INSERT INTO dbo.EnviosDeRevision (NumeroEnvio, IdUsuarioRemitente, IdOrganizacion, IdRevisionOrigen, EstadoAnterior, DatosJson, FechaEnvio, ModuloId, RegistroId)
SELECT ROW_NUMBER() OVER (PARTITION BY p.Festival ORDER BY p.Orden), p.Actor, f.OrganizacionPrincipalId,
       CASE WHEN p.EstadoAnterior = N'ajustes_solicitados' THEN (SELECT Id FROM @Revisiones r WHERE r.Festival = p.Festival) END,
       p.EstadoAnterior, N'{}', p.Fecha, N'festivales', CAST(p.Festival AS nvarchar(120))
FROM @Pasos p JOIN dbo.Festivales f ON f.IdFestival = p.Festival
WHERE p.Paso = N'envio';

-- El estado de cada Festival al final de su historia y la fecha de su último movimiento.
UPDATE f SET FechaActualizacion = x.Ultima
FROM dbo.Festivales f JOIN (SELECT Festival, MAX(Fecha) AS Ultima FROM @Pasos GROUP BY Festival) x ON x.Festival = f.IdFestival;

-- ── 4.2 Ediciones ────────────────────────────────────────────────────────────────────────────
-- Macizo tiene las cinco caras de una edición: realizada ×2, cancelada, programada y en
-- preparación (borrador). Cada una con todos sus campos, clasificaciones, lugares, aliadas y afiche.
DECLARE @Ed TABLE (Clave nvarchar(30) PRIMARY KEY, Id int NULL, Festival int, Anio int, Numero int, Nombre nvarchar(240), Descripcion nvarchar(max),
    Inicio date NULL, Fin date NULL, Estado nvarchar(30), Registro nvarchar(30), Visibilidad nvarchar(30), Director nvarchar(240),
    Tipologia int, OtraTipologia nvarchar(120) NULL, Fin1 int, Fin2 int NULL, OtraFin2 nvarchar(120) NULL, Estampilla bit, Congrega nvarchar(500),
    OtraModalidad nvarchar(120) NULL, OtraExpresion nvarchar(120) NULL, Afiche nvarchar(60) NULL, Alta datetime2, Publicada datetime2 NULL, Autor int);
INSERT INTO @Ed VALUES
 (N'macizo-3', NULL, @FMacizo, @Y3, 11, N'XI Festival de Músicas del Macizo · «Raíces que suenan»',
  N'Programación: cinco noches de conciertos en el Parque Caldas con 24 agrupaciones de 11 municipios; tres talleres de flauta de caña y tiple para 90 niñas y niños; muestra de luthería con ocho constructores; conversatorio «La minga como escenario».' + NCHAR(10) + NCHAR(10)
  + N'Cifras: 6.800 asistentes, 212 músicos en escena, 38 % mujeres, 4 resguardos participantes.',
  DATEFROMPARTS(@Y3, 7, 18), DATEFROMPARTS(@Y3, 7, 22), N'realizada', N'publicado', N'publicada', N'Ernesto Yalanda Quilindo',
  @TipFestival, NULL, @FinMincultura, @FinAlcaldia, NULL, 1, N'Chirimías, conjuntos de cuerdas andinas, flautas de caña, cantos de minga y bambucos caucanos.', NULL, NULL,
  N'afiche-macizo-2023', DATETIME2FROMPARTS(@Y3, 3, 20, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y3, 4, 2, 9, 0, 0, 0, 7), @Lucia),
 (N'macizo-2', NULL, @FMacizo, @Y2, 12, N'XII Festival de Músicas del Macizo · «Voces de la montaña»',
  N'Programación: conciertos en el Parque Caldas y en dos veredas de Cajibío, concurso de agrupaciones juveniles, encuentro de cantadoras de minga y una muestra de grabaciones de campo del archivo de la Corporación.' + NCHAR(10) + NCHAR(10)
  + N'Cifras: 8.200 asistentes, 245 músicos, 41 % mujeres, transmisión en línea con 12.000 reproducciones.',
  DATEFROMPARTS(@Y2, 7, 16), DATEFROMPARTS(@Y2, 7, 21), N'realizada', N'publicado', N'publicada', N'Ernesto Yalanda Quilindo',
  @TipFestival, NULL, @FinMincultura, @FinOtra, N'Aportes de cooperativas campesinas', 1, N'Chirimías, cuerdas andinas, cantos de minga, músicas de banda de los resguardos.', N'Residencias artísticas en veredas', NULL,
  N'afiche-macizo-2024', DATETIME2FROMPARTS(@Y2, 3, 10, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y2, 4, 1, 9, 0, 0, 0, 7), @Lucia),
 (N'macizo-1', NULL, @FMacizo, @Y1, 13, N'XIII Festival de Músicas del Macizo (cancelado)',
  N'Edición cancelada por el cierre de la vía Panamericana durante tres semanas de julio: las agrupaciones de las veredas no podían llegar a Popayán. La programación prevista —26 agrupaciones y cuatro talleres— se trasladó en parte a la edición siguiente.' + NCHAR(10) + NCHAR(10)
  + N'Cifras previstas: 7.000 asistentes y 230 músicos.',
  DATEFROMPARTS(@Y1, 7, 15), DATEFROMPARTS(@Y1, 7, 20), N'cancelada', N'publicado', N'publicada', N'María José Cuchillo Ijají',
  @TipFestival, NULL, @FinMincultura, @FinGobernacion, NULL, 0, N'Chirimías, cuerdas andinas y cantos de minga.', NULL, N'Cocinas tradicionales del Macizo',
  N'afiche-macizo-2025', DATETIME2FROMPARTS(@Y1, 3, 5, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 3, 30, 9, 0, 0, 0, 7), @Andres),
 (N'macizo-0', NULL, @FMacizo, @AP, 14, N'XIV Festival de Músicas del Macizo · «Volver a la plaza»',
  N'Programación prevista: concierto inaugural con las agrupaciones que no pudieron venir el año pasado, cuatro noches en el Parque Caldas, ruta de chirimías por los barrios, talleres de flauta y tiple, muestra de luthería y el lanzamiento del Cancionero del Macizo.' + NCHAR(10) + NCHAR(10)
  + N'Metas: 9.000 asistentes, 260 músicos, 45 % mujeres en escena.',
  @Prog, DATEADD(DAY, 4, @Prog), N'programada', N'publicado', N'publicada', N'María José Cuchillo Ijají',
  @TipFestival, NULL, @FinMincultura, @FinAlcaldia, NULL, 1, N'Chirimías, cuerdas andinas, cantos de minga, bambucos y músicas de banda.', NULL, NULL,
  N'afiche-macizo-2026', DATEADD(DAY, -50, @Ahora), DATEADD(DAY, -35, @Ahora), @Andres),
 (N'macizo-sig', NULL, @FMacizo, @AP + 1, 15, N'XV Festival de Músicas del Macizo',
  N'Edición en preparación: la Corporación está definiendo la convocatoria de agrupaciones y las alianzas con los municipios del sur del Cauca.',
  DATEFROMPARTS(@AP + 1, 7, 14), DATEFROMPARTS(@AP + 1, 7, 19), N'en_preparacion', N'borrador', N'borrador', N'María José Cuchillo Ijají',
  @TipFestival, NULL, @FinPropios, @FinMincultura, NULL, 1, N'Por definir con la convocatoria.', NULL, NULL,
  NULL, DATEADD(DAY, -7, @Ahora), NULL, @Andres),
 (N'chirimias-0', NULL, @FChirimias, @AP, 1, N'I Encuentro de Chirimías del Cauca',
  N'Programación prevista: dos días de presentaciones de 14 chirimías en el parque de Timbío, taller de construcción de flautas de caña y grabación de una muestra sonora de cada agrupación.',
  DATEADD(DAY, 10, @Prog), DATEADD(DAY, 11, @Prog), N'programada', N'borrador', N'borrador', N'Andrés Felipe Muñoz Chilito',
  @TipEncuentro, NULL, @FinMincultura, @FinPropios, NULL, 0, N'Chirimías caucanas.', NULL, NULL,
  N'afiche-chirimias-2026', DATEADD(DAY, -22, @Ahora), NULL, @Andres),
 (N'gaitas-2', NULL, @FGaitas, @Y2, 8, N'VIII Festival de Gaitas y Tambores de la Sierra',
  N'Concurso de agrupaciones tradicionales y juveniles, encuentro de constructores de gaitas y ruedas de baile en el Camellón de la Bahía.' + NCHAR(10) + NCHAR(10) + N'Cifras: 5.100 asistentes, 30 agrupaciones.',
  DATEFROMPARTS(@Y2, 10, 3), DATEFROMPARTS(@Y2, 10, 6), N'realizada', N'publicado', N'publicada', N'Mariana Isabel Palacios Mendoza',
  @TipFestival, NULL, @FinGobernacion, @FinPropios, NULL, 1, N'Gaitas, tambores y maracas del Caribe.', NULL, NULL,
  NULL, DATETIME2FROMPARTS(@Y2, 4, 1, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y2, 4, 10, 10, 0, 0, 0, 7), @Mariana),
 (N'gaitas-1', NULL, @FGaitas, @Y1, 9, N'IX Festival de Gaitas y Tambores de la Sierra',
  N'Concurso de agrupaciones, muestra de gaiteros de la Sierra y conversatorio sobre la transmisión del oficio.' + NCHAR(10) + NCHAR(10) + N'Cifras: 5.900 asistentes, 34 agrupaciones.',
  DATEFROMPARTS(@Y1, 10, 2), DATEFROMPARTS(@Y1, 10, 5), N'realizada', N'publicado', N'publicada', N'José Manuel Caicedo Rentería',
  @TipFestival, NULL, @FinGobernacion, @FinMincultura, NULL, 1, N'Gaitas, tambores y maracas del Caribe.', NULL, NULL,
  N'afiche-gaitas-2025', DATETIME2FROMPARTS(@Y1, 4, 1, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 4, 12, 10, 0, 0, 0, 7), @Jose),
 (N'bullerengue-0', NULL, @FBullerengue, @AP, 1, N'I Festival Bullerengue al Mar',
  N'Ruedas de bullerengue en la playa, semillero infantil y taller de tambor alegre.',
  DATEADD(DAY, 3, @Prog), DATEADD(DAY, 5, @Prog), N'programada', N'borrador', N'borrador', N'José Manuel Caicedo Rentería',
  @TipFestival, NULL, @FinPropios, NULL, NULL, 0, N'Bullerengue sentao, fandango de lengua y chalupa.', NULL, NULL,
  N'afiche-bullerengue-2026', DATEADD(DAY, -40, @Ahora), NULL, @Jose),
 (N'contrapunteo-0', NULL, @FContrapunteo, @AP, 6, N'VI Festival Llanero de Contrapunteo',
  N'Concurso de contrapunteo en tres categorías, concurso de arpa y muestra de luthería.',
  DATEADD(DAY, 20, @Prog), DATEADD(DAY, 22, @Prog), N'programada', N'borrador', N'borrador', N'Camilo Andrés Rojas Pérez',
  @TipFestival, NULL, @FinAlcaldia, @FinPropios, NULL, 1, N'Joropo, contrapunteo, copla y pasaje llanero.', NULL, NULL,
  NULL, DATEADD(DAY, -11, @Ahora), NULL, @Camilo),
 (N'bandasoriente-1', NULL, @FBandas, @Y1, 19, N'XIX Encuentro de Bandas del Oriente Antioqueño',
  N'Concierto de bandas unidas, clínicas de instrumento y retreta. Cifras: 18 bandas y 640 músicos.',
  DATEFROMPARTS(@Y1, 8, 9), DATEFROMPARTS(@Y1, 8, 10), N'realizada', N'borrador', N'borrador', N'Diana Marcela Zapata Gómez',
  @TipOtra, N'Encuentro de bandas con concurso de dirección', @FinOtra, @FinAlcaldia, NULL, 1, N'Bandas sinfónicas y de vientos.', NULL, NULL,
  NULL, DATEADD(DAY, -29, @Ahora), NULL, @Diana);

INSERT INTO dbo.EdicionesFestival (FestivalId, Anio, Nombre, Descripcion, FechaInicio, FechaFin, Estado, FechaCreacion, FechaActualizacion,
    Director, EstadoRegistro, TipologiaFestivalId, OtraTipologia, FuenteFinanciacionPrimariaId, OtraFuenteFinanciacionPrimaria,
    FuenteFinanciacionSecundariaId, OtraFuenteFinanciacionSecundaria, UsaEstampillaProcultura, PracticasMusicalesQueCongrega,
    OtraModalidadParticipacion, OtraExpresionArtistica, NumeroEdicion, EstadoVisibilidad)
SELECT Festival, Anio, Nombre, Descripcion, Inicio, Fin, Estado, Alta, COALESCE(Publicada, Alta),
       Director, Registro, Tipologia, OtraTipologia, Fin1, CASE WHEN Fin1 = @FinOtra THEN N'Cuotas de las bandas asociadas' END, Fin2, OtraFin2, Estampilla, Congrega,
       OtraModalidad, OtraExpresion, Numero, Visibilidad
FROM @Ed;

UPDATE e SET Id = x.IdEdicionFestival FROM @Ed e JOIN dbo.EdicionesFestival x ON x.FestivalId = e.Festival AND x.Anio = e.Anio;

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), N'externo', f.OrganizacionPrincipalId, e.Autor, e.Alta
FROM @Ed e JOIN dbo.Festivales f ON f.IdFestival = e.Festival;

-- Clasificaciones de cada edición: las del Festival, más expresiones, modalidades e ingreso.
INSERT INTO dbo.PracticasMusicalesDeRegistro (ModuloId, RegistroId, IdPracticaMusical)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), p.IdPracticaMusical
FROM @Ed e JOIN dbo.PracticasMusicalesDeRegistro p ON p.ModuloId = N'festivales' AND p.RegistroId = CAST(e.Festival AS nvarchar(120));
INSERT INTO dbo.TerritoriosSonorosDeRegistro (ModuloId, RegistroId, IdTerritorioSonoro)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), t.IdTerritorioSonoro
FROM @Ed e JOIN dbo.TerritoriosSonorosDeRegistro t ON t.ModuloId = N'festivales' AND t.RegistroId = CAST(e.Festival AS nvarchar(120));
INSERT INTO dbo.ExpresionesArtisticasDeRegistro (ModuloId, RegistroId, IdExpresionArtistica)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), x.IdExpresionArtistica
FROM @Ed e JOIN dbo.ExpresionesArtisticas x ON x.Slug IN (N'musica', N'danza', CASE WHEN e.Clave LIKE N'macizo%' THEN N'artesania' ELSE N'narracion' END);
INSERT INTO dbo.ModalidadesParticipacionDeRegistro (ModuloId, RegistroId, IdModalidadParticipacion)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), m.IdModalidadParticipacion
FROM @Ed e JOIN dbo.ModalidadesParticipacion m ON m.Slug IN (N'por-convocatoria', N'invitados-pagos', CASE WHEN e.Clave LIKE N'gaitas%' OR e.Clave LIKE N'contrapunteo%' THEN N'concurso' ELSE N'invitados-pagos' END);
INSERT INTO dbo.TiposIngresoDeRegistro (ModuloId, RegistroId, IdTipoIngreso)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), t.IdTipoIngreso
FROM @Ed e JOIN dbo.TiposIngreso t ON t.Slug IN (N'entrada-libre', CASE WHEN e.Clave LIKE N'macizo%' THEN N'boleteria-paga' ELSE N'entrada-libre' END);

-- Lugares: la cabecera del municipio del Festival y, en el Macizo y la Sierra, un lugar rural.
INSERT INTO dbo.LocalizacionesDeRegistro (ModuloId, RegistroId, CodigoDepartamento, CodigoMunicipio, ZonaUrbanoRuralId, TitulacionColectivaId)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), f.CodigoDepartamento, f.CodigoMunicipio, @ZonaCabecera, @TitNoAplica
FROM @Ed e JOIN dbo.Festivales f ON f.IdFestival = e.Festival WHERE f.CodigoMunicipio IS NOT NULL
UNION ALL SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), '19', '19130', @ZonaRural, @TitResguardo FROM @Ed e WHERE e.Clave IN (N'macizo-3', N'macizo-2', N'macizo-0')
UNION ALL SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), '47', '47745', @ZonaRural, @TitConsejo FROM @Ed e WHERE e.Clave IN (N'gaitas-2', N'gaitas-1');

-- Entidades aliadas: una pública escrita a mano y una organización de SIMUS enlazada.
INSERT INTO dbo.EntidadesAliadasDeRegistro (ModuloId, RegistroId, NombreEntidadAliada, CorreoEntidadAliada, NaturalezaEntidadId, EntidadId)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)),
       CASE WHEN e.Clave LIKE N'macizo%' OR e.Clave LIKE N'chirimias%' THEN N'Secretaría de Cultura de Popayán (demostración)'
            WHEN e.Clave LIKE N'contrapunteo%' THEN N'Instituto de Cultura de Casanare (demostración)'
            WHEN e.Clave LIKE N'bandas%' THEN N'Instituto de Cultura de Antioquia (demostración)'
            ELSE N'Instituto de Cultura del Magdalena (demostración)' END,
       N'cultura@alcaldia.test', @NatPublica, NULL
FROM @Ed e
UNION ALL SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), N'Fundación Sonora del Caribe', N'hola@sonoracaribe.test', @NatPrivada, @Sonora
FROM @Ed e WHERE e.Clave IN (N'macizo-2', N'macizo-0')
UNION ALL SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), N'Corporación Cultural Cantaclaro', N'contacto@cantaclaro.test', @NatPrivada, @Cantaclaro
FROM @Ed e WHERE e.Clave = N'gaitas-1';

-- Materiales: el afiche del Banco y, en las realizadas, la memoria en línea.
INSERT INTO dbo.ArchivosDeRegistro (ModuloId, RegistroId, ArchivoId, Url, RolArchivo, DescripcionArchivo, OrdenVisualizacion, FechaCreacion)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), i.Id, CONCAT(N'/api/v1/publico/archivos/', i.Id), N'material',
       CONCAT(N'Afiche oficial de la edición ', e.Anio, N'.'), 1, e.Alta
FROM @Ed e JOIN @Img i ON i.Nombre = e.Afiche
UNION ALL SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), NULL, CONCAT(N'https://musicasdelmacizo.test/memorias-', e.Anio, N'.pdf'), N'material',
       N'Memoria de la edición: programación, cifras y fotografías.', 2, e.Alta
FROM @Ed e WHERE e.Estado = N'realizada' AND e.Clave LIKE N'macizo%';

-- La organización publica sus ediciones (decisión 13 de docs/referencia/20-decisiones-y-flujos-por-modulo.md).
INSERT INTO #Hist (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, CamposObservados, IdUsuario, Fecha, MetadataJson, OrganizacionId, Instantanea)
SELECT N'ediciones-festival', CAST(e.Id AS nvarchar(120)), N'borrador', N'publicado', N'EdicionPublicadaPorOrganizacion', NULL, NULL, NULL, e.Autor, e.Publicada,
       CONCAT(N'{"FestivalId":', e.Festival, N',"Anio":', e.Anio, N',"NumeroEdicion":', e.Numero, N'}'), f.OrganizacionPrincipalId, 1
FROM @Ed e JOIN dbo.Festivales f ON f.IdFestival = e.Festival WHERE e.Visibilidad = N'publicada';

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha)
SELECT e.Autor, N'EdicionesFestival', CAST(e.Id AS nvarchar(120)), N'actualizar', N'{"EstadoVisibilidad":"borrador"}',
       CONCAT(N'{"FestivalId":', e.Festival, N',"EstadoVisibilidad":"publicada","Evento":"EdicionPublicadaPorOrganizacion"}'), e.Publicada
FROM @Ed e WHERE e.Visibilidad = N'publicada';

-- Supervisión posterior: la consola observa la edición cancelada y pide un dato por campo.
DECLARE @EdCancelada int = (SELECT Id FROM @Ed WHERE Clave = N'macizo-1');
DECLARE @EdRealizada int = (SELECT Id FROM @Ed WHERE Clave = N'macizo-2');
INSERT INTO #Hist (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, CamposObservados, IdUsuario, Fecha, MetadataJson, OrganizacionId, Instantanea)
VALUES (N'ediciones-festival', CAST(@EdRealizada AS nvarchar(120)), N'publicado', N'publicado', N'EdicionObservada',
        N'Revisamos las cifras de asistencia: coinciden con el informe de la Secretaría de Cultura. Sin cambios.', NULL, NULL, @Gestor,
        DATETIME2FROMPARTS(@Y2, 8, 20, 10, 0, 0, 0, 7), CONCAT(N'{"FestivalId":', @FMacizo, N',"Motivo":"supervision_posterior"}'), @Cantaclaro, 1),
       (N'ediciones-festival', CAST(@EdCancelada AS nvarchar(120)), N'publicado', N'publicado', N'EdicionObservadaPorCampo',
        N'Para el informe anual del Programa: precisen en la descripción qué parte de la programación pasa a la edición siguiente.', NULL, NULL, @Gestor,
        DATEADD(DAY, -10, @Ahora), NULL, NULL, 0);

INSERT INTO dbo.RevisionesDeRegistro (ModuloId, RegistroId, Estado, IdUsuarioRevisor, RevisorNombre, ObservacionGeneral, FechaCreacion, FechaActualizacion, FechaEnvio)
SELECT N'ediciones-festival', CAST(@EdCancelada AS nvarchar(120)), N'enviada', @Gestor, NombreCompleto,
       N'Para el informe anual del Programa: precisen en la descripción qué parte de la programación pasa a la edición siguiente.',
       DATEADD(DAY, -10, @Ahora), DATEADD(DAY, -10, @Ahora), DATEADD(DAY, -10, @Ahora)
FROM dbo.Usuarios WHERE IdUsuario = @Gestor;
INSERT INTO dbo.RevisionesDeRegistroObservaciones (IdRevision, Ambito, SubregistroId, SeccionId, CampoId, CampoEtiqueta, ValorObservado, Nota, Estado, FechaCreacion)
SELECT IdRevision, N'principal', NULL, N'identificacion', N'descripcion', N'Descripción', (SELECT Descripcion FROM dbo.EdicionesFestival WHERE IdEdicionFestival = @EdCancelada),
       N'Indiquen cuántas agrupaciones y talleres pasan a la edición siguiente.', N'pendiente', DATEADD(DAY, -10, @Ahora)
FROM dbo.RevisionesDeRegistro WHERE ModuloId = N'ediciones-festival' AND RegistroId = CAST(@EdCancelada AS nvarchar(120));

-- El resumen de ediciones en la cabecera del Festival, como lo recalcula la API.
UPDATE f SET
    NumeroEdiciones = (SELECT COUNT(*) FROM dbo.EdicionesFestival e WHERE e.FestivalId = f.IdFestival),
    FechaUltimaEdicion = (SELECT MAX(e.FechaInicio) FROM dbo.EdicionesFestival e WHERE e.FestivalId = f.IdFestival),
    TieneEdicionVigenteAnoActual = CASE WHEN EXISTS (SELECT 1 FROM dbo.EdicionesFestival e WHERE e.FestivalId = f.IdFestival AND e.Anio = YEAR(@Hoy)) THEN 1 ELSE 0 END,
    EstadoEdicionAnoActual = (SELECT TOP 1 e.Estado FROM dbo.EdicionesFestival e WHERE e.FestivalId = f.IdFestival AND e.Anio = YEAR(@Hoy)),
    FechaInicioEdicionActual = (SELECT TOP 1 e.FechaInicio FROM dbo.EdicionesFestival e WHERE e.FestivalId = f.IdFestival AND e.Anio = YEAR(@Hoy)),
    FechaFinEdicionActual = (SELECT TOP 1 e.FechaFin FROM dbo.EdicionesFestival e WHERE e.FestivalId = f.IdFestival AND e.Anio = YEAR(@Hoy))
FROM dbo.Festivales f WHERE f.IdFestival IN (SELECT Id FROM @Fest);

-- ── 4.3 Historia y propuestas de cambio del Festival del Macizo ──────────────────────────────
-- La cabecera del Festival ES lo publicado. Una primera propuesta, ya aplicada, la dejó como está
-- (descripción nueva, otro enlace, dirección y tipo de organización) y su rastro está en
-- CambiosDeRegistro con origen «propuesta». Una segunda propuesta, sobre la cabecera tal como está, espera decisión.
DECLARE @DescV1 nvarchar(max) = (SELECT Descripcion FROM dbo.Festivales WHERE IdFestival = @FMacizo);
DECLARE @DescV2 nvarchar(max) = N'Encuentro anual de las músicas campesinas del Macizo colombiano: chirimías, conjuntos de cuerdas, flautas de caña y cantos de minga. Durante cinco días reúne a agrupaciones de veredas y resguardos del Cauca, Huila y Nariño con conciertos en la plaza de Popayán, una ruta de chirimías por los barrios, talleres para niñas y niños, una muestra de luthería y un conversatorio sobre la memoria sonora del territorio.' + NCHAR(10) + NCHAR(10) + N'Desde su undécima edición publica cada año un cancionero con el repertorio de las agrupaciones participantes. Datos de demostración: no corresponde a un Festival real.';
DECLARE @AbreP1 datetime2 = DATETIME2FROMPARTS(@Y1, 8, 20, 10, 0, 0, 0, 7);
DECLARE @EnviaP1 datetime2 = DATETIME2FROMPARTS(@Y1, 8, 22, 9, 0, 0, 0, 7);
DECLARE @AplicaP1 datetime2 = DATETIME2FROMPARTS(@Y1, 9, 2, 11, 30, 0, 0, 7);

-- La cabecera queda en el valor de la propuesta aplicada (lo que lee la ficha pública).
UPDATE dbo.Festivales SET Descripcion = @DescV2, Director = N'María José Cuchillo Ijají', TipoOrganizadorId = @OrgCasaCultural,
    PerteneceAOrganizacionColectiva = 1, NombreOrganizacionColectiva = N'Red de Festivales del Suroccidente (demostración)'
WHERE IdFestival = @FMacizo;
-- El afiche vigente acompaña al Festival.
INSERT INTO dbo.ArchivosDeRegistro (ModuloId, RegistroId, ArchivoId, Url, RolArchivo, DescripcionArchivo, OrdenVisualizacion, FechaCreacion)
SELECT N'festivales', CAST(@FMacizo AS nvarchar(120)), Id, CONCAT(N'/api/v1/publico/archivos/', Id), N'material', N'Afiche de la próxima edición.', 1, @AplicaP1
FROM @Img WHERE Nombre = N'afiche-macizo-2026';

DECLARE @NombreLucia nvarchar(180) = (SELECT NombreCompleto FROM dbo.Usuarios WHERE IdUsuario = @Lucia);
DECLARE @NombreWebmaster nvarchar(180) = (SELECT NombreCompleto FROM dbo.Usuarios WHERE IdUsuario = @Webmaster);
DECLARE @NombreCantaclaro nvarchar(240) = (SELECT Nombre FROM dbo.Entidades WHERE IdEntidad = @Cantaclaro);

INSERT INTO dbo.PropuestasDeCambio (ModuloId, RegistroId, Estado, IdOrganizacion, OrganizacionNombre, IdUsuarioProponente, ProponenteNombre, Motivo,
    IdUsuarioDecide, DecideNombre, MotivoDeLaDecision, FechaCreacion, FechaActualizacion, FechaEnvio, FechaDecision)
VALUES (N'festivales', CAST(@FMacizo AS nvarchar(120)), N'aplicada', @Cantaclaro, @NombreCantaclaro, @Lucia, @NombreLucia,
        N'Cambio de dirección artística y nueva descripción tras la edición cancelada.', @Webmaster, @NombreWebmaster,
        N'Cambios verificados con la Corporación. Se publican en la ficha.', @AbreP1, @AplicaP1, @EnviaP1, @AplicaP1);
DECLARE @P1 bigint = SCOPE_IDENTITY();
INSERT INTO dbo.PropuestasDeCambioCampos (IdPropuesta, SeccionId, CampoId, CampoEtiqueta, ValorAnterior, ValorPropuesto, FechaCreacion, FechaActualizacion) VALUES
 (@P1, N'generales', N'descripcion', N'Descripción', @DescV1, @DescV2, @AbreP1, @EnviaP1),
 (@P1, N'contacto', N'otroEnlace', N'Otro enlace', N'https://musicasdelmacizo.test/agenda', N'https://musicasdelmacizo.test/programacion', @AbreP1, @EnviaP1),
 (@P1, N'organizador', N'director', N'Director o directora', N'Ernesto Yalanda Quilindo', N'María José Cuchillo Ijají', @AbreP1, @EnviaP1),
 (@P1, N'organizador', N'tipoOrganizadorId', N'Tipo de organización', CAST(@OrgComunitario AS nvarchar(20)), CAST(@OrgCasaCultural AS nvarchar(20)), @AbreP1, @EnviaP1);

-- Segunda propuesta, viva, sobre la cabecera: nueva cuenta de Instagram y una práctica más.
DECLARE @PracticasActuales nvarchar(200) = (SELECT STRING_AGG(CAST(IdPracticaMusical AS nvarchar(10)), N',') WITHIN GROUP (ORDER BY IdPracticaMusical)
                                      FROM dbo.PracticasMusicalesDeRegistro WHERE ModuloId = N'festivales' AND RegistroId = CAST(@FMacizo AS nvarchar(120)));
DECLARE @PracticasP2 nvarchar(200) = (SELECT STRING_AGG(CAST(Id AS nvarchar(10)), N',') WITHIN GROUP (ORDER BY Id)
                                      FROM (SELECT IdPracticaMusical AS Id FROM dbo.PracticasMusicalesDeRegistro WHERE ModuloId = N'festivales' AND RegistroId = CAST(@FMacizo AS nvarchar(120))
                                            UNION SELECT @PmComunitarias) x);
INSERT INTO dbo.PropuestasDeCambio (ModuloId, RegistroId, Estado, IdOrganizacion, OrganizacionNombre, IdUsuarioProponente, ProponenteNombre, Motivo,
    FechaCreacion, FechaActualizacion, FechaEnvio)
VALUES (N'festivales', CAST(@FMacizo AS nvarchar(120)), N'en_revision', @Cantaclaro, @NombreCantaclaro, @Lucia, @NombreLucia,
        N'El Festival estrenó cuenta de Instagram y suma una línea de procesos comunitarios.', DATEADD(DAY, -4, @Ahora), @Reciente, @Reciente);
DECLARE @P2 bigint = SCOPE_IDENTITY();
INSERT INTO dbo.PropuestasDeCambioCampos (IdPropuesta, SeccionId, CampoId, CampoEtiqueta, ValorAnterior, ValorPropuesto, FechaCreacion, FechaActualizacion) VALUES
 (@P2, N'contacto', N'instagram', N'Instagram', N'https://instagram.com/musicasdelmacizo.test', N'https://instagram.com/festivalmacizo.test', DATEADD(DAY, -4, @Ahora), @Reciente),
 (@P2, N'practicas', N'practicasMusicales', N'Prácticas musicales', @PracticasActuales, @PracticasP2, DATEADD(DAY, -4, @Ahora), @Reciente);

-- El rastro de la propuesta aplicada: un solo guardado (un grupo) con lo que cambió en la cabecera.
DECLARE @GrupoP1 uniqueidentifier = NEWID();
INSERT INTO dbo.CambiosDeRegistro (ModuloId, RegistroId, OrganizacionId, IdGrupo, CampoId, CampoEtiqueta, ClaseDato, ValorAnterior, ValorNuevo,
    Origen, PropuestaId, ActorId, ActorNombre, ActorRol, Motivo, Fecha)
VALUES
 (N'festivales', CAST(@FMacizo AS nvarchar(120)), @Cantaclaro, @GrupoP1, N'descripcion', N'Descripción', N'publico', @DescV1, @DescV2,
  N'propuesta', @P1, @Webmaster, @NombreWebmaster, N'Consola', N'Cambio de dirección artística y nueva descripción tras la edición cancelada.', @AplicaP1),
 (N'festivales', CAST(@FMacizo AS nvarchar(120)), @Cantaclaro, @GrupoP1, N'otroEnlace', N'Otro enlace', N'publico', N'https://musicasdelmacizo.test/agenda', N'https://musicasdelmacizo.test/programacion',
  N'propuesta', @P1, @Webmaster, @NombreWebmaster, N'Consola', N'Cambio de dirección artística y nueva descripción tras la edición cancelada.', @AplicaP1),
 (N'festivales', CAST(@FMacizo AS nvarchar(120)), @Cantaclaro, @GrupoP1, N'director', N'Director o directora', N'publico', N'Ernesto Yalanda Quilindo', N'María José Cuchillo Ijají',
  N'propuesta', @P1, @Webmaster, @NombreWebmaster, N'Consola', N'Cambio de dirección artística y nueva descripción tras la edición cancelada.', @AplicaP1);

INSERT INTO #Hist (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, CamposObservados, IdUsuario, Fecha, MetadataJson, OrganizacionId, Instantanea) VALUES
 (N'propuestas-cambio-festival', CAST(@P1 AS nvarchar(120)), N'borrador', N'en_revision', N'FestivalPropuestaEnviadaARevision', NULL, NULL, NULL, @Lucia, @EnviaP1,
  CONCAT(N'{"FestivalOrigenId":', @FMacizo, N',"OrganizacionId":', @Cantaclaro, N'}'), @Cantaclaro, 1),
 (N'propuestas-cambio-festival', CAST(@P1 AS nvarchar(120)), N'en_revision', N'publicado', N'FestivalPropuestaPublicada', N'Cambios verificados con la Corporación. Se publican en la ficha.', NULL, NULL, @Webmaster, @AplicaP1,
  CONCAT(N'{"FestivalOrigenId":', @FMacizo, N',"OrganizacionId":', @Cantaclaro, N'}'), @Cantaclaro, 1),
 (N'propuestas-cambio-festival', CAST(@P2 AS nvarchar(120)), N'borrador', N'en_revision', N'FestivalPropuestaEnviadaARevision', NULL, NULL, NULL, @Lucia, @Reciente,
  CONCAT(N'{"FestivalOrigenId":', @FMacizo, N',"OrganizacionId":', @Cantaclaro, N'}'), @Cantaclaro, 1);

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha) VALUES
 (@Lucia, N'Festivales', CAST(@P1 AS nvarchar(120)), N'crear', NULL, CONCAT(N'{"FestivalOrigenId":', @FMacizo, N',"OrganizacionId":', @Cantaclaro, N',"Estado":"borrador","Evento":"FestivalCambioPropuesto"}'), @AbreP1),
 (@Webmaster, N'Festivales', CAST(@P1 AS nvarchar(120)), N'publicar', N'{"Estado":"en_revision"}', N'{"Estado":"aplicada","Evento":"FestivalPropuestaPublicada"}', @AplicaP1),
 (@Lucia, N'Festivales', CAST(@P2 AS nvarchar(120)), N'crear', NULL, CONCAT(N'{"FestivalOrigenId":', @FMacizo, N',"OrganizacionId":', @Cantaclaro, N',"Estado":"borrador","Evento":"FestivalCambioPropuesto"}'), DATEADD(DAY, -4, @Ahora));

-- ── 4.4 Retiro solicitado del Festival de Gaitas ─────────────────────────────────────────────
INSERT INTO dbo.SolicitudesVinculacionRegistros (ModuloId, RegistroId, UsuarioSolicitanteId, EntidadId, AlcanceSolicitado, Justificacion, EvidenciaTexto, Estado,
    UsuarioRevisorId, ComentarioRevision, FechaCreacion, FechaActualizacion)
VALUES (N'festivales_retiro', CAST(@FGaitas AS nvarchar(120)), @Mariana, @Sonora, N'responsable',
        N'La Fundación deja de organizar el Festival: desde este año lo asume la alcaldía, que lo registrará con su propia organización. Pedimos retirarlo para no duplicar la ficha.',
        N'Acta de la junta directiva del 2 de octubre (demostración).', N'pendiente', NULL, NULL, DATEADD(DAY, -5, @Ahora), DATEADD(DAY, -5, @Ahora));

-- ── 4.5 Instantánea de cada envío ────────────────────────────────────────────────────────────
UPDATE e SET DatosJson = CONCAT(N'{"esquema":1,"campos":', (
    SELECT c.campoId, c.seccionId, c.campoEtiqueta, c.valor FROM (VALUES
      (1, N'festival.nombre', N'generales', N'Nombre del Festival', f.NombreFestival),
      (2, N'festival.periodicidad', N'generales', N'Periodicidad', f.Periodicidad),
      (3, N'festival.descripcion', N'generales', N'Descripción del Festival', f.Descripcion),
      (4, N'festival.nivelCobertura', N'generales', N'Alcance territorial', f.NivelCobertura),
      (5, N'festival.codigoDepartamento', N'generales', N'Departamento', CAST(f.CodigoDepartamento AS nvarchar(10))),
      (6, N'festival.codigoMunicipio', N'generales', N'Municipio', CAST(f.CodigoMunicipio AS nvarchar(10))),
      (7, N'festival.periodicidadDetalle', N'generales', N'Detalle de la periodicidad', f.PeriodicidadDetalle),
      (8, N'festival.correoContacto', N'contacto-festival', N'Correo de contacto', f.CorreoFestival),
      (9, N'festival.telefonoCelular', N'contacto-festival', N'Teléfono celular', f.TelefonoFestival),
      (10, N'festival.instagram', N'contacto-festival', N'Instagram', f.InstagramFestival),
      (11, N'festival.facebook', N'contacto-festival', N'Facebook', f.FacebookFestival),
      (12, N'festival.paginaWeb', N'contacto-festival', N'Página web', f.SitioWebFestival),
      (13, N'festival.otroEnlace', N'contacto-festival', N'Otro enlace', f.OtroEnlaceFestival),
      (14, N'festival.observacionesContacto', N'contacto-festival', N'Observaciones de contacto', f.ObservacionesContacto),
      (15, N'festival.practicasMusicales', N'musica-festival', N'Prácticas musicales',
           (SELECT STRING_AGG(pm.NombrePracticaMusical, N', ') WITHIN GROUP (ORDER BY pm.NombrePracticaMusical) FROM dbo.PracticasMusicalesDeRegistro r
            JOIN dbo.PracticasMusicales pm ON pm.IdPracticaMusical = r.IdPracticaMusical WHERE r.ModuloId = N'festivales' AND r.RegistroId = e.RegistroId)),
      (16, N'festival.territoriosSonoros', N'musica-festival', N'Territorios sonoros',
           (SELECT STRING_AGG(ts.NombreTerritorioSonoro, N', ') WITHIN GROUP (ORDER BY ts.NombreTerritorioSonoro) FROM dbo.TerritoriosSonorosDeRegistro r
            JOIN dbo.TerritoriosSonoros ts ON ts.IdTerritorioSonoro = r.IdTerritorioSonoro WHERE r.ModuloId = N'festivales' AND r.RegistroId = e.RegistroId))
    ) c(Orden, campoId, seccionId, campoEtiqueta, valor) ORDER BY c.Orden FOR JSON PATH, INCLUDE_NULL_VALUES), N'}')
FROM dbo.EnviosDeRevision e JOIN dbo.Festivales f ON CAST(f.IdFestival AS nvarchar(120)) = e.RegistroId
WHERE e.ModuloId = N'festivales' AND f.IdFestival IN (SELECT Id FROM @Fest);

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 5. MERCADOS
--
-- Su historia vive en la bitácora (así la lee la API), no en RegistrosRevisionHistorial.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @Merc TABLE (Clave nvarchar(20) PRIMARY KEY, Id int NULL, Org int, Creador int, Alta datetime2, Nombre nvarchar(240), Descripcion nvarchar(max),
    Alcance int, Modalidad int, Periodicidad nvarchar(40), Detalle nvarchar(240) NULL, Correo nvarchar(180), Telefono nvarchar(80), Web nvarchar(300),
    Instagram nvarchar(300), Facebook nvarchar(300), Otro nvarchar(300), Observaciones nvarchar(1000), Nivel nvarchar(20), Dep char(2) NULL, Mun char(5) NULL,
    Lugar nvarchar(300) NULL, Festival int NULL, Estado nvarchar(30), Envio datetime2 NULL, Publicacion datetime2 NULL);
INSERT INTO @Merc VALUES
 (N'suroccidente', NULL, @Cantaclaro, @Lucia, DATETIME2FROMPARTS(@Y2, 3, 1, 10, 0, 0, 0, 7), N'Mercado de Músicas del Suroccidente',
  N'Rueda de negocios y vitrina de agrupaciones del Cauca, Nariño y Putumayo que se realiza durante el Festival de Músicas del Macizo. Programadores de festivales, salas y emisoras se reúnen con 40 agrupaciones seleccionadas por convocatoria; hay showcases de 20 minutos, mesas de asesoría en derechos de autor y un encuentro de luthiers.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración.',
  @AlcRegional, @ModMixta, N'anual', N'Durante el Festival de Músicas del Macizo, en julio.', N'mercado@cantaclaro.test', N'+57 602 000 1155', N'https://cantaclaro.test/mercado',
  N'https://instagram.com/mercadosuroccidente.test', N'https://facebook.com/mercadosuroccidente.test', N'https://cantaclaro.test/mercado/convocatoria',
  N'Las citas de la rueda de negocios se agendan por la plataforma del Mercado.', N'municipal', '19', '19001', N'Claustro de Santo Domingo, Popayán', NULL, N'publicado', NULL, NULL),
 (N'caribesonoro', NULL, @Sonora, @Mariana, DATEADD(DAY, -25, @Ahora), N'Rueda Caribe Sonoro',
  N'Rueda de negocios de músicas tradicionales del Caribe en el marco del Festival de Gaitas y Tambores de la Sierra, con programadores de la región y del exterior.' + NCHAR(10) + NCHAR(10) + N'Datos de demostración.',
  @AlcNacional, @ModPresencial, N'anual', NULL, N'rueda@sonoracaribe.test', N'+57 605 000 2244', N'https://sonoracaribe.test/rueda',
  N'https://instagram.com/caribesonoro.test', N'https://facebook.com/caribesonoro.test', N'https://sonoracaribe.test/rueda/programadores',
  N'Acreditación de programadores hasta un mes antes.', N'municipal', '47', '47001', N'Casa de la Aduana, Santa Marta', NULL, N'en_revision', NULL, NULL),
 (N'afromagdalena', NULL, @Sonora, @Jose, DATEADD(DAY, -35, @Ahora), N'Mercado Afro del Magdalena',
  N'Vitrina de agrupaciones afrodescendientes del Magdalena.',
  @AlcLocal, @ModPresencial, N'anual', NULL, N'afro@sonoracaribe.test', N'+57 605 000 2255', N'https://sonoracaribe.test/afro',
  N'https://instagram.com/mercadoafro.test', N'https://facebook.com/mercadoafro.test', N'https://sonoracaribe.test/afro/agrupaciones',
  N'Sin observaciones.', N'municipal', '47', '47189', NULL, NULL, N'ajustes_solicitados', NULL, NULL),
 (N'piedemonte', NULL, @Llano, @Camilo, DATETIME2FROMPARTS(@Y1, 5, 2, 10, 0, 0, 0, 7), N'Feria de Músicas del Piedemonte',
  N'Feria comercial de instrumentos y grabaciones llaneras.',
  @AlcRegional, @ModPresencial, N'anual', NULL, N'feria@llanoadentro.test', N'+57 608 000 3355', N'https://llanoadentro.test/feria',
  N'https://instagram.com/feriapiedemonte.test', N'https://facebook.com/feriapiedemonte.test', N'https://llanoadentro.test/feria/expositores',
  N'Sin observaciones.', N'departamental', '85', NULL, NULL, NULL, N'rechazado', NULL, NULL),
 (N'vitrinallanera', NULL, @Llano, @Camilo, DATEADD(DAY, -6, @Ahora), N'Vitrina Llanera Digital',
  N'Vitrina en línea de agrupaciones de joropo para programadores de todo el país: catálogo de grabaciones, fichas técnicas y citas virtuales.' + NCHAR(10) + NCHAR(10) + N'Borrador. Datos de demostración.',
  @AlcNacional, @ModVirtual, N'semestral', NULL, N'vitrina@llanoadentro.test', N'+57 608 000 3366', N'https://llanoadentro.test/vitrina',
  N'https://instagram.com/vitrinallanera.test', N'https://facebook.com/vitrinallanera.test', N'https://llanoadentro.test/vitrina/catalogo',
  N'Las citas se hacen por videollamada.', N'nacional', NULL, NULL, NULL, NULL, N'borrador', NULL, NULL);

UPDATE @Merc SET Festival = @FMacizo WHERE Clave = N'suroccidente';
UPDATE @Merc SET Festival = @FGaitas WHERE Clave = N'caribesonoro';
UPDATE @Merc SET Envio = DATETIME2FROMPARTS(@Y2, 3, 25, 10, 0, 0, 0, 7), Publicacion = DATETIME2FROMPARTS(@Y2, 4, 5, 9, 0, 0, 0, 7) WHERE Clave = N'suroccidente';
UPDATE @Merc SET Envio = DATEADD(DAY, -3, @Ahora) WHERE Clave = N'caribesonoro';
UPDATE @Merc SET Envio = DATEADD(DAY, -30, @Ahora) WHERE Clave = N'afromagdalena';
UPDATE @Merc SET Envio = DATETIME2FROMPARTS(@Y1, 5, 10, 10, 0, 0, 0, 7) WHERE Clave = N'piedemonte';

INSERT INTO dbo.Mercados (NombreMercado, Descripcion, AlcanceMercadoId, ModalidadMercadoId, Periodicidad, PeriodicidadDetalle, CorreoMercado, TelefonoMercado,
    SitioWebMercado, InstagramMercado, FacebookMercado, OtroEnlaceMercado, ObservacionesContacto, NivelCobertura, CodigoDepartamento, CodigoMunicipio,
    LugarEspecifico, SeRealizaEnElMarcoDeUnFestival, FestivalId, OrganizacionPrincipalId, EstadoRegistro, Activo, IdUsuarioCreador, FechaCreacion,
    FechaActualizacion, FechaEnvioARevision, FechaPublicacion)
SELECT Nombre, Descripcion, Alcance, Modalidad, Periodicidad, Detalle, Correo, Telefono, Web, Instagram, Facebook, Otro, Observaciones, Nivel, Dep, Mun,
       Lugar, CASE WHEN Festival IS NULL THEN 0 ELSE 1 END, Festival, Org, Estado, 1, Creador, Alta, COALESCE(Publicacion, Envio, Alta), Envio, Publicacion
FROM @Merc;

UPDATE m SET Id = x.IdMercado FROM @Merc m JOIN dbo.Mercados x ON x.NombreMercado = m.Nombre AND x.OrganizacionPrincipalId = m.Org;
DECLARE @MSuroccidente int = (SELECT Id FROM @Merc WHERE Clave = N'suroccidente');
DECLARE @MAfro int = (SELECT Id FROM @Merc WHERE Clave = N'afromagdalena');

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'mercados', CAST(Id AS nvarchar(120)), N'externo', Org, Creador, Alta FROM @Merc;

INSERT INTO dbo.MercadosPracticasMusicales (MercadoId, PracticaMusicalId, FechaCreacion)
SELECT m.Id, p.Id, m.Alta FROM @Merc m
JOIN (VALUES (N'suroccidente', @PmCampesinas), (N'suroccidente', @PmTradicionales), (N'suroccidente', @PmPopulares),
             (N'caribesonoro', @PmAfro), (N'afromagdalena', @PmAfro), (N'piedemonte', @PmTradicionales), (N'vitrinallanera', @PmTradicionales)) p(Clave, Id) ON p.Clave = m.Clave;
INSERT INTO dbo.MercadosTerritoriosSonoros (MercadoId, TerritorioSonoroId, FechaCreacion)
SELECT m.Id, t.Id, m.Alta FROM @Merc m
JOIN (VALUES (N'suroccidente', @TsSurenos), (N'suroccidente', @TsRajalena), (N'caribesonoro', @TsCantos), (N'afromagdalena', @TsCantos),
             (N'piedemonte', @TsJoropo), (N'vitrinallanera', @TsJoropo)) t(Clave, Id) ON t.Clave = m.Clave;

-- Ediciones del Mercado del Suroccidente, alineadas con las del Festival.
INSERT INTO dbo.EdicionesMercado (MercadoId, Anio, NumeroEdicion, Nombre, Descripcion, FechaInicio, FechaFin, CodigoDepartamento, CodigoMunicipio, LugarEspecifico,
    Estado, EstadoVisibilidad, IdUsuarioCreador, FechaCreacion, FechaActualizacion, FechaPublicacion) VALUES
 (@MSuroccidente, @Y2, 3, N'III Mercado de Músicas del Suroccidente', N'Rueda de negocios con 32 agrupaciones y 18 programadores; 140 citas agendadas y 22 contrataciones reportadas.',
  DATEFROMPARTS(@Y2, 7, 17), DATEFROMPARTS(@Y2, 7, 19), '19', '19001', N'Claustro de Santo Domingo, Popayán', N'realizada', N'publicado', @Lucia,
  DATETIME2FROMPARTS(@Y2, 4, 10, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y2, 8, 1, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y2, 4, 10, 10, 0, 0, 0, 7)),
 (@MSuroccidente, @Y1, 4, N'IV Mercado de Músicas del Suroccidente', N'Se realizó en formato virtual por el cierre de la vía: 28 agrupaciones, 15 programadores y 96 citas por videollamada.',
  DATEFROMPARTS(@Y1, 7, 16), DATEFROMPARTS(@Y1, 7, 18), '19', '19001', N'Plataforma virtual del Mercado', N'realizada', N'publicado', @Andres,
  DATETIME2FROMPARTS(@Y1, 4, 2, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 7, 25, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 4, 2, 10, 0, 0, 0, 7)),
 (@MSuroccidente, @AP, 5, N'V Mercado de Músicas del Suroccidente', N'Convocatoria cerrada: 40 agrupaciones seleccionadas y 20 programadores confirmados.',
  DATEADD(DAY, 1, @Prog), DATEADD(DAY, 3, @Prog), '19', '19001', N'Claustro de Santo Domingo, Popayán', N'programada', N'publicado', @Andres,
  DATEADD(DAY, -45, @Ahora), DATEADD(DAY, -20, @Ahora), DATEADD(DAY, -44, @Ahora));

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'ediciones-mercado', CAST(IdEdicionMercado AS nvarchar(120)), N'externo', @Cantaclaro, IdUsuarioCreador, FechaCreacion
FROM dbo.EdicionesMercado WHERE MercadoId = @MSuroccidente;

-- Revisión por campos: la del Suroccidente se cerró con el reenvío; la del Mercado Afro espera.
INSERT INTO dbo.RevisionesDeRegistro (ModuloId, RegistroId, Estado, IdUsuarioRevisor, RevisorNombre, IdUsuarioDestinatario, DestinatarioNombre,
    IdOrganizacion, OrganizacionNombre, ObservacionGeneral, FechaCreacion, FechaActualizacion, FechaEnvio, FechaCierre)
SELECT N'mercados', CAST(@MSuroccidente AS nvarchar(120)), N'cerrada', @Gestor, g.NombreCompleto, @Lucia, @NombreLucia, @Cantaclaro, @NombreCantaclaro,
       N'Precisen el lugar y la página del Mercado.', DATETIME2FROMPARTS(@Y2, 3, 28, 9, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y2, 4, 2, 9, 0, 0, 0, 7),
       DATETIME2FROMPARTS(@Y2, 3, 28, 9, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y2, 4, 2, 9, 0, 0, 0, 7)
FROM dbo.Usuarios g WHERE g.IdUsuario = @Gestor
UNION ALL
SELECT N'mercados', CAST(@MAfro AS nvarchar(120)), N'enviada', @Gestor, g.NombreCompleto, @Jose, (SELECT NombreCompleto FROM dbo.Usuarios WHERE IdUsuario = @Jose), @Sonora,
       (SELECT Nombre FROM dbo.Entidades WHERE IdEntidad = @Sonora), N'La ficha necesita más detalle para publicarse.',
       DATEADD(DAY, -26, @Ahora), DATEADD(DAY, -26, @Ahora), DATEADD(DAY, -26, @Ahora), NULL
FROM dbo.Usuarios g WHERE g.IdUsuario = @Gestor;

INSERT INTO dbo.RevisionesDeRegistroObservaciones (IdRevision, Ambito, SubregistroId, SeccionId, CampoId, CampoEtiqueta, ValorObservado, Nota, Estado,
    FechaCreacion, FechaActualizacion, FechaAtencion, IdUsuarioAtiende)
SELECT r.IdRevision, N'principal', NULL, o.Seccion, o.Campo, o.Etiqueta, o.Valor, o.Nota, o.Estado, r.FechaCreacion,
       CASE WHEN o.Estado = N'atendida' THEN r.FechaCierre END, CASE WHEN o.Estado = N'atendida' THEN r.FechaCierre END,
       CASE WHEN o.Estado = N'atendida' THEN @Lucia END
FROM dbo.RevisionesDeRegistro r
JOIN (VALUES
  (CAST(@MSuroccidente AS nvarchar(120)), N'territorio', N'lugarEspecifico', N'Lugar específico', N'Popayán', N'Indiquen el recinto donde se hace la rueda de negocios.', N'atendida'),
  (CAST(@MSuroccidente AS nvarchar(120)), N'contacto', N'sitioWebMercado', N'Página web', N'https://cantaclaro.test', N'Enlacen la página del Mercado, no la de la Corporación.', N'atendida'),
  (CAST(@MAfro AS nvarchar(120)), N'identificacion', N'descripcion', N'Descripción', N'Vitrina de agrupaciones afrodescendientes del Magdalena.', N'Cuenten cómo se seleccionan las agrupaciones y quiénes son los programadores invitados.', N'pendiente'),
  (CAST(@MAfro AS nvarchar(120)), N'territorio', N'lugarEspecifico', N'Lugar específico', NULL, N'Falta el lugar donde se realiza.', N'pendiente')
) o(Registro, Seccion, Campo, Etiqueta, Valor, Nota, Estado) ON o.Registro = r.RegistroId
WHERE r.ModuloId = N'mercados';

-- Propuesta aplicada sobre el Mercado del Suroccidente (se aplica a la ficha, sin versiones).
INSERT INTO dbo.PropuestasDeCambio (ModuloId, RegistroId, Estado, IdOrganizacion, OrganizacionNombre, IdUsuarioProponente, ProponenteNombre, Motivo,
    IdUsuarioDecide, DecideNombre, MotivoDeLaDecision, FechaCreacion, FechaActualizacion, FechaEnvio, FechaDecision)
VALUES (N'mercados', CAST(@MSuroccidente AS nvarchar(120)), N'aplicada', @Cantaclaro, @NombreCantaclaro, @Lucia, @NombreLucia,
        N'El Mercado amplió su convocatoria a Putumayo y estrenó cuenta de Instagram.', @Gestor, (SELECT NombreCompleto FROM dbo.Usuarios WHERE IdUsuario = @Gestor),
        N'Cambios aplicados.', DATETIME2FROMPARTS(@Y1, 10, 1, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 10, 8, 10, 0, 0, 0, 7),
        DATETIME2FROMPARTS(@Y1, 10, 2, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 10, 8, 10, 0, 0, 0, 7));
DECLARE @PM1 bigint = SCOPE_IDENTITY();
INSERT INTO dbo.PropuestasDeCambioCampos (IdPropuesta, SeccionId, CampoId, CampoEtiqueta, ValorAnterior, ValorPropuesto, FechaCreacion, FechaActualizacion) VALUES
 (@PM1, N'identificacion', N'descripcion', N'Descripción', N'Rueda de negocios y vitrina de agrupaciones del Cauca y Nariño que se realiza durante el Festival de Músicas del Macizo.',
  (SELECT Descripcion FROM dbo.Mercados WHERE IdMercado = @MSuroccidente), DATETIME2FROMPARTS(@Y1, 10, 1, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 10, 2, 10, 0, 0, 0, 7)),
 (@PM1, N'contacto', N'instagramMercado', N'Instagram', N'https://instagram.com/cantaclaro.test', N'https://instagram.com/mercadosuroccidente.test',
  DATETIME2FROMPARTS(@Y1, 10, 1, 10, 0, 0, 0, 7), DATETIME2FROMPARTS(@Y1, 10, 2, 10, 0, 0, 0, 7));

-- La bitácora de cada Mercado: es su historial.
DECLARE @ResumenM TABLE (Id int PRIMARY KEY, Json nvarchar(max));
INSERT INTO @ResumenM (Id, Json)
SELECT m.Id, (SELECT x.NombreMercado AS Nombre, N'borrador' AS EstadoRegistro, x.NivelCobertura, x.CodigoDepartamento, x.CodigoMunicipio,
                     x.OrganizacionPrincipalId, x.SeRealizaEnElMarcoDeUnFestival, x.FestivalId
              FROM dbo.Mercados x WHERE x.IdMercado = m.Id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)
FROM @Merc m;

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha)
SELECT m.Creador, N'Mercados', CAST(m.Id AS nvarchar(120)), N'crear', NULL, CONCAT(N'{"evento":"MercadoCreado","detalle":', r.Json, N'}'), m.Alta
FROM @Merc m JOIN @ResumenM r ON r.Id = m.Id
UNION ALL SELECT x.Usuario, N'Mercados', CAST(x.Mercado AS nvarchar(120)), x.Accion, x.Antes, x.Despues, x.Fecha FROM (VALUES
  (@Lucia, @MSuroccidente, N'actualizar', N'{"estado":"borrador"}', N'{"evento":"MercadoEnviadoARevision","detalle":{"estado":"en_revision"}}', DATETIME2FROMPARTS(@Y2, 3, 25, 10, 0, 0, 0, 7)),
  (@Gestor, @MSuroccidente, N'actualizar', N'{"estado":"en_revision"}', N'{"evento":"decidir","detalle":{"estado":"ajustes_solicitados","motivo":"El Programa pidió cambios en 2 campos."}}', DATETIME2FROMPARTS(@Y2, 3, 28, 9, 0, 0, 0, 7)),
  (@Lucia, @MSuroccidente, N'actualizar', N'{"estado":"ajustes_solicitados"}', N'{"evento":"MercadoEnviadoARevision","detalle":{"estado":"en_revision"}}', DATETIME2FROMPARTS(@Y2, 4, 2, 9, 0, 0, 0, 7)),
  (@Gestor, @MSuroccidente, N'actualizar', N'{"estado":"en_revision"}', N'{"evento":"decidir","detalle":{"estado":"publicado","motivo":null}}', DATETIME2FROMPARTS(@Y2, 4, 5, 9, 0, 0, 0, 7)),
  (@Lucia, @MSuroccidente, N'crear', NULL, CONCAT(N'{"evento":"MercadoCambioPropuesto","detalle":{"propuesta":', @PM1, N',"campos":2}}'), DATETIME2FROMPARTS(@Y1, 10, 2, 10, 0, 0, 0, 7)),
  (@Gestor, @MSuroccidente, N'aprobar', NULL, CONCAT(N'{"evento":"MercadoPropuestaAplicada","detalle":{"propuesta":', @PM1, N',"motivo":"Cambios aplicados."}}'), DATETIME2FROMPARTS(@Y1, 10, 8, 10, 0, 0, 0, 7)),
  (@Mariana, (SELECT Id FROM @Merc WHERE Clave = N'caribesonoro'), N'actualizar', N'{"estado":"borrador"}', N'{"evento":"MercadoEnviadoARevision","detalle":{"estado":"en_revision"}}', DATEADD(DAY, -3, @Ahora)),
  (@Jose, @MAfro, N'actualizar', N'{"estado":"borrador"}', N'{"evento":"MercadoEnviadoARevision","detalle":{"estado":"en_revision"}}', DATEADD(DAY, -30, @Ahora)),
  (@Gestor, @MAfro, N'actualizar', N'{"estado":"en_revision"}', N'{"evento":"decidir","detalle":{"estado":"ajustes_solicitados","motivo":"El Programa pidió cambios en 2 campos."}}', DATEADD(DAY, -26, @Ahora)),
  (@Camilo, (SELECT Id FROM @Merc WHERE Clave = N'piedemonte'), N'actualizar', N'{"estado":"borrador"}', N'{"evento":"MercadoEnviadoARevision","detalle":{"estado":"en_revision"}}', DATETIME2FROMPARTS(@Y1, 5, 10, 10, 0, 0, 0, 7)),
  (@Gestor, (SELECT Id FROM @Merc WHERE Clave = N'piedemonte'), N'actualizar', N'{"estado":"en_revision"}', N'{"evento":"decidir","detalle":{"estado":"rechazado","motivo":"Es una feria comercial de instrumentos, no un mercado de circulación musical: no hay rueda de negocios ni programadores. Puede registrarse como evento de la Agenda."}}', DATETIME2FROMPARTS(@Y1, 5, 20, 10, 0, 0, 0, 7))
) x(Usuario, Mercado, Accion, Antes, Despues, Fecha)
UNION ALL SELECT em.IdUsuarioCreador, N'EdicionesMercado', CAST(em.IdEdicionMercado AS nvarchar(120)), N'crear', NULL,
       CONCAT(N'{"evento":"crear","detalle":{"Anio":', em.Anio, N',"Nombre":"', em.Nombre, N'","Estado":"', em.Estado, N'","EstadoVisibilidad":"', em.EstadoVisibilidad,
              N'","FechaInicio":"', CONVERT(nvarchar(10), em.FechaInicio, 23), N'","FechaFin":"', CONVERT(nvarchar(10), em.FechaFin, 23), N'"}}'), em.FechaCreacion
FROM dbo.EdicionesMercado em WHERE em.MercadoId = @MSuroccidente;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 6. AGENDA
--
-- Eventos de organización (ligados a un Festival o un Mercado publicados de su organización) en
-- borrador, en revisión, publicados y devuelto con motivo; y eventos de la consola en los cuatro
-- estados. Todos con imagen del Banco (ImagenRuta y vínculo), categoría, etiquetas, prácticas y
-- territorios.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @CatFestivales int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo = N'agenda' AND Slug = N'festivales');
DECLARE @CatConciertos int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo = N'agenda' AND Slug = N'conciertos-y-presentaciones');
DECLARE @CatFormacion int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo = N'agenda' AND Slug = N'formacion');
DECLARE @CatEncuentros int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo = N'agenda' AND Slug = N'encuentros-y-dialogos');
DECLARE @CatConvocatorias int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo = N'agenda' AND Slug = N'convocatorias');

DECLARE @Ev TABLE (Clave nvarchar(40) PRIMARY KEY, Id bigint NULL, Titulo nvarchar(300), Descripcion nvarchar(1000), Larga nvarchar(max), Inicio date, Fin date,
    HoraInicio time, HoraFin time, Modalidad nvarchar(20), Lugar nvarchar(300) NULL, Dep char(2) NULL, Mun char(5) NULL, Url nvarchar(500) NULL,
    Imagen nvarchar(60), Estado nvarchar(20), Version int, Organizador nvarchar(220), Categoria int, Festival int NULL, Mercado int NULL,
    Org int NULL, Autor int, Alta datetime2, Practica int, Territorio int, Proyecto bit);
INSERT INTO @Ev VALUES
 (N'taller-marimba', NULL, N'Taller de flauta de caña y tiple para niñas y niños', N'Taller gratuito de iniciación musical dentro del Festival de Músicas del Macizo.',
  N'Durante tres mañanas, maestros de las agrupaciones invitadas enseñan a niñas y niños de 8 a 14 años a tocar flauta de caña y tiple. Al final, el grupo se presenta en la plaza.' + NCHAR(10) + NCHAR(10) + N'Cupos: 30. Inscripción previa en el sitio del Festival.',
  DATEADD(DAY, 1, @Prog), DATEADD(DAY, 3, @Prog), '09:00', '12:00', N'presencial', N'Casa de la Cultura de Popayán, salón principal', '19', '19001', NULL,
  N'evento-taller-marimba', N'publicado', 2, N'Corporación Cultural Cantaclaro', @CatFormacion, NULL, NULL, @Cantaclaro, @Lucia, DATEADD(DAY, -30, @Ahora), @PmCampesinas, @TsSurenos, 0),
 (N'concierto-cierre', NULL, N'Concierto de cierre del Festival de Músicas del Macizo', N'Gran concierto de clausura con las agrupaciones ganadoras y la orquesta de cuerdas de la Corporación.',
  N'Cierre del XIV Festival con seis agrupaciones en el Parque Caldas y transmisión en directo para quienes no puedan viajar a Popayán.',
  DATEADD(DAY, 4, @Prog), DATEADD(DAY, 4, @Prog), '18:00', '22:30', N'mixta', N'Parque Caldas, Popayán', '19', '19001', N'https://musicasdelmacizo.test/en-vivo',
  N'evento-concierto-cierre', N'publicado', 2, N'Corporación Cultural Cantaclaro', @CatConciertos, NULL, NULL, @Cantaclaro, @Lucia, DATEADD(DAY, -28, @Ahora), @PmTradicionales, @TsRajalena, 1),
 (N'conversatorio', NULL, N'Conversatorio: músicas campesinas y territorio', N'Diálogo virtual entre cantadoras, investigadores y gestores del Macizo.',
  N'Tres voces del territorio conversan sobre la transmisión del repertorio campesino y el papel de los festivales en su circulación.',
  DATEADD(DAY, 2, @Prog), DATEADD(DAY, 2, @Prog), '16:00', '17:30', N'virtual', NULL, '19', '19001', N'https://musicasdelmacizo.test/conversatorio',
  N'evento-conversatorio', N'en_revision', 2, N'Corporación Cultural Cantaclaro', @CatEncuentros, NULL, NULL, @Cantaclaro, @Lucia, DATEADD(DAY, -6, @Ahora), @PmVocales, @TsSurenos, 0),
 (N'ensayo-abierto', NULL, N'Ensayo abierto de la banda infantil', N'Ensayo abierto al público de la banda infantil de la escuela de la Corporación.',
  N'Borrador: falta confirmar el lugar.', DATEADD(DAY, -1, @Prog), DATEADD(DAY, -1, @Prog), '15:00', '17:00', N'presencial', N'Por confirmar', '19', '19001', NULL,
  N'evento-concierto-cierre', N'borrador', 1, N'Corporación Cultural Cantaclaro', @CatConciertos, NULL, NULL, @Cantaclaro, @Lucia, DATEADD(DAY, -2, @Ahora), @PmComunitarias, @TsSurenos, 0),
 (N'noche-gaitas', NULL, N'Noche de gaitas en la Sierra', N'Concierto de gaiteros mayores y jóvenes en la Sierra Nevada.',
  N'Concierto nocturno en una vereda de la Sierra con transporte desde Santa Marta.',
  DATEADD(DAY, 15, @Prog), DATEADD(DAY, 15, @Prog), '19:00', '22:00', N'presencial', N'Vereda (por definir), Sierra Nevada', '47', '47001', NULL,
  N'evento-concierto-cierre', N'borrador', 2, N'Fundación Sonora del Caribe', @CatConciertos, NULL, NULL, @Sonora, @Mariana, DATEADD(DAY, -16, @Ahora), @PmAfro, @TsCantos, 0),
 (N'rueda-negocios', NULL, N'Rueda de negocios del Mercado de Músicas del Suroccidente', N'Citas entre agrupaciones seleccionadas y programadores de festivales, salas y emisoras.',
  N'Tres jornadas de citas de 20 minutos, showcases y mesas de asesoría en derechos de autor y contratos.',
  DATEADD(DAY, 1, @Prog), DATEADD(DAY, 3, @Prog), '08:30', '13:00', N'presencial', N'Claustro de Santo Domingo, Popayán', '19', '19001', NULL,
  N'evento-rueda-negocios', N'publicado', 2, N'Corporación Cultural Cantaclaro', @CatEncuentros, NULL, NULL, @Cantaclaro, @Andres, DATEADD(DAY, -25, @Ahora), @PmPopulares, @TsSurenos, 0),
 -- Consola.
 (N'encuentro-nacional', NULL, N'Encuentro Nacional de Músicas Tradicionales', N'Encuentro del Programa con festivales, escuelas y mercados de todo el país.',
  N'Dos días de mesas de trabajo sobre circulación, formación y memoria, con conciertos de cierre de agrupaciones de cinco regiones.' + NCHAR(10) + NCHAR(10) + N'Evento de demostración.',
  DATEADD(DAY, 30, @Hoy), DATEADD(DAY, 31, @Hoy), '09:00', '18:00', N'mixta', N'Biblioteca Nacional (demostración), Bogotá', NULL, NULL, N'https://simus.test/encuentro-nacional',
  N'evento-conversatorio', N'publicado', 4, N'Programa de Música (demostración)', @CatEncuentros, NULL, NULL, NULL, @Webmaster, DATEADD(DAY, -20, @Ahora), @PmTradicionales, @TsTrova, 1),
 (N'convocatoria-circulacion', NULL, N'Cierre de la convocatoria de circulación de festivales', N'Último día para postular festivales a la convocatoria de circulación.',
  N'La convocatoria apoya la circulación de agrupaciones entre festivales de distintas regiones.',
  DATEADD(DAY, 12, @Hoy), DATEADD(DAY, 12, @Hoy), '08:00', '17:00', N'virtual', NULL, NULL, NULL, N'https://simus.test/convocatorias/circulacion',
  N'noticia-convocatoria', N'en_revision', 2, N'Programa de Música (demostración)', @CatConvocatorias, NULL, NULL, NULL, @Gestor, DATEADD(DAY, -5, @Ahora), @PmComunitarias, @TsChirimia, 1),
 (N'laboratorio-sonoro', NULL, N'Laboratorio de producción sonora para festivales', N'Laboratorio práctico de sonido en vivo y grabación de campo.',
  N'Borrador: falta definir la sede.', DATEADD(DAY, 45, @Hoy), DATEADD(DAY, 47, @Hoy), '09:00', '16:00', N'presencial', NULL, '76', '76109', NULL,
  N'evento-taller-marimba', N'borrador', 1, N'Programa de Música (demostración)', @CatFormacion, NULL, NULL, NULL, @Gestor, DATEADD(DAY, -1, @Ahora), @PmArchivo, @TsMarimba, 0),
 (N'memoria-pacifico', NULL, N'Jornada de memoria sonora del Pacífico', N'Escucha colectiva de grabaciones históricas de marimba y cantos.',
  N'Jornada realizada en Guapi con portadores de tradición. Se archiva al terminar.', DATEADD(DAY, -60, @Hoy), DATEADD(DAY, -60, @Hoy), '10:00', '13:00', N'presencial',
  N'Casa de la Cultura de Guapi', '19', '19318', NULL, N'noticia-memoria', N'archivado', 3, N'Programa de Música (demostración)', @CatEncuentros, NULL, NULL, NULL, @Gestor, DATEADD(DAY, -90, @Ahora), @PmAfro, @TsMarimba, 0);

UPDATE @Ev SET Festival = @FMacizo WHERE Clave IN (N'taller-marimba', N'concierto-cierre', N'conversatorio', N'ensayo-abierto');
UPDATE @Ev SET Festival = @FGaitas WHERE Clave = N'noche-gaitas';
UPDATE @Ev SET Mercado = @MSuroccidente WHERE Clave = N'rueda-negocios';

INSERT INTO dbo.EventosAgenda (Slug, Titulo, Descripcion, FechaInicio, FechaFin, HoraInicio, Modalidad, Lugar, CodigoDepartamento, CodigoMunicipio, Url,
    ImagenRuta, ImagenAlternativa, Estado, Version, FechaCreacion, FechaActualizacion, Organizador, DescripcionLarga, HoraFin, OrdenVisualizacion,
    FestivalId, NivelCobertura, CategoriaId, MercadoId)
SELECT CONCAT(N'demo-completa-', e.Clave), e.Titulo, e.Descripcion, e.Inicio, e.Fin, e.HoraInicio, e.Modalidad, e.Lugar, e.Dep, e.Mun, e.Url,
       CONCAT(N'/api/v1/publico/archivos/', i.Id), a.TextoAlternativo, e.Estado, e.Version, e.Alta, DATEADD(DAY, 2, e.Alta), e.Organizador, e.Larga, e.HoraFin,
       ROW_NUMBER() OVER (ORDER BY e.Inicio), e.Festival,
       CASE WHEN e.Dep IS NULL THEN N'nacional' WHEN e.Mun IS NULL THEN N'departamental' ELSE N'municipal' END, e.Categoria, e.Mercado
FROM @Ev e JOIN @Img i ON i.Nombre = e.Imagen JOIN dbo.Archivos a ON a.IdArchivo = i.Id;

UPDATE e SET Id = x.IdEventoAgenda FROM @Ev e JOIN dbo.EventosAgenda x ON x.Slug = CONCAT(N'demo-completa-', e.Clave);

INSERT INTO dbo.EventosAgendaArchivos (EventoAgendaId, ArchivoId, RolArchivo, OrdenVisualizacion)
SELECT e.Id, i.Id, N'imagen_principal', 1 FROM @Ev e JOIN @Img i ON i.Nombre = e.Imagen;
INSERT INTO dbo.EtiquetasEventoAgenda (EventoAgendaId, Termino)
SELECT e.Id, t.Termino FROM @Ev e CROSS APPLY (VALUES (N'demostración'),
    (CASE WHEN e.Festival IS NOT NULL THEN N'festival' WHEN e.Mercado IS NOT NULL THEN N'mercado' ELSE N'programa' END),
    (CASE e.Categoria WHEN @CatFormacion THEN N'formación' WHEN @CatConciertos THEN N'concierto' WHEN @CatConvocatorias THEN N'convocatoria' ELSE N'diálogo' END)) t(Termino);
INSERT INTO dbo.EventosAgendaPracticasMusicales (EventoAgendaId, PracticaMusicalId) SELECT Id, Practica FROM @Ev;
INSERT INTO dbo.EventosAgendaTerritoriosSonoros (EventoAgendaId, TerritorioSonoroId) SELECT Id, Territorio FROM @Ev;
INSERT INTO dbo.EventosAgendaProyectosTransversales (EventoAgendaId, ProyectoTransversalId) SELECT Id, @Proyecto FROM @Ev WHERE Proyecto = 1 AND @Proyecto IS NOT NULL;

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'agenda', CAST(Id AS nvarchar(120)), CASE WHEN Org IS NULL THEN N'administrativo' ELSE N'externo' END, COALESCE(Org, @Institucional), Autor, Alta FROM @Ev;

-- Historial de los eventos de organización.
INSERT INTO #Hist (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, CamposObservados, IdUsuario, Fecha, MetadataJson, OrganizacionId, Instantanea)
SELECT N'agenda', CAST(e.Id AS nvarchar(120)), h.Anterior, h.Nuevo, h.Accion, h.Comentario, h.Motivo, NULL,
       CASE WHEN h.Accion IN (N'EventoPublicado', N'EventoDevuelto') THEN @Gestor ELSE e.Autor END,
       DATEADD(HOUR, h.Horas, e.Alta),
       CONCAT(N'{"festivalId":', ISNULL(CAST(e.Festival AS nvarchar(20)), N'null'), N',"mercadoId":', ISNULL(CAST(e.Mercado AS nvarchar(20)), N'null'), N',"version":', h.Version, N'}'),
       e.Org, 1
FROM @Ev e
JOIN (VALUES
  (N'taller-marimba', NULL, N'en_revision', N'EventoEnviadoARevision', NULL, NULL, 0, 1),
  (N'taller-marimba', N'en_revision', N'publicado', N'EventoPublicado', NULL, NULL, 26, 2),
  (N'concierto-cierre', NULL, N'en_revision', N'EventoEnviadoARevision', NULL, NULL, 0, 1),
  (N'concierto-cierre', N'en_revision', N'publicado', N'EventoPublicado', NULL, NULL, 30, 2),
  (N'conversatorio', NULL, N'borrador', N'EventoCreado', NULL, NULL, 0, 1),
  (N'conversatorio', N'borrador', N'en_revision', N'EventoEnviadoARevision', NULL, NULL, 48, 2),
  (N'ensayo-abierto', NULL, N'borrador', N'EventoCreado', NULL, NULL, 0, 1),
  (N'noche-gaitas', NULL, N'en_revision', N'EventoEnviadoARevision', NULL, NULL, 0, 1),
  (N'noche-gaitas', N'en_revision', N'borrador', N'EventoDevuelto',
   N'Falta el lugar exacto y cómo se llega: un evento en una vereda necesita punto de encuentro y transporte. Corríjanlo y vuelvan a enviarlo.',
   N'Falta el lugar exacto y cómo se llega: un evento en una vereda necesita punto de encuentro y transporte. Corríjanlo y vuelvan a enviarlo.', 70, 2),
  (N'rueda-negocios', NULL, N'en_revision', N'EventoEnviadoARevision', NULL, NULL, 0, 1),
  (N'rueda-negocios', N'en_revision', N'publicado', N'EventoPublicado', NULL, NULL, 20, 2)
) h(Clave, Anterior, Nuevo, Accion, Comentario, Motivo, Horas, Version) ON h.Clave = e.Clave;

-- Historial de los eventos de la consola (sin instantánea, como HistorialDeEstados).
INSERT INTO #Hist (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, CamposObservados, IdUsuario, Fecha, MetadataJson, OrganizacionId, Instantanea)
SELECT N'agenda', CAST(e.Id AS nvarchar(120)), h.Anterior, h.Nuevo, h.Accion, h.Comentario, h.Motivo, NULL, h.Usuario, DATEADD(HOUR, h.Horas, e.Alta), h.Meta, NULL, 0
FROM @Ev e
JOIN (VALUES
  (N'encuentro-nacional', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 4, NULL),
  (N'encuentro-nacional', N'en_revision', N'borrador', N'DevueltoParaCorregir', N'Falta el enlace de la transmisión.', N'Falta el enlace de la transmisión.', @Webmaster, 24, NULL),
  (N'encuentro-nacional', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 30, NULL),
  (N'encuentro-nacional', N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Webmaster, 48, NULL),
  (N'encuentro-nacional', N'publicado', N'publicado', N'ErrataCorregida', N'Errata corregida en lo publicado.', NULL, @Gestor, 120, N'{"errata":true,"version":4}'),
  (N'convocatoria-circulacion', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 6, NULL),
  (N'memoria-pacifico', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 4, NULL),
  (N'memoria-pacifico', N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Webmaster, 20, NULL),
  (N'memoria-pacifico', N'publicado', N'archivado', N'EstadoCambiado', NULL, NULL, @Gestor, 24 * 40, NULL)
) h(Clave, Anterior, Nuevo, Accion, Comentario, Motivo, Usuario, Horas, Meta) ON h.Clave = e.Clave;

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha)
SELECT e.Autor, N'EventosAgenda', CAST(e.Id AS nvarchar(120)), N'crear', NULL,
       CASE WHEN e.Org IS NULL THEN CONCAT(N'{"Estado":"borrador","Titulo":"', e.Titulo, N'"}')
            ELSE CONCAT(N'{"evento":"EventoAnunciadoPorOrganizacion","organizacionId":', e.Org, N',"procesoId":', COALESCE(e.Festival, e.Mercado),
                        N',"procesoTipo":"', CASE WHEN e.Festival IS NULL THEN N'mercado' ELSE N'festival' END, N'","estado":"en_revision"}') END, e.Alta
FROM @Ev e;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 7. NOTICIAS
--
-- Completas: cuerpo, imagen, autoría, categoría, etiquetas, prácticas, territorios y proyecto.
-- Publicada con errata, programada (publicada con fecha futura), cambio de fondo devuelto a
-- revisión, borrador y archivada.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @Not TABLE (Clave nvarchar(60) PRIMARY KEY, Id bigint NULL, Titulo nvarchar(300), Resumen nvarchar(500), Cuerpo nvarchar(max), Fecha date NULL,
    Imagen nvarchar(60), Autoria nvarchar(200), Estado nvarchar(20), Version int, Categoria nvarchar(80), Alta datetime2, Practica int, Territorio int, Proyecto bit);
INSERT INTO @Not VALUES
 (N'convocatoria-estimulos', NULL, CONCAT(N'Abierta la convocatoria de estímulos para festivales ', @AP + 1),
  N'Festivales con al menos tres ediciones podrán postular proyectos de programación, formación y memoria hasta el último día hábil del mes.',
  N'La convocatoria apoya a festivales de música con tres o más ediciones realizadas. Pueden postular organizaciones registradas en SIMUS con su ficha de Festival publicada.' + NCHAR(10) + NCHAR(10)
  + N'Los proyectos pueden incluir programación artística, talleres de formación, publicaciones y registros de memoria. Cada organización puede presentar un proyecto.' + NCHAR(10) + NCHAR(10)
  + N'La consulta de requisitos y el formulario están en la sección de convocatorias. Texto de demostración: no corresponde a una convocatoria real.',
  DATEADD(DAY, -4, @Hoy), N'noticia-convocatoria', N'Equipo de Comunicaciones del Programa', N'publicado', 2, N'convocatorias-y-oportunidades', DATEADD(DAY, -6, @Ahora), @PmComunitarias, @TsSurenos, 1),
 (N'macizo-xiv', NULL, N'El Festival de Músicas del Macizo celebra su XIV edición',
  N'Tras la cancelación del año pasado, el Festival vuelve a la plaza con 260 músicos, una ruta de chirimías y el lanzamiento de su cancionero.',
  N'La Corporación Cultural Cantaclaro anunció la programación de la decimocuarta edición del Festival de Músicas del Macizo, que regresa al Parque Caldas de Popayán.' + NCHAR(10) + NCHAR(10)
  + N'La edición incluye el lanzamiento del Cancionero del Macizo, disponible en el Catálogo Editorial, y una rueda de negocios con programadores de la región.' + NCHAR(10) + NCHAR(10)
  + N'Texto de demostración.',
  DATEADD(DAY, 7, @Hoy), N'noticia-macizo', N'Lucía Ramírez (Corporación Cultural Cantaclaro)', N'publicado', 1, N'eventos-y-circulacion', DATEADD(DAY, -2, @Ahora), @PmCampesinas, @TsSurenos, 0),
 (N'escuelas-pacifico', NULL, N'Escuelas de música del Pacífico comparten repertorio',
  N'Doce escuelas de Guapi, Timbiquí y López de Micay intercambiaron arreglos de marimba y cantos en un encuentro de tres días.',
  N'El encuentro reunió a 180 estudiantes y 24 docentes en torno a la marimba de chonta, el cununo y el bombo.' + NCHAR(10) + NCHAR(10)
  + N'Cada escuela grabó un arreglo que quedará en el archivo de la red. Texto de demostración.',
  DATEADD(DAY, -12, @Hoy), N'noticia-formacion', N'Equipo de Formación del Programa', N'publicado', 1, N'formacion', DATEADD(DAY, -14, @Ahora), @PmAfro, @TsMarimba, 0),
 (N'memoria-joropo', NULL, N'Archivo sonoro: la memoria del joropo en Casanare',
  N'El Colectivo Llano Adentro digitalizó 300 grabaciones de contrapunteo de los años setenta.',
  N'Las grabaciones, conservadas por familias de Paz de Ariporo, se digitalizaron con apoyo de la emisora comunitaria.' + NCHAR(10) + NCHAR(10)
  + N'Se corrigió el número de grabaciones y la fuente, y la nota volvió a revisión. Texto de demostración.',
  DATEADD(DAY, -20, @Hoy), N'noticia-memoria', N'Camilo Rojas (Colectivo Llano Adentro)', N'en_revision', 3, N'memoria-y-patrimonio', DATEADD(DAY, -22, @Ahora), @PmTradicionales, @TsJoropo, 0),
 (N'bandas-oriente', NULL, N'Las bandas del Oriente antioqueño preparan su encuentro anual',
  N'Dieciocho bandas confirmaron su participación en el encuentro de la subregión.',
  N'Borrador en preparación: falta confirmar las fechas y el repertorio del concierto de bandas unidas.',
  NULL, N'noticia-bandas', N'Equipo de Comunicaciones del Programa', N'borrador', 1, N'procesos-territoriales', DATEADD(DAY, -1, @Ahora), @PmBandas, @TsTrova, 0),
 (N'balance-temporada', NULL, CONCAT(N'Balance de la temporada de festivales ', @Y1),
  N'La temporada dejó 140 festivales con su edición registrada en SIMUS y tres cancelaciones por cierres viales.',
  N'El balance anual recoge las cifras que las organizaciones registraron en sus ediciones.' + NCHAR(10) + NCHAR(10) + N'Noticia archivada al publicarse el balance siguiente. Texto de demostración.',
  DATEFROMPARTS(@Y1, 12, 15), N'noticia-convocatoria', N'Equipo de Información del Programa', N'archivado', 1, N'institucional', DATETIME2FROMPARTS(@Y1, 12, 10, 10, 0, 0, 0, 7), @PmTradicionales, @TsCantos, 1);

INSERT INTO dbo.Noticias (Slug, Titulo, Resumen, Cuerpo, FechaPublicacion, ImagenRuta, ImagenAlternativa, AutoriaNombre, Estado, Version, FechaCreacion, FechaActualizacion, CategoriaId)
SELECT CONCAT(N'demo-completa-', n.Clave), n.Titulo, n.Resumen, n.Cuerpo, n.Fecha, CONCAT(N'/api/v1/publico/archivos/', i.Id), a.TextoAlternativo, n.Autoria,
       n.Estado, n.Version, n.Alta, DATEADD(DAY, 1, n.Alta), c.IdCategoria
FROM @Not n JOIN @Img i ON i.Nombre = n.Imagen JOIN dbo.Archivos a ON a.IdArchivo = i.Id
LEFT JOIN dbo.Categorias c ON c.CodigoModulo = N'noticias' AND c.Slug = n.Categoria;

UPDATE n SET Id = x.IdNoticia FROM @Not n JOIN dbo.Noticias x ON x.Slug = CONCAT(N'demo-completa-', n.Clave);

INSERT INTO dbo.NoticiasArchivos (NoticiaId, ArchivoId, RolArchivo, OrdenVisualizacion) SELECT n.Id, i.Id, N'imagen_principal', 1 FROM @Not n JOIN @Img i ON i.Nombre = n.Imagen;
INSERT INTO dbo.EtiquetasNoticia (NoticiaId, Termino)
SELECT n.Id, t.Termino FROM @Not n CROSS APPLY (VALUES (N'demostración'), ((SELECT LOWER(c.NombreCategoria) FROM dbo.Categorias c WHERE c.CodigoModulo = N'noticias' AND c.Slug = n.Categoria)), (N'festivales')) t(Termino);
INSERT INTO dbo.NoticiasPracticasMusicales (NoticiaId, PracticaMusicalId) SELECT Id, Practica FROM @Not;
INSERT INTO dbo.NoticiasTerritoriosSonoros (NoticiaId, TerritorioSonoroId) SELECT Id, Territorio FROM @Not;
INSERT INTO dbo.NoticiasProyectosTransversales (NoticiaId, ProyectoTransversalId) SELECT Id, @Proyecto FROM @Not WHERE Proyecto = 1 AND @Proyecto IS NOT NULL;
INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'noticias', CAST(Id AS nvarchar(120)), N'administrativo', @Institucional, @Gestor, Alta FROM @Not;

INSERT INTO #Hist (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, CamposObservados, IdUsuario, Fecha, MetadataJson, OrganizacionId, Instantanea)
SELECT N'noticias', CAST(n.Id AS nvarchar(120)), h.Anterior, h.Nuevo, h.Accion, h.Comentario, h.Motivo, NULL, h.Usuario, DATEADD(HOUR, h.Horas, n.Alta), h.Meta, NULL, 0
FROM @Not n
JOIN (VALUES
  (N'convocatoria-estimulos', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 3, NULL),
  (N'convocatoria-estimulos', N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Webmaster, 30, NULL),
  (N'convocatoria-estimulos', N'publicado', N'publicado', N'ErrataCorregida', N'Errata corregida en lo publicado.', NULL, @Gestor, 60, N'{"errata":true,"version":2}'),
  (N'macizo-xiv', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 2, NULL),
  (N'macizo-xiv', N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Webmaster, 20, NULL),
  (N'escuelas-pacifico', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 2, NULL),
  (N'escuelas-pacifico', N'en_revision', N'borrador', N'DevueltoParaCorregir', N'Confirmen las cifras de estudiantes con la red de escuelas.', N'Confirmen las cifras de estudiantes con la red de escuelas.', @Webmaster, 10, NULL),
  (N'escuelas-pacifico', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 20, NULL),
  (N'escuelas-pacifico', N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Webmaster, 40, NULL),
  (N'memoria-joropo', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 2, NULL),
  (N'memoria-joropo', N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Webmaster, 30, NULL),
  (N'memoria-joropo', N'publicado', N'en_revision', N'CambioDeFondoEnPublicado', N'Cambio de fondo en lo publicado: vuelve a revisión.', NULL, @Gestor, 24 * 18, N'{"errata":false,"version":3}'),
  (N'balance-temporada', N'borrador', N'en_revision', N'EstadoCambiado', NULL, NULL, @Gestor, 2, NULL),
  (N'balance-temporada', N'en_revision', N'publicado', N'EstadoCambiado', NULL, NULL, @Webmaster, 100, NULL),
  (N'balance-temporada', N'publicado', N'archivado', N'EstadoCambiado', NULL, NULL, @Webmaster, 24 * 200, NULL)
) h(Clave, Anterior, Nuevo, Accion, Comentario, Motivo, Usuario, Horas, Meta) ON h.Clave = n.Clave;

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha)
SELECT @Gestor, N'Noticias', CAST(n.Id AS nvarchar(120)), N'crear', NULL, N'{"Estado":"borrador"}', n.Alta FROM @Not n;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 8. CATÁLOGO EDITORIAL
--
-- Cuatro fichas con metadatos completos —DCMI, RDA 336/337/338, relatores MARC, ISO 639-3 y
-- fechas EDTF—, fuentes, derechos en la ficha y en cada acceso, anotaciones e historial:
--   DEMO-001 publicada (con errata), DEMO-002 observada, DEMO-003 devuelta a revisión por un
--   cambio de fondo, DEMO-004 retirada.
-- Códigos `PNMC-ED-DEMO-…`: no chocan con la serie numérica del acervo real (PNMC-ED-001…).
-- ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO dbo.FuentesEditoriales (Nombre, Referencia, Url, FechaFuente, FechaConsulta, VerificadaPor, FechaCreacion) VALUES
 (N'Archivo documental de la Corporación Cultural Cantaclaro', N'Inventario documental, caja 3, carpetas 12 a 15 (demostración).', N'https://cantaclaro.test/archivo',
  DATEFROMPARTS(@Y1, 6, 1), DATEADD(DAY, -40, @Hoy), @NombreWebmaster, DATEADD(DAY, -40, @Ahora)),
 (N'Fonoteca comunitaria de Bandas del Oriente', N'Registro de grabaciones del encuentro, cintas 1 a 6 (demostración).', N'https://bandasoriente.test/fonoteca',
  DATEFROMPARTS(@Y2, 9, 1), DATEADD(DAY, -35, @Hoy), @NombreWebmaster, DATEADD(DAY, -35, @Ahora));
DECLARE @FuenteCantaclaro int = (SELECT IdFuenteEditorial FROM dbo.FuentesEditoriales WHERE Nombre = N'Archivo documental de la Corporación Cultural Cantaclaro');
DECLARE @FuenteBandas int = (SELECT IdFuenteEditorial FROM dbo.FuentesEditoriales WHERE Nombre = N'Fonoteca comunitaria de Bandas del Oriente');

INSERT INTO dbo.ProgramasEditoriales (Codigo, Nombre, Activo) VALUES (N'demo-completa-publicaciones-territoriales', N'Publicaciones territoriales (demostración)', 1);
DECLARE @Programa int = SCOPE_IDENTITY();

INSERT INTO dbo.AgentesEditoriales (Codigo, Tipo, NombrePreferido, FormaNormalizada, Seudonimo, Acronimo, RequiereRevision, FechaCreacion, FechaActualizacion) VALUES
 (N'PNMC-AG-DEMO-001', N'entidad', N'Corporación Cultural Cantaclaro', N'Corporación Cultural Cantaclaro (Popayán, Colombia)', NULL, N'CCC', 0, DATEADD(DAY, -40, @Ahora), DATEADD(DAY, -40, @Ahora)),
 (N'PNMC-AG-DEMO-002', N'persona', N'Lucía Fernanda Ramírez Ortiz', N'Ramírez Ortiz, Lucía Fernanda', NULL, NULL, 0, DATEADD(DAY, -40, @Ahora), DATEADD(DAY, -40, @Ahora)),
 (N'PNMC-AG-DEMO-003', N'persona', N'Ernesto Yalanda Quilindo', N'Yalanda Quilindo, Ernesto', N'Maestro Yalanda', NULL, 0, DATEADD(DAY, -40, @Ahora), DATEADD(DAY, -40, @Ahora)),
 (N'PNMC-AG-DEMO-004', N'entidad', N'Asociación de Bandas del Oriente Antioqueño', N'Asociación de Bandas Musicales del Oriente Antioqueño', NULL, N'ABOA', 0, DATEADD(DAY, -35, @Ahora), DATEADD(DAY, -35, @Ahora)),
 (N'PNMC-AG-DEMO-005', N'persona', N'Andrés Felipe Muñoz Chilito', N'Muñoz Chilito, Andrés Felipe', NULL, NULL, 1, DATEADD(DAY, -30, @Ahora), DATEADD(DAY, -30, @Ahora));

DECLARE @Pub TABLE (Codigo nvarchar(60) PRIMARY KEY, Id bigint NULL, Titulo nvarchar(500), Subtitulo nvarchar(500), Volumen nvarchar(200), Serie nvarchar(300),
    Resumen nvarchar(max), Edtf nvarchar(60), AnioInicio int, AnioFin int NULL, NotaFecha nvarchar(300), Catalogacion nvarchar(30), Publicacion nvarchar(30), Version int,
    DerEstado nvarchar(20), DerFicha bit, DerArchivo bit, DerNota nvarchar(600), DerFuente int, TipoPublicacion nvarchar(240), Ambito nvarchar(160), AmbitoTexto nvarchar(240),
    Portada nvarchar(60) NULL, Tamano nvarchar(160), Paginas nvarchar(160) NULL, Duracion nvarchar(160) NULL, TextoPortada nvarchar(max), Categoria nvarchar(160), Subcategoria nvarchar(160),
    Formato nvarchar(20), Notas nvarchar(500), Confianza nvarchar(10), Alta datetime2);
INSERT INTO @Pub VALUES
 (N'PNMC-ED-DEMO-001', NULL, N'Cancionero del Macizo', N'Repertorio campesino de las agrupaciones del Festival de Músicas del Macizo', N'Volumen 1', N'Colección Músicas del Territorio',
  N'Reúne 42 piezas del repertorio de chirimías, conjuntos de cuerdas y cantos de minga interpretadas en las ediciones XI y XII del Festival, con partituras, letras, cifrados para tiple y guitarra y notas sobre cada agrupación. Incluye un estudio introductorio sobre los géneros del Macizo y un glosario de términos en namtrik.',
  CONCAT(@Y2, N'/', @Y1), @Y2, @Y1, N'Recopilado entre las dos ediciones; impreso al cierre de la segunda.', N'validada', N'publicado', 3,
  N'verificado', 1, 1, N'Licencia Creative Commons Atribución-NoComercial 4.0. Autorización de la Corporación y de los intérpretes (actas en el archivo de la Corporación).', NULL,
  N'Cancionero', N'Regional', N'Macizo colombiano: Cauca, Huila y Nariño', N'portada-cancionero-macizo', N'21,5 × 28 cm', N'184 páginas', NULL,
  N'CANCIONERO DEL MACIZO · Repertorio campesino · Corporación Cultural Cantaclaro', N'repertorio', N'repertorio--cancioneros', N'Mixto',
  N'Ficha completa de demostración: revisada contra el ejemplar impreso y la versión digital.', N'Alta', DATEADD(DAY, -40, @Ahora)),
 (N'PNMC-ED-DEMO-002', NULL, N'Cartilla de chirimía', N'Iniciación a la flauta traversa y la percusión para escuelas del Cauca', NULL, N'Cartillas de iniciación',
  N'Cartilla pedagógica con ejercicios progresivos de flauta de caña, tambora y redoblante para niñas y niños de 8 a 12 años.',
  CONCAT(@Y1, N'~'), @Y1, NULL, N'Año aproximado: el ejemplar no trae fecha.', N'observada', N'borrador', 2,
  N'pendiente', 0, 0, NULL, NULL, N'Cartilla', N'Departamental', N'Cauca', N'portada-cartilla-chirimia', N'Carta', N'64 páginas', NULL,
  N'CARTILLA DE CHIRIMÍA · Iniciación', N'formacion', N'formacion--iniciacion-musical', N'Físico',
  N'Pendiente: confirmar la autoría de los ejercicios y la fecha de edición.', N'Media', DATEADD(DAY, -30, @Ahora)),
 (N'PNMC-ED-DEMO-003', NULL, N'Memorias sonoras del Encuentro de Bandas del Oriente', N'Grabaciones en vivo del concierto de bandas unidas', NULL, N'Registros de circulación',
  N'Selección de 14 grabaciones en vivo del concierto de bandas unidas, con notas sobre cada banda, sus directores y el repertorio.',
  CONCAT(@Y1, N'-08'), @Y1, NULL, N'Grabado en agosto.', N'validada', N'en_revision', 4,
  N'verificado', 1, 0, N'Autorización de difusión de la Asociación; los archivos de audio solo se consultan en sala.', NULL,
  N'Grabación sonora', N'Subregional', N'Oriente antioqueño', NULL, N'Disco compacto y archivos digitales', NULL, N'58 min 20 s',
  N'MEMORIAS SONORAS · Encuentro de Bandas del Oriente', N'creacion-y-circulacion', N'creacion-y-circulacion--registros-conciertos-circulacion', N'Mixto',
  N'Se corrigió la lista de piezas: vuelve a revisión antes de republicarse.', N'Alta', DATEADD(DAY, -35, @Ahora)),
 (N'PNMC-ED-DEMO-004', NULL, N'Guía de gestión de festivales comunitarios', N'Planeación, financiación y memoria', NULL, N'Guías de gestión',
  N'Guía práctica para organizaciones comunitarias que organizan festivales: cronograma, presupuesto, alianzas, convocatorias y registro de memoria.',
  CONCAT(@Y3, N'/', @Y2), @Y3, @Y2, NULL, N'validada', N'retirado', 3,
  N'restringido', 0, 0, N'La editorial original retiró la autorización de difusión.', NULL,
  N'Guía', N'Nacional', N'Colombia', NULL, N'Media carta', N'96 páginas', NULL,
  N'GUÍA DE GESTIÓN DE FESTIVALES COMUNITARIOS', N'gestion', N'gestion--escuelas-y-procesos-musicales', N'Digital',
  N'Retirada del portal por derechos restringidos.', N'Alta', DATEADD(DAY, -90, @Ahora));
UPDATE @Pub SET DerFuente = CASE WHEN Codigo = N'PNMC-ED-DEMO-003' THEN @FuenteBandas WHEN DerEstado = N'pendiente' THEN NULL ELSE @FuenteCantaclaro END;

INSERT INTO dbo.PublicacionesEditoriales (Codigo, Titulo, Subtitulo, DesignacionVolumen, SerieOColeccion, Resumen, FechaEdtf, AnioInicio, AnioFin,
    EstadoCatalogacion, EstadoPublicacion, Version, DerechosEstado, DerechosPermitePublicarFicha, DerechosPermitePublicarArchivo, DerechosLicenciaONota,
    DerechosFuenteId, DerechosFechaVerificacion, DerechosVerificadoPor, FechaCreacion, FechaActualizacion, TipoPublicacion, Ambito, MiniaturaRuta,
    TamanoFormato, Paginas, Duracion, TextoPortada, CategoriaId, Formato, NotaFecha, AmbitoTexto, NotasCatalogacion, Confianza, RevisarClasificacion,
    RevisarCreditos, SubcategoriaEditorialId)
SELECT p.Codigo, p.Titulo, p.Subtitulo, p.Volumen, p.Serie, p.Resumen, p.Edtf, p.AnioInicio, p.AnioFin, p.Catalogacion, p.Publicacion, p.Version,
       p.DerEstado, p.DerFicha, p.DerArchivo, p.DerNota, p.DerFuente,
       CASE WHEN p.DerEstado = N'pendiente' THEN NULL ELSE DATEADD(DAY, 3, p.Alta) END,
       CASE WHEN p.DerEstado = N'pendiente' THEN NULL ELSE (SELECT NombreCompleto FROM dbo.Usuarios WHERE IdUsuario = @Gestor) END,
       p.Alta, DATEADD(DAY, 10, p.Alta), p.TipoPublicacion, p.Ambito,
       CASE WHEN p.Portada IS NULL THEN NULL ELSE CONCAT(N'/api/v1/publico/archivos/', (SELECT Id FROM @Img WHERE Nombre = p.Portada)) END,
       p.Tamano, p.Paginas, p.Duracion, p.TextoPortada, c.IdCategoria, p.Formato, p.NotaFecha, p.AmbitoTexto, p.Notas, p.Confianza,
       CASE WHEN p.Codigo = N'PNMC-ED-DEMO-002' THEN 1 ELSE 0 END, CASE WHEN p.Codigo = N'PNMC-ED-DEMO-002' THEN 1 ELSE 0 END, s.IdCategoria
FROM @Pub p
JOIN dbo.Categorias c ON c.CodigoModulo = N'editorial' AND c.Slug = p.Categoria
JOIN dbo.Categorias s ON s.CodigoModulo = N'editorial' AND s.Slug = p.Subcategoria;

UPDATE p SET Id = x.IdPublicacionEditorial FROM @Pub p JOIN dbo.PublicacionesEditoriales x ON x.Codigo = p.Codigo;
DECLARE @E1 bigint = (SELECT Id FROM @Pub WHERE Codigo = N'PNMC-ED-DEMO-001');
DECLARE @E2 bigint = (SELECT Id FROM @Pub WHERE Codigo = N'PNMC-ED-DEMO-002');
DECLARE @E3 bigint = (SELECT Id FROM @Pub WHERE Codigo = N'PNMC-ED-DEMO-003');
DECLARE @E4 bigint = (SELECT Id FROM @Pub WHERE Codigo = N'PNMC-ED-DEMO-004');

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'catalogo-editorial', CAST(Id AS nvarchar(120)), N'administrativo', @Institucional, @Gestor, Alta FROM @Pub;

INSERT INTO dbo.PublicacionesEditorialesFuentes (PublicacionEditorialId, FuenteEditorialId) VALUES
 (@E1, @FuenteCantaclaro), (@E2, @FuenteCantaclaro), (@E3, @FuenteBandas), (@E4, @FuenteCantaclaro);

INSERT INTO dbo.PublicacionesEditorialesIdiomas (PublicacionEditorialId, CodigoIdioma, Orden) VALUES
 (@E1, N'spa', 1), (@E1, N'gum', 2), (@E2, N'spa', 1), (@E3, N'spa', 1), (@E4, N'spa', 1), (@E4, N'eng', 2);

INSERT INTO dbo.PublicacionesEditorialesTipologias (PublicacionEditorialId, TipologiaEditorialId)
SELECT x.Id, t.IdTipologiaEditorial FROM (VALUES
  (@E1, N'recurso', N'text'), (@E1, N'contenido', N'musica-notada'), (@E1, N'contenido', N'texto'), (@E1, N'medio', N'sin-mediacion'), (@E1, N'soporte', N'volumen'), (@E1, N'soporte', N'recurso-en-linea'), (@E1, N'medio', N'informatico'),
  (@E2, N'recurso', N'text'), (@E2, N'contenido', N'musica-notada'), (@E2, N'medio', N'sin-mediacion'), (@E2, N'soporte', N'volumen'),
  (@E3, N'recurso', N'sound'), (@E3, N'contenido', N'musica-interpretada'), (@E3, N'medio', N'audio'), (@E3, N'soporte', N'disco-de-audio'),
  (@E4, N'recurso', N'text'), (@E4, N'contenido', N'texto'), (@E4, N'medio', N'informatico'), (@E4, N'soporte', N'recurso-en-linea')
) x(Id, Eje, Codigo) JOIN dbo.TipologiasEditoriales t ON t.Eje = x.Eje AND t.Codigo = x.Codigo;

INSERT INTO dbo.CreditosEditoriales (PublicacionEditorialId, AgenteEditorialId, RolCodigo, RolEtiqueta, Principal, Orden)
SELECT x.Id, a.IdAgenteEditorial, x.Rol, x.Etiqueta, x.Principal, x.Orden FROM (VALUES
  (@E1, N'PNMC-AG-DEMO-002', N'com', N'Recopilador/Compilador', 1, 1),
  (@E1, N'PNMC-AG-DEMO-003', N'arr', N'Arreglista', 0, 2),
  (@E1, N'PNMC-AG-DEMO-005', N'ctb', N'Diseño de contenidos/metodología', 0, 3),
  (@E1, N'PNMC-AG-DEMO-001', N'pbl', N'Editorial', 0, 4),
  (@E2, N'PNMC-AG-DEMO-005', N'aut', N'Autor', 1, 1),
  (@E2, N'PNMC-AG-DEMO-001', N'pbl', N'Editorial', 0, 2),
  (@E3, N'PNMC-AG-DEMO-004', N'pro', N'Productor', 1, 1),
  (@E3, N'PNMC-AG-DEMO-004', N'aut', N'Autor (corporativo)', 0, 2),
  (@E4, N'PNMC-AG-DEMO-001', N'aut', N'Autor (corporativo)', 1, 1),
  (@E4, N'PNMC-AG-DEMO-002', N'csl', N'Asesoría', 0, 2)
) x(Id, Agente, Rol, Etiqueta, Principal, Orden) JOIN dbo.AgentesEditoriales a ON a.Codigo = x.Agente;

INSERT INTO dbo.IdentificadoresEditoriales (PublicacionEditorialId, Esquema, CodigoRecibido, Cualificador, Valido, ObservacionValidacion) VALUES
 (@E1, N'ISBN', N'978-958-99999-0-5', N'impreso', 1, NULL),
 (@E1, N'ISMN', N'979-0-9001-0001-6', N'partituras', 1, NULL),
 (@E3, N'ISBN', N'978-958-99999-1-3', N'audio', 0, N'Dígito de control incorrecto en el ejemplar: se conserva como figura.');

INSERT INTO dbo.PalabrasClaveEditoriales (PublicacionEditorialId, Termino)
SELECT x.Id, x.Termino FROM (VALUES (@E1, N'chirimía'), (@E1, N'cantos de minga'), (@E1, N'Macizo colombiano'), (@E1, N'cancionero'),
  (@E2, N'flauta de caña'), (@E2, N'iniciación musical'), (@E3, N'bandas de vientos'), (@E3, N'grabación en vivo'),
  (@E4, N'gestión cultural'), (@E4, N'festivales comunitarios')) x(Id, Termino);

INSERT INTO dbo.PublicacionesEditorialesPracticasMusicales (PublicacionEditorialId, PracticaMusicalId) VALUES
 (@E1, @PmCampesinas), (@E1, @PmVocales), (@E2, @PmTradicionales),
 (@E3, @PmBandas), (@E4, @PmComunitarias);
INSERT INTO dbo.PublicacionesEditorialesTerritoriosSonoros (PublicacionEditorialId, TerritorioSonoroId) VALUES
 (@E1, @TsSurenos), (@E1, @TsRajalena), (@E2, @TsChirimia),
 (@E3, @TsTrova);
INSERT INTO dbo.PublicacionesEditorialesProgramas (PublicacionEditorialId, ProgramaEditorialId, FuenteEditorialId, VigenteDesde, VigenteHasta, VerificadaPor) VALUES
 (@E1, @Programa, @FuenteCantaclaro, DATEFROMPARTS(@Y1, 1, 1), NULL, @NombreWebmaster),
 (@E2, @Programa, @FuenteCantaclaro, DATEFROMPARTS(@Y1, 1, 1), DATEFROMPARTS(@Y1, 12, 31), @NombreWebmaster);

-- Accesos: archivo del Banco, enlace y ubicación física, cada uno con sus derechos.
DECLARE @NombreGestor nvarchar(180) = (SELECT NombreCompleto FROM dbo.Usuarios WHERE IdUsuario = @Gestor);
INSERT INTO dbo.AccesosEditoriales (PublicacionEditorialId, Tipo, ArchivoId, Url, UbicacionFisica, Etiqueta, Nota, Orden, DerechosEstado,
    DerechosPermitePublicarFicha, DerechosPermitePublicarArchivo, DerechosLicenciaONota, DerechosFuenteId, DerechosFechaVerificacion, DerechosVerificadoPor) VALUES
 (@E1, N'archivo', (SELECT Id FROM @Img WHERE Nombre = N'portada-cancionero-macizo'), NULL, NULL, N'Portada digitalizada', N'Imagen de la portada del ejemplar impreso.', 1,
  N'verificado', 1, 1, N'CC BY-NC 4.0', @FuenteCantaclaro, DATEADD(DAY, -37, @Ahora), @NombreGestor),
 (@E1, N'enlace', NULL, N'https://cantaclaro.test/publicaciones/cancionero-del-macizo', NULL, N'Recurso en línea', N'Versión digital completa en el sitio de la Corporación.', 2,
  N'verificado', 1, 0, N'Enlace autorizado por la Corporación.', @FuenteCantaclaro, DATEADD(DAY, -37, @Ahora), @NombreGestor),
 (@E1, N'ubicacion', NULL, NULL, N'Centro de documentación de la Corporación Cultural Cantaclaro, estante B-3, Popayán', N'Dónde se conserva', N'Consulta en sala, con cita previa.', 3,
  N'verificado', 1, 0, NULL, @FuenteCantaclaro, DATEADD(DAY, -37, @Ahora), @NombreGestor),
 (@E2, N'archivo', (SELECT Id FROM @Img WHERE Nombre = N'portada-cartilla-chirimia'), NULL, NULL, N'Portada digitalizada', NULL, 1,
  N'pendiente', 0, 0, NULL, NULL, NULL, NULL),
 (@E3, N'enlace', NULL, N'https://bandasoriente.test/fonoteca/encuentro', NULL, N'Recurso en línea', N'Escucha de fragmentos de 30 segundos.', 1,
  N'verificado', 1, 0, N'Solo fragmentos.', @FuenteBandas, DATEADD(DAY, -32, @Ahora), @NombreGestor),
 (@E3, N'ubicacion', NULL, NULL, N'Fonoteca de la Asociación de Bandas del Oriente, Rionegro', N'Dónde se conserva', N'Consulta en sala.', 2,
  N'restringido', 1, 0, N'Las grabaciones completas solo se consultan en sala.', @FuenteBandas, DATEADD(DAY, -32, @Ahora), @NombreGestor),
 (@E4, N'enlace', NULL, N'https://cantaclaro.test/publicaciones/guia-gestion', NULL, N'Recurso en línea', NULL, 1,
  N'restringido', 0, 0, N'Retirada la autorización de difusión.', @FuenteCantaclaro, DATEADD(DAY, -20, @Ahora), @NombreGestor);

-- Historial del Catálogo: cada eje que se movió, las anotaciones y los derechos.
INSERT INTO #Hist (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, CamposObservados, IdUsuario, Fecha, MetadataJson, OrganizacionId, Instantanea)
SELECT N'catalogo-editorial', CAST(p.Id AS nvarchar(120)), h.Anterior, h.Nuevo, h.Accion, h.Comentario, NULL, NULL, h.Usuario, DATEADD(HOUR, h.Horas, p.Alta),
       CONCAT(N'{"codigo":"', p.Codigo, N'","catalogacion":"', h.Cat, N'","publicacion":"', h.Pub, N'"}'), NULL, 0
FROM @Pub p
JOIN (VALUES
  (N'PNMC-ED-DEMO-001', N'pendiente_revision', N'en_revision', N'CatalogacionCambiada', NULL, @Gestor, 2, N'en_revision', N'borrador'),
  (N'PNMC-ED-DEMO-001', N'en_revision', N'en_revision', N'Anotacion', N'Revisé los créditos contra el colofón: el arreglista es Ernesto Yalanda. Falta el ISMN de las partituras.', @Gestor, 20, N'en_revision', N'borrador'),
  (N'PNMC-ED-DEMO-001', N'en_revision', N'en_revision', N'DerechosCambiados', N'Ficha: verificado; publicar ficha: sí; publicar archivo: sí. Acceso «Portada digitalizada»: verificado; publicar ficha: sí; publicar archivo: sí. Acceso «Recurso en línea»: verificado; publicar ficha: sí; publicar archivo: no. Acceso «Dónde se conserva»: verificado; publicar ficha: sí; publicar archivo: no.', @Gestor, 72, N'en_revision', N'borrador'),
  (N'PNMC-ED-DEMO-001', N'en_revision', N'validada', N'CatalogacionCambiada', NULL, @Gestor, 80, N'validada', N'borrador'),
  (N'PNMC-ED-DEMO-001', N'borrador', N'publicado', N'PublicacionCambiada', NULL, @Webmaster, 96, N'validada', N'publicado'),
  (N'PNMC-ED-DEMO-001', N'publicado', N'publicado', N'ErrataCorregida', N'Errata corregida en lo publicado.', @Gestor, 200, N'validada', N'publicado'),
  (N'PNMC-ED-DEMO-002', N'pendiente_revision', N'en_revision', N'CatalogacionCambiada', NULL, @Gestor, 4, N'en_revision', N'borrador'),
  (N'PNMC-ED-DEMO-002', N'en_revision', N'observada', N'CatalogacionCambiada', N'La autoría de los ejercicios no coincide con la portada y el ejemplar no tiene fecha: hay que confirmarlas con la Corporación antes de validar.', @Gestor, 30, N'observada', N'borrador'),
  (N'PNMC-ED-DEMO-002', N'observada', N'observada', N'Anotacion', N'Escribí a la Corporación para pedir el acta de autoría.', @Gestor, 50, N'observada', N'borrador'),
  (N'PNMC-ED-DEMO-003', N'pendiente_revision', N'validada', N'CatalogacionCambiada', NULL, @Gestor, 5, N'validada', N'borrador'),
  (N'PNMC-ED-DEMO-003', N'validada', N'validada', N'DerechosCambiados', N'Ficha: verificado; publicar ficha: sí; publicar archivo: no. Acceso «Recurso en línea»: verificado; publicar ficha: sí; publicar archivo: no. Acceso «Dónde se conserva»: restringido; publicar ficha: sí; publicar archivo: no.', @Gestor, 24, N'validada', N'borrador'),
  (N'PNMC-ED-DEMO-003', N'borrador', N'publicado', N'PublicacionCambiada', NULL, @Webmaster, 48, N'validada', N'publicado'),
  (N'PNMC-ED-DEMO-003', N'publicado', N'en_revision', N'CambioDeFondoEnPublicado', N'Cambio de fondo en lo publicado: vuelve a revisión.', @Gestor, 24 * 30, N'validada', N'en_revision'),
  (N'PNMC-ED-DEMO-004', N'pendiente_revision', N'validada', N'CatalogacionCambiada', NULL, @Gestor, 3, N'validada', N'borrador'),
  (N'PNMC-ED-DEMO-004', N'borrador', N'publicado', N'PublicacionCambiada', NULL, @Webmaster, 24, N'validada', N'publicado'),
  (N'PNMC-ED-DEMO-004', N'validada', N'validada', N'DerechosCambiados', N'Ficha: restringido; publicar ficha: no; publicar archivo: no. Acceso «Recurso en línea»: restringido; publicar ficha: no; publicar archivo: no.', @Gestor, 24 * 70, N'validada', N'publicado'),
  (N'PNMC-ED-DEMO-004', N'publicado', N'retirado', N'PublicacionCambiada', N'La editorial original retiró la autorización de difusión. Se retira del portal; la ficha se conserva.', @Webmaster, 24 * 70 + 2, N'validada', N'retirado')
) h(Codigo, Anterior, Nuevo, Accion, Comentario, Usuario, Horas, Cat, Pub) ON h.Codigo = p.Codigo;

INSERT INTO #Bit (IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha)
SELECT @Gestor, N'PublicacionesEditoriales', CAST(p.Id AS nvarchar(120)), N'crear', NULL, CONCAT(N'{"Codigo":"', p.Codigo, N'","Titulo":"', p.Titulo, N'"}'), p.Alta FROM @Pub p
UNION ALL SELECT @Webmaster, N'PublicacionesEditoriales', CAST(p.Id AS nvarchar(120)), N'publicar', N'{"estadoPublicacion":"borrador"}', N'{"estadoPublicacion":"publicado","Motivo":null}', DATEADD(HOUR, 96, p.Alta)
FROM @Pub p WHERE p.Codigo = N'PNMC-ED-DEMO-001'
UNION ALL SELECT @Webmaster, N'PublicacionesEditoriales', CAST(p.Id AS nvarchar(120)), N'archivar', N'{"estadoPublicacion":"publicado"}',
       N'{"estadoPublicacion":"retirado","Motivo":"La editorial original retiró la autorización de difusión."}', DATEADD(HOUR, 24 * 70 + 2, p.Alta)
FROM @Pub p WHERE p.Codigo = N'PNMC-ED-DEMO-004';

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 9. NOTIFICACIONES
-- ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO dbo.Notificaciones (UsuarioDestinatarioId, CorreoDestinatario, TipoEvento, Canal, Titulo, Cuerpo, Estado, ModuloId, RegistroId, MetadataJson,
    FechaCreacion, FechaEnvio, FechaLectura, Intentos, AmbitoAcceso) VALUES
 (@Lucia, N'lucia.ramirez@cantaclaro.test', N'FestivalPublicado', N'internal', N'Tu Festival fue publicado', N'«Festival de Músicas del Macizo» ya está en el mapa y en el directorio.', N'leida',
  N'festivales', CAST(@FMacizo AS nvarchar(120)), N'{"Estado":"Publicado"}', DATETIME2FROMPARTS(@Y3, 3, 12, 9, 45, 0, 0, 7), DATETIME2FROMPARTS(@Y3, 3, 12, 9, 45, 0, 0, 7), DATETIME2FROMPARTS(@Y3, 3, 12, 12, 0, 0, 0, 7), 0, N'external'),
 (@Lucia, N'lucia.ramirez@cantaclaro.test', N'FestivalCambiosPedidosPorCampo', N'internal', N'El Programa pidió ajustes', N'Revisa las observaciones del «Encuentro de Chirimías del Cauca» y vuelve a enviarlo.', N'leida',
  N'festivales', CAST(@FChirimias AS nvarchar(120)), NULL, DATEADD(DAY, -15, @Ahora), DATEADD(DAY, -15, @Ahora), DATEADD(DAY, -14, @Ahora), 0, N'external'),
 (@Mariana, N'mariana.palacios@sonoracaribe.test', N'FestivalCambiosPedidosPorCampo', N'internal', N'El Programa pidió ajustes', N'El «Festival Bullerengue al Mar» tiene 3 observaciones por atender.', N'pendiente',
  N'festivales', CAST(@FBullerengue AS nvarchar(120)), NULL, DATEADD(DAY, -6, @Ahora), DATEADD(DAY, -6, @Ahora), NULL, 0, N'external'),
 (@Lucia, N'lucia.ramirez@cantaclaro.test', N'FestivalCambiosPedidosPorCampo', N'internal', N'El Programa pidió ajustes', N'El «Festival de Cuerdas y Bandolas de Silvia» tiene 2 observaciones por atender.', N'pendiente',
  N'festivales', CAST(@FCuerdas AS nvarchar(120)), NULL, DATEADD(DAY, -4, @Ahora), DATEADD(DAY, -4, @Ahora), NULL, 0, N'external'),
 (@Gestor, N'gestor@simus.test', N'FestivalRecibidoParaRevision', N'internal', N'Festival por revisar', N'«Encuentro de Bandas del Oriente Antioqueño» llegó a la bandeja de revisión.', N'pendiente',
  N'festivales', CAST(@FBandas AS nvarchar(120)), NULL, DATEADD(DAY, -2, @Ahora), DATEADD(DAY, -2, @Ahora), NULL, 0, N'institutional'),
 (@Gestor, N'gestor@simus.test', N'FestivalRecibidoParaRevision', N'internal', N'Reenvío de Festival', N'«Encuentro de Chirimías del Cauca» volvió corregido (ciclo 2).', N'pendiente',
  N'festivales', CAST(@FChirimias AS nvarchar(120)), NULL, DATEADD(DAY, -4, @Ahora), DATEADD(DAY, -4, @Ahora), NULL, 0, N'institutional');

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 10. HISTORIAL Y BITÁCORA, con la instantánea de cada paso
-- ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, MotivoRechazo, CamposObservados, IdUsuario, Fecha,
    MetadataJson, OrganizacionId, OrganizacionNombre, ResponsableNombre, ActorNombre)
SELECT h.ModuloId, h.RegistroId, h.EstadoAnterior, h.EstadoNuevo, h.Accion, h.Comentario, h.MotivoRechazo, h.CamposObservados, h.IdUsuario, h.Fecha, h.MetadataJson,
       CASE WHEN h.Instantanea = 1 THEN h.OrganizacionId END,
       CASE WHEN h.Instantanea = 1 THEN e.Nombre END,
       CASE WHEN h.Instantanea = 1 THEN r.ResponsableNombre END,
       CASE WHEN h.Instantanea = 1 THEN u.NombreCompleto END
FROM #Hist h
LEFT JOIN dbo.Entidades e ON e.IdEntidad = h.OrganizacionId
LEFT JOIN dbo.EntidadesResponsable r ON r.IdEntidad = h.OrganizacionId
LEFT JOIN dbo.Usuarios u ON u.IdUsuario = h.IdUsuario
ORDER BY h.Fecha, h.Orden;

INSERT INTO dbo.BitacoraAuditoria (IdUsuario, TablaAfectada, IdRegistroAfectado, Accion, ValoresAnteriores, ValoresNuevos, FechaAccion)
SELECT IdUsuario, Tabla, IdRegistro, Accion, Antes, Despues, Fecha FROM #Bit ORDER BY Fecha, Orden;

DROP TABLE #Hist;
DROP TABLE #Bit;

COMMIT TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 11. LO QUE QUEDÓ
-- ─────────────────────────────────────────────────────────────────────────────────────────────
SELECT N'Cuentas' AS Concepto, COUNT(*) AS Cifra FROM @Cuentas
UNION ALL SELECT N'Organizaciones (revisadas)', COUNT(*) FROM dbo.Entidades WHERE IdEntidad IN (SELECT Id FROM @Orgs) AND FechaRevisionConsola IS NOT NULL
UNION ALL SELECT N'Festivales', COUNT(*) FROM @Fest
UNION ALL SELECT N'Ediciones de Festival', COUNT(*) FROM @Ed
UNION ALL SELECT N'Cambios aplicados del Festival', COUNT(*) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'festivales' AND RegistroId = CAST(@FMacizo AS nvarchar(120)) AND Origen = N'propuesta'
UNION ALL SELECT N'Mercados', COUNT(*) FROM @Merc
UNION ALL SELECT N'Ediciones de Mercado', COUNT(*) FROM dbo.EdicionesMercado WHERE MercadoId = @MSuroccidente
UNION ALL SELECT N'Eventos de Agenda', COUNT(*) FROM @Ev
UNION ALL SELECT N'Noticias', COUNT(*) FROM @Not
UNION ALL SELECT N'Fichas editoriales', COUNT(*) FROM @Pub
UNION ALL SELECT N'Perfiles públicos', COUNT(*) FROM dbo.PerfilesPublicos WHERE IdUsuario IN (SELECT Id FROM @Cuentas)
UNION ALL SELECT N'Imágenes del Banco', COUNT(*) FROM @Img;
