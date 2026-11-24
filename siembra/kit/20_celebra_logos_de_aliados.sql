/*
  SIMUS · Logos reales de los aliados de Celebra la música.

  QUE HACE. En las ediciones de Celebra SEMBRADAS (con marca en dbo.DatosDeDemostracion), apunta el recurso del grupo «Aliados» de cada
  aliado al logo real descargado de la página oficial (alias img.organizacion.aliado-<slug>.logo), en lugar del logo ilustrativo de la
  siembra anterior. Se ejecuta DESPUÉS de aplicar el plan (scripts/demo/sembrar-celebra-ediciones.sh --solo-aliados), que es quien inserta los
  archivos y los recursos que falten.

  SEGURIDAD. Solo cambia ArchivoId de recursos «Aliados» y el texto de aliados de ediciones sembradas, y retira el recurso de Poliedro de 2025 (con su marca de siembra); solo si el logo real ya está en el Banco.
  Idempotente (volver a correrlo no cambia nada). No toca cuentas, fichas ni el resto de la demo.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Aliados TABLE (Titulo nvarchar(200) NOT NULL, Alias nvarchar(200) NOT NULL);
INSERT INTO @Aliados (Titulo, Alias) VALUES
    (N'Fundación Nacional Batuta', N'img.organizacion.aliado-fundacion-nacional-batuta.logo'),
    (N'Asociación Nacional de las Artes', N'img.organizacion.aliado-asociacion-nacional-de-las-artes.logo'),
    (N'Fundación Poliedro', N'img.organizacion.aliado-fundacion-poliedro.logo');

BEGIN TRANSACTION;

UPDATE r
   SET r.ArchivoId = CAST(da.IdRegistro AS int)
  FROM dbo.CelebraRecursos r
  JOIN dbo.CelebraEdiciones e ON e.IdCelebraEdicion = r.CelebraEdicionId
  JOIN dbo.DatosDeDemostracion de ON de.Tabla = N'CelebraEdiciones' AND de.IdRegistro = CAST(e.IdCelebraEdicion AS nvarchar(120))
  JOIN @Aliados a ON a.Titulo = r.Titulo
  JOIN dbo.DatosDeDemostracion da ON da.Tabla = N'Archivos' AND da.Alias = a.Alias
 WHERE r.Grupo = N'Aliados'
   AND (r.ArchivoId IS NULL OR r.ArchivoId <> CAST(da.IdRegistro AS int));

PRINT CONCAT(N'[celebra] Logos de aliados actualizados: ', @@ROWCOUNT);

-- Los aliados de cada edición (decisión del usuario): 2025, Batuta y la Asociación Nacional de las Artes; 2026, esas dos y Poliedro.
-- El Ministerio y el PNMC organizan, no son aliados. Solo cambia el texto de las ediciones sembradas y retira, en 2025, el recurso de Poliedro.
UPDATE e SET e.Aliados = N'Fundación Nacional Batuta y Asociación Nacional de las Artes'
  FROM dbo.CelebraEdiciones e
  JOIN dbo.DatosDeDemostracion de ON de.Tabla = N'CelebraEdiciones' AND de.IdRegistro = CAST(e.IdCelebraEdicion AS nvarchar(120))
 WHERE e.Anio = 2025 AND ISNULL(e.Aliados, N'') <> N'Fundación Nacional Batuta y Asociación Nacional de las Artes';
UPDATE e SET e.Aliados = N'Fundación Nacional Batuta, Asociación Nacional de las Artes y Fundación Poliedro'
  FROM dbo.CelebraEdiciones e
  JOIN dbo.DatosDeDemostracion de ON de.Tabla = N'CelebraEdiciones' AND de.IdRegistro = CAST(e.IdCelebraEdicion AS nvarchar(120))
 WHERE e.Anio = 2026 AND ISNULL(e.Aliados, N'') <> N'Fundación Nacional Batuta, Asociación Nacional de las Artes y Fundación Poliedro';

DECLARE @Sobrantes TABLE (IdRecurso int NOT NULL);
INSERT INTO @Sobrantes (IdRecurso)
SELECT r.IdCelebraRecurso
  FROM dbo.CelebraRecursos r
  JOIN dbo.CelebraEdiciones e ON e.IdCelebraEdicion = r.CelebraEdicionId
  JOIN dbo.DatosDeDemostracion de ON de.Tabla = N'CelebraEdiciones' AND de.IdRegistro = CAST(e.IdCelebraEdicion AS nvarchar(120))
 WHERE e.Anio = 2025 AND r.Grupo = N'Aliados' AND r.Titulo = N'Fundación Poliedro';
DELETE d FROM dbo.DatosDeDemostracion d JOIN @Sobrantes s ON d.Tabla = N'CelebraRecursos' AND d.IdRegistro = CAST(s.IdRecurso AS nvarchar(120));
DELETE r FROM dbo.CelebraRecursos r JOIN @Sobrantes s ON s.IdRecurso = r.IdCelebraRecurso;
PRINT CONCAT(N'[celebra] Recursos de aliados retirados en 2025: ', @@ROWCOUNT);
COMMIT TRANSACTION;
