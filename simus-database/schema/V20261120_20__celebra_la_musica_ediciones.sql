/* SIMUS · Micrositio «Celebra la música» con ediciones históricas */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

/*
  QUE RESUELVE. Celebra la música es una estrategia del PNMC que se repite cada noviembre. El micrositio
  necesita una edición por año (2025, 2026 y las futuras), cada una con su presentación, categorías,
  caja de herramientas, preguntas frecuentes, galería y colores.

  LO QUE NO HACE. No guarda noticias ni agenda: la programación y las noticias de una edición son la
  agenda y las noticias GENERALES filtradas por el proyecto transversal de la edición (dbo.ProyectosTransversales,
  ya existente). Cada edición apunta a su proyecto con una clave foránea real.

  SOLO CREA TABLAS NUEVAS: es idempotente y no toca datos existentes, por eso no necesita respaldo. Las claves
  foráneas no cascadean (regla del proyecto).
*/

IF OBJECT_ID(N'dbo.CelebraEdiciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CelebraEdiciones (
        IdCelebraEdicion int IDENTITY(1,1) NOT NULL,
        Anio int NOT NULL,
        Nombre nvarchar(200) NOT NULL,
        Hashtag nvarchar(80) NULL,
        ProyectoTransversalId int NOT NULL,
        FechaInicio date NULL,
        FechaFin date NULL,
        Resumen nvarchar(600) NULL,
        Presentacion nvarchar(max) NULL,
        Aliados nvarchar(500) NULL,
        Actividades int NULL,
        Municipios int NULL,
        Departamentos int NULL,
        Organizaciones int NULL,
        Musicos int NULL,
        ColorPrincipal char(7) NOT NULL CONSTRAINT DF_CelebraEdiciones_ColorPrincipal DEFAULT ('#6B2A8C'),
        ColorSecundario char(7) NOT NULL CONSTRAINT DF_CelebraEdiciones_ColorSecundario DEFAULT ('#E5007E'),
        ImagenPortadaArchivoId int NULL,
        Actual bit NOT NULL CONSTRAINT DF_CelebraEdiciones_Actual DEFAULT (0),
        Publicada bit NOT NULL CONSTRAINT DF_CelebraEdiciones_Publicada DEFAULT (0),
        Fuente nvarchar(300) NULL,
        PendienteDeValidar bit NOT NULL CONSTRAINT DF_CelebraEdiciones_Pendiente DEFAULT (0),
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_CelebraEdiciones_Creacion DEFAULT (SYSUTCDATETIME()),
        FechaActualizacion datetime2(0) NULL,
        CONSTRAINT PK_CelebraEdiciones PRIMARY KEY CLUSTERED (IdCelebraEdicion),
        CONSTRAINT UQ_CelebraEdiciones_Anio UNIQUE (Anio),
        CONSTRAINT UQ_CelebraEdiciones_Proyecto UNIQUE (ProyectoTransversalId),
        CONSTRAINT FK_CelebraEdiciones_Proyecto FOREIGN KEY (ProyectoTransversalId) REFERENCES dbo.ProyectosTransversales (IdProyectoTransversal),
        CONSTRAINT FK_CelebraEdiciones_Portada FOREIGN KEY (ImagenPortadaArchivoId) REFERENCES dbo.Archivos (IdArchivo),
        CONSTRAINT CK_CelebraEdiciones_Anio CHECK (Anio BETWEEN 2011 AND 2100),
        CONSTRAINT CK_CelebraEdiciones_Fechas CHECK (FechaFin IS NULL OR FechaInicio IS NULL OR FechaFin >= FechaInicio),
        CONSTRAINT CK_CelebraEdiciones_Cifras CHECK (
            (Actividades IS NULL OR Actividades >= 0) AND (Municipios IS NULL OR Municipios >= 0)
            AND (Departamentos IS NULL OR Departamentos >= 0) AND (Organizaciones IS NULL OR Organizaciones >= 0)
            AND (Musicos IS NULL OR Musicos >= 0)),
        CONSTRAINT CK_CelebraEdiciones_Colores CHECK (
            ColorPrincipal LIKE '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'
            AND ColorSecundario LIKE '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
    );
    /* Una sola edición vigente a la vez. */
    CREATE UNIQUE INDEX UX_CelebraEdiciones_Actual ON dbo.CelebraEdiciones (Actual) WHERE Actual = 1;
END
GO

IF OBJECT_ID(N'dbo.CelebraCategorias', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CelebraCategorias (
        IdCelebraCategoria int IDENTITY(1,1) NOT NULL,
        CelebraEdicionId int NOT NULL,
        Nombre nvarchar(120) NOT NULL,
        Descripcion nvarchar(600) NULL,
        Orden int NOT NULL CONSTRAINT DF_CelebraCategorias_Orden DEFAULT (1),
        CONSTRAINT PK_CelebraCategorias PRIMARY KEY CLUSTERED (IdCelebraCategoria),
        CONSTRAINT FK_CelebraCategorias_Edicion FOREIGN KEY (CelebraEdicionId) REFERENCES dbo.CelebraEdiciones (IdCelebraEdicion),
        CONSTRAINT UQ_CelebraCategorias_Nombre UNIQUE (CelebraEdicionId, Nombre),
        CONSTRAINT CK_CelebraCategorias_Orden CHECK (Orden > 0)
    );
END
GO

IF OBJECT_ID(N'dbo.CelebraRecursos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CelebraRecursos (
        IdCelebraRecurso int IDENTITY(1,1) NOT NULL,
        CelebraEdicionId int NOT NULL,
        Grupo nvarchar(120) NOT NULL,
        Titulo nvarchar(200) NOT NULL,
        Descripcion nvarchar(600) NULL,
        ArchivoId int NULL,
        Url nvarchar(500) NULL,
        Orden int NOT NULL CONSTRAINT DF_CelebraRecursos_Orden DEFAULT (1),
        CONSTRAINT PK_CelebraRecursos PRIMARY KEY CLUSTERED (IdCelebraRecurso),
        CONSTRAINT FK_CelebraRecursos_Edicion FOREIGN KEY (CelebraEdicionId) REFERENCES dbo.CelebraEdiciones (IdCelebraEdicion),
        CONSTRAINT FK_CelebraRecursos_Archivo FOREIGN KEY (ArchivoId) REFERENCES dbo.Archivos (IdArchivo),
        /* Un recurso se descarga del Banco de archivos o se abre en un enlace; nunca ambos ni ninguno. */
        CONSTRAINT CK_CelebraRecursos_Destino CHECK ((ArchivoId IS NOT NULL AND Url IS NULL) OR (ArchivoId IS NULL AND Url IS NOT NULL)),
        CONSTRAINT CK_CelebraRecursos_Url CHECK (Url IS NULL OR Url LIKE 'https://%'),
        CONSTRAINT CK_CelebraRecursos_Orden CHECK (Orden > 0)
    );
    CREATE INDEX IX_CelebraRecursos_Edicion ON dbo.CelebraRecursos (CelebraEdicionId, Grupo, Orden);
END
GO

IF OBJECT_ID(N'dbo.CelebraPreguntas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CelebraPreguntas (
        IdCelebraPregunta int IDENTITY(1,1) NOT NULL,
        CelebraEdicionId int NOT NULL,
        Pregunta nvarchar(300) NOT NULL,
        Respuesta nvarchar(2000) NOT NULL,
        Orden int NOT NULL CONSTRAINT DF_CelebraPreguntas_Orden DEFAULT (1),
        CONSTRAINT PK_CelebraPreguntas PRIMARY KEY CLUSTERED (IdCelebraPregunta),
        CONSTRAINT FK_CelebraPreguntas_Edicion FOREIGN KEY (CelebraEdicionId) REFERENCES dbo.CelebraEdiciones (IdCelebraEdicion),
        CONSTRAINT CK_CelebraPreguntas_Orden CHECK (Orden > 0)
    );
    CREATE INDEX IX_CelebraPreguntas_Edicion ON dbo.CelebraPreguntas (CelebraEdicionId, Orden);
END
GO

IF OBJECT_ID(N'dbo.CelebraGaleria', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CelebraGaleria (
        IdCelebraImagen int IDENTITY(1,1) NOT NULL,
        CelebraEdicionId int NOT NULL,
        ArchivoId int NOT NULL,
        TextoAlternativo nvarchar(300) NOT NULL,
        Credito nvarchar(250) NULL,
        Orden int NOT NULL CONSTRAINT DF_CelebraGaleria_Orden DEFAULT (1),
        CONSTRAINT PK_CelebraGaleria PRIMARY KEY CLUSTERED (IdCelebraImagen),
        CONSTRAINT FK_CelebraGaleria_Edicion FOREIGN KEY (CelebraEdicionId) REFERENCES dbo.CelebraEdiciones (IdCelebraEdicion),
        CONSTRAINT FK_CelebraGaleria_Archivo FOREIGN KEY (ArchivoId) REFERENCES dbo.Archivos (IdArchivo),
        CONSTRAINT UQ_CelebraGaleria_Archivo UNIQUE (CelebraEdicionId, ArchivoId),
        CONSTRAINT CK_CelebraGaleria_Orden CHECK (Orden > 0)
    );
END
GO

/*
  LOS PROYECTOS DE EDICION. Cada edicion es su propio proyecto transversal; el contenido (eventos y
  noticias) se etiqueta con el de su edicion. Se siembran solo los dos que existen en el calendario.
*/
IF NOT EXISTS (SELECT 1 FROM dbo.ProyectosTransversales WHERE Codigo = N'celebra-la-musica-2025')
    INSERT INTO dbo.ProyectosTransversales (Codigo, Nombre, Descripcion, Activo, OrdenVisualizacion)
    VALUES (N'celebra-la-musica-2025', N'Celebra la Música 2025', N'Edición 2025 de Celebra la Música (noviembre de 2025).', 1,
        (SELECT ISNULL(MAX(OrdenVisualizacion), 0) + 1 FROM dbo.ProyectosTransversales));
IF NOT EXISTS (SELECT 1 FROM dbo.ProyectosTransversales WHERE Codigo = N'celebra-la-musica-2026')
    INSERT INTO dbo.ProyectosTransversales (Codigo, Nombre, Descripcion, Activo, OrdenVisualizacion)
    VALUES (N'celebra-la-musica-2026', N'Celebra la Música 2026', N'Edición 2026 de Celebra la Música (noviembre de 2026).', 1,
        (SELECT ISNULL(MAX(OrdenVisualizacion), 0) + 1 FROM dbo.ProyectosTransversales));
GO
