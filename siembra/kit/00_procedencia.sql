/*
    KIT DE DEMOSTRACIÓN · TABLA DE PROCEDENCIA 

    La crea SOLO el kit de demostración (`scripts/demo/siembra-integral.sh`), nunca DbUp ni `simus-database/schema`:
    producción no la tiene ni debe tenerla. Registra, fuera de las tablas de negocio, qué filas son de la demo, de qué lote
    vinieron, qué procedencia tienen y a qué nivel pertenecen. Así ninguna ficha pública lleva etiquetas «ficticio» y aun así
    cada fila es identificable y se puede retirar por lote.

    Idempotente: se puede ejecutar cuantas veces haga falta. No toca ninguna otra tabla.
*/
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.DatosDeDemostracion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DatosDeDemostracion (
        IdDato          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_DatosDeDemostracion PRIMARY KEY,
        Tabla           nvarchar(128) NOT NULL,            -- tabla de negocio, sin esquema (p. ej. Festivales)
        IdRegistro      nvarchar(120) NOT NULL,            -- clave primaria del registro, como texto
        Alias           nvarchar(120) NOT NULL,            -- identificador simbólico del generador (idempotencia y referencias entre filas)
        Lote            nvarchar(60)  NOT NULL,            -- p. ej. n1-festivales, n2-organizaciones, cuentas-validacion
        Procedencia     nvarchar(12)  NOT NULL,            -- publico | sintetico | hibrido
        Fuente          nvarchar(500) NULL,                -- URL o referencia de la fuente pública (obligatoria si no es sintético)
        Nivel           tinyint       NOT NULL,            -- 0 cuentas de validación, 1 audiovisual, 2 exploración, 3 cobertura
        ClaveEstable    nvarchar(80)  NULL,                -- identificador estable para videos y recorrido (solo nivel 0 y 1)
        Semilla         int           NOT NULL,            -- semilla del generador que lo produjo
        FechaSiembra    datetime2(0)  NOT NULL CONSTRAINT DF_DatosDeDemostracion_Fecha DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_DatosDeDemostracion_Procedencia CHECK (Procedencia IN (N'publico', N'sintetico', N'hibrido')),
        CONSTRAINT CK_DatosDeDemostracion_Nivel CHECK (Nivel BETWEEN 0 AND 3),
        CONSTRAINT CK_DatosDeDemostracion_Fuente CHECK (Procedencia = N'sintetico' OR Fuente IS NOT NULL),
        CONSTRAINT CK_DatosDeDemostracion_ClaveEstable CHECK (ClaveEstable IS NULL OR Nivel IN (0, 1))
    );
    CREATE UNIQUE INDEX UX_DatosDeDemostracion_Alias ON dbo.DatosDeDemostracion (Alias);
    CREATE UNIQUE INDEX UX_DatosDeDemostracion_Registro ON dbo.DatosDeDemostracion (Tabla, IdRegistro);
    CREATE UNIQUE INDEX UX_DatosDeDemostracion_ClaveEstable ON dbo.DatosDeDemostracion (ClaveEstable) WHERE ClaveEstable IS NOT NULL;
    CREATE INDEX IX_DatosDeDemostracion_Lote ON dbo.DatosDeDemostracion (Lote, Tabla);
END;
