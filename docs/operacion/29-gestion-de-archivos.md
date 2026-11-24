# 29. Gestión de archivos del producto

**Estado: protocolo vigente en lo que ya hace el sistema y propuesta en lo que falta** (versión 1.0, 11 nov 2026,
Define cómo se gestionan los archivos en dos planos que no deben mezclarse:

- **Parte A, del producto:** los archivos que suben las personas a SIMUS (imágenes, PDF, soportes) y cómo el
  sistema los guarda, vincula, retira, archiva y respalda.
- **Parte B, del desarrollo:** los archivos que produce el equipo al construir SIMUS (siembras, capturas, informes,
  binarios), qué se versiona en el repositorio y qué no, dónde se guardan los entregables y qué reglas siguen
  los agentes que trabajan en paralelo.

Se apoya en [`docs/operacion/28-tabla-de-retencion-documental.md`](28-tabla-de-retencion-documental.md) (retención y almacenamiento), en
[`docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md`](../desarrollo/24-versionamiento-y-gobierno-del-dato.md) (bitácora y registro de cambios) y en
[`docs/usuario/23-guia-de-estilo-de-textos.md`](../usuario/23-guia-de-estilo-de-textos.md) (cómo se escriben los textos).

## 29.1 Cómo leer las marcas

| Marca | Significado |
|---|---|
| **[Regla]** | Lo que el equipo ya aplica o lo que la dirección decidió. Se cumple. |
| **[Código]** | Se comprobó leyendo el repositorio. Si no se midió en una base real, se dice. |
| **[Propuesta]** | Propuesta de este documento; no es regla hasta que se apruebe. |
| **[Verificado]** / **[No verificado]** | Dato externo confirmado (o no) con búsqueda web, sin abrir los textos oficiales completos. |
| **[Observado]** | Lo que se vio en la máquina de trabajo en una fecha concreta. |

## 29.2 Qué significa «no borrar nunca»

**[Regla]** (aclaración de la dirección, 11 nov 2026, recogida en `docs/operacion/28-tabla-de-retencion-documental.md` §28.0). **Nada se borra de forma
automática.** Está prohibido todo borrado automático: tareas de retención, depuraciones programadas y limpieza por
antigüedad. **El borrado manual sí está permitido** a quien tiene permiso, con diálogo de confirmación, motivo cuando
aplique, línea de bitácora y, cuando proceda, evidencia.

Esa definición rige las dos partes. En el producto, el sistema no elimina archivos por su cuenta. En el desarrollo,
ningún agente ni guion limpia material ajeno ni borra fuera de lo que creó.

---

## 29.3 Quién sube, qué tipos y qué tamaños

**[Código]** Hay tres puertas de subida, todas hacia el mismo Banco de archivos (`dbo.Archivos`):

| Puerta | Quién | Condiciones |
|---|---|---|
| **Consola** (`/api/v1/institucional/archivos`) | Funcionarios con el módulo que corresponda | Sesión de la consola y testigo antiforgery |
| **Organizaciones** (`/api/v1/externo/archivos`) | Cuentas de una organización | Correo confirmado y cuota por organización (guardas propias de esta puerta) |
| **Personas** (foto del perfil individual) | La propia cuenta | Solo su foto; nombre almacenado con el prefijo `personaN-` |

| Tipo | Formatos | Tope |
|---|---|---|
| Imagen | PNG, JPEG, WebP, reconocidos por su **firma** y no por la extensión | **2 MiB** |
| Documento | PDF, reconocido por su firma | **20 MiB** |

El tope vive en dos sitios a propósito: el código rechaza con un mensaje claro y una restricción de la base
(`CK_Archivos_PesoPorTipo`) impide que una escritura directa lo salte. El servidor rechaza ejecutables, SVG con
código y nombres con rutas.

## 29.4 Dueño y cuota

**[Código]** Cada archivo tiene un **dueño**: una persona, una organización o el Programa. El dueño decide quién
puede retirarlo y contra quién cuenta la cuota. La **cuota es de 50 MiB por organización** y solo se aplica a
archivos de organización; las personas y el Programa no tienen cuota hoy (`docs/operacion/28-tabla-de-retencion-documental.md` §28.12). Superar la cuota
bloquea subidas nuevas y **nunca elimina nada**.

## 29.5 Deduplicación

**[Código]** Al subir, el servidor calcula el **SHA-256** (la «huella») y busca un archivo del **mismo dueño** con la
misma huella. Si existe, reutiliza esa fila y no guarda otra copia. Si se sube la misma imagen con otra descripción,
se actualiza el texto alternativo de la imagen existente, el sistema avisa («Ya tenías esta imagen; actualicé su
descripción») y el cambio queda en el registro de cambios.

**[Propuesta]** La deduplicación **entre dueños** (un almacén de contenidos por huella) está diseñada en `docs/operacion/28-tabla-de-retencion-documental.md`
§28.14. Debe ser interna: ningún mensaje ni tiempo de respuesta puede revelar que otro dueño ya subió ese archivo.

## 29.6 Vínculos

**[Código]** Un archivo se usa a través de vínculos (`dbo.ArchivosDeRegistro`, `dbo.EdicionesFestivalMateriales`,
`dbo.EventosAgendaArchivos`, `dbo.NoticiasArchivos`) y puede ser también un soporte de una solicitud de
reclamación. **Un archivo vinculado no se retira:** el retiro comprueba los vínculos primero. Los soportes de una
solicitud tampoco se retiran mientras la solicitud los cite.

## 29.7 Retiro manual

**[Regla]** Retirar un archivo es una **acción manual** de quien tiene permiso, y **es válida aunque borre de
forma física** (`docs/operacion/28-tabla-de-retencion-documental.md` §28.0). Hoy `RetirarAsync` elimina la fila y los bytes. Lo que debe tener toda vez que se
retira, y que está añadiendo:

1. **Diálogo de confirmación**, que avisa de que es irreversible y de qué vínculos tenía.
2. **Motivo** cuando aplique (por ejemplo, retirar un soporte que cita una solicitud).
3. **Línea de bitácora** con el contrato único de `docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md` (`archivo.retirado`, con huella, tamaño y actor; nunca
   el binario).
4. **Evidencia** cuando proceda (acta, si el archivo era un soporte con datos personales).

**[Propuesta]** Como opción posterior, el retiro ofrece también **archivar** (conservar la fila y los bytes y
permitir restaurar). Es una opción de ahorro y de reversibilidad, no una corrección.

## 29.8 Archivado

**[Propuesta]** (`docs/operacion/28-tabla-de-retencion-documental.md` §28.14, §28.15) Archivar mueve el contenido a un nivel de almacenamiento más barato y deja
en la base la fila con huella, tamaño, tipo, estado y ubicación. **Archivar por antigüedad es mover, no borrar,** y
puede programarse (un archivo sin vínculos durante 90 días, un retirado durante 30, un soporte de solicitud decidida
durante 180). Lo que nunca se programa es eliminar. Se activa solo cuando el informe de almacenamiento lo justifique.

## 29.9 Bitácora y registro de cambios

**[Propuesta]** Cada acción sobre un archivo deja una línea con el contrato `{ evento, antes, despues, motivo, origen }`:
`archivo.subido`, `archivo.reemplazado`, `archivo.retirado`, `archivo.archivado`, `archivo.restaurado`,
`archivo.verificado` y `archivo.verificacion_fallida`. El estado y la ubicación son campos con historial en el
registro de cambios. La **lectura** de un soporte que contenga datos personales se registra con el verbo `consultar`,
con los nombres de los campos y no con los valores. Las pruebas de todo lo que escriba bitácora se hacen contra SQL
Server (sus restricciones no existen en SQLite).

## 29.10 Restauración

**[Código]** Hoy **no hay restauración**: lo que se borra a mano no se recupera de la aplicación, y reemplazar una
imagen del CMS borra la anterior (`V20260829_03`). **[Propuesta]** Con el archivado, la restauración a pedido devuelve
el contenido a caliente: la consola con permiso de Auditoría, y el dueño por solicitud (`docs/operacion/28-tabla-de-retencion-documental.md` §28.18).

## 29.11 Copia de seguridad

**[Código]** Los bytes viven **dentro de la base de datos**, así que las copias de la base **son** la copia de los
archivos. En Azure SQL las gestiona el servicio (`requestedBackupStorageRedundancy: 'Local'` en `infra/main.bicep`);
en local, el volumen de Docker. La oferta gratuita de Azure SQL incluye 32 GB de respaldo y recuperación a un punto en
el tiempo de siete días **[Verificado]** en resultados de búsqueda. **Una copia de siete días no es un archivo:** lo
que haya que conservar más tiempo necesita su propio almacén (`docs/operacion/28-tabla-de-retencion-documental.md` §28.15).

## 29.12 Qué es válido y qué no

| Situación | ¿Válida? | Condición |
|---|---|---|
| Una persona autorizada retira un archivo con borrado físico | **Sí** | Con confirmación, motivo si aplica y bitácora |
| Una persona autorizada reemplaza una imagen del CMS y se pierde la anterior | **Sí** | Es manual; se puede ofrecer una copia en frío como opción |
| Una tarea programada borra archivos sin uso | **No** | Convertirla en archivado |
| Una depuración elimina previsualizaciones de importación a los 30 días | **Excepción por justificar** | Por escrito: son temporales, sin valor de registro (`docs/operacion/28-tabla-de-retencion-documental.md` §28.18, decisión 5) |
| Un archivo supera la cuota | **Se bloquea la subida** | Nunca se elimina nada |
| Mover un archivo a frío por antigüedad | **Sí** | Con huella verificada y recuperable |

---
