# 11. Operación y mantenimiento

## 11.1 Operación corriente

| Tarea | Cómo |
|---|---|
| Levantar el entorno | `./scripts/local/dev-up.sh` |
| Comprobar que responde | `./scripts/local/dev-check.sh` |
| Detener sin perder datos | `./scripts/local/dev-down.sh` |
| Reiniciar aplicando migraciones | `./scripts/local/dev-refresh.sh` |
| Aplicar migraciones pendientes | `./scripts/local/schema-local.sh migrar` |

`dev-down.sh` detiene el contenedor de SQL Server y **conserva su volumen**: ninguna operación
corriente borra datos.

## 11.2 Estado del sistema

El API expone dos comprobaciones: `/health/live` responde si el proceso está en pie y `/health/ready`
si además puede atender, incluida la conexión con la base. La consola tiene una sección de **Salud
del sistema** que las consulta y muestra el resultado.

## 11.3 Trazabilidad

Cada acción con efecto sobre un registro queda en la bitácora de auditoría, identificada con el par
**módulo + identificador de registro**, la cuenta que la ejecutó y su fecha. La consola la expone en
**Auditoría y trazabilidad**, y cada ficha tiene además su propio historial, que reúne de dónde vino
el registro, qué versiones se han publicado y qué le ha ocurrido.

Un registro retirado no desaparece de la bitácora: la trazabilidad sobrevive al registro.

## 11.4 Datos personales

El sistema trata datos personales bajo la **Ley 1581 de 2012**. El principio que ordena la
implementación es que una autorización vale como prueba solo si puede demostrarse **qué texto leyó el
titular** al otorgarla; por eso el texto de cada política se versiona y se **copia dentro** de la
autorización en lugar de referenciarse.


#### Base de datos

`dbo.PoliticasDatos` — el texto versionado que sirve el servidor. Una sola vigente por clave, y lo
garantiza un **índice único filtrado** (`WHERE Vigente = 1`), no el código: con dos filas vigentes
de la misma clave, la respuesta del servidor dependería del orden de lectura y dos personas podrían
aceptar textos distintos creyendo que aceptan el mismo.

`dbo.AutorizacionesDatos` — cada autorización, con el texto **copiado dentro**. Copiado y no
referenciado: una referencia dice a qué fila apuntó; la copia dice qué leyó. Solo la segunda sirve
como prueba. El titular puede ser una cuenta **o** solo un correo (CHECK exige al menos uno), que es
por lo que el boletín había tenido que montarse su propio mecanismo aparte. Revocar **no borra la
fila**: le pone fecha.

#### Las finalidades

Son tres: `tratamiento`, `terminos` y `boletin`. El sistema **solo pide autorización para
finalidades que ejerce**: una lista de permisos que no se corresponde con lo que de verdad ocurre
con los datos del titular no cumple su función.

#### API

- `GET /api/v1/publico/politicas` y `/publico/politicas/{clave}` — **anónimas a propósito**: el art.
  12 obliga a informar *antes* de pedir la autorización, y quien va a registrarse todavía no tiene
  cuenta.
- `GET /api/v1/externo/mis-autorizaciones` y `POST .../{finalidad}/revocar` — con sesión.
- `RegistroDeAutorizaciones` — el **único** punto por el que se otorga o se retira una autorización.
  Cualquier puerta nueva pasa por ahí.

#### Frontend

- **Registro**: una casilla por finalidad vigente, con el **texto entero** desplegable, su versión a
  la vista y el enlace al documento del Ministerio. El boletín aparece marcado **«Opcional»**: que
  se pueda completar el alta sin él es lo que lo convierte en una autorización libre y no en un
  peaje.
- **`/politicas/{clave}`**: el texto que el sistema publica, leíble sin cuenta. Enlazado desde el pie
  del sitio, donde «Política de privacidad» y «Términos y condiciones» salían a `mincultura.gov.co`:
  documentos institucionales legítimos, pero no lo que **este** sistema le dijo a esta persona.
- **«Mis autorizaciones»**, dentro de *Cuenta y seguridad*: qué autorizó, cuándo, en qué versión, y
  el texto exacto. Lo retirado se sigue enseñando —tachado y con su fecha—, porque una lista que
  solo muestra lo vigente no permite comprobar que algo se retiró de verdad.

#### Qué se puede retirar, y qué no

`boletin` se retira en el acto, y al hacerlo la suscripción pasa a baja: dejarla activa haría que el
sistema siguiera escribiéndole a quien acaba de decir que no.

`tratamiento` y `terminos` no se retiran por separado. El art. 9 del decreto 1377 lo admite cuando
el titular tiene un deber legal o contractual de permanecer en la base, y quien responde por una
organización con procesos inscritos está en ese caso. **Lo que no se hace es poner el botón y que
conteste que no**: cuando no procede, el botón no está y en su lugar va el motivo escrito.

Una autorización **nunca se borra**: revocarla le pone fecha de retiro y la fila permanece, que es lo
que permite demostrar después tanto que se otorgó como que se retiró.

## 11.5 Retención de importaciones asistidas

Las previsualizaciones de una importación son material temporal y se depuran automáticamente al
expirar su plazo. Las cabeceras de los lotes aplicados, las decisiones humanas y la auditoría se
conservan: son evidencia administrativa, y su eliminación no se automatiza mientras la Tabla de
Retención Documental institucional no defina serie, tiempo y disposición.

La depuración es irreversible dentro de la base operativa. Una previsualización expirada se
reconstruye volviendo a cargar el archivo fuente.

## 11.6 Mantener el código

cómo se nombran y dónde viven las cosas en SIMUS. Es la referencia para escribir
código nuevo y para decidir si algo que llega de otro desarrollo puede entrar tal cual.


### El idioma es el español

Lo que es nuestro se escribe en español: tablas, columnas, endpoints, ficheros, clases, métodos,
variables, comentarios y textos de interfaz. Lo que llega de un desarrollo de referencia se traduce
al entrar, o se justifica por escrito por qué no.

Hay dos excepciones, y solo dos:

- **Lo que impone una plataforma o una biblioteca**: `ngOnInit`, `HttpClient`, `IActionResult`,
  los nombres de las clases de Tailwind, los verbos HTTP.
- **Lo que ya está publicado y romperlo tiene coste**: una ruta pública que alguien pueda tener
  guardada. En ese caso se documenta la deuda en vez de dejarla sin nombrar.

Quedan en el código nombres en inglés heredados de los desarrollos de origen —`selectedWorkItem`,
`fetchAgendaEvents`, `workQueueFilter`—. No se renombran en masa: se traducen cuando se toca la
pieza, para no convertir cada corrección en una migración.

### Nomenclatura por tipo de elemento

| Elemento | Forma | Ejemplo |
|---|---|---|
| Fichero de componente Angular | `kebab-case.component.ts` | `ficha-en-revision.component.ts` |
| Selector de componente | `app-kebab-case` | `app-ficha-en-revision` |
| Servicio | `kebab-case.service.ts` | `festivales-publicos.service.ts` |
| Clase, interfaz, tipo | `PascalCase` | `FichaDeFestivalEnRevision` |
| Señal, método, variable | `camelCase` | `unifiedWorkQueue`, `contarPublicados` |
| Constante de módulo | `MAYUSCULAS_CON_GUION_BAJO` | `CATEGORIAS_ECOSISTEMA` |
| Migración SQL | `VAAAAMMDD_NN__descripcion_en_espanol.sql` | `V20260913_01__ediciones_en_revision.sql` |
| Tabla y columna | `PascalCase` en español | `dbo.Festivales`, `FechaEnvioRevision` |
| Ruta del API | `/api/v1/{ambito}/{recurso}` en español | `/api/v1/publico/agenda` |
| Documento de producto | `kebab-case.md` | `base-de-datos.md` |

### Los cuatro ámbitos del API

Toda ruta declara para quién es, y eso decide qué sesión exige:

| Ámbito | Quién entra | Ejemplo |
|---|---|---|
| `/api/v1/publico/` | cualquiera, sin sesión | `/publico/festivales` |
| `/api/v1/externo/` | una organización con su sesión externa | `/externo/festivales/{id}` |
| `/api/v1/institucional/` | el equipo del PNMC, con sesión administrativa | `/institucional/festivales` |
| `/api/v1/admin/` | operación y gobierno de la consola | `/admin/auditoria` |

Son **dos cookies distintas** —externa e institucional— y no se mezclan. Un endpoint que sirva a
dos ámbitos se declara dos veces antes que aceptar cualquiera de las dos sesiones.

### Dónde va cada cosa

```text
simus-web/src/app/
  core/            servicios, contratos, http, navegación y utilidades compartidas
  shared/          componentes de interfaz reutilizables y directivas
  features/        una carpeta por área funcional, con sus páginas y sus componentes
simus-web/tools/    utilidades del proyecto que no se publican con la aplicación
simus-web/trinquete/ los trinquetes y sus techos sellados
simus-api/src/      Api (endpoints), Application, Domain, Infrastructure
simus-database/     esquema DbUp y datos de referencia
scripts/           arranque, comprobación y mantenimiento del entorno local
```

Un componente que usan dos áreas vive en `shared/`; uno que usa una sola, dentro de su área. Un
servicio que habla con el API vive en `core/services/`, nunca dentro de una página.

### Estilo del código

- **Los comentarios explican por qué, no qué.** Un comentario que repite lo que dice la línea de
  abajo sobra; uno que explica por qué la pieza es así y qué alternativas no funcionan evita que alguien
  deshaga la decisión dentro de tres meses.
- **Nada de CSS minificado a mano.** Una regla duplicada dentro de una línea de miles de caracteres
  líneas de hasta 4 712 caracteres, y en las cuatro ganaba la copia equivocada.
- **Los colores se nombran por su papel**, no con su hexadecimal: el trinquete `colores_literales`
  lo vigila. Los papeles del texto están en `simus-web/src/styles.css`.
- **Los tamaños salen de la escala tipográfica** (`--text-dato`, `--text-cuerpo`, `--text-lectura`,
  `--text-destacado`, `--text-titulo`), con 12 px como suelo.
- **Los controles salen de `app-boton` y de la escala de áreas de toque** (`--spacing-control*`).

## 11.8 Correo de la demo local con Mailpit

La demo local puede mostrar el correo que SIMUS «envía» sin entregar nada a nadie: **Mailpit** es una bandeja web
que recibe por SMTP todo lo que la API manda (confirmación de correo del registro, invitaciones del equipo y de
agenda, recuperación y cambio de contraseña, avisos de revisión) y deja abrir los enlaces.

- **Ver los correos:** <http://127.0.0.1:8025>. SMTP en `127.0.0.1:1025`. Ambos puertos escuchan solo en bucle local.
- **Cómo queda activo:** `./scripts/demo/reiniciar-demo.sh --si` levanta Mailpit (vacío) y arranca la API con
  `Correo__Proveedor=Smtp` hacia él, con `Correo__UrlPublica=http://127.0.0.1:<puerto web>` para que los enlaces
  abran la demo. La API sigue encolando en `dbo.Notificaciones` y un servicio en segundo plano los envía cada 5 s;
  si Mailpit estuviera caído, el correo queda `pendiente` y se reintenta (hasta 20 veces) sin perderse.
- **A mano:** `./scripts/local/mailpit-local.sh up | vaciar | estado | down`. Puertos y contenedor se cambian con
  `SIMUS_LOCAL_SMTP_PORT`, `SIMUS_LOCAL_MAILPIT_WEB_PORT` y `SIMUS_LOCAL_MAILPIT_CONTAINER` (una prueba aislada
  usa otros para no tocar la demo). Para vaciar la bandeja entre tomas de un video: `./scripts/local/mailpit-local.sh vaciar`.
- **Cómo se desactiva:** `SIMUS_DEMO_SIN_MAILPIT=1 ./scripts/demo/reiniciar-demo.sh --si` (sin Mailpit, los correos
  quedan en la cola, como siempre), o simplemente no definir `Correo__Proveedor`. El valor por omisión de
  `appsettings.json` sigue siendo `Ninguno`; Mailpit solo se activa por variables de entorno del script.
- **Qué no es:** no es un proveedor real ni sirve en producción (ver 15.3). No lleva autenticación ni TLS.
## 11.6 ter Acceso rápido de cuentas de demostración (temporal)

Elemento flotante discreto (esquina inferior izquierda) que, en las pantallas de ingreso, lista cuentas de demostración y, al elegir una, rellena correo y contraseña sin escribir (con el interruptor «Ingresar al elegir» además envía el formulario). Es para el test y las grabaciones; es **temporal y quitable** y no deja rastro en producción.

- **Apagado por omisión y sin datos en el paquete.** Solo existe si hay un archivo `simus-web/public/config-demo.js` con `window.__SIMUS_DEMO__ = { accesoRapido: true, cuentas: [{ rotulo, correo, clave, ambito: 'externo' | 'administrativo' }] }`. Ese archivo está en `.gitignore`, no se versiona y lo escribe la demo. Sin él no se carga ni se muestra nada.
- **Solo desarrollo y solo local.** `main.ts` lo pide únicamente en un build de desarrollo y desde `localhost`/`127.0.0.1`; en el build de producción `angular.json` sustituye `arranque.ts` por `arranque.production.ts` (vacío) y el componente no entra en ningún paquete (comprobado: ni `config-demo` ni el componente aparecen en `dist`). Bajo el servidor de desarrollo, el componente es un trozo aparte (`import()`), fuera del paquete inicial.
- **Solo en los ingresos.** Se muestra cuando están a la vista los campos del ingreso externo (`/ingresar`) o del ingreso de la gestión (`/administracion`), y solo con las cuentas de ese ámbito. No tapa el formulario ni el botón de consulta guiada (queda abajo a la izquierda); es un botón con `aria-expanded`, cierra con Escape y anuncia lo rellenado.
- **Cuentas.** La lista, sin claves, está en `scripts/demo/acceso-rapido-demo-cuentas.tsv` (ámbito, rótulo, correo): cámbiala por las cuentas de validación cuando se haga la siembra integral. La clave sale de `SIMUS_DEMO_CLAVE` (por omisión `admin`) al escribir el archivo.
- **Activar:** `./scripts/demo/acceso-rapido-demo.sh escribir` (lo hace `scripts/demo/reiniciar-demo.sh` solo, antes de levantar la web).
- **Desactivar:** `./scripts/demo/acceso-rapido-demo.sh quitar` (o borrar `simus-web/public/config-demo.js`); en el reinicio, `SIMUS_DEMO_SIN_ACCESO_RAPIDO=1`. Para quitarlo del código por completo: borrar `simus-web/src/app/dev/acceso-rapido-demo/`, el bloque marcado en `main.ts` y el reemplazo en `angular.json`.
## 11.9 Modo mantenimiento

Para dejar el sitio en pausa (una actualización, una migración) sin apagar el contenedor, la API tiene un modo
mantenimiento. **Viene apagado por omisión** y se controla solo con configuración (variables de entorno):

| Variable | Efecto |
|---|---|
| `Mantenimiento__Activo=true` | Enciende el modo. Quitarla (o `false`) lo apaga; no hay nada más que revertir. |
| `Mantenimiento__Mensaje` | Texto opcional que se muestra en la pantalla (máximo 300 caracteres). |
| `Mantenimiento__HastaAprox` | Hora estimada de regreso, ISO 8601 (`2026-11-22T14:00:00-05:00`). Ajusta `Retry-After` y se muestra en la pantalla. |

Encendido, toda ruta bajo `/api/` responde `503` con `Retry-After` (por omisión 300 s; entre 30 s y 1 h si hay
hora estimada) y la cabecera `X-Mantenimiento: 1`. **No se afecta**: `/health/live` y `/health/ready` (el
orquestador no debe reiniciar el contenedor), los ficheros del front y `index.html` (hacen falta para pintar la
pantalla), y las rutas de quien administra: `/api/v1/admin/` (la consola, que sigue exigiendo su sesión y sus
permisos) y `/api/v1/csrf`. No hay cabecera secreta ni rutas nuevas. Las rutas externas (`/api/v1/externo/`,
`/api/v1/institucional/`, públicas) sí quedan en pausa.

La web detecta ese `503` marcado y lleva a `/mantenimiento`: pantalla completa con la identidad de SIMUS, el
mensaje, la hora estimada, «Reintentar» (también reintenta sola cada minuto) y las redes oficiales del
Ministerio. Si la API no responde del todo (sin respuesta, o `502`/`504` y tampoco contesta `/health/live`),
muestra «No logramos conectar con SIMUS». La pantalla también abre directa en `/mantenimiento` y dice si el
servicio está sano. Sus textos están en el código, no en el CMS, porque el CMS depende de la API. Un `503` sin
la marca no se trata como mantenimiento. La consola (`/administracion`) no es interrumpida por el aviso.

```bash
# Encender (ejemplo con la API local; en Azure, en la configuración de la aplicación)
Mantenimiento__Activo=true Mantenimiento__HastaAprox=2026-11-22T14:00:00-05:00 ./scripts/local/api-local.sh
```

La demo (`scripts/demo/verificar-demo-sembrada.sh`, `scripts/demo/reiniciar-demo.sh`) y los e2e no se ven afectados porque
el modo está apagado: no lo enciendas mientras corran, o sus llamadas a `/api/` recibirán `503`.

## 11.7 Reiniciar la demostración

La demostración (API en 8180, web en 4300) corre el código que tenía al levantarse y no se actualiza sola. Para ponerla al día:

```bash
git pull --ff-only
./scripts/demo/reiniciar-demo.sh --si      # reconstruye SIMUS_LOCAL, siembra, levanta y verifica
```

Sin `--si` el guion solo explica lo que haría. Termina con `scripts/demo/verificar-demo-sembrada.sh`; si imprime «Demo completa», la base y la API están bien. La sesión abierta se cierra al reiniciar. Antes de un reinicio conviene correr la validación completa (`scripts/validacion/validar-hito.sh`, ver `docs/desarrollo/10-pruebas.md`).
