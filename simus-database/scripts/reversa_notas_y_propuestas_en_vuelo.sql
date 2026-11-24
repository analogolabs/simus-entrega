/*
  SIMUS · REVERSA de V20261119_30 (notas de revisión y propuestas en vuelo sin perfil, retiro de PerfilesPublicosFestival PR-5b)

  QUE HACE. Devuelve, fila a fila y desde las tres tablas de respaldo que dejó la migración, lo que esta cambió:
    · RevisionesDeRegistroObservaciones: las notas «reescritas» recuperan Ambito, SubregistroId y CampoId; las «descartadas»
      se reinsertan con su mismo IdObservacion.
    · PropuestasDeCambioCampos: los campos «reescritos» recuperan su CampoId (y su ValorAnterior) y los «antes rellenado» su ValorAnterior original;
      los «descartados» se reinsertan con su mismo IdCampoPropuesto.
    · PropuestasDeCambio: las propuestas en vuelo recuperan su SubregistroId.
  NO se ejecuta sola ni la llama ninguna migración: va FUERA de schema/ a propósito. Es manual y debe correrse con la API
  parada. Una sola transacción. Si el respaldo no existe, se detiene con error y no cambia nada.

  Uso: sqlcmd -S <servidor> -d <base> -i reversa_notas_y_propuestas_en_vuelo.sql
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'respaldo.RevisionesObservaciones_V20261119_30', N'U') IS NULL
   OR OBJECT_ID(N'respaldo.PropuestasDeCambioCampos_V20261119_30', N'U') IS NULL
   OR OBJECT_ID(N'respaldo.PropuestasDeCambio_V20261119_30', N'U') IS NULL
    THROW 50010, N'No hay respaldo de V20261119_30: no hay nada que revertir.', 1;

BEGIN TRANSACTION;

-- Notas: primero lo reescrito vuelve a su forma (libera la unicidad), luego se reinsertan las descartadas.
UPDATE o
SET o.Ambito = r.Ambito, o.SubregistroId = r.SubregistroId, o.CampoId = r.CampoId
FROM dbo.RevisionesDeRegistroObservaciones o
JOIN respaldo.RevisionesObservaciones_V20261119_30 r ON r.IdObservacion = o.IdObservacion AND r.Accion = N'reescrita';

SET IDENTITY_INSERT dbo.RevisionesDeRegistroObservaciones ON;
INSERT INTO dbo.RevisionesDeRegistroObservaciones
    (IdObservacion, IdRevision, Ambito, SubregistroId, SeccionId, CampoId, CampoEtiqueta, ValorObservado,
     Nota, Estado, FechaCreacion, FechaActualizacion, FechaAtencion, IdUsuarioAtiende)
SELECT r.IdObservacion, r.IdRevision, r.Ambito, r.SubregistroId, r.SeccionId, r.CampoId, r.CampoEtiqueta, r.ValorObservado,
       r.Nota, r.Estado, r.FechaCreacion, r.FechaActualizacion, r.FechaAtencion, r.IdUsuarioAtiende
FROM respaldo.RevisionesObservaciones_V20261119_30 r
WHERE r.Accion = N'descartada'
  AND NOT EXISTS (SELECT 1 FROM dbo.RevisionesDeRegistroObservaciones o WHERE o.IdObservacion = r.IdObservacion);
SET IDENTITY_INSERT dbo.RevisionesDeRegistroObservaciones OFF;

-- Campos de propuesta.
UPDATE k
SET k.CampoId = r.CampoId, k.ValorAnterior = r.ValorAnterior
FROM dbo.PropuestasDeCambioCampos k
JOIN respaldo.PropuestasDeCambioCampos_V20261119_30 r ON r.IdCampoPropuesto = k.IdCampoPropuesto AND r.Accion = N'reescrito';

UPDATE k
SET k.ValorAnterior = r.ValorAnterior
FROM dbo.PropuestasDeCambioCampos k
JOIN respaldo.PropuestasDeCambioCampos_V20261119_30 r ON r.IdCampoPropuesto = k.IdCampoPropuesto AND r.Accion = N'antes rellenado';

SET IDENTITY_INSERT dbo.PropuestasDeCambioCampos ON;
INSERT INTO dbo.PropuestasDeCambioCampos
    (IdCampoPropuesto, IdPropuesta, SeccionId, CampoId, CampoEtiqueta, ValorAnterior, ValorPropuesto,
     FechaCreacion, FechaActualizacion)
SELECT r.IdCampoPropuesto, r.IdPropuesta, r.SeccionId, r.CampoId, r.CampoEtiqueta, r.ValorAnterior, r.ValorPropuesto,
       r.FechaCreacion, r.FechaActualizacion
FROM respaldo.PropuestasDeCambioCampos_V20261119_30 r
WHERE r.Accion = N'descartado'
  AND NOT EXISTS (SELECT 1 FROM dbo.PropuestasDeCambioCampos k WHERE k.IdCampoPropuesto = r.IdCampoPropuesto);
SET IDENTITY_INSERT dbo.PropuestasDeCambioCampos OFF;

-- Propuestas en vuelo: vuelven a apuntar a su perfil de origen.
UPDATE pc
SET pc.SubregistroId = r.SubregistroId
FROM dbo.PropuestasDeCambio pc
JOIN respaldo.PropuestasDeCambio_V20261119_30 r ON r.IdPropuesta = pc.IdPropuesta;

COMMIT TRANSACTION;
PRINT '[reversa V20261119_30] Notas, campos y propuestas restaurados desde el respaldo.';
