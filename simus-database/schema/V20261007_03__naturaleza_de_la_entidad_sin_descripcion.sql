/*
    SIMUS · Naturaleza de la entidad: sin descripcion

    `V20261007_01` dejo en la descripcion de cada valor el codigo del RUT («RUT, casilla 62, codigo 03.»).
    No aporta a quien elige: la lista (Publica, Privada, Mixta) se explica sola. La equivalencia con
    el RUT sigue documentada en `02_Documentacion/13_Catalogos_maestros`.

    Solo borra el texto que puso aquella migracion; si alguien escribio otra descripcion, no se toca.
    Idempotente.
*/
SET NOCOUNT ON;
GO

UPDATE dbo.NaturalezasEntidad
SET Descripcion = NULL
WHERE Slug IN (N'publica', N'privada', N'mixta')
  AND Descripcion LIKE N'RUT, casilla 62, código 0_.%';
GO
