/*
  V20261117_40 — PROPUESTAS DE CAMBIO DE UN PROCESO QUE RESPONDE UNA PERSONA (PROP, decisión 122 de docs/referencia/20-decisiones-y-flujos-por-modulo.md).

  QUÉ HACE. Taller, Espacio y Red tienen propuestas de cambio como Festival y Mercado, y su responsable puede
  ser una persona (lutier o gestor independiente) y no una organización. `PropuestasDeCambio.IdOrganizacion`
  era obligatoria; aquí pasa a admitir nulo y se añade `IdUsuarioResponsable`, la persona que responde por el
  registro. Un CHECK ata las dos: una propuesta tiene UN responsable, organización o persona, nunca los dos
  ni ninguno (el mismo contrato que `CK_Talleres_UnSoloResponsable`).

  NO ES DESTRUCTIVO. Ninguna fila existente deja de ser válida: todas tienen organización y ninguna persona.
  Es idempotente. El esquema de campos y el índice de «una propuesta viva por registro» no cambian: la tabla
  ya identifica el registro por módulo e identificador.
*/
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.PropuestasDeCambio', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'dbo.PropuestasDeCambio') AND name = N'IdOrganizacion' AND is_nullable = 0)
BEGIN
    ALTER TABLE dbo.PropuestasDeCambio ALTER COLUMN IdOrganizacion int NULL;
END;
GO

IF OBJECT_ID(N'dbo.PropuestasDeCambio', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.PropuestasDeCambio', N'IdUsuarioResponsable') IS NULL
BEGIN
    ALTER TABLE dbo.PropuestasDeCambio ADD IdUsuarioResponsable int NULL;
END;
GO

IF OBJECT_ID(N'dbo.PropuestasDeCambio', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_PropuestasDeCambio_Responsable')
BEGIN
    ALTER TABLE dbo.PropuestasDeCambio WITH CHECK ADD CONSTRAINT FK_PropuestasDeCambio_Responsable
        FOREIGN KEY (IdUsuarioResponsable) REFERENCES dbo.Usuarios (IdUsuario);
END;
GO

IF OBJECT_ID(N'dbo.PropuestasDeCambio', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_PropuestasDeCambio_UnSoloResponsable')
BEGIN
    ALTER TABLE dbo.PropuestasDeCambio WITH CHECK ADD CONSTRAINT CK_PropuestasDeCambio_UnSoloResponsable
        CHECK ((IdOrganizacion IS NOT NULL AND IdUsuarioResponsable IS NULL)
            OR (IdOrganizacion IS NULL AND IdUsuarioResponsable IS NOT NULL));
END;
GO
