/*
  V20261118_30 — LOS ROLES DE LOS PERFILES EN DOS NIVELES: CATEGORÍA Y SUBCATEGORÍA (decisión 135, DIR; docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).

  Pedido: «los roles deberían tener categorías y subcategorías con múltiple selección de acuerdo con lo que podamos revisar
  en Soy Cultura». El formulario de Soy Cultura no es público: la estructura que sigue es una PROPUESTA SIMUS apoyada en los
  grupos de la Ley 397 de 1997 (arts. 27 y 28) y en las funciones de la Ley 2621 de 2026 (art. 8). El código oficial de
  cada categoría y subcategoría queda PENDIENTE DE CONFIRMAR CON EL MINISTERIO.

  ADITIVA Y SIN CAMBIAR NINGÚN CÓDIGO:
  - Añade `IdPadre` (nulo) a `ValoresDeTaxonomiaDePerfiles`, con clave foránea a la misma tabla. Una fila sin padre es una
    categoría (o un valor sin jerarquía: servicios e instrumentos); una con padre es una subcategoría. Dos niveles: lo
    valida la API (una subcategoría no puede tener hijas).
  - Siembra tres categorías nuevas y cuelga de ellas los roles que ya existían, con SUS MISMOS códigos. `gestor` queda como
    categoría sin subcategorías (se elige a sí misma). Las elecciones guardadas en `PerfilesPublicosClasificaciones` no se
    tocan: siguen válidas, y la categoría de cada persona se deduce de su rol.
  - Es idempotente: la reubicación de los roles solo ocurre la primera vez (cuando la columna no existía), así que no pisa
    una reorganización hecha después desde el Catálogo.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
-- El índice filtrado exige QUOTED_IDENTIFIER ON; sqlcmd sin -I (scripts/local/seed-local-db.sh) lo deja en OFF y fallaría con el Msg 1934.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.ValoresDeTaxonomiaDePerfiles', N'IdPadre') IS NULL
BEGIN
    ALTER TABLE dbo.ValoresDeTaxonomiaDePerfiles ADD IdPadre int NULL;
    EXEC (N'
        ALTER TABLE dbo.ValoresDeTaxonomiaDePerfiles ADD CONSTRAINT FK_ValoresDeTaxonomiaDePerfiles_Padre
            FOREIGN KEY (IdPadre) REFERENCES dbo.ValoresDeTaxonomiaDePerfiles (IdValor);
        ALTER TABLE dbo.ValoresDeTaxonomiaDePerfiles ADD CONSTRAINT CK_ValoresDeTaxonomiaDePerfiles_PadreDistinto
            CHECK (IdPadre IS NULL OR IdPadre <> IdValor);
        CREATE INDEX IX_ValoresDeTaxonomiaDePerfiles_Padre ON dbo.ValoresDeTaxonomiaDePerfiles (IdPadre) WHERE IdPadre IS NOT NULL;');

    EXEC (N'
        DECLARE @fuente nvarchar(200) = N''Propuesta SIMUS sobre los grupos de la Ley 397 de 1997 (arts. 27 y 28) y la Ley 2621 de 2026 (art. 8); pendiente de confirmar con el Ministerio'';

        INSERT INTO dbo.ValoresDeTaxonomiaDePerfiles (Dimension, Codigo, Nombre, GrupoSoyCultura, Fuente, OrdenVisualizacion)
        SELECT N''rol'', c.Codigo, c.Nombre, c.Grupo, @fuente, c.Orden
        FROM (VALUES
            (N''creacion-e-interpretacion'', N''Creación e interpretación'', N''creador'', 1),
            (N''formacion-e-investigacion'', N''Formación e investigación'', N''otro'', 2),
            (N''tecnica-luteria-y-produccion'', N''Técnica, lutería y producción'', N''otro'', 3)
        ) AS c(Codigo, Nombre, Grupo, Orden)
        WHERE NOT EXISTS (SELECT 1 FROM dbo.ValoresDeTaxonomiaDePerfiles t WHERE t.Dimension = N''rol'' AND t.Codigo = c.Codigo)
          AND NOT EXISTS (SELECT 1 FROM dbo.ValoresDeTaxonomiaDePerfiles t WHERE t.Dimension = N''rol'' AND t.Nombre = c.Nombre);

        /* gestor es categoría sin subcategorías: ocupa el cuarto puesto entre las categorías. */
        UPDATE dbo.ValoresDeTaxonomiaDePerfiles SET OrdenVisualizacion = 4 WHERE Dimension = N''rol'' AND Codigo = N''gestor'';

        /* Los roles de siempre pasan a ser subcategorías, con el mismo código y su orden relativo. */
        UPDATE h SET IdPadre = p.IdValor
        FROM dbo.ValoresDeTaxonomiaDePerfiles h
        JOIN (VALUES
            (N''interprete'', N''creacion-e-interpretacion''), (N''cantante'', N''creacion-e-interpretacion''),
            (N''compositor'', N''creacion-e-interpretacion''), (N''director'', N''creacion-e-interpretacion''),
            (N''cultor'', N''creacion-e-interpretacion''),
            (N''docente'', N''formacion-e-investigacion''), (N''investigador'', N''formacion-e-investigacion''),
            (N''luthier'', N''tecnica-luteria-y-produccion''), (N''sonidista'', N''tecnica-luteria-y-produccion''),
            (N''productor'', N''tecnica-luteria-y-produccion'')
        ) AS m(Codigo, CodigoPadre) ON h.Codigo = m.Codigo AND h.Dimension = N''rol''
        JOIN dbo.ValoresDeTaxonomiaDePerfiles p ON p.Dimension = N''rol'' AND p.Codigo = m.CodigoPadre
        WHERE h.IdPadre IS NULL;');
END;

COMMIT TRANSACTION;
