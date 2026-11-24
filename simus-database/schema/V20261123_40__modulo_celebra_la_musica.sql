/*
  SIMUS · Módulo propio «Celebra la Música» en la consola

  Hasta ahora las ediciones de Celebra la Música se editaban y publicaban con el módulo «categorias»
  (Categorías y proyectos). Pasa a ser un apartado propio, con su propio permiso: «celebra». Lo gestionan
  solo las personas a las que quien administra se lo concede en «Usuarios y roles».

  NO QUITA ACCESO A NADIE. Quien hoy gestiona Celebra por «categorias» recibe «celebra» al aplicar esta
  migración, y el webmaster también (el webmaster los tiene todos por definición, pero se siembra la fila
  para que la pantalla de permisos muestre un estado coherente). A partir de ahí, se revoca cuenta por cuenta
  en Usuarios y roles > Módulos del gestor (casilla «Celebra la Música»).

  ES IDEMPOTENTE Y ADITIVA: no borra ni cambia nada; la restricción única (IdUsuario, CodigoModulo) y el
  NOT EXISTS impiden duplicados al reaplicarla. Si la tabla ModulosPorCuenta aún no existe, no hace nada.
*/

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = N'ModulosPorCuenta' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    INSERT INTO dbo.ModulosPorCuenta (IdUsuario, CodigoModulo, FechaOtorgado, IdUsuarioQueOtorgo)
    SELECT DISTINCT u.IdUsuario, N'celebra', SYSUTCDATETIME(), NULL
    FROM dbo.Usuarios u
    WHERE (
            EXISTS (SELECT 1 FROM dbo.ModulosPorCuenta m
                    WHERE m.IdUsuario = u.IdUsuario AND m.CodigoModulo = N'categorias')
         OR EXISTS (SELECT 1 FROM dbo.UsuariosRoles ur
                    JOIN dbo.Roles r ON r.IdRol = ur.IdRol
                    WHERE ur.IdUsuario = u.IdUsuario AND r.NombreRol = N'webmaster')
          )
      AND NOT EXISTS (SELECT 1 FROM dbo.ModulosPorCuenta x
                      WHERE x.IdUsuario = u.IdUsuario AND x.CodigoModulo = N'celebra');
END;
GO
