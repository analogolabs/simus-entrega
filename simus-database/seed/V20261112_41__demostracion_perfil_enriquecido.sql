/*
    SIMUS · Demostración del perfil público enriquecido (ME, docs/desarrollo/19-cuentas-y-organizaciones.md §19.12). Va DESPUÉS de
    `V20261106_11__demostracion_completa.sql` y de `V20261112_40__perfil_publico_enriquecido.sql`.

    Las personas de la demostración publicaron su perfil cuando las organizaciones se mostraban solas, por
    ser miembro. Ahora mostrar una organización exige que la persona la ELIJA: esta semilla hace esa elección
    por ellas (las organizaciones en las que son miembros activos) para que la demostración se vea como antes, y
    les añade biografía y oficios. Solo toca perfiles de cuentas de dominio .test que aún no tienen biografía:
    es IDEMPOTENTE y no pisa lo que una persona haya escrito después.

    NO ES UNA MIGRACIÓN: vive en seed/ y solo la aplica ./scripts/demo/sembrar-demo.sh perfiles.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Datos TABLE (Correo nvarchar(180) PRIMARY KEY, Corta nvarchar(280), Larga nvarchar(4000), Oficios nvarchar(max));
INSERT INTO @Datos VALUES
 (N'lucia.ramirez@cantaclaro.test', N'Cantadora y gestora cultural del Cauca.',
  N'Canto músicas campesinas y vocales del Macizo desde hace más de veinte años y dirijo el festival de la corporación.',
  N'["Cantadora","Gestora cultural"]'),
 (N'andres.munoz@cantaclaro.test', N'Intérprete de música tradicional.',
  N'Toco y enseño músicas tradicionales con los jóvenes de mi municipio.',
  N'["Intérprete","Docente"]'),
 (N'camilo.rojas@llanoadentro.test', N'Copleros del Llano.',
  N'Recojo y canto coplas llaneras con la gente mayor de la región.',
  N'["Coplero","Investigador"]'),
 (N'valentina.ocampo@correo.test', N'Archivista sonora y gestora independiente.',
  N'Cuido archivos sonoros comunitarios y acompaño procesos de memoria musical.',
  N'["Archivista","Gestora"]');

UPDATE pp
SET BiografiaCorta = d.Corta,
    BiografiaLarga = d.Larga,
    RolesJson = d.Oficios,
    OrganizacionesVisiblesJson = (
        SELECT CONCAT(N'[', STRING_AGG(CAST(ue.IdEntidad AS nvarchar(20)), N','), N']')
        FROM dbo.UsuariosEntidades ue
        WHERE ue.IdUsuario = pp.IdUsuario AND ue.Activo = 1),
    FechaActualizacion = SYSUTCDATETIME()
FROM dbo.PerfilesPublicos pp
JOIN dbo.Usuarios u ON u.IdUsuario = pp.IdUsuario
JOIN @Datos d ON d.Correo = u.CorreoElectronico
WHERE pp.BiografiaCorta IS NULL;
