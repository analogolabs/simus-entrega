# 10. Pruebas

## 10.1 Qué se comprueba

| Suite | Qué cubre |
|---|---|
| Pruebas del API (.NET) | dominio, endpoints, persistencia y contrato; incluye pruebas contra SQL Server real |
| Pruebas del frontend (Angular) | componentes, servicios, guardas de ruta y comportamiento de pantalla |
| Pruebas de los guiones de operación | que los guiones de `scripts/` hacen lo que declaran |
| Verificación de estructura | que el repositorio conserva su forma y no reaparece material retirado |
| Trinquetes | límites cuantificados que no pueden empeorar |
| Línea de la base SIMUS del Ministerio | instalación completa y actualización con Flyway, misma estructura en ambos caminos y en la cadena DbUp |

### Cifras (corte del 20 de noviembre de 2026, `main` en `e13002c4`)

Recuentos por análisis de texto del código; el total que reporta cada ejecutor se confirma corriendo y puede diferir (filas de
`[Theory]`, `MemberData`, pruebas en bucle y omisiones).

| Suite | Cifra |
|---|---|
| API (xUnit) | 217 clases; 1 349 `[Fact]`, 114 `[Theory]` (456 filas `InlineData`) y 154 `[HechoSqlServer]`: **1 617 métodos**, al menos 1 959 pruebas ejecutadas esperadas. 157 métodos en 52 clases del carril de SQL Server; el resto corre sobre SQLite en memoria |
| Frontend (Karma/Jasmine) | 283 archivos `*.spec.ts`, 406 `describe` y **2 552** casos `it(` (Karma reportó **2 567** ejecutadas, todas correctas, el 20 de noviembre de 2026); ninguno omitido ni enfocado |
| Navegador (Playwright) | 56 especificaciones en `e2e/` (144 llamadas `test(`, 110 con etiqueta `@backend`) y 3 barridos en `e2e-audit/` |
| Guiones de operación | 14 casos Python en `scripts/tests/` |
| Trinquetes | 3 archivos de techo (`techo-any`, `techo-interfaz`, `techo-tokens`); 19 métricas de interfaz y el techo de `any` en 286 |

## 10.2 Cómo se ejecutan

```bash
# Estructura del repositorio
./scripts/validacion/verificar-estructura.sh

# Guiones de operación
bash scripts/validacion/tests/run-script-tests.sh

# Frontend: lint, trinquetes, pruebas y compilación
cd simus-web && npm run lint && npm run trinquete && npm test && npm run build

# API
cd simus-api && dotnet build SIMUS.Api.sln --configuration Release
dotnet test simus-api/tests/SIMUS.Api.Tests/SIMUS.Api.Tests.csproj
# o, repartida en procesos paralelos (SIMUS_API_PARTICIONES, por omisión 3), con la API ya compilada:
(cd simus-api && ../scripts/validacion/pruebas-api-en-paralelo.sh)

# Validación completa de hito sobre main (web, API completa, SQL Server y humo)
./scripts/validacion/validar-hito.sh

# Base SIMUS del Ministerio (necesita Docker y sqlcmd)
./scripts/validacion/validar-simus-ministerio.sh --estado-inicial <exportación.sql> --comparar-con-desarrollo
```

### Pruebas de navegador (recorridos)

Comprueban en un navegador de verdad que los recorridos de la demostración funcionan en
pantalla, no solo en la API. Necesitan la base de demostración y la aplicación en marcha:

```bash
./scripts/demo/reconstruir-demo-local.sh && ./scripts/local/dev-up.sh
cd simus-web && npx playwright install chromium     # solo la primera vez
SIMUS_BASE_URL=http://127.0.0.1:4300 npx playwright test e2e/recorrido-del-festival.spec.ts \
  e2e/recorrido-del-perfil-publico.spec.ts e2e/festivales-y-ediciones.spec.ts e2e/teclado-sitio-publico.spec.ts
```

`recorrido-del-festival` cubre D3–D4 en unos 15 segundos: la organización registra un Festival con el
asistente y lo envía; el funcionario pide un ajuste en un campo; la organización lo corrige y lo
reenvía; el funcionario lo publica y el Festival aparece en el buscador del mapa. Escribe un Festival
nuevo en cada ejecución. `festivales-y-ediciones` registra tres Festivales con tres, dos y cero
ediciones, y `teclado-sitio-publico` recorre con el tabulador noticias, la tarjeta del Plan en la
portada y los hitos de «Sobre el PNMC». `recorrido-del-perfil-publico` crea una cuenta individual nueva, entra por `/ingresar`, guarda
su perfil público (nace oculto), lo publica, lo ve sin sesión en `/ecosistema/personas/:clave`, lo
oculta y comprueba que la ficha dice «Perfil no disponible» y que la API responde 404. Las piezas
comunes del panel de organización están en `e2e/apoyo/organizacion.ts`.

## 10.3 Pruebas contra SQL Server

Las pruebas que necesitan una base real están desactivadas por omisión. Para ejecutarlas hace falta
la base local en marcha y la variable de activación:

```bash
./scripts/local/local-db-up.sh
set -a && source .env && set +a
export SIMUS_PRUEBAS_SQLSERVER=1
dotnet test simus-api/tests/SIMUS.Api.Tests/SIMUS.Api.Tests.csproj
```

Cada clase de prueba construye y destruye su propia base, de modo que no dependen del orden ni se
contaminan entre sí. (Una prueba que necesite algo sembrado, como la organización institucional, lo
crea ella misma: depender de lo que sembró otra prueba la deja pasar o fallar según el orden en que
corra, y así dejó una en rojo en `main` el 10 de noviembre de 2026.)

### La pasada rápida de SQL Server

La validación local (`scripts/validacion/validar-local.sh`) corre la suite de la API sobre SQLite, que no tiene
los CHECK, las claves foráneas ni los índices únicos del esquema real. Lo que escribe bitácora o
historial, o depende de una restricción, solo se comprueba contra SQL Server; y la pasada completa
tarda de 15 a 30 minutos, así que nadie la repite en cada fusión. Por eso existe
`scripts/validacion/validar-sqlserver-rapido.sh`: corre solo las clases de prueba cuyo nombre lleva
«SqlServer» (`--filter "FullyQualifiedName~SqlServer"`), que son las que dependen del motor real.

```bash
# Suelta, sobre una copia de trabajo (necesita el SQL Server local en marcha: ./scripts/local/dev-up.sh)
./scripts/validacion/validar-sqlserver-rapido.sh [ruta-del-repositorio]

```

Lee la contraseña SQL de `SIMUS_LOCAL_SA_PASSWORD` (del entorno o, si falta, solo esa línea del `.env`)
y no la imprime; **no carga el `.env` entero** en el entorno de las pruebas. Usa una base desechable
con prefijo `SIMUS_PRUEBAS_`: nunca toca `SIMUS_LOCAL`. Si el contenedor no está en marcha, falla con
un mensaje en lugar de dar la pasada por buena. No sustituye a la pasada completa antes de un cambio
grande: complementa a la validación local cuando el cambio toca bitácora, historial, migraciones o restricciones.

### Pruebas de API dirigidas

La suite completa de la API tardaba más de dos horas con la máquina cargada, y se repetía por cada cambio que tocara
`simus-api/` o `simus-database/`. Ahora puede pedirse `SIMUS_VALIDAR_API=dirigida` y
`scripts/validacion/decidir-alcance-de-api.sh` decide el alcance:

| `SIMUS_VALIDAR_API` | Efecto |
|---|---|
| `dirigida` | Si el diff toca `simus-api/` o `simus-database/`, corre **solo** las clases de prueba relacionadas. |
| `completa` o `1` | Siempre la suite completa. |
| sin definir (`validar-local.sh` suelto) | Como siempre: completa ante cualquier cambio en esas carpetas. |

**Cómo se relaciona un archivo con sus pruebas.** `Endpoints/X.cs`, `ConsultaGuiada/X.cs` e `ImportacionAsistida/DominioDeX.cs`
corren las clases cuyo nombre contiene «X» más las que citan un tipo declarado en el archivo; una clase de prueba
cambiada se corre a sí misma; `scripts/validacion/mapa-de-pruebas-de-api.txt` añade reglas explícitas. Ante CUALQUIER archivo
sin relación conocida, o transversal, **corre la suite completa**: `Program.cs`, `openapi.yaml`, `*.csproj`, `.sln`,
`appsettings*`, `Security/` (CSRF incluido), `Bootstrap/`, `Observability/`, `SIMUS.Contracts/`, `SIMUS.Domain/`,
`SIMUS.Infrastructure/` (persistencia), `SIMUS.Migrador/`, todo `simus-database/` (DbUp, esquema, siembra), los
auxiliares de pruebas, `Services/` e `Historial/` sin regla, y cualquier diff que añada o quite una ruta (`.MapGet`,
`.MapPost`, `.MapGroup`…, por las pruebas que cuentan rutas). Más de 40 clases relacionadas también manda a la completa.
Las pruebas del mapa están en `scripts/validacion/tests/test_decidir_alcance_api.sh` (corren en `run-script-tests.sh`).

**Riesgo asumido.** Una clase de prueba que ejercite el archivo cambiado sin nombrarlo ni citar sus tipos no correrá en
la pasada dirigida, y su fallo aparecería en la siguiente pasada completa. Se acepta porque los cambios de la API que más rompen a
otros (arranque, contratos, seguridad, persistencia, base, rutas) siempre van a completa. **Recomendación:** correr la
suite completa (`SIMUS_VALIDAR_API=completa ./scripts/validacion/validar-local.sh`) una vez antes de cada entrega y después de
cada lote grande, y siempre en lotes de seguridad o de API transversales. Si una regresión se escapa, se añade el
archivo al mapa o a la lista de transversales.

**Frontend.** Si el diff solo toca documentos (`docs/`, CHANGELOG, README), `validar-local.sh` omite
`npm ci`, lint, trinquete, Karma y build; `SIMUS_VALIDAR_WEB=completa` lo fuerza. Cualquier otro cambio corre todo.

### Suite de API partida en procesos paralelos

La etapa «pruebas api» de la suite completa tardaba cerca de 1 h 20 min (2.292 pruebas, SQLite, 10 núcleos). Ahora
`scripts/validacion/pruebas-api-en-paralelo.sh` (la llama `validar-local.sh` en modo completo) la reparte en
`SIMUS_API_PARTICIONES` procesos `dotnet test` (por omisión 3; `1` = un solo proceso como antes):

1. Lista las pruebas con `dotnet test --list-tests` y las agrupa por clase (se excluye `CarrilDeSqlServerNoSeOlvida`, como antes).
2. `scripts/validacion/repartir-pruebas-de-api.py` reparte las clases por peso, la más pesada primero al grupo menos cargado. El peso es
   el número de pruebas o, si existe `scripts/pesos-de-pruebas-de-api.txt` (o `SIMUS_API_PESOS`), los segundos medidos
   por clase. Para generarlo desde una corrida: `python3 -I scripts/validacion/repartir-pruebas-de-api.py pesos <carpeta-de-registros> scripts/pesos-de-pruebas-de-api.txt`
   (los `.trx` quedan en la carpeta de registros de cada corrida).
3. **Verificación automática antes de correr:** cada prueba listada debe caer en exactamente un filtro (ni sin correr ni
   dos veces); si no, el reparto se rechaza. Los filtros terminan en punto (`...Clase.`) para que `Agenda` no atrape a `AgendaSqlServer`.
4. Cada proceso corre `--no-build --filter <su grupo>`, con su propio registro, `.trx` y `TMPDIR`. Resultado agregado: rojo si
   cualquiera falla, y se listan las pruebas fallidas de todos los grupos. Las pruebas no comparten puertos (usan servidores
   en memoria) ni archivos (los temporales llevan GUID); el carril de SQL Server no corre aquí.
5. `SIMUS_API_HILOS=H` limita los hilos de xUnit por proceso (`xUnit.MaxParallelThreads`); por omisión se deja el valor de xUnit.

`SIMUS_API_SOLO_PLAN=1` solo lista, reparte y verifica. Las pruebas del reparto están en `scripts/validacion/tests/test_reparto_y_lote.sh`.

**Medición (21 de noviembre de 2026).** La máquina tenía otras colas (carga de 6 a 25), así que no se corrió la suite
completa. Con una muestra de 2 clases y 2 procesos las pruebas pasan y se agregan bien (41 pruebas en 58 s, repartidas
31/10). La suite sigue dominada por pruebas que levantan una aplicación completa (unos 2 s cada una, con poco uso de CPU
por proceso: ~120 % con dos procesos), de modo que no está limitada por los núcleos y repartirla en procesos
aprovecha los núcleos ociosos. Estimación con N=3 en una máquina sin otras colas: de 1 h 20 min a unos 30 a 40 min
(reparto en tercios de 764 pruebas); el dato real se anota al correr el primer hito.

## 10.4 Los trinquetes

Un trinquete es un límite numérico que **puede bajar pero no subir**. Hay tres archivos de techo en
`simus-web/trinquete/` (`techo-any`, `techo-interfaz`, `techo-tokens`) y dos comprobaciones principales:

- **`trinquete-any`** cuenta los usos de `any` en TypeScript y falla si superan el techo vigente.
- **`trinquete-interfaz`** vigila diecinueve métricas de interfaz —campos sin rótulo, rótulos escritos a
  mano, tipografías fuera de la escala y otras—.

Sirven para que la deuda no crezca en silencio: si un cambio la aumenta, la puerta lo dice en el
acto y el número queda a la vista.

## 10.5 Criterio de cierre

Un cambio se considera terminado cuando las cuatro comprobaciones de §10.2 pasan en verde, sin
pruebas omitidas, y cuando el trabajo de interfaz se ha comprobado además en navegador y en varias
resoluciones.

Las rutas o flujos que cambien el acceso a información deben cumplir además el protocolo y las
pruebas negativas de la [auditoría por superficie](12-acceso-por-superficie.md).

## 10.6 Matriz de validación por tipo de cambio

Qué hay que ejecutar como mínimo según lo que toca un PR. Un PR que toca varias filas suma sus
comprobaciones. El flujo de GitHub `comprobaciones.yml` (lint, trinquetes, pruebas y compilación de Angular; compilación y pruebas .NET sin
SQL Server) se lanza **solo a mano** (`workflow_dispatch`) para no gastar el cupo gratuito: los PR se validan en local con
`scripts/validacion/validar-local.sh`, que hace los mismos pasos. Ni uno ni otro **sustituye** las de esta tabla que necesitan base, navegador o mirada humana.

| Tipo de cambio | Obligatorio | Si aplica |
|---|---|---|
| **Solo documentación** | `git diff --check`; enlaces relativos que abren | — |
| **Interfaz** (plantillas, estilos, componentes) | `npm run lint`, `npm run trinquete`, pruebas de las áreas tocadas (`npx ng test --include=…`), `npm run build`; **navegador a 360 px y a 1366 px** | `npm run auditoria:interfaz` de las rutas tocadas, con la cifra antes y después; foco por teclado si cambian controles |
| **Rutas y navegación** | Lo de *Interfaz*; las rutas antiguas siguen llegando a su destino | `consola:secciones` (dentro de `trinquete`) si cambia la barra de la consola; actualizar `e2e-audit/rutas.ts` |
| **API y contrato** | `dotnet build` y `dotnet test`; `ContratoOpenApiTests` y, si el cambio es deliberado, `ACTUALIZAR_OPENAPI=1` **con el diff revisado** | Pruebas del frontend que consumen el endpoint |
| **Permisos y acceso** | Lo de *API*; pruebas **positivas y negativas** por rol (`403` a quien no debe) y protocolo de `docs/desarrollo/12-acceso-por-superficie.md` | Comprobar que la prueba falla con la regla anterior (mutación) |
| **Esquema de datos** (`simus-database/schema/`) | `migrar` sobre una **base desechable**; `ParidadEsquemaSinArranqueTests`; pruebas con `SIMUS_PRUEBAS_SQLSERVER=1` (§10.3) | `validar-simus-ministerio.sh` si afecta a la base del Ministerio. **Nunca** sobre bases reales sin autorización |
| **Semillas** (`simus-database/seed/`) | Ejecutarla **dos veces seguidas** sobre una base desechable y comparar conteos; `SemillasDeDemostracionTests` si es de demostración | `reconstruir-demo-local.sh` completo |
| **Configuración y arranque** (`appsettings*`, `Program.cs`) | `ArranqueEnProduccionTests`; paridad `Demo`/`Production` (`PoliticaDeConfirmacionDeCorreoTests`) | Arrancar la API en local y consultar `/health/ready` |
| **Guiones** (`scripts/`) | `bash -n` y `bash scripts/validacion/tests/run-script-tests.sh` | Ejecutarlo de verdad contra la base local o una desechable |
| **CI e infraestructura** (`.github/`, `infra/`) | Revisión del diff; declarar qué se aplicará a mano y quién lo aplica | Nada se aplica en Azure sin autorización expresa |

### Escritas, ejecutadas y pendientes

En la sección *Pruebas y evidencia* del PR cada comprobación se declara en uno de tres estados:

- **Escrita:** prueba nueva o modificada en este PR, con su nombre.
- **Ejecutada:** se corrió y se pega el resultado (`1088 correctas, 0 con error`), o se enlaza la
  ejecución (local o, si se lanzó a mano, de GitHub).
- **Pendiente:** no se pudo ejecutar; se dice **por qué** (falta SQL Server, falta proveedor de correo,
  requiere Azure…) y quién la hará.

### Lo que no se hace para conseguir verde

- Bajar o borrar una prueba que falla sin explicar por qué su expectativa era errónea.
- Aflojar un trinquete. Solo se **sella en la dirección de la mejora** (`--sellar`) cuando una cifra mejora.
- Regenerar el contrato OpenAPI sin revisar el diff.
- Marcar como ejecutada una prueba omitida o una que solo compiló.

## 10.7 Herramientas auxiliares

Hay herramientas que **no forman parte de la validación** (`validar-local.sh` ni el
carril de SQL Server) y que se ejecutan a mano, para mirar el estado de una base o de la interfaz, o para
poblar una base local. Ninguna se ejecuta sola; las que escriben datos lo dicen más abajo.

### Consultas de revisión de la base (solo lectura)

Están en `simus-database/scripts/`. Se ejecutan con `sqlcmd` o desde un cliente SQL contra una base local
(`SIMUS_LOCAL`, por ejemplo) y se **leen**: no devuelven «verde» o «rojo», muestran recuentos y hallazgos
para que una persona los interprete. La opción `-I` de `sqlcmd` no sobra: hay índices filtrados.

```bash
sqlcmd -S 127.0.0.1,14344 -U sa -P "<clave>" -d SIMUS_LOCAL -C -I -i simus-database/scripts/validar_calidad_de_datos.sql
```

| Archivo | Qué muestra | Cuándo usarla |
| --- | --- | --- |
| `validar_calidad_de_datos.sql` | Consultas rápidas de calidad: DIVIPOLA duplicada, noticias sin título, eventos de la Agenda sin fecha o territorio y otras incoherencias | Tras importar o sembrar datos, o al sospechar de datos sucios |
| `validar_maestras_estaticas.sql` | Recuentos y duplicados de las tablas maestras (DIVIPOLA, territorios sonoros, prácticas musicales, tipos de registro) | Tras cargar el catálogo territorial |
| `validar_administracion_control.sql` | Recuentos de roles, usuarios, estados, categorías, etiquetas, archivos y bitácora | Revisión rápida de una base nueva |
| `validar_contenidos_modulos.sql` | Recuentos de Agenda, Noticias, Galería y de los módulos del ecosistema, más registros con creador no válido | Tras sembrar contenidos |
| `validar_articulacion_lectura_comun.sql` | Recuentos de la lectura común (registros del ecosistema, métricas del mapa, etiquetas y archivos) y duplicados | Tras reconstruir las métricas del mapa |
| `validar_migracion_simus.sql` | Informe de salida de la migración de la base SIMUS del Ministerio: usuarios por número de roles, usuarios sin rol y otras comprobaciones | Al validar la línea de migraciones del Ministerio; acompaña a `./scripts/validacion/validar-simus-ministerio.sh` |

Ninguna modifica nada: se pueden ejecutar contra cualquier base local sin riesgo. Contra una base
institucional, solo con autorización expresa.

### Herramientas de navegador

Usan Playwright, abren el sitio de verdad y necesitan la pila local en marcha (`./scripts/local/dev-up.sh`:
web en 4300 y API en 8180 por omisión). Se ejecutan **desde `simus-web/`**.

| Herramienta | Qué hace | Cómo se ejecuta |
| --- | --- | --- |
| `tools/barrido-de-reparacion.mjs` | Recorre el portal, la consola administrativa, la gestión de la organización y el portal en un teléfono, y anota cada petición HTTP que falla, cada error de consola o de página y cada desborde horizontal, con la página donde ocurrió. Encuentra los 404 y 500 que las pruebas unitarias, que doblan la API, no ven | `node tools/barrido-de-reparacion.mjs` (imprime un JSON con los fallos; sin fallos, la lista sale vacía) |
| `tools/censo-de-la-consola.mjs` | Censo visual de la consola: por sección, cuántos tratamientos distintos hay para un mismo papel (título, pestaña, tabla, botón) y qué textos parecen notas internas. Sirve para vigilar la coherencia visual | `node tools/censo-de-la-consola.mjs [carpeta-de-salida]` (por omisión, `/tmp/censo-consola`) |

Ambas usan las cuentas de la demostración (`webmaster@simus.test`, `externo@simus.test`, clave `admin`), así
que necesitan la base de demostración (`./scripts/demo/reconstruir-demo-local.sh`). No escriben datos, más allá
de lo que escribe un inicio de sesión.

### Humo de navegador (opcional)

`scripts/validacion/humo-de-navegador.sh [ruta]` reconstruye una base desechable `SIMUS_PRUEBAS_HUMO` (nunca `SIMUS_LOCAL`),
levanta la API (8241) y la web (4361) desde la ruta indicada —la web es el build de producción servido estático con `tools/servidor-estatico.mjs --api`, no `ng serve` (D-08)—, corre 8 especificaciones Playwright (32 pruebas, minuto y medio) y, al terminar,
apaga los servidores y borra la base. No toca los puertos 8180 y 4300. Los recorridos cubren ingreso y panel
(`organizacion-activa-en-la-url`, `sesion-con-nombre-simus`), consola (`consola-arquitectura-de-informacion`,
`acciones-por-estado`), portal (`portal-publico-enlaces-y-agenda`, `directorios-estandar`) y escritura de punta a
punta (`recorrido-del-festival`, `festivales-y-ediciones`).

Es la única pasada que ve a la vez el navegador, la API y la base reales: Karma dobla la API y la API de la
validación local corre sobre SQLite. Viene apagada porque suma de 8 a 12 minutos; se corre a mano con
`./scripts/validacion/humo-de-navegador.sh` para cambios de pantallas y antes de una entrega. El barrido completo de todas las
pruebas `@backend` sigue siendo manual (`SIMUS_BASE_URL=… npx playwright test`).

### Poblar una base local por la interfaz

`simus-web/e2e/poblar/` tiene tres guiones `.seed.ts` y un archivo de datos (`datos.ts`). Se llaman «seed»
y no «spec» a propósito: la suite normal (`*.spec.ts`) nunca los recoge, porque **escriben** dieciocho
organizaciones y dieciocho Festivales, y repetirlos choca con el índice único del correo de contacto. Se
ejecutan con su propia configuración, `playwright.poblar.config.ts`, con el sitio en 4300 y la API en 8180,
y **solo contra una base local de desarrollo**:

```bash
cd simus-web
npx playwright test -c playwright.poblar.config.ts e2e/poblar/poblar.seed.ts   # crea organizaciones y Festivales
npx playwright test -c playwright.poblar.config.ts e2e/poblar/aprobar.seed.ts  # publica desde la consola los marcados como publicados
npx playwright test -c playwright.poblar.config.ts e2e/poblar/mirar.seed.ts    # deja capturas para revisar a ojo
```

- `poblar.seed.ts` da de alta las organizaciones y los Festivales **como lo haría una persona**, pulsando en
  la interfaz, para comprobar el circuito además de poblarlo. Con `POBLAR_SOLO=1` hace solo la primera
  organización (el piloto). Es re-ejecutable: si la cuenta ya existe, entra; si el Festival ya existe, no
  lo repite.
- `aprobar.seed.ts` se corre **después**. Publica por la consola los Festivales que el conjunto marca como
  `publicado`, de modo que, si una decisión no se registra, se vea aquí.
- `mirar.seed.ts` no comprueba nada por sí mismo: deja capturas de las pantallas que debían cambiar. La
  comprobación es mirarlas.
- `datos.ts` contiene los datos (los Festivales y municipios son reales; los códigos DIVIPOLA se leyeron de
  `dbo.Divipola`). Las contraseñas son literales **a propósito**: son cuentas de una base local de
  desarrollo que nunca se despliega.
- Las capturas quedan en `simus-web/e2e/capturas/poblar/` y no se versionan.
- La misma configuración recoge también `e2e/ajustes/auditar.seed.ts`.

Para una demostración completa, lo habitual no es esto sino las siembras SQL de `./scripts/demo/sembrar-demo.sh`,
que son mucho más rápidas. Estos guiones sirven cuando se quiere **ejercitar la interfaz**
mientras se puebla.
