/* SIMUS · Galería pública: álbumes de fotos, de videos y mixtos */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

/*
  QUE RESUELVE. La Galería pública deja de ser una página vacía: un álbum agrupa ítems de dos clases, FOTOS
  (un archivo del Banco de archivos) y VIDEOS (el identificador de un video público de YouTube, nunca el
  archivo). El álbum tiene un TIPO: «fotos», «videos» o «mixto». La interfaz lo rotula y permite filtrar por él.

  PRIVACIDAD. El video no guarda ninguna dirección de terceros, solo el identificador de 11 caracteres. La
  página no pide nada a YouTube hasta que la persona pulsa «Reproducir» (incrustación youtube-nocookie).

  SOLO CREA TABLAS NUEVAS: es idempotente y no toca datos existentes (no necesita respaldo). Las claves
  foráneas no cascadean (regla del proyecto).

  REGLAS EN LA BASE: un ítem de foto lleva archivo y no video; uno de video lleva identificador y no archivo.
  Que el tipo del ítem sea coherente con el tipo del álbum lo valida la API (un CHECK no puede cruzar tablas).

  REVERSA (manual): DROP TABLE dbo.GaleriaItems; DROP TABLE dbo.GaleriaAlbumes;
*/

IF OBJECT_ID(N'dbo.GaleriaAlbumes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.GaleriaAlbumes (
        IdGaleriaAlbum int IDENTITY(1,1) NOT NULL,
        Slug nvarchar(120) NOT NULL,
        Titulo nvarchar(200) NOT NULL,
        Descripcion nvarchar(1000) NULL,
        Tipo nvarchar(10) NOT NULL,
        Lugar nvarchar(200) NULL,
        FechaReferencia date NULL,
        PortadaArchivoId int NULL,
        ListaOrigenUrl nvarchar(300) NULL,
        Orden int NOT NULL CONSTRAINT DF_GaleriaAlbumes_Orden DEFAULT (1),
        Publicado bit NOT NULL CONSTRAINT DF_GaleriaAlbumes_Publicado DEFAULT (0),
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_GaleriaAlbumes_Creacion DEFAULT (SYSUTCDATETIME()),
        FechaActualizacion datetime2(0) NULL,
        CONSTRAINT PK_GaleriaAlbumes PRIMARY KEY CLUSTERED (IdGaleriaAlbum),
        CONSTRAINT UQ_GaleriaAlbumes_Slug UNIQUE (Slug),
        CONSTRAINT FK_GaleriaAlbumes_Portada FOREIGN KEY (PortadaArchivoId) REFERENCES dbo.Archivos (IdArchivo),
        CONSTRAINT CK_GaleriaAlbumes_Tipo CHECK (Tipo IN (N'fotos', N'videos', N'mixto')),
        CONSTRAINT CK_GaleriaAlbumes_Slug CHECK (Slug NOT LIKE N'%[^a-z0-9-]%' AND LEN(Slug) > 0),
        CONSTRAINT CK_GaleriaAlbumes_ListaOrigen CHECK (ListaOrigenUrl IS NULL OR ListaOrigenUrl LIKE N'https://%')
    );
    CREATE INDEX IX_GaleriaAlbumes_Listado ON dbo.GaleriaAlbumes (Publicado, Orden, IdGaleriaAlbum);
END
GO

IF OBJECT_ID(N'dbo.GaleriaItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.GaleriaItems (
        IdGaleriaItem int IDENTITY(1,1) NOT NULL,
        GaleriaAlbumId int NOT NULL,
        TipoItem nvarchar(5) NOT NULL,
        Orden int NOT NULL CONSTRAINT DF_GaleriaItems_Orden DEFAULT (1),
        Titulo nvarchar(250) NULL,
        Descripcion nvarchar(2000) NULL,
        Fecha date NULL,
        Credito nvarchar(250) NULL,
        TextoAlternativo nvarchar(300) NULL,
        ArchivoId int NULL,
        VideoId char(11) NULL,
        DuracionSegundos int NULL,
        CONSTRAINT PK_GaleriaItems PRIMARY KEY CLUSTERED (IdGaleriaItem),
        CONSTRAINT FK_GaleriaItems_Album FOREIGN KEY (GaleriaAlbumId) REFERENCES dbo.GaleriaAlbumes (IdGaleriaAlbum),
        CONSTRAINT FK_GaleriaItems_Archivo FOREIGN KEY (ArchivoId) REFERENCES dbo.Archivos (IdArchivo),
        CONSTRAINT CK_GaleriaItems_Tipo CHECK (TipoItem IN (N'foto', N'video')),
        CONSTRAINT CK_GaleriaItems_Destino CHECK (
            (TipoItem = N'foto' AND ArchivoId IS NOT NULL AND VideoId IS NULL AND DuracionSegundos IS NULL)
            OR (TipoItem = N'video' AND VideoId IS NOT NULL AND ArchivoId IS NULL AND Titulo IS NOT NULL)),
        CONSTRAINT CK_GaleriaItems_VideoId CHECK (VideoId IS NULL OR VideoId NOT LIKE N'%[^A-Za-z0-9_-]%'),
        CONSTRAINT CK_GaleriaItems_Duracion CHECK (DuracionSegundos IS NULL OR DuracionSegundos > 0)
    );
    CREATE INDEX IX_GaleriaItems_Album ON dbo.GaleriaItems (GaleriaAlbumId, Orden, IdGaleriaItem);
    CREATE INDEX IX_GaleriaItems_Archivo ON dbo.GaleriaItems (ArchivoId) WHERE ArchivoId IS NOT NULL;
END
GO
