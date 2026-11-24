/*
    SIMUS · Catalogos demograficos (solo listas de valores)

    QUE CREA. Seis catalogos transversales para describir a una persona. Por ahora NADIE los usa:
    ninguna tabla los referencia y ningun formulario los captura. Existen para que, cuando el
    agente individual o los indicadores los necesiten, la lista ya este aprobada, sembrada y con su
    fuente. Quien los use despues agrega su propia clave foranea.

      Sexos, IdentidadesGenero, OrientacionesSexuales, PertenenciasEtnicas, TiposDiscapacidad,
      EnfoquesDiferenciales.

    FUENTES (contrastadas el 7-oct-2026; ver `DER_03` y `DER_11` en `02_Documentacion/13_Catalogos_maestros`):
      - DANE, «Guia para la inclusion del enfoque diferencial e interseccional en la produccion
        estadistica del SEN», segunda version, 2026: sexo, identidad de genero, orientacion sexual
        y pertenencia etnica.
      - Ministerio de Salud, Resolucion 1197 de 2024: categorias de discapacidad.
      - Acto Legislativo 01 de 2023, Ley 1448 de 2011, Ley 2136 de 2021 y Decreto 762 de 2018:
        enfoques diferenciales.
    Los valores «No sabe / No responde» y «Ninguna» son adiciones propias: un campo opcional tiene
    que poder decir que no se responde.

    SON DATOS SENSIBLES (Ley 1581 de 2012, art. 5). Que la lista exista no autoriza a pedirla: cada
    captura exige una finalidad y un consentimiento propios. La orientacion sexual solo se captura
    autodiligenciada, de forma opcional y con finalidad definida. La redaccion juridica esta pendiente.

    FORMA. La de los catalogos del Festival: `Id`, `Nombre`, `Slug` (clave natural), `Descripcion`
    (aqui lleva la fuente), `OrdenVisualizacion`, y `Activo` para retirar un valor sin borrarlo.
    La discapacidad y los enfoques son de seleccion multiple: la relacion con la persona se crea
    cuando exista la tabla de personas.

    «BARRISMO SOCIAL» SE SIEMBRA INACTIVO: no se hallo definicion ni catalogo oficial. Se activa o se
    retira cuando la direccion decida.

    IDEMPOTENTE: crea lo que falta y no sobrescribe lo que ya exista.
*/
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Sexos', N'U') IS NULL
    CREATE TABLE dbo.Sexos (
        IdSexo int IDENTITY(1,1) NOT NULL, NombreSexo nvarchar(160) NOT NULL, Slug nvarchar(80) NOT NULL,
        Descripcion nvarchar(600) NULL, OrdenVisualizacion int NOT NULL, Activo bit NOT NULL CONSTRAINT DF_Sexos_Activo DEFAULT (1),
        CONSTRAINT PK_Sexos PRIMARY KEY (IdSexo), CONSTRAINT UQ_Sexos_Slug UNIQUE (Slug),
        CONSTRAINT UQ_Sexos_Nombre UNIQUE (NombreSexo), CONSTRAINT CK_Sexos_Orden CHECK (OrdenVisualizacion > 0));
GO
IF OBJECT_ID(N'dbo.IdentidadesGenero', N'U') IS NULL
    CREATE TABLE dbo.IdentidadesGenero (
        IdIdentidadGenero int IDENTITY(1,1) NOT NULL, NombreIdentidadGenero nvarchar(160) NOT NULL, Slug nvarchar(80) NOT NULL,
        Descripcion nvarchar(600) NULL, OrdenVisualizacion int NOT NULL, Activo bit NOT NULL CONSTRAINT DF_IdentidadesGenero_Activo DEFAULT (1),
        CONSTRAINT PK_IdentidadesGenero PRIMARY KEY (IdIdentidadGenero), CONSTRAINT UQ_IdentidadesGenero_Slug UNIQUE (Slug),
        CONSTRAINT UQ_IdentidadesGenero_Nombre UNIQUE (NombreIdentidadGenero), CONSTRAINT CK_IdentidadesGenero_Orden CHECK (OrdenVisualizacion > 0));
GO
IF OBJECT_ID(N'dbo.OrientacionesSexuales', N'U') IS NULL
    CREATE TABLE dbo.OrientacionesSexuales (
        IdOrientacionSexual int IDENTITY(1,1) NOT NULL, NombreOrientacionSexual nvarchar(160) NOT NULL, Slug nvarchar(80) NOT NULL,
        Descripcion nvarchar(600) NULL, OrdenVisualizacion int NOT NULL, Activo bit NOT NULL CONSTRAINT DF_OrientacionesSexuales_Activo DEFAULT (1),
        CONSTRAINT PK_OrientacionesSexuales PRIMARY KEY (IdOrientacionSexual), CONSTRAINT UQ_OrientacionesSexuales_Slug UNIQUE (Slug),
        CONSTRAINT UQ_OrientacionesSexuales_Nombre UNIQUE (NombreOrientacionSexual), CONSTRAINT CK_OrientacionesSexuales_Orden CHECK (OrdenVisualizacion > 0));
GO
IF OBJECT_ID(N'dbo.PertenenciasEtnicas', N'U') IS NULL
    CREATE TABLE dbo.PertenenciasEtnicas (
        IdPertenenciaEtnica int IDENTITY(1,1) NOT NULL, NombrePertenenciaEtnica nvarchar(200) NOT NULL, Slug nvarchar(80) NOT NULL,
        Descripcion nvarchar(600) NULL, OrdenVisualizacion int NOT NULL, Activo bit NOT NULL CONSTRAINT DF_PertenenciasEtnicas_Activo DEFAULT (1),
        CONSTRAINT PK_PertenenciasEtnicas PRIMARY KEY (IdPertenenciaEtnica), CONSTRAINT UQ_PertenenciasEtnicas_Slug UNIQUE (Slug),
        CONSTRAINT UQ_PertenenciasEtnicas_Nombre UNIQUE (NombrePertenenciaEtnica), CONSTRAINT CK_PertenenciasEtnicas_Orden CHECK (OrdenVisualizacion > 0));
GO
IF OBJECT_ID(N'dbo.TiposDiscapacidad', N'U') IS NULL
    CREATE TABLE dbo.TiposDiscapacidad (
        IdTipoDiscapacidad int IDENTITY(1,1) NOT NULL, NombreTipoDiscapacidad nvarchar(160) NOT NULL, Slug nvarchar(80) NOT NULL,
        Descripcion nvarchar(600) NULL, OrdenVisualizacion int NOT NULL, Activo bit NOT NULL CONSTRAINT DF_TiposDiscapacidad_Activo DEFAULT (1),
        CONSTRAINT PK_TiposDiscapacidad PRIMARY KEY (IdTipoDiscapacidad), CONSTRAINT UQ_TiposDiscapacidad_Slug UNIQUE (Slug),
        CONSTRAINT UQ_TiposDiscapacidad_Nombre UNIQUE (NombreTipoDiscapacidad), CONSTRAINT CK_TiposDiscapacidad_Orden CHECK (OrdenVisualizacion > 0));
GO
IF OBJECT_ID(N'dbo.EnfoquesDiferenciales', N'U') IS NULL
    CREATE TABLE dbo.EnfoquesDiferenciales (
        IdEnfoqueDiferencial int IDENTITY(1,1) NOT NULL, NombreEnfoqueDiferencial nvarchar(160) NOT NULL, Slug nvarchar(80) NOT NULL,
        Descripcion nvarchar(600) NULL, OrdenVisualizacion int NOT NULL, Activo bit NOT NULL CONSTRAINT DF_EnfoquesDiferenciales_Activo DEFAULT (1),
        CONSTRAINT PK_EnfoquesDiferenciales PRIMARY KEY (IdEnfoqueDiferencial), CONSTRAINT UQ_EnfoquesDiferenciales_Slug UNIQUE (Slug),
        CONSTRAINT UQ_EnfoquesDiferenciales_Nombre UNIQUE (NombreEnfoqueDiferencial), CONSTRAINT CK_EnfoquesDiferenciales_Orden CHECK (OrdenVisualizacion > 0));
GO

-- Sexo. Guia DANE V2 2026, §2.4.1.3.
INSERT INTO dbo.Sexos (NombreSexo, Slug, Descripcion, OrdenVisualizacion)
SELECT v.N, v.S, v.D, v.O FROM (VALUES
    (N'Masculino', N'masculino', N'DANE, Guía V2 2026.', 1),
    (N'Femenino', N'femenino', N'DANE, Guía V2 2026.', 2),
    (N'Intersexual', N'intersexual', N'DANE, Guía V2 2026 (operaciones de salud).', 3),
    (N'No sabe / No responde', N'no-responde', N'Adición propia: un campo opcional necesita una salida explícita.', 4)
) AS v (N, S, D, O) WHERE NOT EXISTS (SELECT 1 FROM dbo.Sexos t WHERE t.Slug = v.S);
GO

-- Identidad de genero. Guia DANE V2 2026, §2.4.1.1 (la pregunta «es trans» es una pregunta aparte, no una lista).
INSERT INTO dbo.IdentidadesGenero (NombreIdentidadGenero, Slug, Descripcion, OrdenVisualizacion)
SELECT v.N, v.S, v.D, v.O FROM (VALUES
    (N'Hombre', N'hombre', N'DANE, Guía V2 2026.', 1),
    (N'Mujer', N'mujer', N'DANE, Guía V2 2026.', 2),
    (N'Persona no binaria', N'no-binaria', N'DANE, Guía V2 2026.', 3),
    (N'Prefiere identificarse de otra forma', N'otra', N'DANE, Guía V2 2026. Admite aclarar cuál.', 4),
    (N'Prefiere no responder', N'no-responde', N'Adición propia.', 5)
) AS v (N, S, D, O) WHERE NOT EXISTS (SELECT 1 FROM dbo.IdentidadesGenero t WHERE t.Slug = v.S);
GO

-- Orientacion sexual. Guia DANE V2 2026. Se captura solo autodiligenciada, opcional y con consentimiento.
INSERT INTO dbo.OrientacionesSexuales (NombreOrientacionSexual, Slug, Descripcion, OrdenVisualizacion)
SELECT v.N, v.S, v.D, v.O FROM (VALUES
    (N'Heterosexual', N'heterosexual', N'DANE, Guía V2 2026.', 1),
    (N'Lesbiana', N'lesbiana', N'DANE, Guía V2 2026.', 2),
    (N'Gay', N'gay', N'DANE, Guía V2 2026.', 3),
    (N'Bisexual', N'bisexual', N'DANE, Guía V2 2026.', 4),
    (N'Otra', N'otra', N'DANE, Guía V2 2026. Admite aclarar cuál.', 5),
    (N'Prefiero no responder', N'no-responde', N'DANE, Guía V2 2026.', 6)
) AS v (N, S, D, O) WHERE NOT EXISTS (SELECT 1 FROM dbo.OrientacionesSexuales t WHERE t.Slug = v.S);
GO

-- Pertenencia etnica. Guia DANE V2 2026, §2.3.1, y CNPV 2018.
INSERT INTO dbo.PertenenciasEtnicas (NombrePertenenciaEtnica, Slug, Descripcion, OrdenVisualizacion)
SELECT v.N, v.S, v.D, v.O FROM (VALUES
    (N'Indígena', N'indigena', N'DANE, Guía V2 2026.', 1),
    (N'Gitano o Rrom', N'gitano-rrom', N'DANE, Guía V2 2026.', 2),
    (N'Raizal del Archipiélago de San Andrés, Providencia y Santa Catalina', N'raizal', N'DANE, Guía V2 2026.', 3),
    (N'Palenquero de San Basilio', N'palenquero', N'DANE, Guía V2 2026.', 4),
    (N'Negro, mulato, afrodescendiente, afrocolombiano', N'negro-afrodescendiente', N'DANE, Guía V2 2026.', 5),
    (N'Ninguno de los anteriores', N'ninguno', N'DANE, Guía V2 2026. No equivale a no responder.', 6),
    (N'No sabe / No responde', N'no-responde', N'Adición propia (también la usa Soy Cultura).', 7)
) AS v (N, S, D, O) WHERE NOT EXISTS (SELECT 1 FROM dbo.PertenenciasEtnicas t WHERE t.Slug = v.S);
GO

-- Discapacidad. Resolucion 1197 de 2024 (Minsalud), anexo tecnico: categorias no excluyentes.
INSERT INTO dbo.TiposDiscapacidad (NombreTipoDiscapacidad, Slug, Descripcion, OrdenVisualizacion)
SELECT v.N, v.S, v.D, v.O FROM (VALUES
    (N'Física', N'fisica', N'Resolución 1197 de 2024, Minsalud.', 1),
    (N'Auditiva', N'auditiva', N'Resolución 1197 de 2024, Minsalud.', 2),
    (N'Visual', N'visual', N'Resolución 1197 de 2024, Minsalud.', 3),
    (N'Sordoceguera', N'sordoceguera', N'Resolución 1197 de 2024, Minsalud. No se combina con auditiva ni visual.', 4),
    (N'Intelectual', N'intelectual', N'Resolución 1197 de 2024, Minsalud.', 5),
    (N'Psicosocial (mental)', N'psicosocial', N'Resolución 1197 de 2024, Minsalud.', 6),
    (N'Múltiple', N'multiple', N'Resolución 1197 de 2024, Minsalud.', 7),
    (N'Ninguna', N'ninguna', N'Adición propia.', 8),
    (N'Prefiere no responder', N'no-responde', N'Adición propia.', 9)
) AS v (N, S, D, O) WHERE NOT EXISTS (SELECT 1 FROM dbo.TiposDiscapacidad t WHERE t.Slug = v.S);
GO

-- Enfoques diferenciales. Normas citadas en la descripcion de cada valor.
INSERT INTO dbo.EnfoquesDiferenciales (NombreEnfoqueDiferencial, Slug, Descripcion, OrdenVisualizacion)
SELECT v.N, v.S, v.D, v.O FROM (VALUES
    (N'Campesino o campesina', N'campesino', N'Acto Legislativo 01 de 2023 (art. 64 de la Constitución).', 1),
    (N'Víctima del conflicto armado', N'victima', N'Ley 1448 de 2011, art. 3. Registro: RUV.', 2),
    (N'Población migrante', N'migrante', N'Ley 2136 de 2021, art. 7.', 3),
    (N'Mujer', N'mujer', N'Se deriva de la identidad de género; se conserva como enfoque porque Soy Cultura lo lista.', 4),
    (N'LGBTIQ+', N'lgbtiq', N'Sin categoría única oficial; se deriva de género, orientación y pregunta trans (Decreto 762 de 2018).', 5)
) AS v (N, S, D, O) WHERE NOT EXISTS (SELECT 1 FROM dbo.EnfoquesDiferenciales t WHERE t.Slug = v.S);

IF NOT EXISTS (SELECT 1 FROM dbo.EnfoquesDiferenciales WHERE Slug = N'barrismo-social')
    INSERT INTO dbo.EnfoquesDiferenciales (NombreEnfoqueDiferencial, Slug, Descripcion, OrdenVisualizacion, Activo)
    VALUES (N'Barrismo social', N'barrismo-social', N'Sin definición ni catálogo oficial hallados (el DANE no lo incluye). Inactivo hasta que se decida.', 6, 0);
GO

/*
    CORRESPONDENCIA DEPARTAMENTO -> REGION DEL SGR, LEGIBLE.
    `DepartamentosRegionOcad` solo guarda el codigo del departamento y el id de la region. Esta vista
    la presenta con los nombres, que es como se revisa a ojo:  SELECT * FROM dbo.VistaDepartamentosPorRegionOcad
    Un departamento esta en UNA sola region (la clave primaria lo impide). Fuente del reparto:
    Ley 2056 de 2020, art. 45.
*/
CREATE OR ALTER VIEW dbo.VistaDepartamentosPorRegionOcad
AS
SELECT r.OrdenVisualizacion AS OrdenRegion, r.NombreRegionOcad AS Region, d.CodigoDepartamento,
       (SELECT TOP (1) v.NombreDepartamento FROM dbo.Divipola AS v WHERE v.CodigoDepartamento = d.CodigoDepartamento) AS Departamento
FROM dbo.DepartamentosRegionOcad AS d
JOIN dbo.RegionesOcad AS r ON r.IdRegionOcad = d.RegionOcadId;
GO
