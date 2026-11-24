# 12. Auditoría de acceso y exposición por superficie

**Estado:** línea base verificada en código y pruebas automatizadas; superficie recontada el 20 de noviembre de 2026 (`main` en `e13002c4`).  
**Alcance:** API y las superficies que la consumen; no contiene datos reales ni requiere acceder a
producción.

Esta matriz convierte las reglas de acceso en un inventario comprobable. No sustituye una revisión
de cambios: toda ruta nueva debe entrar en una de estas superficies y tener una prueba proporcional
al dato o acción que expone.

## 12.1 Decisión por superficie

| Superficie | Quién puede entrar | Qué puede ver o hacer | Guarda del servidor | Evidencia automatizada |
|---|---|---|---|---|
| Portal público y geovisor | Visitante sin sesión | Solo contenido, directorios, archivos y cartografía explícitamente publicados | `AllowAnonymous`, filtro de publicación y DTO público sin datos personales | `AutorizacionPorDefectoTests`, `FichaPublicaSinDatosPersonalesTests`, circuitos de cada catálogo |
| Cuenta externa | Persona con sesión externa | Su sesión y las organizaciones en las que responde | `ExternalPolicy` y vínculo activo con rol `administrador` (el rol `propietario` se unificó en él) | `PropietarioRespondePorSuOrganizacionTests` |
| Gestión de organización | Administrador de la organización | Perfil, responsable, festivales, mercados y consultas de **su** organización | `AdministracionDeOrganizacion.PuedeAdministrarAsync` o `ResolverAccesoAsync`; filtros por `OrganizacionPrincipalId` | `MercadosDesdeLaOrganizacionTests`, `ConsultaGuiadaTransversalTests`, pruebas de perfil y de ediciones |
| Consola institucional | Personal interno autenticado | Operación institucional dentro de los módulos concedidos | `InstitutionalPolicy`, `PoliticaFuncionario` y permiso de módulo | `PuertaInstitucionalTests`, `PermisosPorCuentaTests` |
| Administración sensible | Webmaster, o un gestor con el módulo concedido | Cuentas, módulos, publicación, auditoría y configuración | `webmaster-institucional`, lista blanca de roles y módulos por cuenta (`ExigeModulo`); los permisos de acción de `dbo.Permisos` **no** intervienen (`07` §7.3) | `PuertaInstitucionalTests`, `GuardasDeRolTests`, `CandadoDelUltimoWebmasterTests` |

La sesión de consola y la externa son cookies distintas; solo las tres rutas de notificaciones aceptan cualquiera de las
dos (`cualquier-sesion-valida`) y filtran por destinatario. Las 35 rutas de `/admin` que exigen solo «usuario
autenticado» dependen de la política por defecto de la cookie de consola.

El menú del frontend nunca es una guarda. Las decisiones anteriores ocurren en el servidor; por eso
una URL escrita manualmente recibe `401`, `403` o `404` según corresponda.

## 12.2 Límites que no deben cruzarse

| Riesgo | Resultado que debe conservarse |
|---|---|
| Un endpoint nuevo olvida autorización | Se bloquea por `FallbackPolicy`; el censo exige declarar sesión o anonimato de forma explícita. |
| Una ruta pública enumera trabajo no publicado | La consulta filtra publicación y la ficha no visible responde como inexistente. |
| Una organización A usa el identificador de B | El servidor responde `403` antes de leer o modificar el recurso. |
| Una cuenta externa entra a la consola | El acceso institucional usa lista blanca de roles internos. |
| Un gestor institucional navega a un módulo no concedido | El servidor responde `403`; ocultar el enlace no concede acceso. |
| Un cambio de permiso deja el sistema sin administrador | Se conserva al menos un webmaster y nadie puede desactivar su propia cuenta crítica. |

## 12.3 Hallazgos de la línea base

No se confirmó una fuga de datos en las superficies prioritarias revisadas estáticamente. Sí se
confirmó un vacío de gobierno: la evidencia de los límites existía, pero estaba repartida entre
endpoints y pruebas y no había un inventario único para revisar un cambio transversal. Este documento
cierra ese vacío documental y enlaza cada superficie con su control verificable.

**Corregido después de la línea base.** `/api/v1/admin/data` solo exigía sesión de consola, y
un `gestor_interno` podía leer estructura, conteos y monitor aunque la navegación los reserve al
webmaster. Hoy `schema`, `stats`, `monitor` y el cambio de estado exigen la política
`webmaster-institucional`. La lista `records/festivals` es trabajo del módulo Ecosistema y exige
funcionario con ese módulo concedido. Evidencia: `AccesoAdminDataTests`.

Hay dos límites de la conclusión:

1. La matriz afirma el contrato del código y de su suite local; no es evidencia de una configuración
   de producción concreta.
2. Las integraciones nuevas, proveedores externos y archivos históricos deben añadirse a la matriz
   antes de exponerse, aunque reutilicen una política existente.

## 12.4 Protocolo para cambios futuros

Antes de fusionar un cambio que lea o escriba información:

1. Clasificar la ruta en la superficie de §12.1 y declarar explícitamente si es anónima o exige
   sesión.
2. Para información pública, justificar la visibilidad, usar un DTO de proyección y comprobar que
   un borrador/no publicado no se puede distinguir de un inexistente cuando aplique.
3. Para recursos de organización, probar al menos: propietario autorizado, organización distinta
   rechazada y operación de escritura con antiforgery cuando corresponda.
4. Para consola institucional, probar: sesión externa rechazada, gestor sin módulo rechazado y
   gestor con el módulo permitido solo en ese ámbito.
5. Ejecutar las pruebas de §12.5; las pruebas con SQL Server se realizan solo contra la instancia
   local efímera indicada en la documentación, nunca sobre datos reales.

## 12.5 Verificación local

```bash
cd simus-api
dotnet test tests/SIMUS.Api.Tests/SIMUS.Api.Tests.csproj \
  --filter "FullyQualifiedName~AutorizacionPorDefectoTests|FullyQualifiedName~PropietarioRespondePorSuOrganizacionTests|FullyQualifiedName~MercadosDesdeLaOrganizacionTests|FullyQualifiedName~ConsultaGuiadaTransversalTests|FullyQualifiedName~PuertaInstitucionalTests|FullyQualifiedName~PermisosPorCuentaTests"
```

La suite es deliberadamente negativa: no basta comprobar que el titular entra; también demuestra
que el visitante, la cuenta externa ajena y el gestor sin permiso no reciben la misma información ni
pueden ejecutar la acción.

## 12.6 Cifras de la superficie (20 de noviembre de 2026)

> El contrato vigente (23 de noviembre) declara **527 operaciones en 448 caminos**; la tabla de políticas de abajo es la medida del 20 de noviembre (505) y se recalcula con el procedimiento de §12.5.

Obtenidas leyendo `openapi.yaml` y la composición de rutas del código; la prueba `AutorizacionPorDefectoTests` contrasta el total de anónimas.

| Política | Operaciones |
|---|---:|
| `external-principal` (sesión externa) | 207 |
| `funcionario-institucional` (consola, rol interno y módulo) | 176 |
| `(AllowAnonymous)` | 65 |
| Solo «usuario autenticado» (política por defecto de la consola) | 35 |
| `institutional-principal` | 14 |
| `webmaster-institucional` | 4 |
| `cualquier-sesion-valida` | 3 |
| Sin resolver en el código | 1 |

Total: **505 operaciones** en 428 caminos; las 65 anónimas más 4 rutas de infraestructura (`/health/live`, `/health/ready`, el
respaldo 404 de `/api/{**resto}` y el que entrega `index.html`, todas en `Program.cs`) son las **69** que declara la prueba de barrido. Los módulos de la consola y las operaciones que
exige cada uno están en [`07`](../usuario/07-roles-y-permisos.md) §7.4.
