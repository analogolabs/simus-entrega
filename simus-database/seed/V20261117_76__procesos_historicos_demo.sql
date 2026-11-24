/*
    SIMUS · Demostración: procesos históricos de los cinco tipos, sin responsable, listos para reclamar
    (decisión 131).

    POR QUE EXISTE. «Procesos históricos» se reclama para Festivales, Mercados, Redes, Lutería y Espacios.
    Los Festivales históricos ya tenían siembra (V20261106_07); aquí se añaden los otros cuatro tipos para
    poder recorrer la reclamación de cada uno.

    QUÉ ES UN HISTÓRICO. Un proceso publicado cuya organización es la institucional (la custodia del Programa)
    y sin persona responsable, como los Festivales y los Mercados importados. No hay que relajar
    `CK_*_UnSoloResponsable`: «una organización y ninguna persona» ya es válido.

    Todo es inventado; ninguno corresponde a un proceso, una organización ni una persona reales.
    Idempotente: se reconoce por el nombre y no duplica. Se aplica con `scripts/demo/sembrar-demo.sh procesos-historicos`.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Institucional int = (SELECT TOP 1 IdEntidad FROM dbo.Entidades WHERE EsInstitucional = 1 ORDER BY IdEntidad);
IF @Institucional IS NULL THROW 52907, N'Falta la entidad institucional: arranca la API una vez para crearla.', 1;
DECLARE @Ahora datetime2(0) = SYSUTCDATETIME();

-- Mercados musicales históricos.
INSERT INTO dbo.Mercados (NombreMercado, Descripcion, NivelCobertura, CodigoDepartamento, CodigoMunicipio, OrganizacionPrincipalId, EstadoRegistro, Activo, FechaCreacion, FechaPublicacion)
SELECT v.Nombre, v.Descripcion, N'municipal', v.Dep, v.Mun, @Institucional, N'publicado', 1, @Ahora, @Ahora
FROM (VALUES
 (N'Mercado Musical del Pacífico (histórico)', N'Registro histórico de demostración: rueda de negocios de músicas del Pacífico.', '76', '76001'),
 (N'Encuentro de Gestores y Mercado de la Sabana (histórico)', N'Registro histórico de demostración: mercado de circulación de músicas llaneras.', '50', '50001')
) AS v(Nombre, Descripcion, Dep, Mun)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Mercados m WHERE m.NombreMercado = v.Nombre);

-- Redes y documentación históricas.
INSERT INTO dbo.Redes (NombreRed, Descripcion, NivelCobertura, CodigoDepartamento, CodigoMunicipio, OrganizacionPrincipalId, UsuarioResponsableId, EstadoRegistro, Activo, FechaCreacion, FechaPublicacion)
SELECT v.Nombre, v.Descripcion, N'municipal', v.Dep, v.Mun, @Institucional, NULL, N'publicado', 1, @Ahora, @Ahora
FROM (VALUES
 (N'Archivo Sonoro del Caribe (histórico)', N'Registro histórico de demostración: archivo de grabaciones de campo del Caribe.', '13', '13001'),
 (N'Red de Memoria Musical del Huila (histórica)', N'Registro histórico de demostración: red de investigadores y archivos de música del Huila.', '41', '41001')
) AS v(Nombre, Descripcion, Dep, Mun)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Redes r WHERE r.NombreRed = v.Nombre);

-- Talleres de lutería históricos.
INSERT INTO dbo.Talleres (NombreTaller, Descripcion, Modalidad, NivelCobertura, CodigoDepartamento, CodigoMunicipio, OrganizacionPrincipalId, UsuarioResponsableId, EstadoRegistro, Activo, FechaCreacion, FechaPublicacion)
SELECT v.Nombre, v.Descripcion, N'fijo', N'municipal', v.Dep, v.Mun, @Institucional, NULL, N'publicado', 1, @Ahora, @Ahora
FROM (VALUES
 (N'Taller de Luthería Andina (histórico)', N'Registro histórico de demostración: construcción de tiples y bandolas.', '68', '68001'),
 (N'Taller de Tambores del Magdalena (histórico)', N'Registro histórico de demostración: construcción de tambores de la ribera.', '47', '47001')
) AS v(Nombre, Descripcion, Dep, Mun)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Talleres t WHERE t.NombreTaller = v.Nombre);

-- Espacios para música en vivo históricos.
INSERT INTO dbo.Espacios (NombreEspacio, Descripcion, Ambiente, NivelCobertura, CodigoDepartamento, CodigoMunicipio, OrganizacionPrincipalId, UsuarioResponsableId, EstadoRegistro, Activo, FechaCreacion, FechaPublicacion)
SELECT v.Nombre, v.Descripcion, N'cerrado', N'municipal', v.Dep, v.Mun, @Institucional, NULL, N'publicado', 1, @Ahora, @Ahora
FROM (VALUES
 (N'Sala de Conciertos del Río (histórica)', N'Registro histórico de demostración: sala de cámara con programación de música de cuerdas.', '05', '05001'),
 (N'Casa de la Cultura de la Ribera (histórica)', N'Registro histórico de demostración: casa de cultura con tarima y salón de ensayo.', '08', '08001')
) AS v(Nombre, Descripcion, Dep, Mun)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Espacios e WHERE e.NombreEspacio = v.Nombre);
