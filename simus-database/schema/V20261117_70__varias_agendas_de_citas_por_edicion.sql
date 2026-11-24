SET NOCOUNT ON;

-- ── Varias agendas de citas por edición de Mercado (AGE2, decisión 128 de docs/referencia/20-decisiones-y-flujos-por-modulo.md) ───────────────────
--
-- Hasta aquí una edición tenía UNA agenda (UQ_AgendasDeCitas_Edicion). Un Mercado necesita varias: una
-- por tipo de encuentro, por sala o por público, cada una con su configuración, sus franjas, su cupo y sus
-- invitados. Las tablas hijas ya cuelgan de la agenda y no cambian.
--
--   * Nombre: cómo se distingue la agenda dentro de su edición. Las que ya existen quedan con el nombre
--     por omisión, sin perder nada.
--   * La unicidad pasa de «una por edición» a «un nombre por edición».
-- Idempotente: se puede aplicar dos veces.

IF COL_LENGTH(N'dbo.AgendasDeCitas', N'Nombre') IS NULL
BEGIN
    ALTER TABLE dbo.AgendasDeCitas
        ADD Nombre nvarchar(120) NOT NULL
            CONSTRAINT DF_AgendasDeCitas_Nombre DEFAULT (N'Agenda de citas');
END;

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_AgendasDeCitas_Edicion'
           AND parent_object_id = OBJECT_ID(N'dbo.AgendasDeCitas'))
BEGIN
    ALTER TABLE dbo.AgendasDeCitas DROP CONSTRAINT UQ_AgendasDeCitas_Edicion;
END;

-- EXEC: el índice nombra una columna que se acaba de añadir en este mismo lote.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_AgendasDeCitas_EdicionNombre'
               AND object_id = OBJECT_ID(N'dbo.AgendasDeCitas'))
BEGIN
    EXEC (N'CREATE UNIQUE INDEX UX_AgendasDeCitas_EdicionNombre ON dbo.AgendasDeCitas (EdicionMercadoId, Nombre);');
END;
