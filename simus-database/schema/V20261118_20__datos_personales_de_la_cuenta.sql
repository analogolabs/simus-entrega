/*
  SIMUS · Datos personales de la cuenta: residencia y canal de contacto (decisión 133, docs/desarrollo/19-cuentas-y-organizaciones.md §19.14)

  QUE ES. Tres datos OPCIONALES y PRIVADOS de la cuenta individual (docs/desarrollo/19-cuentas-y-organizaciones.md §19.2, #39), pedidos por el usuario:
    · ResidenciaCodigoDepartamento (char(2)) y ResidenciaCodigoMunicipio (char(5)): el municipio y el
      departamento donde vive la persona, del catálogo DIVIPOLA. FINALIDAD: orientar a la persona hacia lo
      que ocurre en su territorio y que el equipo conozca, de forma agregada, de dónde vienen quienes usan
      SIMUS. No se confunde con la sede de un proceso ni con el municipio del perfil público.
    · CanalDeContactoPreferido (varchar(10)): «correo» o «telefono». FINALIDAD: que el equipo use el medio que
      la persona prefiere cuando necesite escribirle por una solicitud suya.

  PRIVACIDAD. NO salen en el perfil público, ni en directorios, ni en ninguna ficha: solo la persona los lee y
  los cambia (GET/PUT /externo/cuenta/perfil) y la consola con Auditoría de acceso. Quedan fuera por
  minimización: fecha de nacimiento, sexo o género, pertenencia étnica, discapacidad y dirección exacta.

  LO QUE NO HACE. No borra ni modifica filas existentes: son columnas nulables y ninguna cuenta anterior queda
  incompleta. Es ADITIVA e idempotente.
*/
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF COL_LENGTH(N'dbo.Usuarios', N'ResidenciaCodigoDepartamento') IS NULL
    ALTER TABLE dbo.Usuarios ADD ResidenciaCodigoDepartamento char(2) NULL;
IF COL_LENGTH(N'dbo.Usuarios', N'ResidenciaCodigoMunicipio') IS NULL
    ALTER TABLE dbo.Usuarios ADD ResidenciaCodigoMunicipio char(5) NULL;
IF COL_LENGTH(N'dbo.Usuarios', N'CanalDeContactoPreferido') IS NULL
    ALTER TABLE dbo.Usuarios ADD CanalDeContactoPreferido varchar(10) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Usuarios_ResidenciaCoherente')
    ALTER TABLE dbo.Usuarios ADD CONSTRAINT CK_Usuarios_ResidenciaCoherente CHECK (
        ResidenciaCodigoMunicipio IS NULL
        OR (ResidenciaCodigoDepartamento IS NOT NULL AND LEFT(ResidenciaCodigoMunicipio, 2) = ResidenciaCodigoDepartamento));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Usuarios_CanalDeContacto')
    ALTER TABLE dbo.Usuarios ADD CONSTRAINT CK_Usuarios_CanalDeContacto CHECK (
        CanalDeContactoPreferido IS NULL OR CanalDeContactoPreferido IN (N'correo', N'telefono'));
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Usuarios_ResidenciaDivipola')
    ALTER TABLE dbo.Usuarios ADD CONSTRAINT FK_Usuarios_ResidenciaDivipola
        FOREIGN KEY (ResidenciaCodigoDepartamento, ResidenciaCodigoMunicipio)
        REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
GO
