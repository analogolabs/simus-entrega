/*
  SIMUS · Cabecera del Festival con los cinco datos del organizador (retiro de PerfilesPublicosFestival, PR-1, docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.11)

  QUE ES. El primer paso, ADITIVO y REVERSIBLE, del retiro de dbo.PerfilesPublicosFestival. La cabecera
  dbo.Festivales no tiene cinco campos que hoy solo viven en el perfil público: V20260929_01 los quitó de
  Festivales cuando el perfil era la «versión» del Festival. La propuesta de cambio de Festival ya propone
  `director` y `tipoOrganizadorId`; para que la cabecera pueda ser algún día lo publicado hay que darles casa.

  COLUMNAS NUEVAS EN dbo.Festivales (todas NULL; mismos tipos que en el perfil):
    · Director                         nvarchar(240)
    · TipoOrganizadorId                int  (FK FK_Festivales_TipoOrganizador -> dbo.TiposOrganizador)
    · OtroTipoOrganizador              nvarchar(200)
    · PerteneceAOrganizacionColectiva  bit  (NULL = «no respondió», distinto de 0)
    · NombreOrganizacionColectiva      nvarchar(500)

  RELLENO. Para cada Festival con perfil vigente APROBADO copia SOLO a las columnas nuevas. «Aprobado» es el
  mismo criterio de la lectura pública (LecturaFestivalesPublicados.VersionesRepudiadasAsync): se salta el
  perfil nacido de una propuesta que no acabó `aplicada` y se retrocede al último no repudiado. Solo toca un
  Festival cuyas cinco columnas siguen todas en NULL: nunca pisa un valor ya escrito. Idempotente.

  LO QUE NO HACE. No cambia ninguna columna existente, ninguna lectura ni ninguna escritura: nada del código
  lee todavía las columnas nuevas, así que ningún JSON público cambia. No toca dbo.PerfilesPublicosFestival.

  REVERSA. Quitar la FK y las cinco columnas (ver el comentario final). Antes de revertir, los valores se pueden
  recuperar del perfil, que sigue intacto.
*/
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF COL_LENGTH(N'dbo.Festivales', N'Director') IS NULL
    ALTER TABLE dbo.Festivales ADD Director nvarchar(240) NULL;
IF COL_LENGTH(N'dbo.Festivales', N'TipoOrganizadorId') IS NULL
    ALTER TABLE dbo.Festivales ADD TipoOrganizadorId int NULL;
IF COL_LENGTH(N'dbo.Festivales', N'OtroTipoOrganizador') IS NULL
    ALTER TABLE dbo.Festivales ADD OtroTipoOrganizador nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.Festivales', N'PerteneceAOrganizacionColectiva') IS NULL
    ALTER TABLE dbo.Festivales ADD PerteneceAOrganizacionColectiva bit NULL;
IF COL_LENGTH(N'dbo.Festivales', N'NombreOrganizacionColectiva') IS NULL
    ALTER TABLE dbo.Festivales ADD NombreOrganizacionColectiva nvarchar(500) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Festivales_TipoOrganizador')
    ALTER TABLE dbo.Festivales ADD CONSTRAINT FK_Festivales_TipoOrganizador
        FOREIGN KEY (TipoOrganizadorId) REFERENCES dbo.TiposOrganizador (IdTipoOrganizador);
GO

/* Relleno: perfil vigente aprobado (o el último no repudiado) -> columnas nuevas de la cabecera. */
;WITH Candidatos AS (
    SELECT p.FestivalOrigenId, p.Director, p.TipoOrganizadorId, p.OtroTipoOrganizador,
           p.PerteneceAOrganizacionColectiva, p.NombreOrganizacionColectiva,
           ROW_NUMBER() OVER (PARTITION BY p.FestivalOrigenId
                              ORDER BY p.EsVigente DESC, p.NumeroPublicacion DESC, p.IdPerfilPublicoFestival DESC) AS Orden
    FROM dbo.PerfilesPublicosFestival p
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.PropuestasDeCambio pc
        WHERE pc.ModuloId = N'festivales'
          AND pc.SubregistroResultanteId = CONVERT(nvarchar(120), p.IdPerfilPublicoFestival)
          AND pc.Estado <> N'aplicada')
)
UPDATE f
SET f.Director = c.Director,
    f.TipoOrganizadorId = c.TipoOrganizadorId,
    f.OtroTipoOrganizador = c.OtroTipoOrganizador,
    f.PerteneceAOrganizacionColectiva = c.PerteneceAOrganizacionColectiva,
    f.NombreOrganizacionColectiva = c.NombreOrganizacionColectiva
FROM dbo.Festivales f
JOIN Candidatos c ON c.FestivalOrigenId = f.IdFestival AND c.Orden = 1
WHERE f.Director IS NULL AND f.TipoOrganizadorId IS NULL AND f.OtroTipoOrganizador IS NULL
  AND f.PerteneceAOrganizacionColectiva IS NULL AND f.NombreOrganizacionColectiva IS NULL
  AND (c.Director IS NOT NULL OR c.TipoOrganizadorId IS NOT NULL OR c.OtroTipoOrganizador IS NOT NULL
       OR c.PerteneceAOrganizacionColectiva IS NOT NULL OR c.NombreOrganizacionColectiva IS NOT NULL);
GO

/*
  REVERSA (manual; no es parte de la migración):
    ALTER TABLE dbo.Festivales DROP CONSTRAINT FK_Festivales_TipoOrganizador;
    ALTER TABLE dbo.Festivales DROP COLUMN Director, TipoOrganizadorId, OtroTipoOrganizador,
                                            PerteneceAOrganizacionColectiva, NombreOrganizacionColectiva;
*/
