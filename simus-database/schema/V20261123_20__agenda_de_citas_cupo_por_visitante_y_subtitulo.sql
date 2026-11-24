SET NOCOUNT ON;

-- ── Agenda de citas: cupo de citas por quien rota y subtítulo del nombre (puntos 60 y 63) ─────────
--
-- CitasMaximasPorVisitante. Hasta aquí el único cupo de la agenda era CupoArtistas (cuántos artistas se
-- inscriben). Faltaba el límite que el Mercado fija a cada quien ROTA: cuántos artistas alcanza a visitar cada
-- comprador (modo compradores_rotan) o a cuántos compradores o bookers puede visitar cada artista (modo
-- compradores_fijos). La semántica es la del modo, no la del rol: «el visitante» es siempre quien rota. NULL es
-- sin límite, y las agendas que ya existen quedan así, sin cambiar su comportamiento.
--
-- Subtitulo. El nombre de la agenda parte del nombre del Mercado y lleva un subtítulo (la edición o el nombre
-- específico: «Ronda de bookers», «Sala de cámara»). Es NOT NULL con '' por omisión para que la unicidad
-- (edición, nombre, subtítulo) funcione sin NULL: dos agendas de una edición pueden compartir el nombre del
-- Mercado si su subtítulo las distingue.
--
-- Idempotente: se puede aplicar dos veces.

IF COL_LENGTH(N'dbo.AgendasDeCitas', N'CitasMaximasPorVisitante') IS NULL
BEGIN
    ALTER TABLE dbo.AgendasDeCitas ADD CitasMaximasPorVisitante int NULL;
END;

IF COL_LENGTH(N'dbo.AgendasDeCitas', N'Subtitulo') IS NULL
BEGIN
    ALTER TABLE dbo.AgendasDeCitas
        ADD Subtitulo nvarchar(120) NOT NULL CONSTRAINT DF_AgendasDeCitas_Subtitulo DEFAULT (N'');
END;

-- EXEC: las restricciones nombran columnas que se acaban de añadir en este mismo lote.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AgendasDeCitas_CitasPorVisitante'
               AND parent_object_id = OBJECT_ID(N'dbo.AgendasDeCitas'))
BEGIN
    EXEC (N'ALTER TABLE dbo.AgendasDeCitas ADD CONSTRAINT CK_AgendasDeCitas_CitasPorVisitante
            CHECK (CitasMaximasPorVisitante IS NULL OR CitasMaximasPorVisitante BETWEEN 1 AND 200);');
END;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_AgendasDeCitas_EdicionNombre'
           AND object_id = OBJECT_ID(N'dbo.AgendasDeCitas'))
BEGIN
    DROP INDEX UX_AgendasDeCitas_EdicionNombre ON dbo.AgendasDeCitas;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_AgendasDeCitas_EdicionNombreSubtitulo'
               AND object_id = OBJECT_ID(N'dbo.AgendasDeCitas'))
BEGIN
    EXEC (N'CREATE UNIQUE INDEX UX_AgendasDeCitas_EdicionNombreSubtitulo ON dbo.AgendasDeCitas (EdicionMercadoId, Nombre, Subtitulo);');
END;
