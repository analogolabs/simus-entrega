/*
    SIMUS · El idioma de una publicacion vive en un solo sitio

    HASTA HOY HABIA DOS COPIAS. La columna de texto `PublicacionesEditoriales.Idioma` («es ; en») y la relacion
    `PublicacionesEditorialesIdiomas` (una fila por idioma, con la clave del catalogo `Idiomas`). Dos copias de la misma
    verdad acaban discrepando y obligan a quien llega nuevo a preguntarse cual manda.

    AHORA MANDA LA RELACION. La API y el formulario leen y escriben codigos del catalogo; el texto desaparece.
    Esta migracion retira la columna despues de COMPROBAR que no se pierde nada:

      1. Repite el traslado (idempotente) del texto a la relacion: cada etiqueta se cruza con el catalogo por codigo, por
         codigo de dos letras o por nombre; `(lengua nativa)` pasa a `und`.
      2. SE NIEGA a seguir si alguna etiqueta del texto no se pudo reconocer (se perderia) o si alguna publicacion con
         texto se quedo sin ningun idioma en la relacion. La migracion falla entera y dice cuales.
      3. Retira la columna.

    En una base nueva la columna esta vacia y no hay nada que comprobar. Idempotente.
*/
SET NOCOUNT ON;
GO

IF COL_LENGTH(N'dbo.PublicacionesEditoriales', N'Idioma') IS NOT NULL
BEGIN
    -- 1. Traslado (por si se creo o edito algo despues del primero).
    EXEC (N'
    ;WITH t AS (
        SELECT p.IdPublicacionEditorial AS Id, LTRIM(RTRIM(p.Idioma)) AS Txt
        FROM dbo.PublicacionesEditoriales AS p
        WHERE p.Idioma IS NOT NULL AND LTRIM(RTRIM(p.Idioma)) <> N''''
    ), a AS (
        SELECT Id, 1 AS N,
               LTRIM(RTRIM(CASE WHEN CHARINDEX(N'';'', Txt) > 0 THEN LEFT(Txt, CHARINDEX(N'';'', Txt) - 1) ELSE Txt END)) AS Tok,
               CASE WHEN CHARINDEX(N'';'', Txt) > 0 THEN SUBSTRING(Txt, CHARINDEX(N'';'', Txt) + 1, 4000) END AS Resto
        FROM t
        UNION ALL
        SELECT Id, N + 1,
               LTRIM(RTRIM(CASE WHEN CHARINDEX(N'';'', Resto) > 0 THEN LEFT(Resto, CHARINDEX(N'';'', Resto) - 1) ELSE Resto END)),
               CASE WHEN CHARINDEX(N'';'', Resto) > 0 THEN SUBSTRING(Resto, CHARINDEX(N'';'', Resto) + 1, 4000) END
        FROM a WHERE Resto IS NOT NULL
    )
    INSERT INTO dbo.PublicacionesEditorialesIdiomas (PublicacionEditorialId, CodigoIdioma, Orden)
    SELECT x.Id, x.Codigo, MIN(x.N)
    FROM (
        SELECT a.Id, a.N, i.CodigoIdioma AS Codigo
        FROM a JOIN dbo.Idiomas AS i ON i.CodigoIdioma = a.Tok OR i.CodigoIso6391 = a.Tok OR i.NombreIdioma = a.Tok
        UNION ALL
        SELECT a.Id, a.N, N''und'' FROM a WHERE a.Tok = N''(lengua nativa)''
    ) AS x
    WHERE NOT EXISTS (SELECT 1 FROM dbo.PublicacionesEditorialesIdiomas r WHERE r.PublicacionEditorialId = x.Id AND r.CodigoIdioma = x.Codigo)
    GROUP BY x.Id, x.Codigo;');

    -- 2a. Ninguna etiqueta puede quedar sin reconocer.
    EXEC (N'
    DECLARE @sinReconocer nvarchar(max) = N'''';
    ;WITH t AS (
        SELECT p.IdPublicacionEditorial AS Id, LTRIM(RTRIM(p.Idioma)) AS Txt
        FROM dbo.PublicacionesEditoriales AS p
        WHERE p.Idioma IS NOT NULL AND LTRIM(RTRIM(p.Idioma)) <> N''''
    ), a AS (
        SELECT Id, 1 AS N,
               LTRIM(RTRIM(CASE WHEN CHARINDEX(N'';'', Txt) > 0 THEN LEFT(Txt, CHARINDEX(N'';'', Txt) - 1) ELSE Txt END)) AS Tok,
               CASE WHEN CHARINDEX(N'';'', Txt) > 0 THEN SUBSTRING(Txt, CHARINDEX(N'';'', Txt) + 1, 4000) END AS Resto
        FROM t
        UNION ALL
        SELECT Id, N + 1,
               LTRIM(RTRIM(CASE WHEN CHARINDEX(N'';'', Resto) > 0 THEN LEFT(Resto, CHARINDEX(N'';'', Resto) - 1) ELSE Resto END)),
               CASE WHEN CHARINDEX(N'';'', Resto) > 0 THEN SUBSTRING(Resto, CHARINDEX(N'';'', Resto) + 1, 4000) END
        FROM a WHERE Resto IS NOT NULL
    )
    SELECT @sinReconocer = @sinReconocer + CONCAT(a.Tok, N''; '')
    FROM (SELECT DISTINCT Tok FROM a WHERE Tok <> N'''') AS a
    WHERE a.Tok <> N''(lengua nativa)''
      AND NOT EXISTS (SELECT 1 FROM dbo.Idiomas i WHERE i.CodigoIdioma = a.Tok OR i.CodigoIso6391 = a.Tok OR i.NombreIdioma = a.Tok);
    IF @sinReconocer <> N'''' THROW 51040, ''Hay etiquetas de idioma sin reconocer en PublicacionesEditoriales.Idioma: se perderian. Corregirlas antes de migrar.'', 1;');

    -- 2b. Ninguna publicacion con texto puede quedarse sin idiomas.
    EXEC (N'
    IF EXISTS (SELECT 1 FROM dbo.PublicacionesEditoriales p
               WHERE p.Idioma IS NOT NULL AND LTRIM(RTRIM(p.Idioma)) <> N''''
                 AND NOT EXISTS (SELECT 1 FROM dbo.PublicacionesEditorialesIdiomas r WHERE r.PublicacionEditorialId = p.IdPublicacionEditorial))
        THROW 51041, ''Hay publicaciones con idioma escrito y sin ningun idioma en la relacion. No se retira la columna.'', 1;');

    -- 3. La columna.
    ALTER TABLE dbo.PublicacionesEditoriales DROP COLUMN Idioma;
END
GO
