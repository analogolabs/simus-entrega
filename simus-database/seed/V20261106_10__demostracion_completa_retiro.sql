/*
    SIMUS · Demostración completa (#145), paso 1 de 3: retirar lo que sembró la pasada anterior.

    La siembra completa se reconoce por lo que ella misma crea, no por la procedencia: sus registros
    llevan la procedencia que el sistema les habría dado (`externo` cuando los crea una
    organización, `administrativo` cuando los crea la consola), igual que si se hubieran cargado a
    mano. Por eso se identifican así:

      · cuentas ............ los correos de la tabla @Cuentas (dominios .test)
      · organizaciones ..... los correos de contacto de la tabla @Organizaciones
      · Festivales, Mercados, ediciones, versiones, eventos y propuestas: los de esas organizaciones
      · consola ............ noticias y eventos con slug `demo-completa-…`; fichas `PNMC-ED-DEMO-…`
      · Banco de archivos .. `NombreOriginal` que empieza por `demo-completa-`

    Las claves ajenas no borran en cascada (decisión del modelo), así que se borran los hijos antes
    que los padres. Lo sembrado por las otras semillas de demostración (mapa, noticias, históricos)
    no se toca.

    Se aplica con ./scripts/demo/sembrar-demo.sh completa (va en la siembra por defecto).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Cuentas TABLE (Correo nvarchar(180) PRIMARY KEY);
INSERT INTO @Cuentas (Correo) VALUES
 (N'lucia.ramirez@cantaclaro.test'), (N'andres.munoz@cantaclaro.test'),
 (N'mariana.palacios@sonoracaribe.test'), (N'jose.caicedo@sonoracaribe.test'),
 (N'camilo.rojas@llanoadentro.test'), (N'diana.zapata@bandasoriente.test'),
 (N'valentina.ocampo@correo.test');

DECLARE @CorreosOrganizacion TABLE (Correo nvarchar(180) PRIMARY KEY);
INSERT INTO @CorreosOrganizacion (Correo) VALUES
 (N'contacto@cantaclaro.test'), (N'hola@sonoracaribe.test'),
 (N'colectivo@llanoadentro.test'), (N'asociacion@bandasoriente.test');

DECLARE @U TABLE (Id int PRIMARY KEY);
INSERT INTO @U (Id) SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico IN (SELECT Correo FROM @Cuentas);

DECLARE @O TABLE (Id int PRIMARY KEY);
INSERT INTO @O (Id) SELECT IdEntidad FROM dbo.Entidades WHERE CorreoContacto IN (SELECT Correo FROM @CorreosOrganizacion);

-- Una cuenta de la demostración que creó OTRA organización durante una prueba: borrarla rompería
-- esa organización. Se para con un mensaje que dice qué hacer.
IF EXISTS (SELECT 1 FROM dbo.Entidades WHERE IdUsuarioCreador IN (SELECT Id FROM @U) AND IdEntidad NOT IN (SELECT Id FROM @O))
BEGIN
    RAISERROR(N'Una cuenta de la demostración completa creó otra organización. Para empezar de cero usa ./scripts/demo/reconstruir-demo-local.sh.', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;

DECLARE @F TABLE (Id int PRIMARY KEY);
INSERT INTO @F (Id) SELECT IdFestival FROM dbo.Festivales WHERE OrganizacionPrincipalId IN (SELECT Id FROM @O);
DECLARE @V TABLE (Id int PRIMARY KEY);
-- La tabla de perfiles se retira del modelo (retiro de PerfilesPublicosFestival): el guion sigue valiendo en una base
-- que aún la tiene (las siembras anteriores dejaron versiones) y en una que ya no.
IF OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U') IS NOT NULL
    INSERT INTO @V (Id) SELECT IdPerfilPublicoFestival FROM dbo.PerfilesPublicosFestival WHERE FestivalOrigenId IN (SELECT Id FROM @F);
DECLARE @E TABLE (Id int PRIMARY KEY);
INSERT INTO @E (Id) SELECT IdEdicionFestival FROM dbo.EdicionesFestival WHERE FestivalId IN (SELECT Id FROM @F);
DECLARE @M TABLE (Id int PRIMARY KEY);
INSERT INTO @M (Id) SELECT IdMercado FROM dbo.Mercados WHERE OrganizacionPrincipalId IN (SELECT Id FROM @O);
DECLARE @EM TABLE (Id int PRIMARY KEY);
INSERT INTO @EM (Id) SELECT IdEdicionMercado FROM dbo.EdicionesMercado WHERE MercadoId IN (SELECT Id FROM @M);
DECLARE @Ev TABLE (Id bigint PRIMARY KEY);
INSERT INTO @Ev (Id) SELECT IdEventoAgenda FROM dbo.EventosAgenda
WHERE FestivalId IN (SELECT Id FROM @F) OR MercadoId IN (SELECT Id FROM @M) OR Slug LIKE N'demo-completa-%';
DECLARE @N TABLE (Id bigint PRIMARY KEY);
INSERT INTO @N (Id) SELECT IdNoticia FROM dbo.Noticias WHERE Slug LIKE N'demo-completa-%';
DECLARE @P TABLE (Id bigint PRIMARY KEY);
INSERT INTO @P (Id) SELECT IdPublicacionEditorial FROM dbo.PublicacionesEditoriales WHERE Codigo LIKE N'PNMC-ED-DEMO-%';
DECLARE @A TABLE (Id int PRIMARY KEY);
INSERT INTO @A (Id) SELECT IdArchivo FROM dbo.Archivos WHERE NombreOriginal LIKE N'demo-completa-%';

-- Las parejas (módulo, registro) de todo lo anterior: las tablas genéricas se borran por ellas.
DECLARE @R TABLE (ModuloId nvarchar(80), RegistroId nvarchar(120), PRIMARY KEY (ModuloId, RegistroId));
INSERT INTO @R SELECT N'festivales', CAST(Id AS nvarchar(120)) FROM @F;
INSERT INTO @R SELECT N'festivales_retiro', CAST(Id AS nvarchar(120)) FROM @F;
INSERT INTO @R SELECT N'perfiles-publicos-festival', CAST(Id AS nvarchar(120)) FROM @V;
INSERT INTO @R SELECT N'ediciones-festival', CAST(Id AS nvarchar(120)) FROM @E;
INSERT INTO @R SELECT N'mercados', CAST(Id AS nvarchar(120)) FROM @M;
INSERT INTO @R SELECT N'ediciones-mercado', CAST(Id AS nvarchar(120)) FROM @EM;
INSERT INTO @R SELECT N'agenda', CAST(Id AS nvarchar(120)) FROM @Ev;
INSERT INTO @R SELECT N'noticias', CAST(Id AS nvarchar(120)) FROM @N;
INSERT INTO @R SELECT N'catalogo-editorial', CAST(Id AS nvarchar(120)) FROM @P;
INSERT INTO @R SELECT N'organizaciones', CAST(Id AS nvarchar(120)) FROM @O;

DECLARE @Prop TABLE (Id bigint PRIMARY KEY);
INSERT INTO @Prop (Id) SELECT p.IdPropuesta FROM dbo.PropuestasDeCambio p JOIN @R r ON r.ModuloId = p.ModuloId AND r.RegistroId = p.RegistroId;
INSERT INTO @R SELECT N'propuestas-cambio-festival', CAST(Id AS nvarchar(120)) FROM @Prop;

-- Revisiones, envíos, propuestas e historial.
DELETE FROM dbo.EnviosDeRevision WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = EnviosDeRevision.ModuloId AND r.RegistroId = EnviosDeRevision.RegistroId);
DELETE o FROM dbo.RevisionesDeRegistroObservaciones o JOIN dbo.RevisionesDeRegistro v ON v.IdRevision = o.IdRevision
  JOIN @R r ON r.ModuloId = v.ModuloId AND r.RegistroId = v.RegistroId;
DELETE FROM dbo.RevisionesDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = RevisionesDeRegistro.ModuloId AND r.RegistroId = RevisionesDeRegistro.RegistroId);
DELETE FROM dbo.PropuestasDeCambioCampos WHERE IdPropuesta IN (SELECT Id FROM @Prop);
DELETE FROM dbo.PropuestasDeCambio WHERE IdPropuesta IN (SELECT Id FROM @Prop);
DELETE FROM dbo.RegistrosRevisionHistorial WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = RegistrosRevisionHistorial.ModuloId AND r.RegistroId = RegistrosRevisionHistorial.RegistroId);
DELETE FROM dbo.SolicitudesVinculacionRegistros WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = SolicitudesVinculacionRegistros.ModuloId AND r.RegistroId = SolicitudesVinculacionRegistros.RegistroId)
   OR EntidadId IN (SELECT Id FROM @O) OR UsuarioSolicitanteId IN (SELECT Id FROM @U);
DELETE FROM dbo.Notificaciones WHERE UsuarioDestinatarioId IN (SELECT Id FROM @U)
   OR EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = Notificaciones.ModuloId AND r.RegistroId = Notificaciones.RegistroId);

-- Relaciones genéricas de Festivales, versiones y ediciones.
DELETE FROM dbo.PracticasMusicalesDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = PracticasMusicalesDeRegistro.ModuloId AND r.RegistroId = PracticasMusicalesDeRegistro.RegistroId);
DELETE FROM dbo.TerritoriosSonorosDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = TerritoriosSonorosDeRegistro.ModuloId AND r.RegistroId = TerritoriosSonorosDeRegistro.RegistroId);
DELETE FROM dbo.ExpresionesArtisticasDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = ExpresionesArtisticasDeRegistro.ModuloId AND r.RegistroId = ExpresionesArtisticasDeRegistro.RegistroId);
DELETE FROM dbo.ModalidadesParticipacionDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = ModalidadesParticipacionDeRegistro.ModuloId AND r.RegistroId = ModalidadesParticipacionDeRegistro.RegistroId);
DELETE FROM dbo.TiposIngresoDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = TiposIngresoDeRegistro.ModuloId AND r.RegistroId = TiposIngresoDeRegistro.RegistroId);
DELETE FROM dbo.LocalizacionesDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = LocalizacionesDeRegistro.ModuloId AND r.RegistroId = LocalizacionesDeRegistro.RegistroId);
DELETE FROM dbo.EntidadesAliadasDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = EntidadesAliadasDeRegistro.ModuloId AND r.RegistroId = EntidadesAliadasDeRegistro.RegistroId)
   OR EntidadId IN (SELECT Id FROM @O);
DELETE FROM dbo.ArchivosDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = ArchivosDeRegistro.ModuloId AND r.RegistroId = ArchivosDeRegistro.RegistroId)
   OR ArchivoId IN (SELECT Id FROM @A);

-- Agenda.
DELETE FROM dbo.EventosAgendaArchivos WHERE EventoAgendaId IN (SELECT Id FROM @Ev) OR ArchivoId IN (SELECT Id FROM @A);
DELETE FROM dbo.EtiquetasEventoAgenda WHERE EventoAgendaId IN (SELECT Id FROM @Ev);
DELETE FROM dbo.EventosAgendaPracticasMusicales WHERE EventoAgendaId IN (SELECT Id FROM @Ev);
DELETE FROM dbo.EventosAgendaTerritoriosSonoros WHERE EventoAgendaId IN (SELECT Id FROM @Ev);
DELETE FROM dbo.EventosAgendaProyectosTransversales WHERE EventoAgendaId IN (SELECT Id FROM @Ev);
DELETE FROM dbo.EventosAgenda WHERE IdEventoAgenda IN (SELECT Id FROM @Ev);

-- Noticias.
DELETE FROM dbo.NoticiasArchivos WHERE NoticiaId IN (SELECT Id FROM @N) OR ArchivoId IN (SELECT Id FROM @A);
DELETE FROM dbo.EtiquetasNoticia WHERE NoticiaId IN (SELECT Id FROM @N);
DELETE FROM dbo.NoticiasPracticasMusicales WHERE NoticiaId IN (SELECT Id FROM @N);
DELETE FROM dbo.NoticiasTerritoriosSonoros WHERE NoticiaId IN (SELECT Id FROM @N);
DELETE FROM dbo.NoticiasProyectosTransversales WHERE NoticiaId IN (SELECT Id FROM @N);
DELETE FROM dbo.Noticias WHERE IdNoticia IN (SELECT Id FROM @N);

-- Mercados.
-- LAS AGENDAS DE CITAS de esas ediciones (herramienta de Mercado, docs/referencia/26-agenda-de-citas-y-mercados.md): las sembradas y las que una
-- persona habilitó probando la demo. Antes que la edición, de la que cuelgan (FK_AgendasDeCitas_Edicion).
IF OBJECT_ID(N'dbo.AgendasDeCitas') IS NOT NULL
BEGIN
    DECLARE @AgendaDeEdicion TABLE (Id int PRIMARY KEY);
    INSERT INTO @AgendaDeEdicion SELECT IdAgenda FROM dbo.AgendasDeCitas WHERE EdicionMercadoId IN (SELECT Id FROM @EM);
    DELETE FROM dbo.Notificaciones WHERE ModuloId = N'agendas-de-citas' AND TRY_CAST(RegistroId AS int) IN (SELECT Id FROM @AgendaDeEdicion);
    DELETE FROM dbo.CambiosDeRegistro WHERE ModuloId = N'citas-de-agenda'
       AND TRY_CAST(RegistroId AS int) IN (SELECT IdCita FROM dbo.CitasDeAgenda WHERE AgendaId IN (SELECT Id FROM @AgendaDeEdicion));
    DELETE FROM dbo.CambiosDeRegistro WHERE ModuloId = N'participantes-de-citas'
       AND TRY_CAST(RegistroId AS int) IN (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId IN (SELECT Id FROM @AgendaDeEdicion));
    DELETE FROM dbo.CambiosDeRegistro WHERE ModuloId = N'agendas-de-citas' AND TRY_CAST(RegistroId AS int) IN (SELECT Id FROM @AgendaDeEdicion);
    DELETE FROM dbo.InvitacionesDeAgenda WHERE ParticipanteId IN (SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId IN (SELECT Id FROM @AgendaDeEdicion));
    DELETE FROM dbo.CitasDeAgenda WHERE AgendaId IN (SELECT Id FROM @AgendaDeEdicion);
    DELETE FROM dbo.ParticipantesDeCitas WHERE AgendaId IN (SELECT Id FROM @AgendaDeEdicion);
    DELETE FROM dbo.FranjasDeCitas WHERE AgendaId IN (SELECT Id FROM @AgendaDeEdicion);
    DELETE FROM dbo.AgendasDeCitas WHERE IdAgenda IN (SELECT Id FROM @AgendaDeEdicion);
END;
DELETE FROM dbo.EdicionesMercado WHERE IdEdicionMercado IN (SELECT Id FROM @EM);
DELETE FROM dbo.MercadosPracticasMusicales WHERE MercadoId IN (SELECT Id FROM @M);
DELETE FROM dbo.MercadosTerritoriosSonoros WHERE MercadoId IN (SELECT Id FROM @M);
DELETE FROM dbo.Mercados WHERE IdMercado IN (SELECT Id FROM @M);

-- Festivales.
DELETE FROM dbo.EdicionesFestival WHERE IdEdicionFestival IN (SELECT Id FROM @E);
IF OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U') IS NOT NULL
    DELETE FROM dbo.PerfilesPublicosFestival WHERE IdPerfilPublicoFestival IN (SELECT Id FROM @V);
DELETE FROM dbo.FestivalesReferenciasHistoricas WHERE IdFestival IN (SELECT Id FROM @F) OR IdOrganizacion IN (SELECT Id FROM @O);
DELETE FROM dbo.Festivales WHERE IdFestival IN (SELECT Id FROM @F);

-- Catálogo Editorial.
DELETE FROM dbo.AccesosEditoriales WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.CreditosEditoriales WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.IdentificadoresEditoriales WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.PalabrasClaveEditoriales WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.PublicacionesEditorialesFuentes WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.PublicacionesEditorialesIdiomas WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.PublicacionesEditorialesPracticasMusicales WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.PublicacionesEditorialesTerritoriosSonoros WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.PublicacionesEditorialesTipologias WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.PublicacionesEditorialesProgramas WHERE PublicacionEditorialId IN (SELECT Id FROM @P);
DELETE FROM dbo.PublicacionesEditoriales WHERE IdPublicacionEditorial IN (SELECT Id FROM @P);
DELETE FROM dbo.AgentesEditoriales WHERE Codigo LIKE N'PNMC-AG-DEMO-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.CreditosEditoriales c WHERE c.AgenteEditorialId = AgentesEditoriales.IdAgenteEditorial);
DELETE FROM dbo.ProgramasEditoriales WHERE Codigo LIKE N'demo-completa-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.PublicacionesEditorialesProgramas x WHERE x.ProgramaEditorialId = ProgramasEditoriales.IdProgramaEditorial);
DELETE FROM dbo.FuentesEditoriales WHERE Nombre IN (N'Archivo documental de la Corporación Cultural Cantaclaro', N'Fonoteca comunitaria de Bandas del Oriente')
  AND NOT EXISTS (SELECT 1 FROM dbo.PublicacionesEditorialesFuentes x WHERE x.FuenteEditorialId = FuentesEditoriales.IdFuenteEditorial)
  AND NOT EXISTS (SELECT 1 FROM dbo.PublicacionesEditoriales x WHERE x.DerechosFuenteId = FuentesEditoriales.IdFuenteEditorial)
  AND NOT EXISTS (SELECT 1 FROM dbo.AccesosEditoriales x WHERE x.DerechosFuenteId = FuentesEditoriales.IdFuenteEditorial);

-- Personas.
IF OBJECT_ID(N'dbo.PerfilesPublicosClasificaciones', N'U') IS NOT NULL
    DELETE FROM dbo.PerfilesPublicosClasificaciones WHERE IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.PerfilesPublicosEnlaces WHERE IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.PerfilesPublicosPracticas WHERE IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.PerfilesPublicos WHERE IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.AutorizacionesDatos WHERE IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.BoletinSuscripciones WHERE CorreoElectronico IN (SELECT Correo FROM @Cuentas);

-- Organizaciones y equipos.
DELETE FROM dbo.InvitacionesDeOrganizacion WHERE IdEntidad IN (SELECT Id FROM @O) OR IdUsuarioInvita IN (SELECT Id FROM @U) OR IdUsuarioAcepta IN (SELECT Id FROM @U);
DELETE FROM dbo.UsuariosEntidades WHERE IdEntidad IN (SELECT Id FROM @O) OR IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.EntidadesResponsable WHERE IdEntidad IN (SELECT Id FROM @O);
DELETE FROM dbo.BorradoresProceso WHERE OrganizacionId IN (SELECT Id FROM @O) OR PersonaId IN (SELECT Id FROM @U);
DELETE FROM dbo.ReclamacionesAdministracion WHERE OrganizacionSolicitanteId IN (SELECT Id FROM @O) OR PersonaSolicitanteId IN (SELECT Id FROM @U);
DELETE FROM dbo.ProcedenciasDeRegistro WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = ProcedenciasDeRegistro.ModuloId AND r.RegistroId = ProcedenciasDeRegistro.RegistroId)
   OR OrganizacionProcedenciaId IN (SELECT Id FROM @O) OR UsuarioCreadorId IN (SELECT Id FROM @U);

-- EL HISTORIAL DE CAMBIOS (CambiosDeRegistro) CUELGA DE LAS CUENTAS (FK ActorId). Quien ya usó la demo
-- (editó una edición, un Festival) dejó filas con una cuenta demo como actor, y sin esto el borrado de
-- las cuentas fallaba con la Msg 547 FK_CambiosDeRegistro_Usuarios. Se retira lo de los registros
-- sembrados y lo de las organizaciones demo; lo que quede de OTRO origen conserva su fila y solo pierde
-- el vínculo con la cuenta (ActorNombre y ActorRol, que viajan escritos, no se tocan).
DELETE FROM dbo.CambiosDeRegistro
 WHERE EXISTS (SELECT 1 FROM @R r WHERE r.ModuloId = CambiosDeRegistro.ModuloId AND r.RegistroId = CambiosDeRegistro.RegistroId)
    OR OrganizacionId IN (SELECT Id FROM @O);
UPDATE dbo.CambiosDeRegistro SET ActorId = NULL WHERE ActorId IN (SELECT Id FROM @U);

-- Otras filas que cuelgan de las cuentas y no de un registro sembrado.
DELETE FROM dbo.RestablecimientosDeContrasena WHERE IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.EnviosDeRevision WHERE IdUsuarioRemitente IN (SELECT Id FROM @U);

-- Bitácora: la de los registros retirados y la de las cuentas (inicios de sesión de la demo).
DELETE FROM dbo.BitacoraAuditoria WHERE IdUsuario IN (SELECT Id FROM @U)
   OR (TablaAfectada IN (N'Festivales', N'EdicionesFestival', N'PerfilesPublicosFestival') AND (IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @F) OR IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @E)))
   -- Las propuestas de cambio se anotan en la tabla del Festival con el número de la propuesta.
   OR (TablaAfectada = N'Festivales' AND IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @Prop)
       AND (ValoresNuevos LIKE N'%FestivalPropuesta%' OR ValoresNuevos LIKE N'%FestivalCambioPropuesto%'))
   OR (TablaAfectada IN (N'Mercados', N'EdicionesMercado') AND (IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @M) OR IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @EM)))
   OR (TablaAfectada = N'EventosAgenda' AND IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @Ev))
   OR (TablaAfectada = N'Noticias' AND IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @N))
   OR (TablaAfectada = N'PublicacionesEditoriales' AND IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @P))
   OR (TablaAfectada IN (N'Entidades', N'InvitacionesDeOrganizacion', N'UsuariosEntidades') AND IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @O))
   OR (TablaAfectada = N'PerfilesPublicos' AND IdRegistroAfectado IN (SELECT CAST(Id AS nvarchar(120)) FROM @U));

-- Archivos del Banco: los de la siembra y los que subieron las cuentas u organizaciones de la
-- demostración. Antes que las organizaciones, que los referencian como procedencia.
UPDATE dbo.Entidades SET ArchivoFotoId = NULL WHERE IdEntidad IN (SELECT Id FROM @O);
DELETE FROM dbo.Archivos WHERE IdArchivo IN (SELECT Id FROM @A) OR IdUsuarioCarga IN (SELECT Id FROM @U) OR OrganizacionId IN (SELECT Id FROM @O);

DELETE FROM dbo.Entidades WHERE IdEntidad IN (SELECT Id FROM @O);

-- Cuentas.
DELETE FROM dbo.ConfirmacionesDeCorreo WHERE IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.UsuariosCodigosVerificacion WHERE IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.ModulosPorCuenta WHERE IdUsuario IN (SELECT Id FROM @U);
DELETE FROM dbo.UsuariosRoles WHERE IdUsuario IN (SELECT Id FROM @U);
-- RED DE SEGURIDAD: toda columna que apunte a Usuarios y que aún referencie una cuenta demo. Si admite
-- nulos se deja en NULL (quién moderó, quién otorgó, quién decidió); si no, la siembra se detiene y dice
-- cuál es, en vez de borrar datos de otro origen. Así una tabla nueva con FK a Usuarios no rompe la
-- repetición con una Msg 547 sin explicación.
SELECT Id INTO #CuentasDemo FROM @U;
DECLARE @Rastro nvarchar(max) = N'';
DECLARE @Ajuste nvarchar(max) = N'';
SELECT @Ajuste = @Ajuste
   + CASE WHEN col.is_nullable = 1
          THEN N'UPDATE ' + QUOTENAME(SCHEMA_NAME(tab.schema_id)) + N'.' + QUOTENAME(tab.name) + N' SET ' + QUOTENAME(col.name)
               + N' = NULL WHERE ' + QUOTENAME(col.name) + N' IN (SELECT Id FROM #CuentasDemo);' + CHAR(10)
          ELSE N'IF EXISTS (SELECT 1 FROM ' + QUOTENAME(SCHEMA_NAME(tab.schema_id)) + N'.' + QUOTENAME(tab.name) + N' WHERE '
               + QUOTENAME(col.name) + N' IN (SELECT Id FROM #CuentasDemo)) SET @Rastro = @Rastro + N'' '
               + REPLACE(tab.name + N'.' + col.name, N'''', N'''''') + N''';' + CHAR(10)
     END
FROM sys.foreign_key_columns fkc
JOIN sys.tables tab ON tab.object_id = fkc.parent_object_id
JOIN sys.columns col ON col.object_id = fkc.parent_object_id AND col.column_id = fkc.parent_column_id
WHERE fkc.referenced_object_id = OBJECT_ID(N'dbo.Usuarios') AND tab.name <> N'Usuarios';
EXEC sys.sp_executesql @Ajuste, N'@Rastro nvarchar(max) OUTPUT', @Rastro = @Rastro OUTPUT;
IF LEN(@Rastro) > 0
BEGIN
    DECLARE @Mensaje nvarchar(2000) = N'Quedan registros de OTRO origen que referencian cuentas de la demostración en:' + @Rastro
        + N'. No se borran. Para empezar de cero usa ./scripts/demo/reconstruir-demo-local.sh.';
    RAISERROR(@Mensaje, 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

DELETE FROM dbo.Usuarios WHERE IdUsuario IN (SELECT Id FROM @U);

COMMIT TRANSACTION;
