/*
    SIMUS · Idiomas: codigo propio para las lenguas nativas sin codigo ISO 639-3

    EL PROBLEMA. La lista de lenguas nativas del Ministerio de Cultura trae seis para las que NO se hallo un
    codigo ISO 639-3 en la tabla de SIL: Kichwa, Miraña, Pisamira, Taiwano, Tucuná y Yanuro. La clave del
    catalogo es el codigo de tres letras, asi que sin codigo no podian entrar.

    LA DECISION (7-oct-2026, a pedido del usuario: «que esten dentro del catalogo»). Se les da un codigo
    PROPIO de SIMUS tomado del RANGO DE USO PRIVADO, que existe justamente para esto:
      - IANA, registro de subetiquetas de idioma: «Subtag: qaa..qtz — Description: Private use —
        Scope: private-use» (corte 2026-09-17).
      - RFC 5646 (BCP 47): «The subtags in the range 'qaa' through 'qtz' are reserved for private use».
      - ISO 639-2 y 639-3 reservan el mismo rango. Se comprobo contra la tabla de SIL: ninguno de sus 7.927
        codigos cae en qaa–qtz, de modo que un codigo propio NUNCA puede chocar con uno oficial.
    Asignacion: en orden alfabetico, qaa a qaf. Un codigo propio no se reutiliza ni se reasigna.

    COMO SE DISTINGUE UN CODIGO PROPIO DE UNO OFICIAL (columnas nuevas y restricciones):
      - `OrigenCodigo`: `iso639_3` (el de SIL) o `simus` (propio). Una restriccion obliga a que un codigo
        `simus` este en el rango qaa–qtz y a que uno `iso639_3` NO lo este (se comprobo con inserciones de prueba).
      - `AlcanceIso` admite `P` (uso privado) ademas de I, M y S.
      - `Verificacion` admite `codigo_propio`: el NOMBRE de la lengua es oficial (lista del Ministerio) y el
        CODIGO es de SIMUS.
      - `NombreSil` pasa a admitir nulo: no hay nombre de SIL para un codigo que SIL no tiene.
      - `ReemplazadoPor` (clave foranea a la misma tabla): si un dia SIL asigna codigo a una de estas lenguas,
        se crea la fila con el codigo oficial, esta se desactiva y se anota aqui por cual se sustituye;
        las publicaciones ya relacionadas se mueven con un UPDATE.

    QUE SE CARGA. Las seis lenguas, ACTIVAS (el nombre es oficial), con el codigo de grupo MARC `sai` (indigenas
    suramericanas), como el resto de las lenguas indigenas. Cada fila dice en su descripcion por que no tiene
    codigo y la pista, SIN CONFIRMAR, de a cual podria corresponder.

    LO QUE NO SE HACE. No se asigna a ninguna de ellas un codigo ISO «parecido»: afirmarlo sin confirmacion del
    Ministerio o del Instituto Caro y Cuervo seria inventar un dato. Cuando se confirme, se sustituye.

    Idempotente.
*/
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Estructura.
ALTER TABLE dbo.Idiomas ALTER COLUMN NombreSil nvarchar(160) NULL;
GO
IF COL_LENGTH(N'dbo.Idiomas', N'OrigenCodigo') IS NULL
    ALTER TABLE dbo.Idiomas ADD OrigenCodigo nvarchar(12) NOT NULL CONSTRAINT DF_Idiomas_OrigenCodigo DEFAULT (N'iso639_3');
GO
IF COL_LENGTH(N'dbo.Idiomas', N'ReemplazadoPor') IS NULL
    ALTER TABLE dbo.Idiomas ADD ReemplazadoPor nvarchar(3) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Idiomas_ReemplazadoPor')
    ALTER TABLE dbo.Idiomas ADD CONSTRAINT FK_Idiomas_ReemplazadoPor FOREIGN KEY (ReemplazadoPor) REFERENCES dbo.Idiomas (CodigoIdioma);
GO
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Idiomas_Alcance' AND definition NOT LIKE N'%''P''%')
    ALTER TABLE dbo.Idiomas DROP CONSTRAINT CK_Idiomas_Alcance;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Idiomas_Alcance')
    ALTER TABLE dbo.Idiomas ADD CONSTRAINT CK_Idiomas_Alcance CHECK (AlcanceIso IN (N'I', N'M', N'S', N'P'));
GO
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Idiomas_Verificacion' AND definition NOT LIKE N'%codigo_propio%')
    ALTER TABLE dbo.Idiomas DROP CONSTRAINT CK_Idiomas_Verificacion;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Idiomas_Verificacion')
    ALTER TABLE dbo.Idiomas ADD CONSTRAINT CK_Idiomas_Verificacion CHECK (Verificacion IN (N'verificado', N'inferido', N'por_verificar', N'codigo_propio'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Idiomas_Origen')
    ALTER TABLE dbo.Idiomas ADD CONSTRAINT CK_Idiomas_Origen CHECK (OrigenCodigo IN (N'iso639_3', N'simus'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Idiomas_CodigoPropio')
    ALTER TABLE dbo.Idiomas ADD CONSTRAINT CK_Idiomas_CodigoPropio CHECK (
        (OrigenCodigo = N'simus'    AND AlcanceIso = N'P' AND CodigoIdioma >= N'qaa' AND CodigoIdioma <= N'qtz')
     OR (OrigenCodigo = N'iso639_3' AND AlcanceIso <> N'P' AND NOT (CodigoIdioma >= N'qaa' AND CodigoIdioma <= N'qtz')));
GO

-- 2. Las seis lenguas.
INSERT INTO dbo.Idiomas (CodigoIdioma, CodigoIso6391, CodigoMarc, CodigoMarcGrupo, EtiquetaBcp47, NombreIdioma, NombreSil,
                         NombreOficialColombia, AlcanceIso, Ambito, Verificacion, Descripcion, OrdenVisualizacion, Activo, OrigenCodigo)
SELECT v.CodigoIdioma, NULL, NULL, v.CodigoMarcGrupo, v.EtiquetaBcp47, v.NombreIdioma, NULL, v.NombreOficialColombia,
       N'P', v.Ambito, v.Verificacion, v.Descripcion, v.OrdenVisualizacion, 1, N'simus'
FROM (VALUES
    (N'qaa', N'sai', N'qaa', N'Kichwa', N'Kichwa', N'indigena', N'codigo_propio', N'Lengua de la lista del Ministerio de Cultura sin código ISO 639-3 verificado. Código de uso privado de SIMUS (rango qaa–qtz). Podría corresponder a una variedad de quechua (por ejemplo qvo, Napo Lowland Quechua); no se confirmó.', 87),
    (N'qab', N'sai', N'qab', N'Miraña', N'Miraña', N'indigena', N'codigo_propio', N'Lengua de la lista del Ministerio de Cultura sin código ISO 639-3 verificado. Código de uso privado de SIMUS (rango qaa–qtz). En la tabla de SIL no tiene código propio; podría estar incluida en Bora (boa). Sin confirmar.', 88),
    (N'qac', N'sai', N'qac', N'Pisamira', N'Pisamira', N'indigena', N'codigo_propio', N'Lengua de la lista del Ministerio de Cultura sin código ISO 639-3 verificado. Código de uso privado de SIMUS (rango qaa–qtz). No se halló código en la tabla de SIL.', 89),
    (N'qad', N'sai', N'qad', N'Taiwano', N'Taiwano', N'indigena', N'codigo_propio', N'Lengua de la lista del Ministerio de Cultura sin código ISO 639-3 verificado. Código de uso privado de SIMUS (rango qaa–qtz). No se halló código; podría estar cerca de Barasano (bsn). Sin confirmar.', 90),
    (N'qae', N'sai', N'qae', N'Tucuná', N'Tucuná', N'indigena', N'codigo_propio', N'Lengua de la lista del Ministerio de Cultura sin código ISO 639-3 verificado. Código de uso privado de SIMUS (rango qaa–qtz). No se halló código; posible duplicado de Tikuna (tca). Sin confirmar.', 91),
    (N'qaf', N'sai', N'qaf', N'Yanuro', N'Yanuro', N'indigena', N'codigo_propio', N'Lengua de la lista del Ministerio de Cultura sin código ISO 639-3 verificado. Código de uso privado de SIMUS (rango qaa–qtz). No se halló código en la tabla de SIL.', 92)
) AS v (CodigoIdioma, CodigoMarcGrupo, EtiquetaBcp47, NombreIdioma, NombreOficialColombia, Ambito, Verificacion, Descripcion, OrdenVisualizacion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Idiomas t WHERE t.CodigoIdioma = v.CodigoIdioma);
GO
