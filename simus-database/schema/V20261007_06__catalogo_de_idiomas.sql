/*
    SIMUS · Catalogo de idiomas (ISO 639-3)

    QUE CREA.
      - `Idiomas`: el catalogo. La CLAVE es el codigo ISO 639-3 (tres letras), porque es el unico estandar
        que cubre a la vez el espanol, los idiomas extranjeros y las lenguas nativas de Colombia. Las
        demas codificaciones viajan como EQUIVALENCIAS: ISO 639-1 (dos letras), el codigo MARC de la
        Biblioteca del Congreso (para exportar el catalogo editorial) y la etiqueta BCP 47 (para la web).
      - `PublicacionesEditorialesIdiomas`: la relacion varios a varios entre una publicacion y sus idiomas,
        que sustituye a la cadena «es ; en».

    LO QUE NO TOCA. La columna de texto `PublicacionesEditoriales.Idioma` SIGUE EXISTIENDO y es la que lee
    y escribe hoy la API y el formulario. Ya guarda etiquetas BCP 47 (`es`, `en`), asi que no hace falta
    convertirla. La API mantiene la relacion al guardar (ver `CatalogoEditorialEndpoints`).

    DE DONDE SALE CADA DATO (consultado el 7-oct-2026)
      - Codigos, nombres de referencia, equivalencias ISO 639-1/-2 y alcance (individual, macrolengua o
        especial): tabla oficial de SIL Global, `iso-639-3.tab`, 7.927 filas. Cada codigo de este guion se
        comprobo contra esa tabla antes de escribirlo.
      - Codigos MARC: «MARC Code List for Languages», Biblioteca del Congreso. MARC usa ISO 639-2/B
        (`fre`, `ger`, `dut`). Las lenguas nativas no tienen codigo MARC propio: se les da el de GRUPO
        que MARC si define (`sai`, `sgn`, `cpe`, `crp`) en `CodigoMarcGrupo`; es el que se usa al exportar,
        no una asignacion de la Biblioteca del Congreso a esa lengua.
      - Etiqueta BCP 47: la de dos letras si existe y si no la de tres (guia de la W3C y registro IANA).
      - Lenguas nativas: la lista del Ministerio de Cultura (65 indigenas, 2 criollas y el romani) segun la
        pagina de Colombia Aprende que la cita. NO se contrasto con el Ministerio ni con el Instituto Caro y
        Cuervo; la Ley 1381 de 2010 no se leyo. El cruce nombre -> codigo se hizo por coincidencia de
        nombre con la tabla de SIL.

    COLUMNA `Verificacion`
      verificado     el codigo existe en SIL y su nombre coincide con el de la lista oficial.
      inferido       el codigo existe pero la equivalencia con el nombre oficial es una inferencia.
      por_verificar  hay un codigo candidato que NO se pudo confirmar para ese pueblo: se carga INACTIVO.
    Quedan FUERA, por no tener codigo hallado: Kichwa, Miraña, Pisamira, Taiwano, Tucuná y Yanuro.

    Idempotente.
*/
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Idiomas', N'U') IS NULL
    CREATE TABLE dbo.Idiomas (
        CodigoIdioma nvarchar(3) NOT NULL,
        CodigoIso6391 nvarchar(2) NULL,
        CodigoMarc nvarchar(3) NULL,
        CodigoMarcGrupo nvarchar(3) NULL,
        EtiquetaBcp47 nvarchar(8) NOT NULL,
        NombreIdioma nvarchar(160) NOT NULL,
        NombreSil nvarchar(160) NOT NULL,
        NombreOficialColombia nvarchar(160) NULL,
        AlcanceIso nchar(1) NOT NULL,
        Ambito nvarchar(20) NOT NULL,
        Verificacion nvarchar(20) NOT NULL,
        Descripcion nvarchar(600) NULL,
        OrdenVisualizacion int NOT NULL,
        Activo bit NOT NULL CONSTRAINT DF_Idiomas_Activo DEFAULT (1),
        CONSTRAINT PK_Idiomas PRIMARY KEY (CodigoIdioma),
        CONSTRAINT UQ_Idiomas_EtiquetaBcp47 UNIQUE (EtiquetaBcp47),
        CONSTRAINT UQ_Idiomas_Nombre UNIQUE (NombreIdioma),
        CONSTRAINT CK_Idiomas_Alcance CHECK (AlcanceIso IN (N'I', N'M', N'S')),
        CONSTRAINT CK_Idiomas_Ambito CHECK (Ambito IN (N'oficial', N'extranjero', N'indigena', N'criolla', N'senas', N'romani', N'especial')),
        CONSTRAINT CK_Idiomas_Verificacion CHECK (Verificacion IN (N'verificado', N'inferido', N'por_verificar')),
        CONSTRAINT CK_Idiomas_Orden CHECK (OrdenVisualizacion > 0));
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Idiomas_Iso6391' AND object_id = OBJECT_ID(N'dbo.Idiomas'))
    CREATE UNIQUE INDEX UX_Idiomas_Iso6391 ON dbo.Idiomas (CodigoIso6391) WHERE CodigoIso6391 IS NOT NULL;
GO

INSERT INTO dbo.Idiomas (CodigoIdioma, CodigoIso6391, CodigoMarc, CodigoMarcGrupo, EtiquetaBcp47, NombreIdioma, NombreSil,
                         NombreOficialColombia, AlcanceIso, Ambito, Verificacion, Descripcion, OrdenVisualizacion, Activo)
SELECT v.* FROM (VALUES
    (N'spa', N'es', N'spa', NULL, N'es', N'Español', N'Spanish', NULL, N'I', N'oficial', N'verificado', NULL, 1, 1),
    (N'eng', N'en', N'eng', NULL, N'en', N'Inglés', N'English', NULL, N'I', N'extranjero', N'verificado', NULL, 2, 1),
    (N'fra', N'fr', N'fre', NULL, N'fr', N'Francés', N'French', NULL, N'I', N'extranjero', N'verificado', NULL, 3, 1),
    (N'por', N'pt', N'por', NULL, N'pt', N'Portugués', N'Portuguese', NULL, N'I', N'extranjero', N'verificado', NULL, 4, 1),
    (N'deu', N'de', N'ger', NULL, N'de', N'Alemán', N'German', NULL, N'I', N'extranjero', N'verificado', NULL, 5, 1),
    (N'ita', N'it', N'ita', NULL, N'it', N'Italiano', N'Italian', NULL, N'I', N'extranjero', N'verificado', NULL, 6, 1),
    (N'lat', N'la', N'lat', NULL, N'la', N'Latín', N'Latin', NULL, N'I', N'extranjero', N'verificado', NULL, 7, 1),
    (N'cat', N'ca', N'cat', NULL, N'ca', N'Catalán', N'Catalan', NULL, N'I', N'extranjero', N'verificado', NULL, 8, 1),
    (N'nld', N'nl', N'dut', NULL, N'nl', N'Neerlandés', N'Dutch', NULL, N'I', N'extranjero', N'verificado', NULL, 9, 1),
    (N'rus', N'ru', N'rus', NULL, N'ru', N'Ruso', N'Russian', NULL, N'I', N'extranjero', N'verificado', NULL, 10, 1),
    (N'mul', NULL, N'mul', NULL, N'mul', N'Varios idiomas', N'Multiple languages', NULL, N'S', N'especial', N'verificado', N'Publicación plurilingüe cuando no conviene enumerar.', 11, 1),
    (N'und', NULL, N'und', NULL, N'und', N'Indeterminado', N'Undetermined', NULL, N'S', N'especial', N'verificado', N'El idioma existe pero no se ha determinado.', 12, 1),
    (N'zxx', NULL, N'zxx', NULL, N'zxx', N'Sin contenido lingüístico', N'No linguistic content', NULL, N'S', N'especial', N'verificado', N'Por ejemplo, música instrumental.', 13, 1),
    (N'mis', NULL, N'mis', NULL, N'mis', N'Otros idiomas', N'Uncoded languages', NULL, N'S', N'especial', N'verificado', N'Idioma sin código propio.', 14, 1),
    (N'aca', NULL, NULL, N'sai', N'aca', N'Achagua', N'Achagua', N'Achagua', N'I', N'indigena', N'verificado', NULL, 15, 1),
    (N'ano', NULL, NULL, N'sai', N'ano', N'Andoque', N'Andoque', N'Andoque', N'I', N'indigena', N'verificado', NULL, 16, 1),
    (N'kwi', NULL, NULL, N'sai', N'kwi', N'Awapit', N'Awa-Cuaiquer', N'Awapit', N'I', N'indigena', N'inferido', NULL, 17, 1),
    (N'bsn', NULL, NULL, N'sai', N'bsn', N'Barasano', N'Barasana-Eduria', N'Barasano', N'I', N'indigena', N'verificado', NULL, 18, 1),
    (N'mot', NULL, NULL, N'sai', N'mot', N'Barí', N'Barí', N'Barí', N'I', N'indigena', N'verificado', NULL, 19, 1),
    (N'boa', NULL, NULL, N'sai', N'boa', N'Bora', N'Bora', N'Bora', N'I', N'indigena', N'verificado', NULL, 20, 1),
    (N'cbb', NULL, NULL, N'sai', N'cbb', N'Cabiyarí', N'Cabiyarí', N'Cabiyarí', N'I', N'indigena', N'verificado', NULL, 21, 1),
    (N'cbc', NULL, NULL, N'sai', N'cbc', N'Carapana', N'Carapana', N'Carapana', N'I', N'indigena', N'verificado', NULL, 22, 1),
    (N'cbd', NULL, NULL, N'sai', N'cbd', N'Carijona', N'Carijona', N'Carijona', N'I', N'indigena', N'verificado', NULL, 23, 1),
    (N'cod', NULL, NULL, N'sai', N'cod', N'Cocama', N'Cocama-Cocamilla', N'Cocama', N'I', N'indigena', N'verificado', NULL, 24, 1),
    (N'con', NULL, NULL, N'sai', N'con', N'Cofán', N'Cofán', N'Cofán', N'I', N'indigena', N'verificado', NULL, 25, 1),
    (N'cui', NULL, NULL, N'sai', N'cui', N'Cuiba', N'Cuiba', N'Cuiba', N'I', N'indigena', N'verificado', NULL, 26, 1),
    (N'kpc', NULL, NULL, N'sai', N'kpc', N'Curripaco', N'Curripaco', N'Curripaco', N'I', N'indigena', N'verificado', NULL, 27, 1),
    (N'des', NULL, NULL, N'sai', N'des', N'Desano', N'Desano', N'Desano', N'I', N'indigena', N'verificado', NULL, 28, 1),
    (N'cto', NULL, NULL, N'sai', N'cto', N'Emberá catío', N'Emberá-Catío', N'Embera', N'I', N'indigena', N'verificado', NULL, 29, 1),
    (N'emp', NULL, NULL, N'sai', N'emp', N'Emberá del norte', N'Northern Emberá', N'Embera', N'I', N'indigena', N'verificado', NULL, 30, 1),
    (N'tdc', NULL, NULL, N'sai', N'tdc', N'Emberá tadó', N'Emberá-Tadó', N'Embera', N'I', N'indigena', N'verificado', NULL, 31, 1),
    (N'bdc', NULL, NULL, N'sai', N'bdc', N'Emberá baudó', N'Emberá-Baudó', N'Embera', N'I', N'indigena', N'verificado', NULL, 32, 1),
    (N'cmi', NULL, NULL, N'sai', N'cmi', N'Emberá chamí', N'Emberá-Chamí', N'Embera', N'I', N'indigena', N'verificado', NULL, 33, 1),
    (N'guo', NULL, NULL, N'sai', N'guo', N'Guayabero', N'Guayabero', N'Guayabero', N'I', N'indigena', N'verificado', NULL, 34, 1),
    (N'arh', NULL, NULL, N'sai', N'arh', N'Ika', N'Arhuaco', N'Ika', N'I', N'indigena', N'verificado', NULL, 35, 1),
    (N'inb', NULL, NULL, N'sai', N'inb', N'Inga', N'Inga', N'Inga', N'I', N'indigena', N'verificado', NULL, 36, 1),
    (N'cbv', NULL, NULL, N'sai', N'cbv', N'Kakua', N'Cacua', N'Kakua', N'I', N'indigena', N'verificado', NULL, 37, 1),
    (N'kbh', NULL, NULL, N'sai', N'kbh', N'Kamsá', N'Camsá', N'Kamsá', N'I', N'indigena', N'verificado', NULL, 38, 1),
    (N'kog', NULL, NULL, N'sai', N'kog', N'Kogui', N'Cogui', N'Kogui', N'I', N'indigena', N'verificado', NULL, 39, 1),
    (N'coe', NULL, NULL, N'sai', N'coe', N'Koreguaje', N'Koreguaje', N'Koreguaje', N'I', N'indigena', N'verificado', NULL, 40, 1),
    (N'cub', NULL, NULL, N'sai', N'cub', N'Kubeo', N'Cubeo', N'Kubeo', N'I', N'indigena', N'verificado', NULL, 41, 1),
    (N'myy', NULL, NULL, N'sai', N'myy', N'Macuna', N'Macuna', N'Macuna', N'I', N'indigena', N'verificado', NULL, 42, 1),
    (N'bmr', NULL, NULL, N'sai', N'bmr', N'Muinane', N'Muinane', N'Muinane', N'I', N'indigena', N'verificado', NULL, 43, 1),
    (N'gum', NULL, NULL, N'sai', N'gum', N'Namtrik', N'Guambiano', N'Namtrik', N'I', N'indigena', N'inferido', NULL, 44, 1),
    (N'pbb', NULL, NULL, N'sai', N'pbb', N'Nasa Yuwe', N'Páez', N'Nasa-Yuwe', N'I', N'indigena', N'verificado', NULL, 45, 1),
    (N'noj', NULL, NULL, N'sai', N'noj', N'Nonuya', N'Nonuya', N'Nonuya', N'I', N'indigena', N'verificado', NULL, 46, 1),
    (N'mbr', NULL, NULL, N'sai', N'mbr', N'Nukak', N'Nukak Makú', N'Nukak', N'I', N'indigena', N'verificado', NULL, 47, 1),
    (N'oca', NULL, NULL, N'sai', N'oca', N'Ocaina', N'Ocaina', N'Ocaina', N'I', N'indigena', N'verificado', NULL, 48, 1),
    (N'pio', NULL, NULL, N'sai', N'pio', N'Piapoco', N'Piapoco', N'Piapoco', N'I', N'indigena', N'verificado', NULL, 49, 1),
    (N'pid', NULL, NULL, N'sai', N'pid', N'Piaroa', N'Piaroa', N'Piaroa', N'I', N'indigena', N'verificado', NULL, 50, 1),
    (N'pir', NULL, NULL, N'sai', N'pir', N'Piratapuyo', N'Piratapuyo', N'Piratapuyo', N'I', N'indigena', N'verificado', NULL, 51, 1),
    (N'pui', NULL, NULL, N'sai', N'pui', N'Puinave', N'Puinave', N'Puinave', N'I', N'indigena', N'verificado', NULL, 52, 1),
    (N'slc', NULL, NULL, N'sai', N'slc', N'Sáliba', N'Sáliba', N'Sáliba', N'I', N'indigena', N'verificado', NULL, 53, 1),
    (N'guh', NULL, NULL, N'sai', N'guh', N'Sikuani', N'Guahibo', N'Sikuani', N'I', N'indigena', N'inferido', NULL, 54, 1),
    (N'snn', NULL, NULL, N'sai', N'snn', N'Siona', N'Siona', N'Siona', N'I', N'indigena', N'verificado', NULL, 55, 1),
    (N'sri', NULL, NULL, N'sai', N'sri', N'Siriano', N'Siriano', N'Siriano', N'I', N'indigena', N'verificado', NULL, 56, 1),
    (N'tnc', NULL, NULL, N'sai', N'tnc', N'Tanimuca', N'Tanimuca-Retuarã', N'Tanimuca', N'I', N'indigena', N'verificado', NULL, 57, 1),
    (N'tae', NULL, NULL, N'sai', N'tae', N'Tariano', N'Tariana', N'Tariano', N'I', N'indigena', N'verificado', NULL, 58, 1),
    (N'tav', NULL, NULL, N'sai', N'tav', N'Tatuyo', N'Tatuyo', N'Tatuyo', N'I', N'indigena', N'verificado', NULL, 59, 1),
    (N'tca', NULL, NULL, N'sai', N'tca', N'Tikuna', N'Ticuna', N'Tikuna', N'I', N'indigena', N'verificado', NULL, 60, 1),
    (N'tit', NULL, NULL, N'sai', N'tit', N'Tinigua', N'Tinigua', N'Tinigua', N'I', N'indigena', N'verificado', NULL, 61, 1),
    (N'tuo', NULL, NULL, N'sai', N'tuo', N'Tucano', N'Tucano', N'Tucano', N'I', N'indigena', N'verificado', NULL, 62, 1),
    (N'tue', NULL, NULL, N'sai', N'tue', N'Tuyuca', N'Tuyuca', N'Tuyuca', N'I', N'indigena', N'verificado', NULL, 63, 1),
    (N'huu', NULL, NULL, N'sai', N'huu', N'Uitoto murui', N'Murui Huitoto', N'Uitoto', N'I', N'indigena', N'verificado', NULL, 64, 1),
    (N'hto', NULL, NULL, N'sai', N'hto', N'Uitoto minica', N'Minica Huitoto', N'Uitoto', N'I', N'indigena', N'verificado', NULL, 65, 1),
    (N'hux', NULL, NULL, N'sai', N'hux', N'Uitoto nüpode', N'Nüpode Huitoto', N'Uitoto', N'I', N'indigena', N'verificado', NULL, 66, 1),
    (N'gvc', NULL, NULL, N'sai', N'gvc', N'Wanano', N'Guanano', N'Wanano', N'I', N'indigena', N'verificado', NULL, 67, 1),
    (N'guc', NULL, NULL, N'sai', N'guc', N'Wayuunaiki', N'Wayuu', N'Wayuunaiki', N'I', N'indigena', N'verificado', NULL, 68, 1),
    (N'yad', NULL, NULL, N'sai', N'yad', N'Yagua', N'Yagua', N'Yagua', N'I', N'indigena', N'verificado', NULL, 69, 1),
    (N'yab', NULL, NULL, N'sai', N'yab', N'Yuhup', N'Yuhup', N'Yuhup', N'I', N'indigena', N'verificado', NULL, 70, 1),
    (N'yup', NULL, NULL, N'sai', N'yup', N'Yukpa', N'Yukpa', N'Yukpa', N'I', N'indigena', N'verificado', NULL, 71, 1),
    (N'yui', NULL, NULL, N'sai', N'yui', N'Yurutí', N'Yurutí', N'Yurutí', N'I', N'indigena', N'verificado', NULL, 72, 1),
    (N'bao', NULL, NULL, N'sai', N'bao', N'Bará', N'Waimaha', N'Bará', N'I', N'indigena', N'por_verificar', NULL, 73, 0),
    (N'mbp', NULL, NULL, N'sai', N'mbp', N'Damana', N'Malayo', N'Damana', N'I', N'indigena', N'por_verificar', NULL, 74, 0),
    (N'cbg', NULL, NULL, N'sai', N'cbg', N'Ette Naka', N'Chimila', N'Ette Naka', N'I', N'indigena', N'por_verificar', NULL, 75, 0),
    (N'mbn', NULL, NULL, N'sai', N'mbn', N'Hitnu', N'Macaguán', N'Hitnu', N'I', N'indigena', N'por_verificar', NULL, 76, 0),
    (N'kvn', NULL, NULL, N'sai', N'kvn', N'Kuna Tule', N'Border Kuna', N'Kuna Tule', N'I', N'indigena', N'por_verificar', NULL, 77, 0),
    (N'tnd', NULL, NULL, N'sai', N'tnd', N'Uwa angosturas', N'Angosturas Tunebo', N'Uwa', N'I', N'indigena', N'por_verificar', NULL, 78, 0),
    (N'tuf', NULL, NULL, N'sai', N'tuf', N'Uwa central', N'Central Tunebo', N'Uwa', N'I', N'indigena', N'por_verificar', NULL, 79, 0),
    (N'tnb', NULL, NULL, N'sai', N'tnb', N'Uwa occidental', N'Western Tunebo', N'Uwa', N'I', N'indigena', N'por_verificar', NULL, 80, 0),
    (N'noa', NULL, NULL, N'sai', N'noa', N'Wounaan', N'Woun Meu', N'Wounaan', N'I', N'indigena', N'por_verificar', NULL, 81, 0),
    (N'pln', NULL, NULL, N'crp', N'pln', N'Palenquero', N'Palenquero', N'Palenquero', N'I', N'criolla', N'verificado', NULL, 82, 1),
    (N'icr', NULL, NULL, N'cpe', N'icr', N'Criollo sanandresano', N'Islander Creole English', N'Lengua criolla de San Andrés, Providencia y Santa Catalina', N'I', N'criolla', N'inferido', N'Código por coincidencia de nombre («Islander Creole English»).', 83, 1),
    (N'rom', NULL, N'rom', NULL, N'rom', N'Romaní', N'Romany', N'Romaní', N'M', N'romani', N'verificado', N'Macrolengua en ISO 639-3; la variedad que se habla en Colombia no está verificada.', 84, 1),
    (N'csn', NULL, NULL, N'sgn', N'csn', N'Lengua de señas colombiana', N'Colombian Sign Language', NULL, N'I', N'senas', N'verificado', NULL, 85, 1),
    (N'prz', NULL, NULL, N'sgn', N'prz', N'Lengua de señas de Providencia', N'Providencia Sign Language', NULL, N'I', N'senas', N'verificado', N'Su reconocimiento oficial no se verificó.', 86, 1)
) AS v (CodigoIdioma, CodigoIso6391, CodigoMarc, CodigoMarcGrupo, EtiquetaBcp47, NombreIdioma, NombreSil,
        NombreOficialColombia, AlcanceIso, Ambito, Verificacion, Descripcion, OrdenVisualizacion, Activo)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Idiomas t WHERE t.CodigoIdioma = v.CodigoIdioma);
GO

/*
    LA RELACION. Sin cascada (regla de la base): las publicaciones no se borran, se archivan.
    `Orden` es la posicion en la lista: el primero es el idioma principal.
*/
IF OBJECT_ID(N'dbo.PublicacionesEditorialesIdiomas', N'U') IS NULL
    CREATE TABLE dbo.PublicacionesEditorialesIdiomas (
        PublicacionEditorialId bigint NOT NULL,
        CodigoIdioma nvarchar(3) NOT NULL,
        Orden int NOT NULL,
        CONSTRAINT PK_PublicacionesEditorialesIdiomas PRIMARY KEY (PublicacionEditorialId, CodigoIdioma),
        CONSTRAINT FK_PublicacionesEditorialesIdiomas_Publicacion FOREIGN KEY (PublicacionEditorialId)
            REFERENCES dbo.PublicacionesEditoriales (IdPublicacionEditorial),
        CONSTRAINT FK_PublicacionesEditorialesIdiomas_Idioma FOREIGN KEY (CodigoIdioma)
            REFERENCES dbo.Idiomas (CodigoIdioma),
        CONSTRAINT CK_PublicacionesEditorialesIdiomas_Orden CHECK (Orden > 0));
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PublicacionesEditorialesIdiomas_Idioma' AND object_id = OBJECT_ID(N'dbo.PublicacionesEditorialesIdiomas'))
    CREATE INDEX IX_PublicacionesEditorialesIdiomas_Idioma ON dbo.PublicacionesEditorialesIdiomas (CodigoIdioma);
GO

/*
    TRASLADO DE LO EXISTENTE. Cada publicacion guarda hoy una cadena con etiquetas separadas por «;».
    Se parte la cadena y cada etiqueta se cruza con el catalogo (por etiqueta BCP 47, por codigo de tres
    letras o por codigo de dos).
      - `(lengua nativa)` -> `und` (indeterminado): existe otro idioma pero nadie dijo cual. Hay que
        preguntarlo a quien cataloga; mientras tanto la relacion lo dice con honestidad.
      - Una etiqueta que no este en el catalogo NO se relaciona y se queda solo en el texto, como hasta hoy.
    El texto original no se modifica.
*/
;WITH t AS (
    SELECT p.IdPublicacionEditorial AS Id, LTRIM(RTRIM(p.Idioma)) AS Txt
    FROM dbo.PublicacionesEditoriales AS p
    WHERE p.Idioma IS NOT NULL AND LTRIM(RTRIM(p.Idioma)) <> N''
), a AS (
    SELECT Id, 1 AS N,
           LTRIM(RTRIM(CASE WHEN CHARINDEX(N';', Txt) > 0 THEN LEFT(Txt, CHARINDEX(N';', Txt) - 1) ELSE Txt END)) AS Tok,
           CASE WHEN CHARINDEX(N';', Txt) > 0 THEN SUBSTRING(Txt, CHARINDEX(N';', Txt) + 1, 4000) END AS Resto
    FROM t
    UNION ALL
    SELECT Id, N + 1,
           LTRIM(RTRIM(CASE WHEN CHARINDEX(N';', Resto) > 0 THEN LEFT(Resto, CHARINDEX(N';', Resto) - 1) ELSE Resto END)),
           CASE WHEN CHARINDEX(N';', Resto) > 0 THEN SUBSTRING(Resto, CHARINDEX(N';', Resto) + 1, 4000) END
    FROM a WHERE Resto IS NOT NULL
)
INSERT INTO dbo.PublicacionesEditorialesIdiomas (PublicacionEditorialId, CodigoIdioma, Orden)
SELECT x.Id, x.Codigo, MIN(x.N)
FROM (
    SELECT a.Id, a.N, i.CodigoIdioma AS Codigo
    FROM a JOIN dbo.Idiomas AS i
      ON i.EtiquetaBcp47 = a.Tok OR i.CodigoIdioma = a.Tok OR i.CodigoIso6391 = a.Tok
    UNION ALL
    SELECT a.Id, a.N, N'und' FROM a WHERE a.Tok = N'(lengua nativa)'
) AS x
WHERE NOT EXISTS (SELECT 1 FROM dbo.PublicacionesEditorialesIdiomas r WHERE r.PublicacionEditorialId = x.Id AND r.CodigoIdioma = x.Codigo)
GROUP BY x.Id, x.Codigo;
GO
