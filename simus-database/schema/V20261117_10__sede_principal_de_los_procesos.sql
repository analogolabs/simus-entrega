/*
  SIMUS · Sede principal de todo proceso (decisión 119)

  QUE ES. Todo proceso del ecosistema (Festival, Mercado, Taller, Espacio para música en vivo y Red) lleva
  una SEDE PRINCIPAL —departamento y municipio— para situarlo en el mapa, AUNQUE su cobertura sea nacional o
  departamental. La COBERTURA sigue siendo un dato aparte: dónde trabaja el proceso. La sede es dónde está.

  LO QUE HACE.
    · añade SedeCodigoDepartamento (char(2)) y SedeCodigoMunicipio (char(5)), nulables, a las cinco tablas;
    · RELLENA la sede desde el territorio actual cuando la cobertura es municipal (departamento y municipio) o
      departamental (solo el departamento: el municipio queda «pendiente de completar»);
    · NO TOCA ningún CHECK de cobertura (la cobertura nacional sigue sin departamento);
    · añade una restricción de coherencia (no hay municipio de sede sin departamento, y el municipio pertenece
      al departamento) y la foránea al catálogo DIVIPOLA.

  LO QUE NO HACE. No borra ni bloquea nada: un proceso sin sede queda «pendiente de completar», se lee igual
  y se le pide la sede en la edición. Es ADITIVA y se puede repetir (idempotente).
*/
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

-- ── Festivales ─────────────────────────────────────────────────────────────────────────────────────────

IF COL_LENGTH(N'dbo.Festivales', N'SedeCodigoDepartamento') IS NULL
    ALTER TABLE dbo.Festivales ADD SedeCodigoDepartamento char(2) NULL;
IF COL_LENGTH(N'dbo.Festivales', N'SedeCodigoMunicipio') IS NULL
    ALTER TABLE dbo.Festivales ADD SedeCodigoMunicipio char(5) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Festivales_SedeCoherente')
    ALTER TABLE dbo.Festivales ADD CONSTRAINT CK_Festivales_SedeCoherente CHECK (
        SedeCodigoMunicipio IS NULL
        OR (SedeCodigoDepartamento IS NOT NULL AND LEFT(SedeCodigoMunicipio, 2) = SedeCodigoDepartamento));
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Festivales_SedeDivipola')
    ALTER TABLE dbo.Festivales ADD CONSTRAINT FK_Festivales_SedeDivipola
        FOREIGN KEY (SedeCodigoDepartamento, SedeCodigoMunicipio)
        REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Festivales_Sede' AND object_id = OBJECT_ID(N'dbo.Festivales'))
    CREATE INDEX IX_Festivales_Sede ON dbo.Festivales (SedeCodigoDepartamento, SedeCodigoMunicipio);
GO

-- Relleno desde el territorio actual; solo donde todavía no hay sede.
UPDATE dbo.Festivales
   SET SedeCodigoDepartamento = CodigoDepartamento,
       SedeCodigoMunicipio = CASE WHEN NivelCobertura = N'municipal' THEN CodigoMunicipio ELSE NULL END
 WHERE SedeCodigoDepartamento IS NULL AND SedeCodigoMunicipio IS NULL
   AND NivelCobertura IN (N'municipal', N'departamental') AND CodigoDepartamento IS NOT NULL;
GO

-- ── Mercados ─────────────────────────────────────────────────────────────────────────────────────────

IF COL_LENGTH(N'dbo.Mercados', N'SedeCodigoDepartamento') IS NULL
    ALTER TABLE dbo.Mercados ADD SedeCodigoDepartamento char(2) NULL;
IF COL_LENGTH(N'dbo.Mercados', N'SedeCodigoMunicipio') IS NULL
    ALTER TABLE dbo.Mercados ADD SedeCodigoMunicipio char(5) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Mercados_SedeCoherente')
    ALTER TABLE dbo.Mercados ADD CONSTRAINT CK_Mercados_SedeCoherente CHECK (
        SedeCodigoMunicipio IS NULL
        OR (SedeCodigoDepartamento IS NOT NULL AND LEFT(SedeCodigoMunicipio, 2) = SedeCodigoDepartamento));
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Mercados_SedeDivipola')
    ALTER TABLE dbo.Mercados ADD CONSTRAINT FK_Mercados_SedeDivipola
        FOREIGN KEY (SedeCodigoDepartamento, SedeCodigoMunicipio)
        REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Mercados_Sede' AND object_id = OBJECT_ID(N'dbo.Mercados'))
    CREATE INDEX IX_Mercados_Sede ON dbo.Mercados (SedeCodigoDepartamento, SedeCodigoMunicipio);
GO

-- Relleno desde el territorio actual; solo donde todavía no hay sede.
UPDATE dbo.Mercados
   SET SedeCodigoDepartamento = CodigoDepartamento,
       SedeCodigoMunicipio = CASE WHEN NivelCobertura = N'municipal' THEN CodigoMunicipio ELSE NULL END
 WHERE SedeCodigoDepartamento IS NULL AND SedeCodigoMunicipio IS NULL
   AND NivelCobertura IN (N'municipal', N'departamental') AND CodigoDepartamento IS NOT NULL;
GO

-- ── Talleres ─────────────────────────────────────────────────────────────────────────────────────────

IF COL_LENGTH(N'dbo.Talleres', N'SedeCodigoDepartamento') IS NULL
    ALTER TABLE dbo.Talleres ADD SedeCodigoDepartamento char(2) NULL;
IF COL_LENGTH(N'dbo.Talleres', N'SedeCodigoMunicipio') IS NULL
    ALTER TABLE dbo.Talleres ADD SedeCodigoMunicipio char(5) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Talleres_SedeCoherente')
    ALTER TABLE dbo.Talleres ADD CONSTRAINT CK_Talleres_SedeCoherente CHECK (
        SedeCodigoMunicipio IS NULL
        OR (SedeCodigoDepartamento IS NOT NULL AND LEFT(SedeCodigoMunicipio, 2) = SedeCodigoDepartamento));
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Talleres_SedeDivipola')
    ALTER TABLE dbo.Talleres ADD CONSTRAINT FK_Talleres_SedeDivipola
        FOREIGN KEY (SedeCodigoDepartamento, SedeCodigoMunicipio)
        REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Talleres_Sede' AND object_id = OBJECT_ID(N'dbo.Talleres'))
    CREATE INDEX IX_Talleres_Sede ON dbo.Talleres (SedeCodigoDepartamento, SedeCodigoMunicipio);
GO

-- Relleno desde el territorio actual; solo donde todavía no hay sede.
UPDATE dbo.Talleres
   SET SedeCodigoDepartamento = CodigoDepartamento,
       SedeCodigoMunicipio = CASE WHEN NivelCobertura = N'municipal' THEN CodigoMunicipio ELSE NULL END
 WHERE SedeCodigoDepartamento IS NULL AND SedeCodigoMunicipio IS NULL
   AND NivelCobertura IN (N'municipal', N'departamental') AND CodigoDepartamento IS NOT NULL;
GO

-- ── Espacios ─────────────────────────────────────────────────────────────────────────────────────────

IF COL_LENGTH(N'dbo.Espacios', N'SedeCodigoDepartamento') IS NULL
    ALTER TABLE dbo.Espacios ADD SedeCodigoDepartamento char(2) NULL;
IF COL_LENGTH(N'dbo.Espacios', N'SedeCodigoMunicipio') IS NULL
    ALTER TABLE dbo.Espacios ADD SedeCodigoMunicipio char(5) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Espacios_SedeCoherente')
    ALTER TABLE dbo.Espacios ADD CONSTRAINT CK_Espacios_SedeCoherente CHECK (
        SedeCodigoMunicipio IS NULL
        OR (SedeCodigoDepartamento IS NOT NULL AND LEFT(SedeCodigoMunicipio, 2) = SedeCodigoDepartamento));
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Espacios_SedeDivipola')
    ALTER TABLE dbo.Espacios ADD CONSTRAINT FK_Espacios_SedeDivipola
        FOREIGN KEY (SedeCodigoDepartamento, SedeCodigoMunicipio)
        REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Espacios_Sede' AND object_id = OBJECT_ID(N'dbo.Espacios'))
    CREATE INDEX IX_Espacios_Sede ON dbo.Espacios (SedeCodigoDepartamento, SedeCodigoMunicipio);
GO

-- Relleno desde el territorio actual; solo donde todavía no hay sede.
UPDATE dbo.Espacios
   SET SedeCodigoDepartamento = CodigoDepartamento,
       SedeCodigoMunicipio = CASE WHEN NivelCobertura = N'municipal' THEN CodigoMunicipio ELSE NULL END
 WHERE SedeCodigoDepartamento IS NULL AND SedeCodigoMunicipio IS NULL
   AND NivelCobertura IN (N'municipal', N'departamental') AND CodigoDepartamento IS NOT NULL;
GO

-- ── Redes ─────────────────────────────────────────────────────────────────────────────────────────

IF COL_LENGTH(N'dbo.Redes', N'SedeCodigoDepartamento') IS NULL
    ALTER TABLE dbo.Redes ADD SedeCodigoDepartamento char(2) NULL;
IF COL_LENGTH(N'dbo.Redes', N'SedeCodigoMunicipio') IS NULL
    ALTER TABLE dbo.Redes ADD SedeCodigoMunicipio char(5) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Redes_SedeCoherente')
    ALTER TABLE dbo.Redes ADD CONSTRAINT CK_Redes_SedeCoherente CHECK (
        SedeCodigoMunicipio IS NULL
        OR (SedeCodigoDepartamento IS NOT NULL AND LEFT(SedeCodigoMunicipio, 2) = SedeCodigoDepartamento));
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Redes_SedeDivipola')
    ALTER TABLE dbo.Redes ADD CONSTRAINT FK_Redes_SedeDivipola
        FOREIGN KEY (SedeCodigoDepartamento, SedeCodigoMunicipio)
        REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Redes_Sede' AND object_id = OBJECT_ID(N'dbo.Redes'))
    CREATE INDEX IX_Redes_Sede ON dbo.Redes (SedeCodigoDepartamento, SedeCodigoMunicipio);
GO

-- Relleno desde el territorio actual; solo donde todavía no hay sede.
UPDATE dbo.Redes
   SET SedeCodigoDepartamento = CodigoDepartamento,
       SedeCodigoMunicipio = CASE WHEN NivelCobertura = N'municipal' THEN CodigoMunicipio ELSE NULL END
 WHERE SedeCodigoDepartamento IS NULL AND SedeCodigoMunicipio IS NULL
   AND NivelCobertura IN (N'municipal', N'departamental') AND CodigoDepartamento IS NOT NULL;
GO
