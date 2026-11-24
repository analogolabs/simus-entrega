/*
  Corrige el nombre de una entidad del acervo editorial.

  EL ROL ESTABA PEGADO AL NOMBRE. La entidad PNMC-AG-265 se llamaba «coordinación y realización Casa
  de la Cultura de Sevilla Valle del Cauca». El rol no es parte del nombre: vive en el crédito
  (`CreditosEditoriales.RolEtiqueta`), que es donde se muestra. La entidad queda con su nombre y el
  crédito conserva el texto del rol. La fuente (V20261009_06) ya está corregida; este guion arregla
  las bases en las que el acervo se cargó antes.

  NO CORRIGE LAS FORMAS INVERTIDAS DE LAS PERSONAS DE TRES PALABRAS («Alonso Medina, Martín» para
  «Martín Alonso Medina»): sin la fuente no se sabe si el segundo nombre es de pila o parte del
  apellido, y adivinarlo cambiaría una autoría. Queda como revisión editorial.

  IDEMPOTENTE: volver a pasarlo no cambia nada. Es dato institucional, no demostrativo: va en la
  lista de semillas de referencia de `seed-local-db.sh`, justo después de cargar el acervo.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

-- ─────────────────────────── 2. El rol pegado al nombre de una entidad ───────────────────────────
UPDATE dbo.AgentesEditoriales
SET NombrePreferido = N'Casa de la Cultura de Sevilla, Valle del Cauca',
    FormaNormalizada = N'Casa de la Cultura de Sevilla, Valle del Cauca',
    FechaActualizacion = SYSUTCDATETIME()
WHERE Codigo = N'PNMC-AG-265'
  AND NombrePreferido LIKE N'coordinación y realización %';

-- EL ROL SE CONSERVA EN EL CRÉDITO, que es donde se lee: el texto que se quitó del nombre.
UPDATE c
SET RolEtiqueta = N'Coordinación y realización'
FROM dbo.CreditosEditoriales c
JOIN dbo.AgentesEditoriales a ON a.IdAgenteEditorial = c.AgenteEditorialId
WHERE a.Codigo = N'PNMC-AG-265'
  AND c.RolCodigo = N'aut'
  AND c.RolEtiqueta = N'Autor';

COMMIT TRANSACTION;
