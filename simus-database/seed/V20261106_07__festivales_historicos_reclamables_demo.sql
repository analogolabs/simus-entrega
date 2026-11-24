/*
    SIMUS · Demostración: Festivales históricos sin organización, listos para reclamar (#140).

    POR QUE EXISTE. La revisión de interfaz (ORG-R4) no pudo recorrer la reclamación de un Festival
    histórico: la base de demostración no tenía ninguno. Los administradores del sistema cargan los
    registros históricos mapeados sin organización (la entidad institucional responde por ellos) y
    las organizaciones, al registrarse, los encuentran y piden administrarlos.

    DE DONDE SALEN. Los seis primeros son los registros sintéticos de
    seed/V20260901_01__reclamaciones_administracion_demo.sql (que reconstruir-demo-local.sh no
    aplica). Los demás añaden los casos difíciles del recorrido:
      - nombres con tildes («Festival Folclórico de la Chirimía» se busca sin tildes);
      - dos Festivales parecidos en municipios distintos («Festival del Bambuco» en Neiva y en
        Pitalito);
      - un histórico duplicado («Muestra Andina de Cuerdas» dos veces en Manizales);
      - un histórico de cobertura departamental, sin municipio.
    Ninguno corresponde a un Festival, una organización ni una persona reales. Correos y enlaces
    usan dominios .test.

    NACEN PUBLICADOS (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1, decisión 16; #147): un histórico cargado desde la consola o
    importado se publica al cargarse para que su organización lo encuentre y lo reclame. La siembra
    deja, como el alta y la importación, la entrada «Registro histórico publicado al cargarse» en
    su historial. La «Muestra Andina de Cuerdas» duplicada sirve para recorrer la fusión de
    duplicados (decisión 18).

    Idempotente: se puede volver a aplicar sin duplicar nada. Se aplica con
    scripts/demo/sembrar-demo.sh historicos (también va en la siembra por defecto).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Institucional int = (SELECT TOP 1 IdEntidad FROM dbo.Entidades WHERE EsInstitucional = 1 ORDER BY IdEntidad);
IF @Institucional IS NULL THROW 52907, N'Falta la entidad institucional: arranca la API una vez para crearla.', 1;
DECLARE @Siembra int = (SELECT TOP 1 IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'sistema@pnmc.local');

DECLARE @Historicos TABLE (
    Clave nvarchar(40) PRIMARY KEY, Nombre nvarchar(200), Descripcion nvarchar(600), Organizador nvarchar(200),
    Correo nvarchar(200) NULL, Instagram nvarchar(300) NULL, SitioWeb nvarchar(300) NULL,
    Nivel nvarchar(20), Departamento nvarchar(2) NULL, Municipio nvarchar(5) NULL, Periodicidad nvarchar(20) NULL);

INSERT INTO @Historicos VALUES
 (N'sonidos-huila',    N'Festival Sonidos del Huila', N'Registro histórico de demostración: encuentro de músicas andinas del sur del Huila.', N'Corporación cultural (sin verificar)', N'sonidoshuila@historico.test', NULL, NULL, N'municipal', N'41', N'41001', N'anual'),
 (N'voces-rio',        N'Encuentro Voces del Río', N'Registro histórico de demostración: músicas tradicionales y contemporáneas alrededor del río.', N'Sin organizador registrado', N'vocesrio@historico.test', N'https://instagram.com/vocesdelrio.test', N'https://vocesdelrio.test', N'municipal', N'08', N'08001', N'anual'),
 (N'cuerdas-andinas',  N'Muestra Andina de Cuerdas', N'Registro histórico de demostración: programación de cuerdas andinas, formación y circulación local.', N'Sin organizador registrado', N'cuerdasandinas@historico.test', N'https://instagram.com/cuerdasandinas.test', N'https://cuerdasandinas.test', N'municipal', N'17', N'17001', N'anual'),
 (N'brisas-caribe',    N'Festival Brisas del Caribe', N'Registro histórico de demostración: músicas de banda, tambores y procesos comunitarios.', N'Sin organizador registrado', N'brisascaribe@historico.test', NULL, NULL, N'municipal', N'13', N'13001', N'anual'),
 (N'circuito-pacifico',N'Circuito Sonoro del Pacífico', N'Registro histórico de demostración: circulación de marimba, cantos y agrupaciones del Pacífico.', N'Sin organizador registrado', NULL, NULL, NULL, N'municipal', N'76', N'76001', N'anual'),
 (N'jornadas-llaneras',N'Jornadas Llaneras de la Sabana', N'Registro histórico de demostración: músicas llaneras, baile y transmisión de saberes.', N'Sin organizador registrado', NULL, NULL, NULL, N'municipal', N'50', N'50001', N'bienal'),
 -- Tildes: la organización lo escribirá «Festival Folclorico de Chirimia».
 (N'chirimia-quibdo',  N'Festival Folclórico de la Chirimía', N'Registro histórico de demostración: chirimías del Atrato y su relevo generacional.', N'Sin organizador registrado', N'chirimia@historico.test', NULL, NULL, N'municipal', N'27', N'27001', N'anual'),
 -- Dos parecidos en municipios distintos del mismo departamento.
 (N'bambuco-neiva',    N'Festival del Bambuco', N'Registro histórico de demostración: concurso de bambuco y rajaleña en la capital.', N'Sin organizador registrado', NULL, NULL, NULL, N'municipal', N'41', N'41001', N'anual'),
 (N'bambuco-pitalito', N'Festival del Bambuco', N'Registro histórico de demostración: muestra de bambuco del sur del departamento.', N'Sin organizador registrado', NULL, NULL, NULL, N'municipal', N'41', N'41551', N'anual'),
 -- Histórico duplicado: la misma Muestra cargada dos veces desde dos fuentes.
 (N'cuerdas-andinas-2',N'Muestra Andina de Cuerdas', N'Registro histórico de demostración (segunda fuente, con menos datos).', N'Sin organizador registrado', NULL, NULL, NULL, N'municipal', N'17', N'17001', NULL),
 -- Cobertura departamental: sin municipio.
 (N'marimba-guapi',    N'Encuentro de Marimba y Cantos del Cauca', N'Registro histórico de demostración: circuito departamental de marimba de chonta.', N'Sin organizador registrado', NULL, NULL, NULL, N'departamental', N'19', NULL, N'anual');

DECLARE @Creados TABLE (Clave nvarchar(40), Id int);

-- La clave se guarda en ObservacionesContacto para que la siembra sea idempotente sin depender
-- del nombre, que se repite a propósito en los casos difíciles.
INSERT INTO dbo.Festivales (NombreFestival, Descripcion, Organizador, CorreoFestival, InstagramFestival, SitioWebFestival,
    NivelCobertura, CodigoDepartamento, CodigoMunicipio, Periodicidad, EstadoRegistro, OrganizacionPrincipalId,
    ObservacionesContacto, FechaCreacion, FechaActualizacion)
OUTPUT inserted.IdFestival, inserted.ObservacionesContacto INTO @Creados (Id, Clave)
SELECT h.Nombre, h.Descripcion, h.Organizador, h.Correo, h.Instagram, h.SitioWeb,
       h.Nivel, h.Departamento, h.Municipio, h.Periodicidad, N'publicado', @Institucional,
       CONCAT(N'historico-demo:', h.Clave), SYSUTCDATETIME(), SYSUTCDATETIME()
FROM @Historicos h
WHERE NOT EXISTS (SELECT 1 FROM dbo.Festivales f WHERE f.ObservacionesContacto = CONCAT(N'historico-demo:', h.Clave));

-- Procedencia «historico»: lo incorporó el Programa desde un registro mapeado.
INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, UsuarioCreadorId, FechaRegistro)
SELECT N'festivales', CAST(c.Id AS nvarchar(40)), N'historico', @Siembra, SYSUTCDATETIME() FROM @Creados c;

-- El historial dice por qué está publicado sin haber pasado por la bandeja (decisión 16).
INSERT INTO dbo.RegistrosRevisionHistorial (ModuloId, RegistroId, EstadoAnterior, EstadoNuevo, Accion, Comentario, IdUsuario, Fecha)
SELECT N'festivales', CAST(c.Id AS nvarchar(64)), N'borrador', N'publicado', N'RegistroHistoricoPublicadoAlCargarse',
       N'Registro histórico de demostración: se publica para que su organización pueda encontrarlo y reclamarlo.', @Siembra, SYSUTCDATETIME()
FROM @Creados c;

-- Ediciones históricas publicadas: deben seguir al Festival cuando una organización lo reclame.
INSERT INTO dbo.EdicionesFestival (FestivalId, Anio, Nombre, Estado, EstadoRegistro, EstadoVisibilidad, FechaCreacion)
SELECT c.Id, e.Anio, CONCAT(N'Edición ', e.Anio), N'realizada', N'publicado', N'publicada', SYSUTCDATETIME()
FROM @Creados c
CROSS APPLY (VALUES (2018), (2019)) e(Anio)
WHERE c.Clave IN (N'historico-demo:sonidos-huila', N'historico-demo:chirimia-quibdo', N'historico-demo:cuerdas-andinas');

SELECT COUNT(*) AS HistoricosReclamables FROM dbo.Festivales
WHERE OrganizacionPrincipalId = @Institucional AND EstadoRegistro = N'publicado';
