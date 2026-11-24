# 7. Roles y permisos

## 7.1 Los dos espacios de acceso

SIMUS distingue **quién entra** antes que **qué puede hacer**. Hay dos espacios con puertas
separadas:

- El **espacio de la organización**, al que entra quien representa a una entidad registrada. Ve y
  administra únicamente los procesos de su propia organización.
- El **espacio de gestión administrativa**, al que entra el personal institucional. Ve el conjunto
  del sistema y decide sobre él.

Una cuenta pertenece a uno u otro canal de acceso, y esa separación es estructural: no se resuelve
con un permiso.

## 7.2 Los roles

Hay tres **roles de plataforma**, que se asignan a la cuenta:

| Rol | Alcance |
|---|---|
| `externo` | cuenta externa: persona que gestiona sus procesos y, si tiene vínculo, los de una organización. No entra a la consola |
| `gestor_interno` | segundo nivel institucional: ve solo los módulos que se le concedieron por cuenta, más los que siempre tiene |
| `webmaster` | control total de la consola: ve todos los módulos y administra usuarios y sistema |

Los roles viven en `Roles` y se asignan en `UsuariosRoles`. La puerta de la consola es una **lista blanca** de los dos roles
internos (`webmaster`, `gestor_interno`); una cuenta no puede tener a la vez un rol interno y `externo`.

Aparte está el **rol de una persona dentro de una organización**, que no es un rol de plataforma sino un vínculo
(`RolesDeEntidad`, doc. [`19`](../desarrollo/19-cuentas-y-organizaciones.md)):

| Rol en la organización | Qué puede |
|---|---|
| `administrador` | administra: equipo, invitaciones y reclamaciones; es quien responde por la organización, y solo a él se le ofrecen publicar, archivar y eliminar ediciones |
| `editor` | edita los procesos y el perfil de la organización; no recibe las acciones reservadas al administrador |

El antiguo rol `propietario` ya no existe: se unificó en `administrador`.

## 7.3 Los permisos de acción: un catálogo que no gobierna el acceso

`dbo.Permisos` declara **15 permisos de acción** (`registros.revisar`, `registros.publicar`, `entidades.administrar`,
`gobernanza.resolver_vinculos`, `festivales.decidir`, `propuestas.decidir`, `festivales.normalizar`, `cms.editar`,
`cms.publicar`, `cms.importar`, `equipo_web.editar`, `equipo_web.publicar`, `usuarios.administrar`,
`sistema.configurar` y `monitor.consultar`) y `dbo.RolesPermisos` los reparte entre los roles: al `webmaster` los 15, al
`gestor_interno` nueve (todos menos `registros.publicar`, `cms.publicar`, `cms.importar`, `equipo_web.publicar`,
`usuarios.administrar` y `sistema.configurar`) y a `externo` ninguno.

**Pero estos permisos no gobiernan el acceso.** Comprobado en el código del corte del 20 de noviembre de 2026: `SIMUS.Api` hace
**cero consultas** a `Permisos` y `RolesPermisos`. Lo que decide si una ruta responde es, en este orden, la política de
autorización declarada en la ruta (sesión externa, sesión institucional, funcionario o webmaster), la lista de roles
escrita en el código, el **módulo concedido a la cuenta** (§7.4) y, para recursos de una organización, el vínculo de la
persona con ella. El catálogo es hoy un inventario de referencia y la base de un posible control fino futuro; no debe
leerse como la matriz real de quién puede qué. Esa matriz, ruta por ruta, está en la
[auditoría por superficie](../desarrollo/12-acceso-por-superficie.md).

## 7.4 Los módulos se conceden por cuenta

Además del rol, **cada cuenta de consola tiene una lista de módulos** que ve y gestiona en la navegación izquierda. Vive en
`ModulosPorCuenta`, con el módulo concedido, la fecha y la cuenta que lo concedió, y es lo que el servidor exige con
`ExigeModulo` (un módulo no concedido responde `403` aunque se escriba la URL).

Esta es una decisión de producto deliberada: **los permisos de la consola se definen por cuenta y no
por rol.** Dos personas con el mismo rol pueden tener módulos distintos, porque lo que determina qué
administra alguien es su encargo, no su nivel jerárquico.

Hay **19 módulos** en `ModulosDeLaConsola`:

| Tipo | Módulos |
|---|---|
| Siempre activos para toda cuenta de consola | `monitor` (Resumen operativo), `solicitudes` (Solicitudes y revisiones) |
| Solo el webmaster | `usuarios` (Usuarios y roles), `sistema` (Salud del sistema) |
| Se conceden por cuenta (el webmaster los tiene todos) | `ecosistema` (Festivales y ediciones), `mercados`, `talleres`, `espacios`, `redes` (los tres se abren en «Procesos del ecosistema»), `organizaciones`, `catalogo-editorial`, `agenda`, `noticias`, `categorias`, `banco-de-archivos`, `gestion-sitio`, `boletin`, `analisis`, `auditoria` |

Las 17 secciones de la consola salen de estos módulos (`talleres`, `espacios` y `redes` comparten una). La matriz
completa —sección, panel y operaciones que exige cada módulo— se genera del código y se recomprueba con el procedimiento de
`docs/desarrollo/12-acceso-por-superficie.md` §12.5.

## 7.5 Cómo nace una cuenta administrativa

Una cuenta administrativa **no se autogestiona**: la crea quien ya administra el sistema.

1. Se decide **antes de crearla** qué módulos tendrá.
2. Se entrega con correo electrónico y una contraseña por omisión.
3. En el primer ingreso, la persona debe cambiar la contraseña y completar su perfil.

El indicador `DebeCambiarContrasena` fuerza el primer paso y `PerfilCompletado` el segundo. Mientras
no los cumpla, la cuenta no opera.

### Cuentas de arranque y cambio de clave en el primer ingreso

Las cuentas administrativas de arranque (`webmaster@simus.test`, webmaster, y `gestor@simus.test`,
gestor interno; `DatabaseBootstrapper.CuentasDeArranque`) inician con la clave por defecto «admin».
Para una instalación nueva, como el repositorio de entrega, se puede exigir que la persona la cambie
al entrar por primera vez:

| Qué | Cómo | Por omisión |
|---|---|---|
| Cuentas de arranque de la API | `Database:BootstrapExigirCambioDeClave=true` (variable `Database__BootstrapExigirCambioDeClave`, p. ej. en `.env`) | `false` |
| Cuentas administrativas de la siembra integral (`webmaster@simus.test`, `gestor@simus.test`) | `SIMUS_SIEMBRA_EXIGIR_CAMBIO_DE_CLAVE=1` al generar o aplicar la siembra | `0` |

Con la opción encendida, esas cuentas nacen con `DebeCambiarContrasena = true`: el ingreso responde
bien pero la consola solo deja cambiar la contraseña (`POST /api/v1/admin/auth/mi-contrasena`). La
política exige al menos 12 caracteres y que la nueva sea distinta de «admin»; tras cambiarla, el
ingreso es normal y no se vuelve a pedir. La marca se pone **solo al crear** la cuenta: una cuenta
que ya existe, y por tanto una persona que ya cambió su clave, no se vuelve a marcar. Las cuentas
externas de arranque y de la siembra no se tocan. Cubierto por `CuentasDeArranqueCambioDeClaveTests`.

## 7.6 Cómo nace una cuenta externa

Una organización se registra por su cuenta desde el espacio externo. **Sin correo electrónico
confirmado no puede registrar procesos**: la confirmación es la puerta.

Mientras no haya proveedor de correo contratado, la confirmación la realiza el equipo del PNMC desde
la consola, dejando registrado el motivo y la cuenta que la ejecutó. No se sustituye la verificación
real por un mecanismo permanente de simulación.

## 7.7 Qué queda registrado

Toda concesión y toda decisión quedan en la bitácora de auditoría con su cuenta ejecutora y su fecha.
Conceder un módulo, confirmar un correo, aprobar un registro o aceptar una propuesta de cambio son
actos atribuibles y consultables después.

## 7.8 Auditoría por superficie

La [matriz de auditoría de acceso](../desarrollo/12-acceso-por-superficie.md) traduce estos roles y
módulos en límites verificables para el portal público, el canal externo y la consola institucional.
Debe actualizarse cuando se incorpora una nueva ruta o integración que lea o escriba información.
