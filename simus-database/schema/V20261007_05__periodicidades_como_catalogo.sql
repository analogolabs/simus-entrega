/*
    SIMUS · Periodicidades como catalogo

    QUE HACE. Crea `Periodicidades` (la lista de cada cuanto ocurre un festival o un mercado) y la
    enlaza con una clave foranea a las columnas de texto que hoy guardan ese valor:
    `Festivales.Periodicidad`, `VersionesFestival.Periodicidad` y, si existe, `Mercados.Periodicidad`.

    NO CAMBIA EL TIPO NI EL CONTENIDO DE ESAS COLUMNAS. La clave es el CODIGO (`anual`, `bienal`...), que
    es lo que ya se guarda, igual que `EstadosContenido` y `TiposDocumento`. Antes la lista vivia solo en el
    contrato de la API y en el formulario (`PeriodicidadesFestival`); ahora la base tambien la exige y las
    tres tablas dejan de poder guardar un valor que el circuito no reconozca.

    LOS VALORES. Los ocho que ya admitian la API y el formulario, mas «Unica vez» (aprobado el 7-oct-2026).
    «Bianual» y «Semestral» quieren decir lo mismo (dos veces al ano): se conservan los dos porque la API y
    el formulario ya los ofrecen, pero conviene retirar uno. La equivalencia con el vocabulario de
    frecuencia de Dublin Core esta en la documentacion, no en la tabla.

    «Otra regular» e «Intermitente» obligan a explicar cual (`RequiereDetalle`), como ya hacia la API.

    Idempotente. El mismo guion sirve para la cadena DbUp y para la linea Flyway del Ministerio (alli no
    existe `Mercados`, y se omite).
*/
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Periodicidades', N'U') IS NULL
    CREATE TABLE dbo.Periodicidades (
        CodigoPeriodicidad nvarchar(80) NOT NULL,
        NombrePeriodicidad nvarchar(160) NOT NULL,
        Descripcion nvarchar(600) NULL,
        RequiereDetalle bit NOT NULL CONSTRAINT DF_Periodicidades_RequiereDetalle DEFAULT (0),
        OrdenVisualizacion int NOT NULL,
        Activo bit NOT NULL CONSTRAINT DF_Periodicidades_Activo DEFAULT (1),
        CONSTRAINT PK_Periodicidades PRIMARY KEY (CodigoPeriodicidad),
        CONSTRAINT UQ_Periodicidades_Nombre UNIQUE (NombrePeriodicidad),
        CONSTRAINT CK_Periodicidades_Orden CHECK (OrdenVisualizacion > 0)
    );
GO

INSERT INTO dbo.Periodicidades (CodigoPeriodicidad, NombrePeriodicidad, Descripcion, RequiereDetalle, OrdenVisualizacion)
SELECT v.C, v.N, v.D, v.R, v.O FROM (VALUES
    (N'anual', N'Anual', NULL, 0, 1),
    (N'semestral', N'Semestral', NULL, 0, 2),
    (N'trimestral', N'Trimestral', NULL, 0, 3),
    (N'bianual', N'Bianual (dos veces al año)', N'Quiere decir lo mismo que semestral; se conserva porque la API y el formulario ya lo ofrecen.', 0, 4),
    (N'bienal', N'Bienal (cada dos años)', NULL, 0, 5),
    (N'trienal', N'Trienal (cada tres años)', NULL, 0, 6),
    (N'unica_vez', N'Única vez', NULL, 0, 7),
    (N'otra_regular', N'Otra periodicidad regular', N'Pide explicar cuál.', 1, 8),
    (N'intermitente', N'Intermitente o sin periodicidad fija', N'Pide explicar cuál.', 1, 9)
) AS v (C, N, D, R, O) WHERE NOT EXISTS (SELECT 1 FROM dbo.Periodicidades t WHERE t.CodigoPeriodicidad = v.C);
GO

-- Antes de enlazar, que ningun dato guardado quede fuera de la lista.
DECLARE @Fuera nvarchar(max) = N'';
SELECT @Fuera = @Fuera + CONCAT(x.Tabla, N' = «', x.Valor, N'»; ')
FROM (
    SELECT DISTINCT N'Festivales' AS Tabla, Periodicidad AS Valor FROM dbo.Festivales WHERE Periodicidad IS NOT NULL
    UNION SELECT DISTINCT N'VersionesFestival', Periodicidad FROM dbo.VersionesFestival WHERE Periodicidad IS NOT NULL
) AS x
WHERE NOT EXISTS (SELECT 1 FROM dbo.Periodicidades p WHERE p.CodigoPeriodicidad = x.Valor);
IF @Fuera <> N'' THROW 51020, 'Hay periodicidades guardadas que no estan en el catalogo. Corregirlas antes de migrar.', 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Festivales_Periodicidades')
    ALTER TABLE dbo.Festivales ADD CONSTRAINT FK_Festivales_Periodicidades
        FOREIGN KEY (Periodicidad) REFERENCES dbo.Periodicidades (CodigoPeriodicidad);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_VersionesFestival_Periodicidades')
    ALTER TABLE dbo.VersionesFestival ADD CONSTRAINT FK_VersionesFestival_Periodicidades
        FOREIGN KEY (Periodicidad) REFERENCES dbo.Periodicidades (CodigoPeriodicidad);
GO
IF OBJECT_ID(N'dbo.Mercados', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Mercados_Periodicidades')
    EXEC (N'ALTER TABLE dbo.Mercados ADD CONSTRAINT FK_Mercados_Periodicidades
        FOREIGN KEY (Periodicidad) REFERENCES dbo.Periodicidades (CodigoPeriodicidad);');
GO
