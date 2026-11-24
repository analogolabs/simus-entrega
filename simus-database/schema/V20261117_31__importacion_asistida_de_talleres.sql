/*
  V20261117_31 — IMPORTACIÓN ASISTIDA DE TALLERES DE LUTERÍA (LUT-02, decisión 120 de docs/referencia/20-decisiones-y-flujos-por-modulo.md).

  QUÉ HACE. Amplía `CK_LotesImportacion_Modulo` para admitir `talleres`, que es lo único que la base
  necesita saber de un dominio nuevo de la Importación Asistida (mismo patrón que V20261113_20 para
  `mercados`). Las reglas del taller (estado «borrador», territorio coherente, organización existente,
  servicios y familias del vocabulario) las comprueba el servidor al planear y las vuelve a comprobar
  `CK_Talleres_*` al escribir.

  NO ES DESTRUCTIVO. Solo amplía lo que se admite; ninguna fila existente deja de ser válida. Es
  idempotente: si la restricción ya admite `talleres`, no hace nada.
*/
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.LotesImportacion', N'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.check_constraints
       WHERE name = N'CK_LotesImportacion_Modulo'
         AND parent_object_id = OBJECT_ID(N'dbo.LotesImportacion')
         AND definition LIKE N'%talleres%')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_LotesImportacion_Modulo')
        ALTER TABLE dbo.LotesImportacion DROP CONSTRAINT CK_LotesImportacion_Modulo;

    -- SE LISTAN Y NO SE ABRE LA COLUMNA: un módulo sin implementación no puede escribir lotes.
    ALTER TABLE dbo.LotesImportacion WITH CHECK ADD CONSTRAINT CK_LotesImportacion_Modulo
        CHECK (ModuloId IN (N'festivales', N'organizaciones', N'noticias', N'agenda', N'catalogo-editorial', N'mercados', N'talleres'));
END;
GO
