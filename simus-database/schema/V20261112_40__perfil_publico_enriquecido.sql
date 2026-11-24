/*
  V20261112_40 — PERFIL PÚBLICO ENRIQUECIDO (ME; docs/desarrollo/19-cuentas-y-organizaciones.md §19.12).

  El perfil público era básico: nombre, prácticas, municipio, foto y hasta cinco enlaces. Esta migración añade, en la
  MISMA tabla y sin tablas hijas (así el retiro de siembras y las fusiones no chocan con claves foráneas):

    - NombreCivilVisible ... si la persona consiente que su nombre civil salga junto al nombre artístico (`NombreVisible`).
    - BiografiaCorta / BiografiaLarga.
    - Visibilidad ............ 'publico' (cualquiera) o 'solo_simus' (solo quien tiene cuenta en SIMUS). «Oculto» no es un valor:
                              es no tener la autorización `perfil_publico` vigente, como hasta ahora.
    - RolesJson .............. roles y oficios, texto libre: arreglo JSON de hasta 8 cadenas.
    - PortafolioJson ......... portafolio por enlace https: arreglo JSON de hasta 8 { tipo, titulo, url }.
    - OrganizacionesVisiblesJson: ids de las organizaciones que la persona ELIGE mostrar (consentimiento explícito).

  Los perfiles ya publicados quedan con Visibilidad = 'publico' y SIN organizaciones elegidas: mostrar una organización
  ahora exige que la persona la elija (antes salían todas las públicas donde tenía membresía). Sin cascadas.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.PerfilesPublicos', N'NombreCivilVisible') IS NULL
    ALTER TABLE dbo.PerfilesPublicos ADD NombreCivilVisible bit NOT NULL
        CONSTRAINT DF_PerfilesPublicos_NombreCivilVisible DEFAULT (0);

IF COL_LENGTH(N'dbo.PerfilesPublicos', N'BiografiaCorta') IS NULL
    ALTER TABLE dbo.PerfilesPublicos ADD BiografiaCorta nvarchar(280) NULL;

IF COL_LENGTH(N'dbo.PerfilesPublicos', N'BiografiaLarga') IS NULL
    ALTER TABLE dbo.PerfilesPublicos ADD BiografiaLarga nvarchar(4000) NULL;

IF COL_LENGTH(N'dbo.PerfilesPublicos', N'Visibilidad') IS NULL
    ALTER TABLE dbo.PerfilesPublicos ADD Visibilidad nvarchar(12) NOT NULL
        CONSTRAINT DF_PerfilesPublicos_Visibilidad DEFAULT (N'publico');

IF COL_LENGTH(N'dbo.PerfilesPublicos', N'RolesJson') IS NULL
    ALTER TABLE dbo.PerfilesPublicos ADD RolesJson nvarchar(max) NULL;

IF COL_LENGTH(N'dbo.PerfilesPublicos', N'PortafolioJson') IS NULL
    ALTER TABLE dbo.PerfilesPublicos ADD PortafolioJson nvarchar(max) NULL;

IF COL_LENGTH(N'dbo.PerfilesPublicos', N'OrganizacionesVisiblesJson') IS NULL
    ALTER TABLE dbo.PerfilesPublicos ADD OrganizacionesVisiblesJson nvarchar(max) NULL;

-- Las restricciones se crean aparte (EXEC) porque la columna nueva no existe todavía cuando se compila este lote.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_PerfilesPublicos_Visibilidad')
    EXEC (N'ALTER TABLE dbo.PerfilesPublicos ADD CONSTRAINT CK_PerfilesPublicos_Visibilidad
            CHECK (Visibilidad IN (N''publico'', N''solo_simus''))');

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_PerfilesPublicos_Json')
    EXEC (N'ALTER TABLE dbo.PerfilesPublicos ADD CONSTRAINT CK_PerfilesPublicos_Json
            CHECK ((RolesJson IS NULL OR ISJSON(RolesJson) = 1)
               AND (PortafolioJson IS NULL OR ISJSON(PortafolioJson) = 1)
               AND (OrganizacionesVisiblesJson IS NULL OR ISJSON(OrganizacionesVisiblesJson) = 1))');

COMMIT TRANSACTION;
