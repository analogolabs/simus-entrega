/*
  SIMUS · Espacios para música en vivo: el espacio, como proceso del Ecosistema (docs/referencia/25-modulos-restantes.md)

  QUE ES. Un espacio para música en vivo es el lugar —un bar, una sala, un auditorio, una casa de
  cultura, un escenario al aire libre— donde se presenta música en directo. Es un proceso del
  Ecosistema al mismo nivel que un Festival, un Mercado o un taller de lutería: tiene su tabla, su
  ciclo de vida y su revisión. Lo que ocurre DENTRO del espacio (un concierto, un ciclo, una jam) se
  anuncia como un evento de la Agenda, sin subregistro propio: decidido por la dirección el 10 de
  noviembre de 2026. El nombre público es «Espacios para música en vivo»; el inventario interno
  lo llamaba «Escenarios».

  DOS DIFERENCIAS CON MERCADOS, y las dos son decisiones de la dirección:

  1. EL RESPONSABLE PUEDE SER UNA PERSONA. Un responsable independiente registra su espacio con su
     cuenta individual, sin organización. Por eso `OrganizacionPrincipalId` es anulable y existe
     `UsuarioResponsableId`, y un CHECK exige EXACTAMENTE uno de los dos: ni un espacio sin dueño ni
     un espacio con dos. La guarda de acceso lo comprueba en el servidor (el CHECK no puede decir
     «esta persona administra esa organización»).
  2. NO HAY EDICIONES NI SUBREGISTROS. Los procesos del espacio son eventos de la Agenda.

  LOS VOCABULARIOS NACEN COMO «PROPUESTOS». Los tipos de espacio y el equipamiento son listas cortas
  propuestas por el equipo técnico: la aprobación es del Plan Nacional de Música para la Convivencia.
  Se pueden elegir desde el primer día (si no, el formulario estaría vacío), pero llevan
  `EstadoAprobacion = 'propuesto'` hasta que la dirección los apruebe.

  LO QUE SE DECIDIO CON LA REGLA MAS CONSERVADORA (preguntas en el PR): el aforo es un número
  opcional; la accesibilidad es un dato de tres estados (sí, no o no consta) más el texto libre del horario y la programación; el
  espacio está siempre en un municipio (el CHECK de cobertura lo permite todo, pero el servidor
  exige «municipal»).

  SIN CASCADAS, como todo el proyecto. ES ADITIVA: no toca ninguna tabla existente.
*/

-- ── Vocabularios propios ────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'TiposDeEspacio' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.TiposDeEspacio (
        IdTipoEspacio int IDENTITY(1,1) NOT NULL,
        NombreTipo nvarchar(120) NOT NULL,
        Slug nvarchar(120) NOT NULL,
        EstadoAprobacion nvarchar(20) NOT NULL CONSTRAINT DF_TiposDeEspacio_Aprobacion DEFAULT (N'propuesto'),
        Fuente nvarchar(120) NULL,
        Activo bit NOT NULL CONSTRAINT DF_TiposDeEspacio_Activo DEFAULT (1),
        OrdenVisualizacion int NOT NULL CONSTRAINT DF_TiposDeEspacio_Orden DEFAULT (0),
        CONSTRAINT PK_TiposDeEspacio PRIMARY KEY (IdTipoEspacio),
        CONSTRAINT UQ_TiposDeEspacio_Slug UNIQUE (Slug),
        CONSTRAINT CK_TiposDeEspacio_Aprobacion CHECK (EstadoAprobacion IN (N'propuesto', N'aprobado'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'EquipamientoDeEspacio' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.EquipamientoDeEspacio (
        IdEquipamientoEspacio int IDENTITY(1,1) NOT NULL,
        NombreEquipamiento nvarchar(120) NOT NULL,
        Slug nvarchar(120) NOT NULL,
        EstadoAprobacion nvarchar(20) NOT NULL CONSTRAINT DF_EquipamientoDeEspacio_Aprobacion DEFAULT (N'propuesto'),
        Fuente nvarchar(120) NULL,
        Activo bit NOT NULL CONSTRAINT DF_EquipamientoDeEspacio_Activo DEFAULT (1),
        OrdenVisualizacion int NOT NULL CONSTRAINT DF_EquipamientoDeEspacio_Orden DEFAULT (0),
        CONSTRAINT PK_EquipamientoDeEspacio PRIMARY KEY (IdEquipamientoEspacio),
        CONSTRAINT UQ_EquipamientoDeEspacio_Slug UNIQUE (Slug),
        CONSTRAINT CK_EquipamientoDeEspacio_Aprobacion CHECK (EstadoAprobacion IN (N'propuesto', N'aprobado'))
    );
END;

-- ── El espacio ───────────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'Espacios' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.Espacios (
        IdEspacio int IDENTITY(1,1) NOT NULL,
        NombreEspacio nvarchar(240) NOT NULL,
        Descripcion nvarchar(max) NULL,

        -- Cómo es el lugar: cerrado, al aire libre o mixto. Una lista, no texto libre.
        Ambiente nvarchar(20) NOT NULL CONSTRAINT DF_Espacios_Ambiente DEFAULT (N'cerrado'),
        -- Cuántas personas caben. Opcional: no todos los espacios lo saben con exactitud.
        AforoMaximo int NULL,
        -- DE TRES ESTADOS A PROPOSITO: 1 = accesible para personas con movilidad reducida, 0 = no lo es y NULL =
        -- no consta. Un `bit NOT NULL` afirmaría que ningún espacio es accesible por el solo hecho de no decirlo.
        EsAccesible bit NULL,
        -- Texto libre a propósito: horarios, días de programación y condiciones de acceso.
        HorarioYProgramacion nvarchar(2000) NULL,

        -- Contacto propio del espacio. El de la organización vive en la organización.
        CorreoEspacio nvarchar(180) NULL,
        TelefonoEspacio nvarchar(80) NULL,
        SitioWebEspacio nvarchar(500) NULL,
        InstagramEspacio nvarchar(500) NULL,
        FacebookEspacio nvarchar(500) NULL,
        OtroEnlaceEspacio nvarchar(500) NULL,

        -- Territorio: las mismas dos claves DIVIPOLA y el mismo CHECK que un festival o un mercado.
        NivelCobertura nvarchar(40) NOT NULL,
        CodigoDepartamento char(2) NULL,
        CodigoMunicipio char(5) NULL,
        -- La dirección o la referencia del lugar (calle, vereda, nombre del sitio).
        LugarEspecifico nvarchar(300) NULL,

        /*
          EL RESPONSABLE: UNA ORGANIZACION O UNA PERSONA, NUNCA LAS DOS NI NINGUNA.
          `OrganizacionPrincipalId` es la misma columna que en Mercados; `UsuarioResponsableId` es el
          responsable independiente. El CHECK `CK_Espacios_UnSoloResponsable` las ata.
        */
        OrganizacionPrincipalId int NULL,
        UsuarioResponsableId int NULL,

        -- Ciclo de vida y auditoría, como en cualquier proceso del Ecosistema.
        EstadoRegistro nvarchar(80) NOT NULL CONSTRAINT DF_Espacios_EstadoRegistro DEFAULT (N'borrador'),
        -- Lo que dijo el Programa al pedir ajustes, rechazar o retirar; se conserva para la ficha.
        MotivoDeLaDecision nvarchar(1200) NULL,
        Activo bit NOT NULL CONSTRAINT DF_Espacios_Activo DEFAULT (1),
        IdUsuarioCreador int NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_Espacios_FechaCreacion DEFAULT (SYSUTCDATETIME()),
        FechaActualizacion datetime2(0) NULL,
        FechaEnvioARevision datetime2(0) NULL,
        FechaPublicacion datetime2(0) NULL,
        FechaArchivado datetime2(0) NULL,

        CONSTRAINT PK_Espacios PRIMARY KEY (IdEspacio),
        CONSTRAINT FK_Espacios_Organizacion FOREIGN KEY (OrganizacionPrincipalId) REFERENCES dbo.Entidades(IdEntidad),
        CONSTRAINT FK_Espacios_UsuarioResponsable FOREIGN KEY (UsuarioResponsableId) REFERENCES dbo.Usuarios(IdUsuario),
        CONSTRAINT CK_Espacios_UnSoloResponsable CHECK (
            (OrganizacionPrincipalId IS NOT NULL AND UsuarioResponsableId IS NULL)
            OR (OrganizacionPrincipalId IS NULL AND UsuarioResponsableId IS NOT NULL)
        ),
        CONSTRAINT CK_Espacios_Ambiente CHECK (Ambiente IN (N'cerrado', N'abierto', N'mixto')),
        CONSTRAINT CK_Espacios_Aforo CHECK (AforoMaximo IS NULL OR AforoMaximo > 0),
        CONSTRAINT CK_Espacios_NivelCobertura CHECK (
            NivelCobertura IN (N'nacional', N'departamental', N'municipal')
            AND (
                (NivelCobertura = N'nacional' AND CodigoDepartamento IS NULL AND CodigoMunicipio IS NULL)
                OR (NivelCobertura = N'departamental' AND CodigoDepartamento IS NOT NULL AND CodigoMunicipio IS NULL)
                OR (NivelCobertura = N'municipal' AND CodigoDepartamento IS NOT NULL AND CodigoMunicipio IS NOT NULL)
            )
        ),
        CONSTRAINT CK_Espacios_EstadoRegistro CHECK (
            EstadoRegistro IN (N'borrador', N'en_revision', N'ajustes_solicitados', N'publicado', N'archivado', N'rechazado')
        )
    );

    CREATE INDEX IX_Espacios_Organizacion_Estado ON dbo.Espacios (OrganizacionPrincipalId, EstadoRegistro);
    CREATE INDEX IX_Espacios_Usuario_Estado ON dbo.Espacios (UsuarioResponsableId, EstadoRegistro);
    CREATE INDEX IX_Espacios_Territorio ON dbo.Espacios (CodigoDepartamento, CodigoMunicipio);
END;

-- ── Los tipos de lugar, el equipamiento y la música que programa ─────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'EspaciosEquipamiento' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.EspaciosEquipamiento (
        IdEspacioEquipamiento int IDENTITY(1,1) NOT NULL,
        EspacioId int NOT NULL,
        EquipamientoEspacioId int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_EspaciosEquipamiento_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_EspaciosEquipamiento PRIMARY KEY (IdEspacioEquipamiento),
        CONSTRAINT UQ_EspaciosEquipamiento_Par UNIQUE (EspacioId, EquipamientoEspacioId),
        CONSTRAINT FK_EspaciosEquipamiento_Espacio FOREIGN KEY (EspacioId) REFERENCES dbo.Espacios(IdEspacio),
        CONSTRAINT FK_EspaciosEquipamiento_Equipamiento FOREIGN KEY (EquipamientoEspacioId) REFERENCES dbo.EquipamientoDeEspacio(IdEquipamientoEspacio)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'EspaciosTipos' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.EspaciosTipos (
        IdEspacioTipo int IDENTITY(1,1) NOT NULL,
        EspacioId int NOT NULL,
        TipoEspacioId int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_EspaciosTipos_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_EspaciosTipos PRIMARY KEY (IdEspacioTipo),
        CONSTRAINT UQ_EspaciosTipos_Par UNIQUE (EspacioId, TipoEspacioId),
        CONSTRAINT FK_EspaciosTipos_Espacio FOREIGN KEY (EspacioId) REFERENCES dbo.Espacios(IdEspacio),
        CONSTRAINT FK_EspaciosTipos_Tipo FOREIGN KEY (TipoEspacioId) REFERENCES dbo.TiposDeEspacio(IdTipoEspacio)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'EspaciosPracticasMusicales' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE TABLE dbo.EspaciosPracticasMusicales (
        IdEspacioPracticaMusical int IDENTITY(1,1) NOT NULL,
        EspacioId int NOT NULL,
        PracticaMusicalId int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_EspaciosPracticas_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_EspaciosPracticasMusicales PRIMARY KEY (IdEspacioPracticaMusical),
        CONSTRAINT UQ_EspaciosPracticas_Par UNIQUE (EspacioId, PracticaMusicalId),
        CONSTRAINT FK_EspaciosPracticas_Espacio FOREIGN KEY (EspacioId) REFERENCES dbo.Espacios(IdEspacio),
        CONSTRAINT FK_EspaciosPracticas_Practica FOREIGN KEY (PracticaMusicalId) REFERENCES dbo.PracticasMusicales(IdPracticaMusical)
    );
END;

-- ── El territorio apunta a DIVIPOLA, como todo lo demás ─────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Espacios_Divipola')
BEGIN
    ALTER TABLE dbo.Espacios ADD CONSTRAINT FK_Espacios_Divipola
        FOREIGN KEY (CodigoDepartamento, CodigoMunicipio)
        REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
END;

-- ── El módulo nuevo, para las cuentas de consola que ya existen ─────────────────────────────────

/*
  Como con Mercados, las cuentas de webmaster y de gestor que ya existen conservan todos los
  módulos: un módulo nuevo hay que concedérselo explícitamente. Después se desactiva a mano.
*/
INSERT INTO dbo.ModulosPorCuenta (IdUsuario, CodigoModulo, FechaOtorgado)
SELECT u.IdUsuario, N'espacios', SYSUTCDATETIME()
FROM dbo.Usuarios u
WHERE EXISTS (
        SELECT 1 FROM dbo.UsuariosRoles ur
        JOIN dbo.Roles r ON r.IdRol = ur.IdRol
        WHERE ur.IdUsuario = u.IdUsuario AND r.NombreRol IN (N'webmaster', N'gestor_interno')
      )
  AND NOT EXISTS (
        SELECT 1 FROM dbo.ModulosPorCuenta m
        WHERE m.IdUsuario = u.IdUsuario AND m.CodigoModulo = N'espacios'
      );
