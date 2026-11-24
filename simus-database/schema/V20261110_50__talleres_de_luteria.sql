/*
  SIMUS · Lutería: el taller, como proceso del Ecosistema (#55, docs/referencia/25-modulos-restantes.md, docs/referencia/27-fuentes-de-luteria.md)

  QUE ES. Un taller de lutería es el lugar —fijo, itinerante o colectivo— donde se construyen,
  reparan, restauran o enseñan a hacer instrumentos musicales. Es un proceso del Ecosistema al
  mismo nivel que un Festival o un Mercado: tiene su tabla, su ciclo de vida y su revisión. Lo que
  ocurre DENTRO del taller (una jornada de construcción, una clase, una venta) se anuncia como un
  evento de la Agenda, sin subregistro propio: decidido por la dirección el 10 de noviembre de 2026.

  DOS DIFERENCIAS CON MERCADOS, y las dos son decisiones de la dirección:

  1. EL RESPONSABLE PUEDE SER UNA PERSONA. Un lutier independiente registra su taller con su
     cuenta individual, sin organización. Por eso `OrganizacionPrincipalId` es anulable y existe
     `UsuarioResponsableId`, y un CHECK exige EXACTAMENTE uno de los dos: ni un taller sin dueño ni
     un taller con dos. La guarda de acceso lo comprueba en el servidor (el CHECK no puede decir
     «esta persona administra esa organización»).
  2. NO HAY EDICIONES NI SUBREGISTROS. Los procesos del taller son eventos de la Agenda.

  LO QUE NO SE GUARDA, A PROPOSITO. No hay campo de origen de la madera ni de validación de saberes:
  la dirección fijó que el origen legal de la madera no es un requisito y que nadie «valida» los
  saberes, que son texto libre (`SaberesYTecnicas`) hasta que haya datos reales con los que construir
  un vocabulario (docs/referencia/27-fuentes-de-luteria.md §27.4).

  LOS VOCABULARIOS NACEN COMO «PROPUESTOS». Ninguno de los valores de docs/referencia/27-fuentes-de-luteria.md está verificado en una
  fuente abierta; la aprobación es del Plan Nacional de Música para la Convivencia. Se pueden elegir
  desde el primer día (si no, el formulario estaría vacío), pero llevan `EstadoAprobacion =
  'propuesto'` hasta que la dirección los apruebe.

  SIN CASCADAS, como todo el proyecto. ES ADITIVA: no toca ninguna tabla existente.
*/

-- ── Vocabularios propios ────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'FamiliasDeInstrumentos' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.FamiliasDeInstrumentos (
        IdFamiliaInstrumento int IDENTITY(1,1) NOT NULL,
        NombreFamilia nvarchar(120) NOT NULL,
        Slug nvarchar(120) NOT NULL,
        -- Subnivel opcional (cordófonos frotados y pulsados): apunta a su familia de primer nivel.
        FamiliaPadreId int NULL,
        EstadoAprobacion nvarchar(20) NOT NULL CONSTRAINT DF_FamiliasDeInstrumentos_Aprobacion DEFAULT (N'propuesto'),
        Fuente nvarchar(120) NULL,
        Activo bit NOT NULL CONSTRAINT DF_FamiliasDeInstrumentos_Activo DEFAULT (1),
        OrdenVisualizacion int NOT NULL CONSTRAINT DF_FamiliasDeInstrumentos_Orden DEFAULT (0),
        CONSTRAINT PK_FamiliasDeInstrumentos PRIMARY KEY (IdFamiliaInstrumento),
        CONSTRAINT UQ_FamiliasDeInstrumentos_Slug UNIQUE (Slug),
        CONSTRAINT FK_FamiliasDeInstrumentos_Padre FOREIGN KEY (FamiliaPadreId) REFERENCES dbo.FamiliasDeInstrumentos(IdFamiliaInstrumento),
        CONSTRAINT CK_FamiliasDeInstrumentos_Aprobacion CHECK (EstadoAprobacion IN (N'propuesto', N'aprobado'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'ServiciosDeTaller' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.ServiciosDeTaller (
        IdServicioTaller int IDENTITY(1,1) NOT NULL,
        NombreServicio nvarchar(120) NOT NULL,
        Slug nvarchar(120) NOT NULL,
        EstadoAprobacion nvarchar(20) NOT NULL CONSTRAINT DF_ServiciosDeTaller_Aprobacion DEFAULT (N'propuesto'),
        Fuente nvarchar(120) NULL,
        Activo bit NOT NULL CONSTRAINT DF_ServiciosDeTaller_Activo DEFAULT (1),
        OrdenVisualizacion int NOT NULL CONSTRAINT DF_ServiciosDeTaller_Orden DEFAULT (0),
        CONSTRAINT PK_ServiciosDeTaller PRIMARY KEY (IdServicioTaller),
        CONSTRAINT UQ_ServiciosDeTaller_Slug UNIQUE (Slug),
        CONSTRAINT CK_ServiciosDeTaller_Aprobacion CHECK (EstadoAprobacion IN (N'propuesto', N'aprobado'))
    );
END;

-- ── El taller ───────────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'Talleres' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.Talleres (
        IdTaller int IDENTITY(1,1) NOT NULL,
        NombreTaller nvarchar(240) NOT NULL,
        Descripcion nvarchar(max) NULL,

        -- Cómo trabaja: taller fijo, itinerante o colectivo. Una lista, no texto libre.
        Modalidad nvarchar(20) NOT NULL CONSTRAINT DF_Talleres_Modalidad DEFAULT (N'fijo'),
        RecibeAprendices bit NOT NULL CONSTRAINT DF_Talleres_Aprendices DEFAULT (0),
        -- Texto libre a propósito: no hay fuente oficial de saberes y técnicas (docs/referencia/27-fuentes-de-luteria.md §27.4).
        SaberesYTecnicas nvarchar(2000) NULL,

        -- Contacto propio del taller. El de la organización vive en la organización.
        CorreoTaller nvarchar(180) NULL,
        TelefonoTaller nvarchar(80) NULL,
        SitioWebTaller nvarchar(500) NULL,
        InstagramTaller nvarchar(500) NULL,
        FacebookTaller nvarchar(500) NULL,
        OtroEnlaceTaller nvarchar(500) NULL,

        -- Territorio: las mismas dos claves DIVIPOLA y el mismo CHECK que un festival o un mercado.
        NivelCobertura nvarchar(40) NOT NULL,
        CodigoDepartamento char(2) NULL,
        CodigoMunicipio char(5) NULL,
        LugarEspecifico nvarchar(300) NULL,

        /*
          EL RESPONSABLE: UNA ORGANIZACION O UNA PERSONA, NUNCA LAS DOS NI NINGUNA.
          `OrganizacionPrincipalId` es la misma columna que en Mercados; `UsuarioResponsableId` es el
          lutier independiente. El CHECK `CK_Talleres_UnSoloResponsable` las ata.
        */
        OrganizacionPrincipalId int NULL,
        UsuarioResponsableId int NULL,

        -- Ciclo de vida y auditoría, como en cualquier proceso del Ecosistema.
        EstadoRegistro nvarchar(80) NOT NULL CONSTRAINT DF_Talleres_EstadoRegistro DEFAULT (N'borrador'),
        -- Lo que dijo el Programa al pedir ajustes, rechazar o retirar; se conserva para la ficha.
        MotivoDeLaDecision nvarchar(1200) NULL,
        Activo bit NOT NULL CONSTRAINT DF_Talleres_Activo DEFAULT (1),
        IdUsuarioCreador int NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_Talleres_FechaCreacion DEFAULT (SYSUTCDATETIME()),
        FechaActualizacion datetime2(0) NULL,
        FechaEnvioARevision datetime2(0) NULL,
        FechaPublicacion datetime2(0) NULL,
        FechaArchivado datetime2(0) NULL,

        CONSTRAINT PK_Talleres PRIMARY KEY (IdTaller),
        CONSTRAINT FK_Talleres_Organizacion FOREIGN KEY (OrganizacionPrincipalId) REFERENCES dbo.Entidades(IdEntidad),
        CONSTRAINT FK_Talleres_UsuarioResponsable FOREIGN KEY (UsuarioResponsableId) REFERENCES dbo.Usuarios(IdUsuario),
        CONSTRAINT CK_Talleres_UnSoloResponsable CHECK (
            (OrganizacionPrincipalId IS NOT NULL AND UsuarioResponsableId IS NULL)
            OR (OrganizacionPrincipalId IS NULL AND UsuarioResponsableId IS NOT NULL)
        ),
        CONSTRAINT CK_Talleres_Modalidad CHECK (Modalidad IN (N'fijo', N'itinerante', N'colectivo')),
        CONSTRAINT CK_Talleres_NivelCobertura CHECK (
            NivelCobertura IN (N'nacional', N'departamental', N'municipal')
            AND (
                (NivelCobertura = N'nacional' AND CodigoDepartamento IS NULL AND CodigoMunicipio IS NULL)
                OR (NivelCobertura = N'departamental' AND CodigoDepartamento IS NOT NULL AND CodigoMunicipio IS NULL)
                OR (NivelCobertura = N'municipal' AND CodigoDepartamento IS NOT NULL AND CodigoMunicipio IS NOT NULL)
            )
        ),
        CONSTRAINT CK_Talleres_EstadoRegistro CHECK (
            EstadoRegistro IN (N'borrador', N'en_revision', N'ajustes_solicitados', N'publicado', N'archivado', N'rechazado')
        )
    );

    CREATE INDEX IX_Talleres_Organizacion_Estado ON dbo.Talleres (OrganizacionPrincipalId, EstadoRegistro);
    CREATE INDEX IX_Talleres_Usuario_Estado ON dbo.Talleres (UsuarioResponsableId, EstadoRegistro);
    CREATE INDEX IX_Talleres_Territorio ON dbo.Talleres (CodigoDepartamento, CodigoMunicipio);
END;

-- ── Lo que el taller ofrece y los instrumentos con los que trabaja ──────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'TalleresServicios' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.TalleresServicios (
        IdTallerServicio int IDENTITY(1,1) NOT NULL,
        TallerId int NOT NULL,
        ServicioTallerId int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_TalleresServicios_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_TalleresServicios PRIMARY KEY (IdTallerServicio),
        CONSTRAINT UQ_TalleresServicios_Par UNIQUE (TallerId, ServicioTallerId),
        CONSTRAINT FK_TalleresServicios_Taller FOREIGN KEY (TallerId) REFERENCES dbo.Talleres(IdTaller),
        CONSTRAINT FK_TalleresServicios_Servicio FOREIGN KEY (ServicioTallerId) REFERENCES dbo.ServiciosDeTaller(IdServicioTaller)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'TalleresFamiliasDeInstrumentos' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.TalleresFamiliasDeInstrumentos (
        IdTallerFamilia int IDENTITY(1,1) NOT NULL,
        TallerId int NOT NULL,
        FamiliaInstrumentoId int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_TalleresFamilias_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_TalleresFamiliasDeInstrumentos PRIMARY KEY (IdTallerFamilia),
        CONSTRAINT UQ_TalleresFamilias_Par UNIQUE (TallerId, FamiliaInstrumentoId),
        CONSTRAINT FK_TalleresFamilias_Taller FOREIGN KEY (TallerId) REFERENCES dbo.Talleres(IdTaller),
        CONSTRAINT FK_TalleresFamilias_Familia FOREIGN KEY (FamiliaInstrumentoId) REFERENCES dbo.FamiliasDeInstrumentos(IdFamiliaInstrumento)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'TalleresPracticasMusicales' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.TalleresPracticasMusicales (
        IdTallerPracticaMusical int IDENTITY(1,1) NOT NULL,
        TallerId int NOT NULL,
        PracticaMusicalId int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_TalleresPracticas_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_TalleresPracticasMusicales PRIMARY KEY (IdTallerPracticaMusical),
        CONSTRAINT UQ_TalleresPracticas_Par UNIQUE (TallerId, PracticaMusicalId),
        CONSTRAINT FK_TalleresPracticas_Taller FOREIGN KEY (TallerId) REFERENCES dbo.Talleres(IdTaller),
        CONSTRAINT FK_TalleresPracticas_Practica FOREIGN KEY (PracticaMusicalId) REFERENCES dbo.PracticasMusicales(IdPracticaMusical)
    );
END;

-- ── El territorio apunta a DIVIPOLA, como todo lo demás ─────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Talleres_Divipola')
BEGIN
    ALTER TABLE dbo.Talleres ADD CONSTRAINT FK_Talleres_Divipola
        FOREIGN KEY (CodigoDepartamento, CodigoMunicipio)
        REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
END;

-- ── El módulo nuevo, para las cuentas de consola que ya existen ─────────────────────────────────

/*
  Como con Mercados, las cuentas de webmaster y de gestor que ya existen conservan todos los
  módulos: un módulo nuevo hay que concedérselo explícitamente. Después se desactiva a mano.
*/
INSERT INTO dbo.ModulosPorCuenta (IdUsuario, CodigoModulo, FechaOtorgado)
SELECT u.IdUsuario, N'talleres', SYSUTCDATETIME()
FROM dbo.Usuarios u
WHERE EXISTS (
        SELECT 1 FROM dbo.UsuariosRoles ur
        JOIN dbo.Roles r ON r.IdRol = ur.IdRol
        WHERE ur.IdUsuario = u.IdUsuario AND r.NombreRol IN (N'webmaster', N'gestor_interno')
      )
  AND NOT EXISTS (
        SELECT 1 FROM dbo.ModulosPorCuenta m
        WHERE m.IdUsuario = u.IdUsuario AND m.CodigoModulo = N'talleres'
      );
