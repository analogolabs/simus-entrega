/*
  V20261117_60 — CLASIFICACIÓN DEL PERFIL PÚBLICO (DIR; docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).

  Para que el directorio de personas funcione como búsqueda, cada persona se clasifica con una taxonomía controlada y
  de selección múltiple: roles, servicios que ofrece, instrumentos y territorio de acción (departamentos).
  Los códigos son estables y viven en `TaxonomiaDePerfiles`; la API los valida. «territorio» guarda el código DANE
  del departamento. Los perfiles existentes quedan SIN filas: «pendiente de completar». No se borra ni se cambia nada.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.PerfilesPublicosClasificaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PerfilesPublicosClasificaciones
    (
        IdUsuario int NOT NULL,
        Dimension nvarchar(12) NOT NULL,
        Codigo nvarchar(40) NOT NULL,
        CONSTRAINT PK_PerfilesPublicosClasificaciones PRIMARY KEY (IdUsuario, Dimension, Codigo),
        CONSTRAINT FK_PerfilesPublicosClasificaciones_Perfil FOREIGN KEY (IdUsuario) REFERENCES dbo.PerfilesPublicos (IdUsuario),
        CONSTRAINT CK_PerfilesPublicosClasificaciones_Dimension CHECK (Dimension IN (N'rol', N'servicio', N'instrumento', N'territorio'))
    );

    CREATE INDEX IX_PerfilesPublicosClasificaciones_Valor ON dbo.PerfilesPublicosClasificaciones (Dimension, Codigo);
END;

COMMIT TRANSACTION;
