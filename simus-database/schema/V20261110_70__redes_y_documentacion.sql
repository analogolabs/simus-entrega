/*
  SIMUS · Redes y documentación: la red o el centro de documentación, como proceso del Ecosistema
  (#56, docs/referencia/25-modulos-restantes.md §25.4)

  QUE ES. Una red o un centro de documentación es un nodo de investigación, archivo y documentación
  musical: una red de investigadores, un archivo sonoro, un centro de documentación, una colección o
  un grupo de investigación. Es un proceso del Ecosistema al mismo nivel que un Festival, un Mercado
  o un taller de lutería: tiene su tabla, su ciclo de vida y su revisión. Lo que ocurre alrededor
  —una jornada de consulta, un conversatorio, la presentación de un acervo— se anuncia como un
  evento de la Agenda, sin subregistro propio.

  DECISIONES DE LA DIRECCION (10 de noviembre de 2026):
  - Es un MODULO PROPIO, no un tipo de organización con ficha ampliada.
  - Sus procesos no pasan por revisión institucional; sí el registro de la red, con el mismo ciclo
    que un Festival, un Mercado o un taller (borrador → en revisión → ajustes solicitados →
    publicado / rechazado; archivado al retirarlo).
  - Escuelas de música queda fuera.

  UNA DECISION MIA, LA MAS CONSERVADORA, y queda como pregunta en el PR: el responsable puede ser una
  ORGANIZACION o una PERSONA, igual que en Lutería. Un investigador que mantiene un archivo propio
  puede registrarlo con su cuenta individual. Por eso `OrganizacionPrincipalId` es anulable y existe
  `UsuarioResponsableId`, y un CHECK exige EXACTAMENTE uno de los dos: ni una red sin responsable ni
  una red con dos. La guarda de acceso lo comprueba en el servidor (el CHECK no puede decir «esta
  persona administra esa organización»).

  LO QUE NO SE GUARDA, A PROPOSITO. No se duplica el Catálogo Editorial: una red dice QUE acervos
  tiene y COMO se consultan, no cataloga cada documento. Los acervos son texto libre
  (`AcervosYColecciones`) hasta que haya datos reales con los que construir un vocabulario.

  LOS VOCABULARIOS NACEN COMO «PROPUESTOS». Las formas de acceso y los formatos son una propuesta
  técnica (docs/referencia/25-modulos-restantes.md §25.4): no vienen de una fuente oficial. Se pueden elegir desde el primer día
  —si no, el formulario estaría vacío— y llevan `EstadoAprobacion = 'propuesto'` hasta que la
  dirección del sistema, el Plan Nacional de Música para la Convivencia, los apruebe.

  SIN CASCADAS, como todo el proyecto. ES ADITIVA: no toca ninguna tabla existente.
*/

-- ── Vocabularios propios ────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'FormatosDeDocumentacion' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.FormatosDeDocumentacion (
        IdFormato int IDENTITY(1,1) NOT NULL,
        NombreFormato nvarchar(120) NOT NULL,
        Slug nvarchar(120) NOT NULL,
        -- Subnivel opcional (por ejemplo, partituras dentro de impresos): apunta a su formato de primer nivel.
        FormatoPadreId int NULL,
        EstadoAprobacion nvarchar(20) NOT NULL CONSTRAINT DF_FormatosDeDocumentacion_Aprobacion DEFAULT (N'propuesto'),
        Fuente nvarchar(120) NULL,
        Activo bit NOT NULL CONSTRAINT DF_FormatosDeDocumentacion_Activo DEFAULT (1),
        OrdenVisualizacion int NOT NULL CONSTRAINT DF_FormatosDeDocumentacion_Orden DEFAULT (0),
        CONSTRAINT PK_FormatosDeDocumentacion PRIMARY KEY (IdFormato),
        CONSTRAINT UQ_FormatosDeDocumentacion_Slug UNIQUE (Slug),
        CONSTRAINT FK_FormatosDeDocumentacion_Padre FOREIGN KEY (FormatoPadreId) REFERENCES dbo.FormatosDeDocumentacion(IdFormato),
        CONSTRAINT CK_FormatosDeDocumentacion_Aprobacion CHECK (EstadoAprobacion IN (N'propuesto', N'aprobado'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'FormasDeAccesoDeRed' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.FormasDeAccesoDeRed (
        IdFormaDeAcceso int IDENTITY(1,1) NOT NULL,
        NombreFormaDeAcceso nvarchar(120) NOT NULL,
        Slug nvarchar(120) NOT NULL,
        EstadoAprobacion nvarchar(20) NOT NULL CONSTRAINT DF_FormasDeAccesoDeRed_Aprobacion DEFAULT (N'propuesto'),
        Fuente nvarchar(120) NULL,
        Activo bit NOT NULL CONSTRAINT DF_FormasDeAccesoDeRed_Activo DEFAULT (1),
        OrdenVisualizacion int NOT NULL CONSTRAINT DF_FormasDeAccesoDeRed_Orden DEFAULT (0),
        CONSTRAINT PK_FormasDeAccesoDeRed PRIMARY KEY (IdFormaDeAcceso),
        CONSTRAINT UQ_FormasDeAccesoDeRed_Slug UNIQUE (Slug),
        CONSTRAINT CK_FormasDeAccesoDeRed_Aprobacion CHECK (EstadoAprobacion IN (N'propuesto', N'aprobado'))
    );
END;

-- ── La red ──────────────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'Redes' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.Redes (
        IdRed int IDENTITY(1,1) NOT NULL,
        NombreRed nvarchar(240) NOT NULL,
        Descripcion nvarchar(max) NULL,

        -- Qué clase de nodo es: una lista, no texto libre.
        TipoDeNodo nvarchar(40) NOT NULL CONSTRAINT DF_Redes_TipoDeNodo DEFAULT (N'red'),
        -- Si cualquier persona puede consultar el acervo sin una gestión previa.
        AccesoAbierto bit NOT NULL CONSTRAINT DF_Redes_AccesoAbierto DEFAULT (0),
        -- Texto libre a propósito: los acervos y colecciones no tienen un vocabulario común todavía.
        AcervosYColecciones nvarchar(2000) NULL,

        -- Contacto propio de la red. El de la organización vive en la organización.
        CorreoRed nvarchar(180) NULL,
        TelefonoRed nvarchar(80) NULL,
        SitioWebRed nvarchar(500) NULL,
        InstagramRed nvarchar(500) NULL,
        FacebookRed nvarchar(500) NULL,
        OtroEnlaceRed nvarchar(500) NULL,

        -- Territorio de referencia: las mismas dos claves DIVIPOLA y el mismo CHECK que un festival o un mercado.
        NivelCobertura nvarchar(40) NOT NULL,
        CodigoDepartamento char(2) NULL,
        CodigoMunicipio char(5) NULL,
        LugarEspecifico nvarchar(300) NULL,

        /*
          EL RESPONSABLE: UNA ORGANIZACION O UNA PERSONA, NUNCA LAS DOS NI NINGUNA.
          `OrganizacionPrincipalId` es la misma columna que en Mercados; `UsuarioResponsableId` es la
          persona que mantiene la red por su cuenta. El CHECK `CK_Redes_UnSoloResponsable` las ata.
        */
        OrganizacionPrincipalId int NULL,
        UsuarioResponsableId int NULL,

        -- Ciclo de vida y auditoría, como en cualquier proceso del Ecosistema.
        EstadoRegistro nvarchar(80) NOT NULL CONSTRAINT DF_Redes_EstadoRegistro DEFAULT (N'borrador'),
        -- Lo que dijo el Programa al pedir ajustes, rechazar o retirar; se conserva para la ficha.
        MotivoDeLaDecision nvarchar(1200) NULL,
        Activo bit NOT NULL CONSTRAINT DF_Redes_Activo DEFAULT (1),
        IdUsuarioCreador int NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_Redes_FechaCreacion DEFAULT (SYSUTCDATETIME()),
        FechaActualizacion datetime2(0) NULL,
        FechaEnvioARevision datetime2(0) NULL,
        FechaPublicacion datetime2(0) NULL,
        FechaArchivado datetime2(0) NULL,

        CONSTRAINT PK_Redes PRIMARY KEY (IdRed),
        CONSTRAINT FK_Redes_Organizacion FOREIGN KEY (OrganizacionPrincipalId) REFERENCES dbo.Entidades(IdEntidad),
        CONSTRAINT FK_Redes_UsuarioResponsable FOREIGN KEY (UsuarioResponsableId) REFERENCES dbo.Usuarios(IdUsuario),
        CONSTRAINT CK_Redes_UnSoloResponsable CHECK (
            (OrganizacionPrincipalId IS NOT NULL AND UsuarioResponsableId IS NULL)
            OR (OrganizacionPrincipalId IS NULL AND UsuarioResponsableId IS NOT NULL)
        ),
        CONSTRAINT CK_Redes_TipoDeNodo CHECK (
            TipoDeNodo IN (N'red', N'centro_de_documentacion', N'archivo', N'coleccion', N'grupo_de_investigacion')
        ),
        CONSTRAINT CK_Redes_NivelCobertura CHECK (
            NivelCobertura IN (N'nacional', N'departamental', N'municipal')
            AND (
                (NivelCobertura = N'nacional' AND CodigoDepartamento IS NULL AND CodigoMunicipio IS NULL)
                OR (NivelCobertura = N'departamental' AND CodigoDepartamento IS NOT NULL AND CodigoMunicipio IS NULL)
                OR (NivelCobertura = N'municipal' AND CodigoDepartamento IS NOT NULL AND CodigoMunicipio IS NOT NULL)
            )
        ),
        CONSTRAINT CK_Redes_EstadoRegistro CHECK (
            EstadoRegistro IN (N'borrador', N'en_revision', N'ajustes_solicitados', N'publicado', N'archivado', N'rechazado')
        )
    );

    CREATE INDEX IX_Redes_Organizacion_Estado ON dbo.Redes (OrganizacionPrincipalId, EstadoRegistro);
    CREATE INDEX IX_Redes_Usuario_Estado ON dbo.Redes (UsuarioResponsableId, EstadoRegistro);
    CREATE INDEX IX_Redes_Territorio ON dbo.Redes (CodigoDepartamento, CodigoMunicipio);
END;

-- ── Cómo se consulta la red y en qué formatos guarda su documentación ───────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'RedesFormasDeAcceso' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.RedesFormasDeAcceso (
        IdRedFormaDeAcceso int IDENTITY(1,1) NOT NULL,
        RedId int NOT NULL,
        FormaDeAccesoId int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_RedesFormasDeAcceso_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_RedesFormasDeAcceso PRIMARY KEY (IdRedFormaDeAcceso),
        CONSTRAINT UQ_RedesFormasDeAcceso_Par UNIQUE (RedId, FormaDeAccesoId),
        CONSTRAINT FK_RedesFormasDeAcceso_Red FOREIGN KEY (RedId) REFERENCES dbo.Redes(IdRed),
        CONSTRAINT FK_RedesFormasDeAcceso_FormaDeAcceso FOREIGN KEY (FormaDeAccesoId) REFERENCES dbo.FormasDeAccesoDeRed(IdFormaDeAcceso)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'RedesFormatos' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.RedesFormatos (
        IdRedFormato int IDENTITY(1,1) NOT NULL,
        RedId int NOT NULL,
        FormatoId int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_RedesFormatos_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_RedesFormatos PRIMARY KEY (IdRedFormato),
        CONSTRAINT UQ_RedesFormatos_Par UNIQUE (RedId, FormatoId),
        CONSTRAINT FK_RedesFormatos_Red FOREIGN KEY (RedId) REFERENCES dbo.Redes(IdRed),
        CONSTRAINT FK_RedesFormatos_Formato FOREIGN KEY (FormatoId) REFERENCES dbo.FormatosDeDocumentacion(IdFormato)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'RedesPracticasMusicales' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.RedesPracticasMusicales (
        IdRedPracticaMusical int IDENTITY(1,1) NOT NULL,
        RedId int NOT NULL,
        PracticaMusicalId int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_RedesPracticas_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_RedesPracticasMusicales PRIMARY KEY (IdRedPracticaMusical),
        CONSTRAINT UQ_RedesPracticas_Par UNIQUE (RedId, PracticaMusicalId),
        CONSTRAINT FK_RedesPracticas_Red FOREIGN KEY (RedId) REFERENCES dbo.Redes(IdRed),
        CONSTRAINT FK_RedesPracticas_Practica FOREIGN KEY (PracticaMusicalId) REFERENCES dbo.PracticasMusicales(IdPracticaMusical)
    );
END;

-- ── El territorio apunta a DIVIPOLA, como todo lo demás ─────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Redes_Divipola')
BEGIN
    ALTER TABLE dbo.Redes ADD CONSTRAINT FK_Redes_Divipola
        FOREIGN KEY (CodigoDepartamento, CodigoMunicipio)
        REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
END;

-- ── El módulo nuevo, para las cuentas de consola que ya existen ─────────────────────────────────

/*
  Como con Mercados y con los talleres, las cuentas de webmaster y de gestor que ya existen
  conservan todos los módulos: un módulo nuevo hay que concedérselo explícitamente. Después se
  desactiva a mano.
*/
INSERT INTO dbo.ModulosPorCuenta (IdUsuario, CodigoModulo, FechaOtorgado)
SELECT u.IdUsuario, N'redes', SYSUTCDATETIME()
FROM dbo.Usuarios u
WHERE EXISTS (
        SELECT 1 FROM dbo.UsuariosRoles ur
        JOIN dbo.Roles r ON r.IdRol = ur.IdRol
        WHERE ur.IdUsuario = u.IdUsuario AND r.NombreRol IN (N'webmaster', N'gestor_interno')
      )
  AND NOT EXISTS (
        SELECT 1 FROM dbo.ModulosPorCuenta m
        WHERE m.IdUsuario = u.IdUsuario AND m.CodigoModulo = N'redes'
      );
