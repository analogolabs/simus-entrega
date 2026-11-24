-- =============================================
-- Nombre del script: V20261105_06__perfil_publico_de_la_persona.sql
-- Descripcion: Perfil publico de la persona, activado por ella (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4-§19.5).
--              - Finalidad nueva `perfil_publico` en CK_PoliticasDatos_Clave y
--                CK_AutorizacionesDatos_Finalidad, con su texto vigente.
--              - Origen nuevo `cuenta` en CK_AutorizacionesDatos_Origen: la autorizacion se da
--                desde la pantalla de la cuenta, no en el registro ni en la portada.
--              - Tablas PerfilesPublicos, PerfilesPublicosPracticas y PerfilesPublicosEnlaces.
--              NO HAY BANDERA «PUBLICADO»: el perfil se ve solo mientras la autorizacion
--              `perfil_publico` esta vigente y la consola no lo oculto. Retirar la autorizacion lo
--              oculta en el acto porque no hay nada mas que apagar.
--              Nunca guarda correo, documento ni telefono: esos datos siguen en dbo.Usuarios.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-05
-- Version: 20261105.06 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

-- 1. La finalidad nueva -------------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_PoliticasDatos_Clave'
           AND definition NOT LIKE N'%perfil_publico%')
BEGIN
    ALTER TABLE dbo.PoliticasDatos DROP CONSTRAINT CK_PoliticasDatos_Clave;
    ALTER TABLE dbo.PoliticasDatos ADD CONSTRAINT CK_PoliticasDatos_Clave
        CHECK (Clave IN (N'tratamiento', N'terminos', N'boletin', N'perfil_publico'));
END;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AutorizacionesDatos_Finalidad'
           AND definition NOT LIKE N'%perfil_publico%')
BEGIN
    ALTER TABLE dbo.AutorizacionesDatos DROP CONSTRAINT CK_AutorizacionesDatos_Finalidad;
    ALTER TABLE dbo.AutorizacionesDatos ADD CONSTRAINT CK_AutorizacionesDatos_Finalidad
        CHECK (Finalidad IN (N'tratamiento', N'terminos', N'boletin', N'perfil_publico'));
END;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AutorizacionesDatos_Origen'
           AND definition NOT LIKE N'%cuenta%')
BEGIN
    ALTER TABLE dbo.AutorizacionesDatos DROP CONSTRAINT CK_AutorizacionesDatos_Origen;
    ALTER TABLE dbo.AutorizacionesDatos ADD CONSTRAINT CK_AutorizacionesDatos_Origen
        CHECK (Origen IN (N'registro', N'portada', N'noticias', N'consola', N'cuenta'));
END;

IF NOT EXISTS (SELECT 1 FROM dbo.PoliticasDatos WHERE Clave = N'perfil_publico' AND Version = N'2026-11-05')
BEGIN
    INSERT INTO dbo.PoliticasDatos (Clave, Version, Titulo, Texto, Vigente, FechaPublicacion)
    VALUES (
        N'perfil_publico',
        N'2026-11-05',
        N'Autorización para publicar mi perfil público',
        N'Autorizo al Ministerio de las Culturas, las Artes y los Saberes —responsable del tratamiento— a publicar en SIMUS, a la vista de cualquier persona, mi perfil público: el nombre visible que yo elija, mis prácticas musicales, mi municipio, la foto y los enlaces que yo añada, y las organizaciones activas de las que formo parte.

Mi correo, mi documento y mi teléfono no se publican nunca. Tampoco se publica mi rol dentro de cada organización.

Publicar mi perfil es voluntario. Conforme al artículo 8 de la Ley 1581 de 2012 puedo conocer, actualizar y rectificar estos datos, solicitar prueba de esta autorización y revocarla en cualquier momento desde mi cuenta: al revocarla, el perfil deja de verse en el acto.',
        1,
        SYSUTCDATETIME());
END;

-- 2. El perfil ------------------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.PerfilesPublicos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PerfilesPublicos
    (
        IdUsuario int NOT NULL,
        -- LA DIRECCION PUBLICA NO ES EL ID DE LA CUENTA: un entero consecutivo dejaria contar
        -- cuantas cuentas hay y probar una por una.
        ClavePublica uniqueidentifier NOT NULL CONSTRAINT DF_PerfilesPublicos_ClavePublica DEFAULT (NEWID()),
        NombreVisible nvarchar(120) NOT NULL,
        CodigoMunicipio nvarchar(10) NULL,
        ArchivoFotoId int NULL,
        OcultoPorModeracion bit NOT NULL CONSTRAINT DF_PerfilesPublicos_OcultoPorModeracion DEFAULT (0),
        MotivoModeracion nvarchar(500) NULL,
        FechaModeracion datetime2(0) NULL,
        IdUsuarioModera int NULL,
        FechaCreacion datetime2(0) NOT NULL,
        FechaActualizacion datetime2(0) NULL,
        CONSTRAINT PK_PerfilesPublicos PRIMARY KEY (IdUsuario),
        CONSTRAINT FK_PerfilesPublicos_Usuarios FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios (IdUsuario),
        CONSTRAINT FK_PerfilesPublicos_Foto FOREIGN KEY (ArchivoFotoId) REFERENCES dbo.Archivos (IdArchivo),
        CONSTRAINT FK_PerfilesPublicos_Modera FOREIGN KEY (IdUsuarioModera) REFERENCES dbo.Usuarios (IdUsuario),
        -- OCULTAR POR MODERACION EXIGE MOTIVO: sin el, la persona no sabe que corregir.
        CONSTRAINT CK_PerfilesPublicos_Moderacion CHECK (OcultoPorModeracion = 0
            OR (MotivoModeracion IS NOT NULL AND LEN(MotivoModeracion) > 0 AND FechaModeracion IS NOT NULL))
    );

    CREATE UNIQUE INDEX UQ_PerfilesPublicos_ClavePublica ON dbo.PerfilesPublicos (ClavePublica);
END;

IF OBJECT_ID(N'dbo.PerfilesPublicosPracticas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PerfilesPublicosPracticas
    (
        IdUsuario int NOT NULL,
        IdPracticaMusical int NOT NULL,
        CONSTRAINT PK_PerfilesPublicosPracticas PRIMARY KEY (IdUsuario, IdPracticaMusical),
        CONSTRAINT FK_PerfilesPublicosPracticas_Perfil FOREIGN KEY (IdUsuario) REFERENCES dbo.PerfilesPublicos (IdUsuario),
        CONSTRAINT FK_PerfilesPublicosPracticas_Practica FOREIGN KEY (IdPracticaMusical) REFERENCES dbo.PracticasMusicales (IdPracticaMusical)
    );
END;

IF OBJECT_ID(N'dbo.PerfilesPublicosEnlaces', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PerfilesPublicosEnlaces
    (
        IdEnlace int IDENTITY(1,1) NOT NULL,
        IdUsuario int NOT NULL,
        Orden tinyint NOT NULL,
        Url nvarchar(400) NOT NULL,
        CONSTRAINT PK_PerfilesPublicosEnlaces PRIMARY KEY (IdEnlace),
        CONSTRAINT FK_PerfilesPublicosEnlaces_Perfil FOREIGN KEY (IdUsuario) REFERENCES dbo.PerfilesPublicos (IdUsuario),
        -- HASTA CINCO Y SOLO https, tambien en la base.
        CONSTRAINT CK_PerfilesPublicosEnlaces_Orden CHECK (Orden BETWEEN 1 AND 5),
        CONSTRAINT CK_PerfilesPublicosEnlaces_Https CHECK (Url LIKE N'https://_%')
    );

    CREATE UNIQUE INDEX UX_PerfilesPublicosEnlaces_Orden ON dbo.PerfilesPublicosEnlaces (IdUsuario, Orden);
END;

COMMIT TRANSACTION;
