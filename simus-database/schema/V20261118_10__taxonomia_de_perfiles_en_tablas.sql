/*
  V20261118_10 — LA TAXONOMÍA DE PERFILES EN TABLAS (decisión 133, DIR; docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).

  Roles, servicios e instrumentos con los que una persona se clasifica eran constantes de código
  (`TaxonomiaDePerfiles`): cambiar un valor exigía una versión del sistema. Pasan a ser un vocabulario controlado
  administrable desde el Catálogo de la consola, como los demás.

  UNA SOLA TABLA con la dimensión como columna (igual que `PerfilesPublicosClasificaciones`, que guarda las elecciones).

  NO DESTRUCTIVA Y SIN CAMBIAR NINGÚN CÓDIGO:
  - Crea una tabla y siembra los valores que ya existían con SUS MISMOS códigos; las elecciones guardadas en
    `PerfilesPublicosClasificaciones` no se tocan ni llevan clave foránea a esta tabla (en «territorio» el código es DANE),
    de modo que los perfiles existentes siguen válidos.
  - Desactivar un valor (`Activo = 0`) deja de ofrecerlo a quien elige, pero no borra ni invalida los perfiles que ya lo
    usan: su nombre se sigue resolviendo. El código nunca se renombra ni se reutiliza.
  - Es idempotente: sembrar solo inserta lo que falta, nunca pisa un nombre o un orden ya editado desde la consola.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.ValoresDeTaxonomiaDePerfiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ValoresDeTaxonomiaDePerfiles
    (
        IdValor int IDENTITY(1,1) NOT NULL,
        Dimension nvarchar(12) NOT NULL,
        Codigo nvarchar(40) NOT NULL,
        Nombre nvarchar(120) NOT NULL,
        GrupoSoyCultura nvarchar(12) NULL,
        Fuente nvarchar(200) NULL,
        Activo bit NOT NULL CONSTRAINT DF_ValoresDeTaxonomiaDePerfiles_Activo DEFAULT (1),
        OrdenVisualizacion int NOT NULL,
        FechaCreacion datetime2(0) NOT NULL CONSTRAINT DF_ValoresDeTaxonomiaDePerfiles_Creacion DEFAULT (SYSUTCDATETIME()),
        FechaActualizacion datetime2(0) NULL,
        CONSTRAINT PK_ValoresDeTaxonomiaDePerfiles PRIMARY KEY CLUSTERED (IdValor),
        CONSTRAINT UQ_ValoresDeTaxonomiaDePerfiles_Codigo UNIQUE (Dimension, Codigo),
        CONSTRAINT UQ_ValoresDeTaxonomiaDePerfiles_Nombre UNIQUE (Dimension, Nombre),
        CONSTRAINT CK_ValoresDeTaxonomiaDePerfiles_Dimension CHECK (Dimension IN (N'rol', N'servicio', N'instrumento')),
        CONSTRAINT CK_ValoresDeTaxonomiaDePerfiles_Grupo CHECK (GrupoSoyCultura IS NULL OR GrupoSoyCultura IN (N'creador', N'gestor', N'otro')),
        CONSTRAINT CK_ValoresDeTaxonomiaDePerfiles_Orden CHECK (OrdenVisualizacion > 0)
    );
END;

/* Siembra: los valores vigentes, con los mismos códigos. */
INSERT INTO dbo.ValoresDeTaxonomiaDePerfiles (Dimension, Codigo, Nombre, GrupoSoyCultura, Fuente, OrdenVisualizacion)
SELECT v.Dimension, v.Codigo, v.Nombre, v.GrupoSoyCultura, v.Fuente, v.Orden
FROM (VALUES
    (N'rol', N'interprete', N'Intérprete o instrumentista', N'creador', N'Ley 2621 de 2026, art. 8', 1),
    (N'rol', N'cantante', N'Cantante o cantautor(a)', N'creador', N'Ley 2621 de 2026, art. 8', 2),
    (N'rol', N'compositor', N'Compositor(a) o arreglista', N'creador', N'Ley 2621 de 2026, art. 8', 3),
    (N'rol', N'director', N'Director(a) de agrupación u orquesta', N'creador', N'Ley 2621 de 2026, art. 8', 4),
    (N'rol', N'docente', N'Docente o formador(a) de música', N'otro', N'Ley 2621 de 2026, art. 8', 5),
    (N'rol', N'investigador', N'Investigador(a) o sabedor(a)', N'otro', N'Ley 2621 de 2026, art. 8', 6),
    (N'rol', N'luthier', N'Lutier o constructor(a) de instrumentos', N'creador', N'Propuesta SIMUS; docs/referencia/27-fuentes-de-luteria.md', 7),
    (N'rol', N'sonidista', N'Sonidista o técnico(a) de audio', N'otro', N'Ley 2621 de 2026, art. 8', 8),
    (N'rol', N'productor', N'Productor(a) musical o fonográfico', N'otro', N'Ley 2621 de 2026, art. 8', 9),
    (N'rol', N'gestor', N'Gestor(a) cultural', N'gestor', N'Ley 397 de 1997, art. 28', 10),
    (N'rol', N'cultor', N'Cultor(a) o portador(a) de tradición', N'creador', N'Propuesta SIMUS', 11),
    (N'servicio', N'clases', N'Clases y formación musical', NULL, NULL, 1),
    (N'servicio', N'presentaciones', N'Presentaciones en vivo', NULL, NULL, 2),
    (N'servicio', N'grabacion', N'Grabación y producción musical', NULL, NULL, 3),
    (N'servicio', N'composicion', N'Composición y arreglos por encargo', NULL, NULL, 4),
    (N'servicio', N'luteria', N'Construcción, reparación y restauración de instrumentos', NULL, NULL, 5),
    (N'servicio', N'sonido', N'Sonido e ingeniería de audio', NULL, NULL, 6),
    (N'servicio', N'gestion', N'Gestión y producción de eventos', NULL, NULL, 7),
    (N'servicio', N'direccion', N'Dirección de agrupaciones o procesos', NULL, NULL, 8),
    (N'servicio', N'investigacion', N'Investigación y documentación', NULL, NULL, 9),
    (N'servicio', N'asesoria', N'Asesoría y consultoría', NULL, NULL, 10),
    (N'instrumento', N'cordofonos', N'Cuerdas (cordófonos)', NULL, N'Hornbostel-Sachs; FamiliasDeInstrumentos', 1),
    (N'instrumento', N'aerofonos', N'Vientos (aerófonos)', NULL, N'Hornbostel-Sachs; FamiliasDeInstrumentos', 2),
    (N'instrumento', N'membranofonos', N'Percusión de membrana (membranófonos)', NULL, N'Hornbostel-Sachs; FamiliasDeInstrumentos', 3),
    (N'instrumento', N'idiofonos', N'Percusión de sonido propio (idiófonos)', NULL, N'Hornbostel-Sachs; FamiliasDeInstrumentos', 4),
    (N'instrumento', N'electrofonos', N'Instrumentos electrónicos (electrófonos)', NULL, N'Hornbostel-Sachs; FamiliasDeInstrumentos', 5),
    (N'instrumento', N'voz', N'Voz', NULL, N'Propuesta SIMUS', 6)
) AS v(Dimension, Codigo, Nombre, GrupoSoyCultura, Fuente, Orden)
WHERE NOT EXISTS (SELECT 1 FROM dbo.ValoresDeTaxonomiaDePerfiles t WHERE t.Dimension = v.Dimension AND t.Codigo = v.Codigo)
  AND NOT EXISTS (SELECT 1 FROM dbo.ValoresDeTaxonomiaDePerfiles t WHERE t.Dimension = v.Dimension AND t.Nombre = v.Nombre);

COMMIT TRANSACTION;
