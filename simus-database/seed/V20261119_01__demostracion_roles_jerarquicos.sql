/*
    SIMUS · Demostración de los roles jerárquicos (decisión 135, DIR, docs/desarrollo/19-cuentas-y-organizaciones.md §19.13). Va DESPUÉS de
    `V20261117_65__demostracion_directorio_de_personas.sql` y de la migración `V20261118_30__jerarquia_de_roles_de_perfiles.sql`
    (que ya siembra las categorías y subcategorías: esto no las toca).

    Deja a tres personas de la demostración con roles que enseñan la selección múltiple por categoría:
      - Inés Cuesta: tres roles, dos subcategorías de «Creación e interpretación» (cantante, compositor) y una de «Técnica,
        lutería y producción» (productor).
      - Dora Pineda: «Gestor(a) cultural», categoría que se elige a sí misma, más «Docente» (otra categoría).
      - Tomás Guerrero: «Lutier» y «Docente» (dos categorías distintas).
    Así el filtro «Categoría de rol» del directorio encuentra gente en las cuatro categorías.
    IDEMPOTENTE: solo inserta lo que falta; no retira nada. No es una migración: vive en seed/ y solo la aplica
    ./scripts/demo/sembrar-demo.sh roles-jerarquicos.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @R TABLE (Correo nvarchar(180), Codigo nvarchar(40));
INSERT INTO @R VALUES
 (N'ines.cuesta@directorio.test', N'cantante'), (N'ines.cuesta@directorio.test', N'compositor'), (N'ines.cuesta@directorio.test', N'productor'),
 (N'dora.pineda@directorio.test', N'gestor'), (N'dora.pineda@directorio.test', N'docente'),
 (N'tomas.guerrero@directorio.test', N'luthier'), (N'tomas.guerrero@directorio.test', N'docente');

INSERT INTO dbo.PerfilesPublicosClasificaciones (IdUsuario, Dimension, Codigo)
SELECT u.IdUsuario, N'rol', r.Codigo
FROM @R r
JOIN dbo.Usuarios u ON u.CorreoElectronico = r.Correo
JOIN dbo.PerfilesPublicos pp ON pp.IdUsuario = u.IdUsuario
WHERE EXISTS (SELECT 1 FROM dbo.ValoresDeTaxonomiaDePerfiles t WHERE t.Dimension = N'rol' AND t.Codigo = r.Codigo)
  AND NOT EXISTS (SELECT 1 FROM dbo.PerfilesPublicosClasificaciones c WHERE c.IdUsuario = u.IdUsuario AND c.Dimension = N'rol' AND c.Codigo = r.Codigo);
