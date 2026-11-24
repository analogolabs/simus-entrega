/*
    SIMUS · Idiomas: estructura minima

    POR QUE. El catalogo habia crecido a 16 columnas, varias de las cuales decian lo mismo de distinta forma. Para
    quien llegue de nuevo tiene que ser claro; la trazabilidad se conserva, pero en el lugar donde cuesta menos.
    Ahora un idioma es:  un CODIGO, un NOMBRE, su CATEGORIA, su estado de VERIFICACION, las dos equivalencias que
    se usan de verdad (ISO 639-1 y MARC), una nota y si esta ACTIVO. Son 8 columnas.

    QUE SE CONSERVA
      - `CodigoIdioma`: la clave (ISO 639-3, o un codigo propio qaa–qtz).
      - `NombreIdioma`: EL NOMBRE. Es lo que se llama desde cualquier formulario o pantalla.
      - `Ambito`: la categoria (oficial, extranjero, indigena, criolla, senas, romani, especial): agrupa el desplegable.
      - `Verificacion`: verificado, inferido, por_verificar o codigo_propio. Una restriccion obliga a que un codigo
        propio este en el rango privado qaa–qtz y a que uno oficial no lo este.
      - `CodigoIso6391`: la etiqueta de dos letras para la web (`lang`) y para reconocer lo que llegue escrito asi.
      - `CodigoMarc`: el codigo que se usa al exportar a MARC. Es el propio (ISO 639-2/B) si la lengua lo tiene y, si no,
        el de grupo (`sai`, `sgn`, `cpe`, `crp`): antes eran dos columnas.
      - `Descripcion` y `Activo`.

    QUE SE RETIRA Y POR QUE
      - `EtiquetaBcp47`: se deduce (la de dos letras si existe, si no el codigo); no se guarda dos veces.
      - `AlcanceIso`, `OrigenCodigo`, `ReemplazadoPor`, `OrdenVisualizacion`: no los usaba nadie. El origen de un codigo
        propio ya lo dice `Verificacion = codigo_propio`; el orden es el alfabetico por nombre; sustituir un codigo
        propio por uno oficial se hara con una migracion cuando exista.
      - `NombreSil` y `NombreOficialColombia`: pasan a la tabla `IdiomasNombres` (abajo), donde son nombres alternos con su
        origen. La trazabilidad se conserva: sigue sabiendose como lo llama SIL y como lo llama el Ministerio.

    LA TABLA NUEVA `IdiomasNombres` (CodigoIdioma, Nombre, Origen). Los otros nombres de un idioma: el de referencia de
    SIL (`sil`), los alternos que SIL registra para 43 idiomas, y el de la lista del Ministerio de Cultura cuando difiere
    (`ministerio`). Es la forma que el proyecto usa para lo que tiene varios valores (una tabla de relacion, no una lista
    en una columna). Sirve para buscar: «Spanish» o «Awa-Cuaiquer» encuentran su idioma.

    Idempotente: cada paso comprueba antes si hace falta.
*/
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Los otros nombres, en su tabla.
IF OBJECT_ID(N'dbo.IdiomasNombres', N'U') IS NULL
    CREATE TABLE dbo.IdiomasNombres (
        CodigoIdioma nvarchar(3) NOT NULL,
        Nombre nvarchar(160) NOT NULL,
        Origen nvarchar(12) NOT NULL,
        CONSTRAINT PK_IdiomasNombres PRIMARY KEY (CodigoIdioma, Nombre),
        CONSTRAINT FK_IdiomasNombres_Idioma FOREIGN KEY (CodigoIdioma) REFERENCES dbo.Idiomas (CodigoIdioma),
        CONSTRAINT CK_IdiomasNombres_Origen CHECK (Origen IN (N'sil', N'ministerio')));
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IdiomasNombres_Nombre' AND object_id = OBJECT_ID(N'dbo.IdiomasNombres'))
    CREATE INDEX IX_IdiomasNombres_Nombre ON dbo.IdiomasNombres (Nombre);
GO

-- 2. Lo que hoy esta en las columnas que se retiran, a la tabla (solo si las columnas aun existen).
IF COL_LENGTH(N'dbo.Idiomas', N'NombreSil') IS NOT NULL
    EXEC (N'INSERT INTO dbo.IdiomasNombres (CodigoIdioma, Nombre, Origen)
            SELECT i.CodigoIdioma, i.NombreSil, N''sil'' FROM dbo.Idiomas i
            WHERE i.NombreSil IS NOT NULL AND i.NombreSil <> i.NombreIdioma
              AND NOT EXISTS (SELECT 1 FROM dbo.IdiomasNombres n WHERE n.CodigoIdioma = i.CodigoIdioma AND n.Nombre = i.NombreSil);');
GO
IF COL_LENGTH(N'dbo.Idiomas', N'NombreOficialColombia') IS NOT NULL
    EXEC (N'INSERT INTO dbo.IdiomasNombres (CodigoIdioma, Nombre, Origen)
            SELECT i.CodigoIdioma, i.NombreOficialColombia, N''ministerio'' FROM dbo.Idiomas i
            WHERE i.NombreOficialColombia IS NOT NULL AND i.NombreOficialColombia <> i.NombreIdioma
              AND NOT EXISTS (SELECT 1 FROM dbo.IdiomasNombres n WHERE n.CodigoIdioma = i.CodigoIdioma AND n.Nombre = i.NombreOficialColombia);');
GO

-- 3. Los nombres alternos que la tabla de SIL registra (43 idiomas).
INSERT INTO dbo.IdiomasNombres (CodigoIdioma, Nombre, Origen)
SELECT v.CodigoIdioma, v.Nombre, N'sil' FROM (VALUES
    (N'cat', N'Valencian'),
    (N'chu', N'Bulgarian, Old'),
    (N'chu', N'Church Slavonic'),
    (N'chu', N'Old Bulgarian'),
    (N'chu', N'Old Church Slavonic'),
    (N'chu', N'Old Slavonic'),
    (N'chu', N'Slavic, Church'),
    (N'chu', N'Slavonic, Church'),
    (N'chu', N'Slavonic, Old'),
    (N'chu', N'Slavonic, Old Church'),
    (N'div', N'Maldivian'),
    (N'ell', N'Greek, Modern (1453-)'),
    (N'emp', N'Emberá, Northern'),
    (N'fry', N'Frisian, Western'),
    (N'gla', N'Gaelic'),
    (N'gla', N'Gaelic, Scottish'),
    (N'hat', N'Creole, Haitian'),
    (N'hat', N'Haitian Creole'),
    (N'hto', N'Huitoto, Minica'),
    (N'huu', N'Huitoto, Murui'),
    (N'hux', N'Huitoto, Nüpode'),
    (N'icr', N'Creole English, Islander'),
    (N'iii', N'Nuosu'),
    (N'iii', N'Yi, Sichuan'),
    (N'ile', N'Occidental'),
    (N'ina', N'Interlingua (International Auxiliary Language Association)'),
    (N'kal', N'Greenlandic'),
    (N'khm', N'Central Khmer'),
    (N'khm', N'Khmer, Central'),
    (N'kik', N'Gikuyu'),
    (N'kir', N'Kyrgyz'),
    (N'kog', N'Kogi'),
    (N'kua', N'Kwanyama'),
    (N'kvn', N'Kuna, Border'),
    (N'lim', N'Limburger'),
    (N'lim', N'Limburgish'),
    (N'ltz', N'Letzeburgesch'),
    (N'nav', N'Navaho'),
    (N'nbl', N'Ndebele, South'),
    (N'nde', N'Ndebele, North'),
    (N'nld', N'Flemish'),
    (N'nya', N'Chewa'),
    (N'oss', N'Iron'),
    (N'oss', N'Iron Ossetian'),
    (N'oss', N'Ossetian'),
    (N'oss', N'Ossetian, Iron'),
    (N'oss', N'Ossetic'),
    (N'oss', N'Ossetic, Iron'),
    (N'pan', N'Punjabi'),
    (N'pus', N'Pashto'),
    (N'ron', N'Moldavian'),
    (N'ron', N'Moldovan'),
    (N'sin', N'Sinhalese'),
    (N'sme', N'Sami, Northern'),
    (N'sot', N'Sotho, Southern'),
    (N'spa', N'Castilian'),
    (N'tnb', N'Tunebo, Western'),
    (N'tnd', N'Tunebo, Angosturas'),
    (N'tuf', N'Tunebo, Central'),
    (N'uig', N'Uyghur'),
    (N'zha', N'Chuang'),
    (N'zxx', N'Not applicable')
) AS v (CodigoIdioma, Nombre)
WHERE EXISTS (SELECT 1 FROM dbo.Idiomas i WHERE i.CodigoIdioma = v.CodigoIdioma)
  AND NOT EXISTS (SELECT 1 FROM dbo.IdiomasNombres n WHERE n.CodigoIdioma = v.CodigoIdioma AND n.Nombre = v.Nombre);
GO

-- 4. Un solo codigo MARC: el propio y, si no tiene, el de grupo.
IF COL_LENGTH(N'dbo.Idiomas', N'CodigoMarcGrupo') IS NOT NULL
    EXEC (N'UPDATE dbo.Idiomas SET CodigoMarc = CodigoMarcGrupo WHERE CodigoMarc IS NULL AND CodigoMarcGrupo IS NOT NULL;');
GO

-- 5. Se retiran las restricciones que dependian de las columnas sobrantes, y luego las columnas.
DECLARE @Quitar TABLE (Tipo nvarchar(10), Nombre nvarchar(128));
INSERT INTO @Quitar VALUES (N'CK', N'CK_Idiomas_CodigoPropio'), (N'CK', N'CK_Idiomas_Origen'), (N'CK', N'CK_Idiomas_Alcance'),
    (N'CK', N'CK_Idiomas_Orden'), (N'UQ', N'UQ_Idiomas_EtiquetaBcp47'), (N'FK', N'FK_Idiomas_ReemplazadoPor'),
    (N'DF', N'DF_Idiomas_OrigenCodigo');
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + N'ALTER TABLE dbo.Idiomas DROP CONSTRAINT ' + QUOTENAME(o.name) + N';'
FROM sys.objects o
JOIN @Quitar q ON q.Nombre = o.name COLLATE DATABASE_DEFAULT
WHERE o.parent_object_id = OBJECT_ID(N'dbo.Idiomas');
IF @sql <> N'' EXEC (@sql);
GO
DECLARE @columnas nvarchar(max) = N'';
SELECT @columnas = @columnas + N'ALTER TABLE dbo.Idiomas DROP COLUMN ' + QUOTENAME(c.name) + N';'
FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.Idiomas')
  AND c.name COLLATE DATABASE_DEFAULT IN (N'EtiquetaBcp47', N'NombreSil', N'NombreOficialColombia', N'AlcanceIso', N'OrdenVisualizacion', N'OrigenCodigo',
                 N'ReemplazadoPor', N'CodigoMarcGrupo');
IF @columnas <> N'' EXEC (@columnas);
GO

-- 6. La restriccion del codigo propio, ahora sobre `Verificacion`.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Idiomas_CodigoPropio')
    ALTER TABLE dbo.Idiomas ADD CONSTRAINT CK_Idiomas_CodigoPropio CHECK (
        (Verificacion = N'codigo_propio' AND CodigoIdioma >= N'qaa' AND CodigoIdioma <= N'qtz')
     OR (Verificacion <> N'codigo_propio' AND NOT (CodigoIdioma >= N'qaa' AND CodigoIdioma <= N'qtz')));
GO
